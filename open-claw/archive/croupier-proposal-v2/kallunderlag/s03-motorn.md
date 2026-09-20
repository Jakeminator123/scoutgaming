# animation-events-v1-s03 · motorn (v2)

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Hur eventmotorn **borde** fungera. Orden är gemensamma för alla sidor: event, linjen, variant, take, trigger.

Ett event. En linje. Noll eller flera varianter. Linjen är standard: några takes som alltid får spelas, och på resultat alltid en tyst. En variant är en gren med eget namn efter sin trigger. Har varianten två takes väljs en. Ingen trigger → linjen.

## Modellen

```
faktum     rng.round.settled · lose
   ↓
event      show.line.lose
   ├─ linjen     lose-a  lose-b  lose-c  tyst
   ├─ variant nära       trigger: skillnad ≤ 1
   ├─ variant dealer-21  trigger: hon drog till 21
   └─ variant otur       trigger: 3 förluster i rad
                         armar: comeback på nästa win
```

Val:

1. Första variant i listan vars trigger är sann, inte på cooldown, inom budget
2. Dealerns benägenhet avgör om varianten faktiskt tas
3. Annars linjen (tyst enligt dealerns tystnad)
4. `hash(shoeDraw, eventIndex)` inom poolen som blev kvar

## Nytt i v2

| # | Nytt | Vad det gör | Varför det känns äkta | Kostnad | Lyft |
| --- | --- | --- | --- | --- | --- |
| 1 | Tyst take i linjen | Resultat-events får en take utan rad, bara gest | Riktiga dealers kommenterar inte varje hand. | 1 gest-take per resultat-event | 9 |
| 2 | Personlighet per dealer | Vera, Astrid, Amira, Mei får egna vikter | Samma events, fyra olika människor. | 0 takes, bara tal | 9 |
| 3 | Eftertrigger (armar) | En variant kan arma en variant på ett senare event | otur i går → comeback i dag. | 0 takes | 8 |
| 4 | Minne som klingar av | otur försvinner efter 2 rundor utan förlust | Människor släpper saker. | 0 takes | 8 |
| 5 | Variantbudget | Max 3 session/chatt/tid-varianter per 10 rundor. Spel alltid ok | För många reaktioner är lika onaturligt som inga. | 0 takes | 8 |
| 6 | Fallback-trappa | variant-take → annan take → linjen → tyst → bara DOM | Aldrig tyst av misstag. Kortet landar alltid. | 0 takes | 9 |
| 7 | Mätbar naturlighet | 20 rundor i rehearsal med krav | Annars är “känns bra” bara en åsikt. | en checklista | 8 |

Deterministiskt:

```
r = hash(shoeDraw, eventIndex) → [0, 1)
variant öppen?   ja om trigger sann, inte cooldown, inom budget
ta varianten?    r < dealer.benägenhet
tyst?            r < dealer.tystnad     (bara linjen, bara resultat)
vilken take?     r * pool.length
```

Acceptans i rehearsal (20 rundor): ingen take två gånger inom 3 rundor · variant-andel 15–30 % · tyst på resultat ≥ 25 % · alla varianter landar inom ±1 frame mot linjen · granskaren kan inte gissa nästa take.

## Idag: Kevin · Jakob

| Lager | Kevin (Croupier) | Jakob (spelsajt) |
| --- | --- | --- |
| faktum | Snapshot via POST /api/table + Partner API | GameEventV2, 16 typer över Socket.IO |
| event | CLIP-nycklar + 17 speech-lines | 24 PresentationCues i planGameEvent |
| linjen | 1 take per line. Bara chatter har 2 | 1 cue → 1 klipp. Persona-video licensblockad |
| tyst take | Talar på varje resultat | Cue på varje resultat |
| variant | Saknas. Astrid dealing-cues avvisad | Saknas |
| trigger: spel | Bara resultatet: win, lose, push, bust | win / loss / push / mixed ur payload |
| trigger: session / minne | Saknas | Saknas |
| trigger: chatt | Ingen chatt in i spelaren | Ingen |
| trigger: tid | Idle-loop finns, inget villkor på tid | wait-decision, inget villkor på tid |
| personlighet | Fyra dealers, samma logik | En dealer |
| urval | Exakt klippnyckel eller hash. Aldrig längd | Deterministiskt per cue |
| landning | landAt + frame-index + kalibrering per take | Cue-duration i klienten |

Emil är utanför tabellen. Han har det närmaste till en linje (wait_decision_a/b) och det enda chattflödet, men inget av det styr klippval idag.

## Trigger → varför

Regeln: dealern reagerar på det spelaren själv känner eller gör, i den storlek det förtjänar, med den fördröjning en människa har.

