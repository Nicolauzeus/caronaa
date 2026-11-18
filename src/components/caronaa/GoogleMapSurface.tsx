import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { resolveGoogleMapsBrowserKey } from "@/lib/google-maps-key";
import {
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
} from "@/lib/google-maps-loader";
import { MapUnavailable } from "./MapUnavailable";
import { tripMarkerIcon, type TripMarkerKind } from "./trip-marker-icons";

export type GoogleMapPoint = {
  /** Stable marker identity: do not key by a title that changes with GPS state. */
  id?: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  label?: string;
  kind?: TripMarkerKind | "person";
};
export type GoogleMapLine = {
  points: Array<{ lat: number; lng: number }>;
  color?: string;
  label?: string;
  dotted?: boolean;
};

type Props = {
  points: GoogleMapPoint[];
  lines?: GoogleMapLine[];
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
  previewOnly?: boolean;
  fitMode?: "once" | "changes";
  /** Refits when visible marker identities change, not on GPS jitter. */
  fitKey?: string;
  /** Preserve markers and ease their GPS positions without camera jumps. */
  smoothTracking?: boolean;
  showControls?: boolean;
  gestureHandling?: "cooperative" | "greedy";
  /** Live GPS camera following, opt-in only for an active driver trip. */
  followPoint?: {lat:number;lng:number}|null;
  /** Changes when the ride or navigation leg changes. */
  followKey?: string;
  followZoom?: number;
};

const isValid = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) &&
  Math.abs(p.lat) <= 90 &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lng) <= 180;

