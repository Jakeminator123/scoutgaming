# A02 · rättelser

12 oktober 2026. Källträd `43bb429c` på `jakob/repo-ordning`.
`origin/main` vid kontrollen: `12a12fd6` (en commit före, inte inmergad här).
A04:s rapport fanns inte. T1 är avgjord mot koden och BASLINJE §8.

## Faktablad

Klassning från `lab/app/**/page.tsx`, `route.ts`,
`apps/croupier-frontend/app/**`, `lab/lib/workspace-surfaces.mjs`,
`lab/lib/scout-navigation.mjs`, `lab/lib/control-flow.mjs`,
`lab/components/kevin-bo/partner-copy.mjs` och
`lab/components/kevin-bo/navigation.mjs`. API-listan är katalogens, inte en
ny inventering av varje metod.

| Adress | Klass | Vart |
| --- | --- | --- |
| `/` (lab) | omdirigering, permanent | `/control/clips` |
| `/control` | sida | Översikt |
| `/control/clips` | sida | Dealers & klipp |
| `/control/dealer-forge` | sida | Dealer Forge |
| `/control/library` | sida | Bord & bakgrunder |
| `/control/compositions` | sida | Sammansättningar |
| `/control/companies` | sida | Bolag & team |
| `/control/rooms` | sida | Spelrum & publicering |
| `/control/administration` | sida | Drift och system. `tab=tables` omdirigerar till `/control/rooms` |
| `/control/openclaw` | sida | Agentmodeller; `?tab=chat` är intern agentchatt |
| `/control/rehearsal` | sida | Provspelning & logg |
| `/control/events` | sida | Spelhändelser & villkor |
| `/control/videos` | sida | Klippbibliotek, utan egen menyrad |
| `/control/replies` | sida | Svarsbibliotek, utan egen menyrad |
| `/control/probe` | sida | Probe |
| `/control/guide` | sida | Guide & hjälp |
| `/control/login`, `/control/set-password` | sida | Inloggning och lösenord |
| `/partner`, `/partner/{slug}` | sida | Katalog och bolagsvy |
| `/partner/login`, `/partner/set-password` | sida | Partnerinloggning och aktivering |
| `/control/preview` | omdirigering | `/control/compositions` |
| `/control/lanes` | omdirigering | `/control/rooms`, eller `/control/companies` när `tab=companies` |
| `/control/activity` | omdirigering | `/control/rehearsal` |
| `/control/zones`, `/zones` | omdirigering | `/control/preview`, därefter sammansättningar |
| `/control/backgrounds` | omdirigering | `/control/compositions` |
| `/control/tree` | omdirigering, permanent | `/control/events` |
| `/control/operator-chat` | omdirigering | `/control/openclaw?tab=chat` |
| `/lissabon` | omdirigering | `/control` |
| `/videos`, `/events`, `/guide`, `/probe`, `/openclaw`, `/administration`, `/activity`, `/tree`, `/operator-chat` | omdirigering | motsvarande `/control/…` |
| `/`, `/about` (frontend) | sida | Startsida och om |
| `/demo` | omdirigering | `/play`, med giltig `operator` behållen |
| `/play` | sida | Lobby |
| `/play/profil`, `/play/historik` | sida | Omdirigerar till inloggning utan spelsession |
| `/play/blackjack` | route | Plattformsdokument. Tom operator går till lobbyn. `launch` går till spelmotorn |
| `/blackjack`, `/game`, `/v2`, `/casino.html`, `/bo`, `/player-login` | route | Plattformsdokument via `platformUiDocument` |
| `/labb-lissabon` | omdirigering 307 | `https://croupier-v2.onrender.com/studio` |
| `lab/app/api/**` | API | Studio-API, oförändrat av A02 |

`navigation.mjs` i `kevin-bo` är prototypkatalogens vyer, inte partnerns meny.
Den levande menyn är `partnerNavigation` i `partner-copy.mjs`.

`docs/system-map/routes.json` beskriver fortfarande äldre etiketter
(Dealer & klipp, Lanes, bakgrundszoner). Kartan ägs av A01. Ingen post är
ändrad här. Gult i systemkartan fanns redan före A02 (0 röda).

## T1

