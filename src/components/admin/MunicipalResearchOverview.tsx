import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
type Municipality={code:string;title:string;municipality:string;audience:string;status:string;responses:number};
export function MunicipalResearchOverview(){
 const [items,setItems]=useState<Municipality[]>([]),[error,setError]=useState("");
 useEffect(()=>{let alive=true;void (supabase as any).rpc("get_municipal_research_overview").then(({data,error}:any)=>{if(!alive)return;if(error)setError(error.message);else setItems(data??[])});return()=>{alive=false}},[]);
 return <section className="space-y-3 rounded-2xl border bg-card p-4">
 <div><h3 className="text-lg font-bold">Mobilidade Local — municípios</h3><p className="text-sm text-muted-foreground">Pesquisas de profissionais, moradores e gestão pública por território.</p></div>
 {error?<p className="text-sm text-muted-foreground">Visão municipal indisponível até aplicar a migração 0074.</p>:
 items.length?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(r=><article key={r.code} className="rounded-xl border p-3"><p className="text-xs font-semibold text-primary">{r.municipality}</p><h4 className="font-bold">{r.title}</h4><p className="text-xs text-muted-foreground">{r.audience} · {r.status}</p><p className="mt-2 text-sm">{r.responses} respostas</p></article>)}</div>:
 <p className="text-sm text-muted-foreground">Nenhuma pesquisa municipal cadastrada ainda. Use a natureza Mobilidade Local ao criar a primeira.</p>}
 </section>;
}
