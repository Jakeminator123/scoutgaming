# A17 · Andra svepet

Branch `cursor/a17-andra-svepet-31c2`. Bas `jakob/ordning-v2-trial` @ `a5e09e18`. `origin/main` `36c8ef59`. Head är committen som lägger in den här filen.

## Borttaget

| Fil | Bevis |
| --- | --- |
| `web/public/shoe-model.mjs` | Vid `33be100b` bara `casino.mjs`, review-sidorna och `table-scene.mjs`. Alla tre är borta. `git grep` hittar ingen importör. |
| `web/public/shoe-contact-occlusion.mjs`, `test/shoe-contact-occlusion.mjs`, krokrad | Bara det provet. Krokraden delades med `performance-contact`; den raden står kvar. |
| `web/public/bo/media-preview.mjs`, `test/bo-media-preview.mjs` | Ingen HTML med `data-bo-preview`. `/bo/` utan session ger 302 före filen finns. Auth-provet pekar nu på levande `speech-qa.mjs`. |
| `web/public/dealer-engine.mjs`, `test/dealing-cues.mjs`, DealerEngine-delen av `test/speech-playback.mjs` | Efter A12 ingen produktimportör. Talproven för `speech-queue` står kvar. |
| `web/public/ready-motion.mjs` | Ingen produktimportör. Hash- och ffprobe-proven av installerade ready-klipp står kvar i `test/ready-motion.mjs`. |

## Behållt

| Fil | Skäl |
| --- | --- |
| `vendor/three/three.module.js`, `three.core.min.js` | `performance-player.mjs` importerar dem. |
| `speech-playback.mjs`, `actor-*`, `performance-contact.mjs` | Den gemensamma spelaren och `audit-performance.mjs` (A30). |
| `astrid-idle-scheduler.mjs` | Kvarhållen Astrid-staging `build-idle.mjs` importerar den. |
| `astrid-folded-rest.mjs` | Bara ett manuellt pipeline-prov, inte i kroken. |
| `port-source.mjs` | Manuell generator. A13/B7 tar inte bort den. |
| `page-template.mjs` | Har produktimportörer. Falskt "no importer". |
| `family-video-upload.tsx` och fyra `lab/lib`-moduler | Kräver beslut. Inte borttagna. |
| Fem manuella byggare, läppsynkkedja, `mouth-crops.json` | B9. Listan står i `docs/LOCAL-PRESENTATION-RUNTIME.md`. |
| Variant-`.gitkeep` under Astrids presentationsbank | Levande platser, inte tomma mappar. |

## Dokument

| Fil | Vad |
| --- | --- |
| `docs/JOHN-HANDOFF.md` | Nivå 3: originalreserven borta, `/casino.html` 308, `/v2` 307, granskningssidor 404. Ny post överst i senaste leveranser. |
| `docs/LOCAL-PRESENTATION-RUNTIME.md` | Våg 2-adresser och "Verktyg som finns kvar". |
| `docs/CLOUD-MIGRATION.md` | Trädfakta, inget JN2 avbockat. B17-sökregeln. |
| `docs/ENVIRONMENT-RESTORATION.md` | Uppspelningens källor är den gemensamma spelaren. |
| `README.md`, `lab/README.md`, `lab/VIDEO-LIBRARY.md`, `lab/docs/README.md` | Reserv, `/v2`, original-API och OpenClaw-länk. |
| `open-claw/lab/docs/DEPLOYMENT.md` med flera | 29-septemberkvittot infört som pensionerad kedja och borttaget. |
| `web/public/styles.css`, `web/partner-presentation.mjs`, `ops/cloud/CONTAINER-CONTEXT.md`, `.dockerignore` | Kommentarer. `encode.sh` i `build-index.mjs` och `trim-speak-start.py` finns kvar, så de rördes inte. |
| `AGENTS.md` | `.ignore` är rg-skölden. `.cursorignore` är hemligheter. Tung projekttext ligger i `.cursorindexingignore`. |
| `CLAUDE.md` | Ingen medie- eller legacyrad blev fel. `test-videoeditor` lämnas till A20. |

## B17

Flyttat från `.cursorignore` till `.cursorindexingignore`: `media/layout.json`, `media/blob-index.json`, `media/**/source/*.json`, `media/**/staging/*.md`. Breda `source/`- och `staging/`-mönster ligger kvar bara i indexfilen, annars går JSON och Markdown inte att läsa. `.ignore` är inte en kopia: rg döljer fortfarande de träden. Hemligheter (`.env*`, `lab/data/`, `web/data/`, arkivet) står kvar i `.cursorignore`. Inget prov jämförde filerna byte för byte. Dokumentationsläget i `precommit-checks` är grönt.

