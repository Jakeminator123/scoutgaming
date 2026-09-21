# Astrid: källkarta, ägarskap och möjlig dubbelström

[Till dealers, video och takes](README.md) ·
[OpenClaw-prompten](../../PROMPT-OPENCLAW-SOM-TALAGARE.md)

Kontrollerat i arbetskatalogen 21 september 2026. Kartan länkar till de
ursprungliga registren i stället för att skapa ett nytt manifest. Inga
medier, bindningar eller acceptansstatusar ändras här.

## Evidensetiketter

- **Kodkontrollerat**: aktuell fil och dess läsare har granskats.
- **Lokalt test**: ett avgränsat test eller en lokal katalogläsning har körts.
- **Liveobservation 21 september**: daterat HTTP-/browserunderlag som redan
  redovisas i Astrids live-kontroll.
- **Ej liveobserverat**: koden tillåter eller avser beteendet, men inget
  aktuellt uppspelningskvitto finns.
- **Avvisat**: materialet finns men får inte väljas i spelvägen.
- **Saknas/osäkert**: källorna räcker inte för slutsatsen.

## Fyra ansvarslager

### 1. Servern äger spelutfallet

**Kodkontrollerat.** `web/shoe-game.mjs` och den serverägda tabelltransaktionen
äger kort, shoe draw, version, regler, wallet och utbetalning. Native-klienten
anropar `/api/table`. Partner-klienten anropar `/api/v1/table`. Båda vägarna
får publika spelvyer från servern; presentation får inte skapa eller ändra
kort, utfall eller saldo.

`web/partner-presentation.mjs` översätter före/efter-vyer till instruktionerna
`speak`, `deal`, `reveal`, `turn`, `settle` och `idle`. Det är en presentation
av serverfakta, inte en andra spelmotor. `web/native-table.mjs` publicerar i
den pågående arbetsändringen en native-observation först efter commit och
endast när en icke-`state`-begäran faktiskt höjt tabellversionen.

### 2. Croupier äger native rendering, media och cues

**Kodkontrollerat.** Native-klienten i `web/public/app.mjs` skapar en
`DealerEngine` för vald dealer. Astrids staged-läge kan dessutom skapa en
`PerformancePlayer` för de kalibrerade utdelningstagen. Det är två
renderingskomponenter i samma koreografi: engine håller idle/tal och
performance-lagret visar en staged utdelning. Att båda objekten finns är inte
i sig bevis på två oberoende spelade takes.

Allt native tal passerar den gemensamma `speechQueue` i klienten. Den kön
omfattar spelrepliker, inspelade chat-takes och fri chattpresentation. För
inspelat tal väljer `playRecorded` exakt line-ID. Native MP4 prioriteras när
`speech-media.json` anger en sådan; annars används samma line-ID i stream-index
och ljudbank. En fri text får inte låna en gammal mun som uttalar andra ord.

### 3. Jakob/labbet äger urvalsförsök, 2D och lokala kvitton

**Kodkontrollerat.** `lab/lib/presentation-sequence.mjs` läser mottagna
presentationer, skyddar dolda kort, matchar befintliga labbnoder och bevarar
mottagningsordningen. Den skapar inte kort eller saknade event. Varje steg
har `actualPlaybackCaptured: false` tills labbspelaren lämnar ett eget start-,
landnings-, slut-, fel- eller avbrottskvitto.

`lab/lib/original-media*.mjs` bygger en lokal, härledd katalog över befintliga
original. Den flyttar eller skriver inte originalregistren. Ett explicit
projektval vinner alltid över originalförvalet. Saknad exakt match behåller
2D-reserven.

### 4. OpenClaw ger råd och social text

**Kodkontrollerat.** `lab/lib/studio-server.mjs` skickar en validerad katalog
och ett redan publicerat event till OpenClaw/Director för variant-råd.
Serversvaret valideras igen mot tillåtna varianter. OpenClaw äger inte speldata.

Labbets sociala OpenClaw-väg är separat från produktens äldre `/chat`-väg.
Produkten använder ännu `AXEL_AGENT_URL` och egen `VERA_SYSTEM` i
`web/server.mjs`. Därför är “OpenClaw är enda samtals- och talägare” ett
implementationsmål, inte dagens verifierade arkitektur. Den kopierbara prompten
ovan beskriver migrationen inom befintligt repo.

