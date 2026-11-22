import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3, Download, Mail, MessageCircle, Printer, RefreshCw, Users, XCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import "./operations-history-print.css";
import { OperationsReportSchedules } from "./OperationsReportSchedules";
import { calculateOperationsDisplay, PRESENTATION_ILLUSTRATIVE_REQUESTS } from "./operations-presentation";

type Summary = {
  orders:number; accepted:number; unaccepted:number; completed:number; cancelled:number;
  expired:number; in_progress:number;searching:number;other:number; unique_passengers:number;
  flash_orders:number;shared_orders:number;completed_fares_cents:number;completed_unpriced?:number;
  cancelled_without_acceptance:number;cancelled_after_acceptance:number;expired_without_acceptance:number;
};
type Order = {
  id:string;service:"flash"|"shared";requested_at:string;origin:string;destination:string;
  municipality:string;status:string;accepted:boolean;completed:boolean;cancelled:boolean;
  expired:boolean;fare_cents:number;payment_status:string;passenger_name:string;driver_name:string|null;
};
type Hour = {hour:number;orders:number;passengers:number};
type Report = {
  generated_at:string; timezone:string;summary:Summary;hours:Hour[];
  hour_days:Array<{weekday:number;hour:number;orders:number}>;
  presence_hours?:Array<{hour:number;drivers:number;passengers_preparing:number}>;
  presence_hour_days?:Array<{weekday:number;hour:number;drivers:number;passengers_preparing:number}>;
  presence_started_at?:string|null;
  active_now:{drivers:number;passengers_preparing:number};
  history_of_presence_available:boolean;total_rows:number;rows:Order[];
};
type Preset = "today"|"7d"|"30d"|"custom";
const fmt = (v:number|undefined|null)=>typeof v==="number"?v.toLocaleString("pt-BR"):"—";
const money=(cents:number|undefined)=>typeof cents==="number"?
  new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100):"—";
