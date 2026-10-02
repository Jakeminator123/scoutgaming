# Croupier V2: GitHub och drift utan lokal dator

Arbetsbranch: `main` i `Jakeminator123/github-work` från 2026-10-02.
V1-återställningsankare: tagg `Jakobs-v1`, commit `600093e`, verifierad på
både GitLab och GitHub. Senare färdigställt agentarbete behöver följa med till
GitHub innan V2 betraktas som den kompletta fortsättningen.

Detta är ett tekniskt driftsunderlag daterat 28 september 2026. Molndrift är
ännu inte verifierad. Befintliga lokala åtkomstspärrar är kvar.

## Kör en läsande kontroll

```powershell
node tools/cloud-readiness.mjs
node tools/cloud-readiness.mjs --json
node tools/cloud-readiness.mjs --json --strict
node --test test/cloud-readiness.mjs
```

Kontrollen läser källfilernas närvaro, mediemanifestets metadata och filstorlekar
samt uttryckligen angivna processmiljövariabler. Den öppnar inga databaser,
läser inga `.env`-filer eller mediabytes, anropar inga externa tjänster och
startar inga servrar. Resultatet visar variabelnamn och status, aldrig nycklar,
URL-värden eller privata datasökvägar. Saknad processvariabel betyder inte att
den saknas i Lissabons privata lokala konfiguration.

Vanlig körning returnerar 0 när rapporten skapats. `--strict` returnerar 2 så
länge migration återstår. `ready` är uttryckligen `false`: kataloger och
konfigurerade nycklar bevisar inte beständig lagring, autentisering eller drift.
Blockerarlistan beskriver dagens arkitektur och behöver omprövas när den ändras.

## Skydda lokal spel- och labbdata

Lissabons `lissabon/data/players/croupier.db` innehåller spel, saldo, chatt och
Probe-minnen. `craig.db` innehåller kontoidentitet. Projekt och historik finns
under `lissabon/data/`. Radera inte dessa filer mellan spelomgångar eller
omstarter. De ingår inte i Git eller i en framtida containerbild.

När det samordnade serverparet är stoppat kan en privat, verifierad kopia skapas
utanför checkouten med `node tools/backup-lissabon-state.mjs --destination
<absolut-katalog>`. Kommandot vägrar en aktiv samordnad serversession, SQLite-sidofiler och
befintlig målkatalog. Det kopierar bara tillåtna databaser, projektfil och
projektets revisionshistorik samt uppladdade videor med index och
klassificeringar, verifierar SHA-256 och lämnar originalen kvar.
Återläsning eller flytt av privata spelarminnen till molnet kräver ett separat
beslut och ett prov med isolerade testdata först.

## Vilken motor används?

Lissabon startar produktservern `web/server.mjs` och Next-studion i `lab/` via
`lissabon/start.mjs` och `open-claw/lab/deploy/local-connection.mjs`.
Node 22.16 eller senare och `npm --prefix lab ci` krävs. Produktservern använder
även labbets beroenden. Lissabons lokala startare är inte en molnstartare.

Spelkedjan är:

1. `web/shoe-game.mjs` och `web/public/blackjack.mjs` bestämmer kort och regler.
2. `web/native-table.mjs` sparar rundan, shoe och saldo i en SQLite-transaktion.
3. `web/partner-presentation.mjs` ger publika presentationer: `speak`, `deal`,
   `reveal`, `turn`, `settle`, `idle`.
4. `presentation-runtime/selection.mjs` väljer kompatibelt material.
5. `web/public/local-presentation.mjs` och `performance-player.mjs` spelar
   Astrids exakta filmer med `?dealer=astrid&presentation=local`.

BO administrerar material och bindningar; ingen separat `bo-events`-motor
behöver installeras. Native `/api/table` och Partner `/api/v1/table` har
publika presentationssvar. `/api/v1/events` är SSE med processlokala
prenumeranter och utan replaybuffert. Labbet observerar samma spel;
browsern komponerar och spelar presentationen.

OpenClaw/Director ger beslut och text, OpenAI Whisper översätter spelarens
tal till engelska, Cartesia ger Astrids röst och RunPod talvideo.
Den befintliga Render-installationen ersätter inte produktservern, dess
databaser eller det lokala labbet.

## Förberedd molningång, ännu spärrad

