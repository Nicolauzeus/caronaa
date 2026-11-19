import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Camera, ChevronRight, IdCard, MapPin, Route, ShieldCheck, Wallet } from "lucide-react";
import { DriverWhatsAppSupport } from "./DriverWhatsAppSupport";

type SectionKey = "personal" | "security" | "notifications" | "pix";
type Props = {
  fullName:string; initials:string; photo:string|null; city:string;
  verified:boolean; onPhoto:()=>void; onSave:()=>void; saving:boolean;
  personalFields:ReactNode; securityContent:ReactNode; notificationContent:ReactNode; pixContent?:ReactNode;
  hasDriverProfile:boolean;
};
export function PassengerAccountDashboard({
  fullName,initials,photo,city,verified,onPhoto,onSave,saving,
  personalFields,securityContent,notificationContent,pixContent,hasDriverProfile,
}:Props){
  const [expanded,setExpanded]=useState<SectionKey|null>(()=>typeof window!=="undefined"&&window.location.hash==="#pix-do-motorista"?"pix":null);
  const show=(key:SectionKey)=>setExpanded(previous=>previous===key?null:key);
  const openPersonal=()=>{
    setExpanded("personal");
    if(typeof window!=="undefined")window.requestAnimationFrame(()=>{
      const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      document.getElementById("passenger-personal")?.scrollIntoView?.({behavior:reduced?"auto":"smooth",block:"center"});
    });
  };
  const section=(key:SectionKey,title:string,subtitle:string,Icon:typeof Bell,content:ReactNode)=>(
    <section key={key} className="min-w-0 self-start rounded-2xl border border-white/15 bg-white/[0.055] px-3.5 py-2 sm:p-5">
      <button type="button" aria-expanded={expanded===key} aria-controls={"passenger-"+key}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00]" onClick={()=>show(key)}>
        <Icon className="size-5 shrink-0 text-[#FFBB00]" aria-hidden="true"/>
        <span className="min-w-0 flex-1"><strong className="block font-[Sora] text-sm font-extrabold sm:text-base">{title}</strong>
          <small className="text-xs text-white/65">{subtitle}</small></span>
        <ChevronRight className={`size-5 shrink-0 text-white/60 transition-transform motion-reduce:transition-none ${expanded===key?"rotate-90":""}`} aria-hidden="true"/>
      </button>
      {expanded===key&&<div id={"passenger-"+key} className="mt-4 scroll-mt-20 space-y-3 border-t border-white/15 pt-4">{content}</div>}
    </section>
  );
  return <div className="dark mx-auto max-w-5xl space-y-3 rounded-3xl bg-[#121212] p-3 font-[Manrope] text-white sm:space-y-5 sm:p-6">
    <header className="space-y-1"><p className="text-[11px] font-black tracking-[.13em] text-[#FFBB00]">CARONAA PASSAGEIRO</p>
      <h1 className="font-[Sora] text-xl font-black sm:text-2xl">Minha conta</h1></header>
    <section aria-label="Minha identidade" className="rounded-3xl border border-[#FFBB00]/25 bg-[radial-gradient(ellipse_at_top_right,rgba(255,187,0,.16),transparent_60%),linear-gradient(120deg,#221D0E,#121212_75%)] p-3.5 sm:p-7">
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative size-16 shrink-0 sm:size-28">
          <button type="button" aria-label="Alterar foto de perfil" onClick={onPhoto} className="flex size-full items-center justify-center overflow-hidden rounded-full border-[3px] border-[#FFBB00] bg-[#272727] shadow-[0_0_0_5px_rgba(255,187,0,.12)]">
            {photo?<img src={photo} alt="Foto de perfil" className="size-full object-cover"/>:<span className="font-[Sora] text-2xl font-black text-[#FFBB00]">{initials}</span>}
          </button>
          <button type="button" onClick={onPhoto} aria-label="Escolher foto da galeria ou câmera" className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-[#FFBB00] text-[#121212]"><Camera size={17}/></button>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="break-words font-[Sora] text-lg font-black sm:text-2xl">{fullName.trim()||"Passageiro CARONAA"}</h2>
          <p className="flex items-center gap-1 text-sm text-white/75"><MapPin size={15} className="text-[#FFBB00]"/>{city.trim()||"Cidade não informada"}</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#FFBB00]/25 bg-[#FFBB00]/10 px-2.5 py-1 text-xs text-[#FFBB00]"><ShieldCheck size={14}/>{verified?"Vínculo confirmado":"Conta CARONAA"}</span>
        </div>
      </div>
      <button type="button" onClick={openPersonal} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 font-[Sora] text-sm font-extrabold text-[#121212] sm:w-auto">
        <IdCard size={18}/> Editar meus dados
      </button>
    </section>
    <div className="grid gap-2 sm:grid-cols-2">
      <Link to="/minhas-caronas" className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#FFBB00]/30 bg-[#FFBB00]/10 px-3.5 py-2.5 transition-colors hover:bg-[#FFBB00]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFBB00]">
        <Route className="size-6 shrink-0 text-[#FFBB00]"/><span className="flex-1"><strong className="block font-[Sora]">Minhas viagens</strong><small className="text-xs text-white/70">Pedidos, reservas e histórico</small></span><ChevronRight size={18}/>
      </Link>
      {section("personal","Dados pessoais","Nome, cidade e contato",IdCard,<div className="space-y-4">
        {personalFields}
        <button type="button" onClick={onSave} disabled={saving} className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-extrabold text-[#121212] disabled:opacity-50">{saving?"Salvando...":"Salvar meus dados"}</button>
      </div>)}
      {section("security","Segurança e verificações","Vínculos confirmados",ShieldCheck,securityContent)}
      {section("notifications","Notificações","Som e avisos",Bell,notificationContent)}
      {hasDriverProfile&&pixContent&&<div id="pix-do-motorista">{section("pix","Chave Pix do motorista","Cadastrar ou atualizar recebimentos",Wallet,pixContent)}</div>}
    </div>
    <DriverWhatsAppSupport/>
    {hasDriverProfile&&<Link to="/cadastro-motorista" className="flex min-h-12 items-center gap-2 rounded-xl border border-white/15 p-3 text-xs text-white/65">Consultar cadastro profissional <ChevronRight className="ml-auto size-4"/></Link>}
  </div>;
}
