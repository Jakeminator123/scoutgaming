# Roulette: kod och integration

Läs [rouletteguiden](README.md) först. Detta beskriver befintlig kod; driftåtgärder kräver eget mandat. Den tidigare versionen med Annas talplan från 14 oktober finns i [historiken](../../history/games/roulette/TEKNIK-2026-10.md).

## Generatorn

[`index.mjs`](../../../services/game/games/roulette/index.mjs) körs bara i Node på spelmotorn och använder [`node:crypto.randomInt(0, 37)`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomintmin-max-callback) utan modulo-bias. Ingen sko, förblandad lista, seed eller viktning.

```js
import { createSpinResult } from './services/game/games/roulette/index.mjs';

// Endast på servern, efter stängda satsningar för en ny runda.
const event = createSpinResult({ operatorId: 'sg-test', roomId: 'roulette-1', roundId: 'round-123' });
```

Eventet har `schemaVersion: 1`, `type: 'roulette.spin.resolved'`, `game: 'roulette'`, `variant: 'european-single-zero'`, `eventId` (UUID), `occurredAt` (UTC), de tre ID-fälten och `outcome: { number, color }` där färgen är `green`, `red` eller `black`. `describePocket(number)` beskriver ett fack utan slumpning; `ROULETTE_RULES` anger variant och intervall. ID:n är 1–100 tecken, börjar med bokstav eller siffra och får innehålla bokstäver, siffror, punkt, understreck, kolon och bindestreck. Extra indata, som seed eller önskat nummer, avvisas, och inget event skapas om slumpkällan fallerar. Generatorn är tillståndslös och får aldrig anropas som återförsök av en avgjord runda.

## Rum och kommandon

Admin erbjuder Blackjack eller Roulette när ett rum skapas för ett bolag; speltypen sparas som `game: 'roulette'` (rum utan fältet är blackjack). Rummet och bolagets frysta presentation publiceras i samma transaktion. Partnerportalen visar publicerade rum och provspelningslänk men skapar inga rum.

- `rules.mjs`: satsningskatalogen, som också skickas till webbläsaren.
- `room.mjs`: validerar satsningar och räknar av dem.
- `storage.mjs`: låser spelarens plånbok och sparar saldo, bokföring och rundkvitto i samma PostgreSQL-transaktion. Utfallet lämnar transaktionen först efter commit.
- `access.mjs`: kontrollerar bolag, speltyp, publicerat rum och dealer; PostgreSQL kontrollerar publiceringen igen före commit.

`POST /api/roulette/table` med `op: 'spin'` tar UUID `requestId`, aktuell `version`, `playerId`, `currency`, `bets: [{id, amount}]` och `context: {operator, table, dealer?}`. Sessionen äger spelar-ID; ändrat konto eller valuta kan inte använda gamla insatser. Upprepade kommandon ger samma kvitto, och konkurrerande kommandon med gammal version avvisas. Webbläsaren sparar väntande kommando före anropet och erbjuder exakt återförsök efter anslutningsfel.

## Spelargränssnitt

Rouletterummet är en serverlevererad HTML-/ES-modulsida; Vercel vidarebefordrar adressen och tillgångarna till Render.

| Ansvar | Källa |
| --- | --- |
| Sidstruktur, kontroller och dialoger | `services/game/public/roulette/index.html` |
| Layout, färg och rörelse | `services/game/public/roulette/style.css` |
| Satsningsutkast, hjul, resultat, historik och återförsök | `services/game/public/roulette/app.mjs`, `wheel.mjs`, `wheel-motion.mjs` |
| Bolagets frysta dealer, bord och bakgrund | `services/game/public/roulette/scene.mjs` |
| Delad scenrenderare för lobby och roulette | `packages/presentation/runtime/published-scene.mjs` |
| Lobby och rummets ingång | `apps/web/components/player/` |

`app.mjs` kopplar kontroller till HTML-elementens ID:n; ändra dem tillsammans. Scenen läser `GET /api/operators/<slug>/rooms/<rum-id>/preview?revision=<paketrevision>&dealer=<id>` (parametern heter `revision`). Ändringar i den delade scenrenderaren kräver kontroll av lobbyn och blackjack.

En ny design behåller serverns regler, RNG, inloggning, plånbok och publiceringskontroller. Animationen visar det mottagna utfallet och väljer inget nummer. Saknas ett svar återanvänds samma `requestId`, version och satsningar; satsningarna är låsta tills det väntande kommandot är hanterat. Laddning, otillräckligt saldo, ändrad session, utgången publicering, tappat svar och saknad dealerscen ska vara begripliga, liksom tangentbord, fokus, upplästa resultat och reducerad rörelse. Röd/svart ska kunna förstås utan enbart färg. Hårdkoda ingen dealer i gränssnittet.

## Drift

Tabellen `croupier_game.roulette_tables` skapas av den additiva `ops/neon-game/007-roulette-tables.sql` och refererar befintliga spelare; inga konton eller saldon ändras av den. Motorn svarar inte redo för roulette innan tabellen finns, och Admin vägrar publicera roulette mot äldre motorer. Ingen egen tjänst, hemlighet eller miljövariabel behövs; `ops/cloud/Dockerfile` kopierar `services/game/` som för blackjack. Återställning sker genom att avpublicera rouletterummen; tabellen och bokförda kvitton behålls. Certifiering och riktiga pengar ingår inte.

## Verifiering

```sh
node --test --test-concurrency=4 test/roulette.mjs test/roulette-room.mjs test/roulette-room-http.mjs test/roulette-publication.mjs test/roulette-postgres.mjs test/roulette-wheel.mjs test/roulette-start-contract.mjs
```

Proven täcker alla 37 fack och färger, slumpanropets gränser, eventkontraktet, felaktiga indata, satsningar, utbetalningar, idempotens, session och origin samt publicering. `test/roulette-postgres.mjs` kräver den isolerade PostgreSQL-fixturen; CI kör den med riktig isolerad databas, inklusive samtidiga spelare, rollback och omstart. Statistiska stickprov bevisar ingen certifierad generator, och ett godkänt API-prov är inget visuellt godkännande. Efter UI-ändringar provas ett fullständigt spelvarv i isolerad staging med tappat svar, exakt återförsök och omladdning, på mobil och desktop.
