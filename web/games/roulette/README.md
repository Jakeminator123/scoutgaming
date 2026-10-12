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

Studio och partnerportalen erbjuder Blackjack eller Roulette när ett rum skapas.
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

Kör från reporoten:
`node --test --test-concurrency=4 test/roulette.mjs test/roulette-preview.mjs`.
Testet ingår också i den gemensamma pre-commit-/CI-sviten. Det kontrollerar
alla 37 fack och färger, slumpanropets gränser, upprepade nummer, eventets
kontrakt, felaktiga indata och fel i slumpkällan. Statistiska stickprov är inte
bevis för en rättvis eller certifierad generator. HTTP-testerna använder en
isolerad loopback-server utan databas och kontrollerar också Origin, tomma
anrop, belastningsgräns, felsvar och exakta proxyvägar.
