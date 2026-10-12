# Roulette — generator och publicerbara demorum

Europeisk roulette med enkel
nolla, 37 lika sannolika fack (0–36). Varje snurr är oberoende och samma nummer
kan komma flera gånger i följd. Nollan är grön och tillhör inga röd/svart-,
udda/jämn- eller låg/hög-satsningar.

`index.mjs` körs bara i Node på spelservern. Den använder
[`node:crypto.randomInt(0, 37)`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomintmin-max-callback)
utan modulo-bias. Inga paket behöver installeras. Ingen kortsko, brännkort,
förblandad nummerlista, egen seed, viktning eller blackjackkod används.

## Gränssnitt

```js
import { createSpinResult } from './web/games/roulette/index.mjs';

// Endast på servern, efter stängda satsningar för en ny runda.
const event = createSpinResult({
  operatorId: 'sg-test',
  roomId: 'roulette-1',
  roundId: 'round-123',
});
```

Resultatet är ett JSON-kompatibelt event med `schemaVersion: 1`,
`type: 'roulette.spin.resolved'`, `game: 'roulette'`,
`variant: 'european-single-zero'`, `eventId` (UUID), `occurredAt` (UTC), de tre
ID-fälten och `outcome: { number, color }`. Färgen är `green`, `red` eller
`black`. `describePocket(number)` beskriver ett givet fack utan slumpning;
`ROULETTE_RULES` anger varianten och intervallet.

ID:n är 1–100 tecken, börjar med bokstav/siffra och får därefter innehålla
bokstäver, siffror, punkt, understreck, kolon och bindestreck. Extra indata,
inklusive seed eller önskat nummer, avvisas. Inget event skapas om slumpkällan
misslyckas. Modulens frysning skyddar objekten i processen, inte datatransporten.

## Koppling till rum och Render

`ops/cloud/Dockerfile` kopierar redan `web/` till samma Node 24-image som
blackjack. Ingen ny Render-tjänst, port eller miljövariabel behövs.

Testytan finns på `/roulette-test`, via samma signerade Vercel → Render-väg
som blackjack. Render-bokmärket omdirigerar till den kanoniska sajten.
`preview.mjs` kopplar `POST /api/roulette-test/spin` till generatorn; HTML,
CSS och klientkod finns under `web/public/roulette-test/`. Ytan är publik,
olänkad från produktmenyerna och märkt `noindex`. Den läser/skriver inga
konton, satsningar, saldon eller databaser. Historiken lever bara i fliken.

Anropet är en tom POST med `X-Roulette-Preview: 1` och exakt samma Origin
som sidan. Servern väljer demooperatör, demorums-ID och ett nytt rund-ID.
Svaret är `{ demo: true, event }`; eventkontraktet ovan är oförändrat.
Klienten återförsöker aldrig automatiskt. En processlokal begränsning till
30 anrop i en burst, därefter ett nytt tillgängligt anrop per sekund, ger
429 vid för hög belastning. Den är inte ett beständigt rundskydd.
## Spelrum

Studio erbjuder Blackjack eller Roulette när ett rum skapas per bolag.
Partnerportalen visar publicerade rum, tillåtna utseendeval och provspelningslänk;
den skapar inte rum. Användarguiden finns i `lab/docs/README.md`.
Speltyp sparas som `game: 'roulette'`; äldre rum utan fältet är blackjack.
Rum och bolagets frysta presentation publiceras i samma befintliga transaktion.
Lobbyn följer aktuell publicering och öppnar
`/play/roulette?operator=<slug>&table=<room-id>&dealer=<dealer-id>`.

`room.mjs` validerar satsningar och räknar av dem. `rules.mjs` är den gemensamma
satsningskatalogen som också skickas till webbläsaren. `storage.mjs` låser
spelarens plånbok och sparar saldo, bokföring och rundkvitto i samma SQLite-/
PostgreSQL-transaktion. `access.mjs` kontrollerar bolag, speltyp, publicerat
rum och dealer; PostgreSQL kontrollerar publiceringen igen före commit.
Utfallet lämnar transaktionen först efter lyckad commit.

