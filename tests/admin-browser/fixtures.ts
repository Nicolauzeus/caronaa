// Isolated visual-test data. This module is never imported by the application.
export const useAuth = () => ({
  user: {
    id: "visual-test",
    email: "admin@example.test",
    user_metadata: { full_name: "Admin de Teste" },
  },
  loading: false,
});
export const getAdminUsers = async () => [];
export const getAdminAccess = async () => ({ isAdmin: true });
export const getOperationalMetrics = async () => ({
  request: { eligibleRequests: 0, matchedRequests: 0, unmatchedRequests: 0, requestMatchRate: 0 },
  offer: { eligibleOffers: 0, utilizedOffers: 0, unmatchedOffers: 0, offerMatchRate: 0 },
  match: { total: 0, completed: 0, cancelled: 0, averageMinutesToMatch: null },
  seats: { availableSeats: null, occupiedSeats: null, seatFillRate: null },
});
export const getFormMetrics = async () => ({
  totals: { started: 0, completed: 0, leads: 0, completionRate: null },
});
export const getMainFunnelMetrics = async () => ({ stages: [], cohortSize: 0 });
export const getRetentionMetrics = async () => ({
  repeatRate7d: 0,
  repeatRate30d: 0,
  distribution: { one: 0, two: 0, threeToFive: 0, sixOrMore: 0 },
});
export const loadAdminOperations = async () => ({
  requests: [],
  offers: [],
  rides: [],
  reviews: [],
});

function query() {
  return new Proxy(
    {},
    {
      get: (_, key) =>
        key === "then"
          ? (resolve: (value: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(resolve)
          : () => query(),
    },
  );
}
const channel = { on: () => channel, subscribe: () => channel };
export const supabase = {
  from: query,
  rpc: async () => ({ data: [], error: null }),
  channel: () => channel,
  removeChannel: async () => undefined,
};
