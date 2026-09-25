# Driftkvitto 2026-09-25 — OpenClaw speech

## Verifierat, inte likställt med färdig spelarchatt

Efter Jakobs uttryckliga godkännande driftsattes exakt
`113dfd8a840eccfa159aa15b6be478738467dde5` på båda befintliga Render-labbtjänsterna:

- Gateway `croupier-lab-openclaw`: deploy `dep-dar6t6ojo6nc73ekrn2g`,
  start 14:52:43 och Live 14:56:21 svensk tid.
- Director `croupier-lab-director`: deploy `dep-dar71ho473hc73a30q9g`,
  start 15:01:59; Render visade därefter **Deploy succeeded | Live**.

Inga tjänsteplaner, andra Render-tjänster, modellval eller befintliga
Gateway-/OpenAI-nycklar ändrades. Ingen publik generell Gateway-`/v1` öppnades.

Gatewayens egen terminal bekräftade OpenClaw `2026.9.5 (ec9c1a1)`.
`config validate --json`, körd med samma `gatewayEnvironment()` som
startwrappern, gav `valid:true`, `warnings:[]`, exit 0. Direkt från Web Shell
utan wrappern gav samma giltiga schema men varnade om en lösenordsvariabel som
wrappern sätter endast för barnprocessen; detta var inte en runtime-konflikt.

Startloggen bekräftade runtimepaket `2026-09-25.1`, SHA-256
`f3477f41523068d6f23cfc1b6f5003d0fb4bd6d592294615264e2bc07609448f`, och
`croupier-speech: installed`. Selektiv, hemlighetsfri config-inspektion visade
samma modell som operatörschatten (`lab-provider/gpt-5.4-mini`), egen workspace
och agentDir, inga fallbackmodeller/skills, `tools.deny:["*"]`, elevated av,
minnessökning av och heartbeat `0m`. Privat `GET /v1/models` från själva
Gateway-containern gav HTTP 200 och inkluderade `openclaw/croupier-speech`.
Detta kontrollanrop använde ingen modellgenerering.

Director-kontroller efter driftsättning:

- Labbtoken → `GET /api/status`: HTTP 200, inklusive `product-speech-v1` och
  befintliga studio-advice/chat/social/companion-funktioner.
- Labbtoken → `POST /api/product/speech`: HTTP 401.
- Utan token → samma produktendpoint: HTTP 401.

## Blockerare: produktnyckeln är inte separat

Användaren sparade `OPENCLAW_PRODUCT_SPEECH_TOKEN` i Director och lokal privat
`.env`. En lokal jämförelse i minnet, utan att skriva ut värden, visade att
speech-tokenen är **identisk med Gateway-nyckeln**, men inte labbtokenen.
Provverktyget stoppade därför före något anrop med speech-tokenen. Det har inte
verifierats om det sparade Render-värdet är identiskt med det lokala värdet.

Som följd implementerades en fail-closed-spärr i `269a797`, pushad till båda
work-speglarna. Lokal helper avvisar aliaser före barnstart; Director och
Gateway-start avvisar aliaser före listen respektive config/statearbete.
Jämförelser omfattar labb-, Gateway- och modellnycklar utan att skriva ut eller
vidarebefordra providerhemligheten. 44/44 riktade och 132/132 OpenClaw-tester
passerade. **Spärrcommitten är inte driftsatt på Render**; där kör båda
tjänsterna fortfarande den uttryckligen godkända `113dfd8`.

Användaren har ombetts att skapa en ny unik slumpnyckel, spara samma nya värde
endast i Directors `OPENCLAW_PRODUCT_SPEECH_TOKEN` och den privata lokala
produktkonfigurationen, och välja **Save only** på Render. Gateway-, labb- och
modellnycklarna ska lämnas oförändrade. Inga nyckelvärden ska skickas i chatt.

När det är gjort behöver Director startas om med den sparade miljön. Därefter
återstår positiv speech-autentisering, att speech-token nekas på `/api/status`,
syntetiska modellprov och browserprov av ett faktiskt svar vid standard-idle.
**Ett riktigt produktsvar från modellen är alltså ännu inte verifierat.**

De två icke-hemliga lokala inställningarna har lagts i ignorerad `.env`:
`OPENCLAW_PRODUCT_SPEECH_URL=https://croupier-lab-director.onrender.com` och
`OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`. Filen versionshanteras inte.

## Isolerad lokal körning och riktiga spelhändelser

