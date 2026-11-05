// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { publicConnectionDefines } from "./config/public-connection";

// Preserve deployment bindings; local files must not overwrite them with blanks.
const localEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
for (const [key, value] of Object.entries(localEnv)) {
  if (!process.env[key] && value) process.env[key] = value;
}

const connectionDefines = publicConnectionDefines(process.env);
// Populate Vite's env object as well as static replacements: generated clients
// use bracket access, and the framework also captures VITE bindings itself.
process.env["VITE_SUPABASE_URL"] = JSON.parse(connectionDefines["import.meta.env.VITE_SUPABASE_URL"]);
process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.parse(
  connectionDefines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"],
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: connectionDefines,
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        // Preserve package exports for nested entities versions (e.g. entities/decode).
      },
    },
  },
});
