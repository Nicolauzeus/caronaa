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
23. [ ] Calculate road fares while composing new offers, show passenger fare before acceptance, and confirm new opted-in offers with passenger acceptance alone; preserve historical rides and validate trusted quoting.
14. [x] Restore STS account linking and first-publication functions in the active database; authenticated home loads without the missing-function error (publication with a linked response remains unverified).
15. [x] Repair offer/request runtime failures, preserve audience preference, and verify publication and readback through the UI.
16. [x] Persist consented travel preferences, snapshot/override on offers, requests and routines; enforce hard rules and rank soft preferences in the database; verified 51 unit tests, 11 isolated database assertions, profile persistence, offer publication and authenticated readback.

17. [x] Refresh admin priorities, exclusive navigation and working section search; restore pending ride schema and generated types. Signed-in admin/home/offer/my-rides pages load, navigation search verified, 67 focused tests pass. New publication and bilateral acceptance were not re-exercised end-to-end in this task.
18. [x] Repair boarding QR RPCs and delayed canvas drawing; preserve per-ride explicit location consent across refreshes; render participant markers; clarify bilateral completion; add private driver Pix settings and completed-ride BR Code. Verified authenticated Pix persistence and active sharing/driver marker/map tiles; 35 tests pass and build OK. QR boarding and bilateral completion-to-Pix were not exercised on a real confirmed trip: available account has an already-started trip, and completing it would alter the user's ongoing ride.
20. [x] Compact admin overview/lists with tabs and pagination; Opportunities has database-backed charts. Authenticated pages and tab changes verified.
21. [x] Persist supplemental pitch answers and expose saved form payloads/consents in authorized details. Authenticated manual test contact captured and read back; 26 form/privacy/admin tests pass. Previously discarded pitch answers cannot be recovered.
22. [x] Repair pending fare migration and verify save/readback, permissions, concurrent quote winner, bilateral acceptance and completion-to-Pix with isolated test trips. Authenticated My rides renders without schema/runtime errors. Entire two-account flow through the hosted UI remains unverified; only one authorized browser account is available, with a real in-progress trip that must not be altered. Historical migration replay also has pre-existing duplicate/incompatible definitions; isolated fixture setup required skipping these duplicates, not changing production history.
