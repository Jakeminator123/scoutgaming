# animation-events-v1-s03 · motorn

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Hur eventmotorn borde fungera. Ett event. En linje. Noll eller flera varianter. En trigger öppnar. En take spelas. Landningen ärvs.

|  |  |
| --- | --- |
| **36** | events |
| **62 + 6** | linjen: tal + tyst |
| **35** | varianter |
| **39** | takes i varianter |
| **107** | takes / dealer |
| **428** | takes för fyra |

## Modellen

### Ett event. En linje. Noll eller flera varianter.

`faktum (rng.round.settled lose)` → `event (show.line.lose)` → `linjen (3 + tyst)` → `variant otur (trigger: 3 förluster)` → `take (lose-otur-a)` → `landning (samma landAt)`

```
event    show.line.lose
linjen   lose-a  lose-b  lose-c  tyst             alltid ok
variant  nära       lose-nara-a  lose-nara-b     trigger: skillnad <= 1
variant  dealer-21  lose-d21-a                   trigger: hon drog till 21
variant  otur       lose-otur-a  lose-otur-b     trigger: 3 förluster i rad
                                                 armar: comeback på nästa win

basval:  första variant vars trigger är sann, inte på cooldown, inom budget
         → dealerns benägenhet avgör om varianten tas
         → annars linjen (tyst enligt dealerns tystnad)
         → hash-drag inom poolen som blev kvar
regissör (s04): får välja annorlunda inom samma öppna lista
```

| Del | Vad |
| --- | --- |
| Linjen | Standard. Väljs med hash på shoeDraw. Cooldown så a-b-c inte känns som a-a-a. Den tysta taken gör att hon inte kommenterar varje hand. |
| Variant | Byter kropp, röst och min. Byter inte kortets plats eller landning. Går den inte att spela: linjen. Kan arma en variant på ett senare event. |
| Trigger | Något sant just nu: spel, session, chatt eller tid. Kollas när eventet startar. Kommer den mitt i en take gäller den nästa event. |

## Nytt i v2

### Sju saker som gör motorn bättre

| # | Nytt | Vad det gör | Varför det känns äkta | Kostnad | Lyft |
| --- | --- | --- | --- | --- | --- |
| 1 | Tyst take i linjen | Resultat-events får en take utan rad | Dealers kommenterar inte varje hand. | 1 gest-take per resultat-event | 9 |
| 2 | Personlighet per dealer | Vera, Astrid, Amira, Mei: tystnad, benägenhet, tempo | Samma events, fyra olika människor. | 0 takes | 9 |
| 3 | Eftertrigger (armar) | En sann trigger armar en variant på ett senare event | otur i går → comeback i dag. | 0 takes | 8 |
| 4 | Minne som klingar av | otur försvinner efter 2 rundor utan förlust | Människor släpper saker. | 0 takes | 8 |
| 5 | Variantbudget | Max 3 session/chatt/tid-varianter per 10 rundor | För många reaktioner är onaturligt. | 0 takes | 8 |
| 6 | Fallback-trappa | variant → annan take → linjen → tyst → bara DOM | Aldrig tyst av misstag. Kortet landar alltid. | 0 takes | 9 |
| 7 | Mätbar naturlighet | 20 rundor i rehearsal med krav | Annars är “känns bra” bara en åsikt. | en checklista | 8 |

```
rV = hash(shoeDraw, eventIndex, "variant")   tre separata drag (v2.1)
rT = hash(shoeDraw, eventIndex, "tyst")
rK = hash(shoeDraw, eventIndex, "take")

variant öppen?   trigger sann, inte cooldown, inom budget
ta varianten?    rV < dealer.benägenhet
tyst?            rT < dealer.tystnad     (bara linjen, bara resultat)
vilken take?     rK * pool.length
```

> **Acceptans i rehearsal (20 rundor).** Ingen take två gånger inom 3 rundor · variant-andel 15–30 % · tyst på resultat ≥ 25 % · alla varianter landar inom ±1 frame mot linjen · granskaren kan inte gissa nästa take.

