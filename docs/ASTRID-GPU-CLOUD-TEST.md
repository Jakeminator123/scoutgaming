# Astrid: molnströmning, konfiguration och GPU-prov

**Uppdaterat 2026-09-29. Ingen image publicerad, ingen GPU startad och inget
molnflöde godkänt.** Källan ligger kvar i `services/astrid-gpu-worker` i
`Jakeminator123/github-work`, branch `jakemanator123-github-work`. MuseTalk 1.5
och den nuvarande avataren är utgångspunkt.

## Faktisk kedja och mätpunkter

`/chat` inväntar fortfarande **hela** OpenClaw-beslutet och dess exakta text.
Först därefter utfärdar Web en signerad strömbiljett. Klienten inväntar sin
spelartur/position, öppnar `/speech-stream` med sessionscookie och biljett,
och Web startar Cartesia. PCM går direkt till den anslutna workern. MuseTalk
skapar munrutorna, FFmpeg lägger dem över avataren och kodar H264/AAC som
fragmenterad MP4. Den gemensamma spelaren visar en enda hörbar video.
Detta är **komplett AI-text → strömmat TTS-ljud → GPU-video**, inte strömmande
AI-text eller full text-till-video-strömning från första token.

| Steg | Befintligt kvitto / ny mätpunkt | Tolkning |
| --- | --- | --- |
| AI-text | Web-logg `text_wait_ms` | Från modellbegäran till komplett beslut. Råtext loggas inte. |
| TTS | Web-logg `tts_first_audio_ms`, `tts_complete_ms` | Från betald TTS-start till första PCM respektive slut. |
| GPU-kö/kallstart | RunPods separata jobbmetadata + worker-health `cold_start_ms` | Kö före processstart måste avläsas i RunPod. Lokal kod kan inte härleda den från en redan ansluten worker. |
| Ljudanalys | Worker-resultat `ms.audio_analysis` | Resampling och Whisper per överlappande fönster, summerad arbetstid. |
| Inferens | Worker-resultat `ms.inference` | MuseTalk-modellens generering/avkodning, summerad arbetstid. |
| Sammanfogning | Worker-resultat `ms.composition` | Python-skapad mask/munruta. FFmpegs overlay ingår i `overlay_encode_wall`; den kan inte isoleras från kodningen i nuvarande pipeline. |
| Kodning | Worker-resultat `ms.overlay_encode_wall`, `ms.first_output_byte`, `ms.first_fragment` | FFmpeg från start till tömning, första utsända byte respektive första hela `moof`/`mdat`-fragment. Överlappar inferens och får inte summeras med den. `first_fragment` i äldre loggar betydde första byte; versionerna får inte jämföras rakt av. |
| Transport | Web-logg `server_transport_enqueue_ms`; klientkvitto `socket_open_ms`, `socket_to_media_ms` | Första värdet slutar när WebSockets sändning är köad. Klientvärdet omfattar även TTS/GPU-väntan. En ren nätverkstid kräver synkroniserad fjärrmätning. |
| Första uppspelning | Klientkvitto `first_playing_ms`, `first_visible_frame_ms`; chattstatusens `data-playback-ms`, `data-first-frame-ms` | Kvittona börjar vid biljettanslutning; data-attributen börjar vid användarens chattbegäran. `playing` är hörbarhetsproxy; faktisk högtalarutgång måste observeras vid GPU-provet. |

Loggar innehåller endast slumpad spårnyckel, stegnamn och millisekunder.
Worker-resultatet anger `encoder` och `encoder_verified` först efter att den
**verkliga FFmpeg-processen avslutats med kod 0**. `h264_nvenc` med
`encoder_verified=true` styrker då att just sessionen använde NVENC.
Startprobens val `ENCODER=h264_nvenc` ensamt styrker bara kapacitet, inte en
genomförd kodning. Nu finns inget sådant GPU-kvitto. `libx264` är tillåten
fallback men måste redovisas som sådan och jämföras i svarstid/kvalitet.

## Konfigurationsmatris

Alla värden i [tomt exempel](../ops/cloud/astrid-streaming.env.example) är
avsiktligt tomma. Fyll dem endast i respektive tjänsts privata sekretlager.
Startaren passerar fortfarande inte `assertCloudAccessReady()`.

