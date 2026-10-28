# Partnerportalen (nivå 2)

Bolagets egen yta på `/partner/<bolag>`. Mappnamnet `kevin-bo` är historiskt och
byter namn i städsteget G; koden här är den levande portalen, inte en kopia.

Kedjan: `app/partner/[[...path]]/page.tsx` → `components/workspace-surface-page.tsx`
→ `packages/navigation/workspace-surfaces.mjs` (`PARTNER_VIEWS`, Kevins gamla
adresser omdirigeras) → `lib/partner-data.mjs` (läser snapshoten och nekar en vy
rollen saknar enligt `PARTNER_VIEW_PERMISSIONS`) → `partner-operator-workspace.jsx`.

- `partner-operator-workspace.jsx`: skalet (sidomeny, tilldelning, roll, 403-kort) och
  vyväxlingen; navigering, rumsval och utkastvakt (`partner-navigation-guard.mjs`).
- `partner-copy.mjs`: orden (TERMINOLOGI), menyn per behörighet, rollorden, preferenser.
- `partner-workspace-context.mjs`: validerar snapshoten mot fel bolag och fixturer.
- `partner-portal.css`: alla stilar, fästa under `.partner-portal` (skissen i ny-admin-skiss).
- `views/`: `overview.jsx`, `rooms.jsx` (kort + `components/partner-appearance.tsx` i flikar),
  `players.jsx` (tomläge till steg F), `reports.jsx` (aggregat ur `lib/partner-game-readout.mjs`),
  `team.jsx`, `integration.jsx`, `help.jsx`, primitiverna i `ui.jsx`, sifferhjälpare i
  `report-figures.mjs`.

Prov: `apps/studio/test/partner-*.test.mjs` och `workspace-surface*.test.mjs`
(JSX-vyerna laddas via `test/fixtures/jsx-require.mjs`).
