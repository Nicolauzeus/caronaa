/**
 * F07 server-only civic reverse geocoding.
 * Nearby POI search is not a reliable way to identify a municipality: even a
 * valid GPS fix can be >150m from any listed business.
 *
 * Use Google's Geocoding API address components instead. Never trust a city
 * supplied by the browser or the user's registered profile.
 */
import { getGoogleServerKey } from "@/lib/location/google-server-key";

type CivicLocation={ city:string; state:string; country:string };
type GoogleComponent={long_name:string;short_name:string;types:string[]};
type GeocodeResult={types?:string[];address_components?:GoogleComponent[]};
type GeocodeResponse={status?:string;results?:GeocodeResult[]};

export async function reverseGeocodeRadarMunicipality(
  lat:number,lng:number,
):Promise<CivicLocation|null>{
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||
    Math.abs(lat)>90||Math.abs(lng)>180) return null;
  const key=getGoogleServerKey();
  if(!key)throw new Error("GOOGLE_GEOCODING_NOT_CONFIGURED");

  const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng",lat+","+lng);
  url.searchParams.set("language","pt-BR");
  url.searchParams.set("result_type","administrative_area_level_2|locality");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const res=await fetch(url,{
      headers:{"X-Goog-Api-Key":key},
      signal:controller.signal,
    });
    if(res.status===429)throw new Error("GOOGLE_QUOTA_LIMITED");
    if(!res.ok)throw new Error("GOOGLE_GEOCODING_HTTP_ERROR");
    const data=await res.json() as GeocodeResponse;
    if(data.status==="OVER_QUERY_LIMIT")throw new Error("GOOGLE_QUOTA_LIMITED");
    if(data.status==="ZERO_RESULTS")return null;
    if(data.status!=="OK")throw new Error("GOOGLE_GEOCODING_FAILED");
    const components=(data.results??[])
      .find(item=>item.types?.includes("administrative_area_level_2"))
      ?.address_components ??
      (data.results??[]).find(item=>item.types?.includes("locality"))?.address_components;
    if(!components)return null;
    const item=(type:string)=>components.find(c=>c.types?.includes(type));
    const city=item("administrative_area_level_2")?.long_name??item("locality")?.long_name;
    const state=item("administrative_area_level_1")?.short_name;
    const country=item("country")?.short_name;
    return city&&state&&country?{city,state,country}:null;
  }finally{
    clearTimeout(timeout);
  }
}
