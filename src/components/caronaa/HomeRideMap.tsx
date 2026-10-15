import { memo, useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { validPoint, type UserPosition } from "@/lib/location/use-user-location";

type Point = { lat?: number; lng?: number };
type Props = {
  userPosition: UserPosition | null;
  origin?: Point;
  destination?: Point;
  originIsCurrent: boolean;
  following: boolean;
  recenterVersion: number;
  locating: boolean;
  onDrag: () => void;
  onRecenter: () => void;
};

export const HomeRideMap = memo(function HomeRideMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    L: typeof Leaflet;
    map: Leaflet.Map;
    markers: Leaflet.LayerGroup;
    routeLine: Leaflet.Polyline | null;
  } | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [roadRoute, setRoadRoute] = useState<{ path: [number, number][]; km: number; minutes: number } | null>(null);
  const [routeError, setRouteError] = useState(false);
  const origin = props.originIsCurrent && validPoint(props.userPosition) ? props.userPosition : props.origin;
  const originLat = origin?.lat, originLng = origin?.lng;
  const destLat = props.destination?.lat, destLng = props.destination?.lng;
  useEffect(() => {
    if (!validPoint({ lat: originLat, lng: originLng }) || !validPoint({ lat: destLat, lng: destLng })) {
      setRoadRoute(null);
      setRouteError(false);
      return;
    }
    let alive = true;
    const abort = new AbortController();
    setRoadRoute(null);
    setRouteError(false);
    const timer = window.setTimeout(async () => {
      const timeout = window.setTimeout(() => abort.abort(), 8000);
      try {
        const coords = String(originLng) + "," + String(originLat) + ";" + String(destLng) + "," + String(destLat);
        const response = await fetch("https://router.project-osrm.org/route/v1/driving/" + coords + "?overview=full&geometries=geojson&steps=false", { signal: abort.signal });
        if (!response.ok) throw new Error("Router unavailable");
        const data = await response.json();
        const route = data.routes?.[0];
        if (data.code !== "Ok" || !route || !Number.isFinite(route.distance) ||
            !Number.isFinite(route.duration) || route.distance <= 0 ||
            !Array.isArray(route.geometry?.coordinates) || route.geometry.coordinates.length < 2) {
          throw new Error("Invalid route");
        }
        const path = route.geometry.coordinates.map((p: number[]) => {
          if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) {
            throw new Error("Invalid coordinate");
          }
          return [p[1], p[0]] as [number, number];
        });
        if (alive) setRoadRoute({ path, km: route.distance / 1000, minutes: route.duration / 60 });
      } catch {
        if (alive) setRouteError(true);
      } finally {
        window.clearTimeout(timeout);
      }
    }, 350);
    return () => { alive = false; window.clearTimeout(timer); abort.abort(); };
  }, [originLat, originLng, destLat, destLng]);

  const hasPoint =
    validPoint(props.userPosition) || validPoint(props.origin) || validPoint(props.destination);
  useEffect(() => {
    if (!hasPoint || !container.current) return;
    let alive = true;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (!alive || !container.current) return;
        const current = latest.current;
        const point = [current.userPosition, current.origin, current.destination].find(validPoint)!;
        const map = L.map(container.current, {
          zoomControl: false,
          scrollWheelZoom: false,
        }).setView([point.lat, point.lng], 16);
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        tiles.on("tileerror", () => {
          if (alive) setMapError(true);
        });
        tiles.on("tileload", () => {
          if (alive) setMapError(false);
        });
        map.on("dragstart", () => latest.current.onDrag());
        const markers = L.layerGroup().addTo(map);
        runtime.current = { L, map, markers, routeLine: null };
        if (typeof ResizeObserver !== "undefined") {
          resize = new ResizeObserver(() => map.invalidateSize());
          resize.observe(container.current);
        }
        setReady(true);
      })
      .catch((error) => {
        console.warn("[HomeMap] Map unavailable", error);
        if (alive) setMapError(true);
      });
    return () => {
      alive = false;
      resize?.disconnect();
      runtime.current?.map.remove();
      runtime.current = null;
      setReady(false);
    };
  }, [hasPoint]);

  useEffect(() => {
    const instance = runtime.current;
    if (!ready || !instance) return;
    const { L, map, markers } = instance;
    markers.clearLayers();
    if (validPoint(props.userPosition)) {
      const { lat, lng, accuracy } = props.userPosition;
      L.circle([lat, lng], {
        radius: accuracy,
        color: "#2563eb",
        weight: 1,
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(markers);
      L.circleMarker([lat, lng], {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .bindTooltip("Sua localização")
        .addTo(markers);
    }
    if (validPoint(props.origin) && !props.originIsCurrent)
      L.circleMarker([props.origin.lat, props.origin.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#b38600",
        fillOpacity: 1,
      })
        .bindTooltip("Saída")
        .addTo(markers);
    if (validPoint(props.destination))
      L.circleMarker([props.destination.lat, props.destination.lng], {
        radius: 9,
        color: "#171717",
        weight: 2,
        fillColor: "#f5b800",
        fillOpacity: 1,
      })
        .bindTooltip("Destino")
        .addTo(markers);
  }, [
    ready,
    props.userPosition,
    props.origin?.lat,
    props.origin?.lng,
    props.destination?.lat,
    props.destination?.lng,
    props.originIsCurrent,
  ]);

  useEffect(() => {
    const current = runtime.current;
    if (!ready || !current) return;
    current.routeLine?.remove();
    current.routeLine = null;
    if (!roadRoute) return;
    const line = current.L.polyline(roadRoute.path, {
      color: "#FFB000", weight: 6, opacity: 0.96, lineCap: "round", lineJoin: "round",
    }).addTo(current.map);
    current.routeLine = line;
    current.map.fitBounds(line.getBounds(), {
      paddingTopLeft: [30, 40], paddingBottomRight: [35, 100], maxZoom: 16, animate: false,
    });
  }, [roadRoute, ready]);

  const previous = useRef<string | null>(null);
  const recentered = useRef(props.recenterVersion);
  const cameraMode = useRef<"user" | "route">("user");
  useEffect(() => {
    const instance = runtime.current;
    if (!ready || !instance) return;
    const routeKey = `${props.originIsCurrent ? "current" : `${props.origin?.lat},${props.origin?.lng}`}:${props.destination?.lat},${props.destination?.lng}`;
    const newRoute = previous.current !== routeKey;
    previous.current = routeKey;
    const explicitRecenter = recentered.current !== props.recenterVersion;
    recentered.current = props.recenterVersion;
    if (explicitRecenter && validPoint(props.userPosition)) {
      cameraMode.current = "user";
      instance.map.setView([props.userPosition.lat, props.userPosition.lng], 16, {
        animate: false,
      });
    } else if (
      validPoint(props.origin) &&
      validPoint(props.destination) &&
      (newRoute || (cameraMode.current === "route" && props.following && props.originIsCurrent))
    ) {
      cameraMode.current = "route";
      instance.map.fitBounds(
        [
          [props.origin.lat, props.origin.lng],
          [props.destination.lat, props.destination.lng],
        ],
        { paddingTopLeft: [32, 32], paddingBottomRight: [48, 72], maxZoom: 16, animate: false },
      );
    } else if (props.following && validPoint(props.userPosition) && cameraMode.current === "user") {
      instance.map.panTo([props.userPosition.lat, props.userPosition.lng], { animate: false });
    } else if (newRoute) {
      const point = [props.origin, props.destination].find(validPoint);
      if (point) instance.map.setView([point.lat, point.lng], 16, { animate: false });
    }
  }, [
    ready,
    props.following,
    props.recenterVersion,
    props.userPosition,
    props.origin?.lat,
    props.origin?.lng,
    props.destination?.lat,
    props.destination?.lng,
    props.originIsCurrent,
  ]);

  return (
    <section
      aria-label="Mapa do seu trajeto"
      className="relative isolate -mx-4 h-[320px] overflow-hidden bg-muted sm:mx-0 sm:h-72 sm:rounded-lg sm:border sm:border-border"
    >
      <div ref={container} className="absolute inset-0 z-0" aria-label="Mapa interativo" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <MapPin className="text-primary" size={28} />
          <p className="text-sm text-muted-foreground">
            {props.locating ? "Localizando você..." : "Informe sua saída para ver o mapa."}
          </p>
        </div>
      )}
      {ready && props.locating && (
        <p
          role="status"
          className="absolute left-3 top-3 rounded-md bg-background px-3 py-2 text-xs shadow-sm"
        >
          Localizando você...
        </p>
      )}
      {roadRoute && (
        <p role="status" className="absolute left-3 top-3 z-10 rounded-xl bg-background/95 px-3 py-2 text-xs font-bold shadow-md">
          Trajeto pelas ruas: {roadRoute.km.toFixed(1).replace(".", ",")} km · cerca de {Math.max(1, Math.round(roadRoute.minutes))} min
        </p>
      )}
      {routeError && (
        <p role="status" className="absolute left-3 right-16 top-3 z-10 rounded-lg bg-background/95 px-3 py-2 text-xs shadow-sm">
          Não foi possível traçar a rota. Ajuste os pontos ou tente novamente.
        </p>
      )}
      {mapError && (
        <p
          role="status"
          className="absolute left-3 right-16 top-3 rounded-md bg-background px-3 py-2 text-xs shadow-sm"
        >
          Mapa indisponível agora. Você pode continuar pelo endereço.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute bottom-8 right-3 size-12 bg-background shadow-sm"
        onClick={props.onRecenter}
        disabled={props.locating}
        aria-label="Centralizar na minha localização"
        title="Centralizar na minha localização"
      >
        <LocateFixed
          size={21}
          className={props.locating ? "animate-pulse" : props.following ? "text-primary" : ""}
        />
      </Button>
    </section>
  );
});
