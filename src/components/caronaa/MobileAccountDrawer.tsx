import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CarFront,
  House,
  UserRound,
  Menu,
  LogOut,
  ShieldCheck,
  Search,
  LayoutDashboard,
  MessageSquare,
  KeyRound,
  Camera,
  HelpCircle,
  Settings,
  CheckCircle2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { getMyAdminEntry, type AdminEntryRoute } from "@/lib/admin/entry";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationControls } from "./NotificationControls";
import { getMyUserVerifications } from "@/lib/user-verifications";

export function MobileAccountDrawer({ signOut }: { signOut: () => Promise<void> }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [adminDestination, setAdminDestination] = useState<AdminEntryRoute | null>(null);
  const [hasVerification, setHasVerification] = useState(false);

  useEffect(() => {
    let alive = true;
    setAdminDestination(null);
    setHasVerification(false);

    if (open && user) {
      void getMyAdminEntry()
        .then((destination) => {
          if (alive) setAdminDestination(destination);
        })
        .catch(() => {
          if (alive) setAdminDestination(null);
        });

      void getMyUserVerifications()
        .then((verifications) => {
          if (alive) setHasVerification(verifications.length > 0);
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [user?.id, open]);

  const name = String(
    user?.user_metadata.full_name ||
      user?.user_metadata.name ||
      user?.email?.split("@")[0] ||
      "Minha conta",
  );

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C";

  const avatar = user?.user_metadata.avatar_url || user?.user_metadata.picture;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Abrir menu">
          <Menu size={22} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[85%] max-w-sm overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-10 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
      >
        {/* Header do Usuário com avatar e verificação */}
        <div className="flex items-center gap-3 border-b border-border pb-5">
          {typeof avatar === "string" && avatar ? (
            <img src={avatar} alt="" className="size-14 shrink-0 rounded-full object-cover ring-2 ring-primary/20" />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-xl font-extrabold text-primary ring-2 ring-primary/20">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <SheetTitle className="truncate text-left text-base font-extrabold text-foreground">
                {name}
              </SheetTitle>
              {hasVerification && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-caronaa-primary-strong dark:text-caronaa-primary" title="Perfil verificado">
                  <CheckCircle2 size={13} className="text-primary fill-primary/20" />
                  Verificado
                </span>
              )}
            </div>
            <SheetDescription className="text-left text-xs text-muted-foreground">
              {user?.email}
            </SheetDescription>
            <Link
              to="/perfil"
              onClick={() => setOpen(false)}
              className="mt-1.5 inline-block text-xs font-bold text-primary underline underline-offset-2"
            >
              Editar perfil
            </Link>
          </div>
        </div>

        {/* Grupo 1: Navegação principal */}
        <nav aria-label="Menu principal" className="py-2.5">
          <Link
            to="/home"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <House size={19} className="text-muted-foreground" />
            Início
          </Link>

          <Link
            to="/minhas-caronas"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <CarFront size={19} className="text-muted-foreground" />
            Minhas viagens
          </Link>

          <Link
            to="/minhas-caronas"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <MessageSquare size={19} className="text-muted-foreground" />
            Mensagens
          </Link>

          <Link
            to="/buscar"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <Search size={19} className="text-muted-foreground" />
            Buscar carona
          </Link>
        </nav>

        <div className="border-t border-border my-1" />

        {/* Grupo 2: Segurança & Perfil com subitens */}
        <div className="py-2.5 space-y-1">
          <div>
            <Link
              to="/seguranca"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <ShieldCheck size={19} className="text-muted-foreground" />
              Segurança
            </Link>
            <div className="pl-9 pr-2">
              <Link
                to="/seguranca"
                search={{ action: "alterar-senha" }}
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <KeyRound size={14} className="text-primary" />
                Alterar senha
              </Link>
            </div>
          </div>

          <div className="pt-1">
            <Link
              to="/perfil"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <UserRound size={19} className="text-muted-foreground" />
              Perfil
            </Link>
            <div className="pl-9 pr-2">
              <Link
                to="/perfil"
                search={{ editPhoto: true }}
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <Camera size={14} className="text-primary" />
                Alterar foto
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-border my-1" />

        {/* Grupo 3: Ajuda, Configurações, Admin e Sair */}
        <div className="py-2.5 space-y-1">
          <Link
            to="/como-funciona"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <HelpCircle size={19} className="text-muted-foreground" />
            Ajuda
          </Link>

          <Link
            to="/perfil"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <Settings size={19} className="text-muted-foreground" />
            Configurações
          </Link>

          {adminDestination && (
            <Link
              to={adminDestination}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-primary/10 px-2.5 text-sm font-bold text-foreground hover:bg-primary/15"
            >
              <LayoutDashboard size={19} className="text-primary" />
              Painel administrativo
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border py-4">
          <ThemeToggle />
          <NotificationControls />
        </div>

        <Button
          variant="ghost"
          className="min-h-12 w-full justify-start gap-3 rounded-xl px-2.5 text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            setOpen(false);
            await signOut();
          }}
        >
          <LogOut size={19} />
          Sair da conta
        </Button>
      </SheetContent>
    </Sheet>
  );
}
