# Gemensam rörlig talworker

Status: byggd och provad för Dragans rörliga tal; rörligt tal är av i produktionen (`CROUPIER_MOVING_SPEECH_ENABLED=0`). Spelmotorn tar en bank per dealer.

RunPod-worker som renderar tal under rörelse för hashbundna dealerbanker. Renderaren är Emils granskade `rorlig-9` med avgränsade protokollpatchar för rutantal och vilorutans identitet; `source.json` bevarar originalhasharna och beskriver avvikelserna. Modell-, blandnings- och kodningsreceptet är oförändrat. Workern innehåller ingen TTS, textmodell eller produktdatabas. Den äldre strömningsvägen för stillastående tal finns i [astrid-gpu-worker](../astrid-gpu-worker/README.md).

## Bygga och verifiera

Från denna katalog:

```sh
python -B -m unittest discover -s tests -v
python build.py --target runtime --tag croupier-moving-worker:local
python build.py --target serverless --tag croupier-moving-worker:serverless
```

Bygget använder pinnad Ubuntu-digest och snapshot, Python 3.12.3, låsta paket och SDK-tillägg samt MuseTalk-commit `0a89dec45a0192b824e3cf4daf96c239440c5ed8`. Modellfiler hämtas från fasta revisioner och avvisas vid avvikande storlek eller SHA-256. Ett hashbundet Ubuntu-CA-paket hämtas före HTTPS-apt; ingen TLS- eller signaturkontroll stängs av, och `apt-get update` avbryter vid varje hämtningsfel. Inga bankfilmer eller nycklar byggs in, och bygget gör aldrig push eller deploy.

`release.json` binder runtimekällor, recept och låsfiler. Efter granskade ändringar: kör proven, `python seal_release.py` och kontrollera igen. Det är kodens releaseidentitet; kontrollplanet verifierar dessutom den driftsatta imagens digest. GPU-, spel- och bild/ljudkvitton krävs separat enligt `verificationRequirements` i `build-contract.json`; CPU-prov startar ingen GPU och verifierar ingen läppsynk.

## Privat publicering

`.github/workflows/moving-gpu-publish.yml` publicerar `ghcr.io/jakeminator123/moving-gpu-worker` vid manuell dispatch från `main` med exakt mål, granskad full commit-SHA och release-SHA. Lokala kontrakt och den byggda serverless-imagen provas före registry-inloggning; `packages:write` finns bara på publiceringsjobbet och `GITHUB_TOKEN` når aldrig Dockerbygget. Paketet måste vara privat, vilket kontrolleras igen efter push. Konfigurera RunPod med kvittots `@sha256:`-referens. Publicering skapar ingen endpoint och kör ingen GPU.

## Bank

Montera `/banks` read-only med `<avatarSha256>.tar` och `<bankReceiptSha256>.json` från den förberedda banken. Alla filer, källmanifest, ägare, karta och ansiktsmetadata kontrolleras innan Torch läser latentfilen. Alternativt tillför servern `bankDownload` i jobbinput:

```json
{
  "schemaVersion": 1,
  "archive": {"url": "https://approved-origin/bank/archive?cap=<one-use>", "sha256": "<avatarSha256>", "bytes": 594432000},
  "receipt": {"url": "https://approved-origin/bank/receipt?cap=<one-use>", "sha256": "<bankReceiptSha256>", "bytes": 1045}
}
```

Hasharna måste matcha jobbets binding. Bara HTTPS mot samma värd och port som callback, utan redirects, komprimering eller proxy. Svaret är status 200 med exakt `Content-Length` eller `Transfer-Encoding: chunked` ([RFC 9112 §7.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1)); båda kräver exakt samma verifierade bytes, och motstridiga längder, andra kodningar, avbrutna eller för stora svar avvisas. Kvittot hämtas före arkivet, med 15 s I/O-gräns och 60 s totalt; högst 1 GiB arkiv och 128 KiB kvitto. Bytes hashkontrolleras före atomisk lagring under `/tmp/croupier-moving-banks`, varje cacheträff återverifieras och korrupta filer skrivs aldrig över automatiskt.

## Bank per dealer i spelmotorn

Spelmotorn läser `CROUPIER_MOVING_SPEECH_BANK_RECORDS`, ett JSON-objekt med dealer-ID som nyckel och bankens privata manifest som värde:

```json
{"dragan": {"provider": "vercel-blob", "pathname": "croupier/media/dealers/dragan/runtime/moving-bank/<uuid>/<sha256>.json", "contentType": "application/json", "size": 1045, "sha256": "<sha256>"}}
```

