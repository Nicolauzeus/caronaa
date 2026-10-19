import { beforeEach,describe,expect,it,vi } from "vitest";
import { getMyResearchLaunchState, getResearchLaunchAdminState, setResearchLaunchReleased } from "./research-launch";

const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:api.rpc}}));
describe("Reusable institutional launch gate",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("returns a read-only preview for a linked UNIFOR participant",async()=>{
  api.rpc.mockResolvedValue({error:null,data:{
   locked:true,formId:"8eaec446-057b-430a-9ccf-3b3652cb9618",
   formCode:"0K9K09K",institution:"UNIFOR",nature:"EDUCACAO",
   launchAt:"2026-11-04T03:00:00Z",
   preview:{kind:"OFERTA",scheduledDate:"2026-11-04",
    origin:"Fortaleza",destination:"UNIFOR",departureTime:"07:00",status:"VISUALIZACAO"}
  }});
  const state=await getMyResearchLaunchState();
  expect(state).toMatchObject({locked:true,institution:"UNIFOR",preview:{kind:"OFERTA",status:"VISUALIZACAO"}});
  expect(api.rpc).toHaveBeenCalledWith("get_my_research_launch_state");
 });
 it("works for another organization without any hard-coded UNIFOR fallback",async()=>{
  api.rpc.mockResolvedValue({error:null,data:{locked:true,formId:"new-form-id",
   formCode:"EVENTO-27",institution:"Evento de lançamento",nature:"EVENTO",
   launchAt:"2027-02-01T03:00:00Z",preview:null}});
  expect(await getMyResearchLaunchState()).toMatchObject({
   locked:true,institution:"Evento de lançamento",formCode:"EVENTO-27",preview:null
  });
 });
 it("cannot advertise an unsafe active ride as a planned preview",async()=>{
  api.rpc.mockResolvedValue({error:null,data:{locked:true,formId:"x",formCode:"X",launchAt:"2027-02-01T03:00:00Z",
   preview:{kind:"OFERTA",status:"MATCHED",scheduledDate:"2027-02-01"}}});
  expect((await getMyResearchLaunchState()).preview).toBeNull();
 });
 it("keeps unrestricted accounts out of the waiting experience",async()=>{
  api.rpc.mockResolvedValue({error:null,data:{locked:false}});
  expect(await getMyResearchLaunchState()).toEqual({locked:false,preview:null});
 });
 it("fails closed when the gateway is unavailable or malformed",async()=>{
  api.rpc.mockResolvedValueOnce({error:{message:"offline"},data:null})
   .mockResolvedValueOnce({error:null,data:{locked:true,formId:"X"}});
  await expect(getMyResearchLaunchState()).rejects.toThrow(/verificar o acesso/);
  await expect(getMyResearchLaunchState()).rejects.toThrow(/incompleta/);
 });
 it("keeps early release behind a dedicated administrator RPC",async()=>{
  api.rpc.mockResolvedValueOnce({error:null,data:{launchDate:"2026-11-04",released:false,linkedUsers:2}})
   .mockResolvedValueOnce({error:null,data:{released:true}});
  expect(await getResearchLaunchAdminState("form-id")).toMatchObject({released:false,linkedUsers:2});
  await expect(setResearchLaunchReleased("form-id",true)).resolves.toBeUndefined();
  expect(api.rpc).toHaveBeenNthCalledWith(2,"set_research_launch_release",{p_form_id:"form-id",p_released:true});
 });
});
