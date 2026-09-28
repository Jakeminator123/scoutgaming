# Strömmad läppsynk

Implementationen utgår från GitHub-work `0503a88` och har sammanförts med
moln- och BO-ändringarna i `c3168ed`. Emils worker finns under
`services/astrid-gpu-worker`; ursprung och commits står i dess `SOURCE.md`.
Ingen GPU-image har publicerats och strömning är avstängd som standard.

## Flöde

1. Spelservern kontrollerar session, bord och minnesrevision och hämtar det
   exakta chattsvaret.
2. En klient som uttryckligen stöder strömning får en kortlivad, signerad
   biljett. Ingen TTS startas när biljetten skapas.
3. Den gemensamma spelaren väntar på sin tur och rätt dealerposition innan
   den ansluter till `/speech-stream` med sin befintliga sessionscookie.
4. Servern kontrollerar ägarskapet igen och skickar Cartesias PCM direkt till
   den anslutna GPU-arbetaren. Ingen ljuduppladdning via webbläsaren behövs.
5. Arbetaren gör MuseTalk-inferens på ansiktsrutan och komponerar den med den
   befintliga bilden. FFmpeg skickar H264 och AAC i samma fragmenterade MP4.
6. En enda hörbar video börjar spela innan hela ljudet är färdigt. Spelaren
   avslutar först när uppspelningen har nått slutet, inte när sista nätpaketet
   kommit. Navigation, avbrott och ändrat ägarskap stoppar arbetet.

Varje begäran reserveras beständigt före betalda anrop. Fil- och strömningsläget
delar reservationsnyckel, så ett misslyckat försök inte automatiskt betalas igen
genom att byta läge. GPU-kapacitet saknas ger ett tydligt fel; ingen andra betald
generering startas automatiskt. En aktiv arbetare hanterar en replik i taget.

Ett strömmat svar är en egen typ, `generated-speech-stream`. Det saknar ännu
slutliga mediehashar och är inte ett godkänt talpaket. De inspelade replikerna
och övriga dealers använder fortsatt samma gemensamma uppspelningsvägar.

## Förbereda drift

Installera `npm --prefix services/astrid-gpu-worker/gateway ci --ignore-scripts`.
Aktivera först i en verifierad testmiljö med en separat GPU-budget:

- `CROUPIER_GENERATED_SPEECH=1`
- `CROUPIER_GENERATED_SPEECH_STREAMING=1`
- `CROUPIER_GENERATED_SPEECH_DIR`: en privat, beständig katalog utanför repot.
- `CARTESIA_API_KEY`: endast på servern.
- `CROUPIER_SPEECH_STREAM_WORKER_SECRET`: serverhemlighet, minst 32 tecken.
- `CROUPIER_SPEECH_STREAM_TICKET_SECRET`: en annan serverhemlighet, minst 32 tecken.

Lokala prov kräver befintligt preview-läge och loopback-värd. Molnläge kräver
produktion, autentisering utan gäståtkomst, giltig HTTPS-`PUBLIC_URL` och det
befintliga molnflaggan. Filbaserat tal behöver fortsatt sin RunPod-konfiguration.

GPU-imagen byggs med `services/astrid-gpu-worker` som Docker-kontext. Välj
`AVATAR_ID=astrid_spel2x`. Arbetarens autentiserade sessionsjobb ansluter till
spelserverns `wss://<spelorigin>/lipsync-worker` med `ws_token` och ett unikt
`worker_id`. Nyckeln ska inte stå i URL:en eller skickas till klienten. Denna
ändring skapar inte endpointen, startar inget betalt jobb och håller inte en GPU
varm automatiskt. Sessionslivslängd, återanslutning och kostnad måste hanteras i
driften. Börja med en reläinstans; för flera behövs gemensam sessionsruttning.

`.github/workflows/astrid-gpu-build.yml` kan köras manuellt för ett CPU-provbygge
på GitHub. Det bygger modeller och båda avatarerna och kontrollerar import av
streamingmodulerna. Jobbet startar ingen GPU-handler, publicerar ingen image och
behöver inga privata API-nycklar. Det ersätter inte ett verkligt GPU-prov.

Nuvarande integration kräver att spelet och WebSocket-adressen har samma
origin. Labbets äldre brygga för över färdiga mediefiler och annonserar därför
inte strömningsstöd. Den avvisar oväntade strömbiljetter i stället för att tappa
läppsynken eller vidarebefordra behörigheter. Vercel-ingången kan länka till
spelet på Render. Att köra spelklienten på en annan origin behöver en uttrycklig
konfiguration för Render-adressen och sessionens överlämning; det ingår inte i
den verifierade integrationen. Befintliga lokala labbspärrar är kvar.