## Idag: Kevin · Jakob

| Lager | Kevin (Croupier) | Jakob (spelsajt) |
| --- | --- | --- |
| faktum | POST /api/table + Partner API | GameEventV2, 16 typer |
| event | CLIP + 17 speech-lines | 24 PresentationCues |
| linjen | 1 take per line. Bara chatter har 2 | 1 cue → 1 klipp |
| tyst take | Talar på varje resultat | Cue på varje resultat |
| variant | Saknas. Astrid dealing-cues avvisad | Saknas |
| trigger: spel | Bara resultatet | win/loss/push/mixed ur payload |
| trigger: session / minne | Saknas | Saknas |
| trigger: chatt | Ingen chatt in | Ingen |
| trigger: tid | Idle-loop, inget villkor | wait-decision, inget villkor |
| personlighet | Fyra dealers, samma logik | En dealer |
| urval | Exakt nyckel eller hash. Aldrig längd | Deterministiskt per cue |
| landning | landAt + frame-index + kalibrering | Cue-duration |

Emil är utanför tabellen. Han har det närmaste till en linje (wait_decision_a/b) och det enda chattflödet, men inget av det styr klippval idag.

## Trigger → varför

Regeln: dealern reagerar på det spelaren själv känner eller gör, i den storlek det förtjänar, med den fördröjning en människa har.

| Trigger | Källa | Event | Variant | Vad hon gör | Varför | När | Armar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skillnad ≤ 1 (20 mot 21) | spel | show.line.lose | nära | Liten grimas, “oj” | Det är exakt vad spelaren känner. | samma event | — |
| Hon drog själv till 21 | spel | show.line.lose | dealer-21 | Nästan ursäktande | Hon “gjorde” det. | samma event | — |
| Vinst ≥ 3× insats | spel | show.line.win | stor | Mer energi | Reaktionens storlek ska följa händelsen. | samma event | — |
| 3 förluster i rad | session | show.line.lose | otur | Lägre röst, långsammare | Samma rad fyra gånger är en maskin. | samma event | comeback på nästa win |
| Armad: otur → nästa vinst | session | show.line.win | comeback | “Där satt den” | Hon minns förra rundan. | samma event | — |
| Första besöket | session | show.line.greeting | ny | Välkomnande | Första intrycket. | samma event | — |
| VERSALER från plats B när dealen startar | chatt | show.deal.* | ett-ögonblick | Kortet landar. På återvägen lyfter hon handen. | Hon hör bordet men tappar inte korten. | samma event | — |
| Chatt mitt i en take | chatt | think / deal.watch | uppmärksam | Blick mot platsen, nick | Människor reagerar med fördröjning. | nästa event | — |
| Någon skriver till henne | chatt | show.line.chatter | svar | Kort svar eller leende | Att bli sedd är poängen med live. | nästa event | — |
| Spam eller otrevligt | chatt | — | ingen | Ingenting. Moderation tar det. | Dealern är inte polis. | — | — |
| Beslut tar > 10 s | tid | show.hand.think | tålmodig | Tittar bort och tillbaka | Ingen stirrar på en som tänker. | samma event | — |
| Efter 23 | tid | greeting / idle / chatter | natt | Lugnare tempo och ton | Ton följer tid på dygnet. | samma event | — |

Krock i basvalet: en variant per event. Spel före session före chatt före tid. På lose vinner nära över otur. Otur armar comeback. Regissören (s04) får välja annorlunda inom samma öppna lista.

## Hysch-exemplet

### Någon skriker i chatten medan hon delar

| Rätt | Ändrat |
| --- | --- |
| Chatten är spelarens enda bord. Kortet landar ändå. Varianten har ett namn efter triggern. Inget nytt rng-event. | Inte “hysch” — pekfinger upp, “ett ögonblick”. Byt bara om triggern var sann när dealen startade. Annars arma uppmärksam på nästa event. Max en gång per spelare och session. |

