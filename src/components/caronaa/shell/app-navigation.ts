import { CalendarClock, CarFront, House, LayoutDashboard, UserRound } from "lucide-react";

// Offer/request is selected exclusively inside the account menu. The dock
// contains destinations, not a duplicate account-role switch.
export const authenticatedNav = [
  { to: "/home" as const, label: "Início", icon: House },
  { to: "/home" as const, label: "Oferecer", icon: CarFront },
  { to: "/minhas-caronas" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

// A shared driver must land in the driver cockpit, never in passenger search.
// Professional F07 drivers use the separate authorized availability dashboard.
export const sharedDriverNav = [
  { to: "/home" as const, label: "Início", icon: LayoutDashboard },
  { to: "/home" as const, label: "Oferecer", icon: CarFront },
  { to: "/home" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

export const professionalNav = [
  { to: "/disponibilidade-profissional" as const, label: "Início", icon: LayoutDashboard },
  { to: "/home" as const, label: "Oferecer", icon: CarFront },
  { to: "/viagens-profissionais" as const, label: "Viagens", icon: CalendarClock },
  { to: "/perfil" as const, label: "Perfil", icon: UserRound },
];

export function isAppNavSelected(pathname: string, activeIntent: string | undefined, to: string, label: string, tripsOpen = false): boolean {
  if (label === "Início") return pathname === to && !tripsOpen && activeIntent !== "offer" && activeIntent !== "scheduled";
  if (label === "Oferecer") return pathname === to && (activeIntent === "offer" || activeIntent === "scheduled");
  if (label === "Painel") return pathname === to && !tripsOpen;
  if (label === "Viagens") {
    if (to === "/home") return pathname === "/home" && tripsOpen;
    return pathname === to || pathname === "/minhas-caronas" || pathname.startsWith("/viagem/");
  }
  return pathname === to || pathname.startsWith(to + "/");
}
