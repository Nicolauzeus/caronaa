import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, RefreshCw, ShieldCheck, Truck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Driver = {
  user_id: string; display_name: string; vehicle_type: string | null;
  approved: boolean; flash_online: boolean; presence_online: boolean;
  connected_recent: boolean; gps_valid: boolean; dispatch_ready: boolean;
  gps_municipality: string | null; gps_sampled_at: string | null;
  gps_accuracy_m: number | null; last_seen_at: string | null;
  active_ride_id: string | null; active_ride_status: string | null;
  active_ride_updated_at: string | null;
  has_review: boolean; open_incidents: number; status_code: string;
};
type Ride = {
  id: string; driver_id: string | null; status: string;
  municipality: string; vehicle_type: string;
  requested_at: string; updated_at: string; expires_at: string;
  accepted_at: string | null; completed_at: string | null;
  payment_status: string | null;
  passenger_name: string; driver_name: string;
  issue_code: string | null; open_incidents: number;
};
type Incident = {
  id: string; ride_id: string | null; driver_id: string | null;
  category: string; priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  description: string; resolution_note: string | null;
  created_at: string; updated_at: string; resolved_at: string | null;
  driver_name: string;
};
type Audit = {
  id: string; incident_id: string | null; ride_id: string | null;
  action: string; detail: string; occurred_at: string;
  previous_status: string | null; new_status: string | null;
};
type Snapshot = {
  generated_at: string; drivers: Driver[]; rides: Ride[];
  incidents: Incident[]; audit: Audit[];
};
type MetricsPeriod = "today" | "7d" | "30d" | "all";
type MobilityLifecycleMetrics = {
  generated_at: string;
  period: MetricsPeriod;
  orders: { total: number; searching: number; matched: number; cancelled: number; expired: number };
  trips: { total: number; in_progress: number; completed: number; cancelled: number; in_review: number };
  payment: { completed_flash_without_confirmed_payment: number };
  sources: { flash_orders: number; shared_orders: number; flash_trips: number; shared_trips: number };
};
const lifecyclePeriodLabels: Record<MetricsPeriod,string> = {
  today: "Hoje", "7d": "7 dias", "30d": "30 dias", all: "Todo o histórico",
};
const lifecycleCount = (value: number) => value.toLocaleString("pt-BR");
type View = "attention" | "rides" | "available" | "drivers" | "incidents";
type Subject = { rideId: string | null; driverId: string | null; label: string };

const driverLabels: Record<string, string> = {
  IN_TRIP: "Em viagem", TO_PICKUP: "A caminho do embarque",
  READY: "Disponível para pedidos", OFFLINE: "Offline",
  GPS_STALE: "GPS desatualizado ou impreciso",
  OUTSIDE_COVERAGE: "Fora da cobertura habilitada",
  NOT_AUTHORIZED: "Habilitação pendente ou suspensa",
  RESTRICTED: "Restrição operacional",
};
const rideLabels: Record<string, string> = {
  SEARCHING: "Procurando motorista", ACCEPTED: "Aceita",
  ARRIVED: "Motorista chegou", IN_PROGRESS: "Em viagem",
  PENDING_REVIEW: "Em revisão", COMPLETED: "Concluída",
  CANCELLED: "Cancelada", EXPIRED: "Expirada",
};
const issueLabels: Record<string, string> = {
  SEARCH_EXPIRED: "Busca vencida e não regularizada",
  REVIEW_PENDING: "Encerramento requer análise",
  NO_PROGRESS: "Sem mudança de etapa há 15 min; verificar",
  LONG_TRIP: "Viagem longa sem mudança de etapa; verificar",
};
const priorities: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta",
};
const categories: Record<string, string> = {
  GPS: "Localização / GPS", ACEITE: "Aceite de corrida",
  EMBARQUE: "Embarque", DESEMBARQUE: "Desembarque",
  CADASTRO: "Cadastro / habilitação", COBERTURA: "Cobertura",
  OUTRO: "Outro problema",
};
const activeStatuses = new Set(["ACCEPTED", "ARRIVED", "IN_PROGRESS"]);
const driverIsAttention = (d: Driver) =>
  ["GPS_STALE", "OUTSIDE_COVERAGE", "RESTRICTED"].includes(d.status_code)
  || (d.status_code === "NOT_AUTHORIZED" && (d.flash_online || d.presence_online));

