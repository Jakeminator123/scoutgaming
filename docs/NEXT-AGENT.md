# Överlämning: Scoutgaming

Uppdaterad 28 oktober 2026, eftermiddag, efter O03-releasen. Skriven för en agent som börjar kallt från `origin/main`. Läs först [START-HERE.md](../START-HERE.md) (produktväg, identiteter, leverans) och [AGENTS.md](../AGENTS.md). Jakobs aktuella instruktioner går före allt här. Alla dokument står i [docs/README](README.md); raderade dokument läses ur Git.

## Läget

- **Status:** bara i [migrering/STATUS.md](../migrering/STATUS.md), genererad från [status.json](../migrering/status.json). O02 är VERIFIED (95 %, #523). O03 är släppt i produktionen men inte statusfört; 100 % sätts först efter den oberoende granskningen.
- **O03 släppt 28 oktober:** main-head `5f5bc88d` (runtime lika med O02-kandidaten `f3780593`). Vercel `dpl_DGRnRtHpVUrMz9V6kv8iXvbJYcJV` READY 13:39Z; Render `croupier-v3` `dep-dbgvog0ae00c73dgivq0` 13:44Z och, när flaggan sattes 13:52Z, `dep-dbgvsc5g1s2s73cdoqkg` live 13:53Z. 011 (`game-011-retire-lissabon`) applicerad 14:21:48Z; 74 tabeller. Backup och restoreprov S0 = S1 på grenen `backup-before-o03-20261028`. Spelad hand på delat bord med syntetiskt konto, 0 fel och 0 5xx i loggarna. Allt i [O03-kvittot](2026-10-28-O03-RELEASE-ACCEPTANCE.json).
- **Produktion:** Vercel `scoutgaming` deployar `main` automatiskt. Kontrollera Render med `curl https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`; `/__cloud/shared-room-health` är inte publikt nåbar. `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen: deploya `croupier-v3` bara när bordet är tomt (F11, [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten)) tills #529 är mergad och provad i preview.
- **Johns Bet (PAOW):** paket 13 och spelinställningen `room-config-36bf0df8…` i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`, nu på det delade bordet. En strandad nativerunda (beslutsfas, 20 demo-USD dragna) ligger kvar; de tre avräknade är inkasserade.
- **dragan-test:** paket 16 sparat av Jakob 13:53Z; spelinställningen är inte publicerad (pending Jakob, eller pausa rummet).
- **Preview** (tidigare staging) behålls; se [START-HERE](../START-HERE.md#preview).
- **Merge:** den obligatoriska kontrollen `CI` gäller på PR:ens head; branchen behöver inte vara à jour med `main`. Orkestratorn mergar grönt Jakob-ägt arbete och deployar `croupier-v3` efter grön main-CI som rör motorn, med F11-villkoret ovan.

## Kvar till O03

| # | Steg | Ägare |
| --- | --- | --- |
| 1 | Oberoende granskning av O03-kvittot: `docs/2026-10-28-O03-REVIEW.md` med utlåtandet GODKÄND (eller fynden), och `verifiedBy` i kvittot. Granskaren har inte producerat något av bevisen. | oberoende granskare |
| 2 | Status-PR:en till 100 %: orkestratorns ifyllnadsskript (utanför Git) sätter `status.json[O03]` till VERIFIED med head `5f5bc88d`, PR #527 och granskaren, kör `node migrering/status.mjs --write` och `--check`. | orkestratorn |
| 3 | Pending Jakob, blockerar inte: publicera dragan-tests spelinställning i Admin (eller pausa rummet); frivilligt en egen hand i produktionen på dator och telefon och "godkänt". | Jakob |

## Efter O03

Ordningen och innehållet står i [MASTERPLAN](../migrering/MASTERPLAN.md#efter-o03); punkterna ger inga procent. Kortfattat:

1. **F11 först** (#529): 1012 vid SIGTERM och ögonblicksbilder oavsett instans; provas i preview. Till dess deploy bara vid tomt bord.
2. **F12–F15** i första gränssnitts-PR:en (mobil och 3-rutors fönster), sedan nya Admin: #518, #519, #512.
3. **Talkedjan:** dealer-generisk, Paow först ([#528](https://github.com/Jakeminator123/scoutgaming/pull/528)). Innan `CROUPIER_MOVING_SPEECH_ENABLED=1` slås på igen ska `MOVING_CALLBACK_ORIGIN` på RunPod-mallen rättas (pekar på raderade `croupier-v2`; Jakobs skript). ElevenLabs-kontot (Kevins) är till 80 % förbrukat.
4. **Bindning nyckel → bolag** (partnernyckel mot delat bord ger 403 i dag), L3, O1, O4 och L1-503.
5. **Städning (D6):** QA-roller, `pg_stat_statements`, `CROUPIER_ASTRID_CAMERA`, O03:s Neon-grenar och restoremål, och det syntetiska produktionskontot `o03v-3436cfb2` (saldo 995).
6. Ren start steg 2, Kevins portplan P4–P14, skalningstest 10×7, preview med egen taluppsättning, och pensionering av nativebordet med konsumentkontroll av `/api/table`, `native_presentations` och klientens enspelarväg.

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

- **Ren start:** [plans/REN-START.md](plans/REN-START.md). Astrid tas bort som dealer, inklusive legacyreferensen (Jakob: "radera allt sånt"); K1 är #480. Dragans dealer, talbank och talkedja behålls som referens när AI-tal med läppsynk görs dealergeneriskt.
- **Admin-förenkling (UX):** `/admin`, `/partner` och spelarens väg ska vara enkla och begripliga. Kablagekartan över alla tre nivåerna är [ADMIN-KARTA](plans/ADMIN-KARTA.md); den enda målbilden med leveransordning är [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) med den klickbara skissen [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html). Byggs efter O03 i ordningen ovan. Det finns inte i masterplanen; Jakob avgör UX.
- **Motorn efter O03:** `croupier-v3` blir ren kort-, sko- och matematiktjänst, och tal och presentation får en egen tjänst.
