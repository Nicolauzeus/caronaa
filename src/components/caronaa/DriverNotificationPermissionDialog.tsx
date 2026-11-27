import { useState } from "react";
import { BellRing } from "lucide-react";
import { isNativeAndroid } from "@/lib/native/capacitor-bridge";
import { openNativeAppSettings, testRideAlertSound } from "@/lib/native/driver-notifications";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function needsNotificationExplanation(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
}
export function notificationsDenied(): boolean {
  return typeof window === "undefined" || !("Notification" in window) || Notification.permission === "denied";
}

export function DriverNotificationPermissionDialog({ open, onAllow, onSkip }: {
  open: boolean; onAllow: () => void; onSkip: () => void;
}) {
  return <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <BellRing className="mx-auto size-8 text-primary" aria-hidden />
        <DialogTitle className="text-center">Receba chamados mesmo com a tela bloqueada</DialogTitle>
        <DialogDescription className="text-center">
          Ative as notificações para o CARONAA avisar você de novas corridas por perto. Você pode desativar quando quiser.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <button type="button" onClick={onAllow}
          className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground">Ativar notificações</button>
        <button type="button" onClick={onSkip}
          className="min-h-11 rounded-xl border border-border font-semibold">Agora não</button>
      </div>
    </DialogContent>
  </Dialog>;
}

/** Native APK: permission granted, but remote delivery is not configured yet. */
export function RemoteAlertsUnavailableNotice() {
  return <p role="status" className="rounded-xl border border-border bg-muted px-3 py-2 text-xs leading-snug text-foreground">
    Notificações permitidas. Alertas com o app fechado ainda não estão disponíveis nesta versão: mantenha o app aberto para ver as corridas.
  </p>;
}

export function KeepScreenOpenWarning() {
  return <p role="status" className="rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-xs leading-snug text-foreground">
    Notificações desativadas: mantenha esta tela aberta para ver as corridas.
  </p>;
}

/** APK only: guided checklist so the driver can leave alerts fully active. */
export function NativeAlertSetupCard() {
  const [msg, setMsg] = useState<string | null>(null);
  if (!isNativeAndroid()) return null;
  const test = async () => {
    const r = await testRideAlertSound();
    setMsg(r === "ok" ? "Alerta enviado. Se não tocou, ative o som da categoria Corridas urgentes."
      : r === "denied" ? "Permita as notificações do CARONAA para testar o toque." : "Teste indisponível neste aparelho.");
  };
  return <details className="rounded-xl border border-primary/40 bg-black/40 px-3 py-2 text-xs leading-snug">
    <summary className="cursor-pointer font-bold text-primary">Deixe os alertas de corrida 100% ativos</summary>
    <ol className="mt-2 list-decimal space-y-1 pl-4">
      <li>Toque em <b>Abrir ajustes do app</b>.</li>
      <li><b>Bateria</b>: escolha <b>Sem restrições</b>.</li>
      <li><b>Notificações › Corridas urgentes</b>: ative som, pop-up e tela de bloqueio.</li>
      <li>Xiaomi/Samsung: ative <b>Início automático</b>.</li>
      <li>Volte e toque em <b>Testar toque de corrida</b>.</li>
    </ol>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => void openNativeAppSettings()} className="min-h-10 rounded-lg border border-border font-semibold">Abrir ajustes do app</button>
      <button type="button" onClick={() => void test()} className="min-h-10 rounded-lg bg-primary font-bold text-primary-foreground">Testar toque de corrida</button>
    </div>
    {msg && <p role="status" className="mt-2">{msg}</p>}
  </details>;
}
