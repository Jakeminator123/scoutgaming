# A30 fas 1 · Indexerad mediebank, originalmotor och partnerprotokoll

Läsande underlag för B11. Ingenting är borttaget. A04 kördes parallellt; denna
rapport står på egen kodläsning och lokal hashning, inte på A04:s rapport.

| Fält | Värde |
| --- | --- |
| Branch | `cursor/a30-indexed-bank-8369` från `jakob/repo-ordning` `43bb429c` |
| Baslinje | `00ea55c5` (BASLINJE.md). Känd rörelse t.o.m. `e160af12` |
| `origin/main` vid mätning | `91969107` "Pin Studio migration 008 after production apply" |
| Merge-bas mot `origin/main` | `e160af12` |
| Node | 22.23.3 (nvm). Node 24 fanns inte. `PATH`-node är 22.14.0 och användes inte |
| Produktion | inte läst |

## Steg 0

`git ls-tree` mot `HEAD` `43bb429c`. Indexed bank, exakt som baslinjen (655 filer):

| Del | Filer | MiB | Baslinje |
| --- | ---: | ---: | --- |
| Astrid indexed, varav rigg | 267 (23 rigg) | 213,69 (61,98 rigg) | 213,69 · rigg 62,0 |
| Amira / Vera / Mei indexed | 108 / 178 / 102 | 41,94 / 48,41 / 36,92 | 41,9 / 48,4 / 36,9 |
| Bank utom rigg (A30) | 632 | 278,99 | cirka 279 |
| Händer `runtime/hands` (utanför mängden) | 33 | 3,28 | inte i A30-summan |

Stora delar av banken utom rigg:

| Del | Filer | MiB |
| --- | ---: | ---: |
| Astrid `performance/` | 115 | 100,40 |
| Strömmar, fyra dealers | 164 | 102,79 |
| Stills (scene/table/poster) + Vera `supervisor.webm` | 12 | 36,76 |
| Astrid `actor/` | 26 | 13,22 |
| Ljud `audio/` | 228 | 11,26 |
| `preview/` | 78 | 10,73 |
| Astrid `speech/` (två mp4) | 2 | 3,84 |

`origin/main` ligger två commits före integrationsbranchen: `12a12fd6` (Node 24
på Vercel) och `91969107` (migration 008 pin). Diffen rör 14 filer (Studio-runtime,
lås, dokument, migrationstest). Ingen fil under `media/`, inte
`web/partner-presentation.mjs`, inte `media/blob-index.json`. Ingen ny
produktkonsument av banken. Storlekarna avviker inte.

GitGuardian mot `91969107` (`--github-only`): kontrollen är köad, slutsats saknas.
Incidentlistan lästes inte. Inget påstås vara rent.

## 1. Partnerprotokollet

Samma producent i båda stackarna: `web/partner-presentation.mjs`, anropad från
`web/partner-api.mjs` (SQLite) och `web/storage/async-partner-api.mjs` (Postgres).
Servern ger `root` = `web/public` (`web/server.mjs` rad 300).

### `POST /api/v1/table` · fältet `presentation[]`

Listan byggs av spelvy och `op`, inte av mediefiler (`presentationEvents`,
rad 38–65). Mediefält:

| `type` | Mediefält | Övrigt (inte media) |
| --- | --- | --- |
| `speak` | `line` (id mot `assets.speech`), `blocking` bara på `goodluck` | — |
| `deal` | `clip.action`, `clip.prefer`, `clip.fallback` (`"slide"`) | `to`, `box`, `handIndex`, `card` `{r,s}` eller `null`, `faceDown`, `shoeDraw` |
| `reveal` | inget klipp | `to:"dealer"`, `card`, `shoeDraw` |
| `idle` | tomt förutom `type` | — |
| `turn` | inget | `box`, `handIndex`, `legalActions` |
| `settle` | inget | `dealerTotal`, `dealerBlackjack`, `hands[{box,stake,returned,outcome}]` |

