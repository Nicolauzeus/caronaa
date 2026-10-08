export type RideParticipantRole = "driver" | "passenger";

export type RideAcceptanceState = {
  status: string;
  role: RideParticipantRole;
  driverAcceptedAt?: string | null;
  passengerAcceptedAt?: string | null;
  responseExpiresAt?: string | null;
  now?: Date;
};

export type MatchProposalState =
  | "not-a-proposal"
  | "proposal-found"
  | "expired"
  | "awaiting-your-response"
  | "awaiting-other-participant"
  | "accepted-by-both";

export function getMatchProposalState(input: RideAcceptanceState): MatchProposalState {
  if (input.status === "CONFIRMED") return "accepted-by-both";
  if (input.status !== "MATCHED") return "not-a-proposal";
  if (
    input.responseExpiresAt &&
    new Date(input.responseExpiresAt).getTime() <= (input.now ?? new Date()).getTime()
  ) {
    return "expired";
  }

  const youAccepted =
    input.role === "driver" ? Boolean(input.driverAcceptedAt) : Boolean(input.passengerAcceptedAt);
  const otherAccepted =
    input.role === "driver" ? Boolean(input.passengerAcceptedAt) : Boolean(input.driverAcceptedAt);

  if (youAccepted && otherAccepted) return "accepted-by-both";
  if (youAccepted) return "awaiting-other-participant";
  if (otherAccepted) return "awaiting-your-response";
  return "proposal-found";
}
