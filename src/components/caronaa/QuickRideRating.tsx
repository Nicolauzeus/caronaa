import { useEffect, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Reuses the established bilateral 1–5 star experience for professional quick rides. */
export function QuickRideRating({rideId,subject}:{rideId:string;subject:"motorista"|"passageiro"}) {
  const [score,setScore]=useState(0);
  const [comment,setComment]=useState("");
  const [saved,setSaved]=useState<{score:number;comment:string}|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    setSaved(null);setScore(0);setComment("");setError("");setLoading(true);
    void (supabase as any).rpc("quick_ride_my_rating",{p_id:rideId})
      .then(({data,error:rpcError}:{data:any;error:any})=>{
        if(!alive)return;
        if(rpcError){setError("Não foi possível consultar sua avaliação.");return;}
        const entry=Array.isArray(data)?data[0]:null;
        if(entry)setSaved({score:entry.score,comment:entry.comment??""});
      })
      .catch(()=>{if(alive)setError("Avaliações indisponíveis neste momento.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false};
  },[rideId]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(busy||score<1||score>5||saved)return;
    setBusy(true);setError("");
    try{
      const {error:rpcError}=await (supabase as any).rpc("quick_ride_rate",
        {p_id:rideId,p_score:score,p_comment:comment.trim()});
      if(rpcError)throw new Error("Não foi possível registrar a avaliação. Talvez já tenha sido enviada.");
      setSaved({score,comment:comment.trim()});
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível avaliar.");}
    finally{setBusy(false);}
  }

  if(loading)return <p role="status" className="text-xs text-white/70">Carregando avaliação…</p>;
  return <section aria-label={`Avaliar ${subject}`} className="space-y-3 rounded-xl border border-[#FFBB00]/40 bg-[#121212] p-4 text-white">
    <p className="font-bold text-[#FFBB00]">Avaliação após a corrida</p>
    {saved?<p role="status">Você avaliou {subject} com {saved.score} de 5 estrelas.{saved.comment?` ${saved.comment}`:""}</p>:
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm">Como foi sua experiência com {subject}?</p>
        <div role="radiogroup" aria-label="Nota da viagem" className="flex gap-2">
          {[1,2,3,4,5].map(value=><button type="button" key={value}
            role="radio" aria-checked={score===value} aria-label={`${value} estrelas`}
            onClick={()=>setScore(value)} className="min-h-11 min-w-11 rounded-lg border border-white/20 p-2">
              <Star size={23} className={value<=score?"fill-[#FFBB00] text-[#FFBB00]":"text-gray-400"}/>
            </button>)}
        </div>
        <textarea value={comment} maxLength={1000} onChange={event=>setComment(event.target.value)}
          aria-label="Comentário opcional" placeholder="Comentário (opcional)"
          className="min-h-20 w-full rounded-xl border border-white/20 bg-white/10 p-3 text-white"/>
        <button type="submit" disabled={busy||score===0}
          className="min-h-11 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-50">
          {busy?"Enviando…":"Enviar avaliação"}
        </button>
      </form>}
    {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
  </section>;
}
