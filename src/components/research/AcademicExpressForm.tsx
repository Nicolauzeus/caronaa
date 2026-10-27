import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CarFront,
  SteeringWheel,
  ArrowLeftRight,
  MapPin,
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
import { academicExpressSteps, isAcademicExpressF01, type AcademicRole } from "@/lib/formulario/academic-express-schema";
import { applySimplePainAnswer, simplePainFields, validateSimpleMobilityPains } from "@/lib/formulario/mobility-simple";
import { reverseGeocodeServerFn } from "@/lib/location.functions";
import { cleanAnswers, validatePage, type Answers } from "@/lib/formulario/research-schema";
import { validResearchEmail, captureResearchLead } from "@/lib/formulario/research-lead";
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
  "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFBB00]";
const field =
  "min-h-[52px] w-full min-w-0 rounded-xl border border-white/20 bg-[#202020] px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-[#FFBB00] focus:ring-2 focus:ring-[#FFBB00]/30";
const label = "block text-xs font-semibold tracking-wide text-white/75";

export function AcademicExpressForm({
  form,
  captureEnabled,
  user,
}: {
  form: AcademicForm;
  captureEnabled: boolean;
  user?: { email?: string | null; email_confirmed_at?: string | null } | null;
}) {
  const config = form.configuration!;
  const schema = form.schema;
  const isF01Express = isAcademicExpressF01(schema);
  const painFields = simplePainFields(schema);
  const id = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [interestRegistered, setInterestRegistered] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [linkageConsent, setLinkageConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
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
    domain && allowedDomains.some((allowed) => allowed.toLowerCase() === domain),
  );
  const institution = config.settings.institutionName || form.title;
  const suggestedTimes = [
    roleSettings.outboundTimes.find(t => Number(t.slice(0, 2)) < 12),
    roleSettings.outboundTimes.find(t => Number(t.slice(0, 2)) >= 12 && Number(t.slice(0, 2)) < 18),
    roleSettings.outboundTimes.find(t => Number(t.slice(0, 2)) >= 18),
  ].filter((t): t is string => Boolean(t));
  const plannedLaunch = form.caronaaPresenceOn || config.settings.launchDate;
  const daysToLaunch = plannedLaunch
    ? Math.max(0, Math.ceil((new Date(plannedLaunch + "T00:00:00-03:00").getTime() - Date.now()) / 86_400_000))
    : null;

  useEffect(() => {
    if (index === 0) nameRef.current?.focus({ preventScroll: true });
    else titleRef.current?.focus({ preventScroll: true });
  }, [index, specificPane]);

  function updateAnswer(q: SurveyQuestion | undefined, value: string | string[]) {
    if (!q) return;
    setAnswers((previous) => {
      const next = q.semanticCode?.startsWith("MOBILITY_")
        ? applySimplePainAnswer(schema, previous, q.id, value)
        : { ...previous, [q.id]: value };
      if (q.semanticCode === "URBAN_OFFER_VEHICLE" && value === "MOTO" && seatsQuestion)
        next[seatsQuestion.id] = "1";
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
      setSpecificPane("pains");
      return;
    }
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    if (index === 3 && isF01Express && specificPane === "pains") setSpecificPane("profile");
    else if (index === 4 && isF01Express) {
      setSpecificPane("pains");
      setIndex(3);
    } else setIndex((i) => Math.max(0, i - 1));
    setError("");
  }

  /** GPS is requested only after a tap, and only the approximate locality is saved. */
  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation ||
        (typeof window !== "undefined" && !window.isSecureContext)) {
      setError("Localização indisponível. Informe seu bairro ou município manualmente.");
      return;
    }
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
          } catch {
            setError("Não foi possível identificar o bairro. Digite sua região manualmente.");
          } finally { setLocating(false); }
        })();
      },
      () => { setError("Permissão de localização não concedida. Digite sua região."); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function submit() {
    if (stage !== "activation") {
      next();
      return;
    }
    if (busy || !role) return;
    const cleaned = cleanAnswers(schema, answers, role);
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
    if (captureEnabled && (!validResearchEmail(email.trim()) || !linkageConsent)) {
      setError("Confirme seu e-mail e a autorização de reconhecimento.");
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
      if (prepareInterest) {
        try {
          const profiles: Array<"PASSAGEIRO" | "MOTORISTA"> = role === "AMBOS"
            ? interestRole === "AMBOS" ? ["PASSAGEIRO", "MOTORISTA"] : [interestRole]
            : [role];
          for (const profile of profiles)
            await registerResearchInterest(form.id, submissionKey, profile, true, validJourney);
          setInterestRegistered(true);
        } catch {
          setInterestRegistered(false);
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

  const selectable = (q: SurveyQuestion | undefined, columns = false) => (
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
            onClick={() => choice(q, option)}
          >
            <span>{textChoices[option] ?? option}</span>
            {active && <CheckCircle2 size={18} className="shrink-0 text-[#FFBB00]" />}
          </button>
        );
      })}
    </div>
  );

  const heading = {
    identity: "Sua universidade, seu caminho",
    role: "Como você quer se deslocar?",
    route: "Qual é seu trajeto?",
    specific:
      isF01Express && specificPane === "pains" ? "Seus desafios no trajeto"
      : role === "MOTORISTA"
        ? "Seu veículo e sua tranquilidade"
        : role === "AMBOS"
          ? "Seu veículo e sua prioridade"
          : "Como você prefere viajar",
    activation: "Tudo pronto para participar",
  }[stage];
  return (
    <main className="relative isolate flex h-[100dvh] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#121212] font-['Manrope'] text-white">
      <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-5">
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
        className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-2 pt-3 sm:px-8 sm:pt-7"
        aria-label="Etapa do questionário"
      >
        {complete ? (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 text-center">
            <CheckCircle2 size={48} className="text-emerald-400" aria-hidden="true" />
            <h1 className="font-['Sora'] text-2xl font-bold sm:text-3xl">
              {interestRegistered === true && plannedLaunch ? "Você está na lista da viagem inaugural!" : "Sua participação foi registrada"}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-white/70">
              Seu trajeto de interesse foi salvo para encontrar compatibilidades futuras.
              Isso não cria reserva, pedido ou oferta confirmada.
            </p>
            {interestRegistered === true && (
              <p className="text-sm text-emerald-300">
                Interesse no trajeto registrado separadamente.
              </p>
            )}
            {interestRegistered === false && (
              <p role="status" className="text-sm text-amber-300">
                A pesquisa foi salva, mas o interesse adicional não pôde ser registrado. Você poderá
                fazê-lo depois.
              </p>
            )}
            {plannedLaunch && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center">
                <p className="text-3xl font-bold text-[#FFBB00]">{daysToLaunch} dias</p>
                <p className="text-sm text-white/75">{institution} · previsão de início: {displaySurveyDate(plannedLaunch)}</p>
                <p className="mt-1 text-xs text-white/60">Você poderá acompanhar oportunidades compatíveis após a liberação da comunidade. A data está sujeita a confirmação.</p>
              </div>
            )}
            {typeof window !== "undefined" && (
              <a className="text-sm font-semibold text-[#FFBB00] underline underline-offset-4"
                href={`https://wa.me/?text=${encodeURIComponent("Participe da pesquisa de mobilidade: " + window.location.href)}`}
                target="_blank" rel="noopener noreferrer">Compartilhar com colegas no WhatsApp</a>
            )}
            <a
              href={
                user ? "/perfil" : "/auth?mode=cadastro&redirect=" + encodeURIComponent("/perfil")
              }
              className="mt-4 flex min-h-13 w-full items-center justify-center rounded-2xl bg-[#FFBB00] px-5 font-semibold text-[#121212]"
            >
              {user ? "Personalizar meu perfil" : "Criar conta para acompanhar"}
            </a>
            <p className="text-xs text-white/50">
              O cadastro e a verificação institucional são etapas independentes.
            </p>
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
                  {isF01Express ? (
                    <div role="group" aria-label="Vínculo com a universidade" className="grid grid-cols-2 gap-2">
                      {affiliationQuestion?.options.map(value => (
                        <button key={value} type="button" aria-pressed={selected(affiliationQuestion) === value}
                          onClick={() => updateAnswer(affiliationQuestion, value)}
                          className={"min-h-11 rounded-2xl border px-3 py-2 text-sm transition-colors " +
                            (selected(affiliationQuestion) === value
                              ? "border-[#FFBB00] bg-[#FFBB00]/10 text-[#FFBB00]"
                              : "border-white/10 bg-white/[.04] text-white/80")}>
                          {textChoices[value] ?? value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <select
                      className={field}
                      aria-label="Vínculo com a universidade"
                      value={selected(affiliationQuestion)}
                      onChange={(event) => updateAnswer(affiliationQuestion, event.target.value)}
                    >
                      <option value="">Selecione</option>
                      {affiliationQuestion?.options.map((v) => (
                        <option key={v} value={v}>{textChoices[v] ?? v}</option>
                      ))}
                    </select>
                  )}
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
                  <p
                    role="status"
                    className={`rounded-xl border px-3 py-2 text-xs leading-5 ${hasRecognizedDomain ? "border-[#FFBB00]/25 bg-[#FFBB00]/[.06] text-[#FFBB00]" : "border-white/10 bg-white/[.03] text-white/65"}`}
                  >
                    {hasRecognizedDomain
                      ? isF01Express
                        ? "✓ Domínio da comunidade " + institution + " reconhecido · a titularidade e o acesso dependem de autenticação."
                        : "Domínio institucional reconhecido. Confirme a titularidade para validar seu acesso."
                      : hasVerifiedEmail
                        ? "E-mail confirmado na conta; vínculo institucional não verificado."
                        : "Link de ativação será necessário após o cadastro. E-mail informado não libera acesso."}
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
                {isF01Express && (
                  <button type="button" onClick={useCurrentLocation} disabled={locating}
                    className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/80 disabled:opacity-50">
                    <MapPin size={15} aria-hidden="true" />
                    {locating ? "Localizando…" : "Usar meu bairro atual (opcional)"}
                  </button>
                )}
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
                {isF01Express && (
                  <fieldset className="space-y-2">
                    <legend className={label}>Horário habitual de saída</legend>
                    <div className="grid grid-cols-4 gap-2">
                      {suggestedTimes.map(time => (
                        <button key={time} type="button" aria-pressed={journey.outboundTime === time && !journey.otherOutboundTime}
                          onClick={() => setJourney(p => ({ ...p, outboundTime: time, otherOutboundTime: false }))}
                          className={"min-h-11 rounded-xl border px-1.5 text-xs font-semibold " +
                            (journey.outboundTime === time && !journey.otherOutboundTime
                              ? "border-[#FFBB00] bg-[#FFBB00]/10 text-[#FFBB00]"
                              : "border-white/15 bg-white/5 text-white")}>
                          {Number(time.slice(0, 2)) < 12 ? "Manhã" : Number(time.slice(0, 2)) < 18 ? "Tarde" : "Noite"} · {time}
                        </button>
                      ))}
                      <button type="button" aria-pressed={journey.otherOutboundTime}
                        onClick={() => setJourney(p => ({ ...p, otherOutboundTime: true, outboundTime: "" }))}
                        className={"min-h-11 rounded-xl border px-1 text-xs " +
                          (journey.otherOutboundTime ? "border-[#FFBB00] text-[#FFBB00]" : "border-white/15")}>
                        Outro
                      </button>
                    </div>
                    {journey.otherOutboundTime && (
                      <input aria-label="Horário personalizado de saída" type="time"
                        value={journey.outboundTime}
                        onChange={event => setJourney(p => ({ ...p, outboundTime: event.target.value }))}
                        className={field}/>
                    )}
                  </fieldset>
                )}
                {!isF01Express && (
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
                )}
                <p className="flex items-start gap-2 text-xs leading-5 text-white/50">
                  <MapPin size={15} className="shrink-0" />
                  Não pedimos endereço residencial; esta é uma intenção de trajeto, não uma reserva.
                </p>
              </>
            )}

            {stage === "specific" && (!isF01Express || specificPane === "profile") && role === "PASSAGEIRO" && (
              <>
                <div className="space-y-2">
                  <p className={label}>Como você vai hoje?</p>
                  {selectable(transportQuestion, true)}
                </div>
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
                <label className={label}>
                  Marca / modelo (opcional)
                  <input
                    className={field + " mt-2"}
                    maxLength={80}
                    value={selected(vehicleModelQuestion)}
                    onChange={(e) => updateAnswer(vehicleModelQuestion, e.target.value)}
                    placeholder="Ex.: Honda Fit"
                  />
                </label>
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
                </div>
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

            {stage === "specific" && isF01Express && specificPane === "pains" && painFields.pains && painFields.primary && (
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
                  </p>
                </div>
                {plannedLaunch && (
                  <div className="rounded-xl border border-[#FFBB00]/30 bg-[#FFBB00]/[.06] p-4">
                    <p className="text-sm font-semibold">
                      Previsão de presença: {displaySurveyDate(plannedLaunch)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Data informada pela organização, sujeita a confirmação. Nenhuma viagem será
                      agendada automaticamente.
                    </p>
                  </div>
                )}
                <label className="flex min-h-13 items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    className="mt-1.5 accent-[#FFBB00]"
                    checked={prepareInterest}
                    onChange={(e) => setPrepareInterest(e.target.checked)}
                  />
                  <span>
                    Quero registrar interesse no meu trajeto quando houver disponibilidade
                    (opcional). Não é uma reserva.
                  </span>
                </label>
                {prepareInterest && role === "AMBOS" && (
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
                  <span>
                    Concordo em participar da pesquisa e com o tratamento das respostas conforme o
                    aviso de privacidade.
                  </span>
                </label>
                {captureEnabled && (
                  <label className="flex items-start gap-3 text-xs leading-5">
                    <input
                      type="checkbox"
                      required
                      checked={linkageConsent}
                      onChange={(e) => setLinkageConsent(e.target.checked)}
                      className="mt-1 accent-[#FFBB00]"
                    />
                    <span>
                      Autorizo vincular minha participação ao e-mail informado. Não é necessário
                      criar uma conta.
                    </span>
                  </label>
                )}
                {captureEnabled && (
                  <label className="flex items-start gap-3 text-xs leading-5 text-white/65">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-1 accent-[#FFBB00]"
                    />
                    <span>Quero receber novidades do CARONAA por e-mail (opcional).</span>
                  </label>
                )}
                <p className="flex items-start gap-2 text-xs leading-5 text-white/55">
                  <ShieldCheck size={16} className="shrink-0 text-[#FFBB00]" />
                  Responder à pesquisa não comprova matrícula, não cria conta, nem libera acesso
                  antecipado à plataforma.
                </p>
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

      {!complete && (
        <div className="z-10 mx-auto flex w-full max-w-3xl shrink-0 gap-3 border-t border-white/10 bg-[#121212] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:px-8">
          <button
            type="button"
            onClick={back}
            disabled={index === 0 || busy}
            aria-label="Voltar etapa"
            className="flex min-h-13 min-w-13 items-center justify-center rounded-xl border border-white/20 disabled:opacity-30"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            disabled={
              busy || (stage === "activation" && (!consent || (captureEnabled && !linkageConsent)))
            }
            onClick={
              stage === "activation"
                ? () => {
                    void submit();
                  }
                : next
            }
            className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-sm font-bold text-[#121212] disabled:opacity-50"
          >
            {busy
              ? "Registrando…"
              : stage === "activation"
                ? "Ativar Minha Carona"
                : "Continuar"}
            {stage !== "activation" && <ArrowRight size={18} />}
          </button>
        </div>
      )}
    </main>
  );
}