`ops/cloud/` har nu en isolerad ingång med tre exakta HTTPS-värdnamn: spel,
BO och Lab. En administratör loggar in på BO och får en kort engångsöverlämning
till Lab. Lab-cookien är värdbunden och HttpOnly; ingången frågar Web om
administratörens aktuella roll, lösenordsavtryck och en växande
behörighetsversion vid varje Lab-begäran. En återställd roll eller ett
återställt lösenord återaktiverar inte en äldre BO- eller Lab-session.
Först därefter skickar ingången en intern behörighet till Next Lab. Riktade
lokala tester täcker routning, felaktiga värdar, förfalskade headers,
utgången/återanvänd kod, begränsat antal väntande inloggningar och ändrad
eller borttagen administratör.

Startspärren i `ops/cloud/start.mjs` står kvar. Ingen container är byggd eller
publicerad, och verklig HTTPS-inloggning, cookies, omstart och hela
Astrid-flödet är inte verifierade. Det första driftpaketet stänger också av
genererat tal och kamera tills en separat skyddad aktivering och prov finns.
En senare ändring förbereder autentiserad WebSocket-vidarebefordran och
serverstyrd strömning utan att lyfta startspärren. Se
[Astrids GPU-provplan](ASTRID-GPU-CLOUD-TEST.md) för aktuella begränsningar.

## Ett källrepo, separata driftsenheter

