# Croupier Studio — lokalt presentationslabb

**Användarguide: [Guide i dashboarden](http://127.0.0.1:4188/guide).**
Det är den gemensamma dokumentationsytan. Denna README är utvecklarreferens.
Källa och begreppsägarskap: [lab/docs](docs/README.md).

Den nya Next.js-arbetsytan. Den riktiga spelklienten och OpenClaws egen
dashboard är separata. Inget du sparar här publiceras automatiskt.

[Aktiv systemkarta: studio, JSON och lagring](../random-stuff-jakob/jakob-docs/systemkarta/04-studio-json-och-lagring/README.md).

Fördjupning/äldre systemunderlag: [systemkartan](../random-stuff-jakob/jakob-docs/systemkarta/README.md).
Praktiskt prov: [Astrids sociala svar i idle, högst sex sekunder tal](SOCIAL-CHAT.md).
Video-intake: [lägg in standardtagningar och alternativ, välj användning och se täckning](VIDEO-LIBRARY.md).
Buggar, förbättringar och öppna kontroller för labbet och övriga repot finns i
[findings](../docs/findings/README.md); implementation och QA följs i Jira CAC.

## Starta

**Windows: dubbelklicka [Start-Labb.cmd](../Start-Labb.cmd) i repots rot.**
Den använder [Start-Labb.ps1](../Start-Labb.ps1), öppnar webbläsaren och startar
studion om den inte redan körs. Ingen befintlig process stoppas, ingen nyckel
roteras och ingenting ändras på Render. Behåll serverfönstret öppet; Ctrl+C
stoppar servern i det. Efter en `.env`-ändring: stoppa den gamla servern först.

Node 22.16+ behövs; saknade beroenden installeras från låsfilen vid första start.
Variabler och placeringar utan hemliga värden: [_ENVIROMENT-INFO](../_ENVIROMENT-INFO.md).
Tekniska alternativ: `Start-Labb.ps1 -NoBrowser` öppnar inte webbläsaren;
`-CheckOnly` kontrollerar starten utan installation/serverstart; `-Port` väljer
en annan lokal testport. Kommandon för utvecklare, från repots rot:

```powershell
npm --prefix lab ci
npm --prefix lab run dev
```

Öppna <http://127.0.0.1:4188>. Stoppa med Ctrl+C. Den gamla lokala servern
ska inte köras samtidigt på samma port. För byggd version: `npm --prefix lab
run build`, därefter `npm --prefix lab start`. Studion är avsiktligt endast
för localhost; öppna den inte mot internet eller ett publikt nätverk.

## Arbetsytor och gemensam Guide

- **Guide (`/guide`):** den avskalade arbetsgången, gemensamma begrepp och tydliga gränser för vad som gäller nu respektive är förslag.

- **Nodträdet (`/tree`):** välj dealer och presentationssätt: idle/bakgrund,
  engångshandling, exakt tal eller tur/resultat. De fyra grupperna är en vy
  över befintliga sex källtyper och 16 eventgrupper. Vald nod visar exempeldata,
  förväntade källfält och saknade uppgifter, separat från testkontext och
  urvalets variant-ID. Standard är också en variant; linje är behållaren för
  en dealers standard och alternativ. Klicka vidare till editorn utan att
  tappa osparat arbete. Ingen seed eller något tekniskt ID migreras.

- **Eventstudion:** välj croupier/event, redigera namn, linje, varianter och
  triggers. Testa ett publicerat exempel med simulerad chatt, historik och
  framtoning. Den animerade scenen och beslutsspåret visar vad som händer.
  **Spela vald variant** spelar ditt markerade klipp direkt: kopplad video,
  annars just den variantens 2D-reserv. Välj fil direkt under **Standardvariantens
  video** i varianteditorn och spara med **Spara projekt**. Alternativ får egna
  kopplingar; de lånar aldrig standardens film. **Bara 2D** är ett manuellt
  förhandsvisningsval. **Testa event** kör regler/modell. Beslutsmodell och
  simulerad kontext ligger samlade under **Regeltest & OpenClaw**. I Astrids vänteläge finns separat
  riktig OpenClaw-spelarchatt med redigerbar social policy och valfritt tal.
  Socialt svar och handlingspreview har en gemensam spärr: ett textsvar och
  högst sex sekunder tal i neutralt idle. Modellens uttrycksförslag loggas
  separat; ingen hand- eller kroppsrörelse läggs ovanpå talet. Riktig läppsynk
  återstår.
- **Videobanken:** lägg in egna MP4/WebM-filer med dealer, event, typ,
  standard/alternativ och konkret situation. Filtrera banken och kontrollera
  vilka standardlinjer som har video. Inspektera original och bind vald variant till ett exakt
  `videoGenerationId`. Samma koppling kan redigeras direkt i Eventstudion.
  Detta är en labbkoppling, inte ett runtime-godkännande.
- **Händelselogg (`/activity`):** flikens indata, beslut och uppspelarens
  start/slut/fel med tid, källa, beslutsfattare och orsak. Fäll ut faktisk JSON
  och filtrera stegen. Loggen håller högst 150 poster i minnet och töms vid
  omladdning. En kompakt logg följer de andra vyerna. Här finns även valfri,
  läsande observation av Partner-strömmen; den kör inget lokalt urval eller
  någon uppspelning.
- **OpenClaw:** ansvar, anslutningsstatus och operatörschatt om det senast
  sparade projektet. Länk till den befintliga, separata native-dashboarden.
  Chatt kräver en konfigurerad anslutning; inga modellsvar fejkas.
  Här finns också **Prova rösten**: tre standardfraser, egen text eller en
  kopia av det senaste operatörssvaret. Explicit knapptryck genererar Sarah-röst
  via ElevenLabs (kan kosta krediter); återanvändning av samma prov kostar inget
  nytt modellanrop. Detta är separat ljud, inte spelarchatt eller videosynk.

## Filer och begrepp

```text
lab/
  policies/project.seed.json   startprojekt: blackjack, 4 dealers, 16 noder
  policies/social.seed.json    startpolicy för Astrids sociala chattprov
  schemas/studio.schema.json   struktur och tillåtna värden
  schemas/social.schema.json   format för den separata sociala policyn
  animations/                 64 eventrörelser + separat social.ledsen i JSON
  lib/studio-model.mjs         kontrakt, referenser, validering och konvertering
  lib/presentation-profile.mjs visningsgrupper och källfält för Nodträdet
  lib/activity-log.mjs         tillfällig händelselogg och förloppskoppling
  lib/partner-observer.mjs     läsande, signerad Partner-SSE på lokal server
  lib/social-playback.mjs      en talägare, sexsekundersgräns och stopp
  data/project.json           ditt sparade projekt (lokalt, Git-ignorerat)
  data/history/               tidigare sparade revisioner (Git-ignorerat)
  data/social-policy.json     sparad social policy, separat från eventprojektet
  data/social-history/        tidigare sociala policyrevisioner
  data/voice-cache/            text/röst/modell-indexerade MP3-prov och metadata
  test/                       automatiska regler-, lagrings-, API- och videotester
  app/                        Next.js-sidor och lokalt API
  components/                 editor, scen, videobank och OpenClaw-panel
```

`policies` betyder här startregler; `schemas` beskriver strukturkraven.
`data/` skapas vid sparning och ersätter inte startprojektet i Git. Ingen separat
projektmanifest behövs. Rörelsebibliotekets lilla `animations/index.json`
listar däremot vilka rörelsefiler som ingår. `.next/` och `node_modules/` är
genererade verktygsmappar. [Rörelsernas format](animations/README.md).

Fristående ElevenLabs-prov (inte scen-/chattintegration):
`node tools/elevenlabs-lab-preview.mjs --check` från repots rot, eller
`--generate` för ett kort debiterbart röstprov. MP3 + text/röst/hash-metadata
sparas lokalt i `lab/data/voice-previews/`, utanför Git. Ingen produktmedia
eller lipsync ersätts. [Status och urvalsmodell](../random-stuff-jakob/jakob-docs/systemkarta/05-openclaw-rost-och-drift/README.md).

Signal → event + relevant kontext → urval → material → uppspelningskvitto.
Signal är samlingsordet för indata, till exempel spelfakta, ett chattmeddelande
eller ljudets slut. Ett event är en namngiven händelse med data. De sex
Partner-presentationstyperna beskriver bara en del av systemets händelser.
`box` är plats 0–6, inte en identifierad spelare. Variant-ID är ett beslut
efter indata; längd och landningstid kommer från materialets metadata.

En linje hör till en croupier och ett event. Starten har 64 linjer med en
standard och tre labbalternativ vardera (256 dealer-specifika variantposter,
64 gemensamma rörelser). Högst fyra alternativ plus standard kan redigeras.
Sparade äldre projekt fylls inte på automatiskt eller skrivs över.
Roulette är bara en synlig framtida plats, inte implementerat.

Partner-API:ts **sex presentationstyper** är `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
De **16 noderna** är labbets begripliga mappningar, inte 16 nya motor-events.
Visningsnamn kan ändras; tekniska event-ID:n, matchning och exempel är låsta.
Standardvarianten kan inte raderas eller villkoras. Alternativ och triggers
kan läggas till och tas bort; använda triggers måste först kopplas loss.

Triggerkategorier: `deterministic` (publicerat spel/avgjord historik), `social`
(simulerad chatt/preferens), `temperament` (croupierns framtoning, inte en
diagnos av spelaren). I nodträdet visas två huvudgrupper: **spelstyrda** och
**sociala/uttryck** (social + temperament). Alla valda villkor måste stämma. Inga villkor betyder
inga extra villkor; variantens separata val för regler, modell och slump avgör
vilka urvalslägen den får delta i. Nya alternativ börjar manuellt.
[Detaljer om policyerna](policies/README.md) och [videointake](VIDEO-LIBRARY.md).

**Spara projekt** validerar, kontrollerar revision och skriver atomiskt med
historik. Ett annat fönsters nyare ändringar skrivs inte över. Startfilen
används endast när `data/project.json` saknas. Export-knappen ger JSON för
granskning/versionering; ingen import- eller publiceringsknapp finns ännu.
`LAB_STUDIO_DATA_DIR` kan välja en separat datamapp för QA.

## OpenClaw och Render

**Nuvarande blueprint:** [open-claw/lab/render.yaml](../open-claw/lab/render.yaml).
Den ligger kvar på den driftsatta sökvägen; den nya Next.js-sajten ingår inte
i blueprinten. `open-claw/` äger Gateway, adapter och Docker/Render-drift;
den äldre mappen `open-claw/lab/` behålls tills vidare för dessa beroenden.
Det är inte en andra ny OpenClaw-installation.

```text
Lokal studio → lokal server → HTTPS till Render Director → privat OpenClaw
                      ← validerat variantförslag ←
```

`off` använder standard utan modell. `rules` väljer högst prioriterade
tillåtna variant utan modell. `random` lottar mellan standard och uttryckligen
slumpaktiverade alternativ vars triggers matchar. `shadow` tar emot råd men spelar standard.
`active` tillåter bara ett godkänt variant-ID för exakt event, dealer och
utkastrevision. Fel, timeout eller otillåtet råd ger standard. RNG, kort,
saldo och utbetalningar är aldrig OpenClaws ansvar.

Vid senare anslutning: sätt `LAB_REMOTE_URL` till Directors HTTPS-adress och
`LAB_REMOTE_TOKEN` till dess `LAB_API_TOKEN`, i rotens `.env` eller labbets
`.env.local`. De läses endast på servern. Ingen `NEXT_PUBLIC_*`-nyckel.
`OPENCLAW_MODEL_API_KEY` stannar på Gatewayen; `OPENCLAWAPI_KEY` är Gatewayens
inloggning och är inte samma sak som Directors API-token.

Den här ändringen tillför `/api/studio/advice` och `/api/studio/chat` i
Director. De behöver driftsättas innan nya studion kan använda Render med
sin tillfälliga katalog. Anropen sparar **inte** utkastet i Render. Direkt
lokal Gateway stöds också via `OPENCLAW_BASE_URL` och `OPENCLAWAPI_KEY`.
Konfigurerad betyder inte automatiskt hälsotestad. Den 20 september 2026
driftsattes Director `7f056f7`: aktivt val, shadow och operatörschatt gav
riktiga modellsvar via lokal Next-server. Första rådanropet fick timeout;
fallback fungerade och omprovet gav giltigt råd. Detta är ett daterat
anslutningsprov, inte en garanti för svarstiden i spelet.
[Officiellt OpenClaw-index](../open-claw/lab/docs/README.md).

## Läsande Partner-ström

`/activity` kan observera den befintliga `/api/v1/events` med en signerad
serveranslutning. Ange följande i den lokala, Git-ignorerade `lab/.env.local`
och starta om labbservern:

- `BETTALOTTO_PARTNER_KEY_ID`: den publika Partner-nyckeln (`ck_live_…`), inte
  backoffices rad-UUID. Nyckeln behöver `play`-behörighet.
- `BETTALOTTO_PARTNER_SECRET`: nyckelns hemliga signeringsdel, aldrig i webbläsaren.
- `BETTALOTTO_PARTNER_PLAYER_ID`: partnerns spelar-ID för den kanal som ska läsas.
- `BETTALOTTO_PARTNER_BASE_URL`: valfritt; standard är `https://bettalotto.se`.
  En uttryckligen konfigurerad loopback-adress stöds för isolerade tester.

Detta är en ny, valfri anslutning. Den använder Next-serverns miljö, som läser
`lab/.env.local`; observatören läser inte automatiskt reporotens `.env`.
Befintlig läsning av Director-/OpenClaw-inställningar från rotens `.env` är
oförändrad. Flytta eller döp inte om de befintliga tjänsternas uppgifter för
att aktivera Partner-loggen.

`play` ger även behörighet till Partner-API:ts bordskommandon. Nyckeln är
alltså inte begränsad till läsning bara för att denna observatör enbart
anropar `GET /api/v1/events` och inte skickar spelhandlingar.

Prefixet anger vem som utfärdar uppgifterna: Bettalotto Partner API, inte
labbet. Nyckelparet kan användas av olika klienter inom sin behörighet;
`PLAYER_ID` väljer vilken partnerkanal den här observatören läser. De tidigare
`LAB_PARTNER_*`-namnen accepteras som kompatibilitetsalias.

Detta är skilt från våra övriga anslutningar: `LAB_API_TOKEN` skyddar vårt
Director-API och `LAB_REMOTE_TOKEN` är den lokala kopian för anrop dit.
`OPENCLAWAPI_KEY` hör till Gatewayen. Ingen av dem ersätter Bettalottos
publika Partner-nyckel och tillhörande signeringshemlighet.

Det historiska namnet `BETTALOTTO_API` avser enligt Kevins åtkomstuppgifter
en separat lästoken för generationsregistret: `GET /api/v1/generations`
med `Authorization: Bearer <readtoken>`. Den läser metadata/material och är
inte Partner-nyckelparet för SSE. Se [Partner-dokumentationen](https://bettalotto.se/docs/partner-api.html).
Detta klargör nycklarnas roller; någon liveanslutning till generations-API:t
har inte verifierats här.

Nycklar skapas i backoffice under API Keys. **Anslut läsande** gör en faktisk
anslutning; ”konfigurerad” bevisar inte behörighet eller trafik. Saknade
uppgifter visas som saknade. Loggen fylls aldrig med låtsad live-trafik.
Ofullständiga nycklar och secrets stoppas av en lokal formatkontroll innan
anslutning. Godkänt format bevisar inte att paret är giltigt, har rätt scope
eller använder rätt playerId; det kan bara verifieras mot Bettalotto.

Strömmen avser samma API-nyckel och partner-playerId. Den vanliga klientens
`/api/table`-anrop ingår inte. En backoffice-inloggning ansluter inte labbet.
Observern läser publicerade rundor och presentationsinstruktioner, gör inga
spelhandlingar och styr inte scenen. Mottagen instruktion, lokalt variantval
och uppspelningskvitto är tre skilda saker.

SSE-källan saknar replay. Avbrott loggas som möjliga luckor och kräver ny
uttrycklig anslutning; loggen är ingen fullständig spelhistorik. Lokala API:n
är `/api/inputs` för status och `/api/inputs/events` för observation.

## Video och kvarvarande integration

Originalregistret läses från den befintliga
[V3-snapshoten](../docs/animation-events/v3-video-map/snapshot.json).
På Jakobs Windows hittas originalarkivet automatiskt; annars anges
`LAB_VIDEO_ARCHIVE` i `lab/.env.local`. Inga videor flyttas eller läggs i Git.
Egna uppladdningar läses dessutom från `data/videos/index.json`; filer sparas
byte för byte i samma Git-ignorerade mapp. Servern tillåter bara registrerade
video-ID:n och kontrollerar storlek och
SHA-256 före uppspelning. `want` är intake, inte visuell acceptans.

Registret är lokal filmetadata, inte AI-indexering av filmernas innehåll.
Att söka, koppla och spela video gör inga modell-/ElevenLabs-anrop.
Saknad eller ospelbar fil ger en märkt 2D-reserv. Filmer spelas till sitt eget
slut, inte animationens testlängd, och loopas inte. Inga 16 filmer väljs
automatiskt: exakt situation, dealer, riktning och eventuell talrad måste matcha.

Bestående spelarminne, produktens spelarchatt/moderering och integration med
produktens gemensamma videospelare återstår. Astrids separata idle-chattprov
använder verkliga modellsvar; eventtestets kontext är fortfarande simulerad.
IDE-agenternas GitLab-inbox hör inte hit. Videor måste granskas per take
med text/ljud, hash och kalibrering innan de aktiveras i spelet. Nodträdet
grupperar efter presentationssätt utan att ändra motorns kontrakt.

### Samstämmighet med Croupier

[Kompatibilitet och gränser](COMPATIBILITY.md) skiljer verifierade källfält
från labbpolicy och från godkända videotakes. `settle` är inte `speak`:
resultatgrupperingen får aldrig ersätta motorns exakta `speak.line`.
`speak.other` samlar flera repliker och kan inte användas som en gemensam
godkänd talvideo. En labbrörelse byter inte språk eller inspelat ljud.

Labbets JSON-animation får inte ändra delningsriktning eller ta bort en
kortvändning. En videoreferens kontrolleras mot registret men är fortfarande
en **ogranskad labbpreview**, inte automatiskt rätt dealer/action/talrad.
Produktionskopplingen måste granskas separat tillsammans med Kevin.

## Kontroller

```powershell
npm --prefix lab test
npm --prefix lab run typecheck
npm --prefix lab run build
npm --prefix open-claw/lab test
```

Tester använder isolerade filer och simulerade modelltransporter, inte riktiga
spelare eller modellnycklar. Byggnaden verifierar inte en Render-driftsättning.
