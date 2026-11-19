import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { GoogleMapSurface } from "./GoogleMapSurface";
import { QuickRideOperationalMap } from "./QuickRideOperationalMap";
import { getMapDrivingRoute } from "@/lib/map-routing.functions";
import {
  getQuickRideMapContext,
  getQuickRideApproach,
} from "@/lib/quick-ride-map.functions";
import { sessionRequest } from "@/lib/session-request-cache";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LocationAutocomplete } from "@/components/formulario/LocationAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/ride-cost";
import { QuickRidePixCard } from "./QuickRidePixCard";
import { QuickRideRatingModal } from "./QuickRideRatingModal";
import { QuickRideDriverSettlement } from "./QuickRideDriverSettlement";
import { useQuickRideRealtime } from "@/lib/quick-rides/use-quick-ride-realtime";
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
  PENDING_REVIEW: "Confirmação / análise pendente",
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
  // GPS presence is not client-authoritative. Refresh from the server when
  // returning to the tab and upon realtime queue invalidation.
  const refreshOperationalMunicipality=useCallback(async()=>{
    if(!driverOnly)return;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data,error}=await (supabase as any).from("professional_presence")
      .select("municipality,is_available,last_seen_at")
      .eq("user_id",user.id).maybeSingle();
    const city=!error && data?.is_available===true &&
      typeof data.municipality==="string" ? data.municipality.trim() : "";
    setMunicipality(city);
  },[driverOnly]);
  useEffect(()=>{
    if(!driverOnly)return;
    void refreshOperationalMunicipality().catch(()=>undefined);
    const visible=()=>{if(!document.hidden)
      void refreshOperationalMunicipality().catch(()=>undefined);};
    document.addEventListener("visibilitychange",visible);
    return()=>document.removeEventListener("visibilitychange",visible);
  },[driverOnly,refreshOperationalMunicipality]);
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
  const [queueError, setQueueError] = useState(false);
  const queueRequestVersion = useRef(0);
  const rejectedQueueIds = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [boardingCode,setBoardingCode]=useState("");
  const [driverPin,setDriverPin]=useState("");
  const [ratingDismissed,setRatingDismissed]=useState<string|null>(null);
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
    if (!activeId || !["ACCEPTED","ARRIVED"].includes(activeStatus ?? "")) return;
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
  const refresh = useCallback(async () => {
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
  }, []);


  const refreshQueue = useCallback(async () => {
    const selectedCity = municipality.trim();
    const version = ++queueRequestVersion.current;
    if (selectedCity.length < 2) {
      setQueue([]);
      setQueueError(false);
      return;
    }
    try {
      const { data, error: loadError } = await (supabase as any).rpc(
        "caronaa_quick_driver_queue", { p_municipality: selectedCity },
      );
      if(version!==queueRequestVersion.current) return;
      setQueueError(Boolean(loadError));
      setQueue(loadError||!Array.isArray(data)?[]:data.filter(
        (ride:QuickRide)=>!rejectedQueueIds.current.has(ride.id),
      ));
    } catch {
      if(version===queueRequestVersion.current){
        setQueueError(true);
        setQueue([]);
      }
    }
  }, [municipality]);

  // The private municipal invalidation channel drives both queue and
  // participant views; only a disconnected channel triggers 60s fallback.
  useQuickRideRealtime(activeRide?.municipality??municipality,()=>{
    void refreshQueue();
    void refresh();
    void refreshOperationalMunicipality().catch(()=>undefined);
  },Boolean(driverOnly||activeRide));
  useEffect(()=>()=>{
    ++queueRequestVersion.current;
  },[refreshQueue]);
  useEffect(()=>{void refresh();},[refresh]);
  // Passenger accounts cannot rely on the professional-driver-only
  // municipal notification channel. Reconcile their own ride status
  // periodically until acceptance, cancellation, completion or expiry.
  useEffect(()=>{
    if(driverOnly||!activeRide||activeRide.role!=="PASSENGER")return;
    const ms=activeRide.status==="SEARCHING"?5000:10000;
    const timer=window.setInterval(()=>{
      if(!document.hidden)void refresh();
    },ms);
    const onVisible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[driverOnly,activeId,activeStatus,refresh]);
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
        accept ? "quick_ride_accept" :
          status==="IN_PROGRESS"?"quick_ride_start_with_code":
          status==="COMPLETED"?"quick_ride_complete_ride":"quick_ride_transition",
        accept ? {p_id:id} :
          status==="IN_PROGRESS"?{p_id:id,p_code:driverPin}:
          status==="COMPLETED"?{p_id:id}:{p_id:id,p_status:status},
      );
      if (actionError) {
        const message=String(actionError.message??"");
        setError(/VERIFIED_GPS_REQUIRED/i.test(message)
          ?"GPS não atualizado. Ative a localização precisa e mantenha o aplicativo aberto."
          :/caronaa_quick_queue_events|column .*ride_id.*does not exist/i.test(message)
            ?"O serviço de aceitação precisa ser atualizado. Tente novamente após a correção do sistema."
            :"Não foi possível aceitar ou atualizar a corrida. Verifique sua disponibilidade e GPS.");
        await refreshQueue();
        return;
      }
      if (!accept && data===false){setError("Código inválido ou solicitação não permitida.");return;}
      if(status==="IN_PROGRESS")setDriverPin("");
      if (accept && data === false) {
        // SQL accepts are atomic. The losing client must not keep a stale
        // actionable card while another driver already owns the ride.
        rejectedQueueIds.current.add(id);
        setQueue(items => items.filter(item => item.id !== id));
        const message = "Solicitação indisponível: pode ter expirado ou sido aceita por outro motorista.";
        setError(message);
        toast.error(message);
        await refreshQueue();
        await refresh();
        return;
      }
      if (accept && data !== true) {
        setError("Aceite não confirmado. Atualize a lista antes de tentar novamente.");
        await refreshQueue();
        return;
      }
      if (accept) {
        rejectedQueueIds.current.add(id);
        setQueue(items => items.filter(item => item.id !== id));
        toast.success("Corrida aceita. Acompanhe o embarque no seu painel.");
      }
      await refresh();
      await refreshQueue();
    } catch {
      setError("Conexão indisponível. Atualize o estado antes de tentar novamente.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4">
      {!embedded && (
        <Link to={driverOnly ? "/disponibilidade-profissional" : "/home"} className="text-sm font-semibold text-primary">
          ← Início
        </Link>
      )}
      <h1 className="text-2xl font-extrabold">{driverOnly ? "Pedidos para você" : "Viajar agora"}</h1>
      {driverOnly && <Link to="/disponibilidade-profissional" className="inline-flex min-h-11 items-center rounded-xl border border-primary/40 px-3 text-sm font-bold text-primary">
        Consultar minha disponibilidade e GPS
      </Link>}
      <p className="text-sm text-muted-foreground">
        {driverOnly
          ? "Fila profissional autorizada. Você só pode aceitar pedidos onde estiver habilitado e online."
          : "Corrida Rápida piloto: peça uma viagem no mapa da tela inicial."}
      </p>
      {driverOnly && (
        <label className="block text-sm font-semibold">
          Município atual confirmado pelo radar
          <input
            value={municipality}
            readOnly
            maxLength={120}
            className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
            placeholder="Ative o GPS na disponibilidade profissional"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A fila acompanha o município atual informado pelo GPS verificado, mesmo que sua região cadastrada seja outra. Sem GPS válido, não há despacho.
          </p>
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
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Pedidos na sua região atual {queue.length > 0 ? `(${queue.length})` : ""}</h2>
        {!municipality.trim() && <p className="rounded-xl border p-3 text-sm">
          Você precisa estar disponível com GPS válido para consultar pedidos.
          <Link to="/disponibilidade-profissional" className="ml-1 font-bold text-primary underline">Ativar GPS</Link>
        </p>}
        {queueError && <p role="alert" className="rounded-xl border border-red-400/50 p-3 text-sm">Não foi possível consultar pedidos. Verifique conexão e autorização profissional.</p>}
        {queue.length === 0 && !queueError && (
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
              className="min-h-14 w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground disabled:opacity-50"
              onClick={() => void action(r.id, "", true)}
            >
              Aceitar esta corrida
            </button>
          </article>
        ))}
      </section>
      {activeRide && ["ACCEPTED","ARRIVED","IN_PROGRESS"].includes(activeRide.status) &&
        <QuickRideOperationalMap rideId={activeRide.id} status={activeRide.status}
          municipality={activeRide.municipality} role={activeRide.role}/>}
      {!activeRide && mapOrigin?.lat != null &&
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
                ...(activeStatus === "IN_PROGRESS" && route
                  ? [{ points: route.routePath, color: "#FFBB00" }]
                  : []),
                ...(["ACCEPTED","ARRIVED"].includes(activeStatus ?? "") && approach
                  ? [{ points: approach.routePath, color: "#2563eb" }]
                  : []),
                ...(!activeRide && route
                  ? [{ points: route.routePath, color: "#FFBB00" }]
                  : []),
              ]}
              fitMode="once"
              fitKey={activeId + ":" + (activeStatus === "IN_PROGRESS" ? "destination" : "pickup")}
              smoothTracking
              className="h-72 w-full rounded-2xl"
              ariaLabel={activeStatus === "IN_PROGRESS"
                ? "Motorista em deslocamento até o destino"
                : "Acompanhamento da chegada do motorista ao passageiro"}
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
            {r.role==="PASSENGER" && r.status==="ARRIVED" && (
              <div className="space-y-2">
                <p className="text-xs">Informe o código secreto apenas ao motorista, no embarque.</p>
                {boardingCode ? <p role="status" className="text-2xl font-bold tracking-widest">{boardingCode}</p> :
                  <button disabled={busy} className="rounded-lg border px-3 py-2 text-sm"
                    onClick={()=>void (async()=>{
                      setBusy(true);
                      try{
                        const {data,error:rpcError}=await (supabase as any).rpc("quick_ride_issue_boarding_pin",{p_id:r.id});
                        if(rpcError || typeof data!=="string")throw new Error("Código indisponível.");
                        setBoardingCode(data);
                      }catch{setError("Não foi possível gerar o código secreto.");}
                      finally{setBusy(false);}
                    })()}>Gerar código de embarque</button>}
              </div>
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
            {r.role==="DRIVER" && r.status==="ARRIVED" && (
              <div className="space-y-2">
                <label htmlFor={"quick-pin-"+r.id} className="block text-xs">Digite o código do passageiro</label>
                <input id={"quick-pin-"+r.id} inputMode="numeric" autoComplete="off" value={driverPin}
                  onChange={e=>setDriverPin(e.target.value.replace(/\\D/g,"").slice(0,4))}
                  maxLength={4} className="rounded-lg border bg-transparent px-3 py-2"/>
                <button disabled={busy||driverPin.length!==4} onClick={()=>void action(r.id,"IN_PROGRESS")}
                  className="rounded-lg border px-3 py-2 text-sm">Validar código e iniciar</button>
              </div>
            )}
            {r.role==="DRIVER" && r.status==="IN_PROGRESS" && (
              <button disabled={busy} onClick={()=>void action(r.id,"COMPLETED")}
                className="rounded-lg border px-3 py-2 text-sm">Concluir Corrida</button>
            )}
            {r.status==="PENDING_REVIEW" && <p role="status"
              className="rounded-xl border border-[#FFBB00]/40 p-3 text-sm">
              O motorista solicitou o desembarque. Se ainda não respondeu, confirme ao retornar ao aplicativo.
              Sem Pix ou comissão até a conclusão confirmada; após o prazo, poderá haver análise administrativa.
            </p>}
            {r.status==="COMPLETED" && <>
              {r.role==="DRIVER"?<QuickRideDriverSettlement rideId={r.id}/>:<QuickRidePixCard rideId={r.id}/>}
              {ratingDismissed!==r.id&&<QuickRideRatingModal rideId={r.id}
                subject={r.role==="DRIVER"?"passageiro":"motorista"}
                onClose={()=>setRatingDismissed(r.id)}/>}
            </>}
          </article>
        ))}
      </section>

    </div>
  );
}
