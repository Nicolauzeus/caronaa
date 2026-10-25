import { describe, expect, it } from "vitest";
import { buildF01Draft, F01_CREATION_MODELS } from "./f01-creation";
import { parseResearchConfiguration } from "./research-configuration";
import { freshTemplate, RESEARCH_TEMPLATES } from "./research-templates";
import { inspectSchema } from "./research-schema";

describe("F01 — novos modelos padrão de criação", () => {
  it.each(F01_CREATION_MODELS)("gera um rascunho válido para $title", model => {
    const draft = buildF01Draft({
      modelKey: model.key, name: "Instituição piloto", title: "Pesquisa de mobilidade",
      code: "PESQUISA-PILOTO-2026", region: "MACICO_BATURITE",
      startsOn: "2026-10-25", endsOn: "2026-11-25",
      launchOn: null,
    });
    expect(draft.nature).toBe(model.nature);
    expect(draft.templateKey).toBe(model.key);
    expect(draft.configuration.emailCaptureEnabled).toBe(true);
    expect(draft.configuration.launchDate).toBeNull();
    expect(draft.configuration.region).toBe("Maciço de Baturité");
    expect(draft.configuration.partnershipConfirmed).toBe(false);
    expect(parseResearchConfiguration(draft.configuration)).toBeTruthy();
    const template = RESEARCH_TEMPLATES.find(t => t.key === model.key)!;
    expect(inspectSchema(freshTemplate(template))).toEqual([]);
    expect(draft.configuration.usagePolicy).toContain("Pesquisa voluntária");
    expect(JSON.stringify(draft)).not.toMatch(/CPF|DOCUMENTO_OBRIGATORIO/);
  });

  it("não cria data de lançamento fictícia e preserva região e campus informado", () => {
    const draft = buildF01Draft({
      modelKey: "F01_UNIVERSIDADE", name: "UNIFOR", title: "Mobilidade universitária",
      code: "UNIFOR-MOBILIDADE-2026", region: "FORTALEZA_EDSON_QUEIROZ",
      campus: "Campus Edson Queiroz",
      startsOn: "2026-10-25", endsOn: "2026-12-01",
      launchOn: null,
    });
    expect(draft.configuration.campus).toBe("Campus Edson Queiroz");
    expect(draft.configuration.launchDate).toBe(null);
    expect(draft.municipality).toBe("Fortaleza");
    expect(draft.caronaaPresenceOn).toBe(null);
  });

  it("rejeita campos vazios e modelos desconhecidos", () => {
    const valid = {
      modelKey: "F01_RUA" as const, name: "Centro", title: "Pesquisa local",
      code: "BAIRRO-2026", region: "MACICO_BATURITE" as const,
      startsOn: "2026-10-25", endsOn: "2026-11-25",
    };
    expect(()=>buildF01Draft({...valid,name:""})).toThrow();
    expect(()=>buildF01Draft({...valid,modelKey:"INVALIDO" as never})).toThrow();
  });
});
