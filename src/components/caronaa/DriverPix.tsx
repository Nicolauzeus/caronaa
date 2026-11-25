import { useEffect, useState } from "react";
import { PixPaymentCode } from "./PixPaymentCode";
import { PixKeyForm } from "./PixKeyForm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildPixPayload, normalizePixKey } from "@/lib/pix";
import { Link } from "@tanstack/react-router";
import { DriverPlatformFees } from "@/components/caronaa/DriverPlatformFees";

export function DriverPixSettings() {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: failure } = await supabase.rpc("get_my_pix_key");
        if (failure) throw failure;
        if (active) { setKey(data ?? ""); setError(false); }
      } catch { if (active) setError(true); }
    })();
    return () => { active = false; };
  }, [revision]);
  return <section id="pix-do-motorista" className="mb-6 border-b border-border pb-6" aria-label="Pix do motorista">
    <h2 className="mb-3 text-lg font-semibold">Pix do motorista</h2>
    {key !== null && <PixKeyForm initialKey={key} onSaved={setKey} />}
    {key === null && !error && <p role="status">Consultando sua chave Pix…</p>}
    {error && <><p role="alert">Não foi possível consultar sua chave Pix.</p>
      <Button type="button" variant="outline" onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button></>}
  </section>;
}

type RidePix = {
  key: string | null;
  name: string | null;
  amount: number;
  passengerCount: number;
  pricePerPassenger: number;
  paymentMethod: "MANUAL_DRIVER_PIX";
  automaticConfirmation: false;
};

export function CompletedRidePix({ rideId, role }: { rideId: string; role: "driver" | "passenger" }) {
  return <SharedRidePayment key={rideId + role} rideId={rideId} role={role} />;
}

type PaymentStatus = { passengerConfirmed: boolean; driverConfirmed: boolean; bothConfirmed: boolean };

async function readStatus(rideId: string): Promise<PaymentStatus> {
  const { data, error } = await supabase.rpc("get_manual_ride_payment_status", { p_ride_id: rideId });
  if (error || !data || typeof data !== "object" || Array.isArray(data) ||
      data.paymentMethod !== "MANUAL_DRIVER_PIX" || data.autoBankVerified !== false ||
      typeof data.passengerConfirmed !== "boolean" || typeof data.driverConfirmed !== "boolean" ||
      typeof data.bothConfirmed !== "boolean") throw new Error("Situação do Pix indisponível.");
  return { passengerConfirmed: data.passengerConfirmed, driverConfirmed: data.driverConfirmed, bothConfirmed: data.bothConfirmed };
}

