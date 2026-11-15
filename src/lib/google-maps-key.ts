type KeyEnvironment = Record<string, unknown>;

/** Browser key only. Never falls back to the server key (GOOGLE_MAPS_API_KEY). */
export function resolveGoogleMapsBrowserKey(
  server: KeyEnvironment = {},
  vite: KeyEnvironment = {},
): string {
  return (
    [
      server.GOOGLE_MAPS_BROWSER_API_KEY,
      vite.VITE_GOOGLE_MAPS_BROWSER_API_KEY,
    ]
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      ?.trim() ?? ""
  );
}
