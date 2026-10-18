# Studio-tjänsten (`apps/studio/`) — utvecklarreferens

**Användarguide: [Guide & hjälp](https://www.scoutgaming.tech/admin/guide).**
Äldre `/control/guide` och `/studio/guide` leder vidare dit. Denna README är utvecklarreferens.
Källa och begreppsägarskap: [apps/studio/docs](docs/README.md).

**Produktens riktning:** [/admin](https://www.scoutgaming.tech/admin) är den nya
personalytan och [/lobby](https://www.scoutgaming.tech/lobby) den nya
spelarlobbyn. Övergången pågår: `/control`, `/partner` och `/play` behövs
fortfarande för befintliga verktyg, inloggning och spelstarter. De detaljerade
`/control`-adresserna längre ned är bevarade länkar; många omdirigeras nu till
motsvarande `/admin`-verktyg. Aktiva ingångar, bolagsåtkomst och mål finns i
den kanoniska [användarguiden](docs/README.md).

Rena dokumentadresser och bolagssluggar ägs av `packages/navigation` i
reporoten, som delas med frontend och spelet utan appimporter. Äldre
dokumentalias hanteras av `middleware.ts` och den appägda HTTP-adaptern
`lib/legacy-studio-document.mjs`. Deras tidigare queryregler och publika
måladresser bevaras. Sidor som laddar data eller först kontrollerar
behörighet ligger kvar; Admin återanvänder fortfarande flera av deras
komponenter. Manuella medieverktyg finns i [tools/media](../../tools/media/README.md).

**Teknisk roll:** `apps/studio/` är den aktiva Next.js-tjänsten `studio` i
Vercel-projektet `scoutgaming`. Den serverar `/admin`, `/lobby`, `/control`,
`/partner` och deras Studio-API:er. `/studio` är tjänstens basePath i molnet.
`apps/studio/client` innehåller Admin/Lobby-klienten med eget React-/TypeScript-bygge.
Labbets bygge förbereder och serverar den från `design-preview-build/`. Behörighet, scoped
data, mediaregister och anslutningar finns kvar i denna tjänst.
Lobbykatalogens rena laddare finns i `packages/player-catalog`; appen äger
fortfarande inloggning, rumsväljning och spelstarter.
Render-tjänsten `croupier-v2` äger spelmotorn och live-transporten.
Neon är produktens register och privat Blob innehåller mediebyte.
`node apps/studio/start.mjs --no-open` skriver den publicerade produktens adress;
endast `--offline` startar ett isolerat, tillfälligt serverpar.
Äldre `lab/data` bevaras som authoring-/återställningsunderlag.
[Väg- och strömkartan](../../docs/LOCAL-PRESENTATION-RUNTIME.md)
skiljer adresser, spelobservation, Partner-SSE, talvideo och BO-administration.

Gemensam Director-, tal-, social- och Companion-logik finns i
`packages/director/`. `lib/director-settings.mjs` äger Studios miljöfilläsning
och återanvänder paketets rena projektion. Samma filer, prioritet, alias och
Director-datarot gäller; Studio väljer fortfarande sin Companion-underkatalog.
Director-tjänstens HTTP, Gateway och signering ligger kvar i `services/openclaw/lab/`.

Eventeditor och sekvensspelare går genom `POST /api/presentation/decision`.
Den gamla `/api/simulate` är ett alias. Servern delar samma pågående/sparade
beslut för ett oförändrat `requestId`; förändrat innehåll ger 409. Cache och
samtidighetsgräns gäller en Node-process: 128 jobb, fem minuter efter svar,
högst fyra pågående beslut. Nytt manuellt prov får nytt ID. Källans ID ligger
separat i `sourceRef`. Detta deduplicerar modellbeslut, inte uppspelning i olika
flikar. Källreferenser skickas inte till modellen. `decision.director` visar
ägare, cacheåterbruk och att uppspelning ännu inte är bekräftad. Explicit bundna
alternativ med otillgänglig eller felmatchad video utesluts före modellval.

Den riktiga spelklienten och OpenClaws egen dashboard är separata.
Sparade klippval påverkar den angivna spelvägen; osparade utkast och manuella
förhandsvisningar påverkar endast Studio-provet. Katalognamnet `lab` är inte
skäl att radera tjänsten: nya `/admin` och `/lobby` använder också den.

[Runtime, lagring och format](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
Praktiskt prov: [Astrids sociala svar i idle, högst sex sekunder tal](SOCIAL-CHAT.md).
Video-intake: [lägg in standardtagningar och alternativ, välj användning och se täckning](VIDEO-LIBRARY.md).
Öppen status finns i [docs/CLOUD-MIGRATION.md](../../docs/CLOUD-MIGRATION.md).

## Starta

I en offline-fixtur öppnas tjänsten på `/`. Äldre verktygslänkar ligger på `/control`;
`/studio` är tjänstens basePath i molnet.
Lab-roten `/` (publikt `/studio`) omdirigerar permanent till `/admin`.
Äldre bokmärken med querykontext går via `/control/clips` till
`/admin/dealer-studio` och behåller den kontexten.
Publika `/lab` och `/labb` går till `/admin` via `/control`; `/bo` går till
`/admin/drift` via `/control/administration`. Publika `/lissabon` svarade 404
vid kontrollen 14 oktober 2026 och ska inte användas som ny ingång.
`lissabon-stream-lane` är ett kvarvarande internt anslutnings-ID i fixturen
och spelservern, inte ett eget spelrum eller en produktadress. Kontrollera
aktiva konsumenter före ändringar; bevarade ID:n och Astrids tal-/videoreferens
kräver ingen ansluten lokal produktstart.

```powershell
# Reproducerbart prov: tom temporär databas, befintliga filmer, inga externa tjänster.
node apps/studio/start.mjs --offline --no-open
# Skriv den publicerade produktens adress; startar inga lokala servrar.
node apps/studio/start.mjs --no-open
```

Offlineparet finns på `http://localhost:4194` (spel) och
`http://127.0.0.1:4192` (Lab). Bygger Next före start; `--skip-build` får endast
användas tillsammans med `--offline`. Det kontrollerar byggfilernas närvaro,
inte att de motsvarar aktuell källversion. Ctrl+C stoppar paret och tar bort dess testdata.
Sessionslåset `acquireLocalSession` i `services/openclaw/lab/deploy/local-session.mjs` hindrar ett andra produkt/labbpar.
Det är en lokal utvecklingsförhandsvisning av ett produktionsbyggt Lab.

Ordinarie lokal produktstart och lägena `--check`, `--cloud-storage` samt
`--astrid-camera` är avvecklade. Lokala arbetsfiler används inte som
produktens reservregister. Följ [användarguiden](docs/README.md) för
startalternativ och [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md)
för bevarade data; migrera inte äldre lokala profiler för vanlig produktstart.
En ny arbetsyta skapas av `createEmptyProject()` utan förregistrerade dealers,
linjer eller sammansättningar. `policies/project.seed.json` innehåller även
historiska demo-/fixturdata; de är inte produktionens startinnehåll.
En separat projektsnapshot behövs inte för den isolerade fixturen.

Node 24.x enligt `package.json` och installerade beroenden krävs för lokal
start. Molndrift är
Vercel-projektet `scoutgaming` och Render `croupier-v2`, se
[docs/CLOUD-MIGRATION.md](../../docs/CLOUD-MIGRATION.md).
[ops/cloud/README.md](../../ops/cloud/README.md) är en äldre Docker-pilot, inte startkommandot.

### Ett register per ansvar

| Ansvar | Källa | Kontroll |
| --- | --- | --- |
| Event-ID, källtyper och begrepp | `policies/studio-contract.json` | `test/studio-contract.test.mjs` |
| Filmfamiljer, standardfiler, variantmappar | `../packages/presentation/runtime/media-families.mjs` | Byggare och validator importerar samma register |
| Faktiska filer, storlek och SHA-256 | `../media/dealers/astrid/runtime/presentation/lab-video-manifest.json` | `node tools/media/build-lab-video-manifest.mjs --check` från reporoten |
| Format/validering | `schemas/`, `lib/lab-video-manifest.mjs` | Manifest- och kontraktstester |
| Sparade operatörsval | vald datakatalogs `project.json` | Revisionslås + historik |
| Uppmätta kortspår och filhashar | `../../services/game/public/card-presentation/` | `test/local-card-overlay.mjs` + faktisk browsergranskning |

Efter nya mediefiler: kör `node tools/media/build-lab-video-manifest.mjs`,
granska diffen och kör `--check`. Lab:s **Läs in nya filer** använder samma byggare.
En ny hash är inte ett visuellt godkännande.

## Befintliga editorer och gemensam Guide

Adresserna nedan beskriver de fungerande `/control`-verktygen. Nya `/admin`
återanvänder deras komponenter och native-API; skapa inget parallellt
projektregister för den nya menyn. Se [guiden](docs/README.md) för ingångarna.

- **Guide & hjälp (`/control/guide`; `/guide` omdirigerar dit):** den avskalade arbetsgången, gemensamma begrepp och tydliga gränser för vad som gäller nu respektive är förslag.

- **Spelhändelser & villkor, översikten (`/control/events` utan `?event=`; `/control/tree` omdirigerar dit):** välj dealer och presentationssätt: idle/bakgrund,
  engångshandling, exakt tal eller tur/resultat. De fyra grupperna är en vy
  över befintliga sex källtyper och 16 eventgrupper. Vald nod visar exempeldata,
  förväntade källfält och saknade uppgifter, separat från testkontext och
  urvalets variant-ID. Standard är också en variant; linje är behållaren för
  en dealers standard och alternativ. Klicka vidare till editorn utan att
  tappa osparat arbete. Ingen seed eller något tekniskt ID migreras.

- **Spelhändelser & villkor (`/control/events`):** välj croupier/event, redigera namn, linje, varianter och
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
  riktig OpenClaw-spelarchatt med fritt svar. Ljudet kommer från Cartesia (Victoria), inte ElevenLabs.
  En enda Inställningar-länk samlar social policy och valfria standardfraser.
  Socialt svar och handlingspreview har en gemensam spärr: ett textsvar och
  högst sex sekunder tal i neutralt idle. Modellens uttrycksförslag loggas
  separat; ingen hand- eller kroppsrörelse läggs ovanpå talet. Riktig läppsynk
  återstår.
- **Klippbibliotek (`/control/videos`; menyraden är Dealers & klipp på `/control/clips`):** lägg in egna MP4/WebM-filer med dealer, event, typ,
  standard/alternativ och konkret situation. Filtrera banken och kontrollera
  vilka standardlinjer som har video. Inspektera original och bind vald variant till ett exakt
  `videoGenerationId`. Samma koppling kan redigeras direkt i Händelser.
  Detta är en labbkoppling, inte ett runtime-godkännande.
- **Provspelning & logg (`/control/rehearsal`; `/control/activity` omdirigerar dit):** flikens indata, beslut och uppspelarens
  start/slut/fel med tid, källa, beslutsfattare och orsak. Fäll ut faktisk JSON
  och filtrera stegen. Loggen håller högst 150 poster i `sessionStorage`, följer
  med vid sidbyte och töms när fliken stängs. Den korta loggen på andra sidor är
  borta. Här finns även valfri,
  läsande observation av Partner-strömmen. Visa originalspelets flik lokalt eller
  spela samma instruktioner i labbet genom ett uttryckligt val. Sekvenslistan
  öppnar riktiga eventdata i editorn. På samma yta kan du verifiera åtkomst,
  öppna originalspelet via Partner-launch och importera/exportera observationer.
- **OpenClaw (`/control/openclaw`):** flikarna Agentmodeller och Chatt
  (`?tab=chat`). `/control/operator-chat` omdirigerar till chattfliken.
  Chatten läser det senast sparade projektet. Länk till den befintliga, separata
  native-dashboarden. Chatt kräver en konfigurerad anslutning; inga modellsvar fejkas.
  På chattfliken finns också **Prova rösten**: tre standardfraser, egen text eller en
  kopia av det senaste operatörssvaret. Explicit knapptryck genererar Victoria-röst
  via Cartesia (kan kosta krediter); återanvändning av samma prov kostar inget
  nytt modellanrop. `node tools/elevenlabs-lab-preview.mjs` är ett separat prov,
  inte panelen. Detta är separat ljud, inte spelarchatt eller videosynk.

## Var finns chatten och vad täcker 2D?

**Spelarchatt med Astrid** sitter i Spelhändelser & villkor (`/control/events`), i förhandsvisningen.
Chattgenvägarna ovanför de andra sidorna är borta.
**Fråga OpenClaw om labbet** ligger på fliken Chatt (`/control/openclaw?tab=chat`).
Ingen fråga skickas av navigationen.

2D-biblioteket innehåller 64 unika rörelsefiler, fyra per eventgrupp, plus
en separat social rörelse. Demo-/fixturprojektet har 64 linjer och en variant
per linje; en ny arbetsyta börjar tom. Tre alternativ per linje och
256 variantposter finns inte i demo-/fixturseedet.
De är schematiska rörelseprov, inte fullständig spelkoreografi:
alla kortsekvenser, sju exakta platser, split, övergångar och läppsynk täcks inte.

API:er, nyckelroller och miljöfiler finns i
[Jakobs miljöförklaring](../../docs/ENVIRONMENT-VARIABLES.md).

## Filer och begrepp

```text
packages/presentation/contracts/
  policies/project.seed.json   eventkontrakt och historiska demo-/fixturdata
  schemas/studio.schema.json   struktur och tillåtna värden
  studio-model.mjs             kontrakt, referenser, validering och konvertering
apps/studio/
  policies/social.seed.json    startpolicy för Astrids sociala chattprov
  schemas/social.schema.json   format för den separata sociala policyn
  animations/                 64 eventrörelser + separat social.ledsen i JSON
  lib/presentation-profile.mjs visningsgrupper och källfält för Händelser → klipp
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

`policies` betyder här regler och kontrakt; `schemas` beskriver strukturkraven.
`data/` skapas vid lokal sparning och ersätter inte reglerna i Git. Ingen separat
projektmanifest behövs. Rörelsebibliotekets lilla `animations/index.json`
listar däremot vilka rörelsefiler som ingår. `.next/` och `node_modules/` är
genererade verktygsmappar. `preview-build/` och `design-preview-build/` skapas
också av byggverktygen. Alla är Git-ignorerade; de ersätter inte källan i
`app/`, `lib/`, `components/` eller `packages/`. [Rörelsernas format](animations/README.md).

Fristående ElevenLabs-prov (inte scen-/chattintegration):
`node tools/elevenlabs-lab-preview.mjs --check` från repots rot, eller
`--generate` för ett kort debiterbart röstprov. MP3 + text/röst/hash-metadata
sparas lokalt i `lab/data/voice-previews/`, utanför Git. Ingen produktmedia
eller lipsync ersätts. [Status och urvalsmodell](../../docs/LOCAL-PRESENTATION-RUNTIME.md).

Signal → event + relevant kontext → urval → material → uppspelningskvitto.
Signal är samlingsordet för indata, till exempel spelfakta, ett chattmeddelande
eller ljudets slut. Ett event är en namngiven händelse med data. De sex
Partner-presentationstyperna beskriver bara en del av systemets händelser.
`box` är plats 0–6, inte en identifierad spelare. Variant-ID är ett beslut
efter indata; längd och landningstid kommer från materialets metadata.

En linje hör till en croupier och ett event. Det historiska demo-/fixturprojektet
har 64 linjer och en variant per linje (64 poster, fyra dealers); en ny arbetsyta
börjar utan dealers och linjer. Rörelseindexet har 64 klipp.
Tre alternativ per linje och 256 variantposter finns inte i demo-/fixturseedet.
Högst fyra alternativ plus standard kan redigeras.
Sparade äldre projekt fylls inte på automatiskt eller skrivs över.
Den äldre händelseeditorns seed beskriver blackjack. Publicerade spelrum kan
däremot vara blackjack eller roulette, enligt `packages/presentation/server/package-rooms.mjs`.
Ett rum har ett spel; spelet kan erbjuda flera rum/bakgrunder med tillåtna
dealers och bord. Produktmodellens källa är [TERMINOLOGI.md](docs/TERMINOLOGI.md).

Partner-API:ts **sex presentationstyper** är `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
De **16 noderna** är labbets begripliga mappningar, inte 16 nya motor-events.
Visningsnamn kan ändras; tekniska event-ID:n, matchning och exempel är låsta.
Standardvarianten kan inte raderas eller villkoras. Alternativ och triggers
kan läggas till och tas bort; använda triggers måste först kopplas loss.

Triggerkategorier: `deterministic` (publicerat spel/avgjord historik), `social`
(simulerad chatt/preferens), `temperament` (croupierns framtoning, inte en
diagnos av spelaren). I Händelser → klipp visas två huvudgrupper: **spelstyrda** och
**sociala/uttryck** (social + temperament). Alla valda villkor måste stämma. Inga villkor betyder
inga extra villkor; variantens separata val för regler, modell och slump avgör
vilka urvalslägen den får delta i. Nya alternativ börjar manuellt.
[Detaljer om policyerna](policies/README.md) och [videointake](VIDEO-LIBRARY.md).

**Spara projekt** validerar, kontrollerar revision och skriver atomiskt med
historik. Ett annat fönsters nyare ändringar skrivs inte över. I den lokala
diskadaptern ger saknad `data/project.json` ett tomt projekt. Export-knappen ger JSON för
granskning/versionering; ingen import- eller publiceringsknapp finns ännu.
`LAB_STUDIO_DATA_DIR` kan välja en separat datamapp för QA.

## OpenClaw och Render

**Nuvarande blueprint:** [services/openclaw/lab/render.yaml](../../services/openclaw/lab/render.yaml).
Den ligger kvar på den driftsatta sökvägen; den nya Next.js-sajten ingår inte
i blueprinten. `services/openclaw/` äger Gateway, adapter och Docker/Render-drift;
den äldre mappen `services/openclaw/lab/` behålls tills vidare för dessa beroenden.
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
`OPENCLAW_MODEL_API_KEY` stannar på Gatewayen; `OPENCLAW_API_KEY` är Gatewayens
inloggning och är inte samma sak som Directors API-token.

Den här ändringen tillför `/api/studio/advice` och `/api/studio/chat` i
Director. De behöver driftsättas innan nya studion kan använda Render med
sin tillfälliga katalog. Anropen sparar **inte** utkastet i Render. Direkt
lokal Gateway stöds också via `OPENCLAW_BASE_URL` och `OPENCLAW_API_KEY`.
Konfigurerad betyder inte automatiskt hälsotestad. Den 20 september 2026
driftsattes Director `7f056f7`: aktivt val, shadow och operatörschatt gav
riktiga modellsvar via lokal Next-server. Första rådanropet fick timeout;
fallback fungerade och omprovet gav giltigt råd. Detta är ett daterat
anslutningsprov, inte en garanti för svarstiden i spelet.
[Officiellt OpenClaw-index](../../docs/AI/openclaw/README.md).

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
`OPENCLAW_API_KEY` hör till Gatewayen. Ingen av dem ersätter Bettalottos
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
öppnar rätt originalsession och samordnar native-observation. Separat preview
kräver ett uttryckligt val.
”Konfigurerad” bevisar inte behörighet eller trafik. Saknade
uppgifter visas som saknade. Loggen fylls aldrig med låtsad live-trafik.
Ofullständiga nycklar och secrets stoppas av en lokal formatkontroll innan
anslutning. Godkänt format bevisar inte att paret är giltigt, har rätt scope
eller använder rätt playerId; det kan bara verifieras mot Bettalotto.

Strömmen avser samma API-nyckel och partner-playerId som den nya launch-knappen.
Kevin anger att launch-spelet ska kunna observeras i SSE. Den hämtade
serverkoden publicerade tidigare endast från Partner-table. Den lokala
`services/game/native-table.mjs` publicerar nu native-kommandon efter commit, till den
verifierade launch-sessionens nyckel/spelare och endast vid versionsökning.
Bryggan måste driftsättas på spelservern innan detta gäller live. **Launch → rund-event är ännu oprövat live.**
En accepterad anslutning bevisar inte denna koppling. BO-inloggning ansluter inte labbet.
Observern läser publicerade rundor och presentationsinstruktioner, gör inga
spelhandlingar. **Anslut** startar endast observation. Separat Lab-preview
kräver uttryckligt val och återspelar inte gammal observationskö. Mottagen instruktion, lokalt variantval
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
4. Labbet följer spelflikens native-kvitton utan att starta en andra spelare.
   Separat Lab-preview är ett uttryckligt manuellt prov. Klippväljaren i
   spelet styr dess Standard/Regler/Slump/OpenClaw-läge. Videokarta, scopes, särskilda
   filmlägen, konfigurationsomläsning och import/export finns i **Diagnostik**.
5. Använd en avsedd demospelare med verifierad intern demoplånbok för rundprov.
   Liveöppningen den 21 september visade Astrid och 0,00 €; inga insatser,
   saldoändringar eller rundor gjordes. Nyckeln ger inte wallet-åtkomst.
6. Kontrollera faktisk rundtrafik, koppla från och **Exportera observationsprotokoll**.
   JSON-underlaget visas även för kopiering när webbläsaren inte hämtar filen.

Protokollet håller hela mottagna rundmeddelanden före loggvisningens kortning.
Gränsen är 300 meddelanden eller 4 MiB, och Provspelning & logg stannar där.
Protokollet ligger i sidans minne och försvinner vid sidbyte eller omladdning.
De högst 150 loggraderna ligger i `sessionStorage` och följer med vid sidbyte
tills fliken stängs. Töm visningen tömmer loggraderna. Nycklar maskeras och URL-frågesträngar utelämnas.
Videokartan, verifierade scopes och avbrott följer med exporten.

Vid fullständigt protokoll: exportera och välj **Ny observation** under
Diagnostik. Det ersätter minnesprotokollet och stoppar den gamla labbkön;
spelet, anslutningen och bilddelningen behålls. Bara kommande instruktioner
följs. Gränsen höjs inte och bortfall markeras.

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
`services/openclaw/lab/schemas/observed-chat.schema.json`; detta aktiverar inte
produktens ännu återstående gemensamma OpenClaw-talägarskap.
`/api/inputs/reference` är lokal status (GET) och explicit verify/launch/mapping
(POST); alla destinationer och credentials bestäms på servern.

## Isolerad lokal jämförelse

Kör från repots rot, med labbets beroenden installerade:

```powershell
npm --prefix apps/studio run build
node tools/start-local-comparison.mjs
```

Öppna `http://127.0.0.1:4192/activity` (omdirigerar till Provspelning & logg, `/control/rehearsal`) och tryck **Anslut**. Spelet körs på
`http://localhost:4194` med originalet på `/`. `/v2/` finns kvar som 307-omdirigering, inte som egen spelare. `/casino.html` svarar 308 till `/play`. `/bo`, `/bo/` och `/bo/index.html`
svarar 308 till `/control/administration`. Olika hostnamn håller testets
spelcookies skilda från labbet. Tillfälliga databaser och en
syntetisk demospelare skapas; `.env`-filer och riktiga konton/saldon används
inte. Modell-, mail- och andra externa nätanrop är avstängda. Detta prov
visar den lokala kedjan, inte en riktig OpenClaw-dialog eller Bettalotto-deploy.

Stäng med Ctrl+C: testprocesserna stoppas och deras egna temporära data tas
bort. Bygg om efter kodändringar; verktyget använder labbets byggda version.
`node --test --test-concurrency=4 test/admin-project-drafts-browser.mjs` ingår
i CI och kör bundle-/API-provet. De interaktiva browserfallen för sparning,
återläsning, revisionskonflikter och osparade utkast kräver
`CROUPIER_BROWSER_FIXTURE_MODULE` med sökvägen till en installerad Playwright-modul.
CI sätter inte variabeln; browserfallen rapporteras som överhoppade där.
Bundle-/API-provet bevisar inte dessa interaktiva flöden. Det äldre browserprovet av uppladdningssidan och BO-iframevyerna
är pensionerat tillsammans med de ersatta flödena. Spelregler, SSE och
taltransport har egna regressioner i `.githooks/pre-commit-full`; Admin-provet
är inget spel- eller läppsynkskvitto.

## Regressionssviter och tidskvitton

`sh .githooks/pre-commit --full` kör produktens åtta sviter. En enskild svit
körs med exempelvis `sh .githooks/pre-commit-full database`. Namnen är
`studio`, `admin`, `contracts`, `database`, `presentation`, `access`,
`speech` och `gameplay`. Testomgångarna har högst fyra workers; gruppens
kommandorad i fullhooken anger dess filer. Normal gruppgräns är 180 sekunder,
Studio 240 och isolerad SQL/omstart/HTTPS 360. Timeout ger felkod 124 och
avslutar gruppens egna processer. Fel i produktproven förblir blockerande.

CI:s sammanfattning och `dealer-regression-timing-<sha>` visar grupptider.
JSONL-filen har start- och slutposter; en start utan slut visar var ett hårt
avbrott inträffade. Den historiska systemkartans reporter behövs inte för
produktproven eller deras tidskvitton.

`node tools/check-orphan-tests.mjs` inventerar JS/TS-prov i `test`, `lab`,
`packages`, `pipeline`, `apps`, `services`, `services/openclaw/lab` och `ops/cloud`.
Rapporten skiljer full regression, andra CI-kommandon och paket-/lokala
körlistor. `tools/orphan-tests-exceptions.json` namnger manuella prov och
hjälpfiler med skäl. Pythonprov redovisas separat; noll JS-orfaner bevisar
varken Python-täckning eller att alla registrerade prov faktiskt kördes.
Browserprov kan kräva miljöinställningar och rapportera skip enligt ovan.

Fullhooken kör hela OpenClaw- och ops/cloud-grupperna en gång; CI använder
samma grupper. OpenClaws separata syntaxkontroll finns kvar. Lägg nya
assertions i ett relevant befintligt beteendeprov när det räcker. En ny
testfil behöver ett eget felutfall och en tydlig körväg. Historiska filnamn,
CSS-klasser, menyantal och fullständiga proplistor är inga produktkontrakt;
behåll däremot negativa prov för hemliga fält, åtkomst och ägarskap.

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

För aktiv native-produktion gäller [Lab-guiden](docs/README.md): projektpolicy
och mediemetadata sparas revisionsstyrt i Neon inom rätt miljö-/arbetsytescope,
medan filmbytes lagras i privat Blob. Den bevarade videobanken har ett kanoniskt
`lab-video-manifest.json`; egna uppladdningar registreras i Neon först efter
verifierad Blob-lagring. Uppladdning och sparade urvalsregler är separata steg.
Servern använder registrerade video-ID:n och verifierar typ, storlek och SHA-256.
Saknad Neon-/Blob-lagring ger fel, inte automatisk diskfallback.

Endast det uttryckliga lokala legacy-/fixturlägets diskadapter läser
`data/videos/index.json` och Git-ignorerade filer. Det är inte den aktiva
produktionens uppladdningsregister eller en reservväg för native-läget.

Registret är metadata, inte AI-indexering av filmernas innehåll. Att söka,
koppla och förhandsvisa redan registrerade klipp startar inga modell-, tal-
eller GPU-jobb. `want` är intake, inte visuell acceptans. Dealer, situation,
riktning och eventuell exakt talrad måste matcha; text/ljud, hash och kalibrering
granskas per take före aktivering. Engångsprov spelar filmen till dess eget slut,
inte animationens testlängd, och loopar inte. Händelser → klipp ändrar inte motorns kontrakt.

Ansluten chatt går via originalets autentiserade produktchatt och serverbundna
konversationsminne. Spelfliken äger uppspelningen och Lab följer dess kvitton;
originalförvalen återanvänder produktens mediespelarmoduler. Fristående event-
och chattprov har separat provkontext. Detta innebär inte att full P6-acceptans
eller mänsklig take-/läppsynkgranskning är klar; se [handoffen](../../docs/JOHN-HANDOFF.md).

### Samstämmighet med Croupier

[Kompatibilitet och gränser](COMPATIBILITY.md) skiljer verifierade källfält
från labbpolicy och från godkända videotakes. `settle` är inte `speak`:
resultatgrupperingen får aldrig ersätta motorns exakta `speak.line`.
`speak.other` samlar flera repliker och kan inte användas som en gemensam
godkänd talvideo. En labbrörelse byter inte språk eller inspelat ljud.

Labbets JSON-animation får inte ändra delningsriktning eller ta bort en
kortvändning. En videoreferens kontrolleras mot registret men är fortfarande
en **ogranskad labbpreview**, inte automatiskt rätt dealer/action/talrad.
Nya produktionskopplingar och takes kräver separat acceptans;
aktuella luckor finns i [handoffen](../../docs/JOHN-HANDOFF.md).

## Kontroller

```powershell
npm --prefix apps/studio test
npm --prefix apps/studio run typecheck
npm --prefix apps/studio run build
npm --prefix services/openclaw/lab test
```

Tester använder isolerade filer och simulerade modelltransporter, inte riktiga
spelare eller modellnycklar. Byggnaden verifierar inte en Render-driftsättning.

Gemensam medieorkestrering och lokala läsare finns i
`packages/studio-registry/server/`; bindnings- och legacykontroller i
`packages/presentation/server/`. Studio komponerar dem med sina egna
Blob-adaptrar och tidigare roots. Projektets skrivning, lås, historik och
video-/klassificeringsskrivare ligger kvar här. Spelservern har egna
läsarkompositioner och behöver inte importera dessa Studio-skrivare.
