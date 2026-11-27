import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({supabase:{}}));
import { createOperationsService, funnelSchema, overviewSchema } from "@/services/operations-service";
const period={from:"2025-01-15",to:"2025-01-15",service:"flash" as const};
const valid={...period,rows:[{service:"flash",quotes_issued:3,quotes_with_request:2,quotes_with_acceptance:2,quotes_with_completion:2,request_pct:66.67,completion_pct:66.67}],notes:{}};
describe("operational flow contracts",()=>{
 it("preserves quote units and explicit scope",async()=>{
  const rpc=vi.fn(async()=>({data:valid,error:null}));
  const service=createOperationsService({rpc});
  expect((await service.getFunnel(period)).rows[0].quotes_with_completion).toBe(2);
  expect(rpc).toHaveBeenCalledWith("admin_operational_quote_funnel",{p_from:period.from,p_to:period.to,p_service:"flash"});
 });
 it("rejects impossible funnel counts",()=>{
  expect(funnelSchema.safeParse({...valid,rows:[{...valid.rows[0],quotes_with_completion:4}]}).success).toBe(false);
 });
 it("rejects partial overview rather than silently substituting zero",async()=>{
  const rpc=vi.fn(async()=>({data:{funnel:valid},error:null}));
  const service=createOperationsService({rpc});
  await expect(service.getOverview(period)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
  expect(overviewSchema.safeParse({funnel:valid}).success).toBe(false);
 });
});
