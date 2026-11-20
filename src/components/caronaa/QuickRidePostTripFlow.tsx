import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Star, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QuickRidePixCard } from "./QuickRidePixCard";
import { playNotificationSound } from "@/lib/notification-sound";
import { QuickRideDriverSettlement } from "./QuickRideDriverSettlement";
import { QuickRideRatingModal } from "./QuickRideRatingModal";
import {
  quickPostTripActiveKey,
  quickPostTripSeenKey,
  shouldPresentQuickPostTrip,
  type CompletedQuickRideRef,
} from "@/lib/quick-rides/post-trip-prompt";

type Role = "PASSENGER" | "DRIVER";

type Props = {
  role: Role;
  activeRideId?: string | null;
  completedRide?: CompletedQuickRideRef | null;
};

/**
 * An automatically presented, non-blocking checkout for both F07 roles.
 * Only the guarded server RPCs decide the payment amount, Pix key, actual
 * payment declarations and previous ratings. No transfer is initiated here.
 */
export function QuickRidePostTripFlow({
  role, activeRideId = null, completedRide = null,
}: Props) {
  const [serverPending,setServerPending]=useState<CompletedQuickRideRef|null>(null);
  const [serverLoaded,setServerLoaded]=useState(false);
  const [checkoutError,setCheckoutError]=useState("");
  const [ackBusy,setAckBusy]=useState(false);
  const lastNotified=useRef<string|null>(null);
  const rideId=serverLoaded?serverPending?.id??null:completedRide?.id??null;
  const [openRideId, setOpenRideId] = useState<string | null>(null);
  const [ratingRideId, setRatingRideId] = useState<string | null>(null);
  const [ratingStatus, setRatingStatus] = useState<"checking" | "available" | "rated" | "error">("checking");
  const [ratingRetry, setRatingRetry] = useState(0);

  // Server-side post-trip receipt survives reload, Safari suspension and devices.
  // If 0217 is not installed yet, retain the legacy local prompt as fallback.
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      if(document.hidden)return;
      try{
        const {data,error}=await (supabase as any).rpc("quick_ride_my_posttrip_pending");
        if(!alive)return;
        if(error){setServerLoaded(false);return;}
        const rows=Array.isArray(data)?data:[];
        const own=rows.find((item:{role?:string})=>item.role===role);
        setServerPending(own?.ride_id?{id:own.ride_id,requested_at:own.completed_at??null}:null);
        setServerLoaded(true);
      }catch{if(alive)setServerLoaded(false);}
    };
    void refresh();
    const foreground=()=>{if(!document.hidden)void refresh();};
    const timer=window.setInterval(foreground,30000);
    window.addEventListener("focus",foreground);
    window.addEventListener("online",foreground);
    window.addEventListener("pageshow",foreground);
    document.addEventListener("visibilitychange",foreground);
    return()=>{
      alive=false;window.clearInterval(timer);
      window.removeEventListener("focus",foreground);
      window.removeEventListener("online",foreground);
      window.removeEventListener("pageshow",foreground);
      document.removeEventListener("visibilitychange",foreground);
    };
  },[role,completedRide?.id,activeRideId]);

  // Persist the active ride so that a refresh, Safari tab suspension or
  // navigation during completion cannot silently skip the checkout prompt.
  useEffect(() => {
    if (!activeRideId) return;
    try {
      window.localStorage.setItem(quickPostTripActiveKey(role), activeRideId);
    } catch { /* The recent-completion fallback also works without storage. */ }
  }, [role, activeRideId]);

  useEffect(() => {
    if (!rideId || activeRideId) return;
    if(serverLoaded){
      setOpenRideId(rideId);
      if(lastNotified.current!==rideId){
        lastNotified.current=rideId;
        void playNotificationSound("ride_completed");
      }
      return;
    }
    let lastActiveId: string | null = null;
    let alreadySeen = false;
    try {
      lastActiveId = window.localStorage.getItem(quickPostTripActiveKey(role));
      alreadySeen = window.localStorage.getItem(quickPostTripSeenKey(role, rideId)) === "1";
    } catch { /* Private browsing may block storage. */ }

    if (shouldPresentQuickPostTrip(completedRide, lastActiveId, alreadySeen)) {
      setOpenRideId(rideId);
      void playNotificationSound("ride_completed");
    }
  }, [role, rideId, activeRideId, completedRide?.requested_at, serverLoaded]);

  useEffect(() => {
    if (!rideId || openRideId !== rideId) return;
    let alive = true;
    setRatingStatus("checking");
    void (supabase as any).rpc("quick_ride_my_rating", { p_id: rideId })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!alive) return;
        setRatingStatus(error ? "error" :
          Array.isArray(data) && data.length > 0 ? "rated" : "available");
      })
      .catch(() => { if (alive) setRatingStatus("error"); });
    return () => { alive = false; };
  }, [rideId, openRideId, ratingRetry]);

  const isOpen = Boolean(rideId && openRideId === rideId);
  const isRatingOpen = Boolean(rideId && ratingRideId === rideId);

  useEffect(() => {
    if (!isOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, [isOpen]);

  const markPresented = () => {
    if (!rideId) return;
    try {
      window.localStorage.setItem(quickPostTripSeenKey(role, rideId), "1");
      if (window.localStorage.getItem(quickPostTripActiveKey(role)) === rideId)
        window.localStorage.removeItem(quickPostTripActiveKey(role));
    } catch { /* Do not block the passenger or driver. */ }
  };
  const dismiss = async () => {
    if(!rideId||ackBusy)return;
    setCheckoutError("");
    if(serverLoaded){
      setAckBusy(true);
      try{
        const {data,error}=await (supabase as any).rpc("quick_ride_ack_posttrip",{p_id:rideId});
        if(error||data!==true)throw error??new Error("Ack unavailable");
        setServerPending(null);
      }catch{
        setCheckoutError("Não foi possível salvar a leitura do pós-corrida. Tente novamente.");
        return;
      }finally{setAckBusy(false);}
    }
    markPresented();
    setOpenRideId(null);
    setRatingRideId(null);
  };
  const rate = () => {
    if (!rideId || ratingStatus !== "available") return;
    // Leave Pix checkout pending while rating is open. Returning from
    // feedback must show payment again instead of abandoning it.
    setOpenRideId(null);
    setRatingRideId(rideId);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") void dismiss();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
    // The active ID is the only resource an Escape listener needs to track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, rideId, role]);

  if (typeof document === "undefined" || !rideId) return null;

  const who = role === "PASSENGER" ? "motorista" : "passageiro";

  return <>
    {isOpen && createPortal(
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 px-2 py-3 sm:items-center sm:px-4"
        role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="quick-post-trip-title"
          className="flex w-full max-w-lg max-h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-t-[28px] border border-[#FFBB00]/40 bg-[#121212] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 size={20} aria-hidden="true" />
                <span className="text-xs font-extrabold uppercase tracking-wide">Viagem finalizada</span>
              </div>
              <h2 id="quick-post-trip-title" className="font-[Sora] text-xl font-black text-[#FFBB00]">
                Corrida concluída
              </h2>
              <p className="text-sm leading-relaxed text-white/75">
                {role === "PASSENGER"
                  ? "Confira o valor da corrida e a chave Pix do motorista. O pagamento é feito pelo seu banco."
                  : "Confira a cobrança, compartilhe seu Pix e acompanhe o recebimento do passageiro."}
              </p>
            </div>
            <button type="button" aria-label="Fechar pós-corrida" disabled={ackBusy} onClick={()=>void dismiss()}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-white/80">
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#FFBB00]">
              <Wallet size={18} aria-hidden="true" />
              {role === "PASSENGER" ? "Pagamento da corrida" : "Cobrança e recebimento"}
            </div>
            {role === "PASSENGER"
              ? <QuickRidePixCard rideId={rideId} />
              : <QuickRideDriverSettlement rideId={rideId} />}
            <div className="space-y-2 border-t border-white/15 pt-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Star size={18} className="text-[#FFBB00]" aria-hidden="true" />
                Como foi a experiência?
              </div>
              {ratingStatus === "rated" ? (
                <p role="status" className="rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                  Sua avaliação já foi registrada. Obrigado!
                </p>
              ) : (
                <button type="button" disabled={ratingStatus !== "available"} onClick={rate}
                  className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-3 font-bold text-[#121212] disabled:opacity-60">
                  {ratingStatus === "checking" ? "Verificando avaliação…" :
                    ratingStatus === "error" ? "Avaliação temporariamente indisponível" :
                    `Avaliar ${who} (opcional)`}
                </button>
              )}
              {ratingStatus === "error" && (
                <button type="button" onClick={() => setRatingRetry(value => value + 1)}
                  className="min-h-11 w-full text-sm font-semibold text-[#FFBB00] underline">
                  Tentar consultar avaliação novamente
                </button>
              )}
            </div>
          </div>
          <div className="shrink-0 space-y-1 border-t border-white/15 bg-[#121212] pt-2">
            {checkoutError&&<p role="alert" className="text-sm text-red-300">{checkoutError}</p>}
            <button type="button" disabled={ackBusy} onClick={()=>void dismiss()}
              className="min-h-12 w-full rounded-xl border border-white/25 px-3 text-sm font-semibold text-white disabled:opacity-60">
              {ackBusy?"Salvando...":"Continuar no CARONAA"}
            </button>
            <p className="text-center text-[11px] leading-tight text-white/50">
              O reconhecimento desta tela não confirma pagamento. Pix e avaliação continuam disponíveis em Minhas viagens.
            </p>
          </div>
        </section>
      </div>,
      document.body,
    )}
    {isRatingOpen && createPortal(
      <QuickRideRatingModal rideId={rideId} subject={who} forceOpen
        onClose={() => { setRatingRideId(null); setOpenRideId(rideId); setRatingRetry(v => v + 1); }} />,
      document.body,
    )}
  </>;
}
