import { CarFront, MapPin } from "lucide-react";

export type RideIntent = "REQUEST" | "OFFER";

/** Keep the primary role choice reachable above the request/offer form.
 * Switching roles never submits or publishes either form.
 */
export function RideIntentSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: RideIntent;
  onChange: (value: RideIntent) => void;
  disabled?: boolean;
}) {
  const options = [
    { value: "REQUEST", label: "Pedir carona", Icon: MapPin },
    { value: "OFFER", label: "Oferecer carona", Icon: CarFront },
  ] as const;
  return (
    <div role="group" aria-label="Pedir ou oferecer carona"
      className="grid min-w-0 w-full grid-cols-2 gap-1.5 rounded-2xl border border-white/15 bg-black/30 p-1.5"
      data-testid="ride-intent-switch">
      {options.map(({ value: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          disabled={disabled}
          onClick={() => option !== value && onChange(option)}
          className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-center text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] disabled:opacity-60 sm:text-sm ${value === option
            ? "bg-[#FFBB00] text-[#121212] shadow-sm"
            : "text-gray-200 hover:bg-white/10"}`}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}
