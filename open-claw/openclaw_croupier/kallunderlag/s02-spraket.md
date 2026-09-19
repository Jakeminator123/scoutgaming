# animation-events-v1-s02 · språket

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Facit-namn så Kevin, Jakob och Emil menar samma sak. Två lager i namnet: `rng` är fakta, `show` är event. Motorns ord — linjen, variant, take, trigger — ligger under varje `show`-event och förklaras på s03.

| Facit-namn | Bara Kevin | Bara Jakob | Bara Emil |
| --- | --- | --- | --- |
| 65 | 21 | 9 | 7 |

## Namnregeln

`lager.ämne.verb` och ibland ett fjärde led för riktning eller rad.

- `rng` = något blev sant. Verb i dåtid: dealt, revealed, settled.
- `show` = något ska visas. Verb i infinitiv: deal, nod, clear, idle. Tal via `show.line.*`.
- Ämne är engelskt substantiv i singular: card, hole, hand, turn, bet, round, shoe, line, deal, chip, table, wheel, seat, side.
- Fjärde led bara när samma verb har flera riktningar eller rader: `show.deal.left`, `show.line.win`.
- Ordet **variant** används inte i event-namn. Det är motorns ord för en triggad gren under ett event, t.ex. `show.line.lose` → variant `otur`.

Under varje show-event (s03): `show.line.lose` har en **linje** (standard-takes, en tyst), noll eller flera **varianter** (nära, dealer-21, otur) som öppnas av en **trigger**, och varje gren består av **takes**. Inget av det syns i facit-namnet. Facit-namnet är eventet.

## Så döper du nästa event som ingen annan har

1. Är det ett faktum spelet redan räknat? → `rng.*`
2. Är det något dealern ska spela upp? → `show.*`
3. Tal? → alltid `show.line.<id>`, aldrig ett nytt lager.
4. Deal-riktning? → `show.deal.left|centre|right|dealer|hole`.
5. Resultat-reaktion? → `show.line.*` för tal, `show.react.big` bara för extra gest.
6. Hitta inte på ett tredje lager. Inte `cue`, inte `clip`, inte `event` ensamt i namnet.

## Ord vi säger — och slutar säga

| Säg | Inte | Varför |
| --- | --- | --- |
| faktum (rng.*) | game event / domain event | Något servern räknat. Tre repon, tre ord för samma sak |
| event (show.*) | presentation / cue / clip | Vad dealern ska göra. Cue är Jakobs planner-ord, clip är Emils fil |
| linjen | standard / default / grund | Poolen som alltid får spelas under ett event |
| variant | mood / stämning / 4.2 | En triggad gren under ett event, döpt efter triggern |
| take | clip / video / mening | En hel inspelning: text, ljud, video, frames |
| trigger | villkor / regel / flag | Det som öppnar en variant. Spel, session, chatt eller tid |
| command | action (löst) | action är både hit och CLIP.deal |
| box 0–6 | seat (i Croupier) | Emil/Jakob säger seat |
| line | mening / prompt | Exakt id, inte AI-text |
| collect | settle (om pengar) | settle = räknat, collect = bokat |
| fas | phase om du menar idle | Idle är show.table.idle |
| landning | ungefär när det ser klart ut | landAtMs / events.land. Det en variant måste ärva |

## rng.* — fakta (29)

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

## show.* — bild och röst (36)

`show.chip.payout` är med medvetet — ingen har godkänd live-flyg, men luckan har ett namn.

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

## Betyg på namnen

Namnhygien är inte kvalitet på dealern. Emils klipp är bäst i bild trots sämst namn.

- Kevin · namnhygien: **7 / 10** — två familjer blandas (server-emit och CLIP/speech). Speech-id:n är exakta.
- Jakob · namnhygien: **8 / 10** — domän.ämne.verb rakt igenom. Cue-namnen bryter mönstret.
- Emil · namnhygien: **5 / 10** — läsbart men ingen regel. deal_pos1–7 aldrig i körning.
- Facit som språk: **8 / 10** — 65 namn täcker allt vi hittat. Minus: många `show.line.*`.
