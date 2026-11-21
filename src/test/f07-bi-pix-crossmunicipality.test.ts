import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page=readFileSync("src/routes/admin/operacoes.tsx","utf8");
const center=readFileSync("src/components/admin/F07OperationsCommandCenter.tsx","utf8");
const online=readFileSync("drizzle/migrations/0225_operations_online_pix_preservation.sql","utf8");
const dispatch=readFileSync("drizzle/migrations/0226_f07_municipality_independent_dispatch.sql","utf8");
const checkout=readFileSync("src/components/caronaa/QuickRidePostTripFlow.tsx","utf8");
const settlement=readFileSync("src/components/caronaa/QuickRideDriverSettlement.tsx","utf8");

describe("BI operations and recovered Pix",()=>{
  it("shows one BI and separates management operations",()=>{
    expect(page).toContain("BI de operações");
    expect(page).toContain("Gestão e exceções");
    expect(page).not.toContain('value="indicators"');
    for(const label of ["Motoristas online","Pedidos em espera","Corridas abertas","Corridas fechadas"]){
      expect(center).toContain(label);
    }
    expect(center).toContain("d.flash_online || d.presence_online");
  });
  it("counts online separately from readiness and does not require registered municipality",()=>{
    expect(online).toContain("coalesce(fl.is_online,false)=false AND coalesce(pr.is_available,false)=false");
    expect(online).not.toContain("THEN 'OUTSIDE_COVERAGE'");
    expect(dispatch).toContain("CREATE OR REPLACE FUNCTION public.respond_flash_order");
    expect(dispatch).toContain("CREATE OR REPLACE FUNCTION public.quick_ride_accept");
    expect(dispatch).toContain("<=15");
    expect(dispatch).toContain("15000");
    expect(dispatch).not.toContain("dispatch_enabled");
    expect(dispatch).not.toContain("public_discovery_enabled");
  });
  it("prevents empty Pix saves and preserves post-ride checkout until Pix is available",()=>{
    expect(online).toContain("Chave Pix vazia. Cadastro existente preservado.");
    expect(online).not.toContain("DELETE FROM public.driver_pix_settings");
    expect(settlement).toContain("onPixReady?.(Boolean(row.available&&row.key))");
    expect(checkout).toContain('role==="DRIVER"&&!driverPixReady');
    expect(checkout).toContain("Cadastre o Pix para continuar");
  });
});
