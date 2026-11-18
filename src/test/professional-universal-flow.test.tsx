import type { ComponentType, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  navigate: vi.fn(),
  readOnboarding: vi.fn(),
  rpc: vi.fn(),
  query: vi.fn(),
  auth: {user:null,loading:false} as {
    user: null | { id:string; email:string; email_confirmed_at:string; user_metadata:Record<string,string> };
    loading:boolean;
  },
}));

vi.mock("@tanstack/react-router", async original => ({
  ...await original<typeof import("@tanstack/react-router")>(),
  useNavigate: () => api.navigate,
  Link: ({to,children,className}: {to:string;children:ReactNode;className?:string}) =>
    <a href={to} className={className}>{children}</a>,
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => api.auth }));
vi.mock("@/lib/onboarding/progressive-onboarding", () => ({readOnboarding: api.readOnboarding}));
vi.mock("@/components/caronaa/BrandElements", () => ({BrandLogo: () => <span>CARONAA</span>}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table:string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => api.query(table),
        }),
      }),
    }),
    rpc: api.rpc,
  },
}));
vi.mock("sonner", () => ({toast: {success:vi.fn(),error:vi.fn()}}));

const validDriverProfile = {
  full_name:"Motorista Exemplo",
  avatar_url:"https://storage.example.com/storage/v1/object/public/avatars/driver-1/portrait.jpg",
  vehicle_brand:"Honda",vehicle_description:"CG 160",vehicle_color:"Preto",
  vehicle_plate:"ABC1D23",vehicle_type:"moto",vehicle_seats:1,
};

import { Route } from "@/routes/cadastro-motorista";
const ProfessionalPage = Route.options.component as ComponentType;

beforeEach(() => {
  vi.clearAllMocks();
  api.auth = {user:null,loading:false};
  api.readOnboarding.mockResolvedValue({status:"BASIC_COMPLETED"});
  api.query.mockImplementation(async (table:string) => ({
    data: table === "profiles"
      ? validDriverProfile
      : null,
    error: null,
  }));
  api.rpc.mockResolvedValue({data:{authorized:false,request:null},error:null});
});
afterEach(cleanup);

