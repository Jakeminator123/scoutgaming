# Astrid: molnströmning, konfiguration och GPU-prov

## Samtalsaktivering — 2026-09-29

Jakob vill kunna föra löpande samtal med Victoria och strömmad läppsynk.
Ett föreslaget tak på fem genereringar per dag avvisades innan leverans.
Den befintliga privata imagen och egna endpointen återanvänds; automatisk
sessionsstart och en beständig reservation av GPU-budget implementeras nu.
Ingen ny betald körning gjordes under denna förberedelse.

RunPods inloggade endpointvy bekräftade kl. 10:09 CEST: RTX 4090/24 GB Pro
1,10 USD/timme, en GPU, max en worker, noll alltid aktiva, idle 5 s,
execution timeout 600 s, FlashBoot av, noll pågående/köade jobb och saldo
29,94 USD. [Prislistan](https://www.runpod.io/pricing) anger samma GPU-pris.
[Faktureringsreglerna](https://docs.runpod.io/serverless/pricing) inkluderar
modellstart, exekvering, idle och containerlagring. En applikationsreservation
är inte en kontoomfattande spärr för andra jobb eller ändrade priser.

Den planerade reservationen är 0,50 USD per avgränsad session, som kan
återanvändas för flera svar. Tillgänglig dagsbudget sätts konservativt till
9,94 USD efter dagens tidigare cirka 0,06 USD. Flaggor och runtimeprov
redovisas i [aktiveringskvittot](LIVE-SPEECH-ACTIVATION-2026-09-29.md).
Kallstart och verklig första bild måste fortfarande mätas; det tidigare
filbaserade talprovet på cirka 52 sekunder bevisar inte realtimeprestanda.

**Uppdaterat 2026-09-29. Imagen är publicerad privat i GHCR, en separat
RunPod-testendpoint är Ready. Ett riktigt kort Cartesia-talprov har nu
skapat GPU-video; läppsynk och molnströmning är ännu inte godkända.** Källan ligger kvar i `services/astrid-gpu-worker` i
`Jakeminator123/github-work`, branch `jakemanator123-github-work`. MuseTalk 1.5
och den nuvarande avataren är utgångspunkt.

## 2026-09-29 09:13 CEST — Första riktiga talprovet

Render-containerns egen `RUNPOD_API_KEY` klarade ett läsande `/health`-anrop.
Ett separat lokalt providerprov använde därefter samma befintliga Cartesia-
och RunPod-inställningar, endpoint `zsudl8tmzcmiv1` och exakta repliken
**"Hej! Välkommen till bordet."**. Inga speldata, liveklipp eller talflaggor
ändrades. Den privata tillfälliga nyckelfilen raderades före nätanropen.

- Cartesia `sonic-3.5`, röst `dc30854e-e398-4579-9dc8-16f6cb2c19b9`,
  gav 2 720 ms PCM/WAV; videoinlämning började efter 519 ms.
- RunPod-jobb `7c8d6603-f6a2-482a-b0ac-f71ee1961ddc-e2`: 35 634 ms kö,
  14 627 ms exekvering, 52 457 ms totalt inklusive resultatöverföring.
- MP4: 1 897 296 byte, H.264 1080×1920, 24 fps, 83 bildrutor,
  3,458 sekunder; muxat AAC 24 kHz, 3,413 sekunder. Den längre
  video-/ljudsvansen jämfört med TTS-WAV måste ingå i synkgranskningen.
- WAV SHA-256: `688f9271d166223023b2708b96a49900d9b67cf3810b1a7fb2254decf4a6756e`.
- MP4 SHA-256: `65050946da741cb55d4c32cd528d9b130ca3e0eaa2842d8feac462914862fc03`.

En kontaktkarta visar genererade munrörelser, men ingen fullständig
audiovisuell acceptans är gjord. Provfilen och kvittot ligger privat utanför
Git. Detta bevisar TTS→filjobb→muxad video, inte mikrofon, kamerabild,
OpenClaw-svar, varm latens eller strömuppspelning i spelet. Kö/kallstart
dominerar detta prov; ett snabbt samtalsflöde är ännu inte uppnått.

Efterkontroll cirka 09:30 CEST: endpointpanelen visar 0 körande workers,
0 pågående/köade jobb, 0 USD/s, min 0/max 1 och idle timeout 5 sekunder.
Kontosaldo 29,94 USD (före detta prov 29,96 USD); detta är inte ett separat
slutligt fakturakvitto. Inga ytterligare jobb skickades.

## 2026-09-29 08:15 CEST — Egen RunPod-konfiguration sparad på Render

Jakob lade in `RUNPOD_API_KEY` på Render `croupier-v2`. Nyckelns
närvaro är verifierad i panelen; dess värde har inte lästs eller API-testats.
Endpoint-ID råkade först hamna i Key-fältet tillsammans med variabelnamnet.
Det rättades till `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=zsudl8tmzcmiv1`
och sparades med **Save only**, utan ytterligare deploy.

Jakobs tidigare sparning startade en ny byggning från `799b359f`,
deploy `dep-datlc17lot8c7381fg50`. Render loggade Live 08:12:56 CEST.
Efteråt gav både `/__cloud/health` och `/blackjack?dealer=astrid` HTTP 200.
Det är en driftkontroll, inte ett fullständigt inloggnings-/rundprov.
Den senare Save only-rättelsen är sparad för nästa deploy; vilken env-snapshot
den redan pågående byggningen använde är inte verifierat.

RunPods endpointpanel visade 0 pågående jobb, 0 köade jobb och 0 USD/s.
Inga nya tal-/streamingflaggor sattes. Riktigt tal, Cartesia-nyckel,
RunPod-API-autentisering och hela lipsync-kedjan återstår att verifiera.
`GEMINI_API_KEY` ingår inte i denna kedja.

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
| RunPod separat test-endpoint | GHCR-image från verifierad SHA, privat GHCR-läsbehörighet, `AVATAR_ID=astrid_spel2x`, `NVIDIA_DRIVER_CAPABILITIES=compute,utility,video`, eventuellt `NVENC=0` för kontrollerad fallback | Endpoint `zsudl8tmzcmiv1`, release 3, är Ready med den nya diagnostikimagen. Två syntetiska filjobb skapade MP4 med `libx264`; inget verkligt tal eller strömprov är godkänt. |
| RunPod sessionsjobb | `op=session`, exakt `wss://<spelvärd>/lipsync-worker`, `ws_token`, unik `worker_id`, avgränsad `ttl` | Stöds. Token skickas som Authorization-header, aldrig i URL. Jobbets start/stop och kötid måste mätas av testorkestreringen; automatisk betald workerstart finns inte. |
| GitHub Actions | Manuell `astrid-gpu-publish.yml`, `approved_target`, repository `GITHUB_TOKEN` | Publiceringskörning 36523063587 lyckades från `12ce6d47`; imagen är Private och release 3 på testendpointen. |
| Vercel-ingång | Landnings- och spel-Preview med Render-testbackend | Den isolerade spel-Previewn har provat native spel och Astridvideo. Ett fullständigt AI-text → TTS → GPU-sessionjobb → fragment → synlig bild-kvitto är ännu inte gjort. |

Lokalt ligger `CARTESIA_API_KEY` i rotens privata env-fil och RunPod-nyckeln i
Labbets privata env-fil. De behöver inte dupliceras eller flyttas i Git.
Render måste få sina egna privata värden för **Web-processen**. Nuvarande
streamingkod använder `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`;
`RUNPOD_ENDPOINT_ID` i Labbets env-fil är ett äldre värde i annat format och
ska inte kopieras som om det vore ett verifierat endpoint-ID. `GEMINI_API_KEY`
ingår inte i den här Cartesia/RunPod-kedjan.

## Versionsbunden privat image och återgång

**Korrigerat paketmål, publicerat:**
`ghcr.io/jakeminator123/astrid-gpu-worker`. Det tidigare målet med `jakemanator123`
saknade en bokstav i GitHub-ägaren. [Första publiceringsförsöket](https://github.com/Jakeminator123/github-work/actions/runs/36510734449)
byggde imagen men GHCR avvisade pushen med `owner not found`. Den nya
[publiceringskörningen](https://github.com/Jakeminator123/github-work/actions/runs/36514600929)
lyckades från `b0bac08f417bfc8a3a136c940e8aba2d41b59bab` och gav
`ghcr.io/jakeminator123/astrid-gpu-worker@sha256:76236958401daca8d78100c40b310f21e8837c9bd2830cbb756808bd20f2487b`.
GitHubs inloggade paketvy visar **Private** och länken till `Jakeminator123/github-work`.
Privat pull från RunPod är verifierad i test-endpointens release 2 med en
separat `read:packages`-behörighet. Lägg inte token i jobbinput, Git eller chatt.

Behåll nuvarande RunPod-produktionsendpoint och dess tidigare image orörda.
Återgång på test-endpointen: stoppa sessionsjobbet, återställ föregående
registrerade image-digest/template, verifiera privat pull och kontrollera att
inga workers fortsätter debiteras. Radera inte föregående image/digest förrän
återgången är provad. Emils GitLab-repo ändras inte.

## Separat GPU-prov inom Jakobs tak på 10 USD/dag — hälsoprov och syntetiskt mediejobb

Jakob godkände 2026-09-29 högst 10 USD per dag för ett separat prov med två
ofarliga repliker och kall/varm start. Han bekräftade först Emils tillstånd,
men valde därefter ett eget RunPod-konto (`Jakeminator123`) för provet. Emils
nycklar används inte vidare. Det är inget godkännande att ändra befintlig
produktionsendpoint. En tidigare, enbart läsande kontroll med Emils nyckel gav
HTTP 403 på endpointlistan; inget jobb skickades. Det egna kontot är inloggat
i RunPod-konsolen med 30 USD förbetalt saldo och Auto-Pay avstängt.
Testendpoint `croupier-astrid-gpu-test` (`zsudl8tmzcmiv1`) skapades
2026-09-29. Den visar Queue, image-digest ovan, en sparad `read:packages`-
registeruppgift, RTX 4090 (24 GB Pro, 1,10 USD/timme), högst en worker,
noll alltid aktiva workers, en GPU per worker, 600 sekunders exekveringsgräns,
5 sekunders idle timeout, FlashBoot av och ingen nätverksvolym. Vid skapandet
gick en worker till `initializing` trots noll aktiva workers; inga jobb hade
skickats och kontrollpanelen visade då 0 USD debiterat. RunPod markerade den
sedan `unhealthy` med `IMAGE_AUTH_ERROR` och `denied` vid hämtning av den
privata GHCR-digesten. RunPods notis säger att den stoppade workern för att
undvika kostnad; kontrollpanelen visade fortsatt 0 running workers och 0 USD.
Ingen applikationslogg eller GPU-läppsynk kom från detta första försök.
Jakob uppdaterade därefter GHCR-registeruppgiften i sitt RunPod-konto. Release 2
pekar på `sha-b0bac08f417bfc8a3a136c940e8aba2d41b59bab` från samma
publiceringsbygge som digesten. Endpointen blev Ready; Workers visade en
idle RTX 4090-worker, inga unhealthy workers och noll jobb innan provet.
Ett `{"input":{"op":"health"}}`-jobb gick till `COMPLETED` på release 2.
RunPod rapporterade `delayTime=33993` ms och `executionTime=79` ms. Svaret
bekräftade `ready=true`, `avatar=astrid_spel2x`, `gpu=NVIDIA GeForce RTX 4090`,
`cold_start_ms=21070`, `size=1080x1920` och `encoder=libx264`.
Detta styrker privat GHCR-pull och modellstart, men ingen läppsynk eller
verifierad NVENC-kodning.

Ett efterföljande `op=lipsync`-rökprov använde 1,5 sekunder syntetiskt
16 kHz mono PCM. Det innehöll inga ord och kan därför inte användas för
fonem-/läppsynksgodkännande. RunPod-jobbet gick till `COMPLETED` med 54
bildrutor och en MP4-preview på 324 KB med spelavataren. Jobbmetadata:
`delayTime=49909` ms, `executionTime=20283` ms. Worker-resultatets tider
var `whisper=0,03` s, `gpu=0,73` s, `gen_enc=15,99` s och `mux=3,85` s.
NVENC-proben loggade att FFmpeg inte kunde initiera videokodaren och valde
`libx264`; den nuvarande felraden innehåller endast sista delen av FFmpegs
stderr och ger ännu inte säker orsak. Inget riktigt Cartesia-tal,
fragmentström, klientuppspelning eller manuell läppsynksgranskning är provat.
Efter jobbet visade RunPod `0 running workers`, `$0.00000/s` och saldo
`$29.96` från ursprungliga `$30.00`. Detta är en saldodifferens på ungefär
fyra cent, inte en verifierad fakturarad; Overview visade ännu `$0.00`
avrundat för total debitering.
Källan fick därefter mer utförlig, avgränsad FFmpeg-diagnostik för NVENC-proben.
[GHCR-körning 36523063587](https://github.com/Jakeminator123/github-work/actions/runs/36523063587)
publicerade commit `12ce6d472a32495704dd557bfc4e420ba4a90b20` som
`sha-12ce6d472a32495704dd557bfc4e420ba4a90b20`, med image-digest
`sha256:23245ce416178a977478685d4147374f658f6405a410c1d15e02237a686fac3f`.
Testendpointens release 3 kör nu denna tagg. RunPod visar en worker med release
3, privat pull fungerar och noll alltid aktiva workers är fortfarande satt.
Samma syntetiska 1,5-sekunders WAV gav åter 54 bildrutor och en 324 KB MP4.
Jobb `b56ac33d-2b2f-48f8-b503-118e74849ad7-e1` rapporterade
`delayTime=21,3` s och `executionTime=1,45` s. Workerfasernas tider var
`whisper=0,02`, `gpu=0,73`, `gen_enc=0,74` och `mux=0,22` sekunder. Det är en
kortare exekvering än release 2:s 20,28 s för samma syntetiska input, men
workerhost och kallstart skiljer sig; jämförelsen är inte ett mått på verklig
tal-/videolatens eller en garanterad optimering.

Den nya loggen visar den faktiska NVENC-orsaken i denna worker: FFmpeg laddade
NVENC 13.0 och identifierade RTX 4090, men `OpenEncodeSessionEx` svarade
`unsupported device (2)`. Workern valde därför `libx264`. Ingen NVENC-kodad
session har verifierats. GPU-beräkning och mediejobb fungerade ändå. Nästa
tekniska val är att undersöka GPU-värdens encoderåtkomst eller låsa fast en
uppmätt x264-fallback; byt inte codec enbart utifrån detta syntetiska jobb.

Den tidigare GHCR-körningen från
`15bd1541` misslyckades. [Ny workflowkörning 36514600929](https://github.com/Jakeminator123/github-work/actions/runs/36514600929)
startades från verifierad SHA `b0bac08f417bfc8a3a136c940e8aba2d41b59bab`
med korrigerat mål `ghcr.io/jakeminator123/astrid-gpu-worker` och slutade
med `success`. Den oföränderliga taggen är
`sha-b0bac08f417bfc8a3a136c940e8aba2d41b59bab`; workflowloggen gav
faktisk manifest-digest
`ghcr.io/jakeminator123/astrid-gpu-worker@sha256:76236958401daca8d78100c40b310f21e8837c9bd2830cbb756808bd20f2487b`.
Git-SHA och image-digest är olika värden. Senaste workercommit med korrekt
fragmentmätning är `68356b69`. Paketets **Private-synlighet** är verifierad i
GitHubs inloggade paketvy. Privat pull från RunPod fungerar med den uppdaterade
registeruppgiften. Den lokala `gh`-inloggningen är separat och kan fortfarande
sakna paketläsning.

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
Om stopp eller kostnad inte kan observeras, kör inget jobb. Emils 403-nyckel
används inte; stopp och debitering ska kontrolleras i Jakobs eget konto.

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
