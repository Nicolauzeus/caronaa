import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  BriefcaseBusiness,
  Code2,
  Route,
  TrendingUp,
  FlaskConical,
  Handshake,
  Headset,
  Wallet,
  Scale,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Menu,
  Search,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/admin/departments";
import { useAdminAccess, hasDepartmentAccess } from "@/lib/admin/access";
import { enterAdminAppPreview, type AdminEntryRoute } from "@/lib/admin/entry";
import { getDepartmentHome, getDepartmentOfPath } from "@/lib/admin/module-navigation";
import { AdminDepartmentTabs } from "@/components/admin/AdminDepartmentTabs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type AdminProfile = {
  full_name: string;
  avatar_url: string | null;
};

const departmentIcons = {
  executive: BriefcaseBusiness,
  technology: Code2,
  operations: Route,
  growth: TrendingUp,
  research: FlaskConical,
  partnerships: Handshake,
  safety: Headset,
  finance: Wallet,
  compliance: Scale,
};
const navigation = [
  { title: "Painel", items: [{ label: "Visão geral", to: "/admin", icon: LayoutDashboard }] },
  {
    title: "Departamentos",
    items: [
      ...DEPARTMENTS.map((department) => ({
        label: department.shortName,
        to: getDepartmentHome(department.id),
        icon: departmentIcons[department.id] ?? Building2,
      })),
    ],
  },
];

