import {useEffect,useState} from "react";
import {claimPendingParticipations,claimResearchParticipation,getMyResearchParticipationBadges,type ResearchParticipationBadge} from "@/lib/formulario/research-participation";

export function ResearchParticipationCard(){
 const [badges,setBadges]=useState<ResearchParticipationBadge[]>([]);
 const [receipt,setReceipt]=useState("");
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [working,setWorking]=useState(false);
 const [loading,setLoading]=useState(true);
 async function refresh(){
  try{setBadges(await getMyResearchParticipationBadges())}
  catch(err){setError(err instanceof Error?err.message:"Não foi possível consultar selos de participação.")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void (async()=>{await claimPendingParticipations();await refresh()})()},[]);
 async function claim(){
  if(!receipt.trim()||working)return;
  setWorking(true);setError("");setSuccess("");
  try{
   await claimResearchParticipation(receipt.trim());
   setReceipt("");
   setSuccess("Participação vinculada à sua conta.");
   await refresh();
  }catch(err){setError(err instanceof Error?err.message:"Não foi possível associar o recibo.")}
  finally{setWorking(false)}
 }
 return <section aria-label="Participações em pesquisas" className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft md:p-5">
  <div><h3 className="font-display text-lg font-extrabold">Pesquisas respondidas</h3>
   <p className="mt-1 text-xs text-muted-foreground">Selos por participação confirmada em um formulário. Não comprovam matrícula, presença no evento ou identidade verificada.</p>
  </div>
  {loading?<p role="status" className="text-sm text-muted-foreground">Consultando participações…</p>:
   badges.length?<div className="flex flex-wrap gap-2">{badges.map(b=><span title={"Participação no questionário "+b.form_code} key={b.form_id} className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">✓ Pesquisa respondida · {b.form_title}</span>)}</div>:
   <p className="text-sm text-muted-foreground">Nenhuma participação vinculada a esta conta ainda.</p>}
  <details className="rounded-lg border border-border/70 p-3">
   <summary className="cursor-pointer text-sm font-semibold">Vincular participação com meu recibo</summary>
   <p className="mt-2 text-xs text-muted-foreground">Se respondeu antes de criar a conta, insira a chave privada mostrada após o envio. Por segurança, confirme seu e-mail antes de vincular.</p>
   <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={receipt} onChange={e=>setReceipt(e.target.value)} placeholder="Recibo UUID da pesquisa" aria-label="Recibo de participação" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
    <button type="button" disabled={working||!receipt.trim()} onClick={()=>void claim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{working?"Validando…":"Vincular"}</button></div>
  </details>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {success&&<p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{success}</p>}
 </section>;
}