| Plats | Variabler / jobbdata | Status i kod och gräns |
| --- | --- | --- |
| Render, molnstartare | `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`, `CROUPIER_GAME_ORIGIN`, `BETTALOTTO_PARTNER_BASE_URL`, `CROUPIER_CLOUD_DATA_ROOT`, `OPENCLAW_PRODUCT_SPEECH_URL/TOKEN`, `CROUPIER_STREAM_LANE`, `PORT`, `NODE_ENV` | Stöds. Exakta tre HTTPS-värdar, en replika och beständig disk krävs; HTTPS/cookies och startspärren måste verifieras före drift. |
| Render → endast Web-child | `CROUPIER_GENERATED_SPEECH=1`, `CROUPIER_CLOUD_GENERATED_SPEECH=1`, `CROUPIER_GENERATED_SPEECH_STREAMING=1`, `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, två **olika** `CROUPIER_SPEECH_STREAM_WORKER_SECRET`/`CROUPIER_SPEECH_STREAM_TICKET_SECRET` på minst 32 tecken | Stöds i denna ändring och passerar bara till Web-processen. File-jobbets RunPod-nyckel/endpoint krävs fortfarande av befintlig genererad-tal-konfiguration. Ange separat test-endpoint först efter beslut. Lab-child får inga dessa hemligheter. |
| Render → gateway | Ingen separat workerhemlighet; `config.streaming` från validerad flagga | Stöds i denna ändring. Endast exakta spelvärdens `/speech-stream` och `/lipsync-worker` uppgraderas; Web-reläet gör cookie-/biljett- eller bearer-kontroll. |
| RunPod separat test-endpoint | Image **digest**, privat GHCR-läsbehörighet, `AVATAR_ID=astrid_spel2x`, `NVIDIA_DRIVER_CAPABILITIES=compute,utility,video`, eventuellt `NVENC=0` för kontrollerad fallback | Avatar och encoderflaggor stöds. Ny endpoint, privat imagehämtning och kostnadstak är **inte** skapade eller verifierade. |
| RunPod sessionsjobb | `op=session`, exakt `wss://<spelvärd>/lipsync-worker`, `ws_token`, unik `worker_id`, avgränsad `ttl` | Stöds. Token skickas som Authorization-header, aldrig i URL. Jobbets start/stop och kötid måste mätas av testorkestreringen; automatisk betald workerstart finns inte. |
| GitHub Actions | Manuell `astrid-gpu-publish.yml`, `approved_target`, repository `GITHUB_TOKEN` | CPU-bygget passerade i Actions. Ett publiceringsförsök byggde men stoppades av felstavat ägarnamn före push. Workflowen rättar nu ägaren och kontrollerar den mot repot; ingen digest finns. Det korrigerade paketmålet kräver nytt exakt godkännande före körning. |
| Eventuell Vercel-ingång | Länk till Render-spelets HTTPS-origin | Ingen hemlighet eller WebSocket-funktion behövs för en ren länk. Separat spelklient på Vercel med sessionsöverlämning och WS-adress är **inte implementerad**. |

Lokalt ligger `CARTESIA_API_KEY` i rotens privata env-fil och RunPod-nyckeln i
Labbets privata env-fil. De behöver inte dupliceras eller flyttas i Git.
Render måste få sina egna privata värden för **Web-processen**. Nuvarande
streamingkod använder `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`;
`RUNPOD_ENDPOINT_ID` i Labbets env-fil är ett äldre värde i annat format och
ska inte kopieras som om det vore ett verifierat endpoint-ID. `GEMINI_API_KEY`
ingår inte i den här Cartesia/RunPod-kedjan.

## Versionsbunden privat image och återgång

