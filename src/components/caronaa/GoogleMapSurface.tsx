import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getGoogleMapsBrowserKey } from "@/lib/google-maps-browser.functions";
import { resolveGoogleMapsBrowserKey } from "@/lib/google-maps-key";
import {
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
} from "@/lib/google-maps-loader";
import { MapUnavailable } from "./MapUnavailable";
import { tripMarkerIcon, type TripMarkerKind } from "./trip-marker-icons";
import { cameraLookAhead, normalizedHeading, shortestHeadingDelta, snapVisualDriverPosition, type NavigationPoint } from "@/lib/quick-rides/driver-navigation";

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
  /** Adaptive road styling is opt-in and only used by the admin cockpit. */
  appearance?: "standard" | "adaptive";
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
  /** Optional parent refresh of current ride state; map itself stays mounted. */
  onRefresh?: () => void | Promise<void>;
  gestureHandling?: "cooperative" | "greedy";
  /** Live GPS camera following, opt-in only for an active driver trip. */
  followPoint?: {lat:number;lng:number}|null;
  /** Changes when the ride or navigation leg changes. */
  followKey?: string;
  followZoom?: number;
  navigationMode?: boolean;
  followHeading?: number | null;
  followAccuracyM?: number | null;
  navigationPath?: NavigationPoint[];
  navigationVehicle?: "CAR" | "MOTO";
};

const adminDarkRoadStyles = [
  { elementType:"geometry", stylers:[{color:"#111923"}] },
  { elementType:"labels.text.fill", stylers:[{color:"#a6b2c2"}] },
  { elementType:"labels.text.stroke", stylers:[{color:"#111923"}] },
  { featureType:"road", elementType:"geometry", stylers:[{color:"#243344"}] },
  { featureType:"road.highway", elementType:"geometry", stylers:[{color:"#374c61"}] },
  { featureType:"water", elementType:"geometry", stylers:[{color:"#09131d"}] },
  { featureType:"poi", stylers:[{visibility:"off"}] },
  { featureType:"transit", stylers:[{visibility:"off"}] },
];

const isValid = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) &&
  Math.abs(p.lat) <= 90 &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lng) <= 180;

