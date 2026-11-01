import { Clock3 } from "lucide-react";
import { getResearchCountdown } from "@/lib/research-countdown";

const CLOCK_RADIUS = 83;
const CLOCK_CIRCUMFERENCE = 2 * Math.PI * CLOCK_RADIUS;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * A circular, live display for one institutional launch.
 * The amber ring counts down the current minute; the center shows full days.
 * Access permissions are NOT inferred from this timer (the launch RPC decides).
 */
export function CircularLaunchCountdown({
  launchAt,
  now,
}: {
  launchAt: string;
  now: number;
}) {
  const remaining = getResearchCountdown(launchAt, now);

  if (!remaining) {
    return (
      <div role="status" className="rounded-2xl border border-white/15 bg-white/[.04] p-4 text-sm text-white/70">
        Consultando a data de lançamento…
      </div>
    );
  }

  const secondOnDial = remaining.totalSeconds === 0
    ? 0
    : ((remaining.totalSeconds - 1) % 60) + 1;
  const dashOffset = CLOCK_CIRCUMFERENCE * (1 - secondOnDial / 60);
  const countdownLabel = remaining.totalSeconds === 0
    ? "Horário previsto alcançado. Aguardando a confirmação da liberação."
    : `Faltam ${remaining.days} dias, ${remaining.hours} horas, ${remaining.minutes} minutos e ${remaining.seconds} segundos para a abertura.`;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={countdownLabel}
      className="flex items-center gap-3 rounded-2xl border border-[#ffc451]/30 bg-[#0b0b0b] px-3 py-3 sm:gap-5 sm:px-5 sm:py-4"
    >
      <div className="relative grid h-[132px] w-[132px] shrink-0 place-items-center sm:h-40 sm:w-40">
        <div className="absolute inset-0 rounded-full bg-[#ffc451]/[.05] blur-lg" aria-hidden="true" />
        <svg
          viewBox="0 0 200 200"
          className="relative h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r={CLOCK_RADIUS} stroke="rgba(255,255,255,0.16)" strokeWidth="8" fill="none" />
          <circle
            cx="100"
            cy="100"
            r={CLOCK_RADIUS}
            stroke="#ffbb00"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CLOCK_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            fill="none"
            className="drop-shadow-[0_0_8px_rgba(255,187,0,0.35)]"
          />
          <circle cx="100" cy="100" r="68" stroke="rgba(255,255,255,0.11)" strokeWidth="1" fill="none" />
          {Array.from({ length: 12 }, (_, index) => {
            const radians = (index * 2 * Math.PI) / 12;
            return (
              <circle
                key={index}
                cx={100 + 67 * Math.cos(radians)}
                cy={100 + 67 * Math.sin(radians)}
                r={index % 3 === 0 ? 2 : 1.3}
                fill="rgba(255,255,255,0.38)"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-black leading-none tabular-nums text-white sm:text-5xl">
            {remaining.days}
          </span>
          <span className="mt-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ffc451]">
            {remaining.days === 1 ? "dia" : "dias"}
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#ffc451] sm:text-xs">
          <Clock3 size={14} aria-hidden="true" className="shrink-0" />
          Relógio regressivo
        </p>
        <p className="mt-2 font-display text-[clamp(1.15rem,4.7vw,2rem)] font-black leading-none tabular-nums tracking-tight text-white">
          {twoDigits(remaining.hours)}:{twoDigits(remaining.minutes)}:{twoDigits(remaining.seconds)}
        </p>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
          horas · min · seg
        </p>
        <p className="mt-3 text-xs leading-5 text-white/70">
          {remaining.totalSeconds > 0
            ? "O relógio e o círculo atualizam a cada segundo."
            : "Horário previsto alcançado. A liberação depende da organização."}
        </p>
      </div>
    </div>
  );
}
