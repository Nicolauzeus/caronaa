import { ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  detail,
  trend,
  positive = true,
}: {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  positive?: boolean;
}) {
  return (
    <Card className="border border-border bg-card/80 shadow-soft">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                positive
                  ? "bg-primary/10 text-primary"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              {positive ? <ArrowUpRight size={12} /> : <Minus size={12} />}
              {trend}
            </span>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
            {detail ? <p className="mt-2 text-xs text-muted-foreground">{detail}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
