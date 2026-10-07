// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import { createFileRoute } from "@tanstack/react-router";
import { OperationPage } from "@/components/admin/OperationPage";

export const Route = createFileRoute("/admin/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações - CARONAA" },
      { name: "description", content: "Gestão administrativa de solicitações do CARONAA." },
    ],
  }),
  component: () => <OperationPage kind="solicitacoes" />,
});
