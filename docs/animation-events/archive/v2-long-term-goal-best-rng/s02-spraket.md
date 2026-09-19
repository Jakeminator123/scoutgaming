# animation-events-v1-s02 · språket

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Facit-namn så Kevin, Jakob och Emil menar samma sak. rng är fakta. show är event. Linjen, variant, take, trigger ligger under varje show-event (s03) och används aldrig i event-namn.

|  |  |
| --- | --- |
| **65** | facit-namn |
| **29** | rng |
| **36** | show |
| **21** | bara Kevin |
| **9** | bara Jakob |
| **7** | bara Emil |

## Regeln

> **Namnregeln.** lager.ämne.verb och ibland ett fjärde led för riktning eller rad. rng = dåtid (dealt, settled). show = infinitiv (deal, nod, idle); tal via show.line.*. Ordet variant används inte i event-namn — det är motorns ord för en triggad gren, t.ex. show.line.lose → variant otur.

- Är det ett faktum spelet redan räknat? → rng.*
- Är det något dealern ska spela upp? → show.*
- Tal? → alltid show.line.<id>
- Deal-riktning? → show.deal.left|centre|right|dealer|hole
- Resultat-reaktion? → show.line.* för tal, show.react.big för extra gest
- Hitta inte på ett tredje lager. Inte cue, inte clip, inte event ensamt.

| Säg | Inte | Varför |
| --- | --- | --- |
| faktum (rng.*) | game event / domain event | Något servern räknat |
| event (show.*) | presentation / cue / clip | Vad dealern ska göra |
| linjen | standard / default / grund | Poolen som alltid får spelas |
| variant | mood / stämning / 4.2 | En triggad gren, döpt efter triggern |
| take | clip / video / mening | En hel inspelning |
| trigger | villkor / regel / flag | Det som öppnar en variant |
| command | action (löst) | action är både hit och CLIP.deal |
| box 0–6 | seat (i Croupier) | Emil/Jakob säger seat |
| line | mening / prompt | Exakt id, inte AI-text |
| collect | settle (om pengar) | settle = räknat, collect = bokat |
| landning | ungefär när det ser klart ut | Det en variant måste ärva |

## rng.*

### rng.* — fakta (29)

| Facit | Betyder | Kevin | Jakob | Emil |
| --- | --- | --- | --- | --- |
| rng.round.prepared | Bord nollställt, ingen insats än | — | round.prepared | — |
| rng.round.started | Rundan är igång, kort kommer | op start (implicite) | round.started | — |
| rng.bet.accepted | En huvudinsats är tagen | placeBet, sen start | blackjack.bet.accepted | bet på state |
| rng.card.dealt | Ett kort lämnade shoen | card.dealt + shoeDraw | blackjack.card.dealt | deal i clip-payload |
| rng.hole.dealt | Hålkort draget, ingen rank ute | holeDraw face-down | card.dealt faceDown | finns ej (europeisk) |
| rng.hole.revealed | Hålets rank är nu sann | dealer.reveal | blackjack.card.revealed | — |
| rng.dealer.peeked | Dealer tittade på hål (ess/tio) | dealer.peek | — | — |
| rng.dealer.blackjack | Hål + up = BJ, runda död | dealer.blackjack | resolve utan player turn | — |
| rng.dealer.drew | Dealer tog extra kort (S17) | dealer.draw | card.dealt dealer | deal_self |
| rng.hand.thinking | Den här handen ska agera | hand.thinking | turn.changed phase=player | PLAYER_TURNS |
| rng.hand.split | En box blev två händer | hand.split | blackjack.hand.split | split i table |
| rng.hand.busted | Hand över 21 | flagga busted, inget emit | följer card.dealt | — |
| rng.action.accepted | hit/stand/double/split giltig | op act (inget emit) | action.accepted (ignore show) | action() |
| rng.turn.changed | Vems tur + legal actions | phase + partner turn | blackjack.turn.changed | turnFor |
| rng.insurance.offered | Dealer ess, fönster öppet | insurance.offered | — | — |
| rng.insurance.resolved | take true/false räknat | op insurance | — | — |
| rng.side.settled | PP / 21+3 uträknat vid deal | settleSideBets | — | — |
| rng.hand.settled | En hands resultat + payout | hand.result i snapshot | blackjack.hand.settled | — |
| rng.round.settled | Hela rundan är räknad | round.settled | round.settled win/loss/push/mixed | PAYOUT |
| rng.wallet.collected | Pengar bokförda, runda paid | op collect | ledger payout | balance på state |
| rng.shoe.shuffled | Ny shoe efter cut | out.shuffled | — | draw/cut |
| rng.seat.taken | Någon satte sig | — | — | playerSat (3D) |
| rng.seat.left | Någon lämnade stolen | — | — | playerLeftSeat (3D) |
| rng.bets.opened | Bord tar roulette-insatser | — | roulette.betting.opened | — |
| rng.bet.placed | En roulette-markör accepterad | — | roulette.bet.placed | — |
| rng.bets.locked | Inga fler roulette-insatser | — | roulette.bets.locked | — |
| rng.wheel.spun | Hjul + kula i rörelse | — | roulette.spin.started | — |
| rng.wheel.landed | Serverns pocket är känd | — | roulette.result | — |
| rng.roulette.settled | En roulette-insats avgjord | — | roulette.bet.settled | — |

