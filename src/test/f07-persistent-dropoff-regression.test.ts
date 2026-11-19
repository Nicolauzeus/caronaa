import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const migration = source("drizzle/migrations/0215_f07_persistent_passenger_dropoff_confirmation.sql");
const prompt = source("src/components/caronaa/QuickRidePendingDropoffPrompt.tsx");
const appShell = source("src/components/caronaa/AppShell.tsx");
const passenger = source("src/components/caronaa/QuickRideHomePanel.tsx");
const driver = source("src/components/caronaa/QuickRideDriverQueue.tsx");
const history = source("src/routes/_authenticated/viagens-profissionais.tsx");

describe("F07 persistent passenger dropoff and bounded review", () => {
  it("extends the bilateral request from 120 seconds to 10 minutes without auto-approving", () => {
    expect(migration).toContain("participant_only");
    expect(migration).toContain("now()+interval '10 minutes'");
    expect(migration).toContain("requested_at+interval '10 minutes'");
    expect(migration).not.toContain("now()+interval '120 seconds'");
    expect(migration).toContain("d.passenger_response IS NULL AND d.resolved_at IS NULL");
    expect(migration).toContain("d.admin_decision IS NULL");
  });

  it("recovers a pending answer from the passenger's account on any page", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.quick_ride_pending_dropoff()");
    expect(migration).toContain("q.passenger_id=auth.uid()");
    expect(migration).toContain("q.status IN ('IN_PROGRESS','PENDING_REVIEW')");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.quick_ride_pending_dropoff() FROM PUBLIC,anon");
    expect(prompt).toContain('rpc("quick_ride_pending_dropoff")');
    expect(prompt).toContain('rpc("quick_ride_respond_dropoff"');
    expect(prompt).toContain('respond("CONFIRMED")');
    expect(prompt).toContain('respond("NOT_YET")');
    expect(prompt).toContain('respond("CONTESTED")');
    expect(prompt).toContain("window.addEventListener(\"focus\",foreground)");
    expect(prompt).toContain('document.addEventListener("visibilitychange",foreground)');
    expect(appShell).toContain("<QuickRidePendingDropoffPrompt userId={user.id} />");
    expect(passenger).toContain('caronaa:quick-ride-dropoff-updated');
  });

  it("only sends an unanswered review to admin after the deadline", () => {
    expect(migration).toContain("d.deadline_at<=now()");
    expect(migration).toContain("(d.passenger_response='CONTESTED' OR d.deadline_at<=now())");
    expect(migration).toContain("quick_ride_finalize_after_timeout");
    expect(migration).toContain("q.status NOT IN ('IN_PROGRESS','PENDING_REVIEW')");
    expect(migration).toContain("SET resolved_at=coalesce(resolved_at,now())");
    expect(migration).toContain("SET status='PENDING_REVIEW',completed_at=NULL");
    expect(migration).not.toContain("SET status='COMPLETED',completed_at=now()");
  });

  it("keeps driver cockpit and history clear until confirmation or review", () => {
    expect(driver).toContain("Aguardando confirmação do passageiro");
    expect(driver).toContain("A solicitação permanece disponível quando ele abrir o app.");
    expect(history).toContain("Aguardando confirmação / análise");
  });
});
