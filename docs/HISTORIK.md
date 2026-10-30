# Historik: raderade dokument

En rad per dokument som raderats ur `main` efter att dess uppgift var klar. Innehållet finns bara i Git; läs det med `git show <sha>:<sökväg>` (sha är den sista main-commit där filen fanns). Det här är en lista, inget arkiv: inga kopior av innehållet, ingen historikmapp. Ett dokument som raderas senare får en rad här i samma PR.

Hänvisningar i `migrering/status.json` (fältet `evidence`) och i kodkommentarer till sökvägar nedan gäller fortfarande; de pekar på Git-versionen.

## Raderade 29 oktober 2026

Alla fanns i `main` på `a05917c3a05f23963006fc4e778f9c4ac8bbadcf` (läs: `git show a05917c3:<sökväg>`). Migreringen var klar (20/20, O03 VERIFIED via #527) och ingen kod eller CI läste filerna; kodkommentarer som citerar ett avsnitt ("K04-mappning G3", "K05-mappning 4b") står kvar och pekar på Git-versionen.

| Datum | Fil | Vad det var | PR |
| --- | --- | --- | --- |
| 2026-10-21 | `migrering/kevin-ks-migrering/K01/K01-matris.md` | K01: urvals- och beroendematris över Kevins modul vid `5aa7ed10` (svar på #312) | #339 |
| 2026-10-22 | `migrering/kevin-ks-migrering/K04/K04-mappning.md` | K04: mappning committade händelser → presentation → exakta medier (kodens "K04-mappning G3" avser avsnitt G3 här) | #339 |
| 2026-10-22 | `migrering/kevin-ks-migrering/K05/K05-mappning.md` | K05: mappning Kevins media → Neon-id → Blob → paket (kodens "K05-mappning 4b" avser avsnitt 4b här) | #339 |
| 2026-10-27 | `docs/2026-10-27-K04-BROWSER-ACCEPTANCE.json` | Första webbläsarkvittot för K04 (spelklient från händelser) på kandidaten `cc415cd8` | #450 |
| 2026-10-27 | `docs/2026-10-27-K05-PRODUCTION-ACCEPTANCE.json` | K05: bindning av PAOW:s media i produktionens Neon och Blob på `cc415cd8` | #450 |
| 2026-10-27 | `docs/2026-10-27-K06-STAGING-ACCEPTANCE.json` | Första stagingkvittot för K06 (Admin till spel efter omstart) | #445 |
| 2026-10-27 | `docs/2026-10-27-K07-STAGING-ACCEPTANCE.json` | Första stagingkvittot för K07 (spelbeteenden och samtidighet) på `cc415cd8` | #450 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-ACCEPTANCE.json` | K04-omprov 1 på `13aa5a01` | #459 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-2-ACCEPTANCE.json` | K04-omprov 2 på `43b7404e`; Jakobs godkännande av PAOW:s 35 giv-, hål- och revealklipp (`visualApproval`, 01:55Z) | #475 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-3-ACCEPTANCE.json` | K04-omprov 3 på `1f66245b` (före O02-frysningen) | #482 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-4-ACCEPTANCE.json` | K04-omprov 4 på `6a158180` (efter #481) | #501 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-5-ACCEPTANCE.json` | K04-omprov 5 på `689c690e` | #510 |
| 2026-10-28 | `docs/2026-10-28-K04-F3-F5-REVIEW.md` | Oberoende granskning av K04 F3–F5 (#478) och uppföljningen (#481) | #514 |
| 2026-10-28 | `docs/2026-10-28-K04-K05-REVIEW.md` | Oberoende granskning av K05-kvittot (#457) och K04-omprovet (#459) | #460 |
| 2026-10-28 | `docs/2026-10-28-K06-K07-REVIEW.md` | Oberoende granskning av K06- och K07-omproven (#470), med fyndet om materialbytande publicering under aktiv hand | #471 |
| 2026-10-28 | `docs/2026-10-28-K07-REVIEW.md` | Oberoende granskning av K07-kvittot (med K06 och K04) mot kandidaten `cc415cd8` | #456 |
| 2026-10-28 | `docs/2026-10-28-O02-ACCEPTANCE.json` | O02: acceptanskvitto för den frysta kandidaten `f3780593` (frysning, kedja, negativa prov, restore-replay) | #523 |
| 2026-10-28 | `docs/2026-10-28-O02-REVIEW.md` | O02: oberoende granskning av kandidaten `f3780593` | #523 |
| 2026-10-28 | `docs/2026-10-28-O03-RELEASE-ACCEPTANCE.json` | O03: releasekvitto för `5f5bc88d` (Vercel `dpl_DGRnRtHpVUrMz9V6kv8iXvbJYcJV`, Render `dep-dbgvog0ae00c73dgivq0`/`dep-dbgvsc5g1s2s73cdoqkg`, migrering 011, backupgren `backup-before-o03-20261028`, restoreprov S0 = S1, flaggan `CROUPIER_SHARED_TABLE_ENABLED=1`) | #527 |
| 2026-10-28 | `docs/2026-10-28-O03-REVIEW.md` | O03: oberoende granskning av releasekvittot, GODKÄND MED ANMÄRKNING | #527 |

## Raderade 29 oktober 2026: `migrering/` efter avslutet

Alla fanns i `main` på `6f2d8236` (läs: `git show 6f2d8236:<sökväg>`). Ingen kod, CI, hook eller allowlist läste dem; proven som nämner sökvägarna (`test/ci-changes.mjs`, `test/precommit-checks.mjs`, `test/check-no-sqlite.mjs`) använder bara strängarna som fixturer. [MASTERPLAN](../migrering/MASTERPLAN.md) kortades samtidigt till en pekare; hela planen läses med `git show 6f2d8236:migrering/MASTERPLAN.md`.

| Datum | Fil | Vad det var | PR |
| --- | --- | --- | --- |
| 2026-10-28 | `migrering/jakob-main-migrering/AKTIVITETER.md` | Kriterier, bevis och läge för J01–J10 | #514 |
| 2026-10-28 | `migrering/kevin-ks-migrering/AKTIVITETER.md` | Kriterier, bevis och läge för K01–K07 (provkommentaren "AKTIVITETER K03" avser K03 här) | #514 |
| 2026-10-27 | `migrering/kevin-ks-migrering/K01/O01-svar.md` | O01: de låsta kontrakten för kommandon, händelser, lagring, presentation och configversion (kodens "O01-svar 2.x" avser avsnitt 2.x här) | #433 |
| 2026-10-29 | `migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md` | K05: Kevins begrepp mot mains, med jämförelsetabell (vilosekvensen uppdaterad i #560) | #560 |
| 2026-10-27 | `migrering/kevin-ks-migrering/K05/tools/validate-k05-manifest.mjs` | Engångsvalidering av K05-manifestet; inget körde det | #433 |
| 2026-10-27 | `migrering/kevin-ks-migrering/K06-K07/K06-K07-forberedelse.md` | K06 och K07: förberedelse och gapanalys mot Kevins prov (provens "K06-K07-forberedelse §2.x" avser avsnitt 2.x här) | #433 |

## Raderade 29 oktober 2026: sista kvittona, O02-planerna och oläst proveniens

Alla fanns i `main` på `6942432d` (läs: `git show 6942432d:<sökväg>`). Alla 20 aktiviteter är VERIFIED, och `git grep -F <filnamn> 6942432d -- apps packages services ops tools .github .githooks` gav ingen levande läsare. `tools/o02-freeze-check.mjs` läser kvitton ur kandidatens träd (`git ls-tree <sha> docs/`), inte ur `main`; dess kommentarer och `how`-texter som nämner O02-PLAN och O02-RESTORE-REPLAY pekar på Git-versionen. Proveniensens sökvägar och hashar i `CATALOGUE_SOURCE` och `dealer-import-kevin-source-paow.json` gäller fortfarande; ingen kod läste filerna.

| Datum | Fil | Vad det var | PR |
| --- | --- | --- | --- |
| 2026-10-27 | `docs/2026-10-27-ISOLATED-ACCEPTANCE.json` | Isolerat prov på `d53b349a`: renklon, HTTP-restore, `cloudVerification` och `webviewVerification` (J10) | #421 |
| 2026-10-27 | `docs/2026-10-27-J08-STAGING-ACCEPTANCE.json` | J08-stagingkvittot med avsnitten `k04`, `k05`, `k07` och `j08` (b08f2a86) | #440 |
| 2026-10-27 | `docs/2026-10-27-K04-STAGING-ACCEPTANCE.json` | K04 g och h på staging `e7a4e251`: tio talrepliker, headless Chromium dator och mobil | #445 |
| 2026-10-28 | `docs/2026-10-28-K04-BROWSER-RERUN-6-ACCEPTANCE.json` | K04-omprov 6 på O02-kandidaten `f3780593` (F11–F14) | #524 |
| 2026-10-28 | `docs/2026-10-28-K06-STAGING-RERUN-ACCEPTANCE.json` | K06-omprov 1 på `13aa5a01`: materialbyte M0 → M1, Restart service, negativa fall | #470 |
| 2026-10-28 | `docs/2026-10-28-K06-STAGING-RERUN-2-ACCEPTANCE.json` | K06-omprov 2 på `f3780593`, rummets fält via `roomOverrides` | #525 |
| 2026-10-28 | `docs/2026-10-28-K07-STAGING-RERUN-ACCEPTANCE.json` | K07-omprov 1 på `13aa5a01`: två spelare vid delat bord, g1/g2, ledgerhash HTTP = Neon | #470 |
| 2026-10-28 | `docs/2026-10-28-K07-STAGING-RERUN-2-ACCEPTANCE.json` | K07-omprov 2 på `f3780593` | #525 |
| 2026-10-27 | `docs/plans/O02-PLAN.md` | O02: frysregler F1–F8, restore-replay variant B, Jakobs ögon V1–V7, negativa fall (avsnitten som `status.json` och `tools/o02-*.mjs` citerar) | `430a87c9`, använd i #523 |
| 2026-10-28 | `docs/plans/O02-RESTORE-REPLAY.md` | O02: kommandolistan D1–D3 och R0–R10 för restore-replay på staging | `75a08629`, körd i #523 |
| 2026-10-21 | `migrering/kevin-ks-migrering/K04/K04-medie-fack.tsv` | K04: Kevins mediefack från `codex/kevin-k01-underlag` `6bd92d05`; spelet läser den härledda `k04-media.tsv` | `6bd92d05` |
| 2026-10-22 | `migrering/kevin-ks-migrering/K05/K05-matris.tsv` | K05: urvalsmatrisen för PAOW; urvalet bärs av `dealer-import-kevin-source-paow.json`, vars läsare `tools/k05-import-plan.mjs` redan var borttagen | `4fbd5467` |
| 2026-10-02 | `media/site/source/design-kit/` (8 filer: `prive-blackjack-ui-kit.html`, `BettingRail`, `Feedback`, `HandBar`, `Main`, `ScoutBrand`, `Seats` `.dc.html`, `canvas.json`) | Gammalt designkit utan läsare; raderna i `media/layout.json` (roten `design-kit` och åtta filer), `media/blob-index.json` (`canvas.json`) och `tools/repo-limits-allowlist.json` togs bort samtidigt. Blob-objektet för `canvas.json` ligger kvar i Blob | `d706dea0` |

## Raderade 29 oktober 2026: Admin-kod utan route och Astrid-media

Kod och media utan läsare i Admin eller lobbyn. API-routen `apps/studio/app/api/forge/**` och `lib/dealer-forge-*` står kvar; dealerfabriken bygger på Runway.

| Datum | Fil | Vad det var | Läses med |
| --- | --- | --- | --- |
| 2026-10-29 | `apps/studio/components/dealer-forge-page.tsx` (+ `.module.css`, `.test.mjs`) | Forge-UI:t "Skapa material"; ingen route i `client/admin/entry.tsx`, `/admin/dealer-studio` leder till `dealer:klipp` | `git show 3ff8f5daa:apps/studio/components/dealer-forge-page.tsx` |
| 2026-10-29 | `apps/studio/components/probe-editor.tsx` (+ `.module.css`) | Gammal provredigerare, 0 läsare (#665) | `git show 9f9f20806:apps/studio/components/probe-editor.tsx` |
| 2026-10-29 | `apps/studio/components/dealer-material-page.tsx` | Omslag kring Forge-UI:t, 0 läsare (#665) | `git show 9f9f20806:apps/studio/components/dealer-material-page.tsx` |
| 2026-10-29 | `apps/studio/client/lobby/public/images/dealers/astrid.jpg`, `.../videos/dealers/astrid-look.mp4` | Astrids lobbyporträtt och porträttklipp; Astrid är raderad (#665) | `git show 9f9f20806:apps/studio/client/lobby/public/images/dealers/astrid.jpg` |

## Raderade 29 oktober 2026: O02-verktygen

O02 är VERIFIED och frysningen hävd. `tools/merge-pr.mjs` hade `--freeze` och läste `REPO` och `CI_WORKFLOW` därifrån; flaggan är borta och konstanterna står i `merge-pr.mjs`. `tools/o02-snapshot.mjs` raderades inte: det är steg 8 i restoreboken och heter nu `tools/db-snapshot.mjs`.

| Datum | Fil | Vad det var | Läses med |
| --- | --- | --- | --- |
| 2026-10-28 | `tools/o02-freeze-check.mjs` (+ `test/o02-freeze-check.mjs`) | O02:s frysprov F1, F2, F5 och F8 för en kandidat, och runtimeprefixen bakom `merge-pr.mjs --freeze` | `git show d88d7a69c:tools/o02-freeze-check.mjs` |
| 2026-10-29 | `media/layout.json`, roten `web/public/bo/gen` | Rot till `media/site/runtime/backoffice/gen`; ingen spårad fil, ingen rad i `files` eller `blob-index.json`, ingen läsare | `git show d88d7a69c:media/layout.json` |

## Raderade 29 oktober 2026: Admin-kartan och skissen efter enkel väg

Båda fanns i `main` på `989609e9b` (efter enkel väg PR 1–8). De beskrev Admin före förenklingen; [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) kortades samtidigt till läget på `main`, och hela målbilden läses med `git show 989609e9b:docs/plans/ADMIN-FORENKLING.md`.

| Datum | Fil | Vad det var | Läses med |
| --- | --- | --- | --- |
| 2026-10-28 | `docs/plans/ADMIN-KARTA.md` | Kablagekarta över Admin (först läst på `34fc4cdc02`): sidor, läsningar, knappar som höjer paketrevisionen, pensionerade adresser, nivå 2 och 3 | `git show 989609e9b:docs/plans/ADMIN-KARTA.md` |
| 2026-10-28 | `docs/plans/ADMIN-MALBILD-PROTOTYP.html` | Klickbar skiss av målbilden i en fil, med exempeldata i minnet | `git show 989609e9b:docs/plans/ADMIN-MALBILD-PROTOTYP.html` |

## Tidigare raderingar

- `docs/history/` (överlämningar, körlistor och kvitton från före 28 oktober) raderades i `8ad45fbf` och `a90dde8d` (28 oktober 2026). Läs med `git show 29ed6626bf:docs/history/<fil>`; `git log --diff-filter=D -- docs/history` listar filerna.
- Admin-kartan från 22 oktober raderades i `61cf0ee8` när `docs/plans/ADMIN-KARTA.md` ersatte den (själv raderad, se ovan).
