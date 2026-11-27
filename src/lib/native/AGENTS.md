# src/lib/native

- Android APK (Capacitor) notification/lifecycle code goes through `src/lib/native/capacitor-bridge.ts` and `src/lib/native/driver-notifications.ts`; the APK never uses Web Push, the service worker or PWA install prompts, and FCM registration runs only when the APK has a real Firebase config. This keeps the browser flow unchanged and avoids crashes in APKs without plugins or Firebase.

- FCM tokens are bound only to the authenticated database driver role; persist via the existing RPC, retry failures on reconnect/resume, fence identity changes, revoke before signOut, and never log tokens or raw push payloads. A failed offline revocation cannot be claimed as a server deletion. Keep Web Push independent.

- Native location FGS only after authenticated explicit availability/consent and approved driver; existing consent may resume in a visible activity without prompting. Use the fixed HTTPS native location endpoint and the same server GPS policy; no refresh/service credentials or coordinates persisted/logged. Browser foreground publishing remains separate; suspend WebView background writes only while the FGS owns them. Stop on offline, logout, role change, revoked permission or explicit consent withdrawal. Never auto-start from boot or re-enable server presence. JWT expiry pauses uploads until refreshed.
