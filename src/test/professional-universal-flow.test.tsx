import type { ComponentType } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api=vi.hoisted(()=>({
  navigate:vi.fn(), rpc:vi.fn(), query:vi.fn(), authCheck:vi.fn(), upload:vi.fn(),
  authorized:false,
  auth:{user:null,loading:false} as {user:null|{id:string;email_confirmed_at:string;user_metadata:Record<string,string>};loading:boolean},
}));
vi.mock("@tanstack/react-router",async original=>({
  ...await original<typeof import("@tanstack/react-router")>(),
  useNavigate:()=>api.navigate,
}));
vi.mock("@/lib/auth-context",()=>({useAuth:()=>api.auth}));
vi.mock("@/components/caronaa/BrandElements",()=>({BrandLogo:()=> <span>CARONAA</span>}));
vi.mock("@/components/caronaa/MunicipalitySelect",()=>({
  MunicipalitySelect:({value,onChange}:{value:string;onChange:(v:string)=>void})=>
    <div><span>Município: {value}</span><button type="button" onClick={()=>onChange("Fortaleza")}>Escolher Fortaleza</button></div>,
}));
vi.mock("@/integrations/supabase/client",()=>({
  supabase:{
    from:(table:string)=>({
      select:()=>({eq:()=>({maybeSingle:()=>api.query(table)})}),
      update:()=>({eq:()=>Promise.resolve({error:null})}),
    }),
    rpc:api.rpc,
    auth:{getUser:api.authCheck},
    storage:{from:()=>({
      upload:api.upload,
      getPublicUrl:()=>({data:{publicUrl:"https://example.com/avatars/driver-1/photo.jpg"}}),
    })},
  },
}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));

