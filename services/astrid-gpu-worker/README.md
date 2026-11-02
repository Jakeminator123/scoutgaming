# astrid-gpu-worker

Status: live, avvecklas vid ren start (clean slate). Astrids avatarer och fullfilsväg tas bort då; `gateway/`-modulerna importeras av spelmotorn för allt genererat tal och flyttas innan katalogen kan raderas.

MuseTalk-worker för läppsynk och de strömningsmoduler spelmotorn använder. Katalognamnet kommer från Astrids ursprungliga implementation; sessionsvägen tar också registrerade dealers med egna verifierade referensbilder. Ursprung i [SOURCE.md](SOURCE.md). Dragans rörliga tal har en egen worker i [moving-gpu-worker](../moving-gpu-worker/README.md).

## Delar

| Del | Ansvar |
| --- | --- |
| `handler.py`, `workers/`, `assets/`, `Dockerfile` | RunPod-worker, MuseTalk och bildförberedelse. De två Astrid-avatarerna används av fullfilsvägen. |
| [`gateway/`](gateway/README.md) | WebSocket-relä, biljetter, workerbindning och PCM-adaptrar för Cartesia och ElevenLabs. Importeras av spelmotorn. |
| [`services/game/generated-speech-stream.mjs`](../game/generated-speech-stream.mjs), [`dealer-speech-runtime.mjs`](../game/dealer-speech-runtime.mjs) | Spelmotorns integration: dealerprofil, sessionens ägare, åtkomst, röst och exakt referensbild. |
| [`services/game/speech-journal-runtime.mjs`](../game/speech-journal-runtime.mjs) | Budget, RunPod-jobb och workerberedskap. |

Workern väljer inte svarstext, spelregler, bolag eller rum. Ett godkänt CPU-prov bevisar inte vilken image en GPU-endpoint kör, pris eller läppsynk.

## Bygge och leverans

- [Croupier CI](../../.github/workflows/croupier.yml) kör relä- och Python-prov, kompilering och shellsyntax, utan betalda GPU-jobb.
- [GPU image build check](../../.github/workflows/astrid-gpu-build.yml) (manuell) bygger med denna katalog som Docker-kontext och kontrollerar båda avatarernas förberedelse.
- [Private image publish](../../.github/workflows/astrid-gpu-publish.yml) (manuell, bara från `main`) publicerar `ghcr.io/jakeminator123/astrid-gpu-worker`, taggad med full commit-SHA och med digest för privat pull och återgång.

En publicerad image byter inte RunPod-endpoint och godkänner inget GPU-prov.

## Workerprotokoll

[`handler.py`](handler.py) har fullfilsvägen och sessionsvägen. RunPods jobbpayload omsluter kommandot med `input`:

```jsonc
{"input":{"op":"health"}}
{"input":{"op":"lipsync","wav_b64":"<base64 WAV med PCM16 mono>"}}
{"input":{"op":"session","ws_url":"wss://<relä>/lipsync-worker","ws_token":"<privat worker-token>","worker_id":"<unikt worker-id>","ttl":540}}
```

`lipsync` returnerar `mp4_b64`, `frames` och `t` (valfria `crf` 18 och `preset` `veryfast`). Sessionens worker-token skickas i autentiseringsheadern, aldrig i URL:en. Sessionsworkern tar löpande PCM och svarar med synkron H.264/AAC i fragmenterad MP4. Reläets meddelanden, ägarbindning, biljetter och gränser står i [gatewayguiden](gateway/README.md).

## Avatarer

Dockerbygget förbereder `astrid_talk2x` och `astrid_spel2x`; `AVATAR_ID` väljer avatar för `lipsync` och `faces`, som inte tar en annan dealers `avatar`.

### Förlustfri lagring av de befintliga avatarerna

De fyra byggindatafilernas sammanlagda storlek är 2 947 010 byte i Git, jämfört
med 8 424 302 byte före packning (65,0 % mindre). Två motiv finns i varsin PNG-
och YUV-version: närbilden är 1440×1440 och bilden med blackjackbordet 1080×1920.

| Fil under `assets/` | Ursprungliga byte | Lagrade byte |
| --- | ---: | ---: |
| `talk_base.png` | 575 074 | 575 074 |
| `talk_base.yuv.xz` | 3 110 400 | 312 748 |
| `astrid_spel2x/talk_base.png.xz` | 1 628 428 | 1 473 524 |
| `astrid_spel2x/talk_base.yuv.xz` | 3 110 400 | 585 664 |

XZ-filerna är packade med Python-standardbibliotekets `lzma.compress(data,
preset=6)`. Den mindre PNG-filen behåller sin befintliga komprimering eftersom
ytterligare XZ-packning gör den större. Inga bilder kodas om och inga pixlar,
YUV-plan eller färginställningar ändras.

Dockerbygget använder BuildKit för att montera `assets/` som indata till
[`restore_assets.py`](workers/restore_assets.py). Skriptet verifierar storlek
och SHA-256 för alla fyra original innan det skriver samma PNG-/YUV-sökvägar
under `/workspace/avatar` som arbetaren redan läser. Saknade, skadade eller
utbytta filer stoppar bygget. De packade indatafilerna kopieras inte in i ett
extra imagelager. Runtime använder fortfarande 8 424 302 byte; besparingen
gäller Git-trädet och byggkontexten, inte GPU-minne, modellvikter eller äldre
Git-historik. Gateway, registrerade dealers, spelregler och Neon/Blob berörs inte.

För lokal inspektion, med en separat utdatakatalog:

```sh
python services/astrid-gpu-worker/workers/restore_assets.py services/astrid-gpu-worker/assets /tmp/astrid-avatar
python -m unittest discover -s services/astrid-gpu-worker/tests -p test_restore_assets.py -v
```

Detta är komprimering av kvarvarande byggindata, inte Astrids avveckling eller
ett nytt bevarandekrav. Den fullständiga GPU-imagen byggs och publiceras fortfarande
genom de manuella arbetsflödena ovan; CPU-provet visar exakt byteåterställning,
inte GPU-driftacceptans.

För registrerade dealers skickar spelmotorn en serverägd `avatar` med `schemaVersion: 1`, `dealerId`, `profileRevision`, `imageSha256` och `imageBase64`. Bilden är en hashverifierad PNG i 1080×1920; `workers/dealer_avatar.py` förbereder och städar den. Workeranslutningen binder dealer, profilrevision och bildhash med protokoll 3, medan webbläsarens medieflöde behåller protokoll 2 och namnet `astrid-v2` för kompatibilitet. Röst och referensbild kommer från dealerns registrerade profil.

Syntetisk video, första fragment eller ett lyckat bildbygge godkänner inte läppsynk; ändrade bild-, ljud- eller videobytes kräver ny granskning.

```sh
npm --prefix services/astrid-gpu-worker/gateway test
python -m unittest discover -s services/astrid-gpu-worker/tests -v
python services/astrid-gpu-worker/tests/bench_first_fragment.py --runs 5
```

Det sista provet är en lokal FFmpeg-baslinje för första hela `moof`+`mdat`-fragmentet, utan MuseTalk, TTS, nätverk eller GPU.

## Ursprung och licens

MuseTalk 1.5 (MIT) från [TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk), pinnad till `0a89dec`. Landmärken via MediaPipe (Apache 2.0). `workers/` och `handler.py` härstammar från jep-live-blackjacks GPU-worker via Emils import. Stillbilderna tillhör uppdragsgivaren.
