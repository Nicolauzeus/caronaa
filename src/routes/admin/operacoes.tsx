import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { F07OperationsCockpit } from "@/components/admin/F07OperationsCockpit";
import { F07OperationsCommandCenter } from "@/components/admin/F07OperationsCommandCenter";
import { QuickRideAdminPanel } from "@/components/admin/QuickRideAdminPanel";
import { QuickRideDisputesAdmin } from "@/components/admin/QuickRideDisputesAdmin";
import { ProfessionalAccessQueue } from "@/components/admin/ProfessionalAccessQueue";

export const Route=createFileRoute("/admin/operacoes")({
  component:MobilityOperationsCenter,
  head:()=>({meta:[
    {title:"Centro de Operações | CARONAA"},
    {name:"description",content:"Operação em tempo quase real, motoristas, passageiros, corridas e ocorrências."},
  ]}),
});

type Tool="monitor"|"disputes"|"access"|"settings";
function MobilityOperationsCenter(){
  const [tools,setTools]=useState(false);
  const [section,setSection]=useState<Tool>("monitor");
  const openTools=(next:Tool="monitor")=>{setSection(next);setTools(true);};
  return <main className="min-w-0 w-full pb-6">
    {!tools?<F07OperationsCockpit onOpenTools={()=>openTools()}/>:
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={()=>setTools(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#FFBB00]">
            <ArrowLeft size={16}/> Voltar ao Centro de Operações
          </button>
          <div>
            <h1 className="font-[Sora] text-xl font-bold">Ferramentas administrativas</h1>
            <p className="text-xs text-muted-foreground">Auditoria, ocorrências, habilitação e configuração; sem alterar a visão operacional.</p>
          </div>
        </header>
        <div role="group" aria-label="Ferramentas administrativas" className="flex flex-wrap gap-2">
          {([
            {id:"monitor",label:"Auditoria operacional"},
            {id:"disputes",label:"Contestações"},
            {id:"access",label:"Habilitação de motoristas"},
            {id:"settings",label:"Configurações"},
          ] as const).map(item=><button key={item.id} type="button"
            aria-pressed={section===item.id} onClick={()=>setSection(item.id)}
            className={"min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[#FFBB00] "+
              (section===item.id?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-border bg-card text-foreground")}>
            {item.label}
          </button>)}
        </div>
        {section==="monitor"&&<F07OperationsCommandCenter onGoToDisputes={()=>openTools("disputes")}
          onGoToAccess={()=>openTools("access")}/>}
        {section==="disputes"&&<QuickRideDisputesAdmin/>}
        {section==="access"&&<ProfessionalAccessQueue/>}
        {section==="settings"&&<QuickRideAdminPanel/>}
      </div>}
  </main>;
}
