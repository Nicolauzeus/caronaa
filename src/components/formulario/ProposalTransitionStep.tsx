import React from "react";
import { Sparkles, Info, Check } from "lucide-react";
import type { CaronaaIntent, ProposalSense } from "@/lib/formulario/types";

interface ProposalTransitionStepProps {
  intent?: CaronaaIntent | undefined;
  proposalSense?: ProposalSense | undefined;
  onProposalSenseChange: (value: ProposalSense) => void;
  onNext: () => void;
  onBack: () => void;
  stepNumber?: number;
  totalSteps?: number;
}

const proposalSenseOptions: Array<{
  value: ProposalSense;
  label: string;
  emoji: string;
  description: string;
}> = [
  {
    value: "POUCO",
    label: "Pouco",
    emoji: "🤔",
    description: "Ainda tenho dúvidas ou não vejo tanta utilidade para meu dia a dia.",
  },
  {
    value: "MEDIO",
    label: "Médio",
    emoji: "🙂",
    description: "Pode ser interessante dependendo do trajeto e das condições.",
  },
  {
    value: "ALTO",
    label: "Alto",
    emoji: "💡",
    description: "Faz bastante sentido e resolveria parte do meu deslocamento.",
  },
  {
    value: "ALTISSIMO",
    label: "Altíssimo",
    emoji: "🔥",
    description: "Faz total sentido, usaria com frequência e quero muito testar.",
  },
];

export function ProposalTransitionStep({
  intent,
  proposalSense,
  onProposalSenseChange,
  onNext,
  onBack,
  stepNumber = 3,
  totalSteps = 5,
}: ProposalTransitionStepProps) {
  const isDriver = intent === "MOTORISTA";
  const isPassenger = intent === "PASSAGEIRO";

  const canContinue = Boolean(proposalSense);

  return (
    <div className="flex h-full w-full flex-col justify-between">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
        {/* Header com badge de progresso */}
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-semibold text-caronaa-dark dark:text-caronaa-primary">
          <Sparkles size={13} className="text-caronaa-primary" />
          Etapa {stepNumber} de {totalSteps} • Proposta CARONAA
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
              {isDriver
                ? "Como funciona para quem oferece carona"
                : isPassenger
                  ? "Como funciona para quem precisa de carona"
                  : "Como funciona a mobilidade compartilhada"}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Conheça os princípios da proposta que estamos validando para o Siará Tech Summit.
            </p>
          </div>

          {/* Card explicativo */}
          <div className="rounded-2xl border border-border bg-card/60 p-3.5 sm:p-4">
            {isDriver ? (
              <div className="flex items-start gap-2.5">
                <span className="text-xl">🚗</span>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-foreground text-xs sm:text-sm">
                    Receba pelo compartilhamento do trajeto
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    Você já vai fazer o trajeto com seu veículo saindo do evento. Receba uma ajuda de custo justa por passageiro para dividir os custos de combustível.
                  </p>
                </div>
              </div>
            ) : isPassenger ? (
              <div className="flex items-start gap-2.5">
                <span className="text-xl">🙋</span>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-foreground text-xs sm:text-sm">
                    Conecte-se com quem já vai pelo mesmo caminho
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    Em vez de esperar por aplicativos caros na saída, divida a viagem com participantes do evento com segurança e valor acessível.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5">
                <span className="text-xl">🔄</span>
                <div className="space-y-0.5">
                  <h3 className="font-bold text-foreground text-xs sm:text-sm">
                    Mobilidade colaborativa de ponta a ponta
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    Motoristas recebem compensação justa e passageiros voltam com conforto e economia.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pergunta de Sentido */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Quanto essa proposta faz sentido para você? *
            </label>

            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label="Quanto essa proposta faz sentido para você"
            >
              {proposalSenseOptions.map((opt) => {
                const isSelected = proposalSense === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onProposalSenseChange(opt.value)}
                    className={`flex flex-col items-center rounded-xl border p-2.5 text-center transition-all ${
                      isSelected
                        ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary font-bold shadow-xs"
                        : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <span className="text-xl mb-1">{opt.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Static/Pinned Bottom Navigation */}
      <div className="shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!canContinue}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-caronaa-primary px-7 py-2.5 text-sm font-bold text-caronaa-dark shadow-md transition hover:bg-caronaa-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
