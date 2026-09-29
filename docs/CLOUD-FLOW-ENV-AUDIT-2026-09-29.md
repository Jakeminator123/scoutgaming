# Driftgranskning: Lissabon, chatt och lagring

Granskad 29 september 2026 cirka 09:35–09:40 CEST av
`codex-cloud-flow-audit`, med separata kod-/env- och lagringsgranskningar.
Utgångspunkt: `e0dc37fb` och Jakobs bekräftade speladress
`https://croupier-v2.onrender.com/?dealer=astrid&presentation=local`.
Detta är ett granskningskvitto, inte ett godkännande av hela tal-/bildkedjan.
Inga hemlighetsvärden har skrivits i rapporten.

## Leveransstatus efter kodgranskningen

Gemensam kodcommit `6c85cfff3fd3c5e3d0d3462c75dc2d1a78173178` är pushad och
återverifierad på `Jakeminator123/github-work`/`jakemanator123-github-work`.
54 uppgiftsfiler ingår, med ordinarie full hook godkänd vid committen.
Råmedia, manifest, lokala policyer och tidigare orelaterade handoffändringar
är bevarade utanför committen. Kontrollen av staged diff mot nio relevanta
privata värden hittade ingen hemlighetsläcka.
[CI-körningen](https://github.com/Jakeminator123/github-work/actions/runs/36542628681)
är godkänd i alla tre jobb. Jakob har bekräftat att de fem lagrings-/
streaminghemlighetsraderna sparats på Render. `6c85cfff` är nu Live, även
efter env-deploy `dep-datnfph7lnhs73e2c670`. Publicerad kamerakontroll och
Lissabon-CSS matchar committen. Autentiserad zonstatus ger HTTP 200 och
`cloudConfigured: true`.

Importen slutfördes 10:37 CEST: **12 nya MP4, 44 574 024 byte**, lagrade i
privat Blob. De övriga tio fanns redan med exakt familj/hash. Alla **22/22**
har återverifierats mot registret och med två korrekta Range 206 per klipp.
En ny, oberoende inloggning fann noll saknade kandidater; direkt Blob HEAD
bekräftade de tolv nya objektens storlek, MP4-typ och privata sökväg.
Se [det sekretessfria importkvittot](qa/cloud-media-import-2026-09-29.json).
Den uttryckligen godkända engångsfilen med BO-inloggning raderades efteråt.
Kandidaterna är manuella och väntar på visuell granskning/användningspolicy;
import är inte ett godkännande av läppsynk eller automatisk spelanvändning.

Samordnarens riktiga talprov har fått streamad bildstart efter 42,051 och
86,226 sekunder. Efterföljande svar hittade ett fel nära GPU-sessionens
60-sekunders tomgångsavslut. Rättning och nytt driftprov ägs av
`root-orchestrator`; talflödet är ännu inte godkänt. GitLab-läsningen på
Jakobs nya uttryckliga begäran fann att Emils worker-main fortfarande är
vår `SOURCE`-bas `d3a2d0a6`. Fem RunPod-workers är inte fem fungerande
parallella sessioner i nuvarande kod; pool och budget måste verifieras först.

GitLab `emil/dealklipp-v1` vid `8e5b47e7`: samtliga 17 ursprungliga repliker
finns redan byteexakt i vår aktiva Lissabon-bank. `codex/astrid-languages`
vid `0d12b7a5` har alternativa språk-/replikpaket, ingen exakt saknad film
för ett dynamiskt chattsvar. Dess `server/serverless.mjs` har encoderbaserat
NVENC-urval, men arbetar med hela MP4-filer. En eventuell smal port behöver
validerad workerstatus och kostnadsreserverat byte; gamla image/auth och
automatiska betalningsretry ska inte ersätta vår strömningskedja direkt.

## Rättning efter granskningen, 29 september cirka 10:10 CEST

Tre underagenter har implementerat och korsgranskat följande. Daterade
förkontroller nedan föregår den slutförda driftsättningen och importen ovan.

- Privat Blob-adapter för Lab-familjeupload och samma registerläsare i
  produktspelaren. Upload följs av hashkontrollerad återläsning innan
  metadata publiceras; GET/HEAD/Range kräver ordinarie behörighet. Gamla
  diskfiler fungerar parallellt. Familjeindex ligger fortsatt på Render-disk.
- Zon-API med exakt klippmåttskontroll, privat Blob och enbart separat
  `CROUPIER_ZONES_DATABASE_URL`. Molnutkast, originalets browserkopia och
  lyckade deluppladdningars ID:n bevaras. Versionskontroll stoppar överskrivning
  från en gammal flik. Se [zonlagringen](ZONE-CLOUD-STORAGE.md).
- Manuell enstaka mikrofoninspelning när lokalt väckord saknas, samt rättad
  kamerakontroll som använder det aktuella Terra-valet. Inga ändringar av
  spelarens samtycke eller automatiskt molnväckord. Tidig Lissabon-CSS håller
  chatten synlig. Se [browser- och testkvittot](ASTRID-INPUT-FIX-2026-09-29.md).
- Molnstartens env-kontrakt vidarebefordrar Blob till Web och Lab, men zon-DB
  bara till Lab. Lokal `--cloud-storage` är explicit opt-in. Den gamla lokala
  RunPod-endpointöverskuggningen är rättad; den lokala RunPod-nyckeln är ännu tom.

Verifierat: 60 lagrings-/cloudintegrationstester, Lab-produktionsbygge och
hela Lab-svitens 524 tester passerar. Full pre-commit och dealer-audit med
probe passerar också (ett plattformsbundet hooktest hoppas över på Windows).
Browserprovet
använde riktig Chrome-DOM, AudioWorklet/WAV och JPEG med syntetiska enheter
och providerstubbar: nio fall passerade, inklusive Terra-byte efter laddning,
två manuella meddelanden och synlig mobilchatt i 390 px. Det är inte ett
fysiskt mikrofonprov eller ett riktigt Terra-svar.

Alla fyra dealers provades därefter via riktiga `?dealer=<namn>&rehearsal=1`:
två kompletta `goodluck`-uppspelningar var gav playing → ended. Astrid använde
MP4 med inbäddat ljud; övriga matchade indexklipp. Åtta bilder från de två
uppspelningarna har inspekterats utan tom eller bortfallen dealerbild.
Testet använde sessionsvakten, egen tillfällig databas och inga providers;
processer och tillfällig data städades. Detta är regressionskontroll,
inte en ny läppsynkacceptans av inspelningarna.

Samordnarens parallella [streamingimplementation](LIVE-SPEECH-ACTIVATION-2026-09-29.md)
ingår i samma leverans: återanvänd GPU-session, beständig kostnadsreservation,
WebSocket-beroende i Docker, tydlig köstatus och budgetbesked. Molnkonfigurationen
kräver separat sessionsreserv/dagbudget och skickar dessa enbart till Web.
Websocketfixture har uppdaterats och städar servern även om configvalidering
misslyckas; båda testerna passerar. Ingen streamingflagga eller betald
GPU-session har aktiverats av denna granskare.

Riktigt privat Blob-prov 10:08 CEST: syntetisk MP4 om 1 587 byte gav identisk
SHA efter upload, GET och hämtning till ny cache; HEAD och Range 206 fungerade.
Anonym direktåtkomst gav 403. Endast det nya testobjektet togs bort och
borttagningen återlästes. Inga riktiga familjeposter skapades av provet.

Dedikerade zon-Neon `wandering-hill-60561912`: schemat provades först på
`codex-zone-storage-qa` (`br-soft-base-b1z5814s`), inklusive revision 1 → 2
och avvisat gammalt revisionsnummer. Därefter installerades samma schema i
main `br-flat-fog-b161a6r8`; både `clips` och `documents` är tomma.
QA-compute suspenderades. Inga spelkonton eller saldon berördes.

De 22 kandidaterna har hashkontrollerats igen: 111 508 277 byte,
inga ändringar sedan inventeringen. Autentiserad läsande importförkontroll
visade att 10 redan finns med rätt familj/hash och är tillgängliga, medan
12 saknas. Ingen av de 22 är i Blob ännu. Inga uploads gjordes av förkontrollen.
Adminåtkomsten fungerar efter uttryckligen godkänd privat engångskopia.
Gemensam koddeploy och Render-env krävs före import till nya Blob-vägen.
Nyckelvärden finns endast i privata Git-ignorerade filer och leverantörernas
hemlighetshantering. Texten nedan beskriver den ursprungliga granskningen
före dessa rättningar och ska läsas som historiskt utgångsläge.

## Slutsats vid initial granskning

Alla miljöer är inte likvärdigt eller fullständigt inkopplade. Den bekräftade
speladressen väljer den gemensamma Lab/Lissabon-presentationen på Render.
Blob och Neon finns som resurser i QA, men Lab-uppladdningarna och
bakgrundszonerna använder dem inte. Lokalt finns dessutom en verklig
överskuggning av RunPod-endpoint och en tom RunPod-nyckel.

## Vilken ström används?

`croupier-v2` är Render-tjänstens namn. `presentation=local` är ett
presentationsval, inte datorns plats. `web/public/blackjack-entry.mjs`
väljer exakt `/?dealer=astrid&presentation=local`. Molnstarten kräver
`CROUPIER_STREAM_LANE=lissabon-stream-lane` i `ops/cloud/config.mjs`.
Den separata äldre `/v2`-vägen väljs genom URL-path; den är inte den URL
Jakob angav. Spelservern väljer klipp genom `/api/presentation/select` och levererar
dem genom `/api/presentation/videos/:id`. Underlaget kommer från den
gemensamma manifest-/policy-/uppladdningskedjan i `presentation-runtime/`.

Director och OpenClaw Gateway är beslut-/modellled. De blir inte en annan
videoström genom sina tjänstenamn. Faktisk uppspelning av ett visst uppladdat
klipp kräver fortfarande valt familje-ID, fil-ID/hash och ett spelar-kvitto.
Något nytt sådant livekvitto har inte tagits i denna granskning.

## Verifierade miljöer och återstående kontroller

| Plats | Verifierat nu | Avvikelse eller begränsning |
| --- | --- | --- |
| Render `croupier-v2` | `/__cloud/health` 200; spelarlogin 200; aktuella klientfiler serveras. `/api/auth/session` visar spelar-konton aktiverade. Oautentiserat kamera- och Lab-API ger 401. | Full env-lista, effektiv datarot/diskmount och skyddad kamera-/modellstatus kunde inte återläsas självständigt denna tur. Tidigare agentkvitto säger kamera=1, Whisper-nyckel finns, Terra sparad och Probe Av. Det ersätter inte fysisk inspelning eller bildsvar. |
| Render Director | `/healthz` 200 och autentiserad `/api/status` 200 med befintlig lokal Lab-token. Provider configured=true, status=configured, agent `openclaw/croupier-director`; product-speech-v1 och product-probe-v1 annonseras. | Detta bevisar Lab-tokenparet och serverkontraktet, inte ett giltigt Terra-/bild-/talbeslut. |
| Render privat OpenClaw Gateway | Konsumenter och separat token-/modellnyckelgräns granskade i kod/lokal konfiguration. Tidigare aktiveringskvitto finns. | Ingen direkt ny kontroll av privat tjänsts Live-SHA, beständiga `openclaw.json` eller effektiv modell. |
| Vercel `croupier-frontend` | Rätt GitHub-repo/branch, rot `apps/croupier-frontend`. `CROUPIER_GAME_URL` är Render `/blackjack?dealer=astrid` i Production och Preview. `/demo` 200 och `/labb-lissabon` 307 till Render `/studio`. | Development saknar explicit speladress och använder samma produktionsfallback. Preview är därför inte isolerat speltest. Ingen Blob/Neon-anslutning här. |
| Vercel `croupier-player-preview-qa` | `BLOB_READ_WRITE_TOKEN` finns i Production, Preview och Development. `CROUPIER_ZONES_*` finns i Preview/Development; separat oprefixad Neon-konfiguration i Preview. | Nycklarna tillhör QA-projektet och är inte automatiskt tillgängliga för Lab på Render. Ingen aktuell lagringskonsument i produkt-/Lab-koden. |
| Lokalt | Filernas laddordning och maskerad nyckelseparation kontrollerade. Lab-token matchar Director live. | Sparat projekt och genererat-tal-profil skiljer sig från molnet; se nedan. Inget serverpar startades eller stoppades. |

Vercelkontrollerna gjordes med befintlig autentiserad CLI/projekt-/env-/
Blob-/Marketplace-metadata. Tokenens **närvaro**, inte dess värde, är beviset
ovan. På startsidan finns dessutom 16 modell-, OpenClaw- och Partner-env
utan konsument i dess kod. Den läser bara `CROUPIER_GAME_URL`. Att ändra
dessa extra frontendvariabler ändrar därför inte Render-spelet.

## Chatt, Terra, kamera och Whisper

Chattfixen från `16f1f53d` serveras på den adress Jakob angav. Direkt hämtade
`app.mjs`, `blackjack-entry.mjs`, `astrid-voice-shell.css` och `index.html`
matchade arbetskopians filer efter normalisering av CRLF, före den parallella
röstfixen. Alla relevanta svar hade `no-store, must-revalidate`.
En redan laddad flik kör dock sin tidigare JavaScript-version tills den
laddas om. Ingen slutsats om felet i Jakobs enskilda DOM/session tas enbart
från filjämförelsen.

Kodens `setChatOpen` håller Astrids konversation öppen på denna väg även vid
Escape, timer och mobilvy; chattkontrollerna flyttas inte in i den privata
kameraloggen. De riktade chatt-/kamerakontroll-/wake-word-/Whisper-testerna
gav **57/57 PASS**. Tidigare agent verifierade synlig chatt i browser,
desktop och 390 px; egen ny browser-QA blev inte möjlig här.

Whisper har fler villkor än API-nyckeln. Record-vägen kräver kamera-/mikrofon-
samtycke samt webbläsarens lokala taligenkänning: `processLocally` och
`SpeechRecognition.available/install`, med ett lokalt språkpaket.
`web/public/astrid-wake-word.mjs` stoppar med förklarande status om stödet
saknas; den faller inte tillbaka till en molntjänst för väckordet.
Whisper används efter detta steg och returnerar engelsk översättning.

Den autentiserade `/api/astrid/observation` är rätt kontrollpunkt för
`enabled`, `model`, `vision.enabled` och `transcription.enabled`.
`/api/config` är inte denna kontrollpunkt. Sparad Terra-modell är i sig
inte bevis på lyckat Terra-svar. Bildstöd i både produkt och Gateway,
samtycke, bildleverans och ett giltigt svar behöver verifieras tillsammans.

Vid granskningen var genererat tal avstängt enligt senaste driftkvittot.
Den då publicerade klienten kunde använda browserns standard-TTS när inget
genererat talpaket fanns. `root-orchestrator` har tagit separat ägarskap för
att rätta denna robotröstfallback, se
[röstgranskningen](ASTRID-VOICE-ROUTING-2026-09-29.md). Inga talflaggor ändras
av denna granskning. Den parallella fixen är committad som `bddf534c`:
20 riktade tester, full pre-commit och dealer-audit med probe passerade;
Live- och visuellt kvitto återstår. Även samordnarens direkta browserläsning av kamera-API blockerades
av klientfiltret; detta försökte ingen av oss kringgå.

## Lokal env-konflikt

`loadPrivateConnection` läser `.env`, sedan `lab/.env.local`, sedan
`lab/.env.generated-speech.local`, sist process-env.

- `lab/.env.local` anger `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID=zsudl8tmzcmiv1`.
- Den senare genererat-tal-filen skriver över med äldre `tdkbn6qxcyh4so`.
- `RUNPOD_API_KEY` är tom i den effektiva lokala konfigurationen.
- Den redan ändrade `lab/policies/local-profile.json` har
  `generatedSpeech:true`. Vanlig koordinerad start läser profilen och kräver
  då kompletta Cartesia-/RunPod-värden. Detta är ett verkligt lokalt starthinder.
- Lokal Whisper-konfiguration faller tillbaka till befintlig
  `OPENAI_API_KEY`; ingen dedikerad translationsnyckel finns lokalt.
  Nyckelns giltighet för ljud har inte provats här.
- Lokal effektiv projektdatarot är `lissabon/data`; dess sparade modell är
  `gpt-6-luna` och Probe `automatic`. Det är ett separat sparat projekt från
  molnets dokumenterade Terra/Av, inte ett env-bevis på vilken modell molnet kör.

Rättning kräver att de två lokala endpointdefinitionerna samordnas och att
en giltig RunPod-nyckel finns om profilen ska fortsätta kräva genererat tal.
Återanvänd inte automatiskt molnets hemlighet och ändra inte den pågående
agentens talprofil som bieffekt. Inga privata env-filer eller sparade
användarinställningar ändrades här.

## Var hamnar MP4, Blob och Neon?

1. **Ladda upp & bibliotek:** skyddad Lab-route →
   `lab/lib/video-uploads.mjs` → `LAB_STUDIO_DATA_DIR/videos`, med
   fil och `index.json`. Avsedd molnplats är `/var/data/studio/videos`.
   Detta är filskrivning på Render, inte Blob.
2. **Familj och produkt:** exakt familjekoppling gör filen till manuell
   kandidat i gemensamt register. Sparad policy avgör om den får väljas.
   Ett upload-svar eller ett bibliotekskort är inte ett uppspelningskvitto.
3. **Bakgrundszoner:** klipp sparas i IndexedDB och geometri/inställningar i
   localStorage av `lab/components/background-zones.tsx`. Ingen Blob-upload
   eller Neon-synk sker här.
4. **Befintlig Blob:** `croupier-astrid-zone-media-private` är Active,
   privat, region arn1, med ett objekt om 65,76 KB. Den är kopplad till
   `croupier-player-preview-qa`, inte startsidan. `BLOB_READ_WRITE_TOKEN`
   finns alltså, men på QA-projektet.
5. **Befintlig Neon:** `croupier-astrid-background-zones-db` och
   `croupier-preview-neon` är available och kopplade till QA.
   Spelkonton/saldo/rundor använder fortsatt SQLite på Render. Den fristående
   Postgres-förberedelsen är inte produktens aktiva databasadapter.

Det behövs ett skyddat upload-/metadata-/uppspelningsflöde till Blob och
zon-Neon. Servern som faktiskt hanterar detta behöver lagringscredentials;
att lägga tokenen på en startsida som bara länkar till Render hjälper inte.
Privat Blob måste spelas genom en behörig väg med Range-stöd. Spel-Neon är
en separat migration och får inte aktiveras enbart genom ett DATABASE_URL-byte.

**27/27** riktade upload-/intake-/registertester passerade, med temporära
fixtures, familjekoppling, återläsning och 206/Range. Det är inte ett
liveuploadprov eller visuell acceptans. Ingen av de 22 väntande varianterna
importerades här; samordnaren bekräftade att de fortfarande väntar.

## Kvar och kontrollgränser

- Browserstyrningen stoppades av verktyget eftersom aktuell Windows-
  browser-URL inte kunde fastställas säkert. Inga ytterligare UI-inputs
  utfördes. Läsande HTTP-/CLI-kontroller kunde fortsätta.
- Autentiserad ny kamera-/modellstatus, riktig mikrofoninspelning,
  Terra-bildsvar, liveupload, omstartsbeständighet och faktisk produktuppspelning
  är fortfarande öppna kontroller. Alla env kan därför inte markeras godkända.
- Full aktuell env-jämförelse mellan de tre Render-tjänsterna återstår;
  senaste tidigare kvitton finns i `CLOUD-CURRENT-STATE-2026-09-29.md`
  och OpenClaws `CLOUD-ACTIVATION-2026-09-29.md`.
- Inget separat dokument rubricerat som agentklagomål hittades i aktiva
  spårade dokument. `CLOUD-BUG-AUDIT-HANDOFF-2026-09-29.md`,
  `ZONE-CLOUD-STORAGE.md` och `NEON-GAME-MIGRATION.md` beskriver den faktiska
  integrationsluckan. Det pensionerade privata arkivet söktes inte.
- Miljövariabelregistrets konsistenskontroll passerade. Inga env-, API-,
  media-, policy-, databas- eller runtimeändringar ingår i denna rapport.
