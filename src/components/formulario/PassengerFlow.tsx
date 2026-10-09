// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import React from "react";
import { Sparkles, Check, ShieldAlert, Info, AlertTriangle, Lock } from "lucide-react";
import type {
  DriverGenderPreference,
  PassengerIntention,
  TrustFactor,
} from "@/lib/formulario/types";

const MIN_PASSENGER_PRICE = 3.5;
const MAX_PASSENGER_PRICE = 25.0;

type PassengerFlowProps = {
  passengerTransports?: string[] | undefined;
  passengerTransportsCustom?: string | undefined;
  passengerDifficulties?: string[] | undefined;
  passengerDifficultiesCustom?: string | undefined;
  passengerTrustFactors?: TrustFactor[] | undefined;
  passengerGenderPreference?: DriverGenderPreference | undefined;
  passengerFairPrice?: number | undefined;
  passengerBarriers?: string[] | undefined;
  passengerBarriersCustom?: string | undefined;
  passengerIntention?: PassengerIntention | undefined;

  onPassengerTransportsChange: (value: string[]) => void;
  onPassengerTransportsCustomChange: (value: string) => void;
  onPassengerDifficultiesChange: (value: string[]) => void;
  onPassengerDifficultiesCustomChange: (value: string) => void;
  onPassengerTrustFactorsChange: (value: TrustFactor[]) => void;
  onPassengerGenderPreferenceChange: (value: DriverGenderPreference) => void;
  onPassengerFairPriceChange: (value: number) => void;
  onPassengerBarriersChange: (value: string[]) => void;
  onPassengerBarriersCustomChange: (value: string) => void;
  onPassengerIntentionChange: (value: PassengerIntention) => void;

  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
};

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

const trustFactorOptions: Array<{
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
    description: "Identidade transparente do motorista antes do embarque.",
  },
  {
    id: "ROTA_VISIVEL",
    label: "Rota e embarque visíveis",
    description: "Conhecer com precisão a rota e ponto de encontro antes de confirmar.",
  },
  {
    id: "WHATSAPP_VERIFICADO",
    label: "WhatsApp validado",
    description: "Canal direto de comunicação confirmado para alinhamento rápido.",
  },
  {
    id: "MESMO_GENERO",
    label: "Preferência por pessoas do mesmo gênero",
    description: "Filtro de conforto pessoal para viajar com motoristas do mesmo gênero.",
  },
  {
    id: "AVALIACOES",
    label: "Avaliações no app",
    description: "Histórico e comentários de experiências prévias com outros participantes.",
  },
];

const barrierOptions = [
  { id: "HORARIO", label: "Incerteza sobre o horário exato de saída do evento" },
  { id: "SEGURANCA", label: "Receio de segurança ao entrar no carro de um desconhecido" },
  { id: "PONTO_ENCONTRO", label: "Dificuldade de localizar o ponto de encontro combinado" },
  { id: "CANCELAMENTO", label: "Receio de cancelamento de última hora por parte do motorista" },
  { id: "PAGAMENTO", label: "Dúvida sobre a forma de pagamento ou divisão da compensação" },
  { id: "OUTRA", label: "Outra questão" },
];

