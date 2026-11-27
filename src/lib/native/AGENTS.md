# src/lib/native

- Android APK (Capacitor) notification/lifecycle code goes through `src/lib/native/capacitor-bridge.ts` and `src/lib/native/driver-notifications.ts`; the APK never uses Web Push, the service worker or PWA install prompts, and FCM registration runs only when the APK has a real Firebase config. This keeps the browser flow unchanged and avoids crashes in APKs without plugins or Firebase.
