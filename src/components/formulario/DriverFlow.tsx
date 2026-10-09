import React from "react";
import { Check, AlertTriangle, Sparkles, Info } from "lucide-react";
import type {
  DriverFutureOffer,
  DriverGenderPreference,
  DriverRealValidation,
  VehicleType,
} from "@/lib/formulario/types";
import {
  calculateCaronaaFee,
  calculateDriverNet,
  MIN_DRIVER_PRICE,
} from "@/lib/formulario/pricing";

const MAX_DRIVER_PRICE = 25.0;

type DriverFlowProps = {
  vehicleType?: VehicleType | undefined;
  availableSeats?: number | undefined;
  driverFutureOffer?: DriverFutureOffer | undefined;
  driverComfortFactors?: string[] | undefined;
  driverGenderPreference?: DriverGenderPreference | undefined;
  driverPrice?: number | undefined;
  driverBarriers?: string[] | undefined;
  driverBarriersCustom?: string | undefined;
  driverRealValidation?: DriverRealValidation | undefined;

  onVehicleTypeChange: (value: VehicleType) => void;
  onAvailableSeatsChange: (value: number) => void;
  onDriverFutureOfferChange: (value: DriverFutureOffer) => void;
  onDriverComfortFactorsChange: (value: string[]) => void;
  onDriverGenderPreferenceChange: (value: DriverGenderPreference) => void;
  onDriverPriceChange: (value: number) => void;
  onDriverBarriersChange: (value: string[]) => void;
  onDriverBarriersCustomChange: (value: string) => void;
  onDriverRealValidationChange: (value: DriverRealValidation) => void;

  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
};

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
    description: "Estou com meu próprio carro hoje.",
  },
  {
    value: "CARRO_COMPARTILHADO",
    icon: "🚙",
    title: "Carro da família",
    description: "Tenho acesso ao veículo e posso oferecer a carona.",
  },
  {
    value: "MOTO",
    icon: "🏍️",
    title: "Moto",
    description: "Estou de moto hoje.",
  },
];

const comfortFactorOptions: Array<{
  id: string;
  label: string;
  description: string;
}> = [
  {
    id: "IDENTIDADE_VERIFICADA",
    label: "Participante verificado",
    description: "Credencial ou perfil confirmado no evento Siará Tech Summit.",
  },
  {
    id: "CONHECER_ROTA",
    label: "Conhecer a rota antes",
    description: "Visualizar o trajeto exato e ponto de desembarque com antecedência.",
  },
  {
    id: "PONTO_ENCONTRO",
    label: "Ponto de encontro oficial",
    description: "Embarque em local sinalizado e movimentado dentro do Centro de Eventos.",
  },
  {
    id: "MESMO_GENERO",
    label: "Preferência por pessoas do mesmo gênero",
    description: "Filtro opcional para maior tranquilidade pessoal no compartilhamento.",
  },
  {
    id: "SEM_DESVIOS",
    label: "Sem desvios da rota",
    description: "Apenas passageiros cujo destino esteja diretamente no meu caminho.",
  },
  {
    id: "AVALIACOES",
    label: "Avaliações e referências",
    description: "Histórico prévio e notas de outros participantes da comunidade.",
  },
];

const barrierOptions: Array<{
  id: string;
  label: string;
}> = [
  { id: "DESVIOS", label: "Desvios demorados da minha rota original" },
  { id: "SEGURANCA", label: "Preocupação de segurança com pessoas desconhecidas" },
  { id: "ATRASOS", label: "Atrasos e pontualidade no ponto de encontro" },
  { id: "CONFORTO", label: "Espaço ou privacidade no veículo" },
  { id: "PAGAMENTO", label: "Dúvidas sobre o recebimento da compensação justa" },
  { id: "OUTRA", label: "Outra questão" },
];

const realValidationOptions: Array<{
  value: DriverRealValidation;
  label: string;
  description: string;
}> = [
  {
    value: "COM_CERTEZA",
    label: "Com certeza, posso oferecer.",
    description: "Tenho assentos disponíveis e gostaria de compartilhar meu trajeto.",
  },
  {
    value: "TALVEZ",
    label: "Talvez.",
    description: "Depende da rota exata, do horário de saída e de quem for o passageiro.",
  },
  {
    value: "APENAS_STS",
    label: "Sim, mas apenas durante o Siará Tech Summit.",
    description: "Disponível exclusivamente para este evento e saída do Centro de Eventos.",
  },
];

const pricePresets = [5, 10, 15, 20, 25];

