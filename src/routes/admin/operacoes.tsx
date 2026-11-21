import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { F07OperationsCommandCenter } from "@/components/admin/F07OperationsCommandCenter";
import { QuickRideAdminPanel } from "@/components/admin/QuickRideAdminPanel";
import { QuickRideDisputesAdmin } from "@/components/admin/QuickRideDisputesAdmin";
import { ProfessionalAccessQueue } from "@/components/admin/ProfessionalAccessQueue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/operacoes")({
  component: MobilityOperationsCenter,
  head: () => ({meta:[{title:"BI e Operações | CARONAA"},
    {name:"description",content:"Painel de indicadores, motoristas online, pedidos e corridas CARONAA."}]}),
});

function MobilityOperationsCenter(){
  const [tab,setTab]=useState("bi");
  const [management,setManagement]=useState<"incidents"|"access"|"pilot">("incidents");
  return <main className="mx-auto w-full max-w-screen-2xl space-y-4 p-2 sm:p-4">
    <header>
      <h1 className="font-[Sora] text-2xl font-bold">BI de operações</h1>
      <p className="text-sm text-muted-foreground">
        Uma visão da operação: motoristas conectados, pedidos aguardando,
        corridas abertas e finalizadas. Dados ao vivo separados do histórico.
      </p>
    </header>
    <Tabs value={tab} onValueChange={setTab} className="space-y-3">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1">
        <TabsTrigger value="bi" className="min-h-11">Painel operacional</TabsTrigger>
        <TabsTrigger value="management" className="min-h-11">Gestão e exceções</TabsTrigger>
      </TabsList>
      <TabsContent value="bi" className="mt-0">
        <F07OperationsCommandCenter onGoToDisputes={()=>{
          setManagement("incidents");setTab("management");
        }} onGoToAccess={()=>{setManagement("access");setTab("management");}}/>
      </TabsContent>
      <TabsContent value="management" className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Gestão operacional">
          <button type="button" aria-pressed={management==="incidents"} onClick={()=>setManagement("incidents")}
            className="min-h-11 rounded-xl border px-3 text-sm">Contestações</button>
          <button type="button" aria-pressed={management==="access"} onClick={()=>setManagement("access")}
            className="min-h-11 rounded-xl border px-3 text-sm">Cadastros e acessos</button>
          <button type="button" aria-pressed={management==="pilot"} onClick={()=>setManagement("pilot")}
            className="min-h-11 rounded-xl border px-3 text-sm">Configurações</button>
        </div>
        {management==="incidents"&&<QuickRideDisputesAdmin/>}
        {management==="access"&&<ProfessionalAccessQueue/>}
        {management==="pilot"&&<QuickRideAdminPanel/>}
      </TabsContent>
    </Tabs>
  </main>;
}
