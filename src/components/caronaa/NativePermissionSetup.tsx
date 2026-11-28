import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, BatteryCharging, MapPin, Navigation, Settings2, ShieldCheck, Smartphone, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { isNativeAndroid, onNativeAppResume } from "@/lib/native/capacitor-bridge";
import { testRideAlertSound } from "@/lib/native/driver-notifications";
import { openSetupSettings, readSetupStatus, requestSetupGps, requestSetupNotifications, setupSeenKey, setupStatusLabel, type SetupStatus } from "@/lib/native/permission-setup";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function NativePermissionSetupLink() {
  if (!isNativeAndroid()) return null;
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
  const generation = useRef(0);
  const actionLock = useRef(false);
  const native = isNativeAndroid();
  const driver = role === "MOTORISTA";

  useEffect(() => {
    if (!native || !user?.id) { setReady(true); return; }
    let alive = true;
    const refreshRole = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("active_role").eq("id", user.id).maybeSingle();
        if (!alive || error) return;
        const next = data?.active_role;
        if (next !== "MOTORISTA" && next !== "PASSAGEIRO") return;
        setRole(next);
        let seen = false;
        try { seen = localStorage.getItem(setupSeenKey(user.id, next === "MOTORISTA")) === "yes"; } catch { /* optional storage */ }
        if (!seen) setOpen(true);
      } catch { /* never block account access */ }
      finally { if (alive) setReady(true); }
    };
    const fallback = window.setTimeout(() => { if (alive) setReady(true); }, 5000);
    void refreshRole();
    window.addEventListener("caronaa:role-changed", refreshRole);
    return () => { alive = false; window.clearTimeout(fallback); window.removeEventListener("caronaa:role-changed", refreshRole); };
  }, [native, user?.id]);

  useEffect(() => {
    if (!native) return;
    const show = () => { setOpen(true); setReady(true); };
    window.addEventListener("caronaa:permission-setup", show);
    return () => window.removeEventListener("caronaa:permission-setup", show);
  }, [native]);

  useEffect(() => {
    if (!native || !open) return;
    let alive = true;
    const update = () => {
      const id = ++generation.current;
      void readSetupStatus().then(value => { if (alive && id === generation.current) setStatus(value); });
    };
    update();
    const off = onNativeAppResume(update);
    window.addEventListener("focus", update);
    return () => { alive = false; generation.current++; off(); window.removeEventListener("focus", update); };
  }, [native, open]);

  const dismiss = () => {
    if (actionLock.current) return;
    if (user?.id && role) {
      try { localStorage.setItem(setupSeenKey(user.id, driver), "yes"); } catch { /* no login dependency */ }
    }
    setOpen(false); setMessage("");
  };
  const act = async (action: () => Promise<boolean>, hint?: string) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setMessage("");
    try {
      const result = await action();
      if (!result) setMessage("Não foi possível abrir este ajuste. Abra Configurações do Android › CARONAA.");
      else if (hint) setMessage(hint);
      const id = ++generation.current;
      const next = await readSetupStatus();
      if (id === generation.current) setStatus(next);
    } catch { setMessage("Não foi possível verificar a configuração. Tente novamente."); }
    finally { actionLock.current = false; setBusy(false); }
  };

  const rows = [
    { icon: Bell, title: "Notificações", description: driver ? "Receba avisos de corridas mesmo fora do app." : "Permita avisos importantes do aplicativo.", value: status.notifications, action: () => requestSetupNotifications(driver), button: "Permitir / ajustar" },
    { icon: MapPin, title: "Localização precisa", description: "Use o mapa e encontre o ponto de embarque. Escolha localização precisa enquanto usa o app.", value: status.preciseLocation, action: () => requestSetupGps(), button: "Permitir GPS" },
    { icon: Navigation, title: "GPS do aparelho", description: "Ative a localização do Android para o mapa funcionar.", value: status.gpsEnabled, action: () => openSetupSettings("gps"), button: "Abrir localização" },
    ...(driver ? [
      { icon: Volume2, title: "Som e vibração das corridas", description: "Na categoria Corridas urgentes, habilite som, vibração e avisos na tela.", value: status.rideChannel, action: () => openSetupSettings("channel"), button: "Ajustar alertas" },
      { icon: BatteryCharging, title: "Bateria sem restrições", description: "Recomendado para receber pedidos em segundo plano. Em Bateria, selecione Sem restrições ou Não otimizar. Pode aumentar o consumo.", value: status.batteryExempt, action: () => openSetupSettings("battery"), button: "Ajustar bateria" },
      { icon: Smartphone, title: "Execução em segundo plano", description: "Em aparelhos Xiaomi ou similares, permita início automático e atividade em segundo plano se essas opções existirem. A disponibilidade profissional continua sob seu controle.", value: undefined, action: () => openSetupSettings("app"), button: "Abrir ajustes" },
    ] : []),
  ];

  if (!native) return <>{children}</>;
  return <>
    {ready && !open ? children : null}
    <Dialog open={open} onOpenChange={value => { if (!value) dismiss(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <ShieldCheck className="mx-auto size-9 text-primary" aria-hidden />
          <DialogTitle className="text-center text-xl">Prepare seu CARONAA</DialogTitle>
          <DialogDescription className="text-center">Configure as permissões necessárias para usar o app com segurança. Você decide o que permitir e pode voltar a estes ajustes pelo Perfil.</DialogDescription>
        </DialogHeader>
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
                {value !== true && <button type="button" disabled={busy} onClick={() => void act(action)} className="mt-2 min-h-10 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50">{button}</button>}
              </div>
            </div>
          </div>)}
        </div>
        <button type="button" disabled={busy} onClick={() => void act(() => openSetupSettings("app"))} className="min-h-11 rounded-xl border border-border text-sm font-bold">Abrir ajustes gerais do CARONAA</button>
        {status.preciseLocation === false && status.approximateLocation === true && <p className="text-xs text-muted-foreground">Localização aproximada permitida; selecione a opção precisa nos ajustes se necessário.</p>}
        {driver && <button type="button" disabled={busy} onClick={() => void act(async () => (await testRideAlertSound()) === "ok", "Alerta local solicitado. Confira o som e a vibração; isso não testa o envio remoto.")} className="min-h-11 rounded-xl border border-border text-sm font-bold">Testar som de corrida</button>}
        <p className="text-xs leading-relaxed text-muted-foreground">Permitir localização não ativa o rastreamento profissional. A câmera e as fotos são solicitadas somente quando você usa esses recursos.</p>
        {message && <p role="status" className="text-xs font-medium">{message}</p>}
        <button type="button" disabled={busy} onClick={dismiss} className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground">{rows.every(row => row.value === true) ? "Concluir" : "Continuar para o app"}</button>
      </DialogContent>
    </Dialog>
  </>;
}
