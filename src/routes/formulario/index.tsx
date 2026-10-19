import { createFileRoute } from "@tanstack/react-router";
import { PublicResearchDirectory } from "@/components/research/PublicResearchDirectory";

export const Route = createFileRoute("/formulario/")({
  head: () => ({
    meta: [
      { title: "Pesquisas e formulários — CARONAA" },
      { name: "description", content: "Escolha e responda às pesquisas públicas de mobilidade do CARONAA, sem precisar criar uma conta." },
      { property: "og:title", content: "Participe das pesquisas CARONAA" },
      { property: "og:description", content: "Acesse as pesquisas de mobilidade disponíveis e compartilhe sua opinião." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicResearchDirectory,
});
