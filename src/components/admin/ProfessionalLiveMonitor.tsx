import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
type Presence={user_id:string;is_available:boolean;last_seen_at:string;municipality:string|null};
const ACTIVE_MS=90000;
export function ProfessionalLiveMonitor(){
 const [rows,setRows]=useState<Presence[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[updated,setUpdated]=useState<Date|null>(null);
 const reload=useCallback(async()=>{const {data,error}=await (supabase as any).from("professional_presence").select("user_id,is_available,last_seen_at,municipality").order("last_seen_at",{ascending:false}).limit(200);
 if(error){setError("Monitoramento indisponível: "+error.message);setRows([])}else{setRows(data??[]);setError("");setUpdated(new Date())}setLoading(false)},[]);
 useEffect(()=>{void reload();const timer=window.setInterval(()=>void reload(),15000);const channel=supabase.channel("admin-professional-presence").on("postgres_changes",{event:"*",schema:"public",table:"professional_presence"},()=>void reload()).subscribe();return()=>{window.clearInterval(timer);void supabase.removeChannel(channel)}},[reload]);
 const now=Date.now();const active=rows.filter(x=>x.is_available&&now-Date.parse(x.last_seen_at)<ACTIVE_MS);
 return <section className="space-y-4 rounded-xl border bg-card p-4"><header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Disponibilidade profissional</h2><p className="mt-1 text-xs text-muted-foreground">Atualização automática a cada 15 segundos. Online = disponibilidade ativa com último heartbeat há menos de 90 segundos.</p></div><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void reload()}>Atualizar agora</button></header>
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 <div className="grid gap-3 sm:grid-cols-3">{[{label:"Profissionais online",value:error||loading?"N/D":active.length},{label:"Indisponíveis ou sem sinal",value:error||loading?"N/D":rows.length-active.length},{label:"Última consulta",value:updated?updated.toLocaleTimeString("pt-BR"):"N/D"}].map(x=><div className="rounded-lg border p-3" key={x.label}><p className="text-xs text-muted-foreground">{x.label}</p><p className="mt-2 text-xl font-bold">{x.value}</p></div>)}</div>
 {!error&&!loading&&<div className="space-y-2">{rows.length===0?<p className="text-sm text-muted-foreground">Nenhum profissional habilitou a disponibilidade neste ambiente.</p>:rows.map(x=><div key={x.user_id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm"><div><p className="font-semibold">{x.municipality||"Município não informado"}</p><p className="text-xs text-muted-foreground">Identificador: {x.user_id.slice(0,8)}… · Último sinal: {new Date(x.last_seen_at).toLocaleString("pt-BR")}</p></div><span className={active.includes(x)?"font-semibold text-emerald-600":"text-muted-foreground"}>{active.includes(x)?"Online":"Offline"}</span></div>)}</div>}
 <p className="text-xs text-muted-foreground">Presença não comprova credenciamento nem disponibilidade para receber corridas. O despacho profissional e a localização em tempo real exigem integração e homologação específicos.</p>
 </section>
}
