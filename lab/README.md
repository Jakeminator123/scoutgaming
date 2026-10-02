# Croupier Studio — gemensam arbetsyta för presentation

**Användarguide: [Guide i dashboarden](http://127.0.0.1:4188/guide).**
Det är den gemensamma dokumentationsytan. Denna README är utvecklarreferens.
Källa och begreppsägarskap: [lab/docs](docs/README.md).

**Moln:** [Astrid Studio](https://croupier-v2.onrender.com/studio) är den
kanoniska arbetsytan bakom ordinarie Lab-inloggning. Vercel är ingången;
Render kör Studio och spelet. **Lokalt:** samma Studio körs på det enda
koordinerade serverparet. [Väg- och strömkartan](../docs/LOCAL-PRESENTATION-RUNTIME.md)
skiljer adresser, spelobservation, Partner-SSE, talvideo och BO-administration.

Eventeditor och sekvensspelare går genom `POST /api/presentation/decision`.
Den gamla `/api/simulate` är ett alias. Servern delar samma pågående/sparade
beslut för ett oförändrat `requestId`; förändrat innehåll ger 409. Cache och
samtidighetsgräns gäller en Node-process: 128 jobb, fem minuter efter svar,
högst fyra pågående beslut. Nytt manuellt prov får nytt ID. Källans ID ligger
separat i `sourceRef`. Detta deduplicerar modellbeslut, inte uppspelning i olika
flikar. Källreferenser skickas inte till modellen. `decision.director` visar
ägare, cacheåterbruk och att uppspelning ännu inte är bekräftad. Explicit bundna
alternativ med otillgänglig eller felmatchad video utesluts före modellval.

Den nya Next.js-arbetsytan. Den riktiga spelklienten och OpenClaws egen
dashboard är separata. Inget du sparar här publiceras automatiskt.

[Aktiv systemkarta: studio, JSON och lagring](../docs/LOCAL-PRESENTATION-RUNTIME.md).

Fördjupning/äldre systemunderlag: [systemkartan](../docs/LOCAL-PRESENTATION-RUNTIME.md).
Praktiskt prov: [Astrids sociala svar i idle, högst sex sekunder tal](SOCIAL-CHAT.md).
Video-intake: [lägg in standardtagningar och alternativ, välj användning och se täckning](VIDEO-LIBRARY.md).
Buggar, förbättringar och öppna kontroller för labbet och övriga repot finns i
[findings](../docs/CLOUD-MIGRATION.md); implementation och QA följs i Jira CAC.

## Starta

Astrids fokuserade studio finns på `/` lokalt och `/studio` i molnet.
`/lissabon` inne i Lab är en omdirigering till samma startsida.
Startkod, standardprojekt och lokala profilval finns nu här i Lab.

```powershell
# Reproducerbart prov: tom temporär databas, befintliga filmer, inga externa tjänster.
node lab/start.mjs --offline --no-open
# Befintlig privat OpenClaw-anslutning (endast när externa anrop är godkända).
node lab/start.mjs --no-open
```

Offlineparet finns på `http://localhost:4194` (spel) och
`http://127.0.0.1:4192` (Lab). Bygger Next före start; `--skip-build` får endast
användas med ett aktuellt bygge. Ctrl+C stoppar paret och tar bort dess testdata.
Ett koordinerat sessionslås hindrar ett andra produkt/labbpar.
Det är en lokal utvecklingsförhandsvisning av ett produktionsbyggt Lab.

[Start-Lab.cmd](../Start-Lab.cmd) startar den befintliga anslutna profilen på
4200/4201. [Start-Lissabon.cmd](../Start-Lissabon.cmd) fungerar som alias.
Om `lissabon/data/project.json` redan finns används dess datakatalog; annars
används `lab/data`. En ensam gammal sessionslåsfil påverkar inte valet.
Inga privata filer kopieras eller flyttas. Standardprojektet skapas från
`policies/project.seed.json` och profilens få idleval. En separat projektsnapshot
behövs inte. Exakt oförändrade gamla demoexempel tas bort vid uppgradering;
egna ändringar/bindningar bevaras och hela föregående revision sparas i historik.

Det äldre `Start-Labb.ps1` finns kvar för den generella fristående editorn;
öppna `/tree` där. Kör den inte samtidigt med det anslutna paret.
Node 22.16+ och installerade beroenden krävs för lokal start. För molndrift
används den befintliga [koordinerade molnstartaren](../ops/cloud/README.md).

### Ett register per ansvar

| Ansvar | Källa | Kontroll |
| --- | --- | --- |
| Event-ID, källtyper och begrepp | `policies/studio-contract.json` | `test/studio-contract.test.mjs` |
| Filmfamiljer, standardfiler, variantmappar | `../presentation-runtime/media-families.mjs` | Byggare och validator importerar samma register |
| Faktiska filer, storlek och SHA-256 | `../emil/dealklipp-v1/lab-video-manifest.json` | `node pipeline/build-lab-video-manifest.mjs --check` från reporoten |
| Format/validering | `schemas/`, `lib/lab-video-manifest.mjs` | Manifest- och kontraktstester |
| Sparade operatörsval | vald datakatalogs `project.json` | Revisionslås + historik |
| Uppmätta kortspår och filhashar | `../web/public/kevin-cards/` | `test/local-card-overlay.mjs` + faktisk browsergranskning |

Efter nya mediefiler: kör `node pipeline/build-lab-video-manifest.mjs`,
granska diffen och kör `--check`. Lab:s **Läs in nya filer** använder samma byggare.
En ny hash är inte ett visuellt godkännande.

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
  triggers. **Övrig spelreplik → Tal-klipp att prova** väljer en exakt lokal
  replik för exemplet (14 Astrid-klipp, utöver de tre egna talnoderna).
  Tur/resultat visar speldata; resultattalet har ett separat speak-event.
  Testa ett publicerat exempel med simulerad chatt, historik och
  framtoning. Den animerade scenen och beslutsspåret visar vad som händer.
  **Spela vald variant** spelar ditt markerade klipp direkt: kopplad video,
  annars exakt registrerat original för standard, därefter variantens 2D-reserv. Välj fil direkt under **Standardvariantens
  video** i varianteditorn och spara med **Spara projekt**. Alternativ får egna
  kopplingar; de lånar aldrig standardens film. **Bara 2D** är ett manuellt
  förhandsvisningsval. **Testa event** startar med OpenClaw som urvalsläge; modellen anropas först
  när du trycker. **Avancerade jämförelsetester** innehåller standard, regler,
  slump och skuggläge. Testsituationen påverkar variantvalet, inte en extra
  animation ovanpå den kopplade videon. I Astrids vänteläge finns separat
  riktig OpenClaw-spelarchatt med fritt svar och ElevenLabs-ljud förvalt.
  En enda Inställningar-länk samlar social policy och valfria standardfraser.
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
  läsande observation av Partner-strömmen. Visa originalspelets flik lokalt eller
  spela samma instruktioner i labbet genom ett uttryckligt val. Sekvenslistan
  öppnar riktiga eventdata i editorn. På samma yta kan du verifiera åtkomst,
  öppna originalspelet via Partner-launch och importera/exportera observationer.
- **Chatt & OpenClaw:** två tydliga chattvägar, anslutningsstatus och operatörschatt om det senast
  sparade projektet. Länk till den befintliga, separata native-dashboarden.
  Chatt kräver en konfigurerad anslutning; inga modellsvar fejkas.
  Här finns också **Prova rösten**: tre standardfraser, egen text eller en
  kopia av det senaste operatörssvaret. Explicit knapptryck genererar Sarah-röst
  via ElevenLabs (kan kosta krediter); återanvändning av samma prov kostar inget
  nytt modellanrop. Detta är separat ljud, inte spelarchatt eller videosynk.

## Var finns chatten och vad täcker 2D?

**Spelarchatt med Astrid** finns som genväg ovanför arbetsytan, även från
Videobanken. Den öppnar Astrids vänteläge och rullar till chattpanelen direkt under bordet.
Panelen sitter ihop med förhandsvisningen, före eventtestets inställningar,
och syns även för andra noder med en tydlig knapp till Astrids vänteläge.
**Fråga OpenClaw om labbet** öppnar operatörschatten för det sparade projektet.
Båda finns samlade under **Chatt & OpenClaw**; ingen fråga skickas av navigationen.

2D-biblioteket innehåller 64 unika rörelsefiler, fyra per eventgrupp, plus
en separat social rörelse. Seedens 256 variantkopplingar delar dessa filer
över fyra dealers. De är schematiska rörelseprov, inte fullständig spelkoreografi:
alla kortsekvenser, sju exakta platser, split, övergångar och läppsynk täcks inte.

API:er, nyckelroller och miljöfiler finns i
[Jakobs miljöförklaring](../docs/ENVIRONMENT-VARIABLES.md).

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
eller lipsync ersätts. [Status och urvalsmodell](../docs/LOCAL-PRESENTATION-RUNTIME.md).

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
  backoffices rad-UUID. Strömmen behöver `events` eller `play`.
- `BETTALOTTO_PARTNER_SECRET`: nyckelns hemliga signeringsdel, aldrig i webbläsaren.
- `BETTALOTTO_PARTNER_PLAYER_ID`: partnerns spelar-ID för den kanal som ska läsas.
- `BETTALOTTO_PARTNER_BASE_URL`: valfritt; standard är `https://bettalotto.se`.
  En uttryckligen konfigurerad loopback-adress stöds för isolerade tester.

Detta är en ny, valfri anslutning. Den använder Next-serverns miljö, som läser
`lab/.env.local`; observatören läser inte automatiskt reporotens `.env`.
Befintlig läsning av Director-/OpenClaw-inställningar från rotens `.env` är
oförändrad. Flytta eller döp inte om de befintliga tjänsternas uppgifter för
att aktivera Partner-loggen.

`events` är en separat läsbehörighet i Kevins uppdaterade API. `play` ger även
behörighet till bordskommandon. Live-ping den 21 september 2026 bekräftade
`launch` och `events` för labbets nyckel; den har inte `play` eller `wallet`.

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
**Hämta videokarta** använder `/api/v1/generations/mapping`, verifierat live
den 21 september. Endast `BETTALOTTO_API` läses från rotens `.env`, sedan
`lab/.env.local`; processmiljön vinner. Detta ändrar inte Partner-observerns
inläsning. Inga miljöfiler skrivs eller videobinära filer hämtas av knappen.

Nycklar skapas i backoffice under API Keys. **Anslut** verifierar åtkomsten,
öppnar rätt originalsession och samordnar observation och labbföljning.
”Konfigurerad” bevisar inte behörighet eller trafik. Saknade
uppgifter visas som saknade. Loggen fylls aldrig med låtsad live-trafik.
Ofullständiga nycklar och secrets stoppas av en lokal formatkontroll innan
anslutning. Godkänt format bevisar inte att paret är giltigt, har rätt scope
eller använder rätt playerId; det kan bara verifieras mot Bettalotto.

Strömmen avser samma API-nyckel och partner-playerId som den nya launch-knappen.
Kevin anger att launch-spelet ska kunna observeras i SSE. Den hämtade
serverkoden publicerade tidigare endast från Partner-table. Den lokala
`web/native-table.mjs` publicerar nu native-kommandon efter commit, till den
verifierade launch-sessionens nyckel/spelare och endast vid versionsökning.
Bryggan måste driftsättas på spelservern innan detta gäller live. **Launch → rund-event är ännu oprövat live.**
En accepterad anslutning bevisar inte denna koppling. BO-inloggning ansluter inte labbet.
Observern läser publicerade rundor och presentationsinstruktioner, gör inga
spelhandlingar. Automatisk följning efter **Anslut**, eller explicit återspelning,
driver labbscenen från dessa fakta. Mottagen instruktion, lokalt variantval
och uppspelningskvitto är tre skilda saker.

SSE-källan saknar replay. Avbrott loggas som möjliga luckor och kräver ny
uttrycklig anslutning; loggen är ingen fullständig spelhistorik. Lokala API:n
är `/api/inputs` för status och `/api/inputs/events` för observation.

### Original och labb sida vid sida

1. Öppna `/activity` och välj **Anslut**. Labbservern verifierar scopes och
   signerar launch för samma konfigurerade spelar-ID. SSE startas före
   spelöppningen; en unik kanal binder observationen till just den nya fliken.
2. Spela i originalfliken. **Transport ansluten · väntar på speldata** är
   korrekt tills verkliga rundposter kommer. Den nya native-observern kräver
   denna spelarkod på vald server och ett uttryckligt loopback-labb som opener.
3. Välj originalfliken i bilddelningen för lokal bildvisning bredvid labbet.
   Webbläsartillståndet kan inte automatiseras bort. Ingen bild spelas in eller
   laddas upp och inget ljud fångas. Data kan fungera även utan delad bild.
4. Labbet följer automatiskt med **Bara standard** utan modellkostnad.
   **Variantval** byter urvalsläge; OpenClaw/Skuggläge kan göra modellanrop.
   **Pausa labbet** stoppar lokal uppspelning. Videokarta, scopes, särskilda
   filmlägen, konfigurationsomläsning och import/export finns i **Diagnostik**.
5. Använd en avsedd demospelare med verifierad intern demoplånbok för rundprov.
   Liveöppningen den 21 september visade Astrid och 0,00 €; inga insatser,
   saldoändringar eller rundor gjordes. Nyckeln ger inte wallet-åtkomst.
6. Kontrollera faktisk rundtrafik, koppla från och **Exportera observationsprotokoll**.
   JSON-underlaget visas även för kopiering när webbläsaren inte hämtar filen.

Protokollet håller hela mottagna rundmeddelanden före loggvisningens kortning.
Det stoppar uttryckligen vid 300 meddelanden eller 4 MiB, utan att kasta bort
äldre rundor. Det bevaras mellan labbvyernas navigation men försvinner vid omladdning. Töm visningen
tömmer bara de 150 loggraderna. Nycklar maskeras och URL-frågesträngar utelämnas.
Videokartan, verifierade scopes och avbrott följer med exporten.

Vid fullständigt protokoll: exportera och välj **Ny observation** under
Diagnostik. Det ersätter minnesprotokollet och stoppar den gamla labbkön;
spelet, anslutningen och bilddelningen behålls. Bara kommande instruktioner
följs. Gränsen höjs inte och gamla poster kastas aldrig tyst bort.

Mapping beskriver registrerade klipp och BO-val; den är inget kvitto på klipp
som faktiskt spelats. Native-observern tillför publika kommandosvar/bordsvy samt
instrumenterade playback- och chattsignaler, separat från SSE och labbkvitton.
Källfönster, origin, kanal och sekvens kontrolleras; credentials och dolda kort
filtreras bort. Labbet gör inga extra spelkommandon för att få signalerna.
Senaste publika bordsvy visas med native-data; en enbart SSE-härledd vy är
märkt partiell. Det är inte en garanti för identiska bild-/ljudframes.

Variantbeslutets kontext bygger på mottagna avgjorda händer sedan senaste
luckan. `context.observedChat` kan dessutom innehålla högst åtta observerade
user/assistant-meddelanden, högst 600 tecken per meddelande och 3 200 totalt.
Endast chatt mottagen före den aktuella instruktionen och efter senaste luckan
följer med, med tidsstämplar och källan `native-observation`. Projektionen tar
bara de tillåtna fälten; separata saldo-, spelar-ID- och authfält följer inte
med. Kända credential-mönster och URL-parametrar filtreras. Chatttexten är
underlag för val bland redan tillåtna varianter, aldrig instruktioner som kan
ändra spelet, utöka kandidaterna eller beställa nytt tal.
Saknat språk, återbesök och chattklassificering anges som otillgängliga;
kontraktets neutrala reservvärden är inte bevis om spelaren. Manuella eventprov
har fortsatt uttrycklig testkontext. Native-/SSE-dubbletter ska ge ett steg;
konflikt eller lucka stoppar följningen.

Director behöver kontextkontrakt version 2 och måste kvittera
`contextContractVersion: 2` samt rätt `observedChatMessages`. Om den driftsatta
tjänsten saknar kvittot spelar labbet standard med den synliga orsaken
`remote_context_not_supported_baseline`. Den befintliga fjärrtjänstens prov
gav denna reserv; den nya chattkontexten kräver därför Director-redeploy och
nytt kompatibilitetsprov. Ingen sådan deploy påstås här. Schemat finns i
`open-claw/lab/schemas/observed-chat.schema.json`; detta aktiverar inte
produktens ännu återstående gemensamma OpenClaw-talägarskap.
`/api/inputs/reference` är lokal status (GET) och explicit verify/launch/mapping
(POST); alla destinationer och credentials bestäms på servern.

## Isolerad lokal jämförelse

Kör från repots rot, med labbets beroenden installerade:

```powershell
npm --prefix lab run build
node tools/start-local-comparison.mjs
```

Öppna `http://127.0.0.1:4192/activity` och tryck **Anslut**. Spelet körs på
`http://localhost:4194`, originalet på `/` och Kevins alternativ på `/v2/`.
BO ligger på samma game-host under `/bo/`. Olika hostnamn håller testets
spelcookies skilda från labbet. Tillfälliga databaser och en
syntetisk demospelare skapas; `.env`-filer och riktiga konton/saldon används
inte. Modell-, mail- och andra externa nätanrop är avstängda. Detta prov
visar den lokala kedjan, inte en riktig OpenClaw-dialog eller Bettalotto-deploy.

Stäng med Ctrl+C: testprocesserna stoppas och deras egna temporära data tas
bort. Bygg om efter kodändringar; verktyget använder labbets byggda version.
Automatiserad acceptans körs med `node test/local-comparison-browser.mjs`.
Den kräver Playwright och Edge; ange `CROUPIER_PLAYWRIGHT_MODULE` till
värdmiljöns `index.mjs` om paketet inte finns i repot. BO-inloggningen för QA
finns endast i fixture-objektets minne och skrivs inte ut av CLI:t.
Browserprovet använder verkliga lokala spelkommandon/SSE men ett uttryckligen
syntetiskt chattsvar. Flikdelningens manuella tillstånd och läppsynk bedöms
separat; testresultat dokumenteras i `docs/JOHN-HANDOFF.md`.

## Video och kvarvarande integration

De 224 snapshot-generationerna finns redan i
`C:/Users/jakem/CroupierAssets/bettalotto-generations`, labbets befintliga
Windows-förval. Inventeringen 22 september kontrollerade ID och filstorlek
224/224; den läste inte filmbytes och är inte visuell eller hashbunden acceptans.
BO:s vanliga `web/public/bo/gen` saknades lokalt. För att prova samma befintliga
arkiv i både labb och BO startas den isolerade jämförelsen uttryckligen så här:

```powershell
node tools/start-local-comparison.mjs --media-directory "C:/Users/jakem/CroupierAssets/bettalotto-generations"
```

Flaggan motsvarar `startLocalComparison({ generationDirectory })` och sätter
`LAB_VIDEO_ARCHIVE` och `CROUPIER_GENERATIONS_DIR` bara i testprocesserna.
Utan flaggan använder fixture:n en egen tom temporär generationsmapp.
Det delade arkivet läses enbart och lämnas kvar när testet stängs. Inga kopior,
nedladdningar eller env-filändringar görs. Detta mediearkiv är inte det
pensionerade personarkivet och behöver inte Git-/AI-indexeras; det är inte
belagt att det är samma tidigare nämnda slaskmapp.

För vanlig produkt-/BO-start är `CROUPIER_GENERATIONS_DIR` en **valfri
processinställning**; utan den gäller `web/public/bo/gen`. Den är inte
ett namn som påträffats i inventeringen av Jakobs privata `.env`. Både BO-media och
Generations-API använder katalogen med sina egna authkrav. Endast kända
katalog-UUID:er och tillåtna filnamn kan öppnas; symlänkar och vägar utanför
den verkliga katalogen avvisas. Byte-range och HEAD stöds för videopreview.

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

Bestående spelarminne, produktens spelarchatt/moderering och en gemensam talägare
återstår. Labbets originalförval återanvänder nu produktens mediespelarmoduler. Astrids separata idle-chattprov
använder verkliga modellsvar; det manuella eventtestets kontext är fortfarande
simulerad medan livejämförelsen använder begränsade observerade fakta.
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
