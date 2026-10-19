import { describe, expect, it } from "vitest";
import { Route as PitchRoute } from "@/routes/pitch";
import { Route as FormRoute } from "@/routes/formulario/index";

describe("Página promocional encerrada", () => {
  it("redireciona a URL antiga para a página inicial", () => {
    expect(PitchRoute.options.beforeLoad).toBeTypeOf("function");
    expect(() => PitchRoute.options.beforeLoad?.({} as never)).toThrow();
  });

  it("mantém /formulario público e sem redirecionamento para cadastro", () => {
    expect(FormRoute.options.beforeLoad).toBeUndefined();
    expect(FormRoute.options.component).toBeTypeOf("function");
  });
});
