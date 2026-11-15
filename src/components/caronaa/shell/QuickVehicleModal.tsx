import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VehicleDraft, VehicleMissingField, VehicleType } from "@/lib/role/use-active-role";

type Props={
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  missingFields:VehicleMissingField[];
  onSave:(vehicle:VehicleDraft)=>Promise<void>;
  initialType?:VehicleType;
  initialSeats?:number;
};
const fields: {key:VehicleMissingField;label:string;hint:string}[]=[
  {key:"brand",label:"Marca",hint:"Ex.: Honda"},
  {key:"model",label:"Modelo",hint:"Ex.: CG 160"},
  {key:"color",label:"Cor",hint:"Ex.: Preto"},
  {key:"plate",label:"Placa",hint:"Ex.: ABC1D23"},
];

export function QuickVehicleModal({
  open,onOpenChange,missingFields,onSave,initialType="car",initialSeats=1,
}:Props){
  const [draft,setDraft]=useState<VehicleDraft>({
    brand:"",model:"",color:"",plate:"",
    vehicleType:initialType,vehicleSeats:initialType==="moto"?1:Math.min(3,Math.max(1,initialSeats)),
  });
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!open)return;
    setDraft({
      brand:"",model:"",color:"",plate:"",
      vehicleType:initialType,
      vehicleSeats:initialType==="moto"?1:Math.min(3,Math.max(1,initialSeats)),
    });
    setError("");
  },[open,initialType,initialSeats]);

  const required=fields.filter(field=>missingFields.includes(field.key));
  // Brazilian legacy ABC1234 and Mercosul ABC1D23 (fifth char A-J).
  const valid=required.every(field=>draft[field.key].trim().length>0) &&
    (!missingFields.includes("plate") || /^[A-Z]{3}[0-9](?:[0-9]|[A-J])[0-9]{2}$/.test(draft.plate));
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy || !valid)return;
    setBusy(true);
    setError("");
    try{
      await onSave(draft);
      onOpenChange(false);
    }catch{
      setError("Não foi possível ativar Motorista. Confira os dados ou a configuração de elegibilidade no Supabase.");
    }finally{
      setBusy(false);
    }
  };
  return <Dialog open={open} onOpenChange={value=>{if(!busy)onOpenChange(value);}}>
    <DialogContent className="max-w-sm border-[#FFBB00]/40 bg-[#121212] text-white"
      style={{fontFamily:"Manrope, sans-serif"}}>
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl text-[#FFBB00]">
          Complete seu veículo
        </DialogTitle>
        <DialogDescription className="text-white/70">
          Informe os dados do veículo. Sem CNH, fotos ou aprovação manual nesta etapa. A ativação depende da validação do servidor.
        </DialogDescription>
      </DialogHeader>
      <form className="max-h-[75dvh] space-y-3 overflow-y-auto" onSubmit={event=>void submit(event)}>
        {required.map(field=><label key={field.key} className="block text-sm font-semibold">
          {field.label}
          <input required autoComplete="off" value={draft[field.key]}
            onChange={event=>setDraft(prev=>({
              ...prev,[field.key]:field.key==="plate"
                ?event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7)
                :event.target.value,
            }))}
            placeholder={field.hint}
            className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-3 text-white placeholder:text-white/50 focus:border-[#FFBB00] focus:outline-none"/>
        </label>)}
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">Tipo de veículo</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["car","moto"] as const).map(type=><button key={type} type="button"
              disabled={busy} aria-pressed={draft.vehicleType===type}
              onClick={()=>setDraft(prev=>({
                ...prev,vehicleType:type,
                vehicleSeats:type==="moto"?1:Math.max(1,Math.min(3,prev.vehicleSeats)),
              }))}
              className={`min-h-12 rounded-xl border px-2 font-bold ${draft.vehicleType===type
                ?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]"
                :"border-white/25 bg-white/10 text-white"}`}>
              {type==="car"?"Carro":"Moto"}
            </button>)}
          </div>
        </fieldset>
        <label className="block text-sm font-semibold">
          Vagas para passageiros
          <select value={draft.vehicleSeats} disabled={busy||draft.vehicleType==="moto"}
            onChange={event=>setDraft(prev=>({...prev,vehicleSeats:Number(event.target.value)}))}
            className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#121212] px-3 text-white">
            {Array.from({length:draft.vehicleType==="moto"?1:3},(_,index)=>index+1)
              .map(seats=><option key={seats} value={seats}>{seats} {seats===1?"vaga":"vagas"}</option>)}
          </select>
        </label>
        {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid||busy}
            className="min-h-12 bg-[#FFBB00] font-bold text-[#121212] hover:bg-[#ffd24d]">
            {busy?"Salvando...":"Salvar veículo"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