> **Kostnad.** En deal-variant är tre nya kalibrerade takes per dealer (vänster/mitten/höger). Gör “uppmärksam” på think/deal.watch först. Deal-varianten är fas 2.

## Matrisen

Per dealer. Linjen = tal-takes + eventuell tyst take. Prio 1 = det spelaren ser varje runda.

| Event | Enkelt | Linjen | Varianter (takes) — trigger | Prio |
| --- | --- | --- | --- | --- |
| show.line.lose | Huset tog | 3 + tyst | nära (2) — skillnad ≤ 1 · dealer-21 (1) — hon drog själv till 21 · otur (2) — 3 förluster i rad | 1 |
| show.line.win | Spelaren vann | 3 + tyst | stor (2) — vinst ≥ 3× · double (1) — vann på double · comeback (1) — armad av otur | 1 |
| show.line.dealerbust | Hon sprack | 2 + tyst | femkort (1) — 5 kort på hand · efter-otur (1) — armad av otur | 1 |
| show.line.bust | Spelaren sprack | 2 + tyst | otur (1) — sprack på 12–13 | 1 |
| show.line.push | Lika | 2 + tyst | igen (1) — lika två gånger i rad | 2 |
| show.line.blackjack | Spelaren har 21 | 2 | första (1) — första BJ i sessionen | 2 |
| show.line.dealerblackjack | Hon har 21 | 2 | försäkrad (1) — spelaren tog försäkring | 2 |
| show.line.placebets | Satsa | 3 | dröjer (1) — ingen insats på 15 s · tomt (1) — ingen vid bordet | 1 |
| show.line.goodluck | Lycka till | 2 + tyst | storinsats (1) — insats ≥ 10× snitt | 1 |
| show.line.insurance | Försäkring? | 2 | — | 2 |
| show.line.peek | Tittar på hålet | 1 | — | 3 |
| show.line.double | Dubblar | 2 | — | 2 |
| show.line.sidebet | Sidobet träff | 2 | trips (1) — suited trips | 3 |
| show.line.greeting | Hej | 2 | ny (1) — första besöket · namn (1) — återvändare med namn · natt (1) — efter 23 | 1 |
| show.line.farewell | Hejdå | 2 | plus (1) — gick plus · minus (1) — gick minus | 3 |
| show.line.chatter | Småprat | 4 | svar (2) — någon skriver till henne · tröst (1) — otur + tyst bord · natt (1) — efter 23 | 2 |
| show.deal.left | Kort åt vänster | 1 | ett-ögonblick (1) — VERSALER i chatten när dealen startar (fas 2) | 1 |
| show.deal.centre | Kort i mitten | 1 | ett-ögonblick (1) — VERSALER i chatten när dealen startar (fas 2) | 1 |
| show.deal.right | Kort åt höger | 1 | ett-ögonblick (1) — VERSALER i chatten när dealen startar (fas 2) | 1 |
| show.deal.dealer | Kort till sig | 1 | — | 1 |
| show.deal.hole | Hålkort | 1 | — | 1 |
| show.hole.flip | Vänder hålet | 1 | dealer-bj (1) — flippen ger henne 21 | 2 |
| show.hand.think | Väntar på beslut | 2 | tålmodig (1) — beslut > 10 s · uppmärksam (1) — armad av chatt mitt i förra eventet | 1 |
| show.deal.watch | Tittar på deal | 2 | uppmärksam (1) — armad av chatt mitt i förra eventet | 2 |
| show.table.idle | Vänteloop | 3 | natt (1) — efter 23 · tomt (1) — ingen vid bordet | 1 |
| show.hand.nod | Nick vid stand | 1 | gillar (1) — stand på 20–21 | 3 |
| show.react.big | Stor reaktion | 1 | jackpot (1) — sidobet ≥ 100× | 2 |
| show.bets.open | Bets öppna i bild | 1 | — | 3 |
| show.bets.close | Inga fler bets i bild | 1 | — | 3 |
| show.table.clear | Sopar bordet | 1 | — | 2 |
| show.shoe.shuffle | Ny shoe | 1 | — | 3 |
| show.chip.fly | Chip till ruta | 1 | — | 2 |
| show.chip.payout | Chip tillbaka | 1 | — | 3 |
| show.hand.split | Dela hand | 1 | — | 3 |
| show.gest.tilt | Huvudlutning | 2 | — | 3 |
| show.gest.hand | Gest | 2 | — | 3 |

