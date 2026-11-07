import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { QuickRideExperience } from "@/components/caronaa/QuickRideExperience";
import { quickRideSearchSchema } from "@/lib/quick-ride-search";
export const Route = createFileRoute("/_authenticated/viagem-rapida")({
  validateSearch: quickRideSearchSchema,
  component: QuickRidePage,
});
function QuickRidePage() {
  const search = Route.useSearch();
  return (
    <AppShell>
      <QuickRideExperience
        initialOrigin={search.origin}
        initialDestination={search.destination}
        initialMunicipality={search.municipality}
        initialOriginPoint={
          search.originLat != null && search.originLng != null
            ? { rawText: search.origin, lat: search.originLat, lng: search.originLng }
            : undefined
        }
        initialDestinationPoint={
          search.destinationLat != null && search.destinationLng != null
            ? {
                rawText: search.destination,
                lat: search.destinationLat,
                lng: search.destinationLng,
              }
            : undefined
        }
      />
    </AppShell>
  );
}
