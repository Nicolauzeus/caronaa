import { createFileRoute } from "@tanstack/react-router";

import { ResearchCatalog } from "@/components/admin/ResearchCatalog";

export const Route = createFileRoute("/admin/formularios/")({
  head: () => ({
    meta: [
      {
        title: "Formulários — Administração CARONAA",
      },
      {
        name: "description",
        content: "Acompanhe os formulários de validação do CARONAA.",
      },
      {
        property: "og:title",
        content: "Formulários — Administração CARONAA",
      },
      {
        property: "og:description",
        content: "Acompanhe os formulários de validação do CARONAA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),

  component: AdminFormsPage,
});

function AdminFormsPage() {
  return <ResearchCatalog />;
}
