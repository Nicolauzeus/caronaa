// Verified public Lovable Cloud connection. These are not privileged credentials.
// Keeping a build-time fallback avoids depending on ignored local .env files.
const managedPublicConnection = {
  url: "https://zlzopkitvfmydceylugq.supabase.co",
  publishableKey: "sb_publishable_FoGL9W_FEfyH9wlra9BGAQ_HMJLJImV",
};

export function publicConnectionDefines(env: Record<string, string | undefined>) {
  const url = env["VITE_SUPABASE_URL"]?.trim();
  const key = env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  // Only accept a complete browser-facing pair; server bindings can point at
  // sandbox-local addresses and must not be bundled into the browser.
  const connection = url && key ? { url, publishableKey: key } : managedPublicConnection;
  return {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(connection.url),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(connection.publishableKey),
  };
}