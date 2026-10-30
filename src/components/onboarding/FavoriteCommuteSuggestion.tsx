import {useEffect,useState} from "react";
import {Home,BriefcaseBusiness,MapPin,Navigation} from "lucide-react";
import {LocationAutocomplete} from "@/components/formulario/LocationAutocomplete";
import type {FormLocationDetails} from "@/lib/location/types";
import {listFavoritePlaces,saveFavoritePlace} from "@/lib/onboarding/favorite-places-service";
import {suggestOppositeDestination,type FavoriteKind,type FavoritePlace} from "@/lib/onboarding/favorite-places";

type Props={onChoose:(from:FavoritePlace,to:FavoritePlace)=>void};
export function FavoriteCommuteSuggestion({onChoose}:Props){
 const [places,setPlaces]=useState<FavoritePlace[]>([]);
 const [editing,setEditing]=useState<FavoriteKind|null>(null);
 const [label,setLabel]=useState("");
 const [details,setDetails]=useState<FormLocationDetails>();
 const [suggestion,setSuggestion]=useState<ReturnType<typeof suggestOppositeDestination>>(null);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;void listFavoritePlaces().then(p=>{if(alive)setPlaces(p)}).catch(()=>undefined);return()=>{alive=false}},[]);
 async function store(){
  if(!editing || details?.lat==null || details?.lng==null)return;
  setBusy(true);
  try{
   const place:FavoritePlace={kind:editing,label:details.formattedAddress||label,lat:details.lat,lng:details.lng};
   await saveFavoritePlace(place);
   setPlaces(p=>[...p.filter(x=>x.kind!==editing),place]);
   setEditing(null);setDetails(undefined);setLabel("");setMessage("Local salvo.");
  }catch{setMessage("Não foi possível salvar o local.");}finally{setBusy(false);}
 }
 function locate(){
  if(!navigator.geolocation||!window.isSecureContext){setMessage("Localização indisponível. Escolha o destino manualmente.");return;}
  setBusy(true);
  navigator.geolocation.getCurrentPosition(p=>{
    setSuggestion(suggestOppositeDestination(places,{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}));
    setMessage("Sugestão calculada somente neste dispositivo.");
    setBusy(false);
  },()=>{setMessage("Sem acesso à localização. Você pode selecionar o destino manualmente.");setBusy(false);},{timeout:10000,maximumAge:15000});
 }
 const home=places.find(p=>p.kind==="HOME"),work=places.find(p=>p.kind==="SCHOOL_WORK");
 return <section className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-2xl" aria-label="Seus caminhos favoritos">
  <div className="mb-3 flex items-center gap-2"><Navigation size={17} className="text-[#FFBB00]"/><h2 className="text-sm font-bold">Seus caminhos</h2></div>
  <div className="grid grid-cols-2 gap-2">
   {([{kind:"HOME" as const,title:"Casa",icon:Home,place:home},{kind:"SCHOOL_WORK" as const,title:"Escola / Trabalho",icon:BriefcaseBusiness,place:work}]).map(p=><button key={p.kind} type="button" onClick={()=>{setEditing(p.kind);setLabel("");setDetails(undefined);setSuggestion(null)}} className="min-h-16 rounded-2xl border border-white/15 bg-white/[0.05] p-3 text-left">
     <p className="flex items-center gap-2 text-sm font-semibold"><p.icon size={16}/>{p.title}</p><p className="mt-1 truncate text-xs opacity-65">{p.place?.label||"Adicionar endereço"}</p>
   </button>)}
  </div>
  {editing&&<div className="mt-3 space-y-3">
    <LocationAutocomplete id="favorite-place" label={editing==="HOME"?"Endereço de casa":"Escola ou trabalho"} variant="glass" value={label} selectedLocation={details} onChange={(value,loc)=>{setLabel(value);setDetails(loc)}}/>
    <div className="flex gap-2">
      <button type="button" className="min-h-11 flex-1 rounded-xl border border-white/20 px-3 text-sm" onClick={()=>setEditing(null)}>Cancelar</button>
      <button type="button" disabled={busy||details?.lat==null||details?.lng==null} className="min-h-11 flex-1 rounded-xl bg-[#FFBB00] px-3 text-sm font-semibold text-[#121212] disabled:opacity-40" onClick={()=>void store()}>Salvar local</button>
    </div>
   </div>}
  {home&&work&&<div className="mt-3 space-y-2">
    <button type="button" disabled={busy} onClick={locate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FFBB00]/35 bg-[#FFBB00]/10 px-3 text-sm font-semibold"><MapPin size={16}/>Sugerir destino pela minha localização</button>
    {suggestion?<button type="button" className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-3 text-sm font-bold text-[#121212]" onClick={()=>onChoose(suggestion.from,suggestion.to)}>Ir de {suggestion.from.kind==="HOME"?"Casa":"Escola/Trabalho"} para {suggestion.to.kind==="HOME"?"Casa":"Escola/Trabalho"}</button>:
     <div className="flex gap-2"><button type="button" onClick={()=>onChoose(home,work)} className="min-h-10 flex-1 rounded-xl border border-white/20 px-2 text-xs">Casa → Escola/Trabalho</button><button type="button" onClick={()=>onChoose(work,home)} className="min-h-10 flex-1 rounded-xl border border-white/20 px-2 text-xs">Escola/Trabalho → Casa</button></div>}
  </div>}
  {message&&<p role="status" className="mt-2 text-xs opacity-70">{message}</p>}
  <p className="mt-2 text-[11px] opacity-55">A localização é consultada somente ao tocar no botão. Você sempre confirma o trajeto.</p>
 </section>;
}