const dateBR=(date:string)=>new Date(date).toLocaleString("pt-BR",{timeZone:"America/Fortaleza",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const localDay=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const periodDates=(preset:Preset,from:string,to:string)=>{
  const now=new Date();
  const end=localDay(now);
  if(preset==="custom")return {from,to};
  if(preset==="today")return {from:end,to:end};
  const d=new Date(now.getTime()-(preset==="7d"?6:29)*86400000);
  return {from:localDay(d),to:end};
};
const palette=["bg-[#FFBB00]","bg-[#FFE49B]","bg-[#FFF1CA]","bg-[#F5F5F5]"];
function Stat({title,value,hint,icon}: {title:string;value:string;hint:string;icon:React.ReactNode}) {
  return <article className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}<span>{title}</span></div>
    <p className="mt-2 font-[Sora] text-2xl font-extrabold tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </article>;
}
function downloadCsv(rows:Order[]) {
  const fields=["Data","Serviço","Passageiro","Motorista","Origem","Destino","Valor estimado","Status"];
  const escape=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")+'"';
  const csv="\uFEFF"+[fields,...rows.map(x=>[
    dateBR(x.requested_at),x.service==="flash"?"Corrida Rápida":"Carona",
    x.passenger_name,x.driver_name??"",x.origin,x.destination,money(x.fare_cents),x.status
  ])].map(line=>line.map(escape).join(";")).join("\r\n");
  const a=document.createElement("a");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.href=url;a.download="caronaa-historico.csv";a.click();URL.revokeObjectURL(url);
}
export function OperationsHistoryReport(){
  const [preset,setPreset]=useState<Preset>("7d");
  const [from,setFrom]=useState("");const [to,setTo]=useState("");
  const [service,setService]=useState<"all"|"flash"|"shared">("all");
  const [status,setStatus]=useState("all");
  const [presentationMode,setPresentationMode]=useState(false);
  const [heatMetric,setHeatMetric]=useState<"orders"|"drivers"|"passengers_preparing">("orders");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(0);const [reload,setReload]=useState(0);
  const [report,setReport]=useState<Report|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const dates=periodDates(preset,from,to);
  const valid=Boolean(dates.from&&dates.to&&dates.from<=dates.to);
  const load=useCallback(async()=>{
    if(!valid){setReport(null);return;}
    setBusy(true);setError("");
    const {data,error:rpcError}=await (supabase as any).rpc("admin_operations_history_report",{
      p_from:dates.from,p_to:dates.to,p_service:service,p_limit:40,p_offset:page*40,
    });
    if(rpcError||!data?.summary||!Array.isArray(data?.hours)||!Array.isArray(data?.rows)){
      setError("Relatório indisponível. Aplique a migration 0232 antes de publicar esta tela. "+(rpcError?.message??""));
      setReport(null);
    } else setReport(data as Report);
    setBusy(false);
  },[dates.from,dates.to,service,page,valid]);
  useEffect(()=>{void load();},[load,reload]);
  const rows=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("pt-BR");
    return (report?.rows??[]).filter(r=>
      (status==="all"||(status==="unaccepted"&&!r.accepted)||
      (status==="completed"&&r.completed)||(status==="cancelled"&&r.cancelled)||
      (status==="accepted"&&r.accepted)) &&
      (!q||[r.id,r.passenger_name,r.driver_name,r.origin,r.destination,r.municipality]
        .some(s=>(s??"").toLocaleLowerCase("pt-BR").includes(q))));
  },[report,status,query]);
  const maxHour=Math.max(1,...(report?.hours??[]).map(x=>x.orders));
  const peak=report?.hours?.length?report.hours.reduce((a,b)=>b.orders>a.orders?b:a):null;
  const quiet=report?.hours?.length?report.hours.filter(x=>x.orders>0).sort((a,b)=>a.orders-b.orders)[0]:null;
  const display=report?calculateOperationsDisplay(report.summary,presentationMode):null;
  const selectedHeat=heatMetric==="orders"?report?.hour_days:report?.presence_hour_days;
  const heatMap=useMemo(()=>{
    const field=heatMetric==="orders"?"orders":heatMetric;
    return new Map<string,number>((selectedHeat??[]).map(x=>[x.weekday+":"+x.hour,Number((x as unknown as Record<string,number>)[field]??0)] as const));
  },[selectedHeat,heatMetric]);
  const heatMax=Math.max(1,...heatMap.values());
  const peakPresence=(kind:"drivers"|"passengers_preparing")=>
    (report?.presence_hours??[]).reduce<{hour:number;value:number}|null>((best,h)=>{
      const value=h[kind]??0;
      return !best||value>best.value?{hour:h.hour,value}:best;
    },null);
  const driverPeak=peakPresence("drivers");
  const passengerPeak=peakPresence("passengers_preparing");
  const share=()=>{
    if(!report||presentationMode)return;
    const msg="CARONAA · Resumo operacional ("+dates.from+" a "+dates.to+")\n"+
      "Pedidos: "+fmt(report.summary.orders)+"\nSem aceite: "+fmt(report.summary.unaccepted)+
      "\nConcluídas: "+fmt(report.summary.completed)+"\nCanceladas: "+fmt(report.summary.cancelled);
    window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank","noopener,noreferrer");
  };
  const sendEmail=()=>{
    if(!report||presentationMode)return;
    const body="Resumo operacional CARONAA\nPeríodo: "+dates.from+" a "+dates.to+
      "\nPedidos: "+fmt(report.summary.orders)+"\nSem aceite: "+fmt(report.summary.unaccepted)+
      "\nAceitos: "+fmt(report.summary.accepted)+"\nConcluídas: "+fmt(report.summary.completed)+
      "\nCanceladas: "+fmt(report.summary.cancelled)+"\n\nGerado a partir de dados operacionais.";
    window.location.href="mailto:?subject="+encodeURIComponent("CARONAA · Resumo operacional")+"&body="+encodeURIComponent(body);
  };
  return <main className="caronaa-report-print min-w-0 space-y-4 pb-8" aria-label="Histórico e relatórios de operações">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-[Sora] text-2xl font-extrabold">Histórico &amp; Relatórios</h1>
        <p className="text-sm text-muted-foreground">Pedidos, corridas, engajamento e inteligência de horários · Fuso de Fortaleza.</p>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button size="sm" variant="outline" onClick={()=>window.print()}><Printer size={15} className="mr-1"/> Imprimir / PDF</Button>
        <Button size="sm" variant="outline" disabled={!report||presentationMode} onClick={sendEmail}><Mail size={15} className="mr-1"/> E-mail</Button>
        <Button size="sm" variant="outline" disabled={!report||presentationMode} onClick={share}><MessageCircle size={15} className="mr-1"/> WhatsApp</Button>
        <Button size="sm" variant="outline" disabled={!report||presentationMode} onClick={()=>downloadCsv(rows)}><Download size={15} className="mr-1"/> CSV da página</Button>
      </div>
    </header>
    <section className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3 print:hidden" aria-label="Filtros dos relatórios">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
        {(["today","7d","30d","custom"] as const).map((p)=><button key={p} type="button" onClick={()=>{setPreset(p);setPage(0);}}
          aria-pressed={preset===p} className={"rounded-full px-3 py-2 text-xs font-semibold "+(preset===p?"bg-[#FFBB00] text-[#121212]":"bg-muted text-foreground")}>
          {{today:"Hoje","7d":"7 dias","30d":"30 dias",custom:"Personalizado"}[p]}
        </button>)}
      </div>
      {preset==="custom"&&<><label className="text-xs">De <input aria-label="Data inicial" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}} className="block rounded-lg border bg-background p-2"/></label>
        <label className="text-xs">Até <input aria-label="Data final" type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(0);}} className="block rounded-lg border bg-background p-2"/></label></>}
      <label className="text-xs">Serviço <select aria-label="Serviço" value={service} onChange={e=>{setService(e.target.value as typeof service);setPage(0);}} className="block rounded-lg border bg-background p-2">
        <option value="all">Todos</option><option value="flash">Corridas Rápidas</option><option value="shared">Caronas</option>
      </select></label>
      <Button size="sm" variant="outline" onClick={()=>setReload(x=>x+1)} disabled={busy}><RefreshCw size={14} className="mr-1"/> Atualizar</Button>
      <button type="button" aria-pressed={presentationMode} disabled={!report||busy} onClick={()=>setPresentationMode(value=>!value)}
        className={"min-h-10 rounded-xl border px-3 text-xs font-bold transition-colors disabled:opacity-50 "+
          (presentationMode?"border-amber-600 bg-amber-100 text-amber-900":"border-border bg-card text-foreground")}>
        {presentationMode?"Sair da demonstração":"Modo apresentação (+108)"}
      </button>
    </section>
    {presentationMode&&report&&!busy&&<section role="note" className="caronaa-demo-banner space-y-2 rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950">
      <h2 className="font-[Sora] text-base font-extrabold">CENÁRIO DEMONSTRATIVO — NÃO SÃO DADOS REAIS</h2>
      <p className="text-sm">
        {fmt(display?.actualOrders)} pedidos registrados de verdade + {PRESENTATION_ILLUSTRATIVE_REQUESTS} pedidos hipotéticos,
        classificados exclusivamente como aguardando motorista = <strong>{fmt(display?.orders)} pedidos neste cenário ilustrativo</strong>.
      </p>
      <p className="text-xs">
        Esta projeção usa o serviço e período selecionados. Banco, clientes, motoristas, histórico, horários e mapa de calor permanecem reais e inalterados.
        A taxa de aceite do cenário é hipotética. Compartilhamentos e CSV ficam desativados nesta visualização.
      </p>
    </section>}
    {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!valid&&<p role="status" className="text-sm text-muted-foreground">Selecione um intervalo válido.</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Resultados exclusivos das solicitações">
      <Stat title="Pedidos registrados" icon={<Users size={18}/>} value={busy?"…":fmt(display?.orders)}
        hint={presentationMode?"Real: "+fmt(report?.summary.orders)+" · Simulados: +108":"Total real de solicitações no período"}/>
      <Stat title="Aguardando motorista" icon={<Clock3 size={18}/>} value={busy?"…":fmt(display?.searching)}
        hint={presentationMode?"Real: "+fmt(report?.summary.searching)+" · Simulados: +108":"Solicitações abertas, ainda sem aceite"}/>
      <Stat title="Em atendimento" icon={<Activity size={18}/>} value={busy?"…":fmt(display?.in_progress)}
        hint="Aceitas, embarcando, em viagem ou revisão"/>
      <Stat title="Corridas concluídas" icon={<CheckCircle2 size={18}/>} value={busy?"…":fmt(display?.completed)}
        hint="Concluídas com registro confirmado"/>
      <Stat title="Canceladas" icon={<XCircle size={18}/>} value={busy?"…":fmt(display?.cancelled)}
        hint={fmt(report?.summary.cancelled_without_acceptance)+" antes do aceite · "+fmt(report?.summary.cancelled_after_acceptance)+" depois"}/>
      <Stat title="Expiradas" icon={<Clock3 size={18}/>} value={busy?"…":fmt(display?.expired)}
        hint="Prazo encerrado sem aceite, inclusive buscas vencidas ainda não regularizadas"/>
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Composição e reconciliação dos pedidos">
      <div>
        <h2 className="font-[Sora] text-lg font-bold">Entenda a conversão dos pedidos</h2>
        <p className="text-xs text-muted-foreground">
          Aceite e resultado final são duas leituras diferentes do mesmo pedido. Nunca some os cancelamentos novamente ao total.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Nunca receberam aceite</p>
          <p className="font-[Sora] text-xl font-extrabold">{fmt(display?.unaccepted)}</p>
          <p className="text-xs text-muted-foreground">{presentationMode?"Inclui 108 pedidos hipotéticos":"Inclui cancelados antes do aceite, expirados e aguardando"}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Receberam aceite de motorista</p>
          <p className="font-[Sora] text-xl font-extrabold">{fmt(display?.accepted)}</p>
          <p className="text-xs text-muted-foreground">
            Taxa {presentationMode?"ilustrativa":"real"} de aceite: {display?display.displayedAcceptanceRate.toFixed(1).replace(".",",")+"%":"—"}
            {presentationMode&&display?" · taxa real: "+display.realAcceptanceRate.toFixed(1).replace(".",",")+"%":""}
          </p>
        </div>
      </div>
      {display&&<div className="flex h-3 w-full overflow-hidden rounded-full" role="img"
        aria-label={display.unaccepted+" sem aceite e "+display.accepted+" com aceite"}>
        <div className="bg-amber-400" style={{width:(display.orders?100*display.unaccepted/display.orders:0)+"%"}}/>
        <div className="bg-emerald-500" style={{width:(display.orders?100*display.accepted/display.orders:0)+"%"}}/>
      </div>}
      <p className="text-xs text-muted-foreground">
        Cancelamentos: <strong>{fmt(display?.cancelled_without_acceptance)} antes</strong> +{" "}
        <strong>{fmt(display?.cancelled_after_acceptance)} após o aceite</strong> ={" "}
        <strong>{fmt(display?.cancelled)} cancelamentos</strong>. São pedidos já incluídos na contagem total.
      </p>
      {display&&!display.outcomesReconcile&&
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Os resultados finais ainda não reconciliam com o total (outros estados: {fmt(display.other)}). Revise a classificação no servidor antes de divulgar um relatório fechado.
        </p>}
      {display&&!display.acceptanceReconciles&&<p role="alert" className="text-xs text-red-700">Contagens de pedidos aceitos e não aceitos não correspondem ao total. Verifique a consulta.</p>}
      {display&&!display.cancellationsReconcile&&
        <p role="alert" className="text-xs text-red-700">
          Atenção: cancelamentos antes/depois do aceite não reconciliam; verifique o histórico de status.
        </p>}
    </section>
    <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <article className="rounded-2xl border bg-card p-4">
        <h2 className="font-[Sora] text-lg font-bold">Horários com mais pedidos</h2>
        <p className="mb-4 text-xs text-muted-foreground">Pedidos reais criados por hora local no período. O cenário demonstrativo não altera este gráfico.</p>
        <div className="grid grid-cols-12 items-end gap-1 sm:grid-cols-24" role="img" aria-label="Histograma de pedidos por hora">
          {(report?.hours??Array.from({length:24},(_,hour)=>({hour,orders:0,passengers:0}))).map(h=>
            <div key={h.hour} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[9px] tabular-nums text-muted-foreground">{report?fmt(h.orders):"—"}</span>
              <div title={h.hour+"h: "+h.orders+" pedidos"} className={"w-full rounded-t-sm "+palette[h.orders===maxHour?0:h.orders>maxHour/2?1:h.orders>0?2:3]}
                style={{height:Math.max(5,Math.round(h.orders/maxHour*104))+"px"}}/>
              <span className="text-[9px] text-muted-foreground">{h.hour.toString().padStart(2,"0")}</span>
            </div>)}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Maior movimento: {report&&peak&&peak.orders>0?peak.hour+"h ("+peak.orders+" pedidos)":"Sem pedidos no período"} · Menor horário com pedidos: {quiet?quiet.hour+"h ("+quiet.orders+")":"Não identificado"}</p>
      </article>
      <article className="rounded-2xl border bg-card p-4">
        <h2 className="font-[Sora] text-lg font-bold">Oferta × demanda</h2>
        <p className="mb-4 text-xs text-muted-foreground">Presença atual e passageiros que prepararam pedidos.</p>
        <Stat title="Motoristas online agora" icon={<Activity size={18}/>} value={busy?"…":fmt(report?.active_now.drivers)} hint="Último sinal válido há até 90 segundos"/>
        <div className="mt-3"><Stat title="Passageiros preparando pedidos" icon={<Users size={18}/>} value={busy?"…":fmt(report?.active_now.passengers_preparing)} hint="Sinal de demanda nos últimos 90 segundos"/></div>
        <p className="mt-3 text-xs text-muted-foreground">Histórico por hora será exibido conforme sinais reais de atividade forem coletados. Ausência de amostras não significa ausência de usuários.</p>
      </article>
    </section>
    <section className="rounded-2xl border bg-card p-4" aria-label="Matriz de calor por hora e dia da semana">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[Sora] text-lg font-bold">Mapa de calor · horários de maior movimento</h2>
          <p className="text-xs text-muted-foreground">Segunda a domingo, 00h–23h · horário de Fortaleza.</p>
        </div>
        <div role="group" aria-label="Indicador do mapa de calor" className="flex flex-wrap gap-1 print:hidden">
          {([{key:"orders",label:"Pedidos"},{key:"drivers",label:"Motoristas ativos"},{key:"passengers_preparing",label:"Passageiros buscando"}] as const)
          .map(item=><button key={item.key} type="button" aria-pressed={heatMetric===item.key}
            onClick={()=>setHeatMetric(item.key)} className={"min-h-9 rounded-full px-3 text-xs font-semibold "+
              (heatMetric===item.key?"bg-[#FFBB00] text-[#121212]":"bg-muted text-foreground")}>
            {item.label}</button>)}
        </div>
      </div>
      {heatMetric!=="orders"&&!report?.history_of_presence_available?
        <p role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Ainda não há histórico de presença neste período. A coleta de sinais começou com a migration 0233.
          Nenhum valor de presença anterior foi estimado.
        </p>:
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[850px] space-y-1" role="table" aria-label="Intensidade de atividade por hora e dia">
            <div className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-1" role="row">
              <span role="columnheader" className="text-[10px] text-muted-foreground">Dia</span>
              {Array.from({length:24},(_,h)=><span key={h} role="columnheader" className="text-center text-[10px] text-muted-foreground">
                {h.toString().padStart(2,"0")}</span>)}
            </div>
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((day,weekday)=>
              <div key={day} className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-1" role="row">
                <span role="rowheader" className="flex items-center text-xs">{day}</span>
                {Array.from({length:24},(_,hour)=>{
                  const value=heatMap.get(weekday+":"+hour)??0;
                  const fraction=value/heatMax;
                  return <div key={hour} role="cell" title={day+" "+hour+"h: "+fmt(value)}
                    aria-label={day+", "+hour+" horas: "+value}
                    style={{backgroundColor:value===0?"#F3F4F6":fraction>.75?"#FFBB00":fraction>.45?"#FFD66B":fraction>.15?"#FFE8A8":"#FFF4D4"}}
                    className="h-7 rounded-[3px] border border-[#E9E9E9]"/>;
                })}
              </div>)}
          </div>
        </div>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {heatMetric==="orders"?
          <span>Pico de pedidos: {peak&&peak.orders>0?peak.hour+"h ("+peak.orders+" solicitações)":"Não identificado"}</span>:
          <span>Contagem de pessoas-hora registradas, não número simultâneo de pessoas online.</span>}
        <span>Pico de motoristas registrados: {driverPeak?.value?driverPeak.hour+"h ("+driverPeak.value+")":"Aguardando dados"}</span>
        <span>Pico de passageiros preparando pedidos: {passengerPeak?.value?passengerPeak.hour+"h ("+passengerPeak.value+")":"Aguardando dados"}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Pedidos usam a data da solicitação. Presença usa apenas sinais após a instalação da migration 0233,
        sem coordenadas GPS e sem reconstrução retroativa. A presença não é filtrada por modalidade.
      </p>
    </section>
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-[Sora] text-lg font-bold">Engajamento e conversão</h2>
      <p className="text-xs text-muted-foreground">Pessoas distintas que registraram pedidos: {fmt(report?.summary.unique_passengers)}. Isto não representa todos os visitantes do aplicativo; o acesso à Home ainda não possui um evento de sessão operacional comparável.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat title="Pedidos sem aceite expirados" value={fmt(report?.summary.expired_without_acceptance)} hint="Busca encerrada sem motorista" icon={<Clock3 size={16}/>}/>
        <Stat title="Cancelados antes do aceite" value={fmt(report?.summary.cancelled_without_acceptance)} hint="Perda anterior à atribuição" icon={<XCircle size={16}/>}/>
        <Stat title="Tarifas de corridas concluídas" value={money(report?.summary.completed_fares_cents)} hint={"Soma das tarifas conhecidas, não pagamentos recebidos. Sem tarifa: "+fmt(report?.summary.completed_unpriced)} icon={<CalendarDays size={16}/>}/>
      </div>
    </section>
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-[Sora] text-lg font-bold">Histórico de pedidos e corridas</h2>
          <p className="text-xs text-muted-foreground">{fmt(report?.total_rows)} pedidos no período · registros por solicitação, sem duplicar a viagem.</p></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <select aria-label="Status das solicitações" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border bg-background p-2 text-sm">
            <option value="all">Todos os status</option><option value="unaccepted">Sem aceite</option><option value="accepted">Aceitos</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option>
          </select>
          <input aria-label="Buscar no histórico carregado" placeholder="Buscar nesta página…" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 rounded-lg border bg-background p-2 text-sm"/>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-muted/50"><tr>{["Data/hora","Serviço","Passageiro","Motorista","Trajeto","Valor estimado","Status"].map(h=><th key={h} scope="col" className="p-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y">
          {rows.map(r=><tr key={r.service+":"+r.id} className="hover:bg-muted/30">
            <td className="whitespace-nowrap p-2">{dateBR(r.requested_at)}</td>
            <td className="p-2">{r.service==="flash"?"Rápida":"Caronaa"}</td>
            <td className="p-2">{r.passenger_name}</td><td className="p-2">{r.driver_name??"Não atribuído"}</td>
            <td className="max-w-[250px] truncate p-2" title={r.origin+" → "+r.destination}>{r.origin} → {r.destination}</td>
            <td className="whitespace-nowrap p-2">{money(r.fare_cents)}</td>
            <td className="p-2"><span className={"inline-block rounded-full px-2 py-1 font-semibold "+(r.completed?"bg-green-100 text-green-900":r.cancelled?"bg-red-100 text-red-900":r.accepted?"bg-blue-100 text-blue-900":"bg-amber-100 text-amber-900")}>
              {r.completed?"Concluída":r.cancelled?"Cancelada":r.expired?"Expirada":r.accepted?"Aceita / em curso":"Sem aceite"}
            </span></td></tr>)}
          {!rows.length&&<tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{busy?"Carregando…":"Nenhum pedido com estes filtros nesta página."}</td></tr>}
        </tbody>
      </table></div>
      <div className="mt-3 flex items-center justify-between gap-2 print:hidden">
        <span className="text-xs text-muted-foreground">Página {page+1} · até 40 pedidos por página</span>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page===0||busy} onClick={()=>setPage(x=>x-1)}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={busy||!report||((page+1)*40)>=report.total_rows} onClick={()=>setPage(x=>x+1)}>Próxima</Button></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Busca e status filtram a página carregada. Use os filtros de período e serviço para os totais globais. PDF: impressão da página; e-mail e WhatsApp: compartilhamento manual do resumo, sem envio automático.</p>
    </section>
    <div className="print:hidden"><OperationsReportSchedules/></div>
  </main>;
}