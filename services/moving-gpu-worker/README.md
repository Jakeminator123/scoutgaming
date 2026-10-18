# Gemensam rörlig talworker

Separat förberedelse för Dragan och senare andra registrerade dealerbanker.
Astrids service, image och endpoint berörs inte. Den importerade renderaren är
Emils granskade `rorlig-9` med avgränsade protokollpatchar för rutantal och
vilorutans identitet; `source.json` bevarar originalhasharna från WSL-provet
och beskriver avvikelserna. Modell-, blandnings- och kodningsreceptet är oförändrat. Ingen ny TTS, textmodell eller produktdatabas ingår.

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

Den minimala Ubuntu-basen saknar CA-certifikat. BuildKit hämtar först ett
exakt hashbundet Ubuntu-CA-paket från samma snapshot och bygger dess
certifikatbunt före HTTPS-apt. Paketets hash är verifierad via Ubuntus
signerade paketindex; ingen TLS- eller arkivsignaturkontroll stängs av.
`apt-get update` avbryter vid varje hämtningsfel, även partiella fel.

`release.json` binder runtimekällor, recept och låsfiler. Efter granskade
ändringar: kör tester, `python seal_release.py` och kontrollera igen.
Det är en kodreleaseidentitet; kontrollplanet måste dessutom verifiera den
faktiskt driftsatta imagens digest. Koden kan inte attestera sin egen
containerdigest enbart genom ett fält i jobbets input.

Aktuell verifieringsstatus ligger utanför det förseglade byggkontraktet.
CI-kvitton måste ange exakt release och image; GPU-, livespels- och
bild/ljudskvitton tillkommer separat enligt `verificationRequirements` i
`build-contract.json`. Ett lyckat CPU-bygge innebär ingen publicering eller
GPU-/läppsynkverifiering. CPU-tester startar ingen GPU.

## Privat publicering

`.github/workflows/moving-gpu-publish.yml` publicerar bara det nya paketet
`ghcr.io/jakeminator123/moving-gpu-worker`. Manuell dispatch kräver exakt
mål, granskat fullständigt commit-SHA och release-SHA. Dispatch är begränsad
till `main` eller `codex/dragan-openclaw-live`; branchens frysta dispatch-SHA
måste matcha inmatningen. GitHub kräver att workflowen finns på defaultbranchen
innan den kan dispatchas, så den första publiceringen kan kräva en separat PR.

Både lokala kontrakt och den faktiskt byggda serverless-imagen provas före
registry-inloggning. `packages:write` finns bara på publiceringsjobbet;
`GITHUB_TOKEN` används endast för registry/API och skickas aldrig till
Dockerbygget eller imagen. Befintligt paket måste vara privat, och privat
synlighet kontrolleras igen efter push. Använd kvittots `@sha256:`-referens
vid separat RunPod-konfiguration; SHA-taggen ensam är ingen immutabilitetsgaranti.
Publicering skapar ingen endpoint och kör ingen GPU.

## Bank och session

Montera `/banks` read-only med `<avatarSha256>.tar` och
`<bankReceiptSha256>.json` från den förberedda bankens arkiv/kvitto.
Använd den fulla verifierade banken; det lokala 66-rutorsprovet är en annan
härledning. Alla sju filer, källmanifest, ägare, karta och ansiktsmetadata
kontrolleras innan Torch får läsa den betrodda latentfilen.

Alternativt kan servern tillföra `bankDownload` i jobbinput:

```json
{
  "schemaVersion": 1,
  "archive": {"url": "https://approved-origin/bank/archive?cap=<one-use>", "sha256": "<avatarSha256>", "bytes": 594432000},
  "receipt": {"url": "https://approved-origin/bank/receipt?cap=<one-use>", "sha256": "<bankReceiptSha256>", "bytes": 1045}
}
```

