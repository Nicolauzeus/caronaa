import {supabase} from "@/integrations/supabase/client";

const PENDING_KEY="caronaa.researchParticipation.pending.v1";
export type ResearchParticipationBadge={
 form_id:string;form_title:string;form_code:string;verified_at:string;
};
export type ParticipationClaimResult={status:"linked"|"already_linked";form_id:string};

/**
 * A UUID submission receipt is proof of control of that submission, not an
 * institution credential. Never derive eligibility from mutable title/code.
 */
export function storePendingParticipation(receipt:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt))
  throw new Error("Recibo inválido.");
 const existing=readPendingParticipations();
 sessionStorage.setItem(PENDING_KEY,JSON.stringify([...new Set([...existing,receipt])].slice(-10)));
}
export function readPendingParticipations():string[]{
 try{
  const parsed=JSON.parse(sessionStorage.getItem(PENDING_KEY)??"[]");
  return Array.isArray(parsed)?parsed.filter((s):s is string=>typeof s==="string"&&/^[0-9a-f-]{36}$/i.test(s)):[];
 }catch{return []}
}
export function removePendingParticipation(receipt:string){
 const remaining=readPendingParticipations().filter(s=>s!==receipt);
 if(remaining.length)sessionStorage.setItem(PENDING_KEY,JSON.stringify(remaining));
 else sessionStorage.removeItem(PENDING_KEY);
}
export async function claimResearchParticipation(receipt:string):Promise<ParticipationClaimResult>{
 const {data,error}=await (supabase as any).rpc("claim_research_participation",{p_submission_key:receipt});
 if(error)throw new Error(error.message);
 if(!data||!["linked","already_linked"].includes(data.status))throw new Error("O vínculo não foi confirmado.");
 removePendingParticipation(receipt);
 return data as ParticipationClaimResult;
}
export async function claimPendingParticipations(){
 for(const receipt of readPendingParticipations()){
  try{await claimResearchParticipation(receipt)}
  catch{/* Keep receipt for later; verified email or migration may still be pending. */}
 }
}
export async function getMyResearchParticipationBadges():Promise<ResearchParticipationBadge[]>{
 const {data,error}=await (supabase as any).rpc("get_my_research_participation_badges");
 if(error)throw new Error(error.message);
 return (data??[]) as ResearchParticipationBadge[];
}
