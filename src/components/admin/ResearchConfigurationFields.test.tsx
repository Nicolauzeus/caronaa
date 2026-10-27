import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ResearchConfigurationFields } from "./ResearchConfigurationFields";
import { newResearchConfiguration, type ResearchConfiguration } from "@/lib/formulario/research-configuration";

const initial: ResearchConfiguration = {
  ...newResearchConfiguration("F01_UNIVERSIDADE"),
  institutionId: "TESTE-CAMPUS",
  institutionName: "Campus Teste",
  publicName: "Pesquisa Campus Teste",
  region: "Interior de Pernambuco",
  usagePolicy: "Pesquisa voluntária sobre deslocamentos universitários.",
  emailCaptureEnabled: true,
  institutionalEmailDomains: [],
  launchDate: null,
};
function Editor() {
  const [config, setConfig] = useState(initial);
  return <div>
    <ResearchConfigurationFields value={config} onChange={setConfig}/>
    <output data-testid="state">{JSON.stringify({
      name: config.institutionName, domains: config.institutionalEmailDomains,
      date: config.launchDate, title: config.publicName,
    })}</output>
  </div>;
}

describe("configuração dinâmica de pesquisa acadêmica", () => {
  it("edita livremente os domínios, instituição e data de lançamento sem regras UNIFOR", () => {
    render(<Editor/>);
    const domains = screen.getByPlaceholderText("universidade.br");
    fireEvent.change(domains, { target: { value: "unilab.edu.br, teste-campus.edu.br" } });
    expect(domains).toHaveValue("unilab.edu.br, teste-campus.edu.br");
    expect(screen.getByTestId("state").textContent).toContain("teste-campus.edu.br");
    fireEvent.change(screen.getByLabelText("Instituição, empresa ou evento"), {
      target: { value: "Instituto Livre" },
    });
    expect(screen.getByTestId("state").textContent).toContain("Instituto Livre");
    fireEvent.click(screen.getByRole("tab", { name: "Serviço e política" }));
    fireEvent.change(screen.getByLabelText(/Data prevista de presença ou início de operação/), {
      target: { value: "2027-03-05" },
    });
    expect(screen.getByTestId("state").textContent).toContain("2027-03-05");
  });
});
