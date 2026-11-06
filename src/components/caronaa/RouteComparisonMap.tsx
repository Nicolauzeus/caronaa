import { GoogleMapSurface } from "./GoogleMapSurface";
import type { RouteStop } from "@/lib/multi-stop-routing";
import type { RoadPoint } from "@/lib/road-routing";

export function RouteComparisonMap(props: {
  originalRoute: RoadPoint[];
  suggestedRoute: RoadPoint[];
  stops: RouteStop[];
  origin: RoadPoint;
  destination: RoadPoint;
}) {
  const { originalRoute, suggestedRoute, stops, origin, destination } = props;
  return (
    <GoogleMapSurface
      points={[
        {
          lat: origin.lat,
          lng: origin.lng,
          title: "Partida do motorista",
          color: "#2563eb",
        },
        {
          lat: destination.lat,
          lng: destination.lng,
          title: "Destino do motorista",
          color: "#FFBB00",
        },
        ...stops.map((stop) => ({
          lat: stop.point.lat,
          lng: stop.point.lng,
          title: stop.label,
          color: "#121212",
        })),
      ]}
      lines={[
        { points: originalRoute, color: "#6B7280", label: "Rota direta" },
        {
          points: suggestedRoute,
          color: "#FFBB00",
          label: "Rota sugerida com paradas",
        },
      ]}
      className="h-72 w-full rounded-lg border border-border"
      ariaLabel={
        "Mapa comparativo com rota direta e " +
        stops.length +
        " paradas sugeridas"
      }
    />
  );
}
