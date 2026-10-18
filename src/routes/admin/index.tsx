import { createFileRoute } from "@tanstack/react-router";
import { AdminOverview } from "@/components/admin/AdminOverview";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Visão Geral — Administração CARONAA" },
      {
        name: "description",
        content: "Indicadores, pendências e atividades administrativas do CARONAA.",
      },
      { property: "og:title", content: "Visão Geral — Administração CARONAA" },
      {
        property: "og:description",
        content: "Indicadores, pendências e atividades administrativas do CARONAA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOverview,
});
