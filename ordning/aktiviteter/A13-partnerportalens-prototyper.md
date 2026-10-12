# A13 · Partnerportalens prototypfabrik

| Fält | Värde |
| --- | --- |
| Våg | 2 · parallell med A10, A12, A15, A16 |
| Väntar på | B7 (vilka diagnostiska destinationer som behålls) · A05 |
| Branch / worktree | `jakob/ordning-a13` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a13` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 40 % · stor JSX-fil, visuell acceptans för N2 är öppen |

## Mål

Den verkliga partnerportalen (Översikt, Spelrum, Team & behörigheter,
Integration) renderas från egna vyfiler. Den importerar inte längre
prototypfabriken `original-views.jsx` för riktiga operatörer. Diagnostik som
behålls ligger tydligt separat. Oönskade prototypvyer är borta.

## Fakta (00ea55c5)

- `lab/components/kevin-bo/original-views.jsx` är 298 KB, `original.css` 70 KB
  och `kevin-backoffice.jsx` 25 KB. Den senare importerar
  `createOriginalViews` (rad 7) och använder
  `original.views[view]` (rad ~60 och ~210) även för riktiga operatörsdata.
- Bara Team är utbrutet (`views/team.jsx`). README:s regel var: "Leave every
  other view in `original-views.jsx` until that view's own data is connected."
- `navigation.mjs` inventerar 24 diagnostiska destinationer: 17 sektioner för
  fixturoperatören och 7 interna. Roulette och Baccarat är planerade vyer.
- Konsumenter: `lab/app/control/surface-page.tsx`,
  `lab/components/partner-workspace.tsx` och `partner-session-actions.tsx`
  (bara `partner-copy.mjs`). Tester: `lab/components/kevin-bo/preview.test.mjs`
  (renderar alla 24), `partner-navigation-guard.test.mjs`,
  `lab/test/partner-workspace-visual.test.mjs`,
  `workspace-surface-pages.test.mjs` och `partner-*.test.mjs`.
- `port-source.mjs`, `factory-preamble.txt`, `factory-appendix.txt` och
  `source-provenance.json` genererar och spårar fabriken.

## Ägda filer

`lab/components/kevin-bo/**`, `lab/app/control/surface-page.tsx` (om den
berörs), `lab/test/partner-workspace-visual.test.mjs`,
`lab/test/workspace-surface-pages.test.mjs` och de `lab/test/partner-*.test.mjs`
som renderar vyerna.

**Rör inte:** API:er för partner, team, paket och utseende (`lab/app/api/partner/**`,
`lab/lib/partner-*`), inloggning och sessioner samt `lab/components/partner-workspace.tsx`
utöver importer.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kör de befintliga partnertesterna och
   notera att de är gröna före start.
1. **Karta:** för var och en av de 24 destinationerna, ange vyfunktionen i
   `original-views.jsx`, vem som når den (riktig operatör, N1-diagnostik,
   planerad) och vilka delade UI-primitiver och CSS-block den använder. Skriv
   kartan i rapporten.
2. **Bryt ut** Översikt, Spelrum, Integration och de delade primitiverna till
   `views/*.jsx` och `views/shared.jsx`, med identisk renderad struktur. Testerna
   ska vara gröna utan ändrade förväntningar. Flytta deras CSS till en egen fil.
3. **Isolera diagnostiken:** riktiga operatörer importerar inte fabriken. Om B7
   behåller diagnostik laddas den bara i N1-diagnostikläget, med dynamisk
   import eller separat ingång.
4. **Ta bort** de vyer B7 inte behåller, samt CSS som bara de använde.
   Uppdatera `navigation.mjs` och `preview.test.mjs` (antal och namn) och
   README:s regel. Uppdatera generatorfilerna, eller ta bort dem om fabriken
   försvinner helt.
5. **Prov:**
   - `node --test lab/components/kevin-bo/*.test.mjs lab/test/partner-*.test.mjs lab/test/workspace-surface-pages.test.mjs`;
   - orkestratorn kör `npm --prefix lab run build` och gör en visuell kontroll i
     lokal Studio: `/partner`, `/partner/<slug>`, `/partner/<slug>/rooms`, Team
     och Integration, i ljust och mörkt läge.

## Klart när

- [ ] `kevin-backoffice.jsx` importerar inte `original-views.jsx` för riktiga
      operatörer.
- [ ] Riktade prov och bygget är gröna, och den visuella kontrollen är gjord.
- [ ] Antalet diagnostiska destinationer motsvarar B7.

## Tveksamt att lyfta

- Varje destination där det är oklart om någon använder den.
- Visuella skillnader, hur små de än är. JN2-B:s visuella acceptans är fortfarande öppen.
