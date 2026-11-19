import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { FirstRunTutorial } from "@/components/onboarding/FirstRunTutorial";
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
    // Professional dispatch remains separately authorized; choosing a driver role
    // in onboarding never bypasses passenger account completion.
    const onboarding = await readOnboarding();
    // Pending professional registration must not lock the person's ordinary
    // passenger/shared-ride app. F07 dispatch authorization stays separate.
    // Passenger app and other routes keep the normal research/onboarding
    // gates. These pilot exceptions do NOT grant access to passenger Home.
    const vehicleRegistration = location.pathname === "/cadastro-veiculo";
    // Driver-intent users may finish their vehicle inside the authenticated
    // app without being incorrectly marked BASIC_COMPLETED first.
    if (onboarding?.status !== "BASIC_COMPLETED" &&
        !(vehicleRegistration && data.user.email_confirmed_at &&
          onboarding?.usage_role === "MOTORISTA")) {
      throw redirect({ to: "/onboarding", replace: true });
    }
    // Old research campaigns are optional and must not gate the mobility app.
    // Professional dispatch, account confirmation and vehicle guards remain enforced above.
    return { user: data.user, launchLocked: false };
  },
  component: () => <><Outlet /><FirstRunTutorial /></>,
});
