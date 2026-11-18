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
/** Guard Google Routes cost: at most one calculation per 60s, earlier only
 * after a previous request window and a significant off-route movement.
 */
export function needsDriverReroute(input:{
  current:NavigationPoint;start:NavigationPoint;path:NavigationPoint[];
  elapsedMs:number;
}):boolean{
  const {current,start,path,elapsedMs}=input;
  if(!validNavigationPoint(current)||!validNavigationPoint(start))return false;
  if(elapsedMs<60000)return false;
  if(elapsedMs>=180000)return true;
  return distanceToNavigationPathMeters(current,path)>85&&
    navigationDistanceMeters(start,current)>65;
}
