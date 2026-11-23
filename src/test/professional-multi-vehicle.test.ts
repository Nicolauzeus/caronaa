import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
describe("F07 multi-vehicle per driver & plate-only identity",()=>{
 const schema=read("drizzle/migrations/0245_professional_multiple_vehicles.sql");
 const privacy=read("drizzle/migrations/0246_remove_registration_from_passenger_radar.sql");
 const manager=read("src/components/caronaa/ProfessionalVehiclesManager.tsx");
 const wizard=read("src/routes/cadastro-motorista.tsx");
 const profile=read("src/routes/_authenticated/perfil.tsx");
 const account=read("src/components/caronaa/ProfessionalAccountDashboard.tsx");
 it("stores many independently validated vehicles with one dispatch-active choice",()=>{
   expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.professional_driver_vehicles");
   expect(schema).toContain("UNIQUE(user_id,plate)");
   expect(schema).toContain("professional_driver_vehicles_one_active_per_account");
   expect(schema).toContain("WHERE is_active");
   expect(schema).toContain("p_vehicle_type NOT IN('CAR','MOTO')");
   expect(schema).toContain("v_plate !~ '^[A-Z]{3}[0-9][0-9A-J][0-9]{2}$'");
   expect(schema).toContain("UPDATE public.professional_driver_authorizations SET vehicle_type=v.vehicle_type");
   expect(schema).toContain("UPDATE public.profiles SET vehicle_type=lower(v.vehicle_type)");
   expect(schema).toContain("IF NOT FOUND OR v_current.approved IS DISTINCT FROM true");
 });
 it("blocks switching while online or working, without changing existing trips",()=>{
   expect(schema).toContain("WHERE pr.user_id=v_uid AND pr.is_available");
   expect(schema).toContain("q.driver_id=v_uid AND q.accepted_at IS NOT NULL");
   expect(schema).toContain("r.driver_user_id=v_uid");
   expect(schema).toContain("o.user_id=v_uid AND o.status='available'");
   expect(schema).not.toContain("UPDATE public.professional_quick_rides");
   expect(schema).not.toContain("UPDATE public.rides");
   expect(schema).toContain("REVOKE ALL ON TABLE public.professional_driver_vehicles FROM PUBLIC,anon,authenticated");
   expect(schema).toContain("auth.uid()");
 });
 it("removes matrícula as a required field and keeps the plate",()=>{
   expect(wizard).not.toContain("Matrícula / registro do mototaxista");
   expect(wizard).not.toContain('setRegistration(');
   expect(wizard).toContain("Placa do veículo");
   expect(wizard).toContain("p_registration_number: null");
   expect(schema).toContain("ALTER COLUMN registration_number DROP NOT NULL");
   expect(schema).toContain("Dados pendentes: SEATS");
   expect(schema).not.toContain("REGISTRATION,SEATS");
   expect(account).not.toContain("Matrícula de mototaxista");
   expect(profile).not.toContain("MATRÍCULA DE MOTOTAXISTA");
   expect(privacy).not.toContain("mp.registration_number");
   expect(read("src/components/caronaa/QuickRideSearchActivity.tsx")).not.toContain("Matrícula informada");
 });
 it("exposes add and activate controls in the profile, never silently activates a new vehicle",()=>{
   expect(manager).toContain("Adicionar outro veículo");
   expect(manager).toContain("Usar este veículo");
   expect(manager).toContain('rpc("save_my_professional_vehicle"');
   expect(manager).toContain('rpc("activate_my_professional_vehicle"');
   expect(manager).toContain("isValidBrazilianPlate");
   expect(manager).toContain("window.dispatchEvent");
   expect(profile).toContain("<ProfessionalVehiclesManager");
   expect(profile).toContain("setProfileReload(value => value+1)");
   expect(profile).not.toContain("window.location.reload()");
   expect(account).toContain("vehicleFormManaged");
   expect(manager).not.toContain("overflow-y-auto");
 });
});
