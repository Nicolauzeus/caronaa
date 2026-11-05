import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { LocateFixed, MapPin } from "lucide-react";
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

function loadGoogleMaps(browserKey: string): Promise<void> {
  if (!browserKey) return Promise.reject(new Error("Google Maps browser key missing"));
  if (typeof window === "undefined") return Promise.reject(new Error("Browser unavailable"));
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const callback = "__caronaaGoogleMapsLoaded";
    const script = document.createElement("script");
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete (window as any)[callback];
      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve();
      }
    };
    const timeout = window.setTimeout(
      () => finish(new Error("Google Maps load timed out")), 12000,
    );
    (window as any)[callback] = () => finish();
    script.src = "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(browserKey) + "&v=weekly&callback=" + callback;
    script.async = true;
    script.onerror = () => finish(new Error("Google Maps load failed"));
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
  const getServerBrowserKey = useServerFn(getGoogleMapsBrowserKey);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const routeRenderer = useRef<any>(null);
  const fallbackPolyline = useRef<any>(null);
  const circle = useRef<any>(null);
  const currentCenter = useRef<{lat: number; lng: number} | null>(null);
  const lastRecenter = useRef(recenterVersion);
  const dragRef = useRef(onDrag);
  const failureRef = useRef(onFailure);
  dragRef.current = onDrag;
  failureRef.current = onFailure;
  const [ready, setReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<{km: number; minutes: number} | null>(null);
  const effectiveOrigin = originIsCurrent && validPoint(userPosition) ? userPosition : origin;

  useEffect(() => {
    let active = true;
    // A script can load even if Google later rejects the key or billing.
    const priorAuthFailure = (window as any).gm_authFailure;
    const handleAuthFailure = () => {
      if (active) failureRef.current();
      if (typeof priorAuthFailure === "function") priorAuthFailure();
    };
    (window as any).gm_authFailure = handleAuthFailure;
    const initializeMap = async () => {
      // Lovable project Secrets can provide the browser key without putting a
      // real value in a tracked .env file. The key is still public in the client.
      const browserKey = googleMapsBrowserKey || (await getServerBrowserKey()) || "";
      if (!active) return;
      await loadGoogleMaps(browserKey);
      if (!active || !container.current) return;
      const G = (window as any).google.maps;
      const center = [userPosition, origin, destination].find(validPoint) ?? {lat: -3.73, lng: -38.53};
      currentCenter.current = {lat: center.lat, lng: center.lng};
      const instance = new G.Map(container.current, {
        center: currentCenter.current, zoom: 15, disableDefaultUI: true,
        zoomControl: false, gestureHandling: "cooperative", clickableIcons: false,
      });
      instance.addListener("dragstart", () => dragRef.current());
      map.current = instance;
      setReady(true);
    };
    void initializeMap().catch(() => { if (active) failureRef.current(); });
    return () => {
      active = false;
      if ((window as any).gm_authFailure === handleAuthFailure) {
        (window as any).gm_authFailure = priorAuthFailure;
      }
      setReady(false);
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];
      routeRenderer.current?.setMap(null);
      routeRenderer.current = null;
      fallbackPolyline.current?.setMap(null);
      fallbackPolyline.current = null;
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

  // Google Maps is the primary map. If Google's legacy Directions service is
  // unavailable, keep the Google basemap and draw the secondary OSRM route.
  // Pricing and ride matching remain server-controlled, not based on this preview.
  const fromLat = validPoint(effectiveOrigin) ? Math.round(effectiveOrigin.lat * 1000) / 1000 : undefined;
  const fromLng = validPoint(effectiveOrigin) ? Math.round(effectiveOrigin.lng * 1000) / 1000 : undefined;
  const toLat = validPoint(destination) ? Math.round(destination.lat * 10000) / 10000 : undefined;
  const toLng = validPoint(destination) ? Math.round(destination.lng * 10000) / 10000 : undefined;
  useEffect(() => {
    if (!ready || !map.current) return;
    const G = (window as any).google.maps;
    const googleMap = map.current;
    routeRenderer.current?.setMap(null);
    routeRenderer.current = null;
    fallbackPolyline.current?.setMap(null);
    fallbackPolyline.current = null;
    setRouteMetrics(null);
    setRouteError(false);
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) return;

    let active = true;
    const controller = new AbortController();
    let osrmTimeout: number | undefined;

    const useSecondaryRoute = async () => {
      if (!active) return;
      try {
        osrmTimeout = window.setTimeout(() => controller.abort(), 8000);
        const coordinates = [fromLng, fromLat].join(",") + ";" + [toLng, toLat].join(",");
        const url = "https://router.project-osrm.org/route/v1/driving/" +
          coordinates + "?overview=full&geometries=geojson&steps=false";
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Secondary route unavailable");
        const result = await response.json();
        const route = result.routes?.[0];
        if (result.code !== "Ok" || !route || !Number.isFinite(route.distance) ||
          !Number.isFinite(route.duration) || !Array.isArray(route.geometry?.coordinates) ||
          route.geometry.coordinates.length < 2) throw new Error("Invalid secondary route");
        const path = route.geometry.coordinates.map((point: number[]) => {
          if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
            Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) {
            throw new Error("Invalid route coordinate");
          }
          return { lat: point[1], lng: point[0] };
        });
        if (!active) return;
        const line = new G.Polyline({
          map: googleMap, path, strokeColor: "#FFB000", strokeWeight: 6, strokeOpacity: 0.95,
        });
        fallbackPolyline.current = line;
        const bounds = new G.LatLngBounds();
        path.forEach((point: {lat: number; lng: number}) => bounds.extend(point));
        googleMap.fitBounds(bounds, 40);
        setRouteMetrics({ km: route.distance / 1000, minutes: route.duration / 60 });
      } catch {
        if (active) setRouteError(true);
      } finally {
        if (osrmTimeout != null) window.clearTimeout(osrmTimeout);
      }
    };

    try {
      if (!G.DirectionsService || !G.DirectionsRenderer) {
        void useSecondaryRoute();
      } else {
        const directions = new G.DirectionsService();
        const renderer = new G.DirectionsRenderer({
          map: googleMap, suppressMarkers: true, preserveViewport: false,
          polylineOptions: { strokeColor: "#FFB000", strokeWeight: 6, strokeOpacity: 0.95 },
        });
        routeRenderer.current = renderer;
        directions.route({
          origin: { lat: fromLat, lng: fromLng },
          destination: { lat: toLat, lng: toLng },
          travelMode: G.TravelMode.DRIVING,
        }, (result: any, status: string) => {
          if (!active) return;
          if (status !== "OK" || !result?.routes?.[0]) {
            renderer.setMap(null);
            void useSecondaryRoute();
            return;
          }
          renderer.setDirections(result);
          const leg = result.routes[0].legs?.[0];
          if (leg?.distance?.value != null && leg?.duration?.value != null) {
            setRouteMetrics({ km: leg.distance.value / 1000, minutes: leg.duration.value / 60 });
          }
        });
      }
    } catch {
      void useSecondaryRoute();
    }

    return () => {
      active = false;
      controller.abort();
      if (osrmTimeout != null) window.clearTimeout(osrmTimeout);
      routeRenderer.current?.setMap(null);
      routeRenderer.current = null;
      fallbackPolyline.current?.setMap(null);
      fallbackPolyline.current = null;
    };
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
    <section
      aria-label="Mapa do seu trajeto"
      className="relative isolate -mx-4 h-[320px] overflow-hidden bg-muted sm:mx-0 sm:h-72 sm:rounded-lg sm:border sm:border-border"
      data-map-provider="google"
    >
      <div ref={container} className="absolute inset-0 z-0" role="img" aria-label="Mapa Google do radar CARONAA" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <MapPin className="text-primary" size={28} />
          <p className="text-sm text-muted-foreground">
            {locating ? "Localizando você..." : "Carregando Google Maps..."}
          </p>
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="absolute bottom-8 right-3 z-10 size-12 bg-background shadow-sm"
        disabled={locating}
        aria-label="Centralizar na minha localização"
        title="Centralizar na minha localização"
        onClick={onRecenter}
      >
        <LocateFixed size={21} className={locating ? "animate-pulse" : following ? "text-primary" : ""} />
      </Button>
      {routeMetrics && (
        <div role="status" className="absolute left-3 top-3 z-10 rounded-xl bg-background/95 px-3 py-2 text-xs font-bold shadow-md">
          Trajeto pelas ruas: {routeMetrics.km.toFixed(1).replace(".", ",")} km · cerca de {Math.max(1, Math.round(routeMetrics.minutes))} min
        </div>
      )}
      {routeError && (
        <div role="status" className="absolute left-3 right-16 top-3 z-10 rounded-lg bg-background/95 px-3 py-2 text-xs shadow-sm">
          Não foi possível traçar a rota. Ajuste os pontos ou tente novamente.
        </div>
      )}
    </section>
  );
}
