import type {
  DepartureWindow,
} from "@/lib/formulario/types";

type RouteStepProps = {
  destinationNeighborhood?: string | undefined;
  destinationReference?: string | undefined;
  departureWindow?: DepartureWindow | undefined;
  onDestinationNeighborhoodChange: (value: string) => void;
  onDestinationReferenceChange: (value: string) => void;
  onDepartureWindowChange: (value: DepartureWindow) => void;
  onNext: () => void;
  onBack: () => void;
};

const departureOptions: Array<{
  value: DepartureWindow;
  label: string;
  description?: string;
}> = [
  {
    value: "ANTES_18",
    label: "Antes das 18h",
  },
  {
    value: "18_19",
    label: "18h – 19h",
  },
  {
    value: "19_20",
    label: "19h – 20h",
  },
  {
    value: "20_21",
    label: "20h – 21h",
  },
  {
    value: "21_22",
    label: "21h – 22h",
  },
  {
    value: "APOS_22",
    label: "Depois das 22h",
  },
];

export function RouteStep({
  destinationNeighborhood,
  destinationReference,
  departureWindow,
  onDestinationNeighborhoodChange,
  onDestinationReferenceChange,
  onDepartureWindowChange,
  onNext,
  onBack,
}: RouteStepProps) {
  const canContinue =
    Boolean(destinationNeighborhood?.trim()) &&
    Boolean(departureWindow);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">
          Sua rota hoje
        </p>

        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Para onde você vai depois do STS?
        </h2>

        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          Usaremos essas informações para tentar encontrar pessoas
          com rota e horário compatíveis com os seus.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="destinationNeighborhood"
            className="text-sm font-medium"
          >
            Bairro ou região de destino
          </label>

          <input
            id="destinationNeighborhood"
            type="text"
            value={destinationNeighborhood ?? ""}
            onChange={(event) =>
              onDestinationNeighborhoodChange(event.target.value)
            }
            placeholder="Ex.: Aldeota, Messejana, Maracanaú..."
            autoComplete="address-level3"
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          <p className="text-xs leading-5 text-muted-foreground">
            Não precisa informar seu endereço residencial.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="destinationReference"
            className="text-sm font-medium"
          >
            Ponto de referência
            <span className="ml-1 font-normal text-muted-foreground">
              opcional
            </span>
          </label>

          <input
            id="destinationReference"
            type="text"
            value={destinationReference ?? ""}
            onChange={(event) =>
              onDestinationReferenceChange(event.target.value)
            }
            placeholder="Ex.: Shopping, avenida, praça..."
            className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="font-semibold">
            Que horas você pretende sair do evento?
          </h3>

          <p className="text-sm text-muted-foreground">
            Escolha a faixa que mais se aproxima do seu horário.
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Horário de saída do STS"
        >
          {departureOptions.map((option) => {
            const selected =
              departureWindow === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onDepartureWindowChange(option.value)
                }
                className={[
                  "min-h-12 rounded-xl border px-3 py-3 text-sm font-medium transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4">
        <p className="text-sm leading-6 text-muted-foreground">
          A CARONAA usará apenas sua região e faixa de horário para
          procurar compatibilidade. Você poderá avaliar a pessoa e a
          rota antes de confirmar qualquer carona.
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
