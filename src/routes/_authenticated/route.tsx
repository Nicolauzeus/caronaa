import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyResearchLaunchState } from "@/lib/research-launch";
import { ensureBasicPassengerOnboarding } from "@/lib/onboarding/progressive-onboarding";
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
    // Availability is accessible to an authenticated pilot candidate. It
    // cannot grant any professional permission by itself; every write and
    // dispatch is checked by the database and pilot server dual gate.
    const professionalPage = ["/disponibilidade-profissional","/perfil","/viagem-rapida","/viagens-profissionais"]
      .includes(location.pathname);
    let approvedProfessional = false;
    if (professionalPage) {
      const [{ data: applicant, error: applicantError },
             { data: access, error: accessError }] = await Promise.all([
        (supabase as any).from("professional_mototaxi_profiles").select("user_id")
          .eq("user_id",data.user.id).maybeSingle(),
        (supabase as any).rpc("get_my_professional_access"),
      ]);
      if (applicantError || accessError) {
        throw new Error("Não foi possível validar seu acesso profissional.");
      }
      approvedProfessional=access?.authorized === true;
      if (location.pathname === "/disponibilidade-profissional") {
        return {user:data.user,launchLocked:!approvedProfessional};
      }
      if (location.pathname === "/viagem-rapida" || location.pathname === "/viagens-profissionais") {
        if (approvedProfessional) {
          return {user:data.user,launchLocked:false};
        }
        throw redirect({to:"/disponibilidade-profissional",replace:true});
      }
      if (location.pathname === "/perfil" && applicant) {
        return {user:data.user,launchLocked:!approvedProfessional};
      }
    }
    // A professional applicant or exclusive driver starts in a dedicated cockpit,
    // not on the passenger Home. This is UX routing only, not dispatch approval.
    const onboarding = await ensureBasicPassengerOnboarding();
    const exclusiveDriver = onboarding?.status === "BASIC_COMPLETED" &&
      (onboarding as { usage_role?: string } | null)?.usage_role === "MOTORISTA";
    if (location.pathname === "/home" || location.pathname === "/minhas-caronas" ||
        location.pathname === "/buscar") {
      const { data: professional, error: professionalError } = await (supabase as any)
        .from("professional_mototaxi_profiles").select("user_id")
        .eq("user_id", data.user.id).maybeSingle();
      if (!professionalError && (professional || exclusiveDriver)) {
        throw redirect({ to: "/disponibilidade-profissional", replace: true });
      }
    }
    // Passenger app and other routes keep the normal research/onboarding
    // gates. These pilot exceptions do NOT grant access to passenger Home.
    if (onboarding?.status !== "BASIC_COMPLETED") {
      throw redirect({ to: "/onboarding", replace: true });
    }
    const destination = await resolvePostOnboardingDestination();
    if (destination === "/formulario" && !approvedProfessional) {
      throw redirect({ to: "/formulario", replace: true });
    }
    const launch = await getMyResearchLaunchState();
    // New campaign participants may personalize their account before launch.
    // All other app routes remain restricted, backed by the database ride guards.
    const accessibleWhileWaiting = location.pathname === "/aguardando" ||
      location.pathname === "/perfil";
    if (launch.locked && !accessibleWhileWaiting && !approvedProfessional) {
      throw redirect({ to: "/aguardando", replace: true });
    }
    return { user: data.user, launchLocked: launch.locked };
  },
  component: () => <Outlet />,
});
