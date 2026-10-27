import { useState, type FormEvent } from "react";
import { buildF01Draft, F01_CREATION_MODELS, F01_REGIONS, type F01DraftInput } from "@/lib/formulario/f01-creation";
import { createResearchForm } from "@/lib/formulario/research-catalog";
import { checkResearchFormCode, describeResearchCodeConflict, suggestResearchFormCode, validResearchFormCode } from "@/lib/formulario/research-form-code";
import { validateSurveyWindow } from "@/lib/formulario/research-window";

type Props = {
  occupiedCodes: string[];
  onCreated: (formId: string) => void;
  onAdvanced: () => void;
  onCancel: () => void;
};

const inputClass = "mt-1 block min-h-12 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary";

/** Default mobile-first creation path. Advanced legacy research models stay accessible separately. */
export function SimpleResearchCreator({ occupiedCodes, onCreated, onAdvanced, onCancel }: Props) {
  const [values, setValues] = useState<F01DraftInput>({
    modelKey: "F01_UNIVERSIDADE", name: "", title: "", code: "",
    region: "FORTALEZA_EDSON_QUEIROZ", campus: "", startsOn: "", endsOn: "", launchOn: null,
  });
  const [codeEdited, setCodeEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof F01DraftInput>(key: K, value: F01DraftInput[K]) => {
    setValues(previous => ({ ...previous, [key]: value }));
    setError("");
  };
  const suggestCode = (source: string) => suggestResearchFormCode(source, occupiedCodes);
  function changeTitle(title: string) {
    setValues(previous => ({
      ...previous, title,
      code: codeEdited ? previous.code : suggestCode(title || previous.name || "PESQUISA"),
    }));
    setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      if (!validResearchFormCode(values.code)) throw Error("Confira o código da pesquisa.");
      const scheduleError = validateSurveyWindow(values.startsOn, values.endsOn);
      if (scheduleError) throw Error(scheduleError);
      const codeAvailability = await checkResearchFormCode(values.code);
      if (!codeAvailability.available)
        throw Error(describeResearchCodeConflict(codeAvailability.status, codeAvailability.inTrash));
      const id = await createResearchForm(buildF01Draft(values));
      onCreated(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o rascunho.");
    } finally {
      setSaving(false);
    }
  }
  const model = F01_CREATION_MODELS.find(option => option.key === values.modelKey)!;
  const duplicate = occupiedCodes.some(code => code.trim().toUpperCase() === values.code.trim().toUpperCase());
  return (
    <section aria-label="Criar novo formulário simples" className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Novo formulário · F01</p>
          <h3 className="text-xl font-bold">Comece com um modelo simples</h3>
          <p className="max-w-lg text-sm text-muted-foreground">Três etapas, dores sociais na mesma tela e respostas organizadas automaticamente no CRM.</p>
        </div>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border px-3 text-sm">Fechar</button>
      </div>
      <div role="group" aria-label="Escolha o modelo do novo formulário" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {F01_CREATION_MODELS.map((option, index) => (
          <button type="button" key={option.key} aria-pressed={values.modelKey === option.key}
            onClick={() => set("modelKey", option.key)}
            className={"flex min-h-24 items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary " +
              (values.modelKey === option.key ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}>
            <span aria-hidden="true" className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold " +
              (values.modelKey === option.key ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {index + 1}
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">{option.title}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{option.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-medium">
            {model.organization} *
            <input required minLength={2} maxLength={180} autoComplete="organization"
              value={values.name} onChange={event => set("name", event.target.value)}
              placeholder={values.modelKey === "F01_UNIVERSIDADE" ? "Nome da universidade" : values.modelKey === "F01_EMPRESA" ? "Nome da empresa" : "Comunidade ou bairro"}
              className={inputClass} />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Região *
            <select value={values.region} onChange={event => set("region", event.target.value as F01DraftInput["region"])}
              className={inputClass}>
              {F01_REGIONS.map(region => <option key={region.id} value={region.id}>{region.label}</option>)}
            </select>
          </label>
          {values.modelKey === "F01_UNIVERSIDADE" && (
            <label className="block min-w-0 text-sm font-medium sm:col-span-2">
              Campus (opcional)
              <input maxLength={120} value={values.campus} onChange={event => set("campus", event.target.value)}
                placeholder="Ex.: campus principal" className={inputClass} />
            </label>
          )}
          <label className="block min-w-0 text-sm font-medium sm:col-span-2">
            Título do formulário *
            <input required minLength={2} maxLength={180} value={values.title}
              onChange={event => changeTitle(event.target.value)}
              placeholder="Ex.: Como você se desloca para a universidade?"
              className={inputClass}/>
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Início das respostas *
            <input type="date" required value={values.startsOn}
              onChange={event => set("startsOn", event.target.value)} className={inputClass}/>
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Encerramento das respostas *
            <input type="date" required min={values.startsOn || undefined}
              value={values.endsOn} onChange={event => set("endsOn", event.target.value)} className={inputClass}/>
          </label>
        </div>
        <details className="rounded-xl border border-border bg-background px-3 py-2" open={undefined}>
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">
            Mais opções: código e lançamento
          </summary>
          <div className="grid gap-3 pb-3 sm:grid-cols-2">
            <label className="block min-w-0 text-sm">
              Código exclusivo *
              <input required value={values.code}
                onChange={event => { setCodeEdited(true); set("code", event.target.value.toUpperCase()); }}
                aria-invalid={duplicate || (values.code !== "" && !validResearchFormCode(values.code))}
                className={inputClass}/>
              <span className="mt-1 block text-xs text-muted-foreground">Gerado automaticamente a partir do título. Pode ser alterado antes da criação.</span>
            </label>
            <label className="block min-w-0 text-sm">
              Lançamento do CARONAA (opcional)
              <input type="date" value={values.launchOn || ""}
                onChange={event => set("launchOn", event.target.value || null)} className={inputClass}/>
              <span className="mt-1 block text-xs text-muted-foreground">É diferente do período da pesquisa.</span>
            </label>
          </div>
        </details>
        <p className="rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          O rascunho usa os campos-padrão do F01, solicita e-mail com consentimento e registra o interesse no CRM.
          Nenhum formulário existente é alterado. Revise as perguntas antes de publicar.
        </p>
        {duplicate && <p role="alert" className="text-sm text-destructive">Código já utilizado. Altere o título ou o código.</p>}
        {error && <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={saving || duplicate}
          className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {saving ? "Criando rascunho…" : "Criar rascunho e revisar"}
        </button>
      </form>
      <button type="button" onClick={onAdvanced}
        className="min-h-11 w-full rounded-xl border border-border px-4 text-sm font-medium">
        Usar construtor avançado ou modelos antigos
      </button>
    </section>
  );
}
