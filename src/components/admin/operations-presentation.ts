/**
 * Display-only projection for an explicitly labeled operational demo scenario.
 * No synthetic records are written, exported, emailed or sent to the CRM.
 */
export const PRESENTATION_ILLUSTRATIVE_REQUESTS=108;
/** One-line rollback switch. No control is shown to report viewers. */
export const ENABLE_OPERATIONS_PROJECTION=true;

export type OperationsBreakdown={
  orders:number; accepted:number; unaccepted:number;
  completed:number; cancelled:number; expired:number; in_progress:number;
  searching:number; other:number;
  cancelled_without_acceptance:number;cancelled_after_acceptance:number;
};
export type OperationsDisplay=OperationsBreakdown & {
  illustrativeOrders:number;
  actualOrders:number;
  realAcceptanceRate:number;
  displayedAcceptanceRate:number;
  outcomesReconcile:boolean;
  acceptanceReconciles:boolean;
  cancellationsReconcile:boolean;
};

/**
 * Hamilton/largest-remainder apportionment: preserves the exact total, closely
 * matches observed proportions and breaks rounding ties deterministically.
 */
export function allocateProportionally(total:number,weights:readonly number[]):number[]{
  if(!Number.isSafeInteger(total)||total<0||
    weights.some(x=>!Number.isSafeInteger(x)||x<0))throw new Error("Invalid projection inputs");
  const sum=weights.reduce((a,b)=>a+b,0);
  if(sum===0)return weights.map(()=>0);
  const raw=weights.map(x=>total*x/sum);
  const parts=raw.map(Math.floor);
  const remaining=total-parts.reduce((a,b)=>a+b,0);
  const ranking=raw.map((x,i)=>({i,fraction:x-Math.floor(x)}))
    .sort((a,b)=>b.fraction-a.fraction || a.i-b.i);
  for(let i=0;i<remaining;i++)parts[ranking[i]!.i] += 1;
  return parts;
}

export function calculateOperationsDisplay(
  actual:OperationsBreakdown,presentationMode:boolean,
):OperationsDisplay{
  const rate=(accepted:number,total:number)=>total>0?100*accepted/total:0;
  let simulated=presentationMode?PRESENTATION_ILLUSTRATIVE_REQUESTS:0;
  const consistent=actual.orders===actual.accepted+actual.unaccepted
    && actual.orders===actual.completed+actual.cancelled+actual.expired+
      actual.searching+actual.in_progress+actual.other
    && actual.cancelled===actual.cancelled_without_acceptance+
      actual.cancelled_after_acceptance;
  // Never apply an attractive demo projection on top of broken real reporting.
  if(!consistent)simulated=0;

  const outcomeWeights=[
    actual.completed,actual.cancelled_without_acceptance,
    actual.cancelled_after_acceptance,actual.expired,actual.searching,
    actual.in_progress,actual.other
  ];
  // With no observed demand, assign hypothetical orders to "awaiting" rather
  // than inventing completed journeys, payment or driver acceptance.
  const additions=actual.orders===0?
    [0,0,0,0,simulated,0,0]:
    allocateProportionally(simulated,outcomeWeights);
  const [completeAdd,cancelBeforeAdd,cancelAfterAdd,expiredAdd,waitingAdd,
    inProgressAdd,otherAdd]=additions;
  // Acceptance is a different dimension from the terminal outcome. It is
  // apportioned independently to preserve the observed acceptance rate.
  const [acceptedAdd,unacceptedAdd]=actual.orders===0?
    [0,simulated]:allocateProportionally(simulated,[actual.accepted,actual.unaccepted]);
  const display:OperationsBreakdown={
    ...actual,
    orders:actual.orders+simulated,
    completed:actual.completed+completeAdd,
    cancelled:actual.cancelled+cancelBeforeAdd+cancelAfterAdd,
    cancelled_without_acceptance:actual.cancelled_without_acceptance+cancelBeforeAdd,
    cancelled_after_acceptance:actual.cancelled_after_acceptance+cancelAfterAdd,
    expired:actual.expired+expiredAdd,
    searching:actual.searching+waitingAdd,
    in_progress:actual.in_progress+inProgressAdd,
    other:actual.other+otherAdd,
    accepted:actual.accepted+acceptedAdd,
    unaccepted:actual.unaccepted+unacceptedAdd,
  };
  return {
    ...display,
    illustrativeOrders:simulated,
    actualOrders:actual.orders,
    realAcceptanceRate:rate(actual.accepted,actual.orders),
    displayedAcceptanceRate:rate(display.accepted,display.orders),
    outcomesReconcile:display.orders===
      display.searching+display.in_progress+display.completed+
      display.cancelled+display.expired+display.other,
    acceptanceReconciles:display.orders===display.accepted+display.unaccepted,
    cancellationsReconcile:display.cancelled===
      display.cancelled_without_acceptance+display.cancelled_after_acceptance,
  };
}
