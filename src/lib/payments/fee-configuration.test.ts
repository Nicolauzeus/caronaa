import { describe, expect, it } from "vitest";
import { readVerifiedPixFee } from "./fee-configuration";
const now = new Date("2026-10-15T04:00:00Z");
const env = {
  ASAAS_ENV:"sandbox",
  ASAAS_VERIFIED_PIX_FEE_CENTS:"199",
  ASAAS_FEE_VERIFIED_AT:"2026-10-14T18:00:00Z",
};
describe("trusted Asaas fee configuration",()=>{
  it("accepts recent account-verified fee in cents",()=>{
    expect(readVerifiedPixFee(env,now)).toEqual({feeCents:199,verifiedAt:env.ASAAS_FEE_VERIFIED_AT});
  });
  it("rejects undefined, stale, decimal or future-dated fees",()=>{
    for(const patch of [
      {ASAAS_ENV:"production"},
      {ASAAS_VERIFIED_PIX_FEE_CENTS:""},
      {ASAAS_VERIFIED_PIX_FEE_CENTS:"1.99"},
      {ASAAS_VERIFIED_PIX_FEE_CENTS:"-1"},
      {ASAAS_FEE_VERIFIED_AT:"2026-09-15T00:00:00Z"},
      {ASAAS_FEE_VERIFIED_AT:"2026-10-16T00:00:00Z"},
    ]) expect(()=>readVerifiedPixFee({...env,...patch},now)).toThrow();
  });
});
