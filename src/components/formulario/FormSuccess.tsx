import type { CaronaaStsFormData } from "@/lib/formulario/types";
import { getLeadClassification } from "@/lib/formulario/classification";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type FormSuccessProps = {
  data: CaronaaStsFormData;
  onRestart?: () => void;
};

function getIntentLabel(intent: CaronaaStsFormData["intent"]) {
  switch (intent) {
    case "MOTORISTA":
      return "Oferecer carona";

    case "PASSAGEIRO":
      return "Pegar carona";

    case "AMBOS":
      return "Oferecer ou pegar carona";

    default:
      return "CARONAA";
  }
}

function getDepartureLabel(departureWindow: CaronaaStsFormData["departureWindow"]) {
  switch (departureWindow) {
    case "ANTES_18":
      return "Antes das 18h";

    case "18_19":
      return "18h – 19h";

    case "19_20":
      return "19h – 20h";

    case "20_21":
      return "20h – 21h";

    case "21_22":
      return "21h – 22h";

    case "APOS_22":
      return "Depois das 22h";

    default:
      return "Não informado";
  }
}

function getActivationMessage(data: CaronaaStsFormData) {
  const classification = getLeadClassification(data);

  if (classification.activationStatus === "QUER_USAR_HOJE") {
    if (data.intent === "MOTORISTA") {
      return {
        title: "Sua rota entrou na CARONAA",
        description:
          "Vamos procurar passageiros do STS com destino e horário compatíveis com os seus.",
      };
    }

    if (data.intent === "PASSAGEIRO") {
      return {
        title: "Vamos tentar encontrar sua carona",
        description:
          "Vamos procurar motoristas do STS saindo em horário parecido e indo para perto do seu destino.",
      };
    }

    return {
      title: "Vamos procurar a melhor combinação para você",
      description:
        "Como você pode oferecer ou pegar carona, vamos considerar as duas possibilidades.",
    };
  }

  if (classification.activationStatus === "QUER_VER_MATCH") {
    return {
      title: "Vamos procurar uma combinação para você avaliar",
      description:
        "Se encontrarmos uma opção compatível, você poderá analisar as informações antes de decidir.",
    };
  }

  return {
    title: "Obrigado por participar da validação da CARONAA",
    description:
      "Sua resposta vai nos ajudar a entender melhor como tornar a experiência segura e útil para quem sai do STS.",
  };
}

export function FormSuccess({ data, onRestart }: FormSuccessProps) {
  const classification = getLeadClassification(data);

  const message = getActivationMessage(data);

  const shouldShowMatching = classification.wantsToSeeMatch;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl"
          aria-hidden="true"
        >
          ✓
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-primary">Resposta registrada</p>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{message.title}</h1>

          <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            {message.description}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4 border-b pb-3">
          <div>
            <p className="text-xs text-muted-foreground">Seu papel</p>

            <p className="mt-1 text-sm font-semibold">{getIntentLabel(data.intent)}</p>
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            STS 2026
          </span>
        </div>

        <dl className="grid gap-4 pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Destino</dt>

            <dd className="mt-1 text-sm font-medium">
              {data.destinationNeighborhood ?? "Não informado"}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-muted-foreground">Horário de saída</dt>

            <dd className="mt-1 text-sm font-medium">{getDepartureLabel(data.departureWindow)}</dd>
          </div>

          {data.intent !== "PASSAGEIRO" && data.vehicleType ? (
            <div>
              <dt className="text-xs text-muted-foreground">Veículo</dt>

              <dd className="mt-1 text-sm font-medium">
                {data.vehicleType === "CARRO_PROPRIO"
                  ? "Carro próprio"
                  : data.vehicleType === "CARRO_COMPARTILHADO"
                    ? "Carro compartilhado"
                    : "Moto"}
              </dd>
            </div>
          ) : null}

          {data.intent !== "MOTORISTA" && data.passengerCount ? (
            <div>
              <dt className="text-xs text-muted-foreground">Pessoas</dt>

              <dd className="mt-1 text-sm font-medium">
                {data.passengerCount === 1
                  ? "1 pessoa"
                  : `${data.passengerCount}${data.passengerCount === 4 ? "+" : ""} pessoas`}
              </dd>
            </div>
          ) : null}

          {data.intent !== "PASSAGEIRO" && data.driverPrice !== undefined ? (
            <div>
              <dt className="text-xs text-muted-foreground">Valor por passageiro</dt>

              <dd className="mt-1 text-sm font-medium">
                {moneyFormatter.format(data.driverPrice)}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {shouldShowMatching ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <div className="flex gap-3">
            <span className="text-xl" aria-hidden="true">
              🔎
            </span>

            <div className="space-y-1">
              <p className="text-sm font-semibold">Agora começa a parte real do teste</p>

              <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
                Vamos comparar destino, horário, disponibilidade e intenção. Se encontrarmos uma
                combinação relevante, a equipe CARONAA poderá falar com você pelo WhatsApp
                informado.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 text-center">
        <p className="text-xs leading-5 text-muted-foreground">
          Nenhuma viagem é confirmada automaticamente. Antes de qualquer carona, você poderá
          analisar as informações disponíveis e decidir se deseja continuar.
        </p>

        {onRestart ? (
          <button
            type="button"
            onClick={onRestart}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Fazer outra resposta
          </button>
        ) : null}
      </div>
    </section>
  );
}