import { Route } from "@/routes/cadastro-motorista";
const Page=Route.options.component as ComponentType;
const completeProfile={
  full_name:"Motorista Exemplo",
  avatar_url:"https://example.com/avatars/driver-1/photo.jpg",
  city:"Fortaleza", vehicle_type:"moto",vehicle_brand:"Honda",
  vehicle_description:"CG 160",vehicle_color:"Preto",vehicle_plate:"ABC1D23",vehicle_seats:1,
};
beforeEach(()=>{
  vi.clearAllMocks(); api.authorized=false;
  api.auth={user:{id:"driver-1",email_confirmed_at:"2026-11-19T10:00:00Z",user_metadata:{full_name:"Motorista Exemplo"}},loading:false};
  api.query.mockImplementation(async(table:string)=>({data:table==="profiles"?completeProfile:null,error:null}));
  api.rpc.mockImplementation(async(name:string)=>{
    if(name==="get_my_professional_access")return {data:{authorized:api.authorized,request:null},error:null};
    if(name==="get_my_caronaa_whatsapp")return {data:{whatsapp:null,contact_consent:false},error:null};
    if(name==="complete_professional_driver_registration"){api.authorized=true;return {data:"registration-1",error:null};}
    throw Error("Unexpected RPC: "+name);
  });
  api.authCheck.mockImplementation(async()=>({data:{user:api.auth.user},error:null}));
  api.navigate.mockResolvedValue(undefined);
  api.upload.mockResolvedValue({error:null});
});
afterEach(cleanup);
async function fillContact(){
  await screen.findByRole("heading",{name:"Contato e município"});
  fireEvent.change(screen.getByLabelText(/WhatsApp com DDD/),{target:{value:"85999999999"}});
  fireEvent.click(screen.getByRole("button",{name:"Escolher Fortaleza"}));
  fireEvent.click(screen.getByRole("button",{name:/Continuar/i}));
}
describe("Cadastro universal do motorista: quatro etapas",()=>{
  it("does not ask for another account and shows current step, next step and percentage",async()=>{
    render(<Page/>);
    await screen.findByRole("heading",{name:"Contato e município"});
    expect(screen.getByText("Etapa 1 de 4")).toBeInTheDocument();
    expect(screen.getByText("25% concluído")).toBeInTheDocument();
    expect(screen.getByText(/Próxima: Dados do veículo/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).toBeNull();
  });
  it("prefills old account WhatsApp when the professional contact row is empty",async()=>{
    api.rpc.mockImplementation(async(name:string)=>{
      if(name==="get_my_professional_access")return {data:{authorized:false,request:null},error:null};
      if(name==="get_my_caronaa_whatsapp")return {data:{whatsapp:"+5585999991234",contact_consent:false},error:null};
      return {data:[],error:null};
    });
    render(<Page/>);
    const field=await screen.findByLabelText(/WhatsApp com DDD/);
    await waitFor(()=>expect(field).toHaveValue("+5585999991234"));
  });
  it("allows proceeding without WhatsApp when the professional municipality is chosen",async()=>{
    render(<Page/>);
    await screen.findByRole("heading",{name:"Contato e município"});
    fireEvent.click(screen.getByRole("button",{name:"Escolher Fortaleza"}));
    fireEvent.click(screen.getByRole("button",{name:/Continuar/i}));
    expect(await screen.findByRole("heading",{name:"Dados do veículo"})).toBeInTheDocument();
    expect(api.rpc).not.toHaveBeenCalledWith("complete_professional_driver_registration",expect.anything());
  });
  it("reuses stored vehicle and moves from the review to the cockpit only after server authorization",async()=>{
    render(<Page/>);
    await fillContact();
    expect(await screen.findByRole("heading",{name:"Dados do veículo"})).toBeInTheDocument();
    expect(screen.getByText("50% concluído")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Continuar/i}));
    await screen.findByRole("heading",{name:"Identificação"});
    fireEvent.click(screen.getByRole("button",{name:/Continuar/i}));
    await screen.findByRole("heading",{name:"Revisão final"});
    expect(screen.getByText("100% concluído")).toBeInTheDocument();
    expect(screen.getByText("Última etapa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Concluir e ver corridas/i}));
    await waitFor(()=>expect(api.navigate).toHaveBeenCalledWith({to:"/disponibilidade-profissional",replace:true}));
    expect(api.rpc).toHaveBeenCalledWith("complete_professional_driver_registration",expect.objectContaining({
      p_whatsapp:"+5585999999999",p_municipality:"Fortaleza",
      p_vehicle_type:"MOTO",p_vehicle_plate:"ABC1D23",p_registration_number:null,
    }));
    expect(api.rpc).not.toHaveBeenCalledWith("set_professional_presence",expect.anything());
  });
  it("does not bypass the server check when authorization is not confirmed",async()=>{
    api.rpc.mockImplementation(async(name:string)=>name==="get_my_professional_access"
      ?{data:{authorized:false,request:null},error:null}:{data:"registration-1",error:null});
    render(<Page/>);
    await fillContact();
    fireEvent.click(screen.getByRole("button",{name:/Continuar/i}));
    await screen.findByRole("heading",{name:"Identificação"});
    fireEvent.change(screen.getByLabelText(/Matrícula \/ registro do mototaxista/),{target:{value:"MTX100"}});
    fireEvent.click(screen.getByRole("button",{name:/Continuar/i}));
    await screen.findByRole("heading",{name:"Revisão final"});
    fireEvent.click(screen.getByRole("button",{name:/Concluir e ver corridas/i}));
    expect(await screen.findByText(/O servidor ainda não confirmou a habilitação/)).toBeInTheDocument();
    expect(api.navigate).not.toHaveBeenCalled();
  });
  it("sends unconfirmed accounts to the universal authentication",async()=>{
    api.auth={user:null,loading:false};
    render(<Page/>);
    await waitFor(()=>expect(api.navigate).toHaveBeenCalledWith({
      to:"/auth",search:{mode:"cadastro",redirect:"/cadastro-motorista"},replace:true,
    }));
  });
});
