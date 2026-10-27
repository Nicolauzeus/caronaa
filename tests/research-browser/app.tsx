import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { PublicResearchForm } from "@/components/research/PublicResearchForm";
import { AcademicExpressForm } from "@/components/research/AcademicExpressForm";
import { academicExpressF01Template } from "@/lib/formulario/academic-express-schema";
import { freshTemplate } from "@/lib/formulario/research-templates";
import { ResearchConfigurationFields } from "@/components/admin/ResearchConfigurationFields";
import { ConfiguredResearchInsights } from "@/components/admin/ConfiguredResearchInsights";
import { settings } from "./fixtures";
import "@/styles.css";

function Configure() {
  const [value, setValue] = useState(settings);
  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Configuração institucional</h1>
      <ResearchConfigurationFields
        value={value}
        onChange={setValue as (value: typeof value) => void}
      />
    </main>
  );
}
const academicForm = {
  id: "a1111111-1111-4111-8111-111111111111",
  version: "a2222222-2222-4222-8222-222222222222",
  title: "Campus Teste", schema: freshTemplate(academicExpressF01Template),
  brandImagePath: null, brandAlt: null, brandName: null,
  caronaaPresenceOn: "2026-12-05",
  configuration: { revision: 1, settings: {
    ...settings, institutionId: "TESTE-CAMPUS", institutionName: "Campus Teste",
    publicName: "Pesquisa de mobilidade", campus: "Campus Central",
    profiles: ["PASSAGEIRO", "MOTORISTA", "AMBOS"] as Array<"PASSAGEIRO" | "MOTORISTA" | "AMBOS">,
    emailCaptureEnabled: true, institutionalEmailDomains: ["campus.test.br"],
    days: [1, 2, 3, 4, 5, 6], outboundTimes: ["07:30", "13:30", "18:30"], returnTimes: [],
  } },
};
const root = createRootRoute({ component: () => <Outlet /> });
const router = createRouter({
  routeTree: root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/configuration", component: Configure }),
    createRoute({ getParentRoute: () => root, path: "/academic", component: () => (
      <AcademicExpressForm form={academicForm} captureEnabled user={null}/>
    ) }),
    createRoute({
      getParentRoute: () => root,
      path: "/public",
      component: () => <PublicResearchForm code="TEST" />,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/insights",
      component: () => (
        <main className="mx-auto max-w-6xl p-4">
          <ConfiguredResearchInsights forms={[]} />
        </main>
      ),
    }),
  ]),
});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
