import {supabase} from "@/integrations/supabase/client";
import type {RegionCode,UsageRole} from "./progressive-onboarding";
export type VerifiedResearchHint = {
 form_code:string; institution:string|null; region:string|null;
 profile:string|null; origin:string|null; destination:string|null; outbound_time:string|null;
};
export type ResearchSuggestion={region:RegionCode|null;role:UsageRole|null;journey:{origin:string;destination:string;time:string}|null;sourceCount:number;conflict:boolean};
export function summarizeResearchHints(rows:VerifiedResearchHint[]):ResearchSuggestion{
 const regions=new Set<RegionCode>();
 const roles=new Set<UsageRole>();
 let journey:ResearchSuggestion["journey"]=null;
 for(const row of rows){
  const value=[row.institution,row.region,row.form_code].join(" ").toUpperCase();
  if(value.includes("UNIFOR")||value.includes("FORTALEZA"))regions.add("FORTALEZA");
  else if(value.includes("UNILAB")||value.includes("BATURIT"))regions.add("MACICO_BATURITE");
  if(row.profile==="PASSAGEIRO"||row.profile==="MOTORISTA"||row.profile==="AMBOS") roles.add(row.profile);
  if(!journey && row.origin && row.destination) journey={origin:row.origin,destination:row.destination,time:row.outbound_time??""};
 }
 const region=regions.size===1?[...regions][0]:null;
 const role=roles.size===1?[...roles][0]:null;
 return {region,role,journey,sourceCount:rows.length,conflict:regions.size>1||roles.size>1};
}
export async function loadVerifiedResearchSuggestions():Promise<ResearchSuggestion>{
 const {data,error}=await (supabase as any).rpc("get_my_onboarding_research_suggestions");
 if(error)throw new Error("Não foi possível consultar sugestões das pesquisas.");
 return summarizeResearchHints(Array.isArray(data)?data:[]);
}
