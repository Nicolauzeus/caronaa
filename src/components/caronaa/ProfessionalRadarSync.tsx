import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishVerifiedProfessionalPosition } from "@/lib/professional-radar.functions";
import { supabase } from "@/integrations/supabase/client";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";

/**
 * Keeps a previously consented professional driver visible when navigating
 * between authenticated screens. No background GPS and no silent first opt-in.
 * Server RPCs enforce approval, region, debt and the 90-second freshness gate.
 */
export function ProfessionalRadarSync({ userId }: { userId: string }) {
  const publishVerified = useServerFn(publishVerifiedProfessionalPosition);
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

    const stop = () => {
      generation += 1;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      // Delete precise stored location immediately; stale heartbeat is also
      // excluded from discovery server-side after 90 seconds.
      void (supabase as any).rpc("professional_location_stop");
    };

    const publish = async (position: GeolocationPosition) => {
      if (disposed || document.hidden || publishing || watchId === null) return;
      if (Date.now() - lastGpsAttemptAt < 25000) return;
      lastGpsAttemptAt = Date.now();
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) return;
      publishing = true;
      const epoch = generation;
      try {
        const result = await publishVerified({
          data: { lat: latitude, lng: longitude, accuracyM: accuracy },
        });
        // Outside an authorized zone: keep the consented GPS watch, but
        // stop publishing until the driver returns to an approved municipality.
        if (!result.published && !disposed && epoch === generation) {
          void (supabase as any).rpc("professional_location_stop");
        }
      } catch {
        if (!disposed && epoch === generation) stop();
      } finally {
        publishing = false;
      }
    };

    const start = async () => {
      if (starting || disposed || document.hidden || watchId !== null ||
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
        if (disposed || document.hidden || generation !== epoch ||
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
        if (error || disposed || document.hidden || generation !== epoch) return;

        watchId = navigator.geolocation.watchPosition(
          position => { void publish(position); },
          position => {
            if (position.code === 1) {
              window.localStorage.removeItem(professionalRadarConsentKey(userId));
            }
            stop();
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
        );
        timer = window.setInterval(() => {
          if (document.hidden || disposed) return;
          if (window.localStorage.getItem(professionalRadarConsentKey(userId)) !== "yes") {
            stop();
            return;
          }
          void (async () => {
            // Do not reactivate an offline driver from another device.
            const { data: state, error: stateError } = await (supabase as any)
              .from("professional_presence").select("is_available")
              .eq("user_id", userId).maybeSingle();
            if (stateError || state?.is_available !== true || document.hidden || disposed) {
              stop();
              return;
            }
            const { error: heartbeatError } = await (supabase as any)
              .rpc("set_professional_presence", {
                p_available: true, p_municipality: null,
              });
            if (heartbeatError || document.hidden || disposed) {
              stop();
              return;
            }
            navigator.geolocation.getCurrentPosition(
              position => { void publish(position); },
              () => { stop(); },
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
      if (document.hidden) stop();
      else void start();
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
      stop();
    };
  }, [userId, publishVerified]);
  return null;
}
