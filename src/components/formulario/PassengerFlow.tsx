import React from "react";
import { Sparkles, Check, ShieldAlert, Info, Lock } from "lucide-react";
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

const transportOptions: Array<{
  value: string;
  icon: string;
  label: string;
}> = [
  { value: "UBER_99", icon: "🚗", label: "Aplicativos (Uber / 99)" },
  { value: "ONIBUS", icon: "🚌", label: "Ônibus convencional" },
  { value: "METRO_VLT", icon: "🚆", label: "Metrô / VLT" },
  { value: "CARRO_PROPRIO", icon: "🚘", label: "Carro próprio" },
  { value: "MOTO_PROPRIA", icon: "🏍️", label: "Moto própria" },
  { value: "CARONA", icon: "👥", label: "Carona com colegas" },
  { value: "COMBINACAO", icon: "🔄", label: "Combinação de transportes" },
  { value: "OUTRO", icon: "📍", label: "Outro modo" },
];

const difficultyOptions: Array<{
  id: string;
  label: string;
}> = [
  {
    id: "DOR_01",
    label: "Dificuldade de encontrar transporte rápido e direto para essa rota.",
  },
  {
    id: "DOR_02",
    label: "Transporte público lotado ou desconfortável nos horários de pico.",
  },
  {
    id: "DOR_03",
    label: "Preços muito elevados de corridas por aplicativo na saída do evento.",
  },
  {
    id: "DOR_04",
    label: "Demora excessiva para voltar para casa após palestras e oficinas.",
  },
  {
    id: "DOR_06",
    label: "Receio de segurança ao combinar viagens com pessoas desconhecidas.",
  },
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
    description: "Identidade transparente e dados básicos do condutor checados.",
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

const barrierOptions: Array<{
  id: string;
  label: string;
}> = [
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
  stepNumber = 3,
  totalSteps = 4,
}: PassengerFlowProps) {
  // Controle de preço em BRL
  const currentPrice = passengerFairPrice !== undefined ? passengerFairPrice : 10;
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

  const numericPrice = rawCents ? parseInt(rawCents, 10) / 100 : 0;
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

  // Validações de campos "Outro" obrigatórios
  const isTransportCustomValid =
    !passengerTransports.includes("OUTRO") || Boolean(passengerTransportsCustom?.trim());
  const isDifficultyCustomValid =
    !passengerDifficulties.includes("OUTRA") || Boolean(passengerDifficultiesCustom?.trim());
  const isBarrierCustomValid =
    !passengerBarriers.includes("OUTRA") || Boolean(passengerBarriersCustom?.trim());

  const canContinue =
    passengerTransports.length > 0 &&
    isTransportCustomValid &&
    passengerDifficulties.length > 0 &&
    isDifficultyCustomValid &&
    isPriceValid &&
    isBarrierCustomValid &&
    Boolean(passengerIntention);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      {/* Header com badge */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-bold text-caronaa-dark dark:text-caronaa-primary">
            Etapa {stepNumber} de {totalSteps} • Necessidade de Carona
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles size={13} />
            Perfil do passageiro
          </span>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
          Como a CARONAA pode ajudar no seu caminho?
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Compartilhe como você se desloca hoje, suas dificuldades e o que torna uma carona justa e
          confiável.
        </p>
      </div>

      {/* ITEM 1 — COMO SE DESLOCA HOJE */}
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            1. Como você costuma se deslocar hoje para trajetos como esse? *
          </label>
          <p className="text-xs text-muted-foreground">
            Selecione todos os modos que você utiliza no dia a dia ou em grandes eventos (múltipla
            escolha).
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {transportOptions.map((opt) => {
            const isChecked = passengerTransports.includes(opt.value);

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleTransport(opt.value)}
                className={[
                  "flex items-center justify-between rounded-xl border p-3.5 text-left transition",
                  isChecked
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-1 ring-caronaa-primary/30 shadow-xs"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">{opt.icon}</span>
                  <span className="font-bold text-xs sm:text-sm text-foreground">{opt.label}</span>
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

        {/* INPUT OBRIGATÓRIO SE "OUTRO" MARCADO */}
        {passengerTransports.includes("OUTRO") && (
          <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
            <label className="text-xs font-bold text-foreground block">
              Especifique seu modo de transporte atual: *
            </label>
            <input
              type="text"
              value={passengerTransportsCustom}
              onChange={(e) => onPassengerTransportsCustomChange(e.target.value)}
              placeholder="Ex.: Bicicleta, van fretada, carona com família..."
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>
        )}
      </div>

      {/* ITEM 2 — MAIOR DIFICULDADE */}
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            2. Quais as maiores dificuldades que você enfrenta no deslocamento? *
          </label>
          <p className="text-xs text-muted-foreground">
            Selecione todas as opções que mais pesam na sua rotina (múltipla escolha).
          </p>
        </div>

        <div className="grid gap-2.5">
          {difficultyOptions.map((opt) => {
            const isChecked = passengerDifficulties.includes(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleDifficulty(opt.id)}
                className={[
                  "flex items-center justify-between rounded-xl border p-3.5 text-left transition",
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

        {/* INPUT OBRIGATÓRIO SE "OUTRA" MARCADA */}
        {passengerDifficulties.includes("OUTRA") && (
          <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
            <label className="text-xs font-bold text-foreground block">
              Descreva sua principal dificuldade: *
            </label>
            <input
              type="text"
              value={passengerDifficultiesCustom}
              onChange={(e) => onPassengerDifficultiesCustomChange(e.target.value)}
              placeholder="Ex.: Falta de linhas diretas para a minha região à noite..."
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>
        )}
      </div>

      {/* ITEM 3 — CONFIANÇA */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            3. O que traria confiança para você pegar uma carona?
          </label>
          <p className="text-xs text-muted-foreground">
            Selecione os fatores que deixariam sua viagem mais tranquila (múltipla escolha).
          </p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {trustFactorOptions.map((opt) => {
            const isChecked = passengerTrustFactors.includes(opt.id);

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

        {/* PREFERÊNCIA DE GÊNERO CONDICIONAL */}
        {passengerTrustFactors.includes("MESMO_GENERO") && (
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
                    onClick={() => onPassengerGenderPreferenceChange(g.value)}
                    className={[
                      "rounded-xl border p-2.5 text-xs font-bold transition text-center",
                      passengerGenderPreference === g.value
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
                <strong>Dado pessoal protegido:</strong> Esta preferência é tratada como dado
                pessoal confidencial, não é divulgada publicamente e visa apenas seu conforto
                pessoal.
              </p>
            </div>
          </div>
        )}

        {/* AVISO IMPORTANTE DE SEGURANÇA SOBRE AVALIAÇÕES */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs sm:text-sm">
            <ShieldAlert size={17} className="text-amber-600 dark:text-amber-400 shrink-0" />
            Aviso de transparência e segurança
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
            Novos participantes podem não ter avaliações prévias na plataforma, e avaliações
            positivas não constituem garantia absoluta de segurança. Sempre embarque nos pontos de
            encontro oficiais sinalizados e compartilhe sua viagem com amigos ou familiares.
          </p>
        </div>
      </div>

      {/* ITEM 4 — VALOR JUSTO A PAGAR */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            4. Quanto você consideraria justo pagar pelo trajeto? *
          </label>
          <p className="text-xs text-muted-foreground">
            Defina o valor por assento (mínimo de R$ 3,50 e máximo de R$ 25,00).
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
              {numericPrice < MIN_PASSENGER_PRICE
                ? `O valor mínimo permitido é de R$ ${MIN_PASSENGER_PRICE.toFixed(2).replace(".", ",")}.`
                : `O valor máximo permitido é de R$ ${MAX_PASSENGER_PRICE.toFixed(2).replace(".", ",")}.`}
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

        {/* Texto explicativo obrigatório */}
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/20 p-3 flex items-start gap-2">
          <Info size={15} className="text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            R$ 3,50 é nossa referência mínima para validação e o valor final pode variar conforme o
            percurso, distância e ponto de encontro combinado com quem oferece.
          </p>
        </div>
      </div>

      {/* ITEM 5 — BARREIRAS */}
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            5. O que mais te faria hesitar em pegar uma carona?
          </label>
          <p className="text-xs text-muted-foreground">
            Selecione todas as barreiras ou receios que você possui (múltipla escolha).
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {barrierOptions.map((opt) => {
            const isChecked = passengerBarriers.includes(opt.id);

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

        {/* INPUT DE TEXTO OBRIGATÓRIO SE "OUTRA QUESTÃO" MARCADA */}
        {passengerBarriers.includes("OUTRA") && (
          <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
            <label className="text-xs font-bold text-foreground block">
              Descreva sua principal dúvida ou questão: *
            </label>
            <textarea
              rows={3}
              value={passengerBarriersCustom}
              onChange={(e) => onPassengerBarriersCustomChange(e.target.value)}
              placeholder="Ex.: Tenho receio de atrasos no ponto de encontro ou de cancelamento em cima da hora..."
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition focus:border-caronaa-primary focus:ring-2 focus:ring-caronaa-primary/20"
            />
          </div>
        )}
      </div>

      {/* ITEM 6 — INTENÇÃO */}
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            6. Se houver alguém compatível com o seu trajeto hoje, você pegaria essa carona? *
          </label>
          <p className="text-xs text-muted-foreground">
            Estamos testando essa ideia agora durante o Siará Tech Summit para mapear o interesse
            real, sem afirmar que haverá carona ou combinação garantida.
          </p>
        </div>

        <div
          className="grid gap-2.5 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Intenção do passageiro"
        >
          {intentionOptions.map((opt) => {
            const isSelected = passengerIntention === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onPassengerIntentionChange(opt.value)}
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
