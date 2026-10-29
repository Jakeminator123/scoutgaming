# Steg F: spelare knyts till bolag

Plan för steg F i [ADMIN-FORENKLING](ADMIN-FORENKLING.md) §9, skriven 29 oktober 2026 mot `main` ffe6b4a6c i samma form som [NYCKEL-BOLAG](NYCKEL-BOLAG.md). Radnumren gäller grenen `jakob/claude-steg-f-1`. Raderas när steget är verifierat i drift.

## 1. Var spelare skapas och läses i dag

| Väg | Fil:rad | Bolaget känt? |
| --- | --- | --- |
| Admin `players/create` | `apps/studio/lib/studio-admin-data.mjs:163` → `packages/storage/server/player-administration.mjs:14–15` | nej, kroppen saknar bolag |
| Partner-API, första anropet per partnerspelare | `services/game/storage/async-partner-api.mjs:105–119` | ja, nyckelns `operator_id` (game-012) |
| Egen registrering `/api/auth/player/register`, `/api/auth/register` | `services/game/storage/async-player-auth.mjs:217–218, 249–250` → `apiPlayer` `services/game/server.mjs:211–219` | nej, `?operator=` följer inte med |
| Craig-/personalkoppling vid inloggning | `async-player-auth.mjs:126` | nej |
| `/api/player` och förhandsvisningens spelare | `server.mjs:253, 497` | nej |
| Läses: session och bindning | `async-player-auth.mjs:56–92, 100–112`; delade bordets kommando `services/game/storage/shared-command-auth.mjs:45–97` | F1: `playerOperatorId` |
| Läses: delat bord och spelsidan | `services/game/shared-room-access.mjs:19–36, 94–101`; `/blackjack` `server.mjs:1132`; roulette `games/roulette/storage.mjs:24` (rummets bolag) | jämförs bara för partnernycklar |
| Läses: inloggningsnamn | `player_accounts.email` PRIMARY KEY (`ops/neon-game/product-schema.sql:18`); `packages/studio-access/server/account-credentials.mjs:17`, `async-player-auth.mjs:211, 240`; kollisioner `apps/studio/lib/operator-accounts.mjs:123`, `studio-admin-accounts.mjs:94` | globalt unika |
| Läses: listor | Admin `GET players` `studio-admin-data.mjs:107`; Partnerportalens Spelare `apps/studio/components/partner/views/players.jsx:7` (tomläge) | F1: Admin |

## 2. Datamodell

