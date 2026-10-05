import { useEffect, useState } from "react";
import { Sparkles, CalendarDays } from "lucide-react";

// 07 de outubro de 2026 às 14:00, horário de Fortaleza/Brasília (UTC-3)
const EVENT_TARGET_TIMESTAMP = new Date("2026-10-07T14:00:00-03:00").getTime();

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isStarted: boolean;
}

function calculateTimeRemaining(): TimeRemaining {
  const now = Date.now();
  const diff = EVENT_TARGET_TIMESTAMP - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: true };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, isStarted: false };
}

export function CountdownTimer({ className }: { className?: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(calculateTimeRemaining());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    // Evita inconsistência de hidratação SSR
    return null;
  }

  if (timeLeft.isStarted) {
    return (
      <div className="inline-flex items-center gap-2.5 rounded-2xl border border-event-cyan/40 bg-caronaa-dark/90 px-5 py-3 text-sm font-bold text-white shadow-glow-cyan backdrop-blur-md">
        <span className="flex size-2.5 items-center justify-center">
          <span className="absolute size-3 animate-ping rounded-full bg-event-cyan opacity-75" />
          <span className="relative size-2 rounded-full bg-event-cyan" />
        </span>
        <span className="text-base font-extrabold text-event-cyan">
          🚀 O Siará Tech Summit começou!
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        <CalendarDays size={14} className="text-primary" />
        <span>Faltam para o evento:</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "dias", value: timeLeft.days },
          { label: "horas", value: timeLeft.hours },
          { label: "minutos", value: timeLeft.minutes },
          { label: "segundos", value: timeLeft.seconds },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card/90 px-2 py-3 text-center shadow-subtle backdrop-blur-xs sm:px-4 sm:py-3.5"
          >
            <span className="font-display text-2xl font-black text-foreground sm:text-3xl">
              {String(value).padStart(2, "0")}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase sm:text-[11px]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
