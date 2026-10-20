import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getRideOpportunities,
  chooseRideOpportunity,
  type RideOpportunity,
} from "@/lib/ride-opportunities.functions";
import { MatchOpportunityDetails } from "./MatchOpportunityDetails";

export function RideOpportunities({
  offerId,
  role,
}: {
  offerId?: string;
  role?: "driver" | "passenger";
}) {
  const load = useServerFn(getRideOpportunities);
  const choose = useServerFn(chooseRideOpportunity);
  const [items, setItems] = useState<RideOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const result = await load({ data: { offerId } });
      setItems(result);
      setError("");
      setSelected(null);
      setConsent(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Oportunidades indisponíveis.");
    } finally {
      setLoading(false);
    }
  }, [load, offerId]);
  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("caronaa:rides-updated", onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("caronaa:rides-updated", onRefresh);
    };
  }, [refresh]);
  const visible = items.filter((item) => !role || item.role === role);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / 5) - 1));
  return (
    <section
      className="my-6 space-y-3 rounded-xl border border-border bg-card p-4"
      aria-label="Oportunidades no trajeto"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Oportunidades no trajeto</h2>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
          Atualizar oportunidades
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Alternativas com diferença de até uma hora no embarque. O horário do motorista permanece
        publicado; o passageiro escolhe se pode ajustar seu pedido.
      </p>
      {loading ? (
        <p role="status" className="text-sm">
          Buscando oportunidades…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : !visible.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma oportunidade disponível agora.</p>
      ) : (
        visible.slice(currentPage * 5, currentPage * 5 + 5).map((item) => {
          const key = `${item.requestId}:${item.offerId}`;
          return (
            <article key={key} className="border-t border-border pt-3">
              <p className="text-sm font-semibold">
                {item.role === "driver"
                  ? `Passageiro no seu trajeto · ${item.passengerCount} vaga(s)`
                  : `${item.origin} → ${item.destination}`}
              </p>
              <MatchOpportunityDetails fit={item.fit} />
              {item.role === "passenger" && (
                <>
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setSelected(selected === key ? null : key);
                      setConsent(false);
                    }}
                  >
                    Avaliar oportunidade
                  </Button>
                  {selected === key && (
                    <div className="mt-3 space-y-3">
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          className="mt-1"
                        />
                        Posso embarcar no horário estimado acima e autorizo ajustar este pedido para
                        solicitar a proposta. A viagem depende dos aceites.
                      </label>
                      <Button
                        size="sm"
                        disabled={busy || !consent}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await choose({
                              data: {
                                requestId: item.requestId,
                                offerId: item.offerId,
                                expectedPickup: item.fit.pickupAt,
                                consent: true,
                              },
                            });
                            toast.success(
                              "Proposta solicitada. Confira o preço e os aceites em suas viagens.",
                            );
                            window.dispatchEvent(new Event("caronaa:rides-updated"));
                            await refresh();
                          } catch (cause) {
                            toast.error(
                              cause instanceof Error
                                ? cause.message
                                : "Não foi possível solicitar.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy ? "Solicitando…" : "Solicitar neste horário"}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {item.role === "driver" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  O passageiro também pode avaliar esta alternativa nas próprias viagens. Aguarde a
                  solicitação para revisar a proposta.
                </p>
              )}
            </article>
          );
        })
      )}
      {visible.length > 5 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span>
            {currentPage + 1} de {Math.ceil(visible.length / 5)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(currentPage + 1) * 5 >= visible.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
