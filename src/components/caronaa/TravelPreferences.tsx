import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadTravelPreferences, saveTravelPreferences } from "@/lib/travel-preferences-service";
import { emptyTravelPreferences, type TravelPreferences as Preferences } from "@/lib/travel-preferences";

export function TravelPreferenceFields({ value, onChange, kind }: {
  value: Preferences; onChange: (value: Preferences) => void; kind: "offer" | "request";
}) {
  const options = [
    { key: "conversation", label: "Conversa", items: [["any", "Indiferente"], ["quiet", "Prefiro silêncio"], ["chat", "Gosto de conversar"]] },
    { key: "music", label: "Música", items: [["any", "Indiferente"], ["off", "Sem música"], ["on", "Com música"]] },
    { key: "smoking", label: "Fumo", items: [["any", "Indiferente"], ["no", "Sem fumo"], ["yes", "Fumo permitido"]] },
    { key: "pets", label: "Animais", items: [["any", "Não informado"], ["no", "Sem animais"], ["yes", kind === "offer" ? "Aceito animais" : "Levo um animal"]] },
  ] as const;
  return <fieldset className="space-y-3">
    <legend className="mb-3 text-sm font-semibold">Preferências de viagem</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map(({ key, label, items }) => <label key={key} className="text-sm font-medium">{label}
        <select value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-foreground">
          {items.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
        </select>
      </label>)}
      <label className="text-sm font-medium">{kind === "offer" ? "Espaço para malas" : "Malas que vou levar"}
        <select value={value.luggage} onChange={(e) => onChange({ ...value, luggage: Number(e.target.value) })}
          className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-foreground">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 0 ? "Nenhuma" : `${n} ${n === 1 ? "mala" : "malas"}`}</option>)}
        </select>
      </label>
    </div>
  </fieldset>;
}

export function JourneyPreferences({ kind, onChange, initial }: {
  kind: "offer" | "request"; onChange: (value: Preferences | undefined) => void; initial?: Preferences;
}) {
  const [custom, setCustom] = useState(Boolean(initial));
  const [value, setValue] = useState(initial ?? { ...emptyTravelPreferences });
  useEffect(() => {
    if (initial) return;
    let alive = true;
    void loadTravelPreferences().then((data) => { if (alive) setValue(data); }).catch(() => undefined);
    return () => { alive = false; };
  }, [initial]);
  return <div className="space-y-3 border-t border-border pt-4">
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={custom} className="accent-primary" onChange={(e) => {
        setCustom(e.target.checked); onChange(e.target.checked ? value : undefined);
      }} /> Personalizar preferências deste trajeto
    </label>
    {custom && <TravelPreferenceFields kind={kind} value={value} onChange={(next) => { setValue(next); onChange(next); }} />}
  </div>;
}

export function ProfileTravelPreferences() {
  const [value, setValue] = useState({ ...emptyTravelPreferences });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadTravelPreferences().then((data) => { if (alive) { setValue(data); setBusy(false); } })
      .catch(() => { if (alive) { setFailed(true); setBusy(false); } });
    return () => { alive = false; };
  }, []);
  return <section className="space-y-4 border-y border-border py-5" aria-label="Preferências padrão">
    <h3 className="text-lg font-bold">Preferências padrão</h3>
    <TravelPreferenceFields kind="request" value={value} onChange={setValue} />
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      Autorizo salvar e usar estas preferências para encontrar caronas compatíveis.
    </label>
    {failed && <p role="alert" className="text-sm text-destructive">Não foi possível carregar suas preferências.</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || !consent || failed} onClick={async () => {
        setBusy(true);
        try { await saveTravelPreferences(value, true); toast.success("Preferências salvas."); }
        catch { toast.error("Não foi possível salvar suas preferências."); }
        finally { setBusy(false); }
      }}>Salvar preferências</Button>
      <Button variant="outline" disabled={busy || failed} onClick={async () => {
        setBusy(true);
        try { await saveTravelPreferences(emptyTravelPreferences, false); setValue({ ...emptyTravelPreferences }); setConsent(false); toast.success("Preferências removidas."); }
        catch { toast.error("Não foi possível remover suas preferências."); }
        finally { setBusy(false); }
      }}>Remover preferências</Button>
    </div>
  </section>;
}