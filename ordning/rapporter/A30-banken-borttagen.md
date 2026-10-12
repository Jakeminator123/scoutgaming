# A30 · Indexerad bank borttagen

Genomförande av Jakobs beslut B11 (2026-10-12) på molnbranch
`cursor/a30-indexed-bank-6a84`. Inget är mergat. Blob-objekt är inte raderade.
`media/dealers/*/runtime/presentation/**` är orörd (83 filer, 173 985 094 byte).

## Konsumentkarta

Spelaren läser inte banken. `web/public/game-lanes.mjs` släpper bara
`portrait-video` och `layered` till spel (`gamePresentationForDealer`).
`indexed-video` ger inga dealers (`gameChoicesForLane`). `web/public/app.mjs`
kastar om presentationen inte är `local` eller `layered`.
`web/server.mjs` svarar 410 `local_dealer_retired` för `/dealer/…` och
`/dealers/{astrid,vera,amira,mei}/…` innan `openPublicMedia`.
`local-presentation.mjs` spelar `/api/presentation/videos/…` från publicerat
paket. Frysta paket läser privata Blob-sökvägar ur paketposten
(`web/storage/frozen-dealer-presentation.mjs`), inte `runtime/indexed`.

| Undermapp | Läsare | Beslut |
| --- | --- | --- |
| `streams` (+ `index.json`) | `audit-dealer-sync`, `studio-voice-lines`, `clip-mapping`, `legacy-clip-inventory`, katalogbyggaren. Partner-API:t läser `web/public` och får tom lista. | Bort. Ingen spel-, paket- eller rumsväg. |
| `audio` (`bank.json`, mp3, `dry`, `orig`) | Samma Studio-läsare och läppsynkskript. `dry`/`orig` bara läppsynk. | Bort. |
| `preview` | Studio-röstregister och `build-previews.sh`. | Bort. |
| `performance` (manifest, mp4, `rhythm`, `smooth60`, `joins`, `scene-acceptance`) | `audit-performance`, klippkarta, legacy-inventering. Spelaren sätter aldrig `joins`. | Bort. |
| `actor` | Bara `audit-astrid-actor`. Packad talfilm och rumsplatta låg i samma mapp. | Bort. |
| `speech` (win/goodluck mp4) | `speech-media.json` pekar hit. Auditarna hashade filerna. Spelaren spelar dem inte. | Bort. JSON-registret står kvar. |
| rot (`scene.png`, `table.png`, `poster.jpg`, `lipsync-overrides.json`, `dealing-cues.json`, `trackcfg.json`, `supervisor.webm`) | Partner-API:t fyller scen-URL:er utan att läsa filerna. Servern svarar 410. Övriga filer bara auditar/läppsynk. | Bort. API-svaret oförändrat. |
| `streams/orig`, `streams/pre-trim` | Bara läppsynk (`retime-*`, `sync-*`). | Bort. |

## Borttaget

| Del | Antal |
| --- | ---: |
| Git-filer under `runtime/indexed` | 632 |
| Byte | 292 543 726 (279,0 MiB) |
| Layoutrader med `path` under banken | 652 (inkl. 20 som redan saknade Git-fil) |
| Layout-rötter `web/public/dealer` och `web/public/dealers/{astrid,amira,mei}` | 4 (pekade bara på banken) |
| Extra aliasrader utan egen Git-fil | 2 (`composited/.../astrid-win.mp4`, `source/.../camera.json`) |
| Blob-indexrader med `logicalPath` under banken | 652 |
| Extra blob-alias utan egen Git-fil | 2 |
| Inbäddade JSON-poster i `media/catalog/legacy.json` | 12 |
| Auditar | `audit-dealer-sync.mjs`, `audit-performance.mjs`, `audit-astrid-actor.mjs` |
| Prov | `test/dealer-sync-audit.mjs`, `test/dealer-rhythm.mjs`, `test/dealer-smooth60.mjs` |
| Krok | tre `node pipeline/audit-*.mjs` och `test/dealer-sync-audit.mjs`; rhythm/smooth60 ur samma rad som reach/scene-join/ready-motion |
| CI | tre steg i `.github/workflows/croupier.yml` (rad 135–137 före ändringen) |
| Läppsynk | `apply-lipsync.py`, `sync-audio-warp.py`, `sync-existing.py`, `auto-phrase-warp.py`, `measure-lipsync.py`, `measure-onset.py`, `retime-video-map.py`, `retime-video-warp.py`, `trim-speak-start.py`, `pipeline/lipsync-overrides.json` |
| Baslinje | `docs/dealer-sync-baseline.json` |