## Verifierat

- Nio worker-tester med riktig FFmpeg: videofragment före ljudslut,
  sammanhängande tidsstämplar, avkodning och avbrott.
- Tretton relä/TTS-tester: verkliga lokala WebSockets, autentisering,
  bytegränser, tidsgräns och strömmat PCM före HTTP-slut.
- Produktens HTTP/WebSocket-prov använder riktig spelserver och isolerad
  databas. HTTP-svaret kommer före TTS; den egna minnescommiten tillåts, medan
  glömt minne och fel sessionscookie stoppar strömmen.
- Spelarens tester täcker descriptor, en hörbar video, positionskontroll,
  avbrott, autoplay-fel, resurser och verkligt uppspelningsslut.
- Chrome provade två strömmar i följd genom den riktiga applikationstjänsten,
  Python-sessionen, FFmpeg och den gemensamma spelaren. Första bildrutan kom
  efter 897 respektive 1 031 ms, i båda fallen före ljudets slut. Båda gav
  start/slut-kvitton, två positionskontroller och städade presentationsytan.
  Ljud och ansiktsrutor var syntetiska; siffrorna mäter inte GPU eller Cartesia.
- `audit-dealer-sync --probe` passerade för alla fyra dealers med befintliga
  dokumenterade luckor. Inga mediebytes, kalibreringar eller baslinjer ändrades.
- Labbets produktionsbygge och hela `.githooks/pre-commit` passerade i den
  isolerade integrationen. Kontroll efter sammanförandet noteras i handoff.
- GitHubs samlade kontroller passerade för `f4e2b8e` i körning
  [36470135995](https://github.com/Jakeminator123/github-work/actions/runs/36470135995).
- Hela Docker-imagen byggdes på CPU från `7644c44` i körning
  [36471104794](https://github.com/Jakeminator123/github-work/actions/runs/36471104794).
  Byggsteget tog 5 min 36 s. Både `astrid_talk2x` och `astrid_spel2x` gav
  `AVATAR_KLAR`; en separat containerkontroll bekräftade latenter och import
  av streamingmodulerna. Imagen publicerades inte och GPU-inferens kördes inte.

Browserprovet kan upprepas med
`node tools/verify-speech-stream-browser.mjs <ffmpeg-sökväg>` och Python med
`websockets`. Det skriver ut en loopback-URL. Klicka **Play twice**. Verktyget
äger tillfälliga data och processer, kan stoppas med Ctrl+C och stänger sig
automatiskt efter fyra minuter. Det använder inga riktiga konton eller API:er.

GitHubs Linux-prov hittade en ordningsskillnad vid WebSocket-stängning:
klientens `close` kan komma före serverns. Reläprovet väntar nu med en kort,
begränsad väntan på serverns faktiska frigöring och kontrollerar även felkoden
1008. Det ersätter antaganden om händelseordning och fasta sovtider; inga
produktionsspärrar eller kontroller har försvagats.

## Kvar före aktivering

Publicera en test-image, anslut en uttryckligen vald test-endpoint och mät
kall/varm start, första bild, total tid, kostnad och munrörelser för samma repliker.
Whisper räknas nu på överlappande fönster; dess interna utfyllnad kan öka
beräkningstiden. Syntetiska prov räcker inte för att lova 2–4 sekunders svarstid.
Alla fyra dealers behöver dessutom den föreskrivna visuella tvåspelskontrollen.

Den äldre `RUNPOD_ENDPOINT_ID` kunde inte valideras och en endpoint-listning
gav HTTP 403. Den aktuella laddaren använder i stället den separata
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` från privat talkonfiguration. En läsande
hälsokontroll av den gav HTTP 200 med tillgängliga workers. Även endpoint- och
template-metadata gick att läsa med den aktuella nyckeln. Spel-endpointen kör
`registry.gitlab.com/emacodehero/astrid-gpu-worker:d3a2d0a6`, samma källversion
som importen, med RTX 4090, min/max 0/5 workers och 1 200 s idle timeout.
Templaten refererar till en registry-behörighet; dess värden lästes inte ut. Flytten av
källkoden till GitHub byter inte den befintliga imagen eller registret.

Den nya streaming-imagen körs ännu inte där. Inga GPU-jobb startades och inga
endpoint-inställningar ändrades. Test-endpoint, imagepublicering, relädrift och
kostnadsram återstår. Jira-verktyg saknades, så inga ärenden eller QA-statusar
har ändrats.