| Trigger | Källa | Event | Variant | Vad hon gör | Varför | När | Armar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skillnad ≤ 1 (20 mot 21) | spel | show.line.lose | nära | Liten grimas, “oj” | Det är exakt vad spelaren känner. | samma event | — |
| Hon drog själv till 21 | spel | show.line.lose | dealer-21 | Nästan ursäktande | Hon “gjorde” det. | samma event | — |
| Vinst ≥ 3× insats | spel | show.line.win | stor | Mer energi, större gest | Reaktionens storlek ska följa händelsen. | samma event | — |
| 3 förluster i rad | session | show.line.lose | otur | Lägre röst, långsammare | Samma rad fyra gånger är en maskin. | samma event | comeback på nästa win |
| Armad: otur → nästa vinst | session | show.line.win | comeback | “Där satt den” | Hon minns förra rundan. | samma event | — |
| Första besöket | session | show.line.greeting | ny | Välkomnande | Första intrycket. | samma event | — |
| VERSALER från plats B när dealen till X startar | chatt | show.deal.* | ett-ögonblick | Kortet landar. På återvägen lyfter hon handen. | Hon hör bordet men tappar inte korten. | samma event | — |
| Chatt kom in mitt i en take | chatt | think / deal.watch | uppmärksam | Blick mot platsen, liten nick | Människor reagerar med fördröjning. | nästa event | — |
| Någon skriver till henne | chatt | show.line.chatter | svar | Kort svar eller leende | Att bli sedd är poängen med live. | nästa event | — |
| Spam eller otrevligt | chatt | — | ingen | Ingenting. Moderation tar det. | Dealern är inte polis. | — | — |
| Beslut tar > 10 s | tid | show.hand.think | tålmodig | Tittar bort och tillbaka | Ingen stirrar på en som tänker. | samma event | — |
| Efter 23 | tid | greeting / idle / chatter | natt | Lugnare tempo och ton | Ton följer tid på dygnet. | samma event | — |

Krock: en variant per event. Spel före session före chatt före tid. På lose vinner `nära` över `otur`. Otur armar `comeback`.

## Ditt hysch-exempel

Event: kort till spelare X, kort Y. Trigger: VERSALER från plats B under dealen.

**Rätt:** Chatten är spelarens enda bord. Kortet landar ändå. Varianten har ett namn efter triggern. Inget nytt rng-event.

**Ändrat:** Inte “hysch” — pekfinger upp, “ett ögonblick”. Byt bara variant om triggern var sann när dealen startade. Kom versalerna mitt i: gör klart, arma “uppmärksam” på nästa event. Max en gång per spelare och session.

**Kostnad:** En deal-variant är tre nya kalibrerade takes per dealer (vänster/mitten/höger). Därför: “uppmärksam” på think/deal.watch först. Deal-varianten är fas 2.

## Matrisen

Per dealer. Linjen = tal-takes + eventuell tyst take. Prio 1 = det spelaren ser varje runda.

| Event | Enkelt | Linjen | Varianter — trigger | Prio |
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

Samma events och samma takes-lista. Det som skiljer är tre tal.

| Dealer | Tyst på resultat | Tar variant | Tempo | Chatt-svar | Karaktär |
| --- | --- | --- | --- | --- | --- |
| Vera | 30 % | 0.7 | normalt | gärna | Värdinnan. Pratar mest, reagerar ofta. |
| Astrid | 45 % | 0.5 | lugnt | sparsamt | Den lugna. Säger mindre, menar mer. |
| Amira | 25 % | 0.8 | snabbt | gärna | Den snabba. Stora gester, kort väntan. |
| Mei | 40 % | 0.6 | lugnt | sparsamt | Den precisa. Nickar mer än hon talar. |

Samma runda, fjärde förlusten, 20 mot 21, r = 0.62: Astrid tar inte varianten, säger lose-b lågmält. Amira tar `nära` med grimasen. Otur armar comeback.

## Betyg

### Ditt förslag

| Del | Betyg | Så här |
| --- | --- | --- |
| Orden linjen + variant + take | 9 | Linjen säger standard utan att låta som undantag. |
| Variant döpt efter trigger | 9 | Därför blir det inte rng.round.settled.slow.surprised. |
| Chatt som trigger | 8 | Största lyftet. Kolla när eventet startar. Spam får ingen variant. |
| Variant mitt i dealen | 6 | Rätt i teorin, dyrt. Gör uppmärksam på think först. |
| Hysch-gesten | 4 | Behåll mekaniken, byt gesten till ett ögonblick. |
| Två takes per variant | 8 | Rätt storlek. |
| Helheten, v1 | 8 | Modellen är rätt. |

### Motorn v1 → v2

- Naturlighet: **8 → 9**
- Fyra dealers känns olika: **7 → 9**
- Tål fel (fallback): **6 → 9**
- Går att testa: **5 → 8**
- Inspelningskostnad: **7 → 7**
- Chatt-latens: **4 → 6**

## Tio regler

| Regel | Varför |
| --- | --- |
| En variant ärver linjens landning | Kortet landar på samma frame. |
| Fallback-trappa: variant → annan take → linjen → tyst → bara DOM | Aldrig tyst av misstag. Kortet landar alltid. |
| Trigger kollas när eventet startar | Kommer den mitt i: arma nästa event. |
| En variant per event, spel före session före chatt före tid | Hon kan inte vara ledsen och busig samtidigt. |
| Cooldown 3 rundor per take | Tre takes ska kännas som tre. |
| Budget: 3 session/chatt/tid-varianter per 10 rundor | För många reaktioner är lika onaturligt som inga. |
| Otur klingar av efter 2 rundor utan förlust | Människor släpper saker. |
| Dealerns tal styr tystnad och benägenhet, inte nya takes | Fyra personligheter ur ett bibliotek. |
| Aldrig välja efter längd, aldrig mun ovanpå | De två sätt läppsynken redan gått sönder på. |
| Servern skickar fakta, aldrig take-namn | Otur, natt och chatt är motorns sak. |

### Hela valet, i ordning

```
när faktum kommer in:
  event    = familj för faktumet
  signaler = spel + session + chatt + tid
  öppna    = varianter vars trigger är sann, inte cooldown, inom budget
  r        = hash(shoeDraw, eventIndex)
  variant  = första i öppna om r < dealer.benägenhet, annars ingen
  pool     = variantens takes | linjen (tyst om r < dealer.tystnad)
  take     = pool[r * pool.length] utan cooldown-träff, annars nästa i trappan
  arma     = det varianten pekar på
  spela    take på landAt
```
