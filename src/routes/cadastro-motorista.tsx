import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bike, Camera, CarFront, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/caronaa/BrandElements";
import { MunicipalitySelect } from "@/components/caronaa/MunicipalitySelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CAR_CATEGORIES, MISSING_LABELS, isValidBrazilianPlate, normalizePlate, parseMissingError, type CarCategory, type MissingCode } from "@/lib/professional-access";
import { professionalPhotoTypes, professionalPhotoMaxBytes } from "@/lib/mototaxi-registration";
import { formatBrazilWhatsapp, validBrazilWhatsapp, normalizeBrazilWhatsapp } from "@/lib/formulario/research-whatsapp";

export const Route = createFileRoute("/cadastro-motorista")({
  ssr: false, component: DriverRegistration,
  head: () => ({ meta: [{ title: "Cadastro de motorista | CARONAA" }] }),
});

type Field = "name" | "whatsapp" | "municipality" | "type" | "brand" | "model" | "color" | "category" | "seats" | "plate" | "registration" | "photo";
type Vehicle = "" | "CAR" | "MOTO";
const stages = ["Contato e município", "Dados do veículo", "Identificação", "Revisão final"];
const avatarValid = (url: string, id: string) => url.startsWith("https://") && url.includes("/avatars/" + id + "/");
const inputStyle = "mt-1 min-h-12 w-full rounded-xl border border-white/20 bg-[#252525] p-3 text-base text-white outline-none focus-visible:border-[#FFBB00]";
const labelStyle = "block text-sm font-semibold text-white/90";

