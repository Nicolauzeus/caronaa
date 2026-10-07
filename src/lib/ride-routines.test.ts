import { describe, expect, it } from "vitest";
import { routineDefinitionSchema, occurrenceDefinitionSchema, weekDays } from "./ride-routines";

const definition = {
  kind: "offer",
  origin: "Aldeota",
  destination: "UNIFOR",
  originLat: -3.735,
  originLng: -38.5,
  destinationLat: -3.77,
  destinationLng: -38.48,
  days: [1, 3, 5],
  departureTime: "07:30",
  startDate: "2030-01-01",
  endDate: null,
  seats: 2,
  timeToleranceMinutes: 15,
  totalPrice: 30,
  active: true,
};
describe("weekly routine input", () => {
  it("supports multiple weekdays with canonical ordering", () => {
    expect(routineDefinitionSchema.parse({ ...definition, days: [5, 1, 3, 1] }).days).toEqual([
      1, 3, 5,
    ]);
    expect(weekDays.map((day) => day.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("requires at least one valid weekday", () => {
    expect(routineDefinitionSchema.safeParse({ ...definition, days: [] }).success).toBe(false);
    expect(routineDefinitionSchema.safeParse({ ...definition, days: [8] }).success).toBe(false);
  });
  it("accepts deactivation without deleting the definition", () => {
    expect(routineDefinitionSchema.parse({ ...definition, active: false }).active).toBe(false);
  });
  it("validates date intervals and default seats", () => {
    expect(
      routineDefinitionSchema.safeParse({ ...definition, endDate: "2029-12-31" }).success,
    ).toBe(false);
    expect(routineDefinitionSchema.safeParse({ ...definition, seats: 0 }).success).toBe(false);
    expect(routineDefinitionSchema.safeParse({ ...definition, seats: 7 }).success).toBe(false);
  });
  it("keeps occurrence edits independent of weekly days", () => {
    const edited = occurrenceDefinitionSchema.parse({
      ...definition,
      rideDate: "2030-01-02",
      departureTime: "08:10",
      seats: 3,
    });
    expect(edited.rideDate).toBe("2030-01-02");
    expect(edited).not.toHaveProperty("days");
    expect(definition.departureTime).toBe("07:30");
  });
  it("supports passenger routines", () => {
    expect(routineDefinitionSchema.parse({ ...definition, kind: "request", seats: 1 }).kind).toBe(
      "request",
    );
  });
  it("rejects partial coordinates and accepts explicitly absent coordinates", () => {
    expect(routineDefinitionSchema.safeParse({ ...definition, originLng: null }).success).toBe(
      false,
    );
    expect(
      routineDefinitionSchema.safeParse({
        ...definition,
        originLat: null,
        originLng: null,
        destinationLat: null,
        destinationLng: null,
      }).success,
    ).toBe(true);
  });
});
