import { CarFront, Users } from "lucide-react";
export type TripMode = "CARPOOL" | "EXCLUSIVE";
export function TripModeSelector({
  value,
  onChange,
}: {
  value: TripMode;
  onChange: (mode: TripMode) => void;
}) {
  return (
    <fieldset className="my-4 space-y-2">
      <legend className="text-sm font-bold">Como você quer viajar?</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            {
              mode: "CARPOOL",
              title: "Carona Compartilhada",
              subtitle: "Econômica · Trajeto compartilhado",
              description:
                "Compartilhe o trajeto de quem já vai dirigir. Pode exigir caminhada curta até um ponto de encontro.",
              Icon: Users,
            },
            {
              mode: "EXCLUSIVE",
              title: "Viajar Agora",
              subtitle: "Corrida direta · piloto regional",
              description:
                "Origem e destino indicados por você. Motoristas autorizados, sem cobrança comercial automatizada no piloto.",
              Icon: CarFront,
            },
          ] as const
        ).map((item) => (
          <label
            key={item.mode}
            className={
              "flex min-h-28 cursor-pointer gap-3 rounded-2xl border-2 p-4 transition " +
              (value === item.mode
                ? "border-[#FFBB00] bg-[#121212] text-white"
                : "border-border bg-card text-foreground")
            }
          >
            <input
              type="radio"
              name="trip-mode"
              value={item.mode}
              checked={value === item.mode}
              onChange={() => onChange(item.mode)}
              className="mt-1 size-4 accent-[#FFBB00]"
            />
            <span>
              <span className="flex items-center gap-2 font-bold">
                <item.Icon size={18} className="text-[#FFBB00]" />
                {item.title}
              </span>
              <span
                className={
                  "mt-1 block text-xs font-semibold " +
                  (value === item.mode ? "text-[#FFBB00]" : "text-muted-foreground")
                }
              >
                {item.subtitle}
              </span>
              <span className="mt-2 block text-xs opacity-80">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
