import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { MetricCard } from "./MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getMatchSuggestions,
  getOperationPeople,
  loadAdminOperations,
  operateAdminRide,
  type OperationData,
} from "@/lib/admin-operations";

type Kind = "caronas" | "solicitacoes" | "matching" | "motoristas" | "passageiros";
const titles: Record<Kind, string> = {
  caronas: "Caronas",
  solicitacoes: "Solicitações",
  matching: "Combinações",
  motoristas: "Motoristas",
  passageiros: "Passageiros",
};
const labels: Record<string, string> = {
  available: "Disponível",
  full: "Lotada",
  open: "Pendente",
  matched: "Com match",
  created: "Proposto",
  completed: "Concluído",
  cancelled: "Cancelado",
  MATCHED: "Com match",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  NO_SHOW: "Não compareceu",
  ACTIVE: "Ativa",
  DISABLED: "Suspensa",
  FORM_ONLY: "Somente formulário",
  VERIFIED: "Verificado",
  UNVERIFIED: "Não verificado",
};
const date = (value: string) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value).toLocaleDateString(
        "pt-BR",
        { timeZone: "America/Fortaleza" },
      )
    : "Não informado";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function Status({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className={
        /CANCEL|cancel|DISABLED|NO_SHOW/.test(value)
          ? "border-destructive/40 text-destructive"
          : /COMPLET|VERIFIED|CONFIRMED|ACTIVE/.test(value) && value !== "UNVERIFIED"
            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground"
      }
    >
      {labels[value] || value}
    </Badge>
  );
}
function Person({
  name,
  avatar,
  contact,
}: {
  name: string;
  avatar?: string | null | undefined;
  contact?: string | undefined;
}) {
  return (
    <div className="flex min-w-44 items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatar || undefined} alt={name} />
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{contact || "Contato não informado"}</div>
      </div>
    </div>
  );
}
type DisplayRow = {
  id: string;
  status: string;
  day: string;
  search: string;
  cells: React.ReactNode[];
  details: [string, string][];
  action?: string | undefined;
  personId?: string;
};

