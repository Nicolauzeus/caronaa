import { describe, expect, it } from "vitest";
import { Route as PitchRoute } from "@/routes/pitch";
import { Route as FormRoute } from "@/routes/formulario";

describe("Página promocional encerrada", () => {
  it("redireciona a URL antiga para a página inicial", () => {
    expect(PitchRoute.options.beforeLoad).toBeTypeOf("function");
    expect(() => PitchRoute.options.beforeLoad?.({} as never)).toThrow();
  });

  it("redireciona links antigos do formulário para cadastro normal", () => {
    expect(FormRoute.options.beforeLoad).toBeTypeOf("function");
    expect(() => FormRoute.options.beforeLoad?.({} as never)).toThrow();
  });
});
