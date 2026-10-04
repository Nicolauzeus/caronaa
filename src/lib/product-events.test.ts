import { describe, expect, it } from "vitest";
import { productEventForRide, productEventNames } from "./product-events";

describe("product event semantics", () => {
  it("exposes every lifecycle event required for the product funnel", () => {
    expect(productEventNames).toEqual(expect.arrayContaining([
      "USER_REGISTERED", "RIDE_REQUEST_CREATED", "RIDE_OFFER_CREATED", "MATCH_CREATED",
      "RIDE_STARTED", "RIDE_COMPLETED", "PAYMENT_COMPLETED", "RIDE_REPEATED",
    ]));
  });

  it("marks a subsequent offer or request as repeated", () => {
    expect(productEventForRide("offer", false)).toBe("RIDE_OFFER_CREATED");
    expect(productEventForRide("request", true)).toBe("RIDE_REPEATED");
  });
});
