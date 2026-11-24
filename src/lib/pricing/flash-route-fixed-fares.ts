/**
 * F07 Flash fixed fares approved per directed municipality pair (24/11/2026).
 * Only server-verified origin/destination municipalities may select these;
 * the reverse direction and every other pair keep their existing pricing.
 */
export const FLASH_ROUTE_FIXED_FARES: ReadonlyArray<{
  origin: string; destination: string; fareCents: 3000;
}> = [
  { origin: "Acarape", destination: "Barreira", fareCents: 3000 },
  { origin: "Redenção", destination: "Barreira", fareCents: 3000 },
];

export function flashRouteFixedFareCents(
  originMunicipality: string, destinationMunicipality: string,
): 3000 | undefined {
  return FLASH_ROUTE_FIXED_FARES.find(r =>
    r.origin === originMunicipality && r.destination === destinationMunicipality,
  )?.fareCents;
}
