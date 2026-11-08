import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GoogleMapSurface } from "./GoogleMapSurface";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import {
  getQuickRideMapContext,
  getQuickRideApproach,
} from "@/lib/quick-ride-map.functions";
import { sessionRequest } from "@/lib/session-request-cache";
import { useEffect, useRef, useState } from "react";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import type { FormLocationDetails } from "@/lib/location/types";

type QuickRide = {
  fare_cents?: number;
  driver_receives_cents?: number;
  id: string;
  role: "PASSENGER" | "DRIVER";
  municipality: string;
  vehicle_type: string;
  origin_label: string;
  destination_label: string;
  status: string;
  requested_at: string;
  expires_at: string;
};
const labels: Record<string, string> = {
  SEARCHING: "Buscando motorista",
  ACCEPTED: "Motorista confirmado",
  ARRIVED: "Motorista chegou",
  IN_PROGRESS: "Em viagem",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Busca encerrada",
};
export function QuickRideExperience({
  initialOrigin = "",
  initialDestination = "",
  initialOriginPoint,
  initialDestinationPoint,
  initialMunicipality = "",
  embedded = false,
  driverOnly = false,
}: {
  initialOrigin?: string;
  initialDestination?: string;
  initialOriginPoint?: FormLocationDetails;
  initialDestinationPoint?: FormLocationDetails;
  initialMunicipality?: string;
  embedded?: boolean;
  driverOnly?: boolean;
}) {
  const [municipality, setMunicipality] = useState(initialMunicipality);
  useEffect(() => {
    if (!driverOnly || initialMunicipality.trim()) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any).from("professional_presence")
        .select("municipality").eq("user_id", user.id).maybeSingle();
      const city = typeof data?.municipality === "string" ? data.municipality : "";
      if (active && city.length > 1) setMunicipality(city);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [driverOnly, initialMunicipality]);
  const [vehicle, setVehicle] = useState<"CAR" | "MOTO">("CAR");
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [originPoint, setOriginPoint] = useState<
    FormLocationDetails | undefined
  >(initialOriginPoint);
  const [destinationPoint, setDestinationPoint] = useState<
    FormLocationDetails | undefined
  >(initialDestinationPoint);
  const [rides, setRides] = useState<QuickRide[]>([]);
  const [queue, setQueue] = useState<QuickRide[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const routeRequest = useServerFn(getMapDrivingRoute);
  const readMap = useServerFn(getQuickRideMapContext);
  const approachRequest = useServerFn(getQuickRideApproach);
  const [route, setRoute] = useState<Awaited<
    ReturnType<typeof routeRequest>
  > | null>(null);
  const [mapContext, setMapContext] = useState<Awaited<
    ReturnType<typeof readMap>
  > | null>(null);
  const [approach, setApproach] = useState<Awaited<
    ReturnType<typeof approachRequest>
  > | null>(null);
  const [mapError, setMapError] = useState("");
  const activeRide = rides.find((r) =>
    ["SEARCHING", "ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(r.status),
  );
  const activeId = activeRide?.id,
    activeStatus = activeRide?.status;
  useEffect(() => {
    setMapContext(null);
    setApproach(null);
    if (!activeId) return;
    let alive = true;
    const refreshMap = () =>
      void readMap({ data: { rideId: activeId } })
        .then((value) => {
          if (alive) setMapContext(value);
        })
        .catch(() => {
          if (alive)
            setMapError(
              "Posição da corrida indisponível. O pedido e seus estados continuam disponíveis abaixo.",
            );
        });
    refreshMap();
    const timer = window.setInterval(refreshMap, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeId, activeStatus, readMap]);
  useEffect(() => {
    setApproach(null);
    if (!activeId || activeStatus !== "ACCEPTED") return;
    let alive = true;
    const refreshEta = () =>
      void approachRequest({ data: { rideId: activeId } })
        .then((value) => {
          if (alive) setApproach(value);
        })
        .catch(() => {
          if (alive) setApproach(null);
        });
    refreshEta();
    const timer = window.setInterval(refreshEta, 60000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeId, activeStatus, approachRequest]);
  const mapOrigin = mapContext?.origin || originPoint;
  const mapDestination = mapContext?.destination || destinationPoint;
  const routeKey = JSON.stringify([
    mapOrigin?.lat,
    mapOrigin?.lng,
    mapDestination?.lat,
    mapDestination?.lng,
  ]);
  useEffect(() => {
    setRoute(null);
    setMapError("");
    if (
      mapOrigin?.lat == null ||
      mapOrigin.lng == null ||
      mapDestination?.lat == null ||
      mapDestination.lng == null
    )
      return;
    const points = [
      { lat: mapOrigin.lat, lng: mapOrigin.lng },
      { lat: mapDestination.lat, lng: mapDestination.lng },
    ];
    let alive = true;
    const timer = window.setTimeout(
      () =>
        void sessionRequest("quick-trip:" + routeKey, () =>
          routeRequest({ data: { points } }),
        )
          .then((value) => {
            if (alive) setRoute(value);
          })
          .catch(() => {
            if (alive)
              setMapError(
                "Rota ponto a ponto indisponível. Revise os endereços ou tente novamente.",
              );
          }),
      600,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // Fixed origin/destination only: no calls from camera or GPS observation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, routeRequest]);
  const refresh = async () => {
    try {
      const { data, error: loadError } = await (supabase as any).rpc(
        "quick_ride_my_requests",
      );
      if (loadError) {
        setError(
          "Histórico de viagens rápidas indisponível. Verifique a homologação.",
        );
        return;
      }
      setRides(Array.isArray(data) ? data : []);
    } catch {
      setError(
        "Conexão indisponível. Suas solicitações serão consultadas novamente.",
      );
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (municipality.trim().length < 2) {
      setQueue([]);
      return;
    }
    let alive = true;
    const check = async () => {
      const { data, error: loadError } = await (supabase as any).rpc(
        "caronaa_quick_driver_queue",
        { p_municipality: municipality.trim() },
      );
      if (alive) setQueue(loadError || !Array.isArray(data) ? [] : data);
    };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [municipality]);
  const useGps = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setError("GPS requer HTTPS e um navegador compatível.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin("Localização atual");
        setOriginPoint({
          rawText: "Localização atual",
          formattedAddress: "Localização atual",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setError("");
      },
      () => setError("Sem permissão para GPS. Busque a origem manualmente."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  async function create() {
    if (submitting.current) return;
    if (
      !originPoint ||
      !destinationPoint ||
      originPoint.lat == null ||
      originPoint.lng == null ||
      destinationPoint.lat == null ||
      destinationPoint.lng == null ||
      municipality.trim().length < 2
    ) {
      setError(
        "Informe município, origem e destino selecionados no mapa ou na busca.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const { error: requestError } = await (supabase as any).rpc(
        "quick_ride_request",
        {
          p_municipality: municipality.trim(),
          p_vehicle_type: vehicle,
          p_origin_label: origin,
          p_destination_label: destination,
          p_origin_lat: originPoint.lat,
          p_origin_lng: originPoint.lng,
          p_destination_lat: destinationPoint.lat,
          p_destination_lng: destinationPoint.lng,
        },
      );
      if (requestError)
        setError("Solicitação não autorizada: " + requestError.message);
      else await refresh();
    } catch {
      setError(
        "Não foi possível enviar. Verifique suas solicitações antes de tentar novamente.",
      );
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  async function action(id: string, status: string, accept = false) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error: actionError } = await (supabase as any).rpc(
        accept ? "quick_ride_accept" : "quick_ride_transition",
        accept ? { p_id: id } : { p_id: id, p_status: status },
      );
      if (actionError || data === false)
        setError(
          actionError?.message ??
            "A solicitação já foi atendida por outro motorista.",
        );
      await refresh();
    } catch {
      setError(
        "Conexão indisponível. Atualize o estado antes de tentar novamente.",
      );
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      {!embedded && (
        <Link to="/home" className="text-sm font-semibold text-primary">
          ← Início
        </Link>
      )}
      <h1 className="text-2xl font-extrabold">{driverOnly ? "Painel do motorista · Corridas Rápidas" : "Viajar agora"}</h1>
      <p className="text-sm text-muted-foreground">
        {driverOnly
          ? "Fila profissional autorizada. Você só pode aceitar pedidos onde estiver habilitado e online."
          : "Corrida Rápida piloto: peça uma viagem no mapa da tela inicial."}
      </p>
      {driverOnly && (
        <label className="block text-sm font-semibold">
          Município em que estou habilitado
          <input
            value={municipality}
            maxLength={120}
            onChange={(e) => setMunicipality(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
            placeholder="Ex.: Redenção"
          />
        </label>
      )}
      {!driverOnly && (
      <div className="rounded-2xl border p-4 space-y-3">
        <label
          htmlFor="quick-municipality"
          className="block text-sm font-semibold"
        >
          Município
        </label>
        <input
          id="quick-municipality"
          className="w-full rounded-xl border bg-background p-3"
          value={municipality}
          maxLength={120}
          onChange={(e) => setMunicipality(e.target.value)}
          placeholder="Município do piloto"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVehicle("CAR")}
            aria-pressed={vehicle === "CAR"}
            className={
              "flex-1 rounded-xl border p-3 " +
              (vehicle === "CAR" ? "bg-primary text-primary-foreground" : "")
            }
          >
            Carro
          </button>
          <button
            type="button"
            onClick={() => setVehicle("MOTO")}
            aria-pressed={vehicle === "MOTO"}
            className={
              "flex-1 rounded-xl border p-3 " +
              (vehicle === "MOTO" ? "bg-primary text-primary-foreground" : "")
            }
          >
            Moto
          </button>
        </div>
        <LocationAutocomplete
          id="quick-origin"
          label="Origem"
          value={origin}
          variant="simple"
          onChange={(v, d) => {
            setOrigin(d?.formattedAddress || v);
            setOriginPoint(d);
          }}
          placeholder="De onde você sai?"
        />
        <button
          className="rounded-xl border px-4 py-3 text-sm"
          type="button"
          onClick={useGps}
        >
          Usar minha localização
        </button>
        <LocationAutocomplete
          id="quick-destination"
          label="Destino"
          value={destination}
          variant="simple"
          onChange={(v, d) => {
            setDestination(d?.formattedAddress || v);
            setDestinationPoint(d);
          }}
          placeholder="Para onde você vai?"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="w-full rounded-xl bg-primary p-4 font-bold text-primary-foreground disabled:opacity-50"
        >
          Solicitar corrida (piloto)
        </button>
        <p className="text-xs text-muted-foreground">
          Sem estimativa tarifária ou pagamento nesta versão. Não utilize para
          transporte comercial real.
        </p>
      </div>
      )}
      {mapOrigin?.lat != null &&
        mapOrigin.lng != null &&
        mapDestination?.lat != null &&
        mapDestination.lng != null && (
          <section aria-label="Mapa ponto a ponto" className="space-y-2">
            <GoogleMapSurface
              points={[
                {
                  lat: mapOrigin.lat,
                  lng: mapOrigin.lng,
                  title: "Origem exata indicada",
                  color: "#2563eb",
                  label: "P",
                },
                {
                  lat: mapDestination.lat,
                  lng: mapDestination.lng,
                  title: "Destino indicado",
                  color: "#FFBB00",
                  label: "D",
                },
                ...(mapContext?.driver
                  ? [
                      {
                        lat: mapContext.driver.lat,
                        lng: mapContext.driver.lng,
                        title: "Seu motorista autorizado",
                        color: "#121212",
                        label: "M",
                      },
                    ]
                  : []),
              ]}
              lines={[
                ...(route
                  ? [{ points: route.routePath, color: "#FFBB00" }]
                  : []),
                ...(approach
                  ? [{ points: approach.routePath, color: "#2563eb" }]
                  : []),
              ]}
              className="h-72 w-full rounded-2xl"
              ariaLabel="Corrida direta e aproximação do motorista"
            />
            {route && (
              <p className="text-xs">
                Trajeto direto: {route.distanceKm.toFixed(1)} km · cerca de{" "}
                {Math.round(route.durationMinutes)} min. Sem encontro a pé.
              </p>
            )}
          </section>
        )}
      {activeRide && (
        <p
          role="status"
          className="rounded-xl border border-[#FFBB00]/40 p-3 text-sm"
        >
          {labels[activeRide.status] || activeRide.status}.
          {activeRide.status === "SEARCHING"
            ? " Aguardando o aceite de um profissional autorizado na região. Sem ETA confirmado."
            : activeRide.status === "ARRIVED"
              ? " Motorista no embarque indicado."
              : approach
                ? ` Aproximação estimada: ${Math.max(1, Math.round(approach.durationMinutes))} min · ${approach.distanceKm.toFixed(1)} km.`
                : activeRide.status === "ACCEPTED"
                  ? " Aguardando uma estimativa de chegada. Acompanhe o estado da solicitação."
                  : ""}
        </p>
      )}
      {mapError && (
        <p role="status" className="text-xs text-muted-foreground">
          {mapError}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400 p-3 text-sm"
        >
          {error}
        </p>
      )}
      <section className="space-y-3">
        <h2 className="font-bold">Minhas solicitações</h2>
        {rides.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma corrida rápida registrada.
          </p>
        )}
        {rides.map((r) => (
          <article key={r.id} className="rounded-xl border p-3 space-y-2">
            <p className="font-semibold">
              {r.origin_label} → {r.destination_label}
            </p>
            <p className="text-sm">
              {r.role === "DRIVER" ? "Motorista" : "Passageiro"} ·{" "}
              {labels[r.status] ?? r.status}
            </p>
            {["SEARCHING", "ACCEPTED", "ARRIVED"].includes(r.status) && (
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => void action(r.id, "CANCELLED")}
              >
                Cancelar
              </button>
            )}
            {r.role === "PASSENGER" && r.status === "ARRIVED" && (
              <button
                disabled={busy}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    const { error } = await (supabase as any).rpc(
                      "quick_ride_confirm_pickup",
                      { p_id: r.id },
                    );
                    if (error) setError(error.message);
                    await refresh();
                    setBusy(false);
                  })()
                }
              >
                Confirmar embarque
              </button>
            )}
            {r.role === "DRIVER" && r.status === "ACCEPTED" && (
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => void action(r.id, "ARRIVED")}
              >
                Cheguei
              </button>
            )}
            {r.role === "DRIVER" && r.status === "ARRIVED" && (
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => void action(r.id, "IN_PROGRESS")}
              >
                Iniciar
              </button>
            )}
            {r.role === "DRIVER" && r.status === "IN_PROGRESS" && (
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => void action(r.id, "COMPLETED")}
              >
                Finalizar
              </button>
            )}
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">Pedidos próximos (motorista credenciado)</h2>
        {queue.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido disponível ou motorista sem autorização/online.
          </p>
        )}
        {queue.map((r) => (
          <article key={r.id} className="rounded-xl border p-3 space-y-2">
            <p className="text-sm">
              {r.origin_label} → {r.destination_label} ·{" "}
              {r.vehicle_type === "MOTO" ? "Moto" : "Carro"}
            </p>
            <p className="text-sm font-semibold">
              {typeof r.driver_receives_cents === "number"
                ? `Sua remuneração prevista: ${formatBrl(r.driver_receives_cents / 100)}`
                : "Remuneração indisponível. Não aceite sem valor confirmado."}
              {typeof r.fare_cents === "number" ? ` · Total do passageiro ${formatBrl(r.fare_cents / 100)}` : ""}
            </p>
            <button
              disabled={busy || typeof r.driver_receives_cents !== "number"}
              className="rounded-lg bg-primary px-4 py-3 font-bold text-primary-foreground"
              onClick={() => void action(r.id, "", true)}
            >
              Aceitar pedido
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
