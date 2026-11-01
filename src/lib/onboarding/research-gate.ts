import { getMyResearchParticipationBadges } from "@/lib/formulario/research-participation";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { getMyUserVerifications } from "@/lib/user-verifications";

/**
 * After basic onboarding, require a real research submission before app access.
 * Existing campaign waiting gates take precedence for users who participated.
 * The pilot badge is issued by an administrator, never inferred from typed email.
 * Fail closed if participation cannot be checked.
 */
export function decideResearchDestination(input: { locked: boolean; hasParticipation: boolean; isPilot: boolean }): "/formulario" | "/aguardando" | "/home" {
  if (input.locked) return "/aguardando";
  if (input.isPilot || input.hasParticipation) return "/home";
  return "/formulario";
}

export async function resolvePostOnboardingDestination():
  Promise<"/formulario" | "/aguardando" | "/home"> {
  const [participations, verifications, launch] = await Promise.all([
    getMyResearchParticipationBadges(),
    getMyUserVerifications(),
    getMyResearchLaunchState(),
  ]);
  return decideResearchDestination({
    locked: launch.locked,
    hasParticipation: participations.length > 0,
    isPilot: verifications.some(v => v.type === "CARONAA_TEST" && v.status === "VERIFIED"),
  });
}
