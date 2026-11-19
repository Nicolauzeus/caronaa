import { describe, expect, it } from "vitest";
import {
  driverNavigationPhase, navigationDistanceMeters, distanceToNavigationPathMeters,
  needsDriverReroute, validNavigationPoint, estimateDriverRouteRemaining,
  navigationBearing, shortestHeadingDelta, projectNavigationPosition, snapVisualDriverPosition,
  upcomingNavigationManeuver, cameraLookAhead,
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
    expect(needsDriverReroute({current,start:origin,path,elapsedMs:30000,offRouteConfirmations:1,accuracyM:12})).toBe(false);
    expect(needsDriverReroute({current,start:origin,path,elapsedMs:12000,offRouteConfirmations:2,accuracyM:12})).toBe(true);
    expect(needsDriverReroute({current,start:origin,path,elapsedMs:9000,offRouteConfirmations:2,accuracyM:12})).toBe(false);
    expect(needsDriverReroute({current,start:origin,path,elapsedMs:70000,offRouteConfirmations:2,accuracyM:200})).toBe(true);
    expect(needsDriverReroute({current:origin,start:origin,path,elapsedMs:100000})).toBe(false);
    expect(needsDriverReroute({current:origin,start:origin,path,elapsedMs:181000})).toBe(true);
  });
});

describe("CARONAA F07 - heading, projection and navigation HUD",()=>{
  it("calculates geographic bearing and smallest rotation across north",()=>{
    expect(navigationBearing({lat:0,lng:0},{lat:0,lng:1})).toBeCloseTo(90);
    expect(navigationBearing({lat:0,lng:0},{lat:1,lng:0})).toBeCloseTo(0);
    expect(shortestHeadingDelta(350,10)).toBe(20);
    expect(shortestHeadingDelta(10,350)).toBe(-20);
    expect(navigationBearing(origin,origin)).toBeNull();
  });
  it("snaps a precise displayed marker but never a GPS fix >15m from road",()=>{
    const road=[{lat:-3.7,lng:-38.5},{lat:-3.7,lng:-38.49}];
    const near={lat:-3.70005,lng:-38.495};
    const snapped=snapVisualDriverPosition(near,road,10);
    expect(snapped?.point.lat).toBeCloseTo(-3.7,5);
    expect(snapped?.heading).toBeCloseTo(90);
    expect(snapVisualDriverPosition(near,road,70)).toBeNull();
    expect(snapVisualDriverPosition({lat:-3.702,lng:-38.495},road,10)).toBeNull();
    expect(projectNavigationPosition(near,road)?.distanceMeters).toBeLessThan(15);
  });
  it("sets perspective camera look-ahead and selects next turn along the road",()=>{
    const line=[{lat:0,lng:0},{lat:0,lng:0.001},{lat:0.001,lng:0.001}];
    const forward=cameraLookAhead(line[0],90,50);
    expect(forward.lng).toBeGreaterThan(0);
    const maneuver=upcomingNavigationManeuver(line[0],line,[{
      start:line[1],end:line[2],maneuver:"TURN_LEFT",instruction:"Vire à esquerda",
    }]);
    expect(maneuver?.instruction).toBe("Vire à esquerda");
    expect(maneuver?.distanceMeters).toBeGreaterThan(100);
  });
});
