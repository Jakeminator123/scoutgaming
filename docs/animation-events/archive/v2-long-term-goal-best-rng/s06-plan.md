# animation-events-v1-s06 · tio dagar

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Från Kevin-samtal till beslut om regissören, på tio arbetsdagar. Kevin är chef och verifierare: inget går vidare utan hans grönt. Emil äger det visuella uttrycket. Jakob samordnar, håller repo och OpenClaw.

|  |  |
| --- | --- |
| **10** | arbetsdagar |
| **4** | milstolpar |
| **C0 → C3** | skivor som ingår |
| **11** | takes Emil klipper |
| **1** | dealer: Astrid |
| **0** | rader kod i servern som rör spelet |

## Dag för dag

`Dag 1 (Kick-off ★)` → `Dag 2 (Karta)` → `Dag 3 (Bygg)` → `Dag 4 (Bygg)` → `Dag 5 (Rehearsal ★)` → `Dag 6 (Varianter)` → `Dag 7 (Skugga)` → `Dag 8 (Mätning ★)` → `Dag 9 (Chatt)` → `Dag 10 (Beslut ★)`

| Dag | Skiva | Kevin · chef & verifierare | Emil · visuellt uttryck | Jakob · samordning, repo, OpenClaw |
| --- | --- | --- | --- | --- |
| 1 · Kick-off | — | Läser s00 + s05 (fem ord). Ja/nej på s02 som gemensamt språk. Veto på s03-modellen. | Läser s03 + s05. Listar vilka Astrid-takes som finns och vad han kan klippa eller spela in. | Håller Kevin-samtalet. Skriver in beslutet i wiki. |
| 2 · Karta | C0 | Hittar player, kalibrering och publiceringsgräns i riktiga repot. Listar skillnader mot s01. | Inventerar Astrid: vilka takes är kalibrerade, vilka saknar landAt. | Sätter branch, mappstruktur, handoff-mall. |
| 3 · Bygg | C1 | Linjen för show.line.lose och win: 3 tal + tyst, cooldown 3, tre hash-drag. Ingen AI. | Klipper saknade takes: lose-b, lose-c, win-b, win-c, tyst ×2. Hela takes. Kalibrerar landAt. | Skriver acceptanskriterierna som rehearsal-check. |
| 4 · Bygg | C1 | Fallback-trappan. Loggar basval. | Fortsätter takes. Frame-kontroll ±1 mot linjen. | Kopplar Emils takes in i index — staging, inte live. |
| 5 · Rehearsal | C1 | Verifierar 20 rundor: ingen upprepning inom 3, tyst ≥ 25 %, ±1 frame. Grönt eller tillbaka. | Fixar det Kevin stryker. | Dokumenterar resultat i handoff. |
| 6 · Varianter | C1+ | Trigger-tabellen och armar i motorn. Personlighetstal som konfiguration. | 5 takes: nära ×2, otur ×2 på lose. comeback ×1 på win. | Sätter spann för Vera, Astrid, Amira, Mei tillsammans med Kevin. |
| 7 · Skugga | C2 | Grinden: 13 kontroller i repots språk. Tester C01–C04, C07. | Granskar variant-takes mot landning. | Klonar sajtmaskins Render-setup: tre lanes, SOUL.md Astrid, möjlighet/råd v2, logg bredvid basval. |
| 8 · Mätning | C2 | Kör 200 rundor i skugga. Blindgranskare 1: bas eller regi? | Blindgranskare 2. | Sammanställer: avvikelse, vinst, latens per lane. |
| 9 · Chatt | C3 | Chatt in i spelaren: kanal och latens. Moderation. | Uppmärksam-take på show.hand.think. | Textsvar på lane snabb. Uppmärksam armad från chatt. |
| 10 · Beslut | — | Go/no-go på regissör-läget utifrån dag 8. Godkänner handoff. | Backlog: fler dealers, deal-varianter. | Uppdaterar s00–s06, wiki, handoff. Stänger. |

Blå rad = milstolpe (★). Grön = baseline utan AI. Gul = skuggläge. Allt som rör OpenClaw ligger hos Jakob; allt som rör kalibrering och landning hos Emil; allt som rör motorn och verifiering hos Kevin.

