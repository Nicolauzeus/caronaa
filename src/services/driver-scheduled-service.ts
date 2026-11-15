import { supabase } from "@/integrations/supabase/client";
import { formatGeoJsonLineString, type RoadPoint } from "@/lib/road-routing";
import type { TravelPreferences } from "@/lib/travel-preferences";

export type DriverBookingMode="ALL"|"ON_ROUTE"|"EXCLUSIVE";
export type DriverVehicleType="CAR"|"MOTO";
export type ScheduledDriverOfferDraft={
  origin:string;destination:string;departureAt:string;
  routePath:RoadPoint[];bookingMode:DriverBookingMode;
  vehicleType:DriverVehicleType;seats:number;
  suggestedFarePerSeat:number;preferences:TravelPreferences;
  womenOnly:boolean;
};
export type DriverOpportunity={
  requestId:string;passengerName:string;passengerAvatarUrl?:string;
  rating?:number;passengers:number;potentialEarnings:number;
  meetingDistanceMeters:number;meetingName:string;
};
export type ScheduledDriverPassenger={
  id:string;name:string;avatarUrl?:string;
  whatsapp?:string;meetingName:string;agreedFare:number;
};
export type DriverScheduledTrip={
  offerId:string;origin:string;destination:string;departureAt:string;
  seatsRemaining:number;vehicleType:DriverVehicleType;
  passengers:ScheduledDriverPassenger[];
};
export class DriverScheduledError extends Error {
  constructor(public readonly code:"DEBT_PENDING"|"ALREADY_MATCHED"|"UNAVAILABLE"|"INVALID_INPUT"){
    super(code);this.name="DriverScheduledError";
  }
}
const object=(data:unknown):Record<string,unknown>|null=>
  data!==null&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:null;