| Gammal text | Ny text | Bevis |
| --- | --- | --- |
| Amira/Vera/Mei använder originalmotorn; Astrid och egna dealers använder lokal spelare. | Spelklienten kräver `local` eller `layered` och kastar `Presentation requires registered cloud media` annars. `dealer-engine.mjs` är Studios originalmediareserv. Amira är inte aktiv inbyggd dealer. | `web/public/app.mjs:78`, `web/server.mjs:1167`, `lab/lib/original-media-server.mjs:21`. BASLINJE §8: ingen av Astrids 10 registerposter matchar gamla Git-filer; inget av 29 paket med presentationsdata refererar dem via hash. A04-rapport saknas. |

## JOHN-HANDOFF.md

Filen är omskriven till de fyra delarna. Sakuppgifter som tas bort ur den
löpande texten finns kvar via `git show 00ea55c5:docs/JOHN-HANDOFF.md`.
Varje `random/`-hänvisning i den gamla filen ersätts med den pekaren, eller
med `git show 00ea55c5:random/<fil>` där en fil nämns.

| Gammal text | Ny text | Bevis |
| --- | --- | --- |
| Löpande handoff på 228 KB med daterade rundor och cirka 17 `random/`-sökvägar. | Cirka 13 KB: aktuellt läge, öppna kontroller, senaste leveranser, en rad till den frysta filen. | Storlek före: `git cat-file -s 43bb429c:docs/JOHN-HANDOFF.md` = 228310. `random/`-träffar i den versionen, bland annat rad 1435, 1534, 1613, 1618, 1649, 1699, 1709, 1750, 1783. |
| Rätt dealer: originalmotor för Amira/Vera/Mei. | Se T1. | Samma som T1. |
| Senaste leveranser saknade Node 24-avsnittet som ligger på `origin/main`. | Avsnittet är med, märkt som `12a12fd6` och inte inmergat i `43bb429c`. | `git show 12a12fd6:docs/JOHN-HANDOFF.md` de åtta första raderna. `lab/package.json:15` på det här trädet är fortfarande `>=22.16.0`. |

Medieacceptans som behålls i den nya filen: talset och hashregeln, probe 12
oktober mot befintlig baslinje, zon-PNG SHA-256
`eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`,
`lipsync-overrides` SHA-256
`28197cb52298d78842d972c1790373e121a43bb59fee727e66998a0379aa5ef1`,
PAOW `dealer_desktop` 1920×1080 / 5 s, och Astrid-kvittot
"Hello Jakob, welcome to the table." Per-rad-resultat hänvisas till den
frysta filens avsnitt från 11 oktober och "Acceptans som består".

## README.md

| Gammal text | Ny text | Bevis |
| --- | --- | --- |
| Personalens sidor är bland annat `/control/videos`, `/control/zones`, `/control/lanes`, `/control/preview`, `/control/activity`. | Menyn är Studio, Spelbolag, Drift och System enligt `scout-navigation.mjs`. De gamla adresserna står kvar som sidor eller omdirigeringar. | `lab/lib/scout-navigation.mjs:5`, `lab/lib/control-flow.mjs:14`, `lab/app/control/zones/page.tsx:7`, `lab/app/control/activity/page.tsx:14`, `lab/app/control/lanes/page.tsx:10`. |
| `/control/backgrounds` omdirigerar till `/control/zones`. | `/control/backgrounds` leder till `/control/compositions`. Zonerna leder till förhandsvisning och därefter sammansättningar. | `lab/lib/control-workspace.mjs:10`, `lab/lib/scout-navigation.mjs:53`, `lab/app/control/zones/page.tsx:7`. |
| Bolag skapas från bolagskortet på `/control/lanes`. | Bolag & team på `/control/companies`. | `lab/app/control/companies/page.tsx:3`, `lab/lib/scout-navigation.mjs:13`. |
| Intern personal utan `partner_session` ser demoförhandsvisning. | Vanliga partnerrutter faller inte tillbaka på demodata. | `lab/docs/README.md` samma påstående redan, och AGENTS.md nivå 2. `lab/lib/partner-data.mjs` har ingen demo-fallback. |
| Uppspelning är `dealer-engine.mjs` och `performance-player.mjs`. | Spelklienten är `local-presentation.mjs`, `layered-presentation.mjs` och `performance-player.mjs`. `dealer-engine.mjs` är originalmediareserven. | `web/public/app.mjs:78` och import vid rad 200–213. `lab/lib/original-media-server.mjs:21`. |
| Work on `main`; deliver with `node tools/push-github-work.mjs`. | Feature-branch `jakob/*`, `codex/*`, `cursor/*` och PR mot `main`. Direkt-push till `main` är admin-nödväg. Omgångarna samlas på `jakob/repo-ordning`. README säger också att kroken fortfarande bara namnger `main` tills regeln är inlagd. | B1 och B2 i prompten och `ordning/README.md` §4. Kroken tillåter ännu bara `main` (`tools/check-push-target.mjs:17`); A03 äger den ändringen. |
| Den allmänna editorn i molnet är `/control/events`. | Dealers & klipp, sammansättningar och spelhändelser är skilda sidor. | `lab/app/control/clips/page.tsx:5`, `lab/app/control/compositions/page.tsx:4`, `lab/app/control/events/page.tsx:7`. |

