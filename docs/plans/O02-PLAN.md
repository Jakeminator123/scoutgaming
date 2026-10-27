# O02 — Oberoende integrerad granskning: körklar plan

> **Flyttad till repot 27 oktober kväll** från orkestratorns lokala arbetsmapp, oförändrad utom sökvägar. Läget har gått vidare sedan planen skrevs: alla tjänster kör `cc415cd8`, Studio-migrering 020 är applicerad i produktionen och kvällens kvitton finns i Git: [K04-webbläsaren](../2026-10-27-K04-BROWSER-ACCEPTANCE.json), [K05-produktionen](../2026-10-27-K05-PRODUCTION-ACCEPTANCE.json), [K06](../2026-10-27-K06-STAGING-ACCEPTANCE.json) och [K07 delat bord](../2026-10-27-K07-STAGING-ACCEPTANCE.json). Skriptet ligger i [tools/o02-receipt.mjs](../../tools/o02-receipt.mjs). Råkvitton och skärmbilder som planen nämner (`j08/…`, `k04-k07/…`, `k05/…`, `dryrun-e7a4e251.json`) finns inte i Git. Läs om läget innan planen används.

Skriven 2026-10-27 kväll mot `main` `e7a4e251caab7a5bfa3ddc8dc440d8057a893863` efter `git fetch`. Repo och live-miljöer var bara lästa. Varje påstående har källa. Det som saknar bevis står som **SAKNAS** och följs av beviset som krävs.

## 0. Läget just nu (read-only, ca 18:15 UTC)

