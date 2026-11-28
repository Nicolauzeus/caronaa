import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, BatteryCharging, MapPin, Navigation, Settings2, ShieldCheck, Smartphone, Volume2, Wifi, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { isNativeAndroid, onNativeAppResume } from "@/lib/native/capacitor-bridge";
import { readWebSetupStatus, requestWebSetupLocation, requestWebSetupNotifications } from "@/lib/native/web-permission-setup";
import { testRideAlertSound } from "@/lib/native/driver-notifications";
import { openSetupSettings, readSetupStatus, requestSetupGps, requestSetupNotifications, setupSeenKey, setupStatusLabel, nextSetupStep, type SetupStatus } from "@/lib/native/permission-setup";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function NativePermissionSetupFab({ className = "absolute right-3 top-48 z-20" }: { className?: string } = {}) {
  return <button type="button" aria-label="Abrir painel de permissões" title="Permissões do aplicativo"
    onClick={() => window.dispatchEvent(new Event("caronaa:permission-setup"))}
    className={className + " flex size-11 shrink-0 items-center justify-center rounded-full border border-[#121212]/20 bg-[#FFBB00] text-[#121212] shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"}>
    <Plus size={24} aria-hidden />
  </button>;
}

export function NativePermissionSetupHeaderButton() {
  return <button type="button" aria-label="Configurar permissões" title="Permissões do aplicativo" onClick={() => window.dispatchEvent(new Event("caronaa:permission-setup"))}
    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-current hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary"><Settings2 size={20} aria-hidden /></button>;
}

export function NativePermissionSetupLink() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("caronaa:permission-setup"))}
    className="mb-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm font-bold text-card-foreground">
    <Settings2 className="size-5 text-primary" aria-hidden /> Permissões e funcionamento do app
  </button>;
}

