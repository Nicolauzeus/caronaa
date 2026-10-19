import type { SurveySchema } from "@/lib/formulario/research-templates";
import type { Answers } from "@/lib/formulario/research-schema";
import type { ResearchJourney, PublicResearchConfiguration } from "@/lib/formulario/research-configuration";
import { eventRideActionLinks } from "@/lib/formulario/event-exit-match";

/** Render only real system entrypoints. Booking, matching and offer creation always
 * remain in their existing authenticated/request flows, never in this survey. */
export function EventExitMatchActions({
  configuration,
  journey,
  answers,
  schema,
}: {
  configuration: PublicResearchConfiguration["settings"];
  journey: ResearchJourney;
  answers: Answers;
  schema: SurveySchema;
}) {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: configuration.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const getDatePart=(type: string)=>dateParts.find(part=>part.type===type)?.value ?? "";
  const today = getDatePart("year")+"-"+getDatePart("month")+"-"+getDatePart("day");
  const seatsQuestion = schema.sections.flatMap(s=>s.questions)
    .find(q=>q.semanticCode==="EVENT_OFFER_SEATS");
  const available = seatsQuestion ? Number(answers[seatsQuestion.id]) : NaN;
  const links = eventRideActionLinks(configuration, journey, today, available);
  if (!links) {
    return (
      <section aria-label="Próximos passos do evento" className="space-y-2 rounded-xl border p-4">
        <h2 className="font-bold">Seu trajeto ficou registrado para a pesquisa</h2>
        <p className="text-sm text-muted-foreground">
          A busca e a oferta de caronas para este evento ainda não estão disponíveis,
          ou a data configurada já passou. Este registro não representa corrida confirmada.
        </p>
      </section>
    );
  }
  const canFind=journey.profile==="PASSAGEIRO"||journey.profile==="AMBOS";
  const canOffer=journey.profile==="MOTORISTA"||journey.profile==="AMBOS";
  return (
    <section aria-label="Encontrar ou oferecer carona no evento" className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <h2 className="text-lg font-bold">Encontre alguém indo na mesma direção</h2>
      <p className="text-sm text-muted-foreground">
        Seu trajeto e horário já estão preparados para abrir os fluxos reais do CARONAA.
        Verifique as informações e confirme a ação no aplicativo.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {canFind && <a href={links.search} className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">Buscar caronas disponíveis</a>}
        {canOffer && <a href={links.offer} className="flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 py-3 text-center text-sm font-semibold">Preparar uma oferta de carona</a>}
      </div>
      <p className="text-xs text-muted-foreground">
        A busca utiliza ofertas verdadeiras. Se não houver caronas compatíveis, será mostrada uma lista vazia.
        Publicação, reserva, preço e confirmação dependem dos controles normais da plataforma.
      </p>
    </section>
  );
}
