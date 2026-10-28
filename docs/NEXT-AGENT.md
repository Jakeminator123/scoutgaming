# Överlämning: Scoutgaming

Uppdaterad 28 oktober 2026, morgon. Skriven för en agent som börjar kallt från `origin/main`. Läs först [START-HERE.md](../START-HERE.md) (produktväg, identiteter, leverans) och [AGENTS.md](../AGENTS.md). Jakobs aktuella instruktioner går före allt här. Alla dokument står i [docs/README](README.md); raderade dokument läses ur Git.

## Läget

- **Status:** bara i [migrering/STATUS.md](../migrering/STATUS.md), genererad från [status.json](../migrering/status.json). K04, K05, K06 och K07 är VERIFIED sedan 28 oktober; bevis, granskare och Jakobs scopebeslut står i `status.json`. Kvar: O02 och O03.
- **Produktion:** Vercel `scoutgaming` deployar `main` automatiskt. Render `croupier-v3` körde `34fc4cdc` på morgonen 28 oktober; kontrollera aktuell SHA med `curl https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. #483 var mergad men ännu inte deployad då; den deployas före #477.
- **Johns Bet (PAOW):** paket 11 och spelinställningen `room-config-4ad8301e…` i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`. Paket 10 och 11 var Jakobs egna publiceringar. Produktionen kör nativebordet; `CROUPIER_SHARED_TABLE_ENABLED` är osatt där till O03.
- **Staging:** Render och Vercel kör K04-kandidaten från omprov 5 (head i `status.json[K04]`, `689c690e`; #508 är inte provad där) med `CROUPIER_SHARED_TABLE_ENABLED=1`. Operatör `qa-k06k07-9dd2d3a4-a`, PAOW-rum `room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e`, paket 15. Jakob har ett syntetiskt spelarkonto där; inloggningen finns bara lokalt hos orkestratorn.
- **Merge:** den obligatoriska kontrollen `CI` gäller på PR:ens head, men branchen behöver inte längre vara à jour med `main` (Jakob 28 oktober). Orkestratorn mergar grönt Jakob-ägt arbete och deployar `croupier-v3` efter varje grön main-CI som rör motorn (Jakobs ja 28 oktober).

## Mergat i natt (27–28 oktober)

- **K04:** omprov 1 (#459), granskning (#460), F1/F2 (#465), omprov 2 (#475, underkänt: F3–F5), F3–F5 med den externa draften #476 som grund (#478), omprov 3 (#482, F5b och F4b), F5b, F4b, R1 och R2 (#481), omprov 4 (#501, nya fynd F5c och F7), F5c/F7/P2/P3 (#502–#508) och omprov 5 (#510) med granskarens del 4 i [K04-F3-F5-REVIEW](2026-10-28-K04-F3-F5-REVIEW.md) och Jakobs godkännande i staging 28 oktober. Kvar och icke-blockerande, bokförda till O02: F8 (text vid återkallad session), F9 (en stannad reveal-tagning), F10 (1011 i stället för 1012), hit-kortet 2 av 4, B1 oprovat.
- **K05–K07:** K05-matrisen (#457), K07-granskningen (#456), K06/K07-omproven (#470) och deras granskning (#471).
- **Städning och Admin:** #458, #466, #479 och #483 (motorn startar ingen handoff från Admin till spelaren, SQLite B1); Admin #464, #467 och #468; Admin-arkitektens karta och målbild (#486); Astrids media utan konsument (#474); grind mot repotillväxt (#463); pushpolicyn för mergade brancher (#485); kortbaksidan (#473); CI-regressionen (#469, #472).

## Kvar till O02 och O03, i ordning

| # | Steg | Ägare |
| --- | --- | --- |
| 1 | Deploya #483 till `croupier-v3`, merga #477 (routningen för handoffen bort) och deploya igen. Avgör om #480 (K1, katalog utan Astrids bank) ingår före frysningen. Senare Admin-UX väntar till efter O03. | orkestratorn; Jakob för #480 |
| 2 | Avgör Admin-arkitektens tre läckor på nivå 3: rätta före frysningen eller klassa i O02. (a) `/game?dealer=X` utan operatör läser sparat projekt (`packages/presentation/server/game-entry-selector.mjs:54–63`). (b) `GET /api/presentation/config?dealerId=X` ger sparad idle och hela videoregistret till inloggade spelare och gäster (`services/game/presentation-api.mjs:174–181`). (c) Rumsnamn läses live från administrationsdokumentet, inte paketet (`packages/presentation/server/package-rooms.mjs:19–26`). | Jakob beslutar, agent rättar |
| 3 | Rätta `tools/o02-receipt.mjs`: rad 33 har inaktuell `room-config-38b14261`/paket 7, och rad 175 läser den borttagna `tools/no-sqlite-allowlist.json`. | agent |
| 4 | Frys kandidaten och registrera F1–F8 i [O02-PLAN §2.2](plans/O02-PLAN.md): main-SHA, grön CI, containerkontroll, GitGuardian, inga öppna runtime-PR:er, staging på kandidaten med flaggan på, schemaledger. | orkestratorn |
| 5 | Kör om K04-, K06- och K07-kvittona på kandidaten (F8). | agent |
| 6 | O02-kriterierna enligt planen: K2-kedjan Admin → publicering → lobby → launch → spel → återanslutning → Restart service → återläsning; K06-fälten dealerval, idle, chips och rumsutseende via scoped `roomOverrides` (Jakobs scopebeslut); negativa fall K3a–K3g (fel roll för partner täcks av CI enligt Jakob); `/control`, `/lab` och `/bo` startar ingen alternativ produkt; testfixturer utan riktiga data; två följande spel; HTTP-spelreplay efter restore (§3.3, stagingstegen är förgodkända); SQLite-slutet (K13). | oberoende granskare, inte implementeraren |
| 7 | Jakobs ögon V1–V7 (§3.4), bland annat fysisk telefon (V3, skjuten från K04) och trelagerslayout (V4). | Jakob |
| 8 | O02-kvittot `docs/<datum>-O02-ACCEPTANCE.json`; därefter status. | granskaren; orkestratorn |
| 9 | O03: färsk ägar-, head-, CI- och säkerhetskontroll; produktions-DDL i godkänd ordning (J09, `bo_game_handoffs`, `bo_lab_handoffs`, `lab_sessions`); `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen som del av releasen (väg B). | orkestratorn; Jakob för DDL och flaggan |
| 10 | O03: release med verifierad Vercel- och Render-SHA, inloggning, Admin-sparning, launch och spel, och produktionens tre lager med inloggad spelare (skjutet från K04; Jakobs adminlogin får läsa med GET). Återställning dokumenterad mot migrerat schema i [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md). Kvitto `docs/<datum>-O03-RELEASE-ACCEPTANCE.json`. | orkestratorn |
| 11 | Efter O03: Jakob raderar stagingen. Nativebordet pensioneras med konsumentkontroll av `/api/table`, `native_presentations` och klientens enspelarväg. | Jakob; agent |

## Behörigheter

Agenter får läsa Neon, Render-loggar och Vercel, prova i staging med syntetiska konton och öppna PR:er. Underagenter mergar aldrig. Jakob krävs för publicering i produktionens Admin, produktions-DDL, radering av molnresurser, produktionsflaggor, betald drift och allt visuellt eller AV; hash och testpass räknas inte som visuellt godkännande. Aldrig hemligheter i Git eller chatt, prov mot riktiga användare eller Johns Bet, eller ändringar i Kevins brancher.

## Kända fällor

- **Interimspolicy till O03:** materialbytande publicering under pågående nativehand ger omladdning till det nya paketet. Publicera därför inte materialbyte för Johns Bet medan händer pågår.
- **Prov i staging:** delat bord innebär att Jakobs hand stör mätningarna. Låt honom inte spela medan en harness kör.
- **START-HERE, steg 4 under Leverera,** säger fortfarande att branchen måste vara à jour med `main`. Det gäller inte längre.
- **Pre-push-hooken** (`tools/check-push-target.mjs`) tillåter sedan #485 bara radering av `jakob/*`-brancher som redan är mergade i `main`; GitHub raderar mergade headbrancher automatiskt.
- **Render MCP:** `update_environment_variables` slår ihop nycklar och startar en deploy. Den läser inga värden; använd REST med `RENDER_API_KEY`.
- **Windows:** `core.longpaths` är på i repot. Kvarblivna mappar tas bort med `Remove-Item -LiteralPath ('\\?\' + $p) -Recurse -Force`. Filbevakningsprov kan fallera lokalt; CI avgör.
- **Hemlighetsskanning:** bokstavliga Postgres-URI:er i tester underkänns. Använd `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`.
- **Glappet mellan PAOW:s hand och skon i stagingen** kommer från stagingmallens standardplacering, inte från produktionen. Det blockerar inte.
- **Talkedjan och Dealer Forge** är frysta till efter O03. Dragans tal är pausat, inget raderas.
- **Namn:** `recordedSpeech` v2 är MP4-talformatet, inte Render-motorn v2.

## Separata spår efter migreringen

- **Ren start:** [plans/REN-START.md](plans/REN-START.md). Astrid tas bort som dealer, inklusive legacyreferensen (Jakob: "radera allt sånt"); K1 är #480. Dragans dealer, talbank och talkedja behålls som referens när AI-tal med läppsynk görs dealergeneriskt.
- **Admin-förenkling (UX):** `/admin`, `/partner` och spelarens väg ska vara enkla och begripliga. Kablagekartan över alla tre nivåerna är [ADMIN-KARTA](plans/ADMIN-KARTA.md); den enda målbilden med leveransordning är [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) med den klickbara skissen [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html). Admin-arkitekten (parallell session, grenar `jakob/par-*`) rensar dubbla ytor i små PR:er före frysningen och bygger målbilden efter O03, nivå 2 först och i staging före merge. Det finns inte i masterplanen; Jakob avgör UX.
- **Motorn efter O03:** `croupier-v3` blir ren kort-, sko- och matematiktjänst, och tal och presentation får en egen tjänst.
