# F07/F08 — Android 1.1.1 candidate

- The signed APK 1.1.0 remains the upgrade baseline. New native client advertises rideActions=v1 in the existing device_info JSON; no schema change. Legacy tokens still receive the old FCM notification.
- Only persisted verified municipalities are allowed, never arbitrary labels. Price uses immutable ride fields, then the single bound quote if a field is missing. Driver earnings are distinguished from passenger fare.
- Data-only FCM is handled by the private MessagingService subclass, retaining Capacitor token rotation and legacy message handling. High priority, existing sound/vibration channel, private lock-screen redaction, per-ride tag and expiry; Android controls exact style.
- Private Activity + immutable PendingIntent for open/accept; dismiss cancels local notification only. No acceptance on tap, no token in Java, no accepting another account's push. The WebView consumes one ephemeral action, checks recipient hash, expiration, current role and uses the existing respond_flash_order RPC with the intended account's session; no new database permission or bypass. On failure show a truthful error; no automatic retry or acceptance while offline.
- Verify on signed APK after site deploy: app foreground/background/process reclaimed, lock screen, permission denied, expiry, competing acceptance, account switch/logout, old APK compatibility and PWA. Force-stop is not guaranteed. Update manifest and public APK distribution are separate release steps; do not announce an untested candidate.

## Server dispatch diagnosis

Filter Lovable server logs by `fcm_payload` after a fresh ride request. Revision `ride-actions-v1-diagnostic` identifies the instrumented sender. It inspects the actual serialized payload: LEGACY vs DATA_ONLY, capability, presence of fare/earnings/cities, action kind and HTTP status (null on network failure). No user/ride IDs, tokens, hashes, cities, prices, headers or raw provider responses are logged. HTTP success is provider acceptance only. If DATA_ONLY is accepted but the legacy UI remains, inspect Android delivery/rendering separately. No change to business logic, APK or credentials.
