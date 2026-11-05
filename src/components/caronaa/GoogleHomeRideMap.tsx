import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { validPoint, type UserPosition } from "@/lib/location/use-user-location";
import type { ApproximateProfessionalDriver } from "./HomeRideMap";

type Point = { lat?: number; lng?: number };
type Props = {
  userPosition: UserPosition | null;
  professionalDrivers?: ApproximateProfessionalDriver[];
  origin?: Point;
  destination?: Point;
  originIsCurrent: boolean;
  following: boolean;
  recenterVersion: number;
  locating: boolean;
  onDrag: () => void;
  onRecenter: () => void;
};

// This is intentionally a browser-restricted key. Never substitute the server
// GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY secret here.
export const googleMapsBrowserKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY?.trim() ?? "";
let googleScriptPromise: Promise<void> | undefined;

function loadGoogleMaps(): Promise<void> {
  if (!googleMapsBrowserKey) return Promise.reject(new Error("Google Maps browser key missing"));
  if (typeof window === "undefined") return Promise.reject(new Error("Browser unavailable"));
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const callback = "__caronaaGoogleMapsLoaded";
    const timeout = window.setTimeout(() => {
      delete (window as any)[callback];
      reject(new Error("Google Maps load timed out"));
    }, 12000);
    (window as any)[callback] = () => {
      window.clearTimeout(timeout);
      delete (window as any)[callback];
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(googleMapsBrowserKey) + "&v=weekly&callback=" + callback;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      delete (window as any)[callback];
      reject(new Error("Google Maps load failed"));
    };
    document.head.appendChild(script);
  }).catch(error => {
    googleScriptPromise = undefined;
    throw error;
  });
  return googleScriptPromise;
}

/**
 * Google Maps replacement for the home radar. Signals failure so that the
 * caller can preserve the previously working Leaflet/OpenStreetMap view.
 * Do not publish real GPS coordinates in analytics or logs.
 */
