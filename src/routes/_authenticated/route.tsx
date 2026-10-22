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
    if (location.pathname !== "/aguardando") {
      const launch = await getMyResearchLaunchState();
      if (launch.locked) {
        throw redirect({ to: "/aguardando", replace: true });
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
