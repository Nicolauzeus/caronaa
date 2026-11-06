import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getStrictPickupContext,
  suggestStrictPickup,
} from "@/lib/safe-pickup.functions";
import { projectOntoRoute } from "@/lib/safe-pickup";
import { sessionRequest } from "@/lib/session-request-cache";
import { GoogleMapSurface } from "./GoogleMapSurface";

export function StrictPickupPanel({ rideId }: { rideId: string }) {
  const load = useServerFn(getStrictPickupContext),
    suggest = useServerFn(suggestStrictPickup);
  const [fixed, setFixed] = useState<Awaited<ReturnType<typeof load>>>(null);
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof suggest>>>(null);
  const [requested, setRequested] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void load({ data: { rideId } })
      .then((value) => {
        if (active) setFixed(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [rideId, load]);
  const key = fixed
    ? JSON.stringify([
        rideId,
        fixed.passenger,
        fixed.route.length,
        fixed.route[0],
        fixed.route.at(-1),
      ])
    : "";
  useEffect(() => {
    if (!fixed || !requested) return;
    const frozen = fixed,
      projection = projectOntoRoute(frozen.passenger, frozen.route).point;
    let active = true;
    setBusy(true);
    setError("");
    const timer = window.setTimeout(() => {
      void sessionRequest("strict-client:" + key, () =>
        suggest({ data: { rideId, projection } }),
      )
        .then((value) => {
          if (active) setResult(value);
        })
        .catch(() => {
          if (active)
            setError(
              "Não foi possível sugerir o encontro agora. Combine um ponto permitido com o condutor.",
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 600);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // The fixed, authorized request/offer key changes only with a fixed trip, never camera/GPS movement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, requested, suggest, rideId]);
  if (!fixed) return null;
  return (
    <section
      aria-label="Embarque em rota estrita"
      className="my-3 space-y-3 rounded-2xl border border-[#FFBB00]/40 bg-[#FFBB00]/5 p-3"
    >
      <h3 className="font-bold">Rota Estrita · ponto de encontro</h3>
      <p className="text-xs text-muted-foreground">
        O condutor não fará desvios. Confira uma sugestão na rota antes de
        combinar o embarque.
      </p>
      {!requested && (
        <button
          type="button"
          onClick={() => setRequested(true)}
          className="min-h-11 rounded-xl bg-[#FFBB00] px-4 font-bold text-[#121212]"
        >
          Ver ponto de encontro sugerido
        </button>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Procurando uma referência e o caminho a pé…
        </p>
      )}
      {error && (
        <p role="status" className="text-xs">
          {error}
        </p>
      )}
      {result && (
        <>
          <GoogleMapSurface
            points={[
              {
                ...result.passenger,
                title: "Origem do passageiro",
                color: "#121212",
                kind: "person",
              },
              {
                ...result.pickup.point,
                title: result.pickup.label,
                color: "#2563eb",
                label: "E",
                kind: "meeting",
              },
            ]}
            lines={[
              { points: result.route, color: "#FFBB00" },
              ...(result.walk
                ? [
                    {
                      points: result.walk.routePath,
                      color: "#2563eb",
                      dotted: true,
                    },
                  ]
                : []),
            ]}
            ariaLabel="Rota do condutor e caminhada ao encontro"
            className="h-64 w-full rounded-xl"
          />
          <p className="text-sm font-semibold">{result.pickup.label}</p>
          <p className="text-sm">
            {result.walk && result.walk.distanceKm > 1.5
              ? "A caminhada pode ser longa. Combine outra opção com o condutor ou escolha Viajar Agora."
              : "Caminhe até o ponto de encontro indicado para encontrar seu condutor."}{" "}
            O motorista não fará desvios.
          </p>
          {result.walk && (
            <p className="text-xs">
              Caminhada estimada: {Math.round(result.walk.distanceKm * 1000)} m
              · {Math.max(1, Math.round(result.walk.durationMinutes))} min.
            </p>
          )}
          {!result.walk && (
            <p className="text-xs">
              Caminho a pé não disponível ou origem junto ao ponto. Nenhum
              trajeto de caminhada foi inventado.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {result.pickup.source === "ROUTE_REFERENCE"
              ? "Sem estabelecimento próximo: referência aproximada na via. "
              : "Estabelecimento usado apenas como referência. "}
            A categoria do local não comprova segurança ou permissão de parada.
            Confirme acesso, lado da via e condições com o condutor; rotas a pé
            podem omitir calçadas e travessias. Esta sugestão não altera o
            embarque já combinado nem a tarifa contratada.
          </p>
        </>
      )}
    </section>
  );
}
