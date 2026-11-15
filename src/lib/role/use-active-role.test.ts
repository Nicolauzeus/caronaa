import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMissingVehicleFields, getVehicleStatus, normalizeVehicleSeats, useActiveRole } from "./use-active-role";

const api=vi.hoisted(()=>({
  getUser:vi.fn(), from:vi.fn(),rpc:vi.fn(), update:vi.fn(),
  select:vi.fn(),ready:true,profile:null as Record<string,unknown>|null,
}));
vi.mock("@/integrations/supabase/client",()=>({
  supabase:{auth:{getUser:api.getUser},from:api.from,rpc:api.rpc},
}));

const fullProfile={
  vehicle_brand:"Honda",vehicle_description:"CG 160",vehicle_color:"Vermelha",
  vehicle_plate:"ABC1D23",vehicle_type:"moto",vehicle_seats:1,
};

function setup(profile:Record<string,unknown>|null,ready=true){
  api.profile=profile;
  api.ready=ready;
  api.getUser.mockResolvedValue({data:{user:{id:"authenticated-user"}},error:null});
  api.from.mockImplementation((table:string)=>{
    if(table!=="profiles")throw new Error("unexpected table");
    return {
      select:vi.fn(()=>({eq:vi.fn(()=>({
        maybeSingle:vi.fn(async()=>({data:api.profile,error:null})),
      }))})),
      update:api.update,
    };
  });
  api.update.mockImplementation((values:Record<string,unknown>)=>({
    eq:vi.fn(()=>({select:vi.fn(()=>({
      single:vi.fn(async()=>{
        api.profile={...api.profile,...values};
        return {data:api.profile,error:null};
      }),
    }))})),
  }));
  api.rpc.mockImplementation(async(name:string,args?:Record<string,unknown>)=>{
    if(name==="is_driver_ready")return {data:api.ready,error:null};
    if(name==="switch_user_active_role")return {data:args?.p_target_role,error:null};
    throw new Error("unexpected RPC: "+name);
  });
}
describe("useActiveRole / elegibilidade sem burocracia",()=>{
  beforeEach(()=>{vi.clearAllMocks();});

  it("starts PASSAGEIRO and requests driver readiness for authenticated user",async()=>{
    setup({...fullProfile});
    const {result}=renderHook(()=>useActiveRole());
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(api.rpc).toHaveBeenCalledWith("is_driver_ready",{p_user_id:"authenticated-user"});
    expect(result.current.vehicleStatus.isComplete).toBe(true);
    expect(result.current.isDriverEligible).toBe(true);
    expect(result.current.vehicleType).toBe("moto");
    expect(result.current.vehicleSeats).toBe(1);
  });

  it("opens vehicle modal for ANY missing field even when eligible",async()=>{
    setup({...fullProfile,vehicle_color:null},true);
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    let response:Awaited<ReturnType<typeof result.current.switchRole>>|undefined;
    await act(async()=>{response=await result.current.switchRole("MOTORISTA");});
    expect(response).toEqual({needsVehicleModal:true,missingFields:["color"]});
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(api.rpc).not.toHaveBeenCalledWith("switch_user_active_role",expect.anything());
  });

  it("reports the four missing fields separately",()=>{
    const missing=getMissingVehicleFields(getVehicleStatus(null));
    expect(missing).toEqual(["brand","model","color","plate"]);
    expect(getVehicleStatus({...fullProfile,vehicle_plate:"INVALID"}).hasPlate).toBe(false);
  });

  it("enforces motorcycle one seat and car 1..3",()=>{
    expect(normalizeVehicleSeats("moto",3)).toBe(1);
    expect(normalizeVehicleSeats("car",9)).toBe(3);
    expect(normalizeVehicleSeats("car",-4)).toBe(1);
    expect(normalizeVehicleSeats("car",2)).toBe(2);
  });

  it("switches eligible complete driver and can return to passenger",async()=>{
    setup({...fullProfile});
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    await act(async()=>{await result.current.switchRole("MOTORISTA");});
    expect(result.current.activeRole).toBe("MOTORISTA");
    await act(async()=>{await result.current.switchRole("PASSAGEIRO");});
    expect(result.current.activeRole).toBe("PASSAGEIRO");
  });

  it("saves only missing fields, forces one seat for motorcycle and activates without reload",async()=>{
    setup({...fullProfile,vehicle_color:null,vehicle_seats:3},true);
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    await act(async()=>{await result.current.saveVehicle({
      brand:"ignored existing",model:"ignored existing",color:"Preta",
      plate:"ABC1D23",vehicleType:"moto",vehicleSeats:1,
    });});
    expect(api.update).toHaveBeenCalledWith({
      vehicle_type:"moto",vehicle_seats:1,vehicle_color:"Preta",
    });
    expect(result.current.activeRole).toBe("MOTORISTA");
    expect(result.current.vehicleStatus.isComplete).toBe(true);
    expect(result.current.vehicleSeats).toBe(1);
    expect(api.rpc).toHaveBeenCalledWith("switch_user_active_role",{p_target_role:"MOTORISTA"});
  });

  it("saves car seats up to three and keeps passenger mode if not eligible",async()=>{
    setup({...fullProfile,vehicle_color:null},false);
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    await act(async()=>{
      await expect(result.current.saveVehicle({
        brand:"",model:"",color:"Prata",plate:"",vehicleType:"car",vehicleSeats:3,
      })).rejects.toThrow(/Supabase/);
    });
    expect(api.update).toHaveBeenCalledWith({
      vehicle_type:"car",vehicle_seats:3,vehicle_color:"Prata",
    });
    expect(result.current.vehicleSeats).toBe(3);
    expect(result.current.activeRole).toBe("PASSAGEIRO");
  });

  it("requests vehicle review when readiness is false, even with complete profile",async()=>{
    setup({...fullProfile},false);
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    let response:Awaited<ReturnType<typeof result.current.switchRole>>|undefined;
    await act(async()=>{response=await result.current.switchRole("MOTORISTA");});
    expect(response).toEqual({needsVehicleModal:true,missingFields:[]});
    expect(result.current.activeRole).toBe("PASSAGEIRO");
  });

  it("does not activate after saving if the server rejects readiness",async()=>{
    setup({...fullProfile,vehicle_color:null},false);
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    await act(async()=>{
      await expect(result.current.saveVehicle({brand:"",model:"",color:"Preta",plate:"",
        vehicleType:"moto",vehicleSeats:1})).rejects.toThrow(/Supabase/);
    });
    expect(result.current.activeRole).toBe("PASSAGEIRO");
    expect(api.rpc).not.toHaveBeenCalledWith("switch_user_active_role",expect.anything());
  });

  it("rejects invalid motorcycle seat count and does not write",async()=>{
    setup({...fullProfile,vehicle_color:null});
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    await expect(result.current.saveVehicle({
      brand:"",model:"",color:"Preta",plate:"",vehicleType:"moto",vehicleSeats:3,
    })).rejects.toThrow("Quantidade de vagas inválida");
    expect(api.update).not.toHaveBeenCalled();
  });

  it("does not pretend eligibility when the readiness RPC is missing",async()=>{
    setup({...fullProfile});
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="is_driver_ready")return {data:null,error:{code:"PGRST202"}};
      return {data:null,error:null};
    });
    const {result}=renderHook(()=>useActiveRole());
    await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(result.current.isDriverEligible).toBe(false);
    expect(result.current.error).toMatch(/RPC|perfil/i);
  });
});
