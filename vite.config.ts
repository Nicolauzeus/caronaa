// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Preserve deployment bindings; local files must not overwrite them with blanks.
const localEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
for (const [key, value] of Object.entries(localEnv)) {
  if (!process.env[key] && value) process.env[key] = value;
}

// Only these public connection values may cross into the browser bundle.
// Cloud deployments may supply the unprefixed bindings instead of VITE_*.
const publicConnection = {
  VITE_SUPABASE_URL: process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"],
};
const publicConnectionDefines: Record<string, string> = {};
for (const [key, value] of Object.entries(publicConnection)) {
  if (!value) {
    // Some build environments (e.g. publish pipeline) inject these later;
    // warn instead of failing the whole build.
    console.warn(`[caronaa] build configuration missing: ${key}`);
    continue;
  }
  publicConnectionDefines[`import.meta.env.${key}`] = JSON.stringify(value);
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: publicConnectionDefines,
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },
});
