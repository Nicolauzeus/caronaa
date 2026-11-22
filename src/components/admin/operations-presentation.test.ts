import {describe,expect,it} from "vitest";
import {calculateOperationsDisplay,PRESENTATION_ILLUSTRATIVE_REQUESTS} from "./operations-presentation";

const actual={
  orders:72,accepted:31,unaccepted:41,completed:21,cancelled:34,
  expired:16,in_progress:0,searching:1,other:0,
  cancelled_without_acceptance:24,cancelled_after_acceptance:10,
};
describe("operational dashboard disclosure and arithmetic",()=>{
  it("uses database values as-is in normal mode",()=>{
    const result=calculateOperationsDisplay(actual,false);
    expect(result.orders).toBe(72);
    expect(result.searching).toBe(1);
    expect(result.illustrativeOrders).toBe(0);
    expect(result.outcomesReconcile).toBe(true);
    expect(result.acceptanceReconciles).toBe(true);
    expect(result.cancellationsReconcile).toBe(true);
  });
  it("isolates the 108 hypothetical requests in presentation mode",()=>{
    const source={...actual};
    const display=calculateOperationsDisplay(actual,true);
    expect(PRESENTATION_ILLUSTRATIVE_REQUESTS).toBe(108);
    expect(display.orders).toBe(180);
    expect(display.searching).toBe(109);
    expect(display.unaccepted).toBe(149);
    expect(display.accepted).toBe(31);
    expect(display.completed).toBe(21);
    expect(display.cancelled).toBe(34);
    expect(display.expired).toBe(16);
    expect(display.realAcceptanceRate).toBeCloseTo(43.0555,3);
    expect(display.displayedAcceptanceRate).toBeCloseTo(17.2222,3);
    expect(display.outcomesReconcile).toBe(true);
    expect(display.cancellationsReconcile).toBe(true);
    expect(actual).toEqual(source);
  });
  it("does not invent active drivers, passengers, trips or revenue",()=>{
    const d=calculateOperationsDisplay(actual,true);
    expect(d.in_progress).toBe(0);
    expect(d.completed).toBe(actual.completed);
    expect(d.cancelled).toBe(actual.cancelled);
    expect(d.illustrativeOrders).toBe(108);
    expect(d.actualOrders).toBe(72);
  });
});
