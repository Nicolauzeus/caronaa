// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/motoristas")({
  head: () => ({
    meta: [
      { title: "Motoristas - CARONAA" },
      { name: "description", content: "Gestão administrativa de motoristas do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="motoristas" />,
});
