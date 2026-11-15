import { supabase } from "@/integrations/supabase/client";
import { formatGeoJsonLineString, type RoadPoint } from "@/lib/road-routing";

export type FlashDriverMode="ALL"|"ON_ROUTE"|"EXCLUSIVE";
export type FlashVehicle="CAR"|"MOTO";
export type FlashDriverOrder={
  id:string;mode:"ON_ROUTE"|"EXCLUSIVE";seats:number;distanceKm:number;
  driverEarnings:number;pickupLabel:string;dropoffLabel:string;
  expiresAt:string;
};
export type FlashDriverRide={
  id:string;status:"ACCEPTED"|"ARRIVED"|"IN_PROGRESS";
  originLabel:string;destinationLabel:string;vehicleType:FlashVehicle;
  municipality:string;mode?:"ON_ROUTE"|"EXCLUSIVE";
  passengerName?:string;passengerPhoto?:string;passengerWhatsapp?:string;
};
export type FlashDriverOnlineInput={
  online:true;mode:FlashDriverMode;seats:number;vehicleType:FlashVehicle;
  destination?:{lat:number;lng:number;label:string}|null;
  routePath?:RoadPoint[]|null;
};
export class FlashDriverError extends Error {
  constructor(public code:"UNAVAILABLE"|"COMMISSION_BLOCKED"|"ALREADY_TAKEN"|"INVALID"|"EXPIRED"){
    super(code);this.name="FlashDriverError";
  }
}
const record=(x:unknown):Record<string,unknown>|null=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;
const string=(x:unknown)=>typeof x==="string"?x.trim():"";
const numeric=(x:unknown):number=>typeof x==="number"?x:typeof x==="string"&&x.trim()?Number(x):NaN;
const coordinatesValid=(p:{lat:number;lng:number})=>
  Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180;
