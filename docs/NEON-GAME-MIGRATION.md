# Speldata till separat Neon Postgres

Beslut 2026-09-29: Neon Postgres ska även bära produktionsspelets konton,
saldo och rundor. Det här är målarkitektur, **inte en genomförd flytt**.
Render kör fortfarande `croupier.db` och `craig.db` på sin beständiga disk.
Ingen verklig spelar- eller kontodatabas har öppnats, exporterats eller ändrats
i denna arbetsrunda. Vercel Blob för media och separat Neon för Labzoner är
andra resurser. Spelets Neon får inte dela databas, branch eller behörighet med
Labzoner eller isolerad Preview.

## Nuvarande datagränser

`web/server.mjs` öppnar två synkrona `node:sqlite`-anslutningar:

| Fil | Innehåll | Kod som skriver |
| --- | --- | --- |
| `players/croupier.db` | `players`, `transactions`, `blackjack_tables`, `native_presentations`; spelarlogin och sessioner; CRAIG→spelarlänkar; Partner-mappning, idempotens och rundlogg; chattminne, Probe och eventuella lokala Lissabon-profiler | `web/server.mjs`, `web/native-table.mjs`, `web/player-auth.mjs`, `web/partner-api.mjs`, `web/player-chat-memory.mjs`, `web/player-probe-store.mjs`, `web/lissabon-profiles.mjs` |
| `players/craig.db` | CRAIG `users`, `tokens`, `meta` inklusive signerhemlighet; BO-auth-epoker, handoff-koder, Lab-sessioner och Partner-API-nycklar | `web/server.mjs`, `web/bo-auth-epoch.mjs`, `web/bo-game-auth.mjs`, `web/bo-lab-auth.mjs`, `web/partner-api.mjs` |

Det serverägda native-kommandot i `web/native-table.mjs` använder
`BEGIN IMMEDIATE` för att skriva spelarsaldo, privat sko/rundstatus,
transaktionsrad och presentationskvitto atomiskt. Partner-kommandot har en
separat transaktionsväg. `player-auth.mjs` länkar befintliga CRAIG-identiteter
till spelare och lagrar sessioner i spelardatabasen. Att bara flytta `players`
eller ändra en anslutningssträng skulle bryta dessa samband.

## Förberett, ännu inte inkopplat

- `ops/neon-game/core-schema.sql` definierar **endast** kärntabellerna för en
  tom, separat testdatabas: spelare, ledger, privat bord och presentationskvitto.
  Textlagrade spelstatusar behåller samma JSON-bytes som SQLite. Pengar har
  `NUMERIC(18,2)`, och befintliga transaktions-ID:n kan sättas explicit före
  justering av sekvensen. Schemat har avsiktligt ännu inga främmande nycklar;
  historiska rader måste granskas för föräldralösa referenser först.
- `web/postgres-native-table.mjs` är en fristående asynkron version av
  native-kommandot. Den får en injicerad PostgreSQL-pool, låser spelarraden
  med `FOR UPDATE`, skriver saldo/sko/ledger/kvitto i en transaktion och
  publicerar observationer först efter commit. Den läser inga env-värden,
  importeras inte av den körande servern och kan därför inte byta databas av
  misstag.
- `node --test test/postgres-native-table.mjs` använder enbart en syntetisk
  transaktionsfixture. Den provar omspelning, rollback och att inget event
  publiceras vid misslyckad skrivning. **Ingen anslutning till riktig Neon har
  ännu provats**; SQL-dialekt och drivrutin måste verifieras mot en isolerad
  Neon-branch före produktionsbruk.

## Genomförandeordning

1. Skapa en **egen game-Neon-resurs** med Free-plan eller annat uttryckligen
   godkänt kostnadstak. Lägg endast anslutningshemligheten i Render, aldrig i
   Git, Vercels klientvariabler eller chatten. Vercels första sida och spelklient
   ska anropa Render-API:t; browsern får inte direkt åtkomst till databasen.
2. Färdigställ Postgres-schema och adapter för samtliga aktiva tabeller och
   anrop ovan, även Partner, autentisering, CRAIG-epoker, chatt/Probe och BO.
   Säkerställ att spelkommandot fortsatt har en atomisk transaktion över saldo,
   sko och ledger. Bevara idempotens och lås samma spelaridentitet vid samtidiga
   anrop. Definiera om CRAIG och speldata ska dela **en** game-databas eller
   ha två Postgres-databaser med uttrycklig konsistensordning; nuvarande
   `craig.db` och `croupier.db` kan inte kopieras som ett enda SQLite-snapshot.
3. Kör riktiga integrationsprov mot en tom, isolerad Neon-branch med
   syntetiska konton: login, gäst, Partner, två samtidiga kommandon på samma
   konto, start/act/collect, dubbelanrop med samma `requestId`, omstart,
   sessionsindragning och kontroll av saldo, rundstatus och ledger. Prova
   även anslutningsavbrott före/efter commit och nätverkslatens från Render.
4. Före skarp flytt: verifiera en extern, återläsbar backup av **båda** Render-
   filerna samt övrig tillhörande data enligt `RENDER-BACKUP-RESTORE.md`.
   Pausa alla skrivare, ta ett samordnat snapshot och migrera från kopior till
   den tomma game-resursen. Kontrollera tabellantal, ID:n, varje spelarsaldo,
   transaktionssumma/ordning, sko/rundversion, koppling CRAIG→spelare och
   auth-epoker. Justera Postgres identity-sekvenser efter importerade ID:n.
5. Prova den migrerade kopian via en isolerad Render-testtjänst med annan
   hostname. Gör en kontrollerad produktionsväxling först när inloggning,
   pågående rundor, utbetalningar och återstart är verifierade. Behåll det
   oförändrade SQLite-snapshotet för rollback. Växla aldrig tillbaka till en
   äldre kopia efter att nya rundor accepterats utan en särskild avstämning.

Jira CAC är enligt `AGENTS.md` det levande ärendespåret. Ingen Jira-anslutning
fanns tillgänglig i denna agentmiljö, så inget ärende eller status har ändrats.

För transaktionsvalet: PostgreSQLs `SELECT ... FOR UPDATE` låser raden till
transaktionens slut enligt [PostgreSQLs dokumentation](https://www.postgresql.org/docs/current/explicit-locking.html).
En Neon-branch har en egen anslutningssträng enligt [Neons guide till
branching](https://neon.com/docs/get-started-with-neon/workflow-primer).