function SharedRidePayment({ rideId, role }: { rideId: string; role: "driver" | "passenger" }) {
  const [charge, setCharge] = useState<{ data: RidePix; payload: string | null } | null>(null);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision(v => v + 1);

  async function confirmPayment() {
    if (confirming || !charge?.payload) return;
    setConfirming(true);
    try {
      const { error: failure } = await supabase.rpc("confirm_manual_ride_payment", { p_ride_id: rideId });
      if (failure) throw failure;
      toast.success(role === "passenger" ? "Transferência declarada." : "Recebimento declarado.");
    } catch { setStatusError("Confira se sua declaração foi registrada."); }
    finally { retry(); setConfirming(false); }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: result, error: failure } = await supabase.rpc("get_ride_pix", { p_ride_id: rideId });
        if (failure) throw new Error("Não foi possível consultar a cobrança desta reserva.");
        const pix = result as unknown as RidePix;
        const unit = Number(pix?.pricePerPassenger);
        const amount = Number(pix?.amount);
        const count = Number(pix?.passengerCount);
        if (!pix || pix.paymentMethod !== "MANUAL_DRIVER_PIX" || pix.automaticConfirmation !== false ||
            !Number.isInteger(count) || count < 1 || count > 6 || !Number.isFinite(unit) || unit <= 0 ||
            !Number.isFinite(amount) || amount <= 0 || Math.abs(unit * 100 - Math.round(unit * 100)) > 1e-6 ||
            Math.round(unit * 100) * count !== Math.round(amount * 100)) {
          throw new Error("O valor desta reserva precisa de revisão.");
        }
        const key = pix.key ? normalizePixKey(pix.key) : null;
        const payload = key ? buildPixPayload(key, pix.name || "Motorista", amount) : null;
        if (active) { setCharge({ data: { ...pix, key }, payload }); setError(""); }
      } catch (cause) {
        if (active) { setCharge(null); setError(cause instanceof Error ? cause.message : "Cobrança Pix indisponível."); }
      }
    })();
    void readStatus(rideId).then(status => {
      if (active) { setPaymentStatus(status); setStatusError(""); }
    }).catch(() => { if (active) setStatusError("Não foi possível atualizar as confirmações do Pix."); });
    const resume = () => { if (!document.hidden && navigator.onLine) retry(); };
    window.addEventListener("online", resume);
    window.addEventListener("caronaa:app-refresh", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.removeEventListener("online", resume);
      window.removeEventListener("caronaa:app-refresh", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [rideId, revision]);

  if (error) return <div><p role="alert" className="text-sm text-destructive">{error}</p>
    {role === "driver" && <Link to="/perfil" hash="pix-do-motorista" className="underline">Revisar minha chave</Link>}
    <Button type="button" variant="outline" onClick={retry}>Atualizar cobrança</Button></div>;
  if (!charge) return <p role="status" className="text-sm text-muted-foreground">Carregando Pix…</p>;
  const { data, payload } = charge;
  if (!data.key) return (
    <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
      O motorista ainda não cadastrou uma chave Pix.{" "}
      {role === "driver" ? (
        <Link className="font-semibold text-primary underline" to="/perfil" hash="pix-do-motorista">Cadastrar minha chave</Link>
      ) : "Peça ao motorista que cadastre uma chave antes de transferir."}
      <button type="button" className="ml-2 underline" onClick={retry}>Atualizar cobrança</button>
    </p>
  );
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-foreground"
      aria-label="Pix direto para o motorista">
      <h4 className="text-center text-base font-bold">Pix direto para o motorista</h4>
      <p className="text-center text-sm font-semibold">
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(data.amount))}
        {" "}· {data.passengerCount} {data.passengerCount === 1 ? "passageiro deste pedido" : "passageiros deste pedido"}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(data.pricePerPassenger))}
        {" "}por passageiro solicitado. Vagas livres do motorista não entram neste valor.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Transferência manual para a conta do motorista. O aplicativo não verifica recebimento,
        não cobra nem divide valores automaticamente. Após a confirmação bilateral, o motorista deve
        repassar à plataforma a comissão registrada para esta viagem. Confirme os dados no aplicativo bancário.
      </p>
      {payload && (!paymentStatus || paymentStatus.passengerConfirmed || paymentStatus.driverConfirmed
        ? <details className="w-full"><summary className="cursor-pointer py-1">Consultar código Pix da reserva</summary>
            <PixPaymentCode payload={payload} pixKey={data.key} alt="QR Code Pix da carona compartilhada" /></details>
        : <PixPaymentCode payload={payload} pixKey={data.key} alt="QR Code Pix da carona compartilhada" />)}
      <p className="max-w-full break-all text-center font-mono text-sm">{data.key}</p>
      {statusError && <div><p role="alert">{statusError}</p>
        <Button type="button" variant="outline" onClick={retry}>Atualizar confirmações</Button></div>}
      <div className="w-full space-y-3 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-sm font-semibold">Confirmação rápida do Pix</p>
        <p className="text-xs text-muted-foreground">
          {paymentStatus?.bothConfirmed
            ? "Ambos declararam o pagamento. Isto não é confirmação bancária automática."
            : "Passageiro: declaro que transferi. Motorista: confirme somente após conferir o recebimento no banco."}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={paymentStatus?.passengerConfirmed ? "font-bold text-foreground" : "text-muted-foreground"}>
            Passageiro: {paymentStatus?.passengerConfirmed ? "confirmou" : "pendente"}
          </span>
          <span className={paymentStatus?.driverConfirmed ? "font-bold text-foreground" : "text-muted-foreground"}>
            Motorista: {paymentStatus?.driverConfirmed ? "confirmou" : "pendente"}
          </span>
        </div>
        {!paymentStatus?.[role === "passenger" ? "passengerConfirmed" : "driverConfirmed"] && (
          <Button type="button" className="w-full" disabled={confirming || !paymentStatus}
            onClick={() => void confirmPayment()}>
            {confirming ? "Confirmando…" : role === "passenger" ? "Já fiz o Pix" : "Recebi o Pix no banco"}
          </Button>
        )}
        {paymentStatus?.bothConfirmed && role === "driver" && (
          <p role="status" className="text-sm font-medium">
            O CARONAA registrou o pagamento declarado pelas duas partes. O repasse da comissão
            desta viagem é sua responsabilidade; consulte o saldo detalhado no painel abaixo.
          </p>
        )}
      </div>
      {role === "driver" && paymentStatus?.bothConfirmed && <DriverPlatformFees compact />}
    </section>
  );
}
