import { CalendarClock, House, LayoutDashboard, UserRound } from "lucide-react";

// Offer/request is selected exclusively inside the account menu. The dock
// contains destinations, not a duplicate account-role switch.
export const authenticatedNav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/minhas-caronas" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

// A shared driver must land in the driver cockpit, never in passenger search.
// Professional F07 drivers use the separate authorized availability dashboard.
export const sharedDriverNav = [
  { to: "/home" as const, label: "Painel", icon: LayoutDashboard },
  { to: "/minhas-caronas" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

export function isAppNavSelected(pathname: string, activeIntent: string | undefined, to: string, label: string): boolean {
  if (label === "Início" || label === "Painel") return pathname === to;
  if (label === "Viagens") {
    return pathname === "/minhas-caronas" || pathname.startsWith("/viagem/");
  }
  return pathname === to || pathname.startsWith(to + "/");
}
