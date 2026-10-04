import type {
  CaronaaIntent,
  CostPeriod,
  DepartureWindow,
  InterestLevel,
  PainPointCode,
  PassengerTransport,
  RouteCostRange,
  UserOccupation,
  WeeklyFrequency,
} from "@/lib/formulario/types";

type NavProps = {
  onNext: () => void;
  onBack: () => void;
  canContinue: boolean;
  nextLabel?: string;
};

const intentOptions: Array<{ value: CaronaaIntent; label: string; description: string }> = [
  {
    value: "PASSAGEIRO",
    label: "Passageiro",
    description: "Quero encontrar alguém com trajeto compatível.",
  },
  {
    value: "MOTORISTA",
    label: "Motorista",
    description: "Posso oferecer lugares disponíveis no meu veículo.",
  },
  {
    value: "AMBOS",
    label: "Os dois",
    description: "Posso pegar ou oferecer carona, dependendo da combinação.",
  },
];

const occupationOptions: Array<{ value: UserOccupation; label: string }> = [
  { value: "ESTUDANTE", label: "Estudante" },
  { value: "TRABALHADOR", label: "Trabalhador" },
  { value: "ESTUDANTE_TRABALHADOR", label: "Estudante e trabalhador" },
  { value: "OUTRO", label: "Outro" },
];

const departureOptions: Array<{ value: DepartureWindow; label: string }> = [
  { value: "ANTES_18", label: "Antes das 18h" },
  { value: "18_19", label: "18h - 19h" },
  { value: "19_20", label: "19h - 20h" },
  { value: "20_21", label: "20h - 21h" },
  { value: "21_22", label: "21h - 22h" },
  { value: "APOS_22", label: "Depois das 22h" },
];

const frequencyOptions: Array<{ value: WeeklyFrequency; label: string }> = [
  { value: "1_2", label: "1-2 vezes/semana" },
  { value: "3_4", label: "3-4 vezes/semana" },
  { value: "5_MAIS", label: "5+ vezes/semana" },
  { value: "EVENTUAL", label: "Eventual" },
];

const transportOptions: Array<{ value: PassengerTransport; label: string }> = [
  { value: "ONIBUS", label: "Ônibus" },
  { value: "METRO_VLT", label: "Metrô/VLT" },
  { value: "CARRO_PROPRIO", label: "Carro próprio" },
  { value: "MOTO_PROPRIA", label: "Moto" },
  { value: "UBER_99", label: "Uber/99" },
  { value: "TAXI", label: "Táxi" },
  { value: "CARONA", label: "Carona" },
  { value: "BICICLETA", label: "Caminhada/bicicleta" },
  { value: "COMBINACAO", label: "Combinação de transportes" },
  { value: "OUTRO", label: "Outro" },
];

const costRangeOptions: Array<{ value: RouteCostRange; label: string }> = [
  { value: "0_5", label: "R$ 0-5" },
  { value: "6_10", label: "R$ 6-10" },
  { value: "11_20", label: "R$ 11-20" },
  { value: "21_30", label: "R$ 21-30" },
  { value: "31_50", label: "R$ 31-50" },
  { value: "ACIMA_50", label: "Acima de R$ 50" },
];

const costPeriodOptions: Array<{ value: CostPeriod; label: string }> = [
  { value: "POR_TRECHO", label: "Por trecho" },
  { value: "POR_DIA", label: "Por dia" },
];

export const painPointOptions: Array<{ value: PainPointCode; label: string }> = [
  {
    value: "DOR_01",
    label: "Dificuldade de encontrar uma opção adequada para esse trajeto.",
  },
  {
    value: "DOR_02",
    label: "Transporte lotado ou desconfortável, principalmente em horários de pico.",
  },
  {
    value: "DOR_03",
    label: "As alternativas de transporte individual são caras.",
  },
  {
    value: "DOR_04",
    label: "O deslocamento demora muito ou exige muitas conexões/trocas.",
  },
  {
    value: "DOR_05",
    label: "Tenho carro e frequentemente existem lugares vazios que poderiam ser compartilhados.",
  },
  {
    value: "DOR_06",
    label: "Não me sinto seguro para pegar ou oferecer carona para desconhecidos.",
  },
  { value: "OUTRO_PROBLEMA", label: "Outro problema" },
  {
    value: "SEM_GRANDES_DIFICULDADES",
    label: "Não tenho grandes dificuldades nesse trajeto",
  },
];

const interestOptions: Array<{ value: InterestLevel; label: string }> = [
  { value: "USARIA_HOJE", label: "Usaria hoje" },
  { value: "PROVAVELMENTE_USARIA", label: "Provavelmente usaria" },
  { value: "TALVEZ", label: "Talvez" },
  { value: "PROVAVELMENTE_NAO", label: "Provavelmente não" },
  { value: "NAO_USARIA", label: "Não usaria" },
];

function StepShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Nav({ onNext, onBack, canContinue, nextLabel = "Continuar" }: NavProps) {
  return (
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
        {nextLabel}
      </button>
    </div>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value?: string | undefined;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function ChoiceGrid<T extends string>({
  value,
  values,
  onChange,
  ariaLabel,
  columns = "sm:grid-cols-2",
}: {
  value?: T | undefined;
  values: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  columns?: string;
}) {
  return (
    <div className={`grid gap-3 ${columns}`} role="radiogroup" aria-label={ariaLabel}>
      {values.map((option) => {
        const selected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              "rounded-xl border p-4 text-left text-sm transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
            ].join(" ")}
          >
            <span className="block font-semibold">{option.label}</span>
            {option.description ? (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileRouteStep({
  intent,
  occupation,
  originNeighborhood,
  destinationNeighborhood,
  departureWindow,
  weeklyFrequency,
  onIntentChange,
  onOccupationChange,
  onOriginNeighborhoodChange,
  onDestinationNeighborhoodChange,
  onDepartureWindowChange,
  onWeeklyFrequencyChange,
  onNext,
  onBack,
}: {
  intent?: CaronaaIntent | undefined;
  occupation?: UserOccupation | undefined;
  originNeighborhood?: string | undefined;
  destinationNeighborhood?: string | undefined;
  departureWindow?: DepartureWindow | undefined;
  weeklyFrequency?: WeeklyFrequency | undefined;
  onIntentChange: (value: CaronaaIntent) => void;
  onOccupationChange: (value: UserOccupation) => void;
  onOriginNeighborhoodChange: (value: string) => void;
  onDestinationNeighborhoodChange: (value: string) => void;
  onDepartureWindowChange: (value: DepartureWindow) => void;
  onWeeklyFrequencyChange: (value: WeeklyFrequency) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canContinue =
    Boolean(intent) &&
    Boolean(occupation) &&
    Boolean(originNeighborhood?.trim()) &&
    Boolean(destinationNeighborhood?.trim()) &&
    Boolean(departureWindow) &&
    Boolean(weeklyFrequency);

  return (
    <StepShell
      eyebrow="Etapa 1 de 5"
      title="Como você se imagina usando a CARONAA?"
      description="Conte seu perfil e seu trajeto mais comum para entendermos onde a CARONAA pode ajudar."
    >
      <div className="space-y-5">
        <ChoiceGrid
          value={intent}
          values={intentOptions}
          onChange={onIntentChange}
          ariaLabel="Como você se imagina usando a CARONAA?"
        />

        <ChoiceGrid
          value={occupation}
          values={occupationOptions}
          onChange={onOccupationChange}
          ariaLabel="Ocupação ou perfil"
          columns="sm:grid-cols-2"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="origin-neighborhood"
            label="Origem aproximada"
            value={originNeighborhood}
            onChange={onOriginNeighborhoodChange}
            placeholder="Ex.: Messejana, Centro..."
          />
          <TextInput
            id="destination-neighborhood"
            label="Destino aproximado"
            value={destinationNeighborhood}
            onChange={onDestinationNeighborhoodChange}
            placeholder="Ex.: Unifor, Aldeota..."
          />
        </div>

        <ChoiceGrid
          value={departureWindow}
          values={departureOptions}
          onChange={onDepartureWindowChange}
          ariaLabel="Faixa de horário mais comum"
          columns="sm:grid-cols-3"
        />

        <ChoiceGrid
          value={weeklyFrequency}
          values={frequencyOptions}
          onChange={onWeeklyFrequencyChange}
          ariaLabel="Frequência semanal do trajeto"
          columns="sm:grid-cols-2"
        />
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} />
    </StepShell>
  );
}

export function CurrentPriceStep({
  currentTransport,
  routeCostRange,
  costPeriod,
  onCurrentTransportChange,
  onRouteCostRangeChange,
  onCostPeriodChange,
  onNext,
  onBack,
}: {
  currentTransport?: PassengerTransport | undefined;
  routeCostRange?: RouteCostRange | undefined;
  costPeriod?: CostPeriod | undefined;
  onCurrentTransportChange: (value: PassengerTransport) => void;
  onRouteCostRangeChange: (value: RouteCostRange) => void;
  onCostPeriodChange: (value: CostPeriod) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canContinue = Boolean(currentTransport) && Boolean(routeCostRange) && Boolean(costPeriod);

  return (
    <StepShell
      eyebrow="Etapa 2 de 5"
      title="Como você faz esse trajeto atualmente?"
      description="Também vamos registrar quanto esse deslocamento costuma custar."
    >
      <div className="space-y-5">
        <ChoiceGrid
          value={currentTransport}
          values={transportOptions}
          onChange={onCurrentTransportChange}
          ariaLabel="Alternativa atual de transporte"
        />

        <div className="space-y-3">
          <h3 className="font-semibold">Quanto você costuma gastar nesse deslocamento?</h3>
          <ChoiceGrid
            value={routeCostRange}
            values={costRangeOptions}
            onChange={onRouteCostRangeChange}
            ariaLabel="Gasto atual no deslocamento"
            columns="sm:grid-cols-3"
          />
          <ChoiceGrid
            value={costPeriod}
            values={costPeriodOptions}
            onChange={onCostPeriodChange}
            ariaLabel="Período do gasto informado"
            columns="grid-cols-2"
          />
        </div>
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} />
    </StepShell>
  );
}

export function ProblemsStep({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value?: PainPointCode[] | undefined;
  onChange: (value: PainPointCode[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const selectedValues = value ?? [];

  function toggle(option: PainPointCode) {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter((item) => item !== option));
      return;
    }

    if (option === "SEM_GRANDES_DIFICULDADES") {
      onChange([option]);
      return;
    }

    onChange([...selectedValues.filter((item) => item !== "SEM_GRANDES_DIFICULDADES"), option]);
  }

  return (
    <StepShell
      eyebrow="Etapa 3 de 5"
      title="Quais desses problemas você enfrenta nesse trajeto?"
      description="Você pode selecionar mais de uma opção."
    >
      <div className="grid gap-3">
        {painPointOptions.map((option) => {
          const selected = selectedValues.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={[
                "rounded-xl border p-4 text-left text-sm transition",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
              ].join(" ")}
            >
              <span className="font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={selectedValues.length > 0} />
    </StepShell>
  );
}

export function MainProblemStep({
  painPoints,
  mainPainPoint,
  mainPainIntensity,
  onMainPainPointChange,
  onMainPainIntensityChange,
  onNext,
  onBack,
}: {
  painPoints?: PainPointCode[] | undefined;
  mainPainPoint?: PainPointCode | undefined;
  mainPainIntensity?: number | undefined;
  onMainPainPointChange: (value: PainPointCode) => void;
  onMainPainIntensityChange: (value: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const selectedPainOptions = painPointOptions.filter((option) =>
    painPoints?.includes(option.value),
  );

  return (
    <StepShell
      eyebrow="Etapa 4 de 5"
      title="Qual desses problemas mais incomoda você atualmente?"
      description="Escolha o principal e indique o impacto na sua rotina."
    >
      <div className="space-y-5">
        <ChoiceGrid
          value={mainPainPoint}
          values={selectedPainOptions}
          onChange={onMainPainPointChange}
          ariaLabel="Dor principal"
          columns="grid-cols-1"
        />

        <div className="space-y-3">
          <h3 className="font-semibold">Quanto esse problema impacta sua rotina?</h3>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Intensidade da dor">
            {[1, 2, 3, 4, 5].map((intensity) => {
              const selected = mainPainIntensity === intensity;

              return (
                <button
                  key={intensity}
                  type="button"
                  onClick={() => onMainPainIntensityChange(intensity)}
                  className={[
                    "min-h-12 rounded-xl border text-sm font-bold transition",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  {intensity}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-[10px] leading-4 text-muted-foreground">
            <span>Quase não</span>
            <span>Pouco</span>
            <span>Médio</span>
            <span>Muito</span>
            <span>Grande problema</span>
          </div>
        </div>
      </div>

      <Nav
        onNext={onNext}
        onBack={onBack}
        canContinue={Boolean(mainPainPoint) && Boolean(mainPainIntensity)}
      />
    </StepShell>
  );
}

export function InterestStep({
  intent,
  passengerInterest,
  driverInterest,
  onPassengerInterestChange,
  onDriverInterestChange,
  onNext,
  onBack,
}: {
  intent?: CaronaaIntent | undefined;
  passengerInterest?: InterestLevel | undefined;
  driverInterest?: InterestLevel | undefined;
  onPassengerInterestChange: (value: InterestLevel) => void;
  onDriverInterestChange: (value: InterestLevel) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const includePassenger = intent === "PASSAGEIRO" || intent === "AMBOS";
  const includeDriver = intent === "MOTORISTA" || intent === "AMBOS";

  const canContinue =
    (!includePassenger || Boolean(passengerInterest)) &&
    (!includeDriver || Boolean(driverInterest));

  return (
    <StepShell
      eyebrow="Etapa 5 de 5"
      title="Qual seu interesse em usar a CARONAA?"
      description="Esta resposta ajuda a medir intenção real sem alongar o formulário."
    >
      <div className="space-y-6">
        {includePassenger ? (
          <div className="space-y-3">
            <h3 className="font-semibold">
              Se houvesse alguém fazendo um trajeto compatível com o seu, você usaria a CARONAA?
            </h3>
            <ChoiceGrid
              value={passengerInterest}
              values={interestOptions}
              onChange={onPassengerInterestChange}
              ariaLabel="Interesse como passageiro"
            />
          </div>
        ) : null}

        {includeDriver ? (
          <div className="space-y-3">
            <h3 className="font-semibold">
              Você ofereceria lugares disponíveis no seu carro para alguém com trajeto compatível?
            </h3>
            <ChoiceGrid
              value={driverInterest}
              values={interestOptions}
              onChange={onDriverInterestChange}
              ariaLabel="Interesse como motorista"
            />
          </div>
        ) : null}
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} nextLabel="Ir para cadastro" />
    </StepShell>
  );
}
