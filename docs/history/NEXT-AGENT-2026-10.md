# Överlämningshistorik: Scoutgaming-migreringen, oktober 2026

Flyttad från `docs/NEXT-AGENT.md` den 27 oktober 2026, kväll, när överlämningen skrevs om. Innehållet är daterat och oförändrat utöver länkvägarna; många uppgifter här är inaktuella (till exempel att #442 och #444 inte var mergade, att Studio-migrering 020 saknades i produktionen och att `croupier-v2` var suspenderad). Aktuell överlämning: [NEXT-AGENT](../NEXT-AGENT.md); status bara i [STATUS.md](../../migrering/STATUS.md).

## 27 oktober kväll: J08 verifierad, 70 %

**70 % = 14/20 aktiviteter.** J08 är VERIFIED i [statusfilen](../../migrering/status.json). Verifierad kod är `b08f2a866f77e6b9673cbb6624b7eea9013a0a70`, och bevisen finns i det [sanitiserade kvittot](../2026-10-27-J08-STAGING-ACCEPTANCE.json). Allt J08-bevis kommer från isolerad staging: `croupier-k06-k07-staging`, operatör `qa-k06k07-9dd2d3a4-a`, rum `room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e`. Produktionens spelkonfiguration och Johns Bet är orörda. Avsnitten nedan är daterade; deras 65 %-uppgifter gäller före J08.

- **Negativa prov på `c32be1fb`** (Vercel `dpl_9V3PF6upGVZ4z8ZzXSvsYC6phh4h`, Render `dep-dbgbloqfngtc7398pfng`, grind 32/32):
  - Varje sparat utkast gav nya revisioner.
  - Fyra inaktuella revisioner gav 409, ogiltigt språk 422 och operatör B 404. Operatör B provades som scope med samma Admin-session, inte separat inloggning, och fel roll provades inte live. `players/status` gav 200, vilket är #424-rättningen.
  - Publicering före AV-granskning nekades med 422 `native_material_speech_unbound`, och tillståndet ändrades inte.
  - Efter processbyte `dep-dbgbodnb9u1s73cr54j0` var allt identiskt.
- **AV-granskning, endast staging:** Jakob godkände med stagingens Admin-konto elva svenska PAOW-tal: åtta `_1` samt `blackjack_7`, `double_3` och `blackjack_3`. Paketet frös `blackjack_7` för blackjack, så paketet har tio godkända tal, ett per replik. Han underkände `blackjack_1` och `double_1`. Det är verklig mänsklig granskning, men den gäller bara stagingens registerposter.
- **Positiv kedja:**
  - Paketet gick från 5 till 6 till 7. Publiceringen av `room-config-38b14261-cf20-4e31-bc09-042ee40f1d28` (sv/casual, 20000/15000 ms) gav 200 och replay 409. Rummet syns bara hos operatör A.
  - Auktoriserad `/game` gav 200 på paket 7. Speak-händelserna valde godkända tagningar med exakt UUID, SHA och bytes.
  - Efter processbyte `dep-dbgdh7mi0phs7383mrrg` (b08f2a86, grind 32/32) serverades samma version, och en ny hand fick åter godkänt tal.
- **Gränser:**
  - Processbytena var redeploys via Render MCP, inte dashboardens *Restart service*, och SHA:n kunde inte låsas (Render `dep-dbgcgt7lk1mc73bbq8o0`@15aa3192 och `dep-dbgckaou01pc73aondd0`@4838537d däremellan).
  - Aktiv-hand-regeln, där pågående hand behåller C0/P0/M0 medan nästa fönster får C1/P1/M1, provades inte live. Den flyttas till K06 med stöd av PR407 (mergad 8fcb920a, head 857347de, CI40347468353).
  - Ingen spelkonsument har bundit `room-config-38b14261`. Insatsprofil och tider (fält 2 och 4) är bevisade som Admin-återläsning plus lagring i `croupier_game.shared_table_configs`/`_heads`. Den enda konsumenten är delat bords koordinator, `shared_table_rooms` har 0 rader i staging, och nativebordets start bär ingen configreferens. Konsumtionen flyttas till K07 g1/g2 med flaggan, enligt scopebeslutet som Jakob ombeds bekräfta i PR #440.
  - Fält 5:s bord, bakgrund och färg provades inte.
  - Replikerna win, push, blackjack, insurance och double utlöstes inte.
  - Ingen spelkonfiguration är publicerad i produktionen.

| Aktivitet (status oförändrad) | Delbevis 27 oktober | Exakt kvar |
| --- | --- | --- |
| K04 | 16 kontroller: exakt material (46/46 UUID/SHA), återanslutning, två processbyten mitt i hand och negativa fall. Talet kommer från godkända tagningar med exakta bytes. | Visuellt godkända giv-, hål- och revealklipp (registret säger `unreviewed`/`lab-only`), återstående talrepliker, aktiv-hand-bytet live och produktionens tre lager. Operatör B:s kontext ger 409 i stället för 404. |
| K05 | Produktion: tio `_1` och 43 svenska tagningar (16 uppladdade från Kevins `c7138759`) har recordedSpeech v2 `verified-embedded-av` och servermätt tid. De 36 kopplade giv- och idleklippen är mätta. Registret 17:08Z: 6 approved, 2 rejected (`blackjack_1`, `double_1`), övriga pending. | Jakobs AV-godkännande i produktionen, kopplade talfack, ompublicerat paket och publicerade spelinställningar för Johns Bet. |
| K06 | Stagingkedjan Admin → publicering → spel efter processbyte med granskat tal. | Aktiv hand över publicering live, visuellt godkänt material, Johns Bet efter K05 och delat bord. |
| K07 | K07 ensamt: 16 pass, 2 blockerade (g1/g2 503) och 1 ersatt kriterium (e1). Den gemensamma K04/K07-körningen hade 35 kontroller; K04:s del är 15 pass plus a4, som passerade senare, alltså 16. Idempotens, samtidiga kommandon, ledger lika med Neon (SHA `7459106d…`), utloggning och isolering passerar. | g1 (platsfrigivning, #426) och g2 (dueTicks) kräver `CROUPIER_SHARED_TABLE_ENABLED=1` i staging, och flera spelare vid samma delade bord saknas. |

Dagens PR:er:

- #424: `players/status` 503.
- #425: START-HERE.
- #426: K07-platser och `dueTicks`.
- #427: Astrid-observatörer.
- #428, #430, #431, #432 och #435: SQLite-stegen 1, 5, 4, 2/3a och 3b.
- #429: överlämning.
- #433: *Godkänn tal*.
- #436: *Röst & tal*.
- #437 (förvald tagning) är mergad som `f1fef7c9`, #438 (dealerpersona i chatten) som `341a8344`, #439 (SQLite steg 3c) som `9cf7b8c2` och #434 (SQLite steg 6) som `3b688d49`, som är main i kväll.

**Kvällens fakta (27 oktober, efter #434):**

- main = `3b688d49`. Vercel (`scoutgaming`) auto-deployar main; Render `croupier-v3` (`srv-dbd6nfon74is73aiblf0`) deployades manuellt 18:33 UTC på `3b688d49` efter grön CI. Director `croupier-lab-director` kör `341a8344`.
- Deploypolicy (Jakob): main är enda produktvägen och allt grönt går direkt till produktion: merge efter grön CI → Vercel auto-deployar → `croupier-v3` triggas manuellt (Render MCP) efter varje grön merge; Director/Gateway deployas om när deras kod ändras. Schemamigrering före kravhöjning; Admin-publicering sist.
- Spelmigreringarna 008–010 är applicerade i produktionen (15 `shared_*`-tabeller och tre kolumner återlästa). Spel-ledgern registrerar avsiktligt fortfarande bara `product-v1` och `sqlite-import-v1`. J07-beviset i `migrering/status.json` (”enbart levererade, inte applicerade i produktion”) är historiskt och ändras inte där.
- Studio-migrering 020 saknas i produktionen; Jakob applicerar med `node tools/check-migration-readiness.mjs --apply`. Det är orsaken till paketpubliceringens 503 *Action unavailable* i produktionen (paketet behöver v2-kuvertet).
- `CROUPIER_SHARED_TABLE_ENABLED=1` stoppade stagingmotorns start (tom frontend-origin i single-origin-layouten). Rättningen är PR #442 (`jakob/claude-shared-room-origin`), inte mergad; behåll varningen i [ENVIRONMENT-VARIABLES](../ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling). Staging står på `=0`.
- Render-staging `srv-dbf61l0m7kps73ft7mk0` är LIVE på `3b688d49`; Jakob startar och stoppar den. Stagingen är en tillfällig provbänk till O03 och raderas därefter.
- Renders gräns för byggminuter är höjd. `RENDER_API_KEY` finns i gitignorerad `.env.local` lokalt och ger REST-läsning; Render MCP deployar, läser loggar/metrics och skriver env, men läser inga env-värden.
- Legacy-tjänsterna `croupier-v2` (`srv-datg3j6gekts73amgli0`) och `croupier-vercel-preview-qa` (`srv-datj7l893c1s73ar3u50`) är suspenderade med autoDeploy av och raderas av Jakob. `croupier-v2` är inte produktion någonstans.
- Kevin (Jakobs beslut 27 oktober): behåller läsrollen `kevin_migration_readonly` i produktionens Neon och sin GitHub-åtkomst (`invoicesolv`); hans brancher (`kevin*`, `codex/kevin-*`) rörs inte.

**Nästa steg, i ordning:**

1. **K05 i produktionen (Jakob):**
   - **Blockerare (27 oktober kväll):** Studio-migrering 020 saknas i produktionen; Jakob applicerar den med `node tools/check-migration-readiness.mjs --apply`. Utan 020 svarar paketpubliceringen i produktionen 503 *Action unavailable* (paketet behöver v2-kuvertet). Därefter: ompublicera Johns Bet-paketet (5 → 6) och publicera rumskonfigurationen. PR #443 loggar orsaken bakom Studios 503/500 i admin-API:t.
   - Gå till Klippkarta → PAOW → *Röst & tal* → *Inspelat tal*. Godkänn en tagning per replik. `goodluck_1` och `win_1` är pending. Välj ersättare för blackjack och double; `blackjack_7` och `double_3`, som godkändes i staging, är pending i produktionen.
   - Koppla talfacken med *Koppla till utkast* och spara.
   - Publicera paketet igen. Publicera sedan Johns Bet-rummets spelinställningar.
   - Ingen agent godkänner tal.
2. **K06:** Publicera en ny config under en pågående hand och visa att handen behåller C0/P0/M0 medan nästa fönster får C1/P1/M1. Granska giv- och revealklippen visuellt och upprepa kedjan på Johns Bet efter K05.
3. **K07:** Sätt `CROUPIER_SHARED_TABLE_ENABLED=1` på staging-Render (kräver Jakobs ja) först när PR #442 är mergad: 27 oktober stoppade `=1` stagingmotorns start (tom frontend-origin i single-origin-layouten). Kör sedan g1/g2 och prov med flera spelare vid samma bord.
4. **K04** stängs med K05/K06-materialet. Därefter kommer **O02** med oberoende samprov på en fryst kandidat, och sedan **O03** med integration, drift och restore.
5. **SQLite:** steg 1–6 är mergade (#428, #430, #431, #432, #435, #439 och #434 → main `3b688d49`); motorn och `ops/cloud` kör enbart Postgres. Steg 7 (companion-/Studio-/backup-JSON-lager) ligger i PR #444; därefter steg 8–9.
6. **Clean slate efter K05:** först när K05 är klar och enligt Jakobs ordning. Dagens stagingdata (rum 33b37ff3 med paket 7 och syntetiska spelare) är bevis och raderas inte före dess.
7. Render-staging (`srv-dbf61l0m7kps73ft7mk0`) är LIVE på `3b688d49` med `CROUPIER_SHARED_TABLE_ENABLED=0`; Jakob startar och stoppar den. Stagingen är en tillfällig provbänk till O03 och raderas därefter.

## Claude tar över — 27 oktober 2026, kväll

**Vid denna avstämning 13/20 verifierade aktiviteter (aktuell siffra bara i [STATUS.md](../../migrering/STATUS.md)).** Inga aktivitetsstatusar ändrades; allt nedan är kod-, test- och dokumentleveranser via öppna PR:er som Jakob mergar efter grön full CI och oberoende granskning (Claude Codes säkerhetsläge tillät då ingen agentmerge; sedan 27 oktober kväll mergar den orkestrerande Claude-sessionen efter grön CI). Ny lokal basmapp är en färsk klon i `C:\Users\jakob\dev\scoutgaming`; Codex-worktrees och originalcheckouten lämnas orörda. Jakobs beslut samma dag: **en enda produktväg** (Vercel + Render + Neon + Blob), SQLite lämnar main helt, bra Kevin-beteenden skrivs om i mains moduler, felaktiga tester/dokument rättas eller raderas, och `/admin` ska vara enkel.

| PR | Innehåll | Verifiering |
| --- | --- | --- |
| [#424](https://github.com/Jakeminator123/scoutgaming/pull/424) | Stagingens `POST /studio/api/admin/players/status` 503: det signerade Render-kommandots transaktion saknade Studio-scope, så probe-avbokningens scopade minnesskrivning kastade `Studio transaction scope mismatch`. Runtime-städning körs nu efter COMMIT via `afterCommit`-hooks med säkra felkoder; kommandot tar inget scope-lås. | Regressionstest 503→200 med riktig Postgres-adapter på fake pool; cutover-harnessen gör den riktiga scopade avbokningen i CI. Full CI grön; två granskningsrundor. |
| [#425](https://github.com/Jakeminator123/scoutgaming/pull/425) | `START-HERE.md` (saknades trots att alla överlämningar pekade dit) och `CLAUDE.md`-pekare. | Dokumentation; full CI grön. |
| [#426](https://github.com/Jakeminator123/scoutgaming/pull/426) | K07, selektiv Kevin-konvertering (`kevin` f664c54d): rutor ingen satsat på frigörs efter rundan (nytt rumsfält `unplayed`, `boxesAfterRound` betyder åter bara val under rundan), `next` låser bara spelare som förlorar sista rutan, `dueTicks`/`tick` läser inte medlemmar/presence för tomma rum. Inte porterat: väntekö (kräver nytt `wait`-kommando i kontraktet) och 60 s frånvaro (120 s behålls, 90 s mellan rundor rekommenderas). | Gap bevisat med fallande test först; `pre-commit-full gameplay` 572/572; full CI grön; två granskningsrundor. |
| [#427](https://github.com/Jakeminator123/scoutgaming/pull/427) | Astrid-legacy: `nativeOptions.publish` körde Astrid-probens avbokning efter varje bordskommando för alla dealers och sväljde fel så att `publishNativeRound` kunde hoppas över. Ny modul `services/game/native-observation-publisher.mjs`: varje observatör isolerad, probe bara när `command.dealer === 'astrid'`, säkra eventkoder med steg/status/kod. | 13 tester inkl. riktig `createPostgresNativeTableCommand` på delad fake pool (`test/fixtures/native-table-fake-pool.mjs`); full CI grön. |
| [#428](https://github.com/Jakeminator123/scoutgaming/pull/428) | SQLite bort, steg 1 av 9: databasfria tester utan SQLite (inline-fakes, async-moduler). Medveten täckningsändring: de synkrona SQLite-modulerna som `server.mjs` fortfarande laddar utanför Postgres raderas i steg 6. | 0 föräldralösa tester; full CI grön. |

**Kvarstående fel och uppföljning**
- Hårdkodat `'astrid'` finns kvar i Admin-avbokningar, utloggning (`server.mjs` ~640–753), `/chat` och probe-rutter; kartan över Astrid-legacy mot PAOW/v3-vägen finns i #312-arbetet och ska in i Astrid-städningens nästa PR. Utloggningens probe-avbokning kostar en scopad transaktion och ger 403 om `astrid` inte är registrerad (sväljs).
- SQLite-planen (9 PR:er, inga schemaändringar; uppdatering 27 oktober kväll: Jakob sa ja till PGlite, mergat i #432, steg 1–6 är mergade och steg 7 ligger i PR #444): steg 2 kräver Jakobs ja till PGlite som dev-beroende; steg 4 pensionerar `apps/studio/start.mjs --offline` och `local-connection.mjs` (ändrar `AGENTS.md`); steg 5 skriver om Admins Provspel (`studio-preview.mjs`, enda SQLite-användningen på Render); steg 6 gör motorn och `ops/cloud` Postgres-only. Planen ligger utanför Git hos Jakob/Claude; lägg in den i `migrering/` när steg 2 beslutats.
- Snapshot exponerar inte `unplayed`, så klienten kan inte varna "satsa eller förlora rutan"; kontraktsändring.
- Dokumentationen är fortsatt spretig (`JOHN-HANDOFF.md` 3 186 rader, dubbletter mot denna fil, 25 md-filer nämner SQLite); `test/ci-changes.mjs:235` hårdkodar dokumentvägar.
- Vercel-lagret `impactwin-media-preview` är ett avslutat sidoprojekt (ingen kodreferens) och kan raderas av Jakob. Kevin behåller enligt Jakobs beslut 27 oktober läsrollen `kevin_migration_readonly` i produktionens Neon (se [SAMARBETE-OCH-ATKOMST](SAMARBETE-OCH-ATKOMST-2026-10.md#separat-sql-läsroll)) och sin GitHub-åtkomst; ingen skrivåtkomst till produktionen, och för skrivprov är en egen Neon-branch i stagingprojektet rätt väg.

**Nästa steg mot 70 % (utfört senare samma kväll; J08 är VERIFIED, se överst):** J08:s niofältskvitto i isolerad staging (`croupier-k06-k07-staging`, Render `srv-dbf61l0m7kps73ft7mk0` återupptas bara under provet) med kandidaten efter #424: spara → återläs → publicera → produktläsning → auktoriserad launch → aktiv hand behåller C0/P0/M0 medan nästa fönster tar C1/P1/M1 → negativa fall. Därefter `status.json[J08]` VERIFIED med PR, oberoende granskare och kvitto-JSON. K05 kräver Jakobs AV-bedömning av PAOW:s tio klipp; ingen fabricerad acceptans.

## J10 slutverifierad — 27 oktober 2026

**Aktuell procentsats finns bara i [STATUS.md](../../migrering/STATUS.md); vid detta kvitto var 13/20 aktiviteter verifierade (före J08).** [Statusfilen](../../migrering/status.json) är enda statuskälla. [Samlat kvitto](../2026-10-27-ISOLATED-ACCEPTANCE.json), särskilt `webviewVerification`, förenar tidigare ren klon/build/start, HTTP-restore16/16 och Cloud-granskad ledger/schema-paritet med en faktisk ny webviewrunda. Versionsrättningen är mergad i PR421; Cloud-kvittot i PR422.

Ordinarie Admin publicerade nytt syntetiskt PAOW-rum, paket3→4. Lobby och autentiserad `/play/blackjack`→`/game` konsumerade samma rum/operatör/dealer/paket4. Ny spelare satsade5 demokrediter, stod på14 och avslutade handen: saldo995, version3, två ledgerrader och en historikrunda. Reload bevarade saldot. Frontend d53/backend c916 skiljer bara dokument; ingen ny produktkod eller schemaändring behövdes.

J10:s förkunskaper är nu J06/J09: K06:s befintliga publicerings-/launchkontrakt provades, men full fält-, material-/AV- och samtidighetsacceptans stannar i K06/K07/O02. Restore gäller d53:s native-spel mot äldre kompatibelt schema utan optional020; ny PAOW-publicering eller020-konfiguration påstås inte vara återställd.

Eget rum är återställbart arkiverat (paket5), borttaget från lobbyn och ger autentiserad404. Gamla rum, operatorB och projektdata är oförändrade. Render är suspended2026-10-27T11:22:02.103Z med exakt originaldatabas. Inga egna lokala provprocesser startades. Spelaren loggades ut i webviewn; slutliga API-utloggningar gav200. Provkontot/historiken bevaras: Admin-spärr gav503, alla äldre hjälpsessioners återkallelse är inte verifierad. Inga produktionsskrivningar eller AV-attester; Johns Bet bevarad.

## Till nästa IDE/agent, inklusive Claude

Läs `START-HERE.md`, aktuell `AGENTS.md`, `migrering/MASTERPLAN.md` och `migrering/status.json` från aktuell GitHub-main. Arbeta från egen featurebranch; bevara andra checkouts/utkast. Inga nya chattar eller molnresurser behövs. Samordna i #312 och använd egna GitHub/Vercel/Render/Neon-anslutningar. Codex-specifika verktyg kan ersättas med respektive tjänsts CLI/API; ägarskap, exakta versioner och beviskrav består.

| Kvar 26 oktober, 7 aktiviteter à 5 % (J08 är sedan VERIFIED; aktuell lista i [STATUS.md](../../migrering/STATUS.md)) | Nästa verifierbara resultat |
| --- | --- |
| K04 | Händelsedriven presentation och återanslutning med korrekt material under aktiv hand |
| J08 | Versionerade Admin-val publiceras och syns i rätt rum, inklusive konflikter/omstart |
| K05 | Exakt materialbindning och uppmätt tidsbudget; vald PAOW-bank behöver verklig ljud/läppsynkbedömning |
| K06 | Samlad Admin → publicering → spel efter omstart med alla relevanta fält och godkänt material |
| K07 | Spelbeteenden, samtidighet, reconnect och negativa isoleringsfall |
| O02 | Oberoende integrerat samprov på samma frysta kandidat |
| O03 | Godkänd integration och verifierad faktisk drift med återställningsunderlag |

Börja med aktuella kriterier, återanvänd redan mergad Kevin-konvertering och kör oberoende fel-/samtidighetsprov medan AV väntar. Nästa konkreta fel att utreda var stagingens `POST /studio/api/admin/players/status`503 (rättat i #424: kommandotransaktion utan Studio-scope); det var inte ett behörighetsfel. Rätta inte genom direkt SQL eller sänkta authskydd. Den separata rotationsuppdateringens422 behöver exakt felkod innan slutsats; vanlig rumspublicering fungerar.

AV-bank `ebe77511c9f0a1736231cdbab49c0b583e253d9be9d2c30b18df11f9da5a9071` har tio pending-tal. Ingen ljud-/läppsynkacceptans har fabricerats. Bevara godkända bytes, Johns Bet och fryst restore-spelare. Om nya prov kräver staging: återanvänd befintliga tjänster och stoppa egna provresurser efteråt.

Privata bildbevis kan överlämnas separat; lösenord, cookies, råa snapshots och API-/databasnycklar ska inte skickas eller läggas i Git.

## Historisk bakgrund — 26 oktober

Datum: 26 oktober 2026. Beställd av Jakob för en ny agent, eventuellt på annat Codex-konto/dator. Detta är en startpunkt och ett daterat kvitto, **inte en ny migrationsplan eller statuskälla**.

## Uppdrag och användarens senaste beslut

Fortsätt selektiv migrering från Kevin-referensen till ren `main`: Neon är produktregister, Blob lagrar mediebytes och presentationen använder separat bakgrund, dealer och bord. Återanvänd bra klipp-/multitablelogik; återinför inte ersatt Control, lokal QA-produkt eller gamla register. Kevin-staging kan granskas på GitHub, men arbetet får inte bero på Kevins GitLab eller körmiljö.

Jakob bekräftade efter leveransen: **”allt såg ganska bra ut gällande paow för johns spelbolag”**. Han hade också provat skarven i extern webbläsare. Bevara den fungerande demon. Detta bekräftar utseendet, inte full spelrunda, tal/läppsynk eller alla filmövergångar. Hans tidigare godkännande av tio PAOW-talklipp ska omkontrolleras; han beskrev det som ”sloppy”.

## Läsordning och första steg

1. Läs aktuell `AGENTS.md`, kontrollera checkout, branch, HEAD och lokala ändringar. Återanvänd befintligt arbete; ingen bred reset, clean, stash eller omladdning av originalcheckouten.
2. Läs [masterplanen](https://github.com/Jakeminator123/scoutgaming/blob/main/migrering/MASTERPLAN.md) och [enda statuskällan](https://github.com/Jakeminator123/scoutgaming/blob/main/migrering/status.json). Status vid denna avstämning: **12/20 verifierade aktiviteter** (aktuell siffra bara i [STATUS.md](../../migrering/STATUS.md)). J09 är verifierad som avvecklingsförberedelse; faktisk produktions-DDL ingår fortsatt i O03.
3. Läs de senaste avsnitten i [JOHN-HANDOFF](JOHN-HANDOFF-2026-10.md), sedan relevanta delar av `docs/ENVIRONMENT-RESTORATION.md`, `docs/CLOUD-MIGRATION.md` och `docs/LOCAL-PRESENTATION-RUNTIME.md`. Sök i historiska avsnitt; äldre gapbeskrivningar är inte automatiskt aktuella.
4. Kontrollera aktuella PR:er, nya relevanta ärenden i [teaminboxen](https://github.com/Jakeminator123/scoutgaming/blob/main/inbox/README.md) (`node tools/inbox.mjs list --to jakob`) och faktisk drift. GitHub-tråden #312 används inte längre för samordning. Återuppta inte redan mergat arbete.
5. Använd Node **24.21.0** genom Volta, högst fyra testarbetare. Arbeta i egen worktree på en `jakob/claude-*`-branch med avgränsade filer; orkestratorn äger integration och merge.

## Senaste fortsättningen: Kevin-konvertering och nästa etapp

Läs det översta kvällsavsnittet i [JOHN-HANDOFF](JOHN-HANDOFF-2026-10.md). Jakob vill att nyare Kevin-underlag och verkligt produktbeteende väger tyngre än historiska lås. Två duplicerade material-/timinglås är borttagna och 62/62 relevanta beteendeprov passerar. Nästa etapp implementerar nåbar varianttäckning, fryst v2-filmplanering, v31-readiness och explicit Admin-bindning på `codex/reachable-filmed-coverage-20261026`. Läs översta handoffen och faktisk PR-/CI-/driftstatus innan arbete återupptas; koden ger inte AV-acceptans eller nya migrationsprocent.

Isolerad staging innehåller nu 46 exakt bundna, servermätta PAOW-original och en separat sparad PAOW-scen. Tio talval passerar i riktig pending-repetition; inget nytt AV-godkännande eller publicerat rum finns. Projektrevision `studio-989f1e1b-7430-44b6-8ae2-1eeab40c468a`. Staging använder fortfarande syntetiska bakgrunds-/bordslager. Full spel-, AV- och layoutacceptans återstår; status vid denna avstämning var 12/20 (aktuell siffra bara i [STATUS.md](../../migrering/STATUS.md)). Root har beställt sömlös fortsättning i en ny chatt med privat överlämning, inte en ny migrationsplan.

## Levererat och kvarvarande arbete

Fortsatt isolerad runtime har verifierats på `d89048625d127d159101707fe46547a6108987f6` (PR414) och säkerhetshead `a22f7a97dc1f29d91400cb7becc33073bff3d11d` (PR416, mergad som `291dba91924bd432c88733aa28a3bf5db8fe9257`). Hämta aktuell main och läs senaste JOHN-HANDOFF vid övertagandet; en fryst testversion är inte automatiskt senaste produktionsdeploy.

| Leverans | Resultat |
|---|---|
| [PR407](https://github.com/Jakeminator123/scoutgaming/pull/407) | Mergad. Aktiv hand behåller fryst material/rumskonfiguration; obligatoriskt verkligt Chrome-prov passerade. |
| [PR409](https://github.com/Jakeminator123/scoutgaming/pull/409) | Mergad. Oanvänd LegacyClipEditor och exklusiva hjälpare/tester borttagna; aktiva editorer bevarade. |
| [PR411](https://github.com/Jakeminator123/scoutgaming/pull/411) | Mergad. 161 frysta Astrid-testsvar och exklusiv testkedja borttagna; 8 oanvända partnerbilder borttagna. Dealerisolering och negativa prov finns kvar. Inga originalfilmer raderade. |
| [PR412](https://github.com/Jakeminator123/scoutgaming/pull/412) | Mergad. Partnerportalens oanvända demodatabas/mockruntime ersatt av verklig arbetskontext. Rumsutkast, behörighet och revisionsskydd bevarade. |
| [PR413](https://github.com/Jakeminator123/scoutgaming/pull/413) | Mergad. Dokumenterar publicerad PAOW-demo och faktisk verifiering. |
| [PR415](https://github.com/Jakeminator123/scoutgaming/pull/415) | Mergad. En gemensam regression och fullständig backupväg; felaktigt shadersträngslås, oanvänd JSON-backup och dubbla teststarter borttagna. Push-hjälparen stöder smal fetch-konfiguration. Full CI passerar. |
| [PR416](https://github.com/Jakeminator123/scoutgaming/pull/416) | Mergad. Next 16.4.1, Undici 6.29.1 och scopebunden Zod 4.6.6; noll produktionsauditfynd i båda paketen. Full CI/container/GitGuardian, 13 isolerade HTTP-prov och SQL-paritet passerar. |
| PR408 / PR410 | Stängda, inte mergade. PR408 ersattes av PR409. PR410 återläst som CLOSED på head `2b65e4cbe076dc6bac934233ec8102fbb13c5fd3`; behandla den inte som väntande release. |

PR409/411/412 har grön CI på respektive fryst head. Integrerad main `a95f5b9ba138ba310d1dc02b9107b2dae5346395` passerade [full CI40355438860](https://github.com/Jakeminator123/scoutgaming/actions/runs/40355438860), inklusive Chrome och produktionsledgerns readiness. PR413:s dokumentations-CI [40358868999](https://github.com/Jakeminator123/scoutgaming/actions/runs/40358868999) passerade; full regression var korrekt ej tillämplig för den rena dokumentändringen.

## Fungerande demo: bevara denna bas

- [Johns Bet – PAOW Blackjack](https://www.scoutgaming.tech/play/blackjack?operator=johns-bet&table=room-76640ca1-b619-7948-596e-3d102202b7d0)
- [PAOW Studio – PAOW Blackjack](https://www.scoutgaming.tech/play/blackjack?operator=paow-studio&table=room-65390c43-00c7-08a6-fb44-a6083276f2a1)
- Båda har **paketversion 5**, återläst i Neon även vid denna överlämning. Inloggning kan krävas. `Johns Bet` skapades genom ordinarie Admin; inga egna spelkommandon/insatser ingick i provet.
- Gemensam mall: `paow-studio-blackjack-e9a6193d-6bf3-4774-b505-538d6507bf3d`.
- Dealer `paow`; bakgrund Midnight-variant-1 `6daa1434-674c-4a43-bcc7-0a4e93fae62a`; bord Blackjack · Oak `f00be01d-fe7c-4a43-85b9-952e378f7331`.

| Format | Dealer skala / X / Y | Bord bredd / X / Y |
|---|---|---|
| Desktop | `1 / 0 / 0.03` | `0.95 / 0 / 0.27` |
| Mobil | `1 / 0 / 0` | `2.6 / 0 / 0.26` |

Bakgrundens skala/läge är oförändrade; `tableFront=false`. Gemensamt mallutkast är inte samma sak som publicerat bolagspaket: geometri sparas i Sceneditor och publiceras via befintlig `publish-scene-layout` med revisionskontroller. Ändra inte ett delat mallutkast i tron att det bara påverkar ett rum. Använd avsett `roomOverrides` för rumsspecifika val.

Den delegerade chatten ”Felsök webview i Codex Work” kontrollerade båda spelvyerna i **390×844, 1280×720 och 1440×900**: inga geometrivarningar, synligt huvud/händer, tät skarv, sparning efter omladdning och formatbyte. Rotchatten granskade slutbilder och avkodade båda frysta paketen: identisk geometri, oförändrade medie-ID. West Bet, kortankare, filmade banor och talgodkännanden ändrades inte. Egna extra provflikar stängdes; Johns Bet och Admin lämnades öppna.

En mellanversion såg bra ut vid 1440×900 men gav korrekt varning vid 1280×720 eftersom insatsplatser överlappade HUD. Detta löstes med slutgeometrin ovan, utan kodändring eller borttagen varning. Återgå inte till mellanversionernas större desktop-dealer.

## Åtkomst på ett annat konto

Behörigheter, inloggade browserflikar och MCP-anslutningar följer inte en textöverlämning. Anslut rätt GitHub-, Neon-, Vercel- och Render-konton på vanligt sätt. Paketet innehåller inga lösenord, tokens eller databasanslutningssträngar. Testa webview i den nya chatten; ett tidigare nekande var chattspecifikt, medan en annan chatt fungerade.

| Resurs | Identitet / senaste observation |
|---|---|
| GitHub | `Jakeminator123/scoutgaming`, repo-ID `1380630440`, målbranch `main`. |
| Vercel | Team `scoutgaming` / `team_Scxorb9qtZHjNae1YEQnFCaT`; projekt `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`. READY på `291dba91924bd432c88733aa28a3bf5db8fe9257`, deploy `dpl_Ck66fKCYFTJeUyfNJBiqZNbJoggG`, alias `www.scoutgaming.tech`. Publik lobby/inloggning och anonym behörighetsgräns kontrollerade. |
| Render | Jakob godkände workspace `tea-d19jsa63jp1c73ch0sc0`. Produktion **croupier-v3**, service `srv-dbd6nfon74is73aiblf0`. LIVE på `a22f7a97dc1f29d91400cb7becc33073bff3d11d`, deployment `dep-dbfpasfb9u1s738nss10`. Tolv health-/versionsprov efter LIVE passerar och är bundna till ny process. |
| Neon produktion | Projekt `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game`; scope `production` / `croupier`. |
| Neon isolerad staging | Projekt `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, DB `croupier_staging`; scope `staging_k06_k07` / `croupier`. En befintlig QA-mediepost och 46 nya exakt bundna PAOW-original; talreview pending. Ingen publicerad delad bordskonfiguration. |
| Render staging | `croupier-k06-k07-staging`, `srv-dbf61l0m7kps73ft7mk0`: återupptagen för isolerad repetition, LIVE `dep-dbfrl8d9fdbs739tnp8g` på f153. Branch rättad till `main`, autoDeploy av. Kontrollera aktuell ägare före användning/stopp; stoppa efter prov. |
| Vercel staging | Befintliga `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, `croupier-k06-k07-staging.vercel.app`, är åtkomligt genom anslutna `mcp__user_vercel`. Tidigare 404 var anslutningsspecifik. Senast READY dpl_6pAacVPeZBx1iUHYqbAtRKqNjehC på a22f7a97 efter vanlig Admin-/spelkontroll. Backend är nu avsiktligt stoppad. |

`recordedSpeech` **v2** är MP4-talformat med inbäddat ljud, inte Render-motorn v2. Motorn är v3. Native materialresolver, serverägd mätning och MP4-formatet är redan implementerade. Delat spel var fortsatt avstängt enligt releasekvittot; aktivera inte produktionsflaggor som bieffekt av tester.

GitGuardian återläst på main `291dba91924bd432c88733aa28a3bf5db8fe9257`: källbindning verifierad, incidenttäckning komplett för källan, 0 öppna/23 ignorerade, monitorering aktiv. Historisk skanning `too_large`, platsmetadata partiell. PR416:s GitGuardian-check passerade; merge-versionens check väntade vid den separata statusläsningen. Grön CI betyder inte full historisk säkerhetstäckning; läs färsk status före nya kod-/konfigurationsändringar.

Separat driftnotering: efter Render-releasen sågs tillfällig `drift_executor_busy` för Dragans genererade tal. Senare 69 sekunder utan readback-fel och tre förnyade SQL-observationer med stabil leaseägare stöder återhämtning. Rotorsaken till konkurrensen är okänd; detta ändrar inte PAOW:s acceptansstatus. Detaljer i senaste JOHN-HANDOFF.

## Nästa konkreta arbete

1. **K05 / K04:** granska och bind exakta PAOW-takes. Fortsatt bytegranskning verifierar 74 taloriginal och 35 filmoriginal mot exakta SHA och full decode; 74 talstorlekar och 35 film-frameantal matchar. Tio svenska _1-kandidater hämtade via befintlig Admin matchar originalbytes. Detta är fortfarande inte ljud-/bildacceptans. Det finns ingen verifierad slutlista över de tio godkända tagningarna. Slots: `blackjack`, `dealerblackjack`, `dealerbust`, `double`, `goodluck`, `insurance`, `lose`, `placebets`, `push`, `win`; svenska/engelska och flera alternativa tagningar förekommer. Återanvänd registrerade original och befintliga tjänster; massimportera/regenerera inte.
2. **J08 / K06 / K07:** använd isolerad miljö, syntetiska konton och separat hostname. Verifiera Admin → sparning → publicering → spel, aktiv hand under ny publicering, nästa hand, multitable/samtidighet och autentiserad återanslutning i den fulla material-/delatbordskedjan. Återanslutning av en native demo-hand efter verklig processomstart är redan verifierad. Kontrollera exakta materialidentiteter, filmprofil, kontakt/handfrigörande och tidsbudget. Varken layoutdemon eller CI ersätter denna samlade acceptans.
3. **J10 / O02 / O03:** komplettera HTTP-spelreplay efter restore, oberoende integrerad granskning och faktisk driftacceptans när förkunskaperna är verifierade. J09:s förberedelse är VERIFIED efter oberoende review; dess tidigare J08/K05-förkunskaper saknade faktisk koppling och är borttagna. Radera inte produktionsdata utan separat mandat och återställningsunderlag. Uppdatera endast `migrering/status.json` när respektive kriterium verkligen är uppfyllt.

Relevant kod: `apps/studio/lib/presentation-room-api.mjs`, `operator-package-api.mjs`, `studio-document-api.mjs`; `packages/presentation/runtime/{presentation-composition,composition-anchors,game-overlay-layout}.mjs`; `packages/presentation/contracts/filmed-profiles/registry.mjs`; `services/game`. K05:s aktuella väg finns i `migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md`. Källmanifestet `apps/studio/lib/dealer-import-kevin-source-paow.json` är stort: parsa och välj fält, skriv inte ut hela filen.

## Privata bevis och lokala resurser

Den separata ZIP-överlämningen innehåller denna text, sex slutbilder, webview-agentens JSON-kvitto och den privata PAOW-talgranskningen. Dessa bevis är inte ett produktregister och ska inte checkas in. På en annan dator behöver ZIP-filen bifogas separat; gamla `C:/Users/...`-länkar fungerar inte där. Saknas bilderna kan repoets handoff användas, men hävda inte egen visuell verifiering utan att se dem eller göra ett nytt prov.

- Arbetskopian för detta uppdrag: `C:/Users/jakob/.codex/worktrees/migration-takeover/scoutgame`.
- Originalcheckout: `C:/Users/jakob/dev/projects/scoutgame`; användarens egna ändringar där har bevarats. Även `paow-clip-standard`-worktreen tillhör annat arbete.
- Privat gransknings-ZIP: `C:/Users/jakob/.codex/visualizations/2026/10/26/01a17942-eb9b-7312-a6dc-0811bd63afa7/paow-media-review-2026-10-26.zip`, 36 filer, utan lösenord eller sessioner. Packa upp och öppna review.html för de tio ännu ej AV-godkända kandidaterna.
- Fortsatt privat byte-/bildgranskning: `C:/Users/jakob/dev/projects/scoutgame/arkiv/2026-10-26/migration-continuation-paow/review.html`, med `source-byte-audit.json`, `served-byte-audit.json` och `review-candidates.json`. Kandidaterna är inte AV-godkända.
- Privat talunderlag finns i `arkiv/2026-10-26/migration-takeover/paow-speech-review.json` och `.md`, även kopierat till originalcheckouten. Status i filen: `TECHNICAL_INVENTORY_ONLY_NOT_APPROVED_FOR_PLAY`.
- Webview-bevis: `C:/Users/jakob/.codex/visualizations/2026/10/26/01a178d1-5a0d-7312-9d2f-86bdc3a17307/`, filer `johns-bet-paow-verifiering.json` och `*-v5-*.jpg`.
- Inga egna testservrar behöver hållas igång. Egna mergade lokala brancher städades; säkerhetsworktreen game-zod-advisory är återställbart arkiverad efter PR416 och ren status, utan privat återställningsmaterial; återställningsbranchen `codex/migration-handoff-20261026` för stängda PR408 bevarades eftersom den inte är grafmergad. Radera inte andras eller tveksamt återställningsarbete.

Leverera nya ändringar genom egen featurebranch och PR via `node tools/push-github-work.mjs`. Bevara skydd för behörighet, isolation, revisioner, samtidighet och spelregler. Verifiera PR-ägare/källrepo/exakt head mot betrodd aktuell `inbox/people.json` före merge. Ett annat Codex-konto innebär inte automatiskt rätt GitHub-identitet; andra ägares arbete eller oklar identitet kräver AGENTS-regelns särskilda godkännande. Använd aldrig direkt main-push eller force-push som genväg.