const rpcError=(error:unknown):FlashDriverError=>{
  const x=record(error);
  const code=string(x?.code);
  const message=string(x?.message);
  if(code==="42501"||/COMMISSION_BLOCKED|PLATFORM_FEE_PENDING/i.test(message))
    return new FlashDriverError("COMMISSION_BLOCKED");
  if(/ALREADY_TAKEN|ALREADY_MATCHED|OVERBOOKING_PREVENTED/i.test(code+" "+message))
    return new FlashDriverError("ALREADY_TAKEN");
  if(/EXPIRED|DEADLINE_PASSED/i.test(code+" "+message))return new FlashDriverError("EXPIRED");
  return new FlashDriverError("UNAVAILABLE");
};
/** New Flash-specific RPCs: fail closed when migration is unavailable. */
export async function setFlashDriverOnline(input:FlashDriverOnlineInput):Promise<void>{
  const {mode,seats,vehicleType,destination,routePath}=input;
  if(!["ALL","ON_ROUTE","EXCLUSIVE"].includes(mode)||
    !["CAR","MOTO"].includes(vehicleType)||!Number.isInteger(seats)||
    seats<1||seats>(vehicleType==="MOTO"?1:4)||
    (mode==="ON_ROUTE"&&!destination)||
    (destination&&(!coordinatesValid(destination)||!routePath?.length)))
    throw new FlashDriverError("INVALID");
  let geometry:null|ReturnType<typeof formatGeoJsonLineString>=null;
  if(destination){
    if(!routePath)throw new FlashDriverError("INVALID");
    geometry=formatGeoJsonLineString(routePath);
  }
  try{
    const {data,error}=await (supabase as any).rpc("set_flash_driver_online",{
      p_online:true,p_booking_mode:mode,p_seats:seats,p_vehicle_type:vehicleType,
      p_destination_lat:destination?.lat??null,p_destination_lng:destination?.lng??null,
      p_destination_label:destination?.label??null,p_route_path:geometry,
    });
    if(error)throw rpcError(error);
    if(data!==true && record(data)?.online!==true && record(data)?.success!==true)
      throw new FlashDriverError("UNAVAILABLE");
  }catch(error){if(error instanceof FlashDriverError)throw error;throw new FlashDriverError("UNAVAILABLE");}
}
export async function setFlashDriverOffline():Promise<void>{
  try{
    const {data,error}=await (supabase as any).rpc("set_flash_driver_online",{p_online:false});
    if(error)throw rpcError(error);
    if(data!==true&&record(data)?.online!==false&&record(data)?.success!==true)
      throw new FlashDriverError("UNAVAILABLE");
  }catch(error){if(error instanceof FlashDriverError)throw error;throw new FlashDriverError("UNAVAILABLE");}
}
export async function updateFlashDriverHeartbeatGPS(lat:number,lng:number,accuracyM:number):Promise<void>{
  if(!coordinatesValid({lat,lng})||!Number.isFinite(accuracyM)||accuracyM<=0||accuracyM>5000)
    throw new FlashDriverError("INVALID");
  try{
    const {data,error}=await (supabase as any).rpc("update_flash_driver_heartbeat_gps",{
      p_lat:lat,p_lng:lng,p_accuracy_m:accuracyM,
    });
    if(error)throw rpcError(error);
    if(data!==true && record(data)?.success!==true && record(data)?.published!==true)
      throw new FlashDriverError("UNAVAILABLE");
  }catch(error){if(error instanceof FlashDriverError)throw error;throw new FlashDriverError("UNAVAILABLE");}
}
function parseOrder(raw:unknown):FlashDriverOrder|null{
  const x=record(raw);
  if(!x)return null;
  const id=string(x.ride_id??x.id),mode=x.mode??x.booking_mode;
  const seats=numeric(x.seats??x.requested_seats);
  const distanceKm=numeric(x.distance_km);
  const driverEarnings=numeric(x.driver_earnings??x.driver_receives);
  const pickupLabel=string(x.pickup_label??x.origin_label);
  const dropoffLabel=string(x.dropoff_label??x.destination_label);
  const expiresAt=string(x.expires_at);
  if(!id||!["ON_ROUTE","EXCLUSIVE"].includes(String(mode))||
    !Number.isInteger(seats)||seats<1||seats>4||
    !Number.isFinite(distanceKm)||distanceKm<0||
    !Number.isFinite(driverEarnings)||driverEarnings<0||
    !pickupLabel||!dropoffLabel||!Number.isFinite(Date.parse(expiresAt)))return null;
  return {id,mode:mode as FlashDriverOrder["mode"],seats,distanceKm,
    driverEarnings,pickupLabel,dropoffLabel,expiresAt};
}
export async function getFlashDriverRadarOrders():Promise<FlashDriverOrder[]>{
  try{
    const {data,error}=await (supabase as any).rpc("get_flash_driver_radar_orders");
    if(error||!Array.isArray(data))throw new FlashDriverError("UNAVAILABLE");
    const items=data.map(parseOrder);
    if(items.some(x=>x===null))throw new FlashDriverError("UNAVAILABLE");
    return items as FlashDriverOrder[];
  }catch(error){if(error instanceof FlashDriverError)throw error;throw new FlashDriverError("UNAVAILABLE");}
}
export async function respondFlashOrder(rideId:string,accept:boolean):Promise<"ACCEPTED"|"REJECTED">{
  if(!rideId)throw new FlashDriverError("INVALID");
  try{
    const {data,error}=await (supabase as any).rpc("respond_flash_order",{
      p_ride_id:rideId,p_accept:accept,
    });
    if(error)throw rpcError(error);
    const status=record(data)?.status;
    if(accept){
      if(data===true||status==="ACCEPTED"||record(data)?.accepted===true)return "ACCEPTED";
      throw new FlashDriverError("ALREADY_TAKEN");
    }
    if(data===true||status==="REJECTED"||record(data)?.rejected===true)return "REJECTED";
    throw new FlashDriverError("UNAVAILABLE");
  }catch(error){if(error instanceof FlashDriverError)throw error;throw new FlashDriverError("UNAVAILABLE");}
}
export async function getMyActiveFlashRide():Promise<FlashDriverRide|null>{
  try{
    const {data,error}=await (supabase as any).rpc("quick_ride_my_requests");
    if(error||!Array.isArray(data))throw new FlashDriverError("UNAVAILABLE");
    const row=data.find((x:unknown)=>{const r=record(x);return r?.role==="DRIVER"&&
      ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(string(r.status).toUpperCase());});
    if(!row)return null;
    const r=record(row)!;
    const id=string(r.id),status=string(r.status).toUpperCase();
    if(!id)return null;
    return {
      id,status:status as FlashDriverRide["status"],
      originLabel:string(r.origin_label),destinationLabel:string(r.destination_label),
      municipality:string(r.municipality),
      vehicleType:r.vehicle_type==="MOTO"?"MOTO":"CAR",
      ...(r.mode==="ON_ROUTE"||r.mode==="EXCLUSIVE"?{mode:r.mode}:{}),
    };
  }catch(error){if(error instanceof FlashDriverError)throw error;throw new FlashDriverError("UNAVAILABLE");}
}
export type FlashPassengerDetails={
  name:string;photo:string|null;whatsapp:string|null;seatsRemaining:number|null;
  rideMode:"ON_ROUTE"|"EXCLUSIVE"|null;
};
export async function getFlashPassengerDetails(rideId:string):Promise<FlashPassengerDetails|null>{
  if(!rideId)return null;
  try{
    const {data,error}=await (supabase as any).rpc("get_flash_passenger_details",{p_ride_id:rideId});
    if(error)return null;
    const row=record(data);
    if(!row||!string(row.name))return null;
    const seatsRemaining=numeric(row.seats_remaining);
    return {
      name:string(row.name),photo:string(row.photo)||null,
      whatsapp:string(row.whatsapp)||null,
      seatsRemaining:Number.isInteger(seatsRemaining)&&seatsRemaining>=0?seatsRemaining:null,
      rideMode:row.ride_mode==="ON_ROUTE"||row.booking_mode==="ON_ROUTE"?"ON_ROUTE":
        row.ride_mode==="EXCLUSIVE"||row.booking_mode==="EXCLUSIVE"?"EXCLUSIVE":null,
    };
  }catch{return null;}
}
export async function markFlashDriverArrived(rideId:string):Promise<void>{
  if(!rideId)throw new FlashDriverError("INVALID");
  const {data,error}=await (supabase as any).rpc("quick_ride_transition",{
    p_id:rideId,p_status:"ARRIVED",
  });
  if(error||data!==true)throw new FlashDriverError("UNAVAILABLE");
}
export async function startFlashRideWithPin(rideId:string,pin:string):Promise<void>{
  if(!rideId||!/^[0-9]{4}$/.test(pin))throw new FlashDriverError("INVALID");
  const {data,error}=await (supabase as any).rpc("quick_ride_start_with_code",{
    p_id:rideId,p_code:pin,
  });
  if(error||data!==true)throw new FlashDriverError("UNAVAILABLE");
}
