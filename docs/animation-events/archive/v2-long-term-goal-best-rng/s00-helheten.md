# animation-events-v1 · helheten & slutrapport

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Sju sidor, ett system. s01 säger vad som finns i dag. s02 vad vi kallar det. s03 hur motorn borde fungera. s04 experimentet med OpenClaw som regissör. s05 ordlistan. s06 tio dagar från samtal till beslut.

|  |  |
| --- | --- |
| **3** | repon lästa |
| **65** | facit · 29 rng + 36 show |
| **36** | events i motorn |
| **107** | takes / dealer · 62 tal + 6 tysta + 39 i varianter |
| **0** | nya rng-events |
| **4** | dealers, ett bibliotek |
| **7** | sidor |

## Slutrapport

### Slutrapport, en sida

> **Uppdraget.** Hitta vad som triggar animationer i tre repon — Croupier (Kevin), spelsajt (Jakob), ava-live-blackjack (Emil). Jämföra utan att blanda. Ge oss ett gemensamt språk. Rita hur variation borde fungera. Pröva OpenClaw som hjärna. Betygsätta allt. Lägga en plan.

### Vad vi kom fram till

- Servern säger vad som hände. Motorn bestämmer hur hon visar det. Inget hon känner — otur, natt, någon som skriker i chatten — blir ett nytt rng-event.
- Under varje event: en linje (standard, med en tyst take) och noll eller flera varianter som en trigger öppnar. En take spelas. Landningen ärvs alltid.
- Fyra dealers ur samma bibliotek med tre spann var: tystnad, benägenhet, tempo.
- OpenClaw är regissör: läser tonen i chatten och väljer variant, tystnad och minne — inom det motorn öppnat. Basvalet loggas alltid bredvid. Skuggläge först.
- Tio dagar från Kevin-samtal till beslut: Kevin chef och verifierare, Emil visuellt uttryck, Jakob samordning, repo och OpenClaw.

### Vad som levererades

- s01 kartan · s02 språket (65 namn) · s03 motorn v2.1 · s04 OpenClaw v2 · s05 ordlistan · s06 tio dagar · s00 den här.
- GitLab wiki: alla sju som inofficiella sidor + den interaktiva filen + canvas-källorna.
- Skrivbordet: samma i animation-events-v1/ och animation-events-v1-canvas/.
- Kod i Croupier: ingenting ändrat. Kevin: inte pingad.

### Betygen i en rad

- **6.7 · 6.0** — Visual Kevin · Emil (s01)
- **6.8 · 7.8** — RNG Kevin · Jakob (s01)
- **7 · 8 · 5** — Namnhygien K · J · E (s02)
- **8 → 9** — Motorn v1 → v2 (s03)
- **8 → 9** — OpenClaw v1 → v2 regissör (s04)
- **9 / 10** — Kärnorden (s05)
- **8 / 10** — Tio dagar (s06)

### Beslut som togs på vägen

| Beslut | Valt | Varför |
| --- | --- | --- |
| Referenserna korsar inte | Visual = Kevin + Emil. RNG = Kevin + Jakob. | Två helt olika kontrakt. |
| Ordet variant | Bara motorns ord för en triggad gren. Aldrig i event-namn. | Ordet bar tre betydelser. Nu en. |
| Hysch | Bytt till “ett ögonblick”. | Finger mot munnen skäller på en gäst. |
| Deal-varianten | Fas 2. “Uppmärksam” på think först. | Tre kalibrerade takes per dealer för något sällsynt. |
| Vad som armar | Triggern, inte den spelade taken. | Hon minns oturen även när hon var tyst. |
| Hash-drag | Tre separata: variant, tyst, take. | Annars kopplas valen (paketets fynd). |
| OpenClaw-roll | Regissör: väljer variant efter ton, tystnad, minne, arma — inom open[]. Inte bara take. | Ton kan ingen regel läsa. Basvalet loggas alltid bredvid. |
| OpenClaw-drift | Sajtmaskins Render-setup rakt av: Docker, pinnad version, Standard, tre lanes, SOUL.md per dealer. | Det kör redan. |
| OpenClaw-omfång | Skugga → chatt → regissör. Deal-events och koordinator väntar på C2-mätningen. | Mervärdet ska mätas, inte antas. |
| Otur för riktiga pengar | På i play-money. Av tills produkt sagt ja (D08). | Naturlighet mot ansvar. Jakobs beslut. |

