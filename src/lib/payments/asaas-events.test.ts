import { describe, expect, it } from "vitest";
import { classifyAsaasPaymentEvent, validWebhookToken } from "./asaas-events";

const event = {
  id: "evt_1", event: "PAYMENT_RECEIVED",
  payment: { id: "pay_123", status: "RECEIVED", value: 21, externalReference: "reservation-1" },
};
describe("Asaas webhook event classification", () => {
  it("classifies confirmed receipt without claiming split settlement", () => {
    expect(classifyAsaasPaymentEvent(event)).toEqual({
      type: "PAYMENT_RECEIVED", eventId: "evt_1", paymentId: "pay_123",
      reference: "reservation-1", amountCents: 2100,
    });
  });
  it("requires split ID for settlement", () => {
    expect(classifyAsaasPaymentEvent({ ...event, event: "PAYMENT_SPLIT_DONE" }).type).toBe("IGNORE");
    expect(classifyAsaasPaymentEvent({
      ...event, event: "PAYMENT_SPLIT_DONE", additionalInfo: { splitId: "split_1" },
    }).type).toBe("SPLIT_SETTLED");
  });
  it("rejects an unauthenticated webhook", () => {
    expect(validWebhookToken("invalid", "a".repeat(32))).toBe(false);
    expect(validWebhookToken("a".repeat(32), "a".repeat(32))).toBe(true);
  });
});
