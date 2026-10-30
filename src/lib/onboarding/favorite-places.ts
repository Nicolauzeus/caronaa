export type FavoriteKind = "HOME" | "SCHOOL_WORK";
export type FavoritePlace = { kind: FavoriteKind; label: string; lat: number; lng: number };
export type CurrentFix = { lat: number; lng: number; accuracy: number };

export function distanceMeters(a: {lat:number;lng:number}, b:{lat:number;lng:number}): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat-a.lat)*rad, dLng = (b.lng-a.lng)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

/** Never guess proximity from an inaccurate GPS fix or store the live fix. */
export function suggestOppositeDestination(
  favorites: FavoritePlace[],
  fix: CurrentFix | null,
  thresholdMeters = 250,
): { from: FavoritePlace; to: FavoritePlace } | null {
  if (!fix || !Number.isFinite(fix.accuracy) || fix.accuracy > 150 || fix.accuracy < 0) return null;
  const home = favorites.find(p=>p.kind==="HOME");
  const work = favorites.find(p=>p.kind==="SCHOOL_WORK");
  if (!home || !work) return null;
  if (![home,work].every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180))return null;
  const homeDistance=distanceMeters(home,fix), workDistance=distanceMeters(work,fix);
  const nearest = homeDistance < workDistance ? home : work;
  const other = nearest.kind === "HOME" ? work : home;
  const distance = Math.min(homeDistance,workDistance);
  if (distance + fix.accuracy > thresholdMeters || Math.abs(homeDistance-workDistance) < fix.accuracy*2) return null;
  return {from:nearest,to:other};
}
