/**
 * Short-lived, process-local server cache of previously verified GPS cities.
 * A new coordinate cannot invent a municipality or extend its verification TTL.
 * No client-provided municipality, profile location or mock GPS is accepted.
 */
type VerifiedCity = { lat: number; lng: number; city: string; verifiedAt: number };
const cache = new Map<string, VerifiedCity>();
const TTL_MS = 3 * 60_000;
const MAX_DISTANCE_METERS = 300;

export function distanceMeters(
  a: {lat:number;lng:number}, b: {lat:number;lng:number},
): number {
  const r = Math.PI / 180;
  const dLat=(b.lat-a.lat)*r, dLng=(b.lng-a.lng)*r;
  const v=Math.sin(dLat/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(v)));
}

export function verifiedGpsCity(
  userId:string,point:{lat:number;lng:number},now=Date.now(),
): string | null {
  if(!userId||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return null;
  const record=cache.get(userId);
  if(!record)return null;
  if(now<record.verifiedAt || now-record.verifiedAt>TTL_MS){
    cache.delete(userId); return null;
  }
  if(distanceMeters(point,record)>MAX_DISTANCE_METERS)return null;
  return record.city;
}

export function rememberVerifiedGpsCity(
  userId:string,point:{lat:number;lng:number},city:string,now=Date.now(),
): void {
  if(!userId||!city||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return;
  if(cache.size>1000){
    for(const [key,value] of cache) if(now-value.verifiedAt>TTL_MS)cache.delete(key);
  }
  cache.set(userId,{lat:point.lat,lng:point.lng,city,verifiedAt:now});
}

export function forgetVerifiedGpsCity(userId:string): void { cache.delete(userId); }
