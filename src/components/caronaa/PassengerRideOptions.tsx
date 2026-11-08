import { CarFront, Bike, Zap } from "lucide-react";
import { formatBrl } from "@/lib/ride-cost";
export type PassengerRideOption = "CAR" | "MOTO" | "EXCLUSIVE";
export function PassengerRideOptions({
  value,
  onChange,
  estimate,
}: {
  value: PassengerRideOption;
  onChange: (value: PassengerRideOption) => void;
  estimate: number | null;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-bold">Escolha sua viagem</legend>
      {(
        [
          {
            value: "CAR",
            title: "Carona Compartilhada",
            description: "Até 3 vagas compartilhadas",
            Icon: CarFront,
          },
          { value: "MOTO", title: "Carona Moto", description: "1 vaga rápida", Icon: Bike },
          {
            value: "EXCLUSIVE",
            title: "Corrida Rápida",
            description: "Motorista ou mototáxi próximo, no mesmo mapa",
            Icon: Zap,
          },
        ] as const
      ).map((option) => (
        <label
          key={option.value}
          className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border p-3 transition focus-within:ring-2 focus-within:ring-[#FFBB00] ${value === option.value ? "border-[#FFBB00] bg-[#FFBB00]/10" : "border-white/10 bg-white/5"}`}
        >
          <input
            type="radio"
            name="passenger-ride-option"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <option.Icon size={28} className="shrink-0 text-[#FFBB00]" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{option.title}</span>
            <span className="mt-1 block text-xs text-gray-300">{option.description}</span>
          </span>
          <span className="shrink-0 text-right text-sm font-bold text-[#FFBB00]">
            {option.value === "EXCLUSIVE" ? (
              <span className="rounded-full bg-[#FFBB00] px-2 py-1 text-xs text-[#121212]">
                Agora
              </span>
            ) : estimate == null ? (
              <span className="text-xs">Econômica</span>
            ) : (
              <>
                <span className="block">{formatBrl(estimate)}</span>
                <span className="text-[10px] font-normal text-gray-300">estimado / pessoa</span>
              </>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
