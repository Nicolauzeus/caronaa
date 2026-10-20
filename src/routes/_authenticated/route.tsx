import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyResearchLaunchState } from "@/lib/research-launch";
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
