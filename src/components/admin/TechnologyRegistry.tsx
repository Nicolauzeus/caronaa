import {useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {useRouterState} from "@tanstack/react-router";
import {InsightChart} from "@/components/admin/InsightChart";
type Kind="INCIDENT"|"BUG"|"FEATURE"|"RELEASE";
type Item={id:string;kind:Kind;title:string;description:string;status:string;severity:string;service_name:string|null;external_url:string|null;created_at:string;resolved_at:string|null};
const types:Kind[]=["INCIDENT","BUG","FEATURE","RELEASE"];
const names:Record<Kind,string>={INCIDENT:"Incidentes",BUG:"Bugs",FEATURE:"Melhorias",RELEASE:"Releases"};
const statuses=["ABERTO","EM_ANDAMENTO","BLOQUEADO","RESOLVIDO","ENCERRADO"];
export function TechnologyRegistry(){
 const locationHash=useRouterState({select:s=>s.location.hash});
 const group=locationHash==="releases"||locationHash==="#releases"?"product":"incident";
 const [kind,setKind]=useState<Kind>("INCIDENT"),[items,setItems]=useState<Item[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[service,setService]=useState(""),[severity,setSeverity]=useState("MEDIA"),[url,setUrl]=useState("");
 async function reload(){setLoading(true);const {data,error}=await (supabase as any).from("tech_work_items").select("id,kind,title,description,status,severity,service_name,external_url,created_at,resolved_at").order("created_at",{ascending:false}).limit(200);if(error){setError("Confirme a migração 0081 e as permissões: "+error.message);setItems([])}else{setError("");setItems(data??[])}setLoading(false)}
 useEffect(()=>{void reload()},[]);
 async function create(e:FormEvent){e.preventDefault();setBusy(true);const {data,error}=await (supabase as any).from("tech_work_items").insert({kind,title:title.trim(),description:description.trim(),service_name:service.trim()||null,severity,external_url:url.trim()||null}).select("id").maybeSingle();if(error||!data)setError(error?.message??"Criação não confirmada");else{setTitle("");setDescription("");setService("");setUrl("");await reload()}setBusy(false)}
 async function setStatus(item:Item,status:string){setBusy(true);const {data,error}=await (supabase as any).from("tech_work_items").update({status,resolved_at:status==="RESOLVIDO"||status==="ENCERRADO"?new Date().toISOString():null}).eq("id",item.id).select("id").maybeSingle();if(error||!data)setError(error?.message??"Atualização não confirmada");else await reload();setBusy(false)}
 useEffect(()=>{setKind(group==="incident"?"INCIDENT":"BUG")},[group]);
 const visible=items.filter(x=>x.kind===kind);
 return <section className="space-y-4">
 <InsightChart title={group==="incident"?"Incidentes por situação":"Registros do produto por situação"} rows={["ABERTO","EM_ANDAMENTO","RESOLVIDO","ENCERRADO"].map(status=>({name:status.replaceAll("_"," "),value:visible.filter(item=>item.status===status).length}))}/>
 {group==="product"&&<div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de produto">{types.filter(t=>t!=="INCIDENT").map(t=><button key={t} role="tab" aria-selected={kind===t} onClick={()=>setKind(t)} className={kind===t?"rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground":"rounded-lg border px-4 py-2 text-sm"}>{names[t]} ({items.filter(i=>i.kind===t).length})</button>)}</div>}
 {error&&<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
 <form onSubmit={create} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
 <h3 className="font-bold md:col-span-2">Registrar {names[kind].toLowerCase()}</h3>
 <label className="text-sm md:col-span-2">Título<input required minLength={3} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 <label className="text-sm md:col-span-2">Descrição<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 <label className="text-sm">Serviço ou componente<input value={service} onChange={e=>setService(e.target.value)} placeholder="Ex.: matching, pagamentos" className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 <label className="text-sm">Severidade<select value={severity} onChange={e=>setSeverity(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">{["BAIXA","MEDIA","ALTA","CRITICA"].map(x=><option key={x}>{x}</option>)}</select></label>
 <label className="text-sm md:col-span-2">Referência externa HTTPS (opcional)<input type="url" pattern="https://.*" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://github.com/..." className="mt-1 w-full rounded-lg border bg-background p-3"/></label>
 <button disabled={busy||!!error} className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2">Registrar</button></form>
 {loading?<p role="status">Carregando registros…</p>:!visible.length?<p className="rounded-xl border p-5 text-sm text-muted-foreground">Nenhum registro para esta categoria.</p>:<div className="grid gap-3 lg:grid-cols-2">{visible.map(x=><article key={x.id} className="rounded-xl border bg-card p-4 space-y-2"><div className="flex justify-between gap-2"><h4 className="font-bold">{x.title}</h4><span className="text-xs text-muted-foreground">{x.severity}</span></div><p className="text-sm text-muted-foreground whitespace-pre-wrap">{x.description}</p><p className="text-xs text-muted-foreground">Componente: {x.service_name??"N/D"}</p>{x.external_url&&<a className="break-all text-xs text-primary" href={x.external_url} target="_blank" rel="noopener noreferrer">Abrir referência externa ↗</a>}<label className="block text-xs">Situação<select value={x.status} disabled={busy} onChange={e=>void setStatus(x,e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2">{statuses.map(s=><option key={s}>{s}</option>)}</select></label></article>)}</div>}
 </section>;
}
