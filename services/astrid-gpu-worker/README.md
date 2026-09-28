# astrid-gpu-worker

## Pågående strömningsversion, 2026-09-28

Den här arbetsgrenen innehåller ett nytt protokoll som tar emot PCM löpande och
skickar H264/AAC i fragmenterad MP4 innan hela repliken är färdig. Se
[implementationsstatus](docs/IMPLEMENTATION-HANDOFF.md) och
[reläets integrationsguide](gateway/README.md). Det är verifierat lokalt med
syntetiskt ljud/video, men ännu inte med riktig GPU eller Croupiers spelare.
GitLab-push är avstängd i denna klon. Äldre driftsättningsanvisningar nedan är
historik; de är inte instruktioner att återaktivera GitLab eller publicera på main.

GPU-arbetaren för Astrids läppsynk på **RunPod Serverless**. Samma MuseTalk 1.5-recept som
demopodden (stillbilden i 2x, munnen målad in i ett orört yuv-plan, ankarlås i ändarna) — men
GPU:n startar när någon är i rummet och släcks när det varit tomt en stund. **I vila kostar den
noll.** Ingen pod att hålla igång, ingen ssh-tunnel.

Webbdelen (chatt, Gemini, ElevenLabs, uppspelning) ligger i `astrid-lipsync-demo` och pratar
med den här endpointen via `RUNPOD_ENDPOINT_ID` + `RUNPOD_API_KEY` i sin `.env`.

---

## Sätta upp endpointen (en gång, ~30 min varav 20 är bygge)

Ni behöver: ett RunPod-konto med betalkort och det här repot på **GitLab** (eller GitHub).
Projektet ligger i dag under `EmaCodeHero/astrid-gpu-worker` med er som Maintainers — flytta det
in i `scout-gg` när ni vill (**Settings → General → Advanced → Transfer project**); registry-
sökvägen byter då namn, så bygg om och peka endpointen på den nya taggen efteråt.

Två vägar till en färdig image — välj den som passar var repot ligger:

| | GitLab (er standard) | GitHub |
|---|---|---|
| Vem bygger | GitLab CI (`.gitlab-ci.yml`, kaniko) | RunPod själv |
| Var imagen hamnar | `registry.gitlab.com/<grupp>/astrid-gpu-worker` | RunPods eget register |
| RunPod-endpointen skapas från | *Docker image* + registry-inloggning | *Git repository* |
| Nytt bygge | varje push till `main` → CI → peka endpointen på nya taggen | varje push → RunPod bygger om |

### Väg A — GitLab

**A1. Repot.** Finns redan (se ovan). `.gitlab-ci.yml` bygger vid varje push till `main`:
pipelinen bygger imagen och pushar `registry.gitlab.com/<namespace>/astrid-gpu-worker:<sha>`
och `:latest`.
Första bygget ~20 min (vikterna hämtas), sedan ~3 min på cache. Kontrollera under
**Deploy → Container Registry** att taggarna finns.

Kräver att projektet har Container Registry påslaget (standard på gitlab.com) och en runner
med ≥ 40 GB disk — CI-filen begär gitlab.com:s `saas-linux-medium-amd64`. Självhostad
GitLab: byt `tags:` till er runner.

**A2. Deploy-token** så RunPod får läsa registret: **Settings → Repository → Deploy tokens →
Add token**, namn `runpod`, scope **`read_registry`** (inget mer). Spara användarnamn +
token — de visas bara en gång.

**A3. Registry-inloggning i RunPod.** RunPod-konsolen → **Settings → Container Registry
Auth → Add**: namn `gitlab`, registry `registry.gitlab.com`, användarnamn + token från A2.

**A4. Endpointen.** **Serverless → New Endpoint → Import from Docker Registry**:

| Inställning | Värde |
|---|---|
| Container image | `registry.gitlab.com/<grupp>/astrid-gpu-worker:<sha>` (ta taggen ur CI-loggen; `:latest` går men RunPod kan ha en gammal `latest` cachad) |
| Registry credentials | `gitlab` (från A3) |
| Container disk | 20 GB |
| övriga inställningar | tabellen under *Inställningar* nedan |

