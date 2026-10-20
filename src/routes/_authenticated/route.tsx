import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { getMyAdminEntry, getAdminAppPreview } from "@/lib/admin/entry";
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
    // Authorization takes precedence over a participant's launch gate.
    // The /home landing must not send a verified departmental administrator
    // to the participant waiting room before reaching their workspace.
    if (location.pathname === "/home" && !getAdminAppPreview(data.user.id)) {
      const adminHome = await getMyAdminEntry();
      if (adminHome) {
        throw redirect({ to: adminHome as "/admin", replace: true });
      }
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
