import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, CalendarDays, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { captureResearchLead, researchLeadCaptureEnabled, validResearchEmail } from "@/lib/formulario/research-lead";
import { supabase } from "@/integrations/supabase/client";
import type { SurveySchema } from "@/lib/formulario/research-templates";
import { createResearchVisibility } from "@/lib/formulario/research-conditions";
import { createUniforGroups,setUniforPainAnswers } from "@/lib/formulario/unifor-compact-groups";
import { isSimpleMobility, applySimplePainAnswer, validateSimpleMobilityPains } from "@/lib/formulario/mobility-simple";
import { isUniforPilotForm, UNIFOR_LAUNCH_DAY } from "@/lib/unifor-launch";
import { academicResearchTemplate,displaySurveyMoment,getResearchWindowState } from "@/lib/formulario/research-window";
import {
  cleanAnswers,
  scheduleWarning,
  validatePage,
  type Answers,
} from "@/lib/formulario/research-schema";
import { ResearchBrandHeader, ResearchSectionFields } from "@/components/research/ResearchFields";
import { isAcademicExpress, isAcademicExpressF01 } from "@/lib/formulario/academic-express-schema";
import { AcademicExpressForm } from "./AcademicExpressForm";
import {
  storePendingParticipation,
  claimResearchParticipation,
} from "@/lib/formulario/research-participation";
import {
  getPublicResearchConfiguration,
  submitConfiguredResearch,
} from "@/lib/formulario/research-configuration-service";
import {
  launchMessage,
  validateJourney,
  type PublicResearchConfiguration,
  type ResearchJourney,
} from "@/lib/formulario/research-configuration";
import { ResearchJourneyFields, initialResearchJourney } from "./ResearchJourneyFields";
import { SimpleResearchJourney } from "./SimpleResearchJourney";
import { URBAN_UNIVERSITY_KEY, urbanUniversityIntro, validateUrbanUniversityAnswers } from "@/lib/formulario/urban-university";
import { REGIONAL_UNIVERSITY_KEY, regionalUniversityIntro, validateRegionalUniversityAnswers } from "@/lib/formulario/regional-university";
import { EVENT_EXIT_MATCH_KEY, eventExitMatchIntro, validateEventExitAnswers, validateEventExitJourney } from "@/lib/formulario/event-exit-match";
import { EventExitMatchActions } from "./EventExitMatchActions";
import { COMPANY_CAMPUS_DRIVER_KEY, companyCampusDriverIntro, validateCompanyCampusAnswers, validateCompanyCampusJourney, companyCampusSuggestedProfile } from "@/lib/formulario/company-campus-driver";
import { CORPORATE_INTERNAL_KEY, corporateInternalIntro, validateCorporateInternalAnswers, validateCorporateInternalJourney,corporateCanOffer } from "@/lib/formulario/corporate-internal";
type Form = {
  id: string;
  version: string;
  title: string;
  schema: SurveySchema;
  caronaaPresenceOn: string | null;
  brandImagePath: string | null;
  brandAlt: string | null;
  brandName: string | null;
  configuration?: PublicResearchConfiguration | null;
};
export function PublicResearchForm({ code }: { code: string }) {
  const { user } = useAuth();
  const previousStep = useRef(0);
  const [microQuestionIndex, setMicroQuestionIndex] = useState(0);
  const [pilotRoleConfirmed,setPilotRoleConfirmed] = useState(false);
  const [pilotSelectedRole,setPilotSelectedRole] = useState<ResearchJourney["profile"] | null>(null);
  const [microJourneyIndex, setMicroJourneyIndex] = useState(0);
  const [form, setForm] = useState<Form | null>(null),
    [answers, setAnswers] = useState<Answers>({}),
    [submissionKey] = useState(() => crypto.randomUUID());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [journey, setJourney] = useState<ResearchJourney | null>(null);
  const [submittedConfiguration, setSubmittedConfiguration] =
    useState<PublicResearchConfiguration | null>(null);
  const hasConfiguration = Boolean(form?.configuration);
  const [launchNotice, setLaunchNotice] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [complete, setComplete] = useState(false),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [step, setStep] = useState(0),
    [email, setEmail] = useState(""),
    [linkageConsent, setLinkageConsent] = useState(false),
    [marketingConsent, setMarketingConsent] = useState(false),
    [captureEnabled, setCaptureEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: f, error: fe } = await (supabase as any)
        .from("research_forms")
        .select("*")
        .ilike("code", code)
        .eq("status", "PUBLICADO")
        .eq("is_enabled", true)
        .maybeSingle();
      if (!alive) return;
      if (fe || !f) {
        setError(
          fe
            ? "Não foi possível carregar a pesquisa. Tente novamente."
            : "Esta pesquisa não está disponível para novas respostas.",
        );
        setLoading(false);
        return;
      }
      const windowState=await getResearchWindowState(code);
      if (!alive) return;
      if (windowState?.state === "AGENDADO") {
        setError("Esta pesquisa abrirá para respostas em "+displaySurveyMoment(windowState.startsOn, windowState.startsAt)+".");
        setLoading(false);
        return;
      }
      if (windowState?.state === "ENCERRADO") {
        setError("Esta pesquisa encerrou o recebimento de respostas em "+displaySurveyMoment(windowState.endsOn, windowState.endsAt)+".");
        setLoading(false);
        return;
      }
      const { data: v, error: ve } = await (supabase as any)
        .from("research_form_versions")
        .select("id,schema_json")
        .eq("form_id", f.id)
        .not("published_at", "is", null)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (ve || !v || !Array.isArray(v.schema_json?.sections) || !v.schema_json.sections.length) {
        setError("Questionário indisponível. Entre em contato com o organizador.");
        setLoading(false);
        return;
      }
      const configuration = f.mobility_configured
        ? await getPublicResearchConfiguration(code)
        : null;
      if (!alive) return;
      if (f.mobility_configured && !configuration) {
        setError("Configuração institucional indisponível.");
        setLoading(false);
        return;
      }
      if (configuration && isSimpleMobility(v.schema_json)) {
        const initial=initialResearchJourney(configuration.settings);
        setJourney({ ...initial, originArea:"", destinationArea:"", outboundTime:"", otherOutboundTime:true });
      } else setJourney(configuration ? initialResearchJourney(configuration.settings) : null);
      // Graceful staged rollout: the form does not require contact collection
      // until the migration-backed RPC is available.
      const canCapture = Boolean(configuration?.settings.emailCaptureEnabled) &&
        await researchLeadCaptureEnabled(f.id);
      if (!alive) return;
      if ((isSimpleMobility(v.schema_json) || isAcademicExpressF01(v.schema_json)) && !canCapture) {
        setError("O CRM e a captura de e-mail ainda não estão habilitados para este novo formulário. Contate a equipe responsável.");
        setLoading(false);
        return;
      }
      setCaptureEnabled(canCapture);
      setForm({
        id: f.id,
        version: v.id,
        title: f.title,
        schema: v.schema_json,
        caronaaPresenceOn: f.caronaa_presence_on ?? null,
        brandImagePath: f.brand_image_path,
        brandAlt: f.brand_image_alt,
        brandName: f.brand_display_name,
        configuration,
      });
      setLoading(false);
    })().catch(() => {
      if (alive) {
        setError("Não foi possível carregar a pesquisa. Tente novamente.");
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [code]);
  useEffect(() => {
    if (!complete || !hasConfiguration) return;
    let active = true;
    const refresh = () => {
      void getPublicResearchConfiguration(code)
        .then((config) => {
          if (active)
            setLaunchNotice(
              config ? "" : "A pesquisa não está mais disponível para novos interesses.",
            );
          if (active && config)
            setForm((previous) => (previous ? { ...previous, configuration: config } : previous));
        })
        .catch(() => {
          if (active)
            setLaunchNotice(
              "Não foi possível atualizar a situação do lançamento. A data exibida é a última consultada.",
            );
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [complete, code, hasConfiguration]);
  useEffect(() => {
    if (!form || previousStep.current === step) return;
    previousStep.current = step;
    if (academicResearchTemplate(form.configuration?.settings.templateKey,isUniforPilotForm(form.id))) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("research-step-content")?.scrollIntoView({ block: "start", behavior: "auto" });
      document.getElementById("research-step-heading")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, form]);
  const allQuestions = form?.schema.sections.flatMap((section) => section.questions) ?? [];
  const roleId = allQuestions.find(q => q.semanticCode === "RESEARCH_PARTICIPANT_ROLE")?.id;
  const declaredRole = roleId && typeof answers[roleId] === "string" ? String(answers[roleId]) : null;
  // In published legacy university versions, the profile belongs to the journey step.
  const participantRole = declaredRole ?? (pilotRoleConfirmed ? pilotSelectedRole : null);
  const hasStandaloneJourney = Boolean(form?.configuration) && !isSimpleMobility(form?.schema);
  const isSimple = isSimpleMobility(form?.schema);
  const visibleStepIndexes = form
    ? [...form.schema.sections.flatMap((section,index) =>
        createResearchVisibility(form.schema,answers,participantRole).sectionVisible(section) ? [index] : []),
       ...(hasStandaloneJourney ? [form.schema.sections.length] : [])]
    : [];
  const totalSteps = (form?.schema.sections.length ?? 0) + (hasStandaloneJourney ? 1 : 0);
  const isUnifor = Boolean(form && academicResearchTemplate(form.configuration?.settings.templateKey,isUniforPilotForm(form.id)));
  const pilotRoleStep = isUnifor && !roleId && !pilotRoleConfirmed;
  const uniforGroups = isUnifor && form ? createUniforGroups(form.schema,answers,!isUniforPilotForm(form.id),participantRole) : [];
  const currentSection = form?.schema.sections[step];
  const currentGroups = uniforGroups[step] ?? [];
  const joinedAcademicRole = isUnifor && !roleId && uniforGroups[0]?.[0]?.questions.some(
    question=>question.semanticCode==="ACADEMIC_ROLE") === true;
  const currentMicroIndex = Math.min(microQuestionIndex,Math.max(0,currentGroups.length-1));
  const currentGroup = currentGroups[currentMicroIndex];
  const journeyPhases = ["routine","time","locations"] as const;
  const microTotalBase = isUnifor && form
    ? visibleStepIndexes.reduce((n,index)=>n+(
      index===form.schema.sections.length ? journeyPhases.length : uniforGroups[index]?.length ?? 0
    ),0) : totalSteps;
  const microTotal = microTotalBase+(isUnifor&&!roleId&&!joinedAcademicRole?1:0);
  const microCompletedBefore = isUnifor && form ? visibleStepIndexes
    .filter(index=>index<step)
    .reduce((n,index)=>n+(index===form.schema.sections.length?journeyPhases.length:
      uniforGroups[index]?.length ?? 0),0)
    : 0;
  const microPosition = isUnifor
    ? (pilotRoleStep ? 1 : microCompletedBefore+(currentSection?currentMicroIndex:microJourneyIndex)+1+(!roleId&&!joinedAcademicRole?1:0))
    : visibleStepIndexes.indexOf(step)+1;
  const progressCount = isUnifor ? microTotal : visibleStepIndexes.length;
  const progressNumber = Math.max(1,Math.min(microPosition,Math.max(1,progressCount)));
  function next() {
    if (!form) return;
    if (pilotRoleStep) {
      if (!pilotSelectedRole || !journey) {
        setError("Escolha se deseja pedir ou oferecer uma carona.");
        return;
      }
      if(joinedAcademicRole && form.schema.sections[0]) {
        const group=uniforGroups[0]?.[0];
        if(group) {
          const one={...form.schema.sections[0],questions:group.questions};
          const problems=validatePage(one,answers,allQuestions,form.schema,participantRole);
          if(problems.length) {
            setFieldErrors({[group.questions[0].id]:problems[0]});
            setError(problems[0]);
            return;
          }
        }
      }
      setJourney({...journey,profile:pilotSelectedRole});
      setPilotRoleConfirmed(true);
      if(joinedAcademicRole)setMicroQuestionIndex(1);
      setFieldErrors({});
      setError("");
      return;
    }
    const sec = form.schema.sections[step];
    if (!sec) {
      if (isUnifor && microJourneyIndex < journeyPhases.length - 1) {
        setMicroJourneyIndex(i => i + 1);
        setError("");
      }
      return;
    }
    // Validate every visible question on the current *grouped* screen, not one
    // field or the entire section before the user has seen the next group.
    if (isUnifor && currentGroup) {
      const one = { ...sec, questions:currentGroup.questions };
      const currentErrors = validatePage(one,answers,allQuestions,form.schema,participantRole);
      if (currentErrors.length) {
        const invalid = currentGroup.questions.find(q =>
          validatePage({...one,questions:[q]},answers,allQuestions,form.schema,participantRole).length);
        if(invalid)setFieldErrors({[invalid.id]:currentErrors[0]});
        setError(currentErrors[0]);
        return;
      }
      if (currentMicroIndex < currentGroups.length-1) {
        setMicroQuestionIndex(index=>index+1);
        setError("");
        setFieldErrors({});
        return;
      }
    }
    const problems = [
      ...validatePage(sec, answers, allQuestions, form.schema,participantRole),
      ...(isSimple && sec.questions.some(q=>q.semanticCode==="MOBILITY_PAINS")
        ? validateSimpleMobilityPains(form.schema,answers) : []),
      ...(form.configuration?.settings.templateKey === URBAN_UNIVERSITY_KEY
        ? validateUrbanUniversityAnswers(form.schema, answers) : []),
      ...(form.configuration?.settings.templateKey === REGIONAL_UNIVERSITY_KEY
        ? validateRegionalUniversityAnswers(form.schema, answers) : []),
      ...(form.configuration?.settings.templateKey === EVENT_EXIT_MATCH_KEY
        ? validateEventExitAnswers(form.schema, answers) : []),
      ...(form.configuration?.settings.templateKey === COMPANY_CAMPUS_DRIVER_KEY
        ? validateCompanyCampusAnswers(form.schema, answers) : []),
      ...(form.configuration?.settings.templateKey === CORPORATE_INTERNAL_KEY
        ? validateCorporateInternalAnswers(form.schema, answers) : []),
    ];
    if (problems.length) {
      const byQuestion: Record<string, string> = {};
      for (const q of sec.questions) {
        const errors = validatePage({ title: sec.title, questions: [q] }, answers, allQuestions, form.schema,participantRole);
        if (errors.length) byQuestion[q.id] = errors[0];
      }
      setFieldErrors(byQuestion);
      setError(problems[0]);
      const first = sec.questions.find((q) => byQuestion[q.id]);
      if (first)
        requestAnimationFrame(() =>
          document
            .getElementById(first.id)
            ?.scrollIntoView({ block: "center", behavior: "smooth" }),
        );
      return;
    }
    setFieldErrors({});
    setError("");
    if (form.configuration?.settings.templateKey === COMPANY_CAMPUS_DRIVER_KEY && step === form.schema.sections.length - 1) {
      const recommended = companyCampusSuggestedProfile(form.schema, answers);
      setJourney((previous) => previous ? { ...previous, profile: recommended } : previous);
    }
    if (form.configuration?.settings.templateKey===CORPORATE_INTERNAL_KEY && step===form.schema.sections.length-1) {
      setJourney(previous => previous ? {...previous, profile:corporateCanOffer(form.schema,answers)?"MOTORISTA":"PASSAGEIRO"} : previous);
    }
    const upcoming = visibleStepIndexes.find(nextIndex => nextIndex > step);
    if (upcoming === form.schema.sections.length && declaredRole && form.configuration) {
      const roleProfile = declaredRole === "PROFISSIONAL" ? "MOTORISTA" : declaredRole;
      if (form.configuration.settings.templateKey === COMPANY_CAMPUS_DRIVER_KEY &&
        roleProfile !== "PASSAGEIRO" && companyCampusSuggestedProfile(form.schema,answers)!=="MOTORISTA") {
        setError("Para oferecer carona, confirme carro, pelo menos um lugar e intenção de oferecer; ou escolha passageiro.");
        return;
      }
      if (form.configuration.settings.templateKey === CORPORATE_INTERNAL_KEY &&
        roleProfile !== "PASSAGEIRO" && !corporateCanOffer(form.schema,answers)) {
        setError("Para oferecer carona, confirme carro, lugar livre e interesse; ou escolha passageiro.");
        return;
      }
      setJourney(previous => previous ? {
        ...previous,
        profile: roleProfile as ResearchJourney["profile"],
        mode: declaredRole === "PROFISSIONAL" ? "TRANSPORTE_PROFISSIONAL_INTERESSE" : "CARONA",
      } : previous);
    }
    setMicroQuestionIndex(0);
    setStep(i => visibleStepIndexes.find(nextIndex => nextIndex > i) ?? i);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    if (step < totalSteps - 1) {
      next();
      return;
    }
    if (isUnifor && microJourneyIndex < journeyPhases.length - 1) {
      setMicroJourneyIndex(i => i + 1);
      return;
    }
    const cleaned = cleanAnswers(form.schema, answers,participantRole);
    const expectedProfile = declaredRole === "PROFISSIONAL" ? "MOTORISTA" : declaredRole;
    if (declaredRole && form.configuration && (
      !journey || journey.profile !== expectedProfile ||
      journey.mode !== (declaredRole === "PROFISSIONAL" ? "TRANSPORTE_PROFISSIONAL_INTERESSE" : "CARONA")
    )) {
      setError("O trajeto deve corresponder ao perfil escolhido no início. Volte e revise sua seleção.");
      return;
    }
    const problems = [
      ...form.schema.sections.flatMap((section) => validatePage(section, cleaned, allQuestions, form.schema,participantRole)),
      ...validateSimpleMobilityPains(form.schema, cleaned),
      ...(form.configuration?.settings.templateKey === URBAN_UNIVERSITY_KEY
        ? validateUrbanUniversityAnswers(form.schema, cleaned) : []),
      ...(form.configuration?.settings.templateKey === REGIONAL_UNIVERSITY_KEY
        ? validateRegionalUniversityAnswers(form.schema, cleaned) : []),
      ...(form.configuration?.settings.templateKey === EVENT_EXIT_MATCH_KEY
        ? validateEventExitAnswers(form.schema, cleaned) : []),
      ...(form.configuration?.settings.templateKey === COMPANY_CAMPUS_DRIVER_KEY
        ? validateCompanyCampusAnswers(form.schema, cleaned) : []),
      ...(form.configuration?.settings.templateKey === CORPORATE_INTERNAL_KEY
        ? validateCorporateInternalAnswers(form.schema, cleaned) : []),
    ];
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    if (!consent) {
      setError("Leia e confirme o consentimento antes de enviar.");
      return;
    }
    if (captureEnabled && !validResearchEmail(email)) {
      setError("Confira o formato do e-mail antes de enviar.");
      return;
    }
    if (captureEnabled && !linkageConsent) {
      setError("Confirme o uso do e-mail para reconhecer sua participação.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (form.configuration) {
        const validJourney = validateJourney(journey, form.configuration.settings);
        if (form.configuration.settings.templateKey === EVENT_EXIT_MATCH_KEY) {
          const mismatches=validateEventExitJourney(form.schema, cleaned, validJourney);
          if (mismatches.length) throw Error(mismatches[0]);
        }
        if (form.configuration.settings.templateKey === COMPANY_CAMPUS_DRIVER_KEY) {
          const mismatches=validateCompanyCampusJourney(form.schema, cleaned, validJourney);
          if (mismatches.length) throw Error(mismatches[0]);
        }
        if (form.configuration.settings.templateKey===CORPORATE_INTERNAL_KEY) {
          const issues=validateCorporateInternalJourney(form.schema,cleaned,validJourney);
          if(issues.length)throw Error(issues[0]);
        }
        await submitConfiguredResearch({
          formId: form.id,
          versionId: form.version,
          submissionKey,
          answers: cleaned,
          config: form.configuration,
          journey: validJourney,
          researchConsent: consent,
        });
      } else {
        const { error: insertError } = await (supabase as any).from("research_answers").insert({
          form_id: form.id,
          version_id: form.version,
          answers: cleaned,
          consent_accepted: true,
          client_submission_key: submissionKey,
        });
        if (insertError && insertError.code !== "23505")
          throw new Error(
            "Não foi possível enviar sua resposta. Verifique a conexão e tente novamente.",
          );
      }
      if (captureEnabled) {
        await captureResearchLead({
          formId: form.id, receipt: submissionKey, email,
          linkageConsent, marketingConsent,
        });
      }
      // The private receipt works as same-device proof when signing in later.
      // An email match alone must never grant a participation badge.
      try { storePendingParticipation(submissionKey, Boolean(form.configuration?.settings.launchDate)); }
      catch { /* Account recovery remains available via private receipt. */ }
      if (user?.email_confirmed_at &&
          (!captureEnabled || user.email?.trim().toLowerCase() === email.trim().toLowerCase())) {
        try { await claimResearchParticipation(submissionKey); } catch { /* Claim is recoverable. */ }
      }
      setSubmittedConfiguration(form.configuration ?? null);
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a resposta.");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="mx-auto max-w-xl p-6" role="status">
        Carregando pesquisa…
      </main>
    );
  if (!form)
    return (
      <main className="mx-auto max-w-xl space-y-3 p-6" role="alert">
        <h1 className="text-2xl font-bold">Formulário indisponível</h1>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border px-4 py-2"
        >
          Tentar novamente
        </button>
        <p className="text-sm text-muted-foreground">Se esta for uma pesquisa corporativa, faça login com uma conta autorizada. Apenas possuir o link não concede acesso.</p>
        <a href={"/auth?mode=login&redirect="+encodeURIComponent("/formulario/"+code)} className="inline-flex rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Entrar com minha conta</a>
      </main>
    );
  // New university versions use the independent, accessible 4/5-screen flow.
  // Legacy published versions continue with their original validated renderer.
  if (isAcademicExpress(form.schema) && form.configuration) {
    return <AcademicExpressForm form={form} captureEnabled={captureEnabled} user={user} />;
  }
  if (complete)
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-4 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] sm:gap-5 sm:px-6 sm:py-8">
        <ResearchBrandHeader compact
          title={form.configuration?.settings.publicName || form.title}
          imagePath={form.brandImagePath}
          alt={form.brandAlt}
          brandName={form.brandName}
        />
        <section aria-label="Confirmação da pesquisa" className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-sm sm:py-8">
          <span className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 size={32} aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight">Resposta registrada!</h2>
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            Sua participação foi salva com sucesso. Não é necessário criar uma conta agora.
          </p>
        </section>
        {(form.caronaaPresenceOn || form.configuration?.settings.launchDate) && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <CalendarDays className="mt-0.5 shrink-0 text-primary" size={20} aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold">Próximos passos</p>
              <p className="text-sm text-muted-foreground">{form.configuration?.settings.launchDate
                ? launchMessage(form.configuration.settings)
                : "Presença prevista do CARONAA · " + displaySurveyDate(form.caronaaPresenceOn!)}</p>
              {launchNotice && <p role="status" className="text-xs text-muted-foreground">{launchNotice}</p>}
            </div>
          </div>
        )}
        <section className="flex items-start gap-3 px-1" aria-label="Reconhecimento da participação">
          <MailCheck className="mt-0.5 shrink-0 text-primary" size={21} aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Reconhecimento da sua participação</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {captureEnabled
                ? "O e-mail foi registrado. Ao acessar sua conta confirmada, a participação poderá ser reconhecida com segurança. Em outro dispositivo, a confirmação da participação pode ser necessária."
                : "Guarde seu recibo privado caso confirme sua conta em outro dispositivo. O reconhecimento exige comprovar sua participação."}
            </p>
          </div>
        </section>
        {form.configuration?.settings.templateKey === EVENT_EXIT_MATCH_KEY && journey && (
          <EventExitMatchActions
            configuration={(submittedConfiguration ?? form.configuration).settings}
            journey={journey} schema={form.schema} answers={answers}
          />
        )}
        <a href={user ? "/home" :
          "/auth?mode=cadastro&redirect=" + encodeURIComponent(form.configuration?.settings.launchDate ? "/aguardando" : "/perfil")}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-center text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary/90">
          {user ? "Continuar no CARONAA" : "Criar conta e acompanhar no CARONAA"}
        </a>
        <p className="text-center text-xs text-muted-foreground">Você também pode criar sua conta mais tarde.</p>
        <details className="text-xs text-muted-foreground">
          <summary className="min-h-10 cursor-pointer py-2 underline underline-offset-2">Recuperação da participação</summary>
          <p className="mt-2">Caso confirme o e-mail em outro navegador e precise comprovar a resposta, utilize o recibo privado na seção Meu perfil. Não compartilhe este código.</p>
          <code className="mt-2 block break-all rounded-lg bg-muted p-3 text-foreground">{submissionKey}</code>
          <button type="button" className="mt-2 min-h-10 rounded-lg border px-4 text-sm"
            onClick={() => void navigator.clipboard.writeText(submissionKey)}>Copiar recibo</button>
        </details>
      </main>
    );
  const section = form.schema.sections[step],
    last = !pilotRoleStep && step === visibleStepIndexes[visibleStepIndexes.length - 1] &&
      (!isUnifor || microJourneyIndex === journeyPhases.length - 1);
  const pilotContent = isUnifor && section && currentGroup
    ? {...section,title:currentGroup.title,questions:currentGroup.questions} : section;
  return (
    <main className={isSimple
      ? "mx-auto flex min-h-[100dvh] w-full max-w-lg min-w-0 flex-col gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-[max(12px,env(safe-area-inset-top))] sm:px-5"
      : isUnifor
      ? last && captureEnabled
        ? "mx-auto flex min-h-[100dvh] w-full max-w-2xl min-w-0 flex-col gap-3 px-4 pb-28 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pt-6"
        : "mx-auto flex min-h-[100dvh] w-full max-w-2xl min-w-0 flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-[max(12px,env(safe-area-inset-top))] sm:px-6"
      : "mx-auto max-w-2xl space-y-4 px-3 pb-28 pt-5 sm:px-6 sm:pt-8"}>
      {isUniforPilotForm(form.id) ? (
        <header className="flex min-h-10 shrink-0 items-center justify-between gap-3" aria-label="Pesquisa CARONAA UNIFOR">
          <span className="font-display text-base font-black tracking-wide text-primary">CARONAA <span className="text-foreground">· UNIFOR</span></span>
          <span className="text-[11px] font-semibold text-muted-foreground">Estreia · {UNIFOR_LAUNCH_DAY}</span>
        </header>
      ) : <ResearchBrandHeader compact={isUnifor || isSimple}
        title={form.configuration?.settings.publicName || form.title}
        imagePath={form.brandImagePath}
        alt={form.brandAlt}
        brandName={form.brandName}
      />}
      {step === 0 && currentMicroIndex === 0 && !pilotRoleStep && form.configuration?.settings.templateKey === REGIONAL_UNIVERSITY_KEY && (
        <section aria-label="Apresentação da pesquisa regional" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">CARONAA na universidade · Mobilidade regional</p>
          <p className="text-sm leading-6 line-clamp-4 sm:line-clamp-none">{regionalUniversityIntro(form.configuration.settings)}</p>
          <p className="hidden text-xs leading-5 text-muted-foreground sm:block">
            A carona compartilhada não é mototáxi remunerado. Transporte profissional somente poderá ser oferecido mediante autorização, habilitação e parceria efetivamente verificadas.
          </p>
        </section>
      )}
      {step === 0 && form.configuration?.settings.templateKey === EVENT_EXIT_MATCH_KEY && (
        <section aria-label="Apresentação da pesquisa do evento" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">CARONAA · saída do evento</p>
          <p className="text-sm leading-6">{eventExitMatchIntro(form.configuration.settings)}</p>
        </section>
      )}
      {step === 0 && form.configuration?.settings.templateKey === COMPANY_CAMPUS_DRIVER_KEY && (
        <section aria-label="Apresentação da iniciativa empresa e universidade" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">CARONAA · empresa próxima ao campus</p>
          <p className="text-sm leading-6">{companyCampusDriverIntro(form.configuration.settings)}</p>
        </section>
      )}
      {step === 0 && form.configuration?.settings.templateKey===CORPORATE_INTERNAL_KEY && (
        <section aria-label="Pesquisa corporativa de mobilidade" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">CARONAA Corporativo · Somente colaboradores autorizados</p>
          <p className="text-sm leading-6">{corporateInternalIntro(form.configuration.settings)}</p>
          <p className="text-xs text-muted-foreground">Você precisa estar conectado a uma conta autorizada e com e-mail confirmado para participar.</p>
        </section>
      )}
      {!isUnifor && step === 0 && form.configuration?.settings.templateKey === URBAN_UNIVERSITY_KEY && (
        <section aria-label="Apresentação da pesquisa" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">CARONAA na universidade</p>
          <p className="text-sm leading-6">{urbanUniversityIntro(form.configuration.settings)}</p>
        </section>
      )}
      {isSimple && step === 0 && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-5">
          Carona compartilhada: referência de R$ 6,00 a cada 11 km rodoviários. O valor depende do trecho; esta pesquisa não cobra nem publica viagens.
        </p>
      )}
      {!isUnifor && !isSimple && step === 0 && form.configuration && (
        <div className="space-y-2 border-y py-3">
          {form.configuration.settings.launchDate && <p className="text-sm font-medium">{launchMessage(form.configuration.settings)}</p>}
          <p className="text-sm">{form.configuration.settings.usagePolicy}</p>
          {form.configuration.settings.priceReference && (
            <p className="text-sm">{form.configuration.settings.priceReference}</p>
          )}
          {form.configuration.settings.pricing?.referencePerTrip != null && (
            <p className="text-sm">
              Referência informativa por trecho:{" "}
              {form.configuration.settings.pricing.referencePerTrip.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              . Origem: {form.configuration.settings.pricing.referenceSource}. Não é uma cotação ou
              cobrança.
            </p>
          )}
          {form.configuration.settings.partnershipConfirmed && (
            <p className="text-sm">{form.configuration.settings.partnershipDescription}</p>
          )}
        </div>
      )}
      <div className="shrink-0 space-y-1.5" aria-label="Progresso da pesquisa">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Etapa {progressNumber} de {progressCount}
          </span>
          <span>{Math.round(progressNumber/Math.max(1,progressCount)*100)}% do questionário</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: progressNumber/Math.max(1,progressCount)*100 + "%" }}
          />
        </div>
      </div>
      <form onSubmit={submit} className={isSimple?"flex min-w-0 flex-col gap-3":isUnifor?(last&&captureEnabled?"flex min-w-0 flex-col gap-3":"flex min-w-0 flex-1 flex-col gap-3"):"flex min-w-0 flex-col gap-4"}>
        <section id="research-step-content" className={isSimple
          ? "min-w-0 space-y-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-5"
          : isUnifor
          ? (last && captureEnabled
            ? "min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6"
            : "w-full min-w-0 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6 unifor-form-stage")
          : "min-h-[250px] scroll-mt-20 space-y-4 rounded-xl border bg-card p-4 sm:p-5"}>
          <h2 id="research-step-heading" tabIndex={-1} className={isUnifor?"mb-3 text-lg font-bold leading-snug outline-none":"text-xl font-bold outline-none"}>
            {pilotRoleStep?"Como pretende participar?":isUnifor
              ? (section ? currentGroup?.title : ["Dias e sentido do trajeto","Horários e flexibilidade","Origem e destino"][microJourneyIndex])
              : section?.title ?? "Seu trajeto"}
          </h2>
          {!isUnifor && section?.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
          {pilotRoleStep ? (
            <div className="space-y-4"><fieldset className="grid gap-2" aria-label="Perfil para a carona no lançamento">
              <legend className="mb-2 text-sm font-medium text-muted-foreground">Qual será seu perfil principal?</legend>
              {([
                ["PASSAGEIRO","Quero encontrar carona"],
                ["MOTORISTA","Posso oferecer lugares"],
                ["AMBOS","Quero encontrar e oferecer"],
              ] as const).map(([role,label])=>(
                <label key={role} className={"flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm "+(pilotSelectedRole===role?"border-primary bg-primary/10 font-semibold":"border-border")}>
                  <input type="radio" name="unifor-pilot-role" checked={pilotSelectedRole===role} onChange={()=>{setPilotSelectedRole(role);setAnswers(previous=>cleanAnswers(form.schema,previous,role));setFieldErrors({});setError("");}} className="accent-primary" />
                  {label}
                </label>
              ))}
            </fieldset>
            {joinedAcademicRole && uniforGroups[0]?.[0] && (
              <ResearchSectionFields
                section={{...form.schema.sections[0],questions:uniforGroups[0][0].questions}}
                compact
                schema={form.schema}
                externalRole={participantRole}
                allQuestions={allQuestions}
                answers={answers}
                errors={fieldErrors}
                onChange={(id,value)=>{
                  setAnswers(previous=>cleanAnswers(form.schema,setUniforPainAnswers(form.schema,previous,id,value),participantRole));
                  setFieldErrors(previous=>({...previous,[id]:""}));
                  setError("");
                }}
              />
            )}
            </div>
          ) : section ? (
            <ResearchSectionFields
              section={pilotContent!}
              compact={isUnifor || isSimple}
              schema={form.schema}
              externalRole={participantRole}
              allQuestions={allQuestions}
              answers={answers}
              errors={fieldErrors}
              onChange={(id, value) => {
                setAnswers((a) => cleanAnswers(form.schema,
                  isUnifor ? setUniforPainAnswers(form.schema,a,id,value)
                    : isSimple ? applySimplePainAnswer(form.schema,a,id,value) : { ...a,[id]:value },participantRole));
                if (isSimple && id === roleId && typeof value === "string") {
                  setJourney(previous=>previous ? {...previous,profile:value as ResearchJourney["profile"],mode:"CARONA"}:previous);
                }
                setFieldErrors((prev) => ({ ...prev, [id]: "" }));
                setError("");
              }}
            />
          ) : form.configuration && journey ? (
            <ResearchJourneyFields
              config={form.configuration.settings}
              phase={isUnifor ? journeyPhases[microJourneyIndex] : undefined}
              showConsents={!isUnifor}
              lockedProfile={isUnifor || Boolean(declaredRole)}
              value={journey}
              onChange={setJourney}
            />
          ) : null}
          {!isUnifor && section && scheduleWarning(section, answers) && (
            <p
              role="status"
              className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300"
            >
              {scheduleWarning(section, answers)}
            </p>
          )}
        </section>
        {isSimple && last && form.configuration && journey && (
          <section aria-label="Sua rotina e trajeto" className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">Seu trajeto habitual</h3>
            <p className="text-xs text-muted-foreground">Dias, horário e locais ajudam a entender a demanda por caronas na sua região.</p>
            <SimpleResearchJourney config={form.configuration.settings} value={journey} onChange={setJourney} />
          </section>
        )}
        {last && captureEnabled && (
          <section aria-label="Contato para reconhecimento" className="shrink-0 space-y-2 rounded-xl border border-border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-bold">E-mail para reconhecer sua participação</h3>
            <input type="email" inputMode="email" autoComplete="email" value={email}
              onChange={e=>{setEmail(e.target.value);setError("");}}
              aria-label="E-mail para reconhecimento" aria-invalid={email!==""&&!validResearchEmail(email)}
              placeholder="seuemail@exemplo.com"
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"/>
            {email!==""&&!validResearchEmail(email)&&
              <p role="alert" className="text-xs text-destructive">Confira o formato do e-mail.</p>}
            <label className="flex items-start gap-2 text-xs leading-5">
              <input type="checkbox" required checked={linkageConsent}
                onChange={e=>setLinkageConsent(e.target.checked)} className="mt-1"/>
              <span>Autorizo usar este e-mail para registrar e reconhecer minha participação na pesquisa. Não é necessário criar conta agora.</span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <input type="checkbox" checked={marketingConsent}
                onChange={e=>setMarketingConsent(e.target.checked)} className="mt-1"/>
              <span>Quero receber novidades e campanhas do CARONAA (opcional).</span>
            </label>
          </section>
        )}
        {last && (
          <label className={isUnifor?"flex shrink-0 items-start gap-2 rounded-xl border bg-card p-2.5 text-xs leading-4":"flex items-start gap-3 rounded-xl border bg-card p-4 text-sm"}>
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              Concordo em participar desta pesquisa e autorizo o uso das respostas para análise de
              mobilidade, conforme o aviso de privacidade aplicável. Esse consentimento não autoriza
              automaticamente contatos comerciais.
            </span>
          </label>
        )}
        {error && (
          <p
            className={isUnifor?"shrink-0 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive":"rounded-lg border border-destructive/40 p-3 text-sm text-destructive"}
            role="alert"
          >
            {error}
          </p>
        )}
        <div aria-label="Navegação entre etapas" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-8px_28px_rgba(0,0,0,0.10)] backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            disabled={((step === visibleStepIndexes[0] && (!isUnifor || currentMicroIndex === 0)) && (pilotRoleStep || !isUnifor || Boolean(roleId))) || busy}
            onClick={() => {
              setError("");
              setFieldErrors({});
              if (isUnifor && !section && microJourneyIndex > 0) {
                setMicroJourneyIndex(i=>i-1);
              } else if (isUnifor && section && currentMicroIndex > 0) {
                if(joinedAcademicRole && step===visibleStepIndexes[0] && currentMicroIndex===1) {
                  setPilotRoleConfirmed(false);
                  setMicroQuestionIndex(0);
                } else setMicroQuestionIndex(i=>i-1);
              } else if (isUnifor && section && step === visibleStepIndexes[0] && !roleId && pilotRoleConfirmed) {
                setPilotRoleConfirmed(false);
              } else {
                const previous = [...visibleStepIndexes].reverse().find(index => index < step) ?? 0;
                if (isUnifor && previous < form.schema.sections.length) {
                  setMicroQuestionIndex(Math.max(0,(uniforGroups[previous]?.length ?? 1)-1));
                }
                setStep(previous);
              }
            }}
            className="min-h-11 rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          {last ? (
            <button
              type="submit"
              disabled={busy || !consent || (captureEnabled && (!linkageConsent || !validResearchEmail(email)))}
              className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 sm:px-6"
            >
              {busy ? "Enviando…" : "Enviar respostas"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground sm:px-6"
            >
              {isUnifor ? "Continuar →" : "Próxima etapa →"}
            </button>
          )}
          </div>
        </div>
      </form>
    </main>
  );
}
