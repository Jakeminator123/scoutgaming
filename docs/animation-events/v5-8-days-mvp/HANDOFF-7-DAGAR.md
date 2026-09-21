# Croupier V5 · portabel handoff för sju arbetsdagar

**Status:** 21 september 2026 · för Jakob, Kevin, Emil och deras agenter.

Det här dokumentet är startkontext för en ny människa eller agent i Cursor,
Codex, browser-GPT eller en annan miljö. Det sammanfattar uppdrag, system,
API-kopplingar, lagring, ansvar, verifiering och öppna gränser. Det är en karta,
inte en ny spelmotor, Jira-kopia eller garanti om vad som är driftsatt.

Den kanoniska V5-planen är fortfarande [åttadagarsplanen](s06-plan.md). Den här
versionen gör planen användbar som **D0 + sju genomförandedagar**:

- **D0** är startgrinden från den gamla Dag 1: rätt branch/SHA, ansvar,
  testmiljö, talproducenter och första Astrid-paket ska vara identifierade.
- **Dag 1–7** motsvarar den gamla planens Dag 2–8.
- Om D0 inte är klar har sjudagarsutförandet inte börjat. Flytta inte bort
  okända beroenden genom att bara kalla nästa dag Dag 1.

Sju dagar är en arbetsram, inte ett lanseringslöfte eller ett påstående om att
personerna redan har accepterat uppgifterna.

## 1. Uppdraget i en minut

Croupier är en fungerande blackjack-demo med serverägd spelstatus och en delad
uppspelningsväg för Vera, Astrid, Amira och Mei. Produkten är inte ett
certifierat RNG/RGS- eller real-money-system.

Sprintens minsta rimliga leverans är en spårbar kedja:

```text
serverfakta eller verifierad chatt
  -> validerad presentations-/talbegäran
  -> OpenClaw väljer exakt inspelad replik, ny kort text eller tystnad
  -> Kevins gemensamma talkö serialiserar jobbet
  -> Emil/Kevins hashbundna material spelas
  -> faktisk spelare lämnar start/slut/avbrott/fel som kvitto
```

Servern äger alltid RNG, sko, kort, tur, legal actions, wallet, insatser,
utfall och utbetalningar. OpenClaw får aldrig skapa eller ändra spelfakta.

Jakobs OpenClaw-spår är den beställda ägaren av persona, samtal och vad dealern
ska säga. Detta är **inte ännu fullt infört i produkten**. Labbet har riktiga
delar för variantbeslut, operatörschatt och social Astrid-chatt. Kevin måste
fortfarande konsolidera produktens talproducenter, adapter, kö, deduplicering,
avbrott och playbackkvitton. Emil och Kevin måste leverera och granska exakt
matchande text/ljud/video-paket.

## 2. Källor som gäller

Läs i denna ordning och följ länkar bara när uppgiften kräver dem:

1. [Detta dokument](HANDOFF-7-DAGAR.md) för orientering och överlämning.
2. [V5-navet](README.md) och [kanonisk åttadagarsplan](s06-plan.md).
3. [Användarguiden](../../../lab/docs/README.md) för vad labbet faktiskt visar.
4. [Aktiv systemkarta](../../../random-stuff-jakob/jakob-docs/systemkarta/README.md)
   för systemområden, status och källhänvisningar.
5. [OpenClaw som talägare](../../../lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md)
   för integrationskontraktet.
6. [John-handoff](../../JOHN-HANDOFF.md) för daterade testkvitton och kända
   spel-/medialuckor.
7. [Miljöåterställning](../../ENVIRONMENT-RESTORATION.md) före gameplay- eller
   mediaarbete.
8. [OpenClaw-dokumentationsindex](../../../open-claw/lab/docs/README.md) före
   Gateway-, Render-, MCP-, konfigurations- eller runtimearbete.
9. **Jira CAC** för faktisk implementerings- och QA-status. Läs alltid aktuell
   issue description, Expected Result och custom fields innan kodarbete.

