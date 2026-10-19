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
    <Card className="rounded-lg border border-border bg-card shadow-none border-t-2 border-t-primary">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">
            {label}
          </p>
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                positive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300",
              )}
            >
              {positive ? <ArrowUpRight size={12} /> : <Minus size={12} />}
              {trend}
            </span>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-extrabold tracking-normal text-foreground">
              {value}
            </p>
            {detail ? <p className="mt-2 text-xs text-muted-foreground">{detail}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
