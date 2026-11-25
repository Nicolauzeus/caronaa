import { useId, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePixKey } from "@/lib/pix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PixKeyForm({ initialKey, onSaved }: { initialKey: string; onSaved: (key: string) => void }) {
  const id = useId();
  const [key, setKey] = useState(initialKey);
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const ambiguous = /^\d{11}$/.test(key.trim()) && key.trim() !== initialKey;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (ambiguous && !kind) throw new Error("Escolha se os 11 dígitos são um telefone ou um CPF.");
      const value = normalizePixKey(ambiguous && kind === "phone" ? "+55" + key.trim() : key);
      const { error: failure } = await supabase.rpc("save_my_pix_key", { p_key: value });
      if (failure) throw new Error(failure.code === "22023" ? "A chave foi recusada. Confira o formato informado." :
        "Não foi possível salvar a chave Pix. Tente novamente.");
      setKey(value);
      setNotice("Chave Pix salva.");
      onSaved(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a chave Pix.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={save} className="w-full space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold">Chave Pix do motorista</label>
    <Input id={id} value={key} maxLength={77} disabled={busy} autoCapitalize="none" spellCheck={false}
      placeholder="E-mail, telefone, CPF, CNPJ ou chave aleatória"
      onChange={e => { setKey(e.target.value); setKind(""); setNotice(""); setError(""); }} />
    {ambiguous && <label className="block text-sm">Tipo de chave de 11 dígitos
      <select required disabled={busy} value={kind} onChange={e => setKind(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-border bg-background p-2 text-foreground">
        <option value="">Selecione o tipo</option>
        <option value="phone">Telefone com DDD (+55)</option><option value="document">CPF</option>
      </select>
    </label>}
    {key === initialKey && /^\d{11}$/.test(key) && <p className="text-xs">
      Chave cadastrada como CPF. Se for telefone, acrescente +55 antes do DDD.
    </p>}
    <Button type="submit" disabled={busy || !key.trim()}>{busy ? "Salvando…" : "Salvar chave Pix"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </form>;
}
