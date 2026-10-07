import React from "react";
import { Check, Sparkles, AlertCircle, Shield, Car, HeartHandshake, MapPin } from "lucide-react";
import { STS_2026_CONFIG } from "@/lib/formulario/event-config";
import { LocationAutocomplete } from "./LocationAutocomplete";
import type { FormLocationDetails } from "@/lib/location/types";
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
  TrustFactor,
  PriceRange,
  VehicleType,
} from "@/lib/formulario/types";
import {
  calculateCaronaaFee,
  calculateDriverNet,
  MIN_DRIVER_PRICE,
} from "@/lib/formulario/pricing";

type NavProps = {
  onNext: () => void;
  onBack: () => void;
  canContinue: boolean;
  nextLabel?: string;
};

export const intentOptions: Array<{
  value: CaronaaIntent;
  label: string;
  description: string;
  emoji: string;
}> = [
  {
    value: "MOTORISTA",
    label: "Oferecer carona",
    description: "Tenho lugar no carro e posso compartilhar com quem vai pelo mesmo caminho.",
    emoji: "🚗",
  },
  {
    value: "PASSAGEIRO",
    label: "Pegar carona",
    description: "Preciso de carona para chegar ou voltar do evento.",
    emoji: "🙋",
  },
  {
    value: "AMBOS",
    label: "Os dois",
    description: "Posso oferecer ou pegar carona, dependendo da rota e do dia.",
    emoji: "🔄",
  },
];

export const occupationOptions: Array<{ value: UserOccupation; label: string }> = [
  { value: "ESTUDANTE", label: "Estudante" },
  { value: "TRABALHADOR", label: "Profissional" },
  { value: "ESTUDANTE_TRABALHADOR", label: "Estudante e profissional" },
  { value: "OUTRO", label: "Outro perfil" },
];

export const departureOptions: Array<{ value: DepartureWindow; label: string }> = [
  { value: "ANTES_18", label: "17h – 19h" },
  { value: "19_20", label: "19h – 21h" },
  { value: "21_22", label: "21h – 22h (encerramento)" },
];

export const legacyDepartureOptions: Array<{ value: DepartureWindow; label: string }> = [
  { value: "ANTES_18", label: "Antes das 18h" },
  { value: "18_19", label: "18h - 19h" },
  { value: "19_20", label: "19h - 20h" },
  { value: "20_21", label: "20h - 21h" },
  { value: "21_22", label: "21h - 22h" },
  { value: "APOS_22", label: "Depois das 22h" },
];

export const frequencyOptions: Array<{ value: WeeklyFrequency; label: string }> = [
  { value: "EVENTUAL", label: "Apenas durante eventos (STS 2026)" },
  { value: "1_2", label: "1 a 2 vezes por semana" },
  { value: "3_4", label: "3 a 4 vezes por semana" },
  { value: "5_MAIS", label: "Diariamente (5+ vezes por semana)" },
];

export const transportOptions: Array<{ value: PassengerTransport; label: string }> = [
  { value: "UBER_99", label: "Aplicativos (Uber / 99)" },
  { value: "ONIBUS", label: "Ônibus convencional" },
  { value: "METRO_VLT", label: "Metrô / VLT" },
  { value: "CARRO_PROPRIO", label: "Carro próprio (dirigindo só)" },
  { value: "MOTO_PROPRIA", label: "Moto própria" },
  { value: "CARONA", label: "Carona com colegas" },
  { value: "COMBINACAO", label: "Combinação de transportes" },
  { value: "OUTRO", label: "Outro modo" },
];

export const costRangeOptions: Array<{ value: RouteCostRange; label: string }> = [
  { value: "0_5", label: "R$ 0 a 5" },
  { value: "6_10", label: "R$ 6 a 10" },
  { value: "11_20", label: "R$ 11 a 20" },
  { value: "21_30", label: "R$ 21 a 30" },
  { value: "31_50", label: "R$ 31 a 50" },
  { value: "ACIMA_50", label: "Mais de R$ 50" },
];

export const costPeriodOptions: Array<{ value: CostPeriod; label: string }> = [
  { value: "POR_TRECHO", label: "Por trecho (ida ou volta)" },
  { value: "POR_DIA", label: "Por dia completo" },
];