Deal-eventen har en take i linjen med flit. Platsen är DOM och landning, inte en film per box eller kortnummer.

## Fyra dealers

Samma events och samma takes-lista. Det som skiljer är tre spann. Förslag att sätta med inspelningarna, inte facit. Regissören tolkar inom spannet.

| Dealer | Tyst på resultat | Tar variant | Tempo | Chatt-svar | Karaktär |
| --- | --- | --- | --- | --- | --- |
| Vera | 30 % | 0.7 | normalt | gärna | Värdinnan. Pratar mest, reagerar ofta. |
| Astrid | 45 % | 0.5 | lugnt | sparsamt | Den lugna. Säger mindre, menar mer. |
| Amira | 25 % | 0.8 | snabbt | gärna | Den snabba. Stora gester, kort väntan. |
| Mei | 40 % | 0.6 | lugnt | sparsamt | Den precisa. Nickar mer än hon talar. |

Samma runda, fjärde förlusten, 20 mot 21, rV = 0.62: Astrid (0.5) tar inte varianten, säger lose-b lågmält. Amira (0.8) tar nära med grimasen. Otur armar comeback hos båda.

## Betyg

### Jakobs förslag

- **9 / 10** — linjen + variant + take
- **9 / 10** — variant döpt efter trigger
- **8 / 10** — chatt som trigger
- **6 / 10** — variant mitt i dealen
- **4 / 10** — hysch-gesten
- **8 / 10** — helheten, v1

### Motorn v1 → v2

- **8 → 9** — naturlighet
- **7 → 9** — fyra dealers känns olika
- **6 → 9** — tål fel (fallback)
- **5 → 8** — går att testa
- **7 → 7** — inspelningskostnad
- **4 → 6** — chatt-latens

Kvar på minus: 107 takes per dealer att spela in — prio-ordningen är svaret. Chatt-triggern hänger på att chatten når spelaren i tid — en Kevin-fråga, dag 9 i s06.

## Regler

| Regel | Varför |
| --- | --- |
| En variant ärver linjens landning | Kortet landar på samma frame. |
| Fallback-trappa: variant → annan take → linjen → tyst → bara DOM | Aldrig tyst av misstag. |
| Trigger kollas när eventet startar | Kommer den mitt i: arma nästa event. |
| En variant per event, spel före session före chatt före tid | Hon kan inte vara ledsen och busig samtidigt. |
| Cooldown 3 rundor per take | Tre takes ska kännas som tre. |
| Budget: 3 extra-varianter per 10 rundor | För många reaktioner är onaturligt. |
| Otur klingar av efter 2 rundor utan förlust | Människor släpper saker. |
| Triggern armar, inte den spelade taken | Hon minns oturen även om hon var tyst. |
| Dealerns spann styr tystnad och benägenhet, inte nya takes | Fyra personligheter ur ett bibliotek. |
| Aldrig välja efter längd, aldrig mun ovanpå | De två sätt läppsynken redan gått sönder på. |
| Servern skickar fakta, aldrig take-namn | Otur, natt och chatt är motorns sak. |

```
när faktum kommer in:
  event    = familj för faktumet
  signaler = spel + session + chatt + tid
  öppna    = varianter vars trigger är sann, inte cooldown, inom budget
  rV rT rK = hash(shoeDraw, eventIndex, domän)
  basval   = första i öppna om rV < dealer.benägenhet, annars linjen
             (tyst om rT < dealer.tystnad) · take = pool[rK * pool.length]
  råd?     = regissören får välja inom öppna (s04), annars basval
  arma     = allt som sanna triggers pekar på
  spela    take på landAt
```

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.