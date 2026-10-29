# Klipp, Neon och Blob

Hur dealerklipp och övrigt material lagras, importeras och raderas. Produktbegreppen (dealer, bolag, rum, mall, paket, spelinställningar, klippkartan) står i [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md), uppspelningskontrakten i [LOCAL-PRESENTATION-RUNTIME](../LOCAL-PRESENTATION-RUNTIME.md) och läget i [NEXT-AGENT](../NEXT-AGENT.md).

## Lagringsgränsen

**Neon är produktregistret; privat Blob lagrar mediebytes.** Neon-flytten är avslutad och återöppnas inte utan ett konkret runtimefel.

| Neon (`croupier_studio`) | Innehåll |
| --- | --- |
| `media_records` och projektets bindningar | Varje tillgångs identitet, hash, storlek, dealer, funktion och granskningsstatus |
| `runtime_media_catalogs` | Scoped layout, Blob-index och presentationsmanifest, revisions- och hashbundna |
| `speech_reply_records` | Talrepliker: text, språk, tagning och exakta ljud-, video- och indexhashar |
| Frysta paket och spelinställningar | Det spelet läser; ändras aldrig efter publicering |
| `operator_materials`, `operator_material_policies`, `operator_ai_attempts` (migrering 021, valfri) | Bolagets eget material: en journal per bakgrund eller bordsgrafik (väntar, godkänt, avslaget, återkallat; ett nytt läge är en ny rad) med exakt lagerfil och, för bordsgrafik, dealerns landningsmall; bolagets AI-dagstak (standard 0 = av) och spärr; AI-försök per bolag och UTC-dygn |

Bolagets eget material hamnar bara i bolagets eget frysta paket, aldrig i någon annans. Publicerare som bygger om presentationen sammanfogar, övriga bevarar. Sammanfogar gör Admins paketpublicering, publicering av scenlayout och viloklipp, nytt spelbord och bolagets brandingpublicering, via `packages/presentation/server/operator-material-merge.mjs` och `apps/studio/lib/operator-material-publication.mjs`. Godkända bakgrunder hamnar på mallar som låser upp en bildbakgrund och har ett av bolagets spelbord. Bordsgrafik hamnar bara på sin egen mall, och bara när landningsmallen fortfarande stämmer med mallens dealer och placering. Bevarar gör rummets livscykel, materialpapperskorgen, dealerarkivet och rummets spelinställningar: de skriver om det frysta paketet som det är, så återkallat material försvinner först vid nästa sammanfogande publicering, och därför måste ett återkallande publicera om direkt. Ett materialid tillhör ett enda bolag per workspace och kan aldrig vara ett av Admins egna. Utan 021 läses inget material, skrivningar ger `operator_materials_unavailable` och varje publicering är exakt som förut. 021 körs först efter Jakobs uttryckliga "ja 021".

Repo-JSON (`media/layout.json`, `media/blob-index.json`, importfiler) och äldre Blob-JSON är authoring- och importunderlag, aldrig runtime-reserv. Saknad eller felaktig katalog ger 503, inte en lokal fallback.

## Scheman och skrivare

Neon-projektet heter `croupier-production` (`wandering-hill-60561912`) och databasen i det `croupier_game`; någon databas `croupier_production` finns inte. All produktdata ligger i den databasen, uppdelad i scheman. Läst 2026-10-29, 74 tabeller:

| Schema | Tabeller | Innehåll | Skrivs av |
| --- | --- | --- | --- |
| `public` | 0 | tomt | – |
| `croupier_auth` | 7 | personal (`users`), tokens, `meta`, auth-epoker, sessioner (`lab_sessions`), partnernycklar (`api_keys`, med `operator_id NOT NULL` sedan `game-012`), BO-resten `bo_lab_handoffs` | Studio och motorn (`users`, `meta`); Studio skapar nycklarna och motorn autentiserar dem |
| `croupier_game` | 39 och 2 vyer från `pg_stat_statements` | spelare, saldo och transaktioner, spelarinloggning, delat bord (008–010), roulette, Partner-API:ts spelare och rundor, chattminne och probe | motorn, utom rummets spelinställningar (`shared_table_configs`, `shared_table_config_heads`; `packages/presentation/server/room-game-publication.mjs`) och spelaradministrationen (`packages/storage/server/player-administration.mjs`), som Studio skriver |
| `croupier_studio` | 28 (31 med den valfria 021) | dokumentregistret (`documents`, `document_history`, `audit_events`, `media_records`), bolag och paket (`operator_*`), runtimekatalog och talrepliker, Forge | Studio, utom tal- och GPU-tabellerna (`speech_*`, `gpu_*`, `fullfile_*`, `operator_qa_*`, `moving_*`), som motorn skriver |

