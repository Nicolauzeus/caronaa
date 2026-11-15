import { supabase } from "@/integrations/supabase/client";
import type { OnRouteMatch } from "@/types/ride";

export type OnRouteSearchParams = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  seats?: number;
  targetTime?: Date;
  maxWalkMeters?: number;
};
export type OnRouteDiagnostic =
  "OK" | "NO_ON_ROUTE_MATCHES" | "INVALID_SEARCH" | "ON_ROUTE_SERVICE_UNAVAILABLE";
export type OnRouteSearchResult = {
  matches: OnRouteMatch[];
  diagnostic: OnRouteDiagnostic;
};
export type OnRouteBookingDetails = {
  pickupMeeting: OnRouteMatch["pickupMeeting"];
  dropoffMeeting: OnRouteMatch["dropoffMeeting"];
};
export type OnRouteBookingResult = { bookingId: string; status: "CONFIRMED" };
export class OnRouteServiceError extends Error {
  constructor(public readonly code: "OVERBOOKING_PREVENTED"|"ON_ROUTE_SERVICE_UNAVAILABLE"|"INVALID_BOOKING") {
    super(code);
    this.name = "OnRouteServiceError";
  }
}
const coordsValid = (lat:unknown,lng:unknown) =>
  typeof lat==="number" && Number.isFinite(lat) && Math.abs(lat)<=90 &&
  typeof lng==="number" && Number.isFinite(lng) && Math.abs(lng)<=180;
const obj=(x:unknown):Record<string,unknown>|null=>
  x!==null && typeof x==="object" && !Array.isArray(x)?x as Record<string,unknown>:null;
const number=(x:unknown)=>typeof x==="number"?x:typeof x==="string"&&x.trim()!==""?Number(x):NaN;
const str=(x:unknown)=>typeof x==="string"?x.trim():"";
function meeting(row:Record<string,unknown>,prefix:"pickup"|"dropoff") {
  const nested=obj(row[prefix+"_meeting"]);
  const lat=number(nested?.lat??row[prefix+"_lat"]);
  const lng=number(nested?.lng??row[prefix+"_lng"]);
  const walkMeters=number(nested?.walk_meters??nested?.walkMeters??row[prefix+"_walk_meters"]);
  const poiName=str(nested?.poi_name??nested?.poiName??row[prefix+"_poi_name"])||"Ponto ao longo da rota";
  if(!coordsValid(lat,lng) || !Number.isFinite(walkMeters)||walkMeters<0)return null;
  return {lat,lng,walkMeters,poiName};
}
export function mapOnRouteMatch(value:unknown):OnRouteMatch|null {
  const row=obj(value);
  if(!row)return null;
  const pickupMeeting=meeting(row,"pickup");
  const dropoffMeeting=meeting(row,"dropoff");
  const offerId=str(row.offer_id);
  const driverUserId=str(row.driver_user_id);
  const driverName=str(row.driver_name);
  const departureTime=str(row.departure_time);
  const availableSeats=number(row.available_seats);
  const seatsRemaining=number(row.seats_remaining);
  const price=number(row.estimated_price);
  const totalWalk=number(row.total_walk_meters);
  if(!offerId||!driverUserId||!driverName||!pickupMeeting||!dropoffMeeting||
    !departureTime||!Number.isFinite(Date.parse(departureTime))||
    !Number.isInteger(availableSeats)||availableSeats<1||
    !Number.isInteger(seatsRemaining)||seatsRemaining<0||
    !Number.isFinite(price)||price<0||
    !Number.isFinite(totalWalk)||totalWalk<0)return null;
  const avatar=str(row.driver_avatar_url);
  return {
    offerId,driverUserId,driverName,
    ...(avatar?{driverAvatarUrl:avatar}:{}),
    departureTime,availableSeats,seatsRemaining,
    pickupMeeting,dropoffMeeting,totalWalkMeters:totalWalk,estimatedPrice:price,
  };
}
/** Fail closed: malformed results are never shown as a verified driver offer. */
export async function searchOnRouteMatches(params:OnRouteSearchParams):Promise<OnRouteSearchResult> {
  const {originLat,originLng,destLat,destLng}=params;
  const seats=params.seats??1;
  const maxWalkMeters=params.maxWalkMeters??500;
  if(!coordsValid(originLat,originLng)||!coordsValid(destLat,destLng)||
    !Number.isInteger(seats)||seats<1||seats>3||
    !Number.isFinite(maxWalkMeters)||maxWalkMeters<=0||maxWalkMeters>5000||
    (params.targetTime!==undefined && (!Number.isFinite(params.targetTime.getTime())))) {
    return {matches:[],diagnostic:"INVALID_SEARCH"};
  }
  try {
    const {data,error}=await (supabase as any).rpc("find_on_route_matches",{
      p_origin_lat:originLat,p_origin_lng:originLng,
      p_destination_lat:destLat,p_destination_lng:destLng,
      p_seats:seats,
      p_target_time:params.targetTime?.toISOString()??null,
      p_max_walk_meters:maxWalkMeters,
    });
    if(error || !Array.isArray(data))return {matches:[],diagnostic:"ON_ROUTE_SERVICE_UNAVAILABLE"};
    const matches=data.map(mapOnRouteMatch).filter((v:OnRouteMatch|null):v is OnRouteMatch=>v!==null);
    if(matches.length!==data.length)return {matches:[],diagnostic:"ON_ROUTE_SERVICE_UNAVAILABLE"};
    return {matches,diagnostic:matches.length?"OK":"NO_ON_ROUTE_MATCHES"};
  }catch {
    return {matches:[],diagnostic:"ON_ROUTE_SERVICE_UNAVAILABLE"};
  }
}
/** The SQL RPC must lock the offer row and atomically verify remaining seats. */
export async function confirmOnRouteBooking(
  offerId:string,seats:number,meetingDetails:OnRouteBookingDetails,
):Promise<OnRouteBookingResult> {
  if(!offerId.trim()||!Number.isInteger(seats)||seats<1||seats>3||
    !meetingDetails?.pickupMeeting||!meetingDetails.dropoffMeeting||
    !coordsValid(meetingDetails.pickupMeeting.lat,meetingDetails.pickupMeeting.lng)||
    !coordsValid(meetingDetails.dropoffMeeting.lat,meetingDetails.dropoffMeeting.lng)){
    throw new OnRouteServiceError("INVALID_BOOKING");
  }
  try {
    const {data,error}=await (supabase as any).rpc("confirm_on_route_match",{
      p_offer_id:offerId,
      p_seats:seats,
      p_meeting_details:meetingDetails,
    });
    const code=String(error?.code??error?.message??"").toUpperCase();
    if(code.includes("OVERBOOKING_PREVENTED"))throw new OnRouteServiceError("OVERBOOKING_PREVENTED");
    if(error)throw new OnRouteServiceError("ON_ROUTE_SERVICE_UNAVAILABLE");
    const row=obj(data);
    const bookingId=typeof data==="string"?data.trim():str(row?.booking_id??row?.ride_id??row?.request_id);
    const confirmed=typeof data==="string"||row?.confirmed===true||row?.status==="CONFIRMED";
    if(!bookingId || !confirmed)throw new OnRouteServiceError("ON_ROUTE_SERVICE_UNAVAILABLE");
    return {bookingId,status:"CONFIRMED"};
  }catch(error){
    if(error instanceof OnRouteServiceError)throw error;
    throw new OnRouteServiceError("ON_ROUTE_SERVICE_UNAVAILABLE");
  }
}
