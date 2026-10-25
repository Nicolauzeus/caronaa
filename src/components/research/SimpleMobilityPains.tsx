import type { Answers } from "@/lib/formulario/research-schema";
import type { SurveySchema } from "@/lib/formulario/research-templates";
import { simplePainFields } from "@/lib/formulario/mobility-simple";
import { formatResearchOption } from "@/lib/formulario/research-option-labels";

type Props = {
  schema: SurveySchema;
  answers: Answers;
  errors: Record<string, string>;
  onChange: (id: string, value: string | string[]) => void;
};

/** F01-only pain selector. Never used to reinterpret legacy published schemas. */
export function SimpleMobilityPains({ schema, answers, errors, onChange }: Props) {
  const { pains, primary, other } = simplePainFields(schema);
  if (!pains || !primary) return null;
  const selected = Array.isArray(answers[pains.id]) ? answers[pains.id] as string[] : [];
  const currentPrimary = String(answers[primary.id] ?? "");
  const otherSelected = selected.includes("OUTRA");
  const toggle = (option: string) => {
    if (option === "NENHUMA") {
      onChange(pains.id, selected.includes(option) ? [] : ["NENHUMA"]);
      return;
    }
    const existing = selected.filter(value => value !== "NENHUMA");
    onChange(pains.id,
      existing.includes(option)
        ? existing.filter(value => value !== option)
        : existing.length < 3 ? [...existing, option] : existing,
    );
  };
  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="text-base font-bold leading-snug">{pains.label} <span className="text-destructive">*</span></legend>
        <p className="text-xs leading-5 text-muted-foreground">Marque até três opções. Você pode dizer que nenhuma se aplica.</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {pains.options.map(option => {
            const checked = selected.includes(option);
            const disabled = !checked && option !== "NENHUMA" && selected.length >= 3 && !selected.includes("NENHUMA");
            return (
              <label key={option} className={"flex min-h-20 cursor-pointer flex-col justify-between gap-2 rounded-xl border px-3 py-3 text-xs leading-5 transition-colors sm:text-sm " +
                (checked ? "border-primary bg-primary/10 font-semibold" : "border-border bg-background hover:border-primary/50") +
                (disabled ? " opacity-50" : "")}>
                <input type="checkbox" checked={checked} disabled={disabled}
                  onChange={() => toggle(option)}
                  aria-label={formatResearchOption(option)}
                  className="h-4 w-4 accent-primary" />
                <span>{formatResearchOption(option)}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{selected.length} de 3 marcadas</p>
        {errors[pains.id] && <p role="alert" className="text-xs text-destructive">{errors[pains.id]}</p>}
      </fieldset>
      {otherSelected && other && (
        <label className="block space-y-2 text-sm font-semibold" htmlFor={other.id}>
          {other.label} <span className="text-destructive">*</span>
          <input id={other.id} type="text" maxLength={other.maxLength ?? 140}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base font-normal"
            placeholder="Descreva a dificuldade"
            value={String(answers[other.id] ?? "")}
            onChange={event => onChange(other.id, event.target.value)} />
          {errors[other.id] && <span role="alert" className="block text-xs text-destructive">{errors[other.id]}</span>}
        </label>
      )}
      {selected.length > 0 && !selected.includes("NENHUMA") && (
        <fieldset className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <legend className="px-1 text-sm font-semibold">{primary.label}</legend>
          <p className="text-xs text-muted-foreground">{selected.length === 1
            ? "Esta é sua principal dificuldade."
            : "Escolha a mais importante entre as que você marcou."}</p>
          <div className="grid gap-2">
            {selected.map(option => (
              <label key={option} className={"flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm " +
                (currentPrimary === option ? "border-primary bg-primary/10 font-medium" : "border-border bg-background")}>
                <input type="radio" name={primary.id} checked={currentPrimary === option}
                  onChange={() => onChange(primary.id, option)} className="accent-primary" />
                {formatResearchOption(option)}
              </label>
            ))}
          </div>
          {errors[primary.id] && <p role="alert" className="text-xs text-destructive">{errors[primary.id]}</p>}
        </fieldset>
      )}
      {selected.includes("NENHUMA") && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          Obrigado. Registrar que você não enfrenta essas dificuldades também é importante para a pesquisa.
        </p>
      )}
    </div>
  );
}