**Före:** `croupier_game.players` saknar bolag, saldot är ett per spelare, inloggningsnamnet är globalt unikt, och bara partnerspelare når ett bolag (via `partner_players.key_id` → `api_keys.operator_id`).
**Efter 014:** `players.operator_id text` med samma CHECK som `croupier_studio.operators.operator_id` och indexet `players_operator_idx`; NULL tillåts. Ett konto tillhör ett bolag, så `players.balance` är saldot per bolag; en person hos två bolag har två konton. Ingen FK mellan scheman (som 012): bolagets existens kontrolleras i koden. Sessionen får ingen ny kolumn; bindningen läser bolaget ur spelarraden.
**Efter game-015 (kravsteget):** NOT NULL, oföränderligt (trigger som i 012), och `player_accounts.operator_id` med `UNIQUE (operator_id, email)` i stället för `PRIMARY KEY (email)` (beslut 2). API-nycklarna har redan bolag (#538, #561, game-012).

## 3. Migreringen `game-014-player-operator`

- **Spelets ledger**, inte Studios: `players` ligger i `croupier_game` och skrivs av motorn. Nummer 014 efter game-013, registrerad `deploymentOptional` i `ops/neon-game/migrations.mjs`, så readiness visar `game-014` som valfri väntande tills den körs och därefter som `applied`.
- Form som 012: `tools/prepare-player-operator.mjs` renderar offline; mål-, ägar-, ledger- och triggerkontroller, `players` låses ACCESS EXCLUSIVE med `lock_timeout` 2 s, postflight kontrollerar kolumn, CHECK, index, ledgerrad och att ingen spelare saknar bolag. `--readiness-sql` visar planen (regel, bolag, antal spelare) och slutar med ROLLBACK.
- **Idempotent:** `ADD COLUMN`/`CREATE INDEX IF NOT EXISTS`, backfill bara där `operator_id IS NULL`, ledgerraden `ON CONFLICT DO NOTHING`. En andra körning ändrar inget; spelare skapade efter 014 av kod som ännu inte skriver bolaget får bolag med samma regel. Annan checksumma, handgjord kolumn eller ändrad struktur nekas.
- **Backfill (Jakobs beslut 1, förslag):** partnerspelare → nyckelns bolag; annars bolaget som äger spelarens senaste spelbord (senaste av delat bords närvaro och senaste rouletteinsats, bara bolag som finns i scopet); annars reservbolaget, förslag `scoutgaming-demo`.

Jakob kör, efter merge av F1 och backupgrenen `backup-player-operator-<datum>` ([ENVIRONMENT-RESTORATION](../ENVIRONMENT-RESTORATION.md)), som `croupier_game` mot den direkta endpointen. Evidensen är privat JSON med `database`, `role`, `environment` (`production`), `workspace` (`croupier`), `fallbackOperator`, `releaseSha`, `rollbackSha` och `backupSha256`:

```sh
node tools/prepare-player-operator.mjs --evidence <privat>/014.json --readiness-sql > <privat>/014-readiness.sql
node tools/prepare-player-operator.mjs --evidence <privat>/014.json --sql > <privat>/014.sql
psql "<direkt anslutning som croupier_game, sslmode=verify-full>" -X -v ON_ERROR_STOP=1 -f <privat>/014-readiness.sql
psql "<direkt anslutning som croupier_game, sslmode=verify-full>" -X -v ON_ERROR_STOP=1 -f <privat>/014.sql
node tools/check-migration-readiness.mjs
```

## 4. PR-ordning (tolerant kod → Jakobs migrering → krav)

1. **F1 (`jakob/claude-steg-f-1`):** 014, prepare-verktyget, ledgerregistreringen och tolerant läsning (`to_jsonb(p)->>'operator_id'`): bindningen bär `playerOperatorId` när spelaren har bolag, Admins `GET players` ger `operatorId` och `operatorBinding` (`pending` före 014). Inget nekas, inget UI. Prov: `test/player-operator-migration.mjs`.
2. **Jakob kör 014** (preview först, sedan produktionen); readiness och `GET players` visar resultatet.
3. **F2 skapvägar och kontroll:** bolag i varje skapväg (Admin kräver `operatorId` när kolumnen finns, partnerspelare får nyckelns bolag, registrering och `/player-login` bär `?operator=`, lobbyn), bolagskontroll när spelarens bolag är känt (`/game`, `shared-room-access` admit, `shared-command-auth`, roulette), partnerns `GET players` per bolag (`players.read`), game-015 skriven men inte körd. Spelare-vyerna i båda nivåerna som egen UI-PR.
4. **Jakob kör game-015.**
5. **F3 krav:** motorn kräver game-014 och game-015 vid start (som `product-v1`), versionerna blir obligatoriska i readiness, spelare utan bolag nekas, inloggning per bolag, toleranta grenar raderas. Klart när en spelare hos A inte kan spela i B:s rum, med negativa prov per väg (sida, socket, kommando, roulette, partner-API) och staging visad för Jakob.

## 5. Risker

- `scoutgaming-demo` är avstängt och raderas i [REN-START](REN-START.md); spelare där har inga öppna bord när F2:s kontroll slås på. Kör ren start först eller välj ett annat reservbolag; readiness visar fördelningen innan något skrivs. Ett bolag som raderas efter 014 lämnar spelare med okänt bolag (ingen FK); F2 nekar dem med namngivet fel, och REN-START flyttar eller stänger dem först.
- `ADD COLUMN` låser `players`: spelarfrågor väntar högst 2 s eller så avbryts transaktionen utan ändring. Plantabellen är TEMP och kräver direkt anslutning, inte poolern.
- "Senaste spelbord" är en heuristik: nativebordet (`blackjack_tables`) saknar bolag och räknas inte; närvaro som skrivs under körningen syns inte.

## 6. Jakobs tre beslut

1. **Backfill och reservbolag:** gäller regeln ovan, och vilket bolag får spelare utan spår (`scoutgaming-demo`, `johns-bet` eller ren start först)?
2. **Inloggningsnamn:** unika per bolag (samma namn hos två bolag ger två konton, och inloggning utan bolagskontext blir tvetydig) eller fortsatt globalt unika (PK `email` kvar)?
3. **Spelare utan bolagskontext:** Craig-/personalinloggning, registrering utan `?operator=`, `/api/player` och förhandsvisningens spelare: stängs vägen, krävs `?operator=` eller får de ett internt bolag? Och är bolaget oföränderligt (trigger i game-015) eller flyttbart av Admin?