`POST /api/roulette/table` accepterar `op: 'state'` eller `op: 'spin'`.
Spin anger UUID `requestId`, aktuell `version`, `playerId`, `currency`,
`bets: [{id, amount}]` och `context: {operator, table, dealer?}`.
Sessionen äger spelar-ID; ändrat konto/valuta kan inte använda gamla insatser.
Upprepade kommandon återfår samma kvitto; konkurrerande kommandon med gammal
version avvisas. De senaste 20 kvittona sparas per spelare/bolag/rum.
Äldre anrop stoppas av versionskontrollen. Webbläsaren sparar väntande
kommando före anropet och erbjuder exakt återförsök efter anslutningsfel.

Samma inloggning och demosaldo som blackjack används. Detta är personliga
rundor som i blackjack; ett gemensamt tidsstyrt multiplayerhjul ingår inte.
Standardvinster är 35:1, 17:1, 11:1, 8:1, 5:1, 2:1 eller 1:1 netto;
ingen La Partage/En Prison. Gränser: 1–2 000 per fält, 10 000 per runda.
Publicerad tyst idle och komposition återanvänder lobbyns `published-scene.mjs`.
Inga blackjackrepliker eller nya rouletteinspelningar spelas. Externa
partner-launch-konton är spärrade tills deras plånbokskontrakt stöder roulette.
Profilens blackjackstatistik är oförändrad; roulettehistoriken finns i rummet.

## Spelargränssnitt och UI/UX-arbete

Rouletterummet är en serverlevererad HTML-/ES-modulsida, inte en Next-/React-sida.
Vercel vidarebefordrar dess kanoniska adress och tillgångar till Render.
Det befintliga gränssnittet är en spelbar första version som kan omarbetas.

| Ansvar | Källa |
| --- | --- |
| Sidstruktur, kontroller och dialoger | `web/public/roulette/index.html` |
| Layout, färg, responsivitet och rörelse | `web/public/roulette/style.css` |
| Satsningsutkast, hjul, resultat, historik och återförsök | `web/public/roulette/app.mjs` |
| Bolagets frysta dealer, bord och bakgrund | `web/public/roulette/scene.mjs` |
| Delad scenrenderare för lobby och roulette | `web/public/published-scene.mjs` |
| Lobby och rummets ingång | `apps/croupier-frontend/components/player/` |

`app.mjs` kopplar kontroller till HTML-elementens ID:n. Ändra HTML och dessa
kopplingar tillsammans. Scenen använder samma publicerade underlag som lobbyn:
`GET /api/operators/<slug>/rooms/<room-id>/preview?revision=<paketversion>&dealer=<id>`.
Parametern heter `revision`, inte `packageRevision`. Ändringar i den delade
scenrenderaren kräver också kontroll av lobbyn och blackjackens presentation.

En ny design ska behålla serverns regler, RNG, inloggning, plånbok och
publiceringskontroller. Animationen visar det mottagna utfallet; den väljer
inget nummer. När ett svar saknas ska samma sparade `requestId`, version och
satsningar återanvändas. Skapa inte en ny snurr för att lösa ett osäkert svar.
Satsningar förblir låsta tills det väntande kommandot har hanterats.

Utforma och kontrollera även laddning, otillräckligt saldo, ändrad session,
utgången publicering, tappat svar, återförsök och saknad dealerscen. Säkerställ
mobil/desktop, tangentbord, synlig fokusmarkering, begripligt upplästa resultat
och reducerad rörelse. Röd/svart ska kunna förstås utan enbart färg.
Rundans utfall och saldo visas först från serverns bekräftade kvitto.

Aktuell leverans, Nordic Bets exempelrum och den samordnade dealerfrågan finns
i `docs/JOHN-HANDOFF.md`. Hårdkoda inte PAOW eller en annan dealer i gränssnittet.

## Driftsättning

