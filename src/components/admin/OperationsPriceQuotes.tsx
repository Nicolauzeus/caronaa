export type PriceQuotesReport={
  from:string;to:string;service:"all"|"flash"|"shared";timezone:string;generated_at:string;
  summary:{quotes_generated:number;unique_quoters:number;flash_quotes:number;shared_quotes:number};
  daily:Array<{day:string;quotes_generated:number;unique_quoters:number;flash_quotes:number;shared_quotes:number}>;
};
export function OperationsPriceQuotes({
  report,error,loading
}:{report:PriceQuotesReport|null;error:string;loading:boolean}){
  const s=report?.summary;
  const max=Math.max(1,...(report?.daily??[]).map(d=>d.quotes_generated));
  return <section className="rounded-2xl border bg-card p-4" aria-label="Cotações de preço">
    <div className="mb-3">
      <h2 className="font-[Sora] text-lg font-bold">Cotações de preço</h2>
      <p className="text-xs text-muted-foreground">
        Preços calculados e emitidos pelo CARONAA, com os mesmos filtros de período e serviço.
        Uma pessoa pode receber várias cotações antes de pedir a corrida.
      </p>
    </div>
    {error&&<p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr]">
      <article className="rounded-xl border border-[#FFBB00]/60 bg-[#FFBB00]/10 p-4">
        <p className="text-sm text-muted-foreground">Cotações de preço geradas</p>
        <p className="mt-1 font-[Sora] text-3xl font-extrabold tabular-nums">
          {loading?"…":s?s.quotes_generated.toLocaleString("pt-BR"):"—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Contagem de cotações emitidas, não de buscas de destino</p>
      </article>
      <article className="rounded-xl border bg-background p-4">
        <p className="text-sm text-muted-foreground">Pessoas que receberam cotação</p>
        <p className="mt-1 font-[Sora] text-3xl font-extrabold tabular-nums">
          {loading?"…":s?s.unique_quoters.toLocaleString("pt-BR"):"—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Contas distintas no intervalo selecionado</p>
      </article>
      <article className="min-w-0 rounded-xl border bg-background p-4">
        <p className="mb-2 text-sm font-semibold">Cotações por dia</p>
        <div className="max-h-[124px] space-y-1.5 overflow-auto">
          {report?.daily.map(day=><div key={day.day} className="grid grid-cols-[66px_minmax(0,1fr)_45px] items-center gap-2 text-xs">
            <span>{day.day.slice(8,10)+"/"+day.day.slice(5,7)}</span>
            <div className="h-3 overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-[#FFBB00]" style={{width:(100*day.quotes_generated/max)+"%"}}/>
            </div>
            <strong className="text-right tabular-nums">{day.quotes_generated.toLocaleString("pt-BR")}</strong>
          </div>)}
        </div>
        {s&&<p className="mt-2 text-xs text-muted-foreground">
          {s.flash_quotes.toLocaleString("pt-BR")} rápidas · {s.shared_quotes.toLocaleString("pt-BR")} compartilhadas
        </p>}
      </article>
    </div>
  </section>;
}