import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";
import { claimPendingParticipations,readPendingParticipations } from "@/lib/formulario/research-participation";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }
    // Link receipts saved by the survey before deciding whether the account
    // may access the app. A pending link is not itself authorization.
    if (data.user.email_confirmed_at && readPendingParticipations().length) {
      await claimPendingParticipations();
    }
    // Shared guard: every authenticated screen (including Profile and Trips)
    // must enforce the research step, not only /home.
    const onboarding = await readOnboarding();
    if (onboarding?.status !== "BASIC_COMPLETED") {
      throw redirect({ to: "/onboarding", replace: true });
    }
    const destination = await resolvePostOnboardingDestination();
    if (destination === "/formulario") {
      throw redirect({ to: "/formulario", replace: true });
    }
    const launch = await getMyResearchLaunchState();
    // New campaign participants may personalize their account before launch.
    // All other app routes remain restricted, backed by the database ride guards.
    const accessibleWhileWaiting = location.pathname === "/aguardando" ||
      location.pathname === "/perfil";
    if (launch.locked && !accessibleWhileWaiting) {
      throw redirect({ to: "/aguardando", replace: true });
    }
    return { user: data.user, launchLocked: launch.locked };
  },
  component: () => <Outlet />,
});
