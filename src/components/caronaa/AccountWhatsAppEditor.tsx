import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilWhatsapp, normalizeBrazilWhatsapp, validBrazilWhatsapp } from "@/lib/formulario/research-whatsapp";

type ContactState={whatsapp:string|null;contact_consent:boolean};
type Props={onChanged?:(value:string)=>void};

export function AccountWhatsAppEditor({onChanged}:Props){
  const [value,setValue]=useState("");
  const [consent,setConsent]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  const load=async()=>{
    setLoading(true);setLoaded(false);setError("");setSuccess("");
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("get_my_caronaa_whatsapp");
      if(rpcError||!data||typeof data!=="object")throw rpcError??new Error("Contato indisponível");
      const row=data as ContactState;
      const original=typeof row.whatsapp==="string"?row.whatsapp:"";
      setValue(formatBrazilWhatsapp(original));
      setConsent(row.contact_consent===true);
      setLoaded(true);
      onChanged?.(original);
    }catch{
      setError("Não foi possível carregar o contato. Confira se a atualização 0218 foi aplicada.");
    }finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);

  const empty=!value.trim();
  const valid=empty||validBrazilWhatsapp(value);
  const save=async()=>{
    if(saving||loading||!loaded||!valid)return;
    setSaving(true);setError("");setSuccess("");
    try{
      const normalized=empty?null:normalizeBrazilWhatsapp(value);
      if(!empty&&!normalized)throw new Error("Número inválido");
      const {data,error:rpcError}=await (supabase as any).rpc("set_my_caronaa_whatsapp",{
        p_whatsapp:normalized,
        p_contact_consent:Boolean(normalized&&consent),
      });
      if(rpcError||!data||typeof data!=="object")throw rpcError??new Error("Falha ao salvar contato");
      const stored=typeof data.whatsapp==="string"?data.whatsapp:"";
      setValue(formatBrazilWhatsapp(stored));
      setConsent(data.contact_consent===true);
      onChanged?.(stored);
      setSuccess(stored?"Contato atualizado. Você pode alterá-lo quando quiser.":"Contato removido. Suas corridas continuam disponíveis.");
    }catch{
      setError("Não foi possível salvar o contato. Revise o DDD ou tente novamente.");
    }finally{setSaving(false);}
  };
  return <section aria-label="Editar WhatsApp" className="space-y-2 rounded-xl border border-white/20 bg-white/[0.045] p-3">
    <label htmlFor="caronaa-whatsapp" className="block text-sm font-bold">
      WhatsApp para contato <span className="font-normal text-white/65">(opcional)</span>
    </label>
    <input id="caronaa-whatsapp" type="tel" inputMode="tel" autoComplete="tel"
      value={value} disabled={loading||saving}
      placeholder="(11) 99999-9999" maxLength={20}
      onChange={event=>{setValue(formatBrazilWhatsapp(event.target.value));setSuccess("");setError("");}}
      className="min-h-12 w-full rounded-xl border border-white/25 bg-[#222] px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00] disabled:opacity-60"/>
    <p className="text-xs text-white/65">
      {empty
        ?"Você pode deixar em branco. O WhatsApp não é necessário para fazer ou aceitar corridas."
        :valid
        ?"Formato brasileiro válido; isso não confirma que o número tem WhatsApp."
        :"Use um DDD brasileiro válido e nove dígitos, começando por 9."}
    </p>
    <label className="flex items-start gap-2 text-xs leading-relaxed text-white/80">
      <input type="checkbox" checked={consent} disabled={loading||saving||empty}
        onChange={event=>setConsent(event.target.checked)}
        className="mt-1 size-4 accent-[#FFBB00]"/>
      Autorizo o CARONAA a me enviar comunicações comerciais e pesquisas neste número. Posso retirar essa autorização depois.
    </label>
    {loading&&<p role="status" className="text-xs text-white/70">Carregando contato...</p>}
    {error&&<div role="alert" className="space-y-1"><p className="text-xs text-red-300">{error}</p>
      {!loaded&&<button type="button" onClick={()=>void load()} className="min-h-10 text-xs font-semibold text-[#FFBB00] underline">Tentar carregar novamente</button>}
    </div>}
    {success&&<p role="status" className="text-xs text-emerald-300">{success}</p>}
    <button type="button" disabled={saving||loading||!loaded||!valid}
      onClick={()=>void save()}
      className="min-h-12 w-full rounded-xl bg-[#FFBB00] px-3 text-sm font-extrabold text-[#121212] disabled:opacity-50">
      {saving?"Salvando contato...":empty?"Remover contato":"Salvar WhatsApp"}
    </button>
  </section>;
}
