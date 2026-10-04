import * as React from "react";
import type { CaronaaIntent, PriceRange } from "@/lib/formulario/types";
import { calculateDriverPricing, MIN_DRIVER_PRICE } from "@/lib/formulario/pricing";

type PassengerPriceStepProps = {
  intent: "PASSAGEIRO";
  value?: PriceRange | undefined;
  onChange: (value: PriceRange) => void;
  onNext: () => void;
  onBack: () => void;
};

type DriverPriceStepProps = {
  intent: "MOTORISTA";
  value?: number | undefined;
  onChange: (value: number | undefined) => void;
  onNext: () => void;
  onBack: () => void;
};

type PriceStepProps = PassengerPriceStepProps | DriverPriceStepProps;

type SharedPriceStepProps = {
  intent: Exclude<CaronaaIntent, "AMBOS">;
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

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function parseMoneyInput(value: string): number | undefined {
  const normalized = value.replace(/[^\d,.]/g, "").replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined;
}

function DriverPriceStep({
  value,
  onChange,
  onNext,
  onBack,
}: Omit<DriverPriceStepProps, "intent">) {
  const [inputValue, setInputValue] = React.useState(
    value ? value.toFixed(2).replace(".", ",") : "",
  );

  React.useEffect(() => {
    setInputValue(value ? value.toFixed(2).replace(".", ",") : "");
  }, [value]);

  const pricing = value !== undefined ? calculateDriverPricing(value) : null;

  const showMinimumError = value !== undefined && value < MIN_DRIVER_PRICE;

  const canContinue = value !== undefined && value >= MIN_DRIVER_PRICE;

  return (
    <PriceStepShell intent="MOTORISTA" onNext={onNext} onBack={onBack} canContinue={canContinue}>
      <div className="space-y-3">
        <label htmlFor="driver-price" className="text-sm font-semibold">
          Quanto você quer cobrar por passageiro?
        </label>

        <div className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
          <span className="text-base font-semibold text-muted-foreground">R$</span>

          <input
            id="driver-price"
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(event) => {
              const nextInputValue = event.target.value;

              setInputValue(nextInputValue);
              onChange(parseMoneyInput(nextInputValue));
            }}
            onBlur={() => {
              if (value !== undefined) {
                setInputValue(value.toFixed(2).replace(".", ","));
              }
            }}
            placeholder="10,00"
            aria-invalid={showMinimumError}
            aria-describedby={showMinimumError ? "driver-price-error" : undefined}
            className="min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        {showMinimumError ? (
          <p id="driver-price-error" className="text-sm font-medium text-destructive">
            O valor mínimo por passageiro é R$ 3,50.
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-semibold">Resumo</p>

        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Valor cobrado</dt>
            <dd className="font-semibold">
              {pricing ? formatMoney(pricing.driverPrice) : "R$ 0,00"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Taxa CARONAA 15%</dt>
            <dd className="font-semibold text-destructive">
              - {pricing ? formatMoney(pricing.caronaaFee) : "R$ 0,00"}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <dt className="font-semibold">Você recebe</dt>
            <dd className="text-base font-bold text-primary">
              {pricing ? formatMoney(pricing.driverNetAmount) : "R$ 0,00"}
            </dd>
          </div>
        </dl>
      </div>
    </PriceStepShell>
  );
}

function PriceStepShell({
  intent,
  children,
  onNext,
  onBack,
  canContinue,
}: SharedPriceStepProps & { children: React.ReactNode; canContinue: boolean }) {
  const isPassenger = intent === "PASSAGEIRO";

  const title = isPassenger
    ? "Quanto você consideraria justo contribuir pela viagem?"
    : "Quanto você quer receber por passageiro?";

  const description = isPassenger
    ? "Imagine que encontramos hoje alguém saindo do STS, em horário parecido, e indo para perto do seu destino."
    : "Informe o valor exato cobrado de cada passageiro. A CARONAA retém 15% e mostra quanto fica líquido para você.";

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Contribuição pela viagem</p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          A ideia da CARONAA é compartilhar uma rota que já aconteceria, com uma contribuição justa
          entre as pessoas envolvidas.
        </p>
      </div>

      {children}

      <div className="space-y-1 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium">Isso não confirma nenhuma cobrança.</p>

        <p className="text-xs leading-5 text-muted-foreground">
          Estamos validando qual faixa parece justa antes de qualquer match ou viagem.
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

function PassengerPriceStep({
  value,
  onChange,
  onNext,
  onBack,
}: Omit<PassengerPriceStepProps, "intent">) {
  return (
    <PriceStepShell
      intent="PASSAGEIRO"
      onNext={onNext}
      onBack={onBack}
      canContinue={Boolean(value)}
    >
      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Faixa de contribuição"
      >
        {passengerOptions.map((option) => {
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
                  selected ? "border-[6px] border-primary" : "border-muted-foreground/40",
                ].join(" ")}
                aria-hidden="true"
              />

              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-semibold">{option.label}</span>

                <span className="block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </PriceStepShell>
  );
}

export function PriceStep(props: PriceStepProps) {
  if (props.intent === "PASSAGEIRO") {
    return <PassengerPriceStep {...props} />;
  }

  return <DriverPriceStep {...props} />;
}
