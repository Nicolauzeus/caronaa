type KeyEnvironment = Record<string, unknown>;

/** Ordered public browser-key resolution. Only a selected key leaves the server. */
export function resolveGoogleMapsBrowserKey(
  server: KeyEnvironment = {},
  vite: KeyEnvironment = {},
): string {
  return (
    [
      server.GOOGLE_MAPS_BROWSER_API_KEY,
      server.GOOGLE_MAPS_API_KEY,
      vite.VITE_GOOGLE_MAPS_BROWSER_API_KEY,
      vite.VITE_GOOGLE_MAPS_API_KEY,
    ]
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      ?.trim() ?? ""
  );
}
