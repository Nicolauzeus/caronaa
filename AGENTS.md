<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep CARONAA sample users and rides in `src/mockData.ts`, accessed through small mock services; this keeps the visual MVP replaceable by real data later.
- Keep the shared app header and navigation in a reusable shell, while every content page owns its TanStack route and metadata; this preserves direct links and responsive navigation.
- Keep the public formulario parent as an Outlet-only layout and scope its legacy registration redirect to its index; parent guards also run for public survey deep links.
- Keep authentication session state in the root AuthProvider and consume it through useAuth; this prevents duplicate auth listeners and keeps navigation synchronized.
- Recover missing deployment chunks from both the root error boundary and a global rejection handler with a bounded multi-attempt reload that clears cached build files first; keep the service worker from ever caching hashed modules or stylesheets, since a stale cached chunk turns one replaced build file into a permanent crash.
- Resolve browser connection constants through `config/public-connection.ts`, preferring a complete VITE public pair and otherwise the verified managed public connection; this keeps deployment independent of local env files without bundling server bindings or privileged keys.

- Use database roles for administrator access; the first registration receives admin atomically, while later registrations receive user.
- Serve user-supplied brand images through Lovable Assets and import their pointer files.
- Link STS responses through authenticated database functions and verified account identities, with publication ownership enforced in the database; this prevents claiming another person's response.
- Snapshot consented travel preferences in database triggers and enforce compatibility in the allocator; UI overrides use authenticated transactional creation to avoid matching before preferences are saved.
- Keep admin attention counts sourced from the existing authorized operation service and navigation matching exclusive; this avoids invented indicators and ambiguous active sections.
- Store Pix keys separately behind authenticated owner/participant RPCs and generate BR Code only for completed rides; this prevents public profile queries exposing payment identifiers and does not imply payment settlement.
- Use dynamically imported Leaflet for participant markers and preserve per-ride consent across non-loading refreshes; this avoids SSR browser imports and tracking resets.

- Keep the shared Relationships page outside route modules and import it from both admin URLs; this preserves automatic route splitting without cross-route component imports.

- Keep admin analytical sections tabbed and lists paginated, and render saved supplemental form answers only within authorized detail views; this keeps the workspace compact without discarding captured content.
- Authorize fare reads through the participant client before privileged persistence, and return the saved quote; this prevents unauthorized access and divergent results under concurrent quoting.
- Persist server-issued expiring offer quotes and attach them transactionally on publication; only these new offers consent to automatic driver acceptance when a passenger quote is saved, preserving historical bilateral proposals.


## Mandatory CARONAA product specification — all coding agents (ChatGPT, Codex, Lovable)

**Read `README.md` in full at the start of every implementation, refactor, migration, bug fix or UX change.** Then inspect the affected code, existing tests and this AGENTS.md. Treat README.md as the canonical **product contract** for flows **F01–F09**, and the repository code/tests as evidence of actual implementation status. Do not assume the README means a flow has already shipped.

Required workflow:
1. Identify the F01–F09 module(s) being changed and state the corresponding README rules before coding.
2. Audit existing implementations and data contracts; reuse proven services, migrations, permissions and components. Do not duplicate a flow.
3. In this MVP **do not add or require CPF** in forms, signup, profiles, APIs or new validations. Driver/mototaxi document-related details remain **textual/declaratory only**, with **no mandatory uploads or rigid automated document checks** unless product scope is explicitly updated. Continue enforcing normal authentication/security and do not launch regulated professional transport without appropriate operational/legal review.
4. Preserve the **R$ 6 per 11 road-km** shared-ride pricing rule, charging for each passenger's contracted subroute; professional fares are a separate policy. Preserve explicit consent for recurrent publishing, alerts, location sharing and detour changes.
5. Maintain design tokens **#FFBB00** and **#121212**, Sora/Manrope, mobile-first four-tab navigation (Início, Oferecer, Viagens, Perfil), concise forms and transparent states. No fake production metrics.
6. Run appropriate automated and guided tests, check regression and authorization, and report what was verified vs. pending. Do not claim untested functionality is completed.
7. Do not silently override README rules. If a change conflicts, request a product decision, then amend documentation only when approved. Never remove this reading requirement when updating agent instructions.
8. For mobile F01 research journeys, show both **Usar localização atual** and **Buscar localização** before the origin field. GPS requires an explicit tap; searchable/manual approximate locality always remains available, including after denial/timeouts. Never persist exact GPS coordinates in research answers. Preserve the fixed event origin when applicable.
9. In F09's unified CRM dossier, render human-readable values grouped by source and participation; never show raw research UUIDs, answers_raw or route-coordinate JSON in the primary visual hierarchy. Preserve every participation, admin-only permissions and original stored codes; place technical payloads in a closed audit section. A known email or WhatsApp may replace a generic unnamed contact heading but must never change identity grouping or imply consent to contact.

10. For F09 dossiers: mobile uses a full-height accessible dialog with a visible back action, a fixed identity header and an internally scrollable body; multiple participations use a single-open accordion, summarized by participation without code/UUID exposure. Classify persisted research answers by their immutable versioned semanticCode (admin RPC migration 0123), falling back safely to legacy question labels. Keep unmatched custom answers available under a collapsed section, and maintain WhatsApp marketing permission separate from data linkage.

11. Keep BI-to-CRM deep-link filters scoped to one research participation, preserve explicit survey denominators and do not treat answers as consented leads. Route operational CRM exclusively through `/admin/relacionamentos`; retain legacy STS read-only response views for backward compatibility.

End each development report with: **module, current status, changes/files, tests/results, pending risks, README alignment**. These requirements apply equally to code generated directly or through Lovable, Codex, ChatGPT or collaborators. Existing rules above remain in effect.
