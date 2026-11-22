export type GoogleUsageReport={
  from:string;to:string;timezone:string;source:string;scope_note:string;
  generated_at:string;
  summary:{total:number;places:number;routes:number;other:number;success:number;errors:number};
  daily:Array<{day:string;total:number;places:number;routes:number;errors:number}>;
  callers:Array<{api_service:string;caller_function:string;total:number;errors:number}>;
  hours:Array<{hour:number;total:number}>;
};
const integer=(n:number)=>n.toLocaleString("pt-BR");
const day=(date:string)=>date.split("-").reverse().join("/");
export function OperationsGoogleMapsUsage({report,error,loading}:{report:GoogleUsageReport|null;error:string;loading:boolean}){
  const totals=report?.summary;
  const peak=report?.hours?.reduce<{hour:number;total:number}|null>((best,h)=>!best||h.total>best.total?h:best,null);
  const max=Math.max(1,...(report?.daily??[]).map(x=>x.total));
  return <section className="space-y-4 rounded-2xl border bg-card p-4" aria-label="Consumo Google Maps">
    <div>
      <h2 className="font-[Sora] text-lg font-bold">Consumo Google Maps</h2>
      <p className="text-xs text-muted-foreground">Places e Routes · mesmo intervalo selecionado no relatório · horário de Fortaleza.</p>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{error}</p>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">Consultando registros de APIs…</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([{name:"Chamadas registradas",value:totals?.total},{name:"Places API",value:totals?.places},
        {name:"Routes API",value:totals?.routes},{name:"Erros registrados",value:totals?.errors}] as const)
        .map(item=><article key={item.name} className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{item.name}</p>
          <p className="mt-2 font-[Sora] text-2xl font-extrabold tabular-nums">{loading?"…":item.value===undefined?"—":integer(item.value)}</p>
        </article>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <article className="min-w-0 rounded-xl border p-3">
        <h3 className="mb-2 text-sm font-bold">Evolução por dia</h3>
        <div className="max-h-[260px] space-y-2 overflow-auto">
          {report?.daily?.map(d=><div key={d.day} className="grid grid-cols-[75px_minmax(0,1fr)_52px] items-center gap-2 text-xs">
            <span>{day(d.day)}</span>
            <div className="flex h-4 overflow-hidden rounded-sm bg-muted" title={"Places "+d.places+" · Routes "+d.routes}>
              <div className="bg-[#FFBB00]" style={{width:(100*d.places/max)+"%"}}/>
              <div className="bg-blue-500" style={{width:(100*d.routes/max)+"%"}}/>
            </div>
            <span className="text-right font-semibold tabular-nums">{integer(d.total)}</span>
          </div>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#FFBB00]"/>Places</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-blue-500"/>Routes</span>
          <span>Pico de chamadas: {peak&&peak.total>0?peak.hour+"h ("+integer(peak.total)+")":"Não identificado"}</span>
        </div>
      </article>
      <article className="min-w-0 rounded-xl border p-3">
        <h3 className="mb-2 text-sm font-bold">Principais origens das consultas</h3>
        <div className="max-h-[260px] overflow-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="p-2 text-left">Função</th><th className="p-2 text-right">Chamadas</th></tr></thead>
            <tbody className="divide-y">{report?.callers?.slice(0,10).map(item=>
              <tr key={item.api_service+":"+item.caller_function}>
                <td className="break-all p-2">{item.caller_function}<span className="ml-1 text-muted-foreground">({item.api_service})</span></td>
                <td className="p-2 text-right tabular-nums">{integer(item.total)}</td>
              </tr>)}</tbody>
          </table>
        </div>
      </article>
    </div>
    <p className="text-xs text-muted-foreground">
      Fonte: registros internos <code>google_api_usage</code>, agrupados por <code>created_at</code> no fuso America/Fortaleza.
      Não é o total oficial de requisições faturáveis do Google Cloud; chamadas Maps JavaScript feitas no navegador podem não estar incluídas.
    </p>
  </section>;
}