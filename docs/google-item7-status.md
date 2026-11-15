# Google item 7 — delivery status

## Module and current status

F07/F08 infrastructure: **partial**, not a completed all-caller migration.

The approved SQL was applied as 0125, followed by the separately approved 0126 grants correction. Readback confirms both new tables have RLS and no anon/authenticated read/write access; service_role retains access. Existing usage logs now allow admin SELECT only. Historical migration files were not modified.

## Changes/files

- `src/lib/google-request-policy.ts`: 30 autocomplete / 10 quote / 20 details requests per minute, 5-second timeout, 30-day searchText and 10-minute route cache lifetimes.
- `src/lib/google-request.server.ts`: authenticated server wrapper, atomic database gate, one retry only for 5xx, classified 403 handling, no retry for 429/network/timeout, swallowed logging failures.
- `src/lib/municipality.functions.ts`: authenticated municipality autocomplete/details use the wrapper and session identity.
- `src/lib/google-cache.server.ts`: private database cache primitives, user-scoped hashes and expiry; not activated for Google payloads pending storage/attribution review.
- Two corresponding test files, generated database types, approved migrations and roadmap.
- Secret replacement completed through secure form; no private value copied to source. Publish required for existing production deployment to use replacement.

Runtime inspection confirms Nitro Cloudflare `augmentReq` binds `request.waitUntil`; the wrapper uses that when present. Dev/other adapters use best-effort logging without awaiting. Actual deployed background-log readback remains unverified.

## Tests/results

23 tests passed (wrapper, cache, municipality parsing); latest automatic signal: build OK. Tests use isolated dependencies, do not claim live Google success or actual database concurrency. Historical self-marker static regression failed in both current code and b72a776. Earlier Flash UI test failure remains outside this partial cost-control implementation.

## Pending risks / blockers

- Anonymous F01 location/map calls retain their pre-existing path until a public budget and complete SQL are explicitly approved. No new anonymous proxy was created and no login was required. These existing calls are NOT yet covered by the new database cost gate.
- Authenticated offer/passenger/group/quick quotes, approach ETA, multi-stop planning, detour/opportunity checks and pickup references/walking now use `googleActionFetch`. Concurrent route legs and address lookups share one atomic action gate, with a maximum of 16 provider requests per action. Separate actions never reuse permission.
- Public location/map server functions verify an optional bearer before applying authenticated limits; invalid or expired credentials cannot downgrade to the anonymous path. Places tokens and field masks are preserved. Sessionless queries still need anonymous protection.
- Cache storage/attribution terms need confirmation before activating 30-day Google search payload persistence. Geometry caching must never bypass authorization or reuse a stale fare snapshot.
- No DB concurrency execution or authenticated end-to-end Google flow was run. Google testing requires an authorized deployed origin.
- D requires reconciliation with README: tracking an accepted ride privately must be separate from discovering/accepting new calls outside coverage; no stale municipality may be presented as current.
- Root AGENTS.md is already above the tool size budget; the attempted new technical note was rejected and not saved there.

## README alignment / untouched scope

README preserved. No changes to radar coverage, consent, GPS, payment/rating lifecycle, public research access, tariffs or publication. Items 4–6 and 8 were not implemented. No assertion that item 7 or the whole ride flow is complete.

## Integration verification — 15 November 2026

Modules F01/F03/F05/F06/F07/F08: partial cost-control integration; public forms remain anonymous, shared fares still use road distance at R$6/11 km, participant checks occur before privileged trip reads, no database changes applied in this task.

Changed: `google-request.server.ts`, new `google-search-access.server.ts`, location provider/service/functions, map preview, offer/passenger/group pricing, multi-stop/detour/opportunity/pickup and quick-ride quote/approach functions, related tests and roadmap/agent guidance.

17 focused test files / 114 tests passed. Covers parallel-leg single consumption, denied-budget fail-closed, separate-action isolation, outbound bounds, optional-session verification, road units/geometry, fare persistence and participant privacy. Automatic build signal at 21:06:42 UTC: OK. No live Google API/rendering checks, no hosted multi-account ride flow and no claimed actual usage/cost reduction measurements.

Pending: choose anonymous daily budget and approve full SQL before adding atomic anonymous session/global counters; then wire that gate and test concurrent limits. Retaining the old public path until approval avoids silently breaking published research links but does not fix its existing cost exposure. Cache payload persistence remains disabled pending provider terms review; no fake identities or auth users will represent anonymous sessions.