/** Pure pilot-area lookup (Haversine). Zero Google calls. */
export type PilotArea = {
  municipality: string; state: string; region: string;
  center_lat: number; center_lng: number; radius_km: number;
};
export type PilotAreaMatch = { municipality: string; state: string; region: string };

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Inside several areas → the nearest centre wins. Outside all → null. */
export function matchPilotArea(lat: number, lng: number, areas: PilotArea[]): PilotAreaMatch | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  let best: { a: PilotArea; d: number } | null = null;
  for (const a of areas) {
    const d = haversineKm(lat, lng, Number(a.center_lat), Number(a.center_lng));
    if (d <= Number(a.radius_km) && (!best || d < best.d)) best = { a, d };
  }
  return best ? { municipality: best.a.municipality, state: best.a.state, region: best.a.region } : null;
}