| Vad | Observerat | Hur |
| --- | --- | --- |
| main | `e7a4e251` (#440). Push-CI [40556239302](https://github.com/Jakeminator123/scoutgaming/actions/runs/40556239302) har `success` | `git fetch`, `gh api …/actions/runs?head_sha=` (dry-run `dryrun-e7a4e251.json`) |
| PR #434 (SQLite steg 6) | Öppen och **inte** utkast, head `39469d89`, mergeable, `BLOCKED`. CI [40556528072](https://github.com/Jakeminator123/scoutgaming/actions/runs/40556528072) pågår (dealer-regression). 24 runtimefiler i `services/game/`, `ops/cloud/` och `packages/` | `gh pr view 434` |
| Övriga öppna PR:er | #352 (utkast, `.github/workflows/claude-pr-review.yml` + doc), #315/#323 (Kevin-utkast, bara `kevin/croupier-scoutgg/test/*`). Ingen av dem rör runtime | `gh pr list` |
| Staging Render `srv-dbf61l0m7kps73ft7mk0` | **LIVE** på `b08f2a866f77…`, health 200 | `GET /__cloud/version` |
| Produktion Render `croupier-v3` | **LIVE** på `341a83442abd…` (#438), health `ok` | `GET https://croupier-v3.onrender.com/__cloud/version` |
| Produktion Neon `wandering-hill-60561912/br-flat-fog-b161a6r8/croupier_game` | 15 `shared_*`-tabeller, alla tre 008-kolumnerna (`wallet_gen`, `source_key`, `source_fingerprint`), `shared_table_rooms`=0, `shared_table_configs`=0. Studio-migreringar 001–008, 011–019, **ingen 020**. Game-ledgern har `product-v1` och `sqlite-import-v1`, men inga rader för 008–010. Lissabon-tabellerna finns kvar | Neon MCP `run_sql`, bara katalog-/count-SELECT, inga spelardata |
| Staging Neon `red-violet-36066351/br-plain-voice-b9yu49xi` | 15 `shared_*`-tabeller, `shared_table_configs`=1, Studio 001–008, 011–015, 017, **020**. Databaserna är `croupier_staging` och `croupier_staging_restore` | Samma |
| Retirerade ytor på staging-Vercel | `/control` 307→`/admin`, `/lab` 307→`/admin`, `/bo` 404, `/studio` 308→`/admin`. Render `/studio` 307→Vercel `/studio`. Anonym `/api/table` och `/studio/api/admin/transactions` ger 401 | `curl` GET |

## 1. Vad O02 måste uppfylla, med bevis

Kriterierna kommer från fyra ställen:

- O02:s checklista i `migrering/MASTERPLAN.md:511-521`.
- 9/10-målet i `MASTERPLAN.md:114`, som O02:s evidens citerar i `migrering/status.json:635`.
- Slutkvittokravet i `MASTERPLAN.md:138`.
- SQLite-slutkravet i `MASTERPLAN.md:11` och oberoenderegeln i `MASTERPLAN.md:280`.

Alla bevis från i dag gäller **olika SHA:er**: Vercel `c32be1fb`/`b08f2a86` och Render `c32be1fb`/`15aa3192`/`4838537d`/`b08f2a86` (`docs/2026-10-27-J08-STAGING-ACCEPTANCE.json:973`). Inget av dem gäller den frysta kandidaten. De är delbevis som granskaren återanvänder, men varje kriterium kräver ett nytt kvitto på kandidaten (K1).

| # | Kriterium (källa) | Befintligt bevis | Status och bevis som saknas |
| --- | --- | --- | --- |
| K1 | Frys en integrerad kandidat. Verifiera schema, miljö, webb, motor och media var för sig (`MASTERPLAN.md:515`, `:138`) | Mönstret finns: J08-kvittots `environment` (`J08…json:17-138`), J10 `cloudVerification.neon.schemaReadback` (`ISOLATED…json:126-319`) | **SAKNAS.** Kvitto med samma kandidat-SHA på Vercel och Render, full CI-run-id, containerkontroll, schemaledger (Studio + game) och paket/config för rum 33b37ff3. Se §2 |
| K2 | Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning (`MASTERPLAN.md:516`) | J08: `j08.positive` (`J08…json:379-478`), `j08.afterProcessReplacement` (`:479-499`). K04-b1 och c1–c5 (`:556-589`). J10 `webviewVerification` (`ISOLATED…json:414-590`). `status.json:466`, `:560` | **Delvis.** (a) Hela kedjan har aldrig körts på *en* SHA. (b) Omstarterna var redeploys, inte *Restart service* (`J08…json:124`). (c) Återanslutning är tillståndshämtning eftersom klienten saknar SSE (`J08…json:558`). Krävs: samma kedja på kandidaten med en riktig *Restart service* (samma SHA) mitt i en hand |
| K3a | Negativa fall: fel rum eller ägare (`:517`) | J08 404/409/422 (`J08…json:155-259`). K07-j1–j3 (`:883-899`) | Pass i staging. Körs om på kandidaten |
| K3b | Negativa fall: fel **roll** | — | **SAKNAS.** `J08…json:512` säger "Fel roll provades inte live". Krävs: en Admin-session med lägre roll (t.ex. `reader`/partner) som får 403/404 på room-game-config, publicering och `players/status` |
| K3c | Inaktuellt paket | Inaktuella revisioner 409 (`J08…json:186-208`). K04-d4 och d5 409 (`:609-618`) | Pass. **Fynd:** operatör B:s kontext ger 409 `studio_presentation_idle_package_changed` i stället för 404 (`J08…json:774`). Granskaren klassar fyndet (icke-blockerande om isoleringen håller) |
| K3d | Dubbelkommandon | K07-e0, e1r, h4 och K04-d2 (`J08…json:793-863`, `:597-601`) | Pass i staging. Körs om på kandidaten |
| K3e | Samtidiga spelare | K07-h1–h3 (`:841-857`) | **Delvis.** Delat bord g1/g2 är blockerat med 503 (`:823-832`). Flera spelare vid *samma* bord saknas (`status.json:589`). Kommer med K07 |
| K3f | Avbruten presentation | Bara kodbevis: fem injicerade feltyper, outbox-loop (`status.json:407`, Kevin-rapporterat och läsgranskat) | **SAKNAS live.** Krävs: avbryt mediehämtning mitt i en hand (browser offline/abort) och visa att saldo och ledger är oförändrade, att retry inte debiterar igen och att handen fortsätter |
| K3g | Felaktiga media-ID | Materialgrind 422 vid publicering (`J08…json:238-242`). Stale select 409 (`:614-618`) | **SAKNAS live.** Krävs: `/api/presentation/select` eller medie-GET med ett påhittat UUID och med UUID från ett annat paket ger 4xx och ingen byte-leverans |
| K4 | Borttagna ytor kan inte starta en alternativ produkt (`:518`) | Live i kväll (§0). Container-asserts mot `apps/`, `media/`, `lab/data` och PGlite (`.github/workflows/product-container-check.yml:53-56`). SQLite-spärr (`.github/workflows/croupier.yml:52-56`). `--offline` pensionerad (#431, `AGENTS.md:63`) | Pass i staging. Körs om på kandidaten |
| K4b | Testfixturer använder aldrig riktiga användardata (`:518`) | Kvittona: "inga … spelaranvändarnamn eller spelar-UUID" (`J08…json:16`). Syntetiska QA-operatörer (`:140-148`) | **SAKNAS som riktat prov.** Krävs: (1) `rg` i `test/`, `**/test/` och `tools/*qa*` efter produktionsidentiteter (`wandering-hill-60561912`, `br-flat-fog-b161a6r8`, `ep-fragrant-meadow`, `www.scoutgaming.tech` som skrivmål, produktionens operatör-/rum-ID). (2) Read-only SELECT på staging som visar att alla spelare och operatörer är syntetiska (prefix `qa-`/`j08`/`k0`) |
| K5 | Granskaren redovisar observerat resultat, testmiljö och brister, och tillskriver tidigare kvitton sina författare (`:519`) | — | Protokollet i §3 och kvittot i §4 |
| K6 | 9/10: överenskommen dealer/rum genom Admin till **två följande spel** (`:114`) | Två händer på PAOW-rum 33b37ff3 paket 7, en före och en efter processbyte, men på olika backend-SHA (`J08…json:628-771`) | **SAKNAS på kandidaten.** Krävs: två följande händer utan reload i samma rum, samma SHA, med media-ID per händelse |
| K7 | 9/10: korrekt kortkontakt och valt godkänt tal (`:114`, `:93`) | Tio godkända tal är frysta i paket 6/7, bara i staging (`J08…json:300-377`). Utlösta i spel: goodluck, lose, placebets, dealerbust | **SAKNAS.** (a) insurance, blackjack, dealerblackjack, double, win och push har aldrig utlösts. (b) Giv-, hål- och revealklipp är `unreviewed`/`lab-only` (`J08…json:775`). (c) Kortkontakt och läppsynk kräver Jakobs ögon (§3.4 V1/V2) |
| K8 | 9/10: exakt en ekonomisk effekt (`:114`) | K07-h2 (en debitering), h4, h5a och h5b: ledger = Neon, SHA `7459106d…` (`J08…json:849-875`). J10-ledger (`ISOLATED…json:561-581`) | Pass i staging. Körs om på kandidaten, plus en invariant över hela databasen (`ledgerMismatch`, §4) |
| K9 | 9/10: obligatorisk regression (`:114`) | Main-CI på `e7a4e251` är grön (§0) | **SAKNAS för kandidaten.** Push-CI med `scope=full` och `migration_readiness=success` (`croupier.yml:243-293`, `tools/ci-changes.mjs:66-85`) |
| K10 | 9/10: särskild mobil- och mediaacceptans (`:114`). Fysisk Safari är obevisad (`:108`) | PR385 320/390 px och desktop är historiskt delbevis (`:108`) | **SAKNAS.** §3.4 V3 |
| K11 | 9/10: fungerande kompatibel restore (`:114`). O02-blockern: "autentiserad HTTP-spelreplay efter restore" (`status.json:644`) | SQL-restore 10-25: 75 tabeller, 1 777 nycklar, app-läsare (`docs/ENVIRONMENT-RESTORATION.md:161-181`). d53 HTTP-restore 16/16 med login, läsning och replay mot den dumpen utan 020 (`ISOLATED…json:35-50`, `docs/JOHN-HANDOFF.md:57`). Ledgerparitet för en spelare (`ISOLATED…json:113-125`) | **SAKNAS för nuvarande schema och data.** Dumpen är från 10-25, före 020, J08-config 38b14261, paket 7, AV och K07. Design i §3.3 |
| K12 | Versionerad Admin-kedja (`status.json:635`) | J08 VERIFIED (`status.json:424-469`) | **Delvis.** Aktiv-hand-regeln (C0/P0/M0 behålls, nästa fönster får C1/P1/M1) har inte körts live (`status.json:562`, `J08…json:967`). Kommer med K06 |
| K13 | SQLite lämnar main helt, och O02/O03 ska bekräfta det (`MASTERPLAN.md:11`) | Spärr med krympande allowlist. Main har 16 poster. PR #434:s allowlist har 9: 5 för arkivering i O03, 2 PR-7b (`packages/director/node/companion-store.mjs`, `services/openclaw/lab/deploy/companion-search-server.mjs`), 2 PR-7c (`tools/backup-render-state.mjs` + test) | **Delvis efter #434.** Motor och ops/cloud blir fria från SQLite. Director/Gateway och backupverktyget kvarstår. O02 redovisar det som känt gap. O03 stänger det (§5) |
| K14 | Slutkvittot identifierar release: Vercel/Render-versioner, schema, paket/config och exakta media (`:138`) | Mönstret finns i J08-kvittot | **SAKNAS.** Fälten `environment`, `inputs` och `criteria` i O02-kvittot (§4) |
| K15 | Delat bord och samtidighet (K07, `status.json:589`) | Blockerat med 503 utan flaggan (`J08…json:823-832`) | **SAKNAS.** Kräver K07-kvitto med `CROUPIER_SHARED_TABLE_ENABLED=1` i staging. Det kräver Jakobs ja (`docs/NEXT-AGENT.md:52`) |
| K16 | K06:s produktionskrav: Johns Bet efter K05 (`status.json:504`, `:562`) | K05-produktion: recordedSpeech v2 på tio + 43 tagningar. 6 approved, 2 rejected, resten pending (`J08…json:902-952`) | **SAKNAS.** Jakobs AV-godkännande i produktionen, kopplade talfack och ompublicering (`NEXT-AGENT.md:46-50`). Det tillhör K05/K06, men O02 kan inte passera innan K06 är VERIFIED. Risk: produktionen saknar Studio 020 (§6 C3) |

**"Klart" för O02** (`MASTERPLAN.md:521`): inga blockerande fynd, och verkliga driftprov redovisas skilda från automatiska tester. Kvittot har därför separata fält: `criteria[].source` för automatiskt, live eller manuellt bevis, och `requests` för live-HTTP.

## 2. Fryst kandidat

### 2.1 Förslag: frys merge-SHA:n för PR #434 (`M434`)

1. **#434 är den sista ändringen i SQLite-planen som rör det `croupier-v3` och motorn kör.** Den raderar SQLite-tvillingarna i `services/game/` och gör `ops/cloud/config.mjs` Postgres-only (PR-filerna i §0). Fryser vi före #434 granskar O02 kod som sedan raderas. Varje runtimekvitto måste då göras om efter merge, och O02 kan inte bekräfta slutkravet i `MASTERPLAN.md:11`.
2. **Efter #434 finns inga allowlistposter under `services/game/` eller `ops/cloud/`** (PR-branchens `tools/no-sqlite-allowlist.json`). Kvar finns bara PR-7b/7c (OpenClaw Director/Gateway och backupverktyget) och arkivposterna för O03.
3. **#434:s risk är känd och avgränsad.** Den gäller bara att SQLite-backendvalet försvinner, och produktionen kör redan Postgres (`ops/cloud/config.mjs`, `ops/cloud/RENDER-V3.md:59`). Planens rollback är revert och redeploy (`sqlite-removal-plan.md:9`, `:59`).

**Undantaget PR-7a/7b/7c.** De rör `apps/studio/lib/companion-server.mjs` (Vercel Studio) och `packages/director` (`sqlite-removal-plan.md:23`, `:30`), alltså runtime. Två lagliga vägar finns:

- **(A, rekommenderas om de är klara inom ett dygn):** merga 7a–7c, och frys sedan den SHA:n. Då klarar O02 hela K13.
- **(B):** frys `M434` och lägg 7a–7c på is tills O02-kvittot är klart. K13 redovisas som känt gap som O03 stänger.

Om något runtime-PR mergas efter frysningen blir kandidaten ogiltig.

### 2.2 Krav på kandidaten (alla måste vara sanna och registrerade)

| # | Krav | Hur det bevisas |
| --- | --- | --- |
| F1 | `M434` ligger på `origin/main` | `git merge-base --is-ancestor M434 origin/main` |
| F2 | Full CI är grön på exakt `M434` | Workflow *Croupier GitHub checks*, event `push` (eller `workflow_dispatch`), `conclusion=success`. Push till main ger alltid `scope=full` med migration readiness mot produktionsledgern (`tools/ci-changes.mjs:66-85`, `croupier.yml:243-293`). Run-id och URL registreras |
| F3 | Containerkontrollen är grön på `M434` | `product-container-check.yml` triggas bara på PR med vissa sökvägar eller `workflow_dispatch` (`:3-14`). Kör därför `gh workflow run product-container-check.yml --ref main` direkt efter merge, så att run-head = `M434`. Run-id registreras |
| F4 | GitGuardian är `success` på `M434` och öppna incidenter är lästa | GitHub check-run plus en färsk dashboardläsning. Historiken har varit `too_large` (`status.json:661`), och det redovisas |
| F5 | Inga öppna icke-draft-PR:er rör runtime-prefixen | `gh pr list --json files`. Prefixen finns i `o02-receipt.mjs` (`RUNTIME_PREFIXES`). I kväll är bara #434 öppen och icke-draft. #352, #315 och #323 är drafts utanför runtime och listas |
| F6 | Staging kör `M434` på både Vercel och Render | Render: deploy *av specifik commit* (dashboard *Deploy a specific commit* eller API med `commitId`). MCP `trigger_deploy` kan **inte** låsa SHA (`J08…json:124`). Vercel: deployment från `M434` till staging-projektet `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, med `dpl_…` och `meta.githubCommitSha` lästa från Vercel-API:t. `/__cloud/version` = `M434`. 32/32-grind som i `J08…json:46-55` |
| F7 | Schemaledgern på staging är registrerad | Studio och game `storage_migrations` (version + checksumma), som i `ISOLATED…json:126-128`. 15 shared-tabeller |
| F8 | K04-, K06- och K07-kvittona är tagna **på `M434`** eller på en runtime-ekvivalent SHA | Runtime-ekvivalent betyder `git diff --name-only <sha> M434 -- <RUNTIME_PREFIXES>` är tom. Annars körs de om |

### 2.3 Registrering

Skriv `o02/frozen-candidate.json` i indatamappen (`--inputs`, utanför Git):

```json
{ "candidate": "<M434>", "frozenAt": "<ISO>", "frozenBy": "<agent-id>",
  "ci": {"runId": 0, "event": "push", "conclusion": "success"},
  "container": {"runId": 0, "conclusion": "success"},
  "gitguardian": {"check": "success", "openIncidents": null},
  "openPrs": [{"number": 352, "draft": true, "runtime": false}],
  "vercel": {"project": "prj_7dgyvW5zakx1qJ8YaH5pueVTVi14", "deployment": "dpl_…", "sha": "<M434>"},
  "render": {"service": "srv-dbf61l0m7kps73ft7mk0", "deploy": "dep-…", "sha": "<M434>", "gate": "32/32"},
  "schema": {"studio": ["001:…"], "game": ["product-v1:…"], "sharedTables": 15},
  "sqliteAllowlist": ["…9 poster efter #434…"] }
```

Sätt sedan i `migrering/status.json[O02]`: `head` = `M434`, `branch` = `main`, och `pr` = O02:s dokument-PR, med O02-kvittot sanerat som `docs/2026-10-2x-O02-ACCEPTANCE.json`. Kör `node migrering/status.mjs` och `--check` (`croupier.yml:73`). **Frysregel:** dokument-merges (`scope=documentation`) är tillåtna. Varje runtime-merge ger en ny kandidat och kräver att F1–F8 görs om.

## 3. Protokoll för den oberoende granskningen

### 3.1 Vem räknas som oberoende

- **En färsk agent** (Opus, high/xhigh) som inte har producerat något av kvittona. Den startas med bara den här planen, kvittona och read-only-åtkomst.
- **Diskvalificerade:**
  - root/Claude-orkestratorn, som producerade `j08/`, `k04-k07/`, `k05/` och `k05-staging/` (`J08…json:16`)
  - Codex/Cloud-agenterna som producerade J10 och det isolerade kvittot (`ISOLATED…json:6`, `:902-906`)
  - agenten som kör K06/K07-proven.
- **Granskaren får inte** godkänna AV eller läppsynk, sätta flaggor, deploya eller skriva SQL. Ändringar i miljön görs av en *utförare* på Jakobs ja. Granskaren verifierar efteråt mot kvitto och live.
- **Tillskrivning:** varje bevis i O02-kvittot får `producedBy` (root, Cloud eller Kevin-rapporterat) och `verifiedBy` (granskarens ID). Kevin-rapporterade prov räknas aldrig som egen körning (`status.json:407`).

### 3.2 Read-only stickprov (samma stil som kvällens J08-granskning)

1. **Proveniens.** Räkna om sha256 på varje indatafil, och läs `docs/*.json` via `git show M434:…`. Jämför `codeSha` och deploy-ID i kvittona mot Render MCP `list_deploys` för `srv-dbf61l0m7kps73ft7mk0` och mot Vercel-API:t.
2. **Loggkorrelation.** Välj slumpvis 10 `rndrId` från `k04-k07/receipt.json#requests` och `j08/receipt-final.json`. Hitta dem i Render MCP `list_logs` (samma runtime-ID som kvittot anger, t.ex. `0d88262a…` för `dep-dbgdh7mi0phs7383mrrg`) och kontrollera status och tid.
3. **Publicerad config.** SELECT `shared_table_config_heads`/`configs` för rum 33b37ff3. Version ska vara `room-config-38b14261…` med kropp casual 1/500/50, sv, 20000/15000 (`J08…json:503-505`). Läs `operator_packages`: revision 7 för operatör A och 1 för B (`:978`).
4. **Ledgerparitet.** SELECT transaktionerna för K07:s P1/P2 med kvittots SQL (`k04-k07/finalize.mjs`). Räkna om SHA:n med samma kanonisering (`lib.mjs` `sha()`: sorterade nycklar, `amount` som Number, ordning `at, player_id`) och jämför med `7459106d84b8…` (`J08…json:874`). Avvikelse som följer av senare lagliga rader (t.ex. en ny hand) dokumenteras, och raden pekas ut.
5. **Medieidentitet.** SELECT registerposterna för de tio talen och de fyra deal-UUID:erna. sha256 och bytes ska vara lika med `J08…json:621-771` och `:534`. `reviewStatus` ska vara approved för talen och `unreviewed` för giv/hål/reveal (`:775`).
6. **Live, anonymt.** Kör `o02-receipt.mjs` (§4): 401, retirerade ytor, lobby A har rum 33b37ff3 på paket 7 och lobby B saknar rummet.
7. **Kod.** Kontrollera att kvittots konsumentpåstående stämmer på `M434`: `services/game/games/blackjack/table/postgres-store.mjs:283` och `coordinator.mjs:17,133,433` (`J08…json:968`). Kontrollera att `/api/table start` saknar config-referens.
8. **Schema.** SELECT migreringsledger och checksummor för staging. Jämför `croupier_staging` med restoremålet efter §3.3.
9. **Negativt omprov (K3b/K3f/K3g).** Utföraren kör det. Granskaren läser rålogg och JSON, och kör vid behov egna GET.
10. **Rapport.** Ange observerat resultat per kriterium (pass/fail/saknas/manuell), testmiljön (SHA, deploy-ID, Neon-scope, Blob-namnrymd `store_7E06N1P4w9Mu1dZD`, `ENVIRONMENT-RESTORATION.md:145`) och kvarvarande brister. Klassa varje fynd som blockerande eller icke-blockerande med motivering.

Valfritt R-läge, bara med Jakobs ja: granskaren gör **en** egen syntetisk spelarinloggning och verifierar medie-HEAD/GET-bytes själv. Inloggningen skriver en sessionsrad, så den är inte strikt read-only.

### 3.3 Det saknade beviset: autentiserad HTTP-spelreplay efter restore

**Mål.** Visa att en färsk backup av nuvarande staging, med 020, J08-config 38b14261, paket 7, godkända tal och K07-ledger, återställs fullständigt. En motor ska kunna starta mot kopian, och en autentiserad spelare ska kunna (a) få sina lagrade svar återspelade utan ny ekonomisk effekt och (b) spela vidare med exakt bokföring. Källdatabasen ska vara bevisat orörd.

**Godkännanden från Jakob före start:**

- (1) skrivarstopp på staging (suspendera Render och pausa Vercel)
- (2) restoremål, med variant A eller B nedan
- (3) byte av staging-miljövariabler mot restoremålet och tillbaka
- (4) lösenordsåterställning av en syntetisk spelare, bara i restoremålet.

**Restoremål.** Uppdraget anger att `croupier_staging_restore` ska återställas. Den databasen är befolkad med 10-25-dumpen (`ENVIRONMENT-RESTORATION.md:170`: "Kör inte om … blint"), och J10:s ledgerparitet pekar på den (`ISOLATED…json:113-125`). Därför finns två varianter:

- **A:** spara först J10-bevisen. Kör `cloudVerification`-SQL:en och schemaledgern mot nuvarande restore och spara resultatet. Dumpen från 10-25 med sha `9f2db199…` finns kvar privat (`ENVIRONMENT-RESTORATION.md:169`). Radera och återskapa sedan `croupier_staging_restore` via Neon API med ägare `croupier_staging_migrator`.
- **B (säkrast):** ny tom databas `croupier_staging_restore_o02` med samma ägare och grants. J10:s bevismål lämnas orört.

| Steg | Åtgärd | Grind och bevis |
| --- | --- | --- |
| R0 | Kandidaten `M434` kör på staging (F6). K04/K06/K07-kvittona är klara | `frozen-candidate.json` |
| R1 | Stoppa skrivare: suspendera Render `srv-dbf61l0m7kps73ft7mk0` och pausa staging-Vercel. Vercel Studio skriver Neon direkt, så båda måste stoppas (prejudikat `ENVIRONMENT-RESTORATION.md:165`) | `/__cloud/health` ej 200. Vercel 503 `DEPLOYMENT_PAUSED`. Tider registreras |
| R2 | Källsnapshot **S0**, read-only som `croupier_staging_app`: radantal för varje tabell i `croupier_game`, `croupier_studio` och `croupier_auth`, sekvensernas `last_value` och innehållshash per nyckeltabell (players, transactions, blackjack_tables, native_presentations, alla `shared_*`, operator_packages, studio-projekt/administration/videos, båda `storage_migrations`). Hasha med `to_jsonb(t)::text` och `ORDER BY` på primärnyckel med `COLLATE "C"`. Undvik `name`-typade UNION-etiketter, eftersom de trunkerar till 63 byte (`ENVIRONMENT-RESTORATION.md:175`) | `s0.json` med en total hash |
| R3 | `pg_dump --format=custom` av `croupier_staging` som `croupier_staging_migrator` med portabel PG18-klient (`ENVIRONMENT-RESTORATION.md:277`). Roller följer inte med i dumpen (`:556`) | Byte, sha256, `pg_restore --list`-antal och klientversion |
| R4 | Skapa målet (A eller B). `GRANT CONNECT` till `croupier_staging_app`, ingen PUBLIC | Neon API-svar |
| R5 | `pg_restore --single-transaction --exit-on-error --dbname <mål>` | exit 0, tid |
| R6 | Snapshot **S1** på målet med exakt samma SQL som R2. Kontrollera dessutom ägare och ACL (`ENVIRONMENT-RESTORATION.md:445`) | `S1 == S0`, per tabell och totalt. Studio-ledgern innehåller 020 |
| R7 | Starta motorn isolerat mot målet, som i J10:s 16/16-prejudikat (`ENVIRONMENT-RESTORATION.md:18`: "Båda providerinställningarna är tillbaka på croupier_staging"). Sätt staging-Renders `CROUPIER_GAME_DATABASE_URL` och staging-Vercels databas-URL för Studio till målet med approllen. Deploya samma `M434` med låst commit. Ingen skrivare pekar på källan | `/__cloud/version` = `M434`. 32/32-grind. Read-only `SELECT current_database()` via appens readiness, eller Render-logg som visar målets databas |
| R8a | **Admin-replay (läsning):** logga in med staging-admin. Läs `room-game-config` för 33b37ff3 (38b14261, paket 7), `resource-lifecycle`, lobby A och B, och `/studio/api/admin/transactions` | Lika med S0. HTTP-ledgerns hash = SQL-hash på målet |
| R8b | **Autentiserad replay av lagrade kommandon:** K07-spelaren P1 (syntetisk; UUID i råkvittot) har bara haft lösenordet i minnet. Därför: `POST /studio/api/admin/players/password` (`apps/studio/lib/studio-admin-accounts.mjs:100-133`) **mot målet**, sedan login som P1. Skicka om P1:s ursprungliga `stand` och `collect` med samma `requestId` från `k04-k07/receipt.json` (K07-e1r, `J08…json:799-803`) | 200 med lagrad version och saldo (v4, v5/1012.5). **0 nya ledgerrader**. Ändrad input med samma id ger 400 (K07-e0) |
| R8c | **Ny hand på återställt tillstånd:** samma P1 i rum 33b37ff3, paket 7: start, act, collect. `presentation/select` för speak/deal | Exakt UUID och SHA ur paket 7. Ledgerdelta = −insats och +retur, inget mer |
| R8d | Replay av R8c:s `requestId` | Identiska svar och 0 nya rader |
| R8e | **Ledgerhashar:** `L1` = SQL-hash av transactions på målet efter R8d. Förväntat `L1 = hash(S1.transactions + exakt raderna från R8c)`. HTTP Admin transactions-SHA = SQL-SHA på målet | `ledger.httpEqualsSql=true`. Delta listat rad för rad |
| R9 | Byt tillbaka till `croupier_staging` och redeploya `M434`. Kör 32/32-grind. Snapshot **S0′** av källan | `S0′ == S0`, så källan är orörd. Suspendera sedan enligt Jakob |
| R10 | Kvitto `o02/restore-replay/receipt.json` med fälten `candidate`, `dump{bytes,sha256,pgVersion}`, `parity{equal,tables,sha}`, `replay{summary,storedResponsesIdentical,newLedgerRowsForReplays}`, `ledger{httpEqualsSql,…}`, `sourceUntouched{equal}` (de fält `o02-receipt.mjs` läser) | Inga hemligheter. Dumpen ligger privat |

**Bevisgränser som anges i kvittot:**

- Neon-PITR och global rollrestore ingår inte (`ENVIRONMENT-RESTORATION.md:586`).
- Lösenordsåterställningen i R8b är en avsiktlig skrivning, bara i målet.
- Blob-bytes återställs inte, eftersom de är oföränderliga. Hash och HEAD visar att de nås.

### 3.4 Jakobs ögon (manuell acceptans med skärmbilder)

Jakob ger varje punkt ett omdöme i `o02/jakob-eyes/manifest.json`: `{id, verdict: approved|rejected, by:"Jakob", at, candidate:"<M434>", screenshots:[{file, sha256}]}`. Skärmbilderna sparas privat i `o02/jakob-eyes/`. Viewport: desktop 1440×900, mobil 390×844 och 320×568, och fysisk iPhone Safari där det anges.

| ID | Vad Jakob bedömer | Skärmbilder och inspelningar att ta |
| --- | --- | --- |
| V1 | Kortkontakt i PAOW:s giv till varje ruta, hålkort och reveal. I dag `unreviewed`/`lab-only` (`J08…json:775`) | `v1-deal-box{1..n}-{desktop,390}.png` i kontaktögonblicket, `v1-hole-*.png`, `v1-reveal-*.png`. Kort skärminspelning `v1-hand.mp4`. Därefter sätts review-status i Admin, som är K06:s krav |
| V2 | Tal och läppsynk för alla tio repliker. Sex har aldrig utlösts: insurance, blackjack, dealerblackjack, double, win, push | `v2-<line>.mp4` (5–10 s per replik) och en stillbild mitt i repliken. Spela tills varje replik har utlösts och logga media-UUID per klipp |
| V3 | Mobil och desktop: lobby, idle, insats, beslutsknappar, avräkning, reload mitt i en hand. Fysisk Safari (`MASTERPLAN.md:108`) | `v3-{lobby,idle,bet,decision,settle,reload}-{1440,390,320,iphone}.png` |
| V4 | Trelagerslayout (bakgrund/dealer/bord) och fält 5 (bord, bakgrund, färg), som inte provats (`J08…json:506`). I staging är lagren syntetiska. Johns Bet hör till O03 | `v4-admin-room-fields.png`, `v4-game-layers-{desktop,390}.png` |
| V5 | Två följande spel i samma rum utan reload, och idle eller återgång till talpose mellan dem (`MASTERPLAN.md:107`, `:114`) | `v5-hand1-settle.png`, `v5-idle.png`, `v5-hand2-deal.png` och `v5-sequence.mp4` |
| V6 | Aktiv hand behåller material vid publicering (C0→C1, K06) | `v6-before-publish.png`, `v6-after-publish-same-hand.png` och `v6-next-hand-new.png` |
| V7 | Avbruten presentation (K3f): inget dubbeldrag och handen fortsätter | `v7-offline.png`, `v7-recovered.png` och utdrag ur saldot |

## 4. Skript: `o02-receipt.mjs` (körklart skelett, read-only)

Fil: [tools/o02-receipt.mjs](../../tools/o02-receipt.mjs).

**Säkerhet.**
- Allowlist med bara staging-värdarna. Produktionen nekas.
- Bara GET och HEAD.
- Neon körs i `BEGIN READ ONLY` och avslutas med `ROLLBACK`.
- Ingen inloggning, och inga hemligheter skrivs ut.
- `mutations` är alltid 0 i kvittot.

**Indata.**
- `git show <candidate>:docs/2026-10-27-*.json` och `migrering/status.json`.
- Råkvitton i indatamappen (utanför Git): `j08/receipt-final.json`, `k04-k07/receipt.json`, `k05/…` och `k05-staging/…`. De sanerade sammanfattningarna står i `docs/2026-10-27-*-ACCEPTANCE.json`.
- Kontraktsnamn för kommande kvitton: `k06/receipt.json`, `k07-shared/receipt.json`, `o02/restore-replay/receipt.json`, `o02/jakob-eyes/manifest.json` och `o02/frozen-candidate.json`.

**Kriterier i skriptet.**
- Automatiska: F1, E1, N1, R1, C1, D1, B1, M1, S1, Q1 och I1.
- Manuella: V1–V6. Dessa får `pass` bara via Jakobs manifest, med `by:"Jakob"` och samma kandidat.

**Körning:**
```
node tools/o02-receipt.mjs --candidate <M434> --inputs <indatamapp> --github --neon --neon-url-file <fil> --reviewer <agent-id> --out <indatamapp>/o02/o02-receipt.json
```
`--neon-url-file` pekar på en lokal fil med anslutningssträngen för `croupier_staging_app` (skrivs aldrig ut); `--reviewer` är granskarens agent-ID. `--repo` är som standard repots rot.

**Dry-run i kväll** mot `e7a4e251`, `--github` utan Neon (`dryrun-e7a4e251.json`): fail=2, missing=8, pass=1, manual=6. Det är väntat.
- F1 fail: #434 är en öppen runtime-PR och containerkörning saknas.
- M1 fail: sex repliker är inte utlösta.
- Q1 pass: main-CI är grön.

Skriptet skrev inget mer än kvittofilen.

**Kvar att fylla i när kvittona finns** (markerat i koden): K06-kvittots check-ID:n (`wrong-role`, `bad-media-id`, `interrupted-presentation`, `twoConsecutiveGames`, `speak[]`) och K07-shared `checks[]` med `candidate`. Utförarna ska använda de namnen.

## 5. O03-checklista (följer direkt efter O02)

Källa: `MASTERPLAN.md:523-533`, `status.json:661-665` och `ENVIRONMENT-RESTORATION.md:183-213`. O03 ger inget nytt produktionsmandat. Varje åtgärd i produktionen kräver Jakobs ja (`MASTERPLAN.md:138`).

1. **Färsk kontroll:** main-SHA, PR-ägare, källrepo, full head, konflikter, obligatorisk CI och GitGuardian med öppna och ignorerade incidenter (senaste läsningen 0/23 och `too_large`, `status.json:661`). Kevins #315 och #323 kräver Jakobs uttryckliga beslut per PR och head. De mergas inte automatiskt (`MASTERPLAN.md:528`).
2. **Schema i godkänd ordning:**
   - **008–010 finns redan i produktionen** (verifierat i §0). Kvitto saknas i repo. Krävs: vem som godkände och körde, tid, verktygsutdata och manifesthash från `tools/prepare-shared-schema.mjs`. Game-ledgern registrerar inte 008–010 (bara `product-v1` och `sqlite-import-v1`). Readiness bygger på katalogkontrollen i `postgres-store.mjs:244`. Det ska stå uttryckligen.
   - **Studio 020 saknas i produktionen.** Den är `deploymentOptional` (`ops/neon-studio/migrations.mjs:64`). Om Johns Bet-paketet med tal och filmplanering kräver utökat kuvert ger publicering 503 `studio_extended_presentation_storage_unavailable` (`packages/presentation/server/presentation-storage.mjs:48-62`). Avgör före K05:s ompublicering. Applicera i så fall med `node tools/check-migration-readiness.mjs --apply` och uttryckligt mandat (`docs/CLOUD-MIGRATION.md:241-252`).
   - **Game 011 (Lissabon)** är förberedd men inte körd (`status.json:509-526`). Beslut: behåll eller kör.
3. **Deploya den frysta kandidaten:**
   - Render `croupier-v3` (`srv-dbd6nfon74is73aiblf0`) kör i dag `341a8344`. Registrera aktuellt deploy-ID som rollbackmål. Deploya `M434` med låst commit, och kontrollera att `/__cloud/version` = `M434` och health `ok`.
   - Vercel-produktion (`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`): deployment från `M434`. Registrera föregående `dpl_…`.
   - Kontrollera capability v31 via Admin-readiness (`apps/studio/lib/presentation-runtime-readiness.mjs:275`).
4. **Säkerhets- och runtimekvitto:**
   - Render-env, bara namn, mot `ops/cloud/RENDER-V3.md:55-117`: krävda finns, förbjudna saknas och inga bootstrap-admin-variabler.
   - Värdet för `CROUPIER_SHARED_TABLE_ENABLED` i produktionen (beslut).
   - Ingresshemligheten fungerar (Vercel → Render 200).
   - `node tools/check-environment-variables.mjs`.
   - Blob är privat. Direkt Render-media ger 421 (`CLOUD-MIGRATION.md:162`).
   - Retirerade ytor på www ger samma koder som §0.
5. **Johns Bet live efter K05:**
   - Jakob har godkänt en tagning per replik i produktionen och kopplat talfacken (`NEXT-AGENT.md:46-50`).
   - Paketet och rummets spelinställningar är ompublicerade. Registrera configVersion och paketrevision.
   - Kontrollera `/game` 200 med rätt rum och paket, och att media-UUID och SHA är lika med registret.
   - En hand med dedikerat syntetiskt demokonto får bara spelas med Jakobs uttryckliga mandat: "Kör inte spelprov mot produktionsdata" (`MASTERPLAN.md:22`). Annars gäller bara läsning plus Jakobs egen spelade hand (V1–V5 i produktionen).
6. **Restorebevis i produktionen via Neon-gren:**
   - Kräver Jakobs ja, eftersom det skapar en resurs.
   - Skapa en gren från `br-flat-fog-b161a6r8` på den tid som registrerades efter deployen.
   - Kör samma R2-snapshot-SQL read-only på gren och förälder vid samma tidpunkt (schemaledger med checksummor, de 15 shared-tabellerna, Johns Bet-config-huvud, ledger-hash och saldoinvariant).
   - Kör gärna app-läsare som 10-25 (`ENVIRONMENT-RESTORATION.md:172`).
   - Radera grenen efteråt och registrera grenens ID, LSN och tider.
   - Dokumentera att restore fungerar med det faktiskt migrerade schemat (`MASTERPLAN.md:531`).
7. **Rollbackplan (skriven före deploy):**
   - Render: deploya föregående deploy-ID. Kompatibiliteten är bevisad: 008–010 är additiva och sparad rotation och sparade format kan läsas (`RENDER-V3.md:130`).
   - Vercel: instant rollback till föregående `dpl_…`.
   - Schemat rullas aldrig ned (`ENVIRONMENT-RESTORATION.md:504-505`).
   - `CROUPIER_SHARED_TABLE_ENABLED=0` är avstängningsknapp.
   - Johns Bet: återpublicera föregående configVersion via Admin, aldrig SQL.
   - AV-beslut kan ändras i Admin.
8. **SQLite-slutet:**
   - PR-7a/7b/7c mergade och Director/Gateway redeployade.
   - Arkivposterna flyttade med K01.
   - `tools/no-sqlite-allowlist.json` = `[]`.
   - Dokumentera produktionsledgerns `sqlite-import-v1` som historisk rad.
9. **Avslut:**
   - Uppdatera `docs/NEXT-AGENT.md`, `docs/JOHN-HANDOFF.md` och `ENVIRONMENT-RESTORATION.md`.
   - Stäng egna claims, städa och suspendera staging enligt Jakob ("clean slate efter K05", `NEXT-AGENT.md:55`).
   - Sätt `status.json[O02]` och `[O03]` till VERIFIED med head, PR, reviewer och kvitto. Kör `node migrering/status.mjs` och `--check`. Då blir det **100 % = 20/20**.
   - Ingen förhandsmarkering (`MASTERPLAN.md:533`).

## 6. Motsägelser mellan dokument och nuvarande kod/infra (till revisionen)

| # | Dokumentet säger | Faktiskt läge | Åtgärd |
| --- | --- | --- | --- |
| C1 | 008→009→010 "inte godkänd för körning … samtliga objekt för 008/009/010 saknades" (`docs/ENVIRONMENT-RESTORATION.md:456-470`). "Game008/009/010 saknas i daterat verifierad Neonproduktion" (`docs/JOHN-HANDOFF.md:1589`). "Schema008… och009… är enbart levererade, inte applicerade i produktion" (`migrering/status.json:376`). `MASTERPLAN.md:219` kräver återläsning | Produktionen har alla 15 shared-tabeller och tre kolumner (SELECT 2026-10-27, §0). Applicerades i kväll enligt orkestratorn. Orkestratorns lokala `apply-shared-schema.mjs` finns, men inget utdata eller kvitto | Lägg till kvitto och ändra texterna. Notera att game-ledgern inte registrerar 008–010 |
| C2 | "SQLite lämnar main helt" (`MASTERPLAN.md:11`) | Produktionens `croupier_game.storage_migrations` innehåller `sqlite-import-v1`. Main har 16 allowlistposter, #434 sänker till 9 | Märk raden som historisk. O03 stänger allowlisten |
| C3 | Optional 020 "redan installerad i isolerade croupier_staging … Annan driftsmiljö kräver separat godkänd schemamigrering" (`MASTERPLAN.md:36`) | Stämmer: produktionen saknar 020. J08-kedjan i staging kördes *med* 020. Johns Bet-publiceringen i produktionen kan stoppas av 503 (§5.2) | Inget fel i texten, men en risk för K05/K06 som inte syns i handoffens nästa steg (`NEXT-AGENT.md:46-50`) |
| C4 | "Steg 2 (PGlite som dev-beroende …) kräver Jakobs beslut; tills motorn är Postgres-only får ingen förlita sig på det lokala SQLite-läget" (`MASTERPLAN.md:11`) | Steg 2 och 3a är mergade i #432 (`4838537d`). Containern kontrollerar att PGlite saknas i imagen (`product-container-check.yml:56`) | Uppdatera |
| C5 | "#437 är öppen … och #434 är ett utkast" och "steg 3c och 7 återstår" (`docs/NEXT-AGENT.md:42`, `:54`) | #437 mergad (`f1fef7c9`), 3c mergad (#439). #434 är inte utkast. Kvar: #434 (steg 6) och 7a/7b/7c, 8, 9 | Uppdatera |
| C6 | Färsk kontroll 25 oktober: v3 på `ebb6b91f…` (`ops/cloud/RENDER-V3.md:5`). K05-runbooken: produktionen kör `15aa3192` (`J08…json:907`) | Produktionen kör `341a8344` (#438), alltså nyare än staging (`b08f2a86`) och utan O02-granskning | O03 tar produktionen till `M434`. Ändra RENDER-V3 |
| C7 | "45 % är 9/20" (`docs/CLOUD-MIGRATION.md:10`). Toppavsnittet "65 % = 13/20" (`docs/ENVIRONMENT-RESTORATION.md:5`) | `status.json` säger 70 % = 14/20 (`MASTERPLAN.md:5`, `NEXT-AGENT.md:5`) | Uppdatera eller datera |
| C8 | O02-blocker: "autentiserad HTTP-spelreplay efter restore … är inte verifierade" (`status.json:644`). "Ingen ny HTTP-applikation kopplades till restoredatabasen" (`ENVIRONMENT-RESTORATION.md:173`) | d53-kvittot har 16/16 HTTP-restore med login, läsning och replay mot 10-25-dumpen (`ISOLATED…json:35-50`, `ENVIRONMENT-RESTORATION.md:18`, `JOHN-HANDOFF.md:57`) | Formulera om blockern: replay mot *aktuell* data och schema med 020 och J08 saknas (§3.3). Datera rad 173 |
| C9 | Reproduktionssteget använder `node apps/studio/start.mjs --offline …` (`ISOLATED…json:754`, `:841-867`) | `--offline` pensionerad i #431 (`AGENTS.md:63`, `CLOUD-MIGRATION.md:48-49`) | Märk som historiskt för `d53`. Inte reproducerbart på main |
| C10 | "`sqlite` är kompatibilitetsstandard" (`docs/ENVIRONMENT-VARIABLES.md:834`) | Sant på `e7a4e251` (`services/game/server.mjs` står på allowlisten för PR-6). Blir falskt med #434, som också ändrar filen | Kontrollera i #434:s diff att raden rättas |
| C11 | CI-jobbet "Render v3 container check" beskrivs som del av verifieringen (`ops/cloud/RENDER-V3.md:150-152`) | Det ligger i ett separat workflow som bara triggas av PR med sökvägsfilter eller dispatch (`product-container-check.yml:3-14`). Push till main kör det inte | Frysningen kräver dispatch (F3). Förtydliga dokumentet |
| C12 | Staging-flaggan beskrivs som `CROUPIER_SHARED_TABLE_ENABLED=0` (`ENVIRONMENT-RESTORATION.md:159`, 10-25) och som "inte satt" (`J08…json:971`) | Båda betyder av. `/__cloud/shared-room-health` ger 421 externt, så HTTP kan inte avgöra det | Läs env-namnet och värdet i Render (värdet är ingen hemlighet) |
| C13 | "Produktionsledger 001–008, 011, 012" (`CLOUD-MIGRATION.md:141`, historiskt). "001–008 och 011–014" (`JOHN-HANDOFF.md:3057`) | Studio i produktionen: 001–008, 011–019 | Daterat. Inget fel men förvirrande. Hänvisa till O03-kvittot |
| C14 | Staging "LIVE på b08f2a86 … Jakob avgör suspension" (`NEXT-AGENT.md:56`) | Fortfarande LIVE vid ca 18:15 UTC | Inget fel. Kostnad och exponering, så påminn Jakob |
| C15 | K04-fyndet: operatör B:s kontext ger 409 i stället för 404 (`J08…json:774`) | Produktbeteende, inte dokumentfel | Klassas i O02 (K3c) |
