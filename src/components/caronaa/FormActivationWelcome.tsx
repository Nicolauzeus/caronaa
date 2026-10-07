import { CheckCircle2, PencilLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmFormAccountActivation, getFormAccountActivation, type FormActivationSubmission } from "@/lib/formulario/account-activation";

export function FormActivationWelcome() {
  const [submission, setSubmission] = useState<FormActivationSubmission | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => { void getFormAccountActivation().then((result) => { if (result.status === "ready") setSubmission(result.submission ?? null); }).catch(() => undefined).finally(() => setChecked(true)); }, []);
  async function confirm() { if (!submission) return; setBusy(true); try { await confirmFormAccountActivation(submission.submissionId, submission); setSubmission(null); toast.success("Sua entrada na CARONAA foi confirmada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível confirmar agora."); } finally { setBusy(false); } }
  if (!checked || !submission) return null;
  const fields: Array<[keyof FormActivationSubmission, string, boolean]> = [["name", "Nome", true], ["whatsapp", "WhatsApp", true], ["origin", "Origem", true], ["destination", "Destino", true], ["departureWindow", "Horário habitual", true], ["email", "E-mail da resposta", false], ["intent", "Intenção inicial", false], ["transport", "Transporte atual", false]];
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-center"><section className="mx-auto w-full max-w-xl rounded-3xl border border-primary/30 bg-card p-6 shadow-2xl sm:p-8"><div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles size={23}/></div><p className="mt-5 text-xs font-bold tracking-[.18em] text-primary">BEM-VINDO DE VOLTA</p><h1 className="mt-2 font-display text-3xl font-extrabold">Você já conhece o CARONAA 🚗</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Encontramos sua participação no nosso formulário. Suas informações iniciais já estão conosco, então você não precisa começar do zero.</p>{reviewing && <div className="mt-6 grid gap-3 sm:grid-cols-2">{fields.map(([key,label,editable]) => <label key={key} className="text-xs font-bold text-muted-foreground">{label.toUpperCase()}<Input className="mt-1.5" value={submission[key] ?? ""} readOnly={!editable} onChange={(event) => setSubmission((current) => current ? {...current, [key]: event.target.value} : current)} /></label>)}</div>}<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setReviewing((value) => !value)} disabled={busy}>{reviewing ? <><CheckCircle2 size={16}/> Concluir revisão</> : <><PencilLine size={16}/> Revisar minhas informações</>}</Button><Button onClick={confirm} disabled={busy} className="min-h-11">{busy ? "Confirmando..." : "Confirmar e continuar"}</Button></div></section></div>;
}
