import { useCallback, useEffect, useRef, useState } from "react";
import { distanceBetweenMeters } from "@/lib/quick-rides/corridor-coverage";
import { GPS_POLICY, isFreshGpsTimestamp } from "./gps-policy";

export type UserPosition = { lat: number; lng: number; accuracy: number };
export type LocationFailure =
  "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED" | "INSECURE";
export function validPoint(
  point?: { lat?: number; lng?: number } | null,
): point is { lat: number; lng: number } {
  return (
    Number.isFinite(point?.lat) &&
    Number.isFinite(point?.lng) &&
    Math.abs(point!.lat!) <= 90 &&
    Math.abs(point!.lng!) <= 180
  );
}

/** Replace a coarse initial fix only with a materially more trustworthy GPS reading.
 * Do not continuously move a chosen pickup when the person walks or GPS jitters.
 */
export function shouldImproveGpsOrigin(previous: UserPosition | null, next: UserPosition): boolean {
  if (!previous) return true;
  if (previous.accuracy > GPS_POLICY.trustedPassengerAccuracyM &&
      (next.accuracy <= GPS_POLICY.trustedPassengerAccuracyM || next.accuracy <= previous.accuracy / 2)) return true;
  // Meaningful movement can improve a provisional pickup; GPS jitter cannot.
  return next.accuracy <= Math.min(previous.accuracy, GPS_POLICY.trustedPassengerAccuracyM) &&
    distanceBetweenMeters(previous, next) > Math.max(120, previous.accuracy + next.accuracy + 50);
}

export const locationFailureMessages: Record<LocationFailure, string> = {
  PERMISSION_DENIED:
    "Não conseguimos acessar sua localização. Informe seu ponto de saída ou ative a localização nas permissões do navegador.",
  POSITION_UNAVAILABLE:
    "Sua localização está indisponível agora. Informe a saída ou tente novamente em um local com melhor sinal.",
  TIMEOUT:
    "A localização está demorando para responder. Você pode informar a saída ou tentar novamente.",
  UNSUPPORTED: "Este navegador não oferece localização. Informe seu ponto de saída.",
  INSECURE:
    "Para usar sua localização, abra o app por HTTPS. Enquanto isso, informe seu ponto de saída.",
};

export function useUserLocation({
  autoLocate = "mobile",
}: { autoLocate?: boolean | "mobile" } = {}) {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [addressPosition, setAddressPosition] = useState<UserPosition | null>(null);
  const [failure, setFailure] = useState<LocationFailure | null>(null);
  const [locating, setLocating] = useState(false);
  const [isFollowingUser, setFollowing] = useState(true);
  const [recenterVersion, setRecenterVersion] = useState(0);
  const watch = useRef<number | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const resumeWatch = useRef(false);
  const stop = useCallback(() => {
    generation.current += 1;
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);
  const locate = useCallback(() => {
    stop();
    if (!mounted.current) return;
    setFollowing(true);
    setFailure(null);
    // Avoid showing an old blue marker as if it were the live GPS after
    // returning from background or explicitly re-centering.
    setPosition(null);
    setAddressPosition(null);
    if (window.isSecureContext === false || !navigator.geolocation) {
      setFailure(window.isSecureContext === false ? "INSECURE" : "UNSUPPORTED");
      setLocating(false);
      return;
    }
    setLocating(true);
    const current = generation.current;
    const alive = () => mounted.current && current === generation.current && !document.hidden;
    let receivedFreshFix = false;
    let watchStarted = false;
    const diagnostic = (stage: string, code?: string, accuracy?: number) => {
      const band = accuracy === undefined ? undefined : accuracy <= 80 ? "0-80m"
        : accuracy <= 300 ? "81-300m" : accuracy <= 1000 ? "301-1000m" : ">1000m";
      // Privacy: no lat/lng, address, user identifier or raw browser error.
      console.info("[CARONAA][PASSENGER][GPS]", {
        stage, ...(code ? { code } : {}), ...(band ? { accuracyBand: band } : {}),
      });
    };
    const fail = (error: GeolocationPositionError) => {
      if (!alive()) return;
      const code: LocationFailure = error.code === 1 ? "PERMISSION_DENIED"
        : error.code === 3 ? "TIMEOUT" : "POSITION_UNAVAILABLE";
      diagnostic("browser_error", code);
      // Timeout/unavailable are transient; do not delete a valid sample.
      if (!receivedFreshFix) { setFailure(code); setLocating(false); }
      if (error.code === 1) stop();
    };
    const update = (value: GeolocationPosition, initial = false) => {
      if (!alive()) return false;
      if (!isFreshGpsTimestamp(value.timestamp, GPS_POLICY.driverSampleMaxAgeMs)) {
        diagnostic("sample_rejected", "STALE_SAMPLE");
        return false;
      }
      const point = {
        lat: value.coords.latitude, lng: value.coords.longitude,
        accuracy: value.coords.accuracy,
      };
      if (!validPoint(point) || !Number.isFinite(point.accuracy) || point.accuracy < 0) {
        diagnostic("sample_rejected", "INVALID_FIX");
        return false;
      }
      const isFirst = !receivedFreshFix;
      receivedFreshFix = true;
      setPosition(point);
      if (initial || isFirst) setAddressPosition(point);
      else setAddressPosition(previous => shouldImproveGpsOrigin(previous, point) ? point : previous);
      setFailure(null);
      setLocating(false);
      // A first valid watch callback must unblock pending "use my location"
      // even when getCurrentPosition timed out or returned a stale sample.
      if (isFirst) {
        diagnostic("first_fix", undefined, point.accuracy);
        setRecenterVersion(version => version + 1);
      }
      return true;
    };
    const startWatch = () => {
      if (!alive() || watchStarted) return;
      watchStarted = true;
      try {
        watch.current = navigator.geolocation.watchPosition(
          value => { update(value); }, fail,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
        diagnostic("watch_started");
      } catch {
        diagnostic("watch_failed", "WATCH_UNAVAILABLE");
        if (!receivedFreshFix) { setFailure("POSITION_UNAVAILABLE"); setLocating(false); }
      }
    };
    try {
      navigator.geolocation.getCurrentPosition(
        value => {
          if (!alive()) return;
          update(value, true);
          startWatch();
        },
        error => {
          fail(error);
          // The original implementation abandoned GPS after the first timeout.
          if (error.code !== 1) startWatch();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } catch {
      diagnostic("initial_request_failed", "POSITION_UNAVAILABLE");
      setFailure("POSITION_UNAVAILABLE");
      setLocating(false);
      startWatch();
    }
  }, [stop]);
  useEffect(() => {
    mounted.current = true;
    let autoPending =
      autoLocate === true ||
      (autoLocate === "mobile" && Boolean(window.matchMedia?.("(max-width: 1023px)").matches));
    if (autoPending && !document.hidden) {
      autoPending = false;
      locate();
    }
    const visibility = () => {
      if (document.hidden) {
        resumeWatch.current = watch.current !== null;
        stop();
        setLocating(false);
      } else if (autoPending || resumeWatch.current) {
        autoPending = false;
        resumeWatch.current = false;
        locate();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [locate, stop, autoLocate]);
  return {
    position,
    addressPosition,
    accuracyM: position?.accuracy ?? null,
    isLowAccuracy: Boolean(position && position.accuracy > 80),
    originAccuracyM: addressPosition?.accuracy ?? null,
    isOriginLowAccuracy: Boolean(addressPosition && addressPosition.accuracy > 80),
    failure,
    locating,
    isFollowingUser,
    setFollowing,
    recenterVersion,
    locate,
  };
}
