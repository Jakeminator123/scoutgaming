# Överlämning: Scoutgaming

Uppdaterad 28 oktober 2026, eftermiddag. Skriven för en agent som börjar kallt från `origin/main`. Läs först [START-HERE.md](../START-HERE.md) (produktväg, identiteter, leverans) och [AGENTS.md](../AGENTS.md). Jakobs aktuella instruktioner går före allt här. Alla dokument står i [docs/README](README.md); raderade dokument läses ur Git.

## Läget

- **Status:** bara i [migrering/STATUS.md](../migrering/STATUS.md), genererad från [status.json](../migrering/status.json). K04–K07 är VERIFIED sedan 28 oktober (90 %); bevis, granskare och Jakobs scopebeslut står i `status.json`. O02 pågår, O03 återstår.
- **O02 pågår:** kandidaten är `main` `f3780593` (efter #517), fryst 28 oktober 10:45:15Z enligt [O02-PLAN](plans/O02-PLAN.md) §1. Frysregistreringen (F1–F8) ligger utanför Git hos orkestratorn. Efter frysningen mergas bara dokument och verktyg utanför runtimeprefixen; en merge som rör dem ger en ny kandidat och alla omprov om. Väntar: omproven på kandidaten (K04 omprov 6, K06 och K07 omprov 2), restore-replay (§3), negativa fall (§5), den oberoende granskarens kvitto `docs/<datum>-O02-ACCEPTANCE.json` och Jakobs ögon V1–V7 (§4). Därefter status-PR:en till 95 %, förberedd som draft.
- **Produktion:** Vercel `scoutgaming` deployar `main` automatiskt. Render `croupier-v3` kör `3415c310` (#508); kontrollera aktuell SHA med `curl https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. Kandidaten går till produktionen först i O03.
- **Johns Bet (PAOW):** paket 11 och spelinställningen `room-config-4ad8301e…` i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`. Paket 10 och 11 var Jakobs egna publiceringar. Produktionen kör nativebordet; `CROUPIER_SHARED_TABLE_ENABLED` är osatt där till O03.
- **Staging:** Render och Vercel är pinnade på kandidaten `f3780593` med `CROUPIER_SHARED_TABLE_ENABLED=1`. Operatör `qa-k06k07-9dd2d3a4-a`, PAOW-rum `room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e`, paket 15. Jakobs egna inloggningar (Admin och spelare) är speglade från produktionen. Neon-endpointen autoskalar 0,5–2 CU sedan 28 oktober. Ingen annan deploy till stagingen under O02 utan orkestratorns besked.
- **Merge:** den obligatoriska kontrollen `CI` gäller på PR:ens head, men branchen behöver inte längre vara à jour med `main` (Jakob 28 oktober). Orkestratorn mergar grönt Jakob-ägt arbete och deployar `croupier-v3` efter varje grön main-CI som rör motorn (Jakobs ja 28 oktober); under O02 rörs inte runtime.

## Mergat 27–28 oktober

- **K04:** omprov 1 (#459), granskning (#460), F1/F2 (#465), omprov 2 (#475, underkänt: F3–F5), F3–F5 med den externa draften #476 som grund (#478), omprov 3 (#482, F5b och F4b), F5b, F4b, R1 och R2 (#481), omprov 4 (#501, nya fynd F5c och F7), F5c/F7/P2/P3 (#502–#508) och omprov 5 (#510) med granskarens del 4 i [K04-F3-F5-REVIEW](2026-10-28-K04-F3-F5-REVIEW.md) och Jakobs godkännande i staging 28 oktober. Status 90 % i #514.
- **Före frysningen:** L5 (#513, bryggan behåller `operator`), L4 (#516, Admin-servern projicerar launch-svaret) och bords-UX med K04-resterna F8, F9 och F10 (#517). L1 och L2 rättades i #503.
- **K05–K07:** K05-matrisen (#457), K07-granskningen (#456), K06/K07-omproven (#470) och deras granskning (#471).
- **Städning och Admin:** #458, #466, #479 och #483 (motorn startar ingen handoff från Admin till spelaren, SQLite B1); Admin #464, #467 och #468; Admin-arkitektens karta och målbild (#486); Astrids media utan konsument (#474); grind mot repotillväxt (#463); pushpolicyn för mergade brancher (#485); kortbaksidan (#473); CI-regressionen (#469, #472); `docs/history` raderad (#521).

## Kvar till O03

| # | Steg | Ägare |
| --- | --- | --- |
| 1 | Avsluta O02: omproven på kandidaten, restore-replay, negativa fall (L3 bokförs till efter O03), granskarens kvitto, Jakobs ögon V1–V7 och status-PR:en (95 %). | agenter; oberoende granskare; Jakob för V1–V7; orkestratorn |
| 2 | Produktions-DDL i godkänd ordning (011, `bo_game_handoffs`, `bo_lab_handoffs`, `lab_sessions`). | Jakob |
| 3 | `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen som del av releasen (väg B). | Jakob |
| 4 | Neon restore-branch för återställningsprovet mot migrerat schema. | Jakob |
| 5 | Stagingen blir preview (namnbyte, inte radering). | Jakob |
| 6 | Färsk ägar-, head-, CI- och säkerhetskontroll; release med verifierad Vercel- och Render-SHA. | orkestratorn |
| 7 | I produktionen: vanlig inloggning, Admin-sparning, launch och spel, och produktionens tre lager med inloggad spelare (skjutet från K04; Jakobs adminlogin får läsa med GET). | orkestratorn |
| 8 | Återställning dokumenterad mot migrerat schema i [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md), kvitto `docs/<datum>-O03-RELEASE-ACCEPTANCE.json` och status 100 %. | orkestratorn |

## Efter O03

1. Nya Admin: #518 (nivå 2, partnerportalen), sedan #519 (nivå 1), sedan #512 (demo-byggaren), alla prövade i staging före merge.
2. Dealer-generisk talkedja, med Paow först. Stillbildsvägen finns redan i main: `speechProfile` med `reference.kind='video-frame'`.
3. Ren start steg 2 ([REN-START](plans/REN-START.md)).
4. Generalisering av filmade profiler.
5. Bindning nyckel → bolag, där motorn kräver att `operator` matchar nyckelns bolag efter verifierad signatur.
6. Kevins portplan P4–P14.
7. Skalningstest (10×7).
8. L3: rummens namn och state ur paketet i stället för administrationsdokumentet.
9. K06 F1-policyn: nativebordet pensioneras med konsumentkontroll av `/api/table`, `native_presentations` och klientens enspelarväg; omladdning vid publicering är interimspolicy till dess.

## Behörigheter

Agenter får läsa Neon, Render-loggar och Vercel, prova i staging med syntetiska konton och öppna PR:er. Underagenter mergar aldrig. Jakob krävs för publicering i produktionens Admin, produktions-DDL, radering av molnresurser, produktionsflaggor, betald drift och allt visuellt eller AV; hash och testpass räknas inte som visuellt godkännande. Aldrig hemligheter i Git eller chatt, prov mot riktiga användare eller Johns Bet, eller ändringar i Kevins brancher.

## Kända fällor

- **Interimspolicy till O03:** materialbytande publicering under pågående nativehand ger omladdning till det nya paketet. Publicera därför inte materialbyte för Johns Bet medan händer pågår.
- **Prov i staging:** delat bord innebär att Jakobs hand stör mätningarna. Låt honom inte spela medan en harness kör.
- **Pre-push-hooken** (`tools/check-push-target.mjs`) tillåter sedan #485 bara radering av `jakob/*`-brancher som redan är mergade i `main`; GitHub raderar mergade headbrancher automatiskt.
- **Render MCP:** `update_environment_variables` slår ihop nycklar och startar en deploy. Den läser inga värden; använd REST med `RENDER_API_KEY`.
- **Windows:** `core.longpaths` är på i repot. Kvarblivna mappar tas bort med `Remove-Item -LiteralPath ('\\?\' + $p) -Recurse -Force`. Filbevakningsprov kan fallera lokalt; CI avgör.
- **Hemlighetsskanning:** bokstavliga Postgres-URI:er i tester underkänns. Använd `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`.
- **Glappet mellan PAOW:s hand och skon i stagingen** kommer från stagingmallens standardplacering, inte från produktionen. Det blockerar inte.
- **Talkedjan och Dealer Forge** är frysta till efter O03. Dragans tal är pausat, inget raderas.
- **Namn:** `recordedSpeech` v2 är MP4-talformatet, inte Render-motorn v2.

## Separata spår efter migreringen

- **Ren start:** [plans/REN-START.md](plans/REN-START.md). Astrid tas bort som dealer, inklusive legacyreferensen (Jakob: "radera allt sånt"); K1 är #480. Dragans dealer, talbank och talkedja behålls som referens när AI-tal med läppsynk görs dealergeneriskt.
- **Admin-förenkling (UX):** `/admin`, `/partner` och spelarens väg ska vara enkla och begripliga. Kablagekartan över alla tre nivåerna är [ADMIN-KARTA](plans/ADMIN-KARTA.md); den enda målbilden med leveransordning är [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) med den klickbara skissen [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html). Byggs efter O03 i ordningen ovan. Det finns inte i masterplanen; Jakob avgör UX.
- **Motorn efter O03:** `croupier-v3` blir ren kort-, sko- och matematiktjänst, och tal och presentation får en egen tjänst.
