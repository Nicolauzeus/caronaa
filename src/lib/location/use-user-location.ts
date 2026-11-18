import { useCallback, useEffect, useRef, useState } from "react";

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
  return !previous || (previous.accuracy > 80 &&
    (next.accuracy <= 80 || next.accuracy <= previous.accuracy / 2));
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
    if (window.isSecureContext === false || !navigator.geolocation) {
      setFailure(window.isSecureContext === false ? "INSECURE" : "UNSUPPORTED");
      setLocating(false);
      return;
    }
    setLocating(true);
    const current = generation.current;
    const alive = () => mounted.current && current === generation.current && !document.hidden;
    let receivedFix = false;
    let newestSampleAt = 0;
    const fail = (error: GeolocationPositionError) => {
      if (!alive()) return;
      // Permission denial is terminal; transient timeouts are not.
      if (error.code === 1) {
        setFailure("PERMISSION_DENIED");
        setLocating(false);
        stop();
        return;
      }
      if (receivedFix) return;
      setFailure(error.code === 3 ? "TIMEOUT" : "POSITION_UNAVAILABLE");
      // Keep the watcher listening: a late fix can still recover the journey.
      setLocating(false);
    };
    const update = (value: GeolocationPosition) => {
      if (!alive()) return false;
      const sampledAt = Number.isFinite(value.timestamp) ? value.timestamp : Date.now();
      if (sampledAt + 1000 < newestSampleAt) return false;
      const point = {
        lat: value.coords.latitude,
        lng: value.coords.longitude,
        accuracy: value.coords.accuracy,
      };
      if (!validPoint(point) || !Number.isFinite(point.accuracy) ||
          point.accuracy < 0 || point.accuracy > 5000) return false;
      newestSampleAt = Math.max(newestSampleAt, sampledAt);
      setPosition(point);
      setAddressPosition(previous => shouldImproveGpsOrigin(previous, point) ? point : previous);
      setFailure(null);
      setLocating(false);
      if (!receivedFix) {
        receivedFix = true;
        setRecenterVersion(version => version + 1);
      }
      return true;
    };
    // Start the continuous watcher immediately, independently of the
    // first getCurrentPosition result. Chrome/Safari may time out on that
    // initial request while delivering a usable GPS fix seconds later.
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };
    try {
      watch.current = navigator.geolocation.watchPosition(
        value => { update(value); }, fail,
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
      );
      navigator.geolocation.getCurrentPosition(
        value => { update(value); }, fail, options,
      );
    } catch {
      setLocating(false);
      setFailure("POSITION_UNAVAILABLE");
      stop();
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
