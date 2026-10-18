import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {InsightChart} from "@/components/admin/InsightChart";
type Dimension={category:string;label:string;total:number};
const dimensions=[["transport","Como se deslocam"],["cost","Custos declarados"],["schedule","Horários"],["frequency","Frequência semanal"],["origin","Origens"],["destination","Destinos"],["passengerInterest","Interesse dos passageiros"],["driverInterest","Interesse dos motoristas"]] as const;
export function ResearchMobilityDimensions({formId,nature,profile,occupation,painCode}:{formId:string|null;nature:string|null;profile:string|null;occupation:string|null;painCode:string|null}){
 const [rows,setRows]=useState<Dimension[]>([]),[total,setTotal]=useState<number|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[dimension,setDimension]=useState<string>("transport");
 useEffect(()=>{let active=true;setLoading(true);setError("");void (supabase as any).rpc("get_research_mobility_dimensions",{p_form_id:formId,p_nature:nature,p_profile:profile,p_occupation:occupation,p_pain_code:painCode}).then(({data,error}:any)=>{if(!active)return;if(error){setError(error.message);setRows([]);setTotal(null)}else{setRows(data?.dimensions??[]);setTotal(typeof data?.total==="number"?data.total:null)}setLoading(false)});return()=>{active=false}},[formId,nature,profile,occupation,painCode]);
 const selected=dimensions.find(([key])=>key===dimension)??dimensions[0];
 const chartRows=rows.filter(row=>row.category===dimension).map(row=>({name:row.label.replaceAll("_"," "),value:row.total})).slice(0,30);
 return <section className="space-y-3">
  <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-lg font-bold">Comportamento de mobilidade</h3><p className="text-xs text-muted-foreground">Base de respostas elegíveis: {loading?"Carregando":total===null?"N/D":total.toLocaleString("pt-BR")}</p></div>
   <label className="text-sm">Dimensão<select value={dimension} onChange={e=>setDimension(e.target.value)} className="ml-2 rounded-lg border bg-background p-2">{dimensions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  </div>
  {loading?<p role="status" className="text-sm text-muted-foreground">Carregando dimensões…</p>:error?<p role="alert" className="text-sm text-destructive">Dimensões indisponíveis. Verifique a função de BI.</p>:
   <InsightChart title={selected[1]} description="Frequência de respostas por categoria; percentuais não devem ser somados quando há múltipla escolha." rows={chartRows} metricLabel="Respostas"/>}
 </section>;
}