`clip.action` är `deal-left` (box 0–1), `deal-centre` (2–4), `deal-right` (5–6),
`deal-dealer`. `clip.prefer` är hårdkodat `astrid-left-*` / `astrid-centre-*` /
`astrid-right-*` / `astrid-dealer-*` för alla dealers. Raden bär inte URL, hash
eller `landAtMs`.

Talrader som producenten faktiskt skickar: `goodluck`, `insurance`, `double`,
`dealerblackjack`, `blackjack`, `dealerbust`, `win`, `push`, `lose`, `placebets`.
Bankens övriga rader (`greeting`, `bust`, `peek`, …) används inte av den här listan.

`op:"state"` ger `presentation: []`.

### SSE `event: round`

`publish` (`web/partner-api.mjs` rad 23 och motsvarande async) skriver
`event: round` med JSON `{ type, op, requestId, version, phase, balance, events }`.
`events` är samma array som `presentation`. Det finns inget nästlat fält
`round.events`; planens kortform är eventnamnet plus `events`.

### `POST /api/v1/assets` · det som faktiskt är URL:er och tider

`buildAssetsManifest` (rad 14–34) läser `streams/index.json`,
`audio/en/bank.json`, `lipsync-overrides.json` och `performance/manifest.json`
med `readFileSync` under `web/public`. Den använder inte `media/layout.json`.
De filerna finns inte kvar på den sökvägen (`git ls-files web/public/dealers`
och `web/public/dealer` är tomma). Anrop mot `web/public` för astrid, vera,
amira och mei gav **0 streams, 0 deals, 0 speech**.

Svaret innehåller ändå alltid:

| Fält | Media |
| --- | --- |
| `scene.room/table/poster` | URL `/{dealer}/scene.png` med flera. Astrid-bas är `dealers/astrid`, Vera är `dealer` |
| `scene.cardBack/shoe/chip` | URL under `/assets/…` (spelassets, inte banken) |
| `camera` | 1920×1080. `boxCentres` bara för Astrid, hårdkodat, inte läst från banken |
| `streams[]` | tom här. Om index fanns: `key`, `kind`, `url` (rå `.h264`), `codec`, `width`, `height`, `fps`, `frames`, `frameOffsets` (`index.json#key`), `handsMatte.{url,width,height,note}`, `audio.{url,delayMs,text}`, `preview` |
| `deals[]` | tom här. Om manifest fanns: `id`, `action`, `url`, `layout`, mått, `fps`, `frames`, `events`, `landAtMs`, `camera.{shoeOutlet,dealerRect}` |
| `speech[]` | tom här. Om bank fanns: `line`, `text`, `audio`, `lipsyncDelayMs`, `clip` |
| `formats.h264` / `formats.packedAtlas` | fast text om Annex-B och packad atlas |

`GET` av `/dealer/…` och `/dealers/{astrid,vera,amira,mei}/…` svarar **410**
`local_dealer_retired` innan Blob eller layout får servera
(`web/server.mjs` rad 1167–1169). Ett återställt manifest skulle alltså peka
på adresser servern redan nekar.

### Tester som låser formatet

| Test | Vad som låses |
| --- | --- |
| `lab/test/engine-compatibility.test.mjs` | Ordning, typer, sju boxar, `clip.action`, talradernas id, `settle`. Projektionen behåller bara `clip.action`, inte `prefer`/`fallback`/URL |
| `lab/test/presentation-sequence.test.mjs` | `presentation[]` och SSE-`events` är samma sekvens och korreleras på `requestId` + `version` |
| `lab/test/presentation-profile.test.mjs` | Ett riktigt `deal` har alla fält närvarande, inklusive klipphintar. `card` är `{r,s}` eller null |
| `test/native-partner-events.mjs` | `response.presentation` deepEqual SSE-`events`. `state` ger `[]`. Ingen omsändning vid replay |
| `open-claw/lab/test/engine.test.mjs` | Direktorn släpper `clip.url` och främmande `prefer`. Låser inte asset-URL:er |
| `test/game-entry-offline.mjs` | `GET` av bankens gamla adresser är 410 |

