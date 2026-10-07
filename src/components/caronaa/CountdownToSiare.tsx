// @ts-nocheck -- legacy typing mismatches with generated database types; fix incrementally
import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const FORTALEZA_TIMEZONE = "America/Fortaleza";

/**
 * Data oficial do evento no fuso horário America/Fortaleza:
 * Início: 07 de outubro de 2026 às 14:00 (UTC-3)
 * Término: 09 de outubro de 2026 às 22:00 (UTC-3)
 */
export const STS_START_ISO = "2026-10-07T14:00:00-03:00";
export const STS_END_ISO = "2026-10-09T22:00:00-03:00";

export type CountdownStatus = "before" | "started" | "during" | "after";

export interface CountdownState {
  status: CountdownStatus;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  diffMs: number;
}

/**
 * Converte qualquer representação de data para milissegundos UTC absolutos.
 */
function toEpochMs(input: Date | number | string): number {
  if (typeof input === "number") return input;
  if (input instanceof Date) return input.getTime();
  return Date.parse(input);
}

/**
 * Calcula o estado determinístico do contador de acordo com a data/hora e o timezone do evento.
 */
export function getCountdownState(
  nowInput: Date | number | string = new Date(),
  options?: {
    startDate?: Date | number | string;
    endDate?: Date | number | string;
    startThresholdMinutes?: number;
  },
): CountdownState {
  const nowMs = toEpochMs(nowInput);
  const startMs = toEpochMs(options?.startDate ?? STS_START_ISO);
  const endMs = toEpochMs(options?.endDate ?? STS_END_ISO);
  const startThresholdMs = (options?.startThresholdMinutes ?? 60) * 60 * 1000;

  // 1. Antes do evento: countdown positivo em execução
  if (nowMs < startMs) {
    const diffMs = startMs - nowMs;
    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return {
      status: "before",
      days,
      hours,
      minutes,
      seconds,
      diffMs,
    };
  }

  // 2. Exatamente no momento do início (ou janela inaugural do evento)
  if (nowMs === startMs || (nowMs >= startMs && nowMs < startMs + startThresholdMs)) {
    return {
      status: "started",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      diffMs: 0,
    };
  }

  // 3. Durante os dias do evento (após a janela inaugural até o encerramento)
  if (nowMs <= endMs) {
    return {
      status: "during",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      diffMs: 0,
    };
  }

  // 4. Após o encerramento do evento: nunca mostra countdown negativo
  return {
    status: "after",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    diffMs: 0,
  };
}

export interface CountdownToSiareProps {
  className?: string;
  now?: Date | number | string;
  startDate?: Date | number | string;
  endDate?: Date | number | string;
  timezone?: string;
}

export function CountdownToSiare({
  className,
  now: customNow,
  startDate = STS_START_ISO,
  endDate = STS_END_ISO,
}: CountdownToSiareProps) {
  const [mounted, setMounted] = useState(false);
  const [currentNow, setCurrentNow] = useState<Date | number | string>(customNow ?? new Date());

  useEffect(() => {
    setMounted(true);

    // Se uma data fixa não foi passada via prop, atualiza o relógio a cada segundo
    if (!customNow) {
      const interval = setInterval(() => {
        setCurrentNow(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [customNow]);

  // Se 'customNow' for fornecido (ex.: testes ou SSR com horário mockado), renderiza imediatamente
  const effectiveNow = customNow ?? currentNow;
  const state = getCountdownState(effectiveNow, { startDate, endDate });

  if (!mounted && !customNow) {
    // Evita dessincronização de hidratação SSR inicial no cliente
    return null;
  }

  // CENÁRIO 1: NO MOMENTO DO INÍCIO
  if (state.status === "started") {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-event-cyan/40 bg-caronaa-dark/95 p-4 text-white shadow-soft backdrop-blur-md",
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-3 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-event-cyan opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-event-cyan" />
          </span>
          <span className="font-extrabold text-base sm:text-lg text-event-cyan">
            🚀 O Siará Tech Summit começou!
          </span>
        </div>

        <Button
          asChild
          size="sm"
          variant="strong"
          className="rounded-xl font-bold w-full sm:w-auto"
        >
<StsFormLink to="/formulario">
            Garantir carona <ArrowRight size={14} />
          </StsFormLink>
        </Button>
      </div>
    );
  }

  // CENÁRIO 2: DURANTE OS DIAS DO EVENTO
  if (state.status === "during") {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row items-center justify-between gap-3.5 rounded-2xl border border-event-cyan/30 bg-caronaa-dark/90 p-4 sm:p-5 text-white shadow-soft backdrop-blur-md",
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-event-cyan opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-event-cyan" />
          </span>
          <div>
            <p className="font-extrabold text-base sm:text-lg text-white">
              🚀 Estamos no Siará Tech Summit
            </p>
            <p className="text-xs text-white/70">
              Conecte-se com participantes e compartilhe caronas no evento.
            </p>
          </div>
        </div>

        <Button
          asChild
          size="default"
          variant="strong"
          className="rounded-xl font-bold w-full sm:w-auto"
        >
<StsFormLink to="/formulario">
            Participar do formulário <ArrowRight size={16} />
          </StsFormLink>
        </Button>
      </div>
    );
  }

  // CENÁRIO 3: APÓS O EVENTO (nunca mostra countdown negativo)
  if (state.status === "after") {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 text-center sm:text-left shadow-soft",
          className,
        )}
      >
        <div className="space-y-1">
          <p className="font-bold text-base text-foreground">
            Obrigado por fazer parte do começo da CARONAA.
          </p>
          <p className="text-xs text-muted-foreground">
            A validação no Siará Tech Summit 2026 foi um marco importante da nossa jornada.
          </p>
        </div>

        <Button
          asChild
          size="default"
          variant="strong"
          className="rounded-xl font-bold w-full sm:w-auto"
        >
          <Link to="/home">
            Continuar na CARONAA <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    );
  }

  // CENÁRIO 4: ANTES DO EVENTO (Contagem regressiva DD, HH, MM, SS)
  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        <CalendarDays size={14} className="text-caronaa-primary" aria-hidden="true" />
        <span>Faltam</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "DD", fullLabel: "dias", value: state.days },
          { label: "HH", fullLabel: "horas", value: state.hours },
          { label: "MM", fullLabel: "minutos", value: state.minutes },
          { label: "SS", fullLabel: "segundos", value: state.seconds },
        ].map(({ label, fullLabel, value }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card/90 px-2 py-3 text-center shadow-2xs backdrop-blur-xs sm:px-4 sm:py-3.5"
          >
            <span className="font-display text-2xl font-black text-foreground sm:text-3xl tabular-nums">
              {String(value).padStart(2, "0")}
            </span>
            <span className="mt-0.5 text-[10px] font-bold tracking-wider text-caronaa-primary-strong uppercase sm:text-[11px]">
              {label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-muted-foreground text-center sm:text-left">
        para o Siará Tech Summit
      </p>
    </div>
  );
}

// Alias de compatibilidade
export { CountdownToSiare as CountdownToSiara };
import { StsFormLink } from "@/components/caronaa/StsFormLink";
