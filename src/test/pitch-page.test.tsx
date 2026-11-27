import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Route as PitchRoute } from "@/routes/pitch";
import { Route as FormRoute } from "@/routes/formulario/index";

describe("Página promocional encerrada", () => {
  it("redireciona a URL antiga para a página inicial", () => {
    expect(PitchRoute.options.beforeLoad).toBeTypeOf("function");
    expect(() => PitchRoute.options.beforeLoad?.({} as never)).toThrow();
  });

  it("mantém o layout /formulario neutro e restringe o redirect ao índice", () => {
    expect(FormRoute.options.beforeLoad).toBeTypeOf("function");
    expect(readFileSync("src/routes/formulario/index.tsx", "utf8")).toContain('throw redirect({ to: "/auth", search: { mode: "cadastro" }, replace: true });');
    expect(FormRoute.options.component).toBeUndefined();
  });
});
