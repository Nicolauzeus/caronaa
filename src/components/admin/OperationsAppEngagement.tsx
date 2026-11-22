export type AppEngagementReport={
  from:string;to:string;timezone:string;collection_started_at:string|null;
  note:string;
  summary:{unique_users:number;passengers:number;drivers:number;recorded_access_signals:number};
  daily:Array<{day:string;unique_users:number;passengers:number;drivers:number}>;
  users:Array<{user_id:string;display_name:string|null;as_passenger:boolean;as_driver:boolean;active_days:number;access_signals:number;last_seen_at:string}>;
};
const n=(x:number)=>x.toLocaleString("pt-BR");
const d=(s:string)=>s.split("-").reverse().join("/");
const clock=(s:string)=>new Date(s).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"});
export function OperationsAppEngagement({report,error,loading}:{report:AppEngagementReport|null;error:string;loading:boolean}){
  const s=report?.summary;
  const overlap=s?Math.max(0,s.passengers+s.drivers-s.unique_users):0;
  const peak=report?.daily?.reduce<{day:string;unique_users:number}|null>((a,b)=>!a||b.unique_users>a.unique_users?b:a,null);
  const max=Math.max(1,...(report?.daily??[]).map(x=>x.unique_users));
  return <section className="space-y-4 rounded-2xl border bg-card p-4" aria-label="Acessos autenticados">
    <div>
      <h2 className="font-[Sora] text-lg font-bold">Pessoas que acessaram o CARONAA</h2>
      <p className="text-xs text-muted-foreground">Usuários distintos autenticados · passageiros e motoristas · mesmo período dos relatórios.</p>
    </div>
    {error&&<p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{error}</p>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">Consultando acessos autenticados…</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([{label:"Pessoas únicas",value:s?.unique_users},{label:"Passageiros",value:s?.passengers},
        {label:"Motoristas",value:s?.drivers},{label:"Usaram ambos os perfis",value:s?overlap:undefined}] as const).map(x=>
        <article key={x.label} className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{x.label}</p>
          <p className="mt-2 font-[Sora] text-2xl font-extrabold tabular-nums">{loading?"…":x.value===undefined?"—":n(x.value)}</p>
        </article>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="min-w-0 rounded-xl border p-3">
        <h3 className="mb-2 text-sm font-bold">Pessoas ativas por dia</h3>
        <div className="max-h-64 space-y-2 overflow-auto">
          {report?.daily?.map(x=><div key={x.day} className="grid grid-cols-[76px_minmax(0,1fr)_48px] items-center gap-2 text-xs">
            <span>{d(x.day)}</span>
            <div className="h-3 rounded-sm bg-muted"><div className="h-full rounded-sm bg-[#FFBB00]" style={{width:(100*x.unique_users/max)+"%"}}/></div>
            <strong className="text-right tabular-nums">{n(x.unique_users)}</strong>
          </div>)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {peak&&peak.unique_users>0?"Dia de maior acesso: "+d(peak.day)+" ("+n(peak.unique_users)+" pessoas)":"Nenhum acesso registrado no período"}
        </p>
      </div>
      <div className="min-w-0 rounded-xl border p-3">
        <h3 className="mb-2 text-sm font-bold">Usuários autenticados identificados</h3>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="p-2 text-left">Usuário</th><th className="p-2 text-left">Perfil utilizado</th><th className="p-2 text-right">Dias</th><th className="p-2 text-right">Último acesso</th></tr></thead>
            <tbody className="divide-y">
              {report?.users?.map(x=><tr key={x.user_id}>
                <td className="p-2">{x.display_name?.trim()||"Conta "+x.user_id.slice(0,8)}</td>
                <td className="p-2">{x.as_driver&&x.as_passenger?"Ambos":x.as_driver?"Motorista":"Passageiro"}</td>
                <td className="p-2 text-right">{n(x.active_days)}</td>
                <td className="whitespace-nowrap p-2 text-right">{clock(x.last_seen_at)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Exibe até 500 contas mais recentes no intervalo. Relatório restrito ao administrador.</p>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      A coleta começou em {report?.collection_started_at?clock(report.collection_started_at):"data ainda não disponível"}.
      Não são reconstruídos acessos anteriores. Uma mesma pessoa pode aparecer nas duas categorias,
      mas é contada apenas uma vez em Pessoas únicas. A contagem de sinais não é o número exato de sessões.
    </p>
  </section>;
}