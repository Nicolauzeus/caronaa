import type { CapacitorConfig } from "@capacitor/cli";

// Connected homologation shell; the TanStack Start SSR runtime stays on the server.
const config: CapacitorConfig = {
  appId: "com.caronaa.app",
  appName: "CARONAA",
  webDir: "native-shell",
  server: {
    url: "https://caronaa.com",
    cleartext: false,
    errorPath: "index.html",
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
