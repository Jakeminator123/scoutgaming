# Historik: raderade dokument

En rad per dokument som raderats ur `main` efter att dess uppgift var klar. Innehållet finns bara i Git; läs det med `git show <sha>:<sökväg>` (sha är den sista main-commit där filen fanns). Det här är en lista, inget arkiv: inga kopior av innehållet, ingen historikmapp. Ett dokument som raderas senare får en rad här i samma PR.

Hänvisningar i `migrering/status.json` (fältet `evidence`) och i kodkommentarer till sökvägar nedan gäller fortfarande; de pekar på Git-versionen.

## Raderade 31 oktober 2026

| Fil | Vad det var och var det läses |
| --- | --- |
| `docs/2026-10-29-ENV-INVENTORY.md` | Daterad miljöinventering, ersatt av ENVIRONMENT-VARIABLES och ENVIRONMENT-RESTORATION. Kvarvarande gallringsfrågor är överförda. Sista main-version: `git show 6a3f976e4428627b135664ba7d13ae24593567c4:docs/2026-10-29-ENV-INVENTORY.md` |

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

## Raderade 31 oktober 2026: ersatt organisationsinventering

Den aktiva körplanen och sakguiderna bär kvarvarande arbete och kontrakt. Inventeringsfilerna nedan var frysta dubbletter, inte utfört arbete. F11-DRIFTKVITTO behålls som bevis för det gällande releasebeslutet.

