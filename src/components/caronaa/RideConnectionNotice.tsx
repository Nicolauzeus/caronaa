import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Wifi, Smartphone, ShieldCheck } from "lucide-react";

/**
 * Once-per-ride operational advice. Never navigates or changes ride state.
 * Shows only when a server-acknowledged ride ID becomes active.
 */
export function RideConnectionNotice({rideId,role}:{
  rideId:string|null|undefined;role:"PASSENGER"|"DRIVER";
}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(!rideId){setVisible(false);return;}
    const key="caronaa:connection-advice:v1:"+role+":"+rideId;
    try{setVisible(sessionStorage.getItem(key)!=="ack");}
    catch{setVisible(true);}
  },[rideId,role]);
  if(!rideId||!visible||typeof document==="undefined")return null;
  const close=()=>{
    try{sessionStorage.setItem("caronaa:connection-advice:v1:"+role+":"+rideId,"ack");}catch{}
    setVisible(false);
  };
  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="caronaa-connection-title"
        className="w-full max-w-sm space-y-4 rounded-3xl border border-[#FFBB00]/40 bg-[#121212] p-5 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-[#FFBB00]">
          <Wifi size={22} aria-hidden="true"/>
          <h2 id="caronaa-connection-title" className="font-[Sora] text-lg font-extrabold">Mantenha sua corrida conectada</h2>
        </div>
        <p className="text-sm leading-relaxed text-white/85">
          {role==="PASSENGER"
            ?"Seu pedido está ativo. Para acompanhar o motorista e receber o código de embarque sem atrasos:"
            :"Você está com uma corrida ativa. Para acompanhar a rota e receber as confirmações do passageiro:"}
        </p>
        <div className="space-y-3 text-sm text-white/85">
          <p className="flex items-start gap-2"><Smartphone className="mt-0.5 shrink-0 text-[#FFBB00]" size={18}/>
            Mantenha o CARONAA aberto e a tela ligada quando possível.</p>
          <p className="flex items-start gap-2"><Wifi className="mt-0.5 shrink-0 text-[#FFBB00]" size={18}/>
            Prefira uma conexão estável e mantenha o acesso à localização autorizado.</p>
          <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#FFBB00]" size={18}/>
            Se a internet cair, não crie outro pedido: o aplicativo tentará sincronizar a mesma corrida.</p>
        </div>
        <button type="button" onClick={close} autoFocus
          className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 text-base font-extrabold text-[#121212]">
          Entendi
        </button>
      </section>
    </div>,document.body
  );
}
