/** Driver-side navigation presentation only; never authorizes ride transitions. */
export type NavigationPoint = {lat:number;lng:number};
export type NavigationPhase = "PICKUP" | "DROPOFF";

export function driverNavigationPhase(status:string):NavigationPhase|null {
  if(status==="ACCEPTED"||status==="ARRIVED")return "PICKUP";
  if(status==="IN_PROGRESS")return "DROPOFF";
  return null;
}
export function validNavigationPoint(point:NavigationPoint|null|undefined):point is NavigationPoint{
  return Boolean(point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&
    Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180);
}
export function navigationDistanceMeters(a:NavigationPoint,b:NavigationPoint):number {
  const radians=Math.PI/180;
  const deltaLat=(b.lat-a.lat)*radians;
  const deltaLng=(b.lng-a.lng)*radians;
  const h=Math.sin(deltaLat/2)**2+
    Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(deltaLng/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
/** Find the distance to the route segments in local metres (not a road ETA). */
export function distanceToNavigationPathMeters(point:NavigationPoint,path:NavigationPoint[]):number{
  if(!path.length)return Infinity;
  if(path.length===1)return navigationDistanceMeters(point,path[0]);
  const latScale=111195;
  const lngScale=latScale*Math.cos(point.lat*Math.PI/180);
  let nearest=Infinity;
  for(let i=1;i<path.length;i++){
    const start=path[i-1],end=path[i];
    const ax=(start.lng-point.lng)*lngScale,ay=(start.lat-point.lat)*latScale;
    const bx=(end.lng-point.lng)*lngScale,by=(end.lat-point.lat)*latScale;
    const dx=bx-ax,dy=by-ay;
    const fraction=dx*dx+dy*dy>0
      ?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy))):0;
    nearest=Math.min(nearest,Math.hypot(ax+fraction*dx,ay+fraction*dy));
  }
  return nearest;
}
/** Approximate progress along the returned road polyline, using local GPS.
 * This is a display estimate, NOT a new route, billing distance or trip proof.
 * With GPS >100 m off-route, hide the estimate instead of guessing.
 */
export function estimateDriverRouteRemaining(
  current:NavigationPoint,
  route:{routePath:NavigationPoint[];distanceKm:number;durationMinutes:number},
):{distanceKm:number;durationMinutes:number}|null{
  const path=route.routePath;
  if(!validNavigationPoint(current)||!Array.isArray(path)||path.length<2||
    !Number.isFinite(route.distanceKm)||route.distanceKm<0||
    !Number.isFinite(route.durationMinutes)||route.durationMinutes<0)return null;
  const latScale=111195,lngScale=latScale*Math.cos(current.lat*Math.PI/180);
  let cumulative=0,total=0,closestDistance=Infinity,closestAlong=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    if(!validNavigationPoint(a)||!validNavigationPoint(b))return null;
    const ax=(a.lng-current.lng)*lngScale,ay=(a.lat-current.lat)*latScale;
    const bx=(b.lng-current.lng)*lngScale,by=(b.lat-current.lat)*latScale;
    const vx=bx-ax,vy=by-ay,len=Math.hypot(vx,vy);
    const fraction=len>0?Math.max(0,Math.min(1,-(ax*vx+ay*vy)/(len*len))):0;
    const separation=Math.hypot(ax+vx*fraction,ay+vy*fraction);
    if(separation<closestDistance){
      closestDistance=separation;
      closestAlong=cumulative+len*fraction;
    }
    cumulative+=len;total+=len;
  }
  if(total<1||closestDistance>100)return null;
  const remaining=Math.max(0,Math.min(1,(total-closestAlong)/total));
  return {
    distanceKm:route.distanceKm*remaining,
    durationMinutes:route.durationMinutes*remaining,
  };
}

export type NavigationManeuver = {
  start: NavigationPoint;
  end: NavigationPoint;
  maneuver: string;
  instruction: string;
};

export function normalizedHeading(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? ((value % 360) + 360) % 360 : null;
}

/** Bearing is geographic (clockwise from North), never relative to the map camera. */
export function navigationBearing(a: NavigationPoint, b: NavigationPoint): number | null {
  if (!validNavigationPoint(a) || !validNavigationPoint(b) ||
    navigationDistanceMeters(a, b) < 2) return null;
  const radians = Math.PI / 180;
  const delta = (b.lng - a.lng) * radians;
  const y = Math.sin(delta) * Math.cos(b.lat * radians);
  const x = Math.cos(a.lat * radians) * Math.sin(b.lat * radians) -
    Math.sin(a.lat * radians) * Math.cos(b.lat * radians) * Math.cos(delta);
  return normalizedHeading(Math.atan2(y, x) / radians);
}

