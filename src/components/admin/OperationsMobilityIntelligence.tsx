import { useState } from "react";
export type MobilityIntelligence={
  from:string;to:string;service:"all"|"flash"|"shared";timezone:string;
  journey:{
    authenticated_users_all_services:number;quote_users:number;quotes_generated:number;
    request_users:number;requests_created:number;accepted_users:number;
    completed_users:number;unaccepted_requests:number;quoted_and_requested_users:number;
  };
  territories:Array<{
    municipality:string;requests:number;accepted:number;unaccepted:number;
    cancelled:number;completed:number;passengers:number;
  }>;
  notes:{visits:string;conversion:string;territory:string};
  generated_at:string;
};
const num=(n:number)=>n.toLocaleString("pt-BR");
export function OperationsMobilityIntelligence({report,error,loading}:{
  report:MobilityIntelligence|null;error:string;loading:boolean;
}){
  const [municipality,setMunicipality]=useState("all");
  const j=report?.journey;
  const visibleMunicipalities=(report?.territories??[]).filter(x=>municipality==="all"||x.municipality===municipality);
  const selectedAvailable=(report?.territories??[]).some(x=>x.municipality===municipality);
  const selectedRows=!selectedAvailable&&municipality!=="all"?report?.territories??[]:visibleMunicipalities;
  const max=Math.max(1,...(report?.territories??[]).map(x=>x.requests));
  const quoteToRequest=j&&j.quote_users>0?100*j.quoted_and_requested_users/j.quote_users:null;
  return <section className="space-y-4 rounded-2xl border bg-card p-4" aria-label="Jornada de utilização e municípios">
    <header>
      <h2 className="font-[Sora] text-lg font-bold">Jornada de utilização</h2>
      <p className="text-xs text-muted-foreground">
        Pessoas distintas em cada etapa dentro do período selecionado. Uma pessoa pode realizar várias cotações e pedidos.
      </p>
    </header>
    {loading&&<p role="status" className="text-xs text-muted-foreground">Consultando conversões e municípios…</p>}
    {error&&<p role="alert" className="rounded-lg border border-red-300 p-2 text-sm text-red-700">{error}</p>}
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {([
        {name:"Pessoas que cotaram",value:j?.quote_users,detail:"Contas distintas com preço emitido"},
        {name:"Pessoas que solicitaram",value:j?.request_users,detail:"Contas distintas com pedido registrado"},
        {name:"Pessoas com pedido aceito",value:j?.accepted_users,detail:"Pelo menos um aceite no período"},
        {name:"Pessoas com corrida concluída",value:j?.completed_users,detail:"Pelo menos uma viagem concluída"},
      ]).map(card=><article key={card.name} className="rounded-xl border bg-background p-3">
        <p className="text-xs text-muted-foreground">{card.name}</p>
        <p className="mt-1 font-[Sora] text-2xl font-extrabold tabular-nums">
          {loading?"…":card.value==null?"—":num(card.value)}
        </p>
        <p className="text-[11px] text-muted-foreground">{card.detail}</p>
      </article>)}
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted/40 p-3 text-xs">
      <span><strong>{j?num(j.quotes_generated):"—"}</strong> cotações emitidas</span>
      <span><strong>{j?num(j.requests_created):"—"}</strong> pedidos feitos</span>
      <span><strong>{j?num(j.unaccepted_requests):"—"}</strong> pedidos sem aceite</span>
      <span><strong>{quoteToRequest!==null?quoteToRequest.toFixed(1).replace(".",",")+"%":"—"}</strong> dos usuários que cotaram também solicitaram no período</span>
    </div>
    <p className="text-xs text-muted-foreground">
      Este é um comparativo de contas por evento, não um funil causal de sessões.
      Os acessos autenticados antigos só são contabilizados após o início da coleta.
    </p>
    <div className="space-y-2 border-t pt-3">
      <div>
        <h3 className="font-[Sora] text-base font-bold">Demanda por município</h3>
        <p className="text-xs text-muted-foreground">
          Base: município registrado no pedido profissional Flash. Não atribuímos município artificialmente a caronas compartilhadas.
        </p>
      </div>
      <label className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold">Município
        <select aria-label="Filtrar município" value={selectedAvailable?municipality:"all"}
          onChange={event=>setMunicipality(event.target.value)} className="min-h-10 rounded-lg border bg-background px-2 text-sm">
          <option value="all">Todos os municípios</option>
          {(report?.territories??[]).map(x=><option value={x.municipality} key={x.municipality}>{x.municipality}</option>)}
        </select>
      </label>
      {report?.service==="shared"&&
        <p role="status" className="text-sm text-muted-foreground">A classificação territorial de solicitações compartilhadas ainda não possui uma origem municipal validada.</p>}
      {report?.territories.length===0&&<p className="text-sm text-muted-foreground">Nenhuma solicitação profissional no período ou serviço selecionado.</p>}
      <div className="max-h-[340px] space-y-2 overflow-y-auto">
        {selectedRows.map(x=><article key={x.municipality} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">{x.municipality}</span>
            <span className="text-sm font-extrabold tabular-nums">{num(x.requests)} pedidos</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-[#FFBB00]" style={{width:(100*x.requests/max)+"%"}}/>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{x.accepted} aceitos</span><span>{x.unaccepted} sem aceite</span>
            <span>{x.completed} concluídos</span><span>{x.cancelled} cancelados</span>
            <span>{x.passengers} passageiros únicos</span>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}