export const painPointOptions: Array<{ value: PainPointCode; label: string }> = [
  {
    value: "DOR_01",
    label: "Dificuldade de encontrar transporte rápido e direto para essa rota.",
  },
  {
    value: "DOR_02",
    label: "Transporte público lotado ou desconfortável nos horários de pico.",
  },
  {
    value: "DOR_03",
    label: "Preços muito elevados de corridas por aplicativo na saída do evento.",
  },
  {
    value: "DOR_04",
    label: "Demora excessiva para voltar para casa após palestras e oficinas.",
  },
  {
    value: "DOR_05",
    label: "Tenho carro e os assentos voltam vazios, podendo compartilhar custos.",
  },
  {
    value: "DOR_06",
    label: "Receio de segurança ao combinar viagens com pessoas desconhecidas.",
  },
  { value: "OUTRO_PROBLEMA", label: "Outra questão do deslocamento" },
  {
    value: "SEM_GRANDES_DIFICULDADES",
    label: "Não costumo ter dificuldades nesse trajeto",
  },
];

export const interestOptions: Array<{ value: InterestLevel; label: string }> = [
  { value: "USARIA_HOJE", label: "Sim, quero usar no STS 2026" },
  { value: "PROVAVELMENTE_USARIA", label: "Provavelmente usaria" },
  { value: "TALVEZ", label: "Talvez, depende da pessoa ou trajeto" },
  { value: "PROVAVELMENTE_NAO", label: "Provavelmente não" },
  { value: "NAO_USARIA", label: "Não pretendo usar" },
];

function StepShell({
  stepNumber,
  totalSteps = 5,
  badgeText,
  title,
  description,
  encouragement,
  children,
}: {
  stepNumber: number;
  totalSteps?: number;
  badgeText?: string;
  title: string;
  description: string;
  encouragement?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sts-step mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-bold text-caronaa-dark dark:text-caronaa-primary">
            Etapa {stepNumber} de {totalSteps} {badgeText ? `• ${badgeText}` : ""}
          </span>
          {encouragement && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles size={13} />
              {encouragement}
            </span>
          )}
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
          {title}
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      </div>

      {children}
    </section>
  );
}

