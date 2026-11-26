import { BellRing } from "lucide-react";
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

export function KeepScreenOpenWarning() {
  return <p role="status" className="rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-xs leading-snug text-foreground">
    Notificações desativadas: mantenha esta tela aberta para ver as corridas.
  </p>;
}
