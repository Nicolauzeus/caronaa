- [ ] F07 passenger mobile: automatic parallel Car/Moto quotes, approximate pickup preview with explicit confirmation, fixed itinerary/action and responsive sheet; preserve server eligibility and fares, run regression and signed-in checks.
- [x] Google credential setup: replaced both keys securely, removed public REST fallback and added async map loading/channel. 56 focused tests passed; automatic build OK. No database or product-rule changes.
- [ ] Google deployed validation: publish updated keys, then validate maps, Places and Routes on the authorized CARONAA domain; live Google checks are unavailable in the agent sandbox.
- [x] F07/Google: Audited policies/view grants, migration ordering and historical self-radar regression; complete proposed SQL presented for approval, with no database mutations.
- [ ] F07: Separate trip tracking from new-dispatch coverage checks without weakening public discovery; resolve README coverage conflict before implementation.
- [x] Google item 7 integration: Authenticated routes/Places use one action budget across bounded legs; anonymous searches/map previews use approved 0127, 2,000 attempts/day (Fortaleza), private session hash/cookie and atomic counters. Grants/RLS readback verified, 125 tests passed, automatic build OK. Cache persistence remains disabled; live Google behavior, real DB concurrency and automated cleanup remain unverified/pending. Do not implement items 4–6 or 8.
- [x] Replaced GOOGLE_MAPS_API_KEY via secure secret form, without writing a committed private value. Published app needs publishing to pick up replacement.
- [x] F02/F07: Operations tabs, real-request detail dialog and missing-data approval guards; shared authenticated Google municipality selection for access, availability and pilot configuration. 20 tests pass, build OK, signed-in real request and mobile UI verified without decisions or publishing. Live Google selection and a new pending-request decision remain unverified; Google checks require an authorized deployed origin.
- [ ] Repair public research deep links; verify anonymous direct access, refresh, submission, disabled forms and app guards without production publishing or historical mutations.
- [x] Rebuild the sign-in screen from the supplied visual reference.
- [x] Add persistent light and dark modes across the app and admin area.
- [x] Verify administrator access uses the secure database role.
- [x] Create CARONAA visual identity and shared navigation.
- [x] Build landing, home, search, offer, rides, profile, and validation placeholder routes with centralized sample data.
- [x] Verify route navigation and responsive rendering.
- [x] Add email and Google authentication, password recovery, and user profiles.

- [x] Apply the supplied CARONAA logo and desktop/mobile backgrounds.
- [x] Replace demo admin access with database-backed role access.
- [x] Remove existing users and make only the first new signup an administrator.

12. [x] Repair automatic road-distance passenger fares and secure persistence; supersedes manual fares and fees. Corrected through migration 0050 without rewriting read-only history; database permissions verified. 47 unit/service tests and 17 isolated database assertions passed through quote, bilateral acceptance, PIN boarding, completion and group Pix.
13. [ ] Remove familiarity/family-based matching prompts and keep objective safety criteria only.
23. [x] New one-time offers calculate and persist road fares while composing, show full-route prices in discovery and automatically quote passenger segments before acceptance. Publication consents to driver acceptance; passenger acceptance confirms after trusted quoting. 50 tests and 25 isolated database assertions passed, including historical bilateral preservation. Signed-in offer screen verified a real 3.59 km / R$1.96 quote and enabled publication without publishing a real ride. Full two-account hosted UI flow remains unverified; routines, STS and older offers retain the existing bilateral flow.
14. [x] Restore STS account linking and first-publication functions in the active database; authenticated home loads without the missing-function error (publication with a linked response remains unverified).
15. [x] Repair offer/request runtime failures, preserve audience preference, and verify publication and readback through the UI.
16. [x] Persist consented travel preferences, snapshot/override on offers, requests and routines; enforce hard rules and rank soft preferences in the database; verified 51 unit tests, 11 isolated database assertions, profile persistence, offer publication and authenticated readback.

17. [x] Refresh admin priorities, exclusive navigation and working section search; restore pending ride schema and generated types. Signed-in admin/home/offer/my-rides pages load, navigation search verified, 67 focused tests pass. New publication and bilateral acceptance were not re-exercised end-to-end in this task.
18. [x] Repair boarding QR RPCs and delayed canvas drawing; preserve per-ride explicit location consent across refreshes; render participant markers; clarify bilateral completion; add private driver Pix settings and completed-ride BR Code. Verified authenticated Pix persistence and active sharing/driver marker/map tiles; 35 tests pass and build OK. QR boarding and bilateral completion-to-Pix were not exercised on a real confirmed trip: available account has an already-started trip, and completing it would alter the user's ongoing ride.
20. [x] Compact admin overview/lists with tabs and pagination; Opportunities has database-backed charts. Authenticated pages and tab changes verified.
21. [x] Persist supplemental pitch answers and expose saved form payloads/consents in authorized details. Authenticated manual test contact captured and read back; 26 form/privacy/admin tests pass. Previously discarded pitch answers cannot be recovered.
22. [x] Repair pending fare migration and verify save/readback, permissions, concurrent quote winner, bilateral acceptance and completion-to-Pix with isolated test trips. Authenticated My rides renders without schema/runtime errors. Entire two-account flow through the hosted UI remains unverified; only one authorized browser account is available, with a real in-progress trip that must not be altered. Historical migration replay also has pre-existing duplicate/incompatible definitions; isolated fixture setup required skipping these duplicates, not changing production history.
