# CARONAA — Research Builder v2 (UI/UX + safe persistence)

## Scope delivered
- **13 editable templates** covering Evento (3), Educação (3), Empresa (2), Mobilidade Local (3) and Outra (2).
- Creation wizard: choose nature, audience, model and see estimated time, sections and questions. Blank creation remains available.
- Atomic form + v1 draft via admin RPC; prevents half-created records.
- Visual editor: edit, reorder sections (up/down and drag), reorder questions, move them between sections, duplicate safely, add/delete, undo/redo, draft autosave and exit warning.
- Conditional questions restricted to earlier single-choice parents. Schema is validated in front-end and by a publishing RPC.
- Expanded field library: short/long, number, single/multi, 1–5/0–10, dates, times, yes/no, stars, value ranges, localities, ranking, matrix, optional contact.
- Preview uses the same shared question fields as the public form and saves nothing.
- Public mobile form: one section at a time, progress, previous/next, per-step validation, cleared hidden answers on submit, optional signup only after response saved.
- Per-research logo/icon + display title + alt text: admin image upload to a separate public-branding bucket limited to PNG/JPEG/WebP 2 MB, scoped upload policy. Used in list, detail, preview and public header.
- BI analysis: compact question selector, version-aware distributions, bars/columns/line/ranking, free-text privacy precautions.
- Research comparison: aggregated semantic tags for verified compatible structured questions, alongside historic profile comparisons.
- Published versions remain immutable; STS legacy rows remain untouched.

## Security & brand
Only upload institution artwork with permission. Image file itself will be publicly served; do not include identity documents, student photos or sensitive material. Uploading a UNILAB logo does not imply partnership or endorsement. The participation consent is separate from commercial-contact permission.

## Database changes (REQUIRED before testing v2)
Confirm a current backup. **Do not run the entire historic Drizzle runner** because earlier migration records were applied separately.
Run each individually, in order, on the intended test environment:
1. `0089_research_builder_branding_atomic_publish.sql`
2. `0090_research_extended_answer_validation.sql`
3. `0091_research_semantic_comparison.sql`

These are additive except for the validator function replacement. No historical responses are rewritten. Review SQL permissions before execution.

## Read-only installation audit
```sql
SELECT to_regprocedure('public.create_research_form_draft(text,text,text,text,text,jsonb)') AS create_draft,
       to_regprocedure('public.publish_research_form(uuid,uuid,jsonb)') AS publish,
       to_regprocedure('public.get_research_semantic_summary(uuid)') AS compare;
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='research_forms'
 AND column_name LIKE 'brand_%' ORDER BY column_name;
SELECT id,public,file_size_limit,allowed_mime_types
 FROM storage.buckets WHERE id='research-branding';
SELECT tablename,policyname,cmd FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'research_branding_%';
```

## Acceptance test sequence
1. As admin, open /admin/formularios, choose Educação, then `Mobilidade estudantil`. Confirm populated sections, question count and correct nature.
2. Repeat for an Evento, Empresa, Mobilidade Local and Outra template. Ensure 13 available across all five nature filters.
3. Create a blank form; add sections, question types and options manually.
4. Move sections up/down/drag and questions up/down/between sections. Duplicate a question and ensure no ID collision.
5. Create a parent single-choice question and a later conditional child. Answer parent both ways in preview; hidden answer must not appear in payload.
6. Edit draft and confirm autosave; reload, ensure edits remain. Undo and redo before new changes.
7. Preview actual fields, including ranking, rating, date, time, money band and matrix. Preview must not insert a response.
8. Upload a **consented** institution icon (PNG/JPG/WebP <=2 MB) with descriptive alt text. Confirm image appears in catalog, detail and anonymous public view. Confirm unauthorized upload is rejected.
9. Publish a valid draft; verify RPC status, enabled flag and published_at. Confirm published version cannot be edited directly and new draft version works.
10. As a logged-out user, answer a survey in stages. Confirm question-level validation, consent, duplicate submit behavior, confirmation and optional signup.
11. Ensure rows are in `research_answers` for the correct form_id/version_id and versioned BI shows counts. Compare two studies only if they have matching semantic tags.
12. Validate the historical STS 35 submissions are unchanged and the ended historical event remains unavailable publicly.
13. Test RLS as user, anonymous and Superadmin; verify no individual answers or private fields in the public storage bucket.
14. Test 360px, 390px, 768px, 1440px; keyboard, focus, error messages, 200% zoom, both color themes.
15. Run `npm test`, `npm run build`, `npm run lint`; inspect Actions and server logs. Do not publish production until these pass.

## Still to verify in environment
Build, CI, real database installation and E2E acceptance are not verified from GitHub connector alone. Logo must be provided/uploaded by an authorized administrator, not generated or assumed.

## Files
- `src/lib/formulario/research-templates.ts` — 13 templates.
- `src/lib/formulario/research-schema.ts` — validation and ordering helpers.
- `src/components/admin/ResearchFormEditor.tsx` — builder.
- `src/components/research/ResearchFields.tsx` — shared fields and branded header.
- `src/components/research/PublicResearchForm.tsx` — public stage flow.
- `src/components/admin/ResearchCatalog.tsx` — creation wizard.
- `src/components/admin/ResearchAnswerInsights.tsx`, `ResearchCompare.tsx` — analytics.