const intentionOptions: Array<{
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

const pricePresets = [5, 10, 15, 20, 25];

export function PassengerFlow({
  passengerTransports = [],
  passengerTransportsCustom = "",
  passengerDifficulties = [],
  passengerDifficultiesCustom = "",
  passengerTrustFactors = [],
  passengerGenderPreference,
  passengerFairPrice,
  passengerBarriers = [],
  passengerBarriersCustom = "",
  passengerIntention,
  onPassengerTransportsChange,
  onPassengerTransportsCustomChange,
  onPassengerDifficultiesChange,
  onPassengerDifficultiesCustomChange,
  onPassengerTrustFactorsChange,
  onPassengerGenderPreferenceChange,
  onPassengerFairPriceChange,
  onPassengerBarriersChange,
  onPassengerBarriersCustomChange,
  onPassengerIntentionChange,
  onNext,
  onBack,
  stepNumber = 4,
  totalSteps = 5,
}: PassengerFlowProps) {
  const [subStep, setSubStep] = React.useState<number>(1);

  // Inicialização de preço padrão caso ainda não definido (R$ 10,00 padrão)
  const currentPrice = passengerFairPrice !== undefined ? passengerFairPrice : 10;

  React.useEffect(() => {
    if (passengerFairPrice === undefined) {
      onPassengerFairPriceChange(10);
    }
  }, [passengerFairPrice, onPassengerFairPriceChange]);

  const [rawCents, setRawCents] = React.useState<string>(() =>
    Math.round(currentPrice * 100).toString(),
  );

  React.useEffect(() => {
    if (passengerFairPrice !== undefined) {
      setRawCents(Math.round(passengerFairPrice * 100).toString());
    }
  }, [passengerFairPrice]);

  function handlePriceInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setRawCents(digitsOnly);

    if (digitsOnly.length > 0) {
      const parsedNum = parseInt(digitsOnly, 10) / 100;
      onPassengerFairPriceChange(parsedNum);
    }
  }

  function handlePricePreset(preset: number) {
    onPassengerFairPriceChange(preset);
    setRawCents(Math.round(preset * 100).toString());
  }

  const numericPrice = rawCents ? parseInt(rawCents, 10) / 100 : 10;
  const isPriceValid = numericPrice >= MIN_PASSENGER_PRICE && numericPrice <= MAX_PASSENGER_PRICE;

  // Toggle helpers
  function toggleTransport(val: string) {
    const next = passengerTransports.includes(val)
      ? passengerTransports.filter((item) => item !== val)
      : [...passengerTransports, val];
    onPassengerTransportsChange(next);
  }

  function toggleDifficulty(id: string) {
    const next = passengerDifficulties.includes(id)
      ? passengerDifficulties.filter((item) => item !== id)
      : [...passengerDifficulties, id];
    onPassengerDifficultiesChange(next);
  }

  function toggleTrustFactor(id: TrustFactor) {
    if (passengerTrustFactors.includes(id)) {
      onPassengerTrustFactorsChange(passengerTrustFactors.filter((item) => item !== id));
      if (id === "MESMO_GENERO") {
        onPassengerGenderPreferenceChange(undefined as unknown as DriverGenderPreference);
      }
    } else {
      onPassengerTrustFactorsChange([...passengerTrustFactors, id]);
    }
  }

  function toggleBarrier(id: string) {
    const next = passengerBarriers.includes(id)
      ? passengerBarriers.filter((item) => item !== id)
      : [...passengerBarriers, id];
    onPassengerBarriersChange(next);
  }

  const isTransportCustomValid =
    !passengerTransports.includes("OUTRO") || Boolean(passengerTransportsCustom?.trim());
  const isDifficultyCustomValid =
    !passengerDifficulties.includes("OUTRA") || Boolean(passengerDifficultiesCustom?.trim());
  const isBarrierCustomValid =
    !passengerBarriers.includes("OUTRA") || Boolean(passengerBarriersCustom?.trim());

  // Validações por sub-etapa
  const canContinueSubStep1 =
    passengerTransports.length > 0 &&
    isTransportCustomValid &&
    passengerDifficulties.length > 0 &&
    isDifficultyCustomValid;
  const canContinueSubStep2 = true;
  const canContinueSubStep3 = isPriceValid;
  const canContinueSubStep4 = Boolean(passengerIntention) && isBarrierCustomValid;

  function handleNextSubStep() {
    if (subStep === 1 && canContinueSubStep1) {
      setSubStep(2);
    } else if (subStep === 2 && canContinueSubStep2) {
      setSubStep(3);
    } else if (subStep === 3 && canContinueSubStep3) {
      setSubStep(4);
    } else if (subStep === 4 && canContinueSubStep4) {
      onNext();
    }
  }

  function handleBackSubStep() {
    if (subStep > 1) {
      setSubStep(subStep - 1);
    } else {
      onBack();
    }
  }

  return (
    <div className="flex h-full w-full flex-col justify-between">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
        {/* Sub-step Indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-semibold text-caronaa-dark dark:text-caronaa-primary">
            <Sparkles size={13} className="text-caronaa-primary" />
            Etapa {stepNumber} de {totalSteps} • Preferências do Passageiro ({subStep}/4)
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
                  s === subStep
                    ? "bg-caronaa-primary w-8"
                    : s < subStep
                      ? "bg-caronaa-primary/60"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* SUB-ETAPA 1: Deslocamento Atual & Dificuldades */}
        {subStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Como você costuma se deslocar?
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Selecione seus transportes habituais e as principais dificuldades que enfrenta.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Como você costuma se deslocar hoje para trajetos como esse? *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {transportOptions.map((opt) => {
                  const isChecked = passengerTransports.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleTransport(opt.value)}
                      className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                        isChecked
                          ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                          : "border-border bg-card hover:border-caronaa-primary/40"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xl">{opt.icon}</span>
                        <div
                          className={`size-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isChecked
                              ? "bg-caronaa-primary border-caronaa-primary text-caronaa-dark"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isChecked && <Check size={11} className="stroke-[3]" />}
                        </div>
                      </div>
                      <span className="mt-1 font-bold text-xs text-foreground leading-tight">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {passengerTransports.includes("OUTRO") && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={passengerTransportsCustom}
                    onChange={(e) => onPassengerTransportsCustomChange(e.target.value)}
                    placeholder="Especifique outro modo de transporte..."
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-caronaa-primary"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Quais as maiores dificuldades que você enfrenta? *
              </label>
              <div className="space-y-1.5">
                {difficultyOptions.map((opt) => {
                  const isChecked = passengerDifficulties.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleDifficulty(opt.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition ${
                        isChecked
                          ? "border-caronaa-primary bg-caronaa-primary/10"
                          : "border-border bg-card hover:border-caronaa-primary/40"
                      }`}
                    >
                      <span className="text-xs font-medium text-foreground">{opt.label}</span>
                      <div
                        className={`size-4 rounded-md border flex items-center justify-center shrink-0 ml-2 ${
                          isChecked
                            ? "bg-caronaa-primary border-caronaa-primary text-caronaa-dark"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isChecked && <Check size={11} className="stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-ETAPA 2: Confiança & Segurança */}
        {subStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                O que traria confiança para você pegar carona?
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Escolha os fatores mais importantes para sua tranquilidade no trajeto.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {trustFactorOptions.map((opt) => {
                const isChecked = passengerTrustFactors.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleTrustFactor(opt.id)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30"
                        : "border-border bg-card hover:border-caronaa-primary/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 size-4 rounded-md border flex items-center justify-center shrink-0 ${
                        isChecked
                          ? "bg-caronaa-primary border-caronaa-primary text-caronaa-dark"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isChecked && <Check size={11} className="stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground">{opt.label}</div>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-ETAPA 3: Contribuição Justa */}
        {subStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Contribuição justa por passageiro
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Quanto você consideraria justo pagar pelo trajeto até o seu destino?
              </p>
            </div>

            <div className="rounded-2xl border border-caronaa-primary/30 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Valor sugerido</span>
                  <div className="text-2xl font-black text-caronaa-dark dark:text-caronaa-primary">
                    R$ {numericPrice.toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {pricePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePricePreset(preset)}
                      className={`h-8 px-2.5 rounded-lg border text-xs font-bold transition ${
                        numericPrice === preset
                          ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      R$ {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Info size={16} className="mt-0.5 text-caronaa-primary shrink-0" />
              <span>
                O valor padrão pré-selecionado é de <strong>R$ 10,00</strong>. Você pode ajustá-lo livremente entre R$ 3,50 e R$ 25,00.
              </span>
            </div>
          </div>
        )}

        {/* SUB-ETAPA 4: Validação Real para Hoje */}
        {subStep === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Validação real para o Siará Tech Summit
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Se encontrarmos alguém compatível na saída do evento hoje, você pegaria essa carona?
              </p>
            </div>

            <div className="space-y-2">
              {intentionOptions.map((opt) => {
                const isSelected = passengerIntention === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onPassengerIntentionChange(opt.value)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary font-medium"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-caronaa-dark" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold sm:text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Static/Pinned Bottom Navigation */}
      <div className="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackSubStep}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={handleNextSubStep}
            disabled={
              (subStep === 1 && !canContinueSubStep1) ||
              (subStep === 2 && !canContinueSubStep2) ||
              (subStep === 3 && !canContinueSubStep3) ||
              (subStep === 4 && !canContinueSubStep4)
            }
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-caronaa-primary px-7 py-2.5 text-sm font-bold text-caronaa-dark shadow-md transition hover:bg-caronaa-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subStep === 4 ? "Avançar para contato" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