export function DriverFlow({
  vehicleType,
  availableSeats,
  driverFutureOffer,
  driverComfortFactors = [],
  driverGenderPreference,
  driverPrice,
  driverBarriers = [],
  driverBarriersCustom,
  driverRealValidation,
  onVehicleTypeChange,
  onAvailableSeatsChange,
  onDriverFutureOfferChange,
  onDriverComfortFactorsChange,
  onDriverGenderPreferenceChange,
  onDriverPriceChange,
  onDriverBarriersChange,
  onDriverBarriersCustomChange,
  onDriverRealValidationChange,
  onNext,
  onBack,
  stepNumber = 4,
  totalSteps = 5,
}: DriverFlowProps) {
  const [subStep, setSubStep] = React.useState<number>(1);

  // Inicialização de preço padrão caso ainda não definido (R$ 10,00 padrão)
  const currentPrice = driverPrice !== undefined ? driverPrice : 10;
  const isMoto = vehicleType === "MOTO";
  const hasZeroSeats = availableSeats === 0;

  React.useEffect(() => {
    if (driverPrice === undefined) {
      onDriverPriceChange(10);
    }
  }, [driverPrice, onDriverPriceChange]);

  React.useEffect(() => {
    if (isMoto && availableSeats !== 1) {
      onAvailableSeatsChange(1);
    }
  }, [isMoto, availableSeats, onAvailableSeatsChange]);

  // Formatação de moeda BRL para exibição e input
  const [rawCents, setRawCents] = React.useState<string>(() =>
    Math.round(currentPrice * 100).toString(),
  );

  React.useEffect(() => {
    if (driverPrice !== undefined) {
      setRawCents(Math.round(driverPrice * 100).toString());
    }
  }, [driverPrice]);

  function handlePriceInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    setRawCents(digitsOnly);

    if (digitsOnly.length > 0) {
      const parsedNum = parseInt(digitsOnly, 10) / 100;
      onDriverPriceChange(parsedNum);
    }
  }

  function handlePricePreset(preset: number) {
    onDriverPriceChange(preset);
    setRawCents(Math.round(preset * 100).toString());
  }

  const numericPrice = rawCents ? parseInt(rawCents, 10) / 100 : 10;
  const isPriceValid = numericPrice >= MIN_DRIVER_PRICE && numericPrice <= MAX_DRIVER_PRICE;

  const currentFee = isPriceValid ? calculateCaronaaFee(numericPrice) : 0;
  const currentNet = isPriceValid ? calculateDriverNet(numericPrice) : 0;

  // Toggle helpers
  function toggleComfortFactor(id: string) {
    if (driverComfortFactors.includes(id)) {
      onDriverComfortFactorsChange(driverComfortFactors.filter((item) => item !== id));
      if (id === "MESMO_GENERO") {
        onDriverGenderPreferenceChange(undefined as unknown as DriverGenderPreference);
      }
    } else {
      onDriverComfortFactorsChange([...driverComfortFactors, id]);
    }
  }

  function toggleBarrier(id: string) {
    if (driverBarriers.includes(id)) {
      onDriverBarriersChange(driverBarriers.filter((item) => item !== id));
      if (id === "OUTRA") {
        onDriverBarriersCustomChange("");
      }
    } else {
      onDriverBarriersChange([...driverBarriers, id]);
    }
  }

  const isBarrierCustomNeeded = driverBarriers.includes("OUTRA");
  const isBarrierCustomValid = !isBarrierCustomNeeded || Boolean(driverBarriersCustom?.trim());

  // Validações por sub-etapa
  const canContinueSubStep1 = Boolean(vehicleType) && availableSeats !== undefined;
  const canContinueSubStep2 = true;
  const canContinueSubStep3 = isPriceValid;
  const canContinueSubStep4 = Boolean(driverRealValidation) && isBarrierCustomValid;

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
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
      {/* Header com badge */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-bold text-caronaa-dark dark:text-caronaa-primary">
            Etapa {stepNumber} de {totalSteps} • Oferta de Carona ({subStep}/4)
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles size={13} />
            Perfil do motorista
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
          {subStep === 1 && "Qual veículo você usará no evento?"}
          {subStep === 2 && "Fatores de conforto para você oferecer carona"}
          {subStep === 3 && "Compensação justa por passageiro"}
          {subStep === 4 && "Validação real para hoje"}
        </h2>

        <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {subStep === 1 && "Escolha o veículo e informe quantos lugares livres você terá disponíveis."}
          {subStep === 2 && "Selecione tudo o que traria mais tranquilidade para você levar alguém."}
          {subStep === 3 && "Defina a contribuição por assento. O valor sugerido de R$ 10,00 já vem pré-selecionado."}
          {subStep === 4 && "Sua resposta valida se você realmente toparia participar neste momento."}
        </p>
      </div>

      {/* SUB-ETAPA 1: VEÍCULO & VAGAS */}
      {subStep === 1 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-xs">
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">
                1. Qual veículo você usará no evento? *
              </label>
              <p className="text-xs text-muted-foreground">
                Escolha o veículo que você realmente terá disponível para sair do Centro de Eventos.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de veículo">
              {vehicleOptions.map((option) => {
                const selected = vehicleType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onVehicleTypeChange(option.value)}
                    className={[
                      "flex min-h-24 flex-col items-start rounded-xl border p-3.5 text-left transition relative",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caronaa-primary",
                      selected
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20 shadow-xs"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-2xl" aria-hidden="true">
                        {option.icon}
                      </span>
                      {selected && (
                        <span className="size-4 rounded-full bg-caronaa-primary flex items-center justify-center text-caronaa-dark shrink-0">
                          <Check size={11} className="stroke-[3]" />
                        </span>
                      )}
                    </div>

                    <span className="mt-2 text-xs sm:text-sm font-bold text-foreground">{option.title}</span>

                    <span className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {isMoto && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 space-y-1 mt-2">
                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold text-xs">
                  <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  Alerta de segurança e conformidade legal
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  Para carona de moto, é indispensável o uso obrigatório de capacete homologado para condutor e passageiro (CTB).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-xs">
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">
                2. Vagas disponíveis para oferecer: *
              </label>
              <p className="text-xs text-muted-foreground">
                {isMoto
                  ? "Para moto, é disponibilizada apenas 1 vaga (garupa)."
                  : "Selecione a quantidade de assentos livres que você toparia disponibilizar (0 a 10)."}
              </p>
            </div>

            {isMoto ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={true}
                  onClick={() => onAvailableSeatsChange(1)}
                  className="flex-1 min-h-11 rounded-xl border border-caronaa-primary bg-caronaa-primary text-caronaa-dark text-xs font-bold py-2.5 px-4 text-center transition"
                >
                  1 lugar disponível (garupa)
                </button>
              </div>
            ) : (
              <div
                className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 sm:gap-2"
                role="radiogroup"
                aria-label="Lugares disponíveis de 0 a 10"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seats) => {
                  const isSelected = availableSeats === seats;

                  return (
                    <button
                      key={seats}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onAvailableSeatsChange(seats)}
                      className={[
                        "min-h-11 rounded-xl border text-xs sm:text-sm font-extrabold transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caronaa-primary",
                        isSelected
                          ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark shadow-sm ring-2 ring-caronaa-primary/30"
                          : "border-border bg-card text-foreground hover:border-caronaa-primary/40 hover:bg-accent/40",
                      ].join(" ")}
                    >
                      {seats}
                    </button>
                  );
                })}
              </div>
            )}

            {hasZeroSeats && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 animate-in fade-in duration-200">
                <p className="text-xs font-semibold text-foreground">
                  Tudo bem! Mesmo sem lugares livres hoje, sua resposta nos ajuda a mapear os fluxos do evento.
                </p>
                <div className="space-y-1.5 pt-1 border-t border-border/60">
                  <label className="text-xs font-bold text-foreground block">
                    Poderia oferecer em outro momento?
                  </label>
                  <div className="flex gap-2">
                    {(["SIM", "TALVEZ", "NAO"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onDriverFutureOfferChange(opt)}
                        className={[
                          "flex-1 rounded-lg border py-1.5 text-xs font-bold transition",
                          driverFutureOffer === opt
                            ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                            : "border-border bg-card text-foreground hover:bg-accent/40",
                        ].join(" ")}
                      >
                        {opt === "SIM" ? "Sim" : opt === "TALVEZ" ? "Talvez" : "Não"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ETAPA 2: CONFORTO & PREFERÊNCIAS */}
      {subStep === 2 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-xs">
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">
                3. Fatores de conforto para você oferecer carona:
              </label>
              <p className="text-xs text-muted-foreground">
                Selecione tudo o que traria mais tranquilidade para você levar alguém (múltipla escolha).
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {comfortFactorOptions.map((opt) => {
                const isChecked = driverComfortFactors.includes(opt.id);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleComfortFactor(opt.id)}
                    className={[
                      "flex items-start justify-between rounded-xl border p-3 text-left transition",
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

            {driverComfortFactors.includes("MESMO_GENERO") && (
              <div className="rounded-xl border border-border bg-accent/20 p-3.5 space-y-2 animate-in fade-in duration-200 mt-2">
                <label className="text-xs font-bold text-foreground block">
                  Qual gênero você gostaria de considerar? (Opcional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: "FEMININO" as DriverGenderPreference, label: "Feminino" },
                    { value: "MASCULINO" as DriverGenderPreference, label: "Masculino" },
                    { value: "OUTRO" as DriverGenderPreference, label: "Outro / Sem preferência" },
                  ].map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => onDriverGenderPreferenceChange(g.value)}
                      className={[
                        "rounded-xl border p-2 text-xs font-bold transition text-center",
                        driverGenderPreference === g.value
                          ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                          : "border-border bg-card hover:bg-accent/40",
                      ].join(" ")}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ETAPA 3: COMPENSAÇÃO JUSTA */}
      {subStep === 3 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-xs">
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">
                4. Compensação justa por passageiro: *
              </label>
              <p className="text-xs text-muted-foreground">
                Defina o valor por assento compartilhado (mínimo de R$ 3,50 e máximo de R$ 25,00).
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-extrabold text-muted-foreground">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    numericPrice > 0
                      ? numericPrice.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : ""
                  }
                  onChange={handlePriceInputChange}
                  placeholder="10,00"
                  className="min-h-11 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base font-bold outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground">Sugestões:</span>
                {pricePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePricePreset(preset)}
                    className={[
                      "rounded-lg border px-2.5 py-1 text-xs font-bold transition",
                      numericPrice === preset
                        ? "border-caronaa-primary bg-caronaa-primary text-caronaa-dark"
                        : "border-border bg-card hover:bg-accent/40",
                    ].join(" ")}
                  >
                    R$ {preset.toFixed(2).replace(".", ",")}
                  </button>
                ))}
              </div>
            </div>

            {isPriceValid && (
              <div className="rounded-xl border border-border bg-accent/20 p-3 text-xs space-y-1.5 mt-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Compensação informada:</span>
                  <span className="font-bold text-foreground">
                    R$ {numericPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Taxa da plataforma (15% em validação):</span>
                  <span className="font-semibold text-muted-foreground">
                    - R$ {currentFee.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border font-bold text-sm text-foreground">
                  <span>Você recebe líquido por carona:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-base">
                    R$ {currentNet.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-muted-foreground/20 bg-muted/20 p-3 flex items-start gap-2 mt-2">
              <Info size={15} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                R$ 3,50 é nossa referência mínima para compensação e o valor final pode variar conforme o percurso. Não cobramos mensalidade: a taxa de serviço é de 15% apenas quando a carona acontece.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ETAPA 4: BARREIRAS & VALIDAÇÃO REAL */}
      {subStep === 4 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-xs">
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">
                5. O que mais te faria hesitar em oferecer uma carona?
              </label>
              <p className="text-xs text-muted-foreground">
                Selecione todas as barreiras ou receios que você possui (múltipla escolha).
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {barrierOptions.map((opt) => {
                const isChecked = driverBarriers.includes(opt.id);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleBarrier(opt.id)}
                    className={[
                      "flex items-center justify-between rounded-xl border p-2.5 text-left transition",
                      isChecked
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30 shadow-xs"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                    ].join(" ")}
                  >
                    <span className="font-semibold text-xs text-foreground pr-2">
                      {opt.label}
                    </span>
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
              <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
                <label className="text-xs font-bold text-foreground block">
                  Descreva sua principal dúvida ou questão: *
                </label>
                <textarea
                  rows={2}
                  value={driverBarriersCustom ?? ""}
                  onChange={(e) => onDriverBarriersCustomChange(e.target.value)}
                  placeholder="Ex.: Gostaria de saber mais sobre como funciona..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-xs">
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">
                6. Se houver alguém compatível com o seu trajeto hoje, você ofereceria carona? *
              </label>
              <p className="text-xs text-muted-foreground">
                Sua resposta valida se você realmente toparia participar neste momento.
              </p>
            </div>

            <div
              className="grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Validação real para oferecer carona"
            >
              {realValidationOptions.map((opt) => {
                const isSelected = driverRealValidation === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onDriverRealValidationChange(opt.value)}
                    className={[
                      "flex flex-col items-start rounded-xl border p-3 text-left transition relative",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caronaa-primary",
                      isSelected
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20 shadow-xs"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-bold text-xs text-foreground">{opt.label}</span>
                      {isSelected && (
                        <span className="size-4 rounded-full bg-caronaa-primary flex items-center justify-center text-caronaa-dark shrink-0">
                          <Check size={11} className="stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navegação fixa na base */}
      <div className="sts-navigation sticky bottom-0 z-20 mt-auto flex flex-col-reverse gap-3 border-t border-border bg-background/95 pt-4 pb-2 backdrop-blur-md sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={handleBackSubStep}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-2 text-sm font-semibold transition hover:bg-accent"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleNextSubStep}
          disabled={
            subStep === 1
              ? !canContinueSubStep1
              : subStep === 2
                ? !canContinueSubStep2
                : subStep === 3
                  ? !canContinueSubStep3
                  : !canContinueSubStep4
          }
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-caronaa-primary px-7 py-2 text-sm sm:text-base font-bold text-caronaa-dark transition hover:bg-caronaa-primary-strong shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {subStep === 4 ? "Avançar para contato" : "Continuar"}
        </button>
      </div>
    </section>
  );
}
