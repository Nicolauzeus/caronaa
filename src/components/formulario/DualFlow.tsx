// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import React from "react";
import {
  Sparkles,
  Check,
  Info,
  AlertTriangle,
  Car,
  User,
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
import {
  calculateCaronaaFee,
  calculateDriverNet,
  MIN_DRIVER_PRICE,
} from "@/lib/formulario/pricing";

const MAX_DRIVER_PRICE = 25.0;
const MIN_PASSENGER_PRICE = 3.5;
const MAX_PASSENGER_PRICE = 25.0;

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

const pricePresets = [5, 10, 15, 20, 25];

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
  stepNumber = 4,
  totalSteps = 5,
}: DualFlowProps) {
  const [subStep, setSubStep] = React.useState<number>(1);

  // Inicialização de preços padrões
  const currentDriverPrice = driverPrice !== undefined ? driverPrice : 10;
  const currentPassengerPrice = passengerFairPrice !== undefined ? passengerFairPrice : 10;

  React.useEffect(() => {
    if (driverPrice === undefined) {
      onDriverPriceChange(10);
    }
  }, [driverPrice, onDriverPriceChange]);

  React.useEffect(() => {
    if (passengerFairPrice === undefined) {
      onPassengerFairPriceChange(10);
    }
  }, [passengerFairPrice, onPassengerFairPriceChange]);

  const isMoto = vehicleType === "MOTO";

  React.useEffect(() => {
    if (isMoto && availableSeats !== 1) {
      onAvailableSeatsChange(1);
    }
  }, [isMoto, availableSeats, onAvailableSeatsChange]);

  // Preço Motorista
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

  function handleDriverPricePreset(preset: number) {
    onDriverPriceChange(preset);
    setDriverRawCents(Math.round(preset * 100).toString());
  }

  const numericDriverPrice = driverRawCents ? parseInt(driverRawCents, 10) / 100 : 10;
  const isDriverPriceValid =
    numericDriverPrice >= MIN_DRIVER_PRICE && numericDriverPrice <= MAX_DRIVER_PRICE;
  const currentFee = isDriverPriceValid ? calculateCaronaaFee(numericDriverPrice) : 0;
  const currentNet = isDriverPriceValid ? calculateDriverNet(numericDriverPrice) : 0;

  // Preço Passageiro
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

  function handlePassengerPricePreset(preset: number) {
    onPassengerFairPriceChange(preset);
    setPassengerRawCents(Math.round(preset * 100).toString());
  }

  const numericPassengerPrice = passengerRawCents ? parseInt(passengerRawCents, 10) / 100 : 10;
  const isPassengerPriceValid =
    numericPassengerPrice >= MIN_PASSENGER_PRICE && numericPassengerPrice <= MAX_PASSENGER_PRICE;

  // Toggles
  function toggleTrust(id: TrustFactor) {
    if (trustFactors.includes(id)) {
      onTrustFactorsChange(trustFactors.filter((item) => item !== id));
      if (id === "MESMO_GENERO") {
        onGenderPreferenceChange(undefined as unknown as DriverGenderPreference);
      }
    } else {
      onTrustFactorsChange([...trustFactors, id]);
    }
  }

  // Validações por sub-etapa
  const canContinueSubStep1 =
    Boolean(dualPriority) && (dualPriority === "PEGAR" || (Boolean(vehicleType) && availableSeats !== undefined));
  const canContinueSubStep2 = true;
  const canContinueSubStep3 = isDriverPriceValid && isPassengerPriceValid;
  const canContinueSubStep4 = Boolean(driverRealValidation) || Boolean(passengerIntention);

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
      setSubStep((prev) => prev - 1);
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
            <ArrowRightLeft size={13} className="text-caronaa-primary" />
            Etapa {stepNumber} de {totalSteps} • Perfil Duplo ({subStep}/4)
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

        {/* SUBSTEP 1: Prioridade de hoje & Veículo */}
        {subStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Qual é a sua prioridade hoje?
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Você pode atuar como motorista ou passageiro dependendo das caronas disponíveis.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {priorityOptions.map((opt) => {
                const isSelected = dualPriority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDualPriorityChange(opt.value)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary shadow-sm"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <span className="text-2xl mb-1.5">{opt.icon}</span>
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{opt.description}</span>
                  </button>
                );
              })}
            </div>

            {dualPriority !== "PEGAR" && (
              <div className="space-y-3 border-t border-border pt-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Seu veículo disponível hoje
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {vehicleOptions.map((opt) => {
                    const isSelected = vehicleType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onVehicleTypeChange(opt.value)}
                        className={`flex flex-col items-center rounded-xl border p-2.5 text-center transition-all ${
                          isSelected
                            ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary font-medium shadow-sm"
                            : "border-border bg-card hover:border-caronaa-primary/40"
                        }`}
                      >
                        <span className="text-xl mb-1">{opt.icon}</span>
                        <span className="text-xs font-semibold">{opt.title}</span>
                      </button>
                    );
                  })}
                </div>

                {vehicleType && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <label className="text-xs font-semibold text-foreground">
                      Vagas disponíveis no veículo:
                    </label>
                    {isMoto ? (
                      <p className="mt-1 text-xs font-semibold text-caronaa-primary">
                        🏍️ 1 vaga exclusiva para passageiro com capacete
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {seatOptions.map((seats) => (
                          <button
                            key={seats}
                            type="button"
                            onClick={() => onAvailableSeatsChange(seats)}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                              availableSeats === seats
                                ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark ring-2 ring-caronaa-primary"
                                : "border-border bg-background hover:border-caronaa-primary/50"
                            }`}
                          >
                            {seats}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SUBSTEP 2: Fatores de Confiança & Segurança */}
        {subStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                O que te dá mais segurança e confiança?
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Selecione os fatores mais importantes para você em uma carona no evento.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sharedTrustOptions.map((opt) => {
                const isSelected = trustFactors.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleTrust(opt.id)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-tight">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {trustFactors.includes("MESMO_GENERO") && (
              <div className="rounded-xl border border-caronaa-primary/30 bg-caronaa-primary/5 p-3">
                <label className="text-xs font-semibold text-foreground">
                  Qual é a sua preferência de gênero?
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onGenderPreferenceChange("MULHERES")}
                    className={`rounded-lg border p-2 text-xs font-medium transition-all ${
                      genderPreference === "MULHERES"
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark font-bold"
                        : "border-border bg-background"
                    }`}
                  >
                    Apenas mulheres
                  </button>
                  <button
                    type="button"
                    onClick={() => onGenderPreferenceChange("HOMENS")}
                    className={`rounded-lg border p-2 text-xs font-medium transition-all ${
                      genderPreference === "HOMENS"
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark font-bold"
                        : "border-border bg-background"
                    }`}
                  >
                    Apenas homens
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBSTEP 3: Compensação & Contribuição Justa */}
        {subStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Compensação justa por passageiro
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                A CARONAA sugere valores justos para ajuda de custo em combustível e trajeto.
              </p>
            </div>

            <div className="rounded-2xl border border-caronaa-primary/30 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Valor sugerido</span>
                  <div className="text-2xl font-black text-caronaa-dark dark:text-caronaa-primary">
                    R$ {numericDriverPrice.toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {pricePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        handleDriverPricePreset(preset);
                        handlePassengerPricePreset(preset);
                      }}
                      className={`h-8 px-2.5 rounded-lg border text-xs font-bold transition-all ${
                        numericDriverPrice === preset
                          ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      R$ {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Taxa da plataforma (15%):</span>
                  <p className="font-semibold text-foreground">
                    R$ {currentFee.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Repasse ao motorista:</span>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    R$ {currentNet.toFixed(2).replace(".", ",")}
                  </p>
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

        {/* SUBSTEP 4: Validação Real para Hoje */}
        {subStep === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Validação real para o Siará Tech Summit
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Se encontrarmos alguém compatível na saída do evento hoje, você aceitaria?
              </p>
            </div>

            <div className="space-y-2">
              {driverRealValidationOptions.map((opt) => {
                const isSelected = driverRealValidation === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onDriverRealValidationChange(opt.value)}
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