Applicera den additiva `ops/neon-game/007-roulette-tables.sql` i den verifierade
game-databasen efter godkännande. Den skapar endast
`croupier_game.roulette_tables` med referens till befintliga spelare.
Inga konton eller saldon ändras av migreringen. Render-kapabilitet 9 svarar
inte redo innan tabellen finns; Studio vägrar publicera roulette mot äldre
motorer. Befintliga blackjackrum fungerar före migreringen.
Ingen ny tjänst, hemlighet eller miljövariabel behövs. Återställning sker genom
att avpublicera rouletterummen; behåll tabellen och bokförda kvitton.

Generatorn i `index.mjs` är fortfarande stateless och får inte anropas direkt
som återförsök av en redan avgjord runda. Certifiering och riktiga pengar ingår inte.

## Verifiering

Använd Node 24 för hela repo-/Studio-flödet. Kör från reporoten:

```sh
node --test --test-concurrency=4 test/roulette.mjs test/roulette-preview.mjs test/roulette-room.mjs test/roulette-room-storage.mjs test/roulette-room-http.mjs test/roulette-publication.mjs test/roulette-postgres.mjs
```

Tester för generator och testyta kontrollerar
alla 37 fack och färger, slumpanropets gränser, upprepade nummer, eventets
kontrakt, felaktiga indata och fel i slumpkällan. Statistiska stickprov är inte
bevis för en rättvis eller certifierad generator. HTTP-testerna använder en
isolerad loopback-server utan databas och kontrollerar också Origin, tomma
anrop, belastningsgräns, felsvar och exakta proxyvägar. Rumstesterna täcker
satsningar, utbetalningar, idempotens, session/origin, publicering och SQLite.
`test/roulette-postgres.mjs` kräver den isolerade PostgreSQL-fixturen för
databastesterna; upptäckta eller hoppade tester är inte körd PG-verifiering.
CI:s `tools/studio-isolated-qa.mjs` kör dessa med riktig isolerad databas,
inklusive åtta samtidiga spelare, rollback och omstart. Hela uppsättningen
ingår i `.githooks/pre-commit-full` och CI.

Efter UI-ändringar: kontrollera ett fullständigt spelvarv i en isolerad miljö,
inklusive ett tappat svar efter servercommit, exakt återförsök och omladdning.
Kontrollera också mobil, desktop och den faktiska dealerscenen. Ett godkänt
API-test är inte visuellt godkännande. Använd inte produktionskonton eller
ändra riktiga användares demosaldon för testning. Starta lokalt enligt
`AGENTS.md` med `node lab/start.mjs --no-open`; endast ett serverpar åt gången.

## Visuell riktning, rörelselabb och mediaunderlag (12 oktober 2026)

Spelvyn använder samma publicerade scen och samma dealerfil på mobil och
skärm. Mobilbordet står på höjden (tre nummerkolumner, dussin och enkla
chanser bredvid); desktop behåller det liggande bordet. Markervärde, insats,
start och återhämtning ligger i en fäst kontrollrad. Text och tillgängliga
namn skiljer rött, svart och grönt. Hjul och separat kula animeras först efter
serverns kvitto; Visa resultat direkt och reducerad rörelse hoppar över
rörelsen. Det grafiska hjulet är en fungerande prototyp, inte godkänd
hyperrealistisk slutmedia.

`/roulette-test#experiments` är den separata, kontofria rörelseytan: mus/
touch-parallax, mobil-/desktoputsnitt och geststart efter minst 45 graders
sammanhängande dragning. Gesten skickar samma tomma förhandsvisningsanrop som
knappen. Kraft och riktning påverkar inte utfallet. Avbruten pekare och dubbla
starter skapar inte extra anrop. Reducerad rörelse stänger av parallax och
animation. Inga kamerabilder eller dealerfiler laddas i den här skissen.
Testytans nya klick skapar nya demorundor; dess stateless-anrop får aldrig
ersätta spelrummets beständiga återförsök.

