import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishVerifiedProfessionalPosition } from "@/lib/professional-radar.functions";
import { supabase } from "@/integrations/supabase/client";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";

/**
 * Keeps a previously consented professional driver visible when navigating
 * between authenticated screens. Never silently opt in for the first time.
 * Browser background GPS is best-effort and may be throttled; DB freshness
 * automatically removes stale pins after 90 seconds.
 */
export function ProfessionalRadarSync({ userId }: { userId: string }) {
  const publishVerified = useServerFn(publishVerifiedProfessionalPosition);
  const publisherRef = useRef(publishVerified);
  publisherRef.current = publishVerified;
  useEffect(() => {
    if (typeof window === "undefined" ||
        window.localStorage.getItem(professionalRadarConsentKey(userId)) !== "yes" ||
        !window.isSecureContext || !navigator.geolocation) return;

    let disposed = false;
    let starting = false;
    let watchId: number | null = null;
    let timer: number | null = null;
    let publishing = false;
    let generation = 0;
    let lastGpsAttemptAt = 0;

    const stop = (deleteStored = true) => {
      generation += 1;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      // Delete precise stored location immediately; stale heartbeat is also
      // excluded from discovery server-side after 90 seconds.
      if (deleteStored)void (supabase as any).rpc("professional_location_stop");
    };

    const publish = async (position: GeolocationPosition) => {
      if (disposed || publishing || watchId === null) return;
      if (Date.now() - lastGpsAttemptAt < 25000) return;
      lastGpsAttemptAt = Date.now();
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) {
        void (supabase as any).rpc("professional_location_stop");
        return;
      }
      publishing = true;
      const epoch = generation;
      try {
        const result = await publisherRef.current({
          data: { lat: latitude, lng: longitude, accuracyM: accuracy },
        });
        // Consent may have been revoked (or page hidden) while the server
        // was resolving Google coordinates. Delete any late publication.
        const consented = window.localStorage.getItem(professionalRadarConsentKey(userId)) === "yes";
        if (disposed || epoch !== generation || !consented) {
          // A page navigation is not consent revocation. An old asynchronous
          // response must not delete a newer watch's published GPS.
          if (!consented) void (supabase as any).rpc("professional_location_stop");
          return;
        }
        // Outside an authorized zone: keep the consented GPS watch, but
        // stop publishing until the driver returns to an approved municipality.
        if (!result.published) {
          void (supabase as any).rpc("professional_location_stop");
        }
      } catch (e) {
        // A shared rate gate may reject a duplicate update during navigation.
        // Keep the consented watch; retry on the next heartbeat.
        if (e instanceof Error && e.message.includes("Aguarde alguns segundos")) return;
        if (!disposed && epoch === generation) stop();
      } finally {
        publishing = false;
      }
    };

    const start = async () => {
      if (starting || disposed || watchId !== null ||
          window.localStorage.getItem(professionalRadarConsentKey(userId)) !== "yes") return;
      starting = true;
      const epoch = generation;
      try {
        const [presence, access, fees] = await Promise.all([
          (supabase as any).from("professional_presence")
            .select("is_available,municipality").eq("user_id", userId).maybeSingle(),
          (supabase as any).rpc("get_my_professional_access"),
          (supabase as any).rpc("get_my_driver_platform_fees"),
        ]);
        if (disposed || generation !== epoch ||
            presence.error || access.error || fees.error ||
            access.data?.authorized !== true || fees.data?.driverAllowed !== true ||
            presence.data?.is_available !== true) return;

        // Do not use the stored/profile municipality for GPS publications.
        // The privileged server endpoint resolves the CURRENT city per fix.
        // Renew presence only when the user did not explicitly choose offline.
        const { error } = await (supabase as any).rpc("set_professional_presence", {
          p_available: true,
          p_municipality: null,
        });
        if (error || disposed || generation !== epoch) return;

        watchId = navigator.geolocation.watchPosition(
          position => { void publish(position); },
          position => {
            if (position.code === 1) {
              window.localStorage.removeItem(professionalRadarConsentKey(userId));
              stop();
            }
            // Timeouts are not a revocation. Keep trying while the user
            // retains permission; never fabricate or publish a stale GPS.
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
        );
        timer = window.setInterval(() => {
          if (disposed) return;
          if (window.localStorage.getItem(professionalRadarConsentKey(userId)) !== "yes") {
            stop();
            return;
          }
          void (async () => {
            // Do not reactivate an offline driver from another device.
            const { data: state, error: stateError } = await (supabase as any)
              .from("professional_presence").select("is_available")
              .eq("user_id", userId).maybeSingle();
            if (stateError || state?.is_available !== true || disposed) {
              stop();
              return;
            }
            const { error: heartbeatError } = await (supabase as any)
              .rpc("set_professional_presence", {
                p_available: true, p_municipality: null,
              });
            if (heartbeatError || disposed) {
              stop();
              return;
            }
            navigator.geolocation.getCurrentPosition(
              position => { void publish(position); },
              () => { /* Browser may throttle background GPS: TTL handles stale points. */ },
              { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
            );
          })();
        }, 30000);
      } catch {
        // An unavailable session/network never authorizes location sharing.
      } finally {
        starting = false;
      }
    };

    const visibility = () => {
      // Do NOT erase position on tab switch. An existing consented watch may
      // continue; if throttled, the server-side 90s TTL removes stale pins.
      if (!document.hidden)void start();
    };
    const consentChanged = (event: StorageEvent) => {
      if (event.key !== professionalRadarConsentKey(userId)) return;
      if (event.newValue !== "yes") stop();
      else void start();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("storage", consentChanged);
    void start();
    return () => {
      disposed = true;
      window.removeEventListener("storage", consentChanged);
      document.removeEventListener("visibilitychange", visibility);
      stop(window.localStorage.getItem(professionalRadarConsentKey(userId)) !== "yes");
    };
  }, [userId]);
  return null;
}
