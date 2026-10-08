// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/caronas")({
  head: () => ({
    meta: [{ property: "og:title", content: "Caronas - CARONAA" },
{ property: "og:description", content: "Gestão administrativa de caronas do CARONAA." },
{ property: "og:type", content: "website" },
{ name: "twitter:card", content: "summary" },
      { title: "Caronas - CARONAA" },
      { name: "description", content: "Gestão administrativa de caronas do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="caronas" />,
});