Behåll ett monorepo på `main`. Produktservern,
Next-labbet, OpenClaw-koden och presentationsmotorn importerar moduler direkt
från varandras kataloger. En uppdelning i två källrepo skulle först kräva
versionerade gemensamma paket och ett separat mediekontrakt. Bygg i stället
avgränsade driftsenheter från samma branch med egna Dockerkontexter och
byggfilter. [Render stöder detta i monorepo](https://render.com/docs/monorepo-support).

Runtimegränsen styrs av lagringen: Renders beständiga disk kan bara läsas av
den tjänst den hör till. Labbet på Vercel kan inte heller skriva samma lokala
`project.json` eller läsa spelarens SQLite-fil. Innan produkt och labb får
varsin tjänst behövs därför ett autentiserat lagrings-API eller extern
projekt-/medielagring. En första fjärrdriven instans kan samla processerna på
en beständig värd med kontrollerad routing, men den lösningen måste provas som
en egen driftsenhet. Ingen källrepo-uppdelning krävs för det steget.

## Rekommenderad första molndrift

En långlivad backend med en produktprocess, ett labb och beständig disk
behåller dagens transaktioner och gemensamma projektlagring. Lägg tjänsterna
bakom skyddad HTTPS. Vercel kan vara ingång eller frontend. Datorn behöver
då bara en webbläsare.

| Del | Placering och krav |
| --- | --- |
| Produkt | Långlivad Node-process, initialt en replika |
| Studio | Next-server med autentiserad operatörsåtkomst |
| Speldata | Beständig `/data/players`: `croupier.db`, `craig.db`, `bo.json` |
| Projekt | Delad beständig `/data/studio`: projekt, historik, uppladdningar och röstcache |
| Originalmedia | Exakta filer och manifest i `emil/dealklipp-v1` eller samma absoluta `LAB_VIDEO_ARCHIVE` i produkt och labb, samt produktens befintliga dealerassets |
| Genererat tal | Privat katalog utanför checkout, exempelvis `/data/speech`; ägarbindning och rensning bevaras |
| AI-tjänster | Befintliga skyddade OpenClaw-, Cartesia- och RunPod-anslutningar |

Ett rent Vercel-upplägg kräver större ändringar: extern databas, projektlagring,
medialagring och beständig jobb-/eventhantering. SQLite på lokal beständig fil
passar inte Vercels funktionslagring. [Vercels SQLite-beskrivning](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

Vercel har WebSocket-stöd, men det flyttar inte processminne eller SQLite till
beständig lagring; aktuell produkt använder SSE.
[WebSockets](https://vercel.com/docs/functions/websockets).
Funktionsanrop har tids- och storleksgränser, bland annat 4,5 MB payload.
Direkt media-/ljudtransport behöver därför granskas innan den går genom en
funktion. [Funktionsgränser](https://vercel.com/docs/functions/limitations).
Extern proxy till backend har 120 sekunder till första byte. Talvägen har
idag upp till 180 sekunders providerdeadline och måste provas med verklig
streaming eller separat jobbstatus.
[Vercels proxytimeout](https://vercel.com/changelog/cdn-origin-timeout-increased-to-two-minutes).

Det befintliga Vercel-projektet `animation-events-v1` är en separat historisk
dokumentationspublicering från `Jakeminator123/animation-events-v1`, inte spelet.
Den ska inte byggas om som bieffekt av denna migration.

## Ändringar som krävs före aktivering

| Källa | Nuvarande hinder | Förberedelse |
| --- | --- | --- |
| `lab/lib/http-guard.mjs` | Autentiserat cloudläge är implementerat men inte driftprovat | Verifiera verklig HTTPS, Lab-cookie, nekade origins och intern behörighet innan startspärren tas bort |
| `lab/lib/partner-observer.mjs` | Molnspel kräver en uttrycklig tillåten origin | Ange samma exakta HTTPS-origin i `CROUPIER_GAME_ORIGIN` och `BETTALOTTO_PARTNER_BASE_URL`; verifiera därefter autentiserad observation |
| `web/lissabon-profiles.mjs`, `web/server.mjs` | Profiler saknar lösenord och kräver lokal utvecklingsdrift | Använd autentiserad identitet eller skyddad demoåtkomst; behåll lokal profilspärr |
| `web/generated-speech.mjs` | Molntal kräver uttrycklig aktivering, privat lagring och giltig HTTPS-origin | Ange `CROUPIER_CLOUD_GENERATED_SPEECH=1` i produktion med autentiserad spelare och verifiera hela det betalda ljud-/videoflödet |
| `lab/lib/project-store.mjs` | JSON, revisionshistorik och fillås | Gemensam beständig volym för Web och Lab, eller en separat lagringsadapter |
| `web/presentation-api.mjs`, `lab/lib/video-registry.mjs` | Båda läser nu `LAB_VIDEO_ARCHIVE`, men driften behöver samma media på båda processerna | Ange samma absoluta arkivrot med `lab-video-manifest.json` och exakta filbytes; verifiera att den valda drifttopologin faktiskt delar dem |
| `web/partner-api.mjs`, `web/server.mjs` | SSE, chattlås och Probe har processminne | Börja med en produktreplika; planera återanslutning och senare delad koordinering |

Driftpaketet behöver en kontrollerad start/stop, healthcheck, sekretesskyddad
loggning och backup/restore för diskdata. Begränsa en publik ingång till avsedda
spelrutter och autentiserade studio-/BO-rutter. Host- och Origin-hantering bakom
proxy måste testas; att skriva om dem till localhost ersätter inte autentisering.
Produkt och labb har överlappande `/api`-sökvägar. Använd två kontrollerade
hostnames eller en uttrycklig, testad uppdelning av rutterna i ingången.

## Konfiguration att föra över privat

- `PUBLIC_URL`, `BO_URL`: rätt publika HTTPS-adresser.
- `CROUPIER_GAME_ORIGIN` och `BETTALOTTO_PARTNER_BASE_URL`: samma exakta
  HTTPS-origin för spelet, utan sökväg eller extra port. Labbet använder den
  uttryckliga tillåtelsen för sin autentiserade Partner-observatör.
- `CROUPIER_DATA_DIR`: beständig datakatalog.
- `LAB_STUDIO_DATA_DIR` och `CROUPIER_PRESENTATION_STUDIO_DIR`: samma absoluta katalog.
- `LAB_VIDEO_ARCHIVE`: valfri, gemensam absolut rot för Astrids manifest och
  familjemappar. Ange identiskt värde i produkt och labb. Utan variabeln läser
  båda `emil/dealklipp-v1` i checkouten. En relativ eller otillgänglig rot
  stänger medievägen i stället för att falla tillbaka till checkoutens klipp.
  Den samordnade lokala startaren för variabeln vidare till båda processerna
  när den anges i miljön eller den privata konfigurationen.
  En Render-disk kan inte monteras i två separata tjänster; välj därför en
  mediekälla som faktiskt är åtkomlig för båda, eller samlokalisera dem på en
  enda instans innan en delad lagringsadapter finns.
  [Renders diskbegränsningar](https://render.com/docs/disks).
- `CROUPIER_STREAM_LANE=lissabon-stream-lane`: rätt Astrid-policy.
- `LAB_REMOTE_URL/TOKEN`: labbets Director.
- `CROUPIER_PRESENTATION_DIRECTOR_URL/TOKEN`: produktens presentationsråd.
- `OPENCLAW_PRODUCT_SPEECH_URL/TOKEN`: krävs för molnstartens separata
  produktroll för chatt/tal. `OPENCLAW_TIMEOUT_MS` är 8000 som standard
  och kan sättas mellan 1000 och 30000.
- `CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/PASSWORD`: hemligheter för första
  uppstart med tom CRAIG-databas. Efter att administratören skapats tar
  operatören bort dem från värdplattformens hemligheter. Ingen befintlig
  användare skrivs över.
- `CARTESIA_API_KEY`, `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`: tal/video.
- `CROUPIER_ASTRID_TRANSLATION_KEY`: giltig OpenAI API-nyckel endast på
  produktservern för `whisper-1` och `/v1/audio/translations`. Den får aldrig
  publiceras som `NEXT_PUBLIC_*`, läggas i klientkod eller ersättas av en
  Gateway-/Director-token. Lokal start kan aliasa en befintlig officiell
  OpenAI-nyckel; en molnstart måste föra in nyckeln som skyddad servervariabel.
- `CROUPIER_SPEECH_VISION=1` på Gateway: ger Luna och Terra bildinput efter
  deployment av aktuell Gateway-konfiguration och Director. Verifiera båda
  modellerna genom den driftsatta kedjan; modellens allmänna bildstöd räcker
  inte som bevis för rätt konfiguration.
- `CROUPIER_GENERATED_SPEECH_DIR`: privat katalog utanför checkout.
- `CROUPIER_GENERATED_SPEECH=1`, `CROUPIER_CLOUD_GENERATED_SPEECH=1`: separat
  molnaktivering. Kräver `NODE_ENV=production`, en riktig `PUBLIC_URL` med
  HTTPS, avstängt gästläge och privat katalog/nycklar ovan. Den samordnade
  molnstarten sätter `CROUPIER_CLOUD_RUNTIME=1` för produktprocessen på
  `127.0.0.1` bakom den kontrollerade HTTPS-ingången; direkta molnservrar
  kräver i stället en publik `HOST`.
  Lokal förhandsvisning använder fortsatt `CROUPIER_GENERATED_SPEECH_PREVIEW=1`
  och loopback-HOST. Detta är en konfigurationsmöjlighet, inte ett genomfört
  leverantörsprov i den nya driften.
- `CROUPIER_ASTRID_CAMERA=1`: valfri kamerafunktion efter explicit aktivering;
  HTTPS och browserns egna enhetsbehörigheter krävs i molnet.

Förbered ny studio från `lissabon/project.snapshot.json` endast om ingen sparad
projektfil finns. Senaste privata `lissabon/data/project.json` och historik kan
innehålla nyare val. Granska och säkerhetskopiera dem separat. Flytta inte
personliga spelarminnen eller databaser till en publik demo som standard.

En Git-tagg skyddar versionerad kod och media, inte ignorerade databaser,
projektinställningar, hemligheter eller externa tjänster.

## Render-diskarnas backup och inloggningsbeslut (29 september)

Tre separata datarötter behöver bevaras: produktens `/var/data`, Directors
`/data/catalog` och Gateways `/data/openclaw`. En profilbunden export,
SHA-256-/SQLite-verifiering och återställning till tom datarot finns nu i
[`RENDER-BACKUP-RESTORE.md`](RENDER-BACKUP-RESTORE.md). Alla lokala prov använde
syntetiska filer. Ingen skarp Render-backup, extern kopia, omstart eller
återställning är utförd; diskarnas aktuella montering återstår att kontrollera.

Befintlig spelarlogin använder CRAIG-identitet, BO använder CRAIG-roller och
skyddade sessioner, och BO→Lab/spel har engångsöverlämning. **OAuth behövs inte
för nuvarande pilotkrav.** Ingen leverantör eller nyckel har skapats. Verklig
HTTPS-inloggning och sessioners återkallning måste fortfarande provas i Render.

## Godkännande av faktisk drift

Verifiera på avsedd molnadress:

1. Inloggning/åtkomst, nekade främmande origins, cookies och HTTPS.
2. Sparad projektändring och spelrunda över processomstart utan ändrat saldo,
   dubbelt utbetalt resultat eller borttappad shoe.
3. Manifestets exakta media, korrekta Range-svar och rätt familj/box/replik.
4. Riktig runda med native-event, urval och faktisk uppspelningskvittens;
   SSE-avbrott får inte ge dubbel presentation.
5. Talets fulla kedja, timeout/avbrott, rätt sessionsägare och inga nycklar i klienten.
6. Kamera/mikrofon med verkligt användarsamtycke, om den funktionen aktiveras.
7. Record → lokal ”Astrid”-aktivering → svensk/engelsk fråga → engelsk
   Whisper-text → bildtolkning med vald modell → hörbart Astrid-svar.
   Ingen transkription eller bild ska visas utanför den avsiktligt öppnade
   loggen. Lokal röstaktivering beror på webbläsarens installerade talstöd;
   Vercel eller Render kan inte ersätta ett saknat lokalt språkpaket.

Vid ändring av spelare/media körs `.githooks/pre-commit`,
`node pipeline/audit-dealer-sync.mjs --probe` och alla fyra dealers i faktisk
rehearsal med två på varandra följande spelningar. Ingen kontroll här godkänner
läppsynk eller hand-/kortkontakt. Dagens kvarvarande visuella och fysiska
enhetsprov följer `docs/JOHN-HANDOFF.md`.
