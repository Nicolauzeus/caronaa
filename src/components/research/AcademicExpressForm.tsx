import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CarFront,
  Car as SteeringWheel,
  ArrowLeftRight,
  MapPin,
  Search,
  X,
  ShieldCheck,
} from "lucide-react";
import type { SurveySchema, SurveyQuestion } from "@/lib/formulario/research-templates";
import type {
  PublicResearchConfiguration,
  ResearchJourney,
} from "@/lib/formulario/research-configuration";
import {
  effectiveResearchSchedule,
  validateJourney,
} from "@/lib/formulario/research-configuration";
import { academicExpressSteps, daysUntilCommunityLaunch, isAcademicExpressF01, type AcademicRole } from "@/lib/formulario/academic-express-schema";
import { applySimplePainAnswer, simplePainFields, validateSimpleMobilityPains } from "@/lib/formulario/mobility-simple";
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { cleanAnswers, validatePage, type Answers } from "@/lib/formulario/research-schema";
import { validResearchEmail, captureResearchLead } from "@/lib/formulario/research-lead";
import { captureResearchWhatsapp, formatBrazilWhatsapp, validBrazilWhatsapp } from "@/lib/formulario/research-whatsapp";
import {
  submitConfiguredResearch,
  registerResearchInterest,
} from "@/lib/formulario/research-configuration-service";
import {
  storePendingParticipation,
  claimResearchParticipation,
} from "@/lib/formulario/research-participation";
import { initialResearchJourney } from "./ResearchJourneyFields";
import { displaySurveyDate } from "@/lib/formulario/research-window";

type AcademicForm = {
  id: string;
  version: string;
  title: string;
  schema: SurveySchema;
  brandImagePath: string | null;
  brandAlt: string | null;
  brandName: string | null;
  caronaaPresenceOn: string | null;
  configuration?: PublicResearchConfiguration | null;
};

type Stage = ReturnType<typeof academicExpressSteps>[number];
const roleNames: Record<AcademicRole, string> = {
  PASSAGEIRO: "Quero pegar carona",
  MOTORISTA: "Quero oferecer carona",
  AMBOS: "Quero pegar e oferecer",
};
const textChoices: Record<string, string> = {
  ESTUDANTE: "Estudante",
  ESTUDANTE_TRABALHADOR: "Estudante e profissional",
  PROFESSOR: "Professor(a)",
  COLABORADOR: "Colaborador(a)",
  TERCEIRIZADO: "Terceirizado(a)",
  OUTRO: "Outro",
  ONIBUS: "Ônibus",
  APLICATIVO: "Uber / 99",
  CARONA: "Carona com conhecidos",
  CARRO: "Carro",
  MOTO: "Moto",
  BICICLETA: "Bicicleta",
  A_PE: "A pé",
  PREFERENCIA_MULHERES: "Prefiro viajar com mulheres",
  PONTO_NO_CAMPUS: "Ponto de encontro dentro do campus",
  PERFIL_VERIFICADO: "Identidade e vínculo verificados",
  ECONOMIA: "Economia no trajeto",
  SEM_DESVIOS: "Sem desvio relevante da minha rota",
  PAGAMENTO_VERIFICADO: "Pagamento confirmado antes de considerar recebido",
  MESMA_UNIVERSIDADE: "Pessoas da mesma universidade",
  LOTACAO: "Ônibus lotados",
  PRECO_ALTO: "Preço alto do transporte",
  ESPERA_LONGA: "Tempo de espera prolongado",
  ATRASOS: "Atrasos frequentes",
  INSEGURANCA_NO_TRAJETO: "Insegurança no trajeto",
  SEM_TRANSPORTE: "Falta de transporte disponível",
  DESCONFORTO: "Desconforto nas viagens",
  HORARIO_INCOMPATIVEL: "Horários incompatíveis",
  OUTRA: "Outra dificuldade",
  SEM_DIFICULDADES: "Nenhuma dessas dificuldades",
};
const shell =
  "flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#121212]/90 px-3 py-2 text-left text-sm font-medium backdrop-blur-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]";
const field =
  "min-h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-[#121212]/90 px-3 text-base text-white backdrop-blur-2xl outline-none placeholder:text-white/40 focus:border-[#FFBB00] focus:ring-2 focus:ring-[#FFBB00]/30";
const label = "block text-xs font-semibold tracking-wide text-white/75";