> **Förslag, inte åtagande.** Dagarna är ordningen, inte kalendern. Går dag 5 rött tar allt efter ett steg bakåt. Ingen ping till Kevin från agenter — Jakob pratar själv.

## Rollerna

|  | Kevin · chef & verifierare | Emil · visuellt uttryck | Jakob · samordning, repo, OpenClaw |
| --- | --- | --- | --- |
| Äger | Motorn och repot. Bygger linjen, triggers, grinden. Verifierar allt Emil levererar mot landning och allt Jakob levererar mot determinism. | Takes. Klipper, kalibrerar landAt, kontrollerar ±1 frame. Inventerar Astrid. Blindgranskare dag 8. | Samtalet med Kevin, wiki, handoff. OpenClaw-sidan: Render från sajtmaskin, lanes, SOUL.md, möjlighet/råd, logg. Mätningen. |
| Levererar | Ja/nej: språket (dag 1), baseline (dag 5), regissör-läget (dag 10). | Sex linje-takes (dag 3–4). Fem variant-takes (dag 6). En uppmärksam-take (dag 9). | Accept (dag 1). Skuggläge (dag 7). Mätrapport (dag 8). Chatt-lane (dag 9). Uppdaterade sidor (dag 10). |
| Rör inte | Render, OpenClaw-config, SOUL.md. | Motorn, live-index, servern. Allt via staging till Kevin. | Motorns urval, kalibrering, main-branchen. |

> **Överlämningar.** Emil → Kevin: takes i staging med landAt-siffror. Jakob → Kevin: grind-tester och skugglogg. Kevin → alla: grönt eller rött med en rad varför. Inga överlämningar via chatt-historik; allt i handoff.

## Milstolparna

| Dag | Milstolpe | Bevis | Om det går rött |
| --- | --- | --- | --- |
| 1 | Språket accepterat | Kevin säger ja till s02 som gemensamt språk. Antecknat i wiki. | Stanna. Ingen kod förrän orden är gemensamma. |
| 5 | Baseline grön utan AI | 20 rundor: ingen take två gånger inom 3, tyst ≥ 25 %, alla ±1 frame. Kevin har sett det själv. | Dag 6–7 skjuts. Emil fixar takes, Kevin fixar motorn. |
| 8 | Regissörens mervärde mätt | 200 rundor i skugga. Avvikelse från basval i %, blindgranskning av två, latens per lane. | Regissör-läget stryks eller skalas ner till chatt-läget. Allt annat står. |
| 10 | Beslut om C4 | Kevin: go/no-go på regissör-läget. Handoff godkänd. s00–s06 uppdaterade. | Beslutet är ett beslut även om det är nej. |

Sant efter dag 10 oavsett beslut: Astrid har en linje med tre tal och en tyst take på lose och win. Fem varianter med triggers. Fyra dealers med spann. Cooldown, budget, fallback-trappa. Ett skuggläge som kan slås på igen när som helst. Ett gemensamt språk. Allt utan att en enda rad i servern som rör spelet har ändrats.

## Ingår inte

| Utanför | Varför | När |
| --- | --- | --- |
| Deal-varianten “ett ögonblick” | Tre kalibrerade takes per riktning för något sällsynt. | Fas 2, efter dag 10 |
| Koordinator för delat bord | Personlig dealer i demon. | När produkten kräver det |
| Fler dealers än Astrid | Bibliotek först, personer sedan. Spannen gör dem olika redan nu. | Efter beslut dag 10 |
| Regissör-läget live | Kräver dag 8-mätningen och Kevins go. | C4, efter dag 10 |
| Pengaspel | D08. | Separat beslut |
| Kevin-ping från agenter | Jakob pratar själv. Alltid. | Aldrig |

> **Regler som gäller alla tio dagarna.** Inget i baseline ändras utan Kevins granskning. Ingen take väljs efter längd. Ingen mun ovanpå. Servern skickar aldrig take-namn. Ingen variant utan sann trigger. Landningen ärvs.

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.