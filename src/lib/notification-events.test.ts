import { describe, expect, it, afterEach } from "vitest";
import { createRideAlert, readRideAlerts, REALTIME_SCOPES } from "./notification-events";
import { NOTIFICATION_NOTES, playNotificationSound } from "./notification-sound";
import { NOTIFICATION_CONFIG_KEY, readNotificationSettings } from "./notification-settings";

const participants = {
  ride_id: "ride",
  match_id: "match",
  driver_user_id: "driver",
  passenger_user_id: "passenger",
};
afterEach(() => localStorage.clear());

describe("notification preferences and sounds", () => {
  it("defaults to sound on and push off", () => {
    expect(readNotificationSettings()).toEqual({ soundEnabled: true, pushEnabled: false });
  });
  it("reads the saved preference and tolerates malformed data", async () => {
    localStorage.setItem(
      NOTIFICATION_CONFIG_KEY,
      JSON.stringify({ soundEnabled: false, pushEnabled: true }),
    );
    expect(readNotificationSettings()).toEqual({ soundEnabled: false, pushEnabled: true });
    await expect(playNotificationSound("request")).resolves.toBeUndefined();
    localStorage.setItem(NOTIFICATION_CONFIG_KEY, "broken");
    expect(readNotificationSettings().soundEnabled).toBe(true);
    localStorage.setItem(NOTIFICATION_CONFIG_KEY, '{"soundEnabled":"false"}');
    expect(readNotificationSettings().soundEnabled).toBe(true);
  });
  it("defines all requested synthesized tones", () => {
    expect(NOTIFICATION_NOTES).toEqual({
      request: [520, 650],
      confirmed: [523, 659, 783],
      cancelled: [440, 349],
      message: [800],
    });
  });
  it("does not fail when Web Audio is unavailable", async () => {
    await expect(playNotificationSound("confirmed")).resolves.toBeUndefined();
  });
});

describe("account-scoped ride notifications", () => {
  it("filters every table by its actual ownership columns", () => {
    expect(REALTIME_SCOPES).toEqual([
      ["ride_requests", "user_id"],
      ["ride_offers", "user_id"],
      ["rides", "driver_user_id"],
      ["rides", "passenger_user_id"],
      ["ride_notifications", "user_id"],
      ["ride_matches", "driver_user_id"],
      ["ride_matches", "passenger_user_id"],
    ]);
  });
  it("notifies the driver of a matched request and the passenger of their match", () => {
    expect(createRideAlert("ride_matches", "INSERT", participants, {}, "driver")?.title).toBe(
      "Nova solicitação de carona",
    );
    expect(createRideAlert("ride_matches", "INSERT", participants, {}, "passenger")?.title).toBe(
      "Carona encontrada",
    );
  });
  it("notifies each participant when the ride starts", () => {
    for (const userId of ["driver", "passenger"]) {
      expect(
        createRideAlert(
          "rides",
          "UPDATE",
          { ...participants, status: "IN_PROGRESS" },
          { status: "CONFIRMED" },
          userId,
        ),
      ).not.toBeNull();
    }
  });
  it.each([
    "PASSENGER_ACCEPTED",
    "RIDE_CONFIRMED",
    "PROPOSAL_EXPIRED",
    "RIDE_CANCELLED",
    "RIDE_COMPLETED",
  ])("maps persisted event %s to one account-scoped alert", (eventName) => {
    const alert = createRideAlert(
      "ride_notifications",
      "INSERT",
      {
        ...participants,
        notification_id: "notification",
        user_id: "driver",
        event_name: eventName,
      },
      {},
      "driver",
    );
    expect(alert).not.toBeNull();
    expect(alert?.notificationId).toBe("notification");
    expect(alert?.rideId).toBe("ride");
    expect(
      createRideAlert(
        "ride_notifications",
        "INSERT",
        {
          ...participants,
          notification_id: "notification",
          user_id: "driver",
          event_name: eventName,
        },
        {},
        "outsider",
      ),
    ).toBeNull();
  });
  it.each(["CONFIRMED", "CANCELLED", "COMPLETED"])(
    "leaves persisted lifecycle notice %s to the notification row and avoids duplicate alerts",
    (status) => {
      for (const userId of ["driver", "passenger"]) {
        const alert = createRideAlert(
          "rides",
          "UPDATE",
          { ...participants, status },
          { status: "MATCHED" },
          userId,
        );
        expect(alert).toBeNull();
      }
    },
  );
  it("ignores outsiders, unchanged states, deletes and match metadata updates", () => {
    expect(
      createRideAlert("rides", "UPDATE", { ...participants, status: "CONFIRMED" }, {}, "outsider"),
    ).toBeNull();
    expect(
      createRideAlert(
        "rides",
        "UPDATE",
        { ...participants, status: "CONFIRMED" },
        { status: "CONFIRMED" },
        "driver",
      ),
    ).toBeNull();
    expect(createRideAlert("rides", "DELETE", participants, {}, "driver")).toBeNull();
    expect(createRideAlert("ride_matches", "UPDATE", participants, {}, "driver")).toBeNull();
    expect(
      createRideAlert("ride_offers", "UPDATE", { user_id: "driver" }, {}, "driver"),
    ).toBeNull();
  });
  it("uses a stable id for replay deduplication and never stores PIN/GPS", () => {
    const row = { ...participants, status: "IN_PROGRESS", pin: "secret", latitude: 12 };
    const first = createRideAlert("rides", "UPDATE", row, { status: "CONFIRMED" }, "driver");
    expect(createRideAlert("rides", "UPDATE", row, { status: "CONFIRMED" }, "driver")?.id).toBe(
      first?.id,
    );
    expect(JSON.stringify(first)).not.toContain("secret");
    expect(first).not.toHaveProperty("latitude");
  });
  it("restores a bounded inbox without exposing another account", () => {
    const alert = createRideAlert(
      "rides",
      "UPDATE",
      { ...participants, status: "IN_PROGRESS" },
      { status: "CONFIRMED" },
      "driver",
    )!;
    localStorage.setItem(
      "caronaa-alerts:driver",
      JSON.stringify(Array.from({ length: 60 }, (_, index) => ({ ...alert, id: String(index) }))),
    );
    expect(readRideAlerts("driver")).toHaveLength(50);
    expect(readRideAlerts("passenger")).toEqual([]);
    localStorage.setItem("caronaa-alerts:driver", '[{"id":"invalid"}]');
    expect(readRideAlerts("driver")).toEqual([]);
  });
});
