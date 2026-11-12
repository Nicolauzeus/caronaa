import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  CircleAlert,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/caronaa/AppShell";
import {
  NotificationControls,
  NotificationPreferences,
} from "@/components/caronaa/NotificationControls";
import { DriverPixSettings } from "@/components/caronaa/DriverPix";
import { DriverPlatformFees } from "@/components/caronaa/DriverPlatformFees";
import { ProfessionalAuthorizationBadge } from "@/components/caronaa/ProfessionalAuthorizationBadge";
import { ProfileTravelPreferences } from "@/components/caronaa/TravelPreferences";
import { PageHeading } from "@/components/caronaa/PageParts";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { ResearchParticipationCard } from "@/components/caronaa/ResearchParticipationCard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { getMyUserVerifications, type UserVerification } from "@/lib/user-verifications";
import { toast } from "sonner";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — CARONAA" },
      {
        name: "description",
        content: "Gerencie seus dados e verificações no CARONAA.",
      },
      { property: "og:title", content: "Meu perfil — CARONAA" },
      {
        property: "og:description",
        content: "Gerencie seus dados e preferências de viagem no CARONAA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

type ProfileData = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  gender: "FEMININO" | "MASCULINO" | null;
  vehicle_description: string | null;
  vehicle_brand: string | null;
  vehicle_plate: string | null;
};

const MAX_AVATAR_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 1280;