**Nytt bygge senare:** pusha → CI bygger → peka endpointen på nya sha-taggen (konsolen:
Endpoint → **Edit** → tagg → Save; eller `npm run skapa:endpoint -- <image:tagg>` i demopaketet)
→ **Terminate workers** (konsolen, eller `npm run terminera`). Det sista är inte valfritt:
RunPod låter befintliga arbetare — även exited — leva kvar med gamla imagen, och de tar nästa
jobb (uppmätt 2026-09-22).

### Väg B — GitHub

**B1.** Privat repo, pusha mappen. **B2.** RunPod → **Settings → Connections → GitHub →
Connect**, ge åtkomst till repot. **B3.** **Serverless → New Endpoint → Import Git
Repository**: repot, branch `main`, Dockerfile `Dockerfile`, plus inställningarna nedan.
RunPod bygger (~20 min första gången) och bygger om vid varje push till `main`.

### Inställningar (båda vägarna)

| Inställning | Värde | Varför |
|---|---|---|
| Endpoint name | `astrid-lipsync` | |
| **GPU** | **RTX 4090** (24 GB) — lägg till **L40S** som andrahand | Imagen är cu121. **Välj INTE 5090** (sm_120, startar inte). |
| Workers max | **2** | En för sessionen + en för förnyelsen som beställs strax före ttl. |
| Workers active (min) | **0** | Noll i vila. Sätt **1** en timme före ett bokat demo så första svaret slipper kallstart. |
| **Idle timeout** | **60 s** | Så att en arbetare som just svarat hänger kvar för nästa fråga. |
| **Execution timeout** | **600 s** | Sessionen är ett jobb på 540 s (+45 s för att avsluta ett pågående yttrande). Kortare = sessionen dör mitt i. |
| FlashBoot | **på** | Snabbare kallstart när en arbetare nyss kört. |
| Scale type | Queue delay, 4 s | standard |
| Env | (ingen krävs) `AVATAR_ID=astrid_talk2x` är satt i imagen | |

### API-nyckel

**Settings → API Keys → Create** — behörighet *Restricted* räcker om den får köra serverless-
endpoints (annars *All*). Kopiera nyckeln; den visas bara en gång.

### Prova

I `astrid-lipsync-demo`:

```bash
# .env
RUNPOD_ENDPOINT_ID=<endpoint-id från konsolen, t.ex. abc123xyz>
RUNPOD_API_KEY=<nyckeln>
```

```bash
node verktyg/kolla-endpoint.mjs      # läser endpointens inställningar och säger vad som avviker
node verktyg/prova-serverless.mjs    # kallstart → första klippet → varmt klipp, med tider
```

`prova-serverless` skriver två klipp till `web/answers/prov-serverless-1.mp4` och `-2.mp4` —
öppna dem och kontrollera att det är Astrid och att bakgrunden är stilla.

---

## Hur det fungerar i drift

```
besökare 1 ansluter ──▶ demoservern beställer en SESSION (ett jobb, 540 s)
                             │
                             ▼  kallstart 35–60 s (varm arbetare: sekunder)
                        arbetaren ringer UPP demoservern: wss://<publik adress>/lipsync-worker
                             │
   fråga → Gemini → ElevenLabs ─PCM─▶ arbetaren ─mp4─▶ alla i rummet      ~3–4 s per svar
                             │
                        150 s före ttl beställs nästa session; ny arbetare tar över mellan två svar
                             │
sista besökaren lämnar ──▶ 10 min grace ──▶ "bye", kön rensas, GPU:n stannar. Kostnad: 0.
```

**Första svaret efter vila** går jobbvägen (`/run` med hela ljudet) medan sessionen startar, och
tar alltså kallstarten + klippet — räkna med **upp till en minut**. Demot visar "Astrid vaknar" under
tiden. Sedan ligger varje svar på pod-nivå.