function Nav({ onNext, onBack, canContinue, nextLabel = "Avançar" }: NavProps) {
  return (
    <div className="sts-navigation flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-4 border-t border-border">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
      >
        Voltar
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue}
        className="inline-flex min-h-12 items-center justify-center rounded-xl bg-caronaa-primary px-7 py-2.5 text-base font-bold text-caronaa-dark transition hover:bg-caronaa-primary-strong shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLabel}
      </button>
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
  values: Array<{ value: T; label: string; description?: string; emoji?: string }>;
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
              "rounded-2xl border p-4 text-left transition relative",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20 shadow-sm"
                : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="block font-bold text-sm sm:text-base text-foreground">
                {option.emoji ? `${option.emoji} ` : ""}
                {option.label}
              </span>
              {selected && (
                <span className="rounded-full bg-caronaa-primary p-0.5 text-caronaa-dark shrink-0">
                  <Check size={14} />
                </span>
              )}
            </div>
            {option.description ? (
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function RoleStep({
  intent,
  onIntentChange,
  onNext,
  onBack,
  stepNumber = 1,
  totalSteps = 6,
}: {
  intent?: CaronaaIntent | undefined;
  onIntentChange: (value: CaronaaIntent) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const canContinue = Boolean(intent);

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Seu Papel"
      encouragement="Ótimo! Vamos começar entendendo como você pretende participar."
      title="Como você poderia usar a CARONAA?"
      description="Estamos conectando pessoas que precisam ir com pessoas que já estão indo pelo mesmo caminho."
    >
      <div className="space-y-4">
        <label className="text-base font-bold text-foreground">Como você deseja participar?</label>
        <ChoiceGrid
          value={intent}
          values={intentOptions}
          onChange={onIntentChange}
          ariaLabel="Intenção de uso"
          columns="grid-cols-1 sm:grid-cols-3"
        />
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} nextLabel="Continuar" />
    </StepShell>
  );
}

export const CEC_DEFAULT_LOCATION: FormLocationDetails = {
  rawText: "Centro de Eventos do Ceará",
  formattedAddress: "Av. Washington Soares, 999 - Edson Queiroz, Fortaleza - CE, 60811-341",
  neighborhood: "Edson Queiroz",
  city: "Fortaleza",
  state: "CE",
  lat: -3.7638,
  lng: -38.4815,
  providerId: "loc_cec",
};

export function FixedOriginCard({ isDriver = false }: { isDriver?: boolean }) {
  const originLabel = isDriver ? "De onde você sai?" : "De onde você vai sair?";
  return (
    <div className="space-y-1.5" data-testid="fixed-origin-card">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <MapPin size={15} className="text-caronaa-primary-strong" />
          <span>{originLabel}</span>
          <span className="text-destructive">*</span>
        </label>
        <span className="inline-flex items-center gap-1 rounded-full bg-caronaa-primary/10 border border-caronaa-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-caronaa-primary-strong">
          📍 Ponto Oficial do Evento
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-muted/30 p-3.5 sm:p-4 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-caronaa-primary/15 text-caronaa-primary-strong border border-caronaa-primary/30">
              <MapPin size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Centro de Eventos do Ceará — Fortaleza, CE
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Av. Washington Soares, 999 - Edson Queiroz, Fortaleza - CE
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground border border-border/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Origem fixa: saída dos participantes do Siará Tech Summit</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="inline-flex items-center gap-1 rounded bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              🔒 Fixo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteDetailsStep({
  intent = "PASSAGEIRO",
  occupation,
  occupationDetails,
  originNeighborhood,
  originLocation: _originLocation,
  destinationNeighborhood,
  destinationLocation,
  departureWindow,
  onOccupationChange,
  onOccupationDetailsChange,
  onOriginNeighborhoodChange,
  onOriginLocationChange,
  onDestinationNeighborhoodChange,
  onDestinationLocationChange,
  onDepartureWindowChange,
  onNext,
  onBack,
  stepNumber = 2,
  totalSteps = 6,
}: {
  intent?: CaronaaIntent | undefined;
  occupation?: UserOccupation | undefined;
  occupationDetails?: string | undefined;
  originNeighborhood?: string | undefined;
  originLocation?: FormLocationDetails | undefined;
  destinationNeighborhood?: string | undefined;
  destinationLocation?: FormLocationDetails | undefined;
  departureWindow?: DepartureWindow | undefined;
  onOccupationChange: (value: UserOccupation) => void;
  onOccupationDetailsChange?: (value: string) => void;
  onOriginNeighborhoodChange: (value: string) => void;
  onOriginLocationChange?: (value: string, details?: FormLocationDetails) => void;
  onDestinationNeighborhoodChange: (value: string) => void;
  onDestinationLocationChange?: (value: string, details?: FormLocationDetails) => void;
  onDepartureWindowChange: (value: DepartureWindow) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const isDriver = intent === "MOTORISTA";
  const destinationLabel = isDriver ? "Para onde você vai?" : "Qual será seu destino?";

  // Garante que o ponto de partida oficial esteja sempre ativo
  React.useEffect(() => {
    if (!originNeighborhood || originNeighborhood !== STS_2026_CONFIG.defaultMeetingPoint) {
      onOriginNeighborhoodChange(STS_2026_CONFIG.defaultMeetingPoint);
      if (onOriginLocationChange) {
        onOriginLocationChange(STS_2026_CONFIG.defaultMeetingPoint, CEC_DEFAULT_LOCATION);
      }
    }
  }, [originNeighborhood, onOriginNeighborhoodChange, onOriginLocationChange]);

  const hasOccupationValid =
    Boolean(occupation) && (occupation !== "OUTRO" || Boolean(occupationDetails?.trim()));

  const canContinue =
    hasOccupationValid && Boolean(destinationNeighborhood?.trim()) && Boolean(departureWindow);

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Trajeto & Horário"
      encouragement="Muito bom! Agora vamos entender a sua rota e horários."
      title="Vamos entender seu caminho"
      description="Conte sobre sua ocupação e os pontos aproximados do seu deslocamento."
    >
      <div className="space-y-6">
        {/* Ocupação */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Sua ocupação:</label>
          <ChoiceGrid
            value={occupation}
            values={occupationOptions}
            onChange={onOccupationChange}
            ariaLabel="Ocupação ou perfil"
            columns="sm:grid-cols-2"
          />

          {occupation === "OUTRO" && onOccupationDetailsChange && (
            <div className="mt-3 space-y-1.5 animate-in fade-in duration-200">
              <label
                htmlFor="occupation-details"
                className="text-xs font-semibold text-muted-foreground"
              >
                Como você se identifica? *
              </label>
              <input
                id="occupation-details"
                type="text"
                value={occupationDetails ?? ""}
                onChange={(e) => onOccupationDetailsChange(e.target.value)}
                placeholder="Ex.: Pesquisador, Visitante de outro estado, Empreendedor..."
                className="min-h-11 w-full rounded-xl border bg-background px-3.5 py-2 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
              />
            </div>
          )}
        </div>

        {/* Origem Fixa Oficial e Destino */}
        <div className="space-y-4 pt-1">
          <FixedOriginCard isDriver={isDriver} />

          <LocationAutocomplete
            id="destination-input"
            label={destinationLabel}
            required
            value={destinationNeighborhood ?? ""}
            selectedLocation={destinationLocation}
            placeholder="Ex.: Atacadão Maracanaú, Aldeota, UNIFOR, Messejana..."
            onChange={(val, details) => {
              onDestinationNeighborhoodChange(val);
              if (onDestinationLocationChange) onDestinationLocationChange(val, details);
            }}
            helperText="Apenas o bairro ou região aproximada será usado para encontrar trajetos compatíveis."
          />
        </div>

        {/* Horário de saída */}
        <div className="space-y-2 pt-1">
          <label className="text-sm font-semibold text-foreground">
            Que horas você pretende sair? (seleção única)
          </label>
          <ChoiceGrid
            value={departureWindow}
            values={departureOptions}
            onChange={onDepartureWindowChange}
            ariaLabel="Janela de horário"
            columns="grid-cols-1 sm:grid-cols-3"
          />
        </div>
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} nextLabel="Avançar trajeto" />
    </StepShell>
  );
}

export function EventPresenceStep({
  eventPresenceDays,
  eventPresenceCustom,
  onEventPresenceDaysChange,
  onEventPresenceCustomChange,
  onNext,
  onBack,
  stepNumber = 3,
  totalSteps = 6,
}: {
  eventPresenceDays?: string[] | undefined;
  eventPresenceCustom?: string | undefined;
  onEventPresenceDaysChange?: (value: string[]) => void;
  onEventPresenceCustomChange?: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const togglePresenceDay = (val: string) => {
    if (!onEventPresenceDaysChange) return;
    const current = eventPresenceDays ?? [];
    if (current.includes(val)) {
      onEventPresenceDaysChange(current.filter((item) => item !== val));
    } else {
      onEventPresenceDaysChange([...current, val]);
    }
  };

  const hasCustomValid =
    !(eventPresenceDays ?? []).includes("OUTRO") || Boolean(eventPresenceCustom?.trim());

  const canContinue = (eventPresenceDays ?? []).length > 0 && hasCustomValid;

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Dias no STS"
      encouragement="Quase lá! Vamos alinhar os dias em que você estará presente."
      title="Quando você estará por aqui?"
      description={`Selecione os dias em que planeja ir ao ${STS_2026_CONFIG.name} (${STS_2026_CONFIG.datesDescription}). Múltipla seleção livre.`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {STS_2026_CONFIG.presenceOptions.map((opt) => {
            const isChecked = (eventPresenceDays ?? []).includes(opt.value);

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => togglePresenceDay(opt.value)}
                className={[
                  "flex items-center justify-between rounded-xl border p-3.5 text-left transition",
                  isChecked
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <div
                  className={[
                    "size-4 rounded-md border flex items-center justify-center shrink-0 transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                      : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {isChecked && <Check size={12} className="stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {(eventPresenceDays ?? []).includes("OUTRO") && onEventPresenceCustomChange && (
          <div className="mt-3 space-y-1.5 animate-in fade-in duration-200">
            <label
              htmlFor="presence-custom"
              className="text-xs font-semibold text-muted-foreground"
            >
              Conte um pouco mais sobre sua disponibilidade: *
            </label>
            <input
              id="presence-custom"
              type="text"
              value={eventPresenceCustom ?? ""}
              onChange={(e) => onEventPresenceCustomChange(e.target.value)}
              placeholder="Ex.: Apenas na abertura de manhã, dependendo da programação..."
              className="min-h-11 w-full rounded-xl border bg-background px-3.5 py-2 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>
        )}
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} nextLabel="Continuar" />
    </StepShell>
  );
}

export function ProfileRouteStep({
  intent,
  occupation,
  occupationDetails,
  originNeighborhood,
  originLocation,
  destinationNeighborhood,
  destinationLocation,
  departureWindow,
  weeklyFrequency: _weeklyFrequency,
  eventPresenceDays,
  eventPresenceCustom,
  onIntentChange,
  onOccupationChange,
  onOccupationDetailsChange,
  onOriginNeighborhoodChange,
  onOriginLocationChange,
  onDestinationNeighborhoodChange,
  onDestinationLocationChange,
  onDepartureWindowChange,
  onWeeklyFrequencyChange: _onWeeklyFrequencyChange,
  onEventPresenceDaysChange,
  onEventPresenceCustomChange,
  onNext,
  onBack,
  stepNumber = 1,
  totalSteps = 6,
}: {
  intent?: CaronaaIntent | undefined;
  occupation?: UserOccupation | undefined;
  occupationDetails?: string | undefined;
  originNeighborhood?: string | undefined;
  originLocation?: FormLocationDetails | undefined;
  destinationNeighborhood?: string | undefined;
  destinationLocation?: FormLocationDetails | undefined;
  departureWindow?: DepartureWindow | undefined;
  weeklyFrequency?: WeeklyFrequency | undefined;
  eventPresenceDays?: string[] | undefined;
  eventPresenceCustom?: string | undefined;
  onIntentChange: (value: CaronaaIntent) => void;
  onOccupationChange: (value: UserOccupation) => void;
  onOccupationDetailsChange?: (value: string) => void;
  onOriginNeighborhoodChange: (value: string) => void;
  onOriginLocationChange?: (value: string, details?: FormLocationDetails) => void;
  onDestinationNeighborhoodChange: (value: string) => void;
  onDestinationLocationChange?: (value: string, details?: FormLocationDetails) => void;
  onDepartureWindowChange: (value: DepartureWindow) => void;
  onWeeklyFrequencyChange?: (value: WeeklyFrequency) => void;
  onEventPresenceDaysChange?: (value: string[]) => void;
  onEventPresenceCustomChange?: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const isDriver = intent === "MOTORISTA";
  const originLabel = isDriver ? "De onde você sai?" : "De onde você vai sair?";
  const destinationLabel = isDriver ? "Para onde você vai?" : "Qual será seu destino?";

  const fillMeetingPoint = () => {
    onOriginNeighborhoodChange(STS_2026_CONFIG.defaultMeetingPoint);
    if (onOriginLocationChange) {
      onOriginLocationChange(STS_2026_CONFIG.defaultMeetingPoint, {
        rawText: STS_2026_CONFIG.defaultMeetingPoint,
        formattedAddress: `${STS_2026_CONFIG.defaultMeetingPoint}, Fortaleza - CE`,
        neighborhood: "Edson Queiroz",
        city: "Fortaleza",
        state: "CE",
        lat: -3.7915,
        lng: -38.4802,
        providerId: "shortcut_cec",
      });
    }
  };

  const togglePresenceDay = (val: string) => {
    if (!onEventPresenceDaysChange) return;
    const current = eventPresenceDays ?? [];
    if (current.includes(val)) {
      onEventPresenceDaysChange(current.filter((item) => item !== val));
    } else {
      onEventPresenceDaysChange([...current, val]);
    }
  };

  // Garante que a origem do Siará Tech Summit seja fixa e consistente
  React.useEffect(() => {
    if (!originNeighborhood || originNeighborhood !== STS_2026_CONFIG.defaultMeetingPoint) {
      onOriginNeighborhoodChange(STS_2026_CONFIG.defaultMeetingPoint);
      if (onOriginLocationChange) {
        onOriginLocationChange(STS_2026_CONFIG.defaultMeetingPoint, CEC_DEFAULT_LOCATION);
      }
    }
  }, [originNeighborhood, onOriginNeighborhoodChange, onOriginLocationChange]);

  const hasOccupationValid =
    Boolean(occupation) && (occupation !== "OUTRO" || Boolean(occupationDetails?.trim()));

  const canContinue =
    Boolean(intent) &&
    hasOccupationValid &&
    Boolean(destinationNeighborhood?.trim()) &&
    Boolean(departureWindow);

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Perfil & Trajeto"
      encouragement="Boa! Vamos começar a entender seu trajeto."
      title="Como você poderia usar a CARONAA?"
      description="Estamos conectando pessoas que precisam ir com pessoas que já estão indo pelo mesmo caminho."
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <label className="text-base font-bold text-foreground">
            Como você deseja participar?
          </label>
          <ChoiceGrid
            value={intent}
            values={intentOptions}
            onChange={onIntentChange}
            ariaLabel="Intenção de uso"
            columns="grid-cols-1 sm:grid-cols-3"
          />
        </div>

        <div className="space-y-5 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h3 className="text-base font-bold text-foreground">Vamos entender seu caminho</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conte sobre sua ocupação e os pontos aproximados do seu deslocamento.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Sua ocupação:</label>
            <ChoiceGrid
              value={occupation}
              values={occupationOptions}
              onChange={onOccupationChange}
              ariaLabel="Ocupação ou perfil"
              columns="sm:grid-cols-2"
            />

            {occupation === "OUTRO" && onOccupationDetailsChange && (
              <div className="mt-3 space-y-1.5 animate-in fade-in duration-200">
                <label
                  htmlFor="occupation-details"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Como você se identifica? *
                </label>
                <input
                  id="occupation-details"
                  type="text"
                  value={occupationDetails ?? ""}
                  onChange={(e) => onOccupationDetailsChange(e.target.value)}
                  placeholder="Ex.: Pesquisador, Visitante de outro estado, Empreendedor..."
                  className="min-h-11 w-full rounded-xl border bg-background px-3.5 py-2 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                />
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2">
            <FixedOriginCard isDriver={isDriver} />

            <LocationAutocomplete
              id="destination-input"
              label={destinationLabel}
              required
              value={destinationNeighborhood ?? ""}
              selectedLocation={destinationLocation}
              placeholder="Ex.: Atacadão Maracanaú, Aldeota, UNIFOR, Messejana..."
              onChange={(val, details) => {
                onDestinationNeighborhoodChange(val);
                if (onDestinationLocationChange) onDestinationLocationChange(val, details);
              }}
              helperText="Apenas o bairro ou região aproximada será usado para encontrar trajetos compatíveis."
            />
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-semibold text-foreground">
              Que horas você pretende sair? (seleção única)
            </label>
            <ChoiceGrid
              value={departureWindow}
              values={departureOptions}
              onChange={onDepartureWindowChange}
              ariaLabel="Janela de horário"
              columns="grid-cols-1 sm:grid-cols-3"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-foreground">Quando você estará por aqui?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione os dias em que planeja ir ao {STS_2026_CONFIG.name} (
              {STS_2026_CONFIG.datesDescription}). Múltipla seleção livre.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {STS_2026_CONFIG.presenceOptions.map((opt) => {
              const isChecked = (eventPresenceDays ?? []).includes(opt.value);

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => togglePresenceDay(opt.value)}
                  className={[
                    "flex items-center justify-between rounded-xl border p-3 text-left transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                      : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                  <div
                    className={[
                      "size-4 rounded-md border flex items-center justify-center shrink-0 transition",
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-muted-foreground/40",
                    ].join(" ")}
                  >
                    {isChecked && <Check size={12} className="stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {(eventPresenceDays ?? []).includes("OUTRO") && onEventPresenceCustomChange && (
            <div className="mt-3 space-y-1.5 animate-in fade-in duration-200">
              <label
                htmlFor="presence-custom"
                className="text-xs font-semibold text-muted-foreground"
              >
                Conte um pouco mais sobre sua disponibilidade:
              </label>
              <input
                id="presence-custom"
                type="text"
                value={eventPresenceCustom ?? ""}
                onChange={(e) => onEventPresenceCustomChange(e.target.value)}
                placeholder="Ex.: Apenas na abertura de manhã, dependendo da programação..."
                className="min-h-11 w-full rounded-xl border bg-background px-3.5 py-2 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
              />
            </div>
          )}
        </div>
      </div>

      <Nav onNext={onNext} onBack={onBack} canContinue={canContinue} nextLabel="Avançar trajeto" />
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
  stepNumber = 2,
  totalSteps = 5,
}: {
  currentTransport?: PassengerTransport | undefined;
  routeCostRange?: RouteCostRange | undefined;
  costPeriod?: CostPeriod | undefined;
  onCurrentTransportChange: (value: PassengerTransport) => void;
  onRouteCostRangeChange: (value: RouteCostRange) => void;
  onCostPeriodChange: (value: CostPeriod) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const canContinue = Boolean(currentTransport) && Boolean(routeCostRange) && Boolean(costPeriod);

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Transporte & Custos"
      encouragement="Seu trajeto está tomando forma!"
      title="Como você costuma fazer esse percurso hoje?"
      description="Queremos entender os modos de transporte e custos atuais de quem frequenta o evento."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">
            Qual meio de transporte você mais utiliza hoje para trajetos como esse?
          </label>
          <ChoiceGrid
            value={currentTransport}
            values={transportOptions}
            onChange={onCurrentTransportChange}
            ariaLabel="Meio de transporte atual"
            columns="sm:grid-cols-2"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <label className="block text-sm font-bold text-foreground">
            Quanto você costuma gastar hoje nesse deslocamento?
          </label>
          <ChoiceGrid
            value={routeCostRange}
            values={costRangeOptions}
            onChange={onRouteCostRangeChange}
            ariaLabel="Faixa de custo"
            columns="sm:grid-cols-3"
          />

          <div className="pt-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              Esse valor se refere a:
            </label>
            <ChoiceGrid
              value={costPeriod}
              values={costPeriodOptions}
              onChange={onCostPeriodChange}
              ariaLabel="Período do custo"
              columns="grid-cols-2"
            />
          </div>
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
  stepNumber = 3,
  totalSteps = 5,
}: {
  value?: PainPointCode[] | undefined;
  onChange: (value: PainPointCode[]) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
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
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Dificuldades & Rotina"
      encouragement="Mais uma etapa concluída com sucesso."
      title="O que mais incomoda no deslocamento até ou a partir de grandes eventos?"
      description="Selecione todas as opções que fazem sentido para a sua experiência cotidiana."
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
                "flex items-center justify-between rounded-2xl border p-4 text-left transition",
                selected
                  ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20"
                  : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
              ].join(" ")}
            >
              <span className="font-semibold text-sm sm:text-base text-foreground pr-2">
                {option.label}
              </span>
              <div
                className={[
                  "size-5 rounded-md border flex items-center justify-center shrink-0 transition",
                  selected
                    ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                    : "border-muted-foreground/40",
                ].join(" ")}
              >
                {selected && <Check size={14} className="stroke-[3]" />}
              </div>
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
  stepNumber = 4,
  totalSteps = 5,
}: {
  painPoints?: PainPointCode[] | undefined;
  mainPainPoint?: PainPointCode | undefined;
  mainPainIntensity?: number | undefined;
  onMainPainPointChange: (value: PainPointCode) => void;
  onMainPainIntensityChange: (value: number) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const selectedPainOptions = painPointOptions.filter((option) =>
    painPoints?.includes(option.value),
  );

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Principal Desafio"
      encouragement="Quase lá! Agora vamos entender sua prioridade."
      title="Dentre os itens apontados, qual é o que mais pesa para você?"
      description="Indique também o nível de impacto na sua rotina diária."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">
            Selecione o problema principal:
          </label>
          <ChoiceGrid
            value={mainPainPoint}
            values={selectedPainOptions}
            onChange={onMainPainPointChange}
            ariaLabel="Problema principal"
            columns="grid-cols-1"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <label className="block text-sm font-bold text-foreground">
            Qual a intensidade do impacto desse problema na sua rotina? (1 a 5)
          </label>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Intensidade">
            {[1, 2, 3, 4, 5].map((intensity) => {
              const selected = mainPainIntensity === intensity;

              return (
                <button
                  key={intensity}
                  type="button"
                  onClick={() => onMainPainIntensityChange(intensity)}
                  className={[
                    "min-h-12 rounded-xl border text-base font-extrabold transition",
                    selected
                      ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark ring-2 ring-caronaa-primary/30"
                      : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                  ].join(" ")}
                >
                  {intensity}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-[11px] font-medium text-muted-foreground">
            <span>Leve</span>
            <span>Pouco</span>
            <span>Moderado</span>
            <span>Alto</span>
            <span>Crítico</span>
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
  passengerPriceRange,
  driverPrice,
  onPassengerInterestChange,
  onDriverInterestChange,
  onPassengerPriceRangeChange,
  onDriverPriceChange,
  onNext,
  onBack,
  stepNumber = 5,
  totalSteps = 5,
}: {
  intent?: CaronaaIntent | undefined;
  passengerInterest?: InterestLevel | undefined;
  driverInterest?: InterestLevel | undefined;
  passengerPriceRange?: PriceRange | undefined;
  driverPrice?: number | undefined;
  onPassengerInterestChange: (value: InterestLevel) => void;
  onDriverInterestChange: (value: InterestLevel) => void;
  onPassengerPriceRangeChange?: (value: PriceRange) => void;
  onDriverPriceChange?: (value: number) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}) {
  const includePassenger = intent === "PASSAGEIRO" || intent === "AMBOS";
  const includeDriver = intent === "MOTORISTA" || intent === "AMBOS";

  const canContinue =
    (!includePassenger || Boolean(passengerInterest)) &&
    (!includeDriver || Boolean(driverInterest));

  const currentDriverPrice = driverPrice ?? 10.0;
  const currentFee = calculateCaronaaFee(currentDriverPrice);
  const currentNet = calculateDriverNet(currentDriverPrice);

  return (
    <StepShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      badgeText="Interesse & Confiança"
      encouragement="Pronto! Agora vamos entender o que você precisa."
      title="O que faria você confiar e participar de uma CARONAA?"
      description="Queremos entender suas condições de confiança e valores considerados justos."
    >
      <div className="space-y-6">
        {includePassenger && (
          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <span>🙋</span> Para passageiros:
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Se houvesse alguém compatível saindo do STS hoje, você pegaria essa carona?
              </label>
              <ChoiceGrid
                value={passengerInterest}
                values={interestOptions}
                onChange={onPassengerInterestChange}
                ariaLabel="Interesse do passageiro"
                columns="sm:grid-cols-2"
              />
            </div>

            {onPassengerPriceRangeChange && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Quanto você consideraria justo pagar por trecho? (R$ 3,50 a 25,00 em validação)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { value: "ATE_5" as PriceRange, label: "Até R$ 5" },
                    { value: "5_10" as PriceRange, label: "R$ 5 a 10" },
                    { value: "10_15" as PriceRange, label: "R$ 10 a 15" },
                    { value: "15_20" as PriceRange, label: "R$ 15 a 20" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onPassengerPriceRangeChange(p.value)}
                      className={[
                        "rounded-xl border p-2.5 font-bold transition",
                        passengerPriceRange === p.value
                          ? "border-caronaa-primary bg-caronaa-primary/15 text-caronaa-dark dark:text-caronaa-primary"
                          : "border-border bg-card hover:bg-accent/50",
                      ].join(" ")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {includeDriver && (
          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <span>🚗</span> Para motoristas com lugar no carro:
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Você compartilharia lugares disponíveis no seu carro para quem vai na mesma direção?
              </label>
              <ChoiceGrid
                value={driverInterest}
                values={interestOptions}
                onChange={onDriverInterestChange}
                ariaLabel="Interesse do motorista"
                columns="sm:grid-cols-2"
              />
            </div>

            {onDriverPriceChange && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="driver-price"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Valor sugerido por passageiro (mínimo R$ {MIN_DRIVER_PRICE.toFixed(2)}):
                  </label>
                  <span className="text-sm font-extrabold text-foreground">
                    R$ {currentDriverPrice.toFixed(2)}
                  </span>
                </div>

                <input
                  id="driver-price"
                  type="range"
                  min={3.5}
                  max={25.0}
                  step={0.5}
                  value={currentDriverPrice}
                  onChange={(e) => onDriverPriceChange(parseFloat(e.target.value))}
                  className="w-full accent-caronaa-primary cursor-pointer"
                />

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Taxa da plataforma (25% em validação):</span>
                    <span className="font-semibold text-muted-foreground">
                      - R$ {currentFee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Você recebe líquido por carona:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      R$ {currentNet.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Shield size={16} className="text-caronaa-primary" />O que faria você confiar?
          </div>
          <p className="text-xs text-muted-foreground">
            No Siará Tech Summit, priorizamos participantes do ecossistema, verificação de
            identidade e aprovação mútua antes de qualquer encontro.
          </p>
        </div>
      </div>

      <Nav
        onNext={onNext}
        onBack={onBack}
        canContinue={canContinue}
        nextLabel="Avançar para contato"
      />
    </StepShell>
  );
}
