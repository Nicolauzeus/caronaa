import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, CarFront, Compass, House, LogIn, LogOut, Menu, Plus, UserRound, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/buscar" as const, label: "Buscar", icon: Compass },
  { to: "/oferecer" as const, label: "Oferecer", icon: Plus },
  { to: "/minhas-caronas" as const, label: "Minhas Caronas", icon: CarFront },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`inline-flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-normal ${light ? "text-primary-foreground" : "text-foreground"}`} aria-label="CARONAA — página inicial"><span className={`flex size-9 items-center justify-center rounded-lg ${light ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"}`}><CarFront size={22} strokeWidth={2.6}/></span>CARONAA<span className="text-primary">.</span></Link>;
}

export function AppShell({ children, publicPage = false }: { children: ReactNode; publicPage?: boolean }) {
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
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
        <Brand />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">{nav.map(({ to, label }) => <Link key={to} to={to} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary ${pathname === to ? "bg-secondary text-primary" : "text-muted-foreground"}`}>{label}</Link>)}</nav>
        <div className="flex items-center gap-2"><Button asChild className="hidden h-10 rounded-md px-4 font-semibold xl:inline-flex"><Link to="/formulario">Validação Siará Tech Summit <ArrowUpRight size={16}/></Link></Button>{!loading && (user ? <><Button asChild variant="outline" className="hidden h-10 md:inline-flex"><Link to="/perfil"><UserRound size={16}/>{user.user_metadata.full_name || user.email?.split("@")[0] || "Minha conta"}</Link></Button><Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={signOut} aria-label="Sair da conta" title="Sair da conta"><LogOut size={18}/></Button></> : <Button asChild variant="outline" className="hidden h-10 md:inline-flex"><Link to="/auth"><LogIn size={17}/> Entrar</Link></Button>)}<Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</Button></div>
      </div>
      {menuOpen && <nav className="absolute left-0 right-0 top-full z-50 border-b border-border bg-background px-5 py-4 shadow-lg lg:hidden" aria-label="Menu"><div className="mx-auto flex max-w-7xl flex-col gap-1">{nav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 font-semibold hover:bg-secondary"><Icon size={18}/>{label}</Link>)}{user ? <Button variant="ghost" onClick={signOut} className="justify-start px-3"><LogOut size={18}/> Sair da conta</Button> : <Link to="/auth" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 font-semibold hover:bg-secondary"><LogIn size={18}/>Entrar ou criar conta</Link>}<Link to="/formulario" onClick={() => setMenuOpen(false)} className="mt-2 flex items-center gap-2 rounded-md bg-primary px-3 py-3 font-semibold text-primary-foreground">Validação Siará Tech Summit <ArrowUpRight size={16}/></Link></div></nav>}
    </header>
    <main className={publicPage ? "" : "mx-auto max-w-7xl px-5 pb-28 pt-8 md:px-8 md:pb-16 md:pt-12"}>{children}</main>
    {!publicPage && <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Navegação inferior"><div className="grid h-[68px] grid-cols-5 items-center">{nav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={`flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold leading-tight transition-colors ${pathname === to ? "text-primary" : "text-muted-foreground"}`}><Icon size={21} strokeWidth={pathname === to ? 2.5 : 1.8}/><span className="text-center">{label}</span></Link>)}</div></nav>}
  </div>;
}
