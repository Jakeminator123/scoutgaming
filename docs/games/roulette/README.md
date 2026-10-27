# Roulette

Europeisk roulette med enkel nolla, spelbar i publicerade rum via `/play/roulette`. Spelmotorn (`services/game`, Render `croupier-v3`) äger dragning, saldo och kvitton. Det enda rouletterum som byggts är demorummet *Anna · Roulette · Demo* hos bolaget `scoutgaming-demo`; det tas bort vid ren start (clean slate), när bara Johns Bet blir kvar. Ingen komplett dealer- eller utfallsbank är godkänd.

[Teknisk referens](TEKNIK.md) · [Klippkarta och signaler](KLIPPKARTA.md) · [Krav på utfallsbank](UTFALLSFILMER.md) · [Klipp och format](../KLIPP-OCH-FORMAT.md) · Historik: [oktober 2026](../../history/games/roulette/README-2026-10.md)

## Regler

- 37 lika sannolika fack (0–36), oberoende serverdrag med `crypto.randomInt(0, 37)` i [index.mjs](../../../services/game/games/roulette/index.mjs). Generatorn tar bolags-, rums- och rund-ID, aldrig seed eller önskat nummer.
- Nollan är grön och ingår inte i röd/svart, jämn/udda eller låg/hög.
- [Satsningskatalogen](../../../services/game/games/roulette/rules.mjs): straight, split, street/trio, corner, six-line, dozen, column och outside, med nettovinst 35:1, 17:1, 11:1, 8:1, 5:1, 2:1 respektive 1:1. Ingen La Partage eller En Prison.
- Gränser: 1–2 000 per fält och 10 000 per runda. Personliga rundor; inget gemensamt tidsstyrt hjul.

## Kommandon

`POST /api/roulette/table` tar `op: 'state'` eller `op: 'spin'`. Spin anger `requestId`, aktuell `version`, `bets` och `context: {operator, table, dealer?}`; sessionen äger spelar-ID och valuta. [room.mjs](../../../services/game/games/roulette/room.mjs) validerar och avräknar, och [storage.mjs](../../../services/game/games/roulette/storage.mjs) skriver saldo, bokföring och kvitto atomärt i PostgreSQL. Exakt återförsök ger samma sparade kvitto, aldrig en ny dragning; de senaste 20 kvittona sparas per spelare, bolag och rum.

Spelingång: `/play/roulette?operator=<slug>&table=<rum-id>&dealer=<dealer-id>`. Inloggning och demosaldo delas med blackjack. Partner-launch-konton är spärrade tills deras plånbokskontrakt stöder roulette.

## Scen

| Ansvar | Källa |
| --- | --- |
| Rumstillgång och publiceringskontroll | [access.mjs](../../../services/game/games/roulette/access.mjs) |
| Sida och resurser | [http.mjs](../../../services/game/games/roulette/http.mjs) |
| HTML, CSS, hjul och interaktion | [services/game/public/roulette](../../../services/game/public/roulette/) |
| Dealer, bord och bakgrund från fryst paket | [scene.mjs](../../../services/game/public/roulette/scene.mjs) |
| Gemensam publicerad scen | [published-scene.mjs](../../../packages/presentation/runtime/published-scene.mjs) |
| Bolag, speltyp och rum | [presentation-room.mjs](../../../packages/presentation/contracts/presentation-room.mjs) |
| Källmetadata för bordsmaterial | [media-specification.json](../../../services/game/games/roulette/media-specification.json) |

Scenen läser `/api/operators/<slug>/rooms/<rum-id>/preview` med `revision` och dealer. Ett rum har en speltyp. Bolagets publicerade bord (bild, MP4 eller WebM) används som scenlager; annars prototypbordet. Hjulet ritar de 37 facken i motorns `WHEEL`-ordning och en separat kula som landar i serverkvittots fack.

Dealern kopplas uttryckligen med `dealers[].rouletteIdle` (bas, högst tre varianter, inramning och handpolygoner, frysta med exakta medierevisioner) och valfritt `rouletteStart` (startgest bunden till hjulstart, kulsläpp och återgång till vila). Rum utan sådan koppling visas utan dealer, aldrig med blackjackens vila. Serverns kvitto bestämmer resultat och saldo; ingen film eller bild gör det.

## Återstår före godkänd medieintegration

Godkänd dealerbank och startgest, kalibrerad handkontakt och mask, separat roulette-taluppsättning, en 37-utfallsbank enligt [kraven](UTFALLSFILMER.md), samt verklig mobil, desktop, tangentbord, reducerad rörelse och fokusåtergång i en publicerad scen. Inga produktionssaldon ändras för acceptansprov.
