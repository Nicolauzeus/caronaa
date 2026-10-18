import {useEffect,useMemo,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
type Kind="OKR"|"DECISION"|"RISK";
type RecordRow={id:string;kind:Kind;title:string;description:string;status:string;priority:string;target_value:number|null;actual_value:number|null;unit:string|null;due_date:string|null;created_at:string};
const db=supabase as any;
const LABELS:Record<Kind,string>={OKR:"OKRs e metas",DECISION:"Decisões",RISK:"Riscos e oportunidades"};
const TYPES:Kind[]=["OKR","DECISION","RISK"];
const STATUSES=["ABERTO","EM_ANDAMENTO","CONCLUIDO","SUSPENSO"];
function progress(record:RecordRow){return record.target_value&&record.target_value>0&&record.actual_value!==null?Math.max(0,Math.min(100,(record.actual_value/record.target_value)*100)):null}
export function ExecutiveGovernance(){
 const [kind,setKind]=useState<Kind>("OKR"),[rows,setRows]=useState<RecordRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[priority,setPriority]=useState("MEDIA"),[dueDate,setDueDate]=useState(""),[target,setTarget]=useState(""),[unit,setUnit]=useState(""),[busy,setBusy]=useState(false);
 async function reload(){setLoading(true);const {data,error}=await db.from("executive_records").select("id,kind,title,description,status,priority,target_value,actual_value,unit,due_date,created_at").order("created_at",{ascending:false}).limit(200);if(error){setError("Gestão executiva indisponível. Confirme a migração 0080 e as permissões: "+error.message);setRows([])}else{setRows(data??[]);setError("")}setLoading(false)}
 useEffect(()=>{void reload()},[]);
 async function create(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError("");const {error}=await db.from("executive_records").insert({kind,title:title.trim(),description:description.trim(),priority,due_date:dueDate||null,target_value:kind==="OKR"&&target?Number(target):null,unit:kind==="OKR"?unit.trim()||null:null});if(error)setError(error.message);else{setTitle("");setDescription("");setTarget("");setDueDate("");setUnit("");setNotice("Registro criado com sucesso.");await reload()}setBusy(false)}
 async function update(id:string,patch:Record<string,unknown>){setBusy(true);setError("");const {data,error}=await db.from("executive_records").update(patch).eq("id",id).select("id").maybeSingle();if(error||!data)setError(error?.message??"A atualização não foi confirmada pelo banco.");else {setNotice("Atualização registrada no histórico.");await reload()}setBusy(false)}
 const filtered=useMemo(()=>rows.filter(r=>r.kind===kind),[rows,kind]);
 return <section className="space-y-5">
 <div className="flex flex-wrap gap-2" role="tablist" aria-label="Gestão executiva">{TYPES.map(x=><button role="tab" aria-selected={kind===x} key={x} className={kind===x?"rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground":"rounded-xl border px-4 py-2 text-sm"} onClick={()=>{setKind(x);setNotice("")}}>{LABELS[x]}</button>)}</div>
 {error&&<p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
 {notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
 <form onSubmit={create} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2">
 <h3 className="font-bold md:col-span-2">Novo registro — {LABELS[kind]}</h3>
 <label className="text-sm md:col-span-2">Título<input required minLength={3} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 <label className="text-sm md:col-span-2">Descrição<textarea rows={3} maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 <label className="text-sm">Prioridade<select value={priority} onChange={e=>setPriority(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{["BAIXA","MEDIA","ALTA","CRITICA"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 <label className="text-sm">Prazo<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 {kind==="OKR"&&<><label className="text-sm">Meta numérica<input type="number" min="0.001" step="any" value={target} onChange={e=>setTarget(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label><label className="text-sm">Unidade<input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="ex.: usuários, viagens, %" className="mt-1 w-full rounded-lg border bg-background p-3"/></label></>}
 <button disabled={busy||Boolean(error)} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">Criar registro</button>
 </form>
 <div className="space-y-3"><h3 className="text-lg font-bold">{LABELS[kind]} <span className="text-sm font-normal text-muted-foreground">({filtered.length})</span></h3>
 {loading?<p role="status">Carregando registros...</p>:!filtered.length?<p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhum registro nesta categoria. Não há dados de demonstração.</p>:<div className="grid gap-3 lg:grid-cols-2">{filtered.map(r=><article key={r.id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex justify-between gap-3"><h4 className="font-bold">{r.title}</h4><span className="text-xs text-muted-foreground">{r.priority}</span></div><p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.description||"Sem descrição"}</p><p className="text-xs text-muted-foreground">Prazo: {r.due_date??"Não definido"}</p>{r.kind==="OKR"&&<div><p className="text-xs">Realizado: {r.actual_value??"N/D"} / meta: {r.target_value??"N/D"} {r.unit??""}</p>{progress(r)!==null&&<div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:progress(r)+"%"}}/></div>}<label className="mt-3 flex items-center gap-2 text-xs">Atualizar realizado <input aria-label={"Valor realizado "+r.title} type="number" step="any" defaultValue={r.actual_value??""} onBlur={e=>{if(e.target.value!=="")void update(r.id,{actual_value:Number(e.target.value)})}} className="min-w-0 w-32 rounded-lg border bg-background p-2"/></label></div>}
 <label className="block text-xs">Situação<select disabled={busy} value={r.status} onChange={e=>void update(r.id,{status:e.target.value})} className="mt-1 w-full rounded-lg border bg-background p-2">{STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
 </article>)}</div>}</div>
 </section>;
}
