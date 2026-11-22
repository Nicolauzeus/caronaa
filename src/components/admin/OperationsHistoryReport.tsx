import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, ChevronDown, ChevronUp, Clock3, Download, Mail, MessageCircle, Printer, RefreshCw, Users, XCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import "./operations-history-print.css";
import { OperationsPrintableReport } from "./OperationsPrintableReport";
import { OperationsGoogleMapsUsage, type GoogleUsageReport } from "./OperationsGoogleMapsUsage";
import { OperationsAppEngagement, type AppEngagementReport } from "./OperationsAppEngagement";
import { OperationsPriceQuotes, type PriceQuotesReport } from "./OperationsPriceQuotes";
import { OperationsMobilityIntelligence, type MobilityIntelligence } from "./OperationsMobilityIntelligence";
import { createOperationsReportPdf, saveOperationsPdf } from "./operations-pdf-file";
import { calculateOperationsDisplay, projectRequestHistogram, ENABLE_OPERATIONS_PROJECTION, PRESENTATION_ILLUSTRATIVE_REQUESTS } from "./operations-presentation";

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
export function OperationsHistoryReport({mode="reports"}:{mode?:"reports"|"intelligence"}={}){
  const [preset,setPreset]=useState<Preset>("7d");
  const [from,setFrom]=useState("");const [to,setTo]=useState("");
  const [service,setService]=useState<"all"|"flash"|"shared">("all");
  const [status,setStatus]=useState("all");
  const [heatMetric,setHeatMetric]=useState<"orders"|"drivers"|"passengers_preparing">("orders");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(0);const [reload,setReload]=useState(0);
  const [historyExpanded,setHistoryExpanded]=useState(true);
  const [report,setReport]=useState<Report|null>(null);
  const [quotes,setQuotes]=useState<PriceQuotesReport|null>(null);
  const [intelligence,setIntelligence]=useState<MobilityIntelligence|null>(null);
  const [intelligenceError,setIntelligenceError]=useState("");
  const [quotesError,setQuotesError]=useState("");
  const [googleUsage,setGoogleUsage]=useState<GoogleUsageReport|null>(null);
  const [appEngagement,setAppEngagement]=useState<AppEngagementReport|null>(null);
  const [engagementError,setEngagementError]=useState("");
  const [googleError,setGoogleError]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [sharing,setSharing]=useState(false);
  const [emailDialog,setEmailDialog]=useState(false);
  const [emailTo,setEmailTo]=useState("");
  const [shareNotice,setShareNotice]=useState("");
  const dates=periodDates(preset,from,to);
  const valid=Boolean(dates.from&&dates.to&&dates.from<=dates.to);
  const load=useCallback(async()=>{
    if(!valid){setReport(null);setGoogleUsage(null);setAppEngagement(null);setQuotes(null);setIntelligence(null);return;}
    setBusy(true);setError("");
    const [historyResult,googleResult,engagementResult,quotesResult,intelligenceResult]=await Promise.all([
      (supabase as any).rpc("admin_operations_history_report",{
        p_from:dates.from,p_to:dates.to,p_service:service,p_limit:40,p_offset:page*40,
      }),
      (supabase as any).rpc("admin_google_api_usage_report",{
        p_from:dates.from,p_to:dates.to,
      }),
      (supabase as any).rpc("admin_caronaa_app_engagement",{p_from:dates.from,p_to:dates.to}),
      (supabase as any).rpc("admin_caronaa_price_quotes_report",{p_from:dates.from,p_to:dates.to,p_service:service}),
      (supabase as any).rpc("admin_operations_intelligence",{p_from:dates.from,p_to:dates.to,p_service:service}),
    ]);
    const {data,error:rpcError}=historyResult;
    const googleData=googleResult.data;
    if(intelligenceResult.error||!intelligenceResult.data?.journey||!Array.isArray(intelligenceResult.data.territories)){
      setIntelligence(null);setIntelligenceError("Inteligência territorial indisponível. Verifique a migration 0240.");
    }else{
      setIntelligence(intelligenceResult.data as MobilityIntelligence);setIntelligenceError("");
    }
    if(quotesResult.error||!quotesResult.data?.summary||!Array.isArray(quotesResult.data.daily)){
      setQuotes(null);
      setQuotesError("Cotações indisponíveis. Verifique a migration 0238.");
    }else{
      setQuotesError("");setQuotes(quotesResult.data as PriceQuotesReport);
    }
    if(engagementResult.error||!engagementResult.data?.summary||!Array.isArray(engagementResult.data?.daily)){
      setAppEngagement(null);
      setEngagementError("Acessos autenticados indisponíveis. Verifique a migration 0237.");
    }else{
      setEngagementError("");setAppEngagement(engagementResult.data as AppEngagementReport);
    }
    if(googleResult.error||!googleData?.summary||!Array.isArray(googleData?.daily)){
      setGoogleUsage(null);
      setGoogleError("Consumo Google Maps indisponível. Verifique a migration 0236.");
    }else{
      setGoogleError("");
      setGoogleUsage(googleData as GoogleUsageReport);
    }
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
  const display=report?calculateOperationsDisplay(report.summary,ENABLE_OPERATIONS_PROJECTION):null;
  const presentationMode=Boolean(display?.illustrativeOrders);
  const projectedHours=useMemo(()=>projectRequestHistogram(
    report?.hours??[],display?.illustrativeOrders??0
  ),[report?.hours,display?.illustrativeOrders]);
  const projectedHourDays=useMemo(()=>projectRequestHistogram(
    report?.hour_days??[],display?.illustrativeOrders??0
  ),[report?.hour_days,display?.illustrativeOrders]);
  const maxHour=Math.max(1,...projectedHours.map(x=>x.orders));
  const peak=projectedHours.length?projectedHours.reduce((a,b)=>b.orders>a.orders?b:a):null;
  const quiet=projectedHours.length?projectedHours.reduce((a,b)=>b.orders<a.orders?b:a):null;
  const selectedHeat=heatMetric==="orders"?projectedHourDays:report?.presence_hour_days;
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
  const makePdf=async()=>{
    if(!report||busy||presentationMode)throw new Error("Relatorio real indisponivel");
    return createOperationsReportPdf({
      from:dates.from,to:dates.to,service,generatedAt:report.generated_at,
      summary:report.summary,hours:report.hours,hour_days:report.hour_days,
      google_usage:googleUsage??undefined,
      app_engagement:appEngagement??undefined,
      price_quotes:quotes??undefined,
    });
  };
  const shareWhatsApp=async()=>{
    if(sharing||!report)return;
    setSharing(true);setShareNotice("");
    try{
      const pdf=await makePdf();
      if(typeof navigator.share==="function"&&
        (typeof navigator.canShare!=="function"||navigator.canShare({files:[pdf]}))){
        await navigator.share({
          files:[pdf],title:"CARONAA · Relatorio em PDF",
          text:"Relatorio operacional CARONAA em PDF",
        });
      }else{
        saveOperationsPdf(pdf);
        window.open("https://wa.me/?text="+encodeURIComponent(
          "Relatorio CARONAA em PDF. Anexe o arquivo "+pdf.name+" que foi baixado no dispositivo."),
          "_blank","noopener,noreferrer");
        setShareNotice("O PDF foi baixado. No WhatsApp, anexe o arquivo na conversa escolhida.");
      }
    }catch(e){
      if((e as Error)?.name!=="AbortError")
        setShareNotice("Nao foi possivel compartilhar o PDF. Tente novamente.");
    }finally{setSharing(false);}
  };
  const sendEmail=async()=>{
    if(sharing||!report||!emailTo.trim())return;
    setSharing(true);setShareNotice("");
    try{
      const {data}=await supabase.auth.getSession();
      const access=data.session?.access_token;
      if(!access)throw new Error("Sessao expirada; entre novamente");
      const pdf=await makePdf();
      if(pdf.size>3_300_000)throw new Error("PDF excedeu o limite do e-mail");
      const b64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=()=>reject(new Error("Falha ao ler PDF"));
        reader.onload=()=>resolve(String(reader.result).split(",")[1]??"");
        reader.readAsDataURL(pdf);
      });
      const response=await fetch("/api/operations/email-pdf",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+access},
        body:JSON.stringify({to:emailTo.trim(),filename:pdf.name,pdf_base64:b64}),
      });
      if(!response.ok){
        const code=(await response.json().catch(()=>({error:"unknown"}))).error;
        throw new Error(code==="email_not_configured"?
          "Configure RESEND_API_KEY e CARONAA_REPORT_FROM no servidor":
          "Falha no envio do PDF ("+code+")");
      }
      setEmailDialog(false);setEmailTo("");
      setShareNotice("PDF enviado ao provedor de e-mail para entrega ao destinatario.");
    }catch(e){
      setShareNotice(e instanceof Error?e.message:"Falha ao enviar o PDF");
    }finally{setSharing(false);}
  };
  return <main className="min-w-0 space-y-4 pb-8" aria-label={mode==="reports"?"Histórico e relatórios de operações":"Inteligência operacional"}>
    <div className="caronaa-screen-report space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-[Sora] text-2xl font-extrabold">{mode==="reports"?"Histórico & Relatórios":"Inteligência de Mobilidade"}</h1>
        <p className="text-sm text-muted-foreground">{mode==="reports"?"Histórico de pedidos, desempenho e PDFs.":"Cotações, horários, usuários ativos e uso de Google Maps."} · Horário de Fortaleza.</p>
        {presentationMode&&report&&!busy&&<p role="note" className="caronaa-report-projection-label mt-1 text-xs text-muted-foreground">
          <strong>Cenário projetado</strong> · {fmt(report.summary.orders)} pedidos reais + {PRESENTATION_ILLUSTRATIVE_REQUESTS} estimados = {fmt(display?.orders)} no cenário. Os adicionais não são operações registradas.
        </p>}
      </div>
      {mode==="reports"&&<div className="flex flex-wrap gap-2 print:hidden">
        <Button size="sm" variant="outline" disabled={!report||busy||(ENABLE_OPERATIONS_PROJECTION&&display?.illustrativeOrders!==PRESENTATION_ILLUSTRATIVE_REQUESTS)} onClick={()=>window.print()}><Printer size={15} className="mr-1"/> Imprimir / PDF</Button>
        <Button size="sm" variant="outline" disabled={!report||presentationMode||sharing} onClick={()=>{setShareNotice("");setEmailDialog(true);}}><Mail size={15} className="mr-1"/> E-mail PDF</Button>
        <Button size="sm" variant="outline" disabled={!report||presentationMode||sharing} onClick={()=>void shareWhatsApp()}><MessageCircle size={15} className="mr-1"/> WhatsApp PDF</Button>
        <Button size="sm" variant="outline" disabled={!report||presentationMode} onClick={()=>downloadCsv(rows)}><Download size={15} className="mr-1"/> CSV da página</Button>
      </div>}
    </header>
    {shareNotice&&<p role="status" className="rounded-xl border bg-muted px-3 py-2 text-sm">{shareNotice}</p>}
    {emailDialog&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 print:hidden"
      role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!sharing)setEmailDialog(false);}}>
      <form className="w-full max-w-md space-y-4 rounded-2xl bg-background p-6 shadow-xl"
        onSubmit={e=>{e.preventDefault();void sendEmail();}}>
        <h2 className="font-[Sora] text-lg font-bold">Enviar relatório em PDF</h2>
        <p className="text-sm text-muted-foreground">O PDF colorido do período selecionado será enviado como anexo. O destinatário receberá o arquivo pronto.</p>
        <label className="block space-y-2 text-sm font-medium">E-mail do destinatário
          <input type="email" autoFocus required maxLength={254} value={emailTo}
            onChange={e=>setEmailTo(e.target.value)} placeholder="destinatario@empresa.com"
            className="w-full rounded-lg border bg-background p-3 text-base"/>
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={sharing} onClick={()=>setEmailDialog(false)}>Cancelar</Button>
          <Button type="submit" disabled={sharing||!emailTo.trim()}>{sharing?"Enviando…":"Enviar PDF"}</Button>
        </div>
      </form>
    </div>}
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
    </section>

    {presentationMode&&display?.illustrativeOrders===0&&<p role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
      Projeção indisponível: os status reais ainda não reconciliam. Os valores exibidos permanecem reais.
    </p>}
    {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!valid&&<p role="status" className="text-sm text-muted-foreground">Selecione um intervalo válido.</p>}
    {mode==="intelligence"&&<>
      <OperationsMobilityIntelligence report={intelligence} error={intelligenceError} loading={busy}/>
      <OperationsPriceQuotes report={quotes} error={quotesError} loading={busy}/>
    </>}
    {mode==="reports"&&<>
    <OperationsPriceQuotes report={quotes} error={quotesError} loading={busy}/>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Resultados exclusivos das solicitações">
      <Stat title="Pedidos registrados" icon={<Users size={18}/>} value={busy?"…":fmt(display?.orders)}
        hint={presentationMode?"Base real: "+fmt(report?.summary.orders)+" · Cenário: +108":"Total real de solicitações no período"}/>
      <Stat title="Aguardando motorista" icon={<Clock3 size={18}/>} value={busy?"…":fmt(display?.searching)}
        hint={presentationMode?"Simulação proporcional · real: "+fmt(report?.summary.searching):"Solicitações abertas, ainda sem aceite"}/>
      <Stat title="Em atendimento" icon={<Activity size={18}/>} value={busy?"…":fmt(display?.in_progress)}
        hint={presentationMode?"Simulação proporcional · real: "+fmt(report?.summary.in_progress):"Aceitas, embarcando, em viagem ou revisão"}/>
      <Stat title="Corridas concluídas" icon={<CheckCircle2 size={18}/>} value={busy?"…":fmt(display?.completed)}
        hint={presentationMode?"Simulação proporcional · real: "+fmt(report?.summary.completed):"Concluídas com registro confirmado"}/>
      <Stat title="Canceladas" icon={<XCircle size={18}/>} value={busy?"…":fmt(display?.cancelled)}
        hint={fmt(display?.cancelled_without_acceptance)+" antes · "+fmt(display?.cancelled_after_acceptance)+" depois"+(presentationMode?" · simulação":"")}/>
      <Stat title="Expiradas" icon={<Clock3 size={18}/>} value={busy?"…":fmt(display?.expired)}
        hint={presentationMode?"Simulação proporcional · real: "+fmt(report?.summary.expired):"Prazo encerrado sem aceite, inclusive buscas vencidas ainda não regularizadas"}/>
    </section>
    </>}
    {mode==="intelligence"&&<>
    <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <article className="rounded-2xl border bg-card p-4">
        <h2 className="font-[Sora] text-lg font-bold">Horários com mais pedidos</h2>
        <p className="mb-4 text-xs text-muted-foreground">Distribuição de solicitações por horário local no período selecionado. {presentationMode?"Estimativa proporcional sobre a base registrada.":"Pedidos registrados."}</p>
        <div className="grid grid-cols-12 items-end gap-1 sm:grid-cols-24" role="img" aria-label="Histograma de pedidos por hora">
          {(projectedHours.length?projectedHours:Array.from({length:24},(_,hour)=>({hour,orders:0,passengers:0}))).map(h=>
            <div key={h.hour} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[9px] tabular-nums text-muted-foreground">{report?fmt(h.orders):"—"}</span>
              <div title={h.hour+"h: "+h.orders+" pedidos"} className={"w-full rounded-t-sm "+palette[h.orders===maxHour?0:h.orders>maxHour/2?1:h.orders>0?2:3]}
                style={{height:Math.max(5,Math.round(h.orders/maxHour*104))+"px"}}/>
              <span className="text-[9px] text-muted-foreground">{h.hour.toString().padStart(2,"0")}</span>
            </div>)}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Maior movimento: {report&&peak&&peak.orders>0?peak.hour+"h ("+peak.orders+" pedidos)":"Sem pedidos no período"} · Horário de menor demanda: {quiet?quiet.hour+"h ("+quiet.orders+" pedidos)":"Não identificado"}</p>
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
        <Stat title="Pedidos sem aceite expirados" value={fmt(presentationMode?display?.expired:report?.summary.expired_without_acceptance)} hint={presentationMode?"Simulação proporcional; reais: "+fmt(report?.summary.expired_without_acceptance):"Busca encerrada sem motorista"} icon={<Clock3 size={16}/>}/>
        <Stat title="Cancelados antes do aceite" value={fmt(display?.cancelled_without_acceptance)} hint={presentationMode?"Simulação proporcional; reais: "+fmt(report?.summary.cancelled_without_acceptance):"Perda anterior à atribuição"} icon={<XCircle size={16}/>}/>
        <Stat title="Tarifas de corridas concluídas" value={money(report?.summary.completed_fares_cents)} hint={(presentationMode?"Valor financeiro real (não simulado). ":"")+"Soma das tarifas conhecidas, não pagamentos recebidos. Sem tarifa: "+fmt(report?.summary.completed_unpriced)} icon={<CalendarDays size={16}/>}/>
      </div>
    </section>
    </>}
    {mode==="reports"&&<>
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-[Sora] text-lg font-bold">Histórico de pedidos e corridas</h2>
          <p className="text-xs text-muted-foreground">{fmt(report?.total_rows)} pedidos reais no período · histórico transacional sem registros projetados.</p></div>
        <Button type="button" size="sm" variant="outline"
          aria-expanded={historyExpanded} aria-controls="operations-order-history-content"
          onClick={()=>setHistoryExpanded(expanded=>!expanded)}
          className="shrink-0 gap-2 print:hidden">
          {historyExpanded?<><ChevronUp size={16}/> Recolher</>:<><ChevronDown size={16}/> Expandir</>}
        </Button>
      </div>
      <div id="operations-order-history-content" hidden={!historyExpanded} className="mt-3">
        <div className="mb-3 flex flex-wrap gap-2 print:hidden">
          <select aria-label="Status das solicitações" value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border bg-background p-2 text-sm">
            <option value="all">Todos os status</option><option value="unaccepted">Sem aceite</option><option value="accepted">Aceitos</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option>
          </select>
          <input aria-label="Buscar no histórico carregado" placeholder="Buscar nesta página…" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 rounded-lg border bg-background p-2 text-sm"/>
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
      <p className="mt-2 text-xs text-muted-foreground">Busca e status filtram apenas a página carregada; o CSV exporta essa página. Totais e gráficos usam exclusivamente registros reais do banco. O PDF compartilha indicadores agregados sem dados pessoais.</p>
      </div>
    </section>
    </>}
    {mode==="intelligence"&&<>
      <OperationsAppEngagement report={appEngagement} error={engagementError} loading={busy}/>
      <OperationsGoogleMapsUsage report={googleUsage} error={googleError} loading={busy}/>
    </>}
    </div>
    {mode==="reports"&&report&&!busy&&valid&&<OperationsPrintableReport
      summary={report.summary}
      hours={report.hours}
      hourDays={report.hour_days}
      from={dates.from}
      to={dates.to}
      service={service}
      generatedAt={report.generated_at}
      googleUsage={googleUsage}
      appEngagement={appEngagement}
      priceQuotes={quotes}
    />}
  </main>;
}