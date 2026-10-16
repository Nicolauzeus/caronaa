import {useState} from "react";
import {ResponsiveContainer,BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,Cell,PieChart,Pie,Legend} from "recharts";
type Datum={name:string;value:number};
export function ResearchChart({title,rows,description}:{title:string;rows:Datum[];description?:string}){
 const [kind,setKind]=useState<"horizontal"|"vertical"|"pie">("horizontal");
 const data=rows.filter(r=>r.value>0).sort((a,b)=>b.value-a.value);
 const colors=["#ffb000","#d99a00","#f6c75b","#a97c1d","#f9dc8a","#ba8b34"];
 return <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 md:p-5">
 <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">{title}</h3>{description&&<p className="text-xs text-muted-foreground">{description}</p>}</div>
 <div className="flex gap-1 rounded-lg border p-1" aria-label={"Tipo de gráfico: "+title}>
 {([["horizontal","Barras"],["vertical","Colunas"],["pie","Pizza"]] as const).map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>setKind(value)} className={kind===value?"rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground":"rounded-md px-2 py-1 text-xs"}>{label}</button>)}</div></div>
 {!data.length?<p className="rounded-lg bg-secondary/30 p-6 text-sm text-muted-foreground">Sem dados válidos neste recorte.</p>:
 <div className="h-[280px] w-full min-w-0" role="img" aria-label={title+": "+data.map(r=>r.name+" "+r.value).join(", ")}>
 <ResponsiveContainer width="100%" height="100%">
 {kind==="pie"?<PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label={({percent})=>((percent??0)*100).toFixed(0)+"%"}>{data.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:11}}/></PieChart>:
 <BarChart data={data} layout={kind==="horizontal"?"vertical":"horizontal"} margin={{top:8,right:14,bottom:kind==="vertical"?35:8,left:kind==="horizontal"?25:0}}>
 <CartesianGrid strokeDasharray="3 3" opacity={0.15}/>
 {kind==="horizontal"?<><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" width={112} tick={{fontSize:10}}/></>:<><XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={65} tick={{fontSize:10}}/><YAxis allowDecimals={false}/></>}
 <Tooltip/><Bar dataKey="value" name="Respostas" fill="#ffb000" radius={[5,5,0,0]}/></BarChart>}
 </ResponsiveContainer></div>}
 </section>;
}
