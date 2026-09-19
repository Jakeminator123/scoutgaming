# animation-events-v1-s01 · kartan

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Vad som finns i dag. Visual = Kevin mot Emil. RNG = Kevin mot Jakob. I motorns ord: faktum är RNG, event är Visual. Varje rad är ett event med en enda take — ingen har linjen eller varianter ännu.

|  |  |
| --- | --- |
| **6.7** | Kevin visual |
| **6.0** | Emil visual |
| **6.8** | Kevin RNG |
| **7.8** | Jakob RNG |
| **17** | Kevin talrader |
| **12** | Emil klipp |
| **16** | Jakob GameEventV2 |

## Visual · Kevin + Emil

| Dimension | Kevin | Emil |
| --- | --- | --- |
| Clip-kanal | 7 | 9 |
| Tal / line-id | 8 | 5 |
| Kortdelning | 7 | 7 |
| Chip / payout | 4 | 2 |
| Bordstäckning | 6 | 7 |
| Körbart live | 8 | 6 |

Emil vinner clip-kanalen. Kevin vinner tal och live-bordet.

### Kevin · Croupier visual

Startar från snapshot efter start / act / insurance / collect. Partner-API:t diffar samma snapshot till speak deal reveal turn settle idle.

| Event | Hur det startar | Vad som syns |
| --- | --- | --- |
| greeting | Grind Enter | Tal + caption |
| goodluck | op start | Blocking tal, sen deal |
| deal-left | Kort, ruta 0–1 | CLIP.deal eller staged take |
| deal-centre | Kort, ruta 2–4 | Samma deal-väg |
| deal-right | Kort, ruta 5–6 | Samma deal-väg |
| deal-dealer | Dealer up / hål | deal-dealer take |
| insurance | Fas insurance | Tal insurance |
| think | Fas decisions | CLIP.think + seat.active |
| double | act double | Tal, sen ett kort |
| bust | Hit över 21 | Tal bust |
| split | act split | 550 ms fläkt + chip-ljud |
| reveal | Settled / stand klar | CSS flip, ev. 3D |
| sidebet | PP/TP träff efter deal | Burst + tal |
| win / lose / push / BJ | finish() | Resultat-tal + gest/tilt |
| placebets + idle | op collect | Banner + idle-loop |
| chip-fly | placeBet | CSS 480 ms, ingen payout-flyg |

### Emil · video-dealer visual

Servern gör playClip(name) och skickar { t: "clip", name }. Spelet väntar på klippets outPoint. Idle väljs inte av servern.

| Klipp | Hur det startar | Vad som syns |
| --- | --- | --- |
| bets_open | Första betting-fönstret | Talk-klipp |
| no_more_bets | Timer med minst en insats | Talk, outPoint 3.2 s |
| deal_player | Spelarkort / hit / double / split | Klipp + uiTakeoverAt ~2.6 s |
| deal_self | Dealer up eller dealer-drag | Samma kanal |
| nod_confirm | Stand, kanal ledig | Gesture-klipp |
| react_blackjack | Payout, spelare BJ | Högst prio |
| react_dealer_bust | Dealer spricker | Näst högst |
| react_win_big | Vinst och insats ≥ 100 | Före vanlig vinst |
| react_win | Någon vinst | Efter big |
| react_push | Alla push | Före lose |
| react_lose | Övrig payout | Lägst react |
| clear_table | Efter react | uiClearAt 1.8 s, sweep |

Inte i de 12: greet_new · shuffle · wait_decision_a/b · goodbye / place_bets / deal_pos1–7.

## RNG · Kevin + Jakob

| Dimension | Kevin | Jakob |
| --- | --- | --- |
| Eventmodell | 5 | 9 |
| Shoe / kort sanning | 8 | 8 |
| Täckning av fakta | 6 | 9 |
| Hål / peek | 7 | 8 |
| Plånbok / ledger | 7 | 8 |
| Körbart live | 8 | 5 |

Jakob vinner eventmodellen. Kevin vinner att det redan körs mot en riktig shoe.

### Kevin · Croupier RNG

Shoe 8 lek, cut 312, 1 burn. Kort, shoeDraw, hål och plånbok är server. Round.emit stannar på servern.

| Event / op | Hur det startar | Vad som räknas |
| --- | --- | --- |
| start | HTTP POST /api/table | Ny Round, deal(), shoeDraw på varje kort |
| act hit | Fas decisions, legal | card.dealt, ev. bust |
| act stand | Fas decisions | Nästa hand eller dealer-turn |
| act double | Fas decisions + balans | En extra card.dealt, hand klar |
| act split | Par + balans | hand.split + två card.dealt |
| insurance | Dealer ess uppe | insurance.offered → take true/false |
| collect | Fas settled | Wallet += result + sideReturn |
| state | Resume / reload | Snapshot, aldrig shoe-ordning |
| round.dealt | Efter opening deal | Internt emit, når inte UI |
| dealer.peek | Ess eller tio uppe | Internt, peek-tal oanvänt |
| dealer.reveal / draw | Dealer-fas | Hål vänds, S17-drag |
| round.settled | Payout räknad | Internt. Klienten ser phase=settled |

### Jakob · spelsajt RNG

HTTP GameCommandV2 → domain events → Zod GameEventV2 med sequence + revision → Socket.IO game.event. Inga klippnamn på wiren.

| Command / event | Hur det startar | Vad som räknas |
| --- | --- | --- |
| PREPARE_ROUND | HTTP command | round.prepared |
| BLACKJACK_PLACE_BET | HTTP command | bet.accepted + 4 card.dealt + round.started |
| BLACKJACK_ACTION | hit/stand/double/split | action.accepted, sen kort/split/turn |
| ROULETTE_PLACE_BETS | HTTP command | bet.placed |
| ROULETTE_SPIN | En burst | LOCK_BETS + spin + result + SETTLE |
| blackjack.card.dealt | Deal / hit / double / split / dealer | Kort-id, hål utan rank |
| blackjack.card.revealed | revealDealerHoleCard | Samma visualId, nu face-up |
| blackjack.turn.changed | Spelare / dealer / settled | activeHand + legal actions |
| blackjack.hand.settled | Per hand i resolveRound | Resultat + payout-intent |
| round.settled | win / loss / push / mixed | Ledger blackjack.payout |
| roulette.result | Samma spin-transition | Pocket från servern |
| roulette.bet.settled | SETTLE per insats | Ledger roulette.round.settle |

## Mot motorn (s03)

### Hur nära motorn står bilden i dag?

### Visual (snitt Kevin 3.3 · Emil 3.3)

| Dimension | Kevin | Emil |
| --- | --- | --- |
| Linjen (flera takes / event) | 2 | 4 |
| Variant med trigger | 1 | 4 |
| Tyst take | 1 | 3 |
| Trigger utanför spelet | 1 | 2 |
| Landning att ärva | 9 | 6 |
| Fyra dealers | 6 | 1 |

Emil har redan en variant: react_win_big = react_win + trigger insats ≥ 100. Kevins landning är det varianter måste ärva.

### Fakta (snitt Kevin 7.0 · Jakob 7.8)

| Dimension | Kevin | Jakob |
| --- | --- | --- |
| Fakta för spel-triggers | 6 | 8 |
| Marginal / dealer drew synligt | 5 | 7 |
| Payout per hand | 6 | 9 |
| Hash-bar nyckel (shoeDraw) | 9 | 6 |
| Servern fri från take-namn | 9 | 9 |

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.