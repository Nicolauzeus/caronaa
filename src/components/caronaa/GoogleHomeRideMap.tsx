import type { StrictPickupPreview } from "@/lib/safe-pickup";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { resolveGoogleMapsBrowserKey } from "@/lib/google-maps-key";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/google-maps-loader";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import { MapUnavailable } from "./MapUnavailable";
import { tripMarkerIcon, type TripMarkerKind } from "./trip-marker-icons";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { LocateFixed, MapPin } from "lucide-react";
import { validPoint, type UserPosition } from "@/lib/location/use-user-location";
import { areNearbyPoints, isTrustedGpsFix } from "@/lib/location/gps-trust";
import { canPreviewPassengerPickup } from "@/lib/location/passenger-pickup";
import type { ApproximateProfessionalDriver } from "./HomeRideMap";

type Point = { lat?: number; lng?: number };
type Props = {
  pickupPreview?: StrictPickupPreview | null;
  /** Explicit passenger-only opt-in. Driver consumers retain the 80m rule. */
  passengerPreview?: boolean;
  immersive?: boolean;
  routeManagedExternally?:boolean;
  routeBottomInset?:number;
  routeLeftInset?:number;
  onRouteMeeting?: {origin:{lat:number;lng:number};pickup:{lat:number;lng:number;poiName:string}}|null;
  plannedRoute?:{routePath:Array<{lat:number;lng:number}>;distanceKm:number;durationMinutes:number}|null;
  userPosition: UserPosition | null;
  professionalDrivers?: ApproximateProfessionalDriver[];
  origin?: Point;
  destination?: Point;
  originIsCurrent: boolean;
  originAccuracyM?: number | null;
  following: boolean;
  recenterVersion: number;
  locating: boolean;
  onDrag: () => void;
  onRecenter: () => void;
  selectingOrigin?: boolean;
  onPickOrigin?: (point: { lat: number; lng: number }) => void;
};

// The server RPC resolves the public browser key without exposing server secrets.
export const googleMapsBrowserKey = resolveGoogleMapsBrowserKey(
  typeof process !== "undefined" ? process.env : {},
  import.meta.env,
);

