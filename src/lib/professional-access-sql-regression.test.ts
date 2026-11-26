import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");
const old=read("drizzle/migrations/0211_professional_access_missing_array_append.sql");
const sql=read("drizzle/migrations/0216_unified_driver_registration.sql");
const wizard=read("src/routes/cadastro-motorista.tsx");
const optional=read("drizzle/migrations/0218_f02_f07_optional_editable_whatsapp.sql");

describe("F07 cadastro único e progressivo",()=>{
  it("mantém a correção de array das validações de banco",()=>{
    // The migration documents the broken expression in a comment; check executable SQL.
    const executable=old.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
    expect(executable).not.toMatch(/v\s*:=\s*v\s*\|\|\s*'[A-Z_]+'/);
    expect((old.match(/array_append\(v, '[A-Z_]+'\)/g)||[]).length).toBeGreaterThanOrEqual(12);
  });
  it("não concede nova autorização sem WhatsApp, município e veículo",()=>{
    for(const expected of [
      "professional_driver_contacts","whatsapp_e164","p_municipality",
      "p_vehicle_plate","professional_auto_enable",
      "Dados pendentes: WHATSAPP,MUNICIPALITY","storage.objects",
      "ON CONFLICT (user_id) DO UPDATE","NOTIFY pgrst,'reload schema'",
    ])expect(sql).toContain(expected);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    // Regression for the malformed 0216: no duplicated PL/pgSQL body or
    // a dangling AND statement outside $automatic$.
    expect((sql.match(/CREATE OR REPLACE FUNCTION public\.professional_auto_enable\(/g)||[])).toHaveLength(1);
    expect((sql.match(/^\$automatic\$;$/gm)||[])).toHaveLength(1);
    expect(sql.indexOf("AND lower(btrim(c.municipality))")).toBeLessThan(sql.indexOf("$automatic$;"));
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.professional_auto_enable(");
    // Guard 42883 from repeated literal function signatures in ACL statements.
    expect(sql).toContain("v_routine regprocedure");
    expect(sql).toContain("p.pronargs=11");
    expect(sql).toContain("CREATE FUNCTION nao executado");
    expect(sql).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION %s TO authenticated");
    expect(sql).not.toContain("set_professional_presence");
  });
  it("0218 retira WhatsApp do gate, preservando validadores de veiculo e municipio",()=>{
    expect(optional).toContain("ALTER COLUMN whatsapp_e164 DROP NOT NULL");
    expect(optional).toContain("public.set_my_caronaa_whatsapp");
    expect(optional).toContain("public.get_my_caronaa_whatsapp");
    expect(optional).toContain("public.caronaa_normalize_whatsapp");
    expect(optional).toContain("Dados pendentes: MUNICIPALITY");
    expect(optional).not.toContain("Dados pendentes: WHATSAPP");
    expect(optional).not.toContain("array_append(v, 'WHATSAPP')");
    expect(optional).toContain("storage.objects");
    expect(optional).toContain("caronaa_f07_pilot_authorization_audit");
    expect(optional).toContain("professional_driver_authorizations");
    expect(optional.trim().endsWith("COMMIT;")).toBe(true);
  });
  it("exibe progresso e verifica habilitação no servidor antes do cockpit",()=>{
    expect(wizard).toContain('rpc("complete_professional_driver_registration"');
    expect(wizard).toContain('rpc("get_my_professional_access")');
    expect(wizard).toContain("supabase.auth.getUser()");
    expect(wizard).toContain("Etapa {stage + 1} de 4");
    expect(wizard).toContain("Próxima: ");
    expect(wizard).toContain("(stage + 1) * 25");
    expect(wizard).not.toContain('rpc("set_professional_presence"');
  });
});
