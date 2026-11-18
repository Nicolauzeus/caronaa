import { CalendarClock, House, UserRound } from "lucide-react";

// Offer/request is selected exclusively inside the account menu. The dock
// contains destinations, not a duplicate account-role switch.
export const authenticatedNav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/minhas-caronas" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

export function isAppNavSelected(pathname: string, activeIntent: string | undefined, to: string, label: string): boolean {
  if (label === "Oferecer") return (pathname === "/home" && activeIntent === "offer") || pathname === "/oferecer";
  if (label === "Início") return pathname === "/home" && activeIntent !== "offer";
  if (label === "Viagens") {
    return pathname === "/minhas-caronas" || pathname.startsWith("/viagem/");
  }
  return pathname === to || pathname.startsWith(to + "/");
}
