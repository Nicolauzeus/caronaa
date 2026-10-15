import { describe, expect, it } from "vitest";
import * as retiredActivation from "@/components/caronaa/StsJourneyActivation";

describe("Fluxo de ativação do formulário encerrado", () => {
  it("não expõe mais o componente de publicação STS na aplicação", () => {
    expect(retiredActivation.StsJourneyActivation()).toBeNull();
  });
});
