import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CarFront,
  House,
  LogIn,
  LogOut,
  Menu,
  UserRound,
  X,
  ShieldCheck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { ThemeToggle } from "@/components/caronaa/ThemeToggle";
import { NotificationControls } from "@/components/caronaa/NotificationControls";
import { PublicFooter } from "@/components/caronaa/PublicFooter";
import { MobileAccountDrawer } from "@/components/caronaa/MobileAccountDrawer";

const authenticatedNav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/minhas-caronas" as const, label: "Viagens", icon: CarFront },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="CARONAA — página inicial">
      <img
        src={logoAsset.url}
        alt="CARONAA"
        className={`h-10 sm:h-11 w-auto object-contain ${light ? "brightness-0 invert" : ""}`}
      />
    </Link>
  );
}

export function AppShell({
  children,
  publicPage = false,
}: {
  children: ReactNode;
  publicPage?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-8">
          {/* Logo CARONAA */}
          <div className={!publicPage && user ? "hidden lg:block" : ""}>
            <Brand />
          </div>
          {!publicPage && user && (
            <Link to="/perfil" className="flex min-w-0 items-center gap-3 lg:hidden">
              {typeof (user.user_metadata.avatar_url || user.user_metadata.picture) === "string" ? (
                <img
                  src={user.user_metadata.avatar_url || user.user_metadata.picture}
                  alt=""
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserRound size={20} />
                </span>
              )}
              <span className="truncate text-base font-bold">
                Olá,{" "}
                {
                  String(
                    user.user_metadata.full_name ||
                      user.user_metadata.name ||
                      user.email?.split("@")[0] ||
                      "você",
                  ).split(" ")[0]
                }
                !
              </span>
            </Link>
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
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
              {authenticatedNav.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${
                    pathname === to ? "bg-secondary text-primary" : "text-muted-foreground"
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
              <MobileAccountDrawer signOut={signOut} />
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
                  {authenticatedNav.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
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

      {/* Conteúdo Principal */}
      <main
        className={
          publicPage
            ? "flex-1"
            : "flex-1 mx-auto w-full max-w-[1280px] px-4 pb-8 pt-4 sm:px-5 md:px-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-12 md:pt-8"
        }
      >
        {children}
      </main>

      {/* Navegação inferior acessível para a área autenticada em celulares. */}
      {!publicPage && user && (
        <nav
          aria-label="Navegação principal mobile"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-1 px-3 pt-2">
            {authenticatedNav.map(({ to, label, icon: Icon }) => {
              const selected = pathname === to || pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={selected ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    selected
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={21} aria-hidden="true" className={selected ? "text-primary" : ""} />
                  <span>{label}</span>
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