Schemat följer alltså inte skrivaren. Båda tjänsterna ansluter med rollen `croupier_game`, som äger allt utom `moving_drift_control`.

Det finns två migreringsledgrar med krockande nummer: `ops/neon-game/011` och `012` är inte samma sak som `ops/neon-studio/011` och `012`. Ange alltid ledgern (`game-012`, Studio 012).

- **Studio**, `croupier_studio.storage_migrations`: registret är listan i `ops/neon-studio/migrations.mjs`, och `tools/check-migration-readiness.mjs` (som CI kör) läser den. Produktionen har 001–008 och 011–020; 021 och 022 är valfria och inte körda. 022 vidgar bara bolagsjournalens action-CHECK (`operator_audit_events`, 006) med partnerns egna åtgärder (spelbordens läge, spelinställningsutkast och begäran om material eller nyckelrotation); utan den svarar de partnervägarna 503 `studio_migration_required` och skriver ingenting. 022 körs först efter Jakobs uttryckliga "ja 022". 023 lägger bara till kolumnen `operator_packages.rooms` (text, NULL eller 2–20000 tecken): paketets egna spelbord som kanonisk JSON, skriven av `publishWithin` ur administrationsdokumentets `rooms[]` i dokumentets ordning (plan L3). Utan 023 skrivs paketen som förut och läsarna använder dokumentet; äldre paket behåller `rooms` NULL. 023 körs först när L3 PR 3 är ute i samma miljö, preview före produktion.
- **Spel**, `croupier_game.storage_migrations`: motorn och Studio kontrollerar bara `product-v1`:s checksumma mot `ops/neon-game/product-schema.sql` vid start (`packages/storage/server/postgres-store.mjs:159`). Senare spelversioner är granskade engångstransaktioner som `tools/prepare-*.mjs` renderar och som själva skriver sin ledgerrad. Produktionen har `product-v1`, `sqlite-import-v1`, `game-011-retire-lissabon` (2026-10-28) och `game-012-api-key-operator` (2026-10-29 01:46Z). 008–010 (delat bord) applicerades utan ledgerrad, och readiness läser inte den här ledgern.

