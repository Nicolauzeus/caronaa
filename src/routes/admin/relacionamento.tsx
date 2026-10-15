import { createFileRoute } from "@tanstack/react-router";
import { AdminRelacionamentosPage } from "@/components/admin/RelationshipsPage";

export const Route = createFileRoute("/admin/relacionamento")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Relacionamentos & Pitch — Administração CARONAA" },
      {
        property: "og:description",
        content: "Gestão de contatos, possíveis investidores e parceiros da CARONAA.",
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
