import {
  formatCrmAnswerValue, formatCrmFieldLabel, formatCrmWeekdays,
} from "@/lib/crm/crm-presentation";

/**
 * Readable, presentation-only renderer for admin answers.
 * The original values are never mutated or replaced in the database.
 * The CRM dossier only calls this with non-duplicated supplemental answers;
 * opaque IDs/JSON live in a separately collapsed audit view.
 */
export function SavedAnswers({
  value, fieldKey,
}: { value: unknown; fieldKey?: string }) {
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground">Não informado</span>;

  if (Array.isArray(value)) {
    const days = (fieldKey === "days" || fieldKey === "eventPresenceDays")
      ? formatCrmWeekdays(value) : null;
    if (days) return <span>{days}</span>;
    if (!value.length) return <span className="text-muted-foreground">Não informado</span>;
    if (value.every(item => item === null || ["string","number","boolean"].includes(typeof item)))
      return <span>{formatCrmAnswerValue(value, fieldKey)}</span>;
    return <div className="space-y-1">{value.map((item, index) =>
      <div key={index}><SavedAnswers value={item}/></div>)}</div>;
  }

  if (typeof value === "object") {
    return (
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {Object.entries(value).map(([key, nested]) =>
          <div key={key} className="min-w-0 border-b border-border/60 pb-2">
            <dt className="text-xs text-muted-foreground">{formatCrmFieldLabel(key)}</dt>
            <dd className="mt-1 break-words whitespace-pre-wrap text-sm leading-5">
              <SavedAnswers value={nested} fieldKey={key}/>
            </dd>
          </div>)}
      </dl>
    );
  }

  return <span>{formatCrmAnswerValue(value, fieldKey)}</span>;
}
