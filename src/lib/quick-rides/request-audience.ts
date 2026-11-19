import { supabase } from "@/integrations/supabase/client";

export type RideParticipantSummary={
  id:string;name:string;photo:string|null;registration:string|null;
};
export type QuickRideAudience={
  watchingCount:number;
  viewers:RideParticipantSummary[];
  acceptedDriver:RideParticipantSummary|null;
};
export type RideRequestPassenger={name:string;photo:string|null};

const record=(x:unknown):Record<string,unknown>|null=>
  x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;
const text=(x:unknown)=>typeof x==="string"?x.trim():"";
const safePhoto=(x:unknown)=>{
  const value=text(x);
  return value.startsWith("https://")?value:null;
};

function parseDriver(x:unknown):RideParticipantSummary|null{
  const d=record(x);
  if(!d||!text(d.id))return null;
  return {
    id:text(d.id),name:text(d.name)||"Motorista CARONAA",
    photo:safePhoto(d.photo),
    registration:text(d.registration)||null,
  };
}

/** One short heartbeat per visible request card, authorized by the SQL 0214 gate. */
export async function markQuickRideRequestViewed(rideId:string):Promise<RideRequestPassenger|null>{
  if(!rideId)return null;
  const {data,error}=await (supabase as any).rpc("quick_ride_view_request",{p_ride_id:rideId});
  if(error)throw error;
  const row=record(data);
  if(!row)return null;
  return {name:text(row.name)||"Passageiro CARONAA",photo:safePhoto(row.photo)};
}

/** Remove just the current driver's view; never touches the customer's ride. */
export async function stopQuickRideRequestView(rideId:string):Promise<void>{
  if(!rideId)return;
  const {error}=await (supabase as any).rpc("quick_ride_stop_view",{p_ride_id:rideId});
  if(error)throw error;
}

/** Passenger-only projection: no GPS, phone, PIN, emails or payment data. */
export async function getQuickRideRequestAudience(rideId:string):Promise<QuickRideAudience>{
  const {data,error}=await (supabase as any).rpc("quick_ride_request_audience",{p_ride_id:rideId});
  if(error)throw error;
  const row=record(data);
  const n=Number(row?.watching_count);
  return {
    watchingCount:Number.isFinite(n)&&n>=0?Math.floor(n):0,
    viewers:Array.isArray(row?.viewers)?row.viewers.map(parseDriver).filter((x):x is RideParticipantSummary=>x!==null):[],
    acceptedDriver:parseDriver(row?.accepted_driver),
  };
}
