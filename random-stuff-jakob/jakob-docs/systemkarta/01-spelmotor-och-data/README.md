# Spelmotor och publik data

[Till systemkartan](../README.md) · [Nästa: presentation och urval](../02-events-triggers-urval/README.md)

**Kodkontrollerat:** motorn bestämmer kort och regler. Servern håller shoe,
runda, saldo och utbetalningar auktoritativa. Presentationen får ett redan
bestämt, publicerat underlag.

```text
Command: state / start / act / insurance / collect
    ↓
Serverns shoe + Round + regler
    ↓
gameView: publik spelvy
    ├── /api/table → vanliga klientens befintliga koreografi
    └── /api/v1/table → Partner-adaptern → presentation[]
```

Den vanliga klienten och Partner-presentationen är olika kodvägar. Att
Partner-adaptern finns innebär inte att den nya studion driver produktens
spelare. Labbet använder publicerade exempel och simulerad kontext.

| Källa | Ansvar |
| --- | --- |
| [blackjack.mjs](../../../../web/public/blackjack.mjs) | Shuffle, blackjackregler, `Round` och dess interna händelser |
| [shoe-game.mjs](../../../../web/shoe-game.mjs) | Beständig shoe, commands, handstruktur och publik `gameView` |
| [server.mjs](../../../../web/server.mjs) | HTTP, lagring och transaktioner med wallet |
| [partner-api.mjs](../../../../web/partner-api.mjs) | Partnertransport och publicering av presentationer |
| [partner-presentation.mjs](../../../../web/partner-presentation.mjs) | Presentation från föregående/ny publik vy och command |

De **tio interna händelsetyperna** är `round.dealt`, `insurance.offered`,
`dealer.peek`, `dealer.blackjack`, `hand.thinking`, `card.dealt`, `hand.split`,
`dealer.reveal`, `dealer.draw` och `round.settled`. Samma typ kan förekomma
flera gånger. De är inte tio videor och inte slumpgeneratorns utdataformat.

Interna `card.dealt` används för hit, double och nya kort efter split.
Initial utdelning signaleras med `round.dealt`; Partner-adaptern hittar dess
enskilda kort genom skillnaden mellan publika vyer. Därför är publika `deal`
en bättre ingång för ett sammanhängande utdelningsregister.

**Tre index måste hållas isär:** fysisk `box` är 0–6; `handIndex` pekar in
i handlistan och kan flyttas vid split; kortets position ligger i handens
`cards[]`. `shoeDraw` identifierar ett faktiskt drag ur shoe, inte första
eller andra kortet i handen. Interna motor-event använder dessutom ibland
namnet `box` för handindex — läs alltid källan till fältet.

Den publika vyn innehåller mer än presentationsevent: händer, synliga kort,
fas, aktiva handlingar, sidobet-resultat och shoe-/shuffle-status. Privata
framtida kort och dolt hålkorts valör/färg följer inte med. En publik uppgift
är inte automatiskt ett tillåtet triggerfält i studion.

Detaljerade payloadtabeller finns i [eventregistret](../../2026-09-20-eventregister-och-mental-modell.md).
För äldre revisionsjämförelse med Kevins branch, läs [V3:s tekniska kvitto](../../../../docs/animation-events/v3-9-days-mvp/RUNTIME-EVIDENCE.md).
Det kvittot är daterat och fastställer inte dagens remote-head eller deployment.
