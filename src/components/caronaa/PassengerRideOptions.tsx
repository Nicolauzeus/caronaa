import { CarFront, Bike, Zap } from "lucide-react";
import { formatBrl } from "@/lib/ride-cost";

export type PassengerRideOption = "CAR" | "MOTO" | "EXCLUSIVE";

/**
 * Two compact choices on narrow phones, one full-width quick-ride choice,
 * three equal columns above 640px. All labels wrap inside the viewport;
 * swapping modes must not change the width of the map bottom sheet.
 */
export function PassengerRideOptions({
  value,
  onChange,
  estimate,
}: {
  value: PassengerRideOption;
  onChange: (value: PassengerRideOption) => void;
  estimate: number | null;
}) {
  const options = [
    {
      value: "CAR",
      title: "Carona Compartilhada",
      description: "Compartilhe o trajeto",
      Icon: CarFront,
    },
    { value: "MOTO", title: "Carona Moto", description: "Uma vaga", Icon: Bike },
    {
      value: "EXCLUSIVE",
      title: "Corrida Rápida",
      description: "Carro ou moto sob demanda",
      Icon: Zap,
    },
  ] as const;

  return (
    <fieldset className="min-w-0 w-full max-w-full">
      <legend className="mb-2 text-sm font-bold">Escolha sua viagem</legend>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3" data-testid="passenger-ride-mode-grid">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-w-0 max-w-full cursor-pointer flex-col gap-2 overflow-hidden rounded-2xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-[#FFBB00] sm:min-h-28 ${option.value === "EXCLUSIVE" ? "col-span-2 sm:col-span-1" : ""} ${selected ? "border-[#FFBB00] bg-[#FFBB00]/10" : "border-white/10 bg-white/5"}`}
            >
              <input
                type="radio"
                name="passenger-ride-option"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="flex min-w-0 items-center gap-2">
                <option.Icon size={20} className="shrink-0 text-[#FFBB00]" aria-hidden="true" />
                <span className="min-w-0 break-words text-xs font-extrabold leading-snug sm:text-sm">
                  {option.title}
                </span>
                {selected && <span aria-hidden="true" className="ml-auto size-2 shrink-0 rounded-full bg-[#FFBB00]" />}
              </span>
              <span className="min-w-0 break-words text-[11px] leading-snug text-gray-300">
                {option.description}
              </span>
              <span className="min-w-0 break-words text-xs font-bold text-[#FFBB00]">
                {option.value === "EXCLUSIVE" ? "Agora" :
                  estimate == null ? "Econômica" :
                  `${formatBrl(estimate)} / pessoa`}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