## show.*

### show.* — bild och röst (36)

show.chip.payout är med medvetet — ingen har godkänd live-flyg, men luckan har ett namn.

| Facit | Betyder | Kevin | Jakob | Emil |
| --- | --- | --- | --- | --- |
| show.line.greeting | Välkomst-tal | greeting | — | greet_new (om idle) |
| show.line.placebets | Be om insatser | placebets | — | place_bets (saknas i manifest) |
| show.line.goodluck | Bets stängda, lycka till | goodluck | round-start “Cards coming out.” | — |
| show.line.insurance | Försäkring öppen | insurance | — | — |
| show.line.peek | Tittar på hålet | peek (bank, oanvänd live) | — | — |
| show.line.double | Doubling down | double | action-double (okopplad) | — |
| show.line.bust | Spelaren sprack | bust | — | — |
| show.line.blackjack | Spelare naturlig 21 | blackjack | — | react_blackjack |
| show.line.dealerbust | Dealer sprack | dealerbust | — | react_dealer_bust |
| show.line.dealerblackjack | Dealer har BJ | dealerblackjack | — | — |
| show.line.win | Spelaren vann | win | react-win | react_win |
| show.line.lose | Huset tog | lose | react-loss | react_lose |
| show.line.push | Oavgjort, stake tillbaka | push | react-push | react_push |
| show.line.sidebet | PP/21+3 träff | sidebet | — | — |
| show.line.chatter | Smalltalk, inte rundstyrd | chatter1 / chatter2 | — | LLM-chat / MuseTalk |
| show.line.farewell | Hejdå | farewell (bank) | — | goodbye (aldrig spelad) |
| show.deal.left | Kort till box 0–1 | deal-left | deal-player | deal_player (alla säten) |
| show.deal.centre | Kort till box 2–4 | deal-centre | deal-player | deal_player |
| show.deal.right | Kort till box 5–6 | deal-right | deal-player | deal_player |
| show.deal.dealer | Kort till dealer | deal-dealer | deal-self | deal_self |
| show.deal.hole | Hål delas framsida ner | deal-dealer faceDown | deal faceDown | — |
| show.hole.flip | Vänd hålet på filten | reveal / .flip | reveal-hole | — |
| show.hand.think | Väntar på beslut | CLIP.think | wait-decision | lokal idle |
| show.hand.nod | Bekräfta stand | — | action-stand (okopplad) | nod_confirm |
| show.hand.split | Visa fläkt till två händer | animateSplit | split-hand | samma deal_player |
| show.chip.fly | Chip från bricka till spot | chip-fly 480 ms | chipMotion place (3D död) | statisk .betchip |
| show.chip.payout | Chip tillbaka vid vinst | saknas | chipMotion payout (oanvänd) | saknas |
| show.bets.open | Öppna betting-fönster i bild | — | — | bets_open |
| show.bets.close | Inga fler bets i bild | goodluck täcker talet | — | no_more_bets |
| show.table.clear | Sopa bort kort efter payout | bara i rigged-review | clear-table (blockad) | clear_table |
| show.table.idle | Vänteloop, ingen handling | CLIP.idle | idle-neutral | wait_decision_a/b lokal |
| show.shoe.shuffle | Visa shoe-byte | banner 1800 ms | — | shuffle om idle |
| show.react.big | Stor vinst-reaktion | sfx.bigwin | — | react_win_big (≥100) |
| show.gest.tilt | Huvudlutning, inte tal | CLIP.headTilt | — | — |
| show.gest.hand | Gesticulera | CLIP.gest | — | — |
| show.deal.watch | Titta på deal, inte bära kort | CLIP.dealWatch | — | — |