export function GoogleHomeRideMap({
  userPosition, professionalDrivers = [], origin, destination, originIsCurrent,
  following, recenterVersion, locating, onDrag, onRecenter, onFailure,
}: Props & { onFailure: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const routeRenderer = useRef<any>(null);
  const circle = useRef<any>(null);
  const currentCenter = useRef<{lat: number; lng: number} | null>(null);
  const lastRecenter = useRef(recenterVersion);
  const [ready, setReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<{km: number; minutes: number} | null>(null);
  const effectiveOrigin = originIsCurrent && validPoint(userPosition) ? userPosition : origin;

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then(() => {
      if (!active || !container.current) return;
      const G = (window as any).google.maps;
      const center = [userPosition, origin, destination].find(validPoint) ?? {lat: -3.73, lng: -38.53};
      currentCenter.current = {lat: center.lat, lng: center.lng};
      const instance = new G.Map(container.current, {
        center: currentCenter.current, zoom: 15, disableDefaultUI: true,
        zoomControl: true, gestureHandling: "greedy", clickableIcons: false,
      });
      instance.addListener("dragstart", onDrag);
      map.current = instance;
      setReady(true);
    }).catch(() => { if (active) onFailure(); });
    return () => {
      active = false;
      setReady(false);
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];
      routeRenderer.current?.setMap(null);
      routeRenderer.current = null;
      circle.current?.setMap(null);
      circle.current = null;
      map.current = null;
    };
    // Create once; markers and camera are updated in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const G = (window as any).google.maps;
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [];
    const add = (point: Point | null | undefined, title: string, color: string) => {
      if (!validPoint(point)) return;
      const marker = new G.Marker({
        map: map.current, position: {lat: point.lat, lng: point.lng}, title,
        icon: {path: G.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1,
          strokeColor: "#ffffff", strokeWeight: 2, scale: 9},
      });
      markers.current.push(marker);
    };
    add(userPosition, "Sua localização", "#2563eb");
    if (!originIsCurrent) add(origin, "Saída", "#b38600");
    add(destination, "Destino", "#f5b800");
    professionalDrivers.forEach(driver => add(driver, "Motorista disponível · posição aproximada", "#FFBB00"));
    circle.current?.setMap(null);
    if (validPoint(userPosition) && userPosition.accuracy > 0) {
      circle.current = new G.Circle({
        map: map.current, center: {lat: userPosition.lat, lng: userPosition.lng},
        radius: userPosition.accuracy, fillColor: "#2563eb", fillOpacity: 0.08,
        strokeColor: "#2563eb", strokeOpacity: 0.5, strokeWeight: 1,
      });
    }
  }, [ready, userPosition, professionalDrivers, origin?.lat, origin?.lng, destination?.lat, destination?.lng, originIsCurrent]);

  // DirectionsService is an interim client implementation. The migration to
  // the server-side Routes API is tracked separately and must be homologated.
  const fromLat = validPoint(effectiveOrigin) ? Math.round(effectiveOrigin.lat * 1000) / 1000 : undefined;
  const fromLng = validPoint(effectiveOrigin) ? Math.round(effectiveOrigin.lng * 1000) / 1000 : undefined;
  const toLat = validPoint(destination) ? Math.round(destination.lat * 10000) / 10000 : undefined;
  const toLng = validPoint(destination) ? Math.round(destination.lng * 10000) / 10000 : undefined;
  useEffect(() => {
    if (!ready || !map.current) return;
    routeRenderer.current?.setMap(null);
    routeRenderer.current = null;
    setRouteMetrics(null);
    setRouteError(false);
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) return;
    let active = true;
    const G = (window as any).google.maps;
    const directions = new G.DirectionsService();
    const renderer = new G.DirectionsRenderer({
      map: map.current, suppressMarkers: true, preserveViewport: false,
      polylineOptions: {strokeColor: "#FFB000", strokeWeight: 6, strokeOpacity: 0.95},
    });
    routeRenderer.current = renderer;
    directions.route({
      origin: {lat: fromLat, lng: fromLng},
      destination: {lat: toLat, lng: toLng},
      travelMode: G.TravelMode.DRIVING,
    }, (result: any, status: string) => {
      if (!active) return;
      if (status !== "OK" || !result?.routes?.[0]) {
        renderer.setMap(null);
        setRouteError(true);
        return;
      }
      renderer.setDirections(result);
      const leg = result.routes[0].legs?.[0];
      if (leg?.distance?.value != null && leg?.duration?.value != null) {
        setRouteMetrics({km: leg.distance.value / 1000, minutes: leg.duration.value / 60});
      }
    });
    return () => { active = false; renderer.setMap(null); };
  }, [ready, fromLat, fromLng, toLat, toLng]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const recenterRequested = lastRecenter.current !== recenterVersion;
    lastRecenter.current = recenterVersion;
    if (!recenterRequested && !following) return;
    const position = validPoint(userPosition) ? userPosition : effectiveOrigin;
    if (!validPoint(position)) return;
    const next = {lat: position.lat, lng: position.lng};
    if (recenterRequested || !currentCenter.current ||
      Math.abs(currentCenter.current.lat - next.lat) + Math.abs(currentCenter.current.lng - next.lng) > 0.0005) {
      map.current.panTo(next);
      currentCenter.current = next;
    }
  }, [ready, recenterVersion, following, userPosition, effectiveOrigin?.lat, effectiveOrigin?.lng]);

  return (
    <div className="relative h-full w-full" data-map-provider="google">
      <div ref={container} className="h-full min-h-[240px] w-full" role="img" aria-label="Mapa Google do radar CARONAA" />
      <Button type="button" size="sm" variant="secondary" className="absolute right-3 top-3 z-10"
        disabled={locating} onClick={onRecenter}>Minha localização</Button>
      {routeMetrics && (
        <div className="absolute bottom-3 left-3 z-10 rounded-md bg-background/95 px-2 py-1 text-xs">
          Rota pelas vias · {routeMetrics.km.toFixed(1)} km · cerca de {Math.round(routeMetrics.minutes)} min
        </div>
      )}
      {routeError && (
        <div className="absolute bottom-3 left-3 z-10 rounded-md bg-background/95 px-2 py-1 text-xs">
          Rota indisponível. Marcadores não representam o percurso.
        </div>
      )}
    </div>
  );
}
