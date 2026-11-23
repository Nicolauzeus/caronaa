import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bike, CarFront, Check, Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CAR_CATEGORIES, isValidBrazilianPlate, normalizePlate, type CarCategory } from "@/lib/professional-access";

type VehicleType="CAR"|"MOTO";
type DriverVehicle={
 id:string;vehicle_type:VehicleType;brand:string;model:string;color:string;plate:string;
 car_category:CarCategory|null;passenger_seats:number;approved:boolean;is_active:boolean;
};
type Fields={type:VehicleType;brand:string;model:string;color:string;plate:string;category:CarCategory|"";seats:number};
const empty:Fields={type:"CAR",brand:"",model:"",color:"",plate:"",category:"",seats:1};
const fieldStyle="mt-1.5 min-h-11 w-full rounded-xl border border-white/20 bg-[#242424] px-3 text-base text-white outline-none focus-visible:border-[#FFBB00]";

export function ProfessionalVehiclesManager({onActivated}:{onActivated?:()=>void}){
 const [vehicles,setVehicles]=useState<DriverVehicle[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [showForm,setShowForm]=useState(false);
 const [fields,setFields]=useState<Fields>(empty);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
   const {data,error:rpcError}=await (supabase as any).rpc("get_my_professional_vehicles");
   if(rpcError||!Array.isArray(data))throw new Error(rpcError?.message||"Não foi possível consultar os veículos. Verifique a migration 0245.");
   setVehicles(data as DriverVehicle[]);
 },[]);
 useEffect(()=>{
   let live=true;
   void (async()=>{
     try{
       const {data,error:rpcError}=await (supabase as any).rpc("get_my_professional_vehicles");
       if(!live)return;
       if(rpcError||!Array.isArray(data))throw Error(rpcError?.message||"Não foi possível consultar os veículos.");
       setVehicles(data as DriverVehicle[]);setError("");
     }catch(e){if(live)setError(e instanceof Error?e.message:"Falha ao carregar veículos");}
     finally{if(live)setLoading(false);}
   })();
   return()=>{live=false};
 },[]);
 function update<K extends keyof Fields>(key:K,value:Fields[K]){
   setFields(prev=>({...prev,[key]:value}));
 }
 async function save(e:FormEvent){
   e.preventDefault();if(busy)return;
   setError("");setMessage("");
   if(!isValidBrazilianPlate(fields.plate)){setError("Informe uma placa válida: ABC1234 ou ABC1D23.");return;}
   if(!fields.brand.trim()||!fields.model.trim()||!fields.color.trim()||
      (fields.type==="CAR"&&!fields.category)){
     setError("Confira marca, modelo, cor e categoria do veículo.");return;
   }
   setBusy(true);
   try{
     const {error:rpcError}=await (supabase as any).rpc("save_my_professional_vehicle",{
       p_vehicle_type:fields.type,p_brand:fields.brand.trim(),p_model:fields.model.trim(),
       p_color:fields.color.trim(),p_plate:normalizePlate(fields.plate),
       p_car_category:fields.type==="CAR"?fields.category:null,
       p_passenger_seats:fields.type==="MOTO"?1:fields.seats,
     });
     if(rpcError)throw new Error(rpcError.message);
     await refresh();
     setFields(empty);setShowForm(false);
     setMessage("Veículo salvo. Para receber pedidos com ele, selecione 'Usar este veículo' enquanto estiver offline.");
   }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar o veículo.");}
   finally{setBusy(false);}
 }
 async function activate(id:string){
   if(busy)return;
   setBusy(true);setError("");setMessage("");
   try{
     const {error:rpcError}=await (supabase as any).rpc("activate_my_professional_vehicle",{p_vehicle_id:id});
     if(rpcError)throw new Error(rpcError.message);
     await refresh();
     setMessage("Veículo ativado para as próximas corridas.");
     window.dispatchEvent(new Event("caronaa:role-changed"));
     onActivated?.();
   }catch(e){setError(e instanceof Error?e.message:"Não foi possível ativar o veículo.");}
   finally{setBusy(false);}
 }
 return <section className="space-y-3" aria-label="Meus veículos profissionais">
   <div>
     <h3 className="font-[Sora] text-base font-bold text-white">Meus veículos</h3>
     <p className="mt-1 text-xs text-white/65">Tenha carro e moto na mesma conta, com placas distintas. Apenas um veículo fica ativo no radar por vez.</p>
   </div>
   {loading&&<p role="status" className="text-sm text-white/70">Consultando veículos…</p>}
   {error&&<p role="alert" className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</p>}
   {message&&<p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
   {!loading&&vehicles.length===0&&<p className="rounded-xl border border-white/15 p-3 text-sm text-white/70">Nenhum veículo completo foi identificado. Cadastre o primeiro com sua placa.</p>}
   <div className="space-y-2">
     {vehicles.map(vehicle=><article key={vehicle.id} className={"rounded-xl border p-3 "+(vehicle.is_active?"border-[#FFBB00]/70 bg-[#FFBB00]/10":"border-white/15 bg-white/[0.03]")}>
       <div className="flex flex-wrap items-center justify-between gap-3">
         <div className="flex min-w-0 items-center gap-3">
           {vehicle.vehicle_type==="MOTO"?<Bike size={25} className="shrink-0 text-[#FFBB00]"/>:<CarFront size={25} className="shrink-0 text-[#FFBB00]"/>}
           <div className="min-w-0">
             <p className="text-sm font-bold text-white">{vehicle.vehicle_type==="MOTO"?"Moto":"Carro"} · {vehicle.brand} {vehicle.model}</p>
             <p className="text-xs text-white/70">Placa {vehicle.plate} · {vehicle.color} · {vehicle.passenger_seats} vaga(s)</p>
             {vehicle.is_active&&<span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#FFBB00]"><Check size={13}/> Veículo ativo no radar</span>}
           </div>
         </div>
         {!vehicle.is_active&&<button type="button" disabled={busy||!vehicle.approved}
           className="min-h-11 shrink-0 rounded-xl border border-[#FFBB00] px-3 text-xs font-bold text-[#FFBB00] disabled:opacity-50"
           onClick={()=>void activate(vehicle.id)}>
           {vehicle.approved?"Usar este veículo":"Aguardando habilitação"}
         </button>}
       </div>
     </article>)}
   </div>
   <button type="button" onClick={()=>{setShowForm(x=>!x);setError("");}} disabled={busy}
     aria-expanded={showForm} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FFBB00]/60 px-3 text-sm font-bold text-[#FFBB00]">
     <Plus size={17}/> {showForm?"Fechar cadastro":"Adicionar outro veículo"}
   </button>
   {showForm&&<form onSubmit={e=>void save(e)} className="space-y-3 rounded-xl border border-white/15 p-3" noValidate>
     <p className="text-xs text-white/70">Cada veículo precisa de placa própria. Matrícula profissional não é solicitada.</p>
     <div role="group" aria-label="Tipo do novo veículo" className="grid grid-cols-2 gap-2">
       {(["CAR","MOTO"] as const).map(type=><button key={type} type="button"
         aria-pressed={fields.type===type}
         onClick={()=>{setFields(p=>({...p,type,category:"",seats:1}));setError("");}}
         className={"min-h-11 rounded-xl border text-sm font-semibold "+(fields.type===type?"border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]":"border-white/20 text-white")}>
         {type==="CAR"?"Carro":"Moto"}</button>)}
     </div>
     <div className="grid grid-cols-2 gap-3">
       <label className="text-xs font-bold text-white">Marca<input className={fieldStyle} value={fields.brand} maxLength={60}
         onChange={e=>update("brand",e.target.value)} placeholder="Honda"/></label>
       <label className="text-xs font-bold text-white">Modelo<input className={fieldStyle} value={fields.model} maxLength={160}
         onChange={e=>update("model",e.target.value)} placeholder={fields.type==="MOTO"?"CG 160":"Fit"}/></label>
     </div>
     <div className="grid grid-cols-2 gap-3">
       <label className="text-xs font-bold text-white">Cor<input className={fieldStyle} value={fields.color} maxLength={60}
         onChange={e=>update("color",e.target.value)} placeholder="Preto"/></label>
       <label className="text-xs font-bold text-white">Placa<input className={fieldStyle} value={fields.plate} maxLength={8}
         autoCapitalize="characters" onChange={e=>update("plate",e.target.value.toUpperCase())} placeholder="ABC1D23"/></label>
     </div>
     {fields.type==="CAR"&&<div className="grid grid-cols-2 gap-3">
       <label className="text-xs font-bold text-white">Categoria
         <select className={fieldStyle} value={fields.category} onChange={e=>update("category",e.target.value as CarCategory)}>
           <option value="">Selecione</option>{CAR_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
         </select></label>
       <label className="text-xs font-bold text-white">Vagas
         <select className={fieldStyle} value={fields.seats} onChange={e=>update("seats",Number(e.target.value))}>
           {[1,2,3].map(i=><option key={i} value={i}>{i}</option>)}
         </select></label>
     </div>}
     <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212] disabled:opacity-60">
       {busy?"Salvando…":"Salvar veículo"}
     </button>
   </form>}
   <p className="flex items-start gap-2 text-xs text-white/60">
     <ShieldCheck size={17} className="shrink-0 text-[#FFBB00]"/>
     Para trocar de veículo, fique offline e conclua corridas ou ofertas abertas. Os pedidos continuam filtrados pelo tipo do veículo ativo.
   </p>
 </section>;
