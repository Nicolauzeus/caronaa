import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 animate-page-in">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h1 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">{title}</h1>
      {description && (
        <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">{description}</p>
      )}
    </div>
  );
}

export function SearchForm({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // Keep the authenticated session, router state and cached data intact.
        void navigate({ to: "/buscar", search: { origem: origin, destino: destination, data: date } });
      }}
      className={`grid gap-3 rounded-xl border border-border bg-card p-3 shadow-soft ${compact ? "lg:grid-cols-[1fr_1fr_1fr_auto]" : "md:grid-cols-[1fr_1fr_1fr_auto]"} md:items-end md:p-4`}
    >
      <label className="block text-[11px] font-bold tracking-wide text-muted-foreground">
        ORIGEM
        <div className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-input px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <MapPin size={16} className="shrink-0 text-primary" />
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="De onde você sai?"
            className="w-full min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </label>
      <label className="block text-[11px] font-bold tracking-wide text-muted-foreground">
        DESTINO
        <div className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-input px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <MapPin size={16} className="shrink-0 text-primary" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Para onde vai?"
            className="w-full min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </label>
      <label className="block text-[11px] font-bold tracking-wide text-muted-foreground">
        DATA
        <div className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-input px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
          <CalendarDays size={16} className="shrink-0 text-primary" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Data da viagem"
            className="w-full min-w-0 bg-transparent text-sm font-medium text-foreground outline-none"
          />
        </div>
      </label>
      <Button type="submit" className="h-10 px-5">
        <Search size={17} /> Buscar caronas
      </Button>
    </form>
  );
}

export function SectionTitle({
  title,
  link,
  to,
}: {
  title: string;
  link?: string;
  to?: "/buscar" | "/minhas-caronas";
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <h2 className="font-display text-xl font-extrabold md:text-2xl">{title}</h2>
      {link && to && (
        <Link
          to={to}
          className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline"
        >
          {link}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
