import type { CaronaaIntent } from "@/lib/formulario/types";

type IntentStepProps = {
  value?: CaronaaIntent | undefined;
  onChange: (intent: CaronaaIntent) => void;
  onNext: () => void;
  onBack: () => void;
};

const options: Array<{
  value: CaronaaIntent;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    value: "MOTORISTA",
    icon: "🚗",
    title: "Quero oferecer carona",
    description:
      "Tenho veículo e posso levar pessoas que estejam indo para uma rota parecida.",
  },
  {
    value: "PASSAGEIRO",
    icon: "🎒",
    title: "Quero pegar carona",
    description:
      "Quero encontrar alguém saindo do STS e indo para perto do meu destino.",
  },
  {
    value: "AMBOS",
    icon: "🔄",
    title: "Posso fazer os dois",
    description:
      "Posso oferecer ou pegar carona, dependendo da melhor opção disponível.",
  },
];

export function IntentStep({
  value,
  onChange,
  onNext,
  onBack,
}: IntentStepProps) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Primeiro, escolha seu papel
        </p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Como você quer usar a CARONAA hoje?
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Vamos mostrar apenas as perguntas que fazem sentido
          para você.
        </p>
      </div>

      <div
        className="grid gap-3"
        role="radiogroup"
        aria-label="Como você quer usar a CARONAA hoje?"
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
                "group w-full rounded-2xl border p-4 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
              ].join(" ")}
            >
              <div className="flex items-start gap-4">
                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {option.icon}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      {option.title}
                    </h3>

                    <span
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {selected && (
                        <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                      )}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
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
