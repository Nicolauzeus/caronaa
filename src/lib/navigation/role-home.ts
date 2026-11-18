export type CaronaaHomeSurface =
  "guest" | "passenger" | "shared-driver" | "professional-driver" | "waiting";

export type CaronaaRole = "PASSAGEIRO" | "MOTORISTA" | null | undefined;

/** The profile's active role selects a landing surface; it never grants F07 access. */
export function resolveCaronaaHomeSurface({
  authenticated, activeRole, prelaunchMode = false,
}: {
  authenticated: boolean;
  activeRole?: CaronaaRole;
  professionalAuthorized?: boolean;
  prelaunchMode?: boolean;
}): CaronaaHomeSurface {
  if (!authenticated) return "guest";
  if (prelaunchMode) return "waiting";
  // Choosing MOTORISTA selects the operational landing, never a permission.
  // Missing professional data/fees/GPS remain enforced in the guarded cockpit.
  if (activeRole === "MOTORISTA") return "professional-driver";
  return "passenger";
}

export function caronaaHomeTarget(surface: CaronaaHomeSurface):
  { to: "/" | "/home" | "/disponibilidade-profissional" | "/aguardando"; search?: { intent: "offer" } } {
  switch (surface) {
    case "guest": return { to: "/" };
    case "waiting": return { to: "/aguardando" };
    case "professional-driver": return { to: "/disponibilidade-profissional" };
    case "shared-driver": return { to: "/home", search: { intent: "offer" } };
    case "passenger": return { to: "/home" };
  }
}
