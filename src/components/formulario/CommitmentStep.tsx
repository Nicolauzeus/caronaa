import type { CaronaaIntent, CommitmentLevel } from "@/lib/formulario/types";

type CommitmentStepProps = {
  intent: Exclude<CaronaaIntent, "AMBOS">;
  value?: CommitmentLevel | undefined;
  onChange: (value: CommitmentLevel) => void;
  onNext: () => void;
  onBack: () => void;
};

const passengerOptions: Array<{
  value: CommitmentLevel;
  title: string;
  description: string;
}> = [
  {
    value: "SIM_HOJE",
    title: "Sim, quero tentar usar hoje",
    description: "Se aparecer uma carona compatível, quero que a CARONAA me conecte.",
  },
  {
    value: "QUERO_VER_MATCH",
    title: "Quero ver motorista e rota primeiro",
    description: "Tenho interesse, mas quero analisar as informações antes de decidir.",
  },
];

const driverOptions: Array<{
  value: CommitmentLevel;
  title: string;
  description: string;
}> = [
  {
    value: "SIM_HOJE",
    title: "Sim, posso levar alguém hoje",
    description: "Se aparecer um passageiro compatível, quero que a CARONAA me conecte.",
  },
  {
    value: "QUERO_VER_MATCH",
    title: "Quero ver passageiro e destino primeiro",
    description: "Posso oferecer carona, mas quero analisar a combinação antes de decidir.",
  },
  {
    value: "NAO_HOJE",
    title: "Hoje não",
    description: "Tenho interesse na CARONAA, mas não vou oferecer carona hoje.",
  },
];

export function CommitmentStep({ intent, value, onChange, onNext, onBack }: CommitmentStepProps) {
  const isPassenger = intent === "PASSAGEIRO";

  const options = isPassenger ? passengerOptions : driverOptions;

  const title = isPassenger
    ? "Se encontrarmos uma carona compatível, você usaria hoje?"
    : "Se encontrarmos um passageiro compatível, você levaria hoje?";

  const description = isPassenger
    ? "Considere uma pessoa saindo do STS em horário parecido e indo para perto do seu destino."
    : "Considere uma pessoa do STS, com destino compatível e dentro do desvio que você aceitou.";

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Uso real hoje</p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium">
          Essa resposta é importante para a validação da CARONAA.
        </p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Queremos medir quem realmente toparia formar uma viagem hoje, e não apenas quem acha a
          ideia interessante.
        </p>
      </div>

      <div className="grid gap-3" role="radiogroup" aria-label="Intenção de uso hoje">
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
                  selected ? "border-[6px] border-primary" : "border-muted-foreground/40",
                ].join(" ")}
                aria-hidden="true"
              />

              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-semibold">{option.title}</span>

                <span className="block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="sts-navigation flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
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
