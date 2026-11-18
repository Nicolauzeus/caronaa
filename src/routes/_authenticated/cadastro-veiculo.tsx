import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { CarFront, Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { getVehicleStatus, normalizeVehicleSeats, type VehicleType } from "@/lib/role/use-active-role";
import { normalizePlate } from "@/lib/professional-access";
import { readOnboarding, completeOnboarding } from "@/lib/onboarding/progressive-onboarding";
import { resolvePostOnboardingDestination } from "@/lib/onboarding/research-gate";
import { professionalPhotoMaxBytes, professionalPhotoTypes } from "@/lib/mototaxi-registration";

export const Route = createFileRoute("/_authenticated/cadastro-veiculo")({
  ssr: false,
  validateSearch: z.object({ redirect: z.literal("/cadastro-motorista").optional() }),
  component: CompleteDriverVehicle,
});

function CompleteDriverVehicle() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [seats, setSeats] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void (supabase as any).from("profiles")
      .select("full_name,avatar_url,vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_type,vehicle_seats")
      .eq("id", user.id).maybeSingle().then(({data,error}:any)=>{
        if (!active) return;
        if (error || !data) {
          setError("Não conseguimos carregar seu cadastro. Tente novamente.");
          setLoading(false);
          return;
        }
        const type:VehicleType = data.vehicle_type === "moto" ? "moto" : "car";
        setVehicleType(type);
        setFullName(data.full_name ?? "");
        setBrand(data.vehicle_brand ?? "");
        setModel(data.vehicle_description ?? "");
        setColor(data.vehicle_color ?? "");
        setPlate(data.vehicle_plate ?? "");
        setSeats(normalizeVehicleSeats(type,data.vehicle_seats));
        setAvatarUrl(data.avatar_url ?? "");
        setLoading(false);
      }).catch(()=>{
        if(active){setError("Não foi possível consultar os dados do veículo.");setLoading(false);}
      });
    return()=>{active=false;};
  },[user?.id]);

  async function submit(event:FormEvent) {
    event.preventDefault();
    if(!user?.id || busy)return;
    const status=getVehicleStatus({
      vehicle_brand:brand,vehicle_description:model,
      vehicle_color:color,vehicle_plate:plate,
    });
    if(!status.isComplete){
      setError("Preencha marca, modelo, cor e uma placa brasileira válida.");
      return;
    }
    if(fullName.trim().split(/\s+/).length<2){
      setError("Seu nome e sobrenome devem estar completos. Atualize seu Perfil.");
      return;
    }
    if(!avatar && !avatarUrl.trim()){
      setError("A foto de perfil é obrigatória para motoristas.");
      return;
    }
    if(avatar && (!professionalPhotoTypes.includes(avatar.type as typeof professionalPhotoTypes[number]) ||
      avatar.size === 0 || avatar.size>professionalPhotoMaxBytes)){
      setError("Use uma foto JPG, PNG ou WebP de até 5 MB.");
      return;
    }
    if(vehicleType==="moto" && seats!==1){
      setError("A moto tem uma vaga para passageiro.");
      return;
    }
    if(vehicleType==="car" && (!Number.isInteger(seats)||seats<1||seats>3)){
      setError("Selecione entre 1 e 3 vagas para passageiros.");
      return;
    }
    setBusy(true);
    setError("");
    try{
      if(avatar){
        const ext=avatar.type==="image/png"?"png":avatar.type==="image/webp"?"webp":"jpg";
        const key=user.id+"/"+crypto.randomUUID()+"."+ext;
        const {error:uploadError}=await supabase.storage.from("avatars").upload(key,avatar,{
          upsert:false,contentType:avatar.type,
        });
        if(uploadError)throw new Error("Não foi possível salvar a foto. Tente novamente.");
        const {data:publicData}=supabase.storage.from("avatars").getPublicUrl(key);
        const url=publicData.publicUrl;
        const {error:photoError}=await supabase.from("profiles")
          .update({avatar_url:url,updated_at:new Date().toISOString()}).eq("id",user.id);
        if(photoError)throw new Error("Não foi possível vincular a foto ao perfil.");
        setAvatarUrl(url);
        setAvatar(null);
      }

      // DB activation trigger checks all required fields independently of UI.
      // F07 authorization is NOT granted by changing active_role.
      const {data,error:saveError}=await (supabase as any).from("profiles").update({
        vehicle_brand:brand.trim(),vehicle_description:model.trim(),
        vehicle_color:color.trim(),vehicle_plate:normalizePlate(plate),
        vehicle_type:vehicleType,
        vehicle_seats:normalizeVehicleSeats(vehicleType,seats),
        active_role:"MOTORISTA",updated_at:new Date().toISOString(),
      }).eq("id",user.id).select("active_role").single();
      if(saveError || data?.active_role!=="MOTORISTA"){
        throw new Error(saveError?.message||"O cadastro não pôde ser confirmado pelo banco.");
      }
      const progress = await readOnboarding();
      if (!progress) throw new Error("Cadastro inicial indisponível. Tente novamente.");
      if (progress.status === "IN_PROGRESS") await completeOnboarding(progress);
      const next = await resolvePostOnboardingDestination();
      window.dispatchEvent(new Event("caronaa:role-changed"));
      toast.success("Cadastro do motorista completo.");
      if(next === "/aguardando") await navigate({to:"/aguardando",replace:true});
      else if(next !== "/home") throw new Error("Não foi possível confirmar o acesso inicial.");
      else if(redirect) await navigate({to:"/cadastro-motorista",replace:true});
      else await navigate({to:"/home",search:{intent:"offer"},replace:true});
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Não foi possível concluir o cadastro.");
    }finally{setBusy(false);}
  }

  return <main className="min-h-[100dvh] bg-[#121212] px-3 py-5 text-white sm:py-10">
    <section className="mx-auto max-w-lg space-y-5 rounded-3xl border border-white/15 bg-[#191919] p-4 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-wider text-[#FFBB00]">CARONAA · Motorista</p>
      <h1 className="font-[Sora] text-2xl font-extrabold">Complete o cadastro do veículo</h1>
      <p className="text-sm leading-relaxed text-white/65">
        Para oferecer caronas, confirme o veículo e sua foto. Assim que tudo estiver válido,
        o modo Motorista será ativado automaticamente, sem esperar aprovação administrativa.
      </p>
      {loading?<p role="status" className="animate-pulse text-sm">Carregando informações do veículo…</p>:
      <form className="space-y-4" onSubmit={event=>void submit(event)}>
        {error&&<p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">{error}</p>}
        <label className="block text-sm font-semibold" htmlFor="driver-photo">
          <span className="mb-2 flex items-center gap-2"><Camera size={18}/> Foto de perfil obrigatória</span>
          {avatarUrl&&<img src={avatarUrl} alt="Foto atual do motorista" className="mb-3 size-20 rounded-full object-cover"/>}
          <input id="driver-photo" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e=>setAvatar(e.target.files?.[0]??null)}
            className="block w-full rounded-xl border border-white/20 bg-white/5 p-3 text-base"/>
          <small className="mt-1 block text-xs text-white/60">Você pode trocar a foto, mas nunca deixá-la vazia.</small>
        </label>
        <label className="block text-sm" htmlFor="driver-type">Tipo do veículo
          <select id="driver-type" value={vehicleType} onChange={e=>{
              const type=e.target.value as VehicleType;setVehicleType(type);
              setSeats(normalizeVehicleSeats(type,seats));
            }} className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#252525] p-3 text-base">
            <option value="car">Carro</option><option value="moto">Moto</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Marca","brand",brand,setBrand,"Ex.: Honda"],
            ["Modelo","model",model,setModel,"Ex.: CG 160"],
            ["Cor","color",color,setColor,"Ex.: Preta"],
            ["Placa","plate",plate,setPlate,"Ex.: ABC1D23"],
          ] as const).map(([title,id,value,update,placeholder])=>
            <label key={id} className="block text-sm" htmlFor={"driver-"+id}>{title}
              <input id={"driver-"+id} required value={value} placeholder={placeholder}
                onChange={e=>update(e.target.value)} autoCapitalize={id==="plate"?"characters":"sentences"}
                className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#252525] p-3 text-base"/>
            </label>)}
        </div>
        <label className="block text-sm" htmlFor="driver-seats">Vagas para passageiros
          <select id="driver-seats" value={seats} disabled={vehicleType==="moto"}
            onChange={e=>setSeats(Number(e.target.value))}
            className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-[#252525] p-3 text-base disabled:opacity-70">
            {(vehicleType==="moto"?[1]:[1,2,3]).map(n=><option value={n} key={n}>{n} {n===1?"vaga":"vagas"}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 font-extrabold text-[#121212] disabled:opacity-60">
          {busy?"Validando cadastro…":<>Ativar modo Motorista <CheckCircle2 size={19}/></>}
        </button>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-white/60">
          <ShieldCheck size={16} className="shrink-0"/> Esta ativação é para caronas comuns. A Corrida Rápida profissional tem requisitos próprios.
        </p>
        <Link to="/perfil" className="inline-flex min-h-11 items-center text-sm text-[#FFBB00] underline">Editar meu nome e perfil</Link>
      </form>}
    </section>
  </main>;
}