const shortId = (id: string | null | undefined) => id ? id.slice(0, 8) : "—";
const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Sem sinal";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR");
};
const matchesQuery = (parts: Array<string | null | undefined>, query: string) =>
  !query || parts.some(part => (part || "").toLocaleLowerCase("pt-BR").includes(query));

export function F07OperationsCommandCenter({
  onGoToDisputes, onGoToAccess,
}: { onGoToDisputes: () => void; onGoToAccess: () => void }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [metricsPeriod,setMetricsPeriod] = useState<MetricsPeriod>("all");
  const [lifecycle,setLifecycle] = useState<MobilityLifecycleMetrics|null>(null);
  const [lifecycleLoading,setLifecycleLoading] = useState(true);
  const [lifecycleError,setLifecycleError] = useState("");
  const lifecycleVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>("available");
  const [rideFilter, setRideFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [category, setCategory] = useState("OUTRO");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [staleRide, setStaleRide] = useState<Ride | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [allIncidents, setAllIncidents] = useState(false);
  const polling = useRef(false);

  const loadLifecycle = useCallback(async (period: MetricsPeriod) => {
    const version=++lifecycleVersion.current;
    setLifecycleLoading(true);
    try {
      const {data:payload,error:rpcError}=await (supabase as any).rpc(
        "admin_mobility_lifecycle_metrics",{p_period:period},
      );
      if(version!==lifecycleVersion.current)return;
      if(rpcError)throw new Error("Indicadores indisponíveis: " + rpcError.message);
      const amounts=[payload?.orders?.total,payload?.orders?.searching,
        payload?.orders?.matched,payload?.orders?.cancelled,payload?.orders?.expired,
        payload?.trips?.total,payload?.trips?.in_progress,payload?.trips?.completed,
        payload?.trips?.cancelled,payload?.trips?.in_review,
        payload?.payment?.completed_flash_without_confirmed_payment,
        payload?.sources?.flash_orders,payload?.sources?.shared_orders,
        payload?.sources?.flash_trips,payload?.sources?.shared_trips];
      if(payload?.period!==period ||
         amounts.some(v=>typeof v!=="number"||!Number.isSafeInteger(v)||v<0))
        throw new Error("Resposta dos indicadores inválida. Confira a migration 0222.");
      setLifecycle(payload as MobilityLifecycleMetrics);
      setLifecycleError("");
    }catch(error){
      if(version!==lifecycleVersion.current)return;
      setLifecycle(null);
      setLifecycleError(error instanceof Error ? error.message : "Indicadores indisponíveis.");
    }finally{
      if(version===lifecycleVersion.current)setLifecycleLoading(false);
    }
  },[]);

  const reload = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const { data: payload, error: rpcError } = await (supabase as any).rpc(
        "admin_f07_operations_snapshot"
      );
      if (rpcError) {
        setError("Central indisponível: " + rpcError.message);
      } else if (!payload || !Array.isArray(payload.drivers) ||
        !Array.isArray(payload.rides) || !Array.isArray(payload.incidents)) {
        setError("A consulta retornou um formato inesperado. Confira a migration 0221.");
      } else {
        setData({
          ...payload, audit: Array.isArray(payload.audit) ? payload.audit : [],
        } as Snapshot);
        setError("");
      }
    } catch {
      setError("Não foi possível consultar a central operacional.");
    } finally {
      setLoading(false);
      polling.current = false;
    }
  }, []);
  useEffect(() => {
    void reload();
    void loadLifecycle(metricsPeriod);
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void reload();
        void loadLifecycle(metricsPeriod);
      }
    }, 20000);
    return () => {
      window.clearInterval(interval);
      lifecycleVersion.current+=1; // Drop responses after unmount or period change.
    };
  }, [reload,loadLifecycle,metricsPeriod]);

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const drivers = data?.drivers ?? [];
  const rides = data?.rides ?? [];
  const incidents = data?.incidents ?? [];
  const openIncidents = incidents.filter(x => x.status !== "RESOLVED");
  const activeRides = rides.filter(r => activeStatuses.has(r.status));
  // Online presence and dispatch readiness are separate KPIs.
  // Do not conceal a connected driver merely because GPS is stale or incomplete.
  const onlineDrivers = drivers.filter(d => d.connected_recent === true);
  const readyDrivers = drivers.filter(d => d.dispatch_ready === true);
  const flaggedRides = rides.filter(r => Boolean(r.issue_code));
  const flaggedDrivers = drivers.filter(driverIsAttention);
  const reviews = rides.filter(r => r.status === "PENDING_REVIEW");
  const issueCount = flaggedRides.length + flaggedDrivers.length + openIncidents.length;

  const filteredRides = useMemo(() => rides.filter(r =>
    matchesQuery([r.id, r.driver_name, r.passenger_name, r.municipality, r.status], normalizedQuery)
  ), [rides, normalizedQuery]);
  const visibleRides = filteredRides.filter(r => rideFilter === "all"
    || (rideFilter === "active" && activeStatuses.has(r.status))
    || (rideFilter === "searching" && r.status === "SEARCHING" && r.issue_code !== "SEARCH_EXPIRED")
    || (rideFilter === "review" && r.status === "PENDING_REVIEW")
    || (rideFilter === "expired" && r.issue_code === "SEARCH_EXPIRED")
    || (rideFilter === "completed" && r.status === "COMPLETED" && Boolean(r.completed_at))
    || (rideFilter === "cancelled" && ["CANCELLED", "CANCELED"].includes(r.status))
    || (rideFilter === "closed" && ["COMPLETED", "CANCELLED", "CANCELED", "EXPIRED"].includes(r.status)));
  const filteredDrivers = useMemo(() => drivers.filter(d =>
    matchesQuery([d.user_id, d.display_name, d.gps_municipality, d.status_code], normalizedQuery)
  ), [drivers, normalizedQuery]);
  const filteredIncidents = useMemo(() => incidents.filter(i =>
    (allIncidents || i.status !== "RESOLVED") &&
    matchesQuery([i.id, i.ride_id, i.driver_name, i.description, i.category], normalizedQuery)
  ), [incidents, allIncidents, normalizedQuery]);

  function startIncident(next: Subject, suggested = "OUTRO") {
    setSubject(next);
    setCategory(suggested in categories ? suggested : "OUTRO");
    setPriority("MEDIUM");
    setDescription("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openIncident() {
    if (!subject || busy) return;
    if (description.trim().length < 12 || description.trim().length > 2000) {
      setMessage("Descreva o problema com 12 a 2000 caracteres.");
      return;
    }
    setBusy("incident");
    const { error: rpcError } = await (supabase as any).rpc("admin_f07_open_incident", {
      p_ride_id: subject.rideId, p_driver_id: subject.driverId,
      p_category: category, p_priority: priority, p_description: description.trim(),
    });
    if (rpcError) setMessage("Erro ao registrar ocorrência: " + rpcError.message);
    else {
      setSubject(null); setDescription("");
      setMessage("Ocorrência registrada com histórico de auditoria.");
      await reload();
    }
    setBusy(null);
  }

  async function updateIncident(item: Incident, status: "IN_PROGRESS" | "RESOLVED") {
    if (busy) return;
    const note = (resolution[item.id] || "").trim();
    if (status === "RESOLVED" && (note.length < 12 || note.length > 2000)) {
      setMessage("Informe uma solução de 12 a 2000 caracteres para encerrar a ocorrência.");
      return;
    }
    if (status === "RESOLVED" && !window.confirm(
      "Marcar a ocorrência como resolvida? Isso não altera o estado da viagem nem confirma pagamento."
    )) return;
    setBusy(item.id);
    const { error: rpcError, data: ok } = await (supabase as any).rpc(
      "admin_f07_update_incident",
      { p_incident_id: item.id, p_status: status, p_resolution: status === "RESOLVED" ? note : null },
    );
    if (rpcError || ok !== true) {
      setMessage("Não foi possível atualizar: " + (rpcError?.message || "Resposta inesperada."));
    } else {
      setMessage(status === "RESOLVED" ? "Ocorrência resolvida e auditada." : "Atendimento iniciado.");
      setResolution(prev => ({ ...prev, [item.id]: "" }));
      await reload();
    }
    setBusy(null);
  }

  async function expireRide(ride: Ride) {
    if (busy || ride.issue_code !== "SEARCH_EXPIRED") return;
    if (!window.confirm(
      "Expirar somente esta busca vencida e sem motorista? Corridas em andamento e pagamentos serão preservados."
    )) return;
    setBusy(ride.id);
    const { error: rpcError, data: updated } = await (supabase as any).rpc(
      "admin_f07_expire_stale_search", { p_ride_id: ride.id }
    );
    if (rpcError) setMessage("Não foi possível expirar a busca: " + rpcError.message);
    else setMessage(updated ? "Busca vencida regularizada com auditoria." : "Busca já regularizada.");
    await reload();
    setBusy(null);
  }


  async function cancelStaleAssignment() {
    if (!staleRide || busy) return;
    const note = cancelReason.trim();
    if (note.length < 20 || note.length > 2000) {
      setMessage("Informe uma justificativa de 20 a 2000 caracteres.");
      return;
    }
    if (!window.confirm(
      "Confirmar cancelamento administrativo antes do embarque? A corrida será auditada e não poderá ser retomada."
    )) return;
    setBusy(staleRide.id);
    const { data: ok, error: rpcError } = await (supabase as any).rpc(
      "admin_f07_cancel_stale_assignment",
      { p_ride_id: staleRide.id, p_reason: note },
    );
    if (rpcError || ok !== true) {
      setMessage("Não foi possível cancelar: " + (rpcError?.message || "Resposta inesperada."));
    } else {
      setMessage("Atribuição pré-embarque cancelada com justificativa e auditoria.");
      setStaleRide(null);
      setCancelReason("");
      await reload();
    }
    setBusy(null);
  }

  function renderRide(ride: Ride) {
    const issue = ride.issue_code ? issueLabels[ride.issue_code] : null;
    return <article key={ride.id} className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{rideLabels[ride.status] || ride.status} · {ride.vehicle_type === "MOTO" ? "Moto" : "Carro"}</strong>
        <span className="text-xs text-muted-foreground">{dateLabel(ride.requested_at)}</span>
      </div>
      <p className="break-words text-muted-foreground">{ride.municipality} · {ride.passenger_name} → {ride.driver_name}</p>
      <p className="text-xs text-muted-foreground">Corrida {shortId(ride.id)} · Última mudança: {dateLabel(ride.updated_at)}</p>
      {issue && <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />{issue}
      </p>}
      {ride.open_incidents > 0 && <p className="text-xs font-semibold">{ride.open_incidents} ocorrência(s) aberta(s)</p>}
      <div className="flex flex-wrap gap-2">
        {ride.status === "PENDING_REVIEW" && <Button size="sm" variant="outline"
          onClick={onGoToDisputes}>Analisar encerramento</Button>}
        {ride.issue_code === "SEARCH_EXPIRED" && <Button size="sm" variant="outline"
          disabled={busy !== null} onClick={() => void expireRide(ride)}>Regularizar busca</Button>}
        {ride.issue_code === "NO_PROGRESS" &&
          (ride.status === "ACCEPTED" || ride.status === "ARRIVED") &&
          <Button size="sm" variant="outline" onClick={() => {
            setStaleRide(ride); setCancelReason("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}>Analisar cancelamento</Button>}
        <Button size="sm" variant="outline"
          onClick={() => startIncident({
            rideId: ride.id, driverId: ride.driver_id,
            label: "Corrida " + shortId(ride.id),
          }, ride.status === "PENDING_REVIEW" ? "DESEMBARQUE" :
          ride.status === "SEARCHING" ? "ACEITE" : "OUTRO")}>
          Registrar problema
        </Button>
      </div>
    </article>;
  }

  function renderDriver(driver: Driver) {
    return <article key={driver.user_id} className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="break-words">{driver.display_name}</strong>
        <span className="font-semibold">{driver.connected_recent ? "Online agora" : "Sem conexão recente"} · {driver.gps_valid ? "GPS válido" : driver.connected_recent ? "GPS pendente/desatualizado" : "Último GPS conhecido"}{driver.dispatch_ready ? " · Apto a receber" : ""}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {driver.vehicle_type === "MOTO" ? "Moto" : driver.vehicle_type === "CAR" ? "Carro" : "Veículo não definido"}
        {" · "}{driver.gps_municipality || "Município GPS indisponível"}
        {" · "}Último GPS: {dateLabel(driver.gps_sampled_at)}
      </p>
      {driver.active_ride_id && <p>Corrida ativa {shortId(driver.active_ride_id)} · {rideLabels[driver.active_ride_status || ""] || driver.active_ride_status}</p>}
      {driver.has_review && <p className="text-xs text-amber-700 dark:text-amber-300">Possui encerramento pendente de revisão (não bloqueia automaticamente).</p>}
      {driver.open_incidents > 0 && <p className="text-xs font-semibold">{driver.open_incidents} ocorrência(s) aberta(s)</p>}
      <div className="flex flex-wrap gap-2">
        {!driver.approved && <Button variant="outline" size="sm" onClick={onGoToAccess}>Ver habilitação</Button>}
        {driver.has_review && <Button variant="outline" size="sm" onClick={onGoToDisputes}>Ver contestações</Button>}
        <Button variant="outline" size="sm" onClick={() => startIncident({
          driverId: driver.user_id, rideId: null, label: driver.display_name,
        }, driver.status_code === "GPS_STALE" ? "GPS" :
          driver.status_code === "OUTSIDE_COVERAGE" ? "COBERTURA" : "CADASTRO")}>
          Registrar problema
        </Button>
      </div>
    </article>;
  }

  function renderIncident(item: Incident) {
    return <article key={item.id} className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{categories[item.category] || item.category} · Prioridade {priorities[item.priority] || item.priority}</strong>
        <span>{item.status === "OPEN" ? "Aberta" : item.status === "IN_PROGRESS" ? "Em tratamento" : "Resolvida"}</span>
      </div>
      <p className="break-words">{item.description}</p>
      <p className="text-xs text-muted-foreground">
        {item.driver_id ? item.driver_name : "Sem motorista atribuído"} ·
        {item.ride_id ? " Corrida " + shortId(item.ride_id) + " ·" : ""}
        {" "}Aberta: {dateLabel(item.created_at)}
      </p>
      {item.status === "RESOLVED" ? <p className="text-sm">
        <strong>Solução registrada:</strong> {item.resolution_note || "Não informada"}
      </p> : <div className="space-y-2">
        {item.status === "OPEN" && <Button variant="outline" size="sm"
          disabled={busy !== null} onClick={() => void updateIncident(item, "IN_PROGRESS")}>Assumir atendimento</Button>}
        <label className="block text-sm font-medium">
          Solução adotada
          <textarea className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3 text-base"
            value={resolution[item.id] || ""} maxLength={2000}
            placeholder="Descreva a ação realizada e como foi confirmada..."
            onChange={e => setResolution(prev => ({ ...prev, [item.id]: e.target.value }))}/>
        </label>
        <Button size="sm" disabled={busy !== null || (resolution[item.id] || "").trim().length < 12}
          onClick={() => void updateIncident(item, "RESOLVED")}>Marcar ocorrência resolvida</Button>
        <p className="text-xs text-muted-foreground">
          Resolver uma ocorrência não conclui a corrida e não confirma pagamento.
        </p>
      </div>}
    </article>;
  }

  const views: Array<{ id: View; label: string }> = [
    { id: "attention", label: "Atenção" },
    { id: "rides", label: "Pedidos e corridas" },
    { id: "available", label: "Online agora" },
    { id: "drivers", label: "Todos os motoristas" },
    { id: "incidents", label: "Ocorrências" },
  ];
  const cards = [
    { label: "Motoristas online agora", value: onlineDrivers.length, icon: ShieldCheck, target: "available" as View, filter: "" },
    { label: "Pedidos em espera", value: rides.filter(r=>r.status==="SEARCHING"&&r.issue_code!=="SEARCH_EXPIRED").length,
      icon: Clock3, target: "rides" as View, filter: "searching" },
    { label: "Corridas abertas", value: activeRides.length, icon: Truck, target: "rides" as View, filter: "active" },
    { label: "Corridas fechadas", value: rides.filter(r=>["COMPLETED","CANCELLED","CANCELED","EXPIRED"].includes(r.status)).length,
      icon: CheckCircle2, target: "rides" as View, filter: "closed" },
    { label: "Pendências", value: issueCount, icon: AlertTriangle, target: "attention" as View, filter: "" },
  ];

  return <section className="space-y-4" aria-label="Central de operações de corridas rápidas">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Central operacional · Corridas Rápidas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe corridas, motoristas, problemas e resoluções. Atualiza a cada 20 segundos enquanto a tela está visível.
        </p>
        {data?.generated_at && <p className="mt-1 text-xs text-muted-foreground">Última leitura: {dateLabel(data.generated_at)}</p>}
      </div>
      <Button variant="outline" onClick={() => {void reload();void loadLifecycle(metricsPeriod);}} disabled={loading || busy !== null}>
        <RefreshCw size={16} className="mr-2" /> Atualizar
      </Button>
    </header>

    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    {!data && loading && <p role="status" className="p-4 text-sm text-muted-foreground">Consultando situação operacional…</p>}


    <details className="rounded-2xl border bg-card/50 p-3 sm:p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-bold">Histórico e indicadores detalhados · pedidos × corridas</summary>
    <section aria-labelledby="mobility-lifecycle-heading" className="mt-3 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="mobility-lifecycle-heading" className="font-[Sora] text-base font-bold">
            Pedidos e corridas
          </h3>
          <p className="text-xs text-muted-foreground">
            Situação real dos registros. Pedidos não são somados como corridas.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          Período
          <select
            aria-label="Período dos pedidos e corridas"
            className="min-h-11 rounded-lg border bg-background px-3 text-sm text-foreground"
            value={metricsPeriod}
            onChange={e=>setMetricsPeriod(e.target.value as MetricsPeriod)}
          >
            {Object.entries(lifecyclePeriodLabels).map(([value,label])=>
              <option key={value} value={value}>{label}</option>
            )}
          </select>
        </label>
      </header>
      {lifecycleError && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
        {lifecycleError}
      </p>}
      {lifecycleLoading && !lifecycle && !lifecycleError &&
        <p role="status" className="text-sm text-muted-foreground">Calculando pedidos e corridas…</p>}
      {lifecycle && <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-live="polite">
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pedidos registrados</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{lifecycleCount(lifecycle.orders.total)}</p>
            </div>
            <ClipboardList aria-hidden="true" size={20} className="text-[#FFBB00]"/>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
            {([
              {label:"Em busca",value:lifecycle.orders.searching,icon:Clock3},
              {label:"Atendidos",value:lifecycle.orders.matched,icon:CheckCircle2},
              {label:"Cancelados",value:lifecycle.orders.cancelled,icon:XCircle},
              {label:"Expirados",value:lifecycle.orders.expired,icon:AlertTriangle},
            ] as const).map(item=>
              <div key={item.label} className="rounded-lg bg-muted/35 p-2.5">
                <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <item.icon size={13} aria-hidden="true"/>{item.label}
                </dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{lifecycleCount(item.value)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Corridas atribuídas</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{lifecycleCount(lifecycle.trips.total)}</p>
            </div>
            <Truck aria-hidden="true" size={20} className="text-[#FFBB00]"/>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
            {([
              {label:"Em andamento",value:lifecycle.trips.in_progress,icon:Clock3},
              {label:"Concluídas com sucesso",value:lifecycle.trips.completed,icon:CheckCircle2},
              {label:"Canceladas",value:lifecycle.trips.cancelled,icon:XCircle},
              {label:"Em revisão",value:lifecycle.trips.in_review,icon:AlertTriangle},
            ] as const).map(item=>
              <div key={item.label} className="rounded-lg bg-muted/35 p-2.5">
                <dt className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <item.icon size={13} className="shrink-0" aria-hidden="true"/>{item.label}
                </dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{lifecycleCount(item.value)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>}
      {lifecycle && <p className="text-[11px] leading-snug text-muted-foreground">
        Fonte: {lifecycleCount(lifecycle.sources.flash_orders)} pedidos Flash + {lifecycleCount(lifecycle.sources.shared_orders)} pedidos compartilhados;
        {" "}{lifecycleCount(lifecycle.sources.flash_trips)} corridas Flash atribuídas + {lifecycleCount(lifecycle.sources.shared_trips)} compartilhadas.
        {" "}Concluída com sucesso significa encerramento registrado, não pagamento recebido.
        {lifecycle.payment.completed_flash_without_confirmed_payment>0 &&
          <> Há {lifecycleCount(lifecycle.payment.completed_flash_without_confirmed_payment)} corrida(s) Flash concluída(s) sem pagamento confirmado.</>}
        {" "}Período conforme a data de criação do pedido ou corrida.
        {" "}Atualizado: {dateLabel(lifecycle.generated_at)}.
      </p>}
      <p className="text-[11px] leading-snug text-muted-foreground">
        Totais calculados no servidor, sem limite de paginação. A lista operacional abaixo exibe apenas corridas Flash recentes.
      </p>
    </section>
    </details>

    {data && <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {cards.map(card => <button type="button" key={card.label}
        className="rounded-xl border bg-card p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFBB00]"
        onClick={() => { setView(card.target); if (card.filter) setRideFilter(card.filter); }}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><card.icon size={14}/>{card.label}</div>
        <p className="mt-2 text-2xl font-bold">{card.value}</p>
      </button>)}
    </div>}

    {subject && <form className="space-y-3 rounded-xl border border-amber-400/50 bg-card p-4"
      onSubmit={event => { event.preventDefault(); void openIncident(); }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Registrar ocorrência · {subject.label}</h3>
        <Button type="button" variant="outline" size="sm" disabled={busy !== null}
          onClick={() => setSubject(null)}>Fechar</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Tipo de problema
          <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"
            value={category} onChange={e => setCategory(e.target.value)}>
            {Object.entries(categories).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm">Prioridade
          <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"
            value={priority} onChange={e => setPriority(e.target.value)}>
            {Object.entries(priorities).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">Descrição do problema
        <textarea className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3 text-base"
          required minLength={12} maxLength={2000} value={description}
          placeholder="O que aconteceu? Qual é o impacto para o motorista ou passageiro?"
          onChange={e => setDescription(e.target.value)} />
      </label>
      <Button type="submit" disabled={busy !== null || description.trim().length < 12}>
        {busy === "incident" ? "Registrando…" : "Criar ocorrência"}
      </Button>
      <p className="text-xs text-muted-foreground">
        O registro será auditado. Nenhum status de corrida será alterado por esta ação.
      </p>
    </form>}


    {staleRide && <form className="space-y-3 rounded-xl border border-amber-400/50 bg-card p-4"
      onSubmit={event => { event.preventDefault(); void cancelStaleAssignment(); }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Cancelamento pré-embarque · Corrida {shortId(staleRide.id)}</h3>
        <Button type="button" variant="outline" size="sm" disabled={busy !== null}
          onClick={() => setStaleRide(null)}>Fechar</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Apenas corridas aceitas ou com chegada registrada, sem embarque, sem pagamento
        e sem mudança de etapa por pelo menos 15 minutos podem ser canceladas por esta ação.
        Confirme com as partes antes de decidir.
      </p>
      <label className="block text-sm">Justificativa administrativa (obrigatória)
        <textarea className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3 text-base"
          value={cancelReason} minLength={20} maxLength={2000} required
          placeholder="Descreva as evidências do travamento e por que o aceite será cancelado..."
          onChange={e => setCancelReason(e.target.value)}/>
      </label>
      <Button type="submit" variant="destructive"
        disabled={busy !== null || cancelReason.trim().length < 20}>
        Cancelar atribuição com auditoria
      </Button>
    </form>}

    {data && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Visualização operacional">
        {views.map(option => <button type="button" key={option.id}
          aria-pressed={view === option.id} onClick={() => setView(option.id)}
          className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " +
            (view === option.id ? "bg-[#FFBB00] text-[#121212] border-[#FFBB00]" : "bg-card text-foreground")}>
          {option.label}
        </button>)}
      </div>
      <label className="block max-w-lg text-sm">
        Buscar corrida ou motorista
        <input className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 text-base"
          value={query} placeholder="Nome, município ou referência da corrida"
          onChange={e => setQuery(e.target.value)}/>
      </label>

      {view === "attention" && <div className="space-y-3">
        <h3 className="font-semibold">Situações que merecem atenção</h3>
        {flaggedRides.filter(r => filteredRides.includes(r)).slice(0, 20).map(renderRide)}
        {flaggedDrivers.filter(d => filteredDrivers.includes(d)).slice(0, 20).map(renderDriver)}
        {openIncidents.filter(i => filteredIncidents.includes(i)).slice(0, 20).map(renderIncident)}
        {issueCount === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Nenhum sinal de atenção identificado nos dados retornados.
        </p>}
        {issueCount > 60 && <p className="text-xs text-muted-foreground">Exibindo os 20 registros mais recentes de cada grupo; use os filtros para consultar mais.</p>}
      </div>}

      {view === "rides" && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Corridas em aberto e histórico recente</h3>
          <label className="text-sm">Situação
            <select className="ml-2 min-h-11 rounded-lg border bg-background px-3"
              aria-label="Filtrar corridas por situação" value={rideFilter}
              onChange={e => setRideFilter(e.target.value)}>
              <option value="active">Em andamento</option>
              <option value="searching">Buscando motorista</option>
              <option value="review">Em revisão</option>
              <option value="expired">Buscas vencidas</option>
              <option value="completed">Concluídas com sucesso</option>
              <option value="cancelled">Canceladas</option>
              <option value="closed">Finalizadas</option>
              <option value="all">Todas</option>
            </select>
          </label>
        </div>
        {visibleRides.slice(0, 50).map(renderRide)}
        {visibleRides.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma corrida neste filtro.</p>}
        {visibleRides.length > 50 && <p className="text-xs text-muted-foreground">Mostrando 50 de {visibleRides.length} corridas. Refine a busca.</p>}
      </div>}

      {view === "available" && <div className="space-y-3">
        <h3 className="font-semibold">Motoristas com sinal recente · {readyDrivers.length} aptos a receber pedidos</h3>
        {filteredDrivers.filter(d => d.connected_recent === true).slice(0, 50).map(renderDriver)}
        {!filteredDrivers.some(d => d.connected_recent === true) && <p className="text-sm text-muted-foreground">Nenhum motorista com presença online confirmada pelo servidor. Confira horário da última atualização; GPS e disponibilidade para despacho são estados diferentes.</p>}
      </div>}

      {view === "drivers" && <div className="space-y-3">
        <h3 className="font-semibold">Todos os motoristas monitorados</h3>
        {filteredDrivers.slice(0, 100).map(renderDriver)}
        {filteredDrivers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum motorista neste filtro.</p>}
        {filteredDrivers.length > 100 && <p className="text-xs text-muted-foreground">Mostrando 100 de {filteredDrivers.length} motoristas. Refine a busca.</p>}
      </div>}

      {view === "incidents" && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Ocorrências administrativas</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allIncidents} onChange={e => setAllIncidents(e.target.checked)} />
            Incluir resolvidas
          </label>
        </div>
        {filteredIncidents.slice(0, 80).map(renderIncident)}
        {filteredIncidents.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ocorrência neste filtro.</p>}
        {filteredIncidents.length > 80 && <p className="text-xs text-muted-foreground">Mostrando 80 ocorrências. Refine a busca.</p>}
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-semibold">Histórico administrativo recente</summary>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            {data.audit.length ? data.audit.slice(0, 50).map(a => <p key={a.id} className="border-b pb-2">
              {dateLabel(a.occurred_at)} · {a.action} · {a.detail}
            </p>) : <p>Nenhuma ação administrativa registrada.</p>}
          </div>
        </details>
      </div>}
      <p className="text-xs text-muted-foreground">
        Os sinais de GPS seguem o limite de 90 segundos do servidor. Um aviso de viagem longa não comprova falha:
        verifique as evidências antes de intervir. Contestações, finanças e autorizações permanecem em seus fluxos protegidos.
      </p>
    </>}
  </section>;
}
