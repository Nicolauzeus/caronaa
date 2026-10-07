// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/caronas")({
  head: () => ({
    meta: [
      { title: "Caronas - CARONAA" },
      { name: "description", content: "Gestão administrativa de caronas do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="caronas" />,
});