| Datum | Fil | Vad det var | Läses med |
| --- | --- | --- | --- |
| 2026-10-31 | `docs/plans/organisation/ARBETSSATT.md` | Arbetssätt: aktiviteter, agenter och nya fynd; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/ARBETSSATT.md` |
| 2026-10-31 | `docs/plans/organisation/MASTERPLAN.md` | Organisation: ingång och inventeringsunderlag; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/MASTERPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/NULAGE.md` | Nuläge: inventeringsbas 31 oktober 2026; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/NULAGE.md` |
| 2026-10-31 | `docs/plans/organisation/UNDERLAG.md` | Underlag: källor, rättelser och spårbarhet; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/UNDERLAG.md` |
| 2026-10-31 | `docs/plans/organisation/gemensamt/OMRADESPLAN.md` | Gemensamt: tvärgående förarbete och beslut; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/gemensamt/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/gemensamt/aktiviteter/GEM-01.md` | GEM-01: Förstädning med bevis för varje kandidat; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/gemensamt/aktiviteter/GEM-01.md` |
| 2026-10-31 | `docs/plans/organisation/gemensamt/aktiviteter/GEM-02.md` | GEM-02: Miljöinventering utan att läsa eller ändra hemligheter; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/gemensamt/aktiviteter/GEM-02.md` |
| 2026-10-31 | `docs/plans/organisation/gemensamt/aktiviteter/GEM-03.md` | GEM-03: Beslutsspår för Git-historik och eventuell ny produktrepo; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/gemensamt/aktiviteter/GEM-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/01-repo-och-dokument/OMRADESPLAN.md` | Områdesplan: Repo och dokument; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/01-repo-och-dokument/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/01-repo-och-dokument/aktiviteter/DOC-01.md` | DOC-01: Rätta dokumentdrift från aktuell kod; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/01-repo-och-dokument/aktiviteter/DOC-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/01-repo-och-dokument/aktiviteter/DOC-02.md` | DOC-02: Förtydliga ord och levande tekniska namn; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/01-repo-och-dokument/aktiviteter/DOC-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/01-repo-och-dokument/aktiviteter/DOC-03.md` | DOC-03: Härled en liten system- och ansvarskarta; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/01-repo-och-dokument/aktiviteter/DOC-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/02-release-och-drift/OMRADESPLAN.md` | Områdesplan: Release och drift; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/02-release-och-drift/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-01.md` | REL-01: Läsande releasekvitto med resurs och kodomfång; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-02.md` | REL-02: Återställningsbevis för Neon och Render-state; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-03.md` | REL-03: Besluta om begränsad releaseautomation; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-04.md` | REL-04: Kontrollerad synk av preview inför nästa acceptansprov; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/02-release-och-drift/aktiviteter/REL-04.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/03-auth-och-sakerhet/OMRADESPLAN.md` | Områdesplan: Auth och säkerhet; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/03-auth-och-sakerhet/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/03-auth-och-sakerhet/aktiviteter/SEC-01.md` | SEC-01: Säkra preview-sessionens cookie; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/03-auth-och-sakerhet/aktiviteter/SEC-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/03-auth-och-sakerhet/aktiviteter/SEC-02.md` | SEC-02: Dela cookiepolicy utan att blanda sessioner; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/03-auth-och-sakerhet/aktiviteter/SEC-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/03-auth-och-sakerhet/aktiviteter/SEC-03.md` | SEC-03: Verifiera säkerhetstäckning och historikgap; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/03-auth-och-sakerhet/aktiviteter/SEC-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/04-spel-och-adaptrar/OMRADESPLAN.md` | Områdesplan: Spel och adaptrar; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/04-spel-och-adaptrar/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/04-spel-och-adaptrar/aktiviteter/GAM-01.md` | GAM-01: F11: verifiera restart och återanslutning i drift; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/04-spel-och-adaptrar/aktiviteter/GAM-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/04-spel-och-adaptrar/aktiviteter/GAM-02.md` | GAM-02: Konsolidera levande speladaptrar stegvis; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/04-spel-och-adaptrar/aktiviteter/GAM-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/04-spel-och-adaptrar/aktiviteter/GAM-03.md` | GAM-03: Fastställ processlokalt tillstånd och idempotensbehov; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/04-spel-och-adaptrar/aktiviteter/GAM-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/05-tal-och-ai/OMRADESPLAN.md` | Områdesplan: Tal och AI; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/05-tal-och-ai/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-01.md` | TAL-01: Generated speech vid delat bord med aktuellhetskontroll; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-02.md` | TAL-02: Isolera talfel från spelstart utan öppen fallback; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-03.md` | TAL-03: Verifiera röst-, bank- och miljöidentiteter; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-04.md` | TAL-04: Besluta om tal utanför spelprocessen; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-04.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-05.md` | TAL-05: Avgränsa Slack-restpunkt och verifiera minsta åtkomst; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/05-tal-och-ai/aktiviteter/TAL-05.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/06-admin-och-produkt/OMRADESPLAN.md` | Områdesplan: Admin och produkt; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/06-admin-och-produkt/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/06-admin-och-produkt/aktiviteter/ADM-01.md` | ADM-01: Samla kvarvarande publiceringskontrakt efter L3; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/06-admin-och-produkt/aktiviteter/ADM-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/06-admin-och-produkt/aktiviteter/ADM-02.md` | ADM-02: Välj nästa avgränsade UX-/partnersteg; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/06-admin-och-produkt/aktiviteter/ADM-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/06-admin-och-produkt/aktiviteter/ADM-03.md` | ADM-03: Verifiera partnerwalletens gräns och bolagssteg; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/06-admin-och-produkt/aktiviteter/ADM-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/07-data-och-media/OMRADESPLAN.md` | Områdesplan: Data och media; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/07-data-och-media/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/07-data-och-media/aktiviteter/DAT-01.md` | DAT-01: Fastställ schemaledger och läsroller per miljö; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/07-data-och-media/aktiviteter/DAT-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/07-data-och-media/aktiviteter/DAT-02.md` | DAT-02: Materialbyte med atomisk påverkan per rum och bolag; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/07-data-och-media/aktiviteter/DAT-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/07-data-och-media/aktiviteter/DAT-03.md` | DAT-03: Referensbaserad gallring med liten revisionskedja; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/07-data-och-media/aktiviteter/DAT-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/08-toolchain-och-ci/OMRADESPLAN.md` | Områdesplan: Toolchain och CI; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/08-toolchain-och-ci/OMRADESPLAN.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-01.md` | CI-01: Rätta runtime- och typmismatchar avgränsat; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-01.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-02.md` | CI-02: Välj och inför en versions-/testpolicy stegvis; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-02.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-03.md` | CI-03: Besluta om workspace och större byggförenkling; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-03.md` |
| 2026-10-31 | `docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-04.md` | CI-04: Granska mellanliggande Git-objekt före push; ersatt som arbetsunderlag av KORPLAN-v2 och sakguiderna | `git show 465c03fcd:docs/plans/organisation/omraden/08-toolchain-och-ci/aktiviteter/CI-04.md` |