Jakobs pensionerade `random-stuff-jakob/jakob-docs/arkiv/` är inte en aktiv
källa. Läs, indexera eller återställ inte den utan en uttrycklig beställning av
ett specifikt historiskt dokument. Privata chattloggar, råa API-svar,
personuppgifter och hemligheter ska inte läggas i Git, wiki eller webb.

## 3. Roller och beslut

### Jakob

- Äger sin arbetsgren `jakeminator123/work`, presentationslogik, labb,
  systemförklaring och OpenClaw-riktning.
- Definierar tillåtet samtals-/talbeslut: `recordedLineId`, kort
  `generatedText` eller `silence`.
- Ska kunna läsa resultatet på resa utan privata chattutskrifter.
- Ger identitets-/produktbeslut som inte kan tas av Kevin eller Emil.

### Kevin

- Äger produktintegration, Croupier-motor och beslut om vad som tas in.
- Bygger adaptern mellan publika spelfakta, chatt, OpenClaw och produkten.
- Utvecklar den befintliga gemensamma kön i
  `web/public/speech-queue.mjs`; skapa inte en parallell kö.
- Kartlägger och stänger konkurrerande text-/talägare för den aktiverade
  vägen: `sayLine`, `voice.say`, produktens `/chat`, eventkommentarer och
  eventuella äldre agentvägar.
- Äger idempotens, avbrott, felhantering, verkliga kvitton och integration/deploy.

### Emil tillsammans med Kevin

- Inventerar, producerar och lämnar exakta media-/läppsynkpaket.
- Anger text, ljud, video, hash, frame-index, delay, kalibrering, proveniens
  och visuell review som en odelbar leverans.
- Börjar litet med Astrid. Utökar inte mängden för att dölja ett
  kvalitetsproblem i första paketet.

### Jira och gemensam koordinering

- Jira CAC är den levande work-trackern. Alla aktuella CAC-dealerrapporter ska
  behandlas som Astrid även om äldre text säger Vera.
- Flytta till **In Dev** när arbete startar, **Ready for QA** när fix och
  reproduktionsevidens är klara och **In Testing** endast under faktisk QA.
  **Done** först efter hela Expected Result. Misslyckad QA går tillbaka till
  In Dev. Upptäck transitions; anta inte status-ID:n.