/** Accept a photo up to 25 MiB; shrink it before sending to storage. */
async function prepareAvatarPhoto(file: File): Promise<File> {
  if (file.size > MAX_AVATAR_SOURCE_BYTES) throw new Error("A foto deve ter no máximo 25 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use JPG, PNG ou WEBP.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem neste navegador.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível converter a foto.")), "image/jpeg", 0.82)
    );
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function Perfil() {
  const { launchLocked } = useRouteContext({ from: "/_authenticated" });
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">(
    "idle",
  );

  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [email, setEmail] = useState("");

  const [verifications, setVerifications] = useState<UserVerification[]>([]);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<"FEMININO" | "MASCULINO" | "">("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");

  const [photo, setPhoto] = useState<string | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("editPhoto=true")) {
      setAvatarSheetOpen(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          throw new Error("Não foi possível identificar o usuário autenticado.");
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, city, created_at, updated_at")
          .eq("id", user.id)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        const verificationRows = await getMyUserVerifications();

        if (cancelled) return;

        const profileData = data as ProfileData;

        // A coluna foi adicionada depois do lançamento. Mantém perfis antigos
        // acessíveis enquanto a migration chega ao ambiente publicado.
        const { data: genderRow } = await supabase
          .from("profiles")
          .select("gender")
          .eq("id", user.id)
          .maybeSingle();
        profileData.gender =
          genderRow?.gender === "FEMININO" || genderRow?.gender === "MASCULINO"
            ? genderRow.gender
            : null;
        const { data: vehicleRow } = await supabase
          .from("profiles")
          .select("vehicle_description, vehicle_brand, vehicle_plate")
          .eq("id", user.id)
          .maybeSingle();
        profileData.vehicle_description =
          typeof vehicleRow?.vehicle_description === "string"
            ? vehicleRow.vehicle_description
            : null;
        profileData.vehicle_brand = vehicleRow?.vehicle_brand ?? null;
        profileData.vehicle_plate = vehicleRow?.vehicle_plate ?? null;

        setProfile(profileData);

        setEmail(user.email ?? "");

        setFullName(profileData.full_name ?? "");
        setCity(profileData.city ?? "");
        setGender(profileData.gender ?? "");
        setVehicleDescription(profileData.vehicle_description ?? "");
        setVehicleBrand(profileData.vehicle_brand ?? "");
        setVehiclePlate(profileData.vehicle_plate ?? "");

        setPhoto(profileData.avatar_url);
        setSavedPhoto(profileData.avatar_url);

        setVerifications(verificationRows);
      } catch (error) {
        if (cancelled) return;

        console.error(error);

        toast.error("Não foi possível carregar seu perfil.", {
          description: error instanceof Error ? error.message : "Tente novamente.",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.type)) {
      toast.error("Formato inválido. Escolha uma imagem JPG, PNG ou WEBP.");
      event.target.value = "";
      return;
    }

    const MAX_FILE_SIZE = MAX_AVATAR_SOURCE_BYTES; // arquivos de entrada até 25 MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. O limite máximo permitido é de 25 MB.");
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setPhoto(previewUrl);
    setZoom(1);
    setPhotoOpen(true);
    setAvatarSheetOpen(false);
  }

  async function confirmPhoto() {
    if (!selectedFile) {
      setPhotoOpen(false);
      return;
    }

    const MAX_FILE_SIZE = MAX_AVATAR_SOURCE_BYTES; // arquivos de entrada até 25 MB
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("A foto excede o limite máximo permitido de 25 MB.");
      return;
    }

    try {
      setUploadStatus("uploading");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("Usuário autenticado não encontrado.");
      }

      // Reduz fotos grandes para um avatar JPEG leve antes de gravar no Storage.
      // Isso evita erros de limite do bucket e melhora o upload em redes móveis.
      const optimizedFile = await prepareAvatarPhoto(selectedFile);
      const fileUuid = crypto.randomUUID();
      const path = `${user.id}/${fileUuid}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, optimizedFile, {
          upsert: false,
          contentType: "image/jpeg",
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);

      const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // Atualiza os metadados de autenticação para que AppShell e Drawer reflitam imediatamente sem logout
      await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl,
          picture: publicUrl,
        },
      });

      setPhoto(publicUrl);
      setSavedPhoto(publicUrl);

      setProfile((current) =>
        current
          ? {
              ...current,
              avatar_url: publicUrl,
              updated_at: new Date().toISOString(),
            }
          : current,
      );

      setSelectedFile(null);
      setPhotoOpen(false);
      setUploadStatus("success");

      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";

      toast.success("Foto de perfil atualizada com sucesso.");
    } catch (error) {
      console.error(error);
      setUploadStatus("error");

      toast.error("Não foi possível atualizar a foto.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  async function removePhoto() {
    try {
      setUploadStatus("uploading");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Usuário autenticado não encontrado.");
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      await supabase.auth.updateUser({
        data: {
          avatar_url: null,
          picture: null,
        },
      });

      setPhoto(null);
      setSavedPhoto(null);

      setProfile((current) =>
        current
          ? {
              ...current,
              avatar_url: null,
              updated_at: new Date().toISOString(),
            }
          : current,
      );

      setAvatarSheetOpen(false);
      setUploadStatus("success");

      if (galleryInputRef.current) galleryInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";

      toast.success("Foto de perfil removida.");
    } catch (error) {
      console.error(error);
      setUploadStatus("error");

      toast.error("Não foi possível remover a foto.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  function cancelPhoto() {
    if (photo && photo.startsWith("blob:")) {
      URL.revokeObjectURL(photo);
    }

    setPhoto(savedPhoto);
    setSelectedFile(null);
    setPhotoOpen(false);
    setZoom(1);

    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function saveProfile() {
    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("Usuário autenticado não encontrado.");
      }

      const normalizedName = fullName.trim();
      const normalizedCity = city.trim();
      const normalizedPlate = vehiclePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (normalizedPlate && !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizedPlate)) {
        toast.error("Informe uma placa válida, como ABC1234 ou ABC1D23.");
        return;
      }
      if (vehicleBrand.trim().length > 60 || vehicleDescription.trim().length > 160) {
        toast.error("Revise a marca e a descrição do veículo.");
        return;
      }

      if (!normalizedName) {
        toast.error("Informe seu nome antes de salvar.");

        return;
      }

      const updatedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from("profiles")
        .update({
          full_name: normalizedName,
          city: normalizedCity || null,
          vehicle_brand: vehicleBrand.trim() || null,
          vehicle_plate: normalizedPlate || null,
          vehicle_description: vehicleDescription.trim() || null,
          updated_at: updatedAt,
        })
        .eq("id", user.id)
        .select("id, full_name, avatar_url, city, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updatedProfile = data as ProfileData;

      if (gender) {
        const { error: genderError } = await supabase
          .from("profiles")
          .update({ gender })
          .eq("id", user.id);
        if (genderError)
          throw new Error(
            "Não foi possível salvar o gênero. Atualize o banco com a migration mais recente.",
          );
      }
      const { error: vehicleError } = await supabase
        .from("profiles")
        .update({ vehicle_description: vehicleDescription.trim() || null })
        .eq("id", user.id);
      if (vehicleError) {
        throw new Error(
          "Não foi possível salvar o veículo padrão. A migration do perfil precisa estar aplicada.",
        );
      }
      updatedProfile.gender = gender || null;
      updatedProfile.vehicle_description = vehicleDescription.trim() || null;
      updatedProfile.vehicle_brand = vehicleBrand.trim() || null;
      updatedProfile.vehicle_plate = normalizedPlate || null;
      setVehiclePlate(normalizedPlate);

      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name);
      setCity(updatedProfile.city ?? "");

      toast.success("Perfil salvo.", {
        description: "Suas informações foram atualizadas.",
      });
    } catch (error) {
      console.error(error);

      toast.error("Não foi possível salvar o perfil.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell prelaunchMode={launchLocked}>
        <PageHeading
          eyebrow="SUA COMUNIDADE"
          title="Meu perfil"
          description="Carregando seus dados..."
        />

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-80 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell prelaunchMode={launchLocked}>
        <PageHeading
          eyebrow="SUA COMUNIDADE"
          title="Meu perfil"
          description="Não foi possível carregar seu perfil."
        />

        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">
            Seu usuário está autenticado, mas o perfil não pôde ser carregado.
          </p>
        </div>
      </AppShell>
    );
  }

  const createdYear = new Date(profile.created_at).getFullYear();

  const initials =
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C";

  return (
    <AppShell prelaunchMode={launchLocked}>
      <PageHeading
        eyebrow="SUA COMUNIDADE"
        title="Meu perfil"
        description={launchLocked
          ? "Seu espaço para personalizar o CARONAA antes do lançamento."
          : "Mantenha seus dados reais e seus vínculos visíveis para conexões mais seguras."}
      />
      {launchLocked && (
        <section role="status" aria-label="Acesso ao perfil durante o pré-lançamento"
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-extrabold text-foreground">Seu perfil já está liberado</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Adicione sua foto, cidade, preferências e veículo. Sua campanha ainda não permite pedir ou oferecer caronas.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full shrink-0 border-primary/30 sm:w-auto">
            <Link to="/aguardando">Voltar à contagem regressiva</Link>
          </Button>
        </section>
      )}

      <section
        className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-soft"
        aria-label="Notificações de carona"
      >
        <div>
          <h2 className="text-sm font-semibold">Combinações e notificações</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Acompanhe novos matches e atualizações das suas viagens.
          </p>
        </div>
        <NotificationControls />
      </section>
      <NotificationPreferences />
      <ProfileTravelPreferences />
      <DriverPixSettings />
      <DriverPlatformFees />
      <div className="mb-3"><ProfessionalAuthorizationBadge /></div>
      <section aria-label="Radar do motorista" className="mb-5 rounded-2xl border border-primary/30 bg-card p-4 shadow-soft">
        <h2 className="text-base font-extrabold">Radar do motorista</h2>
        <Link to="/cadastro-motorista" className="mt-2 inline-block text-sm font-bold text-primary underline">
          Cadastro simplificado de mototaxista / acompanhar solicitação
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          Motoristas aprovados iniciam disponíveis por padrão; para aparecer no mapa é necessário autorizar o GPS uma vez.
          Você pode ficar offline a qualquer momento. A administração precisa liberar o município.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Depois da autorização, o GPS continua enquanto você navega pelo CARONAA com a aba visível.
          Com o celular bloqueado ou o app em segundo plano, sua posição deixa de ser atualizada
          e o radar interrompe a exibição quando o sinal expira.
        </p>
        <Button asChild className="mt-3 min-h-12 w-full sm:w-auto">
          <Link to="/disponibilidade-profissional">Gerenciar radar e localização <ArrowRight className="ml-2 size-4" /></Link>
        </Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="text-center">
            <div className="relative mx-auto size-28">
              <button
                type="button"
                onClick={() => setAvatarSheetOpen(true)}
                className="group relative block size-28 rounded-full focus:outline-none focus:ring-4 focus:ring-primary/20"
                aria-label="Abrir opções de foto de perfil"
              >
                {photo ? (
                  <img
                    src={photo}
                    alt="Foto de perfil"
                    width={112}
                    height={112}
                    className="size-28 rounded-full object-cover ring-4 ring-secondary transition-opacity group-hover:opacity-90"
                    style={{
                      transform: `scale(${photoOpen ? zoom : 1})`,
                    }}
                  />
                ) : (
                  <div className="flex size-28 items-center justify-center rounded-full bg-secondary font-display text-3xl font-extrabold text-primary ring-4 ring-secondary transition-opacity group-hover:opacity-90">
                    {initials}
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setAvatarSheetOpen(true)}
                className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-105 active:scale-95"
                aria-label="Alterar foto de perfil"
              >
                <Camera size={17} />
              </button>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectPhoto}
                className="sr-only"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={selectPhoto}
                className="sr-only"
              />
            </div>

            <h2 className="mt-4 font-display text-xl font-extrabold">
              {fullName || "Usuário CARONAA"}
            </h2>

            {city ? (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <MapPin size={14} />
                {city}
              </p>
            ) : null}

            <div className="mt-4 flex justify-center">
              {verifications.length > 0 ? (
                <VerificationBadges verifications={verifications} />
              ) : (
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Sem vínculo verificado
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 border-t border-border pt-4 text-center">
            <div>
              <p className="font-display text-xl font-extrabold">{verifications.length}</p>

              <p className="text-[11px] text-muted-foreground">Verificações</p>
            </div>

            <div>
              <p className="font-display text-xl font-extrabold">
                {Number.isFinite(createdYear) ? createdYear : "—"}
              </p>

              <p className="text-[11px] text-muted-foreground">Desde</p>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-extrabold">Dados pessoais</h3>

                <p className="text-xs text-muted-foreground">
                  Informações reais associadas à sua conta CARONAA.
                </p>
              </div>

              <CheckCircle2 size={19} className="text-primary" />
            </div>

            {!gender && (
              <div className="mb-4 flex gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                <CircleAlert className="mt-0.5 shrink-0 text-primary" size={18} />
                <p>
                  <strong>Defina seu gênero.</strong> Essa informação permite respeitar filtros de
                  segurança em caronas exclusivas para mulheres ou homens.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome" value={fullName} onChange={setFullName} placeholder="Seu nome" />

              <LocationAutocomplete
                id="perfil-cidade"
                label="Cidade"
                value={city}
                onChange={(val, details) => setCity(details?.city || val)}
                placeholder="Ex.: Fortaleza"
                variant="simple"
              />

              <label className="block text-xs font-bold text-muted-foreground">
                GÊNERO
                <select
                  value={gender}
                  onChange={(event) =>
                    setGender(event.target.value as "FEMININO" | "MASCULINO" | "")
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground"
                >
                  <option value="">Prefiro não informar agora</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MASCULINO">Masculino</option>
                </select>
              </label>

              <Field
                label="Modelo e cor do veículo"
                value={vehicleDescription}
                onChange={setVehicleDescription}
                placeholder="Ex.: Honda Fit prata"
              />
              <Field label="Marca do carro" value={vehicleBrand} onChange={setVehicleBrand} placeholder="Ex.: Honda" />
              <Field label="Placa do carro" value={vehiclePlate} onChange={(value) => setVehiclePlate(value.toUpperCase())} placeholder="ABC1D23" />

              <div className="md:col-span-2">
                <Field label="E-mail" value={email} readOnly />

                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail size={13} />O e-mail vem da sua conta de autenticação e não pode ser
                  alterado por esta tela.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-soft md:p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-extrabold">Vínculos verificados</h3>

                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Os selos mostram vínculos identificados pelo CARONAA. Eles não representam
                  verificação completa de identidade.
                </p>

                <div className="mt-4">
                  {verifications.length > 0 ? (
                    <VerificationBadges verifications={verifications} />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                      <p className="text-sm font-semibold">Nenhum vínculo verificado ainda</p>

                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Contas com e-mail institucional confirmado da UNIFOR recebem o selo UNIFOR.
                        Participantes identificados pelo formulário do Siará Tech Summit 2026
                        recebem o selo STS 2026.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <ResearchParticipationCard />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {!launchLocked && (
              <Button variant="outline" asChild>
                <Link to="/minhas-caronas">
                  Ver viagens
                  <ArrowRight size={16} />
                </Link>
              </Button>
            )}

            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} />
            Seus dados são usados para sua conta e para melhorar a confiança nas conexões.
          </div>
        </section>
      </div>

      {photoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl">
            <h3 className="font-display text-lg font-extrabold">Ajustar foto</h3>

            <div className="mx-auto mt-5 flex size-56 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-secondary">
              {photo ? (
                <img
                  src={photo}
                  alt="Prévia da foto"
                  className="size-full object-cover"
                  style={{
                    transform: `scale(${zoom})`,
                  }}
                />
              ) : (
                <span className="font-display text-4xl font-extrabold text-primary">
                  {initials}
                </span>
              )}
            </div>

            <label className="mt-5 block text-xs font-bold text-muted-foreground">
              ZOOM
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelPhoto} disabled={uploadStatus === "uploading"}>
                Cancelar
              </Button>

              <Button onClick={confirmPhoto} disabled={uploadStatus === "uploading"}>
                {uploadStatus === "uploading" ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Confirmar foto"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet Mobile para opções do Avatar */}
      <Sheet open={avatarSheetOpen} onOpenChange={setAvatarSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border bg-card px-6 pb-8 pt-6 shadow-2xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-lg font-extrabold text-foreground">
              Foto de perfil
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Escolha uma imagem JPG, PNG ou WEBP de até 5MB.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 flex flex-col gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-13 w-full justify-start gap-3 rounded-2xl border-border bg-background text-sm font-bold text-foreground hover:bg-muted shadow-sm"
              onClick={() => {
                setAvatarSheetOpen(false);
                cameraInputRef.current?.click();
              }}
              disabled={uploadStatus === "uploading"}
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Camera size={18} />
              </div>
              Tirar foto
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-13 w-full justify-start gap-3 rounded-2xl border-border bg-background text-sm font-bold text-foreground hover:bg-muted shadow-sm"
              onClick={() => {
                setAvatarSheetOpen(false);
                galleryInputRef.current?.click();
              }}
              disabled={uploadStatus === "uploading"}
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ImageIcon size={18} />
              </div>
              Escolher da galeria
            </Button>

            {photo && (
              <Button
                type="button"
                variant="ghost"
                className="h-13 w-full justify-start gap-3 rounded-2xl text-sm font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={removePhoto}
                disabled={uploadStatus === "uploading"}
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <Trash2 size={18} />
                </div>
                Remover foto
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-11 w-full rounded-2xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => setAvatarSheetOpen(false)}
              disabled={uploadStatus === "uploading"}
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function Field({
  label,
  value = "",
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label.toUpperCase()}

      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 read-only:cursor-not-allowed read-only:opacity-70"
      />
    </label>
  );
}
