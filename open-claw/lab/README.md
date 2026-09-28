# Croupier · OpenClaw-labb

> **Ny lokal arbetsyta:** använd [Next.js-studion i repots `lab/`](../../lab/README.md).
> Den här mappen behåller Render Director, Gateway-adapter, Docker/blueprint
> och den äldre editorn för befintlig drift. Instruktionerna nedan gäller den
> äldre tjänsten; dess katalog är separat från studions `lab/data/project.json`.

Ett fristående labb för att redigera och spela kedjan
`presentationsevent → semantisk nod → standardlinje/variant → trigger → OpenClaw-råd → validering → animation`.

Starta från Croupier-repots rot med Node 22.16 eller senare:

```powershell
npm --prefix open-claw/lab start
```

Öppna **http://localhost:4188**. Inga npm-paket behöver installeras.
Välj scenario, ändra testkontext och spela eller stega eventen. Editorn sparar
ändringar till `data/catalog.json` och tidigare versioner till `data/history/`.
Den versionshanterade startkatalogen är `config/catalog.json`. När labbet går
via Render redigeras i stället katalogen på Render-disken.

## Tre körlägen

| Läge | Vad visas? |
| --- | --- |
| Standard (`off`) | Standardlinjen, utan modellförfrågan. |
| Shadow | OpenClaw får föreslå en tillåten variant; standardlinjen spelas. |
| Active | Ett giltigt råd väljer en tillåten variant; annars standardlinjen. |

Utan en konfigurerad Gateway går scenarier, editor och standardanimationer att
använda. Spåret visar att OpenClaw saknas. Chatten visar anslutningsfel; den
ersätts aldrig med en påhittad modell. Direkt förhandsvisning av en variant är
en manuell labbfunktion, inte ett OpenClaw-beslut.

## IDE-inboxen är inte spelarchatten

- **IDE-agenternas gemensamma inbox** samordnar utvecklingsarbetet i GitLab.
  Den är ett separat projektsystem och har ingen koppling till OpenClaw-runtime.
- **Croupier-spelets användar-/spelarchatt** hör till produkten. OpenClaw ska
  kunna använda kontrollerade signaler från den för croupierns reaktioner och
  presentationsval. Den riktiga spelarchatten är **inte inkopplad i detta labb**.
  Här väljer operatören ännu `context.chat.signal` manuellt.

Labbets ruta "Prata med OpenClaw" är ett operatörssamtal om katalogen, inte en
ersättning för spelarchatten. Den matar inte automatiskt beslutsmotorns
chattsignaler. Nästa integrationssteg behöver en separat serveradapter för
spelarchatten: autentiserat meddelande → moderering/klassificering → validerad
signal → tillåtna varianter → OpenClaw-råd → slutlig validering. Spelartext är
indata, aldrig instruktioner som får ändra spelregler, katalog eller behörigheter.
Beständigt minne och eventuella text-/talsvar till spelare kräver egna kontrakt;
det är inte levererat bara för att operatörssamtalet fungerar.

För publicering: [steg för steg från GitLab till Render](docs/RENDER-START-SV.md).
För OpenClaws egna verktyg och inställningar: [native admin-dashboard](docs/DASHBOARD-SV.md).

## Nycklar och anslutning

Hitta officiella installations-, konfigurations- och MCP-källor via
[den korta dokumentationsguiden](docs/README.md). Externa källor läses vid behov,
inte automatiskt för varje spel-event eller chattmeddelande.

Den befintliga **`.env` i Croupier-roten** läses server-side. Labbet läser bara
sina namngivna inställningar och använder inte automatiskt `OPENAI_API_KEY`.
Ändringar i runtime-nyckel/URL läses på nästa begäran. Port, host och dashboardens
ursprung/upstream är däremot låsta till startkonfigurationen och kräver omstart.

`OPENCLAWAPI_KEY` är lösenordet till native dashboarden och används även som
Bearer-credential mellan Director och OpenClaw Gateway. Till en lokal Gateway
behövs också `OPENCLAW_BASE_URL`.
När Gateway körs privat på Render ligger nyckeln där och på Render-Director.
Den lokala servern använder då `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN` för
utgående HTTPS till Director. Render behöver ingen tunnel till datorn.

OpenClaw behöver även sin modellleverantörs credential, `OPENCLAW_MODEL_API_KEY`,
enbart på Gateway. Om din nyckel är utfärdad av modellleverantören hör den i
det fältet; Gateway får en separat autentiseringsnyckel.
Se [Render, Docker och nycklarnas roller](docs/DEPLOYMENT.md) och `.env.example`.

## Verkliga event och begripliga ord

De sex källtyperna är frysta efter `web/partner-presentation.mjs`:
`speak`, `deal`, `reveal`, `settle`, `turn`, `idle`. Katalogens cirka 15 noder
är semantiska uppdelningar ovanpå dem. Exempelvis är `deal.player.left`
en labbnod som matchar `type: deal` och `clip.action: deal-left`.
Den är inget nytt event som motorn emitterar.

| Ord i editorn | Betydelse |
| --- | --- |
| RNG / game | Motorn äger spelutfall, kort, saldo och payout. |
| Show / presentation | Visar redan publicerade fakta. |
| Event / källtyp | Ett faktiskt objekt i Partner API:s `presentation[]`. |
| Nod | Begripligt presentationsbehov med referens till koden. |
| Standardlinje | Alltid tillgänglig grundpresentation och fallback. |
| Variant | Alternativ vars villkor måste vara uppfyllda. |
| Trigger | Ett kontrollerat villkor, utan körbar JavaScript. |
| Trigger source | Var informationen kommer ifrån: game, chat, player history eller session. |
| Take / asset | Identifierad animation nu; sammanhållet mediapaket senare. |

