import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
type D={category:string;label:string;total:number};
const cards=[["transport","Como se deslocam"],["cost","Custos declarados"],["schedule","Horários"],["frequency","Frequência semanal"],["origin","Origens"],["destination","Destinos"],["passengerInterest","Interesse dos passageiros"],["driverInterest","Interesse dos motoristas"]];
export function ResearchMobilityDimensions({formId,nature,profile,occupation,painCode}:{formId:string|null;nature:string|null;profile:string|null;occupation:string|null;painCode:string|null}){
 const [rows,setRows]=useState<D[]>([]),[total,setTotal]=useState(0),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);void (supabase as any).rpc("get_research_mobility_dimensions",{p_form_id:formId,p_nature:nature,p_profile:profile,p_occupation:occupation,p_pain_code:painCode}).then(({data,error}:any)=>{if(!alive)return;if(error){setError(error.message);setRows([])}else {setError("");setRows(data?.dimensions??[]);setTotal(data?.total??0)}setLoading(false)});return()=>{alive=false}},[formId,nature,profile,occupation,painCode]);
 return <section className="space-y-3"><h3 className="text-lg font-bold">Comportamento de mobilidade</h3>
 {loading?<p role="status" className="text-sm">Carregando distribuição...</p>:error?<p role="alert" className="text-sm text-muted-foreground">Dimensões indisponíveis. Confirme a migração 0073.</p>:
 <div className="grid gap-4 lg:grid-cols-2">{cards.map(([code,title])=><article key={code} className="space-y-3 rounded-xl border p-4"><h4 className="font-bold">{title}</h4>
 {rows.filter(x=>x.category===code).sort((a,b)=>b.total-a.total).slice(0,12).map(x=><div key={x.label} className="space-y-1"><div className="flex justify-between gap-2 text-xs"><span className="break-words">{x.label.replaceAll("_"," ")}</span><strong>{x.total} ({total?(100*x.total/total).toFixed(1):"0"}%)</strong></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:(total?Math.min(100,x.total/total*100):0)+"%"}}/></div></div>)}
 {!rows.some(x=>x.category===code)&&<p className="text-xs text-muted-foreground">Sem informação nesse recorte.</p>}
 </article>)}</div>}
 </section>
}
