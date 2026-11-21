import { Bike, CarFront, CheckCircle2, Clock3, CreditCard, MapPin,
  MessageCircle, Navigation, ShieldCheck, Star, AlertTriangle, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type OnlineDriver={
  id:string;name:string;avatar_url?:string|null;vehicle_type:string|null;
  vehicle_brand?:string|null;vehicle_model?:string|null;vehicle_color?:string|null;
  vehicle_plate?:string|null;municipality?:string|null;
  gps_sampled_at?:string|null;gps_accuracy_m?:number|null;last_seen_at?:string|null;
  gps_valid:boolean;dispatch_ready:boolean;online:boolean;
  status_code?:string|null;active_ride_id?:string|null;
  whatsapp?:string|null;has_pix?:boolean;trips_today?:number;rating?:number|null;
};

const dateTime=(date:string|null|undefined)=>{
  if(!date)return "Sem registro";
  const value=new Date(date);
  return Number.isNaN(value.getTime())?"Sem registro":
    value.toLocaleString("pt-BR",{timeZone:"America/Fortaleza"});
};
const statusLabel=(driver:OnlineDriver)=>{
  if(driver.active_ride_id)return "Em atendimento";
  if(!driver.gps_valid)return "GPS pendente";
  if(driver.dispatch_ready)return "Apto a receber";
  return "Online · cadastro pendente";
};
function Portrait({driver,size="md"}:{driver:OnlineDriver;size?:"sm"|"md"}){
  return <div className={"shrink-0 overflow-hidden rounded-full border border-border bg-muted font-bold dark:border-white/20 "+
    (size==="sm"?"flex size-11 items-center justify-center":"flex size-16 items-center justify-center")}>
    {driver.avatar_url?<img src={driver.avatar_url} alt="" className="size-full object-cover" loading="lazy"/>:
      <span className="text-lg">{driver.name.trim().slice(0,1).toUpperCase()||"M"}</span>}
  </div>;
}
export function OnlineDriverDirectory({drivers,selectedId,onSelect,query="")}:{
  drivers:OnlineDriver[];selectedId:string|null;onSelect:(id:string)=>void;query?:string;
}){
  const q=query.trim().toLocaleLowerCase("pt-BR");
  const entries=drivers.filter(driver=>!q||[driver.name,driver.municipality,
    driver.vehicle_brand,driver.vehicle_model,driver.vehicle_plate].some(value=>
      (value??"").toLocaleLowerCase("pt-BR").includes(q)));
  return <div className="space-y-2 p-3" role="list" aria-label="Motoristas online">
    <div className="mb-3">
      <h3 className="font-[Sora] text-base font-bold">Motoristas online ({drivers.length})</h3>
      <p className="text-xs text-muted-foreground">Sinal recente do servidor. Estar online não significa estar apto a receber corridas.</p>
    </div>
    {entries.map(driver=><button role="listitem" key={driver.id} type="button"
      onClick={()=>onSelect(driver.id)} aria-current={selectedId===driver.id?"true":undefined}
      className={"flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] "+
        (selectedId===driver.id?"border-[#FFBB00] bg-amber-50 dark:bg-amber-500/10":
        "border-border bg-background hover:bg-muted/40 dark:border-white/10 dark:bg-[#161C24] dark:hover:bg-white/10")}>
      <Portrait driver={driver} size="sm"/>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">{driver.name}</strong>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 dark:bg-green-500/20 dark:text-green-300">
            <span className="size-1.5 rounded-full bg-green-500"/>Online
          </span>
          <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold "+
            (driver.gps_valid?"bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300":
              "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300")}>
            {driver.gps_valid?"GPS válido":"GPS pendente"}
          </span>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {driver.vehicle_type==="MOTO"?<Bike size={13}/>:<CarFront size={13}/>}
          <span className="truncate">{[driver.vehicle_brand,driver.vehicle_model].filter(Boolean).join(" ")||
            (driver.vehicle_type==="MOTO"?"Moto":"Carro")}</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin size={12}/>{driver.municipality||"Município não informado"}</span>
          <span className="flex items-center gap-1"><Clock3 size={12}/>Último GPS: {dateTime(driver.gps_sampled_at)}</span>
        </div>
        {!driver.dispatch_ready&&<p className="text-[11px] text-amber-700 dark:text-amber-300">
          {statusLabel(driver)}
        </p>}
      </div>
    </button>)}
    {entries.length===0&&<div className="rounded-xl bg-muted/30 p-7 text-center text-sm text-muted-foreground">
      {q?"Nenhum motorista online corresponde à pesquisa.":"Nenhum motorista com conexão recente. Os registros antigos não são contados como online."}
    </div>}
  </div>;
}
export function OnlineDriverDetails({driver,onFocus,onManage,onClose}:{
  driver:OnlineDriver|null;onFocus:()=>void;onManage:()=>void;onClose?:()=>void;
}){
  return <section aria-label="Detalhes do motorista"
    className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm dark:border-white/10 dark:bg-[#11161D] sm:p-4">
    <header className="flex items-center justify-between border-b border-border pb-3 dark:border-white/10">
      <h3 className="font-[Sora] text-base font-bold">Detalhes do motorista</h3>
      {onClose&&<button type="button" onClick={onClose} aria-label="Fechar detalhes do motorista"
        className="rounded-lg p-2 hover:bg-muted"><X size={18}/></button>}
    </header>
    {!driver?<div className="flex flex-1 flex-col items-center justify-center gap-2 py-14 text-center">
      <UserRound size={26} className="text-muted-foreground"/>
      <p className="text-sm font-semibold">Selecione um motorista online</p>
      <p className="text-xs text-muted-foreground">O perfil e os dados atuais aparecerão aqui.</p>
    </div>:<>
      <div className="flex items-center gap-3">
        <Portrait driver={driver}/>
        <div className="min-w-0">
          <p className="break-words font-bold">{driver.name}</p>
          <p className="text-xs text-muted-foreground">{[driver.vehicle_brand,driver.vehicle_model].filter(Boolean).join(" ")||
            (driver.vehicle_type==="MOTO"?"Moto":"Carro")}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 dark:bg-green-500/20 dark:text-green-300">Online</span>
            <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold "+
              (driver.gps_valid?"bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300":
                "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300")}>
              {driver.gps_valid?"GPS válido":"GPS pendente"}
            </span>
          </div>
        </div>
      </div>
      <dl className="space-y-2.5 border-t border-border py-3 text-xs dark:border-white/10 sm:text-sm">
        {[
          {icon:MapPin,label:"Município",value:driver.municipality||"Não informado"},
          {icon:Clock3,label:"Último GPS",value:dateTime(driver.gps_sampled_at)},
          {icon:Navigation,label:"Precisão",value:driver.gps_accuracy_m!=null?Math.round(driver.gps_accuracy_m)+" m":"Indisponível"},
          {icon:CarFront,label:"Veículo",value:[driver.vehicle_brand,driver.vehicle_model,driver.vehicle_color].filter(Boolean).join(" · ")||"Não informado"},
          {icon:CreditCard,label:"Placa",value:driver.vehicle_plate||"Não informada"},
          {icon:ShieldCheck,label:"Pix cadastrado",value:driver.has_pix===true?"Sim":driver.has_pix===false?"Não":"Não verificado"},
          {icon:CheckCircle2,label:"Corridas hoje",value:driver.trips_today==null?"Não informado":String(driver.trips_today)},
          {icon:Star,label:"Avaliação",value:driver.rating==null?"Sem avaliações":Number(driver.rating).toLocaleString("pt-BR",{maximumFractionDigits:2})+" / 5"},
        ].map(({icon:Icon,label,value})=><div key={label} className="grid grid-cols-[18px_minmax(0,0.9fr)_minmax(0,1.25fr)] items-start gap-2">
          <Icon size={16} className="text-muted-foreground"/>
          <dt className="text-muted-foreground">{label}</dt><dd className="break-words font-semibold">{value}</dd>
        </div>)}
        <div className="grid grid-cols-[18px_minmax(0,0.9fr)_minmax(0,1.25fr)] items-start gap-2">
          <ShieldCheck size={16} className="text-muted-foreground"/><dt className="text-muted-foreground">Situação</dt>
          <dd className={"font-semibold "+(driver.dispatch_ready?"text-green-700 dark:text-green-300":"text-amber-700 dark:text-amber-300")}>
            {statusLabel(driver)}
          </dd>
        </div>
      </dl>
      <div className="mt-auto space-y-2 pt-2">
        <Button type="button" onClick={onFocus}
          className="min-h-11 w-full bg-[#FFBB00] font-bold text-[#121212] hover:bg-[#E6A800]">
          <Navigation size={16} className="mr-2"/>Ver no mapa
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {driver.whatsapp?<Button asChild variant="outline" className="min-h-11 px-1 text-xs">
            <a href={"https://wa.me/"+driver.whatsapp.replace(/[^0-9]/g,"")} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={14} className="mr-1"/>Contatar</a>
          </Button>:<span className="flex min-h-11 items-center justify-center rounded-lg border px-1 text-center text-xs text-muted-foreground">Sem contato autorizado</span>}
          <Button variant="outline" onClick={onManage} className="min-h-11 px-1 text-xs">
            <AlertTriangle size={14} className="mr-1"/>Registrar problema
          </Button>
        </div>
      </div>
    </>}
  </section>;
}
