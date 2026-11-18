/**
 * Dedicated professional access remains a data/approval step, not a second
 * authentication system. Only this exact path may be carried through
 * universal account creation/onboarding.
 */
export const PROFESSIONAL_APPLICATION_PATH = "/cadastro-motorista" as const;

export function isProfessionalApplicationRedirect(value: unknown):
  value is typeof PROFESSIONAL_APPLICATION_PATH {
  return value === PROFESSIONAL_APPLICATION_PATH;
}

export function afterUniversalOnboarding(
  resolved: "/home" | "/aguardando" | "/onboarding",
  redirect: unknown,
): "/home" | "/aguardando" | "/onboarding" | typeof PROFESSIONAL_APPLICATION_PATH {
  // Never override campaign locks or incomplete universal onboarding.
  if (resolved !== "/home" || !isProfessionalApplicationRedirect(redirect)) return resolved;
  return PROFESSIONAL_APPLICATION_PATH;
}