Preview avviker: Studio saknar 016, 018 och 019, och spel-ledgern har `product-v1` och `game-012` men inte 011 ([ENVIRONMENT-RESTORATION](../ENVIRONMENT-RESTORATION.md#migrerat-schema-i-produktionen)).

## Sökvägar i Blob

```text
croupier/media/dealers/<dealer-id>/
  source/<ursprung>/<objekt-id>/<sha256>.<format>
  review/uploads/<media-id>/<sha256>.<format>
  runtime/<bank-eller-format>/<objekt-id>/<sha256>.<format>
  staging/<arbetssteg>/<objekt-id>/<sha256>.<format>
croupier/media/backgrounds/<lager-id>/<sha256>.<format>
croupier/media/tables/<lager-id>/<sha256>.<format>
```

- `source` bevarar original; `runtime` håller härledda spel- och talbanker (till exempel `runtime/moving-bank`).
- `review/uploads` är en lagringsväg, inte en granskningsstatus.
- Val eller publicering flyttar inga filer och skapar inga kopior. Nya undermappar används först när sökvägsvalideringen stödjer dem.
- Privata klipp levereras bara via behöriga API-vägar (GET, HEAD, Range) som kontrollerar familj, roll, fil-ID, hash, storlek och sökväg. Publika tillgångar kräver public-allowlist.

## Identitet och hash

- Likadan SHA-256 betyder likadana bytes, inte samma ägare, språk, kalibrering eller publiceringsidentitet. Slå inte ihop olika ägares poster.
- Behåll en fungerande identitet när både innehåll och användning matchar; importera bara det som saknas.
- Ändrad film- eller ljudhash ger en ny tillgång och ogiltigförklarar tidigare audiovisuellt godkännande för tagningen.
- Ett Git-blob-ID är inte filens SHA-256, och en Git-commit är ingen backup av molnmedia.

## Klippkartans fack

| Fack | Innehåll |
| --- | --- |
| Vila (idle) | Grundloop och beteendeklipp (blick, nick, andning) som återgår till vila |
| Till skon / redo | VILA → REDO; ett kroppstillstånd, ingen extra spelplats |
| Utdelning | Box 1–7 (internt `box0`–`box6`; `pos4` är box 4 = `box3`) samt dealerns öppna och dolda kort |
| Från skon | REDO → VILA |
| Vända dolt kort | Egen handling och kalibrering |
| Talade repliker | Allt där dealern talar: exakt text, språk, repliknyckel och en eller flera tagningar |
| Dynamiskt tal | Genererat ljud och läppsynk på en vald bank; resultaten är egna artefakter, inte original |

Varje klipp har tre egenskaper som sparas för sig: **funktion** (vila, övergång, utdelning, vändning, beteende, tal), **rörelse** (start- och slutpose, kalibrering) och **val** (standard, variant, händelse- eller tidsstyrd, OpenClaw). Standardvalet hör till sparade bindningar, inte till filnamnet. Kort och utbetalningar ägs av spelmotorn.

Poser i Kevins material: grundutdelningen är REDO → REDO; `-i` börjar i VILA, `-u` slutar i VILA, `-iu` gör båda, `-v`/`-iv` är filmade avslut till VILA. `planFilmedDealSequence` (`packages/presentation/runtime/filmed-deal-sequence.mjs`) väljer en sammanhängande posekedja; spela aldrig ett fristående inträde och samma inträde inbakat i `-i`. Anta inte att suffixen betyder samma sak i material från en annan källa.

## Import

Ordinarie väg är Admins importassistent: välj dealer, dra in filer, granska facken, spara. Vald dealer och bekräftad placering är auktoritet; ett filnamn får bara föreslå. Tvetydiga rader visas som "Välj placering" med orsak. AI-förslag (`CROUPIER_DEALER_IMPORT_AI`) får begränsad metadata och kan aldrig skriva eller godkänna själva.

Läsbart namn för nytt material (rekommendation, inget krav i parsern):

```text
dragan__idle__breath__t01.mp4
dragan__deal__pos4__redo-vila__t01.mp4
dragan__speech__blackjack__sv__t01.mp4
```

Varje importerad tillgång behöver validerad identitet, format, storlek och hash, dealer, spel, funktion, situation och källproveniens. Poseklipp behöver start- och slutpose och kalibreringsrevision; tal dessutom språk, exakt text, replik och tagning. Fält som saknas i schemat införs med en versionerad migrering, aldrig som ad hoc-fält i produktions-JSON.

För större källor (till exempel en Kevin-revision) planeras importen offline med importplanen i `apps/studio/lib/dealer-import-plan.mjs`.

Planen läser bara original, kontrollerar mot fryst Git-blob och storlek, beräknar SHA-256 och klassar varje rad som återanvänd, importera, korrigera bindning, behåll skyddad eller raderingskandidat. Alla rader har `applyAllowed: false`: planen laddar inte upp, registrerar inte och raderar inget. Genomförandet går genom Admins revisionsskyddade skrivare:

1. Frys källmanifest, mål-scope, projekt- och medierevisioner och spara ett privat återgångsunderlag.
2. Ladda upp saknade bytes, läs tillbaka och verifiera hash och storlek innan registrering.
3. Byt utkastets bindningar atomiskt. Import publicerar aldrig automatiskt.
4. Verifiera box 1–7, dolt kort och vändning, posekedjor, språk och ljud. Publicera ett nytt paket; gamla paket ändras inte.

## Radering

Permanent radering är det sista steget och kräver att originalbytes är bevarade. Skydden som finns i koden ska återanvändas, inte byggas om:

- Arkivering före permanent radering, revisions- och hashkontroll, objektlås och sekvensen `pending → radera Blob → deleted` med förnyad behörighetskontroll (`apps/studio/lib/studio-media-deletion.mjs`).
- `inspectMediaDeletion` (`packages/studio-registry/server/repository.mjs`) läser dokument, paket, alias, Forge-profiler och icke-avslutade Forge-jobb, sparade talrepliker och talpaketens metadata, och kontrollerar Neons runtimeindex. Saknade tabeller, fler sidor eller okända svar stoppar raderingen.
- Retained bank, publicerade paket, andra ägares poster och aktiva uppladdningar spärrar.
- En aktiv GPU-session, giltig tallease eller oavslutad helfilsbegäran i miljön stoppar radering konservativt, eftersom äldre talsessioner saknar exakta indatareferenser.
- Nya Forge-jobb kontrolleras atomiskt mot pending, deleted och arkiverad media under samma scopelås; ett sent providerutfall får aldrig återaktivera raderad media.

"Inte vald i utkastet" är inget raderingsbevis. Blob och SQL är ingen gemensam transaktion: avbrutna uppladdningar och pending-raderingar måste kunna återupptas. Regressionsprov finns i `apps/studio/test/dealer-lifecycle.test.mjs`, `apps/studio/test/dealer-forge.test.mjs`, `test/studio-repository.mjs` och `test/speech-reply-repository.mjs`.

## Rörligt tal och talworkern

Flödet är OpenClaw-beslut → registrerad röst (TTS) → exakt PCM → vald och verifierad bildrutebank → läppsynk i dealerlagret. Workern väljer aldrig repliker, kort eller filmer, och förinspelade repliker spelar sin egen video och sitt eget ljud.

- Workern ligger i `services/moving-gpu-worker/` (versionslåst motor, modellhashar, bank- och sessionsvalidering). `moving-gpu-build.yml` bygger och provar imagen utan nät och GPU; `moving-gpu-publish.yml` publicerar.
- `services/game/moving-speech-transport.mjs` kräver en GHCR-image med SHA-256-digest och workerintyg för release, dealer, bank, session och accepterat RunPod-jobb innan första PCM skickas.
- Varje session binds till exakta bankoriginal, profilrevision, publicerat paket och eget jobb (Studio-migrering 013), med beständig budget.
- Funktionen är av (`CROUPIER_MOVING_SPEECH_ENABLED`, se [ENVIRONMENT-VARIABLES](../ENVIRONMENT-VARIABLES.md#driftväljarens-api)). Varje betalt prov kräver Jakobs budgetbeslut, och bara Jakob godkänner läppsynk.
- Bildruteplanen räknar hela ljudsamplingar: `floor((pcmBytes / 2 + 18000) / 1000)` rutor vid 24 fps, med 220 ms inledande och 530 ms avslutande tystnad. Vila använder alltid källruta 0.

## Var koden finns

| Del | Filer |
| --- | --- |
| Import och klassning | `apps/studio/lib/dealer-import-*.mjs`, `packages/presentation/contracts/video-intake.mjs`, `packages/presentation/contracts/schemas/video.schema.json` |
| Pose och utdelning | `packages/presentation/runtime/filmed-deal-sequence.mjs`, `services/game/filmed-deal-selection.mjs` |
| Register och radering | `packages/studio-registry/server/repository.mjs`, `apps/studio/lib/studio-media-deletion.mjs`, `apps/studio/lib/dealer-lifecycle.mjs` |
| Talrepliker | `packages/presentation/server/speech-reply-repository.mjs` |
| `media/blob-index.json` (manuellt, inget skript anropar det) | `tools/export-media-blob.mjs`: torrkörning utan flaggor; `--output media/blob-index.json` skriver indexet, `--apply` laddar upp privat och verifierar |
| Rörligt tal | `services/moving-gpu-worker/`, `services/game/moving-speech-*.mjs`, `services/game/generated-speech-stream.mjs` |

Radera inte tester för aktiva kontrakt för att deras namn innehåller Astrid eller Kevin. Medieoriginal, kalibrering och privata checkpoints är aldrig genererbara byggrester.