- Gemensamma frågor och handoffs går via
  [GitLab work item #1](https://gitlab.com/scout-gg/croupier/-/work_items/1).
  En mottagare svarar; CC och “alla” är information.

## 4. Sju genomförandedagar

### D0 · startgrind

- Bekräfta branch, commit, dirty files, isolerad testmiljö och vem som äger
  första förändringen.
- Kevin kartlägger alla nuvarande talproducenter och väljer en enda avgränsad
  produktväg.
- Emil och Kevin väljer ett exakt Astrid-talpaket och ett litet alternativ.
- Läs aktuell CAC-issue. Skriv blockerare som behöver Jakob i en samlad lista.

**Grinden är passerad när:** filer, ansvar, testmiljö, förväntat resultat och
saknade underlag är namngivna. Ett repo- eller manifestfynd räcker inte som
bevis på aktiv produktbindning.

### Dag 1 · minsta talbeslut och första variant

- Kevin definierar validerat utfall: exakt inspelad replik, kort ny text eller
  tystnad. Behåll spelfakta utanför modellen.
- Emil lägger in första granskbara MP4/WebM i labbets Videobank, kopplar exakt
  situation, trigger och urval och provar matchande/icke-matchande fall.

**Klart när:** beslutet kan följas till exakt material och ingen gammal
talägare kör samtidigt i den aktiverade isolerade vägen.

### Dag 2 · en talägare och en kö

- Led en spelreplik och ett chattsvar genom samma kö.
- Prova samtidighet, avbrott, fel och två plays i följd.
- Emil levererar första kompletta takepaketet och granskar hela repliken med
  Kevin, inte bara första munrörelsen.

**Klart när:** ett jobb har ett verkligt start- och terminalkvitto utan dubbelt
tal. Fri text använder neutral idle/2D eller tystnad om matchad läppsynk saknas.

### Dag 3 · samma instruktion ger ett jobb

- Verifiera samma presentation via HTTP och SSE, native-publicering efter
  commit, retry, stale version, konflikt och återanslutningslucka.
- Bestäm hur flera flikar/processer äger playback; processcachen är inte en
  distribuerad lösning.
- Lägg högst till en eller två varianter som bygger på godkänd första väg.

**Klart när:** dubbel leverans ger ett köjobb med flera leveranskvitton,
konflikt stoppar och materialets källa kan spåras.

### Dag 4 · läppsynk och kortkontakt

- Mät kvalitet, latens och avbrott med OpenClaw-text som källa.
- Bedöm läppar, ljud, identitet och övergångar per take.
- Prova en stödd kortdestination separat. Ett mål bevisar inte alla platser,
  senare kort eller split.

**Klart när:** varje testad take har resultat och begränsning. En dynamisk
prototyp måste vara uttryckligt avgränsad; annars levereras inspelat paket och
neutral reserv.

### Dag 5 · regression och återhämtning

- Prova saknat/korrupt media, fel dealer/text/hash, sen modellrespons, mute,
  navigation, dealerbyte och BO-previewbyte.
- Emil arbetar i separat staging och dokumenterar nya hashvärden och vilka
  godkännanden som måste göras om.

**Klart när:** varje fel har exakt ett terminalt kvitto, ingen media hänger
kvar och spelutfallet är oförändrat.

### Dag 6 · sammanhängande QA

- Spela den avgränsade scenen från instruktion till avslut.
- Granska alla fyra dealers i faktisk `?dealer=<name>&rehearsal=1`, inklusive
  två plays i följd.
- Samla riktig rundtrafik och spelartelemetri endast om rätt serverrevision,
  behörig testsession och isolerad databas finns. Annars lämnas live-QA öppet.

**Klart när:** Expected Result är prövat och fixture/stub inte presenteras som
livebevis. Misslyckade fall går tillbaka till In Dev.

### Dag 7 · integration eller tydligt avgränsad handoff

- Kevin lämnar liten granskbar MR/diff, aktiva/avstängda talägare,
  testresultat, rollback och integrations-/deploybeslut.
- Emil lämnar takepaket, hashbunden review och öppna kvalitetsluckor.
- Uppdatera denna handoff, V5-källan, wiki och webbsida tillsammans när
  sakmodellen ändras. Kontrollera den publicerade sidan efter push.

**Klart när:** någon utan privat mapp eller chattlogg kan upprepa leveransen.
Merge och deploy är separata beslut.

## 5. Systemet och var saker hör hemma

```text
spelarhandling
  -> web/server.mjs + web/shoe-game.mjs + web/public/blackjack.mjs
  -> serverägd gameView / wallet / round
     ├─ native /api/table -> web/public/app.mjs -> gemensam spelare
     └─ Partner /api/v1/table -> presentation[]
                                └─ /api/v1/events -> round.events (SSE)

presentation eller labbexempel
  -> lab/app/api/presentation/decision
  -> lab/lib/presentation-director.mjs
  -> Render Director
  -> privat OpenClaw Gateway
  -> validerat råd
  -> lokal originalvideo, uppladdad preview eller märkt 2D-reserv
```

### Produktkod

- Regler och demo-RNG: `web/public/blackjack.mjs`.
- Serverägd sko, rundor och publik vy: `web/shoe-game.mjs`.
- HTTP-server, wallet och BO: `web/server.mjs`.
- Native-kommandon och publicering efter commit: `web/native-table.mjs`.
- Partner, signering, wallet-callbacks och SSE: `web/partner-api.mjs`.
- Projektion till presentation: `web/partner-presentation.mjs`.
- Klientkoreografi: `web/public/app.mjs`.
- Gemensam talkö: `web/public/speech-queue.mjs`.
- Dealer-/mediespelare: `web/public/dealer-engine.mjs` och
  `web/public/performance-player.mjs`.

### Produktmedia

- Exakta talpaket: `web/public/speech-media.json` och
  `web/public/speech-lines.mjs`.
- Vera: `web/public/dealer/`.
- Astrid, Amira och Mei: `web/public/dealers/{astrid,amira,mei}/`.
- Indexerad H.264 och metadata: respektive `streams/index.json`.
- Astrids staged-material: `web/public/dealers/astrid/performance/manifest.json`.
- Bygg, staging, kalibrering och audit: `pipeline/`.

### Labb och Studio

- Next-app och lokala API-rutter: `lab/app/`.
- Editor, scen, videobank och paneler: `lab/components/`.
- Projekt-/video-/socialschema: `lab/schemas/`.
- Tekniska ID:n, ordlista och startprojekt: `lab/policies/`.
- Delade 2D-rörelser: `lab/animations/`.
- Guideinnehåll: `lab/docs/guide.json`; skapa inte en parallell användarguide.
- Lokalt sparat projekt, uploads, klassificering, historik och röstcache:
  `lab/data/` eller `LAB_STUDIO_DATA_DIR`. Detta är Git-ignorerat.

En källkodspush delar inte labbets uppladdade filmer. Överlämna media genom
teamets avtalade lagring och lämna hash/relativ referens i takepaketet.

### OpenClaw och drift

- Director, adapter och Render-blueprint: `open-claw/lab/`.
- Driftindex: `open-claw/lab/docs/README.md`.
- Blueprint: `open-claw/lab/render.yaml`.
- Gateway-image: `open-claw/lab/deploy/Dockerfile.gateway`.
- Kort runtimekunskap per roll: `open-claw/lab/deploy/runtime-bundle/`.

### Dokumentation och samarbete

- Aktiv sprintkälla: `docs/animation-events/v5-8-days-mvp/`.
- Aktiv systemkarta: `random-stuff-jakob/jakob-docs/systemkarta/`.
- Öppna evidensfynd: `docs/findings/`; detta är triage, inte Jira-status.
- GitLab-wiki: gemensamma beslut och läsbar handoff.
- `animation-events-v1`: separat GitHub-repo som bygger den publika
  dokumentationssidan; det är inte spelmotorn.

## 6. Repon, branches och publiceringsytor

- **Kanonisk produktkälla:** `git@gitlab.com:scout-gg/croupier.git`.
- **Jakobs branch:** `jakeminator123/work`. Pusha aldrig `main` från denna
  checkout och force-pusha/rebasea inte en delad branch.
- **Privat GitHub-kopia:**
  [Jakeminator123/gitlab-work](https://github.com/Jakeminator123/gitlab-work),
  branch `jakeminator123/work`. Den är privat och var synkad med GitLab vid
  handoffleveransen. Den är en reservkopia, inte kanonisk produktkälla.
  Automatisk kontinuerlig spegling är ännu inte konfigurerad.
- **Dokumentationsrepo:**
  [Jakeminator123/animation-events-v1](https://github.com/Jakeminator123/animation-events-v1).
- **Publik V5:** [animation-events-v1.vercel.app](https://animation-events-v1.vercel.app/).
- **Wiki:** [GitLab animation-events](https://gitlab.com/scout-gg/croupier/-/wikis/animation-events).
- **Jakobs personliga ChatGPT-projekt:**
  [Croupier](https://chatgpt.com/g/g-p-6ab16900ad188191ab4ad7c0f8aa5126/project).
  Det är en kontextyta, inte facit för kod, runtime eller Jira.
- **Jakobs lokala checkout:** `C:\Users\jakem\Projects\croupier`.
  Andra miljöer ska använda repo-relativa sökvägar i handoffs.

## 7. API- och tjänstekopplingar

### A. Native produkt-API

Ägare: Croupiers server. Används av den vanliga spelklienten.

- `/api/table`: serverägda kommandon/status. SQLite-transaktionen committar
  sko, rundstatus och wallet tillsammans. Request-ID ger idempotens och
  version stoppar stale handlingar.
- `/api/player`, `/api/balance`, `/api/deposit`, `/api/currency`: serverägda
  demo-/spelarkonton. Klienten får inte skriva över verklig walletstatus.
- `/api/chat`: äldre produktchatt som måste ingå i ägarskapsinventeringen.
- `/api/auth/*`: session/login/logout för produktvägen när guest preview inte
  är aktiv.
- `/api/bo/*`: separat backoffice för konfiguration, clips, voice lines,
  API-nycklar, användare och previews. BO-inloggning är inte Partner-åtkomst.

Tillfällig guest access ska vara kvar för lokal produktutveckling tills Jakob
uttryckligen säger annat. Testa med isolerad server/databas och annat hostname;
använd inte riktig användardatabas.

### B. Bettalotto Partner API

Ägare: Croupiers Partner-adapter. Anrop signeras med Partner key ID + secret;
scopes och `playerId` avgör behörighet/kanal.

- `/api/v1/ping`: tid och scopes.
- `/api/v1/assets`: materialmanifest.
- `/api/v1/lobby`: bordskatalog.
- `/api/v1/launch`: kortlivad URL till den vanliga spelklienten.
- `/api/v1/table`: Partner-kommandon och svar med `presentation[]`.
- `/api/v1/events`: SSE; `hello` och `round.events`. Ingen replaybuffer.
- `/api/v1/history`: sparade Partnerrundor när scope finns.
- `/api/v1/demo-credit` och `/api/v1/balance`: demo-/walletscope.

Med `walletUrl` anropar Croupier operatörens `balance`, `bet` och `win` och
använder dess svar som saldo. Launch av native-klienten bevisar inte automatiskt
att samma wallet-/SSE-väg används. Native-publicering efter commit finns lokalt,
men launch -> riktiga rundposter är ännu inte verifierat live.

Labbets läsande observer använder servervariablerna
`BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET`,
`BETTALOTTO_PARTNER_PLAYER_ID` och valfri `BETTALOTTO_PARTNER_BASE_URL`.
Secrets får aldrig skickas till webbläsaren eller dokumenteras med värden.

### C. Generations-/materialregister

Det historiska namnet `BETTALOTTO_API` är en separat Bearer-readtoken, inte
Partner-HMAC-paret.

- `GET /api/v1/generations`: metadata/materialregister.
- `GET /api/v1/generations/mapping`: registrerad videokarta.

Mapping, `want`, filnärvaro och BO-bindning är olika statusar. Ingen av dem är
ett playbackkvitto eller en visuell acceptans.

### D. Lokala labb-API:n

Ägare: Next-servern under `lab/app/api/`.

- `/api/project`: validerad atomisk projektsparning och revisionskontroll.
- `/api/videos`, `/api/videos/classify`, `/api/videos/[id]`: lokal Videobank.
- `/api/original-media` och `/api/original-media/[...path]`: registrerade
  produktoriginal, med path/hashkontroll.
- `/api/presentation/decision`: gemensamt lokalt presentationsbeslut.
- `/api/simulate`: kompatibilitetsadress till samma beslutsservice.
- `/api/inputs`, `/api/inputs/events`, `/api/inputs/reference`: Partnerstatus,
  SSE-observation och explicit verify/launch/mapping.
- `/api/chat`: operatörschatt om sparat projekt.
- `/api/social`, `/api/social/chat`, `/api/social/profile`,
  `/api/social/voice`: avgränsad Astrid-profil/chatt/röst.
- `/api/voice` och `/api/voice/[id]`: explicit lokal röstpreview/cache.
- `/api/health`: lokal hälsa.

`/api/presentation/decision` återanvänder samma beslut för samma ID/innehåll,
men dagens cache är processlokal: 128 jobb, fem minuter efter avslut och högst
fyra samtidiga beslut. Den deduplicerar inte playback över flera processer
eller flikar.

### E. Render Director och privat OpenClaw Gateway

Normal kedja:

```text
lokal Studio -> lokal Next-server -> HTTPS Render Director
              -> privat Gateway -> modell -> validerat svar
```

Director skyddas av `LAB_API_TOKEN`; den lokala kopian heter
`LAB_REMOTE_TOKEN`. `LAB_REMOTE_URL` pekar på Directors publika HTTPS-adress.
Gatewayens `OPENCLAWAPI_KEY` är en annan hemlighet. Modellnyckeln stannar på
Gateway som `OPENCLAW_MODEL_API_KEY`.

Director-rutter:

- `/healthz`.
- `/api/status`, `/api/catalog`, `/api/scenarios`.
- `/api/decide`, `/api/presentation`, `/api/chat`.
- `/api/studio/advice`, `/api/studio/chat`.
- `/api/studio/social-chat`, `/api/studio/companion`.

Gateway är privat och använder `OPENCLAW_BASE_URL`/privat host, agentnamn och
låst modellkonfiguration. Ett fungerande statusanrop bevisar inte att produktens
talägarskap är integrerat.

### F. OpenAI webbsökning i Companion

Companion kan göra en avgränsad offentlig sökning via en privat Gateway-hjälp
på port 18790. Den använder `https://api.openai.com/v1/responses`, låst
`gpt-4.1-mini-2025-04-14`, ett `web_search`-anrop, låg sökkontext, 512
ut-token och `store: false`. Nyckeln kopieras inte till Director/webbläsare.

Budgetreserven är 0,50 SEK per försök, högst tio försök per rullande timme.
Prisantagandet måste omprövas senast 21 oktober 2026. Vanlig chatt, hosting och
ElevenLabs är separata kostnader. OpenClaw-frågor filtreras till
`docs.openclaw.ai`.

### G. ElevenLabs

`ELEVENLABS_API_KEY` eller kompatibelt lokalt alias används för uttryckligt
beställda röstprov. Samma text/röst/modell kan återanvända lokal cache.
Detta är inte automatiskt produktljud eller läppsynk. Ny generering kan kosta
krediter och får inte startas utan relevant scope/godkännande.

### H. GitLab-inbox, GitHub, Vercel, Render och Jira

- Inboxverktyget använder GitLabs Notes API och lokal 30-sekunders cache.
  Kör högst en kontroll vid början av en ny användartur; ingen polling.
- GitHub `gitlab-work` är privat reservkopia. Synka den uttryckligen efter en
  godkänd GitLab-push tills automatisk spegling är beslutad och säkert
  konfigurerad.
- Vercel publicerar dokumentationswebben från det separata docs-repot.
- Render kör Director + privat Gateway enligt blueprint och sparar avgränsad
  Companion-data på disk.
- Jira CAC äger arbete/QA. Denna checkout hade ingen fungerande Jira-connector
  när handoffen skrevs; en agent får därför inte påstå status eller Done från
  repoanteckningar.

## 8. Event-, variant- och mediakontrakt

Partnerpresentationens sex publika typer är:

- `speak`: exakt talrad.
- `deal`: kort mot publik destination.
- `reveal`: vänd redan existerande kort.
- `turn`: visa tur/handlingsläge.
- `settle`: redovisa redan avgjort resultat.
- `idle`: vänteläge.

Labbets 16 noder är begripliga grupper över dessa typer, inte 16 nya
motorevents. Startprojektet har fyra dealers x 16 linjer, 256 variantposter och
64 delade 2D-rörelser. Detta är inte 256 godkända filmer.

En inspelad tal-take är en tuple som inte får delas:

- line-ID och exakt text/språk,
- ljudreferens och SHA-256,
- videoreferens/stream och SHA-256,
- frame-index, fps och audio delay,
- mask, kontakt, kalibrering och proveniens,
- reviewresultat, granskare, datum och exakt revision.

Välj aldrig video efter ungefärlig längd eller “liknande känsla”. Loop aldrig
en inspelad mening över fortsatt ljud. Ny text får inte spelas mot en gammal
mun. Ändrad text-, ljud- eller videohash ogiltigförklarar tidigare visuell
acceptans för paketet.

Varje presentationsjobb behöver separat identitet för:

1. serverkommando accepterat och committat,
2. presentation mottagen/deduplicerad,
3. OpenClaw-beslut validerat,
4. medietuple upplöst och laddad,
5. första bild målad och ljud startat,
6. cue/landning observerad,
7. klart, avbrutet eller fel.

API 200, filhash, waveform, modelltext eller “speech end” efter fel bevisar inte
steg 5–7.

## 9. Lagring, miljö och hemligheter

Dokumentera variabelnamn och roller, aldrig värden.

- Rotens `.env`: lokal Director-koppling och generations-readtoken.
- `lab/.env.local`: labbspecifika val, Partner-observer och eventuellt separat
  datarot. Processmiljö går före filerna.
- Render Director Environment: `LAB_API_TOKEN`, `LAB_DATA_DIR`, Gateway-host,
  agentnamn och tidsgränser.
- Render Gateway Environment: `OPENCLAWAPI_KEY`,
  `OPENCLAW_MODEL_API_KEY`, modell/base-URL/API-format, state/config paths.
- `LAB_REMOTE_TOKEN` måste motsvara Directors befintliga `LAB_API_TOKEN`.
  Rotera eller återskapa inte automatiskt.
- `CROUPIER_DATA_DIR`: isolerad databasrot för säker produkt-QA.
- `LAB_STUDIO_DATA_DIR`: isolerad labbdata för projekt/uploads.
- `LAB_VIDEO_ARCHIVE`: valfri lokal originalvideorot.

Labbets Companion sparar avgränsad profilhistorik i
`LAB_DATA_DIR/companion.sqlite`: de senaste 12 inläggen, högst 8 000 tecken,
30 dagars inaktivitet. Det är inte spelidentitet, embeddings eller obegränsat
minne. Labbets observerade `playerId` får inte användas som autentiserad
produktidentitet.

## 10. Vad som är byggt och vad som fortfarande är öppet

### Byggt eller daterat verifierat

- Gemensamt lokalt presentationsbeslut används av Eventstudion och
  sekvensspelaren; `/api/simulate` delar tjänsten.
- Exakt originalresolver och lokala registrerade medier fungerar i labbet.
  Inventeringen angav 84 tillgängliga originalförval, varav 22 Astrid.
- Separat kontroll fann 89 motorvideovägar, 78 ljudvägar och sex staged-vägar
  lokalt. Filnärvaro är inte visuell acceptans.
- Händelseloggen kan läsa/importera sekvenser, deduplicera HTTP/SSE-observation
  och spela samma instruktioner i labbet.
- Native-kommandon kan lokalt publicera till verifierad Partner-kanal efter
  commit. Publiceringsfel återkallar inte kommittat spelkommando.
- BO har en gemensam preview-controller som städar tidigare video/ljud.
- Companion-minne, glöm, namn, poem och budgeterad OpenAI-sökning har ett
  daterat Render-kvitto. Detta är labb, inte produktens talägarskap.
- V5-källa, wiki och webb publicerades och verifierades 21 september 2026.
- Alla fyra dealers har tidigare klarat två påföljande greeting-lifecycleprov
  i isolerad rehearsal. Det är inte ny identitets-/läppsynkacceptans.

### Öppet och får inte beskrivas som klart

- Produktens alla text-/talproducenter är inte konsoliderade under OpenClaw.
- Produktens kö har inte visats hantera hela nya ägarskapet, HTTP+SSE,
  flera flikar/processer och alla avbrott som ett kontrakt.
- Launch -> riktiga live-rundposter och originalklientens faktiska
  start/slut/landning är inte fullt verifierat.
- Dagens driftsatta Bettalotto-revision och aktiva BO-clipAssignments är inte
  belagda av dokumentationen.
- SSE saknar replay. Luckor efter avbrott kräver explicit strategi.
- Astrids avsedda visuella identitet och full läppsynk är öppna acceptanspunkter.
- Amira och Mei saknar dokumenterad dealing-action-täckning; full kontakt för
  alla platser, senare kort och split är inte belagd.
- 13 talbanksposter saknade exakt speak-indexmatch i daterad inventering
  (Vera 8, Amira 2, Mei 3). Kontrollera faktisk användning innan åtgärd.
- Fri dynamisk text har ingen generellt godkänd exakt läppsynkväg.
- Privat GitHub-kopia synkas inte automatiskt efter framtida GitLab-pushar.
- Jira CAC-status kunde inte läsas när detta dokument skrevs.

## 11. Säker arbetsordning för varje ny agent

1. Kör `git status --short --branch`; bevara dirty och orelaterade filer.
2. Bekräfta `jakeminator123/work` och jämför mot rätt GitLab-ref. Pusha inte
   `main`.
3. Läs D0, aktuell V5-del, relevant systemkartesida och hela CAC Expected Result.
4. Skriv vad som är kodkontrollerat, labb, daterat verifierat och fortfarande
   förslag. Blanda inte statusarna.
5. Ändra minsta befintliga ägarväg. Skapa inte parallell motor, talkö,
   medieregister eller projektstatuslista.
6. Använd isolerad server/databas och annan hostname för gameplay-QA.
7. För media/player: bygg i separat staging, rör inte orelaterade bytes och kör
   `node pipeline/audit-dealer-sync.mjs --probe` plus alla kommandon i
   `.githooks/pre-commit`.
8. Granska Vera, Astrid, Amira och Mei i faktisk rehearsal, två plays i följd.
9. Uppdatera per-take-resultat, tester, öppna glapp och Jira-status efter
   verkligt arbete. Baseline är regressionsskydd, inte visuell acceptans.
10. Commit endast uppgiftens filer. Handoff ska säga exakt vad som ändrades,
    vad som testades och vad som återstår.

## 12. Dagligt kvitto att lämna

Kopiera detta i issue/MR/handoff:

```text
Datum och ansvarig:
Branch och commit:
CAC-issue + status före/efter:
Mål / Expected Result:
Ändrade filer/kontrakt:
Aktiv och avstängd ägare för tal/playback:
Testmiljö och datarot:
Automatiska tester:
Manuell QA, dealer och två plays:
Take-ID, exakt text, ljud/video-hash och review:
Kvitton: commit -> mottaget -> beslut -> load -> frame/audio -> terminalt:
Negativa/avbrottsfall:
Vad detta bevisar:
Vad detta inte bevisar:
Öppna blockerare och vem som äger dem:
Rollback:
Nästa minsta steg:
```

För media används dessutom [take-mallen](../../../lab/docs/templates/media-take.md).

## 13. Kort startprompt för en agent utan full kontext

Följande block kan klistras in i Cursor, browser-GPT eller annan agent. Ge
agenten också denna fil och relevanta källfiler när miljön tillåter det.

```text
Du arbetar med Croupier V5 på branch jakeminator123/work. Croupier-repot på
GitLab är facit för motor, serverdata, media och runtime. Jira CAC äger faktisk
implementerings-/QA-status. Läs aktuell issue inklusive Expected Result innan
kodarbete. Pusha aldrig main och bevara alla dirty/oägda filer.

Målet för den kvarvarande sjudagarsramen är en spårbar, isolerad kedja där
Jakobs OpenClaw bestämmer tillåten exakt replik, kort ny text eller tystnad;
Kevin integrerar beslutet med befintlig produkt och en gemensam talkö; Emil och
Kevin levererar hashbundna text+ljud+video-paket och visuell acceptans. Servern
äger alltid RNG, sko, kort, regler, wallet och utfall. Skapa inte en parallell
motor, kö, app eller mediekatalog.

Skilj alltid serverkommando, presentationsleverans, OpenClaw-beslut,
materialupplösning och faktisk playback. HTTP 200, hash eller modelltext är inte
playbackkvitto. Samma instruktion via HTTP+SSE ska bli ett jobb; konflikt ska
stoppa. Fri text får aldrig spelas med en gammal inspelad mun.

Inspelat tal är en odelbar tuple: line-ID, exakt text, ljud+hash, video+hash,
frame-index/fps/delay, kalibrering/mask/proveniens och review. Alla fyra dealers
går genom samma spelarväg. Vid media/player-ändring: isolerad databas/hostname,
audit-dealer-sync --probe, hela pre-commit-listan och faktisk rehearsal för
Vera/Astrid/Amira/Mei med två plays i följd. Tester/hash är inte visuell
acceptans.

Börja i docs/animation-events/v5-8-days-mvp/HANDOFF-7-DAGAR.md, följ sedan
V5-planen, lab/docs/README.md, aktiva systemkartan och
lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md. Läs aldrig Jakobs pensionerade arkiv om
inte Jakob uttryckligen beställer ett specifikt historiskt dokument. Rapportera
vad som ändrades, testades och förblir öppet, med commit, miljö och rollback.
```
