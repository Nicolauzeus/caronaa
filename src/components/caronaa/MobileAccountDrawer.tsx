import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell, CalendarClock, Camera, CarFront, CheckCircle2, ChevronRight,
  HelpCircle, House, KeyRound, LayoutDashboard, LogOut, Menu,
  Settings2, ShieldCheck, UserRound, Wallet,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationControls } from "./NotificationControls";
import { getMyUserVerifications } from "@/lib/user-verifications";

type Props = {
  signOut: () => Promise<void>;
  prelaunchMode?: boolean;
  professionalOnly?: boolean;
  activeRole?: "PASSAGEIRO" | "MOTORISTA";
};

const tileClass = "flex min-h-[86px] flex-col justify-center gap-2 rounded-2xl border border-border bg-background p-3 text-left text-foreground transition-colors hover:border-[#FFBB00]/50 hover:bg-primary/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00] motion-reduce:transform-none";
const rowClass = "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00]";

export function MobileAccountDrawer({ signOut, prelaunchMode = false, professionalOnly = false, activeRole }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let alive = true;
    setAdmin(false);
    setVerified(false);
    void Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
      getMyUserVerifications().catch(() => []),
    ]).then(([roles, verifications]) => {
      if (!alive) return;
      setAdmin(Boolean(roles.data?.length));
      setVerified(verifications.some(item => item.status === "VERIFIED"));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id, open]);

  const close = () => setOpen(false);
  const name = String(user?.user_metadata.full_name ||
    user?.user_metadata.name || user?.email?.split("@")[0] || "Minha conta");
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "C";
  const avatar = user?.user_metadata.avatar_url || user?.user_metadata.picture;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon"
          className="size-11 shrink-0 rounded-full hover:bg-primary/10"
          aria-label="Abrir menu da conta">
          <Menu size={22} aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left"
        className="w-[min(92vw,390px)] max-w-none overflow-y-auto overscroll-contain bg-background px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-12 shadow-2xl sm:px-5 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#FFBB00] bg-[#121212] font-display text-lg font-black text-[#FFBB00]">
            {typeof avatar === "string" && avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-left font-display text-base font-extrabold">{name}</SheetTitle>
            <SheetDescription className="mt-0.5 truncate text-left text-xs">{user?.email}</SheetDescription>
            {verified && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                <CheckCircle2 size={13} className="text-[#FFBB00]" aria-hidden="true" /> Vínculo confirmado
              </span>
            )}
          </div>
          <Link to="/perfil" onClick={close} aria-label="Editar perfil"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]">
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        </div>

        {!prelaunchMode && user && (
          <section aria-label="Minha atividade" className="mb-5">
            <h3 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Minha atividade</h3>
            <p className="mb-3 px-1 text-xs leading-relaxed text-muted-foreground">Use a mesma conta para pedir ou oferecer caronas comuns. Apenas um modo fica ativo por vez.</p>
            <div className="grid gap-2">
              {([
                { role: "PASSAGEIRO" as const, title: "Pedir carona", description: "Encontrar viagens ou pedir uma corrida", intent: "request" as const, Icon: UserRound },
                { role: "MOTORISTA" as const, title: "Oferecer carona", description: "Compartilhar um trajeto com passageiros", intent: "offer" as const, Icon: CarFront },
              ]).map(item => {
                const selected = activeRole === item.role;
                return (
                  <Link key={item.role} to="/home" search={{intent:item.intent}} onClick={()=>{
                    close();
                    if(selected && item.role==="MOTORISTA")
                      window.dispatchEvent(new Event("caronaa:driver-home"));
                  }}
                    aria-current={selected ? "true" : undefined}
                    className={`flex min-h-[68px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#FFBB00] ${selected ? "border-[#FFBB00] bg-[#FFBB00]/10" : "border-border bg-background hover:border-[#FFBB00]/50"}`}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFBB00]/15 text-[#B58400]"><item.Icon size={21}/></span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-extrabold">{item.title}</strong>
                      <small className="block text-xs leading-4 text-muted-foreground">{item.description}</small>
                    </span>
                    {selected ? <CheckCircle2 size={20} className="shrink-0 text-[#C18B00]" aria-label="Ativo"/> : <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/50"/>}
                  </Link>
                );
              })}
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">Oferecer carona comum não habilita corridas profissionais Flash.</p>
          </section>
        )}
        {!prelaunchMode && !professionalOnly && (
          <nav aria-label="Atalhos da conta" className="space-y-1">
            <Link to="/minhas-caronas" onClick={close} className={rowClass}><CalendarClock size={19} className="text-[#C38D00]"/> Minhas viagens <ChevronRight size={17} className="ml-auto text-muted-foreground"/></Link>
            <Link to="/perfil" onClick={close} className={rowClass}><CarFront size={19} className="text-[#C38D00]"/> Meu veículo e perfil <ChevronRight size={17} className="ml-auto text-muted-foreground"/></Link>
            <Link to="/como-funciona" onClick={close} className={rowClass}><HelpCircle size={19} className="text-[#C38D00]"/> Ajuda e suporte <ChevronRight size={17} className="ml-auto text-muted-foreground"/></Link>
          </nav>
        )}

        {professionalOnly && !prelaunchMode && (
          <>
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Área do motorista</h3>
            <nav aria-label="Atalhos do motorista" className="grid grid-cols-2 gap-2.5">
              <Link to="/disponibilidade-profissional" onClick={close} className={tileClass}>
                <CarFront size={23} className="text-[#C38D00]" aria-hidden="true" />
                <span className="text-sm font-extrabold">Disponibilidade</span>
              </Link>
              <Link to="/viagens-profissionais" onClick={close} className={tileClass}>
                <CalendarClock size={23} className="text-[#C38D00]" aria-hidden="true" />
                <span className="text-sm font-extrabold">Minhas viagens</span>
              </Link>
              <Link to="/perfil" hash="pix-do-motorista" onClick={close} className={tileClass}>
                <Wallet size={23} className="text-[#C38D00]" aria-hidden="true" />
                <span className="text-sm font-extrabold">Pix e ganhos</span>
              </Link>
              <Link to="/como-funciona" onClick={close} className={tileClass}>
                <HelpCircle size={23} className="text-[#C38D00]" aria-hidden="true" />
                <span className="text-sm font-extrabold">Ajuda</span>
              </Link>
            </nav>
          </>
        )}

        {prelaunchMode && (
          <nav aria-label="Acesso de pré-lançamento" className="space-y-2">
            <p className="px-1 text-sm leading-6 text-muted-foreground">
              Acompanhe o lançamento e mantenha seus dados atualizados.
            </p>
            <Link to="/aguardando" onClick={close} className={rowClass}><House size={19} /> Acompanhar lançamento</Link>
            <Link to="/perfil" onClick={close} className={rowClass}><UserRound size={19} /> Meu perfil</Link>
            <Link to="/perfil" search={{ editPhoto: true }} onClick={close} className={rowClass}><Camera size={19} /> Alterar foto</Link>
          </nav>
        )}

        <div className="my-5 border-t border-border" />
        <h3 className="mb-1 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Minha conta</h3>
        <nav aria-label="Dados e configurações" className="space-y-0.5">
          <Link to="/perfil" onClick={close} className={rowClass}><UserRound size={19} className="text-muted-foreground" /> Dados pessoais <ChevronRight size={17} className="ml-auto text-muted-foreground" /></Link>
          <Link to="/seguranca" hash="alterar-senha" onClick={close} className={rowClass}><KeyRound size={19} className="text-muted-foreground" /> Alterar senha <ChevronRight size={17} className="ml-auto text-muted-foreground" /></Link>
          <Link to="/perfil" onClick={close} className={rowClass}><Settings2 size={19} className="text-muted-foreground" /> Preferências <ChevronRight size={17} className="ml-auto text-muted-foreground" /></Link>
          {!prelaunchMode && professionalOnly && (
            <Link to="/cadastro-motorista" onClick={close} className={rowClass}><ShieldCheck size={19} className="text-muted-foreground" /> Meu cadastro profissional <ChevronRight size={17} className="ml-auto text-muted-foreground" /></Link>
          )}
          {admin && (
            <Link to="/admin" onClick={close} className={rowClass}><LayoutDashboard size={19} className="text-muted-foreground" /> Administração <ChevronRight size={17} className="ml-auto text-muted-foreground" /></Link>
          )}
        </nav>

        <div className="mt-5 rounded-2xl border border-border bg-muted/50 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Aparência e notificações</p>
          <div className="flex min-h-12 items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium"><Settings2 size={17} aria-hidden="true" /> Tema</span>
            <ThemeToggle />
          </div>
          <div className="flex min-h-12 items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium"><Bell size={17} aria-hidden="true" /> Alertas</span>
            <NotificationControls />
          </div>
        </div>
        <Button variant="ghost"
          className="mt-4 min-h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => { close(); await signOut(); }}>
          <LogOut size={19} aria-hidden="true" /> Sair da conta
        </Button>
      </SheetContent>
    </Sheet>
  );
}
