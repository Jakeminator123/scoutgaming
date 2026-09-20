# animation-events-v1-s00 · helheten

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Tre sidor, ett system. **s01** säger vad som finns i dag. **s02** säger vad vi kallar det. **s03** säger hur det borde fungera.

| | |
| --- | --- |
| Repon lästa | 3 |
| Facit-namn | 64 · 29 rng + 35 show |
| Events i motorn | 35 |
| Takes per dealer | 106 · 61 tal + 6 tysta + 39 i varianter |
| Nya rng-events | 0 |
| Dealers ur ett bibliotek | 4 |

## Kedjan

`s01 kartan` → `s02 språket` → `s03 motorn` → Kevin-samtal (Jakob tar det själv) → accepterat? → första skivan: linjen för lose/win på Astrid (3 + tyst, cooldown, hash)

**Den ena meningen:** Servern säger vad som hände. Motorn bestämmer hur hon visar det. Inget av det hon känner — otur, natt, någon som skriker i chatten — får bli ett nytt rng-event.

## Sju ord, samma på alla sidor

| Ord | Betyder | Exempel |
| --- | --- | --- |
| faktum | rng.* — något servern räknat | rng.round.settled |
| event | show.* — något dealern ska göra | show.line.lose |
| linjen | standard-takes under ett event, en tyst | lose-a, lose-b, lose-c, tyst |
| variant | triggad gren under ett event, döpt efter triggern | otur, nära, ett-ögonblick |
| trigger | det som öppnar en variant: spel, session, chatt, tid | 3 förluster i rad |
| take | en hel inspelning: text, ljud, video, frames | astrid/lose-otur-a |
| landning | samma kort, samma ruta, samma frame — det en variant ärver | landAt |

### Tre ord vi slutade säga

| Inte | Utan | Varför |
| --- | --- | --- |
| variant 4.2 (som eventnamn) | variant otur, under show.line.lose | Variant är en gren med trigger, inte en mapp och inte ett event |
| grundtake / specialtake | linjen / variant | Jakobs ord var enklare |
| hysch | ett ögonblick | Finger mot munnen skäller. Pekfinger upp ber om en sekund |

## Alla betyg

Skala 1–10. Kevin blå / Jakob gul / Emil grön / lila = gemensamt.

### Repona (s01, s02)

| Vad | Kevin | Jakob | Emil | Från |
| --- | --- | --- | --- | --- |
| Visual · bild och röst | 6.7 | — | 6.0 | s01 |
| RNG · fakta och pengar | 6.8 | 7.8 | — | s01 |
| Mot motorn · visual | 3.3 | — | 3.3 | s01 |
| Mot motorn · fakta | 7.0 | 7.8 | — | s01 |
| Namnhygien | 7 | 8 | 5 | s02 |

### Förslagen

- Facit som språk · s02: **8 / 10**
- Jakobs modell: linjen · variant · chatt: **8 / 10**
- Hysch-gesten (bytt): **4 / 10**
- Motorn v1 → v2 · naturlighet: **8 → 9**
- Fyra dealers känns olika: **7 → 9**
- Chatt-latens · Kevin-fråga: **4 → 6**

### Sidorna själva

| Sida | Betyg | Vad som skulle höja det |
| --- | --- | --- |
| s01 kartan | 8 | Emil räknas som 12 klipp fast katalogen har 16. Jakobs 3D-lab och Persona står som noll utan att förklaras. Bra: referenserna korsar inte. |
| s02 språket | 8 | 35 show-rader blir många när linjen och varianter läggs under. En kortare topp 12 för Kevin-samtalet skulle hjälpa. |
| s03 motorn | 9 | Personlighetstalen är gissningar tills inspelningarna finns. Chatt-latensen är benämnd, inte löst. |

## Kevin · Jakob · Emil

### Kevin · Croupier (produkten)

- **Styrka:** Landningen. landAt, frame-index, kalibrering per take. Exakt klippnyckel eller hash, aldrig längd. Fyra dealers. Live mot riktig shoe.
- **Lucka:** En take per event. Talar på varje resultat. Inga triggers utanför resultatet. Ingen chatt in i spelaren.
- Motorn byggs här. Referenserna får bara inspirera sin sida.

### Jakob · spelsajt

- **Styrka:** Fakta-kedjan. command → GameEventV2, Zod, sequence. hand.settled med payout. Servern skickar aldrig klippnamn.
- **Lucka:** Video licensblockad. En dealer. Cue-namn bryter mönstret.
- **Lånar:** Payload-rikedomen som spel-triggers behöver: marginal, dealer drew, payout per hand.

### Emil · video-dealer

- **Styrka:** Clip-kanalen. react_win_big är redan en variant med trigger. wait_decision_a/b är redan en linje. Enda med chatt.
- **Lucka:** Ingen namnregel. deal_pos1–7 aldrig kopplade. Idle utan namn på wiren. Europeisk deal, inget hål.
- **Lånar:** nod_confirm, bets_open, clear_table och variant-tänket i react_win_big. Inte motorn.

## Status och nästa steg

| Vad | Var | Status |
| --- | --- | --- |
| s01, s02 som wiki-sidor | GitLab wiki | uppe, märkta inofficiella |
| s03 motorn | lokal canvas + den här mappen | inte på wikin ännu |
| s00 helheten | lokal canvas + den här mappen | inte på wikin ännu |
| Kevin | Jakob tar samtalet själv | ingen ping förrän Jakob säger till |
| Kod | jakeminator123/work | ingenting ändrat |

### Om Kevin säger ja — i den här ordningen

| Steg | Vad | Varför först |
| --- | --- | --- |
| 1 | s02 blir det gemensamma språket i wiki och handoff | Kostar noll. |
| 2 | Linjen för show.line.lose och show.line.win på Astrid: 3 tal + 1 tyst, cooldown 3, hash på shoeDraw | Det spelaren ser varje runda. Fyra nya takes, ingen ny logik i servern. |
| 3 | Rehearsal 20 rundor med acceptanskraven från s03 | Så att “känns bra” blir mätbart. |
| 4 | Variant nära och otur på lose, comeback armad på win | Första varianten med trigger och första minnet. Fem takes. |
| 5 | Personlighetstal för alla fyra | Noll takes. Fyra dealers ur ett bibliotek. |
| 6 | Chatt in i spelaren → uppmärksam på think | Kevin-fråga om latens. Deal-varianten är fas 2. |

**Vad som inte får hända:** Ingen take efter längd. Ingen mun ovanpå. Ingen variant utan att linjens landning ärvs. Ingen ny rng-typ för en stämning. Ingen ändring i baseline utan granskad take.
