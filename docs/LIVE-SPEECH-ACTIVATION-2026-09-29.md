# Astrid: Victoria och löpande läppsynk

## Jakobs beslut

Jakob vill ha löpande samtal med Victoria och genererad läppsynk. Han avvisade
förslaget om fem svar per dygn. Den tillagda kvotkoden och dess tester är
borttagna före commit eller deploy. Ingen ny gräns för antal svar införs.
Den redan godkända kostnadsramen är 10 USD per dag.

Röstprofilen är fortsatt Victoria, Cartesia-röst
`dc30854e-e398-4579-9dc8-16f6cb2c19b9`, modell `sonic-3.5`, mono PCM 24 kHz.
Inspelade klipp och dess mediepolicyer ändras inte av denna uppgift.

## Befintlig strömningsväg

1. `/chat` får det kompletta svaret från OpenClaw och kontrollerar ägare,
   bord och minnesrevision. Klienten annonserar `acceptsSpeechStream=true`.
2. `web/generated-speech-stream.mjs` utfärdar en kortlivad engångsbiljett,
   efter att sessionshanteraren startat eller återanvänt rätt GPU-worker.
   Samtalsbegäran reserveras beständigt före en eventuell betald GPU-start.
3. Den gemensamma spelaren öppnar `/speech-stream` med cookie och biljett.
   Cartesia börjar därefter skicka PCM direkt från Render till workern.
4. MuseTalk skapar bildrutor i block; FFmpeg returnerar H264/AAC som
   fragmenterad MP4. En enda hörbar video spelas innan hela repliken är klar.
5. Samma workeranslutning kan hantera flera efterföljande repliker. Den
   startas som RunPod `op=session`, normalt med `ttl=540` sekunder och upp
   till 45 sekunder för avslut av pågående replik.

Detta är strömmat ljud/video efter komplett AI-text. Kodens lokala syntetiska
prov visar tidig media och två följande repliker, men bevisar inte verklig
GPU-latens eller visuell läppsynk.

## Implementerat inför molnaktivering

| Del | Läget vid kodgranskningen |
| --- | --- |
| Victoria/TTS, relay, gemensam spelare | Implementerat |
| Render-gateway | Vidarebefordrar exakt `/speech-stream` och `/lipsync-worker` när streaming är aktiv |
| Render-image | Dockerfilen installerar nu reläets `ws` genom `npm --prefix services/astrid-gpu-worker/gateway ci --omit=dev --ignore-scripts` |
| Worker | Sessionsprotokoll v2 finns i samma publicerade källträd; exakt driftsatt image ska bekräftas vid liveprovet |
| Start/förnyelse av sessionsjobb | `web/generated-speech-session.mjs` startar bara på verifierad samtalsbegäran, återanvänder rätt worker-ID och ersätter en utgående session först efter terminalstatus och frånkoppling |
| Kostnadsstyrning | Beständig reservation i heltals-mikroUSD före `/run`, återläst efter omstart; inget antal-svarstak |

Render behöver `CROUPIER_GENERATED_SPEECH=1`,
`CROUPIER_CLOUD_GENERATED_SPEECH=1` och
`CROUPIER_GENERATED_SPEECH_STREAMING=1`, samt befintlig Cartesia-nyckel.
Två olika serverhemligheter på minst 32 tecken behövs:
`CROUPIER_SPEECH_STREAM_WORKER_SECRET` och
`CROUPIER_SPEECH_STREAM_TICKET_SECRET`. Molnstartaren tillför HTTPS-origin,
autentiserat produktionsläge och `/var/data/speech`.
Två uttryckliga kostnadsvärden krävs också:
`CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD=0.50` och
`CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD=9.94`. Det senare lämnar utrymme
för dagens tidigare cirka 0,06 USD; konfigurationen får aldrig överstiga
10 USD. Saknade eller ogiltiga värden stoppar molnströmning före start.

Ett sessionsjobb måste skickas från betrodd server med `op=session`,
`ws_url=wss://croupier-v2.onrender.com/lipsync-worker`, privat `ws_token`
som matchar workerhemligheten, unikt `worker_id` och avgränsad `ttl`.
Tokenen ska inte finnas i URL, Git eller chatten. För standardens 540 s
session plus 45 s avslut behöver jobbets exekveringsgräns vara minst dessa
585 s; 600 s exekvering och 660 s TTL ger avgränsat utrymme för kö/avslut.
Förlorat svar från `/run` får inte automatiskt skapa ett till betalt jobb.