/** Google Maps surface for ride details, tracking and itinerary previews. */
export function GoogleMapSurface({
  points,
  lines = [],
  className = "h-72 w-full",
  ariaLabel = "Mapa do percurso",
  children,
  previewOnly = false,
  fitMode = "changes",
  fitKey,
  smoothTracking = false,
  showControls = false,
  gestureHandling = "cooperative",
  followPoint = null,
  followKey,
  followZoom = 16,
}: Props) {
  const getKey = useServerFn(getGoogleMapsBrowserKey);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const artifacts = useRef<any[]>([]);
  // Stable line instances: GPS refresh never destroys a road route.
  const lineArtifacts = useRef<Map<string,{fingerprint:string;polyline:any}>>(new Map());
  const trackingMarkers = useRef<Map<string, any>>(new Map());
  const movementFrames = useRef<Map<string, number>>(new Map());
  const fitted = useRef(false);
  const lastFitKey = useRef<string | undefined>(undefined);
  const lastFitPointCount = useRef(0);
  const lastFitRouteCount = useRef(0);
  const lastBounds = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(true);
  const hasFollowFix = Boolean(followPoint && isValid(followPoint));
  const lastFollow = useRef<{lat:number;lng:number;at:number}|null>(null);
  const followInitialized = useRef(false);
  const followPointRef = useRef(followPoint);
  followPointRef.current = followPoint;

  useEffect(() => {
    let active = true;
    const unsubscribe = onGoogleMapsAuthFailure(() => {
      if (active) setFailed(true);
    });
    const initialize = async () => {
      const key =
        (await getKey().catch(() => null)) ||
        resolveGoogleMapsBrowserKey(
          typeof process !== "undefined" ? process.env : {},
          import.meta.env,
        );
      if (!key) throw new Error("Browser map key not configured");
      await loadGoogleMaps(key);
      if (!active || !container.current) return;
      const G = (window as any).google?.maps;
      if (!G?.Map) throw new Error("Google Maps JS missing after load");
      const initialPoint = points.find(isValid);
      map.current = new G.Map(container.current, {
        center: initialPoint
          ? { lat: initialPoint.lat, lng: initialPoint.lng }
          : { lat: -3.73, lng: -38.53 },
        zoom: 13,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: previewOnly ? "none" : gestureHandling,
        keyboardShortcuts: !previewOnly,
      });
      // A deliberate swipe across the map pauses camera following; GPS and
      // markers continue to update. The recenter control restores following.
      map.current.addListener("dragstart",()=>{if(active)setFollowing(false);});
      setReady(true);
    };
    void initialize().catch(() => {
      if (active) {
        console.warn(
          "[CARONAA/maps] Google Maps indisponível. Confira GOOGLE_MAPS_BROWSER_API_KEY, Maps JavaScript API, faturamento e domínios.",
        );
        setFailed(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
      artifacts.current.forEach((item) => item.setMap(null));
      artifacts.current = [];
      lineArtifacts.current.forEach(({polyline})=>polyline.setMap(null));
      lineArtifacts.current.clear();
      movementFrames.current.forEach(frame=>window.cancelAnimationFrame(frame));
      movementFrames.current.clear();
      trackingMarkers.current.clear();
      lastBounds.current = null;
      map.current = null;
    };
    // Initialize exactly once; update markers and polylines separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !map.current || failed || !container.current ||
        typeof ResizeObserver === "undefined") return;
    let frame: number | null = null;
    let previousWidth = 0;
    let previousHeight = 0;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      const height = entries[0]?.contentRect.height ?? 0;
      if (width <= 0 || height <= 0 ||
          (Math.abs(width - previousWidth) < 1 && Math.abs(height - previousHeight) < 1)) return;
      const hadSize = previousWidth > 0 && previousHeight > 0;
      previousWidth = width;
      previousHeight = height;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const G = (window as any).google?.maps;
        if (!map.current) return;
        G?.event?.trigger(map.current, "resize");
        // A bottom-sheet resize is not a new destination. Refitting here
        // moved the camera on every mobile sheet animation/keyboard resize.
        // fitMode/fitKey below explicitly control camera framing instead.
        void hadSize;
      });
    });
    observer.observe(container.current);
    return () => { observer.disconnect(); if (frame !== null) window.cancelAnimationFrame(frame); };
  }, [ready, failed]);

  useEffect(() => {
    if (!ready || !map.current || failed) return;
    const G = (window as any).google.maps;
    artifacts.current.forEach((item) => item.setMap(null));
    artifacts.current = [];
    if (!smoothTracking) {
      movementFrames.current.forEach(frame=>window.cancelAnimationFrame(frame));
      movementFrames.current.clear();
      trackingMarkers.current.forEach(marker=>marker.setMap(null));
      trackingMarkers.current.clear();
    }
    const visibleKeys = new Set<string>();
    const bounds = new G.LatLngBounds();
    let count = 0;
    const extend = (point: { lat: number; lng: number }) => {
      if (isValid(point)) {
        bounds.extend(point);
        count += 1;
      }
    };
    points.filter(isValid).forEach((point, index) => {
      const markerKey = point.id || point.title || point.kind || point.label || String(index);
      visibleKeys.add(markerKey);
      const badgeIcon = point.kind && point.kind !== "person" ? tripMarkerIcon(point.kind) : null;
      const options = {
        map: map.current,
        position: { lat: point.lat, lng: point.lng },
        title: point.title || "Localização",
        ...(point.label && !badgeIcon
          ? {
              label: {
                text: point.label,
                color: "#FFFFFF",
                fontWeight: "bold",
              },
            }
          : {}),
        icon: badgeIcon ?? {
          path:
            point.kind === "person"
              ? "M 0,-9 A 3,3 0 1,1 0,-3 A 3,3 0 1,1 0,-9 M -5,7 L -5,1 Q -5,-2 0,-2 Q 5,-2 5,1 L 5,7 Z"
              : point.kind === "meeting"
                ? "M -7,-8 L 7,-8 L 7,3 L 0,10 L -7,3 Z"
                : G.SymbolPath.CIRCLE,
          scale: point.kind ? 1.4 : 8,
          fillColor: point.color || "#FFBB00",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
        // The viewer must remain identifiable when nearby markers overlap.
        zIndex: point.kind === "you" ? 50 : point.kind === "driver" ? 40 : point.kind === "destination" ? 30 : 20,
      };
      let marker = smoothTracking ? trackingMarkers.current.get(markerKey) : null;
      if (marker) {
        marker.setOptions({title: options.title,icon: options.icon,zIndex:options.zIndex});
        const oldPosition = marker.getPosition();
        const from = oldPosition ? {lat:oldPosition.lat(),lng:oldPosition.lng()} : {lat:point.lat,lng:point.lng};
        const distance = Math.hypot(from.lat-point.lat,from.lng-point.lng);
        const pending=movementFrames.current.get(markerKey);
        if (pending!==undefined) window.cancelAnimationFrame(pending);
        const reduceMotion=typeof window.matchMedia==="function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceMotion && distance > 0 && distance < 0.01) {
          const start=performance.now();
          const animate=(now:number)=>{
            const t=Math.min(1,(now-start)/950);
            const eased=t*t*(3-2*t);
            marker.setPosition({
              lat:from.lat+(point.lat-from.lat)*eased,
              lng:from.lng+(point.lng-from.lng)*eased,
            });
            if(t<1)movementFrames.current.set(markerKey,window.requestAnimationFrame(animate));
            else movementFrames.current.delete(markerKey);
          };
          movementFrames.current.set(markerKey,window.requestAnimationFrame(animate));
        } else marker.setPosition({lat:point.lat,lng:point.lng});
      } else {
        marker = new G.Marker(options);
        if(smoothTracking)trackingMarkers.current.set(markerKey,marker);
        else artifacts.current.push(marker);
      }
      extend(point);
    });
    if(smoothTracking) {
      trackingMarkers.current.forEach((marker,key)=>{
        if(visibleKeys.has(key))return;
        marker.setMap(null);
        trackingMarkers.current.delete(key);
        const pending=movementFrames.current.get(key);
        if(pending!==undefined)window.cancelAnimationFrame(pending);
        movementFrames.current.delete(key);
      });
    }
    let validRouteCount = 0;
    const visibleLines=new Set<string>();
    lines.forEach((line,index)=>{
      const path=line.points.filter(isValid);
      if(path.length<2)return;
      validRouteCount+=1;
      const key=String(index);
      visibleLines.add(key);
      // Route geometry changes much less often than GPS marker positions.
      const fingerprint=[line.color||"#FFBB00",line.dotted?"d":"s",
        ...path.map(p=>p.lat.toFixed(6)+":"+p.lng.toFixed(6))].join("|");
      const existing=lineArtifacts.current.get(key);
      if(existing?.fingerprint!==fingerprint){
        existing?.polyline.setMap(null);
        const polyline=new G.Polyline({
          map:map.current,
          path,
          geodesic:false,
          strokeColor:line.color||"#FFBB00",
          strokeOpacity:line.dotted?0:0.95,
          ...(line.dotted?{icons:[{
            icon:{path:"M 0,-1 0,1",strokeOpacity:1,scale:2},
            offset:"0",repeat:"12px",
          }]}:{}),
          strokeWeight:5,
        });
        lineArtifacts.current.set(key,{fingerprint,polyline});
      }
      path.forEach(extend);
    });
    lineArtifacts.current.forEach(({polyline},key)=>{
      if(visibleLines.has(key))return;
      polyline.setMap(null);
      lineArtifacts.current.delete(key);
    });
    const validMarkerCount = points.filter(isValid).length;
    const newFitKey = fitKey !== undefined && lastFitKey.current !== fitKey;
    const newRoute = validRouteCount > lastFitRouteCount.current;
    const moreMarkers = validMarkerCount > lastFitPointCount.current;
    lastFitKey.current = fitKey;
    lastFitRouteCount.current = validRouteCount;
    lastFitPointCount.current = validMarkerCount;
    // Navigation owns the camera while GPS following is available. Do not
    // let fitBounds steal focus on route redraws or bottom-sheet movements.
    if(hasFollowFix)return;
    if (fitted.current && fitMode === "once" && !newFitKey && !newRoute && !moreMarkers) return;
    if (count > 0) {
      fitted.current = true;
      lastBounds.current = bounds;
    }
    if (count === 1) {
      map.current.panTo(bounds.getCenter());
      if (!fitted.current || !map.current.getZoom?.() || map.current.getZoom() < 14)
        map.current.setZoom(15);
    } else if (count > 1) {
      map.current.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
    }
  }, [ready, failed, points, lines, fitMode, fitKey, smoothTracking, hasFollowFix]);

  useEffect(()=>{
    if(!followKey)return;
    // An explicit "Acompanhar no mapa" press MUST recenter even if the GPS
    // coordinates have not changed since the last frame. Do not rely on a
    // redundant setFollowing(true) to trigger another React render.
    followInitialized.current=false;
    lastFollow.current=null;
    setFollowing(true);
    const fix=followPointRef.current;
    if(ready&&!failed&&map.current&&fix&&isValid(fix)){
      map.current.panTo({lat:fix.lat,lng:fix.lng});
      map.current.setZoom(Math.max(14,Math.min(19,followZoom)));
      lastFollow.current={lat:fix.lat,lng:fix.lng,at:Date.now()};
      followInitialized.current=true;
    }
  },[followKey,ready,failed,followZoom]);
  useEffect(()=>{
    if(!ready||failed||!map.current||!following||!followPoint||!isValid(followPoint))return;
    const now=Date.now();
    const prior=lastFollow.current;
    if(prior&&now-prior.at<850)return;
    const moved=!prior||Math.hypot(
      (followPoint.lat-prior.lat)*111195,
      (followPoint.lng-prior.lng)*111195*Math.cos(followPoint.lat*Math.PI/180),
    )>6;
    if(!moved)return;
    lastFollow.current={lat:followPoint.lat,lng:followPoint.lng,at:now};
    map.current.panTo({lat:followPoint.lat,lng:followPoint.lng});
    if(!followInitialized.current){
      map.current.setZoom(Math.max(14,Math.min(19,followZoom)));
      followInitialized.current=true;
    }
  },[ready,failed,following,followPoint?.lat,followPoint?.lng,followZoom]);

  return (
    <div
      className={
        "relative isolate z-0 overflow-hidden bg-muted/30 " + className
      }
      data-map-provider="google"
      aria-label={ariaLabel}
    >
      <div
        ref={container}
        className="absolute inset-0"
        role="img"
        aria-label={ariaLabel}
      />
      {failed && <MapUnavailable compact={previewOnly} />}
      {!ready && !failed && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground"
        >
          Carregando Google Maps...
        </div>
      )}
      {ready && !failed && showControls && !previewOnly && (
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          <button type="button"
            aria-label={hasFollowFix?(following?"Centralizar e seguir motorista":"Retomar acompanhamento do GPS"):"Centralizar mapa no motorista"}
            title={hasFollowFix&&!following?"Retomar acompanhamento automático":"Centralizar"}
            className={"flex size-11 items-center justify-center rounded-full border bg-white text-xl font-bold text-slate-900 shadow-lg "+(hasFollowFix&&following?"border-[#FFBB00] ring-2 ring-[#FFBB00]/40":"border-slate-200")}
            onClick={() => {
              const driver = followPoint&&isValid(followPoint)?followPoint:
                points.find(point => point.kind === "driver" || point.kind === "availableMoto") ?? points[0];
              if(driver&&isValid(driver)){
                map.current?.panTo({lat:driver.lat,lng:driver.lng});
                if(hasFollowFix)map.current?.setZoom(Math.max(14,Math.min(19,followZoom)));
                lastFollow.current={lat:driver.lat,lng:driver.lng,at:Date.now()};
                followInitialized.current=true;
                setFollowing(true);
              }
            }}>◎</button>
          <button type="button" aria-label="Aumentar zoom do mapa"
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-bold text-slate-900 shadow-lg"
            onClick={() => map.current?.setZoom(Math.min(20, (map.current?.getZoom() ?? 13) + 1))}>+</button>
          <button type="button" aria-label="Diminuir zoom do mapa"
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-bold text-slate-900 shadow-lg"
            onClick={() => map.current?.setZoom(Math.max(3, (map.current?.getZoom() ?? 13) - 1))}>−</button>
        </div>
      )}
      {ready && !failed && children}
    </div>
  );
}
