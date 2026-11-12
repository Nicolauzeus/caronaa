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
    // A professional applicant may access the approval and availability screens
    // without taking a passenger survey or waiting for an academic launch.
    // Approval is always checked by the server RPC, never user metadata.
    const professionalPage = location.pathname === "/disponibilidade-profissional" ||
      location.pathname === "/perfil" || location.pathname === "/viagem-rapida";
    let approvedMototaxi = false;
    if (professionalPage) {
      const [{ data: applicant, error: applicantError }, { data: access, error: accessError }] = await Promise.all([
        (supabase as any).from("professional_mototaxi_profiles").select("user_id")
          .eq("user_id", data.user.id).maybeSingle(),
        (supabase as any).rpc("get_my_professional_access"),
      ]);
      if (applicantError || accessError) throw new Error("Não foi possível validar seu acesso profissional.");
      approvedMototaxi = Boolean(applicant && access?.authorized === true);
      if (applicant && (location.pathname === "/perfil" ||
        location.pathname === "/disponibilidade-profissional" ||
        (location.pathname === "/viagem-rapida" && approvedMototaxi))) {
        // Authorization to inspect the profile/request is not a commercial
        // operating permit. The ride and presence RPCs enforce their own gates.
        return { user: data.user, launchLocked: !approvedMototaxi };
      }
    }
    const destination = await resolvePostOnboardingDestination();
    if (destination === "/formulario" && !approvedMototaxi) {
      throw redirect({ to: "/formulario", replace: true });
    }
    const launch = await getMyResearchLaunchState();
    // New campaign participants may personalize their account before launch.
    // All other app routes remain restricted, backed by the database ride guards.
    const accessibleWhileWaiting = location.pathname === "/aguardando" ||
      location.pathname === "/perfil";
    if (launch.locked && !accessibleWhileWaiting && !approvedMototaxi) {
      throw redirect({ to: "/aguardando", replace: true });
    }
    return { user: data.user, launchLocked: launch.locked };
  },
  component: () => <Outlet />,
});
