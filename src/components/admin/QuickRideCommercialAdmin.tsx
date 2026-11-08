import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type City = {
  municipality:string;region:"FORTALEZA_CORRIDOR"|"MACICO_BATURITE";
  car:boolean;moto:boolean;interest:number;
};
type Policy = {
  pricing_region:"FORTALEZA_CORRIDOR"|"MACICO_BATURITE";
  vehicle_type:"CAR"|"MOTO";
  base_cents:number;per_km_cents:number;per_minute_cents:number;
  minimum_cents:number;commission_bps:number;processing_fee_cents:number;
  minimum_platform_margin_cents:number;intermunicipal_enabled:boolean;
  published:boolean;policy_version:string;
};
type Activity={id:string;title:string;municipality:string;starts_at:string;ends_at:string;published:boolean};
type Overview={cities:City[];policies:Policy[];activities:Activity[]};
const regions=["FORTALEZA_CORRIDOR","MACICO_BATURITE"] as const;
const vehicles=["CAR","MOTO"] as const;
const regionName=(r:string)=>r==="MACICO_BATURITE"?"Maciço de Baturité":"Fortaleza e corredor";
function emptyPolicy(region:Policy["pricing_region"],vehicle:Policy["vehicle_type"]):Policy{
  const macico=region==="MACICO_BATURITE";
  return {
    pricing_region:region,vehicle_type:vehicle,base_cents:0,per_km_cents:0,
    per_minute_cents:0,minimum_cents:macico&&vehicle==="MOTO"?750:450,
    commission_bps:macico?2000:0,processing_fee_cents:0,
    minimum_platform_margin_cents:50,intermunicipal_enabled:false,
    published:false,policy_version:"draft-v0",
  };
}
export function QuickRideCommercialAdmin(){
  const [data,setData]=useState<Overview|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState("");
  const [drafts,setDrafts]=useState<Record<string,Policy>>({});
  const [confirmedPublish,setConfirmedPublish]=useState<Record<string,string>>({});
  const [activity,setActivity]=useState({
    title:"",municipality:"",starts_at:"",ends_at:"",
    center_lat:"",center_lng:"",radius_m:"1000",published:false,
  });
  const load=useCallback(async()=>{
    const {data,error:rpcError}=await (supabase as any).rpc("admin_caronaa_quick_commercial_overview");
    if(rpcError){setError("Configuração comercial indisponível. Confirme a migration 0139.");return;}
    const parsed:Overview={
      cities:Array.isArray(data?.cities)?data.cities:[],
      policies:Array.isArray(data?.policies)?data.policies:[],
      activities:Array.isArray(data?.activities)?data.activities:[],
    };
    setData(parsed);setError("");
    const next:Record<string,Policy>={};
    for(const region of regions)for(const vehicle of vehicles){
      const key=region+":"+vehicle;
      next[key]=parsed.policies.find((p)=>p.pricing_region===region&&p.vehicle_type===vehicle)
        ??emptyPolicy(region,vehicle);
    }
    setDrafts(next);
  },[]);
  useEffect(()=>{void load();},[load]);
  const grouped=useMemo(()=>data?.cities??[],[data]);
  async function toggleCity(city:City,key:"car"|"moto",checked:boolean){
    const id=city.municipality;
    setBusy(id);setNotice("");
    const {error:rpcError}=await (supabase as any).rpc("admin_set_caronaa_quick_city",{
      p_municipality:id,p_car:key==="car"?checked:city.car,
      p_moto:key==="moto"?checked:city.moto,
    });
    setNotice(rpcError?"Não foi possível alterar a cidade.":"Modalidade atualizada para "+id+".");
    setBusy("");await load();
  }
  const setPolicy=(key:string,patch:Partial<Policy>)=>setDrafts(old=>({
    ...old,[key]:{...old[key],...patch},
  }));
  async function savePolicy(key:string){
    const p=drafts[key];
    if(!p)return;
    if(p.published && confirmedPublish[key]!=="PUBLICAR"){
      setError("Para publicar, escreva PUBLICAR no campo de confirmação desta tarifa.");
      return;
    }
    setBusy(key);setError("");setNotice("");
    const {error:rpcError}=await (supabase as any).rpc("admin_set_caronaa_quick_tariff",{
      p_region:p.pricing_region,p_vehicle:p.vehicle_type,
      p_base:p.base_cents,p_per_km:p.per_km_cents,p_per_minute:p.per_minute_cents,
      p_minimum:p.minimum_cents,p_commission_bps:p.commission_bps,
      p_processing_fee:p.processing_fee_cents,
      p_margin:p.minimum_platform_margin_cents,
      p_intermunicipal:p.intermunicipal_enabled,
      p_publish:p.published,p_version:p.policy_version,
    });
    setNotice(rpcError?"Tarifa rejeitada: "+rpcError.message:"Política salva.");
    setBusy("");await load();
  }
  async function saveActivity(){
    setBusy("activity");setError("");setNotice("");
    const parsedStart=Date.parse(activity.starts_at),parsedEnd=Date.parse(activity.ends_at);
    if(!Number.isFinite(parsedStart)||!Number.isFinite(parsedEnd)||parsedEnd<=parsedStart){
      setBusy("");setError("Datas da atividade inválidas.");return;
    }
    const {error:rpcError}=await (supabase as any).rpc("admin_upsert_caronaa_quick_activity",{
      p_id:null,p_title:activity.title,p_city:activity.municipality,
      p_starts_at:new Date(parsedStart).toISOString(),
      p_ends_at:new Date(parsedEnd).toISOString(),
      p_lat:Number(activity.center_lat),p_lng:Number(activity.center_lng),
      p_radius_m:Number(activity.radius_m),
      p_published:activity.published,
    });
    setNotice(rpcError?"Atividade rejeitada: "+rpcError.message:"Atividade registrada.");
    setBusy("");await load();
  }
  return (
    <section aria-label="Cobertura e tarifas da Corrida Rápida" className="space-y-4 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">Eixo Fortaleza–Maciço · Corrida Rápida</h3>
          <p className="text-xs text-muted-foreground">A cidade do cadastro nunca determina a tarifa. Só o embarque validado pelo servidor.</p>
        </div>
        <button type="button" onClick={()=>void load()} className="min-h-10 rounded-lg border px-3 text-sm">Atualizar</button>
      </header>
      {error&&<p role="alert" className="rounded-lg border border-destructive/40 p-2 text-sm text-destructive">{error}</p>}
      {notice&&<p role="status" className="text-sm">{notice}</p>}
      <p className="text-xs text-muted-foreground">
        Para receber pedidos, o município precisa de modalidade ativa aqui,
        descoberta/dispatch habilitados no controle anterior, motorista aprovado
        e política de preço publicada. Nenhuma opção é ativada automaticamente.
      </p>
      <div className="space-y-2">
        <h4 className="font-semibold">Municípios e demanda</h4>
        <div className="grid gap-2 md:grid-cols-2">
          {grouped.map(city=>(
            <div key={city.municipality} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{city.municipality}</span>
                <span className="text-xs text-muted-foreground">{city.interest} interessados</span>
              </div>
              <p className="text-xs text-muted-foreground">{regionName(city.region)}</p>
              <div className="flex flex-wrap gap-4">
                {(["car","moto"] as const).map(k=>(
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" disabled={busy===city.municipality} checked={city[k]}
                      onChange={e=>void toggleCity(city,k,e.target.checked)}/>
                    {k==="car"?"Carro":"Moto"}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold">Tarifas e comissões por modalidade</h4>
        <p className="text-xs text-muted-foreground">Valores em centavos de real; comissão em porcentagem. Asaas/Pix por cobrança deve ser incluído no custo, sem taxas promocionais.</p>
        {Object.entries(drafts).map(([key,p])=>{
          const macicoMoto=p.pricing_region==="MACICO_BATURITE"&&p.vehicle_type==="MOTO";
          const fields=[
            ["base_cents","Bandeirada (centavos)"],["per_km_cents","Por km (centavos)"],
            ["per_minute_cents","Por minuto (centavos)"],["minimum_cents","Mínimo (centavos)"],
            ["processing_fee_cents","Custo pagamento (centavos)"],
            ["minimum_platform_margin_cents","Margem mínima CARONAA (centavos)"],
          ] as const;
          return (
            <details key={key} className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {regionName(p.pricing_region)} · {p.vehicle_type==="CAR"?"Carro":"Moto"} · {p.published?"Publicada":"Rascunho"}
              </summary>
              {macicoMoto&&<p className="my-2 text-xs text-muted-foreground">Maciço moto: mínimo R$ 7,50 até 11 km, acrescido de R$ 6 a cada 11 km excedentes. A bandeirada/km/minuto abaixo não alteram esse cálculo fixado nesta versão.</p>}
              <div className="mt-3 grid grid-cols-2 gap-3">
                {fields.map(([field,label])=>(
                  <label key={field} className="space-y-1 text-xs font-semibold">
                    <span>{label}</span>
                    <input type="number" min="0" step="1" value={p[field]} 
                      disabled={macicoMoto&&["base_cents","per_km_cents","per_minute_cents","minimum_cents"].includes(field)}
                      onChange={e=>setPolicy(key,{[field]:Math.max(0,Math.trunc(Number(e.target.value)))} as Partial<Policy>)}
                      className="h-10 w-full rounded-lg border bg-background px-2"/>
                  </label>
                ))}
                <label className="space-y-1 text-xs font-semibold">
                  <span>Comissão normal (%)</span>
                  <input type="number" min="0" max="40" step=".01" value={p.commission_bps/100}
                    disabled={p.pricing_region==="MACICO_BATURITE"}
                    onChange={e=>setPolicy(key,{commission_bps:Math.round(Number(e.target.value)*100)})}
                    className="h-10 w-full rounded-lg border bg-background px-2"/>
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  <span>Versão da política</span>
                  <input value={p.policy_version} maxLength={100}
                    onChange={e=>setPolicy(key,{policy_version:e.target.value})}
                    className="h-10 w-full rounded-lg border bg-background px-2"/>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={p.intermunicipal_enabled}
                    onChange={e=>setPolicy(key,{intermunicipal_enabled:e.target.checked})}/>
                  Permitir viagem entre municípios homologados
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={p.published}
                    onChange={e=>setPolicy(key,{published:e.target.checked})}/>
                  Publicar tarifa
                </label>
              </div>
              {p.published&&(
                <label className="mt-2 block text-xs font-semibold">
                  Confirme escrevendo PUBLICAR
                  <input value={confirmedPublish[key]??""} autoComplete="off"
                    onChange={e=>setConfirmedPublish(old=>({...old,[key]:e.target.value}))}
                    className="mt-1 h-10 w-full rounded-lg border bg-background px-2"/>
                </label>
              )}
              <button type="button" disabled={busy===key} onClick={()=>void savePolicy(key)}
                className="mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                Salvar política
              </button>
            </details>
          );
        })}
      </div>
      <div className="space-y-3">
        <h4 className="font-semibold">Atividades oficiais · comissão de 15%</h4>
        <p className="text-xs text-muted-foreground">Só vigoram se publicadas, com horário válido e embarque dentro do raio. Não alteram dívidas anteriores.</p>
        {data?.activities.map(a=>(
          <p key={a.id} className="rounded-lg border p-2 text-xs">
            {a.title} · {a.municipality} · {new Date(a.starts_at).toLocaleString("pt-BR")} – {new Date(a.ends_at).toLocaleString("pt-BR")} · {a.published?"Publicada":"Rascunho"}
          </p>
        ))}
        <div className="grid grid-cols-2 gap-2">
          {([
            ["title","Nome da atividade"],["municipality","Município"],
            ["starts_at","Início (ISO / horário local)"],["ends_at","Fim (ISO / horário local)"],
            ["center_lat","Latitude do centro"],["center_lng","Longitude do centro"],
            ["radius_m","Raio (metros)"],
          ] as const).map(([key,label])=>(
            <label key={key} className="min-w-0 space-y-1 text-xs font-semibold">
              <span>{label}</span>
              <input value={activity[key]} onChange={e=>setActivity(old=>({...old,[key]:e.target.value}))}
                placeholder={key==="starts_at"||key==="ends_at"?"2026-11-08T14:00:00-03:00":undefined}
                className="h-10 w-full rounded-lg border bg-background px-2"/>
            </label>
          ))}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={activity.published}
              onChange={e=>setActivity(old=>({...old,published:e.target.checked}))}/>
            Publicar atividade
          </label>
        </div>
        <button type="button" disabled={busy==="activity"} onClick={()=>void saveActivity()}
          className="min-h-10 rounded-lg border px-4 text-sm font-semibold">Salvar atividade</button>
      </div>
    </section>
  );
}
