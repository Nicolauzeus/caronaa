import type { PassengerTransport, VehicleType } from "@/lib/formulario/types";

type BothFlowProps = {
  vehicleType?: VehicleType | undefined;
  availableSeats?: number | undefined;
  currentTransport?: PassengerTransport | undefined;
  onVehicleTypeChange: (value: VehicleType) => void;
  onAvailableSeatsChange: (value: number) => void;
  onCurrentTransportChange: (value: PassengerTransport) => void;
  onNext: () => void;
  onBack: () => void;
};

const vehicleOptions: Array<{
  value: VehicleType;
  icon: string;
  label: string;
}> = [
  {
    value: "CARRO_PROPRIO",
    icon: "🚗",
    label: "Carro próprio",
  },
  {
    value: "CARRO_COMPARTILHADO",
    icon: "🚙",
    label: "Carro da família / compartilhado",
  },
  {
    value: "MOTO",
    icon: "🏍️",
    label: "Moto",
  },
];

const transportOptions: Array<{
  value: PassengerTransport;
  icon: string;
  label: string;
}> = [
  {
    value: "ONIBUS",
    icon: "🚌",
    label: "Ônibus",
  },
  {
    value: "UBER_99",
    icon: "📱",
    label: "Uber / 99",
  },
  {
    value: "CARONA",
    icon: "🚗",
    label: "Carona com alguém",
  },
  {
    value: "BICICLETA",
    icon: "🚲",
    label: "Bicicleta",
  },
  {
    value: "APE",
    icon: "🚶",
    label: "A pé",
  },
  {
    value: "OUTRO",
    icon: "•••",
    label: "Outro",
  },
];

const seatOptions = [1, 2, 3, 4];

export function BothFlow({
  vehicleType,
  availableSeats,
  currentTransport,
  onVehicleTypeChange,
  onAvailableSeatsChange,
  onCurrentTransportChange,
  onNext,
  onBack,
}: BothFlowProps) {
  const isMoto = vehicleType === "MOTO";

  const canContinue =
    Boolean(vehicleType) && Boolean(currentTransport) && (isMoto || Boolean(availableSeats));

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Flexibilidade</p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Você pode oferecer ou pegar carona
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Vamos entender rapidamente as duas possibilidades para tentar encontrar a melhor opção
          para você hoje.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">Se você oferecer carona, qual veículo usaria?</h3>

          <p className="text-sm text-muted-foreground">
            Escolha o veículo que você realmente poderia usar hoje.
          </p>
        </div>

        <div
          className="grid gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Veículo para oferecer carona"
        >
          {vehicleOptions.map((option) => {
            const selected = vehicleType === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onVehicleTypeChange(option.value)}
                className={[
                  "flex min-h-24 flex-col items-start rounded-xl border p-4 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span className="text-2xl" aria-hidden="true">
                  {option.icon}
                </span>

                <span className="mt-3 text-sm font-semibold">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {vehicleType && vehicleType !== "MOTO" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="font-semibold">Quantos lugares você teria disponíveis?</h3>

            <p className="text-sm text-muted-foreground">
              Informe apenas o que você realmente toparia oferecer.
            </p>
          </div>

          <div
            className="grid grid-cols-4 gap-3"
            role="radiogroup"
            aria-label="Lugares disponíveis"
          >
            {seatOptions.map((seat) => {
              const selected = availableSeats === seat;

              return (
                <button
                  key={seat}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onAvailableSeatsChange(seat)}
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
      ) : null}

      {vehicleType === "MOTO" ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">Vamos considerar a moto separadamente.</p>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Essa modalidade ainda pode ter regras diferentes de uma carona de carro.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">
            E se você preferir pegar carona, como voltaria sem a CARONAA?
          </h3>

          <p className="text-sm text-muted-foreground">
            Queremos entender qual alternativa você substituiria hoje.
          </p>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Alternativa de transporte"
        >
          {transportOptions.map((option) => {
            const selected = currentTransport === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onCurrentTransportChange(option.value)}
                className={[
                  "flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg"
                  aria-hidden="true"
                >
                  {option.icon}
                </span>

                <span className="min-w-0 flex-1 text-sm font-medium">{option.label}</span>

                <span
                  className={[
                    "h-5 w-5 shrink-0 rounded-full border",
                    selected ? "border-[6px] border-primary" : "border-muted-foreground/40",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Mais adiante vamos perguntar confiança e contribuição apenas uma vez para cada papel, sem
          repetir destino, horário ou contato.
        </p>
      </div>

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
