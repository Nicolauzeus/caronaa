import { Button } from "@/components/ui/button";
import { CalendarDays, Zap } from "lucide-react";
export type ServiceType = "FLASH" | "AGENDADA";
type Props={value:ServiceType;onChange:(next:ServiceType)=>void;disabled?:boolean;compact?:boolean};
export function ServiceTypeDock({value,onChange,disabled=false,compact=false}:Props) {
  return <nav aria-label="Tipo de serviço" className="mx-auto grid w-full max-w-sm grid-cols-2 gap-2 rounded-2xl border border-caronaa-white/15 bg-secondary p-1"
    style={{fontFamily:"Manrope, sans-serif"}}>
    <Button variant="ghost" type="button" disabled={disabled} aria-pressed={value==="FLASH"} onClick={()=>onChange("FLASH")}
      className={`flex ${compact?"min-h-11":"min-h-12"} items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${value==="FLASH"?"bg-primary text-primary-foreground":"bg-caronaa-white/10 text-secondary-foreground hover:bg-caronaa-white/20"}`}>
      <Zap size={18}/> Agora
    </Button>
    <Button variant="ghost" type="button" disabled={disabled} aria-pressed={value==="AGENDADA"} onClick={()=>onChange("AGENDADA")}
      className={`flex ${compact?"min-h-11":"min-h-12"} items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${value==="AGENDADA"?"bg-primary text-primary-foreground":"bg-caronaa-white/10 text-secondary-foreground hover:bg-caronaa-white/20"}`}>
      <CalendarDays size={18}/> Agendar
    </Button>
  </nav>;
}
