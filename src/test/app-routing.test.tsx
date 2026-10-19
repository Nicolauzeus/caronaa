import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("CARONAA navigation", () => {
  it("keeps direct survey links public and removes registration redirect from the directory", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/formulario/unilab-2026-nov");
    expect(matches.at(-1)?.routeId).toBe("/formulario/$code");
    for (const match of matches) {
      expect(match.routeId).not.toBe("/_authenticated");
      expect(router.routesById[match.routeId].options.beforeLoad).toBeUndefined();
    }
    expect(router.routesById["/formulario/"].options.beforeLoad).toBeUndefined();
    expect(router.routesById["/formulario/"].options.component).toBeTypeOf("function");
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
