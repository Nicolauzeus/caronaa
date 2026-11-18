export type CaronaaHomeSurface =
  "guest" | "passenger" | "shared-driver" | "professional-driver" | "waiting";

export type CaronaaRole = "PASSAGEIRO" | "MOTORISTA" | null | undefined;

/** The profile's active role selects a landing surface; it never grants F07 access. */
export function resolveCaronaaHomeSurface({
  authenticated, activeRole, professionalAuthorized = false, prelaunchMode = false,
}: {
  authenticated: boolean;
  activeRole?: CaronaaRole;
  professionalAuthorized?: boolean;
  prelaunchMode?: boolean;
}): CaronaaHomeSurface {
  if (!authenticated) return "guest";
  if (prelaunchMode) return "waiting";
  if (activeRole === "MOTORISTA")
    return professionalAuthorized ? "professional-driver" : "shared-driver";
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
