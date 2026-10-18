# CARONAA Admin Enterprise — UI/UX consolidation

## Goal
A nine-department, mobile-first enterprise Admin without duplicated navigation cards, preserving all operational URLs, data, RLS, and write workflows.

## Implementation
- AdminShell: compact nav for Overview + nine departments, contextual horizontal tabs, active department in nested URLs, preserved mobile drawer and search.
- Departments overview: nine dense rows, one click into each dedicated workspace.
- Legacy /admin/departamentos/:department: no redirect card gallery; compact tabs plus link to its principal workspace.
- Canonical unique home for each department. Legacy Relationships belongs to Partnerships (avoids linking both Growth and Partnerships to the same destination).
- Same-route modules (OKRs, decisions, risks; incidents/product; CRM leads/campaigns; organizations/pilots/territories; tickets/reports; finance overview/transactions; compliance contracts/audit/regulations) switch by URL hash.
- Separate visual states for loading, empty and errors; original database reads/writes preserved.
- Removed duplicative operation navigation cards and redundant Quick Actions from main dashboard.
- Compact, dense record lists replacing repetitive card grids for CRM, partnership, support, compliance, executive and technology.
- Form library: secondary edit/archive/delete actions collapsed behind an accessible disclosure; primary action stays visible.
- Research mobility dimensions: choose one of eight dimensions and render a unified chart instead of eight card panels.
- Methodology: collapsible definitions rather than explanatory cards.

## Graphs
- InsightChart: Bars, Columns, Line, Ranking. Used in Research, Technology, Operations, Executive, CRM, Partnerships, Support, Finance and Compliance.
- EvidenceChart: same four choices for multi-series comparisons in Opportunities.
- Validation fixed bar chart replaced by shared InsightChart.
- Color meaning: gold neutral/brand; red for errors/cancellations/critical cases; amber pending/attention; green completion/confirmed. Never infer good/bad from numeric magnitude.
- Categorical line charts explicitly state that connected categories are NOT a time-series trend.
- Actual values only; no fake samples in production UI.

## Smoke test matrix
1. Superadmin, desktop 1440 px: /admin and /admin/departamentos — one unique link per department.
2. Open canonical homes: /admin/executivo, /admin/tecnologia, /admin/operacoes, /admin/crescimento, /admin/inteligencia-pesquisa, /admin/parcerias, /admin/atendimento, /admin/financeiro, /admin/compliance.
3. On these pages, check that active department remains highlighted on every subpage and contextual tabs scroll horizontally on mobile.
4. Deep-link to /admin/executivo#decisions and #risk; /admin/tecnologia#releases; /admin/crescimento#campaigns; /admin/parcerias#pilots, #expansion; /admin/atendimento#reports; /admin/financeiro#transactions; /admin/compliance#audit. Reload and use browser Back/Forward.
5. For each new record type: create TESTE, switch tab, refresh, ensure server-side persistence. Inspect error states when disconnected.
6. /admin/formularios: rows compact, edit title, prepare/publish, duplicate, archive, restore and enable unaffected. Test the more-actions disclosure with keyboard.
7. Research BI: change chart types, filters, graph ranking; compare STS denominator and counts with SQL.
8. On a categorical line chart, verify the caution is visible; on statuses, confirm critical red, pending amber and completed green.
9. On /admin/oportunidades, compare the same two series across Bar, Column, Line and Ranking without changing underlying numbers.
10. On /admin/operacoes, inspect service presence and historical counts, then navigate to Caronas, Requests, Matching, Drivers, Passengers using top tabs.
11. At widths 360, 390, 768, 1024, 1440 and 1920 px, verify no horizontal page overflow, truncated content or inaccessible menu.
12. Use keyboard Tab/Enter/Escape, 200% zoom and screen reader for nav label, charts, disclosure and record forms.
13. Logged out and normal-user access to Admin must remain blocked by existing guards and RLS.
14. Run npm test, npm run build, npm run lint and CI on the final commit; resolve errors before production deploy.

## Engineering assertions
- Added unit tests for unique canonical department landing routes, URL-hash navigation and graph ranking/semantics.
- No SQL migration, production publish, record deletion, financial writes or authorization changes in this UI-only refactor.
- UI-focused changes do not claim automatic verification of Supabase queries, regression tests, or real browser flows.
- GitHub/Lovable synchronization and build status must be independently verified before acceptance.
