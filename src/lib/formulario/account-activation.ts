import { supabase } from "@/integrations/supabase/client";

export type FormActivationSubmission = {
  submissionId: string; name: string; email: string | null; whatsapp: string;
  intent: string; origin: string | null; destination: string; departureWindow: string | null; transport: string | null;
};
export type FormActivation = { status: "none" | "ambiguous" | "ready" | "confirmed"; submission?: FormActivationSubmission };

export async function getFormAccountActivation(): Promise<FormActivation> {
  const { data, error } = await (supabase as any).rpc("get_form_account_activation");
  if (error) throw new Error(error.message);
  return data as FormActivation;
}

export async function confirmFormAccountActivation(submissionId: string, changes: Partial<FormActivationSubmission>) {
  const { data, error } = await (supabase as any).rpc("confirm_form_account_activation", { p_submission_id: submissionId, p_changes: changes });
  if (error) throw new Error(error.message);
  return data as FormActivation;
}
