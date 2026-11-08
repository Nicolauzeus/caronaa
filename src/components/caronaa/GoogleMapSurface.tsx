import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { resolveGoogleMapsBrowserKey } from "@/lib/google-maps-key";
import {
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
} from "@/lib/google-maps-loader";
import { MapUnavailable } from "./MapUnavailable";
import { tripMarkerIcon, type TripMarkerKind } from "./trip-marker-icons";

export type GoogleMapPoint = {
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  label?: string;
  kind?: TripMarkerKind | "person";
};
export type GoogleMapLine = {
  points: Array<{ lat: number; lng: number }>;
  color?: string;
  label?: string;
  dotted?: boolean;
};

type Props = {
  points: GoogleMapPoint[];
  lines?: GoogleMapLine[];
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
  previewOnly?: boolean;
  fitMode?: "once" | "changes";
  /** Refits when visible marker identities change, not on GPS jitter. */
  fitKey?: string;
};

const isValid = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) &&
  Math.abs(p.lat) <= 90 &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lng) <= 180;

/** Google Maps surface for ride details, tracking and itinerary previews. */
export function GoogleMapSurface({
  points,
  lines = [],
  className = "h-72 w-full",
  ariaLabel = "Mapa do percurso",
  children,
  previewOnly = false,
  fitMode = "changes",
  fitKey,
}: Props) {
  const getKey = useServerFn(getGoogleMapsBrowserKey);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const artifacts = useRef<any[]>([]);
  const fitted = useRef(false);
  const lastFitKey = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onGoogleMapsAuthFailure(() => {
      if (active) setFailed(true);
    });
    const initialize = async () => {
      const key =
        (await getKey().catch(() => null)) ||
        resolveGoogleMapsBrowserKey(
          typeof process !== "undefined" ? process.env : {},
          import.meta.env,
        );
      if (!key) throw new Error("Browser map key not configured");
      await loadGoogleMaps(key);
      if (!active || !container.current) return;
      const G = (window as any).google?.maps;
      if (!G?.Map) throw new Error("Google Maps JS missing after load");
      map.current = new G.Map(container.current, {
        center: { lat: -3.73, lng: -38.53 },
        zoom: 13,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: previewOnly ? "none" : "cooperative",
        keyboardShortcuts: !previewOnly,
      });
      setReady(true);
    };
    void initialize().catch(() => {
      if (active) {
        console.warn(
          "[CARONAA/maps] Google Maps indisponível. Confira GOOGLE_MAPS_BROWSER_API_KEY, Maps JavaScript API, faturamento e domínios.",
        );
        setFailed(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
      artifacts.current.forEach((item) => item.setMap(null));
      artifacts.current = [];
      map.current = null;
    };
    // Initialize exactly once; update markers and polylines separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current || failed) return;
    const G = (window as any).google.maps;
    artifacts.current.forEach((item) => item.setMap(null));
    artifacts.current = [];
    const bounds = new G.LatLngBounds();
    let count = 0;
    const extend = (point: { lat: number; lng: number }) => {
      if (isValid(point)) {
        bounds.extend(point);
        count += 1;
      }
    };
    points.filter(isValid).forEach((point) => {
      const badgeIcon = point.kind && point.kind !== "person" ? tripMarkerIcon(point.kind) : null;
      const marker = new G.Marker({
        map: map.current,
        position: { lat: point.lat, lng: point.lng },
        title: point.title || "Localização",
        ...(point.label && !badgeIcon
          ? {
              label: {
                text: point.label,
                color: "#FFFFFF",
                fontWeight: "bold",
              },
            }
          : {}),
        icon: badgeIcon ?? {
          path:
            point.kind === "person"
              ? "M 0,-9 A 3,3 0 1,1 0,-3 A 3,3 0 1,1 0,-9 M -5,7 L -5,1 Q -5,-2 0,-2 Q 5,-2 5,1 L 5,7 Z"
              : point.kind === "meeting"
                ? "M -7,-8 L 7,-8 L 7,3 L 0,10 L -7,3 Z"
                : G.SymbolPath.CIRCLE,
          scale: point.kind ? 1.4 : 8,
          fillColor: point.color || "#FFBB00",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
        // The viewer must remain identifiable when nearby markers overlap.
        zIndex: point.kind === "you" ? 50 : point.kind === "driver" ? 40 : point.kind === "destination" ? 30 : 20,
      });
      artifacts.current.push(marker);
      extend(point);
    });
    lines.forEach((line) => {
      const path = line.points.filter(isValid);
      if (path.length < 2) return;
      const polyline = new G.Polyline({
        map: map.current,
        path,
        geodesic: false,
        strokeColor: line.color || "#FFBB00",
        strokeOpacity: line.dotted ? 0 : 0.95,
        ...(line.dotted
          ? {
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
                  offset: "0",
                  repeat: "12px",
                },
              ],
            }
          : {}),
        strokeWeight: 5,
      });
      artifacts.current.push(polyline);
      path.forEach(extend);
    });
    if (fitKey !== undefined && lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      fitted.current = false;
    }
    if (fitted.current && fitMode === "once") return;
    if (count > 0) fitted.current = true;
    if (count === 1) {
      map.current.setCenter(bounds.getCenter());
      map.current.setZoom(15);
    } else if (count > 1) {
      map.current.fitBounds(bounds, 32);
    }
  }, [ready, failed, points, lines, fitMode, fitKey]);

  return (
    <div
      className={
        "relative isolate z-0 overflow-hidden bg-muted/30 " + className
      }
      data-map-provider="google"
      aria-label={ariaLabel}
    >
      <div
        ref={container}
        className="absolute inset-0"
        role="img"
        aria-label={ariaLabel}
      />
      {failed && <MapUnavailable compact={previewOnly} />}
      {!ready && !failed && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground"
        >
          Carregando Google Maps...
        </div>
      )}
      {ready && !failed && children}
    </div>
  );
}
