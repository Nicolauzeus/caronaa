import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/admin/departments";
import { getDepartmentHome, getDepartmentOfPath } from "@/lib/admin/module-navigation";
import { AdminDepartmentTabs } from "@/components/admin/AdminDepartmentTabs";

type AdminProfile = {
  full_name: string;
  avatar_url: string | null;
};

const navigation = [
 {title:"Painel",items:[{label:"Visão geral",to:"/admin",icon:LayoutDashboard}]},
 {title:"Departamentos",items:[
  ...DEPARTMENTS.map(department=>({label:department.shortName,to:getDepartmentHome(department.id),icon:Building2}))
 ]}
];

function AdminNav({ mobile = false, onNavigate, query = "" }: { mobile?: boolean; onNavigate?: () => void; query?: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activeDepartment=getDepartmentOfPath(pathname);

  return (
    <nav className="space-y-6" aria-label="Admin navigation">
      {navigation.map((section) => ({ ...section, items: section.items.filter((item) => (item.label+" "+section.title).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) })).filter((section) => section.items.length).map((section) => (
        <div key={section.title}>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-normal text-muted-foreground/80">
            {section.title}
          </p>

          <div className="space-y-1">
            {section.items.map(({ label, to, icon: Icon }) => {
              const isRelacionamentos =
                (to === "/admin/relacionamentos" || to === "/admin/relacionamento") &&
                (pathname === "/admin/relacionamentos" || pathname === "/admin/relacionamento");
              const active =
                (section.title==="Departamentos"&&activeDepartment!==null&&to===getDepartmentHome(activeDepartment)) ||
                isRelacionamentos ||
                pathname === to ||
                (to !== "/admin" &&
                  pathname.startsWith(`${to}/`) &&
                  !navigation
                    .flatMap((group) => group.items)
                    .some(
                      (item) =>
                        item.to !== to &&
                        item.to.startsWith(`${to}/`) &&
                        (pathname === item.to || pathname.startsWith(`${item.to}/`)),
                    ));

              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    mobile ? "min-h-12" : "",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} />
                    {label}
                  </span>

                  <ChevronRight
                    size={14}
                    className={cn(active ? "text-primary-foreground" : "opacity-60")}
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

  const [mobileOpen, setMobileOpen] = useState(false);

  // Only the mobile drawer locks background scrolling.
  // Desktop pages continue to use the natural document scroll.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);
  const [navQuery, setNavQuery] = useState("");
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

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
    if(pathname==="/admin"||pathname==="/admin/")return "Visão geral";
    const deptId=getDepartmentOfPath(pathname);
    const dept=DEPARTMENTS.find(d=>d.id===deptId);
    return dept?.name??"Departamentos";
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

  return (
    <div className="admin-workspace min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1680px] items-start gap-6 p-3 md:p-5 lg:px-6 lg:py-0">
        <aside className="hidden w-[240px] shrink-0 border-r border-border bg-background pr-5 lg:sticky lg:top-0 lg:block lg:h-dvh lg:self-start lg:overflow-y-auto lg:overscroll-y-contain lg:py-6 lg:[scrollbar-width:thin]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link to="/admin" className="inline-flex items-center gap-3">
              <img src={logoAsset.url} alt="CARONAA" className="h-11 w-auto object-contain" />

              <div>
                <p className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground">
                  Administração
                </p>
              </div>
            </Link>


          </div>

          <AdminNav query={navQuery} />


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
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                    CARONAA admin
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">{breadcrumb}</p>
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
                    onChange={(event) => { setNavQuery(event.target.value); if (window.innerWidth < 1024) setMobileOpen(true); }}
                    className="h-10 rounded-xl border-border bg-background pl-9 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <ThemeToggle />

                  <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                    <Link to="/home">
                      <ArrowLeft size={14} className="mr-1" />
                      Voltar ao app
                    </Link>
                  </Button>

                  <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1.5">
                    <Avatar className="h-8 w-8">
                      {adminAvatar ? <AvatarImage src={adminAvatar} alt={adminName} /> : null}

                      <AvatarFallback>{adminInitials}</AvatarFallback>
                    </Avatar>

                    <div className="hidden max-w-[150px] text-left sm:block">
                      <p className="truncate text-xs font-semibold text-foreground">{adminName}</p>

                      <p className="text-[10px] text-muted-foreground">Administrador</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <AdminDepartmentTabs />

          <main className="px-0 py-5 md:py-6">{children}</main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm lg:hidden" role="presentation" onKeyDown={(event) => { if (event.key === "Escape") setMobileOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Menu administrativo" className="h-dvh w-[82%] max-w-xs overflow-y-auto overscroll-y-contain border-r border-border bg-card p-4 shadow-soft [scrollbar-width:thin]">
            <div className="mb-5 flex items-center justify-between">
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="font-display text-xl font-extrabold"
              >
                CARONAA Admin
              </Link>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu administrativo"
              >
                <X size={18} />
              </Button>
            </div>

            <Input aria-label="Buscar seção no menu" placeholder="Buscar seção" value={navQuery} onChange={(event) => setNavQuery(event.target.value)} className="mb-4" />
            <AdminNav mobile query={navQuery} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
