import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VehicleMissingField } from "@/lib/role/use-active-role";

export type VehicleDraft = { brand:string; model:string; color:string; plate:string };
type Props = {
  open:boolean;
  onOpenChange:(open:boolean)=>void;
  missingFields:VehicleMissingField[];
  onReview?:(vehicle:VehicleDraft)=>void;
};
const fields: {key:keyof VehicleDraft;label:string;hint:string}[] = [
  {key:"brand",label:"Marca",hint:"Ex.: Honda"},
  {key:"model",label:"Modelo",hint:"Ex.: CG 160"},
  {key:"color",label:"Cor",hint:"Ex.: Preto"},
  {key:"plate",label:"Placa",hint:"Ex.: ABC1D23"},
];
const emptyDraft:VehicleDraft={brand:"",model:"",color:"",plate:""};
export function QuickVehicleModal({open,onOpenChange,missingFields,onReview}:Props) {
  const [draft,setDraft]=useState<VehicleDraft>(emptyDraft);
  const [reviewed,setReviewed]=useState(false);
  useEffect(()=>{if(open){setDraft(emptyDraft);setReviewed(false);}},[open]);
  const required=fields.filter(f=>missingFields.includes(f.key));
  const valid=required.every(f=>draft[f.key].trim().length>0) &&
    (!missingFields.includes("plate") || /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(draft.plate));
  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(!valid)return;
    onReview?.(draft);
    setReviewed(true);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm border-[#FFBB00]/40 bg-[#121212] text-white"
      style={{fontFamily:"Manrope, sans-serif"}}>
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl text-[#FFBB00]">Complete seu veículo</DialogTitle>
        <DialogDescription className="text-white/70">Preencha os campos pendentes para revisar seu cadastro de motorista.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        {required.map(field=><label key={field.key} className="block text-sm font-semibold">
          {field.label}
          <input autoComplete="off" value={draft[field.key]}
            onChange={event=>setDraft(prev=>({...prev,[field.key]:field.key==="plate"?event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7):event.target.value}))}
            placeholder={field.hint}
            className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-3 text-white placeholder:text-white/45 focus:border-[#FFBB00] focus:outline-none"/>
        </label>)}
        {reviewed && <p role="status" className="text-sm text-[#FFBB00]">Dados preparados para revisão. Ainda não foram salvos no perfil.</p>}
        <p className="text-xs text-white/60">Nesta etapa visual, nenhum dado é enviado ao banco. A ativação depende do cadastro persistido e da autorização existente.</p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Voltar</Button>
          <Button type="submit" disabled={!valid} className="bg-[#FFBB00] text-[#121212] hover:bg-[#ffd24d]">Revisar dados</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
