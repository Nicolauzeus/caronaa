import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, RefreshCw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/caronaa/AppShell";
import { Button } from "@/components/ui/button";
import {
  loadAvailableResearchForms,
  type AvailableResearchForm,
} from "@/lib/formulario/public-research-directory";

type LoadState = "loading" | "ready" | "error";

export function PublicResearchDirectory() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<LoadState>("loading");
  const [forms, setForms] = useState<AvailableResearchForm[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    void loadAvailableResearchForms()
      .then((available) => {
        if (!mounted) return;
        setForms(available);
        setSelectedCode("");
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });
    return () => { mounted = false; };
  }, [retry]);

  useEffect(() => {
    if (status !== "ready" || forms.length !== 1) return;
    void navigate({
      to: "/formulario/$code",
      params: { code: forms[0].code },
      replace: true,
    });
  }, [status, forms, navigate]);

  const oneForm = status === "ready" && forms.length === 1;
  const manyForms = status === "ready" && forms.length > 1;
  const noForms = status === "ready" && forms.length === 0;

  return (
    <AppShell publicPage>
      <main className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <section aria-labelledby="public-research-title" className="w-full max-w-xl min-w-0">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-black/5 sm:p-8">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <ClipboardList aria-hidden="true" size={25} />
            </div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[.14em] text-primary">
              Pesquisas CARONAA
            </p>
            <h1 id="public-research-title" className="font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              Sua opinião ajuda a construir novos caminhos.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Participe de uma pesquisa de mobilidade. Você pode responder sem criar uma conta.
            </p>

            {status === "loading" && (
              <div role="status" aria-live="polite" className="mt-7 flex min-h-20 items-center gap-3 rounded-xl border bg-muted/30 px-4 text-sm text-muted-foreground">
                <RefreshCw aria-hidden="true" size={18} className="animate-spin" />
                Buscando formulários disponíveis…
              </div>
            )}

            {oneForm && (
              <div role="status" aria-live="polite" className="mt-7 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <p className="text-sm font-semibold">Abrindo a pesquisa disponível…</p>
                <p className="text-sm text-muted-foreground">{forms[0].title}</p>
                <Link to="/formulario/$code" params={{ code: forms[0].code }}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary underline underline-offset-4">
                  Abrir formulário <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            )}

            {manyForms && (
              <form className="mt-7 space-y-4" onSubmit={(event) => {
                event.preventDefault();
                if (!forms.some(form => form.code === selectedCode)) return;
                void navigate({ to: "/formulario/$code", params: { code: selectedCode } });
              }}>
                <div>
                  <label htmlFor="public-research-select" className="mb-2 block text-sm font-semibold">
                    Selecione a pesquisa que deseja responder
                  </label>
                  <select
                    id="public-research-select"
                    value={selectedCode}
                    onChange={(event) => setSelectedCode(event.target.value)}
                    className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">Escolher formulário…</option>
                    {forms.map((form) => (
                      <option key={form.id} value={form.code}>
                        {form.title}{form.municipality ? " — " + form.municipality : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {forms.length} pesquisas disponíveis para você.
                  </p>
                </div>
                <Button type="submit" variant="strong" className="min-h-12 w-full rounded-xl font-bold" disabled={!selectedCode}>
                  Preencher formulário <ArrowRight aria-hidden="true" size={18} />
                </Button>
              </form>
            )}

            {noForms && (
              <div role="status" className="mt-7 rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold">Nenhuma pesquisa disponível no momento.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Quando uma pesquisa for publicada e habilitada, ela aparecerá aqui automaticamente.
                </p>
              </div>
            )}

            {status === "error" && (
              <div role="alert" className="mt-7 space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                <p className="font-semibold">Não foi possível carregar as pesquisas.</p>
                <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => {
                  setStatus("loading");
                  setRetry(value => value + 1);
                }}>
                  <RefreshCw aria-hidden="true" size={17} /> Tentar novamente
                </Button>
              </div>
            )}

            <div className="mt-7 flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
              <ShieldCheck aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-primary" />
              Somente pesquisas publicadas e permitidas para o visitante são exibidas. Responder não cria uma corrida ou reserva.
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link to="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Voltar ao início do CARONAA
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
