import {supabase} from "@/integrations/supabase/client";

const PENDING_KEY="caronaa.researchParticipation.pending.v1";
const LAUNCH_KEY="caronaa.researchLaunch.pending.v1";
const LAUNCH_TTL_MS=48*60*60*1000; // enough for email confirmation in another tab

export type ResearchParticipationBadge={
 form_id:string;form_title:string;form_code:string;verified_at:string;
};
export type ParticipationClaimResult={status:"linked"|"already_linked";form_id:string};

/** A private v4 receipt is proof of submission control, not institutional affiliation. */
export function isValidParticipationReceipt(receipt:string){
 return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt);
}
function readLaunchReceipts():string[]{
 try {
  const parsed=JSON.parse(localStorage.getItem(LAUNCH_KEY)??"[]");
  if(!Array.isArray(parsed))return[];
  const now=Date.now();
  return parsed.filter((item):item is {receipt:string;expires:number}=>
   typeof item==="object"&&item!==null&&
   typeof item.receipt==="string"&&isValidParticipationReceipt(item.receipt)&&
   typeof item.expires==="number"&&item.expires>now)
   .map(item=>item.receipt);
 } catch{return[]}
}
export function storePendingParticipation(receipt:string, persistForLaunch=false){
 if(!isValidParticipationReceipt(receipt))throw new Error("Recibo inválido.");
 const existing=readPendingParticipations();
 try {sessionStorage.setItem(PENDING_KEY,JSON.stringify([...new Set([...existing,receipt])].slice(-10)))} catch {}
 if(persistForLaunch) {
  // Share only this short-lived private receipt across tabs opened by the email
  // confirmation flow. The response itself is never placed in browser storage.
  try {
   const receipts=[...new Set([...readLaunchReceipts(),receipt])].slice(-10);
   localStorage.setItem(LAUNCH_KEY,JSON.stringify(receipts.map(x=>({receipt:x,expires:Date.now()+LAUNCH_TTL_MS}))));
  } catch {}
 }
}
export function readPendingParticipations():string[]{
 let session:string[]=[];
 try{
  const parsed=JSON.parse(sessionStorage.getItem(PENDING_KEY)??"[]");
  session=Array.isArray(parsed)?parsed.filter((s):s is string=>typeof s==="string"&&isValidParticipationReceipt(s)):[];
 }catch{}
 return [...new Set([...session,...readLaunchReceipts()])].slice(-10);
}
export function removePendingParticipation(receipt:string){
 try {
  const remaining=readPendingParticipations().filter(s=>s!==receipt);
  if(remaining.length)sessionStorage.setItem(PENDING_KEY,JSON.stringify(remaining));
  else sessionStorage.removeItem(PENDING_KEY);
 }catch{}
 try {
  const remaining=readLaunchReceipts().filter(s=>s!==receipt);
  if(remaining.length)localStorage.setItem(LAUNCH_KEY,JSON.stringify(remaining.map(x=>({receipt:x,expires:Date.now()+LAUNCH_TTL_MS}))));
  else localStorage.removeItem(LAUNCH_KEY);
 }catch{}
}
export function clearPendingLaunchReceipts(){
 try{localStorage.removeItem(LAUNCH_KEY);}catch{}
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
