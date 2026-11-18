import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isValidBrazilianPlate, normalizePlate } from "@/lib/professional-access";

export type ActiveRole = "PASSAGEIRO" | "MOTORISTA";
export type VehicleType = "car" | "moto";
export type VehicleMissingField = "brand" | "model" | "color" | "plate";
export type VehicleStatus = {
  hasBrand:boolean; hasModel:boolean; hasColor:boolean; hasPlate:boolean; isComplete:boolean;
};
export type VehicleDraft = {
  brand:string; model:string; color:string; plate:string;
  vehicleType:VehicleType; vehicleSeats:number;
};
export type SwitchRoleResult =
  | {needsVehicleModal:false;missingFields:[]}
  | {needsVehicleModal:true;missingFields:VehicleMissingField[]};

type ProfileVehicle = {
  vehicle_brand?:string|null; vehicle_description?:string|null;
  vehicle_color?:string|null; vehicle_plate?:string|null;
  vehicle_type?:string|null; vehicle_seats?:number|null;
};

const hasText=(value:unknown):value is string =>
  typeof value==="string" && value.trim().length>0;

export function getVehicleStatus(profile:ProfileVehicle|null):VehicleStatus {
  const hasBrand=hasText(profile?.vehicle_brand);
  const hasModel=hasText(profile?.vehicle_description);
  const hasColor=hasText(profile?.vehicle_color);
  const hasPlate=isValidBrazilianPlate(profile?.vehicle_plate) &&
    /^[A-Z]{3}[0-9](?:[0-9]|[A-J])[0-9]{2}$/.test(normalizePlate(profile?.vehicle_plate));
  return {hasBrand,hasModel,hasColor,hasPlate,
    isComplete:hasBrand&&hasModel&&hasColor&&hasPlate};
}
export function getMissingVehicleFields(status:VehicleStatus):VehicleMissingField[] {
  const missing:VehicleMissingField[]=[];
  if(!status.hasBrand)missing.push("brand");
  if(!status.hasModel)missing.push("model");
  if(!status.hasColor)missing.push("color");
  if(!status.hasPlate)missing.push("plate");
  return missing;
}
export function normalizeVehicleSeats(type:VehicleType,seats:unknown):number {
  return type==="moto"?1:
    Math.max(1,Math.min(3,Number.isInteger(seats)?Number(seats):1));
}
function parseVehicleType(value:unknown):VehicleType {
  return typeof value==="string" && value.toLowerCase()==="moto"?"moto":"car";
}
function parseActiveRole(value:unknown):ActiveRole|null {
  const possible=typeof value==="string"?value:
    value && typeof value==="object"
      ? (value as Record<string,unknown>).active_role ??
        (value as Record<string,unknown>).activeRole ??
        (value as Record<string,unknown>).role:null;
  return possible==="MOTORISTA"||possible==="PASSAGEIRO"?possible:null;
}
type RoleState = {
  activeRole:ActiveRole;isDriverEligible:boolean;vehicleStatus:VehicleStatus;
  vehicleType:VehicleType;vehicleSeats:number;loading:boolean;busy:boolean;error:string|null;
};
const initialState:RoleState={
  activeRole:"PASSAGEIRO",isDriverEligible:false,vehicleStatus:getVehicleStatus(null),
  vehicleType:"car",vehicleSeats:1,loading:true,busy:false,error:null,
};
export function useActiveRole() {
  const [state,setState]=useState<RoleState>(initialState);
  const profileRef=useRef<ProfileVehicle|null>(null);
  const userRef=useRef<string|null>(null);

  const refresh=useCallback(async()=>{
    const {data:auth,error:authError}=await supabase.auth.getUser();
    if(authError)throw authError;
    if(!auth.user){
      userRef.current=null;
      profileRef.current=null;
      setState({...initialState,loading:false});
      return;
    }
    const userId=auth.user.id;
    userRef.current=userId;
    const [{data:profile,error:profileError},{data:roleProfile}]=await Promise.all([
      (supabase as any).from("profiles")
        .select("vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_type,vehicle_seats")
        .eq("id",userId).maybeSingle(),
      // Optional: active_role may not exist in older versions of profiles.
      (supabase as any).from("profiles").select("active_role").eq("id",userId).maybeSingle(),
    ]);
    if(profileError)throw new Error("Não foi possível carregar os dados do veículo. Tente novamente.");
    const row=profile as ProfileVehicle|null;
    profileRef.current=row;
    const vehicleType=parseVehicleType(row?.vehicle_type);
    const vehicleStatus=getVehicleStatus(row);
    setState(prev=>({
      ...prev,vehicleStatus,
      activeRole:parseActiveRole(roleProfile?.active_role??roleProfile)??prev.activeRole,
      // Traditional carpool readiness only. Professional F07 authorization
      // remains enforced by its own server-side services and RPCs.
      isDriverEligible:vehicleStatus.isComplete,
      vehicleType,vehicleSeats:normalizeVehicleSeats(vehicleType,row?.vehicle_seats),
      loading:false,error:null,
    }));
  },[]);

  useEffect(()=>{
    let alive=true;
    void refresh().catch(()=>{
      if(alive)setState(prev=>({...prev,loading:false,
        isDriverEligible:false,
        error:"Não foi possível carregar seu perfil. Tente novamente."}));
    });
    return()=>{alive=false;};
  },[refresh]);

  const switchRole=useCallback(async(target:ActiveRole):Promise<SwitchRoleResult>=>{
    if(state.busy || state.loading)throw new Error("Aguarde a consulta do perfil.");
    const userId=userRef.current;
    if(!userId)throw new Error("Faça login novamente.");
    if(target!=="MOTORISTA" && target!=="PASSAGEIRO")throw new Error("Papel inválido.");
    if(target==="MOTORISTA"){
      const missingFields=getMissingVehicleFields(state.vehicleStatus);
      if(missingFields.length)return {needsVehicleModal:true,missingFields};
    }
    const previous=state.activeRole;
    if(target==="PASSAGEIRO")setState(prev=>({...prev,activeRole:target,error:null,busy:true}));
    else setState(prev=>({...prev,busy:true,error:null}));
    try{
      try{
        const {data,error}=await (supabase as any).rpc("switch_user_active_role",{
          target_role:target,p_target_role:target,
        });
        if(error || data?.success===false || data?.error || parseActiveRole(data)!==target)
          throw error??new Error("Papel não atualizado.");
      }catch{
        // Support deployments with the older RPC signature. RLS still limits
        // this update to the authenticated user's own profile.
        const {data,error}=await (supabase as any).from("profiles")
          .update({active_role:target}).eq("id",userId).select("active_role").single();
        if(error || data?.active_role!==target)throw new Error("Papel não atualizado.");
      }
      setState(prev=>({...prev,activeRole:target,busy:false,error:null}));
      if (typeof window !== "undefined") window.dispatchEvent(new Event("caronaa:role-changed"));
      return {needsVehicleModal:false,missingFields:[]};
    }catch{
      setState(prev=>({...prev,activeRole:previous,busy:false,
        error:"Não foi possível mudar de perfil. Tente novamente."}));
      throw new Error("Não foi possível mudar de perfil. Tente novamente.");
    }
  },[state.activeRole,state.busy,state.loading,state.vehicleStatus]);

  const saveVehicle=useCallback(async(draft:VehicleDraft)=>{
    if(!userRef.current)throw new Error("Faça login novamente.");
    if(state.busy)throw new Error("Aguarde a operação em andamento.");
    const current=profileRef.current;
    const vehicleType=draft.vehicleType;
    if(vehicleType!=="car" && vehicleType!=="moto")throw new Error("Tipo de veículo inválido.");
    if(!Number.isInteger(draft.vehicleSeats) || draft.vehicleSeats<1 ||
      draft.vehicleSeats>(vehicleType==="moto"?1:3))
      throw new Error("Quantidade de vagas inválida.");
    // The modal asks only for missing fields. Preserve previously saved values
    // when a field is omitted, while persisting any value explicitly supplied.
    const values = {
      vehicle_brand:draft.brand.trim() || current?.vehicle_brand?.trim() || "",
      vehicle_description:draft.model.trim() || current?.vehicle_description?.trim() || "",
      vehicle_color:draft.color.trim() || current?.vehicle_color?.trim() || "",
      vehicle_plate:normalizePlate(draft.plate.trim() || current?.vehicle_plate),
      vehicle_type:vehicleType,
      vehicle_seats:normalizeVehicleSeats(vehicleType,draft.vehicleSeats),
      active_role:"MOTORISTA",
    };
    if(!values.vehicle_brand || !values.vehicle_description || !values.vehicle_color || !values.vehicle_plate)
      throw new Error("Preencha todos os campos pendentes do veículo.");
    if(!getVehicleStatus(values).hasPlate)throw new Error("Informe uma placa válida.");
    setState(prev=>({...prev,busy:true,error:null}));
    try{
      const {data,error}=await (supabase as any).from("profiles")
        .update(values).eq("id",userRef.current)
        .select("vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_type,vehicle_seats,active_role")
        .single();
      if(error || data?.active_role!=="MOTORISTA")throw new Error("Falha ao salvar o veículo.");
      const persisted=data as ProfileVehicle;
      const type=parseVehicleType(persisted.vehicle_type);
      const completed=getVehicleStatus(persisted);
      if(!completed.isComplete)throw new Error("Dados do veículo incompletos.");
      profileRef.current=persisted;
      setState(prev=>({...prev,vehicleStatus:completed,
        vehicleType:type,vehicleSeats:normalizeVehicleSeats(type,persisted.vehicle_seats),
        isDriverEligible:completed.isComplete,activeRole:"MOTORISTA",
        busy:false,error:null}));
      if (typeof window !== "undefined") window.dispatchEvent(new Event("caronaa:role-changed"));
    }catch(cause){
      const raw=cause instanceof Error?cause.message:"";
      const message=/foto|avatar|imagem/i.test(raw)
        ?"Antes de ativar o modo motorista, adicione uma foto de perfil. A foto poderá ser substituída depois, mas não removida."
        :"Não foi possível salvar os dados do veículo. Confira as informações e tente novamente.";
      setState(prev=>({...prev,busy:false,error:message}));
      throw new Error(message);
    }
  },[state.busy]);

  return {...state,switchRole,saveVehicle,refresh};
}
