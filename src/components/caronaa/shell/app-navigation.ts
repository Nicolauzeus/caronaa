import { CalendarClock, CarFront, House, UserRound } from "lucide-react";

// The four destinations are the product contract. Keep the mobile dock and
// desktop navigation sourced from this same configuration.
export const authenticatedNav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/home" as const, label: "Oferecer", icon: CarFront },
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
