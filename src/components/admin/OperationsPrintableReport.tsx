import type { ReactNode } from "react";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

type Summary = {
  orders:number;accepted:number;unaccepted:number;completed:number;
  cancelled:number;expired:number;searching:number;in_progress:number;
  cancelled_without_acceptance:number;cancelled_after_acceptance:number;
  unique_passengers:number;flash_orders:number;shared_orders:number;
  completed_fares_cents:number;completed_unpriced?:number;
};
type Hour = {hour:number;orders:number};
type Cell = {weekday:number;hour:number;orders:number};
type Props = {
  summary:Summary;hours:Hour[];hourDays:Cell[];
  from:string;to:string;service:"all"|"flash"|"shared";generatedAt:string;
};
const nf=(v:number)=>v.toLocaleString("pt-BR");
const currency=(c:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(c/100);
const days=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const serviceLabel={all:"Todos os serviços",flash:"Corrida Rápida",shared:"Caronas compartilhadas"};
function Metric({label,value,kind="normal"}:{label:string;value:string;kind?:string}){
  return <div className={"opr-pdf-metric opr-pdf-"+kind}>
    <p>{label}</p><strong>{value}</strong>
  </div>;
}
function Heading({children}:{children:ReactNode}){
  return <h2 className="opr-pdf-heading">{children}</h2>;
}
export function OperationsPrintableReport({summary,hours,hourDays,from,to,service,generatedAt}:Props){
  const count=summary.orders;
  const percent=(n:number)=>count?(100*n/count).toFixed(1).replace(".",",")+"%":"0%";
  const hourValues=Array.from({length:24},(_,hour)=>hours.find(x=>x.hour===hour)?.orders??0);
  const hourMax=Math.max(1,...hourValues);
  const peak=hours.reduce<Hour|null>((best,h)=>!best||h.orders>best.orders?h:best,null);
  const map=new Map(hourDays.map(x=>[x.weekday+":"+x.hour,x.orders] as const));
  const heatMax=Math.max(1,...hourDays.map(x=>x.orders));
  const time=new Date(generatedAt);
  const generated=Number.isFinite(time.getTime())?
    time.toLocaleString("pt-BR",{timeZone:"America/Fortaleza",dateStyle:"short",timeStyle:"short"}):"—";
  return <article className="caronaa-print-sheet" aria-label="Relatório operacional CARONAA para impressão">
    <header className="opr-pdf-header">
      <div className="opr-pdf-brand">
        <img src={logoAsset.url} alt="CARONAA — logotipo oficial" className="opr-pdf-logo" width={170} height={86}/>
      </div>
      <div className="opr-pdf-heading-meta">
        <strong>Relatório de mobilidade</strong>
        <span>{serviceLabel[service]} · {from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")}</span>
        <small>Fuso: America/Fortaleza · Gerado em {generated}</small>
      </div>
    </header>

    <section className="opr-pdf-section">
      <Heading>Panorama dos pedidos</Heading>
      <div className="opr-pdf-metrics">
        <Metric label="Pedidos feitos" value={nf(count)} kind="yellow"/>
        <Metric label="Aceitos" value={nf(summary.accepted)} kind="green"/>
        <Metric label="Sem aceite" value={nf(summary.unaccepted)} kind="amber"/>
        <Metric label="Concluídos" value={nf(summary.completed)} kind="blue"/>
        <Metric label="Cancelados" value={nf(summary.cancelled)} kind="red"/>
        <Metric label="Expirados" value={nf(summary.expired)} kind="gray"/>
      </div>
    </section>

    <section className="opr-pdf-two">
      <div className="opr-pdf-card">
        <Heading>Conversão e atendimento</Heading>
        <div className="opr-pdf-funnel">
          <div className="opr-pdf-funnel-accepted" style={{width:percent(summary.accepted).replace(",",".")}}/>
          <div className="opr-pdf-funnel-unaccepted" style={{width:percent(summary.unaccepted).replace(",",".")}}/>
        </div>
        <div className="opr-pdf-funnel-labels">
          <span><b>{percent(summary.accepted)}</b> com aceite</span>
          <span><b>{percent(summary.unaccepted)}</b> sem aceite</span>
        </div>
        <p className="opr-pdf-detail">Cancelamentos: {nf(summary.cancelled_without_acceptance)} antes do aceite e {nf(summary.cancelled_after_acceptance)} após o aceite.</p>
      </div>
      <div className="opr-pdf-card">
        <Heading>Indicadores complementares</Heading>
        <div className="opr-pdf-small-grid">
          <div><strong>{nf(summary.unique_passengers)}</strong><span>Passageiros solicitantes</span></div>
          <div><strong>{nf(summary.searching)}</strong><span>Aguardando motorista</span></div>
          <div><strong>{nf(summary.in_progress)}</strong><span>Em atendimento</span></div>
          <div><strong>{currency(summary.completed_fares_cents)}</strong><span>Tarifas de corridas concluídas*</span></div>
        </div>
      </div>
    </section>

    <section className="opr-pdf-card opr-pdf-hour-section">
      <div className="opr-pdf-title-row">
        <Heading>Demanda por horário</Heading>
        <span>Maior volume: {peak&&peak.orders>0?peak.hour.toString().padStart(2,"0")+"h · "+nf(peak.orders)+" pedidos":"Sem pedidos"}</span>
      </div>
      <div className="opr-pdf-chart">
        {hourValues.map((value,h)=><div key={h} className="opr-pdf-hour">
          <small>{value}</small>
          <div className="opr-pdf-hour-fill" style={{
            height:Math.max(2,Math.round(100*value/hourMax))+"%",
            background:value===hourMax&&value>0?"#FFBB00":value>hourMax/2?"#F8D26D":"#FBE7B3"
          }}/>
          <span>{String(h).padStart(2,"0")}</span>
        </div>)}
      </div>
    </section>

    <section className="opr-pdf-card opr-pdf-heat-section">
      <div className="opr-pdf-title-row">
        <Heading>Distribuição da demanda · dia × hora</Heading>
        <small>Intensidade dos pedidos registrados</small>
      </div>
      <div className="opr-pdf-heat-table">
        <div className="opr-pdf-heat-label">Dia</div>
        {Array.from({length:24},(_,h)=><div key={"hour"+h} className="opr-pdf-heat-hour">{String(h).padStart(2,"0")}</div>)}
        {days.map((day,d)=><div key={day} className="opr-pdf-heat-row">
          <span>{day}</span>
          {Array.from({length:24},(_,hour)=>{
            const n=map.get(d+":"+hour)??0;
            const intensity=n/heatMax;
            return <div key={hour} title={day+" "+hour+"h: "+n+" pedidos"}
              style={{backgroundColor:n===0?"#F2F3F5":intensity>.75?"#FFBB00":intensity>.45?"#FFD66B":intensity>.15?"#FFE9A8":"#FFF4D4"}}/>;
          })}
        </div>)}
      </div>
    </section>

    <footer className="opr-pdf-footer">
      <span>* Tarifas não equivalem a pagamentos recebidos. Relatório consolidado, sem dados pessoais ou GPS.</span>
      <span>CARONAA · Operações de Mobilidade</span>
    </footer>
  </article>;
}
