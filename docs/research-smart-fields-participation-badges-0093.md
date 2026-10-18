# CARONAA — Smart research inputs and survey participation badges

## What is implemented
1. Corrected browser validation regex for valid 24-hour times (`17:30`, `12:00`), dates and email addresses.
2. Added explicit numeric bounds across 21 number-type questions in the 13 preloaded templates: 0–7 days weekly (integers), 0–1440 minutes of trip/wait, non-negative fares with a practical ceiling, sensible seat, group and population bounds.
3. Form builder supports authoring min/max and integer-only constraints.
4. Shared public/preview question component shows min/max, enforces HTML number controls, and inline error messages. Invalid fields scroll into view.
5. Departure earlier than arrival generates a contextual next-day warning, **not** false rejection: overnight schedules can be legitimate.
6. Server trigger enforces the same bounds, including fallback by stable question ID and semantic code for **existing already-published versions**; no published schemas are rewritten.

## Survey-origin badge (IMPORTANT distinction)
- Participation linkage is keyed by the immutable `research_forms.id`, the stored `research_answers.id`, and a private per-submission `client_submission_key` UUIDv4 receipt.
- The user must actually submit a valid answer and **opt in** after the submission to link it to an account.
- After confirming the account email, an authenticated server RPC atomically claims the receipt once. Duplicate claims are blocked.
- Signed-up users who retain the browser session are linked on sign-in; if email verification opens another browser, the user can save the private receipt and redeem manually on **Meu perfil**.
- In the profile the badge is explicitly labeled **Pesquisa respondida · [form title]**. Form titles and codes are only presentation; changing either does not change its source identity.
- This badge validates control of a private receipt from a recorded survey submission. It is **not** proof of university enrollment, event attendance, identity verification, or institutional endorsement.
- Existing `UNIFOR` and `STS_2026` institutional verification flows are unchanged.
- Privacy: a user's research badge remains visible only to their authenticated self; the migration does not make individual participation publicly searchable.
- Responses remain anonymous and detached from user profiles except for a minimal badge-to-answer reference held in a restricted table. The badge query returns no answers or identifiable survey content.

## Database prerequisite
Review backup and apply ONLY `drizzle/migrations/0093_research_smart_validation_participation_badges.sql` through Supabase SQL Editor. This migration **replaces the answer validation function**, but does not rewrite answers or published question schemas.

Read-only audit after applying:
```sql
SELECT
  to_regclass('public.research_participation_badges') AS badge_table,
  to_regprocedure('public.claim_research_participation(uuid)') AS claim,
  to_regprocedure('public.get_my_research_participation_badges()') AS my_badges,
  to_regprocedure('public.validate_research_answer()') AS validator;

SELECT policyname,cmd,roles
FROM pg_policies
WHERE schemaname='public' AND tablename='research_participation_badges'
ORDER BY policyname;

SELECT
  POSITION('CAMPUS_DAYS' IN pg_get_functiondef('public.validate_research_answer()'::regprocedure))>0 AS has_weekly_day_limits,
  POSITION('v_num<v_min' IN pg_get_functiondef('public.validate_research_answer()'::regprocedure))>0 AS has_numeric_bounds;
```

## Guided tests
- Open the published `TESTE-25` survey and enter 47 days, −28 min and −31 reais; the form must block progression, explain each invalid field and focus it.
- Enter 5 days, 15 min, 3 reais, arrival 17:30 and departure 12:00. Both times must validate; a next-day warning should appear.
- Test boundaries: 0 and 7 days accepted; 7.5 and 8 rejected; 0 reais accepted; −1 reais rejected.
- Tamper with a request using invalid numeric data; database validator should reject it even if the browser is bypassed (test only on an isolated test form/environment).
- Complete an isolated test survey without creating an account: no badge should automatically be granted.
- Opt into `Vincular participação à minha conta`. Confirm email, log in, open Meu perfil; see exactly one badge with the form's current title.
- Attempt claiming the same receipt from a different account: reject. Reclaim on same account: idempotent.
- Rename the research form (draft/test metadata); badge is still linked to same UUID; a matching form code without a valid receipt must NOT generate a badge.
- Verify UNIFOR/STS historical verification badges remain unchanged.
- Confirm no public SELECT access to `research_participation_badges` or anonymous execution of claim RPC.
- Validate on mobile 360px, keyboard and both themes; run CI `npm test` and `npm run build`.
- Never run actual test submissions against protected historical UNILAB/STS research without explicit authorization.

## Deployment and scope
- New SQL migration 0093 is not automatically installed by GitHub commits.
- No data migration/backfill, production deployment, or manual granting of participation badges has occurred.
- End-to-end browser tests and GitHub build need confirmation before production publish.
