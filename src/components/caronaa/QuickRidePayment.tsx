import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { buildPixPayload, normalizePixKey } from "@/lib/pix";
import { formatBrl } from "@/lib/ride-cost";
import { Button } from "@/components/ui/button";
import { PixPaymentCode } from "./PixPaymentCode";
import { PixKeyForm } from "./PixKeyForm";

type Charge = {
  amountCents: number;
  key: string;
  payload: string | null;
  pilotOnly: boolean;
};
type Declaration = "pending" | "declared" | "received";

function readCharge(row: Json, rideId: string): Charge {
  if (!row || typeof row !== "object" || Array.isArray(row) ||
      row.rideId !== rideId || row.paymentMethod !== "MANUAL_DRIVER_PIX" ||
      row.automaticConfirmation !== false || typeof row.available !== "boolean" ||
      typeof row.pilotOnly !== "boolean" || typeof row.amountCents !== "number" ||
      !Number.isSafeInteger(row.amountCents) || row.amountCents < 450 || row.amountCents > 2_147_483_647) {
    throw new Error("Não foi possível validar o valor contratado desta corrida.");
  }

  const key = typeof row.key === "string" ? row.key.trim() : "";
  if (row.available !== Boolean(key)) throw new Error("Os dados da chave Pix estão inconsistentes.");
  const charge = { amountCents: row.amountCents, pilotOnly: row.pilotOnly, key, payload: null };
  if (!key) return charge;
  let normalized: string;
  try { normalized = normalizePixKey(key); }
  catch { return charge; } // The driver can correct a previously stored key in this checkout.
  const name = typeof row.name === "string" ? row.name : "Motorista";
  const txid = "CR" + rideId.replace(/-/g, "").slice(0, 20);
  return { ...charge, key: normalized, payload: buildPixPayload(normalized, name, row.amountCents / 100, txid) };
}

async function readDeclaration(rideId: string, signal?: AbortSignal): Promise<Declaration> {
  const request = supabase.rpc("quick_ride_payment_declaration_state", { p_id: rideId });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error || !Array.isArray(data) || data.length > 1) throw new Error("Não foi possível consultar as declarações.");
  if (data.length === 0) return "pending";
  const state = data[0];
  if (!state || !(state.passenger_declared_at === null || typeof state.passenger_declared_at === "string") ||
      !(state.driver_acknowledged_at === null || typeof state.driver_acknowledged_at === "string") ||
      (state.driver_acknowledged_at && !state.passenger_declared_at)) {
    throw new Error("As declarações desta corrida estão inconsistentes.");
  }
  if (state.driver_acknowledged_at) return "received";
  return state.passenger_declared_at ? "declared" : "pending";
}

// Declarations are append-only. A poll started before a successful write can arrive afterwards.
function latestDeclaration(previous: Declaration | null, next: Declaration): Declaration {
  if (previous === "received" || next === "received") return "received";
  if (previous === "declared" || next === "declared") return "declared";
  return "pending";
}

