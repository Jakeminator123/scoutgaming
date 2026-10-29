# Paows rörliga bank: körning steg för steg

Körbeskrivning för T4–T5 i [TALKEDJA](plans/TALKEDJA.md): bygg Paows bank i vårt format, lägg den i previews privata Blob och koppla den till en egen RunPod-endpoint i Kevins konto med vår worker-image. Jakob, eller en agent med nycklarna, kör stegen i ordning. Inga nycklar i repot; varje hemlighet sätts direkt i panelen eller i en ospårad lokal fil. Dragan och Kevins resurser (`7tcfouz8jib4wb`, `fxwf3rgwme748i`, `mq7eiwanda72fg`, podden `v01sxp6a4wmjq6`, banan `e2e-prod`) rörs aldrig. Kvittot fylls i [2026-11-XX-TALKEDJA-PAOW-BANK-ACCEPTANCE.json](2026-11-XX-TALKEDJA-PAOW-BANK-ACCEPTANCE.json) (byt `XX` mot dagen när det fylls).

Banken byggs ur **samma miljös** register som den ska köras i. Spelmotorn kräver att talprofilens referens och varje bankklipp finns med samma ID och sha256 i miljöns register; en bank byggd ur produktionens register fungerar inte i preview. Börja i preview.

## 1. Paows talprofil i Admin (förberedelse)

1. Admin i preview → Dealers → Paow → **Röst och tal** → **Förbered röstprofil för realtidstal**.
2. Röst: förvalet **Paow** ur katalogen (`WZVEBKUreb9jAKojf0QF`). Svenska: `eleven_v3`, stability 0,5, similarity 0,85, speaker boost. Engelska: `eleven_multilingual_v2`, stability 0,38, similarity 0,8, style 0,3 (Kevins inställningar, `packages/presentation/contracts/dealer-voice-catalog.json`).
3. **Dealerns egen referensvideo**: vilaklippet som ska ge vilarutan (Emils paket använde sista rutan i `pos1-v`). **Referenstyp**: **Rörlig · dealerns bank**.
4. **Referensposition**: vilarutans tid i millisekunder, i steg om 125 ms (hel ruta i 24 fps: ruta = ms × 24 / 1000). Sista rutan i ett klipp med `n` rutor går bara om `n − 1` är delbart med 3; välj annars närmaste lägre multipel av 125 ms. Visa rutan, **Lägg talprofil i utkast**, spara projektet. **Begär AI-tal** förblir av: ingen bank finns ännu.

## 2. Källor ur registret (CPU, Jakobs dator)

Kräver Node 24, `npm ci` i `services/game` (för `pg`) och previews läsvärden i en ospårad env-fil: `CROUPIER_STUDIO_NEON_POLICY=1`, `CROUPIER_STUDIO_ENVIRONMENT_ID=staging_k06_k07`, `CROUPIER_STUDIO_WORKSPACE_ID=croupier`, `CROUPIER_GAME_DATABASE_URL` (previews), `CROUPIER_MEDIA_STORAGE=blob`, `BLOB_READ_WRITE_TOKEN` (previews store).

```sh
node --env-file=<ospårad-preview.env> tools/prepare-moving-speech-sources.mjs --dealer paow --output <ny-katalog>/paow-sources
```

Verktyget läser bara (read-only-transaktion, inga Blob-skrivningar). Det tar Paows alla `action`- och `idle`-klipp som inte är arkiverade eller inspelat tal (i produktionen 56 + 34; previews antal kan skilja), kontrollerar sha256 och 1080×1920/24 fps och hoppar över klipp som inte är CFR 24 (står i `skipped`). Vilan är profilens referens: `rest = {videoId, frame: offsetMs × 24 / 1000}`. Felet `moving_bank_motion_reference_required` betyder att steg 1 saknas eller att positionen inte är en hel ruta. Utdata: `paow-sources/sources/<uuid>.mp4`, `export-receipt.json` och sist `sources.json`. Notera `sourceSetSha256` och `skipped`.

## 3. Pool (CPU, Jakobs dator)

Kräver Python 3.11+ och ffmpeg med libx264.

```sh
python -I tools/build-moving-speech-bank.py --sources <ny-katalog>/paow-sources --output <ny-katalog>/paow-pool
sha256sum <ny-katalog>/paow-pool/bank-receipt.json
```

Kvittot har `"status": "pool-only"`. Dess sha256 är `expected-receipt-sha256` i nästa steg; skriv ner den här, inte på GPU-maskinen. Emils `avatar-paow.tar` kan inte ges till `--pool`: verktyget kräver vårt pool-kvitto och `sources.json` ur registret.

## 4. GPU-förberedelse i vår worker-image

Imagen har MuseTalk, modellerna och `rorlig.py` (`/opt/moving-worker/vendor`). På en Linux-värd med NVIDIA-GPU (RTX 4090 24 GB, annars 48 GB Ampere) och Docker, inloggad mot GHCR med Jakobs token (`read:packages`):

