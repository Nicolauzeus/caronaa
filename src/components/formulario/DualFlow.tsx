// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import React from "react";
import {
  Sparkles,
  Check,
  ShieldAlert,
  Info,
  Lock,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";
import type {
  DriverFutureOffer,
  DriverGenderPreference,
  DriverRealValidation,
  DualPriority,
  PassengerIntention,
  TrustFactor,
  VehicleType,
} from "@/lib/formulario/types";

const MIN_DRIVER_PRICE = 3.5;
const MAX_DRIVER_PRICE = 25.0;
const MIN_PASSENGER_PRICE = 3.5;
const MAX_PASSENGER_PRICE = 25.0;
const PLATFORM_FEE_RATE = 0.25;

type DualFlowProps = {
  dualPriority?: DualPriority | undefined;

  // Compartilhado: Confiança
  trustFactors?: TrustFactor[] | undefined;
  genderPreference?: DriverGenderPreference | undefined;

  // Lado Motorista
  vehicleType?: VehicleType | undefined;
  availableSeats?: number | undefined;
  maxDetourMinutes?: number | undefined;
  driverFutureOffer?: DriverFutureOffer | undefined;
  driverPrice?: number | undefined;
  driverBarriers?: string[] | undefined;
  driverBarriersCustom?: string | undefined;
  driverRealValidation?: DriverRealValidation | undefined;

  // Lado Passageiro
  passengerTransports?: string[] | undefined;
  passengerTransportsCustom?: string | undefined;
  passengerDifficulties?: string[] | undefined;
  passengerDifficultiesCustom?: string | undefined;
  passengerFairPrice?: number | undefined;
  passengerBarriers?: string[] | undefined;
  passengerBarriersCustom?: string | undefined;
  passengerIntention?: PassengerIntention | undefined;

  // Handlers
  onDualPriorityChange: (value: DualPriority) => void;
  onTrustFactorsChange: (value: TrustFactor[]) => void;
  onGenderPreferenceChange: (value: DriverGenderPreference) => void;

  onVehicleTypeChange: (value: VehicleType) => void;
  onAvailableSeatsChange: (value: number) => void;
  onMaxDetourMinutesChange: (value: number) => void;
  onDriverFutureOfferChange: (value: DriverFutureOffer) => void;
  onDriverPriceChange: (value: number) => void;
  onDriverBarriersChange: (value: string[]) => void;
  onDriverBarriersCustomChange: (value: string) => void;
  onDriverRealValidationChange: (value: DriverRealValidation) => void;

  onPassengerTransportsChange: (value: string[]) => void;
  onPassengerTransportsCustomChange: (value: string) => void;
  onPassengerDifficultiesChange: (value: string[]) => void;
  onPassengerDifficultiesCustomChange: (value: string) => void;
  onPassengerFairPriceChange: (value: number) => void;
  onPassengerBarriersChange: (value: string[]) => void;
  onPassengerBarriersCustomChange: (value: string) => void;
  onPassengerIntentionChange: (value: PassengerIntention) => void;

  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
};

const priorityOptions: Array<{
  value: DualPriority;
  icon: string;
  label: string;
  description: string;
}> = [
  {
    value: "OFERECER",
    icon: "🚗",
    label: "Oferecer",
    description: "Minha prioridade principal hoje é oferecer vagas no meu trajeto.",
  },
  {
    value: "PEGAR",
    icon: "🙋",
    label: "Pegar",
    description: "Minha prioridade principal hoje é encontrar uma carona.",
  },
  {
    value: "AMBOS_AVALIAR",
    icon: "🔄",
    label: "Quero avaliar os dois",
    description: "Estou aberto a qualquer uma das opções conforme a combinação encontrada.",
  },
];

const sharedTrustOptions: Array<{
  id: TrustFactor;
  label: string;
  description: string;
}> = [
  {
    id: "IDENTIDADE_VERIFICADA",
    label: "Participante verificado",
    description: "Credencial ou perfil confirmado no evento Siará Tech Summit.",
  },
  {
    id: "FOTO",
    label: "Foto e dados confirmados",
    description: "Identidade transparente e informações básicas checadas.",
  },
  {
    id: "ROTA_VISIVEL",
    label: "Rota e embarque visíveis",
    description: "Conhecer com precisão a rota e ponto de encontro antes de confirmar.",
  },
  {
    id: "WHATSAPP_VERIFICADO",
    label: "WhatsApp validado",
    description: "Canal direto de comunicação confirmado para alinhamento.",
  },
  {
    id: "MESMO_GENERO",
    label: "Preferência por pessoas do mesmo gênero",
    description: "Opção pessoal para quem se sente mais à vontade no trajeto.",
  },
  {
    id: "AVALIACOES",
    label: "Avaliações no app",
    description: "Histórico e comentários de experiências prévias com outros participantes.",
  },
];

const vehicleOptions: Array<{
  value: VehicleType;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    value: "CARRO_PROPRIO",
    icon: "🚗",
    title: "Carro próprio",
    description: "Estou com meu próprio carro no evento.",
  },
  {
    value: "CARRO_COMPARTILHADO",
    icon: "🚙",
    title: "Carro da família / compartilhado",
    description: "Tenho acesso ao veículo e posso oferecer carona.",
  },
  {
    value: "MOTO",
    icon: "🏍️",
    title: "Moto",
    description: "Estou de moto no evento.",
  },
];

const seatOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const driverBarrierOptions = [
  { id: "PONTO_ENCONTRO", label: "Dificuldade de combinar o ponto exato de encontro no evento" },
  { id: "ATRASO", label: "Receio de que a outra pessoa se atrase no horário combinado" },
  { id: "CANCELAMENTO", label: "Receio de cancelamento de última hora" },
  { id: "DESVIO_ROTA", label: "Preocupação com desvios que aumentem muito o tempo de viagem" },
  { id: "PAGAMENTO", label: "Dúvida sobre a compensação e taxa de serviço" },
  { id: "OUTRA", label: "Outra questão" },
];

const driverRealValidationOptions: Array<{
  value: DriverRealValidation;
  label: string;
  description: string;
}> = [
  {
    value: "COM_CERTEZA",
    label: "Com certeza, posso oferecer.",
    description:
      "Tenho real intenção de dar carona na saída do evento hoje se houver compatibilidade.",
  },
  {
    value: "TALVEZ",
    label: "Talvez.",
    description: "Depende de encontrar alguém com rota e horário muito alinhados aos meus.",
  },
  {
    value: "APENAS_STS",
    label: "Sim, mas apenas durante o Siará Tech Summit.",
    description: "Minha disponibilidade é específica para o período do evento.",
  },
];

const transportOptions = [
  { value: "UBER_99", icon: "🚗", label: "Aplicativos (Uber / 99)" },
  { value: "ONIBUS", icon: "🚌", label: "Ônibus convencional" },
  { value: "METRO_VLT", icon: "🚆", label: "Metrô / VLT" },
  { value: "CARRO_PROPRIO", icon: "🚘", label: "Carro próprio" },
  { value: "MOTO_PROPRIA", icon: "🏍️", label: "Moto própria" },
  { value: "CARONA", icon: "👥", label: "Carona com colegas" },
  { value: "COMBINACAO", icon: "🔄", label: "Combinação de transportes" },
  { value: "OUTRO", icon: "📍", label: "Outro modo" },
];

const difficultyOptions = [
  { id: "DOR_01", label: "Dificuldade de encontrar transporte rápido e direto para essa rota." },
  { id: "DOR_02", label: "Transporte público lotado ou desconfortável nos horários de pico." },
  { id: "DOR_03", label: "Preços muito elevados de corridas por aplicativo na saída do evento." },
  { id: "DOR_04", label: "Demora excessiva para voltar para casa após palestras e oficinas." },
  { id: "DOR_06", label: "Receio de segurança ao combinar viagens com pessoas desconhecidas." },
  { id: "OUTRA", label: "Outra dificuldade no deslocamento." },
];

const passengerBarrierOptions = [
  { id: "HORARIO", label: "Incerteza sobre o horário exato de saída do evento" },
  { id: "SEGURANCA", label: "Receio de segurança ao entrar no carro de um desconhecido" },
  { id: "PONTO_ENCONTRO", label: "Dificuldade de localizar o ponto de encontro combinado" },
  { id: "CANCELAMENTO", label: "Receio de cancelamento de última hora por parte do motorista" },
  { id: "PAGAMENTO", label: "Dúvida sobre a forma de pagamento ou divisão da compensação" },
  { id: "OUTRA", label: "Outra questão" },
];

