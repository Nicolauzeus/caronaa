import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SurveySchema } from "@/lib/formulario/research-templates";
import {
  cleanAnswers,
  scheduleWarning,
  validatePage,
  type Answers,
} from "@/lib/formulario/research-schema";
import { ResearchBrandHeader, ResearchSectionFields } from "@/components/research/ResearchFields";
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
import { ResearchInterestActivation } from "./ResearchInterestActivation";
type Form = {
  id: string;
  version: string;
  title: string;
  schema: SurveySchema;
  brandImagePath: string | null;
  brandAlt: string | null;
  brandName: string | null;
  configuration?: PublicResearchConfiguration | null;
};
export function PublicResearchForm({ code }: { code: string }) {
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
    [linking, setLinking] = useState(false),
    [linkError, setLinkError] = useState("");
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
      setJourney(configuration ? initialResearchJourney(configuration.settings) : null);
      setForm({
        id: f.id,
        version: v.id,
        title: f.title,
        schema: v.schema_json,
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
  const totalSteps = (form?.schema.sections.length ?? 0) + (form?.configuration ? 1 : 0);
  function next() {
    if (!form) return;
    const sec = form.schema.sections[step];
    const problems = validatePage(sec, answers);
    if (problems.length) {
      const byQuestion: Record<string, string> = {};
      for (const q of sec.questions) {
        const errors = validatePage({ title: sec.title, questions: [q] }, answers);
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
    setStep((i) => Math.min(totalSteps - 1, i + 1));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    if (step < totalSteps - 1) {
      next();
      return;
    }
    const cleaned = cleanAnswers(form.schema, answers);
    const problems = form.schema.sections.flatMap((section) => validatePage(section, cleaned));
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    if (!consent) {
      setError("Leia e confirme o consentimento antes de enviar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (form.configuration) {
        const validJourney = validateJourney(journey, form.configuration.settings);
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
      setSubmittedConfiguration(form.configuration ?? null);
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a resposta.");
    } finally {
      setBusy(false);
    }
  }
  async function linkParticipation() {
    if (linking) return;
    setLinking(true);
    setLinkError("");
    try {
      storePendingParticipation(submissionKey);
      const { data } = await supabase.auth.getUser();
      if (data.user?.email_confirmed_at) {
        await claimResearchParticipation(submissionKey);
        window.location.assign("/perfil");
      } else {
        window.location.assign("/auth?mode=cadastro&redirect=" + encodeURIComponent("/perfil"));
      }
    } catch (err) {
      setLinkError(
        err instanceof Error
          ? err.message
          : "Não foi possível associar a participação. Guarde o recibo para tentar mais tarde.",
      );
      setLinking(false);
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
        <p className="text-sm text-muted-foreground">Não é necessário cadastro para responder.</p>
      </main>
    );
  if (complete)
    return (
      <main className="mx-auto max-w-xl space-y-4 p-6">
        <ResearchBrandHeader
          title={form.configuration?.settings.publicName || form.title}
          imagePath={form.brandImagePath}
          alt={form.brandAlt}
          brandName={form.brandName}
        />
        {form.configuration && (
          <p role="status" className="text-sm font-medium">
            {launchMessage(form.configuration.settings)}
          </p>
        )}
        {launchNotice && (
          <p role="status" className="text-sm text-muted-foreground">
            {launchNotice}
          </p>
        )}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-xl font-bold">Resposta registrada!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua participação está registrada. Não é obrigatório criar conta.
          </p>
        </div>
        {form.configuration && journey && (
          <ResearchInterestActivation
            formId={form.id}
            receipt={submissionKey}
            journey={journey}
            configuration={submittedConfiguration?.settings ?? form.configuration.settings}
          />
        )}
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Vincular participação ao meu perfil</h2>
          <p className="text-sm text-muted-foreground">
            Se deseja mostrar no seu perfil CARONAA que respondeu a esta pesquisa, pode associar a
            participação após confirmar seu e-mail. O selo indica{" "}
            <strong>participação no questionário</strong> — não comprova matrícula, presença no
            evento nem verificação de identidade.
          </p>
          <button
            type="button"
            disabled={linking}
            onClick={() => void linkParticipation()}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {linking ? "Preparando vínculo…" : "Vincular participação à minha conta"}
          </button>
          {linkError && (
            <p role="alert" className="text-sm text-destructive">
              {linkError}
            </p>
          )}
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Guardar recibo privado da participação
            </summary>
            <p className="my-2 text-xs text-muted-foreground">
              Caso confirme sua conta em outro navegador, pode digitar este recibo em Meu perfil.
              Não compartilhe: ele permite vincular esta resposta a uma única conta.
            </p>
            <code className="block break-all rounded-lg bg-muted p-2 text-xs">{submissionKey}</code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(submissionKey)}
              className="mt-2 rounded-lg border px-3 py-2 text-sm"
            >
              Copiar recibo
            </button>
          </details>
          <a className="block text-center text-sm text-muted-foreground" href="/home">
            Conhecer o CARONAA sem vincular
          </a>
        </section>
      </main>
    );
  const section = form.schema.sections[step],
    last = step === totalSteps - 1;
  return (
    <main className="mx-auto max-w-xl space-y-5 p-4 py-8 sm:p-8">
      <ResearchBrandHeader
        title={form.configuration?.settings.publicName || form.title}
        imagePath={form.brandImagePath}
        alt={form.brandAlt}
        brandName={form.brandName}
      />
      {form.configuration && (
        <div className="space-y-2 border-y py-3">
          <p className="text-sm font-medium">{launchMessage(form.configuration.settings)}</p>
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
      <div className="space-y-2" aria-label="Progresso da pesquisa">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Etapa {step + 1} de {totalSteps}
          </span>
          <span>{Math.round(((step + 1) / totalSteps) * 100)}% do questionário</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: ((step + 1) / totalSteps) * 100 + "%" }}
          />
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-bold">{section?.title ?? "Seu trajeto"}</h2>
          {section?.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
          {section ? (
            <ResearchSectionFields
              section={section}
              answers={answers}
              errors={fieldErrors}
              onChange={(id, value) => {
                setAnswers((a) => cleanAnswers(form.schema, { ...a, [id]: value }));
                setFieldErrors((prev) => ({ ...prev, [id]: "" }));
                setError("");
              }}
            />
          ) : form.configuration && journey ? (
            <ResearchJourneyFields
              config={form.configuration.settings}
              value={journey}
              onChange={setJourney}
            />
          ) : null}
          {section && scheduleWarning(section, answers) && (
            <p
              role="status"
              className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300"
            >
              {scheduleWarning(section, answers)}
            </p>
          )}
        </section>
        {last && (
          <label className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
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
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 0 || busy}
            onClick={() => {
              setError("");
              setFieldErrors({});
              setStep((s) => s - 1);
            }}
            className="rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          {last ? (
            <button
              type="submit"
              disabled={busy || !consent}
              className="rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Enviando…" : "Enviar respostas"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground"
            >
              Próxima etapa →
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