Länkar som fanns i README är kvar: sajten, de tre nivåerna, `lab/README.md`,
`lab/docs/README.md`, de fem dokumenten i `docs/`, OpenClaw, GitHub-repot,
återställningen och dokumentationsduken `animation-events-v1`.

## lab/README.md

Bara sidnamn. Brödtexten är inte omskriven.

| Gammal text | Ny text | Bevis |
| --- | --- | --- |
| `/lissabon` leder till samma startsida. | `/lissabon` leder till `/control`. Roten `/` leder permanent till `/control/clips`. | `lab/app/lissabon/page.tsx:6`, `lab/app/page.tsx:16`. |
| Guide (`/guide`). | Guide & hjälp (`/control/guide`; `/guide` omdirigerar dit). | `lab/app/guide/page.tsx:6`, `lab/app/control/guide/page.tsx`. |
| Händelser (`/control/events`). | Spelhändelser & villkor (`/control/events`). | `lab/app/control/events/page.tsx:7` metadata. |
| Klippbibliotek utan menysamband. | Samma sida, med menyraden Dealers & klipp. | `lab/lib/scout-navigation.mjs:7` och `lab/app/control/videos/page.tsx:6`. |
| Uppspelning (`/control/activity`), även jämförelse-URL:ens etikett. | Provspelning & logg (`/control/rehearsal`). URL:en `…/activity` behålls och beskrivs som omdirigering. | `lab/app/control/activity/page.tsx:14`, `lab/app/activity/page.tsx:6`. |

## lab/docs/README.md

| Gammal text | Ny text | Bevis |
| --- | --- | --- |
| Ladda om originalspelaren / originalmotorns klippval. | Ladda om spelklienten / presentationsspelarens klippval. | `web/public/app.mjs:78`. |
| Administrationens `tab` är `tables`, `operations`, `finance` eller `accounts`. | Kvarvarande flikar är `operations`, `finance`, `accounts`, `partners` och `media-review`. `tab=tables` leder till `/control/rooms`. | `lab/app/control/administration/page.tsx:27`, `lab/components/studio-administration.tsx:44`. |
| `#probe`, `#background`, `#stream` leder till AI-småprat, Sammansättning och Uppspelning. | De leder till `/control/probe`, `/control/compositions` och `/control/rehearsal`. | `lab/lib/dealer-workspace.mjs:7`. |
| Uppspelningens logg. | Loggen i Provspelning & logg. | `lab/app/control/rehearsal/page.tsx:5`. |

L19-meningen om att varianter för Vera, Amira och Mei inte används av spelet
är kvar. Den är inte bara ett sidnamn. Se Tveksamt i agentrapporten.

## lab/docs/TERMINOLOGI.md

| Gammal text | Ny text | Bevis |
| --- | --- | --- |
| Studio-raden saknar Dealer Forge. | Dealer Forge `/control/dealer-forge` står i Studio-raden. | `lab/lib/scout-navigation.mjs:8`, `lab/app/control/dealer-forge/page.tsx`. |
| Zonadresserna är fortsatt alias. | `/zones` och `/control/zones` leder till `/control/preview` och därefter `/control/compositions`. `/control/backgrounds` leder till `/control/compositions`. | `lab/app/control/zones/page.tsx:7`, `lab/app/zones/page.tsx:6`, `lab/lib/control-workspace.mjs:10`. |
