# Överlämning: Scoutgaming

Uppdaterad 29 oktober 2026, natt, mot `main` `6f2d8236` (efter #556). Skriven för en agent som börjar kallt från `origin/main`. Läs först [START-HERE.md](../START-HERE.md) (produktväg, identiteter, leverans) och [AGENTS.md](../AGENTS.md). Jakobs aktuella instruktioner går före allt här. Alla dokument står i [docs/README](README.md); raderade dokument läses ur Git ([HISTORIK](HISTORIK.md)).

## Läget

- **Status:** bara i [migrering/STATUS.md](../migrering/STATUS.md), genererad från [status.json](../migrering/status.json). Migreringen är klar: alla 20 aktiviteter VERIFIED, O03 via #527. Arbetet nedan ger inga poäng och ändrar inte status.
- **Mergat natten 28–29 oktober:** #552 (tal på delat bord), #553 (ignore-filerna), #554 (assistenten utan `CROUPIER_LAB_UI_ORIGIN`), #555 (`merge-pr.mjs` kräver färsk CI-bas och raden `Buggranskning:`), #556 (bordet: H/S/D/P med fokus i beslutspanelen), #557 (klipplogik), #558 (miljöinventeringen [2026-10-29-ENV-INVENTORY](2026-10-29-ENV-INVENTORY.md)), #559 (kvitton raderade, [HISTORIK](HISTORIK.md)), #560 (vilosekvens per dealer som data), #561 (nyckel → bolag B), #562 (branchen `preview` är previews källa), #563 (CI: utkast kör lätt, klar PR kör fullt), #564 (döda verktyg, prov och typfiler raderade). Kvällen före: #544 (Admin nivå 1 och 2, demo-byggaren, AI-bakgrunder, bordets F12–F16), #538 (nyckel → bolag A), #549 (TALKEDJA T3).
- **Öppna PR:er** (underagenter mergar aldrig; orkestratorn mergar efter grön `CI`):
  - #566: ingångsfiler för alla verktyg (CLAUDE.md, GEMINI.md, `.github/copilot-instructions.md`, `.windsurf/rules/scoutgaming.md`, `.cursor/rules/scoutgaming.mdc`); alla pekar på START-HERE och AGENTS.
  - #567: Admins små pil- och fotnotstexter (`Öppna →`, Tekniska detaljer, fotnoterna) blir ikoner, länkar och vanliga ord, och Scoutguiden laddas inte längre på Admin-sidorna. Kräver Jakobs visuella ok.
  - #568: Admin-klienten får samma React, esbuild och TypeScript som Studio, och planen [VERKTYGSKEDJA](plans/VERKTYGSKEDJA.md) för steg H.
  - #569: [användarguiden](../apps/studio/docs/README.md) följer dagens Admin-meny; [ADMIN-KARTA](plans/ADMIN-KARTA.md) markerad som läst före steg E (sidnivån inaktuell, API:er och lagring gäller).
  - #570: testlås: etikettregex byts mot roll-, aria-, prop- och anropskontroller, så ordändringar i Admin inte fäller CI.
  - #571: planen [PARTNERPORTAL-KONVERTERING](plans/PARTNERPORTAL-KONVERTERING.md): Partnerportalen från `kevin-bo` till mains mönster.
  - #573: nattens fynd i sakdokumenten (den här filen, ENVIRONMENT-VARIABLES, CLOUD-MIGRATION, BLOB-NEON). #574 (mergas efter #573): `migrering/` efter avslutet, där MASTERPLAN blir en pekare och underlag som inget läser raderas.
  - #550 och #551 (Kevins kortkommandon och resultat; gemensamma blackjackregler) är fortfarande öppna. #556 byggde på #550 utan resultatspärren.
- **Produktion:** Vercel `scoutgaming` deployar `main` automatiskt. Kontrollera Render med `curl https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`; `/__cloud/shared-room-health` är inte publikt nåbar. `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen. F11 (#529) är mergad 28 oktober, men inget kvitto på prov i preview finns i dokumenten: deploya `croupier-v3` bara när bordet är tomt ([ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten)) tills F11 är kvitterad.
- **Databasen:** Neon-projektet `croupier-production`, databasen `croupier_game`, fyra scheman och 74 tabeller; schemakartan och de två migreringsledgrarna står i [BLOB-NEON](storage/BLOB-NEON.md#scheman-och-skrivare). `game-012-api-key-operator` är körd i produktionen 2026-10-29 01:46Z (och i preview); Studio 021 (bolagets material) är valfri och inte körd.
- **Var `/admin` läser:** bara Neon `croupier_studio`, utan reserver ([CLOUD-MIGRATION](CLOUD-MIGRATION.md#ytor-och-datalagring)). Gammalt innehåll som syns i Admin är rader i Neon. `/admin` är en esbuild-SPA, byggd till `apps/studio/design-preview-build/`, inte Next-sidor.
- **Miljövariabler:** alla namn som koden läser står i [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md). Vercel-posterna under [Att ta bort](ENVIRONMENT-VARIABLES.md#att-ta-bort-ur-vercel-production) väntar på att Jakob tar bort dem i panelen.
- **Johns Bet (PAOW):** paket 13 och spelinställningen `room-config-36bf0df8…` i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`, på det delade bordet. En strandad nativerunda (beslutsfas, 20 demo-USD dragna) ligger kvar.
- **Preview:** branchen `preview` deployas till preview.scoutgaming.tech ([START-HERE](../START-HERE.md#preview)).
- **Merge:** `CI` gäller PR:ens head; branchen behöver inte vara à jour med `main`, men `merge-pr.mjs` nekar om `main` sedan CI-körningen ändrat samma filer eller paketrot.

## Pending Jakob (blockerar inget)

- dragan-test: paket 16 är sparat; spelinställningen är inte publicerad (publicera i Admin eller pausa rummet).
- Vilosekvens per dealer (#560 mergad): för PAOW **Körregel → Koppla 21 viloklipp** → spara → **Publicera PAOWs viloklipp**. För Dragan laddas de 16 originalen i `apps/studio/lib/idle-rotation-sources/dragan-de31659c.json` upp till facket **Vila**, `andas` blir basklipp, sekvensen kopplas och paketet publiceras. Båda kräver Jakobs visuella godkännande.
- Vercel-posterna ovan, och om `croupier-lab-ui.vercel.app` ska bli en redirect till www.
- Innehållet i `croupier_studio.documents` kunde inte läsas av agenter i natt. Förslag: `select kind, revision, length(value::text), updated_at from croupier_studio.documents`, och en titt på `dealerTrash`, `legacyClipReview` och bolaget `sg-test`.
- Visuellt ok för #567 och för bordet efter #536 och #556 på dator och telefon.

## Efter O03

Nästa arbete, i ordning (Jakobs beslut 28 oktober, kompletterat 29 oktober). Varje punkt är en vanlig PR med grön CI, provas i preview när orkestratorn bedömer att det behövs och kvitteras med verifierad Vercel- och Render-SHA.

1. **F11:** #529 (anslutningarna stängs med 1012 vid SIGTERM, ögonblicksbilder oavsett instans) provas i preview; därefter deployas `croupier-v3` även när bordet inte är tomt.
2. **Admin-förenkling** ([ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md)): steg E (meny och nav) är byggt i #544. Nu: #567, #569 och #570; förhandsvisningen (propen `revision` saknas i `companies-page.tsx` på bolags- och spelbordssidan, och `CompositionPreview` i dealer- och spelbordspanelen); **steg D**, en Publicera i stället för fem knappar (§7); steg F (spelare → bolag), G (städning) och H ([VERKTYGSKEDJA](plans/VERKTYGSKEDJA.md), #568). Nivå 2 följer [PARTNERPORTAL-KONVERTERING](plans/PARTNERPORTAL-KONVERTERING.md) (#571).
3. **Dealer-generisk talkedja, Paow först** ([TALKEDJA](plans/TALKEDJA.md), bakgrund i [PAOW-LIPSYNC](plans/PAOW-LIPSYNC.md)): T3 är mergad (#549). Före rörligt tal: RunPod-mallens `MOVING_CALLBACK_ORIGIN` pekar på raderade `croupier-v2`, och `croupier-v3` har de gamla `CROUPIER_MOVING_SPEECH_BANK_RECORD`/`_ENDPOINT_ID` men saknar `CROUPIER_MOVING_SPEECH_BANK_RECORDS`. ElevenLabs-kontot (Kevins) är till största delen förbrukat. Bara Jakob godkänner ljud och läppsynk.
4. **Nyckel → bolag** ([NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md)): A (#538), 012 och B (#561) är klara. Nästa är C: kravhöjning, legacygrenen bort, nativa bord och rumsoraklet.
5. **L3:** rummens namn och läge läses ur det publicerade paketet i stället för administrationsdokumentet (den farligaste dubbellagringen; rummet finns i dag på fyra ställen).
6. **Ren start steg 2** enligt [REN-START](plans/REN-START.md).
7. **Kevins portplan P4–P14** ([KEVIN-PORT](plans/KEVIN-PORT.md)); P7 (gäståtkomst) och P13 (desktop) kräver Jakobs beslut. Därefter pensioneras nativebordet (`blackjack_tables`, `native_presentations`).
8. **Skalningstest:** tio bord med sju spelare (10×7) som grind, med motorns kända serialiseringspunkter mätta (globalt lås även vid läsning, auditlåset, den sekventiella schemaläggaren).
9. **Preview får egen taluppsättning** när den generiska talkedjan byggs, med egna nycklar och egen budget; produktionens nycklar kopieras aldrig dit.
10. **Databasen** (kräver Jakobs ja för varje DML eller DDL): efterhandsrader `game-008`–`010` och readiness som också läser spel-ledgern; BO-resterna (`bo_lab_handoffs`, `bo_game_handoffs`) bort, först konsumenterna och sedan en spelmigrering i 011:s form (D2); en gallringsregel för `document_history` (en fjärdedel av databasen med tre dokument); preview i takt (011 och Studio 016, 018, 019); index för bolagsrapporter tillsammans med steg F.
11. **Städning (D6):** QA-rollerna `croupier_game_qa` och `croupier_studio_qa_abc92154cb15`, `pg_stat_statements` ur schemat `croupier_game`, `CROUPIER_ASTRID_CAMERA=1` på `croupier-v3` (kamera och röst behålls; flaggan är Astrid-märkt), O03:s Neon-grenar, restoremålen och backupgrenarna, det syntetiska prodkontot `o03v-3436cfb2`, staging-QA-rester och gamla Vercel-previews.

D3c (talströmning med delat bord) är inte provad i preview; återgången D7 (flaggan av och låst deploy av `3415c310`) är förgodkänd och behövdes inte.

## Behörigheter

Agenter får läsa Neon, Render-loggar och Vercel, prova i preview med syntetiska konton och öppna PR:er. Underagenter mergar aldrig. Jakob krävs för publicering i produktionens Admin, produktions-DDL och DML, radering av molnresurser, produktionsflaggor, betald drift och allt visuellt eller AV; hash och testpass räknas inte som visuellt godkännande. Aldrig hemligheter i Git eller chatt, prov mot riktiga användare eller Johns Bet, eller ändringar i Kevins brancher.

## Kända fällor

- **Deploy med delat bord på:** kontrollera `shared_table_members WHERE active` och `shared_wallet_reservations` (båda 0) före varje `croupier-v3`-deploy tills F11 är kvitterad.
- **Prov i preview:** delat bord innebär att Jakobs hand stör mätningarna. Låt honom inte spela medan en harness kör.
- **Två ledgrar med krockande nummer:** `ops/neon-game/012` är inte `ops/neon-studio/012`. Skriv alltid `game-012` eller Studio 012 ([BLOB-NEON](storage/BLOB-NEON.md#scheman-och-skrivare)).
- **Ordändringar i Admin:** pre-commit väljer prov på filnamnsstam, så en ändrad etikett kan passera lokalt och falla i CI. Se urvalet med `node tools/precommit-checks.mjs --plan`; #570 tar bort de flesta etikettlåsen.
- **Pre-push-hooken** (`tools/check-push-target.mjs`) tillåter bara radering av `jakob/*`-brancher som redan är mergade i `main`; GitHub raderar mergade headbrancher automatiskt.
- **Render MCP:** `update_environment_variables` slår ihop nycklar och startar en deploy av branchens senaste commit direkt. Den läser inga värden; använd REST med `RENDER_API_KEY`.
- **Windows:** `core.longpaths` är på i repot. Kvarblivna mappar tas bort med `Remove-Item -LiteralPath ('\\?\' + $p) -Recurse -Force`. Filbevakningsprov kan fallera lokalt; CI avgör.
- **Hemlighetsskanning:** bokstavliga Postgres-URI:er i tester underkänns. Använd `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`.
- **Namn:** `recordedSpeech` v2 är MP4-talformatet, inte Render-motorn v2. Partner-API (kundkontraktet, `/api/v1/*`) är inte portal-API:t (`/studio/api/partner/*`), se [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).

## Separata spår

- **Ren start:** [plans/REN-START.md](plans/REN-START.md). Astrid tas bort som dealer, inklusive legacyreferensen (Jakob: "radera allt sånt"). I repot är K1 (#480, #546), K3 (#545) och repo-PR 2 (#488) mergade; Neon- och Blob-stegen väntar på Jakobs go, och bankformatet tas bort i K1b efter katalogbytet (steg 6). Dragans dealer, talbank och talkedja behålls som referens när AI-tal med läppsynk görs dealergeneriskt.
- **Admin-förenkling (UX):** `/admin`, `/partner` och spelarens väg ska vara enkla och begripliga. Målbilden med leveransordning är [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) med den klickbara skissen [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html); kablagekartan är [ADMIN-KARTA](plans/ADMIN-KARTA.md). Jakob avgör UX.
- **Motorn efter O03:** `croupier-v3` blir ren kort-, sko- och matematiktjänst, och tal och presentation får en egen tjänst.
- **Repostruktur:** rotens `test/` per ägare, `tools/` i `ci/`, `dev/` och `ops/`, media i Git till Blob och en verktygskedja för `apps/web` och Admin-klienten är föreslagna men inte beslutade; de tre `tools/`-modulerna som produktionsimagen kopierar (`ops/cloud/Dockerfile.game`) flyttas i så fall till ett paket.
