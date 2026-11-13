import { getMyResearchParticipationBadges } from "@/lib/formulario/research-participation";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { getMyUserVerifications } from "@/lib/user-verifications";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { supabase } from "@/integrations/supabase/client";

/**
 * Research is not a prerequisite for accounts whose completed onboarding
 * declares the driver-only role. This exempts the SURVEY, not professional
 * approval, regional availability, payment restrictions or GPS consent.
 *
 * PASSAGEIRO and AMBOS retain the passenger research participation gate.
 * The launch waiting gate still takes precedence for linked campaign accounts.
 * A self-selected role is never evidence of professional authorization.
 */
export function decideResearchDestination(input: {
  locked: boolean;
  hasParticipation: boolean;
  isPilot: boolean;
  isDriverOnly?: boolean;
  isApprovedProfessional?: boolean;
  hasProfessionalRequest?: boolean;
}): "/formulario" | "/aguardando" | "/home" | "/disponibilidade-profissional" {
  if (input.locked) return "/aguardando";
  if (input.isDriverOnly || input.isApprovedProfessional || input.isPilot || input.hasParticipation) return "/home";
  // A pending professional candidate must have a path to finish the driver
  // process, without unlocking the passenger home or professional dispatch.
  if (input.hasProfessionalRequest) return "/disponibilidade-profissional";
  return "/formulario";
}

export async function resolvePostOnboardingDestination():
  Promise<"/formulario" | "/aguardando" | "/home" | "/disponibilidade-profissional"> {
  // Read the verified account's persisted onboarding role, not a querystring
  // or mutable auth metadata. This does NOT grant access to paid driver RPCs.
  const onboarding = await readOnboarding();
  const isDriverOnly =
    onboarding?.status === "BASIC_COMPLETED" &&
    onboarding.usage_role === "MOTORISTA";

  // Keep the existing launch gate authoritative. A survey participant linked
  // to a pending institutional launch must still respect that cohort.
  const launch = await getMyResearchLaunchState();
  if (launch.locked) return "/aguardando";

  if (isDriverOnly) {
    // Crucially, no survey/badge RPC is required for a driver-only account.
    return "/home";
  }

  const [participations, verifications] = await Promise.all([
    getMyResearchParticipationBadges(),
    getMyUserVerifications(),
  ]);

  // A professional already approved by the administrative flow is also a
  // driver even if they originally onboarded as PASSAGEIRO or AMBOS.
  // Only an actual server-side authorization qualifies, never a form field,
  // user metadata, or an unapproved access request.
  let isApprovedProfessional = false;
  let hasProfessionalRequest = false;
  if (participations.length === 0 &&
      !verifications.some(v => v.type === "CARONAA_TEST" && v.status === "VERIFIED")) {
    const { data, error } = await (supabase as any).rpc("get_my_professional_access");
    isApprovedProfessional = !error && data?.authorized === true;
    hasProfessionalRequest = !error &&
      ["PENDING", "CHANGES_REQUESTED", "REJECTED"].includes(data?.request?.status);
  }
  return decideResearchDestination({
    locked: false,
    hasParticipation: participations.length > 0,
    isPilot: verifications.some(v => v.type === "CARONAA_TEST" && v.status === "VERIFIED"),
    isDriverOnly: false,
    isApprovedProfessional,
    hasProfessionalRequest,
  });
}