describe("Fluxo universal para candidatos a mototaxista", () => {
  it("sends visitors to universal signup without showing a second sign-in or password form", async () => {
    render(<ProfessionalPage/>);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({
      to:"/auth",search:{mode:"cadastro",redirect:"/cadastro-motorista"},replace:true,
    }));
    expect(screen.queryByLabelText(/senha/i)).toBeNull();
    expect(screen.queryByRole("button",{name:/criar minha conta/i})).toBeNull();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("requires universal onboarding before professional details", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    api.readOnboarding.mockResolvedValue(null);
    render(<ProfessionalPage/>);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({
      to:"/onboarding",search:{redirect:"/cadastro-motorista"},replace:true,
    }));
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it("redirects incomplete vehicle records before the professional form opens", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    api.query.mockImplementation(async (table:string) => ({
      data:table==="profiles"?{...validDriverProfile,vehicle_description:null,vehicle_plate:null}:null,
      error:null,
    }));
    render(<ProfessionalPage/>);
    await waitFor(()=>expect(api.navigate).toHaveBeenCalledWith({
      to:"/cadastro-veiculo",search:{redirect:"/cadastro-motorista"},replace:true,
    }));
    expect(screen.queryByRole("button",{name:/Confirmar dados e ver corridas/i})).toBeNull();
  });

  it("reuses the confirmed account and pre-fills the name, without asking for credentials", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    render(<ProfessionalPage/>);
    await screen.findByRole("heading",{name:"Confirme seus dados"});
    expect(screen.getByDisplayValue("Motorista")).toBeTruthy();
    expect(screen.getByDisplayValue("Exemplo")).toBeTruthy();
    expect(screen.queryByText(/Conta universal:/i)).toBeNull();
    expect(screen.queryByLabelText(/senha/i)).toBeNull();
    expect(screen.queryByRole("button",{name:/Criar minha conta/i})).toBeNull();
    expect(api.rpc).toHaveBeenCalledWith("get_my_professional_access");
  });
  it("prevents incomplete registration and lists exact missing requirements", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    render(<ProfessionalPage/>);
    fireEvent.click(await screen.findByRole("button",{name:/Confirmar dados e ver corridas/i}));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Faltam 3 dados obrigatórios/i));
    expect(screen.getAllByText(/Selecione a região de atuação/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/WhatsApp com DDD/i)).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalledWith("submit_simple_mototaxi_access", expect.anything());
    expect(api.navigate).not.toHaveBeenCalledWith({to:"/disponibilidade-profissional",replace:true});
  });

  it("confirms complete details and requires server authorization before entering the ride cockpit", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    api.query.mockImplementation(async (table:string) => ({data:table==="profiles"
      ? validDriverProfile
      : {first_name:"Motorista",last_name:"Exemplo",whatsapp_e164:"+5585999999999",region_code:"MACICO_BATURITE",registration_number:"AB123CD"},error:null}));
    let authorized = false;
    api.rpc.mockImplementation(async (method:string) => {
      if (method==="submit_simple_mototaxi_access") {
        authorized = true; return {data:"request-1",error:null};
      }
      if (method==="get_my_professional_access") return {
        data:{authorized,request:{status:authorized?"APPROVED":"PENDING"}},error:null,
      };
      return {data:null,error:null};
    });
    render(<ProfessionalPage/>);
    fireEvent.click(await screen.findByRole("button",{name:/Confirmar dados e ver corridas/i}));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({to:"/disponibilidade-profissional",replace:true}));
    expect(api.rpc).toHaveBeenCalledWith("submit_simple_mototaxi_access",{
      p_first_name:"Motorista",p_last_name:"Exemplo",p_whatsapp:"+5585999999999",
      p_region:"MACICO_BATURITE",p_registration_number:"AB123CD",
    });
    expect(screen.queryByText("Solicitar acesso ao radar")).toBeNull();
    expect(screen.queryByText(/Conta universal:/i)).toBeNull();
  });

  it("shows server-side missing-photo feedback instead of entering the cockpit", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    api.query.mockImplementation(async (table:string) => ({data:table==="profiles"
      ? validDriverProfile
      : {first_name:"Motorista",last_name:"Exemplo",whatsapp_e164:"+5585999999999",region_code:"MACICO_BATURITE",registration_number:"AB123CD"},error:null}));
    api.rpc.mockImplementation(async (method:string) => method==="submit_simple_mototaxi_access"
      ? {data:null,error:{message:"Dados pendentes: PHOTO"}}
      : {data:{authorized:false,request:null},error:null});
    render(<ProfessionalPage/>);
    fireEvent.click(await screen.findByRole("button",{name:/Confirmar dados e ver corridas/i}));
    await waitFor(() => expect(screen.getAllByText(/Adicione uma foto pessoal válida, armazenada no CARONAA/i).length).toBeGreaterThan(0));
    expect(api.navigate).not.toHaveBeenCalledWith({to:"/disponibilidade-profissional",replace:true});
  });

  it("never enters the ride cockpit unless the second server authorization check is true", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    api.query.mockImplementation(async (table:string) => ({data:table==="profiles"
      ? validDriverProfile
      : {first_name:"Motorista",last_name:"Exemplo",whatsapp_e164:"+5585999999999",region_code:"MACICO_BATURITE",registration_number:"AB123CD"},error:null}));
    api.rpc.mockImplementation(async (method:string) =>
      method==="get_my_professional_access"
        ? {data:{authorized:false,request:{status:"PENDING"}},error:null}
        : {data:"request-1",error:null});
    render(<ProfessionalPage/>);
    fireEvent.click(await screen.findByRole("button",{name:/Confirmar dados e ver corridas/i}));
    await waitFor(() => expect(screen.getByText(/habilitação não foi confirmada pelo servidor/i)).toBeTruthy());
    expect(api.navigate).not.toHaveBeenCalledWith({to:"/disponibilidade-profissional",replace:true});
  });

});
