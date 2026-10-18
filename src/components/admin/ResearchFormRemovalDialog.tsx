import {useEffect,useRef,useState} from "react";
import {archiveResearchForm,deleteUnansweredResearchForm,getResearchFormRemovalEligibility,type ResearchForm,type ResearchRemovalEligibility} from "@/lib/formulario/research-catalog";

/** No implicit cascades. Database audits the live relationships again before any hard delete. */
export function ResearchFormRemovalDialog({form,onClose,onCompleted}:{form:ResearchForm;onClose:()=>void;onCompleted:()=>void}){
 const [audit,setAudit]=useState<ResearchRemovalEligibility|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[code,setCode]=useState("");
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let active=true;setLoading(true);
  void getResearchFormRemovalEligibility(form.id).then(data=>{if(active)setAudit(data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha na verificação")}).finally(()=>{if(active)setLoading(false)});
  closeRef.current?.focus();
  return()=>{active=false};
 },[form.id]);
 const dependencies=(audit?.answers??0)+(audit?.legacy_submissions??0)+(audit?.crm_leads??0)+(audit?.partner_pilots??0);
 async function remove(){if(!audit?.can_delete||code!==audit.code||busy)return;
  setBusy(true);setError("");
  try{await deleteUnansweredResearchForm(form,code);onCompleted()}catch(e){setError(e instanceof Error?e.message:"Falha na exclusão");setBusy(false)}
 }
 async function archive(){if(busy)return;setBusy(true);setError("");
  try{await archiveResearchForm(form);onCompleted()}catch(e){setError(e instanceof Error?e.message:"Falha ao arquivar");setBusy(false)}
 }
 return <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 sm:p-6" onKeyDown={event=>{if(event.key==="Escape"&&!busy){event.stopPropagation();onClose()}}}>
  <section role="alertdialog" aria-modal="true" aria-labelledby="removal-title" aria-describedby="removal-description" className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border bg-background p-5 shadow-2xl">
   <div className="flex items-start justify-between gap-3"><div><h2 id="removal-title" className="text-xl font-bold">Arquivar ou excluir pesquisa</h2><p className="mt-1 break-all text-sm font-semibold text-foreground">{form.title} · {form.code}</p></div>
    <button ref={closeRef} type="button" onClick={onClose} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm">Fechar</button>
   </div>
   <p id="removal-description" className="text-sm text-muted-foreground">Arquivar desativa o link público e preserva dados. Excluir é irreversível e só é possível quando não existem respostas nem vínculos com outros módulos.</p>
   {loading?<p role="status" className="text-sm text-muted-foreground">Verificando respostas e vínculos no banco…</p>:audit&&<div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
    <div>Respostas: <strong>{audit.answers}</strong></div><div>Respostas históricas: <strong>{audit.legacy_submissions}</strong></div>
    <div>Leads vinculados: <strong>{audit.crm_leads}</strong></div><div>Pilotos vinculados: <strong>{audit.partner_pilots}</strong></div>
   </div>}
   {error&&<p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
   {audit?.can_delete&&<div className="space-y-2 rounded-lg border border-destructive/40 p-3">
    <p className="text-sm font-medium text-destructive">Exclusão definitiva disponível: o servidor não encontrou respostas nem vínculos.</p>
    <label className="block text-sm">Digite exatamente <strong className="select-all">{audit.code}</strong> para confirmar a exclusão
     <input autoComplete="off" spellCheck={false} value={code} onChange={e=>setCode(e.target.value)} placeholder={audit.code} className="mt-2 w-full rounded-lg border border-destructive/40 bg-background px-3 py-2"/>
    </label>
    <button type="button" disabled={busy||code!==audit.code} onClick={()=>void remove()} className="rounded-lg bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-50">{busy?"Excluindo…":"Excluir definitivamente"}</button>
   </div>}
   {audit&&!audit.can_delete&&<p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-foreground">
    {form.status==="ENCERRADO"?"Esta pesquisa histórica está protegida.":
    dependencies>0?"Esta pesquisa possui respostas ou vínculos. Não é seguro excluí-la. Pode arquivá-la para impedir novas respostas.":"Não é possível excluir esta pesquisa no estado atual."}
   </p>}
   {!loading&&form.status!=="ENCERRADO"&&form.status!=="ARQUIVADO"&&<button type="button" disabled={busy} onClick={()=>void archive()} className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted/40 disabled:opacity-50">
    {busy?"Processando…":"Arquivar e desativar o link público"}
   </button>}
   {form.status==="ARQUIVADO"&&<p className="text-xs text-muted-foreground">A pesquisa já está arquivada. O link público está desativado.</p>}
  </section>
 </div>;
}