Helper `8b985de` startade riktiga Next på `127.0.0.1:4197` och native på
`127.0.0.1:4196`, med egna tempdatabaser och syntetisk Partner launch/events-
spelare. **Anslut** öppnade exakt detta bord. Ett syntetiskt prov med box 1 och
4 visade riktiga mottagna instruktioner med kort, box och handIndex, samt
originalspelarens faktiska playback start/end-kvitton i labbet. Exempel från
provet: box 1 hade 7♠ och K♣, box 4 J♣ och 3♣, croupierns synliga kort 3♥.
Detta var inte förifylld loggdata eller bevis för ett OpenClaw-svar.

4196/4197 stoppades när nyckelaliaset upptäcktes; kontroll visade inga kvarvarande
lyssnare där. Den befintliga offlinejämförelsen 4192/4194 lämnades igång och
oförändrad. Inga riktiga konton/databaser användes. Ingen media ändrades och
inget nytt läppsynkgodkännande lämnades.

Windows-stoppet lämnade den avgränsade QA-tempkatalogen
`C:/WINDOWS/TEMP/croupier-openclaw-connection-pGbvDk`. Inga processer använde den
vid efterkontrollen. Raderingsförsöket nekades av exekveringspolicyn och
kringgicks inte; endast syntetiska QA-data ligger därför kvar där.

Separat offlineverifiering: fem produkt-/speech-testfiler gav 25/25. Ett första
osanitiserat test ärvde riktig transportmiljö och nådde Director med HTTP 401;
ingen modellrespons. Testisoleringen rättades i `0a03cc7`: transportfält töms
före fixturevärden, och ett loopback-poisonprov visar noll oavsiktliga anrop.

## Vad de två observationerna faktiskt betyder

Native-serverns `/api/table` och Partner-API:s events använder båda
`presentationEvents()` från `web/partner-presentation.mjs`. Native-observationen
kan dessutom rapportera kommandosvar, verklig playback och chatt från den
öppnade spelfliken. Partner-SSE är en separat transport för publicerade events,
inte en annan kortlek eller en ström med hemliga framtida kort.

Två **presentationer** i labbet betyder originalspelets rendering respektive
labbets klippval av samma spelhändelser. Deras start/slutkvitton är separata.
OpenClaw får vid en chattförfrågan en serverbyggd, begränsad ögonblicksbild:
visningsnamn, synliga kort, box/hand, publicerade event och talpolicy. Det är
inte kontinuerlig prenumeration på allt internt spelstate. Råa player-id:n,
framtida shoe, dolt hålkort och plånbok skickas inte till modellen.

## Lipsync-repo: läst, inte importerat

Separat agent granskade read-only via befintlig SSH
`EmaCodeHero/astrid-lipsync-demo-2`, commit
`1e271e17522e11c51d2703a7149d6196a0b88d3d`. Ingen kod kördes, inga videor eller
nycklar lästes och inget GPU-/modelljobb startades.

Relevant integrationsväg är demots `/api/speak` → Cartesia PCM 24 kHz →
RunPod-lipsync → MP4. `/api/speak` tar redan bestämd text och hoppar över Gemini.
Behåll därför OpenClaw/OpenAI och Croupiers gemensamma spelare, talkö, revisioner,
stale/cancel och standard-idle-grind. Kopiera inte demots globala broadcastchatt
eller dess tidiga textvisning.

Ingen LICENSE hittades. Rätt att återanvända kod/media behöver bekräftas med
ägaren före omfattande kopiering. GPU-worker/modellerna finns i ett separat
`astrid-gpu-worker`-repo, vars fulla URL, revision, licenser och dealerprofiler
inte har verifierats. RunPod-åtkomst/kostnadsram är inte klarlagd.

Nuvarande `web/public/speech-package.mjs` tillåter generatedText endast med
neutral video. En integration behöver ett uttryckligt, hashbundet talpaket för
exakt slutlig text, audio/video, dealer/röst, frame-index, pose, revisioner och
acceptansstatus. Astrid-stöd får inte presenteras som verifierat stöd för alla
fyra dealers. Inga demofiler har kopierats till Croupier.

Källor: [astrid.mjs](https://gitlab.com/EmaCodeHero/astrid-lipsync-demo-2/-/blob/1e271e17522e11c51d2703a7149d6196a0b88d3d/server/astrid.mjs),
[Cartesia](https://gitlab.com/EmaCodeHero/astrid-lipsync-demo-2/-/blob/1e271e17522e11c51d2703a7149d6196a0b88d3d/server/cartesia.mjs),
[RunPod-adapter](https://gitlab.com/EmaCodeHero/astrid-lipsync-demo-2/-/blob/1e271e17522e11c51d2703a7149d6196a0b88d3d/server/serverless.mjs).
