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
  const hasPlate=isValidBrazilianPlate(profile?.vehicle_plate);
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
function parseActiveRole(value:unknown,defaultRole:ActiveRole):ActiveRole {
  const possible=typeof value==="string"?value:
    value && typeof value==="object"
      ? (value as Record<string,unknown>).active_role ??
        (value as Record<string,unknown>).activeRole ??
        (value as Record<string,unknown>).role:null;
  return possible==="MOTORISTA"||possible==="PASSAGEIRO"?possible:defaultRole;
}
function readyFromRpc(value:unknown):boolean {
  if(typeof value==="boolean")return value;
  if(value && typeof value==="object"){
    const row=Array.isArray(value)?value[0]:value;
    if(row && typeof row==="object"){
      const data=row as Record<string,unknown>;
      return data.is_driver_ready===true || data.ready===true || data.is_ready===true;
    }
  }
  return false;
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
    const [{data:profile,error:profileError},{data:roleProfile},{data:ready,error:readyError}]=await Promise.all([
      (supabase as any).from("profiles")
        .select("vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_type,vehicle_seats")
        .eq("id",userId).maybeSingle(),
      // Optional: active_role may not exist in older versions of profiles.
      (supabase as any).from("profiles").select("active_role").eq("id",userId).maybeSingle(),
      // This RPC is expected to validate the authenticated user on the server.
      (supabase as any).rpc("is_driver_ready",{p_user_id:userId}),
    ]);
    if(profileError)throw new Error("Não foi possível consultar os campos do veículo no banco.");
    if(readyError)throw new Error("RPC is_driver_ready indisponível ou assinatura incompatível.");
    const row=profile as ProfileVehicle|null;
    profileRef.current=row;
    const vehicleType=parseVehicleType(row?.vehicle_type);
    setState(prev=>({
      ...prev,vehicleStatus:getVehicleStatus(row),
      activeRole:parseActiveRole(roleProfile?.active_role??roleProfile,prev.activeRole),
      isDriverEligible:readyFromRpc(ready),
      vehicleType,vehicleSeats:normalizeVehicleSeats(vehicleType,row?.vehicle_seats),
      loading:false,error:null,
    }));
  },[]);

  useEffect(()=>{
    let alive=true;
    void refresh().catch(()=>{
      if(alive)setState(prev=>({...prev,loading:false,
        isDriverEligible:false,
        error:"Não foi possível carregar o perfil do motorista. Verifique a RPC e o esquema."}));
    });
    return()=>{alive=false;};
  },[refresh]);

  const switchRole=useCallback(async(target:ActiveRole):Promise<SwitchRoleResult>=>{
    if(state.busy || state.loading)throw new Error("Aguarde a consulta do perfil.");
    if(target==="MOTORISTA"){
      const missingFields=getMissingVehicleFields(state.vehicleStatus);
      if(missingFields.length)return {needsVehicleModal:true,missingFields};
      // Let the user review/save vehicle details if the readiness RPC has
      // not authorized the role. Never activate the role from client state alone.
      if(!state.isDriverEligible)return {needsVehicleModal:true,missingFields:[]};
    }
    const previous=state.activeRole;
    if(target==="PASSAGEIRO")setState(prev=>({...prev,activeRole:target,error:null,busy:true}));
    else setState(prev=>({...prev,busy:true,error:null}));
    try{
      const {data,error}=await (supabase as any).rpc("switch_user_active_role",{
        p_target_role:target,
      });
      if(error)throw error;
      setState(prev=>({...prev,activeRole:parseActiveRole(data,target),busy:false,error:null}));
      return {needsVehicleModal:false,missingFields:[]};
    }catch{
      setState(prev=>({...prev,activeRole:previous,busy:false,
        error:"Não foi possível alternar o papel ativo no servidor."}));
      throw new Error("Não foi possível alternar o papel ativo no servidor.");
    }
  },[state.activeRole,state.busy,state.loading,state.isDriverEligible,state.vehicleStatus]);

  const saveVehicle=useCallback(async(draft:VehicleDraft)=>{
    if(!userRef.current)throw new Error("Faça login novamente.");
    if(state.busy)throw new Error("Aguarde a operação em andamento.");
    const current=profileRef.current;
    const missing=getMissingVehicleFields(getVehicleStatus(current));
    const vehicleType=draft.vehicleType;
    if(vehicleType!=="car" && vehicleType!=="moto")throw new Error("Tipo de veículo inválido.");
    if(!Number.isInteger(draft.vehicleSeats) || draft.vehicleSeats<1 ||
      draft.vehicleSeats>(vehicleType==="moto"?1:3))
      throw new Error("Quantidade de vagas inválida.");
    const values:Record<string,string|number> = {
      vehicle_type:vehicleType,
      vehicle_seats:normalizeVehicleSeats(vehicleType,draft.vehicleSeats),
    };
    const mapping={brand:"vehicle_brand",model:"vehicle_description",
      color:"vehicle_color",plate:"vehicle_plate"} as const;
    for(const field of missing){
      const value=draft[field]?.trim()??"";
      if(!value)throw new Error("Preencha todos os campos pendentes do veículo.");
      if(field==="plate"&&!isValidBrazilianPlate(value))
        throw new Error("Informe uma placa válida.");
      values[mapping[field]]=field==="plate"?normalizePlate(value):value;
    }
    setState(prev=>({...prev,busy:true,error:null}));
    try{
      const {data,error}=await (supabase as any).from("profiles")
        .update(values).eq("id",userRef.current)
        .select("vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_type,vehicle_seats")
        .single();
      if(error||!data)throw new Error("Falha ao persistir o veículo.");
      profileRef.current=data as ProfileVehicle;
      const {data:ready,error:readyError}=await (supabase as any).rpc("is_driver_ready",{
        p_user_id:userRef.current,
      });
      // Do not infer eligibility when a server-side readiness check fails.
      if(readyError)throw new Error("Veículo salvo, mas não foi possível validar a elegibilidade.");
      const persisted=data as ProfileVehicle;
      const type=parseVehicleType(persisted.vehicle_type);
      const eligible=readyFromRpc(ready);
      const completed=getVehicleStatus(persisted);
      // Switch only after the server confirms readiness and all four
      // required fields were saved successfully.
      let activated=false;
      if(!eligible || !completed.isComplete)
        throw new Error("O servidor ainda não confirmou a aptidão do motorista.");
      const {error:roleError}=await (supabase as any).rpc("switch_user_active_role",{
        p_target_role:"MOTORISTA",
      });
      if(roleError)throw new Error("Veículo salvo; a troca de papel não foi autorizada.");
      activated=true;
      setState(prev=>({...prev,vehicleStatus:completed,
        vehicleType:type,vehicleSeats:normalizeVehicleSeats(type,persisted.vehicle_seats),
        isDriverEligible:eligible,activeRole:activated?"MOTORISTA":prev.activeRole,
        busy:false,error:null}));
    }catch{
      setState(prev=>({...prev,busy:false,
        error:"Não foi possível salvar ou validar o veículo. Confira as colunas e a RPC no Supabase."}));
      throw new Error("Não foi possível salvar ou validar o veículo no Supabase.");
    }
  },[state.busy]);

  return {...state,switchRole,saveVehicle,refresh};
}