## Bara en av oss

### Finns bara hos en (37)

| Facit | Vem | Deras namn | Betyder |
| --- | --- | --- | --- |
| rng.round.prepared | Jakob | round.prepared | Bord nollställt, ingen insats än |
| rng.dealer.peeked | Kevin | dealer.peek | Dealer tittade på hål (ess/tio) |
| rng.dealer.blackjack | Kevin | dealer.blackjack | Hål + up = BJ, runda död |
| rng.hand.busted | Kevin | flagga busted, inget emit | Hand över 21 |
| rng.action.accepted | Jakob | action.accepted (ignore show) | hit/stand/double/split giltig |
| rng.insurance.offered | Kevin | insurance.offered | Dealer ess, fönster öppet |
| rng.insurance.resolved | Kevin | op insurance | take true/false räknat |
| rng.side.settled | Kevin | settleSideBets | PP / 21+3 uträknat vid deal |
| rng.hand.settled | Jakob | blackjack.hand.settled | En hands resultat + payout |
| rng.seat.taken | Emil | playerSat (3D) | Någon satte sig |
| rng.seat.left | Emil | playerLeftSeat (3D) | Någon lämnade stolen |
| rng.bets.opened | Jakob | roulette.betting.opened | Bord tar roulette-insatser |
| rng.bet.placed | Jakob | roulette.bet.placed | En roulette-markör accepterad |
| rng.bets.locked | Jakob | roulette.bets.locked | Inga fler roulette-insatser |
| rng.wheel.spun | Jakob | roulette.spin.started | Hjul + kula i rörelse |
| rng.wheel.landed | Jakob | roulette.result | Serverns pocket är känd |
| rng.roulette.settled | Jakob | roulette.bet.settled | En roulette-insats avgjord |
| show.line.placebets | Kevin | placebets | Be om insatser |
| show.line.goodluck | Kevin | goodluck | Bets stängda, lycka till |
| show.line.insurance | Kevin | insurance | Försäkring öppen |
| show.line.peek | Kevin | peek (bank, oanvänd live) | Tittar på hålet |
| show.line.double | Kevin | double | Doubling down |
| show.line.bust | Kevin | bust | Spelaren sprack |
| show.line.dealerblackjack | Kevin | dealerblackjack | Dealer har BJ |
| show.line.sidebet | Kevin | sidebet | PP/21+3 träff |
| show.deal.left | Kevin | deal-left | Kort till box 0–1 |
| show.deal.centre | Kevin | deal-centre | Kort till box 2–4 |
| show.deal.right | Kevin | deal-right | Kort till box 5–6 |
| show.hand.nod | Emil | nod_confirm | Bekräfta stand |
| show.chip.fly | Kevin | chip-fly 480 ms | Chip från bricka till spot |
| show.bets.open | Emil | bets_open | Öppna betting-fönster i bild |
| show.bets.close | Emil | no_more_bets | Inga fler bets i bild |
| show.table.clear | Emil | clear_table | Sopa bort kort efter payout |
| show.react.big | Emil | react_win_big (≥100) | Stor vinst-reaktion |
| show.gest.tilt | Kevin | CLIP.headTilt | Huvudlutning, inte tal |
| show.gest.hand | Kevin | CLIP.gest | Gesticulera |
| show.deal.watch | Kevin | CLIP.dealWatch | Titta på deal, inte bära kort |

## Betyg

### Betyg på namnen

- **7 / 10** — Kevin · namnhygien
- **8 / 10** — Jakob · namnhygien
- **5 / 10** — Emil · namnhygien
- **65 / 65** — facit-täckning
- **8 / 10** — facit som språk

| Vem | Betyg | Så här |
| --- | --- | --- |
| Kevin | 7 | Två familjer blandas: server-emit och CLIP/speech-id. Speech-id:n är exakta. |
| Jakob | 8 | domän.ämne.verb rakt igenom, dåtid, Zod. Cue-namnen bryter mönstret. |
| Emil | 5 | Läsbart men ingen regel. deal_pos1–7 aldrig i körning. |
| Facit | 8 | 65 namn täcker allt vi hittat. Minus: många show.line.*. |

> **Vad betyget inte säger.** Namnhygien är inte kvalitet på dealern. Emils klipp är bäst i bild trots sämst namn.

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.