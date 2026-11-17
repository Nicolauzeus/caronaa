import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/formulario")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
