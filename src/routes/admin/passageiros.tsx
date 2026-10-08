// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/passageiros")({
  head: () => ({
    meta: [{ property: "og:title", content: "Passageiros - CARONAA" },
{ property: "og:description", content: "Gestão administrativa de passageiros do CARONAA." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
      { title: "Passageiros - CARONAA" },
      { name: "description", content: "Gestão administrativa de passageiros do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="passageiros" />,
});