export function shortestHeadingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Put the road ahead of the vehicle in view; used only for display camera framing. */
export function cameraLookAhead(point: NavigationPoint, heading: number, meters = 70): NavigationPoint {
  if (!validNavigationPoint(point)) return point;
  const angle = heading * Math.PI / 180;
  return {
    lat: Math.max(-90, Math.min(90, point.lat + Math.cos(angle) * meters / 111195)),
    lng: point.lng + Math.sin(angle) * meters /
      Math.max(1000, 111195 * Math.cos(point.lat * Math.PI / 180)),
  };
}

/** Local projection on the drawn road polyline. No network calls or GPS mutation. */
export function projectNavigationPosition(
  point: NavigationPoint, path: NavigationPoint[],
): { point: NavigationPoint; distanceMeters: number; alongMeters: number; heading: number | null } | null {
  if (!validNavigationPoint(point) || !Array.isArray(path) || path.length < 2) return null;
  const latScale = 111195;
  const lngScale = latScale * Math.cos(point.lat * Math.PI / 180);
  let closest = Infinity;
  let projected: NavigationPoint | null = null;
  let heading: number | null = null;
  let along = 0;
  let cumulative = 0;
  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1], end = path[i];
    if (!validNavigationPoint(start) || !validNavigationPoint(end)) return null;
    const dx = (end.lng - start.lng) * lngScale;
    const dy = (end.lat - start.lat) * latScale;
    const lengthSq = dx * dx + dy * dy;
    const fraction = lengthSq > 0 ? Math.max(0, Math.min(1,
      ((point.lng - start.lng) * lngScale * dx +
        (point.lat - start.lat) * latScale * dy) / lengthSq)) : 0;
    const lat = start.lat + (end.lat - start.lat) * fraction;
    const lng = start.lng + (end.lng - start.lng) * fraction;
    const distance = Math.hypot((lat - point.lat) * latScale, (lng - point.lng) * lngScale);
    if (distance < closest) {
      closest = distance;
      projected = { lat, lng };
      along = cumulative + Math.sqrt(lengthSq) * fraction;
      heading = navigationBearing(start, end);
    }
    cumulative += Math.sqrt(lengthSq);
  }
  return projected ? { point: projected, distanceMeters: closest, alongMeters: along, heading } : null;
}

/** Visual-only road snapping. Never feed the snapped point to billing, eligibility or GPS publication. */
export function snapVisualDriverPosition(
  fix: NavigationPoint, path: NavigationPoint[], accuracyM: number | null | undefined,
): { point: NavigationPoint; heading: number | null } | null {
  if (typeof accuracyM !== "number" || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 45)
    return null;
  const projection = projectNavigationPosition(fix, path);
  return projection && projection.distanceMeters <= 15
    ? { point: projection.point, heading: projection.heading } : null;
}

/** Next road instruction, measured along road geometry rather than as-the-crow-flies. */
export function upcomingNavigationManeuver(
  fix: NavigationPoint, path: NavigationPoint[], maneuvers: NavigationManeuver[],
): { start: NavigationPoint; maneuver: string; instruction: string; distanceMeters: number } | null {
  if (!Array.isArray(maneuvers) || maneuvers.length === 0) return null;
  const location = projectNavigationPosition(fix, path);
  if (!location || location.distanceMeters > 100) return null;
  for (const item of maneuvers) {
    if (!validNavigationPoint(item.start) || !item.instruction?.trim() ||
      item.maneuver === "DEPART" || item.maneuver === "MANEUVER_UNSPECIFIED") continue;
    const turn = projectNavigationPosition(item.start, path);
    if (!turn || turn.distanceMeters > 80) continue;
    const remaining = turn.alongMeters - location.alongMeters;
    if (remaining >= -15) {
      return {
        start: item.start,
        maneuver: item.maneuver,
        instruction: item.instruction.trim(),
        distanceMeters: Math.max(0, remaining),
      };
    }
  }
  return null;
}

/** Confirm deviations in two distinct GPS samples. Never reroute on a lone inaccurate fix.
 * A 10s minimum between route revisions caps the cost, while a proven detour
 * may bypass the old 60s gate. Moving traffic can refresh every 3 minutes.
 */
export function needsDriverReroute(input: {
  current: NavigationPoint; start: NavigationPoint; path: NavigationPoint[];
  elapsedMs: number; offRouteConfirmations?: number; accuracyM?: number | null;
}): boolean {
  const { current, start, path, elapsedMs, offRouteConfirmations = 0, accuracyM } = input;
  if (!validNavigationPoint(current) || !validNavigationPoint(start) ||
    !Array.isArray(path) || path.length < 2 || elapsedMs < 10000) return false;
  const distanceMoved = navigationDistanceMeters(start, current);
  if (elapsedMs >= 180000 && distanceMoved > 25) return true;
  if (distanceMoved < 30 || offRouteConfirmations < 2) return false;
  const threshold = typeof accuracyM === "number" && Number.isFinite(accuracyM)
    ? Math.max(40, Math.min(100, accuracyM * 1.5)) : 60;
  return distanceToNavigationPathMeters(current, path) > threshold;
}
