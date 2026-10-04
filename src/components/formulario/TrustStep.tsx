import type {
  CaronaaIntent,
  TrustFactor,
} from "@/lib/formulario/types";

type TrustStepProps = {
  intent: Exclude<CaronaaIntent, "AMBOS">;
  value?: TrustFactor[];
  onChange: (value: TrustFactor[]) => void;
  onNext: () => void;
  onBack: () => void;
};

const trustOptions: Array<{
  value: TrustFactor;
  title: string;
  description: string;
}> = [
  {
    value: "IDENTIDADE_VERIFICADA",
    title: "Identidade verificada",
    description:
      "Saber que a identidade da outra pessoa foi confirmada.",
  },
  {
    value: "FOTO",
    title: "Foto no perfil",
    description:
      "Conseguir reconhecer a pessoa antes do encontro.",
  },
  {
    value: "WHATSAPP_VERIFICADO",
    title: "Telefone verificado",
    description:
      "Ter um número de contato confirmado pela CARONAA.",
  },
  {
    value: "PERFIL_CARONAA",
    title: "Perfil CARONAA",
    description:
      "Ver informações básicas e histórico da pessoa.",
  },
  {
    value: "DADOS_VEICULO",
    title: "Dados do veículo",
    description:
      "Ver modelo, cor e outras informações do veículo.",
  },
  {
    value: "PLACA",
    title: "Placa do veículo",
    description:
      "Conferir a placa antes do embarque.",
  },
  {
    value: "AVALIACOES",
    title: "Avaliações",
    description:
      "Ver experiências anteriores de outras pessoas.",
  },
  {
    value: "PARTICIPANTE_STS",
    title: "Saber que está no STS",
    description:
      "Ter certeza de que a outra pessoa também participa do evento.",
  },
  {
    value: "ROTA_VISIVEL",
    title: "Ver a rota antes",
    description:
      "Conferir destino e percurso antes de confirmar.",
  },
  {
    value: "COMPARTILHAR_VIAGEM",
    title: "Compartilhar a viagem",
    description:
      "Poder compartilhar informações da viagem com alguém.",
  },
  {
    value: "OUTRO",
    title: "Outro fator",
    description:
      "Existe outra coisa importante para você se sentir seguro.",
  },
];

export function TrustStep({
  intent,
  value = [],
  onChange,
  onNext,
  onBack,
}: TrustStepProps) {
  const isPassenger = intent === "PASSAGEIRO";

  const title = isPassenger
    ? "O que faria você confiar em uma carona hoje?"
    : "O que faria você confiar em um passageiro hoje?";

  const description = isPassenger
    ? "Escolha tudo que você gostaria de verificar antes de entrar no veículo."
    : "Escolha tudo que ajudaria você a se sentir seguro antes de levar alguém.";

  function toggleOption(option: TrustFactor) {
    if (value.includes(option)) {
      onChange(
        value.filter((item) => item !== option),
      );
      return;
    }

    onChange([...value, option]);
  }

  const canContinue = value.length > 0;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Confiança e segurança
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
          Você poderá analisar essas informações antes de
          confirmar qualquer match.
        </p>
      </div>

      <div
        className="grid gap-2 sm:grid-cols-2"
        role="group"
        aria-label="Fatores de confiança"
      >
        {trustOptions.map((option) => {
          const selected =
            value.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                toggleOption(option.value)
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
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                ].join(" ")}
                aria-hidden="true"
              >
                {selected && (
                  <span className="text-xs font-bold">
                    ✓
                  </span>
                )}
              </span>

              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-semibold">
                  {option.title}
                </span>

                <span className="block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {value.length} selecionado
          {value.length === 1 ? "" : "s"}
        </span>

        <span>
          Pode escolher mais de um
        </span>
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
