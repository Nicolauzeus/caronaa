import { describe, expect, it } from "vitest";
import {
  driverNavigationPhase, navigationDistanceMeters, distanceToNavigationPathMeters,
  needsDriverReroute, validNavigationPoint, estimateDriverRouteRemaining,
} from "./driver-navigation";

const origin={lat:-4.227,lng:-38.705};
const destination={lat:-4.231,lng:-38.699};
const path=[origin,{lat:-4.229,lng:-38.702},destination];

describe("motorista F07: navegação e controle de custo do Google",()=>{
  it("dirige ao embarque até validar o PIN; depois dirige ao destino",()=>{
    expect(driverNavigationPhase("SEARCHING")).toBeNull();
    expect(driverNavigationPhase("ACCEPTED")).toBe("PICKUP");
    expect(driverNavigationPhase("ARRIVED")).toBe("PICKUP");
    expect(driverNavigationPhase("IN_PROGRESS")).toBe("DROPOFF");
    expect(driverNavigationPhase("COMPLETED")).toBeNull();
    expect(driverNavigationPhase("PENDING_REVIEW")).toBeNull();
  });
  it("rejeita coordenadas inválidas, sem inventar localização",()=>{
    expect(validNavigationPoint(origin)).toBe(true);
    expect(validNavigationPoint({lat:NaN,lng:0})).toBe(false);
    expect(validNavigationPoint({lat:97,lng:0})).toBe(false);
    expect(validNavigationPoint(null)).toBe(false);
  });
  it("mede deslocamento real e desvio de rota em metros",()=>{
    expect(navigationDistanceMeters(origin,origin)).toBe(0);
    expect(navigationDistanceMeters(origin,destination)).toBeGreaterThan(500);
    expect(distanceToNavigationPathMeters(path[1],path)).toBeLessThan(2);
    expect(distanceToNavigationPathMeters({lat:-4.235,lng:-38.702},path)).toBeGreaterThan(200);
  });
  it("atualiza distância/ETA restantes localmente, sem novas chamadas ao Google",()=>{
    const route={routePath:path,distanceKm:0.95,durationMinutes:4};
    const atOrigin=estimateDriverRouteRemaining(origin,route);
    const halfway=estimateDriverRouteRemaining(path[1],route);
    const atDestination=estimateDriverRouteRemaining(destination,route);
    expect(atOrigin?.distanceKm).toBeCloseTo(0.95,2);
    expect(halfway?.distanceKm).toBeGreaterThan(0);
    expect(halfway?.distanceKm).toBeLessThan(0.95);
    expect(atDestination?.distanceKm).toBeCloseTo(0,2);
    expect(estimateDriverRouteRemaining({lat:-4.245,lng:-38.72},route)).toBeNull();
  });
  it("não faz nova chamada de Routes em cada pulso GPS",()=>{
    const current={lat:-4.235,lng:-38.702};
    expect(needsDriverReroute({current,start:origin,path,elapsedMs:30000})).toBe(false);
    expect(needsDriverReroute({current,start:origin,path,elapsedMs:70000})).toBe(true);
    expect(needsDriverReroute({current:origin,start:origin,path,elapsedMs:100000})).toBe(false);
    expect(needsDriverReroute({current:origin,start:origin,path,elapsedMs:181000})).toBe(true);
  });
});
