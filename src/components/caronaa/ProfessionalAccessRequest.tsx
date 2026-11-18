import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfessionalAuthorizationBadge } from "@/components/caronaa/ProfessionalAuthorizationBadge";
import { MunicipalitySelect } from "./MunicipalitySelect";
import { Button } from "@/components/ui/button";
import {
  CAR_CATEGORIES, MISSING_LABELS, PROFILE_CODES, STATUS_LABELS, maxSeatsFor, parseMissingError,
  type AccessStatus, type CarCategory, type MissingCode, type VehicleType,
} from "@/lib/professional-access";

type State = {
  authorized: boolean;
  profileMissing: MissingCode[];
  request: null | { status: AccessStatus; access_type?: "STANDARD" | "MOTOTAXI_SIMPLE"; vehicle_type: VehicleType; car_category: CarCategory | null; passenger_seats: number; municipality: string; review_reason: string | null; submitted_at: string };
};

type InitialVehicle = {type:VehicleType;seats:number;municipality:string};
export function ProfessionalAccessRequest({
  onAuthorized, initialVehicle,
}: { onAuthorized?: (v: boolean) => void; initialVehicle?:InitialVehicle }) {
  const [state, setState] = useState<State | null>(null);
  const [type, setType] = useState<VehicleType>("CAR");
  const [category, setCategory] = useState<CarCategory | "">("");
  const [seats, setSeats] = useState(1);
  const [city, setCity] = useState("");
  const [missing, setMissing] = useState<MissingCode[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("get_my_professional_access");
    if (error) { setError("Não foi possível carregar sua autorização."); return; }
    setState(data); onAuthorized?.(Boolean(data?.authorized));
    const r = data?.request;
    if (r) {
      const actualType=initialVehicle?.type??r.vehicle_type;
      setType(actualType);
      setCategory(actualType==="CAR"&&r.vehicle_type==="CAR" ? r.car_category??"" : "");
      setSeats(initialVehicle?.seats!=null
        ?(actualType==="MOTO"?1:Math.min(3,Math.max(1,initialVehicle.seats)))
        :r.passenger_seats);
      setCity(initialVehicle?.municipality||r.municipality);
    } else if(initialVehicle) {
      // Reuse the universal registration instead of making a new application.
      setType(initialVehicle.type);
      setSeats(initialVehicle.type==="MOTO"?1:Math.min(3,Math.max(1,initialVehicle.seats)));
      setCity(initialVehicle.municipality);
    }
  },[onAuthorized,initialVehicle?.type,initialVehicle?.seats,initialVehicle?.municipality]);
  useEffect(() => { void load(); }, [load]);

  async function submit() {
    setError("");
    // Only validate the three inputs that this form actually edits.
    // The old synthetic profile omitted vehicleColor and ALWAYS produced
    // VEHICLE_COLOR even when the real vehicle had a valid color.
    const local:MissingCode[]=[];
    if(type==="CAR"&&!category)local.push("CAR_CATEGORY");
    if(!Number.isInteger(seats)||seats<1||
      seats>(type==="CAR"?Math.min(3,maxSeatsFor(type,category||null)):1))
      local.push("SEATS");
    if(!city.trim())local.push("MUNICIPALITY");
    if(local.length){setMissing(local);return;}
    // The actual profile, photo, car plate, past approvals and permissions
    // are checked atomically by submit_professional_access_request in SQL.
    setBusy(true);
    const { error } = await (supabase as any).rpc("submit_professional_access_request", {
      p_vehicle_type: type, p_car_category: type === "CAR" ? category : null, p_seats: seats, p_municipality: city.trim(),
    });
    setBusy(false);
    if (error) { const codes = parseMissingError(error.message); if (codes.length) setMissing(codes); else setError(error.message); return; }
    setMissing([]); setEditing(false); await load();
  }

  if (!state) return <p className="rounded-xl border p-4 text-sm">{error || "Carregando autorização…"}</p>;
  const r = state.request;
  const simpleMototaxi = r?.access_type === "MOTOTAXI_SIMPLE";
  const heldByPriorDecision = r?.status === "REJECTED" || r?.status === "CHANGES_REQUESTED";
  const canSubmit = !simpleMototaxi && !state.authorized && !heldByPriorDecision && (!r || editing || r.status === "PENDING");
  const profileMissing = missing.length ? missing : state.profileMissing;
  const maxSeats = type==="CAR"?Math.min(3,maxSeatsFor(type,category||null)):1;

  return (
    <section className="space-y-3 rounded-xl border p-4" aria-label="Acesso ao radar profissional">
      <h2 className="font-semibold">{simpleMototaxi ? "Situação dos dados profissionais" : "Habilitação profissional"}</h2>
      {state.authorized
        ? <div className="space-y-2"><ProfessionalAuthorizationBadge /><p className="text-xs text-muted-foreground">Cadastro completo e habilitado na plataforma. Disponibilidade, localização e cobertura ainda são verificadas separadamente.</p></div>
        : r && <p className="text-sm">Situação: <strong>{STATUS_LABELS[r.status]}</strong>{r.status === "PENDING" && " — confirme os dados para concluir a habilitação."}</p>}
      {r?.review_reason && !state.authorized && <p className="rounded-lg border p-2 text-sm">Motivo: {r.review_reason}</p>}
      {heldByPriorDecision && !state.authorized && (
        <p role="alert" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          Existe uma restrição anterior neste cadastro. Para solicitar a revisão, entre em contato com o suporte CARONAA.
        </p>
      )}
      {profileMissing.length > 0 && !state.authorized && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
          <p className="font-semibold">{simpleMototaxi ? "Dados que faltam para operar:" : "Complete os dados para trabalhar:"}</p>
          <ul className="ml-4 list-disc">{profileMissing.map((c) => <li key={c}>{MISSING_LABELS[c]}</li>)}</ul>
          {simpleMototaxi && !heldByPriorDecision
            ? <Link to="/cadastro-motorista" className="inline-flex min-h-11 items-center font-semibold underline">Corrigir dados profissionais</Link>
            : !heldByPriorDecision && profileMissing.some((c) => PROFILE_CODES.includes(c)) && <Link to="/cadastro-veiculo" search={{redirect:"/cadastro-motorista"}} className="font-semibold underline">Corrigir cadastro do veículo e foto</Link>}
        </div>
      )}
      {canSubmit && (
        <div className="space-y-2">
          {initialVehicle ?
            <p role="status" className="rounded-lg border border-[#FFBB00]/30 p-3 text-sm">
              Tipo confirmado no cadastro: <strong>{initialVehicle.type==="CAR"?"Carro":"Moto"}</strong>.
              Para alterar, corrija o veículo antes de habilitar corridas.
            </p> :
            <div className="grid grid-cols-2 gap-2">
              {(["CAR", "MOTO"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={type===t}
                  onClick={()=>{setType(t);setMissing([]);if(t==="MOTO"){setSeats(1);setCategory("");}}}
                  className={`min-h-12 rounded-xl border p-2 font-semibold ${type===t?"border-primary bg-primary text-primary-foreground":""}`}>
                  {t==="CAR"?"Carro":"Moto"}
                </button>
              ))}
            </div>}
          {type === "CAR" && (
            <label className="block text-sm">Categoria do carro
              <select value={category} onChange={(e) => { const c = e.target.value as CarCategory; setCategory(c);setMissing([]);setSeats((s) => Math.min(s,3,maxSeatsFor("CAR",c))); }} className="mt-1 w-full rounded-lg border bg-background p-3">
                <option value="">Selecione</option>{CAR_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          )}
          <label className="block text-sm">Vagas para passageiros (1 a {maxSeats})
            <input type="number" min={1} max={maxSeats} value={seats} disabled={type === "MOTO"} onChange={(e) => {setSeats(Number(e.target.value));setMissing([]);}} className="mt-1 w-full rounded-lg border bg-background p-3" />
          </label>
          <MunicipalitySelect value={city} onChange={value=>{setCity(value);setMissing([]);}} disabled={busy} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="button" disabled={busy || !city} onClick={() => void submit()} className="min-h-12 w-full">
            {busy ? "Validando dados…" : "Confirmar dados e habilitar corridas"}
          </Button>
          <p className="text-xs text-muted-foreground">O sistema habilita sua conta após verificar os dados obrigatórios. O GPS só é compartilhado quando você ativar a disponibilidade.</p>
        </div>
      )}
    </section>
  );
}
