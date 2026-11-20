import { beforeEach, describe, expect, it, vi } from "vitest";
import { canSwitchCaronaaRole, isQuickRideActive } from "./role-switch-guard";

const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:mock.rpc}}));
beforeEach(()=>{vi.clearAllMocks();mock.rpc.mockResolvedValue({data:[],error:null});});
describe("role switch operational safety",()=>{
  it.each(["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS","MATCHED","CONFIRMED"])(
    "blocks an active %s F07 ride",async status=>{
      expect(isQuickRideActive(status)).toBe(true);
      expect(await canSwitchCaronaaRole({id:"ride-1",status})).toEqual({
        allowed:false,reason:"ACTIVE_RIDE",
      });
      expect(mock.rpc).not.toHaveBeenCalled();
    },
  );
  it("blocks a remotely active driver ride before switching roles",async()=>{
    mock.rpc.mockResolvedValue({data:[{role:"DRIVER",status:"SEARCHING"}],error:null});
    expect(await canSwitchCaronaaRole(null)).toEqual({allowed:false,reason:"ACTIVE_RIDE"});
  });
  it("does not block on a locally stale expired SEARCHING request",async()=>{
    const expired=new Date(Date.now()-60000).toISOString();
    mock.rpc.mockResolvedValue({data:[{status:"EXPIRED"}],error:null});
    expect(await canSwitchCaronaaRole({id:"old",status:"SEARCHING",expires_at:expired}))
      .toEqual({allowed:true});
  });
  it("allows switching after all rides have ended",async()=>{
    mock.rpc.mockResolvedValue({data:[{status:"COMPLETED"},{status:"CANCELLED"}],error:null});
    expect(await canSwitchCaronaaRole(null)).toEqual({allowed:true});
  });
  it("releases role switch for F07 closure pending administrative review",async()=>{
    expect(isQuickRideActive("PENDING_REVIEW")).toBe(false);
    mock.rpc.mockResolvedValue({data:[{role:"DRIVER",status:"PENDING_REVIEW"}],error:null});
    expect(await canSwitchCaronaaRole({id:"review-case",status:"PENDING_REVIEW"}))
      .toEqual({allowed:true});
    expect(mock.rpc).toHaveBeenCalledWith("quick_ride_my_requests");
  });
  it("fails closed for RPC errors or unexpected payloads",async()=>{
    mock.rpc.mockRejectedValue(new Error("disconnected"));
    expect(await canSwitchCaronaaRole(null)).toEqual({allowed:false,reason:"UNAVAILABLE"});
    mock.rpc.mockResolvedValue({data:{items:[]},error:null});
    expect(await canSwitchCaronaaRole(null)).toEqual({allowed:false,reason:"UNAVAILABLE"});
  });
});
