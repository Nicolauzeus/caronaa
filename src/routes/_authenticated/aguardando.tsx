import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Clock3, LockKeyhole, MapPin, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getMyUniforLaunchState,
  UNIFOR_LAUNCH_DAY,
  UNIFOR_LAUNCH_ISO,
  type UniforLaunchState,
} from "@/lib/unifor-launch";

export const Route = createFileRoute("/_authenticated/aguardando")({
  head: () => ({ meta: [
    { title: "Pré-lançamento UNIFOR — CARONAA" },
    { name: "description", content: "Sua participação está registrada. As caronas do piloto UNIFOR ficam disponíveis a partir de 4 de novembro." },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: UniforWaitingPage,
});

const fmt = new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Fortaleza",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
function remainingLabel(date: string, now: number) {
  const minutes = Math.max(0,Math.ceil((Date.parse(date)-now)/60000));
  if (minutes===0) return "A abertura está chegando";
  const days=Math.floor(minutes/1440);
  const hours=Math.floor((minutes%1440)/60);
  const mins=minutes%60;
  return [days?days+"d":null,hours?hours+"h":null,mins+"min"].filter(Boolean).join(" ");
}

function UniforWaitingPage() {
  const navigate=useNavigate();
  const router=useRouter();
  const [state,setState]=useState<UniforLaunchState | null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [now,setNow]=useState(()=>Date.now());

  useEffect(()=>{
    let alive=true;
    async function refresh() {
      setNow(Date.now());
      try {
        const next=await getMyUniforLaunchState();
        if(!alive) return;
        setState(next);
        setError("");
        if(!next.locked){
          await router.invalidate();
          if(alive) void navigate({to:"/home",replace:true});
        }
      } catch {
        if(alive) setError("Não conseguimos verificar sua situação. Tente novamente.");
      } finally {
        if(alive) setLoading(false);
      }
    }
    void refresh();
    const id=window.setInterval(()=>void refresh(),60000);
    const focus=()=>void refresh();
    window.addEventListener("focus",focus);
    return ()=>{alive=false;window.clearInterval(id);window.removeEventListener("focus",focus);};
  },[navigate,router]);

  const p=state?.preview;
  const kind=p?.kind==="PEDIDO"?"Pedido planejado":p?.kind==="OFERTA"?"Oferta planejada":p?.kind==="AMBOS"?"Pedido e oferta planejados":"Aguardando vínculo da pesquisa";
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#111111] text-white">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] sm:px-7">
        <div className="flex min-h-10 shrink-0 items-center justify-between gap-3">
          <span className="font-display text-lg font-black tracking-[.12em] text-[#ffc451]">CARONAA</span>
          <span className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/75">
            Pré-lançamento · UNIFOR
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 sm:gap-5">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#ffc451]">
              <CalendarClock size={16} /> Lançamento em {UNIFOR_LAUNCH_DAY}
            </span>
            <h1 className="font-display text-[clamp(1.65rem,5vw,2.5rem)] font-black leading-tight tracking-tight">
              Seu caminho começa em breve.
            </h1>
            <p className="max-w-md text-sm leading-5 text-white/70 sm:text-base sm:leading-6">
              Até a estreia, você pode visualizar sua intenção de carona. Pedidos, ofertas, reservas e combinações ainda não estão liberados.
            </p>
          </div>
          <section className="rounded-2xl border border-[#ffc451]/35 bg-white/[.06] p-3 sm:p-5" aria-label="Intenção de carona para o lançamento">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#ffc451]">04 NOV · SOMENTE VISUALIZAÇÃO</h2>
              <LockKeyhole size={17} className="shrink-0 text-[#ffc451]"/>
            </div>
            {loading ? <p role="status" className="mt-3 text-sm text-white/65">Consultando sua participação…</p> :
             error ? <p role="alert" className="mt-3 text-sm text-amber-300">{error}</p> :
             <div className="mt-3 space-y-2">
               <p className="text-xl font-extrabold">{kind}</p>
               {p ? <>
                 <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                   <MapPin size={14} className="shrink-0"/>
                   <span className="min-w-0 break-words">{p.origin||"Origem a confirmar"} → {p.destination||"Destino a confirmar"}</span>
                 </div>
                 {p.departureTime && <p className="text-xs text-white/65">Horário de interesse: {p.departureTime}</p>}
                 <p className="text-xs text-white/50">Registro de intenção, não é uma corrida publicada ou reserva.</p>
               </> : <p className="text-xs leading-5 text-white/60">Sua participação está vinculada, mas o trajeto ainda não tem dados suficientes para mostrar uma prévia de pedido ou oferta.</p>}
             </div>}
          </section>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-white/50">Contagem regressiva</p>
              <p className="text-lg font-extrabold tabular-nums text-[#ffc451]">{remainingLabel(state?.launchAt||UNIFOR_LAUNCH_ISO,now)}</p>
            </div>
            <Clock3 aria-hidden="true" size={23} className="shrink-0 text-[#ffc451]"/>
          </div>
          {!loading && error && <button type="button" onClick={()=>window.location.reload()} className="min-h-10 self-start rounded-lg border border-white/30 px-4 text-sm font-semibold">
            <RefreshCw size={14} className="mr-2 inline"/> Verificar novamente
          </button>}
          {!p&&!loading&&!error&&<Link to="/formulario/$code" params={{code:"0K9K09K"}} className="inline-flex min-h-10 items-center gap-2 self-start text-sm font-semibold text-[#ffc451] underline underline-offset-4">
            Responder pesquisa UNIFOR <ArrowRight size={16}/>
          </Link>}
        </div>
        <p className="shrink-0 border-t border-white/10 pt-2 text-center text-[11px] leading-4 text-white/50">
          A liberação acontece em 04/11 às 00h, horário de Fortaleza. Esta prévia não garante uma carona.
        </p>
      </div>
    </main>
  );
}
