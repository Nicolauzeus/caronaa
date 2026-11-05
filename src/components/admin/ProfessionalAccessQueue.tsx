import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CAR_CATEGORIES, MISSING_LABELS, STATUS_LABELS, type AccessStatus, type MissingCode } from "@/lib/professional-access";

type Item = { id: string; status: AccessStatus; submitted_at: string; review_reason: string | null; current_missing: MissingCode[];
  snapshot: { full_name: string; avatar_url: string; vehicle_model: string; vehicle_color?: string; vehicle_plate: string; vehicle_type: string; car_category: string | null; passenger_seats: number; municipality: string } };

export function ProfessionalAccessQueue({ onChange }: { onChange?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("admin_professional_access_queue");
    if (error) setMsg("Fila indisponível: " + error.message); else setItems(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    const { error } = await (supabase as any).rpc("admin_review_professional_access", { p_request_id: id, p_decision: decision, p_reason: reason[id] ?? "" });
    setMsg(error ? "Erro: " + error.message : decision === "APPROVED" ? "Autorizado para o radar (piloto)." : "Decisão registrada.");
    await load(); onChange?.();
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Solicitações de acesso ao radar</h3>
      {msg && <p className="text-sm">{msg}</p>}
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>}
      {items.map((i) => {
        const s = i.snapshot;
        return (
          <article key={i.id} className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center gap-3">
              <img src={s.avatar_url} alt={`Foto de ${s.full_name}`} className="h-12 w-12 rounded-full object-cover" />
              <div><p className="font-semibold">{s.full_name}</p><p className="text-muted-foreground">{STATUS_LABELS[i.status]} · {new Date(i.submitted_at).toLocaleString("pt-BR")}</p></div>
            </div>
            <p>{s.vehicle_type === "MOTO" ? "Moto" : `Carro ${CAR_CATEGORIES.find((c) => c.value === s.car_category)?.label ?? ""}`} · {s.vehicle_model} · Cor: {s.vehicle_color || "Não informada"} · {s.vehicle_plate} · {s.passenger_seats} vaga(s) · {s.municipality}</p>
            <p className="text-xs text-muted-foreground">Dados declaratórios — documentos não verificados.</p>
            {i.current_missing.length > 0 && <p role="alert" className="text-destructive">Perfil atual incompleto: {i.current_missing.map((c) => MISSING_LABELS[c]).join("; ")}</p>}
            {i.review_reason && <p>Motivo: {i.review_reason}</p>}
            {i.status === "PENDING" && (
              <>
                <input className="w-full rounded-lg border bg-background p-2" placeholder="Motivo (obrigatório para rejeitar ou pedir correção)" value={reason[i.id] ?? ""} onChange={(e) => setReason({ ...reason, [i.id]: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <button className="rounded-lg bg-primary p-2 font-bold text-primary-foreground" onClick={() => void review(i.id, "APPROVED")}>Aprovar</button>
                  <button className="rounded-lg border p-2" onClick={() => void review(i.id, "CHANGES_REQUESTED")}>Pedir correção</button>
                  <button className="rounded-lg border border-destructive p-2 text-destructive" onClick={() => void review(i.id, "REJECTED")}>Rejeitar</button>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
