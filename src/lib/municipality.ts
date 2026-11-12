export type Municipality = { placeId: string; name: string; state: string };
type Component = { longText?: string; shortText?: string; types?: string[] };
export function municipalityFromGoogle(place: { id?: string; types?: string[]; addressComponents?: Component[] }): Municipality | null {
  const components = place.addressComponents ?? [];
  const find = (type: string) => components.find(c => c.types?.includes(type));
  const country = find("country")?.shortText;
  const city = find("administrative_area_level_2")?.longText ?? find("locality")?.longText;
  const state = find("administrative_area_level_1")?.shortText;
  if (!place.id || !city || !state || country !== "BR" || !place.types?.some(t => t === "locality" || t === "administrative_area_level_2")) return null;
  return { placeId: place.id, name: city, state };
}