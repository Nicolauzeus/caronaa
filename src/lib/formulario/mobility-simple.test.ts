import { describe, expect, it } from "vitest";
import {
  MOBILITY_SIMPLE_EXPERIENCE, simpleMobilityTemplates,
  normalizeSimplePains, applySimplePainAnswer, validateSimpleMobilityPains,
  simplePainFields, isSimpleMobility,
} from "./mobility-simple";
import { freshTemplate, MUNICIPAL_TEMPLATES } from "./research-templates";
import { inspectSchema, cleanAnswers, validatePage, type Answers } from "./research-schema";
import { academicExpressUrbanSchema } from "./academic-express-schema";
import { formatResearchOption } from "./research-option-labels";

describe("F01 — formulários simplificados", () => {
  it("oferece universidade, rua e empresa sem CPF e sem mudar modelos históricos", () => {
    expect(simpleMobilityTemplates.map(t => [t.key, t.nature])).toEqual([
      ["F01_UNIVERSIDADE", "EDUCACAO"],
      ["F01_RUA", "MOBILIDADE_LOCAL"],
      ["F01_EMPRESA", "EMPRESA"],
    ]);
    expect(MUNICIPAL_TEMPLATES.map(t => t.key)).toEqual(["PROFISSIONAIS", "PASSAGEIROS", "PREFEITURA"]);
    expect(isSimpleMobility(academicExpressUrbanSchema)).toBe(false);
    for (const model of simpleMobilityTemplates) {
      expect(model.schema.experience).toBe(MOBILITY_SIMPLE_EXPERIENCE);
      expect(model.schema.sections).toHaveLength(3);
      expect(inspectSchema(model.schema)).toEqual([]);
      expect(JSON.stringify(model.schema)).not.toMatch(/CPF|DOCUMENTO|CNH/i);
      const questions = model.schema.sections.flatMap(s => s.questions);
      expect(questions.filter(q => q.semanticCode === "MOBILITY_PAINS")).toHaveLength(1);
      expect(questions.filter(q => q.semanticCode === "MOBILITY_PRIMARY_PAIN")).toHaveLength(1);
    }
  });

  it("gera identificadores novos e preserva condições vinculadas a UUIDs", () => {
    const source = simpleMobilityTemplates[0].schema;
    const fresh = freshTemplate(simpleMobilityTemplates[0]);
    expect(fresh.sections).toHaveLength(3);
    expect(fresh.sections[1].questions[0].id).not.toBe(source.sections[1].questions[0].id);
    expect(fresh.sections[1].questions[2].condition).toEqual({
      questionId: fresh.sections[1].questions[0].id,
      comparison: "INCLUDES",
      value: "OUTRA",
    });
    expect(inspectSchema(fresh)).toEqual([]);
  });

  it("seleciona até 3 dores e torna nenhuma exclusiva, sem interferir no código legado", () => {
    expect(normalizeSimplePains(["LOTACAO", "ATRASOS", "PRECO_ALTO", "ESPERA_LONGA"]))
      .toEqual(["LOTACAO", "ATRASOS", "PRECO_ALTO"]);
    expect(normalizeSimplePains(["LOTACAO", "SEM_DIFICULDADES", "ESPERA_LONGA"]))
      .toEqual(["SEM_DIFICULDADES"]);
    expect(formatResearchOption("SEM_DIFICULDADES")).toBe("Nenhuma dessas dificuldades");
    expect(formatResearchOption("NENHUMA")).toBe("Nenhuma dessas alternativas");
  });

  it("escolhe principal na mesma tela e recalcula quando uma dor é removida", () => {
    const schema = freshTemplate(simpleMobilityTemplates[1]);
    const { pains, primary, other } = simplePainFields(schema);
    const first = applySimplePainAnswer(schema, {}, pains!.id, ["LOTACAO", "PRECO_ALTO"]);
    expect(first[primary!.id]).toBe("LOTACAO");
    const ranked = applySimplePainAnswer(schema, first, primary!.id, "PRECO_ALTO");
    expect(ranked[primary!.id]).toBe("PRECO_ALTO");
    const reduced = applySimplePainAnswer(schema, ranked, pains!.id, ["LOTACAO"]);
    expect(reduced[primary!.id]).toBe("LOTACAO");
    expect(validateSimpleMobilityPains(schema, reduced)).toEqual([]);
    const withOther = applySimplePainAnswer(schema, reduced, pains!.id, ["LOTACAO", "OUTRA"]);
    expect(validateSimpleMobilityPains(schema, withOther)).toHaveLength(1);
    const detailed = applySimplePainAnswer(schema, withOther, other!.id, "Rota inexistente");
    expect(validateSimpleMobilityPains(schema, detailed)).toEqual([]);
    const cleaned = applySimplePainAnswer(schema, detailed, pains!.id, ["SEM_DIFICULDADES"]);
    expect(cleaned[primary!.id]).toBe("SEM_DIFICULDADES");
    expect(cleaned[other!.id]).toBeUndefined();
    expect(validateSimpleMobilityPains(schema, cleaned)).toEqual([]);
  });

  it("rejeita seleção adulterada ou principal que não foi marcada", () => {
    const schema = freshTemplate(simpleMobilityTemplates[0]);
    const { pains, primary } = simplePainFields(schema);
    const tampered: Answers = { [pains!.id]: ["LOTACAO", "SEM_DIFICULDADES"], [primary!.id]: "LOTACAO" };
    expect(validateSimpleMobilityPains(schema, tampered)).toHaveLength(1);
    const wrong: Answers = { [pains!.id]: ["LOTACAO"], [primary!.id]: "ESPERA_LONGA" };
    expect(validateSimpleMobilityPains(schema, wrong)).toHaveLength(1);
    expect(applySimplePainAnswer(schema, wrong, primary!.id, "ATRASOS")).toEqual(wrong);
  });

  it("impede publicar um novo F01 quando o editor apaga a etapa social", () => {
    const draft = freshTemplate(simpleMobilityTemplates[0]);
    draft.sections.splice(1,1);
    expect(inspectSchema(draft).join(" ")).toMatch(/três etapas|dificuldades/);
  });

  it("impede separar a principal da seleção e remover a opção nenhuma", () => {
    const draft = freshTemplate(simpleMobilityTemplates[1]);
    const selected = draft.sections[1].questions.find(q=>q.semanticCode==="MOBILITY_PAINS")!;
    selected.options = selected.options.filter(option=>option!=="SEM_DIFICULDADES");
    expect(inspectSchema(draft).join(" ")).toMatch(/seleção de dores|alternativas obrigatórias/);
  });

  it("campos ocultos de outra dificuldade não são enviados", () => {
    const schema = freshTemplate(simpleMobilityTemplates[2]);
    const { pains, primary, other } = simplePainFields(schema);
    const answers: Answers = {
      [pains!.id]: ["PRECO_ALTO"],
      [primary!.id]: "PRECO_ALTO",
      [other!.id]: "não deve persistir",
    };
    expect(cleanAnswers(schema, answers)[other!.id]).toBeUndefined();
    expect(validatePage(schema.sections[1], cleanAnswers(schema, answers),
      schema.sections.flatMap(s => s.questions), schema)).toEqual([]);
  });
});
