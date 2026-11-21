import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("drizzle/migrations/0228_passenger_demand_waiting_bi.sql","utf8");
const ui=readFileSync("src/components/caronaa/QuickRideHomePanel.tsx","utf8");
const sheet=readFileSync("src/components/caronaa/shell/FlashPassengerLiveSheet.tsx","utf8");
const admin=readFileSync("src/components/admin/F07OperationsCommandCenter.tsx","utf8");

describe("F07 demand without online drivers",()=>{
  it("accepts a valid price without requiring an online driver",()=>{
    expect(ui).toContain("Solicitar e aguardar motorista");
    expect(ui).not.toContain("driverCount<1||!currentQuote");
    expect(ui).toContain('rpc("caronaa_passenger_demand_heartbeat"');
  });
  it("keeps a single authoritative pending search for up to 30 minutes",()=>{
    expect(sql).toContain("public.caronaa_quick_submit_quoted(p_quote_id uuid)");
    expect(sql).toContain("expires_at=now()+interval '30 minutes'");
    expect(sql).toContain("public.quick_ride_request(");
    expect(sql).toContain("WHERE id=r_id AND passenger_id=auth.uid() AND status='SEARCHING'");
    expect(sheet).toContain("Pedido ativo. Aguardando motorista");
    expect(sheet).toContain("Você pode cancelar a qualquer momento");
  });
  it("counts preparing passengers and accepted pending demand without sharing GPS",()=>{
    expect(sql).toContain("caronaa_passenger_demand_presence");
    expect(sql).toContain("last_seen_at>now()-interval '90 seconds'");
    expect(sql).toContain("'preparing'");
    expect(sql).toContain("'waiting_passengers'");
    expect(sql).toContain("'waiting'");
    expect(sql).not.toContain("origin_lat");
    expect(admin).toContain("Passageiros preparando");
    expect(admin).toContain("passenger_demand.waiting_passengers");
  });
});
