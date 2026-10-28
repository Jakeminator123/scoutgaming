# O02: oberoende samprov av en fryst kandidat

Omskriven 2026-10-28 mot `main` `b0d02bbd`. Ersätter planen från 27 oktober (skriven mot `e7a4e251`); den finns i Git-historiken. Kriterierna står i [MASTERPLAN](../../migrering/MASTERPLAN.md#o02--oberoende-samprov) (rad 70–76) och status i [STATUS](../../migrering/STATUS.md). Målet: O02 startar samma dag som K04–K07 blir VERIFIED. Allt som inte kräver den frysta kandidaten är förberett här.

| Verktyg | Vad |
| --- | --- |
| [tools/o02-freeze-check.mjs](../../tools/o02-freeze-check.mjs) | F1, F2, F5 automatiskt; F3 och F8 förifyllda; skriver `frozen-candidate.json` |
| [tools/o02-receipt.mjs](../../tools/o02-receipt.mjs) | Granskarens kvittoskelett: GET mot staging, `BEGIN READ ONLY` mot Neon, kvitton ur Git på kandidaten |
| [tools/o02-snapshot.mjs](../../tools/o02-snapshot.mjs) | S0/S1/S0′-paritet för restore-replay |
| [O02-RESTORE-REPLAY](O02-RESTORE-REPLAY.md) | Körklar kommandolista för §3 (inte körd) |

## 0. Läget

- **Kvitton som redan finns** (i `docs/`, alla tagna före frysningen): K04 [omprov 3](../2026-10-28-K04-BROWSER-RERUN-3-ACCEPTANCE.json) på `1f66245b` (omprov 4 efter #481 återstår), K06 [omprovet](../2026-10-28-K06-STAGING-RERUN-ACCEPTANCE.json) och K07 [omprovet](../2026-10-28-K07-STAGING-RERUN-ACCEPTANCE.json) på `13aa5a01`, K05 [produktionen](../2026-10-27-K05-PRODUCTION-ACCEPTANCE.json), granskningarna [K04/K05](../2026-10-28-K04-K05-REVIEW.md), [K06/K07](../2026-10-28-K06-K07-REVIEW.md) och [K07](../2026-10-28-K07-REVIEW.md).
- **Inget av dem gäller kandidaten.** Torrkörning 2026-10-28 ca 05:13 UTC mot main `c8a26b64`: runtimediffen mot kandidaten är 183 filer för K04-kvittot och 454 för K06/K07. Alla tre tas därför om på kandidaten (F8).
- **Staging** (läst read-only samma tid): Render kör `6a158180`, health 200. Rum `room-33b37ff3…` har `room-config-e0be09e9-414e-4a84-a77d-9fefe98c2932`, operatör A paket 15 och B paket 1 (Neon `red-violet-36066351`, `shared_table_config_heads` och `operator_packages`). Anonyma Admin-anrop ger 401, `/control` och `/lab` 307 → `/admin`, `/bo` 404. SQLite-förbudet är platt (`tools/check-no-sqlite.mjs`), utan allowlist.
- **Jakobs beslut som bokförs i status.json när K04–K07 blir VERIFIED** (ställs inte igen):
  - K07:s jämförelse main mot kandidat stryks (kandidaten är main).
  - Partnerrollen i wrong-role bevisas med CI-prov, eftersom stagingen saknar e-postleverans.
  - *Slå på ljud* stryks; knappen finns bara på nativebordet, som avvecklas efter O03.
  - K06:s fält för dealerval, idle, marker och rummets utseende via `roomOverrides` bevisas i O02 (V4 och kedjan K2 på kandidaten).
  - K06 F1: delat bord från O03, nativebordet avvecklas och omladdning är interimspolicy.
  - Jakob godkände PAOW:s 35 giv-, hål- och revealklipp 01:55 UTC ([omprov 2](../2026-10-28-K04-BROWSER-RERUN-2-ACCEPTANCE.json), `visualApproval`).

## 1. Fryst kandidat

### 1.1 Frysregeln

Kandidaten är en main-SHA, `$SHA`. Alla åtta måste vara sanna och registrerade i `frozen-candidate.json`.

| # | Krav | Hur det bevisas |
| --- | --- | --- |
| F1 | `$SHA` ligger på `origin/main` | `git merge-base --is-ancestor` (automatiskt) |
| F2 | Full CI är grön på exakt `$SHA` | Workflow *Croupier GitHub checks*, event `push` eller `workflow_dispatch`, `completed/success`. Push till main ger `scope=full` med migration readiness (automatiskt) |
| F3 | Containerkontrollen är grön på `$SHA` | *Render v3 container check* körs bara på PR med sökvägsfilter eller dispatch: `gh workflow run product-container-check.yml --ref main` direkt efter frysningen, så att run-head = `$SHA`. Förifylls om en körning finns |
| F4 | GitGuardian är läst | `node tools/security-status.mjs`; skriv status och antal öppna incidenter, aldrig utdrag (manuellt) |
| F5 | Inga öppna icke-draft-PR:er rör runtime | `gh pr list --json files` mot `RUNTIME_PREFIXES` (automatiskt). Drafts listas men blockerar inte |
| F6 | Staging kör `$SHA` på både Vercel och Render | Deploy med låst SHA ([D1–D3](O02-RESTORE-REPLAY.md#d-deploy-med-låst-sha-används-i-r0-r7-och-r9)). Registrera `dep-…`, `dpl_…` och SHA; `/__cloud/version` = `$SHA` (manuellt) |
| F7 | Schemaledgern på staging är registrerad | Studio och game `storage_migrations` med checksummor och 15 `shared_*`-tabeller ([R6-frågan](O02-RESTORE-REPLAY.md#r6-s1-och-jämförelse)) (manuellt) |
| F8 | K04-, K06- och K07-kvittona i Git är tagna på `$SHA` eller en runtime-ekvivalent SHA | `git diff --name-only <kvittots SHA> $SHA -- RUNTIME_PREFIXES` är tom (förifylls). Annars tas de om: K04 som `RERUN-4`, K06 och K07 som ny `RERUN` |

**Frysregel:** dokumentmerges (`scope=documentation`) är tillåtna efter frysningen. Varje merge som rör runtimeprefixen ger en ny kandidat och kräver att F1–F8 görs om. Runtimeprefixen: `services/game/`, `ops/cloud/`, `ops/neon-game/`, `ops/neon-studio/`, `packages/`, `apps/studio/`, `apps/web/`, `apps/speech/`, `services/openclaw/lab/` och `services/astrid-gpu-worker/gateway/`.

### 1.2 Före frysningen

1. Merga det som ska med: #481 (K04 F5b/F4b), och läckrättningen L1+L2 om Jakob väljer det (§5.2). Admin-UX efter detta väntar till efter O03.
2. Inga öppna icke-draft-PR:er på runtime. Övriga PR:er sätts som draft eller väntar.
3. `git fetch origin`, välj `$SHA` = main-head efter grön push-CI.

### 1.3 Registrering

```sh
node tools/o02-freeze-check.mjs --candidate $SHA --out "$O2/o02/frozen-candidate.json"
```

Skriptet skriver `automatic` (F1, F2, F5), `prefilled` (F3 och F8) och `manual` (F4, F6, F7 med `how`). Fyll `manual` för hand samt `frozenAt` och `frozenBy`. Exit 0 betyder att F1, F2 och F5 passerar; F3, F4 och F6–F8 bedöms av den som fryser. Sätt därefter `status.json[O02]` (`head` = `$SHA`, `branch` = `main`) i O02:s status-PR.

## 2. Granskningen

- **Oberoende:** en färsk agent (Opus high/xhigh eller Fable) som inte har producerat något kvitto. Diskvalificerade: orkestratorn och dess underagenter som körde J08, K04-, K06- och K07-omproven samt K05, Codex/Cloud (J10) och utföraren av omproven på kandidaten. Granskaren läser, kör `o02-receipt.mjs` och gör egna GET och SELECT; den deployar inte, sätter inga flaggor, skriver ingen SQL och godkänner inte AV.
- **Tillskrivning:** varje bevis i O02-kvittot får `producedBy` och `verifiedBy`.
- **Körning:**

  ```sh
  node tools/o02-receipt.mjs --candidate $SHA --inputs "$O2" --github --neon --neon-url-file "$O2/private/src-app.url" \
    --reviewer <agent-id> --out "$O2/o02/o02-receipt.json"
  ```

  Kriterier: F1, F8, E1, N1, R1, T1, C1, D1, B1, M1, S1, Q1 och I1 automatiskt; V1–V7 manuellt (pass bara via Jakobs manifest med `by:"Jakob"` och samma kandidat).
- **Kvittokontrakt:**
  - I Git på kandidaten, nyaste per familj: `docs/<datum>-K04-BROWSER-RERUN-<n>-ACCEPTANCE.json` (RERUN-3 i dag, RERUN-4 på kandidaten), `docs/<datum>-K06-STAGING-RERUN[-<n>]-ACCEPTANCE.json` med `o02ContractChecks[]` (`wrong-role`, `bad-media-id`, `interrupted-presentation`) och `twoConsecutiveGames`, samt `docs/<datum>-K07-STAGING-RERUN[-<n>]-ACCEPTANCE.json` med `checks[]` och `candidate`.
  - Utanför Git i `$O2/o02/`: `frozen-candidate.json`, `restore-replay/receipt.json`, `jakob-eyes/manifest.json` och `negative/receipt.json` (`{candidate, cases:[{id, result: pass|fail|booked, note}]}`).
- **Torrkörning** mot `c8a26b64` med `--github` utan Neon: fail=3, missing=8, pass=2, manual=7. F1 fail (öppen runtime-PR #491, ingen containerkörning). F8 fail (kvittona 183/454 filer bort). S1 fail av samma skäl. Q1 och R1 pass. M1 visar alla tio repliker utlösta i kvittona men väntar på Jakobs manifest. Skriptet skrev bara kvittofilen.
- **Rapport:** observerat resultat per kriterium, testmiljö (SHA, `dep-`/`dpl_`, Neon-scope, Blob `store_7E06N1P4w9Mu1dZD`) och kvarvarande brister, varje fynd blockerande eller inte med motivering. Sanerat kvitto: `docs/<datum>-O02-ACCEPTANCE.json`.

## 3. Restore-replay (variant B)

**Mål:** en färsk dump av nuvarande staging (Studio 020, publicerad config, paket, godkända tal och ledgern från omproven) återställs fullständigt. Motorn körs mot kopian, och en autentiserad spelare får lagrade svar återspelade utan ny ekonomisk effekt och spelar vidare med exakt bokföring. Källan är bevisat orörd.

**Mål-databas:** ny tom `croupier_staging_restore_o02` med ägare `croupier_staging_migrator`, `CONNECT` för `croupier_staging_app` och ingen PUBLIC. `croupier_staging_restore` (J10:s bevis från 25 oktober) lämnas orörd.

**Jakobs go (2026-10-28, bokfört):** de fyra separata godkännandena kallade Jakob "för nitiskt": "fixa bara detta på bästa sätt". Det är ett samlat go för stagingstegen: skrivarstopp i staging, ny tom restoredatabas, byte av stagingens databas-env till kopian och tillbaka, och lösenordsåterställning av en syntetisk spelare i kopian. Produktionen rörs inte. Radering av resurser och nya betalda resurser omfattas inte.

| Steg | Åtgärd | Grind |
| --- | --- | --- |
| R0 | Kandidaten kör på staging (F6); omproven på kandidaten ligger i Git (F8) | `frozen-candidate.json` |
| R1 | Stoppa skrivare: suspendera Render-stagingen och pausa Vercel-stagingen (Vercel Studio skriver Neon direkt) | Health inte 200, Vercel 503; tider |
| R2 | Snapshot S0 av källan som approll (`o02-snapshot.mjs`) | `s0.json` med total hash |
| R3 | `pg_dump --format=custom` som migrator, PG 18-klient | Byte, sha256, `--list`-antal, klientversion |
| R4 | Skapa målet och sätt grants | Neon-svar; `has_database_privilege` |
| R5 | `pg_restore --single-transaction --exit-on-error` | exit 0 |
| R6 | S1 på målet med samma SQL; ägare och ACL | `S1 == S0`; Studio-ledgern har 020 |
| R7 | `CROUPIER_GAME_DATABASE_URL` på Render och Vercel → målet; starta; deploya `$SHA` | `/__cloud/version` = `$SHA`; målets databas i loggen |
| R8a | Admin-läsning: room-game-config, lobby A och B, transaktioner | Lika med S0; HTTP-ledgerns hash = SQL-hashen |
| R8b | Lösenordsåterställning av P1 i kopian, login, omsändning av P1:s `stand`/`collect` med samma `requestId` | Lagrat svar, 0 nya ledgerrader, ändrad kropp med samma id ger 400 |
| R8c | Ny hand med P1 i rum 33b37ff3 | Exakta media-UUID/SHA ur paketet; delta = −insats +retur |
| R8d | Omsändning av R8c:s `requestId` | Identiska svar, 0 nya rader |
| R8e | Ledgerhash `L1` på målet | `L1` = hash(S1 + R8c:s rader); HTTP = SQL |
| R9 | S0′ på källan medan appen pekar på målet, sedan tillbaka till `croupier_staging`, deploy `$SHA`, grind | `S0′ == S0` |
| R10 | Kvitto `o02/restore-replay/receipt.json` med fälten som `o02-receipt.mjs` läser | Inga hemligheter; dumpen ligger privat |

Kommandon för varje steg: [O02-RESTORE-REPLAY](O02-RESTORE-REPLAY.md). Bevisgränser i kvittot: Neon-PITR och globala roller ingår inte, R8b är en avsiktlig skrivning i kopian, och Blob-bytes återställs inte (de är oföränderliga; hash och HEAD visar att de nås).

## 4. Jakobs ögon (V1–V7)

Jakob ger varje punkt ett omdöme i `o02/jakob-eyes/manifest.json`: `{id, verdict: approved|rejected, by:"Jakob", at, candidate:"$SHA", screenshots:[{file, sha256}]}`. Skärmbilderna sparas privat i `o02/jakob-eyes/`. Viewport: desktop 1440×900, mobil 390×844 och 320×568, och fysisk telefon där det anges. Agenten tar bilderna; Jakob bedömer. Jakob spelar inte i staging medan en mätning pågår, eftersom det delade bordet stör mätningen.

| ID | Vad Jakob bedömer | Skärmbilder och inspelningar |
| --- | --- | --- |
| V1 | Kortkontakt vid bordet i PAOW:s giv till varje ruta, hålkort och reveal. Klippen är godkända i Admin; nu gäller själva bordet | `v1-deal-box{n}-{desktop,390}.png`, `v1-hole-*.png`, `v1-reveal-*.png`, `v1-hand.mp4` |
| V2 | Tal och läppsynk för alla tio repliker | `v2-<replik>.mp4` (5–10 s) och media-UUID per klipp |
| V3 | Mobil och desktop: lobby, idle, insats, beslut, avräkning, omladdning mitt i hand; fysisk telefon | `v3-{lobby,idle,bet,decision,settle,reload}-{1440,390,320,phone}.png` |
| V4 | Trelagerslayout och rummets fält via `roomOverrides`: dealerval, idle, marker och utseende (Jakobs K06-scopebeslut) | `v4-admin-room-fields.png`, `v4-game-layers-{desktop,390}.png` |
| V5 | Två följande spel i samma rum utan omladdning, idle mellan händerna | `v5-hand1-settle.png`, `v5-idle.png`, `v5-hand2-deal.png`, `v5-sequence.mp4` |
| V6 | Aktiv hand behåller material vid publicering på delat bord; nästa fönster får det nya | `v6-before-publish.png`, `v6-after-publish-same-hand.png`, `v6-next-hand-new.png` |
| V7 | Avbruten presentation (K3f): inget dubbeldrag, handen fortsätter | `v7-offline.png`, `v7-recovered.png` och saldoutdrag |

## 5. Negativa fall och omprov på kandidaten

### 5.1 Fall som körs på kandidaten

Utföraren kör dem i omproven på kandidaten och skriver resultatet i `o02/negative/receipt.json`. Granskaren läser rålogg och JSON och gör egna GET vid behov.

| # | Fall | Underlag i dag | På kandidaten |
| --- | --- | --- | --- |
| K3a | Fel rum eller ägare | J08 404/409/422; K07-omprovet; K06 wrong-role (fel ägare/rum 404) | Ingår i K06/K07-omproven |
| K3b | Fel roll | K06 wrong-role: spelarsession och anonym 401/403. Partnerrollen via CI-prov (Jakobs beslut) | Ingår i K06-omprovet; CI-provets namn anges i kvittot |
| K3c | Inaktuellt paket | J08 409; K04-d4/d5 409. Operatör B:s kontext ger 409 i stället för 404 (klassas av granskaren) | Ingår i K06-omprovet |
| K3d | Dubbelkommandon | K07-e0, e1r, h4 | Ingår i K07-omprovet |
| K3e | Samtidiga spelare och delat bord | K07-omprovet 19/19, flaggan på i staging | Ingår i K07-omprovet |
| K3f | Avbruten presentation | K06 `interrupted-presentation` (K06S-I1, K06R-I2) | Ingår i K06-omprovet; Jakob ser V7 |
| K3g | Felaktiga media-ID | K06 `bad-media-id`: 422 vid sparning, 404/409 utan bytes | Ingår i K06-omprovet |
| K4 | `/control`, `/lab` och `/bo` startar ingen alternativ produkt; ingen SQLite | Live: 307 → `/admin`, 307, 404. SQLite-förbudet platt | `o02-receipt.mjs` R1 |
| K4b | Testfixturer använder aldrig produktionsidentiteter eller riktiga användardata | Se nedan | `o02-receipt.mjs` T1 plus granskarens bedömning |
| K6 | Två följande spel i samma rum, samma SHA, media-ID per händelse | K06-omprovet `twoConsecutiveGames` (nativebord och delat bord) | Ingår i K06-omprovet; Jakob ser V5 |
| K8 | Exakt en ekonomisk effekt | K07 h2/h4/h5, ledgerparitet mot Neon | K07-omprovet plus `o02-receipt.mjs` D1 (saldoinvariant, inga dubbla `source_key`) |

**K4b, read-only 2026-10-28** (`git grep` i `test/`, `**/test/`, `*.test.*` och `tools/*qa*` på `b0d02bbd`):

- Inga träffar på `wandering-hill-60561912`, `br-flat-fog-b161a6r8`, `ep-fragrant-meadow`, `room-76640ca1`, `johns-bet`, `store_AqwvebTbBHarOjvG` eller `srv-dbd6nfon74is73aiblf0`.
- Fem värdnamnsträffar, alla inerta strängar utan nätverksanrop:
  - `apps/studio/test/preview-page.test.mjs:114`: `https://www.scoutgaming.tech` som *förfalskat* `entryUrl`, som ska avvisas.
  - `test/moving-speech-player.mjs:134,137`: URL-byggaren `movingSpeechSocketURL` med www som bas.
  - `test/vercel-presentation-video-origin.mjs:17,59`: `croupier-v3.onrender.com` som `PUBLIC_URL`/host-header mot en lokal handler.
- Inget av de sex QA-verktygen (`tools/*qa*`) nämner produktionen.
- Staging (SELECT som ägare, bara aggregat): operatörerna är `qa-k06k07-9dd2d3a4-a` och `-b`. Spelarna är 87: 80 `k…`, 2 `j08k04…`, 2 `syntetisk…`, `jakob-check-…`, `staging-admin…` och en spelare som heter `Jakob` (skapad 2026-10-27 16:09 UTC, bara öppningsraden). Ingen produktionsdata. Spelaren `Jakob` är troligen Jakobs egen stagingkontroll; granskaren noterar den och bedömer den inte som fynd om Jakob bekräftar.

### 5.2 Läckor från Admin-arkitekten: rätta före frysning eller bokför

| # | Läcka | Storlek och risk | Rekommendation |
| --- | --- | --- | --- |
| L1 | `/game?dealer=X` utan operatör läser *sparat* projekt och administration, inte paketet (`packages/presentation/server/game-entry-selector.mjs:54–63`). Routingen släpper igenom eftersom `dealer` är ett kontextnyckelord (`gameLobbyDestination`, `packages/navigation/server/platform-routing.mjs`). En inloggad spelare eller gäst kan alltså se en opublicerad dealer på nativebordet | **Kod:** liten, `slug === undefined` → `{status:404}`, eller omdirigering till lobbyn via `gameLobbyDestination`. **Prov:** medel; 68 rader i 11 testfiler använder operatörslösa `dealer=`-adresser, och de som väntar 200 skrivs om till 404 eller lobby. **Produktrisk:** låg. Jakobs väg (Välj bolag → lobby → `/play` → `/game?operator=…&table=…`) bär alltid operatör, och bordets dealerbyte behåller operatören | **Rätta före frysning**, i samma PR som L2 (server, `packages/` + `services/game/`). Omproven tas ändå om på kandidaten (F8), så rättningen kostar inget extra omprov. Uppskattning 1–2 timmar inklusive prov |
| L2 | `GET /api/presentation/config?dealerId=X` lämnar ut sparat projekts dealer-idle, projektrevision och **hela videoinventariet** till varje autentiserad spelare (`services/game/presentation-api.mjs:174–181`) | **Kod:** liten. Formen med bara `dealerId` används av två konsumenter: Admins förhandsvisning, som har en egen API-instans (`services/game/studio-preview.mjs:127`, `configurationSource:'studio-preview'`), och nativebordet utan operatör (`services/game/public/local-presentation.mjs:29`), alltså L1:s väg. Låt bara förhandsvisningens instans ta formen (en option till `createPresentationApi`); den publika svarar 404. **Prov:** `test/composition-runtime.mjs:505` och `test/studio-media-runtime.mjs:62` ändras, och ett negativt prov läggs till. **Risk:** låg när L1 är stängd, eftersom ingen produktväg använder formen | **Rätta före frysning** tillsammans med L1. Lämnas L2 öppen bokförs den som informationsläcka (inventariets metadata, inga bytes; medievägarna kontrollerar fortfarande tillgång och sha) |
| L3 | Rummens namn, state och lane läses levande ur administrationsdokumentet, inte ur paketet (`packages/presentation/server/package-rooms.mjs:19–26`). Avvikelse från "spelet läser bara paketet" | **Avgränsad:** bara rum som paketet redan listar (`pack.tables`), med lanes i paketet och material ur det frysta paketet. `state` live är i praktiken Admins nödbrytare: ett rum stängs utan ompublicering (`game-entry-selector.mjs:78`). **Rättning:** stor, eftersom paketschemat måste bära rummen, med publicerare, läsare och befintliga paket, och det öppnar K06:s kontrakt igen | **Bokför** som känd avvikelse med motiveringen ovan. Ta upp efter O03 i Admin-målbilden ([ADMIN-FORENKLING](ADMIN-FORENKLING.md)). Ingen bindning spelare → operatör före O03 (Jakobs beslut) |
| L4 | Launch-svaret från motorn (`services/game/storage/async-partner-api.mjs:43`, `curlLines` med API-nyckeln i klartext) skickas oprojicerat av Admin-servern till webbläsaren (`apps/studio/lib/studio-admin-accounts.mjs:128`); bara klienten släpper fälten | **Rättning:** servern projicerar `url`, `playerId`, `playerRef`, `balance`, `currency`, `expiresIn` | **Bokförs:** rättas när nya Admin ersätter Integrationer-sidan efter O03, eftersom dagens sida visar curl-exemplet |
| L5 | Bryggan på Vercel tog bort `operator` ur en partnerstart (`launchBackendSearch`, `packages/navigation/server/platform-routing.mjs`) när launch-tokenen bar partner-claim. Partnerns tokens har alltid claimen (`services/game/storage/async-partner-api.mjs:38`), så den publika vägen kunde aldrig ge bolagslandning och demolänkar landade i lobbyn, tvärt emot motorns kontrakt (`services/game/game-start.mjs:18–23`: partnernyckeln namnger inget bolag) | **Kod:** liten; en giltig slug behålls, bara en ogiltig tas bort. **Prov:** `apps/web/test/game-entry.mjs` och hela kedjan brygga → motor → routing i `test/game-entry-partner.mjs`. Bindning nyckel → operatör byggs inte nu (efter O02/O03) | **Rättad före frysning** i #513 |

Beslutet per läcka (rättad med PR och SHA, eller bokförd med Jakobs ok) skrivs i `o02/negative/receipt.json` som `L1`–`L5`, där `booked` betyder att avvikelsen är godtagen till efter O03.

## 6. Efter O02

O03 följer [MASTERPLAN](../../migrering/MASTERPLAN.md#o03--integration-och-leverans): ägar-, head-, CI- och säkerhetskontroll, schema i godkänd ordning, release med verifierad Vercel- och Render-SHA och restore dokumenterad mot migrerat schema i [ENVIRONMENT-RESTORATION](../ENVIRONMENT-RESTORATION.md). `CROUPIER_SHARED_TABLE_ENABLED` sätts i produktionen bara med Jakobs separata godkännande. Stagingen och `croupier_staging_restore_o02` raderas av Jakob efter O03.
