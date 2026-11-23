import {useEffect,useMemo,useState} from "react";
import {Activity,CarFront,CheckCircle2,Eye,RefreshCw,Search,ShieldCheck,Users,Clock3} from "lucide-react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Avatar,AvatarFallback,AvatarImage} from "@/components/ui/avatar";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";

type Role="MOTORISTA"|"PASSAGEIRO";
type Person={
 user_id:string;role:Role;display_name:string;email:string|null;avatar_url:string|null;
 registered_at:string;suspended:boolean;email_confirmed:boolean;vehicle_type:string|null;
 vehicle_brand:string|null;vehicle_model:string|null;professional_authorized:boolean;
 shared_driver_eligible:boolean;online_with_recent_gps:boolean;last_access_at:string|null;
 last_access_role:string|null;active_days_30:number;quick_assigned:number;quick_driven_completed:number;
 quick_requested:number;quick_passenger_completed:number;shared_driven_completed:number;
 shared_passenger_completed:number;shared_requested:number;
};
type Summary={
 registered_accounts:number;registered_drivers:number;registered_passengers:number;
 authorized_drivers:number;online_drivers:number;drivers_completed_users:number;
 passengers_requested_users:number;passenger_accessed_30:number;driver_accessed_30:number;
 driver_completed_rides:number;passenger_requests:number;passenger_completed_rides:number;
};
type PeopleReport={
 generated_at:string;timezone:string;access_tracking_started_at:string|null;
 summary:Summary;users:Person[];scope:Record<string,string>;
};
const fmt=(n:number)=>n.toLocaleString("pt-BR");
const time=(s:string)=>new Date(s).toLocaleString("pt-BR",{timeZone:"America/Fortaleza",dateStyle:"short",timeStyle:"short"});
const date=(s:string)=>new Date(s).toLocaleDateString("pt-BR",{timeZone:"America/Fortaleza"});
const completed=(p:Person,isDriver:boolean)=>isDriver?p.quick_driven_completed+p.shared_driven_completed:p.quick_passenger_completed+p.shared_passenger_completed;
const requested=(p:Person)=>p.quick_requested+p.shared_requested;
function Metric({title,value,caption,tone,icon:Icon}:{
 title:string;value:number|undefined;caption:string;tone:"yellow"|"green"|"blue"|"neutral";
 icon:typeof Users;
}){
 const stripe=tone==="yellow"?"#FFBB00":tone==="green"?"#16A34A":tone==="blue"?"#2563EB":"#64748B";
 return <article className="min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-4" style={{borderTop:"3px solid "+stripe}}>
   <div className="flex items-center justify-between gap-2 text-muted-foreground">
     <p className="text-xs font-medium">{title}</p><Icon size={18} aria-hidden="true"/>
   </div>
   <p className="mt-1 font-[Sora] text-3xl font-extrabold tabular-nums">{value===undefined?"—":fmt(value)}</p>
   <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{caption}</p>
 </article>;
}
function StatePill({status,children}:{status:"good"|"warning"|"neutral";children:React.ReactNode}){
 return <span className={"inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold "+
   (status==="good"?"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300":
   status==="warning"?"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300":
   "border-border bg-muted/70 text-muted-foreground")}>{children}</span>;
}
function Identity({person}:{person:Person}){
 const initials=person.display_name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
 return <div className="flex min-w-0 items-center gap-2.5">
   <Avatar className="h-10 w-10 shrink-0">
     <AvatarImage src={person.avatar_url||undefined} alt=""/>
     <AvatarFallback className="bg-[#FFBB00]/15 text-xs font-bold">{initials}</AvatarFallback>
   </Avatar>
   <div className="min-w-0">
     <p className="truncate text-sm font-semibold" title={person.display_name}>{person.display_name}</p>
     <p className="truncate text-xs text-muted-foreground" title={person.email||undefined}>{person.email||"E-mail não informado"}</p>
   </div>
 </div>;
}
const filterOptions={
 MOTORISTA:[{id:"all",label:"Todos"},{id:"authorized",label:"Autorizados Flash"},{id:"pending",label:"Sem autorização Flash"},
   {id:"online",label:"Online com GPS"},{id:"completed",label:"Com viagem concluída"},{id:"accessed",label:"Acesso medido (30 dias)"}],
 PASSAGEIRO:[{id:"all",label:"Todos"},{id:"requested",label:"Fizeram pedidos"},
   {id:"completed",label:"Com viagem concluída"},{id:"accessed",label:"Acesso medido (30 dias)"}],
};
export function OperationsPeopleDashboard({kind}:{kind:"motoristas"|"passageiros"}){
 const driver=kind==="motoristas";
 const role:Role=driver?"MOTORISTA":"PASSAGEIRO";
 const [report,setReport]=useState<PeopleReport|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [reload,setReload]=useState(0),[query,setQuery]=useState(""),[filter,setFilter]=useState("all");
 const [page,setPage]=useState(0),[selected,setSelected]=useState<Person|null>(null);
 useEffect(()=>{
   let mounted=true;
   async function fetchPeople(){
     if(mounted)setLoading(true);
     try{
       const {data,error:rpcError}=await (supabase as any).rpc("admin_operations_people_truth");
       if(rpcError||!data?.summary||!Array.isArray(data.users))
         throw new Error(rpcError?.message||"Consulta de pessoas inválida. Verifique a migration 0243.");
       if(mounted){setReport(data as PeopleReport);setError("");}
     }catch(e){if(mounted)setError(e instanceof Error?e.message:"Falha ao consultar as contas");}
     finally{if(mounted)setLoading(false);}
   }
   void fetchPeople();
   const timer=window.setInterval(()=>void fetchPeople(),60_000);
   return()=>{mounted=false;window.clearInterval(timer);};
 },[reload]);
 useEffect(()=>{setQuery("");setFilter("all");setPage(0);setSelected(null);},[kind]);
 useEffect(()=>setPage(0),[query,filter]);
 const users=useMemo(()=>(report?.users??[]).filter(p=>p.role===role),[report,role]);
 const visible=useMemo(()=>users.filter(p=>{
   const term=query.toLocaleLowerCase("pt-BR").trim();
   if(term&&!((p.display_name+" "+(p.email??"")).toLocaleLowerCase("pt-BR").includes(term)))return false;
   if(filter==="authorized")return driver&&p.professional_authorized;
   if(filter==="pending")return driver&&!p.professional_authorized;
   if(filter==="online")return driver&&p.online_with_recent_gps;
   if(filter==="completed")return completed(p,driver)>0;
   if(filter==="requested")return !driver&&requested(p)>0;
   if(filter==="accessed")return p.active_days_30>0;
   return true;
 }),[users,query,filter,driver]);
 const totalPages=Math.max(1,Math.ceil(visible.length/10));
 const activePage=Math.min(page,totalPages-1);
 const rows=visible.slice(activePage*10,activePage*10+10);
 const summary=report?.summary;
 const metrics=driver?[
   {title:"Motoristas cadastrados",value:summary?.registered_drivers,caption:"Contas autenticadas no perfil MOTORISTA",tone:"yellow" as const,icon:Users},
   {title:"Autorizados para Flash",value:summary?.authorized_drivers,caption:"Autorização profissional aprovada",tone:"green" as const,icon:ShieldCheck},
   {title:"Online com GPS recente",value:summary?.online_drivers,caption:"Presença e GPS registrados há até 90 s",tone:"blue" as const,icon:Activity},
   {title:"Com viagem concluída",value:summary?.drivers_completed_users,caption:"Motoristas distintos com conclusão registrada",tone:"neutral" as const,icon:CarFront},
 ]:[
   {title:"Passageiros cadastrados",value:summary?.registered_passengers,caption:"Contas autenticadas no perfil PASSAGEIRO",tone:"yellow" as const,icon:Users},
   {title:"Solicitaram viagens",value:summary?.passengers_requested_users,caption:"Pessoas distintas, Flash e carona compartilhada",tone:"green" as const,icon:CheckCircle2},
   {title:"Viagens concluídas",value:summary?.passenger_completed_rides,caption:"Corridas finalizadas vinculadas a passageiros",tone:"blue" as const,icon:CarFront},
   {title:"Acessaram em 30 dias",value:summary?.passenger_accessed_30,caption:"Somente acessos captados pela nova telemetria",tone:"neutral" as const,icon:Clock3},
 ];
 const access=(p:Person)=>p.last_access_at
   ?<div><span className="text-sm">{time(p.last_access_at)}</span>
     <p className="text-[11px] text-muted-foreground">{p.active_days_30} dia(s) registrado(s) em 30 dias</p></div>
   :<span className="text-xs text-muted-foreground">Ainda não medido</span>;
 const auth=(p:Person)=>p.professional_authorized
   ?<StatePill status="good">Autorizado Flash</StatePill>
   :<StatePill status="neutral">Sem autorização Flash</StatePill>;
 return <section className="min-w-0 space-y-4" aria-label={driver?"Gestão real de motoristas":"Gestão real de passageiros"}>
   <header className="flex flex-wrap items-start justify-between gap-3">
     <div>
       <h2 className="font-[Sora] text-xl font-bold">{driver?"Motoristas":"Passageiros"}</h2>
       <p className="mt-1 text-xs text-muted-foreground">Contas reais · {driver?"habilitação, presença e viagens":"pedidos, viagens e acessos autenticados"} · Horário de Fortaleza</p>
       {report&&<p className="mt-1 text-xs text-muted-foreground">Atualizado em {time(report.generated_at)} · atualização a cada 60 s</p>}
     </div>
     <Button variant="outline" size="sm" onClick={()=>setReload(x=>x+1)} disabled={loading} className="min-h-10 gap-2">
       <RefreshCw size={16} className={loading?"animate-spin":""}/> Atualizar
     </Button>
   </header>
   {error&&<div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Não foi possível carregar os números oficiais: {error}</div>}
   {loading&&!report&&<p role="status" className="py-8 text-center text-sm text-muted-foreground">Conferindo contas e registros operacionais…</p>}
   {report&&<>
     <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">{metrics.map(m=><Metric key={m.title} {...m}/>)}</div>
     <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
       <span><strong className="text-foreground">{fmt(users.length)}</strong> contas no perfil atual · <strong className="text-foreground">{fmt(visible.length)}</strong> com os filtros</span>
       <span>Cadastro não significa presença online ou atividade recente</span>
     </div>
     <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
       <div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={17}/>
         <Input aria-label="Buscar por nome ou e-mail" value={query} onChange={e=>setQuery(e.target.value)}
           placeholder="Buscar por nome ou e-mail…" className="h-11 pl-9"/>
       </div>
       <select aria-label="Filtrar situação operacional" value={filter} onChange={e=>setFilter(e.target.value)}
         className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
         {filterOptions[role].map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
       </select>
     </div>
     <div className="hidden min-w-0 overflow-hidden rounded-xl border lg:block">
       <table className="w-full table-fixed text-left text-sm">
         <thead className="bg-muted/50 text-xs text-muted-foreground">
           <tr><th className="w-[25%] px-3 py-3 font-semibold">Pessoa</th>
             <th className="w-[20%] px-3 py-3 font-semibold">{driver?"Habilitação":"Pedidos realizados"}</th>
             <th className="w-[13%] px-3 py-3 font-semibold">{driver?"Disponibilidade":"Viagens concluídas"}</th>
             <th className="w-[13%] px-3 py-3 font-semibold">{driver?"Concluídas":"Cadastro"}</th>
             <th className="w-[19%] px-3 py-3 font-semibold">Último acesso medido</th>
             <th className="w-[10%] px-3 py-3 text-right font-semibold">Detalhes</th></tr>
         </thead>
         <tbody className="divide-y divide-border">
           {rows.map(p=><tr key={p.user_id} className="hover:bg-muted/30">
             <td className="px-3 py-3"><Identity person={p}/></td>
             <td className="px-3 py-3">{driver
               ?<div className="space-y-1">{auth(p)}<p className="text-xs text-muted-foreground">{p.vehicle_type||"Veículo não informado"}{p.shared_driver_eligible?" · Carona compartilhada":""}</p></div>
               :<div><strong className="tabular-nums">{fmt(requested(p))}</strong><p className="text-xs text-muted-foreground">{p.suspended?"Conta suspensa":"Conta cadastrada"}</p></div>}
             </td>
             <td className="px-3 py-3">{driver
               ?<StatePill status={p.online_with_recent_gps?"good":"neutral"}>{p.online_with_recent_gps?"Online com GPS":"Sem sinal recente"}</StatePill>
               :<strong className="tabular-nums">{fmt(completed(p,false))}</strong>}</td>
             <td className="px-3 py-3">{driver?<strong className="tabular-nums">{fmt(completed(p,true))}</strong>:<span className="whitespace-nowrap text-xs">{date(p.registered_at)}</span>}</td>
             <td className="px-3 py-3">{access(p)}</td>
             <td className="px-3 py-3 text-right"><Button size="icon" variant="ghost" aria-label={"Ver detalhes de "+p.display_name} onClick={()=>setSelected(p)}><Eye size={17}/></Button></td>
           </tr>)}
         </tbody>
       </table>
     </div>
     <div className="grid gap-2 lg:hidden">
       {rows.map(p=><article key={p.user_id} className="space-y-3 rounded-2xl border bg-card p-3">
         <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><Identity person={p}/></div>
           <Button size="sm" variant="outline" onClick={()=>setSelected(p)} className="shrink-0 gap-1"><Eye size={15}/> Ver</Button></div>
         <div className="grid grid-cols-2 gap-2 text-xs">
           <div className="min-w-0"><p className="text-muted-foreground">{driver?"Autorização":"Pedidos feitos"}</p><div className="mt-1">{driver?auth(p):<strong>{requested(p)}</strong>}</div></div>
           <div><p className="text-muted-foreground">Viagens concluídas</p><p className="mt-1 font-bold">{fmt(completed(p,driver))}</p></div>
           <div className="col-span-2"><p className="text-muted-foreground">Último acesso medido</p><div className="mt-1">{access(p)}</div></div>
         </div>
       </article>)}
     </div>
     {rows.length===0&&<p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Nenhuma conta corresponde aos filtros atuais.</p>}
     <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
       <span>{fmt(visible.length)} resultado(s) · Página {activePage+1} de {totalPages}</span>
       <div className="flex gap-2">
         <Button variant="outline" size="sm" disabled={activePage===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Anterior</Button>
         <Button variant="outline" size="sm" disabled={activePage+1>=totalPages} onClick={()=>setPage(p=>p+1)}>Próxima</Button>
       </div>
     </footer>
     <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
       Cadastro = conta autenticada e perfil atual. Último acesso = sinal observado desde {report.access_tracking_started_at?date(report.access_tracking_started_at):"o início da coleta"}; ausência de sinal não prova ausência de uso. Os totais combinam Corrida Rápida e caronas compartilhadas.
     </p>
     {driver&&<a className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline underline-offset-2"
       href="/admin/motoristas">Abrir revisões antigas de motoristas de carona compartilhada</a>}
   </>}
   <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}>
     <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
       <DialogHeader><DialogTitle>{selected?.display_name}</DialogTitle>
         <DialogDescription>Detalhes da conta autenticada e da atividade registrada</DialogDescription></DialogHeader>
       {selected&&<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
         {([
           ["E-mail",selected.email||"Não informado"],["Perfil atual",selected.role],
           ["Cadastro",time(selected.registered_at)],["Conta",selected.suspended?"Suspensa":"Cadastrada"],
           ["E-mail confirmado",selected.email_confirmed?"Sim":"Não"],
           ["Autorização profissional Flash",selected.professional_authorized?"Aprovada":"Não aprovada"],
           ["Motorista compartilhado",selected.shared_driver_eligible?"Elegível":"Não habilitado"],
           ["Veículo",selected.vehicle_type||"Não informado"],
           ["Corridas Flash atribuídas",String(selected.quick_assigned)],
           ["Concluídas como motorista",String(selected.quick_driven_completed+selected.shared_driven_completed)],
           ["Pedidos como passageiro",String(requested(selected))],
           ["Concluídas como passageiro",String(completed(selected,false))],
           ["Último acesso medido",selected.last_access_at?time(selected.last_access_at):"Ainda não medido"],
           ["Dias de acesso medido (30d)",String(selected.active_days_30)],
         ] as [string,string][]).map(([name,value])=><div key={name} className="min-w-0">
           <dt className="text-xs text-muted-foreground">{name}</dt><dd className="mt-0.5 break-words font-medium">{value}</dd>
         </div>)}
       </dl>}
     </DialogContent>
   </Dialog>
 </section>;
}