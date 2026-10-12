# A20 · Flyttrapport

Flytten är en commit på molnbranchen. Orkestratorn integrerar på `jakob/repo-ordning` och kör Studio-bygge, frontendbygge och hela sviten med Node 24.

| | |
| --- | --- |
| Branch | `cursor/a20-presentation-compositor-9a27` |
| Flyttcommit | `0f42cc70ece2bbc07474c5a614cc20f6f90909b5` |
| Bas | `1105e6fa` (`jakob/repo-ordning` = `main` `2da014b7`, PR #31, plus planrapporten) |
| Öppna PR vid start | inga |
| `git ls-files test-videoeditor` | tom |

## Commit

70 filer, +63 / −43.

- 50 `git mv`: 48 med likhet 100 %, plus `preview/README.md` 91 % och `preview/prepare.mjs` 95 % (de två innehållsbyten planen tillåter).
- `test-videoeditor/README.md` borttagen. Ny `packages/presentation/README.md`.
- Konsumentrader, krok, orphan-verktyg, systemkartans tre strängar.

`compositor.js` sha256 `a668ed9380e62314e3ddaef236f2e2dea823609a4587b930f6c76fe53866906e` (14 497 byte). Samma kontroll för `geometry.js`, `player.js`, `bridge.js` och `lanes.js` mot planens tabell.

## Ommätta rader

Planen skrevs mot `cf011b1c`. På den här basen:

| Plan | Uppmätt |
| --- | --- |
| `docs/LOCAL-PRESENTATION-RUNTIME.md:290` | rad 296 |
| `docs/JOHN-HANDOFF.md:422` | rad 516–517, plus en kort ny leveransrad under §3 |
| övriga planrader | oförändrade radnummer |
| ny konsument | `test/game-overlay-layout.mjs:4` importerar `geometry.js` |

## Kanter

`node ordning/verktyg/cross-imports.mjs --all-edges`.

Före, sju in till `test-videoeditor/program` (planen räknade sex; den sjunde är overlay-provet):

| Antal | Kant |
| ---: | --- |
| 2 | `lab/test` → `compositor.js`, `geometry.js` |
| 3 | `test` → samma två från `composition-runtime.mjs`, plus `geometry.js` från `game-overlay-layout.mjs` |
| 2 | `web(server)` → samma två från `composition-runtime.mjs` |

Efter: samma sju, mot `packages/presentation`. Noll kanter ut. `join`/`resolve` i prepare-kedjan syns fortfarande inte i verktyget och är bytta.

## Prov (Node v22.14.0)

| Kommando | Resultat |
| --- | --- |
| `node --test` de åtta filerna i uppdraget | 53/53 gröna |
| `node --test test/game-overlay-layout.mjs` | 13/13 (extra konsument) |
| `node docs/system-map/verify.mjs --check` | exit 0, 0 röda, 14 gula. Ingen varning på de tre kartsträngarna |
| `node tools/check-orphan-tests.mjs` | 349 filer, 0 föräldralösa, 2 undantag. `packages/presentation/preview/prepare.test.mjs` täcks av `.githooks/pre-commit-full` |
| `node tools/check-environment-variables.mjs` | exit 0 |

`lab/node_modules` installerades med `npm ci` (motorn vill ha Node 24). Frontend saknade lockfil; `npm install --prefix apps/croupier-frontend --no-package-lock --ignore-scripts` gav `typescript` och `next`. Första platform-ui-körningen hade 3 röda av `MODULE_NOT_FOUND typescript`. Efter installationen är samma fil 24/24 grön, och hela sviten 53/53.

Inte kört här: `sh .githooks/pre-commit-full`, `npm --prefix lab run build`, frontendens `npm run build`, layer-lane i webbläsare. VM:ens `core.hooksPath` anropar inte `.githooks/pre-commit`.

## Kvarvarande `test-videoeditor`

Bara `ordning/`. Inget i handoffen.

| Klass | Filer |
| --- | --- |
| Historiskt citat | `BASLINJE.md`, `README.md`, `aktiviteter/A04`, `A17`, `A20`, `rapporter/A04`, `A06`, `A17`, `A20-flyttplan.md` |
| Död klassare, planen säger låt stå | `ordning/verktyg/cross-imports.mjs:4`, `:23`, `:30` |

## Säkerhetsstatus

`node tools/security-status.mjs` mot `main` `2da014b7`: GitHub-täckning komplett för den committen, GitGuardian-kontrollen köad, incidentlistan oläst, platstäckning oläst. Ingen incidentpost lästes.

## Tveksamt

- Kantantalet är 7, inte planens 6. `test/game-overlay-layout.mjs` kom med main efter planen. Importen är bytt. Antalet sjönk inte.
- Handoffen fick den planerade meningen och en kort ny leveransrad under §3. Den nya raden nämner inte den gamla mappen.
- `prepare.mjs` läser `VERCEL_ENV` och `VERCEL_GIT_COMMIT_REF`. Ingen av dem finns som källa i miljöregistret, ingen variabel lades till eller togs bort, och inventeringsfilerna rördes inte. Kontrollen är grön.
- `verify.mjs` tar fortfarande inte med prefixet `packages`. Kartans README-rad är därför ingen hård existenskoll. Planen lämnar det utanför flytten.
- `app.js`, `index.html` och `viewer.*` flyttades med och serveras inte. De är inte pensionerade.
- `catalog.json` har kvar datafältet `branch: test-video-jakob`.
- Hela pre-commit-sviten och de två byggena är inte körda i den här molnmiljön.
