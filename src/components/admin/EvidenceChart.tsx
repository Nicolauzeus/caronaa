import {useState} from "react";
import {Bar,BarChart,CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {type ChartKind} from "@/lib/admin/chart-utils";
type Series={key:string;label:string};
type Entry=Record<string,string|number|null>;
const palette=["#D6A32A","#478CE6","#16A36A","#E4A238"];
export function EvidenceChart({title,rows,series}:{title:string;rows:Entry[];series:Series[]}){
 const [kind,setKind]=useState<ChartKind>("vertical");
 const values=rows.map(row=>({...row,name:String(row.name??"Não informado")})).filter(row=>row.name.trim().length);
 const sort=[...values].sort((a,b)=>Number(b[series[0]?.key]??0)-Number(a[series[0]?.key]??0));
 const data=kind==="line"?values:sort;
 const opts:[ChartKind,string][]=[["horizontal","Barras"],["vertical","Colunas"],["line","Linha"],["ranking","Ranking"]];
 const col=(i:number,label:string)=>/déficit|falha|erro|crític|cancel/i.test(label)?"#D94B4B":palette[i%palette.length];
 return <section className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-card/50 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-base font-semibold">{title}</h2>
   <div role="group" aria-label={"Visualização: "+title} className="flex flex-wrap gap-1 rounded-lg border p-1">{opts.map(([value,label])=><button type="button" key={value} aria-pressed={kind===value} onClick={()=>setKind(value)} className={kind===value?"rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground":"rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"}>{label}</button>)}</div>
  </div>
  {!data.length?<p className="py-10 text-sm text-muted-foreground">Sem dados disponíveis neste recorte.</p>:kind==="ranking"?
   <div className="space-y-2">{sort.map((row,i)=><div key={i} className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-2 text-sm">
    <span className="w-6 text-xs font-medium text-muted-foreground">{i+1}º</span><span className="min-w-24 flex-1 font-medium">{row.name}</span>
    {series.map((entry,j)=><span key={entry.key} className="text-xs" style={{color:col(j,entry.label)}}>{entry.label}: <strong className="tabular-nums">{Number(row[entry.key]??0).toLocaleString("pt-BR")}</strong></span>)}
   </div>)}</div>:
   <div className="h-72 w-full min-w-0" role="img" aria-label={title+": "+data.map(row=>row.name+" "+series.map(x=>x.label+" "+(row[x.key]??"N/D")).join(", ")).join("; ")}>
    <ResponsiveContainer width="100%" height="100%">
     {kind==="line"?<LineChart data={data} margin={{top:10,right:15,left:0,bottom:25}}><CartesianGrid strokeDasharray="3 3" opacity={0.15}/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip/>{series.map((s,i)=><Line type="monotone" key={s.key} dataKey={s.key} name={s.label} stroke={col(i,s.label)} strokeWidth={2.5} dot={{r:3}}/>)}</LineChart>:
      <BarChart data={data} layout={kind==="horizontal"?"vertical":"horizontal"} margin={{top:8,right:12,bottom:kind==="vertical"?40:5,left:kind==="horizontal"?20:0}}><CartesianGrid strokeDasharray="3 3" opacity={0.15}/>{kind==="horizontal"?<><XAxis type="number" allowDecimals={false}/><YAxis dataKey="name" type="category" width={112} tick={{fontSize:10}}/></>:<><XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={62} tick={{fontSize:10}}/><YAxis allowDecimals={false}/></>}<Tooltip/>{series.map((s,i)=><Bar key={s.key} dataKey={s.key} name={s.label} fill={col(i,s.label)} radius={[3,3,0,0]}/>)}</BarChart>}
    </ResponsiveContainer>
   </div>}
  {kind==="line"&&<p className="text-xs text-muted-foreground">A linha conecta as categorias na sequência apresentada. Não representa evolução temporal sem datas.</p>}
 </section>;
}
