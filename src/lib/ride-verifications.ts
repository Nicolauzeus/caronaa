import type { UserVerification } from "@/lib/user-verifications";

export type RideVerification = Pick<UserVerification, "type" | "status">;

export function normalizeRideVerification(value: unknown): RideVerification | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (row["status"] !== "VERIFIED") return null;
  if (row["type"] !== "UNIFOR" && row["type"] !== "STS_2026") return null;
  return { type: row["type"], status: "VERIFIED" };
}