`test/dealer-reach.mjs`, `test/scene-join.mjs` och `test/ready-motion.mjs` står
kvar med syntetiska fixturer. De läser inte banken. Spelarmodulerna
`dealer-reach.mjs`, `scene-join.mjs`, `ready-motion.mjs` och
`performance-player.mjs` står kvar.

## Kvar och varför

- `runtime/presentation` (83 filer). Beslutet undantar den, inklusive de 12 bankklippen.
- `runtime/hands`, `source`, `composited`. Inte banken. Handmattorna parades mot bankens strömmar av auditen som nu är borta.
- `media/game/runtime/speech-media.json`. Inte en bankfil. Pekar fortfarande på de borttagna `dealers/astrid/speech/*.mp4`.
- `encode.sh`, `build-hands.sh`, `build-previews.sh`, `build-contact-review.mjs`, `prepend-contact-entry.mjs`, `mouth-crops.json`. B9 behöll dem. De namnger den borttagna banken.
- Partner-API:ts kod. Tomma listor var redan svaret. Dokumentet är rättat. HTML ombyggd med `web/build-docs.py`.
- Studios klippkarta kraschar inte: saknat index ger tom `engine`, röstregistret ger tomma rader när båda JSON-raderna saknas, och korrupt register failar fortfarande stängt.

## Mätning

Git-blob före (`git ls-tree -l`) och arbetsyta efter (`stat` på `git ls-files`).
Image är `git ls-files` minus ungefärliga `.dockerignore`-mönster. `docs/` och
`test/` ingår inte i imagen.

| Mått | Före | Efter | Skillnad |
| --- | ---: | ---: | ---: |
| `media/` filer | 1 455 | 823 | −632 |
| `media/` | 568,57 MiB | 288,28 MiB | −280,29 MiB |
| Render-`COPY` (ungefär) | 611,97 MiB | 331,64 MiB | −280,33 MiB |
| `media/` i imagen | 560,24 MiB | 279,94 MiB | −280,30 MiB |
| Presentation | 83 / 173 985 094 byte | samma | 0 |

Skillnaden mot bankens 279,0 MiB är borttagna register och skript (cirka 1,3 MiB).

## Prov

| Kommando | Resultat |
| --- | --- |
| `node tools/build-runtime-media-catalog.mjs --check` | grön, 3 källor |
| `node pipeline/build-lab-video-manifest.mjs --check` | grön, 51 poster / 28 familjer |
| `node tools/check-orphan-tests.mjs` | 346 prov, 0 föräldralösa |
| `node docs/system-map/verify.mjs --check` | 0 röda, gul (ändrade indata; gult är tillåtet) |
| `node tools/check-environment-variables.mjs` | grön |
| `node --test` klippkarta, katalog, röstregister, legacy-klipp, bindningar, dealer-reach, scene-join, ready-motion, generations-api, performance-contact, partner-launch, native-partner-events, studio-media-runtime, media-layout, blob-routing | gröna |
| `buildAssetsManifest` för fyra dealers | 0/0/0 strömmar, utdelningar, tal |
| Hela kroken | se nedan |

Kroken (`.githooks/pre-commit` → `pre-commit-full`) stoppade på
`test/system-map.mjs:290`: Node v22.14.0 rapporterar ett avbrutet prov som
`failed`, provet väntar `cancelled`. Labbet kräver Node 24. Felet rör inte
banken. En fortsättning utan `set -e` gav 37 röda, alla miljö: saknad
`typescript`/`ws`, `node:sqlite` utan `backup`, och inget Next-bygge. Ingen
röd rad nämnde banken.

## AGENTS.md / CLAUDE.md

`CLAUDE.md` nämner inte proben. `AGENTS.md` rad 64 blir fel:

> Run `node pipeline/audit-dealer-sync.mjs --probe` and the tests in `.githooks/pre-commit` for every media/player change. Review all four dealers with `?dealer=<name>&rehearsal=1`, including two consecutive plays. Rehearsal uses the actual game player.

