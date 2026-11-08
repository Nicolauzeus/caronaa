import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Claim = {
  rideId:string; driverId:string; gross:number; fee:number;
  reference:string|null; claimedAt:string;
};
type StatementClaim = {
  id: string; driverId: string; totalCents: number; itemCount: number;
  claimReference: string; claimedAt: string;
};
const brl = (value:number) => Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function PlatformFeeFinance() {
  const [claims,setClaims]=useState<Claim[]>([]);
  const [batchClaims,setBatchClaims]=useState<StatementClaim[]>([]);
  const [batchAvailability,setBatchAvailability]=useState<"READY"|"UNAVAILABLE">("UNAVAILABLE");
  const [key,setKey]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    const {data,error:problem}=await (supabase as any).rpc("admin_platform_fee_claims");
    if(problem)throw new Error(problem.message);
    setClaims(Array.isArray(data)?data:[]);
    const {data:statements,error:statementError}=await (supabase as any).rpc("admin_caronaa_fee_statement_claims");
    setBatchAvailability(statementError?"UNAVAILABLE":"READY");
    setBatchClaims(!statementError&&Array.isArray(statements)?statements:[]);
  },[]);
  useEffect(()=>{
    let alive=true;
    void load().catch(cause=>{if(alive)setError(cause instanceof Error?cause.message:String(cause))});
    return()=>{alive=false};
  },[load]);
  async function saveKey() {
    setBusy(true);setError("");
    const {error:problem}=await (supabase as any).rpc("admin_set_platform_pix",{p_key:key.trim()});
    if(problem)setError(problem.message);else setKey("");
    setBusy(false);
  }
  async function decide(rideId:string,received:boolean) {
    if(!received && !window.confirm("Rejeitar o comprovante e manter a comissão em aberto?"))return;
    if(received && !window.confirm("Você conferiu no extrato bancário o recebimento deste Pix?"))return;
    setBusy(true);setError("");
    const {error:problem}=await (supabase as any).rpc("verify_driver_platform_fee",{
      p_ride_id:rideId,p_received:received
    });
    if(problem)setError(problem.message);
    else await load().catch(e=>setError(String(e)));
    setBusy(false);
  }
  async function verifyStatement(statementId:string,received:boolean) {
    if(!window.confirm(received
      ?"Confirma que o valor exato deste fechamento foi recebido no extrato da plataforma?"
      :"Rejeitar a declaração e devolver este fechamento à situação em aberto?"))return;
    setBusy(true);setError("");
    const {error:problem}=await (supabase as any).rpc("admin_verify_caronaa_fee_statement",{
      p_statement_id:statementId,p_received:received,
    });
    if(problem)setError(problem.message);
    else await load().catch(e=>setError(String(e)));
    setBusy(false);
  }
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <div>
      <h2 className="text-lg font-bold">Conferência das comissões dos motoristas</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Os débitos são registrados por viagem e preservam a comissão vigente na respectiva cotação.
        Não existe confirmação bancária automática: confirme somente após conferir o crédito e o valor
        exato no extrato da plataforma. O motorista volta a ficar elegível quando restarem menos de três débitos.
      </p>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Input aria-label="Chave Pix oficial do CARONAA" type="text" value={key}
        maxLength={77} placeholder="Configurar chave Pix da plataforma"
        onChange={e=>setKey(e.target.value)} className="min-w-0 flex-1 basis-64" />
      <Button type="button" disabled={busy||key.trim().length<6} onClick={()=>void saveKey()}>
        Salvar chave oficial
      </Button>
    </div>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Declarações aguardando conferência: {claims.length}</h3>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>void load()}>Atualizar</Button>
      </div>
      {claims.length === 0 && <p className="text-sm text-muted-foreground">Nenhum repasse declarado pendente.</p>}
      {claims.map(claim=><article key={claim.rideId} className="rounded-lg border p-3 text-sm">
        <p className="font-semibold">{brl(claim.fee)} de comissão · viagem {claim.rideId.slice(0,8)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Motorista {claim.driverId.slice(0,8)} · viagem bruta {brl(claim.gross)}
          {" "}· informado em {new Date(claim.claimedAt).toLocaleString("pt-BR")}
        </p>
        <p className="my-2 break-words font-mono text-xs">Comprovante informado: {claim.reference || "não informado"}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={()=>void decide(claim.rideId,true)}>
            Recebimento conferido
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={()=>void decide(claim.rideId,false)}>
            Não recebido
          </Button>
        </div>
      </article>)}
    </div>
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <h3 className="font-bold">Fechamentos Pix agrupados · conferência financeira</h3>
      <p className="text-xs text-muted-foreground">
        Cada fechamento tem valor fixo e identificador próprio, calculados com os débitos
        que existiam na emissão. Corridas posteriores não alteram aquele QR.
      </p>
      {batchAvailability==="UNAVAILABLE"&&
        <p className="text-xs text-muted-foreground">Aguardando migration 0140 para os fechamentos com QR.</p>}
      {batchAvailability==="READY"&&batchClaims.length===0&&
        <p className="text-sm text-muted-foreground">Nenhum fechamento agrupado aguardando análise.</p>}
      {batchClaims.map(claim=>(
        <article key={claim.id} className="min-w-0 space-y-2 rounded-lg border bg-card p-3 text-sm">
          <p className="font-bold">{brl(claim.totalCents/100)} · {claim.itemCount} {claim.itemCount===1?"viagem":"viagens"}</p>
          <p className="break-all text-xs text-muted-foreground">
            Motorista {claim.driverId.slice(0,8)} · Fechamento {claim.id.slice(0,8)} ·
            informado em {new Date(claim.claimedAt).toLocaleString("pt-BR")}
          </p>
          <p className="break-all font-mono text-xs">Identificador bancário: {claim.claimReference}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={()=>void verifyStatement(claim.id,true)}>
              Confirmei o valor no banco
            </Button>
            <Button type="button" variant="outline" disabled={busy}
              onClick={()=>void verifyStatement(claim.id,false)}>Pagamento não localizado</Button>
          </div>
        </article>
      ))}
    </div>
  </section>;
}