Inget test importerar `buildAssetsManifest`. URL, codec, `frameOffsets`,
`landAtMs` och `lipsyncDelayMs` låses av dokumentet
`web/public/docs/partner-api.md`, inte av ett prov. Att byta en nyckel där är
ändå ett externt kontraktsbrott.

### Kan formatet hållas med registrerad media?

`presentation[]` kan hållas oförändrat utan banken. Den läser inga filer.

`/api/v1/assets` kan inte fyllas från `runtime/presentation` utan att byta
betydelse. Registrerade klipp är MP4 i en annan uppspelare. Bankens kontrakt,
när det är ifyllt, är rå Annex-B H.264 (`avc1.4D4028`, 1440×1440), bildruta som
byte-offset, handmatte och packad atlas med `landAtMs`. Hashöverlapp mot
presentationsbanken är en fil: `bank.json` (1 338 byte), inte video.

Att peka manifestet på Blob under samma fält kräver de indexerade bytena, en
läsare som använder layout (det gör den inte i dag) och att 410-regeln ändras.
Det sista är ett produktbeslut, inte en städning. Dagens svar är redan tomma
medielistor plus scen-URL:er som 410:ar.

Klipp som layout-medvetna läsare ser (inte det tomma asset-svaret):

| Dealer | Klipp i `streams/index.json` | varav tal | rader i `bank.json` |
| --- | ---: | ---: | ---: |
| Vera | 39 | 32 | 23 |
| Astrid | 20 | 17 | 17 |
| Amira | 16 | 15 | 17 |
| Mei | 15 | 14 | 17 |

Astrids performance-manifest: status `draft`, 4 takes, 2 continuations.
Vera, Amira och Mei har `performance/manifest.json` = null i katalogen.

## 2. Studio

`lab/lib/legacy-clip-inventory.mjs` (rad 52–70) läser, via layout, samma index,
talbank och performance-manifest, plus `speech-media.json` och grön talspeak.
Varje klipp har `actualPlayback: false`. Native läge kräver ett
`legacyClipReview`-kvitto (sha256 + `neverAgain`) i administrationsdokumentet,
inte klippbytes i Neon. Motsvarighet i registrerad media: nej för video.

`lab/lib/studio-voice-lines.mjs` läser bank och index ur
`media/catalog/legacy.json` (inte råfilen) och släpper bara en talidentitet när
ljud, preview-mp4 och h264-ström finns i layout **och** blob-index med samma
sha256. Omdömet ligger i Studio-dokumentets `voiceReview`, matchat mot de
indexerade hasharna. Källan är `registered-indexed-speech`,
`productionApproved: false`. Presentationspaketet ersätter inte den identiteten.

`web/clip-mapping.mjs` är samma register, också med `actualPlayback: false`.
`web/public/dealer-engine.mjs` används av Studios originalvisning
(`lab/lib/original-media-runtime.mjs`) och av tal-/cue-tester. A12 har inte
kört; den konsumenten finns kvar.

## 3. Spelet

Publicerad start kräver `portrait-video` eller `layered`
(`web/public/game-lanes.mjs` rad 7–9). `indexed-video` + `legacy-dealers` får
fortfarande lagras, men `gamePresentationForDealer` kastar och
`gameChoicesForLane` ger inga dealers (rad 167). Tester:
`test/game-lanes.mjs`, `test/registered-cloud-playback.mjs`,
`test/game-entry-operator.mjs`, `test/frozen-dealer-presentation.mjs`,
`test/v3-room-dealer-choices.mjs`.

`docs/LOCAL-PRESENTATION-RUNTIME.md` överst (12 oktober) säger samma sak.
Rad 516–517 säger motsatsen och är inaktuell.

