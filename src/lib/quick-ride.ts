export type QuickRideRole = "PASSENGER" | "DRIVER";
export type QuickRideAction = "CANCEL" | "CONFIRM_PICKUP" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED";

/** Ações disponíveis para cada papel em cada status da corrida rápida. */
export function quickRideActions(role: QuickRideRole, status: string): QuickRideAction[] {
  const actions: QuickRideAction[] = [];
  if (["SEARCHING", "ACCEPTED", "ARRIVED"].includes(status)) actions.push("CANCEL");
  if (role === "PASSENGER" && status === "ARRIVED") actions.push("CONFIRM_PICKUP");
  if (role === "DRIVER" && status === "ACCEPTED") actions.push("ARRIVED");
  if (role === "DRIVER" && status === "ARRIVED") actions.push("IN_PROGRESS");
  if (role === "DRIVER" && status === "IN_PROGRESS") actions.push("COMPLETED");
  return actions;
}
