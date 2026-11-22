import { useEffect, useState, type FormEvent } from "react";
import { Headset, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function buildCaronaaSupportWhatsAppUrl(message:string,number:string):string {
  const digits=number.replace(/\D/g,"");
  if(!/^[1-9]\d{7,14}$/.test(digits))throw new Error("Número de suporte indisponível");
  return "https://wa.me/"+digits+"?text="+encodeURIComponent(message.trim());
}
export function DriverWhatsAppSupport(){
  const [open,setOpen]=useState(false);
  const [message,setMessage]=useState("");
  const [number,setNumber]=useState<string|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    void (supabase as any).rpc("get_caronaa_support_whatsapp").then(
      ({data,error:rpcError}:{data:string|null;error?:{message:string}})=>{
        if(!active)return;
        if(rpcError||!data){setError("Contato de suporte indisponível no momento.");setNumber(null);}
        else {setNumber(data);setError("");}
      },
      ()=>{if(active){setNumber(null);setError("Não foi possível carregar o contato de suporte.");}},
    );
    return()=>{active=false;};
  },[]);
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!message.trim()||!number)return;
    try{window.location.assign(buildCaronaaSupportWhatsAppUrl(message,number));}
    catch{setError("Número de suporte inválido. Avise a administração.");}
  }
  return <>
    <section className="driver-account__support" aria-label="Ajuda e suporte CARONAA">
      <span className="driver-account__support-icon"><Headset size={25} aria-hidden="true"/></span>
      <div className="min-w-0 flex-1"><h2 className="driver-account__card-title">Precisa de ajuda?</h2>
        <p>Escreva sua dúvida aqui e continue a conversa pelo WhatsApp do CARONAA.</p></div>
      <button type="button" className="driver-account__support-button" onClick={()=>setOpen(true)}>
        <MessageCircle size={18} aria-hidden="true"/> Falar com o suporte
      </button>
    </section>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dark w-[calc(100vw-1.5rem)] max-w-lg rounded-3xl border border-[#FFBB00]/25 bg-[#121212] p-5 text-white shadow-2xl sm:p-6">
        <DialogHeader className="pr-6 text-left"><DialogTitle className="font-[Sora] text-xl font-extrabold text-white">Suporte CARONAA</DialogTitle>
          <DialogDescription className="text-sm text-white/65">Escreva sua mensagem aqui. Ao continuar, o WhatsApp abrirá com o texto preenchido.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="caronaa-support-message" className="block text-sm font-bold text-white">Sua mensagem</label>
          <textarea id="caronaa-support-message" name="message" rows={6} maxLength={1500} autoFocus required
            value={message} onChange={event=>setMessage(event.target.value)}
            placeholder="Olá, equipe CARONAA! Preciso de ajuda com..."
            className="min-h-36 w-full resize-y rounded-xl border border-white/20 bg-white/10 p-3 text-base text-white placeholder:text-white/40 focus:border-[#FFBB00] focus:outline-none focus:ring-2 focus:ring-[#FFBB00]/20"/>
          {error&&<p role="alert" className="text-xs text-red-300">{error}</p>}
          <p className="text-xs leading-relaxed text-white/60">Nada será enviado automaticamente. Confira e envie a mensagem no WhatsApp.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={()=>setOpen(false)} className="min-h-12 rounded-xl border border-white/20 px-5 font-semibold text-white">Cancelar</button>
            <button type="submit" disabled={!message.trim()||!number} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-5 font-[Sora] text-sm font-extrabold text-[#121212] disabled:opacity-50">
              <Send size={17} aria-hidden="true"/> Enviar pelo WhatsApp
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}