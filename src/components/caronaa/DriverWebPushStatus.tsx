import { isNativeAndroid } from "@/lib/native/capacitor-bridge";
import type { DriverAlertResult } from "@/lib/native/driver-notifications";

/** A granted browser permission alone is never shown as a saved subscription. */
export function DriverWebPushStatus({ result, pending, onEnable }: {
  result: DriverAlertResult | null;
  pending: boolean;
  onEnable: () => void;
}) {
  if (isNativeAndroid()) return null;
  const reason = result && !result.ok ? result.reason : null;
  const saved = result?.ok === true && result.remote === "web";
  const messages = {
    DENIED: "Permita notificações nas configurações deste site no navegador e volte para verificar.",
    INSTALL_REQUIRED: "No iPhone ou iPad (iOS 16.4+), use Compartilhar → Adicionar à Tela de Início. Abra o CARONAA pelo ícone e ative as notificações.",
    UNSUPPORTED: "Este navegador não oferece Web Push. Use um navegador compatível e mantenha esta tela aberta para acompanhar as corridas.",
    NO_SERVICE_WORKER: "O navegador ainda não ficou pronto para receber alertas. Confira a conexão e tente novamente.",
    SAVE_FAILED: "Não foi possível cadastrar este navegador. Confira a conexão e tente novamente.",
  };
  return <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-border bg-muted px-3 py-2 text-xs leading-snug text-foreground">
    <p className="font-semibold">{saved ? "Notificações ativadas neste navegador" : "Alertas em segundo plano"}</p>
    <p>{reason ? messages[reason] : "Receba avisos de novas corridas com outra aba aberta ou com o CARONAA em segundo plano."}</p>
    {saved ? <p className="text-muted-foreground">O som e a entrega dependem do navegador e dos ajustes do aparelho.</p>
      : reason !== "INSTALL_REQUIRED" && reason !== "UNSUPPORTED" && <button type="button" disabled={pending} onClick={onEnable}
        className="min-h-10 w-full rounded-lg border border-border px-3 font-semibold disabled:opacity-50">
        {pending ? "Ativando..." : reason === "DENIED" ? "Verificar permissão" : reason ? "Tentar novamente" : "Ativar notificações"}
      </button>}
  </div>;
}
