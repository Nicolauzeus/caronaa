import { useEffect, useState, type FormEvent } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const compliments = ["Pontual", "Direção segura", "Educado", "Veículo limpo"] as const;
const logRating = (stage: string, details?: Record<string, string | number | boolean>) => {
  if (details) console.info("[CARONAA][F07][RATING]", stage, details);
  else console.info("[CARONAA][F07][RATING]", stage);
};
const ratingErrorCodes = new Set(["23505","23514","42501","22023","PGRST202","PGRST116","PGRST301","401","403","429","500","503"]);
const safeRatingCode = (failure: unknown): string => {
  const raw = failure && typeof failure === "object" && "code" in failure
    ? String((failure as {code?: unknown}).code)
    : failure instanceof Error && failure.message === "RPC_RETURN_NOT_TRUE"
      ? "RPC_RETURN_NOT_TRUE" : "NETWORK_OR_UNKNOWN";
  return ratingErrorCodes.has(raw) || raw === "RPC_RETURN_NOT_TRUE" ? raw : "OTHER";
};

export function QuickRideRatingModal({
  rideId, subject, onClose, forceOpen=false,
}: {
  rideId: string;
  subject: "motorista" | "passageiro";
  onClose?: () => void;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setOpen(false);
    setSuccess(false);
    setScore(0);
    setSelected([]);
    setComment("");
    setLoading(true);
    logRating("RATING_CHECK_STARTED",{ rideIdPrefix: rideId.slice(0, 8) });
    // Never mount a fullscreen backdrop while checking an existing rating.
    try { if (!forceOpen && window.localStorage.getItem(`caronaa-rating-dismissed:${rideId}`) === "1") { logRating("RATING_DISMISSED_STORAGE"); setLoading(false); return; } } catch { /* storage may be unavailable */ }
    void (supabase as any).rpc("quick_ride_my_rating", { p_id: rideId })
      .then(({ data, error: rpcError }: { data: any; error: any }) => {
        if (!alive) return;
        if (rpcError) throw rpcError;
        // Never prompt twice for the same trip after it was rated.
        const alreadyRated = Array.isArray(data) && data.length > 0;
        if (alreadyRated) logRating("RATING_ALREADY_SUBMITTED");
        setOpen(!alreadyRated);
      })
      .catch(() => { if (alive) { setError("Não foi possível consultar a avaliação."); setOpen(false); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [rideId,forceOpen]);

  const close = () => {
    try { window.localStorage.setItem(`caronaa-rating-dismissed:${rideId}`, "1"); } catch { /* storage may be unavailable */ }
    setOpen(false); onClose?.();
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || score < 1 || score > 5) return;
    setBusy(true);
    setError("");
    try {
      const detail = [selected.join(", "), comment.trim()].filter(Boolean).join(" — ").slice(0, 1000);
      logRating("RATING_SUBMIT_STARTED",{score,hasComment:Boolean(detail)});
      const { data, error: rpcError } = await (supabase as any).rpc("quick_ride_rate", {
        p_id: rideId, p_score: score, p_comment: detail,
      });
      if (rpcError || data !== true) throw rpcError ?? new Error("RPC_RETURN_NOT_TRUE");
      logRating("RATING_SUBMIT_SUCCESS");
      setSuccess(true);
      window.setTimeout(close, 850);
    } catch (failure) {
      const code = safeRatingCode(failure);
      logRating("RATING_SUBMIT_FAILED",{code});
      setError(`Não foi possível enviar a avaliação (ref.: ${code}). Tente novamente.`);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !open) return null;
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 sm:items-center"
    role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="quick-rating-title"
      className="w-full max-w-md space-y-4 rounded-3xl border border-[#FFBB00]/40 bg-[#121212] p-5 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="quick-rating-title" className="text-xl font-bold text-[#FFBB00]">Como foi sua corrida?</h2>
          <p className="mt-1 text-sm text-white/70">Avalie {subject} para ajudar a comunidade CARONAA.</p>
        </div>
        <button type="button" onClick={close} aria-label="Fechar avaliação"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/20"><X size={20}/></button>
      </div>
      {success ? <p role="status" className="rounded-xl border border-[#FFBB00]/40 p-4 font-semibold text-[#FFBB00]">Avaliação enviada!</p> :
        <form onSubmit={submit} className="space-y-4">
          <div className="flex justify-center gap-1" role="radiogroup" aria-label="Nota">
            {[1, 2, 3, 4, 5].map(n => <button type="button" role="radio" aria-checked={score === n}
              aria-label={n + " estrelas"} key={n} onClick={() => setScore(n)}
              className="flex min-h-12 min-w-12 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]">
              <Star size={32} className={n <= score ? "fill-[#FFBB00] text-[#FFBB00]" : "text-white/40"}/>
            </button>)}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Elogios rápidos">
            {compliments.map(item => <button type="button" key={item} aria-pressed={selected.includes(item)}
              onClick={() => setSelected(current => current.includes(item)
                ? current.filter(value => value !== item) : [...current, item])}
              className={"min-h-10 rounded-full border px-3 text-sm " + (selected.includes(item)
                ? "border-[#FFBB00] bg-[#FFBB00] text-[#121212]" : "border-white/25 text-white")}>
              {item}
            </button>)}
          </div>
          <label className="block text-sm">Comentário opcional
            <textarea value={comment} maxLength={800} onChange={e => setComment(e.target.value)}
              placeholder="Conte como foi sua experiência"
              className="mt-2 min-h-24 w-full rounded-xl border border-white/25 bg-white/10 p-3 text-white"/>
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {score<1&&<p className="text-xs text-white/70">Escolha de 1 a 5 estrelas antes de enviar.</p>}
          <button type="submit" disabled={busy || score < 1}
            className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212] disabled:opacity-50">
            {busy ? "Enviando..." : "Enviar avaliação"}
          </button>
          <button type="button" onClick={close} className="min-h-10 w-full text-sm text-white/70">
            Avaliar mais tarde
          </button>
        </form>}
    </section>
  </div>;
}
