import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type EmployeeGrant = {
  user_id: string;
  verified_at: string;
  revoked_at: string | null;
};
const uidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const db=supabase as unknown as {
  rpc: (name: string,args: Record<string, unknown>)=>Promise<{data: unknown,error:{message:string}|null}>;
};

/** Only CARONAA administrators may verify HR-backed memberships.
 * "Participated" and "confirmed email" NEVER mean "employee approved".
 */
export function CorporateResearchAccessManager({formId}:{formId:string}) {
  const [userId,setUserId]=useState("");
  const [reference,setReference]=useState("");
  const [items,setItems]=useState<EmployeeGrant[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    const {data,error}=await db.rpc("list_corporate_research_access",{p_form_id:formId});
    if(error)throw Error(error.message);
    setItems((data??[]) as EmployeeGrant[]);
  },[formId]);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError("");
    void load().catch(e=>{if(active)setError(e instanceof Error?e.message:"Não foi possível consultar colaboradores.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[load]);
  async function grant(e:FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if(!uidPattern.test(userId.trim()) || reference.trim().length<8) {
      setError("Informe o UUID da conta e uma referência interna de verificação com pelo menos oito caracteres.");
      return;
    }
    if(!window.confirm("Confirma que o vínculo de trabalho foi verificado por fonte autorizada?"))return;
    setBusy(true);
    try {
      const {data,error}=await db.rpc("grant_corporate_research_access",{
        p_form_id:formId,p_user_id:userId.trim(),p_reference:reference.trim(),
      });
      if(error||data!==true)throw Error(error?.message??"Vínculo não confirmado.");
      setUserId("");setReference("");
      setNotice("Acesso concedido ao colaborador verificado, com auditoria.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível validar o colaborador.");}
    finally{setBusy(false);}
  }
  async function revoke(personId:string) {
    if(!window.confirm("Revogar acesso desta conta a este formulário?"))return;
    setError("");setNotice("");setBusy(true);
    try{
      const {error}=await db.rpc("revoke_corporate_research_access",{p_form_id:formId,p_user_id:personId});
      if(error)throw Error(error.message);
      setNotice("Acesso revogado. Novos envios e interesses serão bloqueados.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Falha ao revogar.");}
    finally{setBusy(false);}
  }
  return (
    <section aria-label="Controle de colaboradores autorizados" className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h3 className="text-lg font-semibold">Colaboradores autorizados</h3>
      <p className="text-sm text-muted-foreground">
        A pesquisa é privada: somente contas autenticadas com vínculo comprovado e concedido pelo administrador podem responder. E-mail corporativo ou selo de pesquisa não autoriza acesso.
      </p>
      <form onSubmit={e=>void grant(e)} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          UUID da conta CARONAA
          <input className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={userId} onChange={e=>setUserId(e.target.value)} required placeholder="Identificador do usuário"/>
        </label>
        <label className="text-sm">
          Referência de verificação (RH)
          <input className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={reference} onChange={e=>setReference(e.target.value)} required minLength={8} maxLength={180} placeholder="Protocolo interno de RH" />
        </label>
        <Button type="submit" disabled={busy} className="sm:col-span-2">{busy?"Validando…":"Autorizar colaborador verificado"}</Button>
      </form>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice&&<p role="status" className="text-sm">{notice}</p>}
      {loading?<p role="status">Verificando acessos…</p>:(
        <div className="space-y-2">
          <p className="text-sm font-medium">Contas verificadas e revogadas: {items.length}</p>
          {items.length===0?<p className="text-sm text-muted-foreground">Nenhum colaborador habilitado. O formulário permanece inacessível aos trabalhadores até a validação.</p>:(
            <div className="space-y-2">
              {items.map(person=><div key={person.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-xs">{person.user_id}</p>
                  <p className="text-xs text-muted-foreground">{person.revoked_at?"Revogado":"Vínculo ativo"} · {new Date(person.verified_at).toLocaleDateString("pt-BR")}</p>
                </div>
                {!person.revoked_at&&<Button variant="outline" disabled={busy} onClick={()=>void revoke(person.user_id)}>Revogar</Button>}
              </div>)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
