import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("CARONAA navigation", () => {
  it("keeps the formulario layout outlet-only and scopes its legacy redirect to the index", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/formulario/unilab-2026-nov");
    expect(matches.at(-1)?.routeId).toBe("/formulario/$code");
    expect(matches.map((match) => match.routeId)).not.toContain("/_authenticated");
    expect(router.routesById["/formulario"].options.beforeLoad).toBeUndefined();
    expect(router.routesById["/formulario"].options.component).toBeTypeOf("function");
    expect(router.routesById["/formulario/"].options.beforeLoad).toBeTypeOf("function");
    expect(router.routesById["/formulario/$code"].options.beforeLoad).toBeUndefined();
    const directory = router.matchRoutes("/pesquisas");
    expect(directory.at(-1)?.routeId).toBe("/pesquisas/");
    expect(directory.map((match) => match.routeId)).not.toContain("/_authenticated");
    const alternateSurvey = router.matchRoutes("/pesquisas/unilab-2026-nov");
    expect(alternateSurvey.at(-1)?.routeId).toBe("/pesquisas/$code");
    expect(alternateSurvey.map((match) => match.routeId)).not.toContain("/_authenticated");
    expect(router.routesById["/_authenticated"].options.beforeLoad).toBeTypeOf("function");
  });
  it.each([
    "/",
    "/home",
    "/buscar",
    "/oferecer",
    "/minhas-caronas",
    "/perfil",
    "/formulario",
    "/admin/oportunidades",
  ])("matches %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
