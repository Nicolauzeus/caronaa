import { isNativeAndroid } from "@/lib/native/capacitor-bridge";
import type { DriverAlertResult } from "@/lib/native/driver-notifications";
import { BellRing, CheckCircle2, X } from "lucide-react";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

/** A granted browser permission alone is never shown as a saved subscription. */
export function DriverWebPushStatus({ result, pending, onEnable, onDismiss }: {
  result: DriverAlertResult | null;
  pending: boolean;
  onEnable: () => void;
  onDismiss?: () => void;
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
  return <div className="relative space-y-3 rounded-3xl border border-[#FFBB00]/50 bg-[#121212] p-5 text-sm leading-relaxed text-white shadow-2xl" style={{ fontFamily: "Manrope, sans-serif" }}>
    <div className="flex items-center justify-between gap-3">
      <img src={logoAsset.url} alt="CARONAA" className="h-8 w-auto max-w-[120px] object-contain"/>
      {onDismiss && <button type="button" aria-label="Fechar convite de notificações" disabled={pending} onClick={onDismiss}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-50"><X className="size-4" aria-hidden/></button>}
    </div>
    <div className="flex items-start gap-3" role="status" aria-live="polite">
      {saved ? <CheckCircle2 className="mt-1 size-6 shrink-0 text-[#FFBB00]" aria-hidden/> : <BellRing className="mt-1 size-6 shrink-0 text-[#FFBB00]" aria-hidden/>}
      <div className="min-w-0 space-y-2">
        <p className="font-[Sora] text-base font-bold leading-snug">{saved ? "Notificações ativadas neste navegador" : "Não perca uma nova corrida"}</p>
        <p className="text-xs text-white/80">{reason ? messages[reason] : "O CARONAA avisa você de novas corridas por perto, mesmo em segundo plano."}</p>
        {!saved && !reason && <p className="text-xs text-white/65">Toque em ativar e confirme “Permitir” no aviso do navegador. Nós concluímos a configuração para você.</p>}
        {saved && <p className="text-xs text-white/65">O som e a entrega dependem do navegador e dos ajustes do aparelho.</p>}
      </div>
    </div>
    {!saved && reason !== "INSTALL_REQUIRED" && reason !== "UNSUPPORTED" && <button type="button" disabled={pending} onClick={onEnable}
        className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] hover:bg-[#eeb000] disabled:opacity-50">
        {pending ? "Ativando..." : reason === "DENIED" ? "Verificar permissão" : reason ? "Tentar novamente" : "Ativar notificações"}
      </button>}
    {onDismiss && <button type="button" disabled={pending} onClick={onDismiss}
      className="min-h-10 w-full rounded-xl px-4 text-xs font-semibold text-white/75 hover:bg-white/5 disabled:opacity-50">
      {saved || reason === "INSTALL_REQUIRED" || reason === "UNSUPPORTED" ? "Entendi" : "Agora não"}
    </button>}
  </div>;
}
