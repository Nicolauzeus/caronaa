import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Functions = Database["public"]["Functions"];

describe("F07 permanent operation schema contract", () => {
  const sql = readFileSync("scripts/sql/f07-public-operation-permanent.proposed.sql", "utf8");
  it("models the permanent administrative switch without an expiry column", () => {
    expectTypeOf<Tables["caronaa_f07_operation_control"]["Row"]>().toEqualTypeOf<{
      id: boolean; enabled: boolean; updated_at: string;
    }>();
    expectTypeOf<Tables["caronaa_f07_operation_control"]["Insert"]>().toEqualTypeOf<{
      id?: boolean; enabled?: boolean; updated_at?: string;
    }>();
    const ddl = sql.match(/CREATE TABLE public\.caronaa_f07_operation_control \(([\s\S]*?)\n\);/)?.[1];
    expect(ddl).toBeDefined();
    expect(ddl).toContain("enabled boolean NOT NULL DEFAULT true");
    expect(ddl).not.toMatch(/expires_at|activated_at/i);
  });
  it("models the private administrative audit and new RPC signatures", () => {
    expectTypeOf<Tables["caronaa_f07_operation_control_events"]["Row"]>().toEqualTypeOf<{
      id: string; actor_id: string; previous_enabled: boolean; enabled: boolean;
      reason: string; created_at: string;
    }>();
    expectTypeOf<Functions["admin_set_f07_operation_enabled"]["Args"]>().toEqualTypeOf<{
      p_enabled: boolean; p_reason: string;
    }>();
    expectTypeOf<Functions["admin_set_f07_operation_enabled"]["Returns"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Functions["caronaa_f07_operation_dispatch_allowed"]["Args"]>().toEqualTypeOf<never>();
    expectTypeOf<Functions["caronaa_f07_operation_dispatch_allowed"]["Returns"]>().toEqualTypeOf<boolean>();
    expect(sql).toContain("CREATE FUNCTION public.admin_set_f07_operation_enabled(p_enabled boolean, p_reason text)");
    expect(sql).toContain("CREATE FUNCTION public.caronaa_f07_operation_dispatch_allowed()");
  });
  it("keeps commercial gates independent of the retired test switch", () => {
    const names = ["caronaa_quick_region_status", "caronaa_quick_submit_quoted", "guard_caronaa_quick_driver_assignment"];
    for (const name of names) {
      const body = sql.split("CREATE OR REPLACE FUNCTION public." + name + "(")[1]?.split("$function$;")[0];
      expect(body, name).toContain("public.caronaa_f07_operation_dispatch_allowed()");
      expect(body, name).not.toContain("public.caronaa_f07_test_dispatch_allowed()");
    }
    expect(sql).toContain("expires_at=now()+interval '30 minutes'");
    expect(sql).toContain("AS $retired$ SELECT false; $retired$;");
  });
});