`rng/show` används som lagerbegrepp; transportens verkliga eventnamn behålls.
Talradens `line` är ett annat begrepp än standardlinjen i variantträdet.

Chattavsikter (`praise`, `inappropriate`), återkomst, språkpreferens och
antal tidigare vinster/förluster är **simulerad kontext** i denna version.
Surprise betyder en reaktion på publicerad historik, aldrig en förutsägelse.
En tysk välkomstvariant visar här att språkpreferensen träffade; den genererar
inte en ny synkad inspelning. Olämplig chatt får en neutral markering.
Beständiga spelarpreferenser och riktig moderering behöver egna anslutningar.
Operatörschatten med OpenClaw är separat och redigerar inte katalogen.

## Ingång från Croupier

Labbet accepterar den publicerade presentationen, inte det privata motorstate:t.
Du kan klistra in `presentation[]` i gränssnittet eller skicka ett event till
`POST /api/decide` med `{requestId,event,context,mode}`.

`POST /api/presentation` tar `{requestId,presentation:[...],context,mode}` och
returnerar `{decisions:[...]}` i samma ordning. Hela batchen valideras innan
första beslutet. En batch har högst 25 sekunders gemensam rådgivningsbudget;
resterande events får standardlinjen när tiden tar slut. `requestId` gör en upprepad identisk förfrågan idempotent under
serverns livstid (upp till 1000 cachade beslut); samma id med annat innehåll
avvisas. Ingen endpoint kan ändra ett Croupier-spel eller skriva i dess databas.

**Detta är en separat integrationsyta.** Den vanliga spelklienten konsumerar
inte automatiskt Partner API:s `presentation[]`. Ingen koppling har lagts in
i den klienten. Croupier-kontraktstestet kontrollerar den faktiska producenten
när labbet ligger i repot; det hoppas över i ett fristående labbrepo.

## Katalog och redigering

`schemas/` beskriver den frysta indataformen och redigerbara katalogen.
`src/engine.mjs` validerar även korsreferenser, basvariant och fält som får
läsas. `match` väljer första matchande nod i katalogordning. `when.all`
innehåller triggerpredikat; en tom lista betyder alltid tillåten. OpenClaw
får bara se de varianter som redan klarat dessa villkor. Prioritet är
vägledning inom den mängden, inte tillåtelse att kringgå en trigger.

Direkt redigering av `data/catalog.json` stöds också: behåll giltig struktur
och ändra `revision` för varje ändring. Editorn sköter detta automatiskt,
avvisar inaktuella sparningar och bevarar föregående katalog. Startfilen i
`config/` används tills en redigerad datakatalog finns. Spara/exportera en
granskad katalog tillbaka till versionshanteringen som en uttrycklig ändring.

## Nästa steg till videobanken

Behåll stabila take-id:n när du skapar videoregistret. En take bör innehålla
`id`, `event/sourceRef`, `variantId`, dealer, exakt talrad och text (om tal),
video/ljudreferenser, hash, fps, frame-index, `pickup/release/land/rest`,
kalibrering, granskningsstatus och acceptansanteckning. Cues är mediapunkter,
inte nya spel-events. Se [videoregistrets startmall](media/README.md).

Nästa etapp lägger en validerad videoadapter bakom samma `assetId` som labbet
använder. Trädet och OpenClaws begränsade val kan då behållas. Nuvarande
katalog accepterar avsiktligt bara de enkla animationerna; verkliga speech-
och deal-takes behöver sin sammanhållna media- och timingvalidering.

Kevins föreslagna YAML per event/take och `want/no` från Generations API
passar som **intake före katalogen**: förslag → granskning → godkänd take →
publicerad JSON-katalog. `want` är en önskad kandidat, inte automatiskt
godkänd för uppspelning; `no` ska hålla kandidaten utanför vald takepool.
Exakta fält och statusövergångar behöver bekräftas mot Generations API innan
en sådan adapter kopplas in.

## Underlag och verifiering

- [V3-referensen i `Jakobs-v1`](https://github.com/Jakeminator123/github-work/tree/Jakobs-v1/docs/animation-events/v3-9-days-mvp) och den då aktuella
  Croupier-koden. Labbet är ett separat experiment på Jakobs begäran;
  produktintegration förblir Kevins beslut.
- Jämförelsen av de två användarlevererade ziparna: V2:s fem filer är
  byte-identiska kopior av motsvarande V1-filer. V1 har mer användbart
  underlag: rådsschema, gate, negativa tester och käll-/beslutslogg.
  Principerna återanvänds; äldre föreslagna `rng.*`/`show.*`-eventnamn görs
  inte till runtime-kontrakt. Dokumentens instruktioner är referensmaterial.
- [OpenClaw HTTP-kontrakt](https://docs.openclaw.ai/gateway/openai-http-api)
  styr adapter och agentval. MCP behövs inte för denna dataväg.

Kör `npm --prefix open-claw/lab test` och `npm --prefix open-claw/lab run check`.
Tester använder isolerade temporära kataloger och falska Gateway-svar, inte
verkliga användarprofiler eller modellnycklar. Ett grönt test bevisar inte en
Render-deployment, fungerande providercredential eller godkända videor.