BASLINJE §8: inga av Astrids 10 registerposter matchar Astrids gamla Git-filer,
och inget av 29 paket med presentationsdata refererar dem via hash. Sparad
konfiguration pekar på 12 klipp i `runtime/presentation` (72 276 298 byte), inte
på indexed. Denna agent har inte läst om Neon.

### Produktionsfrågor till orkestratorn (SELECT, ingen skrivning)

1. Finns en publicerad lane eller ett rum med `renderer: indexed-video` eller
   `mediaCollection: legacy-dealers` som någon startväg fortfarande läser?
2. Matchar någon mediaregisters-sha256 en indexed-fil för **Vera, Amira eller
   Mei**? §8 täcker Astrid.
3. Finns de 632 blob-objekten vid GET? Indexträff är inte existens. Hör till
   A31/A99.
4. Anropar någon operatör `POST /api/v1/assets` i drift, och är svaret tomt?
5. Finns godkända `voiceReview`-identiteter vars audio/video/preview-sha256
   måste fortsätta gå att läsa?

## 4. Offline och CI

| Konsument | Kräver av banken | Ersättning |
| --- | --- | --- |
| `node lab/start.mjs --offline` | Inte bankens H.264. `test/game-entry-offline.mjs` kräver 503 utan paket och 410 på de gamla adresserna | Oförändrat. Ingen fixtur behövs för den provet |
| `tools/build-runtime-media-catalog.mjs --check` (krok rad 59) | JSON: streams-index, talbank, performance-manifest, speech-media, grön speak. Jämförs med `media/catalog/legacy.json` | Behåll JSON, eller peka om kontrollen när källan flyttas. En tom fixtur gör katalogen medvetet gammal |
| `pipeline/audit-dealer-sync.mjs` (krok rad 67; `--probe` kräver ffprobe) | Alla fyra dealers: varje ström och talpar, native speech, mot `docs/dealer-sync-baseline.json`. Handmatte bara där hands-index finns (Astrid 3 filer, Vera 30). `dealing-cues.json` finns bara för Astrid; övriga jämförs som frånvarande | Inte en liten fixtur. Antingen Blob-läsning efter verifierad GET, eller pensionering med Jakobs ok |
| `pipeline/build-index.mjs` | Vägrar byta en kalibrerad take (`audioDelayMs`) mot andra bytes (rad 64–66) | Regeln pensioneras eller flyttas med banken |
| Tester i aktivitetens lista | `test/build-index.mjs`, `test/dealer-sync-audit.mjs`, `test/media-layout.mjs`, `lab/test/legacy-clip-policy.test.mjs`, `lab/test/studio-voice-lines.test.mjs`, `lab/test/studio-project-bindings.test.mjs`, `lab/test/blob-source-routing.test.mjs`, `test/game-entry-offline.mjs` | Tas bort bara tillsammans med funktionen |

Offline-spelet använder inte banken. CI och Studio-reserven gör det.

## 5. Blob-täckning

Skript i `/tmp` (inte committat): `git ls-tree -r -l HEAD -- media/dealers`,
sha256 av filbytena, mot `media/blob-index.json` (`schemaVersion` 1,
`namespace` `croupier/media`, `verification` `readback-sha256`, 1 855 rader).
Jämförelse: `logicalPath`, `sha256`, `size`, `storage.sha256`, `storage.size`,
samt `media/layout.json`. Inga pathnames eller URL:er skrevs ut.
Provider-namnet i indexet är `vercel-blob`.

| Mängd | Filer | Resultat |
| --- | ---: | --- |
| Git indexed utom rigg | 632 | 632 i indexet, `access: public`, content = layout = blob = storage, 0 avvikelser |
| Rigg (A10, inte A30) | 23 | 23/23 samma |
| Händer | 33 | 33/33 samma |
| Stickprov `dealers/astrid/runtime/indexed/streams/index.json` | 35 749 byte | content = layout = blob = storage |

