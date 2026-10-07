import React from "react";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";
import { cn } from "@/lib/utils";

export interface InstitutionalHeaderProps {
  /**
   * Estilo visual do header institucional:
   * - "light": fundo claro padrão do app shell
   * - "dark": fundo escuro para contrastes elevados e hero
   * - "sticky": barra fixa com indicador de progresso
   */
  variant?: "light" | "dark" | "sticky";
  className?: string;
  showProgress?: boolean;
  progress?: number;
  currentStep?: number;
  totalSteps?: number;
  isFinalStep?: boolean;
}

export function InstitutionalHeader({
  variant = "light",
  className,
  showProgress = false,
  progress = 0,
  currentStep,
  totalSteps = 6,
  isFinalStep = false,
}: InstitutionalHeaderProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={cn(
        "w-full transition-colors",
        variant === "sticky"
          ? "sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md"
          : isDark
            ? "border-b border-white/10 bg-[#0b0f19]/90 text-white backdrop-blur-md"
            : "border-b border-border bg-background/95 text-foreground",
        className,
      )}
      aria-label="Identificação institucional CARONAA e Siará Tech Summit 2026"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-8">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* HIERARQUIA DE MARCAS:
              1. CARONAA = Marca Principal
              2. Siará Tech Summit = Contexto do evento
              3. Unifor Hub = Ecossistema da startup
              4. Sebrae = Apoio / Realização do evento
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* 1. CARONAA — Marca Principal com logo discreto */}
            <div className="flex items-center gap-2">
              <img
                src={logoAsset.url}
                alt="CARONAA"
                className={cn(
                  "h-7 sm:h-8 w-auto object-contain transition-transform hover:scale-102",
                  isDark ? "brightness-105" : "",
                )}
              />
              <span className="sr-only">CARONAA</span>
            </div>

            {/* Divisor vertical discreto */}
            <div
              className={cn("hidden h-4 w-px sm:block", isDark ? "bg-white/15" : "bg-border/80")}
              aria-hidden="true"
            />

            {/* Badges Institucionais com hierarquia clara */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {/* Unifor Hub — Ecossistema da startup */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium tracking-tight shadow-2xs transition-colors",
                  isDark
                    ? "border border-white/10 bg-white/5 text-white/90"
                    : "border border-border/80 bg-secondary/80 text-foreground/90",
                )}
                title="A CARONAA é uma startup acelerada/residente no ecossistema do Unifor Hub"
              >
                <span
                  className="size-1.5 rounded-full bg-caronaa-primary shrink-0"
                  aria-hidden="true"
                />
                <span>Startup do Unifor Hub</span>
              </span>

              {/* Siará Tech Summit 2026 — Contexto do evento (com acentos Ciano + Magenta) */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold tracking-tight shadow-2xs transition-colors",
                  isDark
                    ? "border border-white/20 bg-white/5 text-white"
                    : "border border-border bg-secondary text-foreground",
                )}
                title="Participação oficial como startup expositora no Siará Tech Summit 2026"
              >
                {/* Micro-ponto de pulsação tecnológica com acento magenta e ciano */}
                <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
                  <span className="relative inline-flex size-1.5 rounded-full bg-caronaa-primary" />
                </span>
                <span>Expositora no Siará Tech Summit 2026</span>
              </span>

              {/* Sebrae — Realização do evento (apoio sem subordinação da startup) */}
              <span
                className={cn(
                  "inline-flex items-center text-[10px] font-medium opacity-70",
                  isDark ? "text-white/60" : "text-muted-foreground",
                )}
                title="Evento realizado pelo Sebrae Ceará"
              >
                • Realização Sebrae
              </span>
            </div>
          </div>

          {/* Barra e status de progresso quando solicitados (durante o preenchimento) */}
          {showProgress && (
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-0.5 sm:pt-0">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {progress}% concluído • Etapa{" "}
                {isFinalStep
                  ? `Final (${totalSteps}/${totalSteps})`
                  : `${currentStep ?? 1} de ${totalSteps}`}
              </span>

              {/* Barra de progresso com identidade CARONAA (amarelo/laranja) e acento ciano na terminação */}
              <div className="sr-only">
                <div
                  className="h-full bg-caronaa-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-label="Progresso do formulário"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linha de acento sutil do evento na borda inferior:
          Domínio do amarelo CARONAA na base, com sutis toques de ciano e magenta do STS
      */}
      <div className="h-1 w-full bg-muted" aria-hidden="true">
        <div className="h-full bg-caronaa-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: showProgress ? `${progress}%` : "100%" }} />
      </div>
    </header>
  );
}