const string=(value:unknown):string=>typeof value==="string"?value.trim():"";
const number=(value:unknown):number=>typeof value==="number"?value:typeof value==="string"&&value.trim()?Number(value):NaN;
const seatsValid=(type:DriverVehicleType,seats:number)=>Number.isInteger(seats)&&seats>=1&&seats<=(type==="MOTO"?1:3);
function rpcCode(error:any):"DEBT_PENDING"|"ALREADY_MATCHED"|"UNAVAILABLE" {
  const source=String(error?.message??"")+" "+String(error?.code??"");
  if(/42501|PLATFORM_FEE_PENDING|DEBT_PENDING/i.test(source))return "DEBT_PENDING";
  if(/ALREADY_MATCHED|ALREADY_ACCEPTED|REQUEST_ALREADY_ASSIGNED|OVERBOOKING_PREVENTED/i.test(source))return "ALREADY_MATCHED";
  return "UNAVAILABLE";
}
export async function publishScheduledDriverOffer(draft:ScheduledDriverOfferDraft):Promise<string>{
  if(!draft.origin.trim()||!draft.destination.trim()||
    !Number.isFinite(Date.parse(draft.departureAt))||
    Date.parse(draft.departureAt)<Date.now()+30*60*1000 ||
    !["ALL","ON_ROUTE","EXCLUSIVE"].includes(draft.bookingMode)||
    !["CAR","MOTO"].includes(draft.vehicleType)||
    !seatsValid(draft.vehicleType,draft.seats)||
    !Number.isFinite(draft.suggestedFarePerSeat)||draft.suggestedFarePerSeat<0)
    throw new DriverScheduledError("INVALID_INPUT");
  const geoJson=formatGeoJsonLineString(draft.routePath);
  try{
    const {data,error}=await (supabase as any).rpc("publish_scheduled_driver_offer",{
      p_origin:draft.origin.trim(),
      p_destination:draft.destination.trim(),
      p_departure_at:draft.departureAt,
      p_route_path:geoJson,
      p_booking_mode:draft.bookingMode,
      p_vehicle_type:draft.vehicleType,
      p_available_seats:draft.seats,
      p_suggested_fare_per_seat:draft.suggestedFarePerSeat,
      p_preferences:draft.preferences,
      p_women_only:draft.womenOnly,
    });
    if(error)throw new DriverScheduledError(rpcCode(error));
    const row=object(data);
    const id=typeof data==="string"?data.trim():string(row?.offer_id??row?.id);
    if(!id)throw new DriverScheduledError("UNAVAILABLE");
    return id;
  }catch(error){
    if(error instanceof DriverScheduledError)throw error;
    throw new DriverScheduledError("UNAVAILABLE");
  }
}
function parseOpportunity(value:unknown):DriverOpportunity|null {
  const row=object(value);
  if(!row)return null;
  const requestId=string(row.request_id);
  const passengerName=string(row.passenger_name);
  const passengers=number(row.passengers??row.passenger_count);
  const potentialEarnings=number(row.potential_earnings);
  const meetingDistanceMeters=number(row.meeting_distance_meters);
  if(!requestId||!passengerName||!Number.isInteger(passengers)||passengers<1||passengers>3||
    !Number.isFinite(potentialEarnings)||potentialEarnings<0||
    !Number.isFinite(meetingDistanceMeters)||meetingDistanceMeters<0)return null;
  const rating=number(row.rating??row.average_rating);
  const avatar=string(row.passenger_avatar_url);
  return {requestId,passengerName,passengers,potentialEarnings,
    meetingDistanceMeters,meetingName:string(row.meeting_name)||"Ponto ao longo do trajeto",
    ...(Number.isFinite(rating)&&rating>=0&&rating<=5?{rating}:{}),
    ...(avatar?{passengerAvatarUrl:avatar}:{}),
  };
}
export async function getDriverScheduledOpportunities(offerId:string):Promise<DriverOpportunity[]> {
  if(!offerId.trim())throw new DriverScheduledError("INVALID_INPUT");
  try {
    const {data,error}=await (supabase as any).rpc("get_driver_scheduled_opportunities",{p_offer_id:offerId});
    if(error||!Array.isArray(data))throw new DriverScheduledError("UNAVAILABLE");
    const items=data.map(parseOpportunity);
    if(items.some(item=>item===null))throw new DriverScheduledError("UNAVAILABLE");
    return items as DriverOpportunity[];
  }catch(error) {
    if(error instanceof DriverScheduledError)throw error;
    throw new DriverScheduledError("UNAVAILABLE");
  }
}
export async function acceptDriverScheduledRequest(offerId:string,requestId:string):Promise<{seatsRemaining:number}> {
  if(!offerId.trim()||!requestId.trim())throw new DriverScheduledError("INVALID_INPUT");
  try{
    const {data,error}=await (supabase as any).rpc("driver_accept_scheduled_request",{
      p_offer_id:offerId,p_request_id:requestId,
    });
    if(error)throw new DriverScheduledError(rpcCode(error));
    const row=object(data);
    const remaining=number(row?.seats_remaining);
    if(!row || (row.accepted!==true&&row.status!=="CONFIRMED")||
      !Number.isInteger(remaining)||remaining<0)throw new DriverScheduledError("UNAVAILABLE");
    return {seatsRemaining:remaining};
  }catch(error){
    if(error instanceof DriverScheduledError)throw error;
    throw new DriverScheduledError("UNAVAILABLE");
  }
}
export async function getDriverScheduledTrips():Promise<DriverScheduledTrip[]>{
  try{
    const {data,error}=await (supabase as any).rpc("get_driver_scheduled_trips");
    if(error||!Array.isArray(data))throw new DriverScheduledError("UNAVAILABLE");
    return data.map((item:unknown)=>{
      const row=object(item);
      const offerId=string(row?.offer_id??row?.id);
      const origin=string(row?.origin);
      const destination=string(row?.destination);
      const departureAt=string(row?.departure_at);
      const seatsRemaining=number(row?.seats_remaining);
      const vehicleType=row?.vehicle_type;
      const passengerRows=row?.passengers;
      if(!offerId||!origin||!destination||!Number.isFinite(Date.parse(departureAt))||
        !Number.isInteger(seatsRemaining)||seatsRemaining<0||
        (vehicleType!=="CAR"&&vehicleType!=="MOTO")||!Array.isArray(passengerRows))
        throw new DriverScheduledError("UNAVAILABLE");
      const passengers=passengerRows.map((raw:unknown)=>{
        const p=object(raw);const id=string(p?.id);const name=string(p?.name);
        const agreedFare=number(p?.agreed_fare);
        if(!id||!name||!Number.isFinite(agreedFare)||agreedFare<0)
          throw new DriverScheduledError("UNAVAILABLE");
        const avatar=string(p?.avatar_url);
        const whatsapp=string(p?.whatsapp);
        return {id,name,agreedFare,meetingName:string(p?.meeting_name)||"Ponto combinado",
          ...(avatar?{avatarUrl:avatar}:{}),...(whatsapp?{whatsapp}:{})};
      });
      return {offerId,origin,destination,departureAt,seatsRemaining,vehicleType,passengers};
    });
  }catch(error){
    if(error instanceof DriverScheduledError)throw error;
    throw new DriverScheduledError("UNAVAILABLE");
  }
}
/** WhatsApp is contact initiated by the driver, never an automatic message. */
export function driverWhatsappLink(trip:DriverScheduledTrip,passenger:ScheduledDriverPassenger):string|null {
  const raw=passenger.whatsapp?.replace(/\D/g,"")??"";
  const local=raw.startsWith("55")?raw.slice(2):raw;
  if(!/^[1-9][0-9]9[0-9]{8}$/.test(local))return null;
  const date=new Date(trip.departureAt);
  if(!Number.isFinite(date.getTime()))return null;
  const day=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",dateStyle:"short"}).format(date);
  const time=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",hour:"2-digit",minute:"2-digit"}).format(date);
  const message=`Olá ${passenger.name}, sou seu motorista do CARONAA para a viagem de ${trip.origin} até ${trip.destination} no dia ${day} às ${time}. Nos encontramos no ponto combinado!`;
  return `https://wa.me/55${local}?text=${encodeURIComponent(message)}`;
}