export function GoogleHomeRideMap({
  immersive = false,
  pickupPreview = null,
  passengerPreview = false,
  routeManagedExternally = false,
  routeBottomInset = 160,
  routeLeftInset = 48,
  onRouteMeeting = null,
  plannedRoute = null,
  userPosition,
  professionalDrivers = [],
  origin,
  destination,
  originIsCurrent,
  originAccuracyM,
  following,
  recenterVersion,
  locating,
  onDrag,
  onRecenter,
  selectingOrigin = false,
  onPickOrigin,
}: Props) {
  const getServerBrowserKey = useServerFn(getGoogleMapsBrowserKey);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const routePolyline = useRef<any>(null);
  const circle = useRef<any>(null);
  const pickupLines = useRef<any[]>([]);
  const onRouteOverlay = useRef<any[]>([]);
  const currentCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastManualOrigin = useRef<string | null>(null);
  const lastRecenter = useRef(recenterVersion);
  const firstGpsCentered = useRef(false);
  const dragRef = useRef(onDrag);
  dragRef.current = onDrag;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<{
    km: number;
    minutes: number;
  } | null>(null);
  const trustedGps = isTrustedGpsFix(userPosition);
  const canPreviewGps = canPreviewPassengerPickup(userPosition);
  const canDisplayGps = passengerPreview ? canPreviewGps : trustedGps;
  // Coarse browser GPS is visual context, NEVER a trusted quote origin.
  const hasApproximateBrowserFix = passengerPreview && validPoint(userPosition) &&
    Number.isFinite(userPosition.accuracy) && userPosition.accuracy > 300 &&
    userPosition.accuracy <= 5000;
  // Previewing a real approximate pickup is not consent to dispatch it.
  // Route from the selected/frozen origin, never substitute a live GPS pulse.
  const trustedAppliedOrigin = originIsCurrent
    ? (originAccuracyM == null
        ? canDisplayGps
        : Number.isFinite(originAccuracyM) && originAccuracyM >= 0 &&
          originAccuracyM <= (passengerPreview ? 300 : 80))
    : true;
  const effectiveOrigin = validPoint(origin) && trustedAppliedOrigin ? origin : undefined;

  useEffect(() => {
    let active = true;
    const unsubscribe = onGoogleMapsAuthFailure(() => {
      if (active) setFailed(true);
    });
    const initializeMap = async () => {
      const browserKey = (await getServerBrowserKey().catch(() => null)) || googleMapsBrowserKey;
      if (!active) return;
      await loadGoogleMaps(browserKey);
      if (!active || !container.current) return;
      const G = (window as any).google.maps;
      // A coarse, rejected fix must not be used as a person's map position.
      const center = [effectiveOrigin, (canDisplayGps || hasApproximateBrowserFix) ? userPosition : null, destination].find(validPoint) ?? {
        lat: -3.73,
        lng: -38.53,
      };
      currentCenter.current = { lat: center.lat, lng: center.lng };
      const instance = new G.Map(container.current, {
        center: currentCenter.current,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "cooperative",
        clickableIcons: false,
      });
      instance.addListener("dragstart", () => dragRef.current());
      map.current = instance;
      setReady(true);
    };
    void initializeMap().catch(() => {
      if (active) {
        console.warn(
          "[CARONAA/maps] Google Maps indisponível no radar da home. Verifique GOOGLE_MAPS_BROWSER_API_KEY, domínios permitidos, faturamento e Maps JavaScript API.",
        );
        setFailed(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
      setReady(false);
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
      routePolyline.current?.setMap(null);
      routePolyline.current = null;
      circle.current?.setMap(null);
      circle.current = null;
      pickupLines.current.forEach((line) => line.setMap(null));
      pickupLines.current = [];
      onRouteOverlay.current.forEach(item=>item.setMap(null));
      onRouteOverlay.current = [];
      map.current = null;
    };
    // Create once; separate effects handle async GPS and map readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current) return;
    const G = (window as any).google.maps;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];
    const add = (point: Point | null | undefined, title: string, kind: TripMarkerKind) => {
      if (!validPoint(point)) return;
      const marker = new G.Marker({
        map: map.current,
        position: { lat: point.lat, lng: point.lng },
        title,
        icon: tripMarkerIcon(kind),
        zIndex: kind === "you" ? 50 : kind === "destination" ? 40 : kind === "origin" ? 30 : 20,
      });
      markers.current.push(marker);
    };
    // An explicit manual pickup remains authoritative even if GPS arrives late.
    if (!originIsCurrent && validPoint(origin)) {
      add(origin, "Sua saída escolhida · ponto informado (não GPS ao vivo)", "you");
    } else if (originIsCurrent) {
      if (canDisplayGps) {
        add(userPosition, trustedGps ? "Você · localização GPS" : "Você · localização aproximada", "you");
      } else if (hasApproximateBrowserFix) {
        add(userPosition, "Região aproximada indicada pelo navegador · confirme o embarque no mapa", "you");
      }
      if (trustedAppliedOrigin && validPoint(origin) &&
          (!canDisplayGps || !areNearbyPoints(origin, userPosition))) {
        add(origin, "Ponto de saída registrado · não acompanha o GPS", "origin");
      }
    }
    add(destination, "Destino", "destination");
    if (pickupPreview) {
      add(pickupPreview.passenger, "Origem do passageiro", "passenger");
      add(pickupPreview.pickup.point, pickupPreview.pickup.label, "meeting");
    }
    professionalDrivers.forEach((driver) => {
      const isMoto = driver.vehicle_type === "MOTO";
      add(driver, driver.simulated
        ? "MINHA SIMULAÇÃO DE HOMOLOGAÇÃO · posição fictícia · sem viagens"
        : driver.is_self
          ? "MEU VEÍCULO · GPS real aproximado · visualização de teste"
          : (isMoto ? "Mototaxista" : "Motorista") + " disponível no radar · posição aproximada · ainda não atribuído",
        isMoto ? "availableMoto" : "availableDriver");
    });
    circle.current?.setMap(null);
    circle.current = null;
    if (originIsCurrent && (canDisplayGps || hasApproximateBrowserFix) &&
        userPosition && userPosition.accuracy > 0) {
      circle.current = new G.Circle({
        map: map.current,
        center: { lat: userPosition.lat, lng: userPosition.lng },
        radius: userPosition.accuracy,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        strokeColor: "#2563eb",
        strokeOpacity: 0.4,
        strokeWeight: 1,
      });
    }
  }, [
    ready, userPosition, professionalDrivers,
    origin?.lat, origin?.lng, destination?.lat, destination?.lng,
    originIsCurrent, trustedGps, canDisplayGps, hasApproximateBrowserFix, trustedAppliedOrigin, pickupPreview,
  ]);

  // Only an explicit selection mode may change the departure from a map tap.
  useEffect(() => {
    if (!ready || !map.current || failed || !selectingOrigin || !onPickOrigin) return;
    const listener = map.current.addListener("click", (event: any) => {
      const lat = event?.latLng?.lat?.();
      const lng = event?.latLng?.lng?.();
      if (validPoint({ lat, lng })) onPickOrigin({ lat, lng });
    });
    return () => listener?.remove?.();
  }, [ready, failed, selectingOrigin, onPickOrigin]);

  // Visual connector only: never describe it as a calculated walking route.
  useEffect(()=>{
    onRouteOverlay.current.forEach(item=>item.setMap(null));
    onRouteOverlay.current=[];
    if(!ready||!map.current||failed||!onRouteMeeting)return;
    const {origin,pickup}=onRouteMeeting;
    if(!validPoint(origin)||!validPoint(pickup))return;
    const G=(window as any).google.maps;
    const marker=new G.Marker({
      map:map.current,position:{lat:pickup.lat,lng:pickup.lng},
      title:pickup.poiName||"Ponto de Encontro no Trajeto",
      icon:{
        path:"M -7,-8 L 7,-8 L 7,3 L 0,10 L -7,3 Z",
        fillColor:"#FFBB00",fillOpacity:1,strokeColor:"#121212",strokeWeight:2,scale:1.6,
      },
      zIndex:60,
    });
    const connector=new G.Polyline({
      map:map.current,
      path:[{lat:origin.lat,lng:origin.lng},{lat:pickup.lat,lng:pickup.lng}],
      geodesic:false,strokeOpacity:0,strokeWeight:4,
      icons:[{icon:{path:"M 0,-1 0,1",strokeColor:"#FFBB00",strokeOpacity:1,scale:2},offset:"0",repeat:"12px"}],
    });
    onRouteOverlay.current=[marker,connector];
    return()=>{onRouteOverlay.current.forEach(item=>item.setMap(null));onRouteOverlay.current=[];};
  },[ready,failed,onRouteMeeting?.origin.lat,onRouteMeeting?.origin.lng,
    onRouteMeeting?.pickup.lat,onRouteMeeting?.pickup.lng,onRouteMeeting?.pickup.poiName]);

  useEffect(() => {
    if (!ready || !map.current || failed) return;
    if (originIsCurrent || !validPoint(origin)) {
      lastManualOrigin.current = null;
      return;
    }
    const key = `${origin.lat.toFixed(6)}:${origin.lng.toFixed(6)}`;
    if (lastManualOrigin.current !== key) {
      lastManualOrigin.current = key;
      map.current.panTo({ lat: origin.lat, lng: origin.lng });
    }
  }, [ready, failed, originIsCurrent, origin?.lat, origin?.lng]);

  // Keep the existing road-routing contract and bounded refresh behavior.
  const fromLat = validPoint(effectiveOrigin)
    ? Math.round(effectiveOrigin.lat * 1000) / 1000 : undefined;
  const fromLng = validPoint(effectiveOrigin)
    ? Math.round(effectiveOrigin.lng * 1000) / 1000 : undefined;
  const toLat = validPoint(destination) ? Math.round(destination.lat * 10000) / 10000 : undefined;
  const toLng = validPoint(destination) ? Math.round(destination.lng * 10000) / 10000 : undefined;
  useEffect(() => {
    if (!ready || !map.current || failed) return;
    routePolyline.current?.setMap(null);
    routePolyline.current = null;
    setRouteMetrics(null);
    setRouteError(false);
    if (pickupPreview) return;
    if (routeManagedExternally) {
      if (!plannedRoute?.routePath?.length) return;
      const G=(window as any).google.maps;
      routePolyline.current=new G.Polyline({
        map:map.current,path:plannedRoute.routePath,
        strokeColor:"#FFBB00",strokeWeight:6,strokeOpacity:0.95,
      });
      const bounds=new G.LatLngBounds();
      plannedRoute.routePath.forEach(point=>bounds.extend(point));
      map.current.fitBounds(bounds,{top:70,right:48,bottom:Math.max(72,routeBottomInset),left:Math.max(48,routeLeftInset)});
      setRouteMetrics({km:plannedRoute.distanceKm,minutes:plannedRoute.durationMinutes});
      return;
    }
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) return;
    const abort = new AbortController();
    const googleMap = map.current;
    const timer = window.setTimeout(() => {
      void getMapDrivingRoute({
        data: { points: [{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }] },
        signal: abort.signal,
      }).then((route) => {
        if (abort.signal.aborted) return;
        const G = (window as any).google.maps;
        routePolyline.current = new G.Polyline({
          map: googleMap, path: route.routePath,
          strokeColor: "#FFBB00", strokeWeight: 6, strokeOpacity: 0.95,
        });
        const bounds = new G.LatLngBounds();
        route.routePath.forEach((point) => bounds.extend(point));
        googleMap.fitBounds(bounds, { top: 48, right: 40, bottom: 72, left: 40 });
        setRouteMetrics({ km: route.distanceKm, minutes: route.durationMinutes });
      }).catch(() => {
        if (!abort.signal.aborted) setRouteError(true);
      });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
      routePolyline.current?.setMap(null);
      routePolyline.current = null;
    };
  }, [ready, failed, fromLat, fromLng, toLat, toLng, pickupPreview,
    routeManagedExternally,plannedRoute,routeBottomInset,routeLeftInset]);

  useEffect(() => {
    if (!ready || !map.current || failed) return;
    pickupLines.current.forEach((line) => line.setMap(null));
    pickupLines.current = [];
    if (!pickupPreview) return;
    const G = (window as any).google.maps;
    const lines = [new G.Polyline({
      map: map.current, path: pickupPreview.route,
      strokeColor: "#FFBB00", strokeOpacity: 0.9, strokeWeight: 6,
    })];
    if (pickupPreview.walk?.routePath.length) {
      lines.push(new G.Polyline({
        map: map.current, path: pickupPreview.walk.routePath, strokeOpacity: 0,
        icons: [{
          icon: {path: G.SymbolPath.CIRCLE, scale: 3, fillOpacity: 1,
            fillColor: "#2563eb", strokeOpacity: 1, strokeColor: "#ffffff", strokeWeight: 1},
          offset: "0", repeat: "12px",
        }],
      }));
    }
    pickupLines.current = lines;
    const bounds = new G.LatLngBounds();
    pickupPreview.walk?.routePath.forEach((point) => bounds.extend(point));
    bounds.extend(pickupPreview.passenger);
    bounds.extend(pickupPreview.pickup.point);
    map.current.fitBounds(bounds, {
      top: immersive ? 180 : 48, right: 48,
      bottom: immersive ? 340 : 72, left: 48,
    });
    return () => { lines.forEach((line) => line.setMap(null)); pickupLines.current = []; };
  }, [ready, failed, pickupPreview, immersive]);

  useEffect(() => {
    if (!ready || !map.current || failed) return;
    const recenterRequested = lastRecenter.current !== recenterVersion;
    const position = originIsCurrent
      ? ((canDisplayGps || hasApproximateBrowserFix) ? userPosition : null)
      : (validPoint(effectiveOrigin) ? effectiveOrigin : null);
    // Do not consume recenterVersion while GPS/map initialization is pending.
    if (!validPoint(position)) return;
    if (!recenterRequested && !following) return;
    const next = { lat: position.lat, lng: position.lng };
    const firstFix = originIsCurrent && !firstGpsCentered.current;
    if (recenterRequested || firstFix || !currentCenter.current ||
      Math.abs(currentCenter.current.lat - next.lat) +
        Math.abs(currentCenter.current.lng - next.lng) > 0.0005) {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion && typeof map.current.setCenter === "function") map.current.setCenter(next);
      else map.current.panTo(next);
      currentCenter.current = next;
    }
    lastRecenter.current = recenterVersion;
    if (originIsCurrent) firstGpsCentered.current = true;
  }, [ready, failed, recenterVersion, following, userPosition, canDisplayGps,
    hasApproximateBrowserFix, originIsCurrent, effectiveOrigin?.lat, effectiveOrigin?.lng]);

  return (
    <section
      aria-label="Mapa do seu trajeto"
      className={immersive
        ? "relative isolate h-full w-full overflow-hidden bg-[#121212]"
        : "relative isolate -mx-4 h-[320px] overflow-hidden bg-muted sm:mx-0 sm:h-72 sm:rounded-lg sm:border sm:border-border"}
      data-map-provider="google"
    >
      <div ref={container} className="absolute inset-0 z-0" role="img"
        aria-label={selectingOrigin ? "Toque para definir sua saída no Google Maps" : "Mapa Google do radar CARONAA"} />
      {failed && <MapUnavailable />}
      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <MapPin className="text-primary" size={28} />
          <p className="text-sm text-muted-foreground">{locating ? "Localizando você..." : "Carregando Google Maps..."}</p>
        </div>
      )}
      <Button type="button" size="icon" variant="outline"
        className={immersive ? "absolute right-3 top-32 z-10 size-12 bg-background shadow-sm"
          : "absolute bottom-8 right-3 z-10 size-12 bg-background shadow-sm"}
        disabled={locating}
        aria-label={!originIsCurrent && validPoint(origin) ? "Centralizar na saída escolhida"
          : canDisplayGps ? "Centralizar na minha localização" : "Tentar melhorar sinal GPS"}
        title={!originIsCurrent && validPoint(origin) ? "Centralizar na saída escolhida"
          : canDisplayGps ? "Centralizar na minha localização" : "Tentar melhorar sinal GPS"}
        onClick={() => {
          if (!originIsCurrent && validPoint(origin)) map.current?.panTo({ lat: origin.lat, lng: origin.lng });
          else onRecenter();
        }}>
        <LocateFixed size={21} className={locating ? "animate-pulse motion-reduce:animate-none" : following ? "text-primary" : ""}/>
      </Button>
      {originIsCurrent&&hasApproximateBrowserFix&&<div role="status"
        className={`pointer-events-none absolute left-3 right-20 z-10 rounded-lg bg-background/95 px-3 py-2 text-[11px] text-foreground shadow-sm ${immersive?"top-32":"top-3"}`}>
        GPS aproximado ({Math.round(userPosition!.accuracy)} m). Confirme o embarque no mapa; este ponto não será usado automaticamente no preço.
      </div>}
      {professionalDrivers.some(driver=>driver.simulated) && (
        <div role="status" className="pointer-events-none absolute bottom-14 left-3 z-10 rounded-lg border border-[#FFBB00]/60 bg-background/95 px-3 py-2 text-[11px] font-semibold">
          SIMULAÇÃO F07 · ponto fictício somente nesta conta · sem despacho
        </div>
      )}
      {professionalDrivers.length > 0 && (
        <div className={`pointer-events-none absolute left-3 z-10 max-w-[70%] rounded-lg bg-background/95 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm ${immersive ? "bottom-24" : "bottom-3"}`}>
          {professionalDrivers.some(driver=>!driver.is_self) ? "🚗 Motoristas disponíveis no radar · ainda não atribuídos à viagem" : "Prévia do próprio veículo · apenas teste, sem oferta de corrida"}
        </div>
      )}
      {routeMetrics && (
        <div role="status" className={`absolute left-3 ${immersive ? "top-32" : "top-3"} z-10 rounded-xl bg-background/95 px-3 py-2 text-xs font-bold shadow-md`}>
          Trajeto pelas ruas: {routeMetrics.km.toFixed(1).replace(".", ",")} km · cerca de {Math.max(1, Math.round(routeMetrics.minutes))} min
        </div>
      )}
      {routeError && (
        <div role="status" className={`absolute left-3 right-16 ${immersive ? "top-32" : "top-3"} z-10 rounded-lg bg-background/95 px-3 py-2 text-xs shadow-sm`}>
          Não foi possível traçar a rota. Ajuste os pontos ou tente novamente.
        </div>
      )}
    </section>
  );
}