const passengerIntentionOptions: Array<{
  value: PassengerIntention;
  label: string;
  description: string;
}> = [
  {
    value: "COM_CERTEZA_HOJE",
    label: "Com certeza, posso precisar hoje.",
    description: "Tenho intenção real de pegar carona na saída do evento hoje se houver vaga.",
  },
  {
    value: "TALVEZ",
    label: "Talvez.",
    description: "Depende de encontrar alguém compatível com o meu caminho e horário.",
  },
  {
    value: "COM_CERTEZA_SEMPRE",
    label: "Com certeza — e não apenas hoje.",
    description: "Quero usar no Siará Tech Summit e também na minha rotina regular.",
  },
];

export function DualFlow({
  dualPriority,
  trustFactors = [],
  genderPreference,
  vehicleType,
  availableSeats,
  driverFutureOffer,
  driverPrice,
  driverBarriers = [],
  driverBarriersCustom = "",
  driverRealValidation,
  passengerTransports = [],
  passengerTransportsCustom = "",
  passengerDifficulties = [],
  passengerDifficultiesCustom = "",
  passengerFairPrice,
  passengerBarriers = [],
  passengerBarriersCustom = "",
  passengerIntention,
  onDualPriorityChange,
  onTrustFactorsChange,
  onGenderPreferenceChange,
  onVehicleTypeChange,
  onAvailableSeatsChange,
  onDriverFutureOfferChange,
  onDriverPriceChange,
  onDriverBarriersChange,
  onDriverBarriersCustomChange,
  onDriverRealValidationChange,
  onPassengerTransportsChange,
  onPassengerTransportsCustomChange,
  onPassengerDifficultiesChange,
  onPassengerDifficultiesCustomChange,
  onPassengerFairPriceChange,
  onPassengerBarriersChange,
  onPassengerBarriersCustomChange,
  onPassengerIntentionChange,
  onNext,
  onBack,
  stepNumber = 3,
  totalSteps = 4,
}: DualFlowProps) {
  // Controle de preço motorista
  const currentDriverPrice = driverPrice !== undefined ? driverPrice : 10;
  const [driverRawCents, setDriverRawCents] = React.useState<string>(() =>
    Math.round(currentDriverPrice * 100).toString(),
  );

  React.useEffect(() => {
    if (driverPrice !== undefined) {
      setDriverRawCents(Math.round(driverPrice * 100).toString());
    }
  }, [driverPrice]);

  function handleDriverPriceInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setDriverRawCents(digitsOnly);
    if (digitsOnly.length > 0) {
      onDriverPriceChange(parseInt(digitsOnly, 10) / 100);
    }
  }

  const numericDriverPrice = driverRawCents ? parseInt(driverRawCents, 10) / 100 : 0;
  const isDriverPriceValid =
    numericDriverPrice >= MIN_DRIVER_PRICE && numericDriverPrice <= MAX_DRIVER_PRICE;
  const currentFee = numericDriverPrice * PLATFORM_FEE_RATE;
  const currentNet = numericDriverPrice - currentFee;

  // Controle de preço passageiro
  const currentPassengerPrice = passengerFairPrice !== undefined ? passengerFairPrice : 10;
  const [passengerRawCents, setPassengerRawCents] = React.useState<string>(() =>
    Math.round(currentPassengerPrice * 100).toString(),
  );

  React.useEffect(() => {
    if (passengerFairPrice !== undefined) {
      setPassengerRawCents(Math.round(passengerFairPrice * 100).toString());
    }
  }, [passengerFairPrice]);

  function handlePassengerPriceInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setPassengerRawCents(digitsOnly);
    if (digitsOnly.length > 0) {
      onPassengerFairPriceChange(parseInt(digitsOnly, 10) / 100);
    }
  }

  const numericPassengerPrice = passengerRawCents ? parseInt(passengerRawCents, 10) / 100 : 0;
  const isPassengerPriceValid =
    numericPassengerPrice >= MIN_PASSENGER_PRICE && numericPassengerPrice <= MAX_PASSENGER_PRICE;

  // Toggle helpers
  function toggleTrustFactor(id: TrustFactor) {
    if (trustFactors.includes(id)) {
      onTrustFactorsChange(trustFactors.filter((item) => item !== id));
      if (id === "MESMO_GENERO") {
        onGenderPreferenceChange(undefined as unknown as DriverGenderPreference);
      }
    } else {
      onTrustFactorsChange([...trustFactors, id]);
    }
  }

  function toggleDriverBarrier(id: string) {
    const next = driverBarriers.includes(id)
      ? driverBarriers.filter((item) => item !== id)
      : [...driverBarriers, id];
    onDriverBarriersChange(next);
  }

  function togglePassengerTransport(val: string) {
    const next = passengerTransports.includes(val)
      ? passengerTransports.filter((item) => item !== val)
      : [...passengerTransports, val];
    onPassengerTransportsChange(next);
  }

  function togglePassengerDifficulty(id: string) {
    const next = passengerDifficulties.includes(id)
      ? passengerDifficulties.filter((item) => item !== id)
      : [...passengerDifficulties, id];
    onPassengerDifficultiesChange(next);
  }

  function togglePassengerBarrier(id: string) {
    const next = passengerBarriers.includes(id)
      ? passengerBarriers.filter((item) => item !== id)
      : [...passengerBarriers, id];
    onPassengerBarriersChange(next);
  }

  // Validações
  const isDriverBarrierCustomValid =
    !driverBarriers.includes("OUTRA") || Boolean(driverBarriersCustom?.trim());
  const isPassengerTransportCustomValid =
    !passengerTransports.includes("OUTRO") || Boolean(passengerTransportsCustom?.trim());
  const isPassengerDifficultyCustomValid =
    !passengerDifficulties.includes("OUTRA") || Boolean(passengerDifficultiesCustom?.trim());
  const isPassengerBarrierCustomValid =
    !passengerBarriers.includes("OUTRA") || Boolean(passengerBarriersCustom?.trim());

  const isDriverValid =
    Boolean(vehicleType) &&
    availableSeats !== undefined &&
    isDriverPriceValid &&
    isDriverBarrierCustomValid &&
    Boolean(driverRealValidation) &&
    (availableSeats > 0 || Boolean(driverFutureOffer));

  const isPassengerValid =
    passengerTransports.length > 0 &&
    isPassengerTransportCustomValid &&
    passengerDifficulties.length > 0 &&
    isPassengerDifficultyCustomValid &&
    isPassengerPriceValid &&
    isPassengerBarrierCustomValid &&
    Boolean(passengerIntention);

  const canContinue = Boolean(dualPriority) && isDriverValid && isPassengerValid;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      {/* Header com badge */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-bold text-caronaa-dark dark:text-caronaa-primary">
            Etapa {stepNumber} de {totalSteps} • Oferecer e Pegar Carona
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ArrowRightLeft size={13} />
            Perfil flexível (os dois)
          </span>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
          Como você quer participar da CARONAA?
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Como você topa tanto oferecer quanto pegar carona, já aproveitamos seu caminho e
          precisamos apenas entender suas preferências para cada possibilidade.
        </p>
      </div>

      {/* BLOCO 1: PERGUNTA INICIAL OBRIGATÓRIA — PRIORIDADE */}
      <div className="space-y-3 rounded-2xl border-2 border-caronaa-primary/30 bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            Hoje, qual dessas possibilidades é mais importante para você? *
          </label>
          <p className="text-xs text-muted-foreground">
            Isso ajuda nossa equipe a priorizar seu contato e mapear as combinações ideais.
          </p>
        </div>

        <div
          className="grid gap-2.5 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Prioridade entre oferecer e pegar"
        >
          {priorityOptions.map((opt) => {
            const isSelected = dualPriority === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onDualPriorityChange(opt.value)}
                className={[
                  "flex flex-col items-start rounded-xl border p-3.5 text-left transition relative",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caronaa-primary",
                  isSelected
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20 shadow-xs"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{opt.icon}</span>
                    <span className="font-bold text-xs sm:text-sm text-foreground">
                      {opt.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="size-4 rounded-full bg-caronaa-primary flex items-center justify-center text-caronaa-dark shrink-0">
                      <Check size={11} className="stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground mt-2">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* BLOCO 2: CONFIANÇA UNIFICADA (REUTILIZADA, SEM DUPLICIDADE) */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-caronaa-dark dark:text-caronaa-primary font-bold text-xs uppercase tracking-wide">
            <Sparkles size={14} />
            Confiança e Segurança Unificada
          </div>
          <label className="text-base font-bold text-foreground block">
            O que traria confiança para você compartilhar o trajeto?
          </label>
          <p className="text-xs text-muted-foreground">
            Essas preferências valem para quando você estiver oferecendo ou pegando carona.
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {sharedTrustOptions.map((opt) => {
            const isChecked = trustFactors.includes(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleTrustFactor(opt.id)}
                className={[
                  "flex items-start justify-between rounded-xl border p-3.5 text-left transition",
                  isChecked
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30 shadow-xs"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-xs sm:text-sm text-foreground block">
                    {opt.label}
                  </span>
                  <span className="text-[11px] leading-relaxed text-muted-foreground mt-0.5 block">
                    {opt.description}
                  </span>
                </div>
                <div
                  className={[
                    "size-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                      : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {isChecked && <Check size={11} className="stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Preferência de gênero opcional */}
        {trustFactors.includes("MESMO_GENERO") && (
          <div className="rounded-xl border border-border bg-accent/20 p-4 space-y-3 animate-in fade-in duration-200">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">
                Qual gênero você gostaria de considerar? (Opcional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: "FEMININO" as DriverGenderPreference, label: "Feminino" },
                  { value: "MASCULINO" as DriverGenderPreference, label: "Masculino" },
                  {
                    value: "OUTRO" as DriverGenderPreference,
                    label: "Outro / Prefiro não informar",
                  },
                ].map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => onGenderPreferenceChange(g.value)}
                    className={[
                      "rounded-xl border p-2.5 text-xs font-bold transition text-center",
                      genderPreference === g.value
                        ? "border-caronaa-primary bg-caronaa-primary/20 text-caronaa-dark dark:text-caronaa-primary ring-1 ring-caronaa-primary/40"
                        : "border-border bg-card hover:bg-accent/40",
                    ].join(" ")}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2.5 border border-border/60">
              <Lock size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>Dado pessoal confidencial:</strong> Esta preferência é protegida e visa
                exclusivamente seu conforto pessoal.
              </p>
            </div>
          </div>
        )}

        {/* Aviso de segurança e avaliações */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs sm:text-sm">
            <ShieldAlert size={17} className="text-amber-600 dark:text-amber-400 shrink-0" />
            Aviso de transparência e segurança
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
            Novos participantes podem não ter avaliações prévias na plataforma, e avaliações
            positivas não constituem garantia absoluta de segurança. Sempre embarque nos pontos de
            encontro oficiais sinalizados e compartilhe sua viagem.
          </p>
        </div>
      </div>

      {/* BLOCO 3: QUANDO VOCÊ FOR MOTORISTA (ESPECÍFICO) */}
      <div className="space-y-6 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1 border-b border-border pb-3">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
            🚗 Para quando você for motorista
          </div>
          <h3 className="text-lg font-extrabold text-foreground">Detalhes para oferecer lugares</h3>
          <p className="text-xs text-muted-foreground">
            Defina seu veículo, capacidade e compensação esperada.
          </p>
        </div>

        {/* Veículo */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            Qual veículo você tem disponível? *
          </label>
          <div
            className="grid gap-2.5 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Veículo motorista"
          >
            {vehicleOptions.map((opt) => {
              const isSelected = vehicleType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onVehicleTypeChange(opt.value)}
                  className={[
                    "flex flex-col items-start rounded-xl border p-3 text-left transition",
                    isSelected
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <span className="mt-1 font-bold text-xs text-foreground">{opt.title}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>

          {vehicleType === "MOTO" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-1 mt-2">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold text-xs">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                Alerta de segurança e conformidade legal
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                O transporte de passageiro em moto exige capacete adequado e conformidade com o CTB.
              </p>
            </div>
          )}
        </div>

        {/* Vagas disponíveis */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground block">
            Vagas disponíveis para oferecer: *
          </label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Vagas disponíveis">
            {seatOptions.map((seats) => {
              const isSelected = availableSeats === seats;
              return (
                <button
                  key={seats}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onAvailableSeatsChange(seats)}
                  className={[
                    "size-10 rounded-xl border text-xs font-bold transition flex items-center justify-center",
                    isSelected
                      ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark shadow-xs"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  {seats === 10 ? "10+" : seats}
                </button>
              );
            })}
          </div>

          {availableSeats === 0 && (
            <div className="rounded-xl border border-border bg-accent/30 p-3.5 space-y-2 mt-2">
              <p className="text-xs text-foreground font-semibold">
                Sem lugares livres hoje? Você poderia oferecer carona em outro momento? *
              </p>
              <div className="flex gap-2">
                {[
                  { value: "SIM" as DriverFutureOffer, label: "Sim, em outro dia" },
                  { value: "TALVEZ" as DriverFutureOffer, label: "Talvez" },
                  { value: "NAO" as DriverFutureOffer, label: "Não pretendo" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDriverFutureOfferChange(opt.value)}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                      driverFutureOffer === opt.value
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-border bg-card hover:bg-accent/40",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Compensação motorista */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-foreground block">
            Compensação esperada por passageiro: *
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-sm font-extrabold text-muted-foreground">
              R$
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={
                numericDriverPrice > 0
                  ? numericDriverPrice.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : ""
              }
              onChange={handleDriverPriceInputChange}
              placeholder="0,00"
              className="min-h-11 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base font-bold outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>

          {isDriverPriceValid && (
            <div className="rounded-xl border border-border bg-accent/20 p-3 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Compensação informada:</span>
                <span className="font-bold text-foreground">
                  R$ {numericDriverPrice.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxa da plataforma (25% em validação):</span>
                <span>- R$ {currentFee.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold text-foreground">
                <span>Você recebe líquido:</span>
                <span className="text-emerald-600 font-extrabold">
                  R$ {currentNet.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Barreiras motorista */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            O que mais te faria hesitar em oferecer carona?
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {driverBarrierOptions.map((opt) => {
              const isChecked = driverBarriers.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleDriverBarrier(opt.id)}
                  className={[
                    "flex items-center justify-between rounded-xl border p-2.5 text-left transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="text-xs font-semibold text-foreground pr-2">{opt.label}</span>
                  <div
                    className={[
                      "size-4 rounded-md border flex items-center justify-center shrink-0 transition",
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-muted-foreground/40",
                    ].join(" ")}
                  >
                    {isChecked && <Check size={11} className="stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {driverBarriers.includes("OUTRA") && (
            <div className="pt-1">
              <input
                type="text"
                value={driverBarriersCustom}
                onChange={(e) => onDriverBarriersCustomChange(e.target.value)}
                placeholder="Descreva sua dúvida para oferecer carona... *"
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-caronaa-primary"
              />
            </div>
          )}
        </div>

        {/* Validação real motorista */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            Se houver alguém compatível com o seu trajeto hoje, você ofereceria carona? *
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {driverRealValidationOptions.map((opt) => {
              const isSelected = driverRealValidation === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onDriverRealValidationChange(opt.value)}
                  className={[
                    "flex flex-col items-start rounded-xl border p-3 text-left transition",
                    isSelected
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{opt.label}</span>
                    {isSelected && (
                      <span className="size-3.5 rounded-full bg-caronaa-primary flex items-center justify-center text-caronaa-dark shrink-0">
                        <Check size={9} className="stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* BLOCO 4: QUANDO VOCÊ FOR PASSAGEIRO (ESPECÍFICO) */}
      <div className="space-y-6 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1 border-b border-border pb-3">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
            🙋 Para quando você for passageiro
          </div>
          <h3 className="text-lg font-extrabold text-foreground">Detalhes para pegar carona</h3>
          <p className="text-xs text-muted-foreground">
            Defina como se desloca, dificuldades e quanto considera justo pagar.
          </p>
        </div>

        {/* Como se desloca hoje */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            Como costuma se deslocar hoje para trajetos como esse? *
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {transportOptions.map((opt) => {
              const isChecked = passengerTransports.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => togglePassengerTransport(opt.value)}
                  className={[
                    "flex items-center justify-between rounded-xl border p-2.5 text-left transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{opt.icon}</span>
                    <span className="font-bold text-xs text-foreground">{opt.label}</span>
                  </div>
                  <div
                    className={[
                      "size-4 rounded-md border flex items-center justify-center shrink-0 transition",
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-muted-foreground/40",
                    ].join(" ")}
                  >
                    {isChecked && <Check size={11} className="stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {passengerTransports.includes("OUTRO") && (
            <div className="pt-1">
              <input
                type="text"
                value={passengerTransportsCustom}
                onChange={(e) => onPassengerTransportsCustomChange(e.target.value)}
                placeholder="Especifique seu transporte atual... *"
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-caronaa-primary"
              />
            </div>
          )}
        </div>

        {/* Maior dificuldade */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            Maiores dificuldades que enfrenta no deslocamento: *
          </label>
          <div className="grid gap-2">
            {difficultyOptions.map((opt) => {
              const isChecked = passengerDifficulties.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePassengerDifficulty(opt.id)}
                  className={[
                    "flex items-center justify-between rounded-xl border p-2.5 text-left transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="text-xs font-semibold text-foreground pr-2">{opt.label}</span>
                  <div
                    className={[
                      "size-4 rounded-md border flex items-center justify-center shrink-0 transition",
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-muted-foreground/40",
                    ].join(" ")}
                  >
                    {isChecked && <Check size={11} className="stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {passengerDifficulties.includes("OUTRA") && (
            <div className="pt-1">
              <input
                type="text"
                value={passengerDifficultiesCustom}
                onChange={(e) => onPassengerDifficultiesCustomChange(e.target.value)}
                placeholder="Descreva sua dificuldade no deslocamento... *"
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-caronaa-primary"
              />
            </div>
          )}
        </div>

        {/* Valor justo passageiro */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-foreground block">
            Quanto você consideraria justo pagar pelo trajeto? *
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-sm font-extrabold text-muted-foreground">
              R$
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={
                numericPassengerPrice > 0
                  ? numericPassengerPrice.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : ""
              }
              onChange={handlePassengerPriceInputChange}
              placeholder="0,00"
              className="min-h-11 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base font-bold outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>

          <div className="rounded-xl border border-muted-foreground/20 bg-muted/20 p-2.5 flex items-start gap-2">
            <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              R$ 3,50 é nossa referência mínima para validação e o valor final pode variar conforme
              o percurso e ponto de encontro combinado.
            </p>
          </div>
        </div>

        {/* Barreiras passageiro */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            O que mais te faria hesitar em pegar carona?
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {passengerBarrierOptions.map((opt) => {
              const isChecked = passengerBarriers.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => togglePassengerBarrier(opt.id)}
                  className={[
                    "flex items-center justify-between rounded-xl border p-2.5 text-left transition",
                    isChecked
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <span className="text-xs font-semibold text-foreground pr-2">{opt.label}</span>
                  <div
                    className={[
                      "size-4 rounded-md border flex items-center justify-center shrink-0 transition",
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-muted-foreground/40",
                    ].join(" ")}
                  >
                    {isChecked && <Check size={11} className="stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {passengerBarriers.includes("OUTRA") && (
            <div className="pt-1">
              <input
                type="text"
                value={passengerBarriersCustom}
                onChange={(e) => onPassengerBarriersCustomChange(e.target.value)}
                placeholder="Descreva sua dúvida para pegar carona... *"
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-caronaa-primary"
              />
            </div>
          )}
        </div>

        {/* Intenção passageiro */}
        <div className="space-y-2.5">
          <label className="text-sm font-bold text-foreground block">
            Se houver alguém compatível com o seu trajeto hoje, você pegaria essa carona? *
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {passengerIntentionOptions.map((opt) => {
              const isSelected = passengerIntention === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onPassengerIntentionChange(opt.value)}
                  className={[
                    "flex flex-col items-start rounded-xl border p-3 text-left transition",
                    isSelected
                      ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20"
                      : "border-border bg-card hover:bg-accent/40",
                  ].join(" ")}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{opt.label}</span>
                    {isSelected && (
                      <span className="size-3.5 rounded-full bg-caronaa-primary flex items-center justify-center text-caronaa-dark shrink-0">
                        <Check size={9} className="stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navegação */}
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
          Continuar
        </button>
      </div>
    </section>
  );
}
