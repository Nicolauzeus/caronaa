/**
 * CARONAA region resolution. These are service inventory candidates, not an
 * authorization to dispatch. The DB can disable any municipality or vehicle.
 * Always derive municipality from SERVER Google Geocoding, never profile city.
 */
export type CorridorRegion = "FORTALEZA_CORRIDOR" | "MACICO_BATURITE";
const municipalityEntries: ReadonlyArray<readonly [string,CorridorRegion]> = [
  ["Fortaleza","FORTALEZA_CORRIDOR"],["Maracanaú","FORTALEZA_CORRIDOR"],
  ["Pacatuba","FORTALEZA_CORRIDOR"],["Guaiúba","FORTALEZA_CORRIDOR"],
  ["Acarape","MACICO_BATURITE"],["Redenção","MACICO_BATURITE"],
  ["Aracoiaba","MACICO_BATURITE"],["Baturité","MACICO_BATURITE"],
  ["Barreira","MACICO_BATURITE"],["Ocara","MACICO_BATURITE"],
  ["Capistrano","MACICO_BATURITE"],["Itapiúna","MACICO_BATURITE"],
  ["Aratuba","MACICO_BATURITE"],["Guaramiranga","MACICO_BATURITE"],
  ["Mulungu","MACICO_BATURITE"],["Pacoti","MACICO_BATURITE"],
  ["Palmácia","MACICO_BATURITE"],
];
export function normalizeMunicipality(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ").trim().toLowerCase();
}
const lookup = new Map(municipalityEntries.map(([city,region]) => [
  normalizeMunicipality(city), { municipality:city,region },
]));

export function resolveCorridorMunicipality(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined,
): { municipality:string; region:CorridorRegion } | null {
  const stateNormalized=normalizeMunicipality(state??"");
  const countryNormalized=normalizeMunicipality(country??"");
  // Fail closed unless Google positively identifies the state and country.
  if (!["ce","ceara"].includes(stateNormalized) ||
      !["br","brasil","brazil"].includes(countryNormalized))
    return null;
  return lookup.get(normalizeMunicipality(city??"")) ?? null;
}

export function distanceBetweenMeters(
  a: {lat:number;lng:number},b:{lat:number;lng:number}
): number {
  const rad=Math.PI/180;
  const h=Math.sin((b.lat-a.lat)*rad/2)**2+
    Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*
    Math.sin((b.lng-a.lng)*rad/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function insideApprovedActivityRadius(
  origin: {lat:number;lng:number},
  event: {center_lat:number;center_lng:number;radius_m:number},
): boolean {
  return Number.isFinite(event.radius_m) && event.radius_m>=100 &&
    event.radius_m<=30000 &&
    distanceBetweenMeters(origin,{lat:event.center_lat,lng:event.center_lng}) <=event.radius_m;
}