### Vad som är kvar

| Kvar | Vem | Blockerar |
| --- | --- | --- |
| Samtalet med Kevin om s02 som gemensamt språk (dag 1) | Jakob | allt annat |
| C0: verklighetskarta mot det riktiga repot (dag 2) | Kevin | C1 |
| Astrid-takes: vilka finns, är kalibrerade, godkända (dag 2) | Emil | C1 |
| Chatt in i spelaren — latens och kanal (dag 9) | Kevin | C3 |
| D08: förlust-/insatsvarianter i pengaspel | produkt | regissör-läget |

## Kedjan

### Från tre repon till en dealer som känns levande

`s01 kartan (vad finns i dag)` → `s02 språket (65 facit-namn)` → `s03 motorn (linjen · variant · trigger)` → `s04 OpenClaw (regissör med ramar)` → `s05 ordlistan (ett ord, en betydelse)` → `s06 tio dagar (Kevin · Emil · Jakob)` → `Kevin-samtal (dag 1)` → `baseline grön (dag 5)` → `beslut C4 (dag 10)`

> **Den ena meningen.** Servern säger vad som hände. Motorn bestämmer hur hon visar det. Regissören väljer hur, inom ramar. Inget av det hon känner får bli ett nytt rng-event.

## Orden

### Åtta ord, samma på alla sidor

| Ord | Betyder | Exempel |
| --- | --- | --- |
| faktum | Något servern räknat och publicerat. rng.ämne.verb i dåtid. | rng.round.settled |
| event | Något dealern ska göra nu. show.ämne.verb. Luckan motorn fyller med en take. | show.line.lose |
| linjen | Standardpoolen under ett event. Alltid ok. På resultat alltid en tyst take. | lose-a, lose-b, lose-c, tyst |
| variant | En gren under ett event som en trigger öppnar. Döpt efter triggern. Byter aldrig landning. | variant otur · variant nära |
| trigger | Det som öppnar en variant. Kollas när eventet startar. Kommer den mitt i: nästa event. | 3 förluster i rad |
| take | En hel inspelning: text, ljud, video, frame-index. Aldrig mun ovanpå, aldrig vald efter längd. | astrid/lose-otur-a |
| landning | Ögonblicket kortet ligger på filten. landAt + frame. Det en variant ärver. | landAt · ±1 frame |
| regissören | OpenClaw: väljer variant, tystnad, minne inom open[] (s04) | råd → grind → frys |

Hela ordlistan: s05.

## Alla betyg

### Alla betyg på ett ställe

Skala 1–10. Kevin blå, Jakob gul, Emil grön. Lila är det gemensamma. Orange är förslagen.

### Repona (s01, s02)

| Vad | Kevin | Jakob | Emil | Från |
| --- | --- | --- | --- | --- |
| Visual · bild och röst | 6.7 | — | 6.0 | s01 |
| RNG · fakta och pengar | 6.8 | 7.8 | — | s01 |
| Mot motorn · visual | 3.3 | — | 3.3 | s01 |
| Mot motorn · fakta | 7.0 | 7.8 | — | s01 |
| Namnhygien | 7 | 8 | 5 | s02 |

### Förslagen (s02–s06)

- **8 / 10** — facit som språk · s02
- **8 / 10** — Jakobs modell: linjen · variant · chatt
- **4 / 10** — hysch-gesten (bytt)
- **8 → 9** — motorn v1 → v2 · naturlighet
- **7 → 9** — fyra dealers känns olika
- **6 → 9** — tål fel (fallback)
- **5 → 8** — går att testa
- **7 → 7** — inspelningskostnad
- **4 → 6** — chatt-latens · Kevin-fråga
- **8 → 9** — OpenClaw-förslaget v1 → v2 · s04
- **10 / 10** — OpenClaw: gränsen mot spelet
- **6 → 9** — OpenClaw: mervärde som regissör
- **5 → 7** — OpenClaw: komplexitet, sajtmaskin kör redan
- **6 → 7** — OpenClaw: latens med lanes
- **9 / 10** — kärnorden · s05
- **8 / 10** — tio dagar · s06

### Sidorna själva

- **8 / 10** — s01 kartan
- **8 / 10** — s02 språket
- **9 / 10** — s03 motorn
- **9 / 10** — s04 OpenClaw
- **8 / 10** — s05 ordlistan
- **8 / 10** — s06 tio dagar

