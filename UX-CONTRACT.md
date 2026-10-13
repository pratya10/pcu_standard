# PCU/NPCU UI contracts

## Business context

Public history follows the existing `src/pages/PublicHistory.tsx` scope: only `completed` assessment rounds with `is_public = true`. Date values are ISO date-only; results use `src/lib/thaiDate.ts` Buddhist-era formatting. Authentication and mutations remain owned by the existing application and Supabase policies. This history change introduces no writes or permission changes.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Date | Native input[type=date] | DESIGN.md and existing AdminNewRound | platform calendar; Thai result dates | History filter + exact-date API/browser checks |
| Select/Listbox | Native select | Existing admin screens and DESIGN.md | platform popup | Existing behavior; untouched in history |
| Search | PublicHistory labeled search input | PublicHistory.tsx | local route query; 300ms remote search | Clear, combined filters, IME-safe request gate |
| Navigation | React Router Link | App.tsx | internal route; guide new tab | History report href and back link |
| Pagination | PublicHistory | PublicHistory.tsx | 10 server rows; exact count | 13-row fixture; filter reset; invalid-page clamp |
| Scrollbar | Global src/index.css | DESIGN.md | standard + forced-colors | Existing baseline |

## History flow

Route `/history` loads a stable table panel. Search and date values are stored as `q` and `date`; paging uses `page`. Filters reset page to 1. Search requests wait 300ms outside composition; clear runs immediately. Old requests are aborted and ignored. Empty dataset, no matches and failed requests have separate Thai messages. Failure has a retry button. Page numbers clamp to the last available page. Table markup is semantic; phone layouts show dates under names, and report actions remain visible. Labels activate their inputs; keyboard focus is visible. Native calendar language/year follows the browser/OS; rendered results show Thai dates.

## Existing gaps

Static audit findings in older forms (validation ownership, textarea resizing, and the name-suggestion button detection) predate this table and are outside this feature. This document records actual owners and does not assert that untouched flows pass the premium audit.
