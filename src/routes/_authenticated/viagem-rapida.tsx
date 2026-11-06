import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/caronaa/AppShell";
import { QuickRideExperience } from "@/components/caronaa/QuickRideExperience";
export const Route = createFileRoute("/_authenticated/viagem-rapida")({
  component: () => (
    <AppShell>
      <QuickRideExperience />
    </AppShell>
  ),
});