export function QuickRidePayment({ rideId, driver = false, onPixReady }: {
  rideId: string; driver?: boolean; onPixReady?: (ready: boolean) => void;
}) {
  const [charge, setCharge] = useState<Charge | null>(null);
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [loadError, setLoadError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const ready = Boolean(charge?.payload);
  useEffect(() => { onPixReady?.(ready); }, [onPixReady, ready]);

  useEffect(() => {
    let active = true;
    let timer: number;
    let deadline: number;
    let controller: AbortController;
    async function load() {
      let nextDelay = 5000;
      controller = new AbortController();
      const signal = controller.signal;
      deadline = window.setTimeout(() => controller.abort(), 15000);
      const statusRead = readDeclaration(rideId, signal).then(state => {
        if (!active) return;
        setDeclaration(previous => latestDeclaration(previous, state));
        setStatusError("");
      }).catch(() => {
        if (active) setStatusError("Não foi possível atualizar a situação do pagamento.");
      });
      try {
        const contract = await supabase.rpc("get_completed_quick_ride_pix", { p_ride_id: rideId }).abortSignal(signal);
        if (!active) return;
        if (contract.error) throw new Error(
          "Não foi possível consultar a cobrança. Confira se a corrida foi concluída e tente novamente.",
        );
        const verified = readCharge(contract.data, rideId);
        setCharge(verified);
        setLoadError("");
        if (!driver && verified.payload) nextDelay = 15000;
      } catch (cause) {
        if (!active) return;
        setCharge(null);
        setLoadError(cause instanceof Error ? cause.message : "Cobrança Pix indisponível.");
      }
      await statusRead;
      window.clearTimeout(deadline);
      if (!active) return;
      // Schedule after the response so a slow mobile connection cannot starve the checkout.
      timer = window.setTimeout(() => { if (!document.hidden && navigator.onLine) void load(); }, nextDelay);
    }
    const onResume = () => { if (!document.hidden && navigator.onLine) refresh(); };
    void load();
    window.addEventListener("online", onResume);
    window.addEventListener("caronaa:app-refresh", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      active = false;
      controller?.abort();
      window.clearTimeout(deadline);
      window.clearTimeout(timer);
      window.removeEventListener("online", onResume);
      window.removeEventListener("caronaa:app-refresh", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [rideId, driver, revision, refresh]);

  async function confirm() {
    if (busy || !ready || declaration !== (driver ? "declared" : "pending")) return;
    if (driver && !window.confirm("Você conferiu no extrato o recebimento do Pix desta corrida?")) return;
    setBusy(true);
    setActionError("");
    const expected = driver ? "received" : "declared";
    try {
      let saved = false;
      try {
        const result = await supabase.rpc(driver ? "quick_ride_acknowledge_manual_pix" : "quick_ride_declare_manual_pix",
          { p_id: rideId });
        saved = !result.error && result.data === true;
      } catch { /* The response can be lost after the transaction commits. */ }
      const state = saved ? expected : await readDeclaration(rideId);
      setDeclaration(previous => latestDeclaration(previous, state));
      if (state !== expected && state !== "received") throw new Error();
    } catch {
      setActionError("Não foi possível confirmar a declaração. Confira o extrato e atualize o status.");
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const canConfirm = ready && declaration === (driver ? "declared" : "pending");
  const code = charge?.payload ? <PixPaymentCode payload={charge.payload} pixKey={charge.key}
    alt="QR Code Pix com o valor contratado da corrida" /> : null;
  return <section aria-label={driver ? "Liquidação Pix do motorista" : "QR Pix da Corrida Rápida concluída"}
    className="min-w-0 space-y-3 rounded-xl border border-[#FFBB00]/40 bg-[#121212] p-3 text-sm text-white">
    <h4 className="font-bold">{driver ? "Cobrança ao passageiro" : "Pix direto ao motorista"}</h4>
    {!charge && !loadError && <p role="status">Consultando a cobrança…</p>}
    {charge && <>
      <div><p className="text-xs text-white/75">Valor total da corrida</p>
        <p className="text-3xl font-black text-[#FFBB00]">{formatBrl(charge.amountCents / 100)}</p></div>
      {charge.pilotOnly && <p role="note">Homologação · use o código somente para teste.</p>}
      {!charge.payload && <p role="status">{charge.key
        ? "A chave Pix cadastrada precisa ser corrigida pelo motorista."
        : "Aguardando o cadastro da chave Pix do motorista."}</p>}
      {driver && !charge.payload && <PixKeyForm key={charge.key} initialKey={charge.key} onSaved={refresh} />}
      {declaration === "pending" && code}
      {declaration !== "pending" && code &&
        <details><summary className="cursor-pointer py-1">Consultar código Pix da corrida</summary>{code}</details>}
      {ready && <p className="break-all text-xs">Chave do motorista: {charge.key}</p>}
    </>}
    {declaration === "declared" && <p role="status">{driver
      ? "O passageiro declarou o Pix. Confira o crédito no extrato."
      : "Você já declarou o Pix. Aguardando a confirmação do motorista."}</p>}
    {declaration === "received" && <p role="status">Passageiro e motorista já registraram suas confirmações.</p>}
    {canConfirm &&
      <Button type="button" variant="outline" disabled={busy} className="min-h-11 w-full"
        onClick={() => void confirm()}>{busy ? "Registrando…" : driver ? "Recebi o Pix no banco" : "Já fiz o Pix"}</Button>}
    {loadError && <p role="alert">{loadError}</p>}
    {statusError && <p role="alert">{statusError} Confira o extrato antes de transferir.</p>}
    {canConfirm && actionError && <p role="alert">{actionError}</p>}
    {(loadError || statusError || (canConfirm && actionError)) && <Button type="button" variant="outline" onClick={refresh}>Atualizar cobrança</Button>}
    <p className="text-xs text-white/70">O pagamento é feito no aplicativo do banco. O CARONAA registra as declarações das duas partes.</p>
  </section>;
}
