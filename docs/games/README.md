# Speldokumentation

En ingång per spel. Koden avgör vad spelet gör; bolagets publicerade paket avgör vilken scen ett rum visar. Gemensamma lagrings- och uppspelningskontrakt står i [runtime-referensen](../LOCAL-PRESENTATION-RUNTIME.md), begreppen i [ordlistan](../../apps/studio/docs/TERMINOLOGI.md) och läget i [NEXT-AGENT](../NEXT-AGENT.md).

- [Blackjack](blackjack/README.md): regler, kodkarta, delat bord och dealerbankens mått. Produktens spel i drift (Johns Bet, dealer PAOW).
- [Roulette](roulette/README.md): regler, rumskommandon och scen. Spelbart, men utan kopplad dealerbank.
- [Klipp och format](KLIPP-OCH-FORMAT.md): lagerroll, handling, pose, filformat, visningsprofil och godkännande för båda spelen.
- [Partner-API v1](partner-api.md): HTTP-kontraktet för partnerintegrationer.

Redigera respektive spels README och dess ämnesdokument här, och länka hit i stället för att kopiera mått eller regler. Mottagna planeringsunderlag, källregister och daterade analyser ligger i [docs/history/games](../history/games/); de är källbevis, inte gällande standarder.
