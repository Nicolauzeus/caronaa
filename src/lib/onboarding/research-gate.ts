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
  return "/home";
}

export async function resolvePostOnboardingDestination():
  Promise<"/formulario" | "/aguardando" | "/home" | "/disponibilidade-profissional"> {
  // Survey participation is voluntary, not an access requirement.
  // A verified session with basic onboarding may use normal passenger rides
  // and request Flash rides. Professional dispatch remains separately gated.
  const onboarding = await readOnboarding();
  if (onboarding?.status !== "BASIC_COMPLETED") return "/home";
  const launch = await getMyResearchLaunchState();
  return launch.locked ? "/aguardando" : "/home";
}
