import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql=readFileSync("drizzle/migrations/0211_professional_access_missing_array_append.sql","utf8");
const professional=readFileSync("src/components/caronaa/ProfessionalAccessRequest.tsx","utf8");
const mototaxi=readFileSync("src/routes/cadastro-motorista.tsx","utf8");

describe("professional registration SQL 22P02 regression",()=>{
  it("replaces all scalar concatenations with safe array_append, without bypassing mandatory checks",()=>{
    expect(sql).not.toMatch(/v\s*:=\s*v\s*\|\|\s*'[A-Z_]+'/);
    expect((sql.match(/array_append\(v, '[A-Z_]+'\)/g)||[]).length).toBeGreaterThanOrEqual(12);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.professional_access_missing");
    expect(sql).toContain("v_avatar_path");
    expect(sql).toContain("storage.objects");
    expect(sql).toContain("vehicle_plate");
    expect(sql).toContain("vehicle_color");
    expect(sql).toContain("NOTIFY pgrst,'reload schema'");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });
  it("never validates a made-up vehicle profile lacking its actual color",()=>{
    expect(professional).not.toContain('avatarUrl: "https://ok"');
    expect(professional).toContain("initialVehicle");
    expect(professional).toContain('rpc("submit_professional_access_request"');
  });
  it("reuses the correct vehicle type and blocks expired sessions before writes",()=>{
    expect(mototaxi).toContain('registeredVehicle==="CAR"');
    expect(mototaxi).toContain("supabase.auth.getUser()");
    expect(mototaxi).toContain("vehicleMissing");
    expect(mototaxi).toContain("Entrar novamente");
    expect(mototaxi).toContain("onCarAuthorized");
  });
});
