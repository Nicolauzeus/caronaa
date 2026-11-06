import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { useEffect, useState } from "react";
import { GoogleMapSurface } from "./GoogleMapSurface";

export type LiveMapPoint = {
  lat: number;
  lng: number;
  title: string;
  type: "driver" | "passenger" | "meeting" | "destination";
};
type Coordinates = [number, number]; // latitude, longitude
type RoadRoute = {
  geometry: Coordinates[];
  distanceKm: number;
  durationMinutes: number;
};

function validPoint(p: LiveMapPoint) {
  return (
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lng) <= 180
  );
}
export function routeWaypoints(
  points: LiveMapPoint[],
  skipMeeting = false,
): LiveMapPoint[] {
  const find = (type: LiveMapPoint["type"]) =>
    points.find((p) => p.type === type && validPoint(p));
  const driver = find("driver");
  const meeting = find("meeting");
  const destination = find("destination");
  return [driver, skipMeeting ? undefined : meeting, destination]
    .filter((p): p is LiveMapPoint => Boolean(p))
    .filter(
      (p, i, arr) =>
        i === 0 ||
        Math.abs(p.lat - arr[i - 1].lat) + Math.abs(p.lng - arr[i - 1].lng) >
          0.00001,
    );
}
export async function fetchRoadRoute(
  points: LiveMapPoint[],
  signal?: AbortSignal,
  skipMeeting = false,
): Promise<RoadRoute | null> {
  const waypoints = routeWaypoints(points, skipMeeting);
  if (waypoints.length < 2) return null;
  const route = await getMapDrivingRoute({
    data: { points: waypoints.map(({ lat, lng }) => ({ lat, lng })) },
    signal,
  });
  return {
    geometry: route.routePath.map(({ lat, lng }) => [lat, lng]),
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
  };
}

export function LiveRideMap({
  points,
  skipMeeting = false,
}: {
  points: LiveMapPoint[];
  skipMeeting?: boolean;
}) {
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const [routeError, setRouteError] = useState(false);
  const positions = points.filter(validPoint);
  const routeKey = routeWaypoints(positions, skipMeeting)
    .map((p) => p.type + ":" + p.lat.toFixed(4) + "," + p.lng.toFixed(4))
    .join("|");

  useEffect(() => {
    if (routeKey.split("|").filter(Boolean).length < 2) {
      setRoad(null);
      setRouteError(false);
      return;
    }
    setRoad(null);
    setRouteError(false);
    const abort = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetchRoadRoute(points, abort.signal, skipMeeting)
        .then((result) => {
          if (!abort.signal.aborted) {
            setRoad(result);
            setRouteError(false);
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setRoad(null);
            setRouteError(true);
          }
        });
    }, 400);
    return () => {
      window.clearTimeout(timeout);
      abort.abort();
    };
    // Stable waypoint key deliberately avoids refetching at every GPS jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, skipMeeting]);

  return (
    <GoogleMapSurface
      points={positions.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        title: p.title,
        color:
          p.type === "driver"
            ? "#121212"
            : p.type === "destination"
              ? "#FFBB00"
              : "#2563eb",
      }))}
      lines={
        road
          ? [
              {
                points: road.geometry.map(([lat, lng]) => ({ lat, lng })),
                color: "#FFBB00",
              },
            ]
          : []
      }
      fitMode="once"
      className="h-72 w-full"
      ariaLabel={"Mapa da viagem: " + positions.map((p) => p.title).join(", ")}
    >
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[85%] rounded-md bg-background/95 px-2 py-1 text-[11px] text-foreground shadow">
        {road
          ? "Rota pelas vias · " +
            road.distanceKm.toFixed(1) +
            " km · cerca de " +
            Math.round(road.durationMinutes) +
            " min (estimativa)"
          : routeError
            ? "Rota indisponível. Marcadores não representam o percurso."
            : "Carregando trajeto rodoviário…"}
      </div>
    </GoogleMapSurface>
  );
}
