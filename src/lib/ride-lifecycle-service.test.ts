import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    rest: { context: "attached" },
    calls: [] as Array<{ name: string; args: Record<string, string> }>,
    result: { data: "AWAITING_OTHER_PARTICIPANT" as string | null, error: null as { message: string } | null },
    rpc(this: { rest: unknown; calls: Array<{ name: string; args: Record<string, string> }>; result: { data: string | null; error: { message: string } | null } }, name: string, args: Record<string, string>) {
      if (!this.rest) throw new Error("Cannot read properties of undefined (reading 'rest')");
      this.calls.push({ name, args });
      return Promise.resolve(this.result);
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockClient }));

import { transitionRideStatus } from "./ride-lifecycle-service";

describe("ride lifecycle RPC binding", () => {
  beforeEach(() => {
    mockClient.calls.length = 0;
    mockClient.result = { data: "AWAITING_OTHER_PARTICIPANT", error: null };
  });

  it("keeps the Supabase client context while accepting a proposal", async () => {
    await expect(transitionRideStatus("test-ride-1", "CONFIRMED")).resolves.toBe(
      "AWAITING_OTHER_PARTICIPANT",
    );
    expect(mockClient.calls).toEqual([
      {
        name: "respond_to_ride_match",
        args: { p_ride_id: "test-ride-1", p_response: "ACCEPT" },
      },
    ]);
  });

  it("keeps the client context when declining through the cancellation transition", async () => {
    mockClient.result = { data: "CANCELLED", error: null };

    await expect(transitionRideStatus("test-ride-2", "CANCELLED")).resolves.toBe("CANCELLED");
    expect(mockClient.calls).toEqual([
      {
        name: "transition_ride_status",
        args: { p_ride_id: "test-ride-2", p_next_status: "CANCELLED" },
      },
    ]);
  });

  it.each([
    ["permission denied", "permission denied"],
    ["Match proposal is no longer active", "Match proposal is no longer active"],
  ])("surfaces server rejection for permission/expiry (%s)", async (message, expected) => {
    mockClient.result = { data: null, error: { message } };

    await expect(transitionRideStatus("test-ride-3", "CONFIRMED")).rejects.toThrow(expected);
  });

  it("does not bypass boarding validation to start a ride", async () => {
    await expect(transitionRideStatus("test-ride-4", "IN_PROGRESS")).rejects.toThrow(
      "Valide o PIN de embarque",
    );
    expect(mockClient.calls).toHaveLength(0);
  });
});
