# Spelmotor, Partner och signaler

[Till systemkartan](../README.md) · [Nästa: presentation och urval](../02-events-triggers-urval/README.md)

**Serverns spelmotor bestämmer kort, regler och utfall.** RNG bidrar till
kortordningen; spelfakta omfattar också händer, fas, tillåtna handlingar
och resultat. Presentation och modellråd kan inte ändra dessa beslut.

```text
Spelarhandling → serverns shoe + Round + regler → publik gameView
    ├── /api/table → vanliga klientens egen koreografi
    └── /api/v1/table → presentation[] → partnerns klient
                           └── samma lista via /api/v1/events
```

## Partner-API:t går i båda riktningar

Partnern skickar start, hit, stand och andra kommandon **in**. Croupier
skickar status, presentationslistor och mediereferenser **ut**. Vid seamless
wallet anropar Croupier operatörens wallet och tar emot dess svar.

- **Intern demo:** Croupier lagrar och ändrar demobalansen på servern.
- **Partner med `walletUrl`:** operatörens wallet är saldots källa. Den
  granskade Partner-table-vägen anropar `balance`, `bet` och `win` och
  lagrar det returnerade saldot lokalt. Detta dokument bevisar inte ett
  komplett avstämnings-/rollbackflöde för drift.

En launch-URL öppnar den vanliga webbklienten. Det innebär inte att dess
`/api/table` automatiskt går genom Partner-table-vägens wallet eller SSE.
Den skillnaden behöver ingå i ett verkligt integrationsprov.

## Eventströmmen är avgränsad

SSE kräver signerad Partner-åtkomst med `play`-scope och rätt kombination
av API-nyckel och partnerns `playerId`. En BO-inloggning räcker inte.
Vanliga `/api/table` publicerar inte till denna ström i granskad kod.

`hello` är anslutningsmeddelandet; `round.events` innehåller presentationerna.
`state` ger tom presentationslista. Ett cachat svar för samma `requestId`
publiceras inte igen. Strömmen har ingen replaybuffert eller återhämtning
via `Last-Event-ID`. Efter avbrott behövs återläst status och en beslutad
återhämtningsstrategi; kör inte både svar och SSE som dubbla uppspelningar.

## Fältens betydelse

Fysisk `box` är 0–6. `handIndex` pekar in i handlistan och kan ändras vid
split. Kortpositionen finns i `cards[]`; `shoeDraw` identifierar draget
ur skon. Interna motor-events använder ibland `box` för handindex, så
källan till fältet måste följa med.

Motorns tio interna eventnamn är `round.dealt`, `insurance.offered`,
`dealer.peek`, `dealer.blackjack`, `hand.thinking`, `card.dealt`, `hand.split`,
`dealer.reveal`, `dealer.draw` och `round.settled`. Partner-adaptern
översätter skillnader mellan publika vyer till sex presentationstyper;
den vidarebefordrar inte denna interna lista.

Publik status innehåller även sidobet-resultat, shoe-/shuffle-status och
legal actions. Privat kortordning och dolt hålkorts valör/färg lämnas inte
ut. Publikt fält betyder heller inte automatiskt tillåtet modellinput.

## Direkta källor

- [Regler och Round](../../../../web/public/blackjack.mjs),
  [shoe och gameView](../../../../web/shoe-game.mjs).
- [Server och native table](../../../../web/server.mjs),
  [Partner, wallet och SSE](../../../../web/partner-api.mjs),
  [presentationsprojektion och manifest](../../../../web/partner-presentation.mjs).
- [Detaljerade payloads](../../2026-09-20-eventregister-och-mental-modell.md).

Kodkontroll 20 september 2026 är inte verifiering av dagens Bettalotto-deploy,
behörighet, betalflöde eller aktiva session.
