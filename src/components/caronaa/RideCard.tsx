import { useState } from "react";
import { Clock3, MapPin, Star, UsersRound, ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ride } from "@/mockData";

export function RideCard({ ride }: { ride: Ride }) {
  const [expanded, setExpanded] = useState(false);
  const [requested, setRequested] = useState(false);
  return (
    <article className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-card md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={ride.photo}
            alt={ride.driver}
            loading="lazy"
            width={48}
            height={48}
            className="size-11 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{ride.driver}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star size={13} className="fill-warning text-warning" />{" "}
              <span className="font-bold text-foreground">{ride.rating}</span> ({ride.reviews}{" "}
              avaliações)
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-sm bg-secondary px-2 py-1 text-[11px] font-semibold text-primary">
          {ride.type}
        </span>
      </div>
      <div className="relative ml-1 mt-6 grid grid-cols-[20px_1fr_auto] gap-x-2 gap-y-4 before:absolute before:left-[5px] before:top-4 before:bottom-4 before:w-px before:bg-border">
        <span className="relative z-10 mt-1 size-2.5 rounded-full border-[3px] border-primary bg-card" />
        <p className="font-bold">{ride.origin}</p>
        <span className="font-bold">{ride.time}</span>
        <span className="relative z-10 mt-1 size-2.5 rounded-full bg-primary" />
        <p className="font-bold">{ride.destination}</p>
        <span className="text-sm text-muted-foreground">{ride.arrival}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 size={14} />
          {ride.date}
        </span>
        <span className="flex items-center gap-1.5">
          <UsersRound size={14} />
          {ride.seats} {ride.seats === 1 ? "vaga" : "vagas"}
        </span>
        <span className="ml-auto text-base font-extrabold text-foreground">
          R$ {ride.price}
          <span className="text-xs font-normal text-muted-foreground"> / pessoa</span>
        </span>
      </div>
      {expanded && (
        <div className="mt-4 space-y-2 rounded-md bg-secondary p-4 text-sm text-secondary-foreground">
          <p className="flex items-center gap-2">
            <MapPin size={15} /> Encontro: {ride.meeting}
          </p>
          <p>Veículo: {ride.vehicle}</p>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 flex-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          <ArrowUpRight size={15} />
        </Button>
        <Button
          type="button"
          className="h-10 flex-1"
          disabled={requested}
          onClick={() => setRequested(true)}
        >
          {requested ? (
            <>
              <Check size={16} /> Solicitada
            </>
          ) : (
            "Solicitar carona"
          )}
        </Button>
      </div>
    </article>
  );
}
