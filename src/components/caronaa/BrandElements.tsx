import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, MapPin, CheckCircle2 } from "lucide-react";

/**
 * Ícone vetorial oficial do símbolo CARONAA (Pino de localização com arco "C").
 * Baseado na identidade visual da marca.
 */
export function CaronaaSymbol({
  className,
  size = 24,
  color = "currentColor",
}: {
  className?: string;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Pino exterior com terminação aberta à direita */}
      <path
        d="M50 92C32 75 22 58 22 42C22 26.5 34.5 14 50 14C65.5 14 78 26.5 78 42C78 45.5 77.2 49 75.8 52"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Arco interior em formato de "C" */}
      <path
        d="M68 34C63.5 28.5 57 25 50 25C38.5 25 29 34.5 29 46C29 57.5 38.5 67 50 67C57 67 63.5 63.5 68 58"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Logotipo oficial CARONAA
 */
export function BrandLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-11",
    lg: "h-16",
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <CaronaaSymbol
        size={size === "sm" ? 22 : size === "md" ? 30 : 40}
        className="text-caronaa-primary"
      />
      <span
        className={cn(
          "font-display font-extrabold tracking-tight text-foreground",
          size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl",
        )}
      >
        CARONAA
      </span>
    </div>
  );
}

export function StsBadge({ className }: { className?: string }) {
  return <BrandBadge variant="sts" className={className} />;
}

export function UniforHubBadge({ className }: { className?: string }) {
  return <BrandBadge variant="unifor" className={className} />;
}

/**
 * Badges padronizados do Design System da CARONAA
 */
export type BrandBadgeVariant = "sts" | "unifor" | "validation" | "community" | "light";

export function BrandBadge({
  variant = "validation",
  children,
  className,
  ...props
}: {
  variant?: BrandBadgeVariant;
  children?: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  if (variant === "sts") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-event-cyan/30 bg-caronaa-dark/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft backdrop-blur-md",
          className,
        )}
        {...props}
      >
        <span className="flex size-2 items-center justify-center">
          <span className="absolute size-2 animate-ping rounded-full bg-event-cyan opacity-75" />
          <span className="relative size-1.5 rounded-full bg-event-cyan" />
        </span>
        <span className="text-event-cyan font-bold tracking-wide">STS 2026</span>
        <span className="text-white/40">•</span>
        <span className="text-white/90">Startup Expositora</span>
        {children}
      </div>
    );
  }

  if (variant === "unifor") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-subtle",
          className,
        )}
        {...props}
      >
        <span className="size-2 rounded-full bg-caronaa-primary" />
        <span>Ecossistema Unifor Hub</span>
        {children}
      </div>
    );
  }

  if (variant === "validation") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-caronaa-primary/40 bg-caronaa-primary-soft/80 px-3.5 py-1.5 text-xs font-bold text-caronaa-dark shadow-subtle",
          className,
        )}
        {...props}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-caronaa-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-caronaa-primary-strong" />
        </span>
        <span>MVP em Validação Real</span>
        {children}
      </div>
    );
  }

  if (variant === "light") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md",
          className,
        )}
        {...props}
      >
        <span className="size-2 rounded-full bg-caronaa-primary" />
        <span>{children ?? "Mobilidade que conecta pessoas"}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-3.5 py-1.5 text-xs font-semibold text-foreground",
        className,
      )}
      {...props}
    >
      <span className="size-2 rounded-full bg-caronaa-primary" />
      <span>{children ?? "Mobilidade Comunitária"}</span>
    </div>
  );
}

/**
 * Visual de Conexão de Trajetos (Origem -> Destino)
 * Comunica graficamente a proposta de valor: "conecta quem precisa ir com quem já está indo".
 */
export function RouteConnectionVisual({
  origin = "Sua saída (ex.: Aldeota)",
  destination = "Seu destino (ex.: Unifor)",
  compact = false,
  className,
}: {
  origin?: string;
  destination?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card p-4 shadow-soft",
        compact ? "p-3" : "p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        {/* Linha vertical de conexão */}
        <div className="flex flex-col items-center pt-1">
          <span className="size-3.5 rounded-full border-2 border-caronaa-primary bg-background shadow-xs" />
          <span className="my-1 h-8 w-0.5 connection-line" />
          <CaronaaSymbol size={18} className="text-caronaa-primary" />
        </div>

        {/* Textos dos pontos */}
        <div className="flex flex-1 flex-col justify-between gap-3 text-left">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Quem precisa ir
            </p>
            <p className="text-sm font-bold text-foreground">{origin}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-primary uppercase">
              Quem já está indo
            </p>
            <p className="text-sm font-bold text-foreground">{destination}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner Institucional de Validação do Evento (Siará Tech Summit + Unifor Hub)
 */
export function InstitutionalPartnershipStrip({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Afiliação Institucional"
      className={cn(
        "border-y border-border/80 bg-secondary/50 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-center sm:px-6">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles size={14} className="text-caronaa-primary" />
          Startup expositora no <strong className="text-foreground">Siará Tech Summit 2026</strong>
        </span>
        <span className="hidden text-muted-foreground/40 sm:inline">•</span>
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <CheckCircle2 size={14} className="text-success" />
          Startup do ecossistema <strong className="text-foreground">Unifor Hub</strong>
        </span>
      </div>
    </aside>
  );
}
