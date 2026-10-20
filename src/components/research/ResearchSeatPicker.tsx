import { useState } from "react";
import { CheckCircle2, Pencil } from "lucide-react";

/** A compact mobile-first control for declared passenger seats, not vehicle registration. */
export function ResearchSeatPicker({
  id, value, min, max, onChange, error,
}: {
  id: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [manual, setManual] = useState(() => Number(value) > 4);
  const count = Number(value);
  const valid = value.trim() !== "" && /^\\d+$/.test(value)
    && Number.isInteger(count) && count >= min && count <= max;
  const quick = Array.from({ length: 5 - min }, (_, index) => min + index)
    .filter((n) => n <= max);

  return (
    <div id={id} className="min-w-0 space-y-2" role="group" aria-label="Lugares para passageiros">
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {quick.map((n) => (
          <button key={n} type="button" aria-pressed={!manual && value === String(n)}
            onClick={() => { setManual(false); onChange(String(n)); }}
            className={`min-h-11 rounded-xl border px-2 text-sm font-bold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
              !manual && value === String(n) ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background hover:bg-muted"
            }`}>{n}</button>
        ))}
        <button type="button" aria-label="Informar quantidade manualmente" aria-pressed={manual}
          onClick={() => setManual(true)}
          className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary ${
            manual ? "border-primary bg-primary/15" : "border-border bg-background hover:bg-muted"
          }`}><Pencil size={15} aria-hidden="true" /><span className="sr-only">Outro valor</span></button>
      </div>
      {manual && (
        <label className="block space-y-1 text-xs font-medium">
          Informar quantidade de vagas
          <input type="number" inputMode="numeric" min={min} max={max} step={1}
            value={value} onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error) || (value !== "" && !valid)}
            aria-describedby={id + "-feedback"}
            className="block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base" />
        </label>
      )}
      <p id={id + "-feedback"} className={`flex min-h-5 items-center gap-1.5 text-xs ${
        error || (value !== "" && !valid) ? "text-destructive" : valid ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
      }`} role={error || (value !== "" && !valid) ? "alert" : "status"}>
        {error || (value !== "" && !valid)
          ? "Informe um número inteiro entre " + min + " e " + max + "."
          : valid
            ? <><CheckCircle2 size={14} aria-hidden="true" /> {count} {count === 1 ? "vaga disponível" : "vagas disponíveis"}</>
            : "Informe apenas lugares livres para passageiros, sem contar o motorista. Limite: " + max + "."}
      </p>
    </div>
  );
}
