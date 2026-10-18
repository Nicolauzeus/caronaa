import { useEffect, useRef, useState } from "react";
import {
  archiveResearchForm,
  getResearchFormRemovalEligibility,
  permanentlyDeleteTrashedResearchForm,
  removeTrashedResearchBrandAssets,
  restoreTrashedResearchForm,
  trashResearchForm,
  type ResearchForm,
  type ResearchRemovalEligibility,
} from "@/lib/formulario/research-catalog";

const DELETE_PHRASE = "EXCLUIR DEFINITIVAMENTE";

/** Re-check all dependencies inside the database when executing a destructive action. */
export function ResearchFormRemovalDialog({
  form,
  onClose,
  onCompleted,
}: {
  form: ResearchForm;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [audit, setAudit] = useState<ResearchRemovalEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [phrase, setPhrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await getResearchFormRemovalEligibility(form.id);
      setAudit(result);
    } catch (caught) {
      setAudit(null);
      setError(caught instanceof Error ? caught.message : "Falha ao verificar vínculos.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setAudit(null);
    setError("");
    void getResearchFormRemovalEligibility(form.id)
      .then((result) => { if (active) setAudit(result); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Falha ao verificar vínculos."); })
      .finally(() => { if (active) setLoading(false); });
    closeRef.current?.focus();
    return () => { active = false; };
  }, [form.id]);

  async function act(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
      onCompleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
      setBusy(false);
      // Re-fetch after an aborted/stale destructive operation.
      void refresh();
    }
  }

  const blockers = audit ? [
    { name: "Respostas históricas", count: audit.legacy_submissions },
    { name: "Leads vinculados", count: audit.crm_leads },
    { name: "Pilotos vinculados", count: audit.partner_pilots },
    { name: "Selos de participação", count: audit.participation_badges },
    { name: "Arquivos de imagem", count: audit.brand_assets },
  ].filter((item) => item.count > 0) : [];
  const inTrash = audit?.in_trash === true;
  const confirmed = !!audit?.can_delete && code === audit.code &&
    phrase === DELETE_PHRASE && acknowledged;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="removal-title"
        aria-describedby="removal-description"
        className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Gestão de pesquisas</p>
            <h2 id="removal-title" className="text-xl font-bold">
              {inTrash ? "Restaurar ou excluir definitivamente" : "Arquivar ou mover para a lixeira"}
            </h2>
            <p className="mt-1 break-all text-sm font-medium">{form.title} · {form.code}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy}
            className="shrink-0 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary">
            Fechar
          </button>
        </div>
        <p id="removal-description" className="text-sm leading-6 text-muted-foreground">
          {inTrash
            ? "A pesquisa está fora da biblioteca e não recebe novas respostas. Restaurar mantém o link desativado. A exclusão definitiva apaga também as respostas comuns e não pode ser desfeita."
            : "Arquivar preserva a pesquisa na biblioteca. Mover para a lixeira oculta a pesquisa da biblioteca e desativa o link público sem apagar respostas."}
        </p>

        {loading && <p role="status" className="text-sm text-muted-foreground">Verificando relações no banco…</p>}
        {!loading && audit && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div>Respostas: <strong>{audit.answers}</strong></div>
            <div>Históricas: <strong>{audit.legacy_submissions}</strong></div>
            <div>Leads: <strong>{audit.crm_leads}</strong></div>
            <div>Pilotos: <strong>{audit.partner_pilots}</strong></div>
            <div>Selos: <strong>{audit.participation_badges}</strong></div>
            <div>Imagens: <strong>{audit.brand_assets}</strong></div>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

        {!inTrash && audit?.can_trash && (
          <div className="space-y-2">
            {form.status !== "ARQUIVADO" && (
              <button type="button" disabled={busy || loading}
                onClick={() => void act(() => archiveResearchForm(form))}
                className="w-full rounded-xl border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted/50 disabled:opacity-50">
                Arquivar (manter na biblioteca)
              </button>
            )}
            <button type="button" disabled={busy || loading}
              onClick={() => void act(() => trashResearchForm(form))}
              className="w-full rounded-xl border border-primary bg-primary/10 px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/15 disabled:opacity-50">
              Mover para a lixeira
            </button>
            <p className="text-xs text-muted-foreground">As respostas e os vínculos serão preservados. A pesquisa poderá ser restaurada.</p>
          </div>
        )}

        {inTrash && (
          <div className="space-y-4">
            <button type="button" disabled={busy || loading || !audit?.can_restore}
              onClick={() => void act(() => restoreTrashedResearchForm(form))}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Restaurar pesquisa
            </button>
            {blockers.length > 0 && (
              <section className="space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/5 p-3">
                <p className="text-sm font-semibold">Exclusão definitiva bloqueada por vínculos</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Respostas históricas, leads, pilotos e selos precisam ser preservados. Nesses casos, mantenha a pesquisa na lixeira.
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {blockers.map((item) => <li key={item.name}>{item.name}: {item.count}</li>)}
                </ul>
                {audit?.brand_assets > 0 && blockers.every((item) => item.name === "Arquivos de imagem") && (
                  <button type="button" disabled={busy}
                    onClick={() => {
                      if (!window.confirm("Remover permanentemente os arquivos de imagem desta pesquisa? Essa ação não apaga respostas.")) return;
                      setBusy(true);
                      setError("");
                      void removeTrashedResearchBrandAssets(form)
                        .then(() => refresh())
                        .catch((caught) => setError(caught instanceof Error ? caught.message : "Falha na limpeza das imagens."))
                        .finally(() => setBusy(false));
                    }}
                    className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
                    Remover imagens para liberar a exclusão
                  </button>
                )}
              </section>
            )}
            {audit?.can_delete && (
              <section className="space-y-3 rounded-xl border border-destructive/60 p-4">
                <h3 className="font-semibold text-destructive">Exclusão definitiva e irreversível</h3>
                <p className="text-sm leading-6">
                  Você apagará <strong>{audit.answers} resposta(s)</strong>, todas as versões e a pesquisa
                  <strong> {audit.code}</strong>. Recibos não vinculados deixarão de funcionar.
                  Essa operação não poderá ser desfeita pela lixeira.
                </p>
                <label className="block text-sm">
                  Digite o código da pesquisa: <strong className="select-all">{audit.code}</strong>
                  <input autoComplete="off" spellCheck={false} value={code}
                    onChange={(e) => setCode(e.target.value)} placeholder={audit.code}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
                </label>
                <label className="block text-sm">
                  Digite: <strong className="select-all">{DELETE_PHRASE}</strong>
                  <input autoComplete="off" spellCheck={false} value={phrase}
                    onChange={(e) => setPhrase(e.target.value)} placeholder={DELETE_PHRASE}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2" />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
                  <span>Entendo que as respostas serão apagadas e a restauração não será possível.</span>
                </label>
                <button type="button" disabled={!confirmed || busy}
                  onClick={() => void act(() => permanentlyDeleteTrashedResearchForm(form, code, phrase, audit.answers))}
                  className="w-full rounded-xl bg-destructive px-4 py-3 text-sm font-bold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? "Processando…" : "Excluir definitivamente pesquisa e respostas"}
                </button>
              </section>
            )}
          </div>
        )}

        {audit?.status === "ENCERRADO" && !inTrash && (
          <p className="rounded-lg border p-3 text-sm">Esta pesquisa histórica está protegida contra exclusão.</p>
        )}
        {!loading && <button type="button" disabled={busy} onClick={() => void refresh()}
          className="text-xs font-medium text-muted-foreground underline underline-offset-4">
          Atualizar verificação de vínculos
        </button>}
      </section>
    </div>
  );
}
