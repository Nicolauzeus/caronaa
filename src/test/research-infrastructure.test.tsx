import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicResearchForm } from "@/components/research/PublicResearchForm";
import { ResearchInterestActivation } from "@/components/research/ResearchInterestActivation";
import { initialResearchJourney } from "@/components/research/ResearchJourneyFields";
import { newResearchConfiguration } from "@/lib/formulario/research-configuration";

const api = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), configured: true }));
const settings = {
  ...newResearchConfiguration(),
  institutionId: "TEST",
  institutionName: "Instituição de teste",
  publicName: "Pesquisa institucional",
  region: "Fortaleza",
  launchDate: "2027-01-10",
  profiles: ["AMBOS" as const],
  usagePolicy: "Participação voluntária. Não cria uma reserva.",
};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: api.rpc,
    from: (table: string) => {
      const chain = {
        select: () => chain,
        ilike: () => chain,
        eq: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        insert: api.insert,
        maybeSingle: async () => ({
          error: null,
          data:
            table === "research_forms"
              ? { id: "form-test", title: "Pesquisa", mobility_configured: api.configured }
              : {
                  id: "version-test",
                  schema_json: {
                    sections: [
                      {
                        title: "Sua opinião",
                        questions: [
                          {
                            id: "pay",
                            type: "yes_no",
                            label: "Você pagaria?",
                            required: true,
                            options: [],
                            semanticCode: "WILLINGNESS_TO_PAY",
                          },
                        ],
                      },
                    ],
                  },
                },
        }),
      };
      return chain;
    },
  },
}));
vi.mock("@/components/formulario/LocationAutocomplete", () => ({
  LocationAutocomplete: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
}));

describe("Configured public research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.configured = true;
    api.rpc.mockImplementation(async (name: string) => ({
      error: null,
      data:
        name === "get_public_research_configuration"
          ? { revision: 1, settings }
          : name === "register_research_interest"
            ? "INTERESSE_REGISTRADO"
            : true,
    }));
    api.insert.mockResolvedValue({ error: null });
  });
  it("accepts an anonymous response before a separately consented activation; never inserts a ride", async () => {
    render(<PublicResearchForm code="TEST" />);
    expect(await screen.findByText(/Início planejado.*10\/01\/2027/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Sim" }));
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seg" }));
    fireEvent.change(screen.getByLabelText("Bairro ou município de origem"), {
      target: { value: "Aldeota" },
    });
    fireEvent.change(screen.getByLabelText("Horário de saída", { exact: true }), {
      target: { value: "OTHER" },
    });
    fireEvent.change(screen.getByLabelText("Horário de saída: outro horário"), {
      target: { value: "08:30" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Concordo em participar desta pesquisa/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByText("Resposta registrada!");
    expect(api.rpc).toHaveBeenCalledWith(
      "submit_configured_research_answer",
      expect.objectContaining({
        p_research_consent: true,
        p_revision: 1,
        p_journey: expect.objectContaining({
          outboundTime: "08:30",
          otherOutboundTime: true,
          marketingConsent: false,
          partnerSharingConsent: false,
        }),
      }),
    );
    expect(api.insert).not.toHaveBeenCalled();
    expect(api.rpc.mock.calls.some(([name]) => name === "register_research_interest")).toBe(false);
    fireEvent.click(screen.getByText("Registrar interesse no trajeto (opcional)"));
    expect(
      screen.getByRole("button", { name: "Quero encontrar uma carona para este trajeto" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Quero disponibilizar lugares neste trajeto" }),
    ).toBeDisabled();
  });
  it("preserves the established submission path for unconfigured published surveys", async () => {
    api.configured = false;
    render(<PublicResearchForm code="OLD" />);
    await screen.findByText("Sua opinião");
    fireEvent.click(screen.getByRole("radio", { name: "Não" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Concordo em participar desta pesquisa/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviar respostas" }));
    await screen.findByText("Resposta registrada!");
    expect(api.insert).toHaveBeenCalledOnce();
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("requires independent pre-registration consent for both passenger and driver", async () => {
    render(
      <ResearchInterestActivation
        formId="form"
        receipt="private-receipt"
        journey={{ ...initialResearchJourney(settings), profile: "AMBOS" }}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Autorizo registrar meu interesse/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Quero encontrar uma carona para este trajeto" }),
    );
    await screen.findByText("Interesse registrado");
    expect(
      screen.getByRole("button", { name: "Quero disponibilizar lugares neste trajeto" }),
    ).toBeDisabled();
    await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(1));
    expect(api.rpc).toHaveBeenCalledWith("register_research_interest", {
      p_form_id: "form",
      p_submission_key: "private-receipt",
      p_profile: "PASSAGEIRO",
      p_consent: true,
    });
  });
  it("does not activate a professional service without regulation and enablement", () => {
    render(
      <ResearchInterestActivation
        formId="form"
        receipt="private"
        journey={{ ...initialResearchJourney(settings), mode: "TRANSPORTE_PROFISSIONAL_INTERESSE" }}
      />,
    );
    expect(screen.getByText(/depende de aprovação e habilitação/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(api.rpc).not.toHaveBeenCalled();
  });
});