## Kostnadsstyrning inom 10 USD/dag

Kostnaden styrs av avgränsad GPU-tid och verifierad taxa, inte antal repliker.
Samordnaren återläste 2026-09-29: 4090, 1,10 USD/timme, min workers 0,
max workers 1, en GPU och idle 5 sekunder. Ett dygn med ständigt aktiv
worker överskrider då 10 USD.

Sessionshanteraren reserverar 0,50 USD på beständig disk innan start;
600 s GPU-tid med denna taxa är cirka 0,184 USD. Resten är en konservativ
marginal för uppstart, tomgång, lagring och avstängning. Reservationen
återbetalas inte automatiskt. Ett osäkert submitsvar, korrupt lagring eller
kvarlämnat exklusivt lås stoppar nya starter. En session vars tidsfönster
korsar UTC-midnatt belastar båda dygnen med hela reservationen.

Vid en tom ny speech-katalog initierar det uttryckliga återstående
budgetvärdet atomiskt `gpu-budget-policy.json`. Ett nytt bygge kan sänka
men inte automatiskt höja den sparade budgeten. Befintliga reservationer
utan giltig policy, eller en trunkerad policy, stoppar genereringen.
Bevara policy och reservationsfiler vid omstart och felsökning.

Workern återanvänds mellan repliker, utan automatisk uppstarts- eller
förnyelseloop. 60 sekunders inaktivitet avbryter det egna jobbet; en aktiv
replik får först avslutas. Inför nya repliker behålls minst 180 sekunders
marginal för biljett och uppspelning före sessionsslut. En verifierad ny
begäran pausar inaktivitetstimern medan status läses. Ingen ny session
betalas förrän föregående är avslutad och den exakta workern frånkopplad.

Detta är en budget för denna sessionshanterare, inte ett hårt kontotak hos
RunPod. Andra klienter och kontoanvändningar omfattas inte. Faktisk kostnad
måste stämmas av mot RunPod; TTS/modellkostnad räknas separat om taket ska
gälla hela kedjan. Ett kvarlämnat `stream-session.lock` efter processkrasch
kräver kontroll av process och det kända RunPod-jobbet före manuell
låsfrisättning. Osäkert submit utan känt jobb-ID kräver operatörsutredning;
det skapas aldrig automatiskt ett nytt betalt jobb som ersättning.

RunPod debiterar även uppstart och tomgång enligt sin
[prisbeskrivning](https://docs.runpod.io/serverless/pricing).
[Cost centers](https://docs.runpod.io/accounts-billing/cost-centers) hjälper
med kostnadsuppföljning; dokumentationen anger inget automatiskt tak på
10 USD/dag. Tidsgränser anges genom
[jobbpolicy](https://docs.runpod.io/serverless/endpoints/send-requests#execution-policies).

## Övrigt skydd och verifiering

Filjobbsadapterns separata skydd behålls: varje `op=lipsync` skickar
`executionTimeout=120000` och `ttl=180000` ms. Dessa värden används inte för
sessionsjobb och begränsar inte antalet svar. Befintlig deduplicering och
avbrytning av det egna kända jobbet kvarstår.
När hanterad molnströmning är aktiv är hela den gamla molnfilgenereringen
avstängd. En gammal klient eller Probe kan därför inte kringgå budgeten
genom att utelämna strömningsstödet; vanlig chatt kan fortfarande visa text.
Uttryckliga isolerade lokala filprov behåller sin tidigare väg.

76 riktade tester passerar: sessionshanterare, streamingtjänst, HTTP,
gemensam spelare, filgenerering, provider, relay och Cartesia-adapter.
Regressioner täcker restart, osäkert submit, parallella processer,
dygnsövergång, exakt worker-ID, förnyelse nära sessionsslut och timer-racen
när en ny begäran kommer under en långsam statuskontroll. Full pre-commit
körs av samordnaren vid integration. Fyra-dealer-assetprobe passerade
tidigare under samma uppgift; detta är inte visuell acceptans.

Ingen miljöändring, publicering eller betald körning gjordes i denna
avgränsade uppgift. Nästa driftprov behöver ett sammanhängande autentiserat
samtal med minst två repliker, faktisk första bildruta, stopp vid avbrott,
uppmätt GPU-kostnad samt audiovisuell acceptans. Inspelade original eller
ofärdiga strömmar får inte märkas visuellt godkända genom enbart tester.
