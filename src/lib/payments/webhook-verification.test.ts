import { describe, expect, it } from "vitest";
import { verifyAsaasWebhookPayment } from "./webhook-verification";
const checkout = {
  id:"6f977149-afe8-4b62-b920-664e4c46cfdc",
  asaasPaymentId:"pay_123456789",passengerTotalCents:10199,
  driverFixedCents:8500,platformTargetNetCents:1500,
};
const webhook = {
  id:"evt_1",event:"PAYMENT_RECEIVED",
  payment:{id:checkout.asaasPaymentId, status:"RECEIVED", value:101.99, externalReference:checkout.id},
};
const provider = {id:checkout.asaasPaymentId,status:"RECEIVED",value:101.99,netValue:100,externalReference:checkout.id};
describe("verified Asaas webhooks",()=>{
  it("reconciles correctly when the real fee is the disclosed fee",()=>{
    expect(verifyAsaasWebhookPayment(webhook,provider,checkout)).toMatchObject({
      netCents:10000,reconciliation:"MATCHED",providerStatus:"RECEIVED",
    });
  });
  it("does not silently guarantee commission on fee differences",()=>{
    expect(verifyAsaasWebhookPayment(webhook,{...provider,netValue:99.90},checkout))
      .toMatchObject({reconciliation:"DIVERGENT",netCents:9990});
  });
  it("rejects forged provider data, references, or amounts",()=>{
    expect(()=>verifyAsaasWebhookPayment(webhook,{...provider,id:"pay_other"},checkout)).toThrow();
    expect(()=>verifyAsaasWebhookPayment(webhook,{...provider,externalReference:"other"},checkout)).toThrow();
    expect(()=>verifyAsaasWebhookPayment(webhook,{...provider,value:100},checkout)).toThrow();
    expect(()=>verifyAsaasWebhookPayment(webhook,{...provider,status:"PENDING"},checkout)).toThrow();
  });
  it("does not mark a QR scan as a paid event",()=>{
    expect(verifyAsaasWebhookPayment({...webhook,event:"PAYMENT_CREATED"},provider,checkout)).toBeNull();
  });
});