function AdminNav({
  mobile = false,
  onNavigate,
  query = "",
  collapsed = false,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  query?: string;
  collapsed?: boolean;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activeDepartment = getDepartmentOfPath(pathname);
  const scope = useAdminAccess();

  return (
    <nav className="space-y-6" aria-label="Navegação administrativa">
      {query &&
        !navigation.some((section) =>
          section.items.some((item) =>
            item.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
          ),
        ) && (
          <p role="status" className="px-3 text-sm text-muted-foreground">
            Nenhuma seção encontrada.
          </p>
        )}
      {navigation
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            (section.title !== "Painel" || scope.isGlobalAdmin) &&
            (section.title !== "Departamentos" || DEPARTMENTS.some((dept) =>
              getDepartmentHome(dept.id) === item.to && hasDepartmentAccess(scope, dept.id))) &&
            (item.label + " " + section.title)
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
          ),
        }))
        .filter((section) => section.items.length)
        .map((section) => (
          <div key={section.title}>
            <p
              className={
                collapsed
                  ? "sr-only"
                  : "mb-3 px-3 text-[11px] font-bold uppercase tracking-normal text-muted-foreground/80"
              }
            >
              {section.title}
            </p>

            <div className="space-y-1">
              {section.items.map(({ label, to, icon: Icon }) => {
                const active =
                  section.title === "Departamentos"
                    ? activeDepartment !== null && to === getDepartmentHome(activeDepartment)
                    : pathname.replace(/\/$/, "") === to;

                return (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: true }}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      mobile ? "min-h-12" : "",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={16} />
                      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
                    </span>

                    <ChevronRight
                      size={14}
                      className={cn(
                        collapsed && "hidden",
                        active ? "text-primary-foreground" : "opacity-60",
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
    </nav>
  );
}

function getMetadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return initials || "AD";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const scope = useAdminAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [navQuery, setNavQuery] = useState("");
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const department = DEPARTMENTS.find((item) => item.id === getDepartmentOfPath(pathname));

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (query.matches) setMobileOpen(false);
    };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setProfile(null);
      return () => {
        active = false;
      };
    }

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error) {
        console.error("[AdminShell] Não foi possível carregar o perfil do administrador.", error);
        setProfile(null);
        return;
      }

      setProfile(
        data
          ? {
              full_name: data.full_name ?? "",
              avatar_url: data.avatar_url ?? null,
            }
          : null,
      );
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const breadcrumb = useMemo(() => {
    if (pathname === "/admin" || pathname === "/admin/") return "Visão geral";
    const deptId = getDepartmentOfPath(pathname);
    const dept = DEPARTMENTS.find((d) => d.id === deptId);
    return dept?.name ?? "Departamentos";
  }, [pathname]);

  const adminName = useMemo(() => {
    const profileName = profile?.full_name?.trim();

    if (profileName) {
      return profileName;
    }

    const metadataName =
      getMetadataString(user?.user_metadata as Record<string, unknown> | undefined, "full_name") ??
      getMetadataString(user?.user_metadata as Record<string, unknown> | undefined, "name");

    if (metadataName) {
      return metadataName;
    }

    const emailName = user?.email?.split("@")[0]?.trim();

    return emailName || "Administrador";
  }, [profile?.full_name, user]);

  const adminAvatar = useMemo(() => {
    if (profile?.avatar_url) {
      return profile.avatar_url;
    }

    return (
      getMetadataString(user?.user_metadata as Record<string, unknown> | undefined, "avatar_url") ??
      getMetadataString(user?.user_metadata as Record<string, unknown> | undefined, "picture")
    );
  }, [profile?.avatar_url, user]);

  const adminInitials = useMemo(() => getInitials(adminName), [adminName]);
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error("Não foi possível encerrar a sessão. Tente novamente."); return; }
    void navigate({ to: "/auth", replace: true });
  }
  function switchToApp() {
    if (!user?.id) return;
    const returnTo: AdminEntryRoute = scope.isGlobalAdmin
      ? "/admin" : getDepartmentHome(scope.departments[0]?.id ?? "technology") as AdminEntryRoute;
    enterAdminAppPreview(user.id, returnTo);
  }

  return (
    <div className="admin-workspace min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1680px] items-start gap-6 p-3 md:p-5 lg:px-6 lg:py-0">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-border bg-muted/20 pr-3 lg:sticky lg:top-0 lg:block lg:h-dvh lg:self-start lg:overflow-y-auto lg:overscroll-y-contain lg:py-6 lg:[scrollbar-width:thin]",
            collapsed ? "w-[64px]" : "w-[240px]",
          )}
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            {!collapsed && (
              <Link to={scope.isGlobalAdmin ? "/admin" : getDepartmentHome(scope.departments[0]?.id ?? "technology")} className="inline-flex min-w-0 items-center gap-2">
                <img src={logoAsset.url} alt="CARONAA" className="h-auto w-28 object-contain" />
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
              title={collapsed ? "Expandir navegação" : "Recolher navegação"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          </div>

          <AdminNav query={navQuery} collapsed={collapsed} />
        </aside>

        <div className="min-w-0 flex-1 lg:py-6">
          <header className="border-b border-border bg-background px-1 py-3 md:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Abrir menu administrativo"
                >
                  <Menu size={18} />
                </Button>

                <div>
                  <nav
                    aria-label="Caminho administrativo"
                    className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Link to={scope.isGlobalAdmin ? "/admin" : getDepartmentHome(scope.departments[0]?.id ?? "technology")} className="font-medium hover:text-foreground">
                      Admin
                    </Link>
                    <ChevronRight size={14} aria-hidden="true" />
                    <span aria-current="page">{breadcrumb}</span>
                  </nav>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-end">
                <div className="relative w-full md:max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={16}
                  />

                  <Input
                    aria-label="Buscar seção administrativa"
                    placeholder="Buscar seção do painel"
                    value={navQuery}
                    onChange={(event) => {
                      setNavQuery(event.target.value);
                      if (window.innerWidth < 1024) setMobileOpen(true);
                    }}
                    className="h-10 rounded-xl border-border bg-background pl-9 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Button type="button" variant="ghost" size="icon"
                    aria-label="Sair do painel administrativo" title="Sair do painel"
                    onClick={() => void signOut()}>
                    <LogOut size={17} />
                  </Button>

                  <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                    <Link to="/home" preload={false} onClick={switchToApp}>
                      <ArrowLeft size={14} className="mr-1" />
                      Visualizar aplicativo
                    </Link>
                  </Button>

                  <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1.5">
                    <Avatar className="h-8 w-8">
                      {adminAvatar ? <AvatarImage src={adminAvatar} alt={adminName} /> : null}

                      <AvatarFallback>{adminInitials}</AvatarFallback>
                    </Avatar>

                    <div className="hidden max-w-[150px] text-left sm:block">
                      <p className="truncate text-xs font-semibold text-foreground">{adminName}</p>

                      <p className="text-[10px] text-muted-foreground">{scope.isGlobalAdmin ? "Administrador" : "Equipe administrativa"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {department && (
            <AdminPageHeader title={department.name} description={department.mission} />
          )}
          <AdminDepartmentTabs />

          <main className="px-0 py-5 md:py-6">{children}</main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="admin-workspace h-dvh w-[85%] max-w-xs overflow-y-auto overscroll-y-contain p-4"
        >
          <div className="mb-5 flex items-center justify-between">
            <Link
              to={scope.isGlobalAdmin ? "/admin" : getDepartmentHome(scope.departments[0]?.id ?? "technology")}
              onClick={() => setMobileOpen(false)}
              className="font-display text-xl font-extrabold"
            >
              CARONAA Admin
            </Link>

            <SheetTitle className="sr-only">Menu administrativo</SheetTitle>
            <SheetDescription className="sr-only">
              Navegação entre as áreas administrativas.
            </SheetDescription>
          </div>

          <Input
            aria-label="Buscar seção no menu"
            placeholder="Buscar seção"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            className="mb-4"
          />
          <AdminNav mobile query={navQuery} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-5 border-t border-border pt-4">
            <Button asChild variant="outline" className="min-h-11 w-full justify-start">
              <Link to="/home" preload={false} onClick={() => { switchToApp(); setMobileOpen(false); }}>
                <ArrowLeft size={16} className="mr-2" />
                Visualizar aplicativo
              </Link>
            </Button>
          </div>
          <Button type="button" variant="ghost" className="mt-3 min-h-11 w-full justify-start text-destructive"
            onClick={() => { setMobileOpen(false); void signOut(); }}>
            <LogOut size={16} className="mr-2" />
            Sair da conta
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
