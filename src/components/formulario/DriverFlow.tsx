import React from "react";
import { Car, Check, AlertTriangle, ShieldCheck, Sparkles, Info, Lock, Bike } from "lucide-react";
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
  stepNumber = 3,
  totalSteps = 4,
}: DriverFlowProps) {
  // Inicialização de preço padrão caso ainda não definido
  const currentPrice = driverPrice !== undefined ? driverPrice : 10;
  const isMoto = vehicleType === "MOTO";
  const hasZeroSeats = availableSeats === 0;

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
    // Apenas números, sem negativos
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

  const numericPrice = rawCents ? parseInt(rawCents, 10) / 100 : 0;
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

  // Não bloquear avanço caso vagas seja 0
  const canContinue =
    Boolean(vehicleType) &&
    availableSeats !== undefined &&
    isPriceValid &&
    isBarrierCustomValid &&
    Boolean(driverRealValidation);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      {/* Header com badge */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-bold text-caronaa-dark dark:text-caronaa-primary">
            Etapa {stepNumber} de {totalSteps} • Oferta de Carona
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles size={13} />
            Perfil do motorista
          </span>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
          Como você poderia compartilhar lugares hoje?
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Preencha os detalhes reais sobre seu veículo, condições de conforto e compensação.
        </p>
      </div>

      {/* ITEM 1 — VEÍCULO */}
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
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
                  "flex min-h-28 flex-col items-start rounded-xl border p-4 text-left transition relative",
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

                <span className="mt-3 text-sm font-bold text-foreground">{option.title}</span>

                <span className="mt-1 text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* ALERTA OBRIGATÓRIO PARA MOTO */}
        {isMoto && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs sm:text-sm">
              <AlertTriangle size={17} className="text-amber-600 dark:text-amber-400 shrink-0" />
              Alerta de segurança e conformidade legal
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
              Para carona de moto, é indispensável o uso obrigatório de capacete homologado para
              condutor e passageiro, bem como o cumprimento integral de todas as exigências do
              Código de Trânsito Brasileiro (CTB).
            </p>
          </div>
        )}
      </div>

      {/* ITEM 2 — VAGAS DISPONÍVEIS (0 a 10) */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            2. Vagas disponíveis para oferecer: *
          </label>
          <p className="text-xs text-muted-foreground">
            Selecione a quantidade de assentos livres que você toparia disponibilizar (0 a 10).
          </p>
        </div>

        <div
          className="grid grid-cols-6 sm:grid-cols-11 gap-2"
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
                  "min-h-12 rounded-xl border text-sm font-extrabold transition",
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

        {/* FEEDBACK ACOLHEDOR SE VAGAS === 0 (NÃO BLOQUEIA AVANÇO) */}
        {hasZeroSeats && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-200">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                Tudo bem! Mesmo sem lugares livres hoje, sua resposta nos ajuda muito a mapear os
                fluxos do evento.
              </p>
              <p className="text-xs text-muted-foreground">
                Você pode continuar preenchendo normalmente.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block">
                Você poderia oferecer uma carona em outro momento?
              </label>
              <div className="flex gap-2">
                {(["SIM", "TALVEZ", "NAO"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onDriverFutureOfferChange(opt)}
                    className={[
                      "flex-1 rounded-xl border py-2 text-xs font-bold transition",
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

      {/* ITEM 3 — FATORES DE CONFORTO PARA OFERECER */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            3. Fatores de conforto para você oferecer carona:
          </label>
          <p className="text-xs text-muted-foreground">
            Selecione tudo o que traria mais tranquilidade para você levar alguém (múltipla
            escolha).
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {comfortFactorOptions.map((opt) => {
            const isChecked = driverComfortFactors.includes(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleComfortFactor(opt.id)}
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

        {/* SUB-QUESTÃO CONDICIONAL: PREFERÊNCIA POR GÊNERO */}
        {driverComfortFactors.includes("MESMO_GENERO") && (
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
                    onClick={() => onDriverGenderPreferenceChange(g.value)}
                    className={[
                      "rounded-xl border p-2.5 text-xs font-bold transition text-center",
                      driverGenderPreference === g.value
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
                <strong>Privacidade:</strong> Esta preferência é mantida sob sigilo absoluto. Não
                exclui automaticamente outros participantes de forma discriminatória nem é exibida
                publicamente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ITEM 4 — COMPENSAÇÃO JUSTA */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            4. Compensação justa por passageiro: *
          </label>
          <p className="text-xs text-muted-foreground">
            Defina o valor por assento compartilhado (mínimo de R$ 3,50 e máximo de R$ 25,00).
          </p>
        </div>

        {/* Input numérico formatado BRL */}
        <div className="space-y-2">
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
              placeholder="0,00"
              className={[
                "min-h-12 w-full rounded-xl border bg-background pl-11 pr-4 text-lg font-bold outline-none transition",
                isPriceValid
                  ? "border-border focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
                  : "border-destructive focus:ring-2 focus:ring-destructive/20",
              ].join(" ")}
            />
          </div>

          {!isPriceValid && numericPrice > 0 && (
            <p className="text-xs text-destructive font-medium">
              {numericPrice < MIN_DRIVER_PRICE
                ? `O valor mínimo permitido é de R$ ${MIN_DRIVER_PRICE.toFixed(2).replace(".", ",")}.`
                : `O valor máximo permitido é de R$ ${MAX_DRIVER_PRICE.toFixed(2).replace(".", ",")}.`}
            </p>
          )}

          {/* Presets rápidos */}
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

        {/* Demonstrativo da taxa da plataforma e valor líquido */}
        {isPriceValid && (
          <div className="rounded-xl border border-border bg-accent/20 p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Compensação informada:</span>
              <span className="font-bold text-foreground">
                R$ {numericPrice.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Taxa da plataforma (25% em validação):</span>
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

        {/* Texto explicativo obrigatório */}
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/20 p-3 flex items-start gap-2">
          <Info size={15} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            R$ 3,50 é nossa referência mínima para compensação e o valor final pode variar conforme
            o percurso e ponto de encontro. Não cobramos mensalidade: a taxa de serviço é de 25%
            apenas quando a carona acontece.
          </p>
        </div>
      </div>

      {/* ITEM 5 — BARREIRAS */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
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
                  "flex items-center justify-between rounded-xl border p-3 text-left transition",
                  isChecked
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30 shadow-xs"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span className="font-semibold text-xs sm:text-sm text-foreground pr-2">
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

        {/* INPUT DE TEXTO OBRIGATÓRIO SE "OUTRA QUESTÃO" ESTIVER MARCADA */}
        {driverBarriers.includes("OUTRA") && (
          <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
            <label className="text-xs font-bold text-foreground block">
              Descreva sua principal dúvida ou questão: *
            </label>
            <textarea
              rows={3}
              value={driverBarriersCustom ?? ""}
              onChange={(e) => onDriverBarriersCustomChange(e.target.value)}
              placeholder="Ex.: Gostaria de saber mais sobre como funciona caso o passageiro cancele em cima da hora..."
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>
        )}
      </div>

      {/* ITEM 6 — VALIDAÇÃO REAL */}
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            6. Se houver alguém compatível com o seu trajeto hoje, você ofereceria carona? *
          </label>
          <p className="text-xs text-muted-foreground">
            Sua resposta valida se você realmente toparia participar neste momento.
          </p>
        </div>

        <div
          className="grid gap-2.5 sm:grid-cols-3"
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
                  "flex flex-col items-start rounded-xl border p-3.5 text-left transition relative",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caronaa-primary",
                  isSelected
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20 shadow-xs"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-foreground">{opt.label}</span>
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

      {/* Navegação */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between pt-4 border-t border-border">
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
