import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publishVerifiedProfessionalPosition } from "@/lib/professional-radar.functions";
import { supabase } from "@/integrations/supabase/client";
import { professionalRadarConsentKey } from "@/lib/professional-radar-consent";
import { f07RadarAccuracyBand, f07RadarFailureCode, f07RadarTraceId } from "@/lib/professional-radar-diagnostics";

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
    const log=(stage:string,code?:string, details:Record<string,string>={})=>{
      // No GPS coordinates, account IDs, access tokens or raw SQL errors.
      const entry={at:new Date().toISOString(),stage,...(code?{code}:{}),...details};
      if(code)console.warn("[CARONAA][F07][GPS][sync]",entry);
      else console.info("[CARONAA][F07][GPS][sync]",entry);
    };

    const stop = (deleteStored = true) => {
      log("SYNC_STOP",undefined,{deleteStored:deleteStored?"yes":"no"});
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
      log("SYNC_GPS_FIX",undefined,{accuracy:f07RadarAccuracyBand(position.coords.accuracy)});
      if(position.coords.accuracy>100 && position.coords.accuracy<=5000) log("SYNC_GPS_LOW_ACCURACY","GPS_LOW_ACCURACY",{accuracy:f07RadarAccuracyBand(position.coords.accuracy),guidance:"Procure janela ou ceu aberto"});
      lastGpsAttemptAt = Date.now();
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) {
        log("SYNC_INVALID_FIX", "GPS_INVALID_FIX");
        return;
      }
      if (!Number.isFinite(position.timestamp) || Date.now()-position.timestamp>30000 ||
          position.timestamp-Date.now()>5000) {
        log("SYNC_STALE_FIX", "STALE_GPS");
        return;
      }
      if (accuracy>150) {
        log("SYNC_LOW_ACCURACY", "GPS_LOW_ACCURACY");
        return;
      }
      publishing = true;
      const epoch = generation;
      const ref=f07RadarTraceId();
      log("SYNC_PUBLISH_REQUEST",undefined,{ref});
      try {
        const result = await publisherRef.current({
          data: { lat: latitude, lng: longitude, accuracyM: accuracy, sampledAtMs: position.timestamp, traceId:ref },
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
          log("SYNC_NOT_PUBLISHED",result.reason,{ref:result.traceId??ref});
          // Temporary geocoding/GPS failures must not erase a still-fresh
          // consented position; the server's TTL expires it automatically.
          if (result.reason === "OUTSIDE_APPROVED_ZONE")
            void (supabase as any).rpc("professional_location_stop");
        }else{
          log("SYNC_PUBLISHED",undefined,{ref:result.traceId??ref,city:result.municipality});
        }
      } catch (e) {
        log("SYNC_PUBLISH_ERROR",f07RadarFailureCode(e),{ref});
        // A shared rate gate may reject a duplicate update during navigation.
        // Keep the consented watch; retry on the next heartbeat.
        if (e instanceof Error && e.message.includes("Aguarde alguns segundos")) return;
        if (!disposed && epoch === generation) log("SYNC_RETRY_SCHEDULED",f07RadarFailureCode(e),{ref});
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
        if (disposed || generation !== epoch) return;
        if (presence.error || access.error || fees.error ||
            access.data?.authorized !== true || fees.data?.driverAllowed !== true ||
            presence.data?.is_available !== true) {
          log("SYNC_START_BLOCKED",presence.error?"PRESENCE_RPC_ERROR":
            access.error?"ACCESS_RPC_ERROR":fees.error?"FEES_RPC_ERROR":
            access.data?.authorized!==true?"ACCESS_NOT_AUTHORIZED":
            fees.data?.driverAllowed!==true?"FEES_BLOCKED":"DRIVER_OFFLINE", {
              authorized:access.data?.authorized===true?"yes":"no",
              presenceOnline:presence.data?.is_available===true?"yes":"no",
              feesAllowed:fees.data?.driverAllowed===true?"yes":"no",
            });
          return;
        }

        // Do not use the stored/profile municipality for GPS publications.
        // The privileged server endpoint resolves the CURRENT city per fix.
        // Renew presence only when the user did not explicitly choose offline.
        const { error } = await (supabase as any).rpc("set_professional_presence", {
          p_available: true,
          p_municipality: null,
        });
        if (error || disposed || generation !== epoch) {
          if (error) log("SYNC_PRESENCE_REFRESH_FAILED",String(error.code??"PRESENCE_RPC_ERROR"));
          return;
        }

        log("SYNC_WATCH_STARTED");
        watchId = navigator.geolocation.watchPosition(
          position => { void publish(position); },
          position => {
            log("SYNC_BROWSER_GPS_ERROR",position.code===1?"GPS_PERMISSION_DENIED":
              position.code===3?"GPS_TIMEOUT":"GPS_UNAVAILABLE");
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
              log("SYNC_HEARTBEAT_STOPPED",stateError?"PRESENCE_RPC_ERROR":"DRIVER_OFFLINE");
              stop();
              return;
            }
            const { error: heartbeatError } = await (supabase as any)
              .rpc("set_professional_presence", {
                p_available: true, p_municipality: null,
              });
            if (heartbeatError || disposed) {
              if(heartbeatError) log("SYNC_HEARTBEAT_FAILED",String(heartbeatError.code??"PRESENCE_RPC_ERROR"));
              stop();
              return;
            }
            navigator.geolocation.getCurrentPosition(
              position => { void publish(position); },
              reason => { log("SYNC_HEARTBEAT_GPS_ERROR",reason.code===1?"GPS_PERMISSION_DENIED":reason.code===3?"GPS_TIMEOUT":"GPS_UNAVAILABLE"); },
              { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
            );
          })();
        }, 30000);
      } catch {
        log("SYNC_START_FAILED","NETWORK_OR_SERVER_ERROR");
        // An unavailable session/network never authorizes location sharing.
      } finally {
        starting = false;
      }
    };

    const visibility = () => {
      // Do NOT erase position on tab switch. An existing consented watch may
      // continue; if throttled, the server-side 90s TTL removes stale pins.
      log(document.hidden?"SYNC_TAB_HIDDEN":"SYNC_TAB_VISIBLE");
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
