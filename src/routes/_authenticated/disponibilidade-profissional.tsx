import { createFileRoute } from "@tanstack/react-router";
import { ProfessionalAvailabilityPage } from "@/components/caronaa/ProfessionalAvailabilityPage";
import { AppShell } from "@/components/caronaa/AppShell";

export const Route = createFileRoute("/_authenticated/disponibilidade-profissional")({
  component: () => <AppShell mapLayout><ProfessionalAvailabilityPage /></AppShell>,
  head: () => ({ meta: [
    {title:"Disponibilidade profissional | CARONAA"},
    {name:"description",content:"Fique disponível e compartilhe GPS no mesmo toque, com consentimento e status de radar em tempo real."},
    {property:"og:title",content:"Disponibilidade profissional | CARONAA"},
    {property:"og:type",content:"website"},
  ]}),
});