export function NativePermissionSetup({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<"MOTORISTA" | "PASSAGEIRO" | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SetupStatus>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [guided, setGuided] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | undefined>(undefined);
  const generation = useRef(0);
  const actionLock = useRef(false);
  const native = isNativeAndroid();
  const driver = role === "MOTORISTA";

  useEffect(() => {
    if (!user?.id) { setReady(true); return; }
    let alive = true;
    const showFirst = (driverRole: boolean) => {
      let seen = false;
      try { seen = localStorage.getItem(setupSeenKey(user.id, driverRole, native ? "android" : "web")) === "yes"; } catch { /* optional storage */ }
      if (!seen) setOpen(true);
    };
    const refreshRole = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("active_role").eq("id", user.id).maybeSingle();
        if (!alive) return;
        const next = !error && data?.active_role === "MOTORISTA" ? "MOTORISTA" : "PASSAGEIRO";
        setRole(next);
        showFirst(next === "MOTORISTA");
      } catch { if (alive) { setRole("PASSAGEIRO"); showFirst(false); } }
      finally { if (alive) setReady(true); }
    };
    const fallback = window.setTimeout(() => { if (alive) setReady(true); }, 2500);
    void refreshRole();
    window.addEventListener("caronaa:role-changed", refreshRole);
    return () => { alive = false; window.clearTimeout(fallback); window.removeEventListener("caronaa:role-changed", refreshRole); };
  }, [native, user?.id]);

  useEffect(() => {
    const show = () => { setOpen(true); setReady(true); };
    window.addEventListener("caronaa:permission-setup", show);
    return () => window.removeEventListener("caronaa:permission-setup", show);
  }, [native]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const update = () => {
      const id = ++generation.current;
      void (native ? readSetupStatus() : readWebSetupStatus()).then(value => { if (alive && id === generation.current) setStatus(value); });
    };
    const network = () => setOnline(navigator.onLine);
    network();
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    update();
    const off = onNativeAppResume(() => { network(); update(); });
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { alive = false; generation.current++; off(); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); window.removeEventListener("online", network); window.removeEventListener("offline", network); };
  }, [native, open]);

  const dismiss = () => {
    if (actionLock.current) return;
    if (user?.id && role) {
      try { localStorage.setItem(setupSeenKey(user.id, driver, native ? "android" : "web"), "yes"); } catch { /* no login dependency */ }
    }
    setOpen(false); setMessage(""); setGuided(false); setVisited([]);
  };
  const act = async (action: () => Promise<boolean>, hint?: string) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setMessage("");
    try {
      const result = await action();
      if (!result) setMessage(native ? "Não foi possível abrir este ajuste. Abra Configurações do Android › CARONAA." : "Confira as permissões do site nas configurações do navegador. No iPhone, instale o CARONAA na tela de início para permitir push, quando compatível.");
      else if (hint) setMessage(hint);
      const id = ++generation.current;
      const next = await (native ? readSetupStatus() : readWebSetupStatus());
      if (id === generation.current) setStatus(next);
    } catch { setMessage("Não foi possível verificar a configuração. Tente novamente."); }
    finally { actionLock.current = false; setBusy(false); }
  };

  const rows = native ? [
    { icon: Bell, title: "Notificações", description: driver ? "Receba avisos de corridas mesmo fora do app." : "Permita avisos importantes do aplicativo.", value: status.notifications, action: () => requestSetupNotifications(driver), button: "Permitir / ajustar" },
    { icon: MapPin, title: "Localização precisa", description: "Use o mapa e encontre o ponto de embarque. Escolha localização precisa enquanto usa o app.", value: status.preciseLocation, action: () => requestSetupGps(), button: "Permitir GPS" },
    { icon: Navigation, title: "GPS do aparelho", description: "Ative a localização do Android para o mapa funcionar.", value: status.gpsEnabled, action: () => openSetupSettings("gps"), button: "Abrir localização" },
    { icon: Wifi, title: "Conexão de rede", description: "Verifique Wi-Fi ou dados móveis. O estado indica a conexão local, não confirma acesso ao servidor.", value: online, action: () => openSetupSettings("network"), button: "Abrir rede" },
    ...(driver ? [
      { icon: Volume2, title: "Som e vibração das corridas", description: "Na categoria Corridas urgentes, habilite som, vibração e avisos na tela.", value: status.rideChannel, action: () => openSetupSettings("channel"), button: "Ajustar alertas" },
      { icon: BatteryCharging, title: "Bateria sem restrições", description: "Recomendado para receber pedidos em segundo plano. Em Bateria, selecione Sem restrições ou Não otimizar. Pode aumentar o consumo.", value: status.batteryExempt, action: () => openSetupSettings("battery"), button: "Ajustar bateria" },
      { icon: Smartphone, title: "Execução em segundo plano", description: "Em aparelhos Xiaomi ou similares, permita início automático e atividade em segundo plano se essas opções existirem. A disponibilidade profissional continua sob seu controle.", value: undefined, action: () => openSetupSettings("app"), button: "Abrir ajustes" },
    ] : []),
  ] : [
    { icon: Bell, title: "Notificações", description: "Autorize os avisos do site. No iPhone, as notificações push exigem o app instalado na tela de início e uma versão compatível do iOS.", value: status.notifications, action: () => requestWebSetupNotifications(driver), button: "Permitir notificações" },
    { icon: MapPin, title: "Localização do site", description: "Autorize a localização para usar o mapa. O navegador não informa se o GPS é preciso nem se o GPS do aparelho está ligado.", value: status.siteLocation, action: requestWebSetupLocation, button: "Permitir localização" },
  ];

  const next = nextSetupStep(rows, visited);
  const advance = () => {
    if (!next || actionLock.current) return;
    setVisited(previous => [...previous, next.title]);
    void act(next.action);
  };

  return <>
    {ready && !open ? children : null}
    <Dialog open={open} onOpenChange={value => { if (!value) dismiss(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <ShieldCheck className="mx-auto size-9 text-primary" aria-hidden />
          <DialogTitle className="text-center text-xl">Prepare seu CARONAA</DialogTitle>
          <DialogDescription className="text-center">{native ? "Configure as permissões do Android. Você decide o que permitir." : "Configure as permissões do navegador. Para revisar, use também os ajustes do site ou do aparelho."} Você pode voltar aqui pelo cabeçalho ou Perfil.</DialogDescription>
        </DialogHeader>
        <button type="button" disabled={busy} onClick={() => { setVisited([]); setGuided(true); }}
          className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground">Ativar tudo · configuração guiada</button>
        {guided && <div className="space-y-2 rounded-xl border border-primary/40 p-3">
          <p role="status" className="text-sm font-semibold">{next ? "Próximo ajuste: " + next.title : "Etapas revisadas. Confira os itens que continuam pendentes."}</p>
          <p className="text-xs text-muted-foreground">Abra um ajuste por vez, autorize se desejar e volte ao CARONAA. Nenhuma permissão é ativada sem seu consentimento.</p>
          {next && <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={advance} className="min-h-11 rounded-lg bg-primary text-xs font-bold text-primary-foreground">Abrir próximo ajuste</button>
            <button type="button" disabled={busy} onClick={() => setVisited(previous => [...previous, next.title])} className="min-h-11 rounded-lg border border-border text-xs font-bold">Pular etapa</button>
          </div>}
          <button type="button" disabled={busy} onClick={() => setGuided(false)} className="min-h-10 text-xs font-bold text-muted-foreground">Sair do modo guiado</button>
        </div>}
        <div className="space-y-2">
          {rows.map(({ icon: Icon, title, description, value, action, button }) => <div key={title} className="rounded-xl border border-border p-3">
            <div className="flex items-start gap-3">
              <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <h3 className="text-sm font-bold">{title}</h3>
                  <span className={value === true ? "text-xs font-semibold text-emerald-700 dark:text-emerald-300" : "text-xs text-muted-foreground"}>{setupStatusLabel(value)}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                {<button type="button" disabled={busy} onClick={() => void act(action)} className="mt-2 min-h-10 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50">{button}</button>}
              </div>
            </div>
          </div>)}
        </div>
        {!native && <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
          <p>Conexão de rede: <strong>{online === true ? "Conectado à rede" : online === false ? "Sem conexão" : "Verificando"}</strong>. Isso não confirma acesso ao servidor.</p>
          <p className="mt-2">Bateria, GPS do aparelho, canal de som e execução em segundo plano são ajustados no sistema. O navegador não pode abrir nem verificar esses ajustes nativos.</p>
        </div>}
        {native && <><button type="button" disabled={busy} onClick={() => void act(() => openSetupSettings("notifications"))} className="min-h-11 rounded-xl border border-border text-sm font-bold">Configurar notificações</button>
        <button type="button" disabled={busy} onClick={() => void act(() => openSetupSettings("app"))} className="min-h-11 rounded-xl border border-border text-sm font-bold">Abrir ajustes gerais do CARONAA</button></>}
        {status.preciseLocation === false && status.approximateLocation === true && <p className="text-xs text-muted-foreground">Localização aproximada permitida; selecione a opção precisa nos ajustes se necessário.</p>}
        {native && driver && <button type="button" disabled={busy} onClick={() => void act(async () => (await testRideAlertSound()) === "ok", "Alerta local solicitado. Confira o som e a vibração; isso não testa o envio remoto.")} className="min-h-11 rounded-xl border border-border text-sm font-bold">Testar som de corrida</button>}
        <p className="text-xs leading-relaxed text-muted-foreground">Permitir localização não ativa o rastreamento profissional. O serviço de localização em segundo plano funciona somente com disponibilidade e consentimento do motorista. A câmera e as fotos são solicitadas somente quando você usa esses recursos.</p>
        {message && <p role="status" className="text-xs font-medium">{message}</p>}
        <button type="button" disabled={busy} onClick={dismiss} className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground">{rows.every(row => row.value === true) ? "Concluir" : "Continuar para o app"}</button>
      </DialogContent>
    </Dialog>
  </>;
}
