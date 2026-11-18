import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyF07RadarDbError, f07RadarAccuracyBand,
  f07RadarEvent, f07RadarFailureCode, f07RadarTraceId,
} from "./professional-radar-diagnostics";

describe("F07 — structured GPS diagnostics without leaking location or secrets",()=>{
  it("distinguishes errors returned by the publish_verified_professional_position SQL RPC",()=>{
    expect(classifyF07RadarDbError({code:"PGRST202",message:"function not found"}))
      .toBe("DB_FUNCTION_MISSING");
    expect(classifyF07RadarDbError({code:"42501",message:"permission denied for function"}))
      .toBe("DB_PERMISSION_DENIED");
    expect(classifyF07RadarDbError({code:"42501",message:"Motorista esta offline"}))
      .toBe("DB_DRIVER_OFFLINE");
    expect(classifyF07RadarDbError({code:"42501",message:"Motorista nao autorizado ou bloqueado por repasses"}))
      .toBe("DB_DRIVER_NOT_APPROVED");
    expect(classifyF07RadarDbError({code:"42501",message:"Municipio ainda nao habilitado para o radar"}))
      .toBe("DB_REGION_DISABLED");
    expect(classifyF07RadarDbError({code:"22023",message:"Posicao GPS invalida"}))
      .toBe("DB_LOCATION_INVALID");
    expect(classifyF07RadarDbError({code:"42703",message:"column absent"})).toBe("DB_SCHEMA_MISMATCH");
    expect(classifyF07RadarDbError({code:"23514",message:"check constraint"})).toBe("DB_CONSTRAINT_FAILED");
    expect(classifyF07RadarDbError({code:"42501",message:"Piloto F07 expirado; encerre a autorizacao temporaria"})).toBe("DB_DRIVER_NOT_APPROVED");
    expect(classifyF07RadarDbError({code:"99999",message:"unknown SQL exception"}))
      .toBe("DB_WRITE_FAILED");
    expect(classifyF07RadarDbError(null)).toBe("DB_WRITE_FAILED");
  });

  it("keeps F07 SQL UPSERT fixed and restricted to service_role",()=>{
    const sql=readFileSync("drizzle/migrations/0146_f07_fix_gps_schema_mismatch.sql","utf8");
    expect(sql).toContain("sampled_at=now(),updated_at=now()");
    expect(sql).toContain("TO service_role");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("public.driver_platform_access_allowed(p_user_id)");
    expect(sql).toContain("municipality=v_city,last_seen_at=now(),updated_at=now()");
    expect(sql).not.toContain("sampled_at=now,");
  });

  it("allows diagnostics for coarse fixes but blocks their public publication",async()=>{
    const { professionalRadarPointSchema } = await import("./professional-radar-geo");
    expect(professionalRadarPointSchema.safeParse({
      lat:-4.2,lng:-38.7,accuracyM:1500,traceId:"coarse01",
    }).success).toBe(true);
    expect(professionalRadarPointSchema.safeParse({
      lat:-4.2,lng:-38.7,accuracyM:6000,traceId:"invalid01",
    }).success).toBe(false);
    const page=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
    const sync=readFileSync("src/components/caronaa/ProfessionalRadarSync.tsx","utf8");
    expect(page).toContain("Online e transmitindo GPS");
    expect(page).toContain("accuracy>80");
    const server=readFileSync("src/lib/professional-radar.functions.ts","utf8");
    expect(server).toContain("GPS_LOW_ACCURACY");
    expect(sync).toContain("SYNC_GPS_LOW_ACCURACY");
    expect(sync).toContain("SYNC_RETRY_SCHEDULED");
  });

  it("copies only allowlisted safe fields into diagnostic events",()=>{
    const entry=f07RadarEvent("SERVER_PUBLISH_ERROR",{
      ref:"abc-123",code:"DB_PERMISSION_DENIED",accuracy:"21-100m",
      city:"Acarape",authorized:true,
      // Deliberately malicious data: none may enter console/copy output.
      lat:-4.2253,lng:-38.7306,token:"very-secret",email:"private@example.test",
    } as any);
    expect(entry.ref).toBe("abc-123");
    expect(entry.city).toBe("Acarape");
    expect(entry.accuracy).toBe("21-100m");
    expect(entry.authorized).toBe(true);
    expect(JSON.stringify(entry)).not.toContain("-4.2253");
    expect(JSON.stringify(entry)).not.toContain("-38.7306");
    expect(JSON.stringify(entry)).not.toContain("very-secret");
    expect(JSON.stringify(entry)).not.toContain("private@example.test");
  });

  it("reports accuracy in broad bands instead of precise coordinates",()=>{
    expect(f07RadarAccuracyBand(18)).toBe("0-20m");
    expect(f07RadarAccuracyBand(60)).toBe("21-100m");
    expect(f07RadarAccuracyBand(120)).toBe("101-1000m");
    expect(f07RadarAccuracyBand(1500)).toBe(">1000m");
    expect(f07RadarAccuracyBand(Number.NaN)).toBe("invalid");
  });

  it("extracts only a controlled error code and generates bounded trace IDs",()=>{
    expect(f07RadarFailureCode(new Error("Failure [F07:DB_PERMISSION_DENIED] (ref 1)")))
      .toBe("DB_PERMISSION_DENIED");
    expect(f07RadarFailureCode(new Error("Query contains password=abc")))
      .toBe("NETWORK_OR_SERVER_ERROR");
    expect(f07RadarTraceId()).toMatch(/^[a-zA-Z0-9_-]{6,40}$/);
  });

  it("maintains geolocation security boundaries while logging every backend stage",()=>{
    const server=readFileSync("src/lib/professional-radar.functions.ts","utf8");
    const page=readFileSync("src/components/caronaa/ProfessionalAvailabilityPage.tsx","utf8");
    const sync=readFileSync("src/components/caronaa/ProfessionalRadarSync.tsx","utf8");
    expect(server).toContain("reverseGeocodeRadarMunicipality(data.lat, data.lng)");
    expect(server).toContain("municipalityFromProfessionalGps(geo)");
    expect(server).toContain("p_user_id: context.userId");
    expect(server).toContain("db_publish_rejected");
    expect(server).toContain("dbAuthorizationRowApproved");
    expect(server).toContain("serviceRoleConfigured");
    expect(server).toContain("sqlState");
    expect(server).toContain("professional_radar_location_rate_gate");
    expect(page).toContain("SERVER_PUBLISH_ERROR");
    expect(page).toContain("GPS_BROWSER_ERROR");
    expect(page).toContain("Copiar diagnóstico sem GPS");
    expect(sync).toContain("SYNC_PUBLISH_ERROR");
    expect(sync).not.toContain("console.log(position.coords)");
    expect(server).not.toContain("console.log(data)");
    expect(server).not.toContain("console.error(savedError)");
  });
});