export function AcademicExpressForm({
  form,
  captureEnabled,
  user,
  previewMode = false,
}: {
  form: AcademicForm;
  captureEnabled: boolean;
  user?: { email?: string | null; email_confirmed_at?: string | null } | null;
  /** Inert editor preview. It must never call the persistence/lead/interest APIs. */
  previewMode?: boolean;
}) {
  const config = form.configuration!;
  const schema = form.schema;
  const isF01Express = isAcademicExpressF01(schema);
  const painFields = simplePainFields(schema);
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepScrollRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const allQuestions = useMemo(() => schema.sections.flatMap((s) => s.questions), [schema]);
  const bySemantic = (semantic: string) => allQuestions.find((q) => q.semanticCode === semantic);
  const roleQuestion = bySemantic("RESEARCH_PARTICIPANT_ROLE");
  const nameQuestion = bySemantic("ACADEMIC_PARTICIPANT_NAME");
  const affiliationQuestion = bySemantic("ACADEMIC_ROLE");
  const transportQuestion = bySemantic("TRANSPORT_MODE");
  const passengerPriority = bySemantic("ACADEMIC_PASSENGER_PRIORITY");
  const vehicleQuestion = bySemantic("URBAN_OFFER_VEHICLE");
  const vehicleModelQuestion = bySemantic("ACADEMIC_VEHICLE_MODEL");
  const seatsQuestion = bySemantic("SEATS_AVAILABLE");
  const driverPriority = bySemantic("ACADEMIC_DRIVER_PRIORITY");

  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState(user?.email ?? "");
  const [whatsapp, setWhatsapp] = useState("");
  const [journey, setJourney] = useState<ResearchJourney>(() => ({
    ...initialResearchJourney(config.settings),
    days: [],
    outboundTime: "",
    returnTime: "",
    direction: "IDA",
  }));
  const [index, setIndex] = useState(0);
  const [specificPane, setSpecificPane] = useState<"profile" | "pains">("profile");
  const [locating, setLocating] = useState(false);
  const [searchOriginOpen, setSearchOriginOpen] = useState(false);
  const [searchOriginDraft, setSearchOriginDraft] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [interestRegistered, setInterestRegistered] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [linkageConsent, setLinkageConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [whatsappContactConsent, setWhatsappContactConsent] = useState(false);
  const [prepareInterest, setPrepareInterest] = useState(false);
  const [interestRole, setInterestRole] = useState<AcademicRole>(isF01Express ? "AMBOS" : "PASSAGEIRO");
  const [customSeats, setCustomSeats] = useState(false);
  const [submissionKey] = useState(() => crypto.randomUUID());

  const candidateRole = roleQuestion ? answers[roleQuestion.id] : null;
  const role: AcademicRole | null =
    candidateRole === "PASSAGEIRO" || candidateRole === "MOTORISTA" || candidateRole === "AMBOS"
      ? candidateRole
      : null;
  const steps = academicExpressSteps(role);
  const selectedPains = painFields.pains && Array.isArray(answers[painFields.pains.id])
    ? answers[painFields.pains.id] as string[] : [];
  const roleSettings = effectiveResearchSchedule(
    config.settings,
    role ?? config.settings.profiles[0],
  );
  const stage = steps[Math.min(index, steps.length - 1)] as Stage;
  const hasVerifiedEmail = Boolean(
    user?.email_confirmed_at && user.email?.toLowerCase() === email.trim().toLowerCase(),
  );
  const allowedDomains = [
    ...((config.settings as typeof config.settings & { institutionalEmailDomains?: string[] })
      .institutionalEmailDomains ?? []),
  ];
  const domain = email.trim().split("@")[1]?.toLowerCase();
  const hasRecognizedDomain = Boolean(
    domain && allowedDomains.some((allowed) => allowed.trim().toLowerCase() === domain),
  );
  const institution = config.settings.institutionName || form.title;
  // The admin configuration is authoritative: changing or clearing launchDate
  // must immediately affect this public experience, regardless of old form metadata.
  const plannedLaunch = config.settings.launchDate;
  const daysToLaunch = daysUntilCommunityLaunch(plannedLaunch, config.settings.timezone);

  useEffect(() => {
    // The internal 100dvh scroller survives step transitions on mobile.
    // Always reveal the location actions when entering the route step.
    if (stepScrollRef.current) stepScrollRef.current.scrollTop = 0;
    if (index === 0) nameRef.current?.focus({ preventScroll: true });
    else titleRef.current?.focus({ preventScroll: true });
  }, [index, specificPane]);

  function updateAnswer(q: SurveyQuestion | undefined, value: string | string[]) {
    if (!q) return;
    setAnswers((previous) => {
      const next = q.semanticCode?.startsWith("MOBILITY_")
        ? applySimplePainAnswer(schema, previous, q.id, value)
        : { ...previous, [q.id]: value };
      // A participant selecting two or three pains must explicitly choose the
      // main one. A single selected pain already identifies itself.
      if (isF01Express && q.semanticCode === "MOBILITY_PAINS" && painFields.primary) {
        const pains = Array.isArray(next[q.id]) ? next[q.id] as string[] : [];
        const oldPrimary = previous[painFields.primary.id];
        const previousPains = Array.isArray(previous[q.id]) ? previous[q.id] as string[] : [];
        if (pains.length === 1) next[painFields.primary.id] = pains[0];
        else if (previousPains.length > 1 &&
                 typeof oldPrimary === "string" && pains.includes(oldPrimary))
          next[painFields.primary.id] = oldPrimary;
        else delete next[painFields.primary.id];
      }
      if (q.semanticCode === "URBAN_OFFER_VEHICLE" && seatsQuestion) {
        if (value === "MOTO") next[seatsQuestion.id] = "1";
        // A new car selection must be a deliberate declaration of free seats.
        else if (value === "CARRO" && previous[q.id] === "MOTO")
          delete next[seatsQuestion.id];
      }
      const roleValue = roleQuestion ? next[roleQuestion.id] : null;
      return cleanAnswers(schema, next, typeof roleValue === "string" ? roleValue : null);
    });
    setError("");
  }

  function selected(q: SurveyQuestion | undefined): string {
    if (!q) return "";
    const value = answers[q.id];
    return Array.isArray(value) ? (value[0] ?? "") : typeof value === "string" ? value : "";
  }

  function choice(q: SurveyQuestion | undefined, value: string, auto = false) {
    if (!q) return;
    updateAnswer(q, q.type === "multiple_choice" ? [value] : value);
    if (auto) {
      setJourney((previous) => ({ ...previous, profile: value as AcademicRole, mode: "CARONA" }));
      setIndex(2);
    }
  }

  function identityReady(): boolean {
    const name = selected(nameQuestion).trim();
    return (
      name.length >= 2 &&
      name.length <= 80 &&
      Boolean(selected(affiliationQuestion)) &&
      (!captureEnabled || validResearchEmail(email.trim()))
    );
  }

  function verifyCurrent(): string | null {
    if (stage === "identity") {
      if (!identityReady()) return "Informe seu nome, vínculo acadêmico e um e-mail válido.";
    } else if (stage === "role") {
      if (!role) return "Escolha se deseja pegar ou oferecer carona.";
    } else if (stage === "route") {
      if (journey.originArea.trim().length < 2 || journey.destinationArea.trim().length < 2)
        return "Informe uma região de origem e o campus de destino.";
      if (!journey.days.length) return "Selecione os dias em que costuma se deslocar.";
      if (!journey.outboundTime) return "Escolha o horário habitual de saída.";
    } else if (stage === "specific") {
      if (isF01Express && specificPane === "pains") {
        if (role === "MOTORISTA") return null;
        const socialErrors = validateSimpleMobilityPains(schema, answers);
        return socialErrors[0] ?? null;
      }
      const questions =
        role === "MOTORISTA"
          ? [vehicleQuestion, vehicleModelQuestion, seatsQuestion, driverPriority]
          : role === "AMBOS"
            ? [transportQuestion, passengerPriority, vehicleQuestion, vehicleModelQuestion, seatsQuestion, driverPriority]
            : [transportQuestion, passengerPriority];
      const section = {
        title: "Sua preferência",
        questions: questions.filter((q): q is SurveyQuestion => Boolean(q)),
      };
      const issues = validatePage(section, answers, allQuestions, schema, role);
      if (issues.length) return issues[0];
      if (
        role !== "PASSAGEIRO" &&
        selected(vehicleQuestion) === "MOTO" &&
        Number(selected(seatsQuestion)) !== 1
      )
        return "Em uma moto, informe no máximo um passageiro, quando permitido.";
    }
    return null;
  }

  function next() {
    const issue = verifyCurrent();
    if (issue) {
      setError(issue);
      return;
    }
    if (stage === "role" && role)
      setJourney((previous) => ({ ...previous, profile: role, mode: "CARONA" }));
    setError("");
    if (stage === "specific" && isF01Express && specificPane === "profile") {
      if (role === "MOTORISTA") {
        setIndex(4);
        return;
      }
      setSpecificPane("pains");
      return;
    }
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    if (index === 3 && isF01Express && specificPane === "pains") setSpecificPane("profile");
    else if (index === 4 && isF01Express) {
      setSpecificPane(role === "MOTORISTA" ? "profile" : "pains");
      setIndex(3);
    } else setIndex((i) => Math.max(0, i - 1));
    setError("");
  }

  /** GPS is requested only after a tap; precise coordinates are never stored. */
  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation ||
        (typeof window !== "undefined" && window.isSecureContext === false)) {
      setError("A localização atual exige HTTPS e permissão do navegador. Use Buscar localização ou digite o bairro.");
      return;
    }
    setError("");
    setLocationHint("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const location = await reverseGeocodeServerFn({
              data: { lat: position.coords.latitude, lng: position.coords.longitude },
            });
            const area = [location?.neighborhood, location?.city].filter(Boolean).join(" · ")
              || location?.city || "";
            if (area.length < 2) throw Error("Região não identificada.");
            setJourney(previous => ({
              ...previous, originArea: area,
              originLat: null, originLng: null,
            }));
            setError("");
            setLocationHint("Região aproximada identificada. Você pode alterar o bairro antes de continuar.");
          } catch {
            setError("Não foi possível reconhecer o bairro. Use Buscar localização ou digite manualmente.");
          } finally { setLocating(false); }
        })();
      },
      () => { setError("Sem acesso à localização atual. Você pode buscar ou digitar o bairro normalmente."); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function applySearchedOrigin(raw: string) {
    const locality = raw.trim().slice(0, 120);
    if (locality.length < 2) {
      setError("Informe pelo menos duas letras do bairro, região ou município.");
      return;
    }
    // Persist a locality label only. Precise coordinates or residential addresses
    // received from search providers must not be copied to a research journey.
    setJourney(previous => ({ ...previous, originArea: locality, originLat: null, originLng: null }));
    setSearchOriginOpen(false);
    setError("");
    setLocationHint("Região aproximada selecionada. Você pode alterar o bairro.");
  }

  async function submit(requestInterest = false) {
    if (stage !== "activation") {
      next();
      return;
    }
    if (busy || !role) return;
    const cleaned = cleanAnswers(schema, answers, role);
    // A published V2 still requiring pains for everyone needs a new version
    // before a driver can submit without passenger questions.
    if (isF01Express && role === "MOTORISTA" && painFields.pains?.required &&
        !painFields.pains.condition) {
      setError("Este formulário precisa da atualização do fluxo do motorista. Avise a equipe CARONAA.");
      return;
    }
    const problems = schema.sections.flatMap((section) =>
      validatePage(section, cleaned, allQuestions, schema, role),
    );
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    const socialErrors = isF01Express ? validateSimpleMobilityPains(schema, cleaned) : [];
    if (socialErrors.length) {
      setError(socialErrors[0]);
      setSpecificPane("pains");
      setIndex(3);
      return;
    }
    if (!consent) {
      setError("Confirme sua participação na pesquisa.");
      return;
    }
    if (captureEnabled && !validResearchEmail(email.trim())) {
      setError("Confirme um e-mail válido.");
      return;
    }
    if (!validBrazilWhatsapp(whatsapp)) {
      setError("Informe um WhatsApp válido com DDD: (DDD) 9XXXX-XXXX.");
      return;
    }
    if (!linkageConsent) {
      setError("Autorize vincular seu WhatsApp à participação.");
      return;
    }
    let validJourney: ResearchJourney;
    try {
      validJourney = validateJourney(
        { ...journey, profile: role, mode: "CARONA", marketingConsent },
        config.settings,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Revise seu trajeto.");
      setIndex(2);
      return;
    }
    if (previewMode) {
      setComplete(true);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitConfiguredResearch({
        formId: form.id,
        versionId: form.version,
        submissionKey,
        answers: cleaned,
        config,
        journey: validJourney,
        researchConsent: true,
      });
      if (captureEnabled) {
        await captureResearchLead({
          formId: form.id,
          receipt: submissionKey,
          email: email.trim(),
          linkageConsent: true,
          marketingConsent,
        });
      }
      await captureResearchWhatsapp({
        formId: form.id, receipt: submissionKey, whatsapp,
        linkageConsent, contactConsent: whatsappContactConsent,
      });
      try {
        storePendingParticipation(submissionKey, Boolean(plannedLaunch));
      } catch {
        /* Can be recovered with receipt. */
      }
      if (
        user?.email_confirmed_at &&
        (!captureEnabled || user.email?.trim().toLowerCase() === email.trim().toLowerCase())
      ) {
        try {
          await claimResearchParticipation(submissionKey);
        } catch {
          /* Recoverable later. */
        }
      }
      if (requestInterest || prepareInterest) {
        try {
          const profiles: Array<"PASSAGEIRO" | "MOTORISTA"> = role === "AMBOS"
            ? interestRole === "AMBOS" ? ["PASSAGEIRO", "MOTORISTA"] : [interestRole]
            : [role];
          for (const profile of profiles)
            await registerResearchInterest(form.id, submissionKey, profile, true, validJourney);
          setInterestRegistered(true);
        } catch {
          setInterestRegistered(false);
          if (isF01Express) {
            setError("Sua pesquisa foi salva, mas o interesse não foi confirmado. Você pode tentar novamente.");
            return;
          }
        }
      }
      setComplete(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível registrar sua pesquisa.",
      );
    } finally {
      setBusy(false);
    }
  }

  const selectable = (q: SurveyQuestion | undefined, columns = false) => !q ? null : (
    <div
      role="group"
      aria-label={q?.label}
      className={columns ? "grid grid-cols-2 gap-2" : "grid gap-2"}
    >
      {(q?.options ?? []).map((option) => {
        const active = selected(q) === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            className={
              shell +
              " " +
              (active
                ? "border-[#FFBB00] bg-[#FFBB00]/10 text-white"
                : "border-white/15 bg-white/[.04] text-white hover:border-white/40")
            }
            onClick={() => {
              choice(q, option);
              if (isF01Express && q.semanticCode === "ACADEMIC_PASSENGER_PRIORITY" &&
                  (role === "PASSAGEIRO" ||
                   (role === "AMBOS" && selected(vehicleQuestion) && selected(seatsQuestion))))
                setSpecificPane("pains");
              if (isF01Express && role === "MOTORISTA" &&
                  q.semanticCode === "URBAN_OFFER_VEHICLE" && option === "MOTO")
                setIndex(4);
            }}
          >
            <span>{textChoices[option] ?? option}</span>
            {active && <CheckCircle2 size={18} className="shrink-0 text-[#FFBB00]" />}
          </button>
        );
      })}
    </div>
  );

  const heading = {
    identity: isF01Express ? "Sua comunidade, seu caminho" : "Sua universidade, seu caminho",
    role: "Como você quer se deslocar?",
    route: "Qual é seu trajeto?",
    specific:
      isF01Express && specificPane === "pains" ? "Seus desafios no trajeto"
      : role === "MOTORISTA"
        ? isF01Express ? "Seu veículo e suas vagas" : "Seu veículo e sua tranquilidade"
        : role === "AMBOS"
          ? "Seu veículo e sua prioridade"
          : "Como você prefere viajar",
    activation: "Tudo pronto para participar",
  }[stage];
  return (
    <main
      style={{ height: previewMode ? "min(667px, 100dvh)" : "100dvh" }}
      className="relative isolate flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#121212] font-['Manrope'] text-white">
      <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-3 px-4 py-2 sm:px-8 sm:py-4">
        <span className="font-bold tracking-tight text-[#FFBB00]">
          CARONAA <span className="font-normal text-white/75">· {institution}</span>
        </span>
        <span className="text-xs text-white/60">
          Passo {index + 1} de {steps.length}
        </span>
      </div>
      <div
        className="h-[3px] w-full shrink-0 bg-white/10"
        role="progressbar"
        aria-label="Progresso da pesquisa"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
      >
        <div
          className="h-full bg-[#FFBB00] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: ((index + 1) / steps.length) * 100 + "%" }}
        />
      </div>

      <section
        ref={stepScrollRef}
        className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-1 pt-2 sm:px-8 sm:pt-5"
        aria-label="Etapa do questionário"
      >
        {complete ? (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 size={48} className="text-emerald-400" aria-hidden="true" />
            <h1 className="font-['Sora'] text-2xl font-bold sm:text-3xl">
              {previewMode
                ? "Prévia finalizada — nenhuma resposta enviada"
                : interestRegistered === true && daysToLaunch !== null && daysToLaunch > 0
                  ? "Seu interesse está registrado para o lançamento!"
                  : "Sua participação foi registrada"}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-white/70">
              {previewMode
                ? "Prévia local do questionário. Nenhum lead, resposta ou interesse foi gravado."
                : "Seu trajeto de interesse foi salvo para encontrar compatibilidades futuras. Isso não cria reserva, pedido ou oferta confirmada."}
            </p>
            {!previewMode && interestRegistered === true && (
              <p className="text-sm text-emerald-300">
                Interesse no trajeto registrado separadamente.
              </p>
            )}
            {!previewMode && interestRegistered === false && (
              <p role="status" className="text-sm text-amber-300">
                A pesquisa foi salva, mas o interesse adicional não pôde ser registrado. Você poderá
                fazê-lo depois.
              </p>
            )}
            {plannedLaunch && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center">
                <p className="text-3xl font-bold text-[#FFBB00]">
                  {daysToLaunch !== null && daysToLaunch > 0
                    ? daysToLaunch + (daysToLaunch === 1 ? " dia" : " dias")
                    : "Data prevista alcançada"}
                </p>
                <p className="text-sm text-white/75">{institution} · previsão de início: {displaySurveyDate(plannedLaunch)}</p>
                <p className="mt-1 text-xs text-white/60">Você poderá acompanhar oportunidades compatíveis após a liberação da comunidade. A data está sujeita a confirmação.</p>
              </div>
            )}
            {!previewMode && typeof window !== "undefined" && (
              <a className="text-sm font-semibold text-[#FFBB00] underline underline-offset-4"
                href={`https://wa.me/?text=${encodeURIComponent("Participe da pesquisa de mobilidade: " + window.location.href)}`}
                target="_blank" rel="noopener noreferrer">Compartilhar com colegas no WhatsApp</a>
            )}
            {!previewMode && <a
              href={
                user ? "/perfil" : "/auth?mode=cadastro&redirect=" + encodeURIComponent("/perfil")
              }
              className="mt-4 flex min-h-13 w-full items-center justify-center rounded-2xl bg-[#FFBB00] px-5 font-semibold text-[#121212]"
            >
              {user ? "Personalizar meu perfil" : "Criar conta para acompanhar"}
            </a>}
            {!previewMode && <p className="text-xs text-white/50">
              O cadastro e a verificação institucional são etapas independentes.
            </p>}
          </div>
        ) : (
          <div
            key={stage + "-" + specificPane}
            className="mx-auto flex w-full max-w-xl flex-col justify-center gap-2 py-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 sm:my-auto"
          >
            <div className="space-y-2">
              <h1
                tabIndex={-1}
                ref={titleRef}
                className="font-['Sora'] text-[clamp(1.3rem,4.5vw,2.25rem)] font-bold leading-tight tracking-tight outline-none"
              >
                {heading}
              </h1>
              <p className="text-sm leading-5 text-white/60">
                {stage === "identity"
                  ? "Em poucos toques, conhecemos seu perfil acadêmico."
                  : stage === "role"
                    ? "Escolha seu papel para ver somente as perguntas que fazem sentido."
                    : stage === "route"
                      ? "Informe somente a região aproximada e seus horários habituais."
                      : stage === "specific"
                        ? isF01Express && specificPane === "pains"
                          ? "Escolha até três dificuldades. A principal aparece na mesma tela."
                          : "Responda às escolhas essenciais para o seu perfil."
                        : "Confira suas autorizações antes de registrar o interesse."}
              </p>
            </div>

            {stage === "identity" && (
              <>
                <label className={label} htmlFor={id + "-name"}>
                  {isF01Express ? "Nome completo" : "Seu nome"}
                  <input
                    id={id + "-name"}
                    ref={nameRef}
                    autoComplete="name"
                    value={selected(nameQuestion)}
                    onChange={(event) => updateAnswer(nameQuestion, event.target.value)}
                    placeholder={isF01Express ? "Seu nome completo" : "Como prefere ser chamado(a)"}
                    maxLength={80}
                    className={field + " mt-2"}
                  />
                </label>
                <div className="space-y-2">
                  <p className={label}>Seu vínculo</p>
                  <select
                    className={field}
                    aria-label="Vínculo com a universidade"
                    value={selected(affiliationQuestion)}
                    onChange={event => updateAnswer(affiliationQuestion, event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {affiliationQuestion?.options.map(value => (
                      <option key={value} value={value}>{textChoices[value] ?? value}</option>
                    ))}
                  </select>
                </div>
                {captureEnabled && (
                  <label className={label} htmlFor={id + "-email"}>
                    E-mail para reconhecer sua participação
                    <input
                      id={id + "-email"}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                      }}
                      placeholder="voce@universidade.br"
                      className={field + " mt-2"}
                    />
                  </label>
                )}
                {captureEnabled && validResearchEmail(email) && (
                  <p role="status"
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5 ${hasRecognizedDomain
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/[.03] text-white/65"}`}>
                    {hasRecognizedDomain && <CheckCircle2 className="mt-0.5 shrink-0" size={15} aria-hidden="true" />}
                    <span>{hasRecognizedDomain
                      ? "Domínio de " + institution + " reconhecido imediatamente. O vínculo e o acesso dependem da verificação do e-mail."
                      : hasVerifiedEmail
                        ? "E-mail confirmado na conta; vínculo institucional ainda não verificado."
                        : "E-mail externo: será necessário ativar sua conta para acessar a plataforma."}</span>
                  </p>
                )}
              </>
            )}

            {stage === "role" && (
              <fieldset className="space-y-2">
                <legend className={label + " mb-2"}>Como pretende usar o CARONAA?</legend>
                {(["PASSAGEIRO", "MOTORISTA", "AMBOS"] as const).filter(value => config.settings.profiles.includes(value)).map((value) => {
                  const active = role === value;
                  return (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={active}
                      className={
                        shell +
                        " mb-2 " +
                        (active
                          ? "border-[#FFBB00] bg-[#FFBB00]/10"
                          : "border-white/15 bg-white/[.04]")
                      }
                      onClick={() => {
                        choice(roleQuestion, value, true);
                        setJourney((previous) => ({
                          ...previous,
                          profile: value,
                          mode: "CARONA",
                          days: [],
                          outboundTime: "",
                          returnTime: "",
                          otherOutboundTime: false,
                          otherReturnTime: false,
                        }));
                        setError("");
                      }}
                    >
                      <span className="flex items-center gap-3">{value === "PASSAGEIRO" ? <CarFront size={21} /> : value === "MOTORISTA" ? <SteeringWheel size={21} /> : <ArrowLeftRight size={21} />}{roleNames[value]}</span>
                      <ChevronRight size={18} className="text-[#FFBB00]" />
                    </button>
                  );
                })}
              </fieldset>
            )}

            {stage === "route" && (
              <>
                <p className="text-xs font-semibold text-[#FFBB00]">Defina sua localização de origem</p>
                <div role="group" aria-label="Ferramentas de localização"
                  className="grid w-full min-w-0 grid-cols-2 gap-2">
                  <button type="button" onClick={useCurrentLocation} disabled={locating}
                    aria-label="Usar localização atual"
                    className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-[#FFBB00]/45 bg-[#FFBB00]/[.08] px-2 py-2 text-xs font-semibold leading-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00] disabled:opacity-50">
                    <MapPin size={16} className="shrink-0 text-[#FFBB00]" aria-hidden="true"/>
                    <span>{locating ? "Localizando…" : "Usar localização atual"}</span>
                  </button>
                  <button type="button"
                    aria-label="Buscar localização"
                    onClick={() => { setSearchOriginDraft(journey.originArea); setSearchOriginOpen(true); setError(""); }}
                    className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-[#FFBB00]/45 bg-[#FFBB00]/[.08] px-2 py-2 text-xs font-semibold leading-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00] disabled:opacity-50">
                    <Search size={16} className="shrink-0 text-[#FFBB00]" aria-hidden="true"/>
                    <span>Buscar localização</span>
                  </button>
                </div>
                <p className="text-xs leading-5 text-white/55">
                  Busque um bairro ou use o GPS com sua permissão. Também pode digitar a região no campo abaixo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    Bairro ou região de origem
                    <input
                      autoComplete="off"
                      value={journey.originArea}
                      maxLength={120}
                      onChange={(e) =>
                        setJourney((p) => ({
                          ...p,
                          originArea: e.target.value,
                          originLat: null,
                          originLng: null,
                        }))
                      }
                      placeholder={isF01Express ? "Bairro ou região de origem" : "Ex.: Maracanaú"}
                      className={field + " mt-2"}
                      aria-label="Bairro ou região de origem"
                    />
                  </label>
                  <label className={label}>
                    Campus ou destino
                    <input
                      autoComplete="off"
                      value={journey.destinationArea}
                      maxLength={120}
                      onChange={(e) =>
                        setJourney((p) => ({
                          ...p,
                          destinationArea: e.target.value,
                          destinationLat: null,
                          destinationLng: null,
                        }))
                      }
                      placeholder={institution}
                      className={field + " mt-2"}
                    />
                  </label>
                </div>
                {locationHint && <p role="status" className="text-xs text-emerald-300">{locationHint}</p>}
                <div className="space-y-2">
                  <p className={label}>Dias habituais</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className={
                        "min-h-11 rounded-xl border px-3 text-xs font-semibold " +
                        ([1, 2, 3, 4, 5].every((d) => journey.days.includes(d))
                          ? "border-[#FFBB00] text-[#FFBB00]"
                          : "border-white/20")
                      }
                      onClick={() =>
                        setJourney((p) => ({
                          ...p,
                          days: [1, 2, 3, 4, 5].filter((d) => roleSettings.days.includes(d)),
                        }))
                      }
                    >
                      Seg–Sex
                    </button>
                    {roleSettings.days.map((day) => (
                      <button
                        type="button"
                        key={day}
                        aria-pressed={journey.days.includes(day)}
                        className={
                          "min-h-11 min-w-11 rounded-xl border px-2 text-xs font-semibold " +
                          (journey.days.includes(day)
                            ? "border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]"
                            : "border-white/20 text-white/70")
                        }
                        onClick={() =>
                          setJourney((p) => ({
                            ...p,
                            days: p.days.includes(day)
                              ? p.days.filter((d) => d !== day)
                              : [...p.days, day].sort(),
                          }))
                        }
                      >
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][day - 1]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    Horário de ida
                    <select
                      className={field + " mt-2"}
                      aria-label="Horário habitual de saída"
                      value={journey.otherOutboundTime ? "OUTRO" : journey.outboundTime}
                      onChange={(e) =>
                        setJourney((p) => ({
                          ...p,
                          outboundTime: e.target.value === "OUTRO" ? "" : e.target.value,
                          otherOutboundTime: e.target.value === "OUTRO",
                        }))
                      }
                    >
                      <option value="">Selecione</option>
                      {roleSettings.outboundTimes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                      <option value="OUTRO">Outro horário</option>
                    </select>
                    {journey.otherOutboundTime && (
                      <input
                        aria-label="Outro horário de ida"
                        type="time"
                        value={journey.outboundTime}
                        className={field + " mt-2"}
                        onChange={(e) =>
                          setJourney((p) => ({ ...p, outboundTime: e.target.value }))
                        }
                      />
                    )}
                  </label>
                  <label className={label}>
                    Horário de retorno (opcional)
                    <select
                      className={field + " mt-2"}
                      aria-label="Horário habitual de retorno"
                      value={journey.otherReturnTime ? "OUTRO" : journey.returnTime}
                      onChange={(e) =>
                        setJourney((p) => ({
                          ...p,
                          returnTime: e.target.value === "OUTRO" ? "" : e.target.value,
                          otherReturnTime: e.target.value === "OUTRO",
                          direction: e.target.value ? "IDA_E_VOLTA" : "IDA",
                        }))
                      }
                    >
                      <option value="">Sem retorno fixo</option>
                      {roleSettings.returnTimes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                      <option value="OUTRO">Outro horário</option>
                    </select>
                    {journey.otherReturnTime && (
                      <input
                        aria-label="Outro horário de retorno"
                        type="time"
                        value={journey.returnTime}
                        className={field + " mt-2"}
                        onChange={(e) => setJourney((p) => ({ ...p, returnTime: e.target.value }))}
                      />
                    )}
                  </label>
                </div>
                <p className="flex items-start gap-2 text-xs leading-5 text-white/50">
                  <MapPin size={15} className="shrink-0" />
                  Não pedimos endereço residencial; esta é uma intenção de trajeto, não uma reserva.
                </p>
              </>
            )}

            {stage === "specific" && (!isF01Express || specificPane === "profile") && role === "PASSAGEIRO" && (
              <>
                {!isF01Express && <div className="space-y-2">
                  <p className={label}>Como você vai hoje?</p>
                  {selectable(transportQuestion, true)}
                </div>}
                <div className="space-y-2">
                  <p className={label}>Sua prioridade ao pegar carona</p>
                  {selectable(passengerPriority, true)}
                </div>
              </>
            )}

            {stage === "specific" && (!isF01Express || specificPane === "profile") && (role === "MOTORISTA" || role === "AMBOS") && (
              <>
                <div className="space-y-2">
                  <p className={label}>Qual veículo usaria?</p>
                  {selectable(vehicleQuestion, true)}
                </div>
                {!isF01Express && <label className={label}>
                  Marca / modelo (opcional)
                  <input
                    className={field + " mt-2"}
                    maxLength={80}
                    value={selected(vehicleModelQuestion)}
                    onChange={(e) => updateAnswer(vehicleModelQuestion, e.target.value)}
                    placeholder="Ex.: Honda Fit"
                  />
                </label>}
                {isF01Express && selected(vehicleQuestion) === "MOTO" ? (
                  <p role="status" className="rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/10 px-4 py-3 text-sm text-[#FFBB00]">
                    <CheckCircle2 className="mr-2 inline h-4 w-4" />
                    Moto: 1 vaga de passageiro definida automaticamente.
                  </p>
                ) : (
                <div className="space-y-2">
                  <p className={label}>Vagas livres, sem contar o motorista</p>
                  <div className={isF01Express ? "grid grid-cols-4 gap-2" : "grid grid-cols-5 gap-2"}>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={
                          "min-h-[52px] rounded-xl border text-base font-semibold " +
                          (selected(seatsQuestion) === String(n)
                            ? "border-[#FFBB00] bg-[#FFBB00]/15"
                            : "border-white/20")
                        }
                        onClick={() => {
                          updateAnswer(seatsQuestion, String(n));
                          setCustomSeats(false);
                          if (isF01Express && role === "MOTORISTA")
                            setIndex(4);
                          else if (isF01Express && role === "AMBOS" &&
                                   selected(passengerPriority) && selected(vehicleQuestion))
                            setSpecificPane("pains");
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    {!isF01Express && <button
                      type="button"
                      aria-label="Informar outra quantidade de vagas"
                      aria-pressed={customSeats}
                      onClick={() => setCustomSeats(true)}
                      className={
                        "min-h-[52px] rounded-xl border text-base " +
                        (customSeats ? "border-[#FFBB00]" : "border-white/20")
                      }
                    >
                      5–7
                    </button>}
                  </div>
                  {customSeats && !isF01Express && (
                    <input
                      aria-label="Quantidade personalizada de vagas"
                      type="number"
                      min={1}
                      max={7}
                      step={1}
                      value={selected(seatsQuestion)}
                      onChange={(e) => updateAnswer(seatsQuestion, e.target.value)}
                      className={field + " mt-2"}
                    />
                  )}
                  {isF01Express && selected(vehicleQuestion) === "CARRO" && (
                    <label className={label}>
                      Ou digite as vagas disponíveis (1 a 4)
                      <input
                        aria-label="Quantidade de vagas do carro"
                        type="number" inputMode="numeric" min={1} max={4} step={1}
                        value={selected(seatsQuestion)}
                        onChange={e => {
                          const value = e.target.value;
                          if (value === "" || /^[1-4]$/.test(value))
                            updateAnswer(seatsQuestion, value);
                        }}
                        className={field + " mt-1"}
                      />
                    </label>
                  )}
                </div>
                )}
                {!isF01Express && (role === "MOTORISTA" || role === "AMBOS") && (
                  <div className="space-y-2">
                    <p className={label}>O que é mais importante para você ao dirigir?</p>
                    {selectable(driverPriority, true)}
                  </div>
                )}
                {role === "AMBOS" && (
                  <>
                    {!isF01Express && <div className="space-y-2">
                      <p className={label}>Como você costuma se deslocar como passageiro?</p>
                      {selectable(transportQuestion, true)}
                    </div>}
                    <div className="space-y-2">
                      <p className={label}>Como passageiro, qual é sua prioridade?</p>
                      {selectable(passengerPriority, true)}
                    </div>
                  </>
                )}
                {!isF01Express && <p className="text-xs leading-5 text-white/50">
                  O CARONAA calculará valores pelo trajeto real; não há promessa de ganhos, Pix ou
                  passageiro confirmado.
                </p>}
              </>
            )}

            {stage === "specific" && isF01Express && specificPane === "pains" && role !== "MOTORISTA" && painFields.pains && painFields.primary && (
              <div className="space-y-3">
                <div role="group" aria-label="O que mais dificulta seu deslocamento?" className="grid grid-cols-2 gap-1.5">
                  {painFields.pains.options.map(option => {
                    const active = selectedPains.includes(option);
                    return <button key={option} type="button" aria-pressed={active}
                      onClick={() => {
                        const next = active ? selectedPains.filter(pain => pain !== option)
                          : option === "SEM_DIFICULDADES" ? [option]
                          : [...selectedPains.filter(pain => pain !== "SEM_DIFICULDADES"), option];
                        updateAnswer(painFields.pains, next);
                      }}
                      className={"min-h-11 rounded-xl border px-2 py-1.5 text-xs leading-4 transition-colors " +
                        (active ? "border-[#FFBB00] bg-[#FFBB00]/10 text-[#FFBB00]"
                          : "border-white/10 bg-white/[.04] text-white/80")}>
                      {textChoices[option] ?? option}
                    </button>;
                  })}
                </div>
                {selectedPains.length > 1 && (
                  <fieldset className="space-y-1">
                    <legend className={label}>Qual dessas é a principal?</legend>
                    <div className="grid grid-cols-2 gap-1.5">
                      {selectedPains.map(option => (
                        <button key={option} type="button" aria-pressed={selected(painFields.primary) === option}
                          onClick={() => updateAnswer(painFields.primary, option)}
                          className={"min-h-10 rounded-xl border px-2 text-xs " +
                            (selected(painFields.primary) === option
                              ? "border-[#FFBB00] bg-[#FFBB00]/10 text-[#FFBB00]" : "border-white/10")}>
                          {textChoices[option] ?? option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {selectedPains.includes("OUTRA") && painFields.other && (
                  <label className={label}>
                    Outra dificuldade
                    <input value={selected(painFields.other)} maxLength={140}
                      onChange={event => updateAnswer(painFields.other, event.target.value)}
                      placeholder="Escreva em poucas palavras" className={field + " mt-1"}/>
                  </label>
                )}
              </div>
            )}

            {stage === "activation" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                  <p className="text-sm font-semibold text-[#FFBB00]">Resumo do seu interesse</p>
                  <p className="mt-1 text-sm text-white/85">{journey.originArea} → {journey.destinationArea}</p>
                  <p className="mt-1 text-xs text-white/60">
                    {role ? roleNames[role] : ""} · {journey.days.map(day => ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][day - 1]).join(", ")} · {journey.outboundTime}
                    {role !== "PASSAGEIRO" && selected(vehicleQuestion) &&
                      " · " + (selected(vehicleQuestion) === "MOTO" ? "Moto" : "Carro") +
                      " · " + selected(seatsQuestion) + " vaga(s)"}
                  </p>
                </div>
                <label className={label} htmlFor={id + "-whatsapp"}>
                  WhatsApp com DDD
                  <input id={id + "-whatsapp"} type="tel" inputMode="tel" autoComplete="tel-national"
                    required maxLength={15} value={whatsapp}
                    onChange={event => { setWhatsapp(formatBrazilWhatsapp(event.target.value)); setError(""); }}
                    placeholder="(85) 99999-0000" className={field + " mt-2"} />
                  <span className="mt-1 block text-xs font-normal text-white/55">Contato privado no CRM. Mensagens exigem autorização opcional.</span>
                </label>
                {plannedLaunch && (isF01Express ? (
                  <p className="rounded-xl border border-[#FFBB00]/25 bg-[#FFBB00]/[.06] px-3 py-2 text-xs text-white/75">
                    <span className="font-semibold text-[#FFBB00]">
                      {daysToLaunch !== null && daysToLaunch > 0
                        ? `${daysToLaunch} ${daysToLaunch === 1 ? "dia" : "dias"} para o início previsto`
                        : "Data prevista alcançada"}
                    </span>
                    {" · "}{displaySurveyDate(plannedLaunch)} · {institution}. Sujeito a confirmação.
                  </p>
                ) : (
                  <div className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/[.06] p-4">
                    <p className="text-sm font-semibold">
                      Previsão de presença: {displaySurveyDate(plannedLaunch)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Data informada pela organização, sujeita a confirmação. Nenhuma viagem será
                      agendada automaticamente.
                    </p>
                  </div>
                ))}
                {isF01Express ? (
                  <p className="text-xs leading-5 text-white/60">
                    Pré-agendar registra só sua intenção de carona, com seu consentimento. Não é reserva ou match confirmado.
                  </p>
                ) : (
                  <label className="flex min-h-13 items-start gap-3 text-sm leading-6">
                    <input type="checkbox" className="mt-1.5 accent-[#FFBB00]"
                      checked={prepareInterest} onChange={(e) => setPrepareInterest(e.target.checked)}/>
                    <span>Quero registrar interesse no meu trajeto quando houver disponibilidade
                      (opcional). Não é uma reserva.</span>
                  </label>
                )}
                {(prepareInterest || isF01Express) && role === "AMBOS" && (
                  <div className="flex gap-2" role="group" aria-label="Tipo de interesse inicial">
                    {(isF01Express ? (["PASSAGEIRO", "MOTORISTA", "AMBOS"] as const) : (["PASSAGEIRO", "MOTORISTA"] as const)).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={interestRole === r}
                        onClick={() => setInterestRole(r)}
                        className={
                          "min-h-12 flex-1 rounded-xl border px-3 text-sm " +
                          (interestRole === r ? "border-[#FFBB00]" : "border-white/20")
                        }
                      >
                        {r === "PASSAGEIRO" ? "Encontrar" : r === "MOTORISTA" ? "Oferecer" : "Ambos"}
                      </button>
                    ))}
                  </div>
                )}
                <label className="flex items-start gap-3 text-xs leading-5">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 accent-[#FFBB00]"
                  />
                  <span>{isF01Express
                    ? "Li o aviso de privacidade e aceito participar da pesquisa."
                    : "Concordo em participar da pesquisa e com o tratamento das respostas conforme o aviso de privacidade."}</span>
                </label>
                {(
                  <label className="flex items-start gap-3 text-xs leading-5">
                    <input
                      type="checkbox"
                      required
                      checked={linkageConsent}
                      onChange={(e) => setLinkageConsent(e.target.checked)}
                      className="mt-1 accent-[#FFBB00]"
                    />
                    <span>{captureEnabled
                      ? "Autorizo vincular esta participação ao meu e-mail e WhatsApp no CRM."
                      : "Autorizo vincular esta participação ao meu WhatsApp no CRM."}</span>
                  </label>
                )}
                <label className="flex items-start gap-3 text-xs leading-5 text-white/65">
                  <input type="checkbox" checked={whatsappContactConsent}
                    onChange={event => setWhatsappContactConsent(event.target.checked)}
                    className="mt-1 accent-[#FFBB00]" />
                  <span>Aceito receber novidades do CARONAA pelo WhatsApp (opcional).</span>
                </label>
                {captureEnabled && (isF01Express ? (
                  <details className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2">
                    <summary className="cursor-pointer text-xs text-white/70">Preferências de comunicação (opcional)</summary>
                    <label className="mt-2 flex items-start gap-2 text-xs text-white/70">
                      <input type="checkbox" checked={marketingConsent}
                        onChange={(event) => setMarketingConsent(event.target.checked)}
                        className="mt-1 accent-[#FFBB00]"/>
                      Aceito receber novidades do CARONAA por e-mail.
                    </label>
                  </details>
                ) : (
                  <label className="flex items-start gap-3 text-xs leading-5 text-white/65">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-1 accent-[#FFBB00]"
                    />
                    <span>Quero receber novidades do CARONAA por e-mail (opcional).</span>
                  </label>
                ))}
                {!isF01Express && <p className="flex items-start gap-2 text-xs leading-5 text-white/55">
                  <ShieldCheck size={16} className="shrink-0 text-[#FFBB00]" />
                  Responder à pesquisa não comprova matrícula, não cria conta, nem libera acesso
                  antecipado à plataforma.
                </p>}
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/40 bg-red-950/30 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </section>

      {searchOriginOpen && (
        <div role="dialog" aria-modal="true" aria-label="Buscar bairro ou região"
          className="absolute inset-0 z-50 flex min-h-0 flex-col bg-[#121212]/95 p-4 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-y-auto pt-[env(safe-area-inset-top)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-['Sora'] text-xl font-bold">Buscar localização</h2>
                <p className="mt-1 text-xs text-white/60">Busque um bairro, campus ou município. Salvará somente sua região aproximada.</p>
              </div>
              <button type="button" aria-label="Fechar busca" onClick={() => setSearchOriginOpen(false)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/15">
                <X size={18}/>
              </button>
            </div>
            <LocationAutocomplete id={id + "-origin-search"} variant="glass"
              autoFocus value={searchOriginDraft} onChange={value => setSearchOriginDraft(value)}
              onSelect={(value,details) => applySearchedOrigin(details.neighborhood || details.city || value)}
              label="Localidade de origem" placeholder="Digite o bairro, município ou local..." />
            <button type="button" onClick={() => applySearchedOrigin(searchOriginDraft)}
              disabled={searchOriginDraft.trim().length < 2}
              className="min-h-11 rounded-xl bg-[#FFBB00] px-4 text-sm font-semibold text-[#121212] disabled:opacity-40">
              Usar localidade digitada
            </button>
            <p className="text-xs text-white/50">Caso as sugestões não estejam disponíveis, você pode usar a região digitada sem conceder GPS.</p>
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          </div>
        </div>
      )}
      {!complete && (
        <div className="z-10 mx-auto flex w-full max-w-3xl shrink-0 flex-wrap gap-2 border-t border-white/10 bg-[#121212]/90 px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl sm:px-8">
          <button
            type="button"
            onClick={back}
            disabled={index === 0 || busy}
            aria-label="Voltar etapa"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/20 disabled:opacity-30"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            disabled={
              busy || (stage === "activation" && (!consent || !linkageConsent))
            }
            onClick={
              stage === "activation"
                ? () => { void submit(isF01Express); }
                : next
            }
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-sm font-bold text-[#121212] disabled:opacity-50"
          >
            {busy
              ? "Registrando…"
              : stage === "activation"
                ? isF01Express
                  ? "Pré-agendar meu interesse"
                  : "Registrar participação"
                : "Continuar"}
            {stage !== "activation" && <ArrowRight size={18} />}
          </button>
          {isF01Express && stage === "activation" && (
            <button type="button" disabled={busy || !consent || !linkageConsent}
              onClick={() => void submit(false)}
              className="min-h-9 w-full rounded-xl border border-white/10 text-xs text-white/70 disabled:opacity-40">
              Enviar apenas a pesquisa (sem registrar trajeto)
            </button>
          )}
        </div>
      )}
    </main>
  );
}
