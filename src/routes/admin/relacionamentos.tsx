import { createFileRoute } from "@tanstack/react-router";
import { AdminRelacionamentosPage } from "@/components/admin/RelationshipsPage";

export const Route = createFileRoute("/admin/relacionamentos")({
  head: () => ({
    meta: [
      { property: "og:title", content: "Relacionamentos & Pitch — Administração CARONAA" },
      {
        property: "og:description",
        content: "Gestão de contatos, possíveis investidores e parceiros do Pitch STS 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        title: "Relacionamentos & Pitch — Administração CARONAA",
      },
      {
        name: "description",
        content: "Gestão de contatos, possíveis investidores e parceiros do Pitch STS 2026.",
      },
    ],
  }),
  component: AdminRelacionamentosPage,
});

