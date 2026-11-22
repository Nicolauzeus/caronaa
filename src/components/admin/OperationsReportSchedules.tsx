import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Mail, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Cadence="daily"|"weekly"|"monthly";
type Schedule={cadence:Cadence;enabled:boolean;recipients:string[];local_hour:number;updated_at:string};
type Delivery={cadence:Cadence;window_start:string;window_end:string;status:"SENDING"|"SENT"|"FAILED";updated_at:string;sent_at:string|null;error_code:string|null};
type Payload={schedules:Schedule[];deliveries:Delivery[]};
const names:Record<Cadence,string>={daily:"Diário",weekly:"Semanal",monthly:"Mensal"};
const descriptions:Record<Cadence,string>={daily:"Todos os dias · período de ontem",weekly:"Segunda-feira · semana anterior",monthly:"Dia 1 · mês anterior"};
const emailPattern=/^[^\s@]+@[^\s@]+[.][^\s@]+$/;

export function OperationsReportSchedules(){
  const [payload,setPayload]=useState<Payload|null>(null);
  const [form,setForm]=useState<Record<string,{enabled:boolean;recipients:string;hour:number}>>({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<Cadence|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    const {data,error:rpcError}=await (supabase as any).rpc("admin_caronaa_report_schedules");
    if(rpcError||!Array.isArray(data?.schedules)){
      setError("Configurações indisponíveis. Confirme a migration 0234 e a permissão administrativa.");
      setPayload(null);
    }else{
      setPayload(data as Payload);
      setForm(Object.fromEntries((data.schedules as Schedule[]).map(s=>[s.cadence,{
        enabled:s.enabled,recipients:s.recipients.join(", "),hour:s.local_hour
      }])));
    }
    setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);
  async function save(cadence:Cadence){
    const item=form[cadence];if(!item||busy)return;
    const recipients=Array.from(new Set(item.recipients.split(/[,\n;]/).map(x=>x.trim().toLowerCase()).filter(Boolean)));
    if(recipients.length>10||recipients.some(x=>x.length>254||!emailPattern.test(x))||
      (item.enabled&&recipients.length===0)){
      setError("Informe até 10 e-mails válidos, separados por vírgula, antes de ativar o envio.");
      return;
    }
    setBusy(cadence);setError("");setNotice("");
    const {error:rpcError,data:ok}=await (supabase as any).rpc("admin_save_caronaa_report_schedule",{
      p_cadence:cadence,p_enabled:item.enabled,p_recipients:recipients,p_local_hour:item.hour,
    });
    if(rpcError||ok!==true)setError("Não foi possível salvar: "+(rpcError?.message??"Resposta inválida"));
    else {setNotice("Configuração de "+names[cadence].toLowerCase()+" salva. O envio exige provedor e agendador configurados no servidor.");await load();}
    setBusy(null);
  }
  return <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Resumos automáticos por e-mail">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <CalendarClock size={21} className="text-[#D59D00]"/>
        <div><h2 className="font-[Sora] text-lg font-bold">Resumos automáticos</h2>
          <p className="text-xs text-muted-foreground">Configure destinatários, frequência e horário (Fortaleza).</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="print:hidden" disabled={busy!==null||loading} onClick={()=>void load()}>
        <RefreshCw size={14} className="mr-1"/> Atualizar
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      <ShieldCheck size={13} className="mr-1 inline"/>
      Dados agregados, sem coordenadas, contatos de passageiros ou Pix. Para entrega automática, configure o provedor de e-mail e o agendador do servidor. Salvar uma preferência não comprova envio.
    </p>
    {error&&<p role="alert" className="rounded-xl border border-red-300 p-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-green-300 p-3 text-sm text-green-700">{notice}</p>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">Carregando configuração…</p>}
    <div className="grid gap-3 lg:grid-cols-3">
      {(["daily","weekly","monthly"] as const).map(cadence=>{
        const item=form[cadence];
        return <article key={cadence} className="min-w-0 space-y-3 rounded-xl border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-[Sora] text-sm font-bold">{names[cadence]}</h3>
              <p className="text-xs text-muted-foreground">{descriptions[cadence]}</p></div>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" aria-label={"Ativar "+names[cadence].toLowerCase()} checked={item?.enabled??false}
                disabled={!item||busy!==null} onChange={e=>setForm(prev=>({...prev,[cadence]:{...prev[cadence],enabled:e.target.checked}}))}/>
              Ativar
            </label>
          </div>
          <label className="block text-xs font-semibold">Destinatários
            <textarea aria-label={"Destinatários do resumo "+names[cadence].toLowerCase()} value={item?.recipients??""}
              disabled={!item||busy!==null} rows={2} maxLength={2600} placeholder="equipe@empresa.com, gestor@empresa.com"
              onChange={e=>setForm(prev=>({...prev,[cadence]:{...prev[cadence],recipients:e.target.value}}))}
              className="mt-1 w-full resize-y rounded-lg border bg-card p-2 text-sm font-normal"/>
          </label>
          <label className="block text-xs font-semibold">Horário de envio
            <select value={item?.hour??8} disabled={!item||busy!==null} aria-label={"Horário "+names[cadence].toLowerCase()}
              onChange={e=>setForm(prev=>({...prev,[cadence]:{...prev[cadence],hour:Number(e.target.value)}}))}
              className="mt-1 w-full rounded-lg border bg-card p-2 text-sm font-normal">
              {Array.from({length:24},(_,h)=><option key={h} value={h}>{h.toString().padStart(2,"0")}:00 · Fortaleza</option>)}
            </select>
          </label>
          <Button className="w-full print:hidden" disabled={!item||busy!==null} onClick={()=>void save(cadence)}>
            <Save size={14} className="mr-1"/>{busy===cadence?"Salvando…":"Salvar frequência"}
          </Button>
        </article>;
      })}
    </div>
    <div className="space-y-2 border-t pt-3">
      <h3 className="flex items-center gap-2 text-sm font-bold"><Mail size={16}/> Registros de disparo</h3>
      <p className="text-xs text-muted-foreground">“Enviado ao provedor” confirma a aceitação da API; entrega na caixa de entrada exige confirmação posterior.</p>
      {!payload?.deliveries?.length?
        <p className="text-xs text-muted-foreground">Nenhuma tentativa de envio registrada.</p>:
        <div className="overflow-x-auto"><table className="w-full min-w-[450px] text-xs">
          <thead><tr className="text-left">{["Frequência","Período","Estado","Atualização"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{payload.deliveries.map((d,i)=><tr key={i}>
            <td className="p-2">{names[d.cadence]}</td><td className="p-2">{d.window_start} a {d.window_end}</td>
            <td className="p-2">{d.status==="SENT"?"Enviado ao provedor":d.status==="SENDING"?"Processando":"Falhou"}</td>
            <td className="p-2">{new Date(d.updated_at).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
  </section>;
}
