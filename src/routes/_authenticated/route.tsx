import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyUniforLaunchState } from "@/lib/unifor-launch";

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
    // Only the actual participant linked to the immutable UNIFOR research UUID
    // enters the waiting room. Other CARONAA users remain unaffected.
    if (location.pathname !== "/aguardando") {
      const pilot = await getMyUniforLaunchState();
      if (pilot.locked) {
        throw redirect({ to: "/aguardando", replace: true });
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
