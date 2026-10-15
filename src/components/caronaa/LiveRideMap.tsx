import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

export type LiveMapPoint = {
  lat: number;
  lng: number;
  title: string;
  type: "driver" | "passenger" | "meeting" | "destination";
};
type Coordinates = [number, number]; // Leaflet latitude, longitude
type RoadRoute = { geometry: Coordinates[]; distanceKm: number; durationMinutes: number };

function validPoint(p: LiveMapPoint) {
  return Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
}
export function routeWaypoints(points: LiveMapPoint[], skipMeeting = false): LiveMapPoint[] {
  const find = (type: LiveMapPoint["type"]) => points.find(p => p.type === type && validPoint(p));
  const driver = find("driver");
  const meeting = find("meeting");
  const destination = find("destination");
  return [driver, skipMeeting ? undefined : meeting, destination].filter((p): p is LiveMapPoint => Boolean(p))
    .filter((p, i, arr) => i === 0 || Math.abs(p.lat - arr[i-1].lat) + Math.abs(p.lng - arr[i-1].lng) > 0.00001);
}
export async function fetchRoadRoute(
  points: LiveMapPoint[],
  signal?: AbortSignal,
  skipMeeting = false,
): Promise<RoadRoute | null> {
  const waypoints = routeWaypoints(points, skipMeeting);
  if (waypoints.length < 2) return null;
  const coordinates = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Serviço de rotas indisponível");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("routes" in data)) throw new Error("Resposta de rotas inválida");
  const routes = (data as { routes?: Array<{distance?: number;duration?: number;geometry?: {coordinates?: number[][]}}> }).routes;
  const first = routes?.[0];
  const coords = first?.geometry?.coordinates;
  if (!first || !Array.isArray(coords) || coords.length < 2 ||
      typeof first.distance !== "number" || !Number.isFinite(first.distance) || typeof first.duration !== "number" || !Number.isFinite(first.duration)) throw new Error("Trajeto rodoviário indisponível");
  const geometry: Coordinates[] = coords.map(c => [c[1], c[0]]);
  if (geometry.some(([lat,lng]) => !Number.isFinite(lat) || !Number.isFinite(lng))) throw new Error("Coordenadas de rota inválidas");
  return { geometry, distanceKm: first.distance / 1000, durationMinutes: first.duration / 60 };
}

export function LiveRideMap({ points, skipMeeting = false }: { points: LiveMapPoint[]; skipMeeting?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const initialBoundsDone = useRef(false);
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const [routeError, setRouteError] = useState(false);
  const positions = useMemo(() => points.filter(validPoint), [points]);
  const key = routeWaypoints(positions, skipMeeting).map(p => `${p.type}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  const latest = useRef(positions);
  latest.current = positions;
  const roadLatest = useRef(road);
  roadLatest.current = road;

  useEffect(() => {
    if (routeWaypoints(positions, skipMeeting).length < 2) {
      setRoad(null);
      setRouteError(false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void fetchRoadRoute(positions, controller.signal, skipMeeting).then(result => {
        if (!controller.signal.aborted) { setRoad(result); setRouteError(false); }
      }).catch(() => {
        if (!controller.signal.aborted) { setRoad(null); setRouteError(true); }
      });
    }, 600);
    return () => { clearTimeout(timeout); controller.abort(); };
  // Rounded key avoids fetching on every small GPS movement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skipMeeting]);

  useEffect(() => {
    let active = true;
    void import("leaflet").then(L => {
      if (!active || !container.current) return;
      const instance = L.map(container.current, { zoomControl: true }).setView([-3.73, -38.53], 12);
      map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      draw(L, latest.current, roadLatest.current);
      instance.invalidateSize();
    });
    return () => { active = false; map.current?.remove(); map.current = null; layer.current = null; };
  }, []);

  function draw(L: typeof import("leaflet"), next: LiveMapPoint[], route: RoadRoute | null) {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    next.forEach(p => {
      const marker = p.type === "driver" ? "M" : p.type === "passenger" ? "P" : p.type === "meeting" ? "E" : "D";
      const icon = L.divIcon({
        className: "ride-live-marker",
        html: `<span class="ride-marker-${p.type}">${marker}</span>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      L.marker([p.lat, p.lng], { icon }).bindTooltip(p.title, { direction: "top" }).addTo(layer.current!);
    });
    if (route) {
      L.polyline(route.geometry, { color: "#FFB000", weight: 6, opacity: 0.92 }).addTo(layer.current);
    }
    if (!initialBoundsDone.current && next.length) {
      const coords = route?.geometry ?? next.map(p => [p.lat, p.lng] as Coordinates);
      map.current.fitBounds(L.latLngBounds(coords), { padding: [28, 28], maxZoom: 15 });
      initialBoundsDone.current = true;
    }
  }

  useEffect(() => {
    let active = true;
    void import("leaflet").then(L => { if (active) draw(L, positions, road); });
    return () => { active = false; };
  }, [positions, road]);

  return <div className="relative isolate z-0">
    <div ref={container} className="h-72 w-full" role="img"
      aria-label={`Mapa da viagem: ${positions.map(p => p.title).join(", ")}`} />
    <div className="absolute bottom-2 left-2 z-10 max-w-[85%] rounded-md bg-background/95 px-2 py-1 text-[11px] text-foreground shadow">
      {road ? `Rota pelas vias · ${road.distanceKm.toFixed(1)} km · cerca de ${Math.round(road.durationMinutes)} min (estimativa)`
        : routeError ? "Rota indisponível. Marcadores não representam o percurso."
        : "Carregando trajeto rodoviário…"}
    </div>
  </div>;
}
