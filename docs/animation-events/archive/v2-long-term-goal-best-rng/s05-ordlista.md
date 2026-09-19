# animation-events-v1-s05 · ordlistan

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Orden vi kom på tillsammans, på ett ställe. s02 döper events. Den här sidan förklarar allt som ligger under ett event — linjen, variant, trigger, take — och regissörens ord från s04. Ett ord, en betydelse, samma på alla sidor.

|  |  |
| --- | --- |
| **17** | motor-ord |
| **12** | regissörs-ord |
| **9** | ord vi slutat säga |
| **65** | event-namn i s02 |

## Ordkartan

`faktum` → `event` → `trigger (signal · prio)` → `linjen (tyst take · cooldown)` → `variant (budget · armar)` → `regissören (möjlighet · råd · lane)` → `grinden (frysning)` → `take (hash-drag · basval)` → `landning`

> **De fem orden att kunna utantill.** event är luckan. linjen är standard. variant är grenen. trigger öppnar grenen. take är filmen som spelas.

### Ett stycke med alla orden

Servern publicerar ett faktum: rundan är lose. Motorn mappar det till event show.line.lose. Den läser signaler och ser att triggern “3 förluster i rad” är sann, så varianten otur är öppen. Prio säger att nära vinner basvalet. Budgeten har plats, cooldown hindrar inte. Motorn räknar basvalet: nära, lose-nara-a via hash-drag. Regissören får en möjlighet med open[] och läser chatten: “äh, igen…”. Hon svarar med ett råd: otur, lose-otur-b, arma comeback. Grinden säger ja före frysningen. Oavsett vad: landningen är samma.

## Motorns ord

| Ord | Betyder | Exempel | Säg inte |
| --- | --- | --- | --- |
| faktum | Något servern räknat och publicerat. rng.ämne.verb i dåtid. | rng.round.settled | rng-event, game event |
| event | Något dealern ska göra nu. show.ämne.verb. Luckan motorn fyller med en take. | show.line.lose | familj, presentation, cue |
| linjen | Standardpoolen under ett event. Alltid ok. På resultat alltid en tyst take. | lose-a, lose-b, lose-c, tyst | animations-pool, standardpool, default |
| variant | En gren under ett event som en trigger öppnar. Döpt efter triggern. Byter aldrig landning. | variant otur · variant nära | gren, mood (inte) |
| trigger | Det som öppnar en variant. Kollas när eventet startar. Kommer den mitt i: nästa event. | 3 förluster i rad | villkor, regel |
| take | En hel inspelning: text, ljud, video, frame-index. Aldrig mun ovanpå, aldrig vald efter längd. | astrid/lose-otur-a | klipp, clip |
| landning | Ögonblicket kortet ligger på filten. landAt + frame. Det en variant ärver. | landAt · ±1 frame | land, ankare |
| signal | Mätvärde en trigger läser. Spel, session, chatt, tid. Räknas i presentationen. | lossStreak = 4 | räknare |
| prio | Spel före session före chatt före tid. En variant per event. Regissören får välja annorlunda inom open[]. | nära vinner över otur | krockregel |
| armar | En sann trigger sätter upp en variant på ett senare event. Triggern armar, inte taken. | otur armar comeback | eftertrigger, minne |
| tyst take | Take utan rad, bara gest. I linjen på resultat. | lose · tyst | tystnad |
| cooldown | Samma take inte igen inom tre rundor. | lose-b: runda 12 → tidigast 15 | karens |
| budget | Max tre extra-varianter per tio rundor. Spel-triggers alltid ok. | otur + natt + svar = full | kvot |
| benägenhet | Hur ofta en dealer tar en öppnad variant. Ett spann per dealer. | Astrid 0.35–0.65 | vikt |
| tystnad | Hur ofta en dealer är tyst på resultat. Ett spann per dealer. | Astrid 30–60 % | tystnadsgrad |
| fallback-trappan | variant → annan take → linjen → tyst → bara DOM. | lose-otur-a saknas → lose-otur-b … | fallback |
| hash-drag | rV, rT, rK = hash(shoeDraw, eventIndex, domän). Tre separata. Basvalets slump. | rK · pool.length | deterministisk slump |

## Regissörens ord

