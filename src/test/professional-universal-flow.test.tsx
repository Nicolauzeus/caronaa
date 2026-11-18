import type { ComponentType, ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

import { Route } from "@/routes/cadastro-motorista";
const ProfessionalPage = Route.options.component as ComponentType;

beforeEach(() => {
  vi.clearAllMocks();
  api.auth = {user:null,loading:false};
  api.readOnboarding.mockResolvedValue({status:"BASIC_COMPLETED"});
  api.query.mockImplementation(async (table:string) => ({
    data: table === "profiles"
      ? {full_name:"Motorista Exemplo",avatar_url:null,vehicle_plate:null}
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

  it("reuses the confirmed account and pre-fills the name, without asking for credentials", async () => {
    api.auth.user={id:"driver-1",email:"teste@example.com",
      email_confirmed_at:"2026-11-17T18:00:00Z",
      user_metadata:{full_name:"Motorista Exemplo"}};
    render(<ProfessionalPage/>);
    await screen.findByRole("heading",{name:"Seus dados profissionais"});
    expect(screen.getByDisplayValue("Motorista")).toBeTruthy();
    expect(screen.getByDisplayValue("Exemplo")).toBeTruthy();
    expect(screen.getByText(/Conta universal:/i)).toBeTruthy();
    expect(screen.queryByLabelText(/senha/i)).toBeNull();
    expect(screen.queryByRole("button",{name:/Criar minha conta/i})).toBeNull();
    expect(api.rpc).toHaveBeenCalledWith("get_my_professional_access");
  });
});
