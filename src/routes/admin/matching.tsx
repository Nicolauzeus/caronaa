// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/matching")({
  head: () => ({
    meta: [
      { title: "Matching - CARONAA" },
      { name: "description", content: "Gestão administrativa de matching do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="matching" />,
});
