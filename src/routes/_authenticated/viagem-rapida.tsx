import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { QuickRideExperience } from "@/components/caronaa/QuickRideExperience";
import { quickRideSearchSchema } from "@/lib/quick-ride-search";

/** Passenger dispatch lives in the HOME map; this route is for authorized
 * professional drivers to receive and complete incoming ride requests.
 */
export const Route = createFileRoute("/_authenticated/viagem-rapida")({
  validateSearch: quickRideSearchSchema,
  component: QuickRideDriverPage,
});
function QuickRideDriverPage() {
  const search = Route.useSearch();
  return (
    <AppShell>
      <QuickRideExperience initialMunicipality={search.municipality} driverOnly />
    </AppShell>
  );
}
