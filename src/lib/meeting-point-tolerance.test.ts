import { describe, expect, it } from "vitest";
import { calculateRemainingWaitTime, STRICT_MEETING_TOLERANCE_MINUTES } from "./meeting-point-tolerance";

describe("tolerância do encontro estrito", () => {
  const start = "2026-11-07T20:00:00.000Z";
  const at = (seconds: number) => new Date(Date.parse(start) + seconds * 1000);
  it("usa exatamente oito minutos", () => expect(STRICT_MEETING_TOLERANCE_MINUTES).toBe(8));
  it("começa em 08:00", () => expect(calculateRemainingWaitTime(start, at(0))).toEqual({minutes:8,seconds:0,isExpired:false}));
  it("mantém 00:01 aos 07:59", () => expect(calculateRemainingWaitTime(start, at(479))).toEqual({minutes:0,seconds:1,isExpired:false}));
  it("expira em 08:00", () => expect(calculateRemainingWaitTime(start, at(480))).toEqual({minutes:0,seconds:0,isExpired:true}));
  it("permanece expirado depois", () => expect(calculateRemainingWaitTime(start, at(650))).toEqual({minutes:0,seconds:0,isExpired:true}));
  it("rejeita horário inválido ou futuro", () => {
    expect(() => calculateRemainingWaitTime("oops", at(4))).toThrow();
    expect(() => calculateRemainingWaitTime(start, at(-1))).toThrow();
  });
});
