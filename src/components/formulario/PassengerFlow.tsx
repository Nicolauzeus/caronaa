import type { PassengerTransport } from "@/lib/formulario/types";

type PassengerFlowProps = {
  passengerCount?: number | undefined;
  currentTransport?: PassengerTransport | undefined;
  onPassengerCountChange: (value: number) => void;
  onCurrentTransportChange: (value: PassengerTransport) => void;
  onNext: () => void;
  onBack: () => void;
};

const passengerCountOptions = [
  {
    value: 1,
    label: "Só eu",
    description: "1 lugar",
  },
  {
    value: 2,
    label: "Nós dois",
    description: "2 lugares",
  },
  {
    value: 3,
    label: "3 pessoas",
    description: "3 lugares",
  },
  {
    value: 4,
    label: "4+ pessoas",
    description: "4 ou mais lugares",
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
    label: "Ônibus / transporte público",
  },
  {
    value: "UBER_99",
    icon: "📱",
    label: "Uber / 99 / aplicativo",
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

export function PassengerFlow({
  passengerCount,
  currentTransport,
  onPassengerCountChange,
  onCurrentTransportChange,
  onNext,
  onBack,
}: PassengerFlowProps) {
  const canContinue =
    Boolean(passengerCount) &&
    Boolean(currentTransport);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Sua carona
        </p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Vamos tentar encontrar sua volta para casa
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Precisamos entender quantos lugares você precisa e qual
          alternativa usaria se não encontrasse uma CARONAA hoje.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">
            A carona seria para quantas pessoas?
          </h3>

          <p className="text-sm text-muted-foreground">
            Isso nos ajuda a procurar um veículo com vagas suficientes.
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          role="radiogroup"
          aria-label="Quantidade de passageiros"
        >
          {passengerCountOptions.map((option) => {
            const selected =
              passengerCount === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onPassengerCountChange(option.value)
                }
                className={[
                  "flex min-h-20 flex-col items-center justify-center rounded-xl border px-3 py-3 text-center transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span className="text-sm font-semibold">
                  {option.label}
                </span>

                <span className="mt-1 text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">
            Se não encontrasse uma CARONAA, como você voltaria hoje?
          </h3>

          <p className="text-sm leading-5 text-muted-foreground">
            Queremos entender qual alternativa a CARONAA estaria
            substituindo nesta viagem.
          </p>
        </div>

        <div
          className="grid gap-2 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Alternativa de transporte para hoje"
        >
          {transportOptions.map((option) => {
            const selected =
              currentTransport === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onCurrentTransportChange(option.value)
                }
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

                <span className="min-w-0 flex-1 text-sm font-medium">
                  {option.label}
                </span>

                <span
                  className={[
                    "h-5 w-5 shrink-0 rounded-full border",
                    selected
                      ? "border-[6px] border-primary"
                      : "border-muted-foreground/40",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
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
