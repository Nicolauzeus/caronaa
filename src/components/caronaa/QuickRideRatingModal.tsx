import { useEffect, useState, type FormEvent } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const compliments = ["Pontual", "Direção segura", "Educado", "Veículo limpo"] as const;

export function QuickRideRatingModal({
  rideId, subject, onClose,
}: {
  rideId: string;
  subject: "motorista" | "passageiro";
  onClose?: () => void;
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
    // Never mount a fullscreen backdrop while checking an existing rating.
    try { if (window.localStorage.getItem(`caronaa-rating-dismissed:${rideId}`) === "1") { setLoading(false); return; } } catch { /* storage may be unavailable */ }
    void (supabase as any).rpc("quick_ride_my_rating", { p_id: rideId })
      .then(({ data, error: rpcError }: { data: any; error: any }) => {
        if (!alive) return;
        if (rpcError) throw rpcError;
        // Never prompt twice for the same trip after it was rated.
        setOpen(!(Array.isArray(data) && data.length > 0));
      })
      .catch(() => { if (alive) { setError("Não foi possível consultar a avaliação."); setOpen(false); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [rideId]);

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
      const { data, error: rpcError } = await (supabase as any).rpc("quick_ride_rate", {
        p_id: rideId, p_score: score, p_comment: detail,
      });
      if (rpcError || data !== true) throw rpcError ?? new Error("Evaluation not confirmed");
      setSuccess(true);
      window.setTimeout(close, 850);
    } catch {
      setError("Não foi possível registrar a avaliação. Tente novamente.");
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