| Sida | Betyg | Vad som skulle höja det |
| --- | --- | --- |
| s01 | 8 | Emil räknas som 12 klipp fast katalogen har 16. Bra: referenserna korsar inte. |
| s02 | 8 | 36 show-rader blir många. En topp-12 för Kevin-samtalet skulle hjälpa. |
| s03 | 9 | Personlighetstalen är gissningar. Chatt-latensen är benämnd, inte löst. |
| s04 | 9 | Regissörsrollen gör förslaget lika stort som problemet. Kvar: C2-mätningen måste visa att hon väljer annorlunda och bättre. |
| s05 | 8 | Kärnorden klara. Hjärnans ord låter som API. För många ord för ett första samtal. |
| s06 | 8 | Ordningen är rätt och rollerna tydliga. Kvar: dag 3–4 är tunga för Emil om Astrid saknar mer än sex takes. Dag 2 avgör. |

## Kevin · Jakob · Emil

### Var de tre står, och vad vi lånar

|  | Styrka | Lucka | Lånar / roll |
| --- | --- | --- | --- |
| Kevin · Croupier | Landningen. landAt, frame-index, kalibrering. Exakt nyckel eller hash, aldrig längd. Fyra dealers. Live mot riktig shoe. | En take per event. Talar på varje resultat. Inga triggers utanför resultatet. Ingen chatt in. | Produkten. Motorn byggs här. Chef och verifierare i s06. |
| Jakob · spelsajt + sajtmaskin | Fakta-kedjan. GameEventV2, Zod, sequence. Servern skickar aldrig klippnamn. Kör redan OpenClaw i Docker på Render med tre lanes. | Video licensblockad. En dealer. Cue-namn bryter mönstret. | Payload: marginal, dealer drew, payout per hand. Hela Render-setupen. Samordnare i s06. |
| Emil · video-dealer | Clip-kanalen. react_win_big är redan en variant. wait_decision_a/b är en linje. Enda med chatt. | Ingen namnregel. deal_pos1–7 aldrig kopplade. Europeisk deal. | nod_confirm, bets_open, clear_table, variant-tänket. Inte motorn. Takes och landning i s06. |

## Status & nästa

### Status och nästa steg

| Vad | Var | Status |
| --- | --- | --- |
| s00–s06 som wiki-sidor | GitLab wiki · animation-events-v1-s00 … s06 | uppe, märkta inofficiella |
| Interaktiv fil | wiki: animation-events-v1/index.html · Desktop | sju sidor, nav och flikar |
| Canvas-källor | wiki: animation-events-v1/canvas/ · Desktop | sju .canvas.tsx |
| OpenClaw-paketet + sajtmaskin/infra | random-stuff-jakob · Jakeminator123/sajtmaskin | lästa, omformade till s04 v2 |
| Kevin | Jakob tar samtalet själv — dag 1 i s06 | ingen ping förrän Jakob säger till |
| Kod | jakeminator123/work | ingenting ändrat |

### Om Kevin säger ja — i den här ordningen (dag för dag i s06)

| Steg | Vad | Varför först |
| --- | --- | --- |
| 0 | C0: läs det riktiga repot, hitta player, kalibrering, publiceringsgräns | Så att s01–s03 blir verklighet. |
| 1 | s02 blir det gemensamma språket | Kostar noll. |
| 2 | C1: linjen för lose och win på Astrid: 3 tal + 1 tyst, cooldown 3, tre hash-drag | Det spelaren ser varje runda. Ingen AI. |
| 3 | Rehearsal 20 rundor med acceptanskraven | Så att “känns bra” blir mätbart. |
| 4 | Variant nära och otur på lose, comeback armad på win | Första triggern och första minnet. |
| 5 | Spann för alla fyra dealers | Noll takes. |
| 6 | C2: OpenClaw i skuggläge på Render, sajtmaskins setup | Mät avvikelse, vinst, latens per lane. |
| 7 | C3: chatt in → textsvar + uppmärksam på think | Här börjar regissörens verkliga mervärde. |
| 8 | C4 regissör-läget · deal-varianter · fler dealers | Bara om dag 8 visade att det tillför. |

> **Vad som inte får hända.** Ingen take efter längd. Ingen mun ovanpå. Ingen variant utan att linjens landning ärvs. Ingen ny rng-typ för en stämning. Ingen ändring i baseline utan granskad take. Ingen modell mellan servern och kortet.

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.