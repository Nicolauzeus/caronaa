import {supabase} from "@/integrations/supabase/client";
import type {FavoriteKind,FavoritePlace} from "./favorite-places";
const table = () => (supabase as any).from("user_favorite_places");
async function identity() {
 const {data,error}=await supabase.auth.getUser();
 if(error || !data.user?.id) throw new Error("Entre na sua conta.");
 return data.user.id;
}
export async function listFavoritePlaces():Promise<FavoritePlace[]>{
 const userId=await identity();
 const {data,error}=await table().select("kind,label,latitude,longitude").eq("user_id",userId);
 if(error)throw new Error("Não foi possível carregar os locais favoritos.");
 return (data??[]).map((p:{kind:FavoriteKind;label:string;latitude:number;longitude:number})=>({kind:p.kind,label:p.label,lat:p.latitude,lng:p.longitude}));
}
export async function saveFavoritePlace(place:FavoritePlace):Promise<void>{
 const userId=await identity();
 if(!["HOME","SCHOOL_WORK"].includes(place.kind) || !place.label.trim() || place.label.length>120 ||
 !Number.isFinite(place.lat)||!Number.isFinite(place.lng)||Math.abs(place.lat)>90||Math.abs(place.lng)>180)
 throw new Error("Informe um endereço válido.");
 const {error}=await table().upsert({user_id:userId,kind:place.kind,label:place.label.trim(),latitude:place.lat,longitude:place.lng,updated_at:new Date().toISOString()},{onConflict:"user_id,kind"});
 if(error)throw new Error("Não foi possível salvar o local.");
}
