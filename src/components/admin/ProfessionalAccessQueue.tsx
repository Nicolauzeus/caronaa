import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CAR_CATEGORIES, MISSING_LABELS, STATUS_LABELS, canApproveProfessionalRequest, type AccessStatus, type MissingCode } from "@/lib/professional-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeft, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";

type Item = { id: string; status: AccessStatus; submitted_at: string; review_reason: string | null; current_missing: MissingCode[]; currently_ready?: boolean;
  snapshot: { full_name: string; avatar_url: string; email?: string; vehicle_model: string; vehicle_plate: string; vehicle_type: string; car_category: string | null; passenger_seats: number; municipality: string; access_type?: string; whatsapp_e164?: string; region_code?: string } };
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
function situation(item: Item): string {
  if (item.status === "APPROVED") {
    if (item.current_missing?.length) return "Autorização registrada · dados atuais incompletos";
    if (item.currently_ready === true) return "Habilitado para receber corridas";
    return "Autorização registrada · aptidão a confirmar";
  }
  return STATUS_LABELS[item.status];
}
export function ProfessionalAccessQueue({ onChange, onCountChange }: { onChange?: () => void; onCountChange?: (count: number) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error } = await (supabase as any).rpc("admin_professional_access_queue");
      if (error) { setError("Fila indisponível: " + error.message); return; }
      setItems(data ?? []); onCountChange?.((data ?? []).filter((i: Item) => i.status === "PENDING").length);
    } catch { setError("Não foi possível carregar as solicitações."); }
    finally { setLoading(false); }
  }, [onCountChange]);
  useEffect(() => { void load(); }, [load]);
  const item = items.find(i => i.id === selected);
  const visible = items.filter(i => filter === "ALL" || i.status === filter);
  async function review(decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    if (!item || busy || (decision === "APPROVED" && !canApproveProfessionalRequest(item.status, item.current_missing))) return;
    if (decision !== "APPROVED" && reason.trim().length < 5) { setMsg("Informe um motivo com pelo menos 5 caracteres."); return; }
    setBusy(true); setMsg("");
    try {
      const { error } = await (supabase as any).rpc("admin_review_professional_access", { p_request_id: item.id, p_decision: decision, p_reason: reason.trim() });
      setMsg(error ? "Erro: " + error.message : decision === "APPROVED" ? "Autorizado para o radar (piloto)." : "Decisão registrada.");
      await load(); if (!error) onChange?.();
    } catch { setMsg("Não foi possível registrar a decisão. Atualize antes de tentar novamente."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <header className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Solicitações de acesso ao radar</h2><Button variant="outline" size="icon" aria-label="Atualizar solicitações" title="Atualizar solicitações" disabled={loading || busy} onClick={() => void load()}><RefreshCw className="size-4" /></Button></header>
    <label className="flex flex-wrap items-center gap-2 text-sm">Situação<select aria-label="Filtrar solicitações" className="rounded-lg border bg-background p-2" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="ALL">Todas</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Carregando solicitações…</p> : !error && !visible.length ? <p className="py-6 text-sm text-muted-foreground">Nenhuma solicitação neste filtro.</p> : visible.slice(page * 10, page * 10 + 10).map(i => <article key={i.id} className="rounded-lg border bg-card">
      <Button variant="ghost" className="h-auto min-h-24 w-full justify-start gap-3 whitespace-normal p-4 text-left" onClick={() => { setSelected(i.id); setReason(""); setMsg(""); }}>
        <Avatar className="size-12 shrink-0"><AvatarImage src={i.snapshot.avatar_url} alt="" /><AvatarFallback>{i.snapshot.full_name?.slice(0, 1) || "?"}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1 space-y-1"><span className="block font-semibold break-words">{i.snapshot.full_name || "Nome não informado"}</span><span className="block text-xs text-muted-foreground">{i.snapshot.access_type === "MOTOTAXI_SIMPLE" ? "Mototaxista · cadastro simplificado" : i.snapshot.vehicle_type === "MOTO" ? "Motorista de moto" : "Motorista de carro"} · {date(i.submitted_at)}</span><span className="block text-xs">{situation(i)}</span>{i.current_missing?.length > 0 && <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" />{i.current_missing.length} pendência(s) no cadastro</span>}</span><ChevronRight className="size-4 shrink-0" />
      </Button>
    </article>)}
    {visible.length > 10 && <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-xs">{page + 1} / {Math.ceil(visible.length / 10)}</span><Button variant="outline" disabled={(page + 1) * 10 >= visible.length} onClick={() => setPage(p => p + 1)}>Próxima</Button></div>}
    <Dialog open={Boolean(item)} onOpenChange={open => { if (!open && !busy) setSelected(null); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogClose asChild><Button variant="ghost" className="w-fit" disabled={busy}><ArrowLeft className="size-4" />Voltar aos pedidos</Button></DialogClose>
        <div className="flex items-center gap-3"><Avatar className="size-14"><AvatarImage src={item?.snapshot.avatar_url} alt="Foto do solicitante" /><AvatarFallback>{item?.snapshot.full_name?.slice(0, 1) || "?"}</AvatarFallback></Avatar><div className="min-w-0"><DialogTitle className="break-words leading-snug">{item?.snapshot.full_name || "Solicitação profissional"}</DialogTitle><DialogDescription>{item ? situation(item) : "Detalhes da solicitação"}</DialogDescription></div></div>
        {item && <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
          {item.current_missing?.length > 0 ? <div role="alert" className="border-l-4 border-destructive bg-destructive/10 p-3 text-sm"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />{item.status === "APPROVED" ? "Cadastro atual incompleto — regularização necessária" : "Faltam dados para habilitar"}</p><ul className="mt-2 list-disc pl-5">{item.current_missing.map(code => <li key={code}>{MISSING_LABELS[code] ?? code}</li>)}</ul></div> : <p className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-primary" />Cadastro declaratório completo para análise.</p>}
          <section className="space-y-2"><h3 className="font-semibold">Identidade e contato</h3><dl className="grid gap-3 text-sm sm:grid-cols-2"><Field label="Nome" value={item.snapshot.full_name} /><Field label="E-mail" value={item.snapshot.email} /><Field label="WhatsApp" value={item.snapshot.whatsapp_e164} /><Field label="Enviado em (Fortaleza)" value={date(item.submitted_at)} /></dl></section>
          <section className="space-y-2"><h3 className="font-semibold">Veículo e atuação</h3><dl className="grid gap-3 text-sm sm:grid-cols-2">{item.snapshot.access_type === "MOTOTAXI_SIMPLE" ? <><Field label="Região" value={item.snapshot.region_code === "MACICO_BATURITE" ? "Maciço de Baturité" : item.snapshot.region_code === "FORTALEZA" ? "Fortaleza" : undefined} /><Field label="Placa" value={item.snapshot.vehicle_plate} /></> : <><Field label="Veículo" value={item.snapshot.vehicle_model} /><Field label="Placa" value={item.snapshot.vehicle_plate} /><Field label="Tipo / categoria" value={item.snapshot.vehicle_type === "MOTO" ? "Moto" : `Carro · ${CAR_CATEGORIES.find(c => c.value === item.snapshot.car_category)?.label ?? "Categoria não informada"}`} /><Field label="Vagas" value={String(item.snapshot.passenger_seats ?? "")} /><Field label="Município" value={item.snapshot.municipality} /></>}</dl></section>
          {item.review_reason && <section className="space-y-1 text-sm"><h3 className="font-semibold">Último motivo registrado</h3><p className="break-words">{item.review_reason}</p></section>}
          <p className="text-xs text-muted-foreground">A situação histórica da solicitação não comprova a aptidão atual. A lista operacional apresenta somente a solicitação mais recente de cada conta existente; o histórico permanece preservado para auditoria. Não habilite corridas com pendências.</p>
          {item.status === "PENDING" && <div className="space-y-3 border-t pt-4"><label className="block space-y-2 text-sm"><span className="font-medium">Motivo da decisão</span><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Obrigatório ao rejeitar ou pedir correção" disabled={busy} maxLength={2000} /></label>{item.current_missing?.length > 0 && <Button variant="ghost" disabled={busy} onClick={() => setReason(`Por favor, ajuste: ${item.current_missing.map(c => MISSING_LABELS[c] ?? c).join("; ")}.`)}>Preencher com as pendências</Button>}<div className="flex flex-wrap gap-2"><Button disabled={busy || loading || !canApproveProfessionalRequest(item.status, item.current_missing)} onClick={() => void review("APPROVED")}>Aprovar</Button><Button variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => void review("CHANGES_REQUESTED")}>Pedir correção</Button><Button variant="destructive" disabled={busy || reason.trim().length < 5} onClick={() => void review("REJECTED")}>Rejeitar</Button></div></div>}
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
function Field({ label, value }: { label: string; value?: string }) { return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value || "Não informado"}</dd></div>; }
