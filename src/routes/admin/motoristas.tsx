// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/motoristas")({
  head: () => ({
    meta: [{ property: "og:title", content: "Motoristas - CARONAA" },
{ property: "og:description", content: "Gestão administrativa de motoristas do CARONAA." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
      { title: "Motoristas - CARONAA" },
      { name: "description", content: "Gestão administrativa de motoristas do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="motoristas" />,
});
