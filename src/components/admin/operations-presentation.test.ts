import {describe,expect,it} from "vitest";
import {allocateProportionally,calculateOperationsDisplay,projectRequestHistogram,ENABLE_OPERATIONS_PROJECTION,PRESENTATION_ILLUSTRATIVE_REQUESTS}
from "./operations-presentation";

const actual={
  orders:72,accepted:31,unaccepted:41,completed:21,cancelled:34,
  expired:16,in_progress:0,searching:1,other:0,
  cancelled_without_acceptance:24,cancelled_after_acceptance:10,
};
describe("CARONAA projected report remains labeled, separate and mathematically consistent",()=>{
  it("shows only recorded orders by default",()=>{
    expect(ENABLE_OPERATIONS_PROJECTION).toBe(false);
    expect(calculateOperationsDisplay(actual,ENABLE_OPERATIONS_PROJECTION).orders).toBe(72);
  });
  it("uses exactly the unchanged real numbers in normal mode",()=>{
    const value=calculateOperationsDisplay(actual,false);
    expect(value.orders).toBe(72);
    expect(value.searching).toBe(1);
    expect(value.completed).toBe(21);
    expect(value.cancelled).toBe(34);
    expect(value.illustrativeOrders).toBe(0);
    expect(value.outcomesReconcile).toBe(true);
    expect(value.acceptanceReconciles).toBe(true);
    expect(value.cancellationsReconcile).toBe(true);
  });
  it("distributes exactly +108 demonstrative requests proportionally across outcomes",()=>{
    const before={...actual},value=calculateOperationsDisplay(actual,true);
    expect(PRESENTATION_ILLUSTRATIVE_REQUESTS).toBe(108);
    expect(value.orders).toBe(180);
    expect(value.completed).toBe(53);
    expect(value.cancelled).toBe(85);
    expect(value.expired).toBe(40);
    expect(value.searching).toBe(2);
    expect(value.in_progress).toBe(0);
    expect(value.accepted).toBe(78);
    expect(value.unaccepted).toBe(102);
    expect(value.cancelled_without_acceptance).toBe(60);
    expect(value.cancelled_after_acceptance).toBe(25);
    expect(value.realAcceptanceRate).toBeCloseTo(43.05555,4);
    expect(value.displayedAcceptanceRate).toBeCloseTo(43.33333,4);
    expect(value.outcomesReconcile).toBe(true);
    expect(value.acceptanceReconciles).toBe(true);
    expect(value.cancellationsReconcile).toBe(true);
    expect(actual).toEqual(before);
  });
  it("distributes the same illustrative increment in 24 hourly bars and 168 heatmap cells",()=>{
    const hourly=Array.from({length:24},(_,hour)=>({hour,orders:hour+1,passengers:hour}));
    const cells=Array.from({length:168},(_,index)=>({weekday:Math.floor(index/24),hour:index%24,orders:index%9}));
    const projectedHourly=projectRequestHistogram(hourly,108);
    const projectedCells=projectRequestHistogram(cells,108);
    expect(projectedHourly.reduce((n,x)=>n+x.orders,0)).toBe(408);
    expect(projectedCells.reduce((n,x)=>n+x.orders,0)).toBe(cells.reduce((n,x)=>n+x.orders,0)+108);
    expect(hourly[0].orders).toBe(1);
    expect(cells[0].orders).toBe(0);
    expect(projectedHourly.map(x=>x.orders)).toEqual(projectRequestHistogram(hourly,108).map(x=>x.orders));
    expect(projectedCells.every((x,i)=>x.orders>=cells[i].orders)).toBe(true);
    expect(projectRequestHistogram(hourly,0)).toEqual(hourly);
  });
  it("handles rounding and different operational compositions",()=>{
    expect(allocateProportionally(108,[21,24,10,16,1,0,0])).toEqual([32,36,15,24,1,0,0]);
    expect(allocateProportionally(108,[1,1,1])).toEqual([36,36,36]);
    expect(allocateProportionally(2,[1,1,1])).toEqual([1,1,0]);
    expect(allocateProportionally(0,[1,1,1])).toEqual([0,0,0]);
  });
  it("uses waiting for an empty baseline instead of inventing completed rides",()=>{
    const empty=Object.fromEntries(Object.keys(actual).map(key=>[key,0])) as typeof actual;
    const value=calculateOperationsDisplay(empty,true);
    expect(value.orders).toBe(108);
    expect(value.searching).toBe(108);
    expect(value.unaccepted).toBe(108);
    expect(value.completed).toBe(0);
    expect(value.cancelled).toBe(0);
    expect(value.outcomesReconcile).toBe(true);
  });
  it("refuses to decorate inconsistent real status totals",()=>{
    const inconsistent={...actual,orders:73};
    const value=calculateOperationsDisplay(inconsistent,true);
    expect(value.illustrativeOrders).toBe(0);
    expect(value.orders).toBe(73);
    expect(value.outcomesReconcile).toBe(false);
  });
});