Varje manifest ligger under dealerns egen `croupier/media/dealers/<dealerId>/runtime/moving-bank/`, och bankens källor måste tillhöra samma dealer. Varje dealer har exakt en driftprofil i `CROUPIER_STUDIO_MOVING_DRIFT_PROFILES` med `dealerId`, en egen endpoint och `bankHash` lika med bankarkivets SHA-256; alla använder samma image och `CROUPIER_MOVING_SPEECH_RELEASE_SHA256`. En ny dealer behöver alltså en egen endpoint med samma mall (min 0, max 1). Budgeten är per dealer (`<dealerId>-test-20261017`). Se [ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md#driftväljarens-api).

## Session och protokoll

Sätt `MOVING_CALLBACK_ORIGIN` till spelmotorns exakta HTTPS-origin. Jobbinput:

```json
{
  "schemaVersion": 1,
  "callbackUrl": "wss://approved-origin/lipsync-moving/<48-hex>?token=<64-hex>&avatar=dragan",
  "ttlSeconds": 180,
  "binding": {
    "schemaVersion": 1,
    "releaseSha256": "<64-hex>",
    "dealerId": "dragan",
    "workerAvatar": "dragan",
    "profileRevision": "<64-hex>",
    "sourceSetSha256": "<64-hex>",
    "avatarSha256": "<64-hex>",
    "bankReceiptSha256": "<64-hex>",
    "sessionId": "<owned-session>",
    "attemptId": "<reserved-attempt>",
    "nonce": "<64-random-hex>"
  }
}
```

Callbackadressen är en engångskapabilitet som aldrig loggas eller når webbläsaren. Workern skickar `pong` plus `attestation = {...binding, jobId}`. Servern jämför med ägare, profil, bank, fryst publicering, budgetreservation, accepterat jobb och verifierad image och svarar `{t:"bind", attestation}` med exakt samma objekt före start och PCM; fel bindning stoppar försöket. Därefter gäller start, PCM, end, lapp och done.

PCM är 24 kHz mono s16le. Antal planrutor är `(pcmBytes / 2 + 18000) // 1000` för jämnt byteantal, högst 600 (26000 byte ger 31 rutor, 64000 ger 50). En vilosekvens refererar alltid till ruta 0. `pong` annonserar `fps:24`, `ljud_fore_s:0.22`, `pad_after_s:0.53`, `del_rutor:12` och `chunk_ack:true`. Varje metadata/binär-par kräver `{t:"ack",id:<start.id>,del:<chunk.del>}` innan nästa skickas; saknad kvittens stoppar försöket inom 15 s, och `avbryt` fungerar även under kvittensväntan. Implicit loop eller fryst sista ruta accepteras inte, och minst 30 uppmätta rutor/s krävs.

## Startformer och cache

`runtime` läser en JSON-rad `{id, input}` från stdin och avslutas efter ett jobb. `serverless` startar RunPod SDK 1.12.0 med asynkron handler och högst en aktiv admission. Endpointen konfigureras separat: min 0 och max 1 worker, 180 s execution timeout och avgränsad idle-policy. Bank- och modellhashning och kall uppvärmning sker före callbackanslutningen; avbrott, frånkoppling, långsam mottagare och timeout stoppar motorprocessen innan avbrottet kvitteras. Journalen slutför alltid sin reservation och kontrollerar providerjobbet även om workern försvinner.

`EngineCache` ger en exklusiv lease och högst en motorprocess, med nyckel bunden till release, dealer, profilrevision, bankarkiv, bankkvitto och source-set. Varje jobb verifierar fortfarande release, bank och modellhashar; en träff ersätter bara modellrekonstruktionen och provar 30-fps-grinden med en kort syntetisk plan. Återanvändning kräver normal `done`, alla kvittenser, stängd callback och processens generationsbundna `idle`; fel, avbrott eller ändrad identitet stoppar processen. En ny eller nedskalad container är kall.

## Diagnostik

`diagnostics.py` samlar ett fast, sanerat schema per jobb, i providerresultatets `diagnostics` och som stderr-händelsen `moving_worker_diagnostics`. Det innehåller inga URL:er, tokens, taltexter, PCM eller godtyckliga undantag; saknade värden är `null`. Faserna skiljer bankcache, verifiering, modellhashning, uppvärmning, callback, PCM, rendering, överföring, kvittensväntan och städning, samt GPU-namn, RSS och högsta VRAM. Fasvärden överlappar och summeras inte. Providerkö och webbläsarens ljud och bild mäts utanför workern.

MuseTalks MIT-licens följer med dess pinnade checkout. Emils privata snapshot saknar separat licensfil; se källkvittot före extern distribution.
