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
  } | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
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
        runtime.current = { L, map, markers };
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
