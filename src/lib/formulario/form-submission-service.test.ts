import { describe, expect, it } from "vitest";

import { assertPainPointIntegrity } from "./form-submission-service";

const validRows = [
  { selecionada: true, principal: true, intensidade: 4 },
  { selecionada: true, principal: false, intensidade: null },
  { selecionada: false, principal: false, intensidade: null },
] as const;

describe("form pain payload integrity", () => {
  it("accepts selected pains with exactly one principal pain", () => {
    expect(() => assertPainPointIntegrity(validRows as unknown as never[])).not.toThrow();
  });

  it("rejects two principal pains", () => {
    expect(() => assertPainPointIntegrity([{ ...validRows[0]!, principal: true }, { ...validRows[1]!, principal: true }] as never[])).toThrow();
  });

  it("rejects selected pains without a principal pain", () => {
    expect(() => assertPainPointIntegrity(validRows.map((row) => ({ ...row, principal: false })) as never[])).toThrow();
  });

  it("rejects a principal pain that was not selected", () => {
    expect(() => assertPainPointIntegrity([{ ...validRows[0]!, selecionada: false }] as never[])).toThrow();
  });

  it("rejects a principal pain without a valid intensity", () => {
    expect(() => assertPainPointIntegrity([{ ...validRows[0]!, intensidade: 6 }] as never[])).toThrow();
  });
});
