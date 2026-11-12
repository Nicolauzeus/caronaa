import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0142_radar_corredor_localizacao_verificada.sql", "utf8");
const page = readFileSync("src/routes/_authenticated/disponibilidade-profissional.tsx", "utf8");
const sync = readFileSync("src/components/caronaa/ProfessionalRadarSync.tsx", "utf8");
const server = readFileSync("src/lib/professional-radar.functions.ts", "utf8");

describe("F07 corridor radar migration safety contracts", () => {
  it("explicitly approves only the eight requested CE-060 core cities", () => {
    const approved = sql.split("INSERT INTO public.professional_service_regions")[1]?.split("ON CONFLICT")[0] ?? "";
    for (const city of [
      "Fortaleza", "Maracanaú", "Pacatuba", "Guaiúba",
      "Acarape", "Redenção", "Aracoiaba", "Baturité",
    ]) expect(approved).toContain("'" + city + "',true,false");
    for (const excluded of ["Itaitinga", "Eusébio", "Caucaia", "Recife"]) {
      expect(approved).not.toContain("'" + excluded + "'");
    }
    expect(sql).not.toMatch(/UPDATE public\.caronaa_service_municipalities\s+SET[^;]*enabled\s*=\s*true/i);
  });

  it("keeps commercial tariffs, dispatch and intermunicipal trips unchanged", () => {
    expect(sql).toContain("public_discovery_enabled=true");
    expect(sql).toContain("v_commercial := enabled AND r.dispatch AND r.radar");
    expect(sql).toContain("'status',CASE WHEN v_commercial THEN 'ENABLED' ELSE 'WAITLIST'");
    expect(sql).not.toMatch(/SET\s+published\s*=\s*true/i);
    expect(sql).not.toMatch(/SET\s+dispatch_enabled\s*=\s*true/i);
    expect(sql).not.toMatch(/SET\s+intermunicipal_enabled\s*=\s*true/i);
  });

  it("does not trust a profile region, client city or forged user ID for GPS publication", () => {
    expect(server).toContain("reverseGeocodeService(data.lat, data.lng)");
    expect(server).toContain("municipalityFromProfessionalGps(geo)");
    expect(server).toContain("p_user_id: context.userId");
    expect(server).toContain("professional_radar_location_rate_gate");
    expect(server).toContain("access.data?.authorized !== true");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.publish_verified_professional_position(");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.professional_location_opt_in(");
    expect(sql).toContain("public.driver_platform_access_allowed(p_user_id)");
  });

  it("preserves consent, offline and 90-second approximate discovery", () => {
    expect(page).toContain("professionalRadarConsentKey");
    expect(sync).toContain('window.localStorage.getItem(professionalRadarConsentKey(userId)) !== "yes"');
    expect(sync).toContain("presence.data?.is_available !== true");
    expect(page).toContain('p_municipality:null');
    expect(sync).toContain("p_municipality: null");
    expect(sql).toContain("round(l.lat::numeric,2)");
    expect(sql).toContain("AND l.updated_at>now()-interval '90 seconds'");
    expect(sql).toContain("AND p.last_seen_at>now()-interval '90 seconds'");
    expect(sql).toContain("r.public_discovery_enabled");
    expect(sql).toContain("a.approved AND a.vehicle_type=p_vehicle");
    expect(sql).toContain("l.user_id<>auth.uid()");
    expect(page).not.toContain(".rpc(\"professional_location_opt_in\"");
    expect(sync).not.toContain(".rpc(\"professional_location_opt_in\"");
  });

  it("has one transaction and balanced dollar quote delimiters", () => {
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect((sql.match(/^BEGIN;$/gm)??[]).length).toBe(1);
    expect((sql.match(/^COMMIT;$/gm)??[]).length).toBe(1);
    for (const tag of ["gate","publish","discover","status"]) {
      expect((sql.match(new RegExp("\\$"+tag+"\\$", "g"))??[]).length).toBe(2);
    }
  });
});
