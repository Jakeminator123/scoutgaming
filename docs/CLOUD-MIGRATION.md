# Drift och leverans

Var produkten kör, hur en ändring når produktionen och hur man kontrollerar den. Identiteter och publiceringsordning står i [START-HERE](../START-HERE.md), migreringens status bara i [migrering/STATUS.md](../migrering/STATUS.md) och överlämningen i [NEXT-AGENT](NEXT-AGENT.md).

## Ytor och datalagring

| Ansvar | Kod | Drift |
| --- | --- | --- |
| Admin, partnerportal, lobby | `apps/studio` (basePath `/studio`; publika vägar `/admin`, `/partner`, `/lobby`) | Vercel, projekt `scoutgaming`, tjänsten `studio` |
| Startsida och spelskal `/game`, `/play/{game}` | `apps/web` | Vercel, tjänsten `web` |
| Talingress | `apps/speech` | Vercel, tjänsten `speech` |
| Spelmotorn: kort, sko, saldo, avräkning, delat bord | `services/game` bakom gatewayn i `ops/cloud` | Render `croupier-v3`, se [RENDER-V3](../ops/cloud/RENDER-V3.md) |
| Talkedjan (Director och Gateway) | `packages/director`, `services/openclaw/lab` | Render `croupier-lab-director` och `croupier-lab-openclaw`, med diskar `/data/catalog` och `/data/openclaw` |
| Produktregister: konton, spel, dealers, bolag, rum, mallar, paket, spelinställningar, mediekatalog, talrepliker | SQL i `ops/neon-game` och `ops/neon-studio` | Neon `croupier-production`, databas `croupier_game` |
| Mediebytes | Sökvägar och regler i [BLOB-NEON](storage/BLOB-NEON.md) | Privat Vercel Blob `croupier-media-private` |
| Preview (tidigare staging) | Samma kod som produktionen mellan prov, låst SHA från `main` eller `jakob/*` | Egna resurser i Vercel, Render, Neon och Blob, se [START-HERE](../START-HERE.md#preview) |

Det finns en väg: inga lokala produktregister, ingen SQLite, inga parallella QA-ytor. `node apps/studio/start.mjs --no-open` skriver bara den publicerade lobbyns adress. `/control` och `/lab` svarar med redirect till `/admin`. Variablerna per tjänst står i [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).

> **Var `/admin` läser.** Bara Neon, schemat `croupier_studio` (dokumenten `project` och `administration`, bolagen, paketen och `media_records`), valt av `CROUPIER_GAME_DATABASE_URL` och scopet `CROUPIER_STUDIO_ENVIRONMENT_ID`/`CROUPIER_STUDIO_WORKSPACE_ID`. Det finns ingen reserv till fil, JSON, SQLite, PGlite eller seed: fel eller saknad databas ger 503 ([ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md#vercel-scoutgaming-web-studio-och-speech)). Gammalt innehåll som syns i Admin är rader i Neon, inte kod. Själva sidan är en esbuild-SPA, inte Next-sidor: `apps/studio/client/build.mjs` bygger `apps/studio/design-preview-build/` med hela Admin-SPA:n, den interna lobbyn och den publika lobbyn, som `app/admin/[[...path]]` och `app/lobby/[[...path]]` serverar. `apps/studio/preview-build/` innehåller bara kompositorn (`compositor.js` och `geometry.js`, kopierade av `apps/studio/tools/prepare-preview.mjs`) under `/preview`. Schemana, tabellerna och vem som skriver vad står i [BLOB-NEON](storage/BLOB-NEON.md#scheman-och-skrivare).

## Från merge till produktion

1. **Schema först.** Kod som kräver ny SQL mergas inte förrän Jakob har applicerat migreringen (`node tools/check-migration-readiness.mjs --apply` med `CROUPIER_MIGRATION_CONFIRM=apply-pending`). CI läser produktionens migreringsledger. En `deploymentOptional`-version kräver tolerant kod först, sedan godkänd migrering och sist en PR som gör versionen obligatorisk. Ändra aldrig ett redan applicerat schemas checksumma för att få grön CI.
   `--apply` skriver först `migration_apply_plan <versioner>` och kör exakt den listan. En enskild version: `--apply --only 021` (upprepningsbar eller kommaseparerad). Varje tidigare väntande version måste också anges eller hoppas över med `--skip <version>`; obligatoriska versioner och versioner som delar tabell med en senare vald (019 efter 018) kan inte hoppas över. Vägran namnger versionen, till exempel `migration_check_selection_order 016,018`. Bara de överhoppade och de senare valfria versionerna hålls tillbaka. Blir något annat väntande efter planeringen vägrar körningen under låset (`studio_migration_selection_mismatch`). `--only` utan `--apply` visar bara urvalet.
2. **Merge efter grön CI.** Den obligatoriska kontrollen heter `CI` och gäller PR:ens head; branchen behöver inte vara à jour med `main` (Jakob 28 oktober, rulesetet kräver inte strikt kontroll). Vercel deployar `main` automatiskt.
3. **Spelmotorn deployas manuellt** efter varje grön merge: Render MCP `trigger_deploy` för `srv-dbd6nfon74is73aiblf0` eller panelen. Director och Gateway deployas om när `packages/director` eller `services/openclaw/lab` ändras.
4. **Admin-publicering sist:** paket och rummets spelinställningar publiceras när koden är live.

## Kontrollera en deploy

```sh
curl -s https://croupier-v3.onrender.com/__cloud/health    # ok
curl -s https://croupier-v3.onrender.com/__cloud/version   # {schemaVersion:1, provider:"render", commitSha}
```

- Jämför `commitSha` med `main` och med Vercels deploy. Grön CI eller "live" i Render är inget kvitto på att rätt kod kör.
- Kör det ändrade flödet: Admin → spara → publicera → lobby → `/game?game=blackjack` → spelad hand → omladdning. Riktig acceptans görs i preview med syntetiska konton och Jakobs speglade inloggningar, när orkestratorn bedömer att det behövs.
- Efter varje env-ändring på Render: läs `/__cloud/health` igen, eftersom Render MCP startar en deploy direkt.
- Kvitton skrivs sanerade som `docs/<datum>-<aktivitet>-…-ACCEPTANCE.json` med versions-, deploy- och databasidentiteter.

Återgång och backup står i [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).

## Teknisk register-/runtimeflytt: avslutad i produktion

Neon som produktregister och privat Blob som mediekälla är införda och driftsatta sedan 16–18 oktober 2026 (migrering 012 och framåt). Flytten återöppnas inte utan ett konkret runtimefel.

## Separat produktarbete och öppna driftansvar

Inventering från oktober 2026, utanför masterplanen. Kontrollera mot koden innan arbete börjar; Jakob beslutar omfattningen.

| Område | Öppet |
| --- | --- |
| Admin-förenkling | `/admin` ska bli enkel (en publiceringsknapp per rum). Underlag i [NEXT-AGENT](NEXT-AGENT.md#separata-spår-efter-migreringen) |
| Bolagsdata | Spelare, transaktioner och rapporter ur motorns ledger, bolagsbunden identitet, valuta och exportisolering. Ingen andra plånbok i Admin |
| Konto och integration | Lösenordsåterställning för bolag, riktig 2FA, API-nycklar med rotation, wallet- och webhookprov |
| Inbjudan och återställning | Resend mot sandbox är verifierad; en riktig mottagares hela kedja saknar kvitto |
| Tal och läppsynk | Rörligt tal är av. Automatisk lagring av resultat, riktig mikrofon och bild hela vägen samt kostnadsavstämning återstår; bara Jakob godkänner AV |
| Backup | Extern fullbackup av Director- och Gateway-diskarna saknas |
| Radering | Permanent klippradering med beroendespärr; äldre bankindexreferenser behöver konsumentkontroll |
