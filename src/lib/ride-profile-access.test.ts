import { describe, expect, it } from "vitest";
import { canViewRideCounterpartProfile } from "./ride-profile-access";

describe("ride participant profile access", () => {
  const people = { passengerId: "passenger", driverId: "driver" };

  it("lets a passenger view only the driver from their ride", () => {
    expect(
      canViewRideCounterpartProfile({ ...people, callerId: "passenger", targetId: "driver" }),
    ).toBe(true);
    expect(
      canViewRideCounterpartProfile({ ...people, callerId: "passenger", targetId: "passenger" }),
    ).toBe(false);
  });

  it("lets a driver view only the passenger from their ride", () => {
    expect(
      canViewRideCounterpartProfile({ ...people, callerId: "driver", targetId: "passenger" }),
    ).toBe(true);
    expect(
      canViewRideCounterpartProfile({ ...people, callerId: "driver", targetId: "driver" }),
    ).toBe(false);
  });

  it("denies profiles to anyone outside the ride", () => {
    expect(
      canViewRideCounterpartProfile({ ...people, callerId: "outsider", targetId: "driver" }),
    ).toBe(false);
  });
});
