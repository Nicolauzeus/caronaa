import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfessionalAuthorizationBadge } from "@/components/caronaa/ProfessionalAuthorizationBadge";
import {
  CAR_CATEGORIES, MISSING_LABELS, STATUS_LABELS, maxSeatsFor, parseMissingError, professionalAccessMissing,
  type AccessStatus, type CarCategory, type MissingCode, type VehicleType,
} from "@/lib/professional-access";

type State = {
  authorized: boolean;
  profileMissing: MissingCode[];
  request: null | { status: AccessStatus; vehicle_type: VehicleType; car_category: CarCategory | null; passenger_seats: number; municipality: string; review_reason: string | null; submitted_at: string };
};
type Profile = {
  full_name: string;
  avatar_url: string;
  vehicle_brand: string;
  vehicle_description: string;
  vehicle_plate: string;
  city: string;
};
const EMPTY_PROFILE: Profile = { full_name: "", avatar_url: "", vehicle_brand: "", vehicle_description: "", vehicle_plate: "", city: "" };

async function optimizePhoto(file: File): Promise<File> {
  if (file.size > 25 * 1024 * 1024) throw new Error("A foto deve ter no máximo 25 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use JPG, PNG ou WEBP.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Não foi possível converter a imagem.")), "image/jpeg", 0.82,
    ));
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function ProfessionalAccessRequest({ onAuthorized }: { onAuthorized?: (value: boolean) => void }) {
  const [state, setState] = useState<State | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<VehicleType>("CAR");
  const [category, setCategory] = useState<CarCategory | "">("");
  const [seats, setSeats] = useState(1);
  const [city, setCity] = useState("");
  const [color, setColor] = useState("");
  const [missing, setMissing] = useState<MissingCode[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const [{ data: access, error: accessError }, { data: auth, error: authError }] = await Promise.all([
      (supabase as any).rpc("get_my_professional_access"),
      supabase.auth.getUser(),
    ]);
    if (accessError || authError || !auth.user) {
      setError("Não foi possível carregar seu cadastro de motorista.");
      return;
    }
    const { data: p, error: profileError } = await supabase.from("profiles")
      .select("full_name, avatar_url, vehicle_brand, vehicle_description, vehicle_plate, city")
      .eq("id", auth.user.id).maybeSingle();
    if (profileError || !p) { setError("Não foi possível carregar os dados do seu perfil."); return; }
    setState(access as State);
    setUserId(auth.user.id);
    setProfile({
      full_name: p.full_name ?? "", avatar_url: p.avatar_url ?? "",
      vehicle_brand: p.vehicle_brand ?? "", vehicle_description: p.vehicle_description ?? "",
      vehicle_plate: p.vehicle_plate ?? "", city: p.city ?? "",
    });
    onAuthorized?.(Boolean(access?.authorized));
    const r = access?.request;
    if (r) {
      setType(r.vehicle_type); setCategory(r.car_category ?? "");
      setSeats(r.passenger_seats); setCity(r.municipality);
    } else { setCity(p.city ?? ""); }
  }, [onAuthorized]);

  useEffect(() => { void load(); }, [load]);

  function updateProfile(key: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
    setMissing([]);
    setError("");
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPG, PNG ou WEBP com até 25 MB.");
      return;
    }
    setPhotoFile(file);
    setError("");
    setMissing([]);
  }

  async function submit() {
    if (busy) return;
    setSuccess(""); setError("");
    const selected = professionalAccessMissing({
      avatarUrl: photoFile ? "https://pending-upload" : profile.avatar_url,
      fullName: profile.full_name, vehicleBrand: profile.vehicle_brand,
      vehicleDescription: profile.vehicle_description, vehiclePlate: profile.vehicle_plate,
      vehicleColor: color, vehicleType: type, carCategory: category || null, seats, municipality: city,
    });
    if (selected.length) { setMissing(selected); return; }
    if (!userId) { setError("Sessão não encontrada. Entre novamente."); return; }
    setBusy(true);
    try {
      if (photoFile) {
        const optimized = await optimizePhoto(photoFile);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, optimized, {
          upsert: false, contentType: "image/jpeg",
        });
        if (uploadError) throw new Error("Falha ao enviar foto: " + uploadError.message);
        const { data: url } = supabase.storage.from("avatars").getPublicUrl(path);
        const avatarUrl = url.publicUrl + "?v=" + Date.now();
        const { error: profileError } = await supabase.from("profiles")
          .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", userId);
        if (profileError) throw new Error("Não foi possível salvar a foto: " + profileError.message);
        setProfile((p) => ({ ...p, avatar_url: avatarUrl }));
        setPhotoFile(null);
      }
      const { error: requestError } = await (supabase as any).rpc("submit_professional_access_request_complete", {
        p_full_name: profile.full_name.trim(), p_vehicle_brand: profile.vehicle_brand.trim(),
        p_vehicle_model: profile.vehicle_description.trim(), p_vehicle_plate: profile.vehicle_plate.trim(),
        p_vehicle_color: color.trim(), p_vehicle_type: type,
        p_car_category: type === "CAR" ? category : null, p_seats: seats, p_municipality: city.trim(),
      });
      if (requestError) throw new Error(requestError.message);
      const { data: verified, error: verificationError } = await (supabase as any).rpc("get_my_professional_access");
      if (verificationError || verified?.request?.status !== "PENDING") {
        throw new Error("Solicitação enviada, mas não foi possível confirmar o status. Atualize a página antes de tentar novamente.");
      }
      setState(verified as State);
      setMissing([]);
      setSuccess("Solicitação enviada com sucesso. Aguardando análise administrativa.");
      onAuthorized?.(Boolean(verified.authorized));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível enviar a solicitação.";
      const codes = parseMissingError(message);
      if (codes.length) setMissing(codes);
      else setError(message);
    } finally { setBusy(false); }
  }

  if (!state) return <p className="rounded-xl border p-4 text-sm" role="status">{error || "Carregando autorização…"}</p>;
  const request = state.request;
  const canSubmit = !state.authorized && (!request || request.status === "CHANGES_REQUESTED" || request.status === "REJECTED");
  const maxSeats = maxSeatsFor(type, category || null);
  const completed = 9 - professionalAccessMissing({
    avatarUrl: photoFile ? "https://pending-upload" : profile.avatar_url,
    fullName: profile.full_name, vehicleBrand: profile.vehicle_brand, vehicleDescription: profile.vehicle_description,
    vehiclePlate: profile.vehicle_plate, vehicleColor: color, vehicleType: type,
    carCategory: category || null, seats, municipality: city,
  }).length;
  const fieldClass = "mt-1 w-full rounded-lg border bg-background p-3";

  return (
    <section className="space-y-3 rounded-xl border p-4" aria-label="Solicitação de autorização do motorista">
      <h2 className="font-semibold">Autorização de motorista para o radar</h2>
      {state.authorized ? (
        <div className="space-y-2"><ProfessionalAuthorizationBadge />
          <p className="text-xs text-muted-foreground">Autorização administrativa do radar piloto; não é verificação documental.</p>
        </div>
      ) : request && (
        <p role="status" className="text-sm">Situação: <strong>{STATUS_LABELS[request.status]}</strong>
          {request.status === "PENDING" && " — aguarde a análise administrativa."}
        </p>
      )}
      {request?.review_reason && !state.authorized && <p className="rounded-lg border p-2 text-sm">Motivo: {request.review_reason}</p>}
      {success && <p role="status" className="rounded-lg border p-3 text-sm">{success}</p>}
      {missing.length > 0 && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
        <p className="font-semibold">Complete os campos indicados:</p>
        <ul className="ml-4 list-disc">{Array.from(new Set(missing)).map((item) =>
          <li key={item}>{MISSING_LABELS[item]}</li>)}</ul>
      </div>}
      {canSubmit && <>
        <p className="text-xs text-muted-foreground">Dados preenchidos são reaproveitados do seu perfil. Revise e complete apenas o que faltar.</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Dados do motorista</p>
          <span className="text-xs text-muted-foreground">{Math.max(0, completed)} de 9 informações prontas</span>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">Nome completo *
            <input className={fieldClass} maxLength={150} autoComplete="name" value={profile.full_name}
              onChange={(event) => updateProfile("full_name", event.target.value)} />
          </label>
          <div className="space-y-2 text-sm">
            <p>Foto do perfil *</p>
            {profile.avatar_url && <img src={profile.avatar_url} alt="Foto atual do perfil" className="size-16 rounded-full object-cover" />}
            <input aria-label="Atualizar foto do motorista" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void selectPhoto(event)} className={fieldClass} />
            {photoFile && <p className="text-xs">Nova foto: {photoFile.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["CAR", "MOTO"] as const).map((choice) =>
              <button key={choice} type="button" aria-pressed={type === choice}
                onClick={() => { setType(choice); if (choice === "MOTO") { setCategory(""); setSeats(1); } }}
                className={`min-h-12 rounded-xl border p-2 font-semibold ${type === choice ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                {choice === "CAR" ? "Carro" : "Moto"}
              </button>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Marca *
              <input className={fieldClass} maxLength={80} placeholder="Ex.: Fiat" value={profile.vehicle_brand}
                onChange={(event) => updateProfile("vehicle_brand", event.target.value)} />
            </label>
            <label className="block text-sm">Modelo *
              <input className={fieldClass} maxLength={100} placeholder="Ex.: Argo" value={profile.vehicle_description}
                onChange={(event) => updateProfile("vehicle_description", event.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Cor do veículo *
              <input className={fieldClass} maxLength={40} placeholder="Ex.: Prata" value={color}
                onChange={(event) => { setColor(event.target.value); setMissing([]); }} />
            </label>
            <label className="block text-sm">Placa *
              <input className={fieldClass} maxLength={12} placeholder="ABC1D23" value={profile.vehicle_plate}
                autoCapitalize="characters" onChange={(event) => updateProfile("vehicle_plate", event.target.value.toUpperCase())} />
            </label>
          </div>
          {type === "CAR" && <label className="block text-sm">Categoria do carro *
            <select className={fieldClass} value={category} onChange={(event) => {
              const next = event.target.value as CarCategory; setCategory(next);
              setSeats((previous) => Math.min(previous, maxSeatsFor("CAR", next)));
            }}>
              <option value="">Selecione</option>
              {CAR_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>}
          <label className="block text-sm">Vagas para passageiros * (1 a {maxSeats})
            <input className={fieldClass} type="number" min={1} max={maxSeats} value={seats}
              disabled={type === "MOTO"} onChange={(event) => setSeats(Number(event.target.value))} />
          </label>
          <label className="block text-sm">Município de atuação *
            <input className={fieldClass} maxLength={120} placeholder="Ex.: Fortaleza" value={city}
              onChange={(event) => setCity(event.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void submit()}
          className="min-h-12 w-full rounded-xl bg-primary p-3 font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "Salvando e enviando…" : request ? "Reenviar solicitação" : "Enviar solicitação"}
        </button>
        <p className="text-xs text-muted-foreground">O envio não autoriza o radar. A aprovação é exclusivamente administrativa.</p>
      </>}
    </section>
  );
}
