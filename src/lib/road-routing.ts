/**
 * OSRM public demo router. The caller must fail closed when this best-effort
 * endpoint is unavailable; straight-line distance is never a fallback.
 */
export async function getDrivingDistanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  request: typeof fetch = fetch,
): Promise<number> {
  for (const point of [origin, destination]) {
    if (
      !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90 ||
      !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180
    ) throw new Error("Coordenadas inválidas para calcular o percurso.");
  }

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`;
  const response = await request(url, {
    headers: { Accept: "application/json", "User-Agent": "CARONAA/1.0 (ride fare quote)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Serviço de rotas indisponível (HTTP ${response.status}).`);

  const result = (await response.json()) as {
    code?: string;
    routes?: Array<{ distance?: number }>;
  };
  const meters = result.routes?.[0]?.distance;
  if (result.code !== "Ok" || typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) {
    throw new Error("Não foi possível calcular o percurso rodoviário.");
  }
  return meters / 1000;
}
