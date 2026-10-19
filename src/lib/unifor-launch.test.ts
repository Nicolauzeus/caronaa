import { describe,expect,it,beforeEach,vi } from "vitest";
import { getMyUniforLaunchState,isUniforPilotForm,UNIFOR_FORM_ID,UNIFOR_LAUNCH_ISO } from "@/lib/unifor-launch";

const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));

describe("UNIFOR pilot launch gate",()=>{
 beforeEach(()=>{vi.clearAllMocks()});
 it("only recognises the immutable pilot form UUID",()=>{
   expect(isUniforPilotForm(UNIFOR_FORM_ID)).toBe(true);
   expect(isUniforPilotForm("UNIFOR")).toBe(false);
   expect(isUniforPilotForm("another-form-id")).toBe(false);
   expect(Date.parse(UNIFOR_LAUNCH_ISO)).toBe(Date.parse("2026-11-04T03:00:00Z"));
 });
 it("shows a read-only passenger request preview while locked",async()=>{
   api.rpc.mockResolvedValue({data:{locked:true,launchAt:UNIFOR_LAUNCH_ISO,preview:{
     kind:"PEDIDO",scheduledDate:"2026-11-04",origin:"Maracanaú",
     destination:"Fortaleza",departureTime:"07:00",status:"VISUALIZACAO"
   }},error:null});
   expect(await getMyUniforLaunchState()).toMatchObject({
     locked:true,preview:{kind:"PEDIDO",status:"VISUALIZACAO"}
   });
   expect(api.rpc).toHaveBeenCalledWith("get_my_unifor_launch_state");
 });
 it("does not fabricate bookings or accept other ride statuses",async()=>{
   api.rpc.mockResolvedValue({data:{locked:true,preview:{
     kind:"OFERTA",status:"MATCHED",scheduledDate:"2026-11-04"
   }},error:null});
   expect((await getMyUniforLaunchState()).preview).toBeNull();
 });
 it("keeps other users unlocked without a pilot preview",async()=>{
   api.rpc.mockResolvedValue({data:{locked:false,preview:null},error:null});
   expect(await getMyUniforLaunchState()).toMatchObject({locked:false,preview:null});
 });
 it("does not allow silent access when the server gate cannot be checked",async()=>{
   api.rpc.mockResolvedValue({data:null,error:{message:"connection unavailable"}});
   await expect(getMyUniforLaunchState()).rejects.toThrow(/verificar a abertura/);
 });
});