| Ord | Betyder | Exempel | Säg inte |
| --- | --- | --- | --- |
| regissören | OpenClaw. Läser ton och läge, väljer variant, take, tystnad, arma — inom open[]. Docker på Render. | lane balanserad | hjärnan, agenten, modellen |
| ramar | Vad regissören får (välja inom open[] och spann) och aldrig får (kort, pengar, landning, egna spann). | aldrig-listan | spakar |
| basval | Det motorn väljer utan hjälp: prio + hash. Alltid räknat, alltid loggat, alltid fallback. | nära / lose-nara-a | default |
| open[] | Listan över öppna varianter i en möjlighet: trigger sann, inte cooldown, inom budget. | [nära, otur, linjen] | öppna, tillåtna |
| möjlighet | Serverns fråga till regissören. open[], baseChoice, kontext, spann, deadline. | PresentationOpportunityV2 | opportunity |
| råd | Regissörens svar. variant, take, arm, reason. Eller null = avstå. | DirectorAdviceV2 | advice |
| lane | Vilken OpenClaw-agent som svarar: snabb (chatt), balanserad (regissör), stark (skugga, review). | croupier-fast | agent-id |
| grinden | Kod som säger ja/nej till ett råd. 13 kontroller. | variant_not_open · stale_epoch | gate |
| frysning | Ett val låses när eventet startar. Sent råd byter aldrig film. | frozen = true | freeze |
| skuggläge | Regissören svarar, loggas bredvid basvalet, inget används. Mät innan aktivt. | läge 2 av 4 | shadow mode |
| publiceringsgräns | Det regissören aldrig får se: seed, shoe, hålkort, wallet, andras chatt. | hålkort → dolt tills reveal | sanering |
| textsvar | Regissörens replik i chatten. ≤ 2 meningar, modererat. Aldrig ny röst på filmen. | “Fjärde i rad, jag vet.” | replyText |

> **Två ord som inte är event.** möjlighet och råd är interna API-meddelanden mellan server och regissör. De heter aldrig rng.* eller show.*.

## Grundord

| Ord | Betyder | Säg inte |
| --- | --- | --- |
| dealer | Vera, Astrid, Amira, Mei. Fyra personer, ett bibliotek. | croupier |
| box 0–6 | Platsen vid bordet i Croupier. | seat |
| line | Ett exakt tal-id, inte AI-text. | mening, prompt |
| command | hit, stand, double, split. | action (löst) |
| collect | Pengar bokade. settle = räknat. | settle om pengar |
| fas | dealing → insurance? → decisions → dealer → settled. | phase när du menar idle |
| rehearsal | ?dealer=&rehearsal=1. 20 rundor. Riktiga spelaren. | test, demo |
| baseline | Hash-skydd mot oavsiktliga ändringar. Inte bevis på synk. | godkänd |
| kalibrering | Frame-index och landAt per take. Ny hash ogiltigförklarar den. | sync |

## Säg inte

| Inte | Utan | Varför |
| --- | --- | --- |
| variant 4.2 i event-namn | variant otur under show.line.lose | Variant är en gren med trigger, inte en mapp |
| grundtake / specialtake | linjen / variant | Jakobs ord var enklare |
| hysch | ett ögonblick | Finger mot munnen skäller |
| mood, stämning | variant döpt efter trigger | Spelet vet inte vad förvånad är |
| cue (hos oss) | event | Cue är Jakobs planner-ord i spelsajt |
| clip (hos oss) | take | Clip är Emils filnamn |
| rng.round.settled.slow.surprised | rng.round.settled + variant | Aldrig ett rng-event per känsla |
| filmen som är ungefär så lång | exakt take, hash-drag | Så gick synken sönder |
| AI väljer kortet / AI skriver klippnamn | regissören väljer inom open[] | Grinden avgör, servern äger |

## Betyg

- **9 / 10** — linjen · variant · trigger · take
- **8 / 10** — motorns stödord
- **7 / 10** — regissörens ord
- **9 / 10** — inga ordkrockar kvar
- **6 / 10** — för många ord för Kevin-samtalet

> **Det vi säger till Kevin.** Ett event är en lucka. Linjen är vad hon gör som standard. En variant är en gren en trigger öppnar. En take är filmen. Landningen är helig. Allt annat är detaljer vi kan visa när han frågar.

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.