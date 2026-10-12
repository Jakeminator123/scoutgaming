# Roulette — serverägd slumpgenerator

Första byggstenen för ett framtida rouletterum: europeisk roulette med enkel
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
Insatser, spelrum och SSE är ännu inte inkopplade.

När rummet byggs ska dess serverflöde:

1. Kontrollera operatör och rum mot aktuell session och publicering. Stäng
   satsningarna för alla spelare i rundan innan utfallet dras.
2. Låsa rundan och läsa lagrat resultat. Anropa generatorn endast om resultat
   saknas; lagra eventet atomiskt med rundan, med unik nyckel för
   `(operatorId, roomId, roundId)`. En processlokal cache räcker inte vid
   omstart eller flera Render-instanser.
3. Skicka samma lagrade event efter commit till behöriga prenumeranter i det
   rummet. Återförsök och återanslutning återspelar eventet; de anropar inte
   generatorn igen. Mottagaren kan deduplicera med `eventId`.
4. Animera hjulet mot `outcome.number`. Servern avgör utfallet och framtida
   avräkning; animationens fysik/tid och klienten får inte välja resultatet.

Generatorn är avsiktligt stateless: två anrop med samma ID:n drar två gånger.
Transaktionsskyddet ovan ingår därför i nästa steg, tillsammans med satsningar,
plånbok, utbetalningsregler och rumstransport. Detta är inte ett färdigt spel
eller ett certifierat spel om pengar.

## Verifiering

Kör från reporoten:
`node --test --test-concurrency=4 test/roulette.mjs test/roulette-preview.mjs`.
Testet ingår också i den gemensamma pre-commit-/CI-sviten. Det kontrollerar
alla 37 fack och färger, slumpanropets gränser, upprepade nummer, eventets
kontrakt, felaktiga indata och fel i slumpkällan. Statistiska stickprov är inte
bevis för en rättvis eller certifierad generator. HTTP-testerna använder en
isolerad loopback-server utan databas och kontrollerar också Origin, tomma
anrop, belastningsgräns, felsvar och exakta proxyvägar.
