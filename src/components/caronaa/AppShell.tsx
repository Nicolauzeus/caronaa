import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CarFront,
  House,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";
import { PublicFooter } from "@/components/caronaa/PublicFooter";

const authenticatedNav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/minhas-caronas" as const, label: "Viagens", icon: CarFront },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

const publicNav = [
  { to: "/" as const, label: "Início", icon: House },
  { to: "/como-funciona" as const, label: "Como Funciona", icon: Sparkles },
  { to: "/buscar" as const, label: "Buscar Carona", icon: Search },
  { to: "/seguranca" as const, label: "Segurança", icon: ShieldCheck },
];

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2" aria-label="CARONAA — página inicial">
      <img
        src={logoAsset.url}
        alt="CARONAA"
        className={`h-11 w-auto object-contain transition-transform hover:scale-105 ${light ? "brightness-0 invert" : ""}`}
      />
    </Link>
  );
}

export function AppShell({
  children,
  publicPage = false,
  hideFooter = false,
}: {
  children: ReactNode;
  publicPage?: boolean;
  hideFooter?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeNav = publicPage ? publicNav : authenticatedNav;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-5 lg:px-8">
          <Brand />

          {/* Navegação Desktop */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            {activeNav.map(({ to, label }) => {
              const isActive = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${
                    isActive ? "bg-secondary text-primary font-bold" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />

            {/* CTA de Destaque da Validação */}
            <Button
              asChild
              variant="strong"
              className="hidden h-9 rounded-xl px-4 text-xs font-bold sm:inline-flex"
            >
              <Link to="/formulario">
                Validação STS 2026 <ArrowUpRight size={15} />
              </Link>
            </Button>

            {!loading &&
              (user ? (
                <>
                  <Button asChild variant="ghost" className="hidden h-9 gap-2 px-2 md:inline-flex">
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
                <Button asChild variant="outline" className="hidden h-9 rounded-xl md:inline-flex">
                  <Link to="/auth">
                    <LogIn size={16} /> Entrar
                  </Link>
                </Button>
              ))}

            {/* Botão Menu Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>

        {/* Drawer Mobile */}
        {menuOpen && (
          <nav
            className="absolute left-0 right-0 top-full z-50 border-b border-border bg-background px-4 py-4 shadow-xl md:hidden"
            aria-label="Menu Mobile"
          >
            <div className="mx-auto flex max-w-[1280px] flex-col gap-1.5">
              {activeNav.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 font-semibold transition-colors ${
                    pathname === to ? "bg-secondary text-primary" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon size={19} className="text-primary" />
                  {label}
                </Link>
              ))}

              <div className="my-2 border-t border-border pt-2">
                <Button
                  asChild
                  variant="strong"
                  className="w-full justify-center rounded-xl py-3 text-sm font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  <Link to="/formulario">
                    Validação Siará Tech Summit <ArrowUpRight size={16} />
                  </Link>
                </Button>
              </div>

              {user ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="justify-start px-3.5 py-3 text-muted-foreground"
                >
                  <LogOut size={18} /> Sair da conta
                </Button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-3 font-semibold text-foreground hover:bg-secondary"
                >
                  <LogIn size={18} /> Entrar ou criar conta
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>

      <main
        className={
          publicPage
            ? "flex-1"
            : "mx-auto w-full max-w-[1280px] flex-1 px-4 pb-24 pt-6 sm:px-5 md:px-8 md:pb-12 md:pt-8"
        }
      >
        {children}
      </main>

      {/* Rodapé institucional nas páginas públicas */}
      {publicPage && !hideFooter && <PublicFooter />}

      {/* Navegação inferior móvel apenas para páginas autenticadas */}
      {!publicPage && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
          aria-label="Navegação inferior"
        >
          <div className="mx-auto grid h-16 max-w-md grid-cols-3 items-center">
            {authenticatedNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold leading-tight transition-colors ${
                  pathname === to ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={20} strokeWidth={pathname === to ? 2.5 : 1.8} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

