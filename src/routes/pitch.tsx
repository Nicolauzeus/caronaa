import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pitch")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
