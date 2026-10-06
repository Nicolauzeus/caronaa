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
  stepNumber = 2,
  totalSteps = 4,
}: ProposalTransitionStepProps) {
  const isDriver = intent === "MOTORISTA";
  const isPassenger = intent === "PASSAGEIRO";

  const canContinue = Boolean(proposalSense);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* Header com badge de progresso */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-caronaa-primary/30 bg-caronaa-primary/10 px-3 py-1 text-xs font-bold text-caronaa-dark dark:text-caronaa-primary">
            Etapa {stepNumber} de {totalSteps} • Proposta CARONAA
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles size={13} />
            Entendendo o modelo
          </span>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
          {isDriver
            ? "Como funciona para quem oferece carona"
            : isPassenger
              ? "Como funciona para quem precisa de carona"
              : "Como funciona a mobilidade compartilhada na CARONAA"}
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Conheça os princípios da proposta que estamos validando para o Siará Tech Summit.
        </p>
      </div>

      {/* BLOCO DE TRANSIÇÃO (NÃO é pergunta) com regras estritas de linguagem */}
      <div className="space-y-4">
        {isDriver && (
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚗</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Receba pelo compartilhamento do trajeto
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Você já vai fazer o trajeto com seu veículo saindo do Siará Tech Summit. Com a
                  CARONAA, receba pelo compartilhamento do trajeto e conte com uma compensação pelo
                  lugar compartilhado para ajudar nos custos do deslocamento.
                </p>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 flex items-start gap-3">
              <span className="text-2xl">🧪</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Estamos testando essa ideia agora
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Estamos testando essa ideia agora durante o evento para entender a adesão real de
                  motoristas e passageiros e desenhar uma solução prática para o ecossistema.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-start gap-2.5">
              <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <strong>Transparência:</strong> Sem prometer renda garantida, matching automático ou
                segurança absoluta. Nosso objetivo é construir e validar juntos conexões baseadas em
                caminhos compatíveis e confiança mútua.
              </p>
            </div>
          </div>
        )}

        {isPassenger && (
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🙋</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Conecte-se com quem já vai pelo mesmo caminho
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Em vez de lidar com longas esperas ou tarifas dinâmicas elevadas na saída,
                  encontre pessoas credenciadas que já vão na mesma direção e têm assentos
                  disponíveis no carro.
                </p>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 flex items-start gap-3">
              <span className="text-2xl">🤝</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Compensação pelo lugar compartilhado
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Você contribui com uma compensação pelo lugar compartilhado, dividindo os custos
                  de combustível de forma justa, acessível e combinada antecipadamente.
                </p>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 flex items-start gap-3">
              <span className="text-2xl">🧪</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Estamos testando essa ideia agora
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Estamos testando essa ideia agora no Siará Tech Summit para entender na prática a
                  demanda e os principais fluxos de mobilidade.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-start gap-2.5">
              <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <strong>Transparência:</strong> Sem falsas promessas de carona disponível garantida
                ou segurança absoluta. Queremos mapear o interesse real para estruturar rotas
                seguras e colaborativas.
              </p>
            </div>
          </div>
        )}

        {!isDriver && !isPassenger && (
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔄</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Mobilidade compartilhada de ponta a ponta
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Quem dirige recebe pelo compartilhamento do trajeto e quem precisa de transporte
                  contribui com uma compensação pelo lugar compartilhado, equilibrando custos e
                  otimizando deslocamentos.
                </p>
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 flex items-start gap-3">
              <span className="text-2xl">🧪</span>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  Estamos testando essa ideia agora
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Estamos testando essa ideia agora durante o Siará Tech Summit. Não prometemos
                  renda garantida, matching automático ou segurança absoluta, mas sim um formato
                  colaborativo e transparente.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PERGUNTA ESTRUTURADA (Item 2) */}
      <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <div className="space-y-1">
          <label className="text-base font-bold text-foreground">
            Quanto essa proposta faz sentido para você? *
          </label>
          <p className="text-xs text-muted-foreground">
            Sua resposta sincera nos ajuda a entender o valor real deste teste.
          </p>
        </div>

        <div
          className="grid gap-2.5 sm:grid-cols-2"
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
                className={[
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left transition relative",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caronaa-primary",
                  isSelected
                    ? "border-caronaa-primary bg-caronaa-primary/10 ring-2 ring-caronaa-primary/20 shadow-xs"
                    : "border-border bg-card hover:border-caronaa-primary/40 hover:bg-accent/40",
                ].join(" ")}
              >
                <span className="text-2xl shrink-0 mt-0.5">{opt.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">{opt.label}</span>
                    {isSelected && (
                      <span className="size-4 rounded-full bg-caronaa-primary flex items-center justify-center text-caronaa-dark shrink-0">
                        <Check size={11} className="stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </div>
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
