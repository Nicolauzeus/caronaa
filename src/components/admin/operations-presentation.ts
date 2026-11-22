/**
 * Operations reporting display projection.
 * Never write illustrative data to PostgreSQL, mutate real analytics, or send it
 * through the real CSV/email/WhatsApp paths.
 */
export const PRESENTATION_ILLUSTRATIVE_REQUESTS=108;

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

export function calculateOperationsDisplay(
  actual:OperationsBreakdown,
  presentationMode:boolean,
):OperationsDisplay{
  const simulated=presentationMode?PRESENTATION_ILLUSTRATIVE_REQUESTS:0;
  const display:OperationsBreakdown={
    ...actual,
    orders:actual.orders+simulated,
    searching:actual.searching+simulated,
    unaccepted:actual.unaccepted+simulated,
    // Newly simulated requests are ONLY awaiting a driver; no invented
    // acceptance, completion, cancellation, expiry, revenue or presence.
  };
  const rate=(accepted:number,total:number)=>total>0?(accepted/total)*100:0;
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
