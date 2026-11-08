import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildPixPayload } from "@/lib/pix";

type Due = {
  source: "SHARED" | "QUICK";
  rideId: string;
  grossCents: number;
  feeCents: number;
  commissionBps: number;
  status: "OPEN" | "CLAIMED" | "SETTLED";
  statementId: string | null;
  createdAt: string;
};
type Statement = {
  id: string;
  status: "OPEN" | "CLAIMED" | "SETTLED";
  totalCents: number;
  itemCount: number;
  pixKey: string;
  txid: string;
  claimReference: string | null;
  createdAt: string;
  verifiedAt: string | null;
};
type Ledger = {
  driverAllowed: boolean;
  pendingTrips: number;
  limit: number;
  totalOutstandingCents: number;
  readyToInvoiceCents: number;
  platformPixConfigured: boolean;
  dues: Due[];
  statements: Statement[];
};
type LegacyDue = {
  rideId: string;
  grossAmount: number;
  feeAmount: number;
  status: "OPEN" | "CLAIMED" | "SETTLED";
  createdAt: string;
};
type LegacyFees = {
  driverAllowed: boolean;
  pendingTrips: number;
  limit: number;
  amountOutstanding: number;
  platformPixKey: string | null;
  dues: LegacyDue[];
};
const brlCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl = (value: number) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Driver-facing ledger for both ride models.
 * Every Pix statement amount comes from a locked DB snapshot; the browser
 * never calculates how many obligations to charge or who receives the money.
 */
