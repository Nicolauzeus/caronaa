import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OperationPage } from "@/components/admin/OperationPage";
import { OperationsPeopleDashboard } from "@/components/admin/OperationsPeopleDashboard";
import { ArrowLeft, Settings2, Route as RouteIcon, UsersRound } from "lucide-react";
import "@/components/admin/operations-workspace.css";
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
type Tool="monitor"|"disputes"|"access";
function MobilityOperationsCenter(){
  const hash=useRouterState({select:s=>s.location.hash});
  const navigate=useNavigate();
  const section=hash.replace(/^#/,"");
  const [tools,setTools]=useState(false);
  const [journeyTab,setJourneyTab]=useState<"caronas"|"solicitacoes"|"matching">("caronas");
  const [peopleTab,setPeopleTab]=useState<"motoristas"|"passageiros">("motoristas");
  const [tool,setTool]=useState<Tool>("monitor");
  const showHistory=section==="history";
  const showIntelligence=section==="intelligence";
  const showJourneys=section==="journeys";
  const showPeople=section==="people";
  const showSupport=section==="support";
  useEffect(()=>{setTools(false);},[section]);
  const openTools=(next:Tool="monitor")=>{setTool(next);setTools(true);};
  const back=()=>{setTools(false);void navigate({hash:"command",search:true});};
  return <div className="operations-workspace min-w-0 w-full pb-4" data-operations-module={showHistory?"reports":showIntelligence?"intelligence":showJourneys?"journeys":showPeople?"people":showSupport?"settings":"central"}>
    {showHistory?<OperationsHistoryReport mode="reports"/>:
     showIntelligence?<OperationsHistoryReport mode="intelligence"/>:
     showSupport?<section className="min-w-0 space-y-4" aria-label="Configurações operacionais">
       <header className="ops-heading"><div className="ops-eyebrow"><Settings2 size={14}/> Administração</div><h1 className="font-[Sora] text-2xl font-extrabold">Configurações</h1>
         <p className="text-sm text-muted-foreground">Suporte e parâmetros administrativos, separados da operação ao vivo.</p></header>
       <OperationsSupportSettings/>
       <details className="ops-panel rounded-2xl border bg-card p-4">
         <summary className="cursor-pointer text-sm font-bold">Configurações profissionais avançadas</summary>
         <div className="mt-4"><QuickRideAdminPanel/></div>
       </details>
     </section>:
     showJourneys?<section className="min-w-0 space-y-3" aria-label="Gestão de viagens">
       <header className="ops-heading"><div className="ops-eyebrow"><RouteIcon size={14}/> Gestão de mobilidade</div><h1 className="font-[Sora] text-2xl font-extrabold">Viagens</h1>
         <p className="text-sm text-muted-foreground">Ofertas, pedidos de carona e correspondências em um só lugar.</p></header>
       <nav aria-label="Tipo de operação" className="ops-subnav flex max-w-full flex-wrap gap-2">
         {([{id:"caronas",label:"Caronas"},{id:"solicitacoes",label:"Solicitações"},
            {id:"matching",label:"Correspondências"}] as const).map(item=>
           <button key={item.id} type="button" aria-pressed={journeyTab===item.id}
             onClick={()=>setJourneyTab(item.id)}
             className={"shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold "+(journeyTab===item.id?"bg-[#FFBB00] text-[#121212] border-[#FFBB00]":"bg-card")}>
             {item.label}</button>)}
       </nav>
       <OperationPage kind={journeyTab} embedded/>
     </section>:
     showPeople?<section className="min-w-0 space-y-3" aria-label="Gestão de pessoas">
       <header className="ops-heading"><div className="ops-eyebrow"><UsersRound size={14}/> Contas e desempenho</div><h1 className="font-[Sora] text-2xl font-extrabold">Pessoas</h1>
         <p className="text-sm text-muted-foreground">Contas reais, habilitação, pedidos e atividade medida por perfil.</p></header>
       <nav aria-label="Perfis operacionais" className="ops-subnav flex max-w-full flex-wrap gap-2">
         {([{id:"motoristas",label:"Motoristas"},{id:"passageiros",label:"Passageiros"}] as const).map(item=>
           <button key={item.id} type="button" aria-pressed={peopleTab===item.id}
             onClick={()=>setPeopleTab(item.id)}
             className={"shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold "+(peopleTab===item.id?"bg-[#FFBB00] text-[#121212] border-[#FFBB00]":"bg-card")}>
             {item.label}</button>)}
       </nav>
       <OperationsPeopleDashboard kind={peopleTab}/>
     </section>:
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
            {id:"access",label:"Habilitação de motoristas"}] as const)
            .map(item=><button key={item.id} type="button" aria-pressed={tool===item.id} onClick={()=>setTool(item.id)}
            className={"min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[#FFBB00] "+
              (tool===item.id?"border-[#FFBB00] bg-[#FFBB00] text-[#121212]":"border-border bg-card text-foreground")}>
              {item.label}</button>)}
        </div>
        {tool==="monitor"&&<F07OperationsCommandCenter onGoToDisputes={()=>openTools("disputes")} onGoToAccess={()=>openTools("access")}/>}
        {tool==="disputes"&&<QuickRideDisputesAdmin/>}
        {tool==="access"&&<ProfessionalAccessQueue/>}
      </div>}
  </div>;
}