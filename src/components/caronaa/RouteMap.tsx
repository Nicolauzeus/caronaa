import React, { useEffect, useState, useMemo } from "react";
import {
  MapPin,
  Navigation,
  ExternalLink,
  Route as RouteIcon,
  Info,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { geocodeAddressServerFn } from "@/lib/location.functions";
import { geocodeAddress } from "@/lib/location/geo-utils";
import { LiveRideMap } from "./LiveRideMap";
import { GoogleMapSurface } from "./GoogleMapSurface";
import type { FormLocationDetails } from "@/lib/location/types";

export interface RouteMapLocation {
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  name?: string;
}

export interface RouteMapProps {
  origin?: string | null;
  destination?: string | null;
  originLocation?: FormLocationDetails | RouteMapLocation | null;
  destinationLocation?: FormLocationDetails | RouteMapLocation | null;
  className?: string;
  heightClassName?: string;
  showRouteDetails?: boolean;
  showApproximateMetrics?: boolean;
}

interface ResolvedCoords {
  lat: number;
  lng: number;
  name: string;
}

export function RouteMap({
  origin = "",
  destination = "",
  originLocation,
  destinationLocation,
  className = "",
  heightClassName = "min-h-48 sm:min-h-56",
  showRouteDetails = true,
  showApproximateMetrics = true,
}: RouteMapProps) {
  const resolveAddress = useServerFn(geocodeAddressServerFn);
  const geocode = async (address: string) => {
    const remote = await resolveAddress({ data: { address } }).catch(
      () => null,
    );
    return remote || geocodeAddress(address);
  };
  const [resolvedOrigin, setResolvedOrigin] = useState<ResolvedCoords | null>(
    null,
  );
  const [resolvedDest, setResolvedDest] = useState<ResolvedCoords | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // 1. Resolve origem com dados explícitos ou geocoding automático
  useEffect(() => {
    let active = true;

    if (
      Number.isFinite(originLocation?.lat) &&
      Number.isFinite(originLocation?.lng)
    ) {
      setResolvedOrigin({
        lat: originLocation!.lat!,
        lng: originLocation!.lng!,
        name: originLocation!.formattedAddress || origin || "Origem",
      });
      return;
    }

    if (origin && origin.trim().length >= 2) {
      setIsGeocoding(true);
      void geocode(origin)
        .then((res) => {
          if (!active) return;
          if (res?.lat && res?.lng) {
            setResolvedOrigin({
              lat: res.lat,
              lng: res.lng,
              name: res.formattedAddress || origin,
            });
          } else {
            setResolvedOrigin(null);
          }
        })
        .finally(() => {
          if (active) setIsGeocoding(false);
        });
    } else {
      setResolvedOrigin(null);
    }

    return () => {
      active = false;
    };
  }, [origin, originLocation]);

  // 2. Resolve destino com dados explícitos ou geocoding automático
  useEffect(() => {
    let active = true;

    if (
      Number.isFinite(destinationLocation?.lat) &&
      Number.isFinite(destinationLocation?.lng)
    ) {
      setResolvedDest({
        lat: destinationLocation!.lat!,
        lng: destinationLocation!.lng!,
        name: destinationLocation!.formattedAddress || destination || "Destino",
      });
      return;
    }

    if (destination && destination.trim().length >= 2) {
      setIsGeocoding(true);
      void geocode(destination)
        .then((res) => {
          if (!active) return;
          if (res?.lat && res?.lng) {
            setResolvedDest({
              lat: res.lat,
              lng: res.lng,
              name: res.formattedAddress || destination,
            });
          } else {
            setResolvedDest(null);
          }
        })
        .finally(() => {
          if (active) setIsGeocoding(false);
        });
    } else {
      setResolvedDest(null);
    }

    return () => {
      active = false;
    };
  }, [destination, destinationLocation]);

  // 3. Cálculo métrico da rota quando ambos os pontos possuem coordenadas
  const routeMetrics = useMemo(() => {
    if (!resolvedOrigin || !resolvedDest) return null;

    const externalNavUrl = `https://www.google.com/maps/dir/?api=1&origin=${resolvedOrigin.lat},${resolvedOrigin.lng}&destination=${resolvedDest.lat},${resolvedDest.lng}`;

    return {
      externalNavUrl,
    };
  }, [resolvedOrigin, resolvedDest]);

  // Visualização com ambos os pontos georreferenciados
  if (routeMetrics && resolvedOrigin && resolvedDest) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all ${className}`}
      >
        <div
          className={`relative w-full ${heightClassName} overflow-hidden bg-muted/30`}
        >
          <LiveRideMap
            points={[
              {
                lat: resolvedOrigin.lat,
                lng: resolvedOrigin.lng,
                title: resolvedOrigin.name,
                type: "meeting",
              },
              {
                lat: resolvedDest.lat,
                lng: resolvedDest.lng,
                title: resolvedDest.name,
                type: "destination",
              },
            ]}
          />

          {/* Badge superior indicando trajeto */}
          <div className="absolute z-20 top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur-xs border border-border/70">
            <RouteIcon size={14} className="text-primary" />
            <span>
              {showApproximateMetrics
                ? "Trajeto pelas vias · distância e tempo estimados no mapa"
                : "Pontos de referência · rota pelas vias quando disponível"}
            </span>
          </div>

          {/* Link para navegação externa */}
          <a
            href={routeMetrics.externalNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute z-20 top-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-background/95 px-2 py-1 text-[11px] font-semibold text-primary hover:text-primary/80 shadow-sm backdrop-blur-xs border border-border/70 transition-colors"
          >
            <span>Abrir mapa</span>
            <ExternalLink size={12} />
          </a>

          {/* Marcadores de Coordenadas A e B */}
          <div className="pointer-events-none absolute z-20 bottom-12 left-2 right-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
            <span className="rounded bg-background/90 px-1.5 py-0.5 shadow-xs backdrop-blur-xs">
              A: {resolvedOrigin.lat.toFixed(4)},{" "}
              {resolvedOrigin.lng.toFixed(4)}
            </span>
            <span className="rounded bg-background/90 px-1.5 py-0.5 shadow-xs backdrop-blur-xs">
              B: {resolvedDest.lat.toFixed(4)}, {resolvedDest.lng.toFixed(4)}
            </span>
          </div>
        </div>

        {showRouteDetails && (
          <div className="border-t border-border bg-muted/15 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-medium truncate">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                A
              </span>
              <span className="truncate">{resolvedOrigin.name}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium truncate">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                B
              </span>
              <span className="truncate">{resolvedDest.name}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Visualização de ponto único se apenas um tiver coordenadas
  const singlePoint = resolvedOrigin || resolvedDest;
  if (singlePoint) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-card shadow-soft ${className}`}
      >
        <div
          className={`relative w-full ${heightClassName} overflow-hidden bg-muted/30`}
        >
          <GoogleMapSurface
            points={[
              {
                lat: singlePoint.lat,
                lng: singlePoint.lng,
                title: singlePoint.name,
              },
            ]}
            className="h-56 w-full"
            ariaLabel={"Localização: " + singlePoint.name}
          />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur-xs border border-border/70">
            <MapPin size={14} className="text-primary" />
            <span className="truncate max-w-[200px]">{singlePoint.name}</span>
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-xs backdrop-blur-xs">
            {singlePoint.lat.toFixed(4)}, {singlePoint.lng.toFixed(4)}
          </div>
        </div>
      </div>
    );
  }

  // Fallback quando não há coordenadas ou busca está em andamento
  const hasText = Boolean(origin?.trim() || destination?.trim());
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border border-border/80 bg-muted/20 p-6 text-center ${heightClassName} ${className}`}
    >
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
        <Navigation size={20} className={isGeocoding ? "animate-spin" : ""} />
      </div>
      <p className="text-sm font-semibold text-foreground">
        {hasText ? "Mapa do trajeto" : "Mapa interativo do trajeto"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {isGeocoding
          ? "Localizando pontos do trajeto no mapa..."
          : hasText
            ? `Trajeto definido: ${origin || "Origem"} → ${destination || "Destino"}. Selecione um local sugerido para ver a rota exata.`
            : "Selecione a origem e o destino para visualizar a rota, distância e tempo estimado no mapa."}
      </p>
      {hasText && (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground bg-background/80 px-2 py-1 rounded-md border border-border/60">
          <Info size={12} className="text-primary shrink-0" />
          <span>Suporte georreferenciado com Google Maps.</span>
        </div>
      )}
    </div>
  );
}
