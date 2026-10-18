import { describe, expect, it } from "vitest";
import { adminErrorMessage } from "./error-message";

describe("Administrative errors", () => {
  it("distinguishes denied access from unavailable data", () => {
    expect(adminErrorMessage({ code: "42501", message: "internal SQL" })).toContain(
      "não tem permissão",
    );
    expect(adminErrorMessage(new Error("Admin access required"))).toContain("não tem permissão");
    expect(adminErrorMessage(new Error("relation public.secret does not exist"))).toBe(
      "Não foi possível carregar os dados. Tente novamente.",
    );
  });
});
