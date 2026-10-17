# Gemensam rörlig talworker

Separat förberedelse för Dragan och senare andra registrerade dealerbanker.
Astrids service, image och endpoint berörs inte. Den importerade renderaren är
exakt Emils granskade `rorlig-9`; `source.json` binder originalhashar till
det lokala WSL-provet. Ingen ny TTS, textmodell eller produktdatabas ingår.

## Bygga och verifiera

Kör från denna katalog:

```sh
python -B -m unittest discover -s tests -v
python build.py --target runtime --tag croupier-moving-worker:local
python build.py --target serverless --tag croupier-moving-worker:serverless
```

Bygget använder pinnad Ubuntu-digest/snapshot, Python 3.12.3, alla 70 paket
från det verifierade lokala renderingsprovet, egna hashade SDK-tillägg och
MuseTalk-commit `0a89dec45a0192b824e3cf4daf96c239440c5ed8`. Modellfiler
hämtas från fasta revisioner och avvisas om storlek eller SHA-256 avviker.
Inga bankfilmer eller nycklar byggs in. Byggkommandot gör aldrig push/deploy.

`release.json` binder runtimekällor, recept och låsfiler. Efter granskade
ändringar: kör tester, `python seal_release.py` och kontrollera igen.
Det är en kodreleaseidentitet; kontrollplanet måste dessutom verifiera den
faktiskt driftsatta imagens digest. Koden kan inte attestera sin egen
containerdigest enbart genom ett fält i jobbets input.

Dockerbygge, verklig GPU-körning och livespel är ännu inte verifierade.
`build-contract.json` dokumenterar denna gräns. CPU-tester startar ingen GPU.

## Bank och session

Montera `/banks` read-only med `<avatarSha256>.tar` och
`<bankReceiptSha256>.json` från den förberedda bankens arkiv/kvitto.
Använd den fulla verifierade banken; det lokala 66-rutorsprovet är en annan
härledning. Alla sju filer, källmanifest, ägare, karta och ansiktsmetadata
kontrolleras innan Torch får läsa den betrodda latentfilen.

Sätt `MOVING_CALLBACK_ORIGIN` till spelmotorns exakta HTTPS-origin.
Jobbinput har exakt:

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

Callbackadressen är en engångskapabilitet och får inte loggas eller nå
webbläsaren. Workern skickar befintlig `pong` plus
`attestation = {...binding, jobId: faktisk-provider-jobbidentitet}`.
Servern jämför detta med aktuell ägare/profil/bank, fryst publicering,
egen budgetreservation, accepterat jobb och verifierad image, och skickar
`{t:"bind", attestation:exakt-samma-objekt}` före start/PCM. Fel bindning
stoppar försöket. Därefter används befintliga start/PCM/end/lapp/done.
Ingen URL-baserad ljudhämtning eller fristående godtycklig upload exponeras.

PCM är 24 kHz mono s16le. Exakt antal planrutor måste vara
`floor((pcmBytes / 48000 + 0.22 + 0.53) * 24)`, högst 600.
`pong` annonserar `fps:24`, `ljud_fore_s:0.22`, `pad_after_s:0.53`
och `del_rutor:12`. En sekund PCM kräver 42 planrutor. Implicit looping
eller fryst sista ruta accepteras inte. Minst 30 uppmätta rutor/s krävs;
desktopprovets `MIN_RUTOR=0` används aldrig här.

## Två startformer

`runtime` läser en JSON-rad/envelope `{id, input}` från stdin och avslutas
efter ett jobb. Den betrodda pod-/containerlaunchern tillför faktiskt jobb-ID.

`serverless` startar RunPod SDK 1.12.0 med asynkron handler, högst en aktiv
admission och samma verifiering. SDK-version och samtliga tilläggswheels är
låsta separat. Endpoints måste konfigureras separat: min 0/max 1 worker,
180 sekunders execution timeout och avgränsad idle-policy. Dessa inställningar
är ett underlag, ingen genomförd providerändring. Adaptern behöver ingen
egen RunPod API-nyckel.

Bank/modelhashning och kall uppvärmning sker före callbackanslutningen.
Servern behöver begränsad startupfrist innan första pong; normal I/O har
15 sekunders gräns och hela jobbet högst 180 sekunder. Avbrott,
frånkoppling, långsam mottagare och timeout stoppar jobbets egen motorprocess
innan avbrott kvitteras. Journalen måste alltid slutföra just sin reservation
och kontrollera providerjobbet även om workern försvinner.

## Återstående aktivering

Bygg och prova den nya imagen i isolerad miljö före publicering/omkoppling.
Mät kall/varm första ljud- och bildruta, faktisk cancellationkostnad och
visuell läppsynk. Förena med autentiserad talsession, dynamisk OpenClaw-text,
befintlig röst-/TTS-adapter, serverns omplanering och spelarens ljudklocka.
En image per gemensam motor kan användas för olika hashbundna dealerbanker;
denna version kör ett jobb/uttalande åt gången och gör ingen dold bankcache.

MuseTalks MIT-licens följer med dess pinnade checkout. Emils privata snapshot
saknar separat licensfil; se källkvitto före eventuell extern distribution.
