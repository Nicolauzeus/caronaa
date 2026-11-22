import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { F07OperationsCockpit } from "@/components/admin/F07OperationsCockpit";
import { F07OperationsCommandCenter } from "@/components/admin/F07OperationsCommandCenter";
import { OperationsHistoryReport } from "@/components/admin/OperationsHistoryReport";
import { OperationsSupportSettings } from "@/components/admin/OperationsSupportSettings";
import { QuickRideAdminPanel } from "@/components/admin/QuickRideAdminPanel";
import { QuickRideDisputesAdmin } from "@/components/admin/QuickRideDisputesAdmin";
import { ProfessionalAccessQueue } from "@/components/admin/ProfessionalAccessQueue";

export const Route=createFileRoute("/admin/operacoes")({
  component:MobilityOperationsCenter,
  head:()=>({meta:[
    {title:"Operações de Mobilidade | CARONAA"},
    {name:"description",content:"Central ao vivo, histórico de pedidos, relatórios e configurações de suporte."},
  ]}),
});
type Tool="monitor"|"disputes"|"access"|"settings";
function MobilityOperationsCenter(){
  const hash=useRouterState({select:s=>s.location.hash});
  const navigate=useNavigate();
  const section=hash.replace(/^#/,"");
  const [tools,setTools]=useState(false);
  const [tool,setTool]=useState<Tool>("monitor");
  const showHistory=section==="history";
  const showSupport=section==="support";
  const openTools=(next:Tool="monitor")=>{setTool(next);setTools(true);};
  const back=()=>{setTools(false);void navigate({hash:"command",search:true});};
  return <main className="min-w-0 w-full pb-6">
    {showHistory?<OperationsHistoryReport/>:showSupport?<OperationsSupportSettings/>:
      !tools?<F07OperationsCockpit onOpenTools={()=>openTools()}/>:
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={back}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#FFBB00]">
            <ArrowLeft size={16}/> Voltar ao Centro de Operações
          </button>
          <div><h1 className="font-[Sora] text-xl font-bold">Ferramentas administrativas</h1>
            <p className="text-xs text-muted-foreground">Auditoria, ocorrências, habilitação e configuração; sem alterar a visão operacional.</p></div>
        </header>
        <div role="group" aria-label="Ferramentas administrativas" className="flex flex-wrap gap-2">
          {([{id:"monitor",label:"Auditoria operacional"},{id:"disputes",label:"Contestações"},
            {id:"access",label:"Habilitação de motoristas"},{id:"settings",label:"Configurações profissionais"}] as const)
            .map(item=><button key={item.id} type="button" aria-pressed={tool===item.id} onClick={()=>setTool(item.id)}
            className={"min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[#FFBB00] "+
              (tool===item.id?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-border bg-card text-foreground")}>
              {item.label}</button>)}
        </div>
        {tool==="monitor"&&<F07OperationsCommandCenter onGoToDisputes={()=>openTools("disputes")} onGoToAccess={()=>openTools("access")}/>}
        {tool==="disputes"&&<QuickRideDisputesAdmin/>}
        {tool==="access"&&<ProfessionalAccessQueue/>}
        {tool==="settings"&&<QuickRideAdminPanel/>}
      </div>}
  </main>;
}