import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarClock,
  LogIn,
  LogOut,
  Menu,
  UserRound,
  X,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getAdminAppPreview, leaveAdminAppPreview } from "@/lib/admin/entry";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";
import { NotificationControls } from "@/components/caronaa/NotificationControls";
import { PublicFooter } from "@/components/caronaa/PublicFooter";
import { MobileAccountDrawer } from "@/components/caronaa/MobileAccountDrawer";
import { ProfessionalRadarSync } from "@/components/caronaa/ProfessionalRadarSync";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";
import { clearRideIntentDraft } from "@/lib/ride-intent-draft";
import { authenticatedNav, isAppNavSelected } from "@/components/caronaa/shell/app-navigation";

const waitingNav = [
  { to: "/aguardando" as const, label: "Lançamento", icon: CalendarClock },
  { to: "/perfil" as const, label: "Meu perfil", icon: UserRound },
];

const professionalNav = [
  { to: "/disponibilidade-profissional" as const, label: "Painel", icon: LayoutDashboard },
  { to: "/viagens-profissionais" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Conta", icon: UserRound },
];

export function Brand({ light = false }: { light?: boolean }) {
  const { user } = useAuth();
  return (
    <Link to={user ? "/home" : "/"} className="inline-flex items-center" aria-label="CARONAA — página inicial">
      <img
        src={logoAsset.url}
        alt="CARONAA"
        className={`h-9 w-auto max-w-[120px] object-contain sm:h-11 sm:max-w-none ${light ? "brightness-0 invert" : ""}`}
      />
    </Link>
  );
}

export function AppShell({
  children,
  publicPage = false,
  prelaunchMode = false,
  mapLayout = false,
}: {
  children: ReactNode;
  publicPage?: boolean;
  prelaunchMode?: boolean;
  mapLayout?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeIntent = useRouterState({ select: (state) => (state.location.search as {intent?:string}).intent });
  const selectedNav = (to: string, label: string) => isAppNavSelected(pathname, activeIntent, to, label);
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { data: professionalNavigation, isPending: professionalAccessPending } = useQuery({
    queryKey: ["caronaa", "professional-navigation", user?.id ?? "guest"],
    enabled: Boolean(user?.id) && !publicPage && !prelaunchMode,
    staleTime: 15_000,
    gcTime: 120_000,
    retry: false,
    queryFn: async () => {
      if (!user?.id) return { professionalOnly: false, activeRole: null as "PASSAGEIRO" | "MOTORISTA" | null };
      // This only selects the navigation surface. F07 permissions are still
      // enforced by the database and authenticated route guards.
      const [access, roleRow] = await Promise.all([
        (supabase as any).rpc("get_my_professional_access"),
        (supabase as any).from("profiles").select("active_role")
          .eq("id", user.id).maybeSingle(),
      ]);
      const activeRole = roleRow.error ? null :
        roleRow.data?.active_role === "MOTORISTA" ? "MOTORISTA" as const :
        roleRow.data?.active_role === "PASSAGEIRO" ? "PASSAGEIRO" as const : null;
      return {
        activeRole,
        professionalOnly: !access.error && !roleRow.error &&
          access.data?.authorized === true && activeRole === "MOTORISTA",
      };
    },
  });
  const professionalOnly = !user || publicPage || prelaunchMode ? false
    : professionalAccessPending ? null : professionalNavigation?.professionalOnly === true;
  useEffect(() => {
    if (!user?.id || publicPage || prelaunchMode) return;
    const onRoleChanged = () => {
      void queryClient.invalidateQueries({
        queryKey: ["caronaa", "professional-navigation", user.id],
      });
    };
    window.addEventListener("caronaa:role-changed", onRoleChanged);
    return () => window.removeEventListener("caronaa:role-changed", onRoleChanged);
  }, [queryClient, user?.id, publicPage, prelaunchMode]);
  const navigation = prelaunchMode ? waitingNav : professionalOnly === true ? professionalNav : professionalOnly === null ? [] : authenticatedNav;
  const adminPreview = !publicPage ? getAdminAppPreview(user?.id) : null;
  const navigate = useNavigate();
  async function signOut() {
    clearRideIntentDraft();
    if (user && typeof window !== "undefined") {
      // Revoke this device's GPS opt-in before terminating the session.
      window.localStorage.removeItem(professionalRadarConsentKey(user.id));
      try { await (supabase as any).rpc("professional_location_stop"); } catch { /* Session may already be gone. */ }
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className={mapLayout?"flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground":"min-h-screen flex flex-col bg-background text-foreground"}>
      {/* The availability screen owns the first GPS watcher. On navigation away,
          this shared watcher mounts and resumes the same explicit consent,
          without running two GPS transmitters/rate-gate calls in parallel. */}
      {!publicPage && !prelaunchMode && user &&
        pathname !== "/disponibilidade-profissional" &&
        <ProfessionalRadarSync userId={user.id} />}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${professionalOnly ? "border-white/10 bg-[#121212] text-white" : "border-border/80 bg-background/95"}`}>
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-3 sm:h-16 sm:px-5 lg:px-8">
          {/* Logo CARONAA */}
          <div className="min-w-0 shrink-0">
            <Brand />
          </div>
          {!publicPage && user && (
            <span className="ml-auto hidden min-w-0 truncate text-sm font-bold text-foreground min-[380px]:block lg:hidden" aria-label="Saudação">
              Olá, {String(user.user_metadata.full_name || user.user_metadata.name || user.email?.split("@")[0] || "você").trim().split(/\s+/)[0]}!
            </span>
          )}

          {/* Navegação DESKTOP para Páginas Públicas */}
          {publicPage ? (
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação institucional">
              <Link
                to="/como-funciona"
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${
                  pathname === "/como-funciona"
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground"
                }`}
              >
                Como funciona
              </Link>
              <Link
                to="/seguranca"
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${
                  pathname === "/seguranca" ? "bg-secondary text-primary" : "text-muted-foreground"
                }`}
              >
                Segurança
              </Link>
              <Link
                to="/auth"
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${
                  pathname === "/auth" ? "bg-secondary text-primary" : "text-muted-foreground"
                }`}
              >
                Entrar
              </Link>
            </nav>
          ) : (
            /* Navegação DESKTOP para Área Autenticada */
            <nav className={professionalOnly ? "hidden" : "hidden items-center gap-1 lg:flex"} aria-label="Navegação principal">
              {navigation.map(({ to, label }) => (
                <Link
                  key={`${to}-${label}`}
                  to={to}
                  search={to==="/home" ? {intent:label==="Oferecer"?"offer":undefined} : undefined}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${
                    selectedNav(to,label) ? "bg-secondary text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}

          {/* Área Direita do Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="hidden md:inline-flex" />
            {user && (
              <div className="hidden lg:block">
                <NotificationControls />
              </div>
            )}

            {publicPage ? (
              !loading &&
              !user && (
                <>
                  {/* CTA Destacado no DESKTOP: 'Encontrar minha CARONAA' */}
                  <Button
                    asChild
                    variant="strong"
                    className="hidden h-10 rounded-xl px-5 font-bold shadow-soft lg:inline-flex"
                  >
                    <Link to="/auth" search={{ mode: "cadastro" }}>
                      Encontrar minha CARONAA
                    </Link>
                  </Button>

                  {/* CTA no MOBILE: 'Participar' */}
                  <Button
                    asChild
                    size="sm"
                    variant="strong"
                    className="h-8.5 rounded-xl px-3.5 text-xs font-extrabold shadow-soft lg:hidden"
                  >
                    <Link to="/auth" search={{ mode: "cadastro" }}>
                      Participar
                    </Link>
                  </Button>
                </>
              )
            ) : (
              /* Ações da Área Autenticada */
              <>
                {!loading && !user && (
                  <Button
                    asChild
                    className="hidden h-9 rounded-lg px-4 font-semibold xl:inline-flex"
                  >
                    <Link to="/auth" search={{ mode: "cadastro" }}>
                      Criar conta <ArrowUpRight size={16} />
                    </Link>
                  </Button>
                )}
                {!loading &&
                  (user ? (
                    <>
                      <Button
                        asChild
                        variant="ghost"
                        className="hidden h-9 gap-2 px-2 md:inline-flex"
                      >
                        <Link to="/perfil">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <UserRound size={16} />
                          </span>
                          <span className="max-w-32 truncate">
                            {user.user_metadata["full_name"] ||
                              user.email?.split("@")[0] ||
                              "Minha conta"}
                          </span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden md:inline-flex"
                        onClick={signOut}
                        aria-label="Sair da conta"
                        title="Sair da conta"
                      >
                        <LogOut size={18} />
                      </Button>
                    </>
                  ) : (
                    <Button asChild variant="outline" className="hidden h-9 md:inline-flex">
                      <Link to="/auth">
                        <LogIn size={17} /> Entrar
                      </Link>
                    </Button>
                  ))}
              </>
            )}

            {/* Botão de Menu para MOBILE */}
            {!publicPage ? (
              <MobileAccountDrawer signOut={signOut} prelaunchMode={prelaunchMode} professionalOnly={professionalOnly === true} activeRole={professionalNavigation?.activeRole ?? undefined} />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg lg:hidden"
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                onClick={() => setMenuOpen((value) => !value)}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            )}
          </div>
        </div>

        {/* Menu Gaveta MOBILE */}
        {menuOpen && publicPage && (
          <nav
            className="absolute left-0 right-0 top-full z-50 border-b border-border bg-background px-4 py-4 shadow-xl lg:hidden animate-in fade-in slide-in-from-top-2 duration-150"
            aria-label="Menu de navegação mobile"
          >
            <div className="mx-auto flex max-w-[1280px] flex-col gap-1.5">
              {publicPage ? (
                <>
                  <Link
                    to="/como-funciona"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-3 font-semibold text-foreground hover:bg-secondary"
                  >
                    Como funciona
                  </Link>
                  <Link
                    to="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-3 font-semibold text-foreground hover:bg-secondary"
                  >
                    <LogIn size={18} className="text-caronaa-primary" />
                    Entrar
                  </Link>
                  {!loading && !user && (
                    <div className="pt-2">
                      <Button asChild variant="strong" className="w-full rounded-xl py-3 font-bold">
                        <Link
                          to="/auth"
                          search={{ mode: "cadastro" }}
                          onClick={() => setMenuOpen(false)}
                        >
                          Criar conta
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {navigation.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={`${to}-${label}`}
                      to={to}
                      search={to==="/home" ? {intent:label==="Oferecer"?"offer":undefined} : undefined}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-3 font-semibold hover:bg-secondary"
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  ))}
                  {user ? (
                    <Button variant="ghost" onClick={signOut} className="justify-start px-3.5 py-3">
                      <LogOut size={18} /> Sair da conta
                    </Button>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-3 font-semibold hover:bg-secondary"
                    >
                      <LogIn size={18} /> Entrar
                    </Link>
                  )}
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      {adminPreview && (
        <div role="status" className="border-b border-primary/25 bg-primary/10 px-4 py-2.5">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground sm:text-sm">
              <strong>Modo aplicativo</strong> — as ações realizadas no aplicativo continuam sendo reais.
            </p>
            <Button asChild size="sm" variant="outline" className="min-h-10 shrink-0 border-primary/30 bg-background">
              <Link to={adminPreview.returnTo as "/admin"} onClick={leaveAdminAppPreview}>
                <LayoutDashboard size={15} className="mr-1.5" />
                Voltar ao Admin
              </Link>
            </Button>
          </div>
        </div>
      )}

      {prelaunchMode && (
        <div role="status" className="border-b border-primary/25 bg-primary/5 px-4 py-2">
          <p className="mx-auto max-w-[1280px] text-xs leading-5 text-muted-foreground sm:px-2">
            Pré-lançamento: você já pode personalizar seu perfil. Pedidos e ofertas estarão disponíveis após a abertura.
          </p>
        </div>
      )}
      {!publicPage && !prelaunchMode && professionalOnly === true && (
        <aside aria-label="Navegação profissional desktop"
          className="fixed bottom-0 left-0 top-16 z-30 hidden w-48 flex-col border-r border-white/10 bg-[#121212] px-3 py-6 text-white lg:flex">
          <nav className="space-y-2">
            {professionalNav.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} aria-current={selectedNav(to,label) ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] ${selectedNav(to,label) ? "bg-[#FFBB00] text-[#121212]" : "text-white/85 hover:bg-white/10"}`}>
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-[#FFBB00]/25 p-3">
            <p className="text-sm font-bold text-[#FFBB00]">CARONAA</p>
            <p className="mt-1 text-xs text-white/70">Painel profissional</p>
          </div>
        </aside>
      )}

      {/* Conteúdo Principal */}
      <main
        className={
          mapLayout
            ? `relative min-h-0 w-full flex-1 mb-[calc(80px_+_env(safe-area-inset-bottom))] md:mb-0 ${professionalOnly ? "lg:ml-48 lg:w-[calc(100%_-_12rem)]" : ""}`
            : publicPage
            ? "flex-1"
            : "caronaa-page-enter flex-1 mx-auto w-full max-w-[1280px] px-4 pb-8 pt-4 sm:px-5 md:px-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-12 md:pt-8"
        }
      >
        {children}
      </main>

      {/* Navegação inferior acessível para a área autenticada em celulares. */}
      {!publicPage && user && professionalOnly !== null && (
        <nav
          aria-label={professionalOnly ? "Navegação profissional mobile" : "Navegação principal mobile"}
          className={`fixed inset-x-0 bottom-0 z-40 isolate border-t pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.10)] backdrop-blur-xl md:hidden ${professionalOnly ? "border-white/10 bg-[#121212] text-white" : "border-border/80 bg-background/95"}`}
        >
          <div className={`mx-auto grid max-w-lg gap-1 px-2 pt-1.5 ${prelaunchMode ? "grid-cols-2" : "grid-cols-3"}`}>
            {navigation.map(({ to, label, icon: Icon }) => {
              const selected = selectedNav(to,label);
              return (
                <Link
                  key={`${to}-${label}`}
                  to={to}
                  search={to==="/home" ? {intent:label==="Oferecer"?"offer":undefined} : undefined}
                  aria-current={selected ? "page" : undefined}
                  className={`group relative flex min-h-14 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00] ${
                    selected
                      ? professionalOnly ? "bg-[#FFBB00] text-[#121212]" : "bg-primary/15 text-foreground"
                      : professionalOnly ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span aria-hidden="true" className={`absolute top-0 h-[3px] w-9 rounded-b-full bg-[#FFBB00] transition-[opacity,transform] duration-150 motion-reduce:transition-none ${selected ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0"}`} />
                  <Icon size={22} aria-hidden="true" className={`transition-transform duration-150 motion-reduce:transition-none ${selected ? "scale-[1.08]" : "scale-100"} ${selected && !professionalOnly ? "text-primary" : ""}`} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Rodapé Público Consistente em Todas as Páginas Públicas */}
      {publicPage && <PublicFooter />}
    </div>
  );
}

