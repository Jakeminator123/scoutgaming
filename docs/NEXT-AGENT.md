# Överlämning: Scoutgaming

Uppdaterad 27 oktober 2026, kväll, efter PR #442–#448. Skriven för en agent (Codex, Cursor eller Claude) som börjar kallt från `origin/main`. Läs först [START-HERE.md](../START-HERE.md) och [AGENTS.md](../AGENTS.md); Jakobs aktuella instruktioner går före allt här. Äldre överlämningar: [history/NEXT-AGENT-2026-10.md](history/NEXT-AGENT-2026-10.md) och [history/JOHN-HANDOFF-2026-10.md](history/JOHN-HANDOFF-2026-10.md); kvällens revision av styrfiler och CI: [history/AUDIT-2026-10-27.md](history/AUDIT-2026-10-27.md); övrig historik i [docs/history](history/README.md).

## Läget i en skärm

- **Status:** bara i [migrering/STATUS.md](../migrering/STATUS.md), genererad från [status.json](../migrering/status.json). Skriv inga procentsatser någon annanstans. Kvar enligt status.json 27 oktober: K04, K05 och K06 (IN_PROGRESS) samt K07, O02 och O03 (TODO).
- **Produktion:** Vercel `scoutgaming` och Render `croupier-v3`, `croupier-lab-director` och `croupier-lab-openclaw` kör alla `main` `cc415cd8`. Render `croupier-v2` och `croupier-vercel-preview-qa` är raderade.
- **Schema:** spelmigreringarna 008–010 och Studio-migrering 020 är applicerade i produktionen.
- **Johns Bet (PAOW):** paketrevision 9 och spelkonfigurationen `room-config-133cfffc-fdad-47f2-9c85-51b08de4a325` är publicerade i rummet `room-76640ca1-b619-7948-596e-3d102202b7d0`, med alla 15 PAOW-tagningar godkända och servermätta. Jakob spelade i produktionen och godkände (”allt funkade, hon pratar”) på dator och i datorwebbläsarens mobilvy, inte på fysisk telefon.
- **Autoplay:** före första interaktionen visade statusraden råtexten ”Tal: play() failed …”. Rättningen är mergad i #446 (”Slå på ljud” i stället för rå text) men inte bekräftad i produktionen i något kvitto.
- **Staging:** Render-stagingen kör `cc415cd8` med `CROUPIER_SHARED_TABLE_ENABLED=1`. K07-körningen på delat bord gav 19/19 kontroller på `cc415cd8`, med processbyte på samma SHA ([K07-kvittot](2026-10-27-K07-STAGING-ACCEPTANCE.json)).
- **Mergat i kväll:** #442 (delade bord startar i enkel-origin-layouten), #443 (Studio-admin loggar orsaken bakom 503/500), #444 (SQLite steg 7; steg 8–9 återstår enligt SQLite-planen), #445 (K06/K04-kvitton, båda kvar IN_PROGRESS), #446 (autoplay) samt #447–#448 (styrfiler, CI och städning).

## Identiteter

Inga hemligheter här. Inloggningar och nycklar finns bara i gitignorerad `.env.local` på Jakobs dator, bland annat `RENDER_API_KEY` (läsning via Renders REST-API) och stagingens `STAGING_ADMIN_LOGIN_UN`/`STAGING_ADMIN_LOGIN_PW`. Skriv aldrig ut värdena.

| Tjänst | Produktion | Staging (provbänk till O03) |
| --- | --- | --- |
| GitHub | `Jakeminator123/scoutgaming`, repo-ID `1380630440`, målbranch `main` | samma |
| Vercel, team `scoutgaming` `team_Scxorb9qtZHjNae1YEQnFCaT` | projekt `scoutgaming` `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`, www.scoutgaming.tech, deployar `main` automatiskt | projekt `croupier-k06-k07-staging` `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, croupier-k06-k07-staging.vercel.app, deployas från `main` via API |
| Render, workspace `tea-d19jsa63jp1c73ch0sc0` | spelmotor `croupier-v3` `srv-dbd6nfon74is73aiblf0` (manuell deploy); Director `croupier-lab-director` `srv-danhlpjtqb8s73bv530g`; Gateway `croupier-lab-openclaw` `srv-danhiv3tqb8s73burkq0` (privat) | `croupier-k06-k07-staging` `srv-dbf61l0m7kps73ft7mk0`, suspenderad mellan prov |
| Neon, org "Vercel: scoutgaming" `org-green-butterfly-00780270` | `croupier-production` `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game` (scheman `public`, `croupier_auth`, `croupier_game`, `croupier_studio`) | `croupier-k06-k07-staging` `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, databaser `croupier_staging` och `croupier_staging_restore` |
| Vercel Blob | `croupier-media-private` `store_AqwvebTbBHarOjvG` | `croupier-k06-k07-staging` `store_7E06N1P4w9Mu1dZD`, bara syntetiskt material |
| Spel | Johns Bet: operatör `johns-bet`, rummet ovan, dealer `paow` | operatör `qa-k06k07-9dd2d3a4-a`, PAOW-rum `room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e` |

