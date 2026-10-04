import type {
  CaronaaIntent,
  PriceRange,
} from "@/lib/formulario/types";

type PriceStepProps = {
  intent: Exclude<CaronaaIntent, "AMBOS">;
  value?: PriceRange | undefined;
  onChange: (value: PriceRange) => void;
  onNext: () => void;
  onBack: () => void;
};

const passengerOptions: Array<{
  value: PriceRange;
  label: string;
  description: string;
}> = [
  {
    value: "ATE_5",
    label: "Até R$ 5",
    description: "Uma contribuição pequena para ajudar nos custos.",
  },
  {
    value: "5_10",
    label: "R$ 5 a R$ 10",
    description: "Uma faixa intermediária para uma rota curta.",
  },
  {
    value: "10_15",
    label: "R$ 10 a R$ 15",
    description: "Aceitaria contribuir nessa faixa pela viagem.",
  },
  {
    value: "15_20",
    label: "R$ 15 a R$ 20",
    description: "Faria sentido dependendo da distância.",
  },
  {
    value: "ACIMA_20",
    label: "Acima de R$ 20",
    description: "Aceitaria mais em uma rota mais longa.",
  },
  {
    value: "DEPENDE_DISTANCIA",
    label: "Depende da distância",
    description: "Prefiro avaliar a rota antes de definir.",
  },
  {
    value: "GRATUITO",
    label: "Só usaria se fosse gratuito",
    description: "Não pagaria contribuição pela viagem.",
  },
];

const driverOptions: Array<{
  value: PriceRange;
  label: string;
  description: string;
}> = [
  {
    value: "ATE_5",
    label: "Até R$ 5",
    description: "Uma ajuda simbólica já faria sentido.",
  },
  {
    value: "5_10",
    label: "R$ 5 a R$ 10",
    description: "Essa contribuição ajudaria nos custos.",
  },
  {
    value: "10_15",
    label: "R$ 10 a R$ 15",
    description: "Consideraria uma boa faixa de rateio.",
  },
  {
    value: "15_20",
    label: "R$ 15 a R$ 20",
    description: "Faria sentido dependendo da rota.",
  },
  {
    value: "ACIMA_20",
    label: "Acima de R$ 20",
    description: "Para trajetos mais longos.",
  },
  {
    value: "DEPENDE_DISTANCIA",
    label: "Depende da distância",
    description: "Prefiro avaliar a rota antes.",
  },
  {
    value: "GRATUITO",
    label: "Não precisaria receber",
    description: "Eu ofereceria a carona sem contribuição.",
  },
];

export function PriceStep({
  intent,
  value,
  onChange,
  onNext,
  onBack,
}: PriceStepProps) {
  const isPassenger = intent === "PASSAGEIRO";

  const options = isPassenger
    ? passengerOptions
    : driverOptions;

  const title = isPassenger
    ? "Quanto você consideraria justo contribuir pela viagem?"
    : "Qual contribuição faria sentido para ajudar nos custos da viagem?";

  const description = isPassenger
    ? "Imagine que encontramos hoje alguém saindo do STS, em horário parecido, e indo para perto do seu destino."
    : "Não estamos falando de cobrar uma corrida. Queremos entender qual rateio ajudaria combustível e outros custos do trajeto.";

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Contribuição pela viagem
        </p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          A ideia da CARONAA é compartilhar uma rota que já aconteceria,
          com uma contribuição justa entre as pessoas envolvidas.
        </p>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Faixa de contribuição"
      >
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={[
                "flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left transition",
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

      <div className="space-y-1 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium">
          Isso não confirma nenhuma cobrança.
        </p>

        <p className="text-xs leading-5 text-muted-foreground">
          Estamos validando qual faixa parece justa antes de qualquer
          match ou viagem.
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
          disabled={!value}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
