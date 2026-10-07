import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, Camera, CheckCircle2, Mail, MapPin, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/caronaa/AppShell";
import { NotificationPreferences } from "@/components/caronaa/NotificationControls";
import { PageHeading } from "@/components/caronaa/PageParts";
import { VerificationBadges } from "@/components/caronaa/VerificationBadges";
import { Button } from "@/components/ui/button";
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
};

function Perfil() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [email, setEmail] = useState("");

  const [verifications, setVerifications] = useState<UserVerification[]>([]);

  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");

  const [photo, setPhoto] = useState<string | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

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

        setProfile(profileData);

        setEmail(user.email ?? "");

        setFullName(profileData.full_name ?? "");
        setCity(profileData.city ?? "");

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

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Escolha uma imagem JPG, PNG ou WEBP.");

      event.target.value = "";

      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setPhoto(previewUrl);
    setZoom(1);
    setPhotoOpen(true);
  }

  async function confirmPhoto() {
    if (!selectedFile) {
      setPhotoOpen(false);
      return;
    }

    try {
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

      const extension =
        selectedFile.type === "image/png"
          ? "png"
          : selectedFile.type === "image/webp"
            ? "webp"
            : "jpg";

      const path = `${user.id}/profile.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, selectedFile, {
          upsert: true,
          contentType: selectedFile.type,
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

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      toast.success("Foto atualizada.");
    } catch (error) {
      console.error(error);

      toast.error("Não foi possível atualizar a foto.", {
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

    if (inputRef.current) {
      inputRef.current.value = "";
    }
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
          updated_at: updatedAt,
        })
        .eq("id", user.id)
        .select("id, full_name, avatar_url, city, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const updatedProfile = data as ProfileData;

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
      <AppShell>
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
      <AppShell>
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
    <AppShell>
      <PageHeading
        eyebrow="SUA COMUNIDADE"
        title="Meu perfil"
        description="Mantenha seus dados reais e seus vínculos visíveis para conexões mais seguras."
      />

      <NotificationPreferences />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="text-center">
            <div className="relative mx-auto size-28">
              {photo ? (
                <img
                  src={photo}
                  alt="Foto de perfil"
                  width={112}
                  height={112}
                  className="size-28 rounded-full object-cover ring-4 ring-secondary"
                  style={{
                    transform: `scale(${photoOpen ? zoom : 1})`,
                  }}
                />
              ) : (
                <div className="flex size-28 items-center justify-center rounded-full bg-secondary font-display text-3xl font-extrabold text-primary ring-4 ring-secondary">
                  {initials}
                </div>
              )}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-105"
                aria-label="Alterar foto"
              >
                <Camera size={17} />
              </button>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
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

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" asChild>
              <Link to="/minhas-caronas">
                Ver viagens
                <ArrowRight size={16} />
              </Link>
            </Button>

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
              <Button variant="ghost" onClick={cancelPhoto}>
                Cancelar
              </Button>

              <Button onClick={confirmPhoto}>Confirmar foto</Button>
            </div>
          </div>
        </div>
      )}
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