Parallaxen är en liten förskjutning mellan bakgrund, dealerplan och bord,
inte en fri kamera. En inspelad frontal dealer innehåller inga sidovyer.
Behåll kameran låst vid inspelning och rör lagren lite i spelaren. Dealer och
bordets kontaktkant måste följa samma förankring, annars glider händerna.
Inbränt blackjackbord kan inte döljas genom att lägga ett roulettebord ovanpå.
Ett nytt frilagt idleklipp eller en ny sammanhängande roulettescen behövs.
Den befintliga rumspubliceringen väljer dealer; arbetet gör inget dealerbyte.

### Föreslaget produktionsformat för Runway / 3D-artist

Detta är ett arbetsunderlag för nya tillgångar, inte en ändring av Studios
publiceringskontrakt. Börja med en godkänd stillbild och prova kompositionen
med skisslagren före betald video. Bakgrunder kan använda blackjackmiljöns
material och ljus, medan bord och hjul är rouletteunika.

| Tillgång | Föreslagen leverans |
| --- | --- |
| Dealer idle | En enda stående master, 2160 × 3840 om källan medger det; runtimevariant 1080 × 1920, kvadratiska pixlar. Frontal, låst kamera. Hela huvudet, axlarna, armarna, händerna och kroppen till nedanför bordskanten i bild. Ingen separat mobil-/desktoptagning. |
| Inramning | Ansiktets mitt omkring x=50 %, ögon y=25–30 %, händer i y=60–70 %. Minst 12 % fri marginal åt sidorna och 8 % över huvudet. Bevara ett neutralt parti under händerna för maskning. Detta är startvärden som måste kalibreras mot den valda referensbilden. |
| Bakgrund | Ljudlös, låst miljöplåt 3840 × 2160 med minst 15 % extra scen runt avsett utsnitt; kompletterande stående miljöplåt vid behov. Ingen inbakad dealer, text, marker eller bordsgeometri. |
| Roulettebord | Separat frilagd stillbild eller 3D-modell. Startmått 2,4 × 1,35 m, höjd 0,9 m, hjuldiameter cirka 0,8 m. Måtten är scenförslag, inte påstådda standardmått. Valnöt, mässing, mörkgrön filt; samma ljusriktning som miljön. |
| Bordets bildplan | Separata exports för 16:9 och 9:16 är tillåtna för bord/bakgrund. Dealerfilen är samma. Hjulyta och händer ska förbli läsbara; skala eller placera om bordet, aldrig sträcka det. Behåll neutral filt under det kodritade satsningsbordet. |
| Hjul | Helst GLB/glTF: stationär skål, roterande rotor och kula som separata delar, gemensam centrumaxel, meter som enhet, PBR-material och separata texturer. Siffror/fack följer exakt WHEEL i rules.mjs. En grön nolla. |
| Video | Välj en källängd runt 8–10 sekunder som aktuell modell stöder. Leverera original och en redigerad sömlös loop med konstant bildfrekvens (föreslagen runtime 30 fps), ljudlös. Bevara källans riktiga upplösning; uppskalning är inte mer detalj. |
| Friläggning | Be om ren bakgrund och stabil siluett. Separat alfamaster efter friläggning är önskad leverans, inte en garanti från videogeneratorn. Registrera och prova via befintlig compositing; introducera inget nytt runtimeformat enbart för briefen. |

Alla lager ska dela ljus: stor mjuk huvudkälla ovanför kamerans vänstra sida,
varm praktisk belysning i bakgrunden och svag neutral upplättning från höger.
Undvik extremt kort skärpedjup; händer och bordskant måste vara skarpa.
Bordets framkant ockluderar den frilagda kroppen under den kalibrerade
kontaktlinjen. Vid parallax ska kontaktlinjen inte glida.

### Prompt: dealer i vila (image-to-video, engelska)

Använd en godkänd referensbild av den dealer som senare ska publiceras.
Prompten kan klistras in i Runway efter att referensbilden är förberedd:

> Locked-off camera, continuous photorealistic shot. The standing roulette dealer holds the same relaxed neutral pose throughout. Gentle natural breathing, one soft blink and tiny eye movements. Lips remain gently closed. Both hands rest calmly at the same height in front of the body, with all fingers stable and visible. Shoulders and head return naturally to their initial neutral position at the end. The framing, focus, exposure and lighting remain constant throughout. Quiet, attentive presence, restrained movement, realistic skin and fabric detail.

