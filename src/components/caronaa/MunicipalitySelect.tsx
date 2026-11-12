import { useEffect, useRef, useState, useId } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchMunicipalities, resolveMunicipality } from "@/lib/municipality.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, LoaderCircle } from "lucide-react";

export function MunicipalitySelect({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [options, setOptions] = useState<{ placeId: string; label: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const token = useRef("");
  const generation = useRef(0);
  const search = useServerFn(searchMunicipalities);
  const resolve = useServerFn(resolveMunicipality);
  useEffect(() => { if (!editing) setText(value); }, [value, editing]);
  useEffect(() => {
    if (!editing || disabled || text.trim().length < 2) return;
    const current = generation.current;
    let active = true;
    const timer = window.setTimeout(() => {
      setBusy(true); setError("");
      if (!token.current) token.current = crypto.randomUUID();
      void search({ data: { query: text.trim(), sessionToken: token.current } }).then(result => {
        if (active && current === generation.current) { setOptions(result); if (!result.length) setError("Nenhum município encontrado."); }
      }).catch(e => { if (active && current === generation.current) setError(e instanceof Error ? e.message : "Busca Google indisponível."); })
        .finally(() => { if (active && current === generation.current) setBusy(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [text, editing, disabled, search]);
  async function select(placeId: string) {
    const current = ++generation.current;
    setBusy(true); setOptions([]); setError("");
    try {
      const city = await resolve({ data: { placeId, sessionToken: token.current } });
      if (current !== generation.current) return;
      setEditing(false); setText(`${city.name} — ${city.state}`); onChange(city.name);
      token.current = "";
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : "Não foi possível confirmar o município."); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium">Município</label>
    <div className="relative">
      <Input id={id} role="combobox" aria-expanded={options.length > 0} aria-controls={`${id}-options`} aria-autocomplete="list" autoComplete="off" value={text} disabled={disabled} maxLength={120} placeholder="Buscar município" onChange={e => { generation.current++; setText(e.target.value); setEditing(true); setOptions([]); setError(""); setBusy(false); onChange(""); }} />
      {busy && <LoaderCircle aria-label="Consultando Google" className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />}
      {options.length > 0 && <div id={`${id}-options`} role="listbox" aria-label="Municípios Google" className="absolute z-20 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
        {options.map(option => <Button key={option.placeId} role="option" aria-selected={false} variant="ghost" className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" onClick={() => void select(option.placeId)}><MapPin className="size-4 shrink-0" />{option.label}</Button>)}
        <p className="px-3 py-1 text-xs text-muted-foreground">Google Maps</p>
      </div>}
    </div>
    {editing && !error && <p className="text-xs text-muted-foreground">Selecione um município da lista.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}