export function DriverPlatformFees({ compact = false }: { compact?: boolean }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [legacy, setLegacy] = useState<LegacyFees | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reference, setReference] = useState<Record<string, string>>({});
  const [selectedStatement, setSelectedStatement] = useState<string | null>(null);
  const [pix, setPix] = useState<{ image: string; payload: string } | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: failure } = await (supabase as any).rpc("get_my_caronaa_commission_ledger");
    if (!failure) {
      setLedger(data as Ledger);
      setLegacy(null);
      setError("");
      return;
    }
    // A code deploy can arrive before the DB migration. Keep the existing
    // manual shared-ride repayment workflow available in that interval.
    const { data: oldData, error: oldFailure } = await (supabase as any).rpc("get_my_driver_platform_fees");
    if (oldFailure) throw new Error("Não foi possível consultar as comissões. Verifique a configuração financeira.");
    setLegacy(oldData as LegacyFees);
    setLedger(null);
    setError("");
  }, []);

  useEffect(() => {
    let alive = true;
    void refresh().catch(e => {
      if (alive) setError(e instanceof Error ? e.message : "Saldo indisponível.");
    });
    return () => { alive = false; };
  }, [refresh]);

  const statement = useMemo(
    () => ledger?.statements.find(item => item.id === selectedStatement) ?? null,
    [ledger, selectedStatement],
  );

  useEffect(() => {
    let live = true;
    setPix(null);
    if (statement?.status === "SETTLED" || !statement) return;
    try {
      const code = buildPixPayload(
        statement.pixKey, "CARONAA", statement.totalCents / 100, statement.txid,
      );
      void QRCode.toDataURL(code, { width: 240, margin: 2 })
        .then(image => { if (live) setPix({ image, payload: code }); })
        .catch(() => { if (live) setError("Falha ao gerar a imagem do Pix. Confira o identificador do fechamento."); });
    } catch {
      setError("Dados do fechamento Pix inválidos. Solicite revisão financeira.");
    }
    return () => { live = false; };
  }, [statement?.id, statement?.status, statement?.totalCents, statement?.pixKey, statement?.txid]);

  async function issue(source?: Due["source"], rideId?: string) {
    if (busy) return;
    setBusy(rideId ?? "ALL");
    setError("");
    try {
      const { data, error: failure } = await (supabase as any).rpc(
        "create_my_caronaa_fee_statement",
        { p_source: source ?? null, p_ride_id: rideId ?? null },
      );
      if (failure || typeof data !== "string") throw new Error(failure?.message || "Não foi possível gerar o fechamento Pix.");
      await refresh();
      setSelectedStatement(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar o Pix.");
    } finally { setBusy(""); }
  }

  async function claim(statementId: string) {
    if (busy) return;
    setBusy(statementId);
    setError("");
    try {
      const { error: failure } = await (supabase as any).rpc(
        "claim_my_caronaa_fee_statement",
        { p_statement_id: statementId, p_reference: (reference[statementId] || "").trim() },
      );
      if (failure) throw new Error(failure.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a declaração.");
    } finally { setBusy(""); }
  }

  async function legacyClaim(rideId: string) {
    if (busy) return;
    setBusy(rideId);
    setError("");
    const { error: failure } = await (supabase as any).rpc("claim_driver_platform_fee", {
      p_ride_id: rideId,
      p_reference: (reference[rideId] || "").trim(),
    });
    if (failure) setError(failure.message);
    else await refresh().catch(e => setError(String(e)));
    setBusy("");
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); }
    catch { setError("Não foi possível copiar. Use o código exibido."); }
  }

  return (
    <section id="comissoes-caronaa" aria-label="Repasses do motorista à plataforma"
      className="min-w-0 max-w-full space-y-3 overflow-x-hidden rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Minhas comissões CARONAA</h3>
        <Button type="button" variant="outline" size="sm" disabled={Boolean(busy)}
          onClick={() => void refresh().catch(e => setError(String(e)))}>Atualizar</Button>
      </div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      {!ledger && !legacy && <p role="status" className="text-sm text-muted-foreground">Carregando situação financeira…</p>}

      {legacy && (
        <div className="space-y-3">
          <p role="status" className="rounded-lg border border-amber-500/30 p-3 text-sm">
            O novo fechamento por QR ainda aguarda a migration 0140. Comissões antigas continuam acessíveis.
          </p>
          <p className="font-bold">{brl(legacy.amountOutstanding)} em aberto · {legacy.pendingTrips} viagens</p>
          {legacy.platformPixKey && <p className="break-all font-mono text-xs">Chave Pix oficial: {legacy.platformPixKey}</p>}
          {legacy.dues.map(due => (
            <div key={due.rideId} className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-semibold">{brl(due.feeAmount)} · Viagem {due.rideId.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">
                {due.status === "SETTLED" ? "Quitada" : due.status === "CLAIMED" ? "Aguardando conferência" : "Em aberto"}
              </p>
              {due.status === "OPEN" && (
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Input className="min-w-0 flex-1 basis-40" value={reference[due.rideId] || ""}
                    maxLength={180} aria-label={"Identificador do Pix " + due.rideId}
                    placeholder="Identificador do Pix"
                    onChange={e => setReference(r => ({ ...r, [due.rideId]: e.target.value }))} />
                  <Button type="button" disabled={Boolean(busy) || !legacy.platformPixKey ||
                    (reference[due.rideId] || "").trim().length < 6}
                    onClick={() => void legacyClaim(due.rideId)}>Enviei o Pix</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ledger && (
        <>
          <div role="status" className={"rounded-xl border p-3 " +
            (ledger.driverAllowed ? "border-border bg-muted/40" : "border-destructive/50 bg-destructive/5")}>
            <p className="text-xs text-muted-foreground">Saldo de comissões não quitadas</p>
            <p className="text-2xl font-extrabold tabular-nums">{brlCents(ledger.totalOutstandingCents)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ledger.pendingTrips} {ledger.pendingTrips === 1 ? "viagem pendente" : "viagens pendentes"} ·
              {ledger.driverAllowed ? " disponível para novas caronas." : " novas ofertas bloqueadas até a quitação verificada."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {brlCents(ledger.readyToInvoiceCents)} ainda sem fechamento Pix.
              Comissões em conferência continuam no saldo até a validação bancária.
            </p>
          </div>
          {!ledger.platformPixConfigured && ledger.readyToInvoiceCents > 0 && (
            <p role="alert" className="rounded-xl border border-amber-500/30 p-3 text-sm">
              A administração ainda não configurou a chave Pix oficial da plataforma.
              Não envie comissões para chaves não verificadas.
            </p>
          )}
          {ledger.platformPixConfigured && ledger.readyToInvoiceCents > 0 && (
            <Button type="button" className="w-full" disabled={Boolean(busy)}
              onClick={() => void issue()}>
              Gerar QR Pix das comissões disponíveis
            </Button>
          )}
          <div className="space-y-2">
            <h4 className="text-sm font-bold">Comissão de cada viagem</h4>
            {ledger.dues.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma comissão registrada.</p>}
            {ledger.dues.map(due => (
              <article key={due.source + due.rideId} className="min-w-0 space-y-1 rounded-lg border p-3 text-sm">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">
                    {brlCents(due.feeCents)} · {due.source === "QUICK" ? "Corrida Rápida" : "Carona Compartilhada"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {due.status === "SETTLED" ? "Quitada" :
                      due.statementId ? "Em fechamento Pix" :
                      due.status === "CLAIMED" ? "Aguardando conferência" : "Em aberto"}
                  </span>
                </div>
                <p className="break-words text-xs text-muted-foreground">
                  Corrida {due.rideId.slice(0, 8)} · Total {brlCents(due.grossCents)} ·
                  Comissão {(due.commissionBps / 100).toLocaleString("pt-BR")}% ·
                  {new Date(due.createdAt).toLocaleDateString("pt-BR")}
                </p>
                {due.status === "OPEN" && !due.statementId && ledger.platformPixConfigured && (
                  <Button type="button" variant="outline" size="sm" disabled={Boolean(busy)}
                    onClick={() => void issue(due.source, due.rideId)}>
                    Gerar QR desta viagem
                  </Button>
                )}
              </article>
            ))}
          </div>
          <div className="space-y-2">
            <h4 className="font-bold">Fechamentos Pix</h4>
            {ledger.statements.map(item => (
              <article key={item.id} className="min-w-0 space-y-2 rounded-lg border p-3">
                <div className="flex min-w-0 flex-wrap justify-between gap-2">
                  <span className="font-bold">{brlCents(item.totalCents)} · {item.itemCount} {item.itemCount === 1 ? "viagem" : "viagens"}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.status === "SETTLED" ? "Quitado" :
                      item.status === "CLAIMED" ? "Conferência bancária pendente" : "Pix disponível"}
                  </span>
                </div>
                <p className="break-all text-xs text-muted-foreground">Fechamento {item.id.slice(0, 8)} · Identificador {item.txid}</p>
                {item.status !== "SETTLED" && (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setSelectedStatement(selectedStatement === item.id ? null : item.id)}>
                    {selectedStatement === item.id ? "Ocultar QR Pix" : "Mostrar QR Pix"}
                  </Button>
                )}
                {selectedStatement === item.id && item.status !== "SETTLED" && (
                  <div className="min-w-0 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-sm font-bold">
                      Pix CARONAA · Valor fixo {brlCents(item.totalCents)}
                    </p>
                    {pix ? (
                      <>
                        <img src={pix.image} alt={"QR Pix CARONAA de " + brlCents(item.totalCents)}
                          width={240} height={240} className="mx-auto max-w-full rounded-lg bg-white p-2"/>
                        <Button type="button" className="w-full" onClick={() => void copy(pix.payload)}>
                          Copiar Pix copia e cola
                        </Button>
                      </>
                    ) : <p role="status" className="text-sm">Preparando código Pix…</p>}
                    <p className="break-all font-mono text-xs">{item.pixKey}</p>
                    <p className="text-xs text-muted-foreground">
                      Confira no banco a chave de destino, o nome CARONAA e o valor exato.
                      O QR preenche o valor, mas NÃO comprova recebimento automático.
                    </p>
                    {item.status === "OPEN" && (
                      <div className="space-y-2">
                        <Input value={reference[item.id] || ""} maxLength={180}
                          aria-label={"Identificador bancário do fechamento " + item.id}
                          placeholder="Identificador bancário do Pix (EndToEndId)"
                          onChange={e => setReference(r => ({ ...r, [item.id]: e.target.value }))} />
                        <Button type="button" variant="outline" className="w-full"
                          disabled={Boolean(busy) || (reference[item.id] || "").trim().length < 10}
                          onClick={() => void claim(item.id)}>Já paguei · solicitar conferência</Button>
                      </div>
                    )}
                    {item.status === "CLAIMED" && (
                      <p role="status" className="text-xs">
                        Pagamento declarado, aguardando conferência no extrato da plataforma.
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
            {ledger.statements.length === 0 &&
              <p className="text-sm text-muted-foreground">Nenhum fechamento emitido.</p>}
          </div>
          {!compact && (
            <p className="text-xs text-muted-foreground">
              Débito e quitação são registrados por viagem. Declarar um Pix não baixa a comissão;
              somente a validação financeira libera o saldo.{" "}
              <Link to="/minhas-caronas" className="font-semibold underline">Minhas viagens</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
