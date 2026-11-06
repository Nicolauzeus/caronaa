/** Server credentials only. A known Maps JavaScript key is never a REST fallback. */
export function getGoogleServerKey(): string | null {
  if (
    typeof window !== "undefined" &&
    !import.meta.env.SSR &&
    import.meta.env.MODE !== "test"
  )
    return null;
  const env = typeof process !== "undefined" ? process.env : {};
  const vite = import.meta.env ?? {};
  const browserKeys = [
    env.GOOGLE_MAPS_BROWSER_API_KEY,
    env.VITE_GOOGLE_MAPS_BROWSER_API_KEY,
    vite.VITE_GOOGLE_MAPS_BROWSER_API_KEY,
  ]
    .filter(Boolean)
    .map((value) => value!.trim());
  const candidates = [
    env.GOOGLE_MAPS_API_KEY,
    env.GOOGLE_PLACES_API_KEY,
    env.VITE_GOOGLE_MAPS_API_KEY,
    vite.VITE_GOOGLE_MAPS_API_KEY,
  ];
  return (
    candidates
      .map((key) => key?.trim())
      .find((key) => key && !browserKeys.includes(key)) || null
  );
}
