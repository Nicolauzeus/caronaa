import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, RefreshCw, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  checkAsaasConnection, type AsaasConnectionResult,
} from "@/lib/payments/asaas-connection.functions";

export function AsaasConnectionPanel() {
  const check = useServerFn(checkAsaasConnection);
  const [state, setState] = useState<AsaasConnectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function verify() {
    setBusy(true);
    setError("");
    try {
      setState(await check());
    } catch {
      setError("Não foi possível consultar a configuração Asaas. Confirme suas permissões administrativas.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Conexão Asaas" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-primary" />
        <h2 className="text-lg font-bold">Integração Asaas</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Verificação apenas de leitura. Não cria cobranças, não transfere dinheiro e não exibe a chave API.
        Cadastre a credencial em um gerenciador seguro de segredos do backend antes de verificar.
      </p>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void verify()}>
        <RefreshCw size={15} className={busy ? "mr-2 animate-spin" : "mr-2"} />
        {busy ? "Verificando conexão…" : "Verificar minha conta Asaas"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {state && (
        <div role="status" className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-primary" />
            <strong>Ambiente: {state.environment === "production" ? "Produção"
              : state.environment === "sandbox" ? "Sandbox" : "Não configurado"}</strong>
          </div>
          <p>Chave API: {state.apiKeyConfigured ? "configurada no servidor" : "não configurada"}</p>
          <p>Token de webhook: {state.webhookTokenConfigured ? "configurado" : "não configurado"}</p>
          <p>Situação da conta: {state.accountStatus === "APPROVED" ? "Aprovada"
            : state.accountStatus === "NOT_APPROVED" ? "Exige verificação"
            : state.accountStatus === "UNAVAILABLE" ? "Não foi possível validar"
            : "Não consultada"}</p>
          <p>{state.message}</p>
          <p className="text-xs text-muted-foreground">
            Cobranças automáticas: {state.chargesEnabled ? "configuradas como ativas (rever antes de operar)" : "desativadas"}.
            O checkout Asaas do CARONAA ainda não foi homologado para produção.
          </p>
        </div>
      )}
    </section>
  );
}