Descriptorhasharna måste matcha jobbets binding. Endast HTTPS med samma
hostname och effektiva port som callback tillåts; inga redirects,
komprimerade svar eller proxyupptäckt. Servern binder kortlivade capabilities
till jobb/session och svarar med status 200 och exakt `Content-Length`.
En HTTP-mellanhand kan överföra svaret med `Transfer-Encoding: chunked`;
workern avkodar då delarna innan storlek och SHA-256 kontrolleras mot jobbets
descriptor. Både fast längd och chunked kräver exakt samma verifierade byte.
Motstridiga längdhuvuden, andra kodningar, avbrutna eller för stora svar
avvisas. Chunkrader och trailers är begränsade; trailers kan inte ändra
längd, kodning eller den förväntade hashen. Se [HTTP/1.1 RFC 9112 §7.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1).
Workern hämtar kvitto först, sedan arkiv, med 15 sekunders
I/O-gräns och totalt 60 sekunder inom jobbets vanliga TTL. Maxgränser är
1 GiB arkiv och 128 KiB kvitto; inga allmänna Blobnycklar skickas.

Bytes hashkontrolleras före atomisk lagring under `/tmp/croupier-moving-banks`
och före ordinarie bankverifiering/extraktion. Varje cacheträff återverifieras;
korrupta eller avvikande filer avvisas och skrivs aldrig över automatiskt.
Timeout/avbrott tar bort just den egna ofärdiga filen. Cacheinnehåll lever
bara i containerns temporära lagring; bankoriginal och modellfiler ändras inte.

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
`(pcmBytes / 2 + 18000) // 1000` för jämnt byteantal, högst 600.
Beräkningen använder heltal: 26000 byte ger 31 rutor, 64000 ger 50.
En vila-sekvens refererar alltid till ruta 0, även över flera chunkar.
`pong` annonserar `fps:24`, `ljud_fore_s:0.22`, `pad_after_s:0.53`
och `del_rutor:12`, samt `chunk_ack:true`. Varje metadata/binär-par kräver
exakt `{t:"ack",id:<start.id>,del:<chunk.del>}` innan nästa bit skickas.
Servern kvitterar efter sin begränsade konsument; fel/saknad kvittens stoppar
försöket inom 15 sekunder och hela jobbets TTL. `avbryt` fungerar även under
kvittensväntan. En sekund PCM kräver 42 planrutor. Implicit looping
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

## Diagnostik och verklig varm/kall körning

`diagnostics.py` samlar ett fast, sanerat schema per jobb. Samma snapshot finns
i providerresultatets `diagnostics` och en stderr-rad med event
`moving_worker_diagnostics`. Det ingår i den förseglade releasen. Diagnostiken
är inte auktorisering och innehåller inga URL:er, capabilitytokens, taltexter,
PCM eller godtyckliga undantag. Saknade mätvärden är `null`.

Faserna skiljer bankcache/hämtning, extraktion+verifiering, modellhashning,
process/importer, modell/avatar/uppvärmning, callback/bindning, PCM, rendering,
överföring, kvittensväntan och cleanup. Modell/avatar/uppvärmning är en samlad
fas eftersom vendor-motorn äger dessa steg. GPU-namn/kapacitet, host-RSS och
Torchs högsta VRAM-användning läses utan en ny CUDA-kontext. Renderwall kan
inkludera IPC/backpressure; fasvärden överlappar och får inte summeras till en
påhittad total. Providerkön och webbläsarens ljud/bild mäts utanför workern.

Bankarkivet kan överleva i samma containers temporära cache. Däremot skapas
en ny extraktion och motorprocess för varje jobb; modellen återanvänds inte
mellan repliker. `workersMin=1` ensamt gör alltså inte modellen varm. En framtida
modellcache kräver exklusiv lease och full identitet, samt processavveckling
vid avbrott/fel/bankbyte. Den här diagnostikändringen inför ingen sådan cache
och ändrar inte rendering eller callbackprotokoll.

## Återstående aktivering

Bygg och prova den nya imagen i isolerad miljö före publicering/omkoppling.
Mät kall/varm första ljud- och bildruta, faktisk cancellationkostnad och
visuell läppsynk. Förena med autentiserad talsession, dynamisk OpenClaw-text,
befintlig röst-/TTS-adapter, serverns omplanering och spelarens ljudklocka.
En image per gemensam motor kan användas för olika hashbundna dealerbanker;
denna version kör ett jobb/uttalande åt gången, med den uttryckliga arkivcachen
ovan men utan delad extraktions- eller modellcache.

MuseTalks MIT-licens följer med dess pinnade checkout. Emils privata snapshot
saknar separat licensfil; se källkvitto före eventuell extern distribution.
