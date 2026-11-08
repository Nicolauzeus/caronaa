/** Pure road-duration comparison; NEVER substitute departure-time differences. */
export function calculateDriverDetour(
  originalMinutes: number, originalKm: number,
  individualMinutes: number, individualKm: number,
  combinedMinutes: number,
) {
  const addedMinutes = Math.max(0, individualMinutes - originalMinutes);
  const addedKm = Math.max(0, individualKm - originalKm);
  const combinedAddedMinutes = Math.max(0, combinedMinutes - originalMinutes);
  return {
    detourMinutes: Math.round(addedMinutes * 10) / 10,
    detourKm: Math.round(addedKm * 10) / 10,
    combinedAddedMinutes: Math.round(combinedAddedMinutes * 10) / 10,
    withinLimits: addedMinutes <= 6 && combinedAddedMinutes <= 15,
  };
}
