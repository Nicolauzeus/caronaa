import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getVerificationDescription,
  getVerificationLabel,
  type UserVerification,
} from "@/lib/user-verifications";

type VerificationBadgesProps = {
  verifications: Pick<UserVerification, "type" | "status">[];
  className?: string;
  compact?: boolean;
};

export function VerificationBadges({
  verifications,
  className = "",
  compact = false,
}: VerificationBadgesProps) {
  const activeVerifications = verifications.filter(
    (verification) => verification.status === "VERIFIED",
  );

  if (activeVerifications.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {activeVerifications.map((verification) => {
        const label = getVerificationLabel(verification.type);
        const description = getVerificationDescription(
          verification.type,
        );

        return (
          <Tooltip key={verification.type}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={[
                  "cursor-default border",
                  "transition-colors",
                  verification.type === "UNIFOR"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
                  compact
                    ? "px-2 py-0.5 text-[11px]"
                    : "px-2.5 py-1 text-xs",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[10px]"
                >
                  ✓
                </span>

                {label}
              </Badge>
            </TooltipTrigger>

            <TooltipContent
              side="top"
              align="center"
              className="max-w-xs text-center"
            >
              <p className="text-xs leading-relaxed">
                {description}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
