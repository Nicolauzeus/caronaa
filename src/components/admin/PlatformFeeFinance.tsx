import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Claim = {
  rideId:string; driverId:string; gross:number; fee:number;
  reference:string|null; claimedAt:string;
};
const brl = (value:number) => Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function PlatformFeeFinance() {
  const [claims,setClaims]=useState<Claim[]>([]);
  const [key,setKey]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    const {data,error:problem}=await (supabase as any).rpc("admin_platform_fee_claims");
    if(problem)throw new Error(problem.message);
    setClaims(Array.isArray(data)?data:[]);
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
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <div>
      <h2 className="text-lg font-bold">Repasse manual dos motoristas — 16,86% nas novas viagens</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Esta tela não tem conexão com o banco. Confirme apenas após verificar o recebimento no extrato
        bancário da plataforma. Aprovação libera o motorista quando restarem menos de três débitos.
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
  </section>;
}
