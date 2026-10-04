import type {
  VehicleType,
} from "@/lib/formulario/types";

type DriverFlowProps = {
  vehicleType?: VehicleType | undefined;
  availableSeats?: number | undefined;
  maxDetourMinutes?: number | undefined;
  onVehicleTypeChange: (value: VehicleType) => void;
  onAvailableSeatsChange: (value: number) => void;
  onMaxDetourMinutesChange: (value: number) => void;
  onNext: () => void;
  onBack: () => void;
};

const vehicleOptions: Array<{
  value: VehicleType;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    value: "CARRO_PROPRIO",
    icon: "🚗",
    title: "Carro próprio",
    description:
      "Estou com meu próprio carro hoje.",
  },
  {
    value: "CARRO_COMPARTILHADO",
    icon: "🚙",
    title: "Carro da família / compartilhado",
    description:
      "Tenho acesso ao carro e posso oferecer a carona.",
  },
  {
    value: "MOTO",
    icon: "🏍️",
    title: "Moto",
    description:
      "Estou de moto hoje.",
  },
];

const seatOptions = [1, 2, 3, 4];

const detourOptions: Array<{
  value: number;
  label: string;
  description: string;
}> = [
  {
    value: 0,
    label: "Só no meu caminho",
    description:
      "Não quero desviar da rota.",
  },
  {
    value: 5,
    label: "Até 5 min",
    description:
      "Aceito um pequeno desvio.",
  },
  {
    value: 10,
    label: "Até 10 min",
    description:
      "Tenho alguma flexibilidade.",
  },
  {
    value: 15,
    label: "Até 15 min",
    description:
      "Posso ajustar um pouco mais a rota.",
  },
];

export function DriverFlow({
  vehicleType,
  availableSeats,
  maxDetourMinutes,
  onVehicleTypeChange,
  onAvailableSeatsChange,
  onMaxDetourMinutesChange,
  onNext,
  onBack,
}: DriverFlowProps) {
  const isMoto = vehicleType === "MOTO";

  const canContinue =
    Boolean(vehicleType) &&
    (
      isMoto ||
      (
        Boolean(availableSeats) &&
        maxDetourMinutes !== undefined
      )
    );

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Sua oferta de carona
        </p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Como você poderia levar alguém hoje?
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Queremos entender sua capacidade real para a saída do STS.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">
            Com qual veículo você está hoje?
          </h3>

          <p className="text-sm text-muted-foreground">
            Escolha a opção que você realmente poderia usar na carona.
          </p>
        </div>

        <div
          className="grid gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Tipo de veículo"
        >
          {vehicleOptions.map((option) => {
            const selected =
              vehicleType === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onVehicleTypeChange(option.value)
                }
                className={[
                  "flex min-h-28 flex-col items-start rounded-xl border p-4 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span
                  className="text-2xl"
                  aria-hidden="true"
                >
                  {option.icon}
                </span>

                <span className="mt-3 text-sm font-semibold">
                  {option.title}
                </span>

                <span className="mt-1 text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {vehicleType === "MOTO" ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">
            Moto será analisada separadamente nesta validação.
          </p>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Estamos entendendo também esse perfil, sem assumir a mesma
            capacidade e dinâmica de um carro.
          </p>
        </div>
      ) : null}

      {vehicleType && !isMoto ? (
        <>
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold">
                Quantos lugares você poderia disponibilizar hoje?
              </h3>

              <p className="text-sm text-muted-foreground">
                Conte apenas os lugares que você realmente toparia oferecer.
              </p>
            </div>

            <div
              className="grid grid-cols-4 gap-3"
              role="radiogroup"
              aria-label="Lugares disponíveis"
            >
              {seatOptions.map((seat) => {
                const selected =
                  availableSeats === seat;

                return (
                  <button
                    key={seat}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      onAvailableSeatsChange(seat)
                    }
                    className={[
                      "min-h-14 rounded-xl border px-3 py-3 text-sm font-semibold transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                    ].join(" ")}
                  >
                    {seat === 4 ? "4+" : seat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="font-semibold">
                Quanto você aceitaria desviar da sua rota?
              </h3>

              <p className="text-sm text-muted-foreground">
                Isso ajuda a entender quais passageiros realmente cabem
                no seu trajeto.
              </p>
            </div>

            <div
              className="grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Desvio máximo da rota"
            >
              {detourOptions.map((option) => {
                const selected =
                  maxDetourMinutes === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      onMaxDetourMinutesChange(option.value)
                    }
                    className={[
                      "flex min-h-20 items-start gap-3 rounded-xl border p-4 text-left transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "mt-0.5 h-5 w-5 shrink-0 rounded-full border",
                        selected
                          ? "border-[6px] border-primary"
                          : "border-muted-foreground/40",
                      ].join(" ")}
                      aria-hidden="true"
                    />

                    <span className="min-w-0 space-y-1">
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>

                      <span className="block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-medium transition hover:bg-accent"
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
