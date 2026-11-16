import { describe, expect, it } from "vitest";
import { mapQuickRadarDrivers } from "./quick-radar-markers";

const now=new Date().toISOString();
const key="1a".repeat(16);
const anotherKey="2b".repeat(16);

describe("F07 approximate professional markers",()=>{
  it("uses only authenticated RPC coordinates and the selected authorized vehicle type",()=>{
    expect(mapQuickRadarDrivers([{
      driver_key:key,lat:-4.22,lng:-38.72,seen_at:now,
    }],"MOTO")).toEqual([{
      driver_key:key,lat:-4.22,lng:-38.72,seen_at:now,
      is_self:false,vehicle_type:"MOTO",
    }]);
  });
  it("never synthesizes GPS positions for an empty or malformed radar response",()=>{
    expect(mapQuickRadarDrivers(null,"CAR")).toEqual([]);
    expect(mapQuickRadarDrivers([{driver_key:key,lat:null,lng:null,seen_at:now}],"CAR")).toEqual([]);
    expect(mapQuickRadarDrivers([{driver_key:key,lat:999,lng:-38.7,seen_at:now}],"CAR")).toEqual([]);
    expect(mapQuickRadarDrivers([{driver_key:key,lat:-4.2,lng:-38.7,seen_at:"not a timestamp"}],"CAR")).toEqual([]);
  });
  it("drops flagged self/simulated markers and duplicate identities",()=>{
    const point={driver_key:key,lat:-4.2,lng:-38.7,seen_at:now};
    const second={driver_key:anotherKey,lat:-4.3,lng:-38.8,seen_at:now};
    const mapped=mapQuickRadarDrivers([
      {...point,is_self:true},
      {...point,simulated:true},
      second,second,
    ],"CAR");
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.driver_key).toBe(anotherKey);
    expect(mapped[0]?.vehicle_type).toBe("CAR");
  });
});
