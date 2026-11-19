import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryAcquireProfessionalRadarLease } from "./professional-radar-lease";

describe("F07 professional radar cross-tab lease",()=>{
  beforeEach(()=>{window.localStorage.clear();vi.useRealTimers();});
  it("prevents a duplicate while one publisher owns the lease",()=>{
    const release=tryAcquireProfessionalRadarLease("driver-one");
    expect(release).toBeTypeOf("function");
    expect(tryAcquireProfessionalRadarLease("driver-one")).toBeNull();
    expect(tryAcquireProfessionalRadarLease("driver-two")).toBeTypeOf("function");
    release?.();
    expect(tryAcquireProfessionalRadarLease("driver-one")).toBeTypeOf("function");
  });
  it("expires abandoned leases without blocking GPS forever",()=>{
    vi.useFakeTimers();
    const release=tryAcquireProfessionalRadarLease("driver-one");
    expect(tryAcquireProfessionalRadarLease("driver-one")).toBeNull();
    vi.advanceTimersByTime(30001);
    const next=tryAcquireProfessionalRadarLease("driver-one");
    expect(next).toBeTypeOf("function");
    release?.(); // Stale owner must not remove newer owner's lease.
    expect(tryAcquireProfessionalRadarLease("driver-one")).toBeNull();
    next?.();
    vi.useRealTimers();
  });
});
