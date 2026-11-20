import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";

const sql=readFileSync("drizzle/migrations/0220_f02_f07_optional_home_region.sql","utf8");
const wizard=readFileSync("src/routes/cadastro-motorista.tsx","utf8");
const access=readFileSync("src/components/caronaa/ProfessionalAccessRequest.tsx","utf8");
const radar=readFileSync("drizzle/migrations/0217_f07_cross_municipality_radius_dispatch.sql","utf8");

describe("F02/F07 optional declared region contract",()=>{
  it("makes all three profile-only regional fields nullable without changing operational zones",()=>{
    for(const table of ["professional_access_requests","professional_driver_contacts","professional_mototaxi_profiles"])
      expect(sql).toContain("ALTER TABLE public."+table);
    expect(sql).toContain("ALTER COLUMN region_code DROP NOT NULL");
    expect(sql).not.toContain("UPDATE public.professional_quick_rides");
    expect(sql).not.toContain("UPDATE public.professional_service_regions");
  });
  it("keeps server-side authorization, storage-photo and vehicle gates",()=>{
    for(const key of ["auth.uid()","email_confirmed_at","storage.objects","professional_driver_authorizations",
      "caronaa_f07_pilot_authorization_audit","REJECTED","CHANGES_REQUESTED","VEHICLE_MODEL","PLATE"])
      expect(sql).toContain(key);
    expect(sql).not.toContain("Dados pendentes: MUNICIPALITY");
  });
  it("accepts a blank form region while preserving driver coverage by GPS",()=>{
    expect(wizard).toContain("p_municipality: municipality.trim() || null");
    expect(wizard).not.toContain('m.municipality = "Escolha seu município nas sugestões."');
    expect(access).toContain("p_municipality: city.trim() || null");
    expect(access).not.toContain('local.push("MUNICIPALITY")');
    expect(radar).toContain(")))<=15");
    expect(radar).toContain("pickup_city.municipality=q.municipality");
  });
});
