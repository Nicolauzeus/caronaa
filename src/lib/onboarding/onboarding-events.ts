import {supabase} from "@/integrations/supabase/client";
export type OnboardingEventType = "STEP" | "COMPLETED";
export async function trackOnboardingEvent(type:OnboardingEventType,step:string):Promise<void>{
 const {data}=await supabase.auth.getUser();
 if(!data.user?.id)return;
 // Only enum-like metadata is recorded; never addresses, GPS, passwords or research receipts.
 const {error}=await (supabase as any).from("user_onboarding_events").upsert({
   user_id:data.user.id,event_type:type,step,recorded_at:new Date().toISOString()
 },{onConflict:"user_id,event_type,step"});
 if(error) console.warn("[Onboarding] Não foi possível registrar etapa.");
}
