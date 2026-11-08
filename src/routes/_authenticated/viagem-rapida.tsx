import { createFileRoute, redirect } from "@tanstack/react-router";
import { quickRideSearchSchema } from "@/lib/quick-ride-search";

/** Legacy deep links now use the same HOME map and bottom sheet.
 * The original pilot RPC cannot bypass the server-quoted request flow.
 */
export const Route = createFileRoute("/_authenticated/viagem-rapida")({
  validateSearch: quickRideSearchSchema,
  beforeLoad: () => { throw redirect({ to: "/home", replace: true }); },
  component: () => null,
});
