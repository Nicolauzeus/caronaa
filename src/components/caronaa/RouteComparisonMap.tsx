import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { GoogleMapSurface } from "./GoogleMapSurface";
import "leaflet/dist/leaflet.css";
import "./route-comparison-map.css";
import type { RouteStop } from "@/lib/multi-stop-routing";
import type { RoadPoint } from "@/lib/road-routing";

function LegacyRouteComparisonMap({
  originalRoute,
  suggestedRoute,
  stops,
  origin,
  destination,
}: {
  originalRoute: RoadPoint[];
  suggestedRoute: RoadPoint[];
  stops: RouteStop[];
  origin: RoadPoint;
  destination: RoadPoint;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const latest = useRef({ originalRoute, suggestedRoute, stops, origin, destination });
  latest.current = { originalRoute, suggestedRoute, stops, origin, destination };

  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !container.current) return;
      const instance = L.map(container.current, { scrollWheelZoom: false });
      map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      draw(L, latest.current);
    });
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (active) draw(L, latest.current);
    });
    return () => {
      active = false;
    };
  }, [originalRoute, suggestedRoute, stops, origin, destination]);

  function draw(
    L: typeof import("leaflet"),
    route: {
      originalRoute: RoadPoint[];
      suggestedRoute: RoadPoint[];
      stops: RouteStop[];
      origin: RoadPoint;
      destination: RoadPoint;
    },
  ) {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const original = L.polyline(
      route.originalRoute.map((point) => [point.lat, point.lng] as [number, number]),
      {
        color: "var(--muted-foreground)",
        weight: 4,
        opacity: 0.7,
        dashArray: "7 8",
      },
    ).addTo(layer.current);
    const suggested = L.polyline(
      route.suggestedRoute.map((point) => [point.lat, point.lng] as [number, number]),
      {
        color: "var(--primary)",
        weight: 6,
        opacity: 0.95,
      },
    ).addTo(layer.current);
    original.bindTooltip("Rota direta");
    suggested.bindTooltip("Rota sugerida com paradas");

    const endpointIcon = (kind: "start" | "finish") =>
      L.divIcon({
        className: "route-comparison-icon",
        html: `<span class="route-endpoint-badge ${kind}">${kind === "start" ? "A" : "F"}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
    L.marker([route.origin.lat, route.origin.lng], { icon: endpointIcon("start") })
      .bindTooltip("Partida do motorista")
      .addTo(layer.current);
    L.marker([route.destination.lat, route.destination.lng], { icon: endpointIcon("finish") })
      .bindTooltip("Destino do motorista")
      .addTo(layer.current);

    route.stops.forEach((stop) => {
      const icon = L.divIcon({
        className: "route-comparison-icon",
        html: `<span class="route-stop-badge ${stop.kind}">${stop.sequence}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([stop.point.lat, stop.point.lng], { icon })
        .bindTooltip(stop.label)
        .addTo(layer.current as LayerGroup);
    });
    map.current.fitBounds(suggested.getBounds(), { padding: [24, 24], maxZoom: 14 });
    window.setTimeout(() => map.current?.invalidateSize(), 50);
  }

  return (
    <div
      ref={container}
      className="h-72 w-full overflow-hidden rounded-lg border border-border"
      role="img"
      aria-label={`Mapa comparativo com rota direta e ${stops.length} paradas sugeridas`}
    />
  );
}

/** Map for driver stop comparison. Google first, legacy Leaflet only as a fallback. */
export function RouteComparisonMap(props: {
  originalRoute: RoadPoint[];
  suggestedRoute: RoadPoint[];
  stops: RouteStop[];
  origin: RoadPoint;
  destination: RoadPoint;
}) {
  const { originalRoute, suggestedRoute, stops, origin, destination } = props;
  return <GoogleMapSurface
    points={[
      { lat: origin.lat, lng: origin.lng, title: "Partida do motorista", color: "#2563eb" },
      { lat: destination.lat, lng: destination.lng, title: "Destino do motorista", color: "#FFBB00" },
      ...stops.map((stop) => ({
        lat: stop.point.lat, lng: stop.point.lng, title: stop.label, color: "#121212",
      })),
    ]}
    lines={[
      { points: originalRoute, color: "#6B7280", label: "Rota direta" },
      { points: suggestedRoute, color: "#FFBB00", label: "Rota sugerida com paradas" },
    ]}
    className="h-72 w-full rounded-lg border border-border"
    ariaLabel={"Mapa comparativo com rota direta e " + stops.length + " paradas sugeridas"}
    fallback={<LegacyRouteComparisonMap {...props} />}
  />;
}