Utan publik adress (ingen `npm run share`, ingen `SESSION_URL`) körs bara jobbvägen: fungerar,
men varje svar kostar ett RunPod-jobb extra (~0,5–1 s) i stället för en stående socket.

## Kostnad

Listpris RTX 4090 serverless ≈ **$0,69/timme** per arbetare, sekundbaserat, bara medan den
kör. Ett demo på en timme med folk i rummet ≈ $0,70–1,40 (en eller två arbetare under
förnyelsen). Tom lobby = 0. Idle timeout på 60 s betalas efter varje jobb.

## API (endpointens `/run` + `/status/<id>`)

```jsonc
{"input": {"op": "health"}}                                        // → {"warm": {...}, "error": null}
{"input": {"op": "lipsync", "wav_b64": "<wav 16-bit PCM>"}}        // → {"mp4_b64", "frames", "t": {whisper, gen_enc, mux}}
{"input": {"op": "session", "ws_url": "wss://…/lipsync-worker?token=…", "ttl": 540}}
```

`crf`/`preset` styr x264 för `lipsync` (standard 18 / veryfast; sessionen kör 19 / ultrafast).
Ljudet ska vara **mono 16-bit PCM**; samplingsfrekvens spelar ingen roll (resamplas till 16 kHz).

## Byta stillbild

Imagen bär två avatarer, valda med env `AVATAR_ID` på templaten:

| `AVATAR_ID` | Stillbild | Vad |
|---|---|---|
| `astrid_talk2x` (standard) | `assets/talk_base.png` (1440×1440) | demots ursprungliga bild |
| `astrid_spel2x` | `assets/astrid_spel2x/talk_base.png` (1080×1920) | spelets startbild = H3:s ruta 0 (`ankare/astrid_startbild_spel_1080x1920.png`); klippen är hela spelbilden och börjar/slutar exakt i den |

En ny avatar = en mapp `assets/<id>/` med `talk_base.png` + `.yuv` och en `prepare_avatar`-rad i Dockerfile.

Byt `assets/talk_base.png` (1x) och `assets/talk_base.yuv` (samma bild som råa yuv420p-plan, BT.709,
tv-range) och pusha — imagen byggs om och avataren byggs på nytt i bygget. yuv-planet görs så:

```bash
ffmpeg -i talk_base.png -vf "scale=out_color_matrix=bt709:out_range=tv" -pix_fmt yuv420p -f rawvideo talk_base.yuv
```

Filstorleken ska vara exakt `bredd × höjd × 1,5` byte — motorn vägrar starta annars.

## Dyrköpta lärdomar (från JEP-arbetaren detta bygger på)

- **cu121-imagen kör inte på 5090.** 4090/L40S.
- **apt-ffmpeg, inte condas.** `/opt/conda/bin/ffmpeg` saknar libx264 — motorn pekar explicit på `/usr/bin/ffmpeg`.
- **Kallstart > 20 s.** Klienten måste ha budget för ~60 s på första jobbet, annars faller varje första svar.
- **`/run` + statuspoll, inte `/runsync`.** En lång `/runsync` bryts av klientens timer mitt i kallstarten och jobb-id:t tappas.
- **Execution timeout < 600 s dödar sessionen** mitt i ett svar. Sätt 600.
- **Ett bygge triggas av varje push till `main`** (GitLab CI eller RunPod). Pusha inte halvfärdigt.
- **`:latest` kan vara cachad hos RunPod.** Peka endpointen på sha-taggen när ni vill vara säkra på att få nya bygget.
- **Terminate workers** i konsolen efter ett nytt bygge — annars kör gamla imagen tills idle-cykeln löpt ut.

## Ursprung och licens

MuseTalk 1.5 (MIT) från [TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk), pinnad till
commit `0a89dec` (2025-09-26). Landmärken via MediaPipe (Apache 2.0) — DWPose (icke-kommersiell)
används inte. Koden i `workers/` och `handler.py` härstammar från jep-live-blackjacks GPU-arbetare.
Stillbilden i `assets/` tillhör uppdragsgivaren.