/** Google Maps surface for ride details, tracking and itinerary previews. */
export function GoogleMapSurface({
  points,
  lines = [],
  appearance = "standard",
  className = "h-72 w-full",
  ariaLabel = "Mapa do percurso",
  children,
  previewOnly = false,
  fitMode = "changes",
  fitKey,
  smoothTracking = false,
  showControls = false,
  onRefresh,
  gestureHandling = "cooperative",
  followPoint = null,
  followKey,
  followZoom = 16,
  navigationMode = false,
  followHeading = null,
  followAccuracyM = null,
  navigationPath = [],
  navigationVehicle = "CAR",
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
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshAt = useRef(0);
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(true);
  const [overview, setOverview] = useState(false);
  const [vectorMap, setVectorMap] = useState(false);
  const headingRef = useRef<number | null>(null);
  const cameraFrame = useRef<number | null>(null);
  const programmaticZoom = useRef(false);
  const manualCamera = useRef(false);
  const controlsRef = useRef({ navigationMode, following, overview });
  controlsRef.current = { navigationMode, following, overview };
  const navigationPathRef = useRef(navigationPath);
  navigationPathRef.current = navigationPath;
  const hasFollowFix = Boolean(followPoint && isValid(followPoint));
  const lastFollow = useRef<{lat:number;lng:number;at:number}|null>(null);
  const followInitialized = useRef(false);
  const followPointRef = useRef(followPoint);
  followPointRef.current = followPoint;

  useEffect(() => {
    let active = true;
    let removeTouchListener: (() => void) | undefined;
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
        // Vector rendering is required for perspective and bearing; gracefully
        // fall back to classic 2D when the browser/key does not support it.
        renderingType: G.RenderingType?.VECTOR,
        center: initialPoint
          ? { lat: initialPoint.lat, lng: initialPoint.lng }
          : { lat: -3.73, lng: -38.53 },
        zoom: 13,
        disableDefaultUI: true,
        clickableIcons: false,
        styles: appearance==="adaptive" && document.documentElement.classList.contains("dark")? adminDarkRoadStyles:undefined,
        gestureHandling: previewOnly ? "none" : gestureHandling,
        headingInteractionEnabled: !previewOnly,
        tiltInteractionEnabled: !previewOnly,
        keyboardShortcuts: !previewOnly,
      });
      // Keep Google's native pinch/rotation handling. Only relinquish GPS
      // camera ownership, so the next fix cannot undo a two-finger adjustment.
      const pauseFollowing = () => {
        if (!active || previewOnly) return;
        manualCamera.current = true;
        setFollowing(false);
        setOverview(false);
      };
      const handleTouchStart = (event: TouchEvent) => {
        if (event.touches.length >= 2) pauseFollowing();
      };
      const mapContainer = container.current;
      mapContainer.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
      removeTouchListener = () => mapContainer.removeEventListener("touchstart", handleTouchStart, true);
      // A deliberate swipe across the map pauses camera following; GPS and
      // markers continue to update. The recenter control restores following.
      map.current.addListener("dragstart", pauseFollowing);
      map.current.addListener("zoom_changed",()=>{
        if(active && !programmaticZoom.current && controlsRef.current.navigationMode && followInitialized.current){
          setFollowing(false);setOverview(false);
        }
      });
      const detectRendering=()=>{
        if(active)setVectorMap(Boolean(G.RenderingType?.VECTOR &&
          map.current?.getRenderingType?.()===G.RenderingType.VECTOR));
      };
      map.current.addListener("renderingtype_changed",detectRendering);
      detectRendering();
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
      removeTouchListener?.();
      unsubscribe();
      artifacts.current.forEach((item) => item.setMap(null));
      artifacts.current = [];
      lineArtifacts.current.forEach(({polyline})=>polyline.setMap(null));
      lineArtifacts.current.clear();
      movementFrames.current.forEach(frame=>window.cancelAnimationFrame(frame));
      movementFrames.current.clear();
      if(cameraFrame.current!==null)window.cancelAnimationFrame(cameraFrame.current);
      cameraFrame.current=null;
      trackingMarkers.current.clear();
      lastBounds.current = null;
      map.current = null;
    };
    // Initialize exactly once; update markers and polylines separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The admin cockpit follows the current theme without reconstructing a map,
  // while navigation/passenger maps keep their existing styling.
  useEffect(()=>{
    if(appearance!=="adaptive"||!ready||!map.current)return;
    const update=()=>map.current?.setOptions?.({
      styles:document.documentElement.classList.contains("dark")?adminDarkRoadStyles:[],
    });
    update();
    const observer=new MutationObserver(update);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
    return()=>observer.disconnect();
  },[appearance,ready]);

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
      const isTrackedDriver = point.id === "assigned-professional" && (navigationMode || navigationPathRef.current.length >= 2);
      const badgeIcon = isTrackedDriver ? null : point.kind && point.kind !== "person" ? tripMarkerIcon(point.kind) : null;
      const snapped = isTrackedDriver && navigationPathRef.current.length >= 2
        ? snapVisualDriverPosition(point, navigationPathRef.current, followAccuracyM) : null;
      const position = snapped?.point ?? point;
      const driverHeading = normalizedHeading(followHeading ?? snapped?.heading);
      const markerSymbol = isTrackedDriver ? {
        // North-facing vehicle silhouette; the Google symbol rotates with bearing.
        path: navigationVehicle === "MOTO"
          ? "M 0,-15 L 6,-5 L 6,8 Q 0,16 -6,8 L -6,-5 Z"
          : "M 0,-17 L 9,-7 L 9,10 Q 0,16 -9,10 L -9,-7 Z",
        scale: 1.15, fillColor: "#FFBB00", fillOpacity: 1,
        strokeColor: "#121212", strokeWeight: 2.5,
        rotation: driverHeading ?? 0,
        anchor: new G.Point(0,0),
      } : null;
      const options = {
        map: map.current,
        position: { lat: position.lat, lng: position.lng },
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
        icon: markerSymbol ?? badgeIcon ?? {
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
        const priorRotation=marker.getIcon?.()?.rotation ?? driverHeading ?? 0;
        marker.setOptions({title: options.title,icon: markerSymbol && driverHeading !== null ? {...markerSymbol,rotation:priorRotation} : options.icon,zIndex:options.zIndex});
        const oldPosition = marker.getPosition();
        const from = oldPosition ? {lat:oldPosition.lat(),lng:oldPosition.lng()} : {lat:position.lat,lng:position.lng};
        const distance = Math.hypot(from.lat-position.lat,from.lng-position.lng);
        const pending=movementFrames.current.get(markerKey);
        if (pending!==undefined) window.cancelAnimationFrame(pending);
        const reduceMotion=typeof window.matchMedia==="function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceMotion && distance > 0 && distance < 0.01) {
          const start=performance.now();
          const previousRotation=priorRotation;
          const rotationDelta=driverHeading===null?0:shortestHeadingDelta(previousRotation,driverHeading);
          const animationDuration=isTrackedDriver?Math.min(6000,Math.max(1500,Math.abs(distance)*450000)):950;
          const animate=(now:number)=>{
            const t=Math.min(1,(now-start)/animationDuration);
            const eased=t*t*(3-2*t);
            marker.setPosition({
              lat:from.lat+(position.lat-from.lat)*eased,
              lng:from.lng+(position.lng-from.lng)*eased,
            });
            if(isTrackedDriver && markerSymbol && driverHeading!==null)
              marker.setIcon({...markerSymbol, rotation:normalizedHeading(previousRotation+rotationDelta*eased) ?? 0});
            if(t<1)movementFrames.current.set(markerKey,window.requestAnimationFrame(animate));
            else movementFrames.current.delete(markerKey);
          };
          movementFrames.current.set(markerKey,window.requestAnimationFrame(animate));
        } else marker.setPosition({lat:position.lat,lng:position.lng});
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
    if(hasFollowFix){lastBounds.current=bounds;return;}
    if (manualCamera.current && !newFitKey) { lastBounds.current = bounds; return; }
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
    manualCamera.current=false;
    setOverview(false);
    // An explicit "Acompanhar no mapa" press MUST recenter even if the GPS
    // coordinates have not changed since the last frame. Do not rely on a
    // redundant setFollowing(true) to trigger another React render.
    followInitialized.current=false;
    lastFollow.current=null;
    setFollowing(true);
    const fix=followPointRef.current;
    if(ready&&!failed&&map.current&&fix&&isValid(fix)){
      const heading=normalizedHeading(followHeading);
      const centered=navigationMode && heading!==null?cameraLookAhead(fix,heading):fix;
      map.current.panTo(centered);
      if(navigationMode && vectorMap){map.current.setTilt(45);if(heading!==null)map.current.setHeading(heading);}
      programmaticZoom.current=true;
      map.current.setZoom(Math.max(14,Math.min(19,followZoom)));
      window.setTimeout(()=>{programmaticZoom.current=false;},0);
      lastFollow.current={lat:fix.lat,lng:fix.lng,at:Date.now()};
      followInitialized.current=true;
    }
  },[followKey,ready,failed,followZoom,navigationMode,vectorMap]);
  useEffect(()=>{
    if(!ready||failed||!map.current||manualCamera.current||!following||overview||!followPoint||!isValid(followPoint))return;
    const now=Date.now();
    const prior=lastFollow.current;
    if(prior&&now-prior.at<850)return;
    const moved=!prior||Math.hypot(
      (followPoint.lat-prior.lat)*111195,
      (followPoint.lng-prior.lng)*111195*Math.cos(followPoint.lat*Math.PI/180),
    )>6;
    const heading=normalizedHeading(followHeading);
    const headingDelta=heading!==null&&headingRef.current!==null
      ?Math.abs(shortestHeadingDelta(headingRef.current,heading)):0;
    if(!moved&&headingDelta<8)return;
    lastFollow.current={lat:followPoint.lat,lng:followPoint.lng,at:now};
    const center=navigationMode && heading!==null?cameraLookAhead(followPoint,heading):followPoint;
    map.current.panTo(center);
    if(navigationMode && vectorMap){
      map.current.setTilt(45);
      if(heading!==null){map.current.setHeading(heading);headingRef.current=heading;}
    }
    if(!followInitialized.current){
      programmaticZoom.current=true;
      map.current.setZoom(Math.max(14,Math.min(19,followZoom)));
      window.setTimeout(()=>{programmaticZoom.current=false;},0);
      followInitialized.current=true;
    }
  },[ready,failed,following,overview,navigationMode,vectorMap,followPoint?.lat,followPoint?.lng,followHeading,followZoom]);

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
      {ready && !failed && navigationMode && !vectorMap && <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg bg-[#121212]/75 px-2 py-1 text-[10px] text-white/80">Visão 2D</span>}
      {ready && !failed && showControls && !previewOnly && (
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          <button type="button"
            aria-label={hasFollowFix?(following&&!overview&&navigationMode?"Ver rota completa":following?"Centralizar e seguir motorista":"Retomar acompanhamento do GPS"):"Centralizar mapa no motorista"}
            title={hasFollowFix&&!following?"Retomar acompanhamento automático":navigationMode?"Alternar navegação e visão geral":"Centralizar"}
            className={"flex size-11 items-center justify-center rounded-full border bg-white text-xl font-bold text-slate-900 shadow-lg "+(hasFollowFix&&following?"border-[#FFBB00] ring-2 ring-[#FFBB00]/40":"border-slate-200")}
            onClick={() => {
              const driver = followPoint&&isValid(followPoint)?followPoint:
                points.find(point => point.kind === "driver" || point.kind === "availableMoto") ?? points[0];
              if(driver&&isValid(driver)){
                const heading=normalizedHeading(followHeading);
                const alreadyFollowing=following&&!overview;
                if(navigationMode&&alreadyFollowing){
                  setFollowing(false);setOverview(true);
                  map.current?.setTilt?.(0);map.current?.setHeading?.(0);
                  if(lastBounds.current)map.current?.fitBounds(lastBounds.current,{top:60,right:45,bottom:110,left:45});
                  return;
                }
                setOverview(false);
                manualCamera.current=false;
                map.current?.panTo(navigationMode&&heading!==null?cameraLookAhead(driver,heading):driver);
                if(navigationMode&&vectorMap){map.current?.setTilt?.(45);if(heading!==null)map.current?.setHeading?.(heading);}
                if(hasFollowFix){programmaticZoom.current=true;map.current?.setZoom(Math.max(14,Math.min(19,followZoom)));window.setTimeout(()=>{programmaticZoom.current=false;},0);}
                lastFollow.current={lat:driver.lat,lng:driver.lng,at:Date.now()};
                followInitialized.current=true;
                setFollowing(true);
              }
            }}>◎</button>
          <button type="button" aria-label="Aumentar zoom do mapa"
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-bold text-slate-900 shadow-lg"
            onClick={() => {setFollowing(false);setOverview(false);map.current?.setZoom(Math.min(20, (map.current?.getZoom() ?? 13) + 1));}}>+</button>
          <button type="button" aria-label="Diminuir zoom do mapa"
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl font-bold text-slate-900 shadow-lg"
            onClick={() => {setFollowing(false);setOverview(false);map.current?.setZoom(Math.max(3, (map.current?.getZoom() ?? 13) - 1));}}>−</button>
          <button type="button" aria-label="Atualizar aplicativo e mapa" title="Atualizar corridas, dados do aplicativo e mapa"
            disabled={refreshing}
            className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-lg disabled:opacity-60"
            onClick={async () => {
              const now=Date.now();
              if(refreshing || now-lastRefreshAt.current<3000)return;
              lastRefreshAt.current=now;
              setRefreshing(true);
              try {
                // Refresh existing Google Maps objects without rebuilding the map.
                const G=(window as any).google?.maps;
                if(map.current)G?.event?.trigger?.(map.current,"resize");
                await onRefresh?.();
                window.dispatchEvent(new Event("caronaa:app-refresh"));
                // Check a newer PWA version without replacing an active journey.
                void navigator.serviceWorker?.getRegistration?.().then(registration=>registration?.update()).catch(()=>undefined);
                const point=followPointRef.current;
                if(map.current&&point&&isValid(point)){
                  manualCamera.current=false;
                  setOverview(false);
                  setFollowing(true);
                  map.current.panTo(point);
                }
              } catch (error) {
                console.warn("[CARONAA/maps] Atualização manual indisponível", error);
              } finally {setRefreshing(false);}
            }}>
            <RefreshCw size={19} className={refreshing?"animate-spin motion-reduce:animate-none":""}/>
          </button>
        </div>
      )}
      {ready && !failed && children}
    </div>
  );
}
