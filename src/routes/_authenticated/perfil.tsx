import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ArrowRight,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronDown,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/mockData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — CARONAA" },
      { name: "description", content: "Gerencie seus dados e preferências no CARONAA." },
    ],
  }),
  component: Perfil,
});
const preferenceOptions = [
  "Música",
  "Conversa",
  "Silêncio",
  "Ar-condicionado",
  "Aceita pets",
  "Não fumante",
];

function Perfil() {
  const [photo, setPhoto] = useState(currentUser.photo);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [preferences, setPreferences] = useState(["Conversa", "Não fumante"]);
  const [driverOpen, setDriverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [about, setAbout] = useState(
    "Gosto de conhecer novas pessoas e acredito que compartilhar o caminho torna a cidade melhor para todo mundo.",
  );
  const [phone, setPhone] = useState("+55 (85) 98758-4347");

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Escolha uma imagem JPG, PNG ou WEBP.");
      return;
    }
    setSelectedFile(file);
    setPhoto(URL.createObjectURL(file));
    setZoom(1);
    setPhotoOpen(true);
  }
  async function confirmPhoto() {
    if (!selectedFile) {
      setPhotoOpen(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.warning("Prévia atualizada", {
        description: "Entre na conta para salvar a foto no storage.",
      });
      setPhotoOpen(false);
      return;
    }
    const extension = selectedFile.type.split("/")[1] || "jpg";
    const path = `${user.id}/profile.${extension}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, selectedFile, { upsert: true, contentType: selectedFile.type });
    if (error) {
      toast.error("Não foi possível atualizar a foto.", { description: error.message });
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setPhoto(data.publicUrl);
    setPhotoOpen(false);
    toast.success("Foto atualizada");
  }
  function saveProfile() {
    toast.success("Perfil salvo", { description: "Suas informações foram atualizadas." });
  }
  function togglePreference(value: string) {
    setPreferences((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }
  return (
    <AppShell>
      <PageHeading
        eyebrow="SUA COMUNIDADE"
        title="Meu perfil"
        description="Mantenha seus dados claros para conexões mais seguras."
      />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="text-center">
            <div className="relative mx-auto size-28">
              <img
                src={photo}
                alt="Foto de perfil"
                width={112}
                height={112}
                className="size-28 rounded-full object-cover ring-4 ring-secondary"
                style={{ transform: `scale(${photoOpen ? zoom : 1})` }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
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
            <h2 className="mt-4 font-display text-xl font-extrabold">{currentUser.name}</h2>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={14} /> {currentUser.city}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
                Motorista
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-primary">
                Passageiro
              </span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 border-t border-border pt-4 text-center">
            <div>
              <p className="font-display text-xl font-extrabold">{currentUser.rides}</p>
              <p className="text-[11px] text-muted-foreground">Caronas</p>
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 font-display text-xl font-extrabold">
                {currentUser.rating}
                <Star size={14} className="fill-warning text-warning" />
              </p>
              <p className="text-[11px] text-muted-foreground">Avaliação</p>
            </div>
            <div>
              <p className="font-display text-xl font-extrabold">2026</p>
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
                  Como a comunidade pode conhecer você.
                </p>
              </div>
              <CheckCircle2 size={19} className="text-primary" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome" value={currentUser.name} readOnly />
              <Field label="Telefone" value={phone} onChange={setPhone} />
              <label className="block text-xs font-bold text-muted-foreground md:col-span-2">
                SOBRE VOCÊ
                <textarea
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft md:p-5">
            <h3 className="font-display text-lg font-extrabold">Preferências de viagem</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Selecione o que ajuda a combinar melhor.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {preferenceOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => togglePreference(option)}
                  className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${preferences.includes(option) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-soft">
            <button
              type="button"
              onClick={() => setDriverOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left md:p-5"
            >
              <span>
                <span className="block font-display text-lg font-extrabold">
                  Motorista — {driverOpen ? "Cadastro incompleto" : "Cadastro incompleto"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Ative seu perfil de motorista com os dados do veículo.
                </span>
              </span>
              <ChevronDown
                size={19}
                className={`transition-transform ${driverOpen ? "rotate-180" : ""}`}
              />
            </button>
            {driverOpen && (
              <div className="grid gap-4 border-t border-border p-4 animate-page-in md:grid-cols-2 md:p-5">
                <Field label="Número da CNH" placeholder="Número da CNH" />
                <Field label="Categoria" placeholder="Ex.: B" />
                <Field label="Validade" type="date" />
                <Field label="Marca" placeholder="Ex.: Honda" />
                <Field label="Modelo" placeholder="Ex.: Fit" />
                <Field label="Cor" placeholder="Ex.: Prata" />
                <Field label="Placa" placeholder="Ex.: ABC1D23" />
                <Field label="Lugares" type="number" placeholder="1" />
                <div className="flex justify-end md:col-span-2">
                  <Button
                    type="button"
                    onClick={() => toast.success("Cadastro de motorista ativado")}
                  >
                    Ativar motorista
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link to="/minhas-caronas">
                Ver viagens <ArrowRight size={16} />
              </Link>
            </Button>
            <Button onClick={saveProfile}>Salvar alterações</Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} /> Seus dados são usados apenas para melhorar as combinações.
          </div>
        </section>
      </div>
      {photoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl">
            <h3 className="font-display text-lg font-extrabold">Ajustar foto</h3>
            <div className="mx-auto mt-5 flex size-56 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-secondary">
              <img
                src={photo}
                alt="Prévia da foto"
                className="size-full object-cover"
                style={{ transform: `scale(${zoom})` }}
              />
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
              <Button
                variant="ghost"
                onClick={() => {
                  setPhotoOpen(false);
                  setPhoto(currentUser.photo);
                }}
              >
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
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 read-only:opacity-70"
      />
    </label>
  );
}