```sh
docker run --rm --gpus all --network none --entrypoint /workspace/mt-venv/bin/python \
  -v "$PWD/tools:/tools:ro" -v <ny-katalog>/paow-pool:/in/paow-pool:ro -v <ny-katalog>/out:/out \
  ghcr.io/jakeminator123/moving-gpu-worker@sha256:<digest> -I /tools/build-moving-speech-bank.py \
  --pool /in/paow-pool --expected-receipt-sha256 <sha256 från steg 3> \
  --prepare-with /opt/moving-worker/vendor --output /out/paow-bank
```

Resultat: `out/paow-bank/paow.tar` (arkivet) och `out/paow-bank/bank-receipt.json` med `"status": "prepared"`, `avatarSha256` och `inputReceiptSha256`. `archive.sha256` = `avatarSha256` = `sha256sum paow.tar`; `receipt.sha256` = `sha256sum bank-receipt.json`. Ej provkört i denna form: en RunPod-pod med vår image kräver att startkommandot ersätts, vilket inte är verifierat; en GPU-värd med Docker är den säkra vägen.

## 5. Arkiv, kvitto och manifest till previews privata Blob

Tre filer under en ny UUID i `croupier/media/dealers/paow/runtime/moving-bank/<uuid>/`, var och en med sin sha256 som filnamn (`validatePrivateMedia`): arkivet som `<archive.sha256>.bin` (`application/octet-stream`; `.tar` är ingen tillåten ändelse), kvittot som `<receipt.sha256>.json`, och manifestet `{"schemaVersion":1,"sourceSet":<sources.json>,"archive":<post>,"receipt":<post>}` som `<manifestets sha256>.json`. En post är `{"provider":"vercel-blob","pathname":…,"sha256":…,"size":<bytes>,"contentType":…}`. Ladda upp med `@vercel/blob` 2.8.0 ur `services/game`:

```js
// node --env-file=<ospårad-preview.env> --input-type=module, från services/game
import {put} from '@vercel/blob';
await put(pathname, bytes, {access:'private', token:process.env.BLOB_READ_WRITE_TOKEN,
  addRandomSuffix:false, allowOverwrite:false, contentType, multipart:bytes.length > 5*1024*1024});
```

Manifestets post är bankposten i `CROUPIER_MOVING_SPEECH_BANK_RECORDS`.

## 6. Image och release

Endpoint och motor använder samma publicerade image. Release-SHA: `cd services/moving-gpu-worker && python -c "from contracts import verify_release; print(verify_release('.'))"`. Saknas en publicering för den releasen: Actions → **Publish private Moving GPU image** på `main` med `approved_target=ghcr.io/jakeminator123/moving-gpu-worker`, `expected_head=<main-SHA>` och `expected_release=<release-SHA>`. Publiceringskvittot står i körningens sammanfattning och logg (`gh run view <id> --log | grep releaseSha256`): `image` (`…@sha256:<digest>`) blir `CROUPIER_MOVING_SPEECH_IMAGE` och RunPod-imagen, `releaseSha256` blir `CROUPIER_MOVING_SPEECH_RELEASE_SHA256` och profilens `releaseDigest`. Alla profiler i en miljö delar release, så Paow bredvid Dragan kräver Dragans image.

## 7. RunPod-endpoint (Kevins konto, vår image)

Serverless endpoint `scoutgaming-moving-paow`: image ur steg 6 med registry-auth (Jakobs GHCR-token; paketet är privat), GPU RTX 4090 24 GB (faller den: 48 GB Ampere; inte 5090 utan prov), workers min 0 / max 1 (min 1 bara under ett provfönster, cirka 1 $/h), idle timeout 60 s, execution timeout 180 s, flashboot på, container disk 20 GB. Env: `MOVING_CALLBACK_ORIGIN=https://croupier-k06-k07-staging.onrender.com` (previews Render-origin, exakt) och `MOVING_BANK_STORE=/tmp/croupier-moving-banks`. Endpoint-ID:t blir profilens `endpointId`.

## 8. Miljö och aktivering

Render `scoutgaming-preview-engine`: `CROUPIER_MOVING_SPEECH_ENABLED=1`, `CROUPIER_MOVING_SPEECH_BANK_RECORDS={"paow":<manifestpost>}`, `CROUPIER_MOVING_SPEECH_IMAGE`, `_RELEASE_SHA256`, `_RUNPOD_API_KEY` (Kevins konto), `_TICKET_SECRET`, `_WORKER_ORIGIN=https://croupier-k06-k07-staging.onrender.com`, `ELEVENLABS_API_KEY` (Kevins konto), `CROUPIER_DEALER_SPEECH_PROFILES=1`, `CROUPIER_STUDIO_MOVING_DRIFT_API=1` och

```json
[{"id":"paow","label":"Paow","dealerId":"paow","endpointId":"<endpoint>","releaseDigest":"<releaseSha256>","bankHash":"<archive.sha256>"}]
```

i `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`. Vercel `scoutgaming-preview`: samma två drift-variabler, inga talnycklar. Kör `node ops/cloud/start.mjs --check` med previews värden; motorn verifierar bankhash och image vid start. Sedan Admin → Paow → Röst och tal: **Begär AI-tal** går nu att slå på (Admin ser Paow i `movingSpeech.dealerIds`), spara; Taldrift för Paow: Sparläge. Prov: Dialogtest mot Paow ger ljud och rörlig mun. Fyll i kvittot och lägg det i en PR.