Andra tjänster i samma Render-workspace (`sajtmaskin-dash`, `openclaw-sajtagenten`, `spelsajt-game-server`) och Neon-orgen `org-lucky-cake-48388035` hör till andra projekt; rör dem inte. Kevin har läsrollen `kevin_migration_readonly` i produktionens Neon.

## Vad som återstår, i beroendeordning

Orkestratorn sätter VERIFIED i `status.json` först när kriterierna i [Kevins AKTIVITETER](../migrering/kevin-ks-migrering/AKTIVITETER.md) respektive [masterplanen](../migrering/MASTERPLAN.md#o02--oberoende-samprov) är bevisade, med full SHA, PR, oberoende granskare och kvitto. `node migrering/status.mjs --check` kräver att beroendena redan är VERIFIED. Kvitton skrivs sanerade som `docs/<datum>-<aktivitet>-…-ACCEPTANCE.json` med versions-, deploy- och databasidentiteter, aldrig med kakor, sessioner eller nycklar.

Råkvitton, skript och skärmbilder bakom kvittona finns bara lokalt hos orkestratorn. Det som gäller är de sanerade kvittona i `docs/` och planerna i `docs/plans/`.

### K04 — Spelklient och presentation från händelser (IN_PROGRESS)

- **Bevisat:** isolerad staging 27 oktober på `e7a4e251` ([K04-kvittot](2026-10-27-K04-STAGING-ACCEPTANCE.json)): händelsestyrd presentation, exakt materialbindning (46/46 UUID/SHA), återanslutning via API, två processbyten mitt i hand, negativa fall och alla tio talrepliker med godkända stagingtagningar. Kväll på `cc415cd8`, delat bord i headless Chromium ([K04-webbläsarkvittot](2026-10-27-K04-BROWSER-ACCEPTANCE.json)): omladdning mitt i hand på dator och mobil, beslut till resultat och nästa fönster, tangentbord och tap, okänt media-ID, avbrutet tal och Fast 3G. Jakobs produktionsspel ovan är underlag.
- **Saknas:**
  - Två fallerade prov: ett dealerklipp med 404 lämnar spelaren utan kort, knappar och feltext i minst 6,5 s, och på 400 kbit/s blir bordet aldrig spelbart. Rättningen pågår på `jakob/claude-k04-client-fixes`; båda proven körs om efter merge.
  - Jakobs visuella godkännande av giv-, hål- och revealklippen (registret säger `unreviewed`/`lab-only`) och av skärmbilderna.
  - Webbläsarens autoplay-spärr (proven körde med den avstängd) och fysisk telefon.
  - Produktionens tre lager med inloggad spelare i ett kvitto.
- **Vem:** agent rättar och kör om proven i staging; Jakob gör den visuella bedömningen.
- **Kvitto:** komplettera K04-webbläsarkvittot eller lägg ett nytt daterat kvitto.

### K05 — Exakt mediakoppling till Neon och Blob (IN_PROGRESS)

- **Bevisat:** produktionen 27 oktober kväll ([K05-kvittot](2026-10-27-K05-PRODUCTION-ACCEPTANCE.json)): `cc415cd8`, Studio-migrering 020, paketrevision 9 och `room-config-133cfffc…`, de 15 godkända och servermätta tagningarnas media-ID och identitetshash, och Jakobs godkännande med tid och gräns (mobilvy, inte telefon). Blockeraren i `status.json` beskriver läget före detta och ändras bara efter granskning.
- **Saknas:**
  - K05:s manifestmatris `käll-SHA → bytes-SHA → Neon-ID → Blob → paket/händelse → acceptans`; bytes-SHA saknas för de 8 tagningar som bands utan import.
  - Ett negativt fall: en ogranskad eller okänd tagning kan inte väljas.
  - Inloggad läsning av produktionens tre lager (anonymt svarar de 401).
- **Vem:** agent kompletterar med läsningar (Neon read-only, Admin-API GET); en annan agent granskar; orkestratorn uppdaterar status.
- **Kvitto:** komplettera K05-kvittot.

### K06 — Admin till spel efter omstart (IN_PROGRESS; kräver K05 VERIFIED)

- **Bevisat:** staging 27 oktober: Admin → publicering C0→C1 → aktiv hand behöll paket 7 över publicering och processbyte, nästa fönster fick paket 8 (13/13, [K06-kvittot](2026-10-27-K06-STAGING-ACCEPTANCE.json)). Delat bord på `cc415cd8`: aktiv runda behöll C1 när C2 publicerades, nästa fönster band C2, och processbytet skedde på samma SHA ([K07-kvittot](2026-10-27-K07-STAGING-ACCEPTANCE.json), K06-S1–S3 och K07-e2).
- **Saknas:**
  - En publicering som byter material så att M0 och M1 kan särskiljas.
  - Wrong-role, bad-media-id och interrupted-presentation.
  - Visuellt godkända giv- och revealklipp.
  - Johns Bet-kedjan i produktionen, dokumenterad efter K05.
- **Vem:** agent i staging; Jakob för det visuella.
- **Kvitto:** komplettera K06-kvittot eller lägg ett nytt daterat kvitto.

### K07 — Spelbeteenden och samtidighet (TODO; kräver K04 och K06 VERIFIED)

- **Bevisat:** dagtid 27 oktober: enspelarbeteenden, idempotens, samtidiga kommandon, ledgerparitet mot Neon, utloggning och isolering ([J08-kvittot](2026-10-27-J08-STAGING-ACCEPTANCE.json), avsnitt `k07`). Kväll, flaggan på i staging: 19/19 på `cc415cd8` ([K07-kvittot](2026-10-27-K07-STAGING-ACCEPTANCE.json)), bland annat två spelare vid samma delade bord, g1 platsfrigivning (#426), g2 inga ticks i tysta rum, återanslutning efter processbyte på samma SHA, isolering och ledgerparitet mot read-only Neon.
- **Saknas:**
  - En oberoende granskning av kvittot.
  - Jämförelsen main mot kandidat som K07-kriterierna kräver, eller ett uttryckligt scopebeslut av Jakob.
  - K04 och K06 VERIFIED.
- **Vem:** en agent som inte körde provet granskar; orkestratorn uppdaterar status.
- **Kvitto:** K07-kvittot ovan.

### O02 — Oberoende samprov (TODO; kräver K07 och J10)

- **Bevisat:** J10 (ren klon, build, start och restore) är VERIFIED; SQL-restore till `croupier_staging_restore` gav identisk data 25 oktober.
- **Saknas:**
  - En fryst integrerad kandidat: Vercel- och Render-SHA, schema, paket/config och media.
  - En oberoende granskare som kör Admin spara → publicera → lobby → launch → spel → återanslutning → omstart → återläsning.
  - Negativa fall: fel rum/ägare/roll, inaktuellt paket, dubbelkommandon, samtidiga spelare, avbruten presentation och fel media-ID.
  - Bevis att `/control`, `/lab` och `/bo` inte kan starta en alternativ produkt.
  - HTTP-spelreplay efter restore.
  - SQLite-steg 8–9 klara, eftersom en ren main är ett slutkrav.
- **Vem:** en agent som inte har implementerat kandidaten; orkestratorn fryser kandidaten; Jakob för AV.
- **Kvitto:** `docs/<datum>-O02-ACCEPTANCE.json`. Plan: [O02-PLAN](plans/O02-PLAN.md), skriven mot `e7a4e251`; läs om läget innan den används. Kvittoskriptet [tools/o02-receipt.mjs](../tools/o02-receipt.mjs) är read-only (GET mot staging, `BEGIN READ ONLY` mot Neon).

### O03 — Integration och verifierad drift (TODO; kräver O02)

- **Saknas:**
  - Ägar-, head-, CI- och säkerhetskontroll av releasen.
  - Schemaändringar i godkänd ordning, inklusive produktions-DDL som J09:s avveckling.
  - `CROUPIER_SHARED_TABLE_ENABLED=1` i produktionen, om Jakob godkänner det.
  - Release med verifierad Vercel- och Render-SHA, inloggning, Admin-sparning, launch och spel.
  - Återställning dokumenterad mot faktiskt migrerat schema i [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md). Därefter raderar Jakob stagingen.
- **Vem:** Jakob för DDL, produktionsflaggan och radering; orkestratorn för verifieringen.
- **Kvitto:** `docs/<datum>-O03-RELEASE-ACCEPTANCE.json`.

## Hur man levererar

1. `git fetch`, sedan egen worktree och branch `jakob/*` från `origin/main` (Claude-underagenter: `jakob/claude-*` under `.claude/worktrees`). Node 24.21.0 via Volta. I en ny worktree behöver pre-commit `npm ci` i `apps/studio` och i det paket som provas.
2. Committa med repots hookar, aldrig `--no-verify`. Läs `node tools/security-status.mjs` före push och merge.
3. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot (eller `git push -u origin <branch>` och `gh pr create`). PR mot `main`.
4. Den obligatoriska kontrollen heter `CI`, och regeln är strikt: branchen ska vara à jour med `main`. Kör `gh pr update-branch <nr>`, vänta på grön CI och merga sedan; auto-merge är avstängt. Ägarreglerna i AGENTS.md gäller.
5. Vercel deployar `main` automatiskt. Render `croupier-v3` deployas manuellt efter grön merge (Render MCP eller dashboard); kontrollera `https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. Director och Gateway deployas om när `packages/director` eller `services/openclaw/lab` ändras.
6. Schemamigrering före kravhöjning (Jakob applicerar), Admin-publicering sist.

## Behörigheter och vad som kräver Jakob

Agenter får läsa Neon, Render-loggar, metrik och Vercel; köra prov i staging med syntetiska konton; öppna PR:er; starta Render-stagingen under ett prov och säga till när det är klart. Den orkestrerande sessionen mergar verifierat Jakob-ägt arbete efter grön CI och deployar `croupier-v3`. Underagenter mergar aldrig.

Kräver Jakob:

- publicering i produktionens Admin (paket, rumskonfiguration, tal);
- produktions-DDL och migreringar (`node tools/check-migration-readiness.mjs --apply`);
- radering av molnresurser (Render, Vercel, Neon, Blob, stagingen efter O03, ren start);
- visuellt godkännande och AV/läppsynk; hash, testpass eller kodläsning räknas inte;
- produktionsflaggor som `CROUPIER_SHARED_TABLE_ENABLED`, betald drift och nya konton.

Aldrig: hemligheter i Git eller chatt, prov mot riktiga användares data eller Johns Bet, ändringar i Kevins brancher (`kevin*`, `codex/kevin-*`).

## Kända fällor

- **Strikt CI:** varje merge till `main` gör andra öppna PR:er inaktuella, och `gh pr update-branch` kör hela CI igen. Merga en i taget och samla små dokumentändringar i en PR.
- **Windows:** filbevakningsprov (till exempel `apps/studio/test/watch-design-preview.test.mjs`) kan fallera lokalt av tidsskäl. Kör om innan du felsöker; CI på Linux avgör.
- **Hemlighetsskanning:** GitGuardian och andra skannrar underkänner bokstavliga Postgres-URI:er i tester. Använd `fixtureDatabaseUrl()` i `test/fixtures/database-url.mjs`.
- **Render MCP:** `update_environment_variables` sammanfogar nycklar i stället för att ersätta dem och startar en deploy automatiskt. Den kan inte läsa värden; läs via REST med `RENDER_API_KEY`.
- **`CROUPIER_SHARED_TABLE_ENABLED`:** stagingen kör `=1`, produktionen har flaggan osatt till O03. Före #442 stoppade `=1` motorns start; kontrollera `/__cloud/health` efter varje env-ändring.
- **Autoplay:** webbläsare blockerar ljud före första interaktionen. Tills `jakob/claude-speech-autoplay` är mergad syns rå feltext, och ett spel utan klick är inget talbevis.
- **Namn:** `recordedSpeech` v2 är MP4-talformatet, inte Render-motorn v2. `croupier-v2` finns inte längre.
- **Stora filer:** `apps/studio/lib/dealer-import-kevin-source-paow.json` och mediebinärer parsas; skriv inte ut dem.

## Separata spår efter migreringen

- **Ren start (clean slate):** Jakobs beslut 27 oktober. När K05 är klar och som egen aktivitet med backup och Jakobs uttryckliga go: ta bort gamla Astrid-, Dragan- och testrum, alla operatörer utom Johns Bet (PAOW) och töm papperskorgen. Följ avvecklingsreglerna i [AGENTS.md](../AGENTS.md#data-media-och-avveckling) och [masterplanens raderingsavsnitt](../migrering/MASTERPLAN.md#radera-med-ett-konkret-slutdatum). Stagingens bevisdata (rum `33b37ff3`) står kvar till O03. I repot ingår att radera Astrids gamla experimentmapp `media/dealers/astrid/staging/` (442 spårade filer, cirka 6 MB, ingen kod läser dem) och samtidigt bygga om `media/layout.json` och `media/blob-index.json`, som listar mappens filer, med de befintliga medieverktygen.
- **Admin-förenkling (UX):** `/admin` ska vara enkel. Underlag: [Admin-kartan](history/jakob-main-migrering/ADMIN-KARTA-2026-10-22.md), [backloggen](history/jakob-main-migrering/BACKLOGG-2026-10-23.md), [separat produktarbete](CLOUD-MIGRATION.md#separat-produktarbete-och-öppna-driftansvar) och utkastet [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md) (en publiceringsknapp per rum). Det finns inte i masterplanen; Jakob beslutar omfattningen.
- **Övrigt:** SQLite-steg 8–9 (planen ligger utanför Git; `tools/no-sqlite-allowlist.json` visar vad som återstår), Astrid-legacy (hårdkodat `'astrid'` i Admin-avbokning, utloggning, `/chat` och probe) och en inställning per dealer för proben (av, klipp efter N minuter eller AI-tal); Jakob har inte beslutat om den sista.
