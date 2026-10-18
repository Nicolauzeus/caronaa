import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { Route as Executive } from "@/routes/admin/executivo";
import { Route as Technology } from "@/routes/admin/tecnologia";
import { Route as Operations } from "@/routes/admin/operacoes";
import { Route as Growth } from "@/routes/admin/crescimento";
import { Route as Research } from "@/routes/admin/inteligencia-pesquisa";
import { Route as Partnerships } from "@/routes/admin/parcerias";
import { Route as Safety } from "@/routes/admin/atendimento";
import { Route as Finance } from "@/routes/admin/financeiro";
import { Route as Compliance } from "@/routes/admin/compliance";
import "@/styles.css";

const root = createRootRoute({
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
});
const departments = [
  Executive,
  Technology,
  Operations,
  Growth,
  Research,
  Partnerships,
  Safety,
  Finance,
  Compliance,
];
const paths = [
  "executivo",
  "tecnologia",
  "operacoes",
  "crescimento",
  "inteligencia-pesquisa",
  "parcerias",
  "atendimento",
  "financeiro",
  "compliance",
];
const routes = [
  createRoute({ getParentRoute: () => root, path: "/admin", component: AdminOverview }),
  ...departments.map((route, i) =>
    createRoute({
      getParentRoute: () => root,
      path: `/admin/${paths[i]}`,
      component: route.options.component as () => React.ReactNode,
    }),
  ),
];
const router = createRouter({ routeTree: root.addChildren(routes) });
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
