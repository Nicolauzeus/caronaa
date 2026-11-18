import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(path,"utf8");

describe("CARONAA — cadastro de motorista só conclui quando completo",()=>{
  it("does not mark MOTORISTA onboarding completed before mandatory vehicle setup",()=>{
    const page=source("src/routes/onboarding.tsx");
    expect(page).toContain('if (selectedRole === "MOTORISTA")');
    expect(page).toContain('to: "/cadastro-veiculo"');
    expect(page).toContain('await completeOnboarding(saved)');
    const vehicle=source("src/routes/_authenticated/cadastro-veiculo.tsx");
    expect(vehicle).toContain('getVehicleStatus({');
    expect(vehicle).toContain('avatar && (!professionalPhotoTypes.includes');
    expect(vehicle).toContain('if (progress.status === "IN_PROGRESS") await completeOnboarding(progress)');
    expect(vehicle).toContain('active_role:"MOTORISTA"');
  });

  it("guards the profile at the database layer independently of the frontend",()=>{
    const sql=source("drizzle/migrations/0207_guard_shared_driver_activation.sql");
    for(const column of [
      "NEW.avatar_url","NEW.full_name","NEW.vehicle_brand",
      "NEW.vehicle_description","NEW.vehicle_color","NEW.vehicle_plate",
      "NEW.vehicle_type","NEW.vehicle_seats",
    ]) expect(sql).toContain(column);
    expect(sql).toContain("BEFORE UPDATE OF active_role ON public.profiles");
  });

  it("does not allow stale approved radar requests to claim current readiness",()=>{
    const sql=source("drizzle/migrations/0208_professional_current_readiness.sql");
    expect(sql).toContain("cardinality(v_missing)=0");
    expect(sql).toContain("p.vehicle_color");
    expect(sql).toContain("v_simple");
    const admin=source("src/components/admin/ProfessionalAccessQueue.tsx");
    expect(admin).toContain("currently_ready");
    expect(admin).toContain("Autorização registrada · dados atuais incompletos");
  });

  it("hides deleted accounts operationally but preserves historical requests",()=>{
    const sql=source("drizzle/migrations/0206_professional_queue_live_accounts.sql");
    expect(sql).toContain("DISTINCT ON (request.user_id)");
    expect(sql).toContain("JOIN auth.users existing");
    expect(sql).toContain("JOIN public.profiles existing_profile");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.professional_access_requests/i);
  });
});
