# astrid-gpu-worker

MuseTalk-worker för läppsynk och återanvändbara streamingmoduler i
`Jakeminator123/scoutgaming` på `main`. Katalognamnet kommer från Astrids
ursprungliga implementation; sessionsvägen stöder också registrerade dealers
med egna verifierade referensbilder. Exakt upstream och lokal härkomst
finns i [SOURCE.md](SOURCE.md); den äldre importens testkvitton finns i
[implementationshistoriken](docs/IMPLEMENTATION-HANDOFF.md).

## Ansvar och kopplingar

| Del | Ansvar |
| --- | --- |
| `handler.py`, `workers/`, `assets/`, `Dockerfile` | RunPod-worker, MuseTalk och bildförberedelse. De två medföljande Astrid-avatarerna behövs av den bevarade fullfilsvägen. |
| `gateway/` | WebSocket-relä, biljetter, workerbindning och PCM-adaptrar för Cartesia/ElevenLabs. Modulerna importeras av spelservern; `server.mjs` och referensspelaren är separata protokollfixturer. |
| [`services/game/generated-speech-stream.mjs`](../game/generated-speech-stream.mjs), [`services/game/dealer-speech-runtime.mjs`](../game/dealer-speech-runtime.mjs) | Spelserverns integration: aktuella dealerprofiler, sessionens ägare, åtkomst, röst och exakt referensbild. |
| [`services/game/speech-journal-runtime.mjs`](../game/speech-journal-runtime.mjs) | Molnsessionens budget, RunPod-jobb och workerberedskap. |

Workern väljer inte svarstext, spelregler, bolag eller rum. OpenClaw och
Lab/admin använder andra moduler för rådgivning och administration; detta är
talets GPU- och transportdel. Importerna ovan gör att katalogen behöver
finnas kvar i samma repo. Katalogens `docs/` är importhistorik, inte en separat
produktplan eller instruktion att starta ännu en backoffice.

Aktuell drift, QA och återstående AI/GPU-acceptans finns i
[molnkartan](../../docs/CLOUD-MIGRATION.md) och
[John-handoffen](../../docs/JOHN-HANDOFF.md). Denna katalog eller ett godkänt
CPU-test bevisar inte vilken image en GPU-endpoint kör, pris, visuell läppsynk
eller godkänd produktionsaktivering.

## Bygge och leverans

- [Croupier CI](../../.github/workflows/croupier.yml) kör relä-/Python-tester,
  kompileringskontroll och shellsyntax. Den startar inga betalda GPU-jobb.
- [GPU image build check](../../.github/workflows/astrid-gpu-build.yml) är
  manuell och bygger med denna katalog som Docker-kontext. Båda avatarernas
  förberedelser och workerimport kontrolleras utan att starta GPU-handlern.
- [Private image publish](../../.github/workflows/astrid-gpu-publish.yml) är
  manuell, endast från `main`, och kräver exakt mål
  `ghcr.io/jakeminator123/astrid-gpu-worker`. Imagen verifieras före push,
  taggas med full commit-SHA och redovisar digest för privat pull och återgång.

Ingen image publiceras genom en vanlig Git-push. En publicerad image byter
inte automatiskt RunPod-endpoint eller godkänner GPU-provet. Kontrollera den
faktiskt körda imagen, privat åtkomst, kostnadsram och stoppläge innan ett
uttryckligt liveprov. GitLab-CI och dess gamla deploy-token-/registry-steg är
borttagna; GitLab-URL:en i SOURCE är upstream-proveniens.

## Workerprotokoll

[`handler.py`](handler.py) behåller fullfilsvägen och sessionsvägen. RunPods
jobbpayload omsluter kommandot med `input`:

```jsonc
{"input":{"op":"health"}}
{"input":{"op":"lipsync","wav_b64":"<base64 WAV med PCM16 mono>"}}
{"input":{"op":"session","ws_url":"wss://<relä>/lipsync-worker","ws_token":"<privat worker-token>","worker_id":"<unikt worker-id>","ttl":540}}
```

`lipsync` returnerar `mp4_b64`, `frames` och `t`; valfria `crf` och `preset`
har kodens standardvärden 18 respektive `veryfast`. Sessionens worker-token
skickas i autentiseringsheadern, aldrig som queryparameter. Sessionsworkern
stöder löpande PCM-in och synkron H264/AAC i fragmenterad MP4. Reläets exakta
kontrollmeddelanden, ägarbindning, engångsbiljetter, avbrott och gränser finns i
[gatewayguiden](gateway/README.md).

Croupier använder sin gemensamma spelare i `services/game/public`, med samma talkö,
idlegrindar och kvitton för registrerade dealers. Referensspelaren i `gateway`
är för isolerad protokollverifiering. Ett streamingkvitto är inte en godkänd,
hashverifierad fullfilstake.

## Avatarer och validering

Dockerbygget förbereder `astrid_talk2x` och `astrid_spel2x`; `AVATAR_ID`
väljer den medföljande avataren. `lipsync` och `faces` använder denna äldre
fullfilsväg och accepterar inte en ny dealers `avatar`.

För registrerade dealers skickar spelservern en serverägd `avatar` med
`schemaVersion: 1`, `dealerId`, `profileRevision`, `imageSha256` och
`imageBase64` i sessionsjobbet. Bilden måste vara en hashverifierad 1080×1920
PNG; `workers/dealer_avatar.py` förbereder och städar den tillfälliga avataren.
Workeranslutningen binder dealer, profilrevision och bildhash med protokoll
3. WebSocket-medieflödet använder fortsatt protokoll 2 och `astrid-v2` som
kompatibilitetsnamn; det innebär inte att en annan dealer använder Astrids bild.
Röst och referensbild hämtas från den aktuella registrerade dealerprofilen,
inte från en ungefärlig klipplängd eller ett namn i en legacy-mapp.

Bevara exakta bild-/ljud-/videohashar och kalibrering vid
ändringar. Bygg ersättningstakes separat och följ repo-reglerna för
mediaaudit och två uppspelningar av varje dealer. Syntetisk video,
första fragment eller lyckat bildbygge godkänner inte läppsynken.

Kör från reporoten:

```sh
npm --prefix services/astrid-gpu-worker/gateway test
python -m unittest discover -s services/astrid-gpu-worker/tests -v
```

## Ursprung och licens

MuseTalk 1.5 (MIT) från [TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk),
pinnad till `0a89dec` (2025-09-26). Landmärken via MediaPipe (Apache 2.0);
DWPose används inte. `workers/` och `handler.py` härstammar från
jep-live-blackjacks GPU-worker via Emils import. Stillbilderna tillhör
uppdragsgivaren. [Upstream- och latenshistoriken](docs/UPSTREAM-AND-LATENCY.md)
bevarar importkvitton och de syntetiska mätningarnas begränsningar.
