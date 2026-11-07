import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Footprints } from "lucide-react";
import { getStrictPickupContext, suggestStrictPickup } from "@/lib/safe-pickup.functions";
import { projectOntoRoute, type StrictPickupPreview } from "@/lib/safe-pickup";
import { sessionRequest } from "@/lib/session-request-cache";
import { GoogleMapSurface } from "./GoogleMapSurface";

export function StrictPickupPanel({
  rideId,
  autoSuggest = false,
  showMap = true,
  onPreviewChange,
}: {
  rideId: string;
  autoSuggest?: boolean;
  showMap?: boolean;
  onPreviewChange?: (preview: StrictPickupPreview | null) => void;
}) {
  const load = useServerFn(getStrictPickupContext),
    suggest = useServerFn(suggestStrictPickup);
  const [snapshot, setSnapshot] = useState<{
    rideId: string;
    value: Awaited<ReturnType<typeof load>>;
  } | null>(null);
  const [preview, setPreview] = useState<{ key: string; value: StrictPickupPreview | null } | null>(
    null,
  );
  const [requestedRide, setRequestedRide] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fixed = snapshot?.rideId === rideId ? snapshot.value : null;
  const key = fixed
    ? JSON.stringify([rideId, fixed.passenger, fixed.route, fixed.strict, fixed.highway])
    : "";
  const result = key && preview?.key === key ? preview.value : null;
  const requested = autoSuggest || requestedRide === rideId;
  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setPreview(null);
    setError("");
    setBusy(false);
    void load({ data: { rideId } })
      .then((value) => {
        if (active) setSnapshot({ rideId, value });
      })
      .catch(() => {
        if (active) setSnapshot(null);
      });
    return () => {
      active = false;
    };
  }, [rideId, load]);
  useEffect(() => {
    onPreviewChange?.(result);
  }, [result, onPreviewChange]);
  useEffect(
    () => () => {
      onPreviewChange?.(null);
    },
    [onPreviewChange],
  );
  useEffect(() => {
    if (!fixed || !requested) return;
    const projection = projectOntoRoute(fixed.passenger, fixed.route).point;
    let active = true;
    setBusy(true);
    setError("");
    const timer = window.setTimeout(() => {
      void sessionRequest("strict-client:" + key, () => suggest({ data: { rideId, projection } }))
        .then((value) => {
          if (active) setPreview({ key, value });
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
    // The key contains the complete authorized route, never live GPS/camera movement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, requested, suggest, rideId]);
  if (!fixed) return null;
  return (
    <section
      aria-label="Ponto de encontro sugerido"
      className="my-3 space-y-3 rounded-2xl border border-[#FFBB00]/30 bg-[#FFBB00]/5 p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <MapPin size={17} className="shrink-0 text-[#FFBB00]" aria-hidden="true" />
        Ponto de encontro sugerido
      </h3>
      <p className="text-xs text-muted-foreground">
        {fixed.strict
          ? "Rota Estrita: encontro no trajeto do condutor."
          : "Encontro sugerido na rodovia indicada no trajeto."}
      </p>
      {!requested && (
        <button
          type="button"
          onClick={() => setRequestedRide(rideId)}
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
          {showMap && (
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
                  color: "#FFBB00",
                  label: "E",
                  kind: "meeting",
                },
              ]}
              lines={[
                { points: result.route, color: "#FFBB00" },
                ...(result.walk
                  ? [{ points: result.walk.routePath, color: "#2563eb", dotted: true }]
                  : []),
              ]}
              ariaLabel="Rota do condutor e caminhada ao encontro"
              className="h-64 w-full rounded-xl"
            />
          )}
          <p className="text-sm font-semibold">{result.pickup.label}</p>
          {result.walk ? (
            <p className="flex items-center gap-2 text-xs">
              <Footprints size={16} aria-hidden="true" />A{" "}
              {Math.round(result.walk.distanceKm * 1000)} m da origem da viagem · ~
              {Math.max(1, Math.round(result.walk.durationMinutes))} min a pé
            </p>
          ) : (
            <p className="text-xs">
              Estimativa de caminhada indisponível. Confira o acesso ao ponto com o condutor.
            </p>
          )}
          {result.walk && result.walk.distanceKm > 1.5 && (
            <p className="text-xs">
              A caminhada pode ser longa. Combine outra opção com o condutor ou escolha Viajar
              Agora.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {result.pickup.source === "ROUTE_REFERENCE"
              ? "Referência aproximada na via. "
              : "Local usado como referência. "}
            Confirme acesso, lado da via e parada permitida com o condutor. A sugestão não altera o
            embarque combinado nem a tarifa.
          </p>
        </>
      )}
    </section>
  );
}
