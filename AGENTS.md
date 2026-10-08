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
- Keep authentication session state in the root AuthProvider and consume it through useAuth; this prevents duplicate auth listeners and keeps navigation synchronized.

- Use database roles for administrator access; the first registration receives admin atomically, while later registrations receive user.
- Serve user-supplied brand images through Lovable Assets and import their pointer files.
- Link STS responses through authenticated database functions and verified account identities, with publication ownership enforced in the database; this prevents claiming another person's response.
- Snapshot consented travel preferences in database triggers and enforce compatibility in the allocator; UI overrides use authenticated transactional creation to avoid matching before preferences are saved.
- Keep admin attention counts sourced from the existing authorized operation service and navigation matching exclusive; this avoids invented indicators and ambiguous active sections.
- Store Pix keys separately behind authenticated owner/participant RPCs and generate BR Code only for completed rides; this prevents public profile queries exposing payment identifiers and does not imply payment settlement.
- Use dynamically imported Leaflet for participant markers and preserve per-ride consent across non-loading refreshes; this avoids SSR browser imports and tracking resets.