export function OperationPage({ kind }: { kind: Kind }) {
  const [data, setData] = useState<OperationData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<DisplayRow | null>(null);
  const [confirm, setConfirm] = useState<DisplayRow | null>(null);
  const [note, setNote] = useState("");
  const [document, setDocument] = useState(false);
  const [vehicle, setVehicle] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  async function reload() {
    setLoading(true);
    setError("");
    try {
      setData(await loadAdminOperations());
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const next = await loadAdminOperations();
        if (active) {
          setData(next);
          setUpdatedAt(new Date());
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Não foi possível carregar os dados.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchData();
    const timer = window.setInterval(() => void fetchData(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    setPage(0);
  }, [query, status, day]);
  async function run(action: string, id: string, offerId?: string) {
    setBusy(true);
    try {
      await operateAdminRide(action, id, { offerId, note, document, vehicle });
      setConfirm(null);
      setSelected(null);
      toast.success("Operação concluída.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }
  const model = useMemo(() => {
    if (!data) return null;
    const name = (id: string) =>
      data.users.find((u) => u.id === id)?.fullName ||
      data.users.find((u) => u.id === id)?.email ||
      "Usuário";
    const person = (id: string) => {
      const u = data.users.find((u) => u.id === id);
      return (
        <Person
          name={name(id)}
          avatar={u?.avatarUrl}
          contact={u?.email || data.contacts.find((c) => c.id === id)?.phone || undefined}
        />
      );
    };
    const trip = (r: { origin: string; destination: string }) => `${r.origin} → ${r.destination}`;
    const time = (r: { ride_date: string; departure_time: string }) =>
      `${date(r.ride_date)} · ${r.departure_time.slice(0, 5)}`;
    const month = today().slice(0, 7);
    let rows: DisplayRow[] = [];
    let headers: string[] = [];
    let metrics: [string, string][] = [];
    if (kind === "caronas") {
      headers = ["Motorista", "Trajeto", "Partida", "Vagas ocupadas / total", "Preço", "Status"];
      rows = data.offers.map((o) => {
        const rides = data.rides.filter((r) => r.offer_id === o.offer_id);
        const state =
          o.status === "cancelled"
            ? "CANCELLED"
            : ["IN_PROGRESS", "CONFIRMED", "MATCHED"].find((s) =>
                rides.some((r) => r.status === s),
              ) ||
              (rides.length && rides.every((r) => r.status === "COMPLETED")
                ? "COMPLETED"
                : o.status);
        return {
          id: o.offer_id,
          status: state,
          day: o.ride_date,
          search: `${name(o.user_id)} ${o.origin} ${o.destination}`,
          cells: [
            person(o.user_id),
            trip(o),
            time(o),
            `${o.available_seats - o.seats_remaining} / ${o.available_seats}`,
            "Não informado",
          ],
          details: [
            ["Motorista", name(o.user_id)],
            ["Trajeto", trip(o)],
            ["Partida", time(o)],
            ["Vagas disponíveis", String(o.seats_remaining)],
            ["Oferta", o.offer_id],
            ...rides.map(
              (r) =>
                [
                  "Passageiro",
                  `${name(r.passenger_user_id)} · ${labels[r.status] || r.status}`,
                ] as [string, string],
            ),
          ],
          action:
            o.status !== "cancelled" && !rides.some((r) => r.status === "COMPLETED")
              ? "cancel_offer"
              : undefined,
          personId: o.user_id,
        };
      });
      metrics = [
        ["Total de caronas", String(data.offers.length)],
        ["Caronas hoje", String(data.offers.filter((o) => o.ride_date === today()).length)],
        [
          "Confirmadas / em andamento",
          String(data.rides.filter((r) => ["CONFIRMED", "IN_PROGRESS"].includes(r.status)).length),
        ],
        [
          "Vagas ofertadas / ocupadas",
          `${data.offers.reduce((s, o) => s + o.available_seats, 0)} / ${data.offers.reduce((s, o) => s + o.available_seats - o.seats_remaining, 0)}`,
        ],
      ];
    } else if (kind === "solicitacoes") {
      headers = ["Passageiro", "Trajeto", "Partida / tolerância", "Assentos", "Status"];
      rows = data.requests.map((r) => ({
        id: r.request_id,
        status: r.status,
        day: r.ride_date,
        search: `${name(r.user_id)} ${r.origin} ${r.destination}`,
        cells: [
          person(r.user_id),
          trip(r),
          `${time(r)} · ±${r.time_tolerance_minutes ?? 15} min`,
          r.passenger_count,
        ],
        details: [
          ["Passageiro", name(r.user_id)],
          ["Trajeto", trip(r)],
          ["Partida", time(r)],
          ["Assentos", String(r.passenger_count)],
          ["Tolerância", `${r.time_tolerance_minutes ?? 15} minutos`],
          ["Pedido", r.request_id],
        ],
        action:
          r.status !== "cancelled" &&
          !data.rides.some(
            (ride) => ride.request_id === r.request_id && ride.status === "COMPLETED",
          )
            ? "cancel_request"
            : undefined,
        personId: r.user_id,
      }));
      metrics = [
        ["Total de solicitações", String(rows.length)],
        ["Pendentes de match", String(data.requests.filter((r) => r.status === "open").length)],
        ["Com match", String(data.requests.filter((r) => r.status === "matched").length)],
        ["Canceladas", String(data.requests.filter((r) => r.status === "cancelled").length)],
      ];
    } else if (kind === "matching") {
      headers = ["Motorista", "Passageiro", "Trajeto", "Partida", "Status"];
      rows = data.matches.map((m) => {
        const o = data.offers.find((o) => o.offer_id === m.offer_id);
        const ride = data.rides.find((r) => r.match_id === m.match_id);
        return {
          id: m.match_id,
          status: ride?.status || m.status,
          day: o?.ride_date || m.created_at.slice(0, 10),
          search: `${name(m.driver_user_id)} ${name(m.passenger_user_id)} ${o ? trip(o) : ""}`,
          cells: [
            person(m.driver_user_id),
            person(m.passenger_user_id),
            o ? trip(o) : "Não informado",
            o ? time(o) : date(m.created_at),
          ],
          details: [
            ["Motorista", name(m.driver_user_id)],
            ["Passageiro", name(m.passenger_user_id)],
            ["Trajeto", o ? trip(o) : "Não informado"],
            ["Criado em", date(m.created_at)],
            ["Match", m.match_id],
            ["Carona", ride?.ride_id || "Não informada"],
          ],
        };
      });
      const matchedRequests = new Set(
        data.matches.filter((m) => m.status !== "cancelled").map((m) => m.request_id),
      ).size;
      const responseMinutes = data.rides.flatMap((ride) => {
        const confirmations = data.history
          .filter((h) => h.ride_id === ride.ride_id)
          .map((h) => new Date(h.created_at).getTime());
        if (!confirmations.length) return [];
        const minutes = (Math.min(...confirmations) - new Date(ride.created_at).getTime()) / 60000;
        return Number.isFinite(minutes) && minutes >= 0 ? [minutes] : [];
      });
      metrics = [
        [
          "Taxa de match",
          data.requests.length
            ? `${((100 * matchedRequests) / data.requests.length).toFixed(1)}%`
            : "0%",
        ],
        [
          "Matches ativos",
          String(
            data.rides.filter((r) => ["MATCHED", "CONFIRMED", "IN_PROGRESS"].includes(r.status))
              .length,
          ),
        ],
        ["Matches concluídos", String(data.matches.filter((m) => m.status === "completed").length)],
        [
          "Tempo médio até confirmação",
          responseMinutes.length
            ? `${(responseMinutes.reduce((sum, minutes) => sum + minutes, 0) / responseMinutes.length).toFixed(1)} min`
            : "N/D",
        ],
      ];
    } else {
      const driver = kind === "motoristas";
      const people = getOperationPeople(data, driver);
      headers = driver
        ? ["Motorista", "Veículo / vagas", "Verificação", "Caronas concluídas", "Status"]
        : ["Passageiro", "Destinos frequentes", "Caronas realizadas", "Cadastro", "Status"];
      rows = people.map((p) => ({
        id: p.id,
        status: driver
          ? p.review?.document_verified && p.review?.vehicle_verified
            ? "VERIFIED"
            : "UNVERIFIED"
          : p.status,
        day: p.createdAt.slice(0, 10),
        search: `${p.name} ${p.email} ${p.phone}`,
        cells: driver
          ? [
              <Person name={p.name} avatar={p.avatar} contact={`${p.email} ${p.phone}`} />,
              `${p.form?.vehicleType || "Não informado"} / ${p.form?.availableSeats || "N/D"}`,
              <div className="space-y-1 text-xs">
                <div>Telefone: {p.phoneConfirmed ? "verificado" : "não verificado"}</div>
                <div>Documento: {p.review?.document_verified ? "verificado" : "pendente"}</div>
                <div>Veículo: {p.review?.vehicle_verified ? "verificado" : "pendente"}</div>
              </div>,
              p.completed,
            ]
          : [
              <Person name={p.name} avatar={p.avatar} contact={`${p.email} ${p.phone}`} />,
              p.destinations || "Não informado",
              p.completed,
              date(p.createdAt),
            ],
        details: [
          ["Nome", p.name],
          ["E-mail", p.email || "Não informado"],
          ["Telefone", p.phone || "Não informado"],
          ["Conta", labels[p.status] || p.status],
          ["Cadastro", date(p.createdAt)],
          ["Caronas concluídas", String(p.completed)],
          ["Veículo", p.form?.vehicleType || "Não informado"],
          ["Modelo / placa", "Não informado"],
          ["Destinos", p.destinations || "Não informado"],
          ["Revisão documental", p.review?.evidence_note || "Não realizada"],
          ...data.requests
            .filter((r) => r.user_id === p.id)
            .map(
              (r) =>
                ["Pedido", `${trip(r)} · ${time(r)} · ${labels[r.status] || r.status}`] as [
                  string,
                  string,
                ],
            ),
          ...data.rides
            .filter((r) => (driver ? r.driver_user_id : r.passenger_user_id) === p.id)
            .map(
              (r) =>
                ["Viagem", `${date(r.created_at)} · ${labels[r.status] || r.status}`] as [
                  string,
                  string,
                ],
            ),
        ],
        action: driver && p.registered ? "review" : undefined,
      }));
      metrics = driver
        ? [
            ["Total de motoristas", String(people.length)],
            [
              "Documentos verificados",
              String(people.filter((p) => p.review?.document_verified).length),
            ],
            [
              "Caronas oferecidas no mês",
              String(data.offers.filter((o) => o.created_at.startsWith(month)).length),
            ],
            ["Avaliação média", "N/D"],
          ]
        : [
            ["Passageiros ativos", String(people.filter((p) => p.status === "ACTIVE").length)],
            [
              "Solicitações no mês",
              String(data.requests.filter((r) => r.created_at.startsWith(month)).length),
            ],
            [
              "Caronas realizadas",
              String(data.rides.filter((r) => r.status === "COMPLETED").length),
            ],
            ["Taxa de avaliação", "N/D"],
          ];
    }
    return { rows, headers, metrics };
  }, [data, kind]);
  const filtered = (model?.rows || []).filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!day || r.day === day) &&
      r.search.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, totalPages - 1);
  const suggestions =
    data && kind === "matching"
      ? getMatchSuggestions(data).filter(
          (s) =>
            (!day || s.offer.ride_date === day) &&
            `${s.offer.origin} ${s.offer.destination} ${data.users.find((u) => u.id === s.request.user_id)?.fullName || ""} ${data.users.find((u) => u.id === s.offer.user_id)?.fullName || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
      : [];
  function openAction(row: DisplayRow) {
    const review = data?.reviews.find((r) => r.user_id === row.id);
    setNote(review?.evidence_note || "");
    setDocument(review?.document_verified || false);
    setVehicle(review?.vehicle_verified || false);
    setConfirm(row);
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">OPERAÇÃO / CARONAA</p>
          <h1 className="font-display text-3xl font-bold">{titles[kind]}</h1>
          <p className="mt-2 text-xs text-muted-foreground">{updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR")} · atualização a cada 30 s` : "Aguardando dados"}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          title="Atualizar dados"
          aria-label="Atualizar dados"
          onClick={() => void reload()}
          disabled={loading || busy}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 p-4 text-sm text-destructive"
        >
          Não foi possível carregar a operação: {error}
          <Button variant="outline" className="ml-3" onClick={() => void reload()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {loading && (
        <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          Carregando dados…
        </div>
      )}
      {model && !loading && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {model.metrics.map(([label, value]) => (
              <MetricCard key={label} label={label} value={value} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 basis-64">
              <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                aria-label="Buscar registros"
                placeholder="Buscar por nome ou trajeto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filtrar por status"
              className="h-10 max-w-full rounded-md border border-border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Todos os status</option>
              {[...new Set(model.rows.map((r) => r.status))].map((s) => (
                <option key={s} value={s}>
                  {labels[s] || s}
                </option>
              ))}
            </select>
            <Input
              type="date"
              aria-label="Filtrar por data"
              className="w-44"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto border-y border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {model.headers.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(currentPage * 20, currentPage * 20 + 20).map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell, i) => (
                      <TableCell key={i}>{cell}</TableCell>
                    ))}
                    <TableCell>
                      <Status value={row.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Ver detalhes"
                          title="Ver detalhes"
                          onClick={() => setSelected(row)}
                        >
                          <Eye size={16} />
                        </Button>
                        {row.action && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={
                              row.action === "review" ? "Revisar documentação" : "Cancelar"
                            }
                            title={row.action === "review" ? "Revisar documentação" : "Cancelar"}
                            onClick={() => openAction(row)}
                          >
                            {row.action === "review" ? <ShieldCheck size={16} /> : <X size={16} />}
                          </Button>
                        )}
                        {kind === "solicitacoes" && row.status === "open" && (
                          <Button
                            variant="outline"
                            size="sm"
                            title="Buscar combinação"
                            aria-label="Buscar combinação"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                "match",
                                row.id,
                                data?.requests.find((r) => r.request_id === row.id)
                                  ?.target_offer_id || undefined,
                              )
                            }
                          >
                            <Zap size={16} className="mr-1" /> Buscar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filtered.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {model.rows.length
                  ? "Nenhum registro corresponde aos filtros."
                  : "Nenhum registro disponível ainda."}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length} registros · Página {currentPage + 1} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                title="Página anterior"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Próxima página"
                title="Próxima página"
                disabled={currentPage + 1 >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          {kind === "matching" && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Combinações sugeridas</h2>
              {!suggestions.length ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma sugestão para os pedidos pendentes e filtros atuais. Confira datas, horários, vagas e trajetos em Caronas e Solicitações; a confirmação também valida os requisitos obrigatórios.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista / passageiro</TableHead>
                        <TableHead>Trajeto</TableHead>
                        <TableHead>Partida</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.slice(0, 20).map((s) => (
                        <TableRow key={`${s.request.request_id}-${s.offer.offer_id}`}>
                          <TableCell>
                            {data?.users.find((u) => u.id === s.offer.user_id)?.fullName ||
                              "Motorista"}{" "}
                            /{" "}
                            {data?.users.find((u) => u.id === s.request.user_id)?.fullName ||
                              "Passageiro"}
                          </TableCell>
                          <TableCell>
                            {s.request.origin} → {s.request.destination}
                          </TableCell>
                          <TableCell>
                            {date(s.offer.ride_date)} · {s.offer.departure_time.slice(0, 5)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void run("match", s.request.request_id, s.offer.offer_id)
                              }
                            >
                              <Zap size={14} />
                              Sugerir match
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="py-2 text-xs text-muted-foreground">
                    {Math.min(20, suggestions.length)} de {suggestions.length} sugestões
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes</DialogTitle>
            <DialogDescription>
              {selected ? labels[selected.status] || selected.status : ""}
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-3">
            {selected?.details.map(([label, value], i) => (
              <div key={i}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          {selected?.personId && (
            <a
              className="text-sm text-primary underline"
              href={`/admin/${kind === "caronas" ? "motoristas" : "passageiros"}`}
            >
              Ver {kind === "caronas" ? "motoristas" : "passageiros"}
            </a>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirm} onOpenChange={(open) => !busy && !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === "review" ? "Revisar documentação" : "Cancelar registro"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === "review"
                ? "Registre a evidência conferida antes de aprovar."
                : "O cancelamento encerra as viagens ativas associadas e libera os assentos reservados."}
            </DialogDescription>
          </DialogHeader>
          {confirm?.action === "review" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={document} onCheckedChange={(v) => setDocument(v === true)} />
                Documento conferido
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={vehicle} onCheckedChange={(v) => setVehicle(v === true)} />
                Veículo conferido
              </label>
              <label className="block space-y-2 text-sm">
                <span>Evidência da revisão</span>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
              Voltar
            </Button>
            <Button
              variant={confirm?.action === "review" ? "default" : "destructive"}
              disabled={busy || (confirm?.action === "review" && note.trim().length < 10)}
              onClick={() => confirm?.action && void run(confirm.action, confirm.id)}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
