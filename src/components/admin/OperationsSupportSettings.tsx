import { useEffect, useState } from "react";
import { Headset, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function OperationsSupportSettings(){
  const [number,setNumber]=useState("");
  const [saved,setSaved]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const valid=/^\+[1-9]\d{7,14}$/.test(number.trim());
  useEffect(()=>{
    let active=true;
    void (supabase as any).rpc("get_caronaa_support_whatsapp").then(
      ({data,error:rpcError}:{data:string|null;error?:{message:string}})=>{
        if(!active)return;
        if(rpcError||!data)setError("Não foi possível carregar o contato; confira a migration 0232.");
        else{setNumber(data);setSaved(data);setError("");}
      },()=>{if(active)setError("Falha ao carregar o número de suporte.");}
    );
    return()=>{active=false;};
  },[]);
  async function save(){
    if(!valid||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("admin_set_caronaa_support_whatsapp",{p_number:number.trim()});
      if(rpcError||!data)setError("Não foi possível guardar a alteração: "+(rpcError?.message??"Erro de servidor"));
      else{setNumber(data);setSaved(data);setNotice("Número atualizado para todo o aplicativo. Alteração registrada na auditoria.");}
    }catch{setError("Conexão indisponível. Atualize o contato e tente novamente.");}
    finally{setBusy(false);}
  }
  return <section className="ops-panel space-y-4 p-4 sm:p-5" aria-label="Configuração do suporte CARONAA">
    <div className="flex items-start gap-3"><span className="ops-icon"><Headset className="text-amber-700 dark:text-yellow-300" size={20}/></span>
      <div><h2 className="font-[Sora] text-lg font-bold">WhatsApp de suporte</h2>
        <p className="text-xs text-muted-foreground">Contato oficial compartilhado pelos painéis do passageiro e motorista.</p></div>
    </div>
    <label htmlFor="operations-support-phone" className="block text-sm font-semibold">Número de suporte (formato internacional E.164)</label>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input id="operations-support-phone" inputMode="tel" autoComplete="off" value={number} onChange={e=>setNumber(e.target.value)}
        placeholder="+Código do país e número" className="min-h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-base" maxLength={16}/>
      <Button className="min-h-11 bg-[#FFBB00] font-bold text-[#121212] hover:bg-[#E6A800]" disabled={!valid||busy||number.trim()===saved} onClick={()=>void save()}>
        <Save size={16} className="mr-1"/> {busy?"Salvando…":"Salvar contato"}
      </Button>
    </div>
    {!valid&&number&&<p className="text-xs text-amber-700">Inclua o +, código do país e número, sem espaços.</p>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14}/>
      Alteração permitida apenas ao administrador, validada no banco e registrada em auditoria. Não altera WhatsApp pessoal dos usuários nem os contatos do CRM.
    </p>
  </section>;
}