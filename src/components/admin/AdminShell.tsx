import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  FileText,
  Gauge,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { currentUser } from "@/mockData";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";

const navigation = [
  { title: "Visão Geral", items: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard }] },
  {
    title: "Operação",
    items: [
      { label: "Caronas", to: "/admin/caronas", icon: Gauge },
      { label: "Solicitações", to: "/admin/solicitacoes", icon: FileText },
      { label: "Matching", to: "/admin/matching", icon: Activity },
    ],
  },
  {
    title: "Pessoas",
    items: [
      { label: "Usuários", to: "/admin/usuarios", icon: Users },
      { label: "Motoristas", to: "/admin/motoristas", icon: Building2 },
      { label: "Passageiros", to: "/admin/passageiros", icon: Users },
    ],
  },
  {
    title: "Validação",
    items: [
      { label: "Oportunidades", to: "/admin/oportunidades", icon: Gauge },
      { label: "Formulários", to: "/admin/formularios", icon: FileText },
      { label: "Respostas", to: "/admin/formularios/respostas", icon: FileText },
      { label: "Validação", to: "/admin/validacao", icon: ShieldCheck },
    ],
  },
];

function AdminNav({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="space-y-6" aria-label="Admin navigation">
      {navigation.map((section) => (
        <div key={section.title}>
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80">
            {section.title}
          </p>
          <div className="space-y-1">
            {section.items.map(({ label, to, icon: Icon }) => {
              const active = pathname === to || pathname.startsWith(`${to}/`);

              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const breadcrumb = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (!parts.length) {
      return "Dashboard";
    }

    return parts
      .map((segment) => segment.replace(/-/g, " "))
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" / ");
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1680px] gap-5 p-3 md:p-5 lg:p-6">
        <aside className="hidden w-[280px] shrink-0 rounded-2xl border border-border bg-card/85 p-4 shadow-soft backdrop-blur-md lg:block">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link to="/admin" className="inline-flex items-center gap-3">
              <img src={logoAsset.url} alt="CARONAA" className="h-11 w-auto object-contain" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Admin Center
                </p>
              </div>
            </Link>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              live
            </span>
          </div>

          <AdminNav />

          <div className="mt-8 rounded-xl border border-border bg-secondary/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Segurança
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">Controle administrativo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Acesso liberado para perfil com autorização ativa.
            </p>
          </div>
        </aside>

        <div className="flex-1">
          <header className="rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-soft backdrop-blur-md md:px-5">
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
                    aria-label="Busca global administrativa"
                    placeholder="Buscar usuário, carona ou protocolo"
                    className="h-10 rounded-xl border-border bg-background pl-9 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Ambiente: produção
                  </span>
                  <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                    <Link to="/home">
                      <ArrowLeft size={14} className="mr-1" />
                      Voltar ao app
                    </Link>
                  </Button>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Notificações administrativas"
                  >
                    <Bell size={16} />
                  </button>
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1.5">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.photo} alt={currentUser.name} />
                      <AvatarFallback>{currentUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <p className="text-xs font-semibold text-foreground">Admin</p>
                      <p className="text-[10px] text-muted-foreground">Operação</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="px-0 py-5 md:py-6">{children}</main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm lg:hidden">
          <div className="h-full w-[82%] max-w-xs border-r border-border bg-card p-4 shadow-soft">
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
              >
                <X size={18} />
              </Button>
            </div>
            <AdminNav mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
