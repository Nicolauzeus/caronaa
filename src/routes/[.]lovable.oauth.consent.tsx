import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import logoAsset from "@/assets/brand/caronaa-logo.png.asset.json";

type Authorization = {
  client?: { name?: string; client_name?: string };
  redirect_uri?: string;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: Authorization | null; error: { message: string } | null };
const oauth = supabase.auth.oauth as unknown as {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "" }),
  head: () => ({ meta: [
    { title: "Conectar agente — CARONAA" },
    { name: "description", content: "Revise e autorize o acesso de um agente à sua conta CARONAA." },
    { property: "og:title", content: "Conectar agente — CARONAA" },
    { property: "og:description", content: "Autorize uma conexão segura com sua conta CARONAA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Este pedido de conexão é inválido. Inicie novamente no agente.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("Não foi possível verificar sua conta. Tente novamente.");
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: location.pathname + location.searchStr + location.hash } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("Pedido de conexão ausente.");
    const { data, error } = await oauth.getAuthorizationDetails(id);
    if (error) throw new Error("Este pedido expirou ou não pôde ser carregado. Inicie a conexão novamente no agente.");
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    if (!data?.client) throw new Error("Pedido de conexão inválido.");
    return data;
  },
  pendingComponent: () => <main className="p-8 text-center text-foreground" role="status">Carregando pedido de conexão...</main>,
  errorComponent: ({ error }) => <main className="mx-auto max-w-lg space-y-4 px-6 py-16 text-foreground"><h1 className="font-display text-2xl">Não foi possível conectar</h1><p role="alert">{error instanceof Error ? error.message : "Não foi possível carregar este pedido de conexão."}</p><Button asChild variant="outline"><Link to="/">Voltar para CARONAA</Link></Button></main>,
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = details.client?.name ?? details.client?.client_name ?? "este agente";
  const scopes = details.scopes ?? (details.scope ?? "").split(" ").filter(Boolean);

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await (approve ? oauth.approveAuthorization(authorization_id) : oauth.denyAuthorization(authorization_id));
      if (result.error) throw new Error("Não foi possível salvar sua decisão. Tente novamente.");
      const target = result.data?.redirect_url ?? result.data?.redirect_to;
      if (!target) throw new Error("O agente não informou o retorno da conexão. Inicie novamente.");
      window.location.assign(target);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir sua decisão.");
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-lg space-y-6 px-6 py-12 text-foreground">
    <img src={logoAsset.url} alt="CARONAA" className="h-12 w-auto" />
    <h1 className="font-display text-2xl font-bold">Conectar {name} à CARONAA</h1>
    <p className="break-all text-sm text-muted-foreground">Conta: {user?.email}</p>
    <Button variant="outline" disabled={busy} onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>Trocar conta</Button>
    {details.redirect_uri && <p className="break-all text-sm text-muted-foreground">Destino do agente: {details.redirect_uri}</p>}
    <p>Esta conexão permite consultar seus pedidos e ofertas de carona.</p>
    {scopes.length > 0 && <ul className="list-disc space-y-2 pl-5 text-sm">{scopes.map(scope => <li key={scope}>{scope === "openid" || scope === "profile" ? "Compartilhar seu perfil básico" : scope === "email" ? "Compartilhar seu endereço de e-mail" : `Permissão adicional solicitada: ${scope}`}</li>)}</ul>}
    <p className="text-sm text-muted-foreground">As permissões da sua conta continuam valendo. O agente não pode publicar, cancelar ou pagar caronas.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void decide(true)}>{busy ? "Aguarde..." : "Permitir conexão"}</Button><Button variant="outline" disabled={busy} onClick={() => void decide(false)}>Cancelar conexão</Button></div>
  </main>;
}