## Astrids ursprungliga register

| Register | Vad det faktiskt innehåller | Vad det inte bevisar | Status |
| --- | --- | --- | --- |
| [`streams/index.json`](../../../../web/public/dealers/astrid/streams/index.json) | Aktuellt lokalt index har 20 H.264-poster: 1 idle, 17 exakta `speak` och 2 actions (`action-deal`, `action-return`). Varje post har frame offsets, frame count, fps och för tal även uppmätt `audioDelayMs`. | Att en post väljs i en viss runda eller är visuellt godkänd. | **Kodkontrollerat.** Det daterade Generations-svaret redovisade 19 motorposter; den lokala indexläsningen har dessutom `action-return`. När skillnaden uppstod är inte belagt här. |
| [`audio/en/bank.json`](../../../../web/public/dealers/astrid/audio/en/bank.json) | 17 line-ID:n med Astrids exakta inspelade text. MP3 ligger med samma line-ID. | Munprecision eller att repliken triggas. | **Kodkontrollerat.** De 17 lokala ljudfiler som originalkatalogen använder finns. |
| [`speech-media.json`](../../../../web/public/speech-media.json) | Native MP4-överstyrning för exakt `goodluck` och `win`, med text och review-anteckning. | Tillgänglighet i driftsatt public-träd eller lyckad uppspelning. | **Lokalt:** båda MP4-filerna finns. **Liveobservation:** båda gav 404 den 21 september. |
| [`dealing-cues.json`](../../../../web/public/dealers/astrid/dealing-cues.json) | Fyra bildcues och timing för den äldre `action-deal`. | Att rörelsen tar ett kort ur skon eller får användas. | **Avvisat.** Status är `rejected`; originalkatalogen filtrerar bort den. |
| [`performance/manifest.json`](../../../../web/public/dealers/astrid/performance/manifest.json) | Draftmanifest med fyra `review`-takes: vänster, mitten, höger och dealer. Varje take bär mediahash, 24 fps, layout, pickup/release/land/rest, kalibrering och playback rate 2. Dessutom finns två `review`-continuations för mitten och vänster. | Full täckning för sju boxar, splitfan, korrekt handkontakt eller godkänd liveprodukt. | **Kodkontrollerat/lokalt.** Grundmanifest och sex filer gav 200 i den daterade livekontrollen; ingen visuell acceptans gjordes då. |
| `performance/smooth60/manifest.json` och `performance/rhythm/manifest.json` | Lokala reviewmanifest med fyra riktningar vardera och egna fps/frame cues. | Att motsvarande deployade URL finns. | **Lokalt:** manifesten finns. **Liveobservation:** manifest-URL:erna gav 404 den 21 september. |
| `performance/joins/manifest.json` | Sex review-joins för entry/exit mellan staged-poser. | Att continuity är aktiverad eller visuellt godkänd. | **Kodkontrollerat, ej liveobserverat i denna kontroll.** |
| `performance/joins/ready/manifest.json` | Review-status, ready-loop, ready-speech och sex ready-joins. | Att talet är exakt eller att ready-vägen används i den aktuella routen. | **Kodkontrollerat, ej liveobserverat.** |
| `performance/scene-acceptance/index.json` | Daterade filer och ett avgränsat bakgrund/cutout-underlag. | Full motion-, tal- eller enhetsacceptans. | **Kodkontrollerat historiskt underlag.** |

Manifestens statusord betyder olika saker. `draft`, `review`, filförekomst och
HTTP 200 är inte `approved`, aktiv BO-bindning eller faktisk playback.

## Vad originalförvalet i labbet väljer

**Kodkontrollerat och lokalt testat.** `lab/lib/original-media-server.mjs`
läser de fyra dealrarnas stream-index och bank direkt. För Astrid gör den detta:

- registrerar idle och alla 17 exakta talposter i katalogen;
- exponerar endast de tal-ID:n som har en befintlig labbnod: `goodluck`,
  `insurance`, `double`, `placebets`, `dealerblackjack`, `blackjack`,
  `dealerbust`, `win`, `push` och `lose`;
- lämnar `greeting`, `bust`, `sidebet`, `peek`, `farewell`, `chatter1` och
  `chatter2` utan labbevent-ID. De finns som media men väljs inte som
  originalförval från dagens 16 noder;
- prioriterar lokala native-MP4 för `goodluck` och `win`, annars exakt
  indexerad H.264 + MP3 + delay;
- exponerar bara de fyra staged-grundtagen som actions. Continuations,
  smooth60, rhythm och joins ingår inte i originalkatalogen;
- mappar spelarkort bara för box 0, 3 och 6 till vänster, mitten och höger.
  Box 1, 2, 4 och 5 behåller 2D eftersom individuell kontakt inte är belagd;
- väljer aldrig den avvisade gamla `action-deal` och hittar inte på reveal,
  tur eller resultattakes.

Spelaren i `original-media-runtime.mjs` väljer exakt en av tre vägar per jobb:
native MP4, indexerad H.264+ljud eller packed staged-take. Ett nytt `play`
avbryter föregående controller. Iframe-komponenten accepterar bara aktuell
same-origin-avsändare och ignorerar dubbla/stale start- och slutmeddelanden.
Detta är lokala previewgarantier, inte livekvitton från originalspelet.

## Undersökning av “två strömmar”

### HTTP-svar och SSE

**Kodkontrollerat, avsiktligt två leveransvägar.** `/api/v1/table` returnerar
`presentation[]` i HTTP-svaret och publicerar samma lista som `events[]` via
SSE efter commit. En konsument som tar emot båda måste korrelera dem; den får
inte spela dem som två rundor.

Labbets sekvens gör detta när underlaget har samma `channel`, `requestId`,
`version`, presentationsindex och identiskt innehåll. Den första instruktionen
behålls och den andra registreras i `deliveries`; olika innehåll för samma
position spärras som konflikt. Saknas request-ID eller version går säker
deduplicering inte att göra och osäkerheten visas.

### Native-publicering och Partner-publicering

**Kodkontrollerat/lokalt test.** Partner-table publicerar från sin egen
transaktion. Native-bryggan publicerar från `/api/table` efter att native-
transaktionen committats och endast till launch-sessionens entydiga
nyckel+partner-player-kanal. `state`, retry utan versionsökning, stale version,
olaglig handling, rollback och misslyckad commit publicerar inte.

Detta visar skydden i den lokala ändringen. Det är ännu **ej liveobserverat**
att den driftsatta native-launchen ger exakt en SSE-runda per accepterat
kommando. Det finns heller inget belägg för att en och samma accepterade
mutation idag går genom båda endpointsen.

### Dubbla prenumerationer

**Kodkontrollerat.** Händelseloggskomponenten tillåter bara en `EventSource`
per monterad komponent, stänger den vid frånkoppling/unmount och ignorerar
meddelanden från en ersatt instans. Flera flikar eller flera observatörer kan
däremot ansluta till samma kanal; servern skickar då samma SSE-meddelande till
varje subscriber. Det är fan-out, inte två publiceringar i samma mottagare.

**Ej liveobserverat:** antal aktiva prenumeranter och nätverksrader i Kevins
tidigare lokala session är inte bevarade i det aktiva underlaget.

### Backoffice-videor och bindningar

**Kodkontrollerat.** Backofficebibliotekets `clipScan()` slår ihop tre
familjer i samma vy:

1. staged performance-takes från manifest,
2. engine streams från dealerindex,
3. äldre route-/review-klipp från `ROUTE_CLIPS`.

Två liknande kort i BO kan därför vara två registerposter för olika
uppspelningssystem eller reviewvägar. Det bevisar inte dubbel runtime-playback.

Ett konkret lokalt glapp kunde förklara Kevins minne: varje BO-kort med MP4
renderades som en egen `<video controls>`, utan gemensam play-ägare som pausade
övriga previews. Två klickade previews kunde därför spela och avkodas samtidigt.

**Lokalt åtgärdat och testat i arbetskatalogen:** BO:s klipp- och talpreview
använder nu en gemensam preview-controller. En ny start pausar och spolar
tillbaka föregående media. Filterbyte, sektionsbyte, omrendering och `pagehide`
pausar, återställer och släpper `src` för synliga eller tidigare aktiva
previewelement. När sidan återkommer från BFCache återrenderar `pageshow` den
aktuella BO-sektionen, så släppta previews får tillbaka sina källor. Det
fokuserade testet verifierar ensam uppspelning, cleanup och att samma element
inte dubbelbinds. API-nyckelvyn visar även serverns separata `events`-scope som
read-only observation utan tabell- eller plånbokskommandon; ingen nyckel
skapades i denna granskning. **Kevins tidigare incident är fortfarande inte
reproducerad eller tidskorrelerad här**, så fixen bevisar inte att detta var
hela hans observerade fel.

`cfg.clipAssignments` skrivs till BO-konfigurationen och visas i BO-vyn. I
nuvarande `web`-källor finns inga andra läsare av dessa assignments; spelaren
läser bara `cfg.tiers`. BO-text som antyder att en klipptilldelning omedelbart
styr liveplayern har därför ingen verifierad kodkoppling. Det är ett separat
konfigurationsglapp, inte belägg för två videoströmmar.

### Flera dekodrar och flera talägare

**Kodkontrollerat, avsiktlig komposition.** `DealerEngine` kan ha en huvud-
`VideoDecoder` och en andra `handsDecoder`. Den senare avkodar den parade
person-/handmatten med samma bildtidsstämplar; de två strömmarna bildar en bild.
I staged-läge kan PerformancePlayer lägga en HTML-video/WebGL-komposition över
engine-idle. Native MP4-tal läggs också till tillfälligt ovanpå dealerbilden
och tas bort i `onFinish`. Dessa samtidiga resurser behöver mätas med faktiska
start/slut och synlighet innan de kallas dubbel visning.

**Reproducerat separat men inte dubbel bild:** [F-001](../../../../docs/findings/REGISTER.md#f-001-samtidiga-medieladdningar-lämnar-en-blob-url-utanför-städningen)
visar att samtidiga `PerformancePlayer.source()` för samma hash kan skapa två
fetch/hash/Blob-resultat där bara en URL hamnar i cachen. Fyndet bevisar en
resursläcka, inte två synliga takes.

**Kodkontrollerat talägarskap idag:** produktens speltriggers och `/chat` kan
båda begära tal men passerar samma klientkö. Produktchatten, labbets sociala
OpenClaw och labbets variant-råd är fortfarande separata beslutsvägar. En enda
kö förhindrar ljudöverlapp i en klient, men gör inte OpenClaw till ensam ägare
av text eller line-val.

## Kvar att observera

- En browsertrace från Kevins lokala BO-session med `play`, `pause`, `ended`,
  element-ID, URL och antal aktiva mediaelement. Utan den går det inte att
  säga vilken dubbelström han såg.
- En native-runda där request-ID/version korreleras med exakt ett SSE-batch,
  klientens valda clip-ID/hash samt målad start, landning, slut eller fel.
- HTTP+SSE i samma sekvensimport för ett verkligt Partner-kommando. Det lokala
  dedupe-testet visar algoritmen, inte dagens liveleverans.
- Visuell kontroll av alla fyra dealers och två på varandra följande plays.
  Lokala hashes, tester och frame receipts ersätter inte den granskningen.

## Direkta källor

- Spelfakta och transport: `web/shoe-game.mjs`, `web/native-table.mjs`,
  `web/partner-api.mjs`, `web/partner-presentation.mjs`.
- Produktpresentation: `web/public/app.mjs`, `dealer-engine.mjs`,
  `performance-player.mjs`, `speech-queue.mjs`, registren ovan.
- Backoffice: `web/server.mjs` (`clipScan`, `clipAssignments`) och
  `web/public/bo/bo.mjs`.
- Labbet: `lab/lib/original-media.mjs`, `original-media-server.mjs`,
  `original-media-runtime.mjs`, `presentation-sequence.mjs`,
  `studio-server.mjs` samt deras fokuserade tester.
- Daterad livegräns:
  [Astrids live-kontroll](ASTRID-LIVE-2026-09-21.md).