## Prov

| Kommando | Resultat |
| --- | --- |
| `public-reach.mjs` | 89 filer: 87 produkt, 2 pipeline-only, 0 none, 0 test-only |
| `lab-unused.mjs` | 2 utan importör, 4 bara test. Alla motiverade ovan |
| `check-orphan-tests.mjs` | 341 filer, 0 föräldralösa |
| `docs/system-map/verify.mjs --check` | 0 röda, gul (indata ändrad sedan baslinjen) |
| `check-environment-variables.mjs` | registret matchar |
| `raderingsgrind.mjs 33be100b` | 0 IMPORT, 0 REGISTRY, 31 MENTION |
| `coverage.mjs` | en lucka: `apps/croupier-frontend/components` (27 filer, 0,16 MB) |
| `node --test` tal, ready, klippkatalog, dealer-växling, BO-auth | 23 gröna |
| `audit-dealer-sync.mjs` | PASS mot baslinjen, utan `--probe` |
| `npm --prefix lab run build` | stopp: `next: not found`. `lab/node_modules` saknas. `engines.node` är 24.x, molnet har Node 22.14 |
| `precommit-checks.mjs --full` | stopp i `test/system-map.mjs` "real Node cancellation". Node 22 ger `failed`, provet väntar `cancelled`. Provet och evidensverktyget är orörda. Inte omskrivet |

## MENTION

- `streams/index.json` i pipeline, katalog och tester: två sista segment mot borttagen staging. Raderna läser levande dealerindex.
- `docs/system-map/routes.json` och `contracts.json`: `[...path]/route.ts` träffar levande `lab/app/preview/[...path]/route.ts`.
- `docs/system-map/index.html`: genererad ögonblicksbild 8 oktober. Byggs inte om här. Innehåller originalmedia-sökvägar.
- Caddy-filen och `bo/media-preview.mjs` i handoff och driftdokument: de beskrivs som borttagna.
- `seven-targets/isolated-game-targets.json` i `web/partner-presentation.mjs`: källan är borttagen staging, kvar i historiken vid `00ea55c5`.
- Kvarhållen Astrid-staging nämner `blender-table-scene.mjs` och `table-scene.mjs`. Mapparna lämnades av A14. Inte redigerade.

`migrate-media-layout.mjs --verify` har samma registerrad för `astrid-zones-manual-snapshot-2026-09-29.json` som på `33be100b`. Inte våg 2.

## Kvar

- A19: inga platshållare i tömda mappar. `web/public/review/2026-09-09/` syns inte här; BASLINJE §9 säger ospårad 3lager och den rörs inte. `.vercel` är gitignorerad om `ops/vercel-entry/preview/` finns lokalt. Tömda spårade mappar (`media/game/staging`, Amiras staging, `ops/vercel-entry`, `ops/caddy`, `pipeline/data`) finns inte i den här checkouten.
- A20: `test-videoeditor` i `CLAUDE.md`.
- `apps/croupier-frontend/components` saknar rapportomnämnande.
- `pipeline/data` har 0 spårade filer.

## Tveksamt

- `family-video-upload.tsx`, `background-zone-schedule.mjs`, `media-family-resolver.mjs`, `social-store.mjs`, `zone-workspaces.mjs`: kräver beslut. Inte borttagna.
- `kevin-bo/port-source.mjs`: manuell portningsgenerator. Säg till om den ska bort.
- `vendor/three/GLTFLoader.js` och `BufferGeometryUtils.js` saknar importör. Katalogen rördes inte eftersom `three.module.js` har en konsument.
- Ready-validatorn är borta. Manifestet `joins/ready` och hashproven står kvar. Säg till om validatorn var en planerad vänteloop.
- `docs/system-map/routes.json` `frontend-v2` och `frontend-game` säger fortfarande att `/casino.html` är en förberedd sida. Aliasposten är redan 308. A17 äger inte den kartan.
- `ordning/BASLINJE.md` och `ordning/ORKESTRERING.md` säger fortfarande att `.cursorignore` är identisk med `.ignore`. De är orkestratorns filer och är orörda.
- `measure-target.mjs` i kvarhållen Astrid-staging importerar borttagen `blender-table-scene.mjs`.
- GitGuardian: kontrollen för `2191349a` är `queued`. Incidentlistan är inte läst (`incidents:read` saknas). Ingen incident är markerad klar.
- Node 22-felet i systemkartans cancellationsprov är inte A17:s. Det är inte omskrivet.
