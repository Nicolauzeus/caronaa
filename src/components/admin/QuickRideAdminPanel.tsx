import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MunicipalitySelect } from "@/components/caronaa/MunicipalitySelect";
import { Button } from "@/components/ui/button";
import { QuickRideCommercialAdmin } from "./QuickRideCommercialAdmin";

type Region = { municipality: string; public_discovery_enabled: boolean; dispatch_enabled: boolean };
type Driver = { user_id: string; name: string | null; approved: boolean; vehicle_type: string };
type Ride = { id: string; municipality: string; vehicle_type: string; status: string; requested_at: string };
type Overview = { regions: Region[]; drivers: Driver[]; rides: Ride[] };

export function QuickRideAdminPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [vehicle, setVehicle] = useState<"CAR" | "MOTO">("CAR");

  const reload = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("admin_quick_ride_overview");
    if (error) setError("Painel indisponível: " + error.message);
    else { setData(data); setError(""); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function setRegion(m: string, discovery: boolean, dispatch: boolean) {
    const { error } = await (supabase as any).rpc("admin_set_quick_ride_region", { p_municipality: m, p_discovery: discovery, p_dispatch: dispatch });
    setMsg(error ? "Erro: " + error.message : "Região atualizada.");
    await reload();
  }
  async function setDriver(approved: boolean, target = email, type = vehicle) {
    const { error } = await (supabase as any).rpc("admin_set_quick_ride_driver", { p_email: target, p_approved: approved, p_vehicle_type: type });
    setMsg(error ? "Erro: " + error.message : approved ? "Motorista aprovado." : "Aprovação removida.");
    if (!error) setEmail("");
    await reload();
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Corridas rápidas — controle do piloto</h2>
        <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => void reload()}>Atualizar</button>
      </header>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm">{msg}</p>}

      <div className="space-y-2">
        <h3 className="font-semibold">Municípios</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1"><MunicipalitySelect value={city} onChange={setCity} /></div>
          <Button variant="outline" disabled={city.trim().length < 2} onClick={() => { void setRegion(city, false, false); setCity(""); }}>Adicionar (desligado)</Button>
        </div>
        {data?.regions.length === 0 && <p className="text-sm text-muted-foreground">Nenhum município cadastrado.</p>}
        {data?.regions.map((r) => (
          <div key={r.municipality} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm">
            <span className="font-semibold">{r.municipality}</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1"><input type="checkbox" checked={r.public_discovery_enabled} onChange={(e) => void setRegion(r.municipality, e.target.checked, r.dispatch_enabled)} /> Mostrar motoristas</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={r.dispatch_enabled} onChange={(e) => void setRegion(r.municipality, r.public_discovery_enabled, e.target.checked)} /> Aceitar pedidos</label>
            </div>
          </div>
        ))}
      </div>

      <QuickRideCommercialAdmin />

      <div className="space-y-2">
        <h3 className="font-semibold">Motoristas autorizados</h3>
        <div className="flex flex-wrap gap-2">
          <input className="flex-1 rounded-lg border bg-background p-2 text-sm" type="email" placeholder="E-mail da conta do motorista" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="rounded-lg border bg-background p-2 text-sm" value={vehicle} onChange={(e) => setVehicle(e.target.value as "CAR" | "MOTO")}>
            <option value="CAR">Carro</option><option value="MOTO">Moto</option>
          </select>
          <button className="rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground" disabled={!email.includes("@")} onClick={() => void setDriver(true)}>Aprovar</button>
        </div>
        {data?.drivers.map((d) => (
          <div key={d.user_id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
            <span>{d.name || "Sem nome"} · {d.vehicle_type === "MOTO" ? "Moto" : "Carro"} · {d.approved ? "Aprovado" : "Não aprovado"}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Últimas corridas</h3>
        {data?.rides.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma corrida registrada.</p>}
        {data?.rides.map((q) => (
          <p key={q.id} className="text-sm">{new Date(q.requested_at).toLocaleString("pt-BR")} · {q.municipality} · {q.vehicle_type === "MOTO" ? "Moto" : "Carro"} · {q.status}</p>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Aprovação é declaratória neste piloto. Não libere transporte comercial real sem revisão legal e operacional.</p>
    </section>
  );
}