Layout och blob-index har **20 indexed sökvägar som inte finns i Git**
(9,08 MiB): `orig/`, `pre-trim/`, Astrid `performance/rhythm` och `smooth60`.
De är redan borta ur trädet. Layout ska inte användas som raderingslista.

Presentationslayout: 84 rader, varav 55 riktiga filer alla i blob med samma
hash. De 29 som saknas i blob är `.gitkeep` och två README (`access: source`).
Ett delat sha256 med banken: talbankens `bank.json`, inte ett klipp.

## 6. Förslag till B11

Rekommendation: **(b) del för del**. Inte (a) dealer för dealer som första snitt.
`audit-dealer-sync` och talregistret kräver alla fyra. Tar man Mei först faller
fyran.

| Skiva | Innehåll | Ersätts med | AGENTS.md | Prov | Risk |
| --- | --- | --- | --- | --- | --- |
| b1 | Astrid performance + actor, 141 filer, 113,62 MiB | Ingenting i spelaren. Katalogkontroll och `audit-astrid-actor` pekas om eller följer med | oförändrad talregel | katalogkontroll, `test/dealer-reach.mjs`, legacy-inventory | 30 %. Partner-`deals[]` är redan tom. Hash mot paket är inte omkörd här |
| b2 | Stills och `supervisor.webm`, ~36,8 MiB | Scen-URL:erna i assets är redan 410. Ta bort först när asset-svaret slutar lova dem, eller låt URL:erna 410:a medvetet | nej | `test/game-entry-offline.mjs` | 15 % |
| b3 | Strömmar, ljud, preview, speech, cues, plus händer 3,28 MiB | Blob-backad CI efter GET-bevis, eller pensionerad `audit-dealer-sync` / `build-index`-regel med uttryckligt ok. Inte en syntetisk minifixtur | ja: kalibreringsvägran, `--probe`, talsetet om det syftar på den här banken. Regeln om exakt replik och förbud mot duration-val för den levande spelaren står kvar | hela talgrinden | 50 %. Här sitter kontraktet och läppsynkbaslinjen |

(a) blir rimligt först efter b3, om någon dealer ska lämna helt.

Fas 2 ska inte ändra `presentation[]`, `events` eller asset-nycklar. Att fylla
de tomma asset-listorna från layout vore en beteendeändring och ska inte smygas
in som städning.

## Dokumentändringar som behövs

Inte gjorda här (våg 2/A17 äger `docs/`).

- `docs/LOCAL-PRESENTATION-RUNTIME.md` rad 516–517: indexed lane kan inte starta indexspelaren.
- `web/public/docs/partner-api.md`: exemplen visar fyllda `streams`, `deals` och `landAtMs`. Koden returnerar tomma listor, och GET 410:ar.
- Fas 2, om B11 tar bort bytes: `docs/ENVIRONMENT-RESTORATION.md` (återställning) och `docs/JOHN-HANDOFF.md`. `AGENTS.md` bara om skiva b3 pensionerar talgrinden.

## Kvar

- B11. Fas 2 startar inte på detta underlag ensam.
- Orkestratorns fem SELECT/GET-frågor ovan.
- A12 (originalvisningen) och A16 är inte inmergade. `dealer-engine.mjs` lever.

## Tveksamt

- Tomma `/api/v1/assets`-listor kan vara en oavsiktlig följd av flytten (läsaren
  följde inte med till layout). Återställning ändrar det externa svaret och
  krockar med 410. Inte rättat.
- §8 bevisar inte att Vera/Amira/Mei-paket saknar indexed-hashar.
- Blob-indexträff är inte ett bevis på att objektet finns i Blob.
- 20 layoutrader pekar på filer som redan saknas i Git.
- `clip.prefer` är Astrid-globs även för de andra dealers och låses inte av
  kompatibilitetstestet. En ändring är ändå trådbrytande.
- Node 24 saknades i VM:en.