function DriverRegistration() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [stage, setStage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [missing, setMissing] = useState<Partial<Record<Field, string>>>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [type, setType] = useState<Vehicle>("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [category, setCategory] = useState<CarCategory | "">("");
  const [seats, setSeats] = useState(1);
  const [plate, setPlate] = useState("");
  const [registration, setRegistration] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email_confirmed_at) {
      void navigate({ to: "/auth", search: { mode: user ? "entrar" : "cadastro", redirect: "/cadastro-motorista" }, replace: true });
      return;
    }
    let live = true;
    setReady(false); setLoadFailed(false); setError("");
    void Promise.all([
      supabase.from("profiles")
        .select("full_name,avatar_url,city,vehicle_type,vehicle_brand,vehicle_description,vehicle_color,vehicle_plate,vehicle_seats")
        .eq("id", user.id).maybeSingle(),
      (supabase as any).from("professional_driver_contacts")
        .select("whatsapp_e164,municipality,registration_number").eq("user_id", user.id).maybeSingle(),
      (supabase as any).rpc("get_my_professional_access"),
    ]).then(async ([profile, contact, access]) => {
      if (!live) return;
      if (profile.error || !profile.data || contact.error || access.error) {
        setLoadFailed(true);
        setError(contact.error?.code === "42P01" ? "A migration 0216 do cadastro de motoristas precisa ser aplicada no Supabase." :
          "Não foi possível consultar os dados do cadastro. Tente novamente.");
        setReady(true); return;
      }
      if (access.data?.authorized === true) {
        void navigate({ to: "/disponibilidade-profissional", replace: true }); return;
      }
      const p = profile.data, c = contact.data;
      setName(String(p.full_name || user.user_metadata?.full_name || ""));
      // Existing account contact may live outside the professional-contacts table.
      // Restore it when registration is reopened rather than showing an empty field.
      const {data:accountContact,error:contactError}=await (supabase as any).rpc("get_my_caronaa_whatsapp");
      if(!live)return;
      setWhatsapp(String(!contactError&&accountContact?.whatsapp
        ? accountContact.whatsapp : c?.whatsapp_e164 || ""));
      const city = String(c?.municipality || p.city || "").trim();
      setMunicipality(["MACICO_BATURITE", "OUTRA_REGIAO"].includes(city.toUpperCase()) ? "" : city);
      setType(p.vehicle_type === "car" ? "CAR" : p.vehicle_type === "moto" ? "MOTO" : "");
      setBrand(String(p.vehicle_brand || "")); setModel(String(p.vehicle_description || ""));
      setColor(String(p.vehicle_color || "")); setPlate(String(p.vehicle_plate || ""));
      setSeats(Number(p.vehicle_seats) > 0 ? Number(p.vehicle_seats) : 1);
      setPhotoUrl(String(p.avatar_url || "")); setRegistration(String(c?.registration_number || ""));
      setReady(true);
    }).catch(() => { if (live) { setLoadFailed(true); setError("Falha de conexão. Tente novamente."); setReady(true); } });
    return () => { live = false; };
  }, [authLoading, user?.id, user?.email_confirmed_at, navigate, retry]);

  const clear = (field: Field) => setMissing(old => { const next = { ...old }; delete next[field]; return next; });
  const FieldError = ({ field }: { field: Field }) => missing[field] ?
    <span role="alert" className="mt-1 block text-xs text-amber-300">{missing[field]}</span> : null;

  function validate(which: number) {
    const m: Partial<Record<Field, string>> = {};
    if (which === 0 || which === 3) {
      if (!/^\S{2,}\s+\S{2,}/.test(name.trim()) || name.trim().length > 120) m.name = "Informe nome e sobrenome.";
      if (whatsapp.trim() && !validBrazilWhatsapp(whatsapp))
        m.whatsapp = "Informe um celular com DDD válido e nove dígitos começando por 9.";
      if (municipality.trim().length < 2 || ["MACICO_BATURITE", "OUTRA_REGIAO"].includes(municipality.toUpperCase()))
        m.municipality = "Escolha seu município nas sugestões.";
    }
    if (which === 1 || which === 3) {
      if (!type) m.type = "Escolha carro ou moto.";
      if (!brand.trim()) m.brand = "Informe a marca.";
      if (!model.trim()) m.model = "Informe o modelo.";
      if (!color.trim()) m.color = "Informe a cor.";
      if (type === "CAR" && !category) m.category = "Escolha a categoria.";
      if (!Number.isInteger(seats) || seats < 1 || (type === "CAR" && seats > 3) || (type === "MOTO" && seats !== 1))
        m.seats = "Confira as vagas.";
    }
    if (which === 2 || which === 3) {
      if (!isValidBrazilianPlate(plate) || !/^[A-Z]{3}\d[\dA-J]\d{2}$/.test(normalizePlate(plate)))
        m.plate = "Informe placa válida (ABC1234 ou ABC1D23).";
      if (type === "MOTO" && registration.trim().length < 2) m.registration = "Informe sua matrícula/registro.";
      if (!photo && !avatarValid(photoUrl, user?.id || "")) m.photo = "Adicione sua foto pessoal.";
      if (photo && (!professionalPhotoTypes.includes(photo.type as typeof professionalPhotoTypes[number]) ||
          photo.size === 0 || photo.size > professionalPhotoMaxBytes))
        m.photo = "Use JPG, PNG ou WebP com até 5 MB.";
    }
    return m;
  }

  function changeStage(next: number) {
    setStage(next); setMissing({}); setError("");
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function complete() {
    if (busy || !user) return;
    setBusy(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== user.id || !auth.user.email_confirmed_at)
        throw new Error("Sessão expirada. Entre novamente para concluir.");
      if (photo) {
        const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = user.id + "/" + crypto.randomUUID() + "." + extension;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, photo,
          { contentType: photo.type, upsert: false });
        if (uploadError) throw new Error("Não foi possível salvar a foto.");
        const { data: photoData } = supabase.storage.from("avatars").getPublicUrl(path);
        const { error: photoError } = await supabase.from("profiles").update({
          avatar_url: photoData.publicUrl, updated_at: new Date().toISOString(),
        }).eq("id", user.id);
        if (photoError) throw new Error("Não foi possível vincular a foto ao perfil.");
        setPhotoUrl(photoData.publicUrl); setPhoto(null);
      }
      const { error: registrationError } = await (supabase as any).rpc("complete_professional_driver_registration", {
        p_full_name: name.trim(), p_whatsapp: whatsapp.trim()?normalizeBrazilWhatsapp(whatsapp):null, p_municipality: municipality.trim(),
        p_vehicle_type: type, p_vehicle_brand: brand.trim(), p_vehicle_model: model.trim(),
        p_vehicle_color: color.trim(), p_vehicle_plate: normalizePlate(plate),
        p_car_category: type === "CAR" ? category : null, p_vehicle_seats: type === "MOTO" ? 1 : seats,
        p_registration_number: type === "MOTO" ? registration.trim() : null,
      });
      if (registrationError) {
        const codes = parseMissingError(String(registrationError.message || ""));
        if (codes.length) {
          const target = codes.some((v: MissingCode) => ["WHATSAPP", "MUNICIPALITY", "FULL_NAME"].includes(v)) ? 0 :
            codes.some((v: MissingCode) => ["VEHICLE_MODEL", "VEHICLE_COLOR", "VEHICLE_TYPE", "CAR_CATEGORY", "SEATS"].includes(v)) ? 1 : 2;
          changeStage(target);
          setError("Corrija: " + codes.map((v: MissingCode) => MISSING_LABELS[v]).join(", ") + ".");
        } else setError(registrationError.code === "PGRST202" ? "Aplique a migration 0216 antes de publicar." :
          String(registrationError.message || "Falha ao concluir o cadastro."));
        return;
      }
      const { data: access, error: checkError } = await (supabase as any).rpc("get_my_professional_access");
      if (checkError || access?.authorized !== true) throw new Error("O servidor ainda não confirmou a habilitação.");
      window.dispatchEvent(new Event("caronaa:role-changed"));
      toast.success("Cadastro concluído. Ative sua disponibilidade quando quiser.");
      await navigate({ to: "/disponibilidade-profissional", replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro.");
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const m = validate(stage);
    if (Object.keys(m).length) { setMissing(m); setError("Revise os dados indicados."); return; }
    if (stage < stages.length - 1) changeStage(stage + 1);
    else void complete();
  }

  if (authLoading || !user?.email_confirmed_at || !ready) return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#121212] p-5 text-white">
      <p role="status">Preparando o cadastro do motorista…</p>
    </main>
  );
  if (loadFailed) return <main className="grid min-h-[100dvh] place-items-center bg-[#121212] p-5 text-white">
    <section className="w-full max-w-sm space-y-4 rounded-2xl border border-white/20 p-5">
      <BrandLogo size="lg" />
      <p role="alert" className="text-sm text-amber-200">{error}</p>
      <button className="min-h-12 w-full rounded-xl bg-[#FFBB00] font-bold text-[#121212]"
        onClick={() => setRetry(v => v + 1)}>Tentar novamente</button>
    </section>
  </main>;

  return <main className="min-h-[100dvh] bg-[#121212] px-3 pb-[max(18px,env(safe-area-inset-bottom))] pt-4 text-white">
    <section className="mx-auto w-full max-w-lg rounded-3xl border border-white/15 bg-[#1b1b1b] p-4 sm:mt-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <BrandLogo size="lg" />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#FFBB00]">Etapa {stage + 1} de 4</span>
      </div>
      <div className="mt-5" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={(stage + 1) * 25} aria-label="Cadastro de motorista">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#FFBB00] transition-all" style={{ width: ((stage + 1) * 25) + "%" }} />
        </div>
        <div className="mt-2 flex justify-between gap-2 text-xs text-white/60">
          <span>{(stage + 1) * 25}% concluído</span>
          <span>{stage === 3 ? "Última etapa" : "Próxima: " + stages[stage + 1]}</span>
        </div>
      </div>
      <h1 className="mt-5 font-[Sora] text-2xl font-extrabold">{stages[stage]}</h1>
      <p className="mt-1 text-sm text-white/65">
        {stage === 0 ? "Confirme seu contato e município principal." :
          stage === 1 ? "Informe o veículo que atenderá seus passageiros." :
          stage === 2 ? "Está perto do fim: só faltam placa, registro e foto." :
          "Confira seus dados. Depois, será só escolher quando ficar online."}
      </p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {error && <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">{error}</p>}
        {stage === 0 && <>
          <label className={labelStyle}>Nome completo
            <input className={inputStyle} value={name} autoComplete="name" maxLength={120}
              onChange={e => { setName(e.target.value); clear("name"); }} /><FieldError field="name" />
          </label>
          <label className={labelStyle}>WhatsApp com DDD (opcional)
            <input className={inputStyle} type="tel" inputMode="tel" autoComplete="tel"
              placeholder="(11) 99999-9999" value={whatsapp} maxLength={20}
              onChange={e => { setWhatsapp(formatBrazilWhatsapp(e.target.value)); clear("whatsapp"); }} /><FieldError field="whatsapp" />
            <span className="mt-1 block text-xs text-white/55">Contato opcional. Você poderá adicionar, alterar ou remover no Perfil. Não bloqueia corridas.</span>
          </label>
          <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
            <MunicipalitySelect value={municipality} onChange={value => { setMunicipality(value); clear("municipality"); }} />
            <FieldError field="municipality" />
            <p className="mt-2 text-xs text-white/55">Escolha um município específico. O GPS real será verificado quando você ficar online.</p>
          </div>
        </>}
        {stage === 1 && <>
          <div role="group" aria-label="Tipo de veículo" className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={type === "CAR"}
              onClick={() => { setType("CAR"); setSeats(1); clear("type"); }}
              className={"flex min-h-14 items-center justify-center gap-2 rounded-xl border font-bold " +
                (type === "CAR" ? "border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]" : "border-white/20")}>
              <CarFront size={20} /> Carro
            </button>
            <button type="button" aria-pressed={type === "MOTO"}
              onClick={() => { setType("MOTO"); setSeats(1); setCategory(""); clear("type"); }}
              className={"flex min-h-14 items-center justify-center gap-2 rounded-xl border font-bold " +
                (type === "MOTO" ? "border-[#FFBB00] bg-[#FFBB00]/15 text-[#FFBB00]" : "border-white/20")}>
              <Bike size={20} /> Moto
            </button>
          </div><FieldError field="type" />
          <div className="grid grid-cols-2 gap-3">
            <label className={labelStyle}>Marca
              <input className={inputStyle} value={brand} placeholder="Honda"
                onChange={e => { setBrand(e.target.value); clear("brand"); }} /><FieldError field="brand" />
            </label>
            <label className={labelStyle}>Modelo
              <input className={inputStyle} value={model} placeholder="CG 160"
                onChange={e => { setModel(e.target.value); clear("model"); }} /><FieldError field="model" />
            </label>
          </div>
          <label className={labelStyle}>Cor
            <input className={inputStyle} value={color} placeholder="Preto"
              onChange={e => { setColor(e.target.value); clear("color"); }} /><FieldError field="color" />
          </label>
          {type === "CAR" && <>
            <label className={labelStyle}>Categoria do carro
              <select className={inputStyle} value={category}
                onChange={e => { setCategory(e.target.value as CarCategory); clear("category"); }}>
                <option value="">Selecione</option>
                {CAR_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select><FieldError field="category" />
            </label>
            <label className={labelStyle}>Vagas para passageiros
              <select className={inputStyle} value={seats}
                onChange={e => { setSeats(Number(e.target.value)); clear("seats"); }}>
                {[1, 2, 3].map(n => <option key={n} value={n}>{n} {n === 1 ? "vaga" : "vagas"}</option>)}
              </select><FieldError field="seats" />
            </label>
          </>}
          {type === "MOTO" && <p className="text-xs text-white/60">Moto: 1 vaga para passageiro, automaticamente.</p>}
        </>}
        {stage === 2 && <>
          <label className={labelStyle}>Placa do veículo
            <input className={inputStyle} value={plate} autoCapitalize="characters" maxLength={8}
              placeholder="ABC1D23" onChange={e => { setPlate(e.target.value.toUpperCase()); clear("plate"); }} />
            <FieldError field="plate" />
          </label>
          {type === "MOTO" && <label className={labelStyle}>Matrícula / registro do mototaxista
            <input className={inputStyle} value={registration} maxLength={80}
              onChange={e => { setRegistration(e.target.value); clear("registration"); }} />
            <FieldError field="registration" />
          </label>}
          <label className={labelStyle}>Foto do motorista
            {avatarValid(photoUrl, user.id) && !photo &&
              <img className="my-2 size-20 rounded-full object-cover" src={photoUrl} alt="Foto cadastrada" />}
            <span className="mt-2 flex gap-2 text-xs font-normal text-white/60"><Camera size={16} /> JPG, PNG ou WebP, até 5 MB</span>
            <input type="file" accept={professionalPhotoTypes.join(",")}
              className="mt-2 block w-full rounded-xl border border-white/20 bg-[#252525] p-3 text-sm"
              onChange={e => { setPhoto(e.target.files?.[0] || null); clear("photo"); }} />
            {photo && <span className="mt-1 block break-all text-xs text-white/60">{photo.name}</span>}
            <FieldError field="photo" />
          </label>
          <p className="text-xs text-white/55">Dados declaratórios. A habilitação na plataforma não substitui licenças exigidas para transporte profissional.</p>
        </>}
        {stage === 3 && <>
          <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.03] p-4 text-sm">
            <div><span className="text-xs text-white/55">Nome e contato</span><p className="font-semibold">{name} · {whatsapp||"WhatsApp não informado (opcional)"}</p></div>
            <div><span className="text-xs text-white/55">Município</span><p className="font-semibold">{municipality}</p></div>
            <div><span className="text-xs text-white/55">Veículo</span><p className="font-semibold">{type === "CAR" ? "Carro" : "Moto"} · {brand} {model} · {color} · {normalizePlate(plate)}</p></div>
            <div><span className="text-xs text-white/55">Vagas</span><p className="font-semibold">{seats}</p></div>
            {type === "MOTO" && <div><span className="text-xs text-white/55">Matrícula</span><p className="font-semibold">{registration}</p></div>}
          </div>
          <p className="text-xs text-white/60">O servidor validará seu cadastro. Nenhum GPS será ligado automaticamente.</p>
        </>}
        <div className="flex gap-3 pt-2">
          {stage > 0 && <button type="button" disabled={busy} onClick={() => changeStage(stage - 1)}
            className="flex min-h-13 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-bold">
            <ArrowLeft size={16} /> Voltar
          </button>}
          <button type="submit" disabled={busy}
            className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFBB00] px-4 text-sm font-extrabold text-[#121212] disabled:opacity-50">
            {busy ? "Validando…" : stage === 3 ? "Concluir e ver corridas" : "Continuar"}
            {stage === 3 ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
          </button>
        </div>
        <p className="text-center text-xs text-white/50">
          {stage === 3 ? "Depois: cockpit → ficar online quando quiser." :
            "A seguir: " + stages[stage + 1] + ". Você revisará tudo antes de concluir."}
        </p>
      </form>
    </section>
  </main>;
}
