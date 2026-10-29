# Överlämning: Scoutgaming

Uppdaterad 28 oktober 2026, eftermiddag, efter O03 (migreringen 100 %). Skriven för en agent som börjar kallt från `origin/main`. Läs först [START-HERE.md](../START-HERE.md) (produktväg, identiteter, leverans) och [AGENTS.md](../AGENTS.md). Jakobs aktuella instruktioner går före allt här. Alla dokument står i [docs/README](README.md); raderade dokument läses ur Git.

## Läget

- **Status:** bara i [migrering/STATUS.md](../migrering/STATUS.md), genererad från [status.json](../migrering/status.json). **Migreringen är klar: 100 % (20/20).** O03 VERIFIED via #527 efter oberoende granskning ([O03-REVIEW](2026-10-28-O03-REVIEW.md), GODKÄND MED ANMÄRKNING).
- **O03 släppt 28 oktober:** main-head `5f5bc88d` (runtime lika med O02-kandidaten `f3780593`). Vercel `dpl_DGRnRtHpVUrMz9V6kv8iXvbJYcJV` READY 13:39Z (senare auto-deployer av main, bara docs, runtimediff 0); Render `croupier-v3` `dep-dbgvog0ae00c73dgivq0` 13:44Z och, när flaggan sattes 13:52Z, `dep-dbgvsc5g1s2s73cdoqkg` live 13:53Z. 011 (`game-011-retire-lissabon`) applicerad 14:21:48Z; 74 tabeller. Backup och restoreprov S0 = S1 på grenen `backup-before-o03-20261028`. Spelad hand på delat bord med syntetiskt konto, 0 fel och 0 5xx i loggarna. Allt i [O03-kvittot](2026-10-28-O03-RELEASE-ACCEPTANCE.json).
- **Produktion:** Vercel `scoutgaming` deployar `main` automatiskt. Kontrollera Render med `curl https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`; `/__cloud/shared-room-health` är inte publikt nåbar. `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen: deploya `croupier-v3` bara när bordet är tomt (F11, [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten)) tills #529 är mergad och provad i preview.
- **Johns Bet (PAOW):** paket 13 och spelinställningen `room-config-36bf0df8…` i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`, nu på det delade bordet. En strandad nativerunda (beslutsfas, 20 demo-USD dragna) ligger kvar; de tre avräknade är inkasserade.
- **dragan-test:** paket 16 sparat av Jakob 13:53Z; spelinställningen är inte publicerad (pending Jakob, eller pausa rummet).
- **Preview** (tidigare staging) behålls; se [START-HERE](../START-HERE.md#preview).
- **Merge:** den obligatoriska kontrollen `CI` gäller på PR:ens head; branchen behöver inte vara à jour med `main`. Orkestratorn mergar grönt Jakob-ägt arbete och deployar `croupier-v3` efter grön main-CI som rör motorn, med F11-villkoret ovan.

## Pending Jakob (blockerar inget)

Publicera dragan-tests spelinställning i Admin (eller pausa rummet); frivilligt en egen hand i produktionen på dator och telefon och "godkänt".

## Efter O03

Nästa arbete, i ordning (bakgrund i [MASTERPLAN](../migrering/MASTERPLAN.md#efter-o03); punkterna ger inga procent):

1. **#529 F11:** merge → prov i preview → prod-deploy av `croupier-v3` vid tomt bord. Till dess deploy bara vid tomt bord.
2. **Gränssnitts-PR:en F12–F16** (draft på väg, `jakob/claude-table-layout`).
3. **#530** preview-namn i docs.
4. **Admin:** N2 → N1 → demo → AI-grenen efter designrunda (#518, #519, #512; [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md)).
5. **Städning:** syntetiskt prodkonto `o03v-3436cfb2` (saldo 995), staging-QA-rester, Vercel-previews, D6 (QA-roller, `pg_stat_statements`, `CROUPIER_ASTRID_CAMERA`, O03:s Neon-grenar och restoremål).
6. **Dealer-generisk talkedja med Paow** ([PAOW-LIPSYNC](plans/PAOW-LIPSYNC.md)): RunPod-callbacken (`MOVING_CALLBACK_ORIGIN`, pekar på raderade `croupier-v2`) rättas före rörligt tal. ElevenLabs-kontot (Kevins) är till 80 % förbrukat.
7. **Bindning nyckel → bolag** ([NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md)): A (#538) är live på `croupier-v3`, B (Admin, partnerportalen, demolänken) är tolerant före DDL. Väntar på Jakobs 012 i produktion och preview (previews återkallade testnyckel `o02-partnerkey-check` raderas först, annars nekar preflighten); därefter C.
8. **L3** (rumsnamn och state ur paketet), sedan O1, O4, L1-503.
9. **Ren start steg 2.**
10. **Kevins portplan** P4–P14 (skalningstest 10×7, preview med egen taluppsättning och pensionering av nativebordet följer i MASTERPLAN).

D3c (talströmning med delat bord) är inte provad i preview; återgången D7 (flaggan av och låst deploy av `3415c310`) är förgodkänd och behövdes inte.

## Behörigheter

Agenter får läsa Neon, Render-loggar och Vercel, prova i preview med syntetiska konton och öppna PR:er. Underagenter mergar aldrig. Jakob krävs för publicering i produktionens Admin, produktions-DDL, radering av molnresurser, produktionsflaggor, betald drift och allt visuellt eller AV; hash och testpass räknas inte som visuellt godkännande. Aldrig hemligheter i Git eller chatt, prov mot riktiga användare eller Johns Bet, eller ändringar i Kevins brancher.

## Kända fällor

- **Deploy med delat bord på:** kontrollera `shared_table_members WHERE active` och `shared_wallet_reservations` (båda 0) före varje `croupier-v3`-deploy tills F11 är rättad.
- **Prov i preview:** delat bord innebär att Jakobs hand stör mätningarna. Låt honom inte spela medan en harness kör.
- **Pre-push-hooken** (`tools/check-push-target.mjs`) tillåter sedan #485 bara radering av `jakob/*`-brancher som redan är mergade i `main`; GitHub raderar mergade headbrancher automatiskt.
- **Render MCP:** `update_environment_variables` slår ihop nycklar och startar en deploy av branchens senaste commit direkt (så sattes flaggan i O03). Den läser inga värden; använd REST med `RENDER_API_KEY`.
- **Windows:** `core.longpaths` är på i repot. Kvarblivna mappar tas bort med `Remove-Item -LiteralPath ('\\?\' + $p) -Recurse -Force`. Filbevakningsprov kan fallera lokalt; CI avgör.
- **Hemlighetsskanning:** bokstavliga Postgres-URI:er i tester underkänns. Använd `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`.
- **Namn:** `recordedSpeech` v2 är MP4-talformatet, inte Render-motorn v2.

## Separata spår efter migreringen

- **Ren start:** [plans/REN-START.md](plans/REN-START.md). Astrid tas bort som dealer, inklusive legacyreferensen (Jakob: "radera allt sånt"). I repot är K1 (#480) och repo-PR 2 (#488) mergade och driftsatta; Neon- och Blob-stegen väntar på Jakobs go, och bankformatet tas bort i K1b efter katalogbytet (steg 6). Dragans dealer, talbank och talkedja behålls som referens när AI-tal med läppsynk görs dealergeneriskt.
- **Admin-förenkling (UX):** `/admin`, `/partner` och spelarens väg ska vara enkla och begripliga. Kablagekartan över alla tre nivåerna är [ADMIN-KARTA](plans/ADMIN-KARTA.md); den enda målbilden med leveransordning är [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) med den klickbara skissen [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html). Byggs efter O03 i ordningen ovan. Det finns inte i masterplanen; Jakob avgör UX.
- **Motorn efter O03:** `croupier-v3` blir ren kort-, sko- och matematiktjänst, och tal och presentation får en egen tjänst.
