import React from "react";
export type { TimeToleranceMinutes } from "@/lib/ride-matching";
import { Clock, Info } from "lucide-react";
import {
  TIME_TOLERANCE_OPTIONS,
  type TimeToleranceMinutes,
  getTimeWindowRange,
} from "@/lib/ride-matching";

export interface TimeToleranceSelectorProps {
  value: TimeToleranceMinutes;
  onChange: (value: TimeToleranceMinutes) => void;
  baseTime?: string;
  label?: string;
  className?: string;
  showWindowPreview?: boolean;
}

export function TimeToleranceSelector({
  value,
  onChange,
  baseTime,
  label = "Janela de tolerância",
  className = "",
  showWindowPreview = true,
}: TimeToleranceSelectorProps) {
  const windowRange = baseTime ? getTimeWindowRange(baseTime, value) : null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
          <Clock size={13} className="text-primary" />
          <span>{label}</span>
        </label>
        <span
          data-testid="active-tolerance-badge"
          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
        >
          Tolerância ativa: ±{value} min
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {TIME_TOLERANCE_OPTIONS.map((option) => {
          const isSelected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60"
              }`}
            >
              ±{option} min {option === 15 ? "(padrão)" : ""}
            </button>
          );
        })}
      </div>

      {showWindowPreview && windowRange && baseTime && (
        <p
          data-testid="time-window-preview"
          className="flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          <Info size={12} className="shrink-0 text-primary" />
          <span>
            Aceita saídas de <strong className="text-foreground">{windowRange.start}</strong> até{" "}
            <strong className="text-foreground">{windowRange.end}</strong>
          </span>
        </p>
      )}
    </div>
  );
}
