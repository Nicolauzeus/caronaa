import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  claimPendingParticipations,
  getMyResearchParticipationBadges,
  type ResearchParticipationBadge,
} from "@/lib/formulario/research-participation";
import { getMyResearchLaunchState } from "@/lib/research-launch";

export function ResearchParticipationCard() {
  const [badges, setBadges] = useState<ResearchParticipationBadge[]>([]);
  const [pendingLaunches, setPendingLaunches] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setBadges(await getMyResearchParticipationBadges());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar selos de participação.");
    }
    try {
      const state = await getMyResearchLaunchState();
      setPendingLaunches(state.launches.length);
    } catch {
      // Keep the already confirmed badges visible if the launch service fails.
      setPendingLaunches(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await claimPendingParticipations();
      await refresh();
    })();
  }, []);

  return (
    <section aria-label="Participações em pesquisas" className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft md:p-5">
      <div>
        <h3 className="font-display text-lg font-extrabold">Pesquisas respondidas</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Participações confirmadas em formulários. Os selos não comprovam matrícula,
          presença em evento ou identidade institucional.
        </p>
      </div>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">Consultando participações…</p>
      ) : badges.length ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge.form_id} title={`Participação no questionário ${badge.form_code}`} className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300">
              ✓ Pesquisa respondida · {badge.form_title}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma participação vinculada a esta conta ainda.</p>
      )}
      {pendingLaunches > 0 && (
        <Link to="/aguardando" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-primary">
          <span>Acompanhar {pendingLaunches} {pendingLaunches === 1 ? "lançamento" : "lançamentos"} pendentes</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
