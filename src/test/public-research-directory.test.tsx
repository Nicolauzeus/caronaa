import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { PublicResearchDirectory } from "@/components/research/PublicResearchDirectory";

const api = vi.hoisted(() => ({
  load: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => api.navigate,
  Link: ({ to, params, children, ...props }: {
    to: string; params?: {code:string}; children: ReactNode; className?: string;
  }) => <a href={params ? "/formulario/" + encodeURIComponent(params.code) : to} {...props}>{children}</a>,
}));
vi.mock("@/components/caronaa/AppShell", () => ({
  AppShell: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock("@/lib/formulario/public-research-directory", () => ({
  loadAvailableResearchForms: api.load,
}));

const active = [
  { id:"1",code:"UNIFOR-26",title:"Pesquisa UNIFOR",municipality:"Fortaleza",nature:"EDUCACAO" },
  { id:"2",code:"EVENTO-26",title:"Carona no evento",municipality:null,nature:"EVENTO" },
];

describe("Public research directory navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.navigate.mockResolvedValue(undefined);
  });

  it("redirects to the only accessible form without login", async () => {
    api.load.mockResolvedValue([active[0]]);
    render(<PublicResearchDirectory />);
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith({
      to:"/formulario/$code",params:{code:"UNIFOR-26"},replace:true,
    }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("link",{name:/Abrir formulário/})).toHaveAttribute("href","/formulario/UNIFOR-26");
  });

  it("provides an accessible select for multiple forms and navigates to the selected code", async () => {
    api.load.mockResolvedValue(active);
    render(<PublicResearchDirectory />);
    const select=await screen.findByRole("combobox",{name:/Selecione a pesquisa/});
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("button",{name:/Preencher formulário/})).toBeDisabled();
    fireEvent.change(select,{target:{value:"EVENTO-26"}});
    fireEvent.click(screen.getByRole("button",{name:/Preencher formulário/}));
    await waitFor(()=>expect(api.navigate).toHaveBeenCalledWith({
      to:"/formulario/$code",params:{code:"EVENTO-26"},
    }));
    expect(screen.getByText(/2 pesquisas disponíveis/)).toBeInTheDocument();
  });

  it("shows an informative empty state, never opening registration", async () => {
    api.load.mockResolvedValue([]);
    render(<PublicResearchDirectory />);
    expect(await screen.findByText(/Nenhuma pesquisa disponível/)).toBeInTheDocument();
    expect(api.navigate).not.toHaveBeenCalled();
  });

  it("keeps a loading state and lets the visitor retry a network failure", async () => {
    api.load.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(active);
    render(<PublicResearchDirectory />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/Tentar novamente/}));
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(api.load).toHaveBeenCalledTimes(2);
  });
});
