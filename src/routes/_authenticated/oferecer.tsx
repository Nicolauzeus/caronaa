import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CarFront,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { PageHeading } from "@/components/caronaa/PageParts";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/oferecer")({
  head: () => ({
    meta: [
      { title: "Oferecer carona — CARONAA" },
      {
        name: "description",
        content: "Compartilhe um trajeto que você já vai fazer e ofereça lugares à comunidade.",
      },
      { property: "og:title", content: "Oferecer carona — CARONAA" },
      {
        property: "og:description",
        content: "Compartilhe um trajeto que você já vai fazer e ofereça lugares à comunidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Oferecer,
});
const initial = {
  origin: "",
  destination: "",
  date: "",
  time: "",
  seats: "2",
  vehicle: "",
  meeting: "",
  notes: "",
  price: "",
};
function Oferecer() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const update = (key: keyof typeof initial, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const next = (e: FormEvent) => {
    e.preventDefault();
    if (step === 2) {
      try {
        sessionStorage.setItem("caronaa-offered-ride", JSON.stringify(form));
      } catch {}
      setStep(3);
    } else setStep(2);
  };
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <PageHeading
          eyebrow="COMPARTILHE SEU CAMINHO"
          title="Ofereça uma carona"
          description="Já vai fazer esse trajeto? Abra espaço para quem está indo na mesma direção."
        />
        <div className="mb-8 flex items-center gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step >= n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {step > n ? <Check size={15} /> : n}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:block ${step >= n ? "text-foreground" : "text-muted-foreground"}`}
              >
                {["Trajeto", "Detalhes", "Pronto!"][n - 1]}
              </span>
              {n < 3 && <span className="ml-auto h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>
        {step === 3 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-16 text-center shadow-soft">
            <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
              <CheckCircle2 size={34} />
            </span>
            <h2 className="font-display text-2xl font-extrabold">Carona publicada!</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Seu trajeto de {form.origin} para {form.destination} foi adicionado às suas caronas
              nesta demonstração.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/minhas-caronas">
                  Ver minhas caronas <ArrowRight />
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setForm(initial);
                  setStep(1);
                }}
              >
                Oferecer outra
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={next}
            className="rounded-lg border border-border bg-card p-5 shadow-soft md:p-8"
          >
            <div className="mb-7 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
                {step === 1 ? <MapPin /> : <CarFront />}
              </span>
              <div>
                <h2 className="font-display text-xl font-extrabold">
                  {step === 1 ? "Por onde você vai?" : "Detalhes da sua carona"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {step === 1
                    ? "Conte-nos o trajeto e quando pretende sair."
                    : "Ajude passageiros a conhecer sua viagem."}
                </p>
              </div>
            </div>
            {step === 1 ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Origem"
                  value={form.origin}
                  onChange={(v) => update("origin", v)}
                  placeholder="Ex.: Aldeota, Fortaleza"
                  required
                />
                <Field
                  label="Destino"
                  value={form.destination}
                  onChange={(v) => update("destination", v)}
                  placeholder="Ex.: Eusébio"
                  required
                />
                <Field
                  label="Data"
                  value={form.date}
                  onChange={(v) => update("date", v)}
                  type="date"
                  required
                />
                <Field
                  label="Horário de saída"
                  value={form.time}
                  onChange={(v) => update("time", v)}
                  type="time"
                  required
                />
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Vagas disponíveis
                  <select
                    value={form.seats}
                    onChange={(e) => update("seats", e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                  </select>
                </label>
                <Field
                  label="Veículo"
                  value={form.vehicle}
                  onChange={(v) => update("vehicle", v)}
                  placeholder="Ex.: Honda Fit, prata"
                  required
                />
                <Field
                  label="Ponto de encontro"
                  value={form.meeting}
                  onChange={(v) => update("meeting", v)}
                  placeholder="Ex.: Praça Portugal"
                  required
                />
                <Field
                  label="Contribuição sugerida (R$)"
                  value={form.price}
                  onChange={(v) => update("price", v)}
                  type="number"
                  placeholder="Opcional"
                />
                <label className="block text-sm font-semibold sm:col-span-2">
                  Observações
                  <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Algo mais que os passageiros devem saber?"
                    rows={3}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            )}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              {step === 2 ? (
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft /> Voltar
                </Button>
              ) : (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays size={15} /> Planeje seu trajeto
                </span>
              )}
              <Button type="submit" className="h-11 px-6">
                {step === 1 ? "Continuar" : "Publicar carona"} <ArrowRight />
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0" : undefined}
        className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
