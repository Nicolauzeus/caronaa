import { createFileRoute } from "@tanstack/react-router";
import { AdminRelacionamentosPage } from "@/components/admin/RelationshipsPage";

export const Route = createFileRoute("/admin/relacionamentos")({
  head: () => ({
    meta: [
      { property: "og:title", content: "CRM & Relacionamentos CARONAA" },
      {
        property: "og:description",
        content: "CRM multiformulários: UNIFOR, UNILAB, STS e contatos de Pitch com filtros e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        title: "Relacionamentos & Pitch — Administração CARONAA",
      },
      {
        name: "description",
        content: "Gestão de contatos, possíveis investidores e parceiros da CARONAA.",
      },
    ],
  }),
  component: AdminRelacionamentosPage,
});