Förslag (Jakob beslutar):

> Run the tests in `.githooks/pre-commit` for every media or player change. The indexed dealer bank and `pipeline/audit-dealer-sync.mjs` are no longer in the tree. Review registered dealers with `?dealer=<name>&rehearsal=1`, including two consecutive plays. Rehearsal uses the actual game player.

## Raderingsgrind mot `origin/main`

`head f81669c5`, 666 borttagna filer (banken plus tidigare vågor på
integrationsbranchen). **0 IMPORT. 0 REGISTRY.** 32 MENTION. De flesta är
två sista sökvägsled (`en/bank.json`, `streams/index.json`, `speech/win.mp4`)
som också finns i levande text. Verkliga namn:

| Fil | Vad träffen är |
| --- | --- |
| `AGENTS.md` | Proben som inte ändrades, enligt uppdraget |
| `README.md` | Säger att `audit-dealer-sync.mjs` inte längre finns |
| `docs/JOHN-HANDOFF.md` | Leveransraden för den här borttagningen |
| `lab/test/studio-voice-lines.test.mjs`, `lab/test/blob-source-routing.test.mjs` | Tillfälliga fixturer som bygger egna indexed-sökvägar |
| `media/game/runtime/speech-media.json` | `dealers/astrid/speech/{win,goodluck}.mp4` (suffix mot de borttagna filerna) |
| `pipeline/build-hands.sh`, `build-previews.sh`, `prepend-contact-entry.mjs` | B9-byggare som fortfarande namnger banken |
| `pipeline/build-index.mjs`, `web/partner-presentation.mjs`, `web/clip-mapping.mjs`, `lab/lib/legacy-clip-inventory.mjs`, `lab/lib/studio-voice-lines.mjs`, `test/clip-mapping.mjs`, `test/build-index.mjs`, `test/game-entry-offline.mjs`, `lab/test/legacy-clip-policy.test.mjs`, `lab/test/studio-project-bindings.test.mjs` | Relativa `streams/index.json` och `bank.json`, inte Git-filerna |
| `media/catalog/legacy.json`, grön-tal-JSON, staging-`speak.json` | Ljudfilnamn som delar suffix med borttagna mp3 |
| `runtime/presentation/repliker/README.md`, `take-anchors.json`, staging-README och `sha256.txt`, `branding-qa/result.json` | Historiska anteckningar |
| `web/public/environment.css` | Suffix `room.jpg`, inte bankens fil |
| `test/speech-package-contract.mjs`, `pipeline/test-amira-green-speak.mjs` | Talnamn `goodluck`/`bank.json`, inte bankens bytes |
| `lab/components/studio-administration.test.mjs` | Samma suffix i ett adminprov |

## Tveksamt

- Läppsynkkedjan och de tre auditarna togs bort fast B9 sa att kedjan skulle stå kvar. De hade bara banken som underlag.
- `runtime/hands` (Vera) står kvar utan audit. Den parades mot bankens strömmar.
- `build-hands.sh`, `build-previews.sh`, `build-contact-review.mjs` och `prepend-contact-entry.mjs` pekar på borttagna sökvägar.
- `speech-media.json` pekar på borttagna `dealers/astrid/speech/win.mp4` och `goodluck.mp4`. Spelaren läser inte den sökvägen.
- Layoutraden `dealers/astrid/runtime/presentation/repliker/bank.json` behölls (ingen rad under presentation togs bort). Filen finns inte i Git. `canonicalPath` mot bankens `bank.json` togs bort så registret fortfarande går att läsa. Motsvarande blob-rad behölls; objektet är inte raderat.
- Två aliasrader utan egen fil togs bort: composited `astrid-win.mp4` och `source/.../camera.json`. Båda pekade på banken.
- Blob-objektens existens är inte läst. Inget objekt är raderat.
- `scene-join.mjs` kräver fortfarande sökvägsprefixet `dealers/astrid/performance/joins/`. Den levande spelaren sätter inte `joins`.
- GitGuardian mot `main` var köad vid start. Incidentlistan lästes inte.
- Hela kroken är inte grön här. Node är 22, inte 24. Första stoppet är `test/system-map.mjs` (cancelled mot failed). Resten föll på saknade paket och `node:sqlite`.