**Korrigerat paketmål, ännu ej godkänt:**
`ghcr.io/jakeminator123/astrid-gpu-worker`. Det tidigare målet med `jakemanator123`
saknade en bokstav i GitHub-ägaren. [Första publiceringsförsöket](https://github.com/Jakeminator123/github-work/actions/runs/36510734449)
byggde imagen men GHCR avvisade pushen med `owner not found`. Ingen paketdigest
eller privat pull är verifierad. Vid godkännande körs den manuella
workflowen från exakt commit på `jakemanator123-github-work` med samma
`approved_target`. Publiceringen använder endast `sha-<hela commit-SHA>`;
ingen `latest`-tagg, automatisk branchpush eller ändring av endpoint ingår.
Kopiera `ghcr.io/jakeminator123/astrid-gpu-worker@sha256:<digest>` ur
jobbsammanfattningen till testprotokollet. Bekräfta paketets **Private**-läge
innan någon RunPod-konfiguration ändras. GitHubs dokumentation anger privat
standardläge för nya GHCR-paket, men det verkliga paketets behörigheter måste
kontrolleras. Testa privat pull med en separat läsbehörighet i den nya
test-endpointen; lägg inte token i jobbinput, Git eller chatt.

Behåll nuvarande RunPod-produktionsendpoint och dess tidigare image orörda.
Återgång på test-endpointen: stoppa sessionsjobbet, återställ föregående
registrerade image-digest/template, verifiera privat pull och kontrollera att
inga workers fortsätter debiteras. Radera inte föregående image/digest förrän
återgången är provad. Emils GitLab-repo ändras inte.

## Separat GPU-prov inom Jakobs tak på 10 USD/dag — förberett, ej startat

Jakob bekräftade 2026-09-29 att Emil, kontoägaren, godkänt högst 10 USD per dag för ett
separat prov med två ofarliga repliker och kall/varm start. Det är inget
godkännande att ändra befintlig produktionsendpoint. Nycklar i Emils env-filer
hör till hans konto och används bara inom detta avgränsade prov. Vid en
tidigare, enbart läsande kontroll gav den lokalt tillgängliga nyckeln HTTP 403
på endpointlistan; inget jobb skickades. En separat endpoint, workergräns, pris
och stopp kan därför inte verifieras med den nyckeln. Ägarkontots fungerande
managementväg behövs före betald start. Den tidigare GHCR-körningen från
`15bd1541` misslyckades. [Ny workflowkörning 36514600929](https://github.com/Jakeminator123/github-work/actions/runs/36514600929)
startades från verifierad SHA `b0bac08f417bfc8a3a136c940e8aba2d41b59bab`
med korrigerat mål `ghcr.io/jakeminator123/astrid-gpu-worker`; vid överlämningen
var den fortfarande igång och image-digest okänd. Senaste workercommit med
korrekt fragmentmätning är `68356b69`. Först efter lyckad publicering kan
`sha-<workflowens fulla github.sha>` och
`ghcr.io/jakeminator123/astrid-gpu-worker@sha256:<verklig digest>` fyllas i.
Ingen digest får gissas från Git-SHA.

[RunPods aktuella serverless-priser](https://www.runpod.io/pricing) anger
RTX 4090 (24 GB) till 1,10 USD/timme och L40/L40S (48 GB) till 1,75
USD/timme. [RunPods faktureringsregler](https://docs.runpod.io/serverless/pricing)
räknar från workerstart tills den stannar, även modellinitiering och idle,
avrundat per sekund; containerlagring tillkommer. Planen är **en** flex-worker,
`workersMin=0`, `workersMax=1`, `idleTimeout=5` sekunder, RTX 4090 i första
hand och L40S endast om dess faktiska endpointpris har bekräftats. Ingen
beständig volym. Som övre beräkning kostar 30 minuter kontinuerlig L40S-körning
0,875 USD i GPU-tid, plus lagring. Det är en kalkyl, inte RunPods faktura
eller en automatisk budgetspärr. RunPods dokumenterade kontospendgräns är
80 USD/timme och skyddar **inte** Jakobs tak på 10 USD/dag.

Stoppvillkor före ett betalt jobb: rätt ägarkonto ska kunna **läsa, skapa och stoppa**
den nya endpointen; dess pris, GPU, image-digest, privata pull och
`workersMin/Max` ska visas i kontrollpanelen/API:t. Starta en lokal 30-minuters
deadline samtidigt med första GPU-starten. Stoppa vid 10 minuter utan `ready`,
15 minuter utan ett fullständigt mediefragment, direkt vid andra worker eller
oväntad endpoint/image, och senast vid 30 minuter totalt. Kontrollera att
aktiva workers går till noll och läs faktisk debitering innan ett nytt försök.
Om stopp eller kostnad inte kan observeras, kör inget jobb. Den nuvarande
403-nyckeln uppfyller inte detta krav; en ägarstyrd managementväg behövs.

Använd tom spel-/BO-/Lab-databas, separata testkonton och
inga privata samtal. Behåll MuseTalk. Kör från en namngiven commit/digest och
anteckna GPU-typ, RunPod-pris per debiterad tidsenhet, worker min/max/idle,
tidpunkt, browser, Render-release och testvärd. Koden för testmiljön får inte
leda till befintlig produktionsendpoint.

Fasta, ofarliga engelska repliker för direkt TTS-prov:

1. `Good evening. The next card is yours.`
2. `I can explain the rule before we continue. Please look at the table.`

Kör varje replik två gånger direkt efter varandra i den gemensamma spelaren,
först efter kall start och sedan på redan varm worker. Gör även ett avbrott
efter första mediefragmentet och verifiera att GPU-platsen frigörs utan ett
automatiskt andra betalt jobb. Vid chattprovet ska beslutets **exakta färdiga
text** sparas som testkvitto privat och samma text användas för jämförelsen;
inga preliminära modellfraser spelas upp.

För varje försök fyll i: RunPod job-ID (privat), kötid från submit till
workerstart, `cold_start_ms`, textväntan, TTS första PCM/slut, första
workerfragment, analys, inferens, composition, FFmpeg overlay/kodning,
encoder/verified, serverköning, klientens första media/playing/bildruta,
fullt uppspelningsslut, effektiv FPS, avbrottstid och debiterad tid/kostnad
från RunPod-kvitto. Ta en synkron skärm-/ljudinspelning för granskning av
fonem och munform, start/slut, artefakter, färg, identitet och två spelningar
i följd. Jämför ljudets och bildens tidsstämplar med `ffprobe` och granska
synken manuellt. Ingen hash, vågform eller första munöppning ensam godkänner
läppsynk. Kör alla fyra dealers genom föreskriven rehearsal före spelarändring.

Efter provet: stoppa sessionsjobb och worker, kontrollera RunPods aktiva
workers och faktisk fakturerad kostnad. Välj sedan nästa optimering efter
dominerande uppmätt steg. Om textväntan dominerar kan frasvis AI-text vara
nästa arbete, men bara med validerade kompletta fraser och spärr mot att läsa
upp ofärdiga, ändrade eller ogiltiga svar. Inget löfte om 2–4 sekunder ges.
