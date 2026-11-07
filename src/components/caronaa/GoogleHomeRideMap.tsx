import type { StrictPickupPreview } from "@/lib/safe-pickup";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { resolveGoogleMapsBrowserKey } from "@/lib/google-maps-key";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps-loader";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { MapUnavailable } from "./MapUnavailable";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { LocateFixed, MapPin } from "lucide-react";
import { validPoint, type UserPosition } from "@/lib/location/use-user-location";
import type { ApproximateProfessionalDriver } from "./HomeRideMap";

type Point = { lat?: number; lng?: number };
type Props = {
  pickupPreview?: StrictPickupPreview | null;
  immersive?: boolean;
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

// process.env is available on the server; the RPC applies that priority before
// public Vite bindings. No server environment object is bundled into the client.
export const googleMapsBrowserKey = resolveGoogleMapsBrowserKey(
  typeof process !== "undefined" ? process.env : {},
  import.meta.env,
);

export function GoogleHomeRideMap({
  immersive = false,
  pickupPreview = null,
  userPosition,
  professionalDrivers = [],
  origin,
  destination,
  originIsCurrent,
  following,
  recenterVersion,
  locating,
  onDrag,
  onRecenter,
}: Props) {
  const getServerBrowserKey = useServerFn(getGoogleMapsBrowserKey);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const routePolyline = useRef<any>(null);
  const circle = useRef<any>(null);
  const pickupLines = useRef<any[]>([]);
  const currentCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastRecenter = useRef(recenterVersion);
  const dragRef = useRef(onDrag);
  dragRef.current = onDrag;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<{
    km: number;
    minutes: number;
  } | null>(null);
  const effectiveOrigin = originIsCurrent && validPoint(userPosition) ? userPosition : origin;

  useEffect(() => {
    let active = true;
    const unsubscribe = onGoogleMapsAuthFailure(() => {
      if (active) setFailed(true);
    });
    const initializeMap = async () => {
      // Lovable project Secrets can provide the browser key without putting a
      // real value in a tracked .env file. The key is still public in the client.
      const browserKey = (await getServerBrowserKey().catch(() => null)) || googleMapsBrowserKey;
      if (!active) return;
      await loadGoogleMaps(browserKey);
      if (!active || !container.current) return;
      const G = (window as any).google.maps;
      const center = [userPosition, origin, destination].find(validPoint) ?? {
        lat: -3.73,
        lng: -38.53,
      };
      currentCenter.current = { lat: center.lat, lng: center.lng };
      const instance = new G.Map(container.current, {
        center: currentCenter.current,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "cooperative",
        clickableIcons: false,
      });
      instance.addListener("dragstart", () => dragRef.current());
      map.current = instance;
      setReady(true);
    };
    void initializeMap().catch(() => {
      if (active) {
        console.warn(
          "[CARONAA/maps] Google Maps indisponível no radar da home. Verifique GOOGLE_MAPS_BROWSER_API_KEY, domínios permitidos, faturamento e Maps JavaScript API.",
        );
        setFailed(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
      setReady(false);
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
      routePolyline.current?.setMap(null);
      routePolyline.current = null;
      circle.current?.setMap(null);
      circle.current = null;
      pickupLines.current.forEach((line) => line.setMap(null));
      pickupLines.current = [];
      map.current = null;
    };
    // Create once; markers and camera are updated in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const G = (window as any).google.maps;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];
    const add = (point: Point | null | undefined, title: string, color: string) => {
      if (!validPoint(point)) return;
      const marker = new G.Marker({
        map: map.current,
        position: { lat: point.lat, lng: point.lng },
        title,
        icon: {
          path: G.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 9,
        },
      });
      markers.current.push(marker);
    };
    add(userPosition, "Sua localização", "#2563eb");
    if (!originIsCurrent) add(origin, "Saída", "#b38600");
    add(destination, "Destino", "#f5b800");
    if (pickupPreview) {
      add(pickupPreview.passenger, "Origem do passageiro", "#2563eb");
      add(pickupPreview.pickup.point, pickupPreview.pickup.label, "#FFBB00");
    }
    professionalDrivers.forEach((driver) =>
      add(driver, "Motorista disponível · posição aproximada", "#FFBB00"),
    );
    circle.current?.setMap(null);
    if (validPoint(userPosition) && userPosition.accuracy > 0) {
      circle.current = new G.Circle({
        map: map.current,
        center: { lat: userPosition.lat, lng: userPosition.lng },
        radius: userPosition.accuracy,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        strokeColor: "#2563eb",
        strokeOpacity: 0.5,
        strokeWeight: 1,
      });
    }
  }, [
    ready,
    userPosition,
    professionalDrivers,
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    originIsCurrent,
    pickupPreview,
  ]);

  // Keep road geometry and preview metrics on the same Google Routes contract
  // used by server-side fares. Small GPS changes do not trigger a new request.
  const fromLat = validPoint(effectiveOrigin)
    ? Math.round(effectiveOrigin.lat * 1000) / 1000
    : undefined;
  const fromLng = validPoint(effectiveOrigin)
    ? Math.round(effectiveOrigin.lng * 1000) / 1000
    : undefined;
  const toLat = validPoint(destination) ? Math.round(destination.lat * 10000) / 10000 : undefined;
  const toLng = validPoint(destination) ? Math.round(destination.lng * 10000) / 10000 : undefined;
  useEffect(() => {
    if (!ready || !map.current || failed) return;
    routePolyline.current?.setMap(null);
    routePolyline.current = null;
    setRouteMetrics(null);
    setRouteError(false);
    if (pickupPreview || fromLat == null || fromLng == null || toLat == null || toLng == null)
      return;
    const abort = new AbortController();
    const googleMap = map.current;
    const timer = window.setTimeout(() => {
      void getMapDrivingRoute({
        data: {
          points: [
            { lat: fromLat, lng: fromLng },
            { lat: toLat, lng: toLng },
          ],
        },
        signal: abort.signal,
      })
        .then((route) => {
          if (abort.signal.aborted) return;
          const G = (window as any).google.maps;
          routePolyline.current = new G.Polyline({
            map: googleMap,
            path: route.routePath,
            strokeColor: "#FFBB00",
            strokeWeight: 6,
            strokeOpacity: 0.95,
          });
          const bounds = new G.LatLngBounds();
          route.routePath.forEach((point) => bounds.extend(point));
          googleMap.fitBounds(bounds, {
            top: 48,
            right: 40,
            bottom: 72,
            left: 40,
          });
          setRouteMetrics({
            km: route.distanceKm,
            minutes: route.durationMinutes,
          });
        })
        .catch(() => {
          if (!abort.signal.aborted) setRouteError(true);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
      routePolyline.current?.setMap(null);
      routePolyline.current = null;
    };
  }, [ready, failed, fromLat, fromLng, toLat, toLng, pickupPreview]);

  useEffect(() => {
    if (!ready || !map.current || failed) return;
    pickupLines.current.forEach((line) => line.setMap(null));
    pickupLines.current = [];
    if (!pickupPreview) return;
    const G = (window as any).google.maps;
    const lines = [
      new G.Polyline({
        map: map.current,
        path: pickupPreview.route,
        strokeColor: "#FFBB00",
        strokeOpacity: 0.9,
        strokeWeight: 6,
      }),
    ];
    if (pickupPreview.walk?.routePath.length)
      lines.push(
        new G.Polyline({
          map: map.current,
          path: pickupPreview.walk.routePath,
          strokeOpacity: 0,
          icons: [
            {
              icon: {
                path: G.SymbolPath.CIRCLE,
                scale: 3,
                fillOpacity: 1,
                fillColor: "#2563eb",
                strokeOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 1,
              },
              offset: "0",
              repeat: "12px",
            },
          ],
        }),
      );
    pickupLines.current = lines;
    const bounds = new G.LatLngBounds();
    pickupPreview.walk?.routePath.forEach((point) => bounds.extend(point));
    bounds.extend(pickupPreview.passenger);
    bounds.extend(pickupPreview.pickup.point);
    map.current.fitBounds(bounds, {
      top: immersive ? 180 : 48,
      right: 48,
      bottom: immersive ? 340 : 72,
      left: 48,
    });
    return () => {
      lines.forEach((line) => line.setMap(null));
      pickupLines.current = [];
    };
  }, [ready, failed, pickupPreview, immersive]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const recenterRequested = lastRecenter.current !== recenterVersion;
    lastRecenter.current = recenterVersion;
    if (!recenterRequested && !following) return;
    const position = validPoint(userPosition) ? userPosition : effectiveOrigin;
    if (!validPoint(position)) return;
    const next = { lat: position.lat, lng: position.lng };
    if (
      recenterRequested ||
      !currentCenter.current ||
      Math.abs(currentCenter.current.lat - next.lat) +
        Math.abs(currentCenter.current.lng - next.lng) >
        0.0005
    ) {
      map.current.panTo(next);
      currentCenter.current = next;
    }
  }, [ready, recenterVersion, following, userPosition, effectiveOrigin?.lat, effectiveOrigin?.lng]);

  return (
    <section
      aria-label="Mapa do seu trajeto"
      className={
        immersive
          ? "relative isolate h-full w-full overflow-hidden bg-[#121212]"
          : "relative isolate -mx-4 h-[320px] overflow-hidden bg-muted sm:mx-0 sm:h-72 sm:rounded-lg sm:border sm:border-border"
      }
      data-map-provider="google"
    >
      <div
        ref={container}
        className="absolute inset-0 z-0"
        role="img"
        aria-label="Mapa Google do radar CARONAA"
      />
      {failed && <MapUnavailable />}
      {!ready && !failed && (
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
        className={
          immersive
            ? "absolute right-3 top-32 z-10 size-12 bg-background shadow-sm"
            : "absolute bottom-8 right-3 z-10 size-12 bg-background shadow-sm"
        }
        disabled={locating}
        aria-label="Centralizar na minha localização"
        title="Centralizar na minha localização"
        onClick={onRecenter}
      >
        <LocateFixed
          size={21}
          className={locating ? "animate-pulse" : following ? "text-primary" : ""}
        />
      </Button>
      {routeMetrics && (
        <div
          role="status"
          className={`absolute left-3 ${immersive ? "top-32" : "top-3"} z-10 rounded-xl bg-background/95 px-3 py-2 text-xs font-bold shadow-md`}
        >
          Trajeto pelas ruas: {routeMetrics.km.toFixed(1).replace(".", ",")} km · cerca de{" "}
          {Math.max(1, Math.round(routeMetrics.minutes))} min
        </div>
      )}
      {routeError && (
        <div
          role="status"
          className={`absolute left-3 right-16 ${immersive ? "top-32" : "top-3"} z-10 rounded-lg bg-background/95 px-3 py-2 text-xs shadow-sm`}
        >
          Não foi possível traçar a rota. Ajuste os pontos ou tente novamente.
        </div>
      )}
    </section>
  );
}
