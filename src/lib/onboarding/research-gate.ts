import { getMyResearchParticipationBadges } from "@/lib/formulario/research-participation";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { getMyUserVerifications } from "@/lib/user-verifications";

/**
 * After basic onboarding, require a real research submission before app access.
 * Existing campaign waiting gates take precedence for users who participated.
 * The pilot badge is issued by an administrator, never inferred from typed email.
 * Fail closed if participation cannot be checked.
 */
export async function resolvePostOnboardingDestination():
  Promise<"/formulario" | "/aguardando" | "/home"> {
  const [participations, verifications, launch] = await Promise.all([
    getMyResearchParticipationBadges(),
    getMyUserVerifications(),
    getMyResearchLaunchState(),
  ]);
  if (launch.locked) return "/aguardando";
  if (verifications.some(v => v.type === "CARONAA_TEST" && v.status === "VERIFIED")) {
    return "/home";
  }
  return participations.length > 0 ? "/home" : "/formulario";
}
