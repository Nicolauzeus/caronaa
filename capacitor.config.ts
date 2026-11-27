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
  plugins: {
    LocalNotifications: { smallIcon: "ic_stat_caronaa", iconColor: "#FFBB00", sound: "caronaa_ride_alert.wav" },
    PushNotifications: { presentationOptions: ["sound", "alert"] },
  },
  // BridgeActivity is singleTask: resume reconciles existing state, not the URL.
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
