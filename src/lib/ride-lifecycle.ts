export const rideStatuses = [
  "MATCHED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type RideStatus = (typeof rideStatuses)[number];

const allowedTransitions: Partial<Record<RideStatus, readonly RideStatus[]>> = {
  MATCHED: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "NO_SHOW"],
};

export function canTransitionRide(from: RideStatus, to: RideStatus): boolean {
  if (from === to && (from === "CONFIRMED" || from === "CANCELLED")) return true;
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function transitionRide(
  from: RideStatus,
  to: RideStatus,
  context: {
    hasPersistedMatch: boolean;
    isParticipant: boolean;
    confirmedByBoth?: boolean;
    boardingValidated?: boolean;
    isDriver?: boolean;
  },
): RideStatus {
  if (!context.hasPersistedMatch) throw new Error("A ride requires a persisted match");
  if (!context.isParticipant) throw new Error("Only ride participants may transition the ride");
  if (from === to && (from === "CONFIRMED" || from === "CANCELLED")) return to;
  if (from === "MATCHED" && to === "CONFIRMED" && !context.confirmedByBoth) {
    throw new Error("Both ride participants must accept the match");
  }
  if (to === "IN_PROGRESS" && (!context.boardingValidated || !context.isDriver)) {
    throw new Error("Driver must validate boarding PIN before starting the ride");
  }
  if (to === "COMPLETED") {
    if (from === "IN_PROGRESS" && context.confirmedByBoth) return "COMPLETED";
    throw new Error(`Invalid ride transition: ${from} -> ${to}`);
  }
  if (!canTransitionRide(from, to)) throw new Error(`Invalid ride transition: ${from} -> ${to}`);
  return to;
}

export type RideAction = {
  label: string;
  status: RideStatus;
  variant?: "outline";
};

export function getRideNextActions(
  status: string,
  role: "driver" | "passenger" | "available",
  matchAcceptance: { acceptedByViewer?: boolean; acceptedByOther?: boolean } = {},
): RideAction[] {
  if (status === "MATCHED") {
    return [
      ...(matchAcceptance.acceptedByViewer ||
      (role === "driver" && !matchAcceptance.acceptedByOther)
        ? []
        : [{ label: "Aceitar combinação", status: "CONFIRMED" as const }]),
      {
        label: matchAcceptance.acceptedByViewer ? "Retirar aceite" : "Recusar combinação",
        status: "CANCELLED",
        variant: "outline",
      },
    ];
  }

  if (status === "CONFIRMED") {
    if (role === "driver") {
      return [{ label: "Cancelar", status: "CANCELLED", variant: "outline" }];
    }
    // Passageiro já teve a carona confirmada, sem botão redundante de confirmar
    return [{ label: "Cancelar", status: "CANCELLED", variant: "outline" }];
  }

  if (status === "IN_PROGRESS") {
    return [
      { label: "Concluir viagem", status: "COMPLETED" },
      { label: "Cancelar", status: "CANCELLED", variant: "outline" },
    ];
  }

  return [];
}
