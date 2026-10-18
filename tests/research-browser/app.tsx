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
const root = createRootRoute({ component: () => <Outlet /> });
const router = createRouter({
  routeTree: root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/configuration", component: Configure }),
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
