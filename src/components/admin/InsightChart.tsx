import {useState} from "react";
import {Bar,BarChart,CartesianGrid,Cell,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {rankChartRows,semanticMetricTone,validChartRows,type ChartDatum,type ChartKind} from "@/lib/admin/chart-utils";
type Props={title:string;rows:ChartDatum[];description?:string;temporal?:boolean;metricLabel?:string;defaultKind?:ChartKind};
const OPTIONS:{value:ChartKind;label:string}[]=[
 {value:"horizontal",label:"Barras"},{value:"vertical",label:"Colunas"},
 {value:"line",label:"Linha"},{value:"ranking",label:"Ranking"}
];
const colors={danger:"#D94B4B",warning:"#E4A238",success:"#16A36A",neutral:"#D6A32A"};
const colorOf=(label:string)=>colors[semanticMetricTone(label)];
export function InsightChart({title,rows,description,temporal=false,metricLabel="Registros",defaultKind="horizontal"}:Props){
 const [kind,setKind]=useState<ChartKind>(defaultKind);
 const clean=validChartRows(rows),ranking=rankChartRows(rows);
 const chartRows=kind==="line"?clean:ranking;
 const chartDataDescription=chartRows.map(r=>r.name+": "+r.value.toLocaleString("pt-BR")).join("; ");
 const maximum=Math.max(1,...ranking.map(r=>r.value));
 return <section className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div className="space-y-1"><h3 className="text-base font-semibold">{title}</h3>{description&&<p className="text-xs text-muted-foreground">{description}</p>}</div>
   <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 p-1" role="group" aria-label={"Visualização: "+title}>
    {OPTIONS.map(option=><button type="button" key={option.value} aria-pressed={kind===option.value} onClick={()=>setKind(option.value)}
     className={kind===option.value?"rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground":"rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"}>{option.label}</button>)}
   </div>
  </header>
  {!clean.length?<p className="rounded-lg bg-secondary/30 p-5 text-sm text-muted-foreground">Nenhum dado disponível neste recorte.</p>:
  kind==="ranking"?<div className="space-y-2" aria-label={"Ranking de "+title}>{ranking.map((item,index)=><div key={item.name+index} className="flex items-center gap-3 text-sm">
   <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{index+1}º</span>
   <span className="min-w-0 w-28 shrink-0 truncate" title={item.name}>{item.name}</span>
   <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary/60"><div className="h-full rounded-full" style={{width:(item.value/maximum*100)+"%",backgroundColor:colorOf(item.name)}}/></div>
   <strong className="w-12 text-right text-xs tabular-nums">{item.value.toLocaleString("pt-BR")}</strong>
  </div>)}</div>:
  <div className="h-[285px] min-w-0 w-full" role="img" aria-label={title+". "+chartDataDescription}>
   <ResponsiveContainer width="100%" height="100%">
    {kind==="line"?<LineChart data={chartRows} margin={{top:12,right:20,left:0,bottom:25}}>
     <CartesianGrid strokeDasharray="3 3" opacity={0.12}/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="value" name={metricLabel} stroke={colors.neutral} strokeWidth={3} dot={{r:3}} activeDot={{r:5}}/>
    </LineChart>:
    <BarChart data={chartRows} layout={kind==="horizontal"?"vertical":"horizontal"} margin={{top:10,right:20,left:kind==="horizontal"?20:0,bottom:kind==="vertical"?35:0}}>
     <CartesianGrid strokeDasharray="3 3" opacity={0.12}/>
     {kind==="horizontal"?<><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={115} tick={{fontSize:10}}/></>:
      <><XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={65} tick={{fontSize:10}}/><YAxis allowDecimals={false}/></>}
     <Tooltip/><Bar dataKey="value" name={metricLabel} radius={[4,4,0,0]}>{chartRows.map((row,i)=><Cell key={row.name+i} fill={colorOf(row.name)}/>)}</Bar>
    </BarChart>}
   </ResponsiveContainer>
  </div>}
  {kind==="line"&&!temporal&&<p className="text-xs text-muted-foreground">A linha conecta categorias para comparação; não representa uma evolução no tempo.</p>}
 </section>;
}
