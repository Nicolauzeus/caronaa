import { createFileRoute, redirect } from "@tanstack/react-router";
import { quickRideSearchSchema } from "@/lib/quick-ride-search";

/**
 * Legacy driver URL. The operational queue and ride transitions now live in
 * the unified driver cockpit. Preserve old deep links as redirects.
 */
export const Route = createFileRoute("/_authenticated/viagem-rapida")({
  validateSearch: quickRideSearchSchema,
  beforeLoad: () => {
    throw redirect({ to: "/disponibilidade-profissional", replace: true });
  },
});