Referensbilden bestämmer utseende och komposition; rörelseprompten ska beskriva
rörelsen. För loopförsök kan samma godkända bild användas som första och sista
bild i Runways Animate Frames. Sömlöshet är inte garanterad: granska och
redigera skarven. Källa: [Runway Image to Video Prompting Guide](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide).

Acceptans: ingen talrörelse, utdelning av kort eller beröring av hjulet; inga
nya fingrar eller vandrande händer, hopp i belysning eller kameradrift. Spela
loopen minst två gånger i följd i båda utsnitten och inspektera skarven vid
normal hastighet. Spara original, filhash, beskärning, mask, kontaktlinje och
acceptansnotering. Nya hashvärden får inget ärvt mediegodkännande.

### Prompt: bord och atmosfärisk referens

> A photorealistic private European roulette room with a single-zero roulette table. Dark walnut cabinet, finely machined brushed brass, deep forest-green wool felt, subtle wear and physically believable reflections. A standing dealer position centered behind the table, an unobstructed circular wheel to the viewer's left, and a clean felt betting area to the right. Camera locked at seated player eye height with a natural 45 mm equivalent lens. Warm architectural lighting, soft neutral key light from camera left, precise straight edges, crisp materials and restrained depth of field. A quiet, premium private gaming salon.

För en separat miljöplåt används samma referens, ljus och kamera med tomt rum.
Nummer, logotyper och satsningsrutor läggs på kontrollerat i kod/3D efteråt.
Genererad video av en snurr är användbar som look-/rörelsereferens. Den kan
inte vara produktens enda resultatvisning: aktuell server måste kunna styra
samtliga 37 slutpositioner, även samma nummer flera gånger. Slutlösningen bör
vara ett fotorealistiskt modellerat hjul med kodstyrd rotor/kula, eller en
verifierad uppsättning exakta utfall som matchar samma kamerageometri.

### Kamera: nästa avgränsade experiment

Webbkamera är undersökt men inte aktiverad. [MediaPipe Face Landmarker för webben](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
kan ge ansiktslandmärken och transformationer. En möjlig implementation är
lokal huvudpositionsberäkning, filtrerad och begränsad till samma lilla
parallaxintervall. Lägg inferens i en worker så spelkontrollerna inte blockeras.
Det kräver ett uttryckligt Starta kamera-val, synlig avstängning, ingen
inspelning/uppladdning, stopp av alla kameraspår vid sidbyte eller när fliken
döljs och fungerande mus/touch utan kamera. Modell, WASM och CSP ska hanteras
som en separat granskad integration; den här PR:n lägger inte in CDN-skript.

### Isolerad manuell UI-acceptans

`node tools/roulette-ui-fixture.mjs` skapar en kortlivad testserver på
`127.0.0.2` med slumpad port, SQLite i minnet och två egna testkonton. Den
läser inga env-filer och kopplar inte upp mot Neon, Blob eller produktionen.
Öppna utskriven `/fixture`-adress. Verktyget är ingen alternativ produktstart:
använd det bara för test och avsluta efteråt (automatisk stängning efter 30 min).

Kontrollera 1440 px desktop, 390 px mobil och 320 px smal mobil: inga dolda
satsningskolumner, minst 44 px tryckhöjd, läsbart saldo och åtkomliga kontroller.
Spela, upprepa, ångra, rensa, öppna/stäng dialoger med tangentbord och prova
reducerad rörelse. `/fixture` kan tappa nästa svar efter riktig SQLite-commit;
återförsök från spelet och efter omladdning ska ha identiskt requestId,
version och bets. `/fixture/evidence` visar antal generatoranrop, kommandon
och testledger. Byte till det andra testkontot ska neka det förra kontots
kommando. Scenen ska ge ett begripligt fel när ingen media finns. En godkänd
fixtur ger inte acceptans av produktionsauth, PostgreSQL eller verklig dealer.
