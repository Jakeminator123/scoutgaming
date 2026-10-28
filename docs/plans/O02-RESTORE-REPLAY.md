# O02: körplan för restore-replay (variant B)

Körklar steg-för-steg-lista för [O02-PLAN §3](O02-PLAN.md#3-restore-replay-variant-b). Inget här är kört. Bara staging rörs; produktionen och Johns Bet rörs aldrig. Jakob gav samlat go för stagingstegen 2026-10-28 ("fixa bara detta på bästa sätt"): stoppa skrivare i staging, ny tom restoredatabas, byte av staging-env till kopian och tillbaka, och lösenordsåterställning av en syntetisk spelare i kopian. Allt annat (produktion, radering av resurser, nya betalda resurser) kräver eget ja.

## Förutsättningar

| | Värde |
| --- | --- |
| Kandidat | `$SHA` = fryst main-SHA ur `o02/frozen-candidate.json` ([tools/o02-freeze-check.mjs](../../tools/o02-freeze-check.mjs)) |
| Render staging | `srv-dbf61l0m7kps73ft7mk0`, `https://croupier-k06-k07-staging.onrender.com` |
| Vercel staging | `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, team `team_Scxorb9qtZHjNae1YEQnFCaT`, `https://croupier-k06-k07-staging.vercel.app` |
| Neon staging | projekt `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, källa `croupier_staging`, mål `croupier_staging_restore_o02` (ny), roller `croupier_staging_migrator` (ägare) och `croupier_staging_app` (app) |
| Privat mapp | `$O2` = O02-indatamappen utanför Git (samma som `--inputs`); dumpar och anslutningssträngar ligger i `$O2/private/` och skrivs aldrig ut |
| Nycklar | `RENDER_API_KEY` ur repots `.env.local`; Vercel-token ur Vercel CLI:s `auth.json`; Neon via Neon MCP. Läs in i skalet, eka aldrig |
| PG-klient | PostgreSQL 18-klient (`pg_dump --version` ska visa 18.x; servern kör 18.6). Inget är installerat på Jakobs dator: packa upp EDB:s portabla Windows-zip för 18.x i `$O2/private/pgsql/` eller använd WSL med `postgresql-client-18`. Ingen global installation |

Skal: bash (Git Bash). Sätt först:

```sh
SHA=<40-hex>; O2=<indatamapp>; mkdir -p "$O2/private" "$O2/o02/restore-replay"
SRV=srv-dbf61l0m7kps73ft7mk0; PRJ=prj_7dgyvW5zakx1qJ8YaH5pueVTVi14; TEAM=team_Scxorb9qtZHjNae1YEQnFCaT
RENDER_API_KEY=$(grep -E '^RENDER_API_KEY=' .env.local | cut -d= -f2-)      # skrivs inte ut
VERCEL_TOKEN=$(node -e "console.log(require(process.env.APPDATA+'/com.vercel.cli/Data/auth.json').token)")
PG=$O2/private/pgsql/bin    # pg_dump, pg_restore, psql
```

Anslutningssträngar: hämta med Neon MCP `get_connection_string` (projekt, branch, `database_name`, `role_name`, direkt endpoint, inte pooler) och spara var för sig i `$O2/private/`: `src-migrator.url` (`croupier_staging`, migrator), `src-app.url` (`croupier_staging`, app), `dst-migrator.url` och `dst-app.url` (`croupier_staging_restore_o02`). Lägg till `sslmode=verify-full` om den saknas.

## D: deploy med låst SHA (används i R0, R7 och R9)

```sh
# D1 Render: deploy av exakt commit (MCP trigger_deploy kan inte låsa SHA)
curl -sS -X POST "https://api.render.com/v1/services/$SRV/deploys" -H "Authorization: Bearer $RENDER_API_KEY" \
  -H 'Content-Type: application/json' -d "{\"commitId\":\"$SHA\",\"clearCache\":\"do_not_clear\"}" | tee "$O2/o02/render-deploy.json"
# D2 Vercel: projektet är inte Git-kopplat; deploya SHA:n via API
curl -sS -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"croupier-k06-k07-staging\",\"project\":\"$PRJ\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repoId\":1380630440,\"ref\":\"main\",\"sha\":\"$SHA\"}}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.id,j.readyState,j.meta?.githubCommitSha)})"
# D3 grind: vänta tills båda är klara
curl -sS https://croupier-k06-k07-staging.onrender.com/__cloud/version   # commitSha == $SHA
curl -sS -o /dev/null -w '%{http_code}\n' https://croupier-k06-k07-staging.onrender.com/__cloud/health   # 200
vercel inspect croupier-k06-k07-staging.vercel.app --scope scoutgaming    # Ready, samma dpl_ som D2
```

Registrera `dep-…`, `dpl_…` och SHA i `frozen-candidate.json` (`manual.F6`).

## Stegen

| Steg | Kommando | Grind |
| --- | --- | --- |
| R0 | Kandidaten kör på staging (D1–D3). K04 RERUN-4 och K06/K07-omproven är tagna på `$SHA` och ligger i Git | `node tools/o02-freeze-check.mjs --candidate $SHA` visar F1/F2/F5 pass och F8 `eq` |
| R1 | Stoppa skrivare (se nedan) | Render-health ej 200; Vercel svarar 503 `DEPLOYMENT_PAUSED`; tider noteras |
| R2 | `node tools/o02-snapshot.mjs --url-file "$O2/private/src-app.url" --out "$O2/o02/restore-replay/s0.json" --label S0` | `s0.json` med total hash |
| R3 | `"$PG/pg_dump" --version` och dump (se nedan) | Byte, sha256, `pg_restore --list`-antal, klientversion |
| R4 | Skapa `croupier_staging_restore_o02` med ägare `croupier_staging_migrator` (Neon MCP `create_postgres_database` eller API nedan), sedan grants | Neon-svar; `has_database_privilege` |
| R5 | `pg_restore` till målet | exit 0, tid |
| R6 | S1 på målet och jämförelse | `--compare` exit 0; Studio-ledgern innehåller 020 |
| R7 | Byt env till målet, starta skrivarna, deploya `$SHA` (D1–D3) | `/__cloud/version` = `$SHA`; Render-loggen visar målets databas; health 200 |
| R8a–e | Autentiserad replay (se nedan) | Se tabellen under R8 |
| R9 | S0′ på källan medan appen pekar på målet; byt tillbaka env; deploya `$SHA`; grind | `--compare s0.json s0prime.json` exit 0 |
| R10 | Skriv kvittot `$O2/o02/restore-replay/receipt.json` | Fälten som `tools/o02-receipt.mjs` läser |

### R1 Stoppa skrivare

```sh
curl -sS -X POST "https://api.render.com/v1/services/$SRV/suspend" -H "Authorization: Bearer $RENDER_API_KEY"
curl -sS -X POST "https://api.vercel.com/v1/projects/$PRJ/pause?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN"
curl -sS -o /dev/null -w '%{http_code}\n' https://croupier-k06-k07-staging.onrender.com/__cloud/health   # inte 200
curl -sS -o /dev/null -w '%{http_code}\n' https://croupier-k06-k07-staging.vercel.app/lobby              # 503
```

Vercel Studio skriver Neon direkt, så båda måste stoppas.

### R3 Dump

```sh
"$PG/pg_dump" --format=custom --file "$O2/private/croupier_staging-$SHA.dump" "$(cat "$O2/private/src-migrator.url")"
sha256sum "$O2/private/croupier_staging-$SHA.dump"; stat -c %s "$O2/private/croupier_staging-$SHA.dump"
"$PG/pg_restore" --list "$O2/private/croupier_staging-$SHA.dump" | grep -vc '^;'
```

Roller följer inte med dumpen; i Neon är rollerna projektgemensamma, så ägare och ACL finns redan för målet.

### R4 Skapa målet

Neon MCP: `create_postgres_database` med `project_id=red-violet-36066351`, `branch_id=br-plain-voice-b9yu49xi`, `name=croupier_staging_restore_o02`, `owner_name=croupier_staging_migrator`. Alternativt REST:

```sh
curl -sS -X POST "https://console.neon.tech/api/v2/projects/red-violet-36066351/branches/br-plain-voice-b9yu49xi/databases" \
  -H "Authorization: Bearer $NEON_API_KEY" -H 'Content-Type: application/json' \
  -d '{"database":{"name":"croupier_staging_restore_o02","owner_name":"croupier_staging_migrator"}}'
```

Grants som migrator mot målet:

```sql
REVOKE ALL ON DATABASE croupier_staging_restore_o02 FROM PUBLIC;
GRANT CONNECT ON DATABASE croupier_staging_restore_o02 TO croupier_staging_app;
SELECT has_database_privilege('croupier_staging_app','croupier_staging_restore_o02','CONNECT') AS app_connect,
       has_database_privilege('public','croupier_staging_restore_o02','CONNECT') AS public_connect;   -- true, false
```

### R5 Restore

```sh
time "$PG/pg_restore" --single-transaction --exit-on-error --no-owner --role=croupier_staging_migrator \
  --dbname "$(cat "$O2/private/dst-migrator.url")" "$O2/private/croupier_staging-$SHA.dump"; echo "exit=$?"
```

`--no-owner --role` gör migratorn till ägare som i källan; ACL:erna (`GRANT … TO croupier_staging_app`) följer med dumpen. Kontrollera ägare och ACL efteråt:

```sql
SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner, c.relacl::text
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('croupier_game','croupier_studio','croupier_auth') AND c.relkind IN ('r','p','S')
ORDER BY 1 COLLATE "C", 2 COLLATE "C";
```

Kör samma fråga mot källan och jämför raderna.

### R6 S1 och jämförelse

```sh
node tools/o02-snapshot.mjs --url-file "$O2/private/dst-app.url" --out "$O2/o02/restore-replay/s1.json" --label S1
node tools/o02-snapshot.mjs --compare "$O2/o02/restore-replay/s0.json" "$O2/o02/restore-replay/s1.json"; echo "exit=$?"   # 0
```

Schemaledgern (ska innehålla Studio 020 och game `product-v1`):

```sql
SELECT 'studio' AS ledger, version, checksum FROM croupier_studio.storage_migrations
UNION ALL SELECT 'game', version, checksum FROM croupier_game.storage_migrations ORDER BY 1, 2;
SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
WHERE s.nspname = 'croupier_game' AND c.relname LIKE 'shared\_%' AND c.relkind = 'r';   -- 15
```

### R7 Peka staging mot målet

Värdet är målets app-URL (`dst-app.url`); det skrivs bara till leverantören, aldrig till terminalen.

```sh
# Render: REST ändrar en nyckel utan automatisk deploy (MCP-skrivning sammanfogar och deployar direkt)
curl -sS -X PUT "https://api.render.com/v1/services/$SRV/env-vars/CROUPIER_GAME_DATABASE_URL" -H "Authorization: Bearer $RENDER_API_KEY" \
  -H 'Content-Type: application/json' -d "{\"value\":\"$(cat "$O2/private/dst-app.url")\"}" -o /dev/null -w '%{http_code}\n'
# Vercel: läs env-ID:t för CROUPIER_GAME_DATABASE_URL (production) och skriv om värdet
curl -sS "https://api.vercel.com/v10/projects/$PRJ/env?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const e of JSON.parse(s).envs)if(e.key==='CROUPIER_GAME_DATABASE_URL')console.log(e.id,e.target)})"
curl -sS -X PATCH "https://api.vercel.com/v9/projects/$PRJ/env/<envId>?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"value\":\"$(cat "$O2/private/dst-app.url")\"}" -o /dev/null -w '%{http_code}\n'
curl -sS -X POST "https://api.render.com/v1/services/$SRV/resume" -H "Authorization: Bearer $RENDER_API_KEY"
curl -sS -X POST "https://api.vercel.com/v1/projects/$PRJ/unpause?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN"
```

Kör sedan D1–D3 med samma `$SHA`. Bevis på att motorn läser målet: Render MCP `list_logs` för `$SRV` efter starten (databasnamnet i readiness-loggen), eller som approll `SELECT client_addr, backend_start FROM pg_stat_activity WHERE datname = 'croupier_staging_restore_o02'` som visar nya anslutningar medan `croupier_staging` inte får några.

### R8 Autentiserad replay på kopian

Spelaren P1 är den syntetiska spelaren från K07-omprovet på kandidaten; UUID och `requestId` finns i dess råkvitto (utanför Git). Alla anrop går via `https://croupier-k06-k07-staging.vercel.app`.

| Steg | Åtgärd | Grind |
| --- | --- | --- |
| R8a | Logga in med stagingens admin (`STAGING_ADMIN_LOGIN_UN/PW` ur `.env.local`). Läs `/studio/api/admin/room-game-config?operatorId=qa-k06k07-9dd2d3a4-a&roomId=room-33b37ff3-ec79-ff2d-5567-b14a9d3efe5e`, lobby A och B (`/api/operators/<id>/rooms`) och `/studio/api/admin/transactions` | Config och paket som i S0 (i dag `room-config-e0be09e9…`, paket 15). SHA-256 av HTTP-ledgern = SQL-hashen på målet (frågan i R8e) |
| R8b | `POST /studio/api/admin/players/password` för P1 **mot kopian** (approllens URL pekar på målet sedan R7), logga in som P1 och skicka om P1:s ursprungliga `stand`/`collect` med samma `requestId` | 200 med lagrad version och saldo; **0 nya ledgerrader**; ändrad kropp med samma id ger 400 |
| R8c | Ny hand med P1 i rum 33b37ff3: start, act, collect; `presentation/select` för speak/deal | Media-UUID och SHA ur paketets material; ledgerdelta = −insats och +retur |
| R8d | Skicka om R8c:s `requestId` | Identiska svar, 0 nya rader |
| R8e | Ledgerhash på målet efter R8d (SQL nedan, som approll) | `L1` = hash(S1-transaktionerna + exakt R8c:s rader); HTTP = SQL |

```sql
-- R8e: samma kanonisering som tools/o02-receipt.mjs (D1)
BEGIN READ ONLY;
SELECT count(*)::int AS n, encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text, 'UTF8')), 'hex') AS sha
FROM croupier_game.transactions t;
SELECT count(*)::int AS mismatched FROM croupier_game.players p
WHERE p.balance <> (SELECT COALESCE(sum(t.amount), 0) FROM croupier_game.transactions t WHERE t.player_id = p.id);
ROLLBACK;
```

Lösenordet i R8b är en avsiktlig skrivning, bara i kopian. Ingen produktion, ingen riktig spelare.

### R9 Källan orörd och tillbaka

```sh
node tools/o02-snapshot.mjs --url-file "$O2/private/src-app.url" --out "$O2/o02/restore-replay/s0prime.json" --label S0prime
node tools/o02-snapshot.mjs --compare "$O2/o02/restore-replay/s0.json" "$O2/o02/restore-replay/s0prime.json"; echo "exit=$?"   # 0
```

S0′ tas medan appen fortfarande pekar på målet, så ingen skrivare kan ha rört källan mellan R1 och jämförelsen. Byt sedan tillbaka `CROUPIER_GAME_DATABASE_URL` på Render och Vercel till `src-app.url` (samma kommandon som i R7), kör D1–D3 och kontrollera health. Suspendera Render-stagingen enligt Jakob. Målet `croupier_staging_restore_o02` står kvar tills Jakob raderar stagingen efter O03.

### R10 Kvitto

`$O2/o02/restore-replay/receipt.json`, utan hemligheter:

```json
{ "kind": "o02-restore-replay/v1", "candidate": "<SHA>", "at": "<ISO>", "by": "<agent-id>",
  "writersStopped": { "renderSuspendedAt": "", "vercelPausedAt": "" },
  "dump": { "bytes": 0, "sha256": "", "pgVersion": "18.x", "listEntries": 0 },
  "target": { "database": "croupier_staging_restore_o02", "owner": "croupier_staging_migrator", "appConnect": true, "publicConnect": false },
  "parity": { "equal": true, "tables": 0, "sha": "<S1 total>" },
  "replay": { "summary": "R8a–R8d", "storedResponsesIdentical": true, "newLedgerRowsForReplays": 0 },
  "ledger": { "httpEqualsSql": true, "l1": "", "delta": [] },
  "sourceUntouched": { "equal": true, "s0": "", "s0prime": "" },
  "deploys": { "render": ["dep-…"], "vercel": ["dpl_…"] },
  "limits": ["Neon-PITR och globala roller ingår inte", "R8b skriver ett lösenord i kopian", "Blob-bytes återställs inte; hash och HEAD visar att de nås"] }
```

Den sanerade sammanfattningen går in i `docs/<datum>-O02-ACCEPTANCE.json` med O02-kvittot.
