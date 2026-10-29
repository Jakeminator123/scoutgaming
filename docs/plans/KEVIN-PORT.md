# Kevins och Emils presentationsförbättringar: selektiv överföring

Plan för punkt 8 i masterplanens [Efter O03](../../migrering/MASTERPLAN.md#efter-o03), skriven 28 oktober 2026 mot `origin/main` 74fdb27f. Utfört: P-E ([#541](https://github.com/Jakeminator123/scoutgaming/pull/541)), P-C ([#547](https://github.com/Jakeminator123/scoutgaming/pull/547)) och K10 (tangenterna, se tabellen). Varje PR i ordningen nedan är en vanlig PR med grön CI och provas i preview när orkestratorn bedömer att det behövs.

**Regel ([AGENTS](../../AGENTS.md)):** Kevins grenar (`kevin`, `kevin-staging`, `kevin*`, `codex/kevin-*`) rörs aldrig. Vi läser dem med `git fetch`, `git log`, `git show` och `git diff`. Ett bra beteende skrivs om i mains egna moduler. Vi kopierar inga filer och gör inga merge eller cherry-picks.

**Underlag:** `origin/kevin` de31659c och `origin/kevin-staging` 715fdfd8 (båda 28 oktober). Hela Kevins app ligger under `kevin/croupier-scoutgg/`, som nedan förkortas `K/`. Planen bygger vidare på portplanen P1–P14 från jämförelsen main mot kevin-staging (28 oktober, underlaget ligger utanför Git). Bordets layout-PR [#536](https://github.com/Jakeminator123/scoutgaming/pull/536) (F12–F16, utkast) dubbleras inte.

## Läget för P1–P14

| P | Beteende | Läge i main |
| --- | --- | --- |
| P1 | Återanslutning | Klar (#502) |
| P2 | Vilan startas inte om vid varje snapshot | Klar (#502) |
| P3 | `decide`-fas | Klar (#502, `shared-room-presentation.mjs:43-44`) |
| P4 | Närvaro från anslutningen | Klar (#503) |
| P5 | Nedräkning för insats och beslut | Öppen, går in i **P-B** |
| P6 | Ett tryck ger både plats och insats | Öppen, går in i **P-B** |
| P7 | Automatisk plats via spelbordets länk, "Bjud in" | Öppen. **Jakobs beslut** (gäståtkomst, nivå 3 i målbilden) |
| P8 | Vinstbesked per plats | Öppen, går in i **P-B** |
| P9 | Förladdning i insatsfönstret | Öppen. Görs efter låsfixen (skalningstestet, punkt 9) |
| P10 | `turnAt` vid kortets landning | Öppen. Hör ihop med tempot (K7) |
| P11 | Fullt bord: högst 3 platser när någon väntar | Klar i **P-C** (#547) |
| P12 | Serverkedja för vilan, lika för alla tittare | Öppen. **Jakobs beslut** (koppla in `room-idle.mjs` eller radera den) |
| P13 | Desktoplayout | Öppen. **Jakobs beslut.** Emils desktopbord (`adccb313`, `b50a3de4`, `c0f3838f`, `4adc3c63`) räknas hit |
| P14 | Tyst tick | Öppen. Hör till skalningstestet (punkt 9) |

## Kandidater

Här står bara sådant som är bättre än main. "Beslut" betyder att Jakob måste avgöra innan PR:n byggs.

| # | Beteende | Hos Kevin/Emil | Motsvarighet i main | Värde för spelaren | Risk | Storlek | Beroende | Beslut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | **Kodek väljs per besök** (AV1, HEVC eller H.264) efter hårdvaruavkodning (`mediaCapabilities.decodingInfo`, `powerEfficient`). Valet får högst 400 ms, sedan H.264. Avkodningsfel ger H.264 resten av besöket | `kevin-staging:K/public/clip-format.js:11-55`, `K/public/app.js:71,301,332` (af80e223, 87d1291f) | `services/game/public/verified-video-buffer.mjs` (hämtning, LRU), `local-film-player.mjs`, registret (`packages/studio-registry/server/storage-contract.mjs`), frysningen i `packages/presentation/server/` | AV1 är cirka 7 % och HEVC cirka 11 % av originalets bytes, så klippen startar snabbare på mobil och Blob-trafiken minskar | Varje variant behöver egen identitet (UUID och SHA-256) bunden till originalet. Bildrutor, fps och antal rutor måste vara identiska, annars hamnar kortspår och landningar fel. Inspelat tal v2 mäts per fil. Rörligt tal läser bara AVC-originalet (`moving-speech-source-frames.mjs`) | L | Registret, frysningen, kodning i Admin | **Ja**: lagring, kodningskedja och om en variant kräver nytt AV-godkännande |
| K2 | **Fasstyrd kontrollyta på mobil.** Rubriken följer fasen ("Lägg insatser", "Din tur · plats 4"), och statusraden visar saldo, insats och senaste vinst | `kevin:K/public/redesign.js:77-104` (e22bd1ee) | `shared-room-view.mjs` (statusraden `banner` i `render`: "Din tur", "Rundan pågår") och #536:s `#shared-room-actions` | Spelaren ser direkt vad som väntas av henne | Låg om det ligger ovanpå #536. Krockar om det byggs före | M | #536 mergad | Nej |
| K3 | **Tydligare resultatyta.** Ett nettobelopp och "1 plats vann · 1 över 21 · dealern 19" visas över bordet, först när dealerns sista kort ligger öppet och hennes klipp är klara. En förlust visas lugnt, och bara en vinst får markering | `kevin:K/public/redesign.js:120-170` | `shared-room-view.mjs:224` (bara `last-win` som summa). Tidsdelen finns redan, se nedan | Man ser vad som hände per plats (P8) | Låg | S–M | #536 | Nej |
| K4 | **Nedräkning** i insats- och beslutsfönstret, markerad som brådskande vid 5 s eller mindre (P5) | `K/public/shared-table.js:259-276`. Kevins `round-clock.js` (prov `test/round-clock.test.mjs:4,11`) pausar klockan i klienten, vilket inte tas | `shared-room-controller.mjs` (`schedule` ritar om vid snapshotens `deadline` och `actionDeadline`) | Ingen tyst autostand efter 15 s | Låg. Visningen läser bara serverns tider och har ingen egen klocka | S | #536 | Nej |
| K5 | **Chatten flyttad på mobil.** Chattikonen sitter uppe med de andra knapparna, och de tre senaste raderna svävar över bilden | `kevin:K/public/redesign.js:42-45,172-221` | Vid delat bord är chatten dold i dag (`shared-room-view.mjs`, raden som döljer `chat` bland de nativa ytorna) | Dealern känns levande vid bordet | Vem dealern svarar vid ett bord med sju spelare, moderering och kostnad | M | Talkedjan (T3, T5) | **Ja**: ska det delade bordet ha chatt? |
| K6 | **Fullt bord och väntande tittare.** En tittare utan plats vid fullt bord registreras som väntande i 30 s, och då behåller varje spelare högst 3 platser efter rundan, de som spelades först (P11). En spelare som varken satsar eller agerar på 90 s i insatsfönstret släpper sina platser | `kevin-staging:K/server/shared-table.mjs:45-47,283-292,489` (7ddb7de4), prov `K/test/ghost-seats.test.mjs:19,36,61` | Byggd i P-C (#547): `FULL_TABLE`, kommandot `wait` och ticken `seat.idle` i `games/blackjack/table/coordinator.mjs`, klienten i `public/shared-room-waiting.mjs` | Ett fullt bord låser inte ute nya spelare | Medel. Låsplanen (`endingAtReset`) måste ta med 3-gränsen, annars `LockSetExceeded`. Väntandet måste vara ett idempotent kommando, eftersom kanalen bara läser | M | Inget öppet (F11 mergad, #529) | Nej, men Jakob kan justera 3, 30 s och 90 s |
| K7 | **Tempo per spelbord** (1×, 1,5×, 2×, 2,5×). Utdelningstagningarna spelas med `playbackRate`, motorns tider skalas, en sen tagning tas igen en gång, och en hit startar 0,8 s efter knappen | `kevin-staging:K/server/studio-tables.mjs:36-37,56-57,72-73`, `K/server/shared-table.mjs:134-153,241-245`, prov `K/test/table-tempo.test.mjs` (87d1291f, 86892006, 3be63841) | `coordinator.mjs:130-133` (`leadMs + draws·cardMs`), `local-film-player.mjs:159` (`playbackRate` finns), `filmed-deal-timeline.mjs` | Snabbare rundor för vana spelare | Filmad dealer i 2,5× kan se onaturlig ut. Läppsynken måste följa tempot (Emils 976b264d, 6dc38414, 883cc9ae lånar munlappar vid 2×), och main kräver exakt munlapp per ruta | M–L | P10, talkedjan T3 | **Ja**: produktval, och om tempot är en spelinställning |
| K8 | **Underhållsbesked från drifthälsan.** Spelaren ser ett meddelande när läppsynken inte levererar, och det försvinner när allt är grönt igen | `kevin:K/server/runpod-notice.mjs:1-76`, `K/public/maintenance-notice.js`, prov `K/test/runpod-notice.test.mjs` (de31659c) | `services/game/moving-drift-observer.mjs` (arbetarnas läge), `public/app.mjs:1705` (`setMovingSpeechAvailable` döljer bara knapparna) | Spelaren förstår varför dealern tystnar, i stället för att undra | Låg. Texten får inte lova något, och RunPod-saldot är ett driftlarm, inte spelartext | S–M | T3 (driftprofil per dealer), tal vid delat bord | **Ja**: om spelaren ska se texten, och hur den lyder |
| K9 | **Fast tabell för sidobetten** (Perfect Pairs, 21+3, ingen stege runt K-A-2) som komplement till fuzz-oraklet | `K/test/sidebet-payouts.test.mjs:5-17` | `games/blackjack/round.mjs:8-9,34-55`, `test/fuzz-blackjack.mjs:151-182` | Indirekt: utbetalningarna låses mot oavsiktliga ändringar | Ingen | S | Inget | Nej |
| K10 | **Klar. Tangenter H/S/D/P** när en beslutsknapp har fokus. Kevin lyssnade på hela sidan; det tas inte (se nedan och [beslutet](#k10-tangenterna-hsdp)) | `kevin:K/public/redesign.js:276-283` | `shared-room-shortcuts.mjs`, prov `test/shared-room-shortcuts.mjs` och `test/shared-room-shortcuts-browser.mjs` (bygger på utkastet #550) | Snabbare på dator | Låg | S | Inget | Nej |

### Redan bättre i main, tas inte

- **Munlapp bunden till bildrutan.** Emil tar munnen för den ruta som faktiskt ritas, med `VideoFrame` av videoelementet (`K/public/dealer-layer.js:214-259`, 715fdfd8). Main gör det striktare. Rörligt tal avkodar kroppens rutor ur originalets exakta MP4, och PCM-klockan adresserar varje ruta (`packages/presentation/runtime/moving-speech-source-frames.mjs`). Varje munlapp måste ha rätt tagning, ruta och rektangel, annars avvisas den (`moving-speech-frame-layer.mjs:112-115`). Main har ingen fristående munklocka (`generated-speech-player.mjs:87`). Att generalisera per dealer är talkedjans T3 och T6, inte den här planen.
- **Mjuk summa (7/17):** finns redan (`card-presentation/renderer-support.js:20-24`, prov `test/local-card-overlay.mjs:89`).
- **Osatsade platser släpps efter rundan:** finns (`coordinator.mjs`, `startRound` och `unplayed`).
- **Nästa runda väntar på planens slut:** finns (`controller.mjs:70`).
- **Resultatet syns efter korten** (K3:s tidsdel): finns. Spelmotorn avräknar först vid planens `endAt` (ticken `round.settle`, `coordinator.mjs:593,696`), och klienten spelar en presentation i taget (`shared-room-client.mjs`), så den avräknade ögonblicksbilden når vyn först när rundans kort ligger. Kevins vy behövde vänta på "inget dolt kort" och 700 ms eftersom hans server avräknade direkt. Utkastet #550 spärrade dessutom resultatet medan den lokala presentationen spelade. Efter avräkningen spelas bara insamlingens `placebets`, så spärren hade dolt vinsten och Nästa runda bakom fel replik och visat "Rundan pågår" för en avslutad runda. Den togs inte.

### Tas inte

- SQLite i alla former: Kevins delade bord (`K/server/shared-table.mjs:2`) och dealerminnet (`K/server/dealer-memory.mjs`). Main har en väg, Postgres.
- Media i Git: `kevin-staging` har 2 777 filer under `K/public/media/`, och af80e223 ensam lade till 942. Main har registret och privat Blob.
- Egen drift med Caddy och systemd (`K/drift/*.caddy`, `K/drift/*.service`). Main kör på Render och Vercel.
- Gemini-chatten (`K/server/llm.mjs`, `dealer-chat.mjs`, `astrid.mjs`) utanför mains assistent och talkedja.
- Astrid-specifik kod: `clip-format.js` hårdkodar `astrid2`, och `lapprutor.json`, Astrid 2.0:s formatmappar och `CROUPIER_ASTRID_*` följer samma mönster. Astrid tas bort helt ([REN-START](REN-START.md)).
- Gästidentitet via cookie per rum, HTTP-poll var 700 ms, `LOCAL_BO_USER` och den lokala klippgranskningen (`studio/klipp.html`, `verktyg/kandidat-manifest.mjs`). Main har konton, WebSocket och Admin.
- Kevins val av vilor (Paow) är materialval som görs i Admin, inte kod.
- Klientägd beslutsklocka som pausar för klipp och dold flik (`round-clock.js`). Tiderna ägs av spelmotorn.
- Tangenterna H/S/D/P och R (`redesign.js:140,276-283`) på hela sidan. En bokstav utan fokus i beslutspanelen får inte dubbla eller splitta en insats, och WCAG 2.1.4 kräver att en enbokstavsgenväg kan stängas av, ändras eller bara gäller med fokus. Main tar det sista.

### K10: tangenterna H/S/D/P

Beslut (PR #556, buggranskningen): beslutspanelen `#actions-top` är en sammansatt kontroll. Med fokus på vilken som helst av dess knappar gäller alla fyra tangenterna, också D och P som flyttar pengar. Alternativet, att D och P bara gäller med fokus på Double respektive Split, togs inte: då säger D inte mer än Enter, och spelaren hade fått tabba till rätt knapp före varje beslut, vilket är det tangenterna ska bespara henne. Risken är begränsad: panelen finns bara under spelarens egen tur, kontrollern prövar varje drags laglighet igen och spelmotorn avvisar ett otillåtet drag. Den skrivna bokstaven avgör; en layout utan latinska bokstäver faller tillbaka på den fysiska tangenten. `aria-keyshortcuts` behålls (se [runtimeguiden](../LOCAL-PRESENTATION-RUNTIME.md)).

## PR-ordning

Ordningen gäller tills Jakob ändrar den. Kod byggs av en underagent på `jakob/claude-*`, med review före merge. Felande prov skrivs först.

### P-E. Regelprov för sidobetten (K9)

- **Filer:** ett nytt prov `test/blackjack-sidebets.mjs`, registrerat bredvid `fuzz-blackjack` i sviten `gameplay` i `.githooks/pre-commit-full`.
- **Prov:** fasta fall med förväntad total utbetalning inklusive vinnande insats, mot `games/blackjack/round.mjs`.
- **Preview:** behövs inte.
- Kan gå först. Det är billigt och ändrar ingen kod.

### P-C. Fullt bord och väntande tittare (K6, P11)

- **Läge:** byggd i #547. Värdena står i `FULL_TABLE` i `coordinator.mjs`: `keepBoxes: 3`, `waitingMs: 30000` och `idleSeatMs: 90000`. Klienten förnyar väntandet var 10 s. Ett fullt bord, en väntande och en ny plats efter rundan är provat lokalt genom HTTP-vägen, tjänsten och kanalen mot PGlite (`test/shared-table-full.mjs`). Preview återstår.
- **Filer:** `games/blackjack/table/coordinator.mjs` (`keptAfterRound`, `endingAtReset`, `resetRound`, ett väntekommando), `shared-room-command-contract.mjs`, `shared-room-command.mjs`, och i klienten texten "Väntar på plats" i `shared-room-view.mjs`.
- **Prov (PGlite, felar först):** en väntande inom 30 s ger högst 3 platser, de spelade först. Inget tas från en runda som pågår. Utan väntande behålls alla. 90 s inaktivitet i insatsfönstret släpper platserna, men en insats behåller dem. Låsordningen ska hålla (`test/postgres-shared-command.mjs`), och väntekommandot ska vara idempotent.
- **Preview:** sju platser fyllda av två spelare, en tredje spelare väntar, och efter rundan har den tredje fått en plats.
- **Beroende:** inget öppet (F11 är mergad i #529). Lås- och skalningsfixarna (punkt 9) får gärna komma före.

### P-B. Mobilens kontrollyta, resultat och nedräkning ovanpå #536 (K2, K3, K4, P5, P6, P8)

- **Filer:** `shared-room-view.mjs`, `shared-room-controller.mjs` (ett tryck på ledig plats ger plats och insats, P6; servern stöder det redan), `index.html`, `styles.css`.
- **Prov:** `test/shared-room-layout.mjs` och `test/shared-room-layout-browser.mjs` från #536 utökas. Rubriken ska följa fasen. Nedräkningen ska visa serverns `deadline` och `actionDeadline` och vara brådskande vid 5 s eller mindre. Tidsdelen finns redan (resultatet följer den avräknade ögonblicksbilden, se ovan); en omladdning ska inte fira en gammal vinst. Ett tryck på ledig plats ska ge ett enda kommando. Inget reglage får överlappa vid 320×568, 390×844, 1440×900 och 1920×1080.
- **Preview:** Jakob spelar en runda på telefon med PAOW och Johns Bet.
- **Beroende:** #536 mergad. Chatten (K5) ingår bara om Jakob säger ja, och kommer då efter T3 och T5.

### P-A. Videoflyt: kodekvarianter med reserv (K1)

- **Filer:** varianter i registret (egen post med UUID och SHA-256 som pekar på originalet, samma fps och samma antal rutor), frysningen tar med varianterna i paketet, `verified-video-buffer.mjs` och `local-film-player.mjs` väljer variant per besök med H.264 som reserv, och Admin får en kodningskedja. Dealergeneriskt, utan dealerlistor.
- **Prov:** en variant med annat antal rutor eller annan fps avvisas. När valet tar för lång tid eller avkodningen felar faller besöket tillbaka till H.264. Rörligt tal och mätningen av inspelat tal läser alltid originalet. Kortspåren ger samma landning i alla varianter.
- **Preview:** med `?format=` tvingas varje variant fram på en telefon och en dator. Jakob bedömer bilden.
- **Beroende:** Jakobs beslut. Kan delas i två PR:er: först register och frysning, sedan klienten.

### P-D. Underhållsbesked från drifthälsan (K8)

- **Filer:** spelmotorn räknar fram beskedet ur `moving-drift-observer.mjs` och talets tillgänglighet per dealer, och skickar det i snapshot eller kanal i stället för en egen poll. Klienten visar det i `shared-room-view.mjs`. RunPod-saldot blir ett driftlarm i `ops/cloud`, inte spelartext.
- **Prov:** beskedet visas när arbetare saknas en tid efter beställningen, när en beställning felar eller när en replik faller tillbaka till stillbild. Det döljs när allt är grönt. En dealer påverkar inte en annan.
- **Preview:** kräver taluppsättningen i preview (TALKEDJA T2).
- **Beroende:** T3 och T5 samt Jakobs beslut om texten.

### Senare, efter beslut

- **Tempo per spelbord (K7)** tillsammans med P10, efter T3, om Jakob vill ha det.
- **P7, P12 och P13** enligt tabellen ovan.

## Jakobs beslutspunkter

1. K1: kodekvarianter, alltså lagring, kodningskedja och om en variant kräver nytt AV-godkännande.
2. K5: chatt vid det delade bordet.
3. K7: tempo per spelbord, och i så fall som spelinställning.
4. K8: om spelaren ska se underhållsbeskedet, och vad det ska säga.
5. K6: gränserna 3 platser, 30 s och 90 s, och vilka platser som behålls. Utan beslut gäller Kevins värden och de platser dealern spelade först. Dealern ger och spelar från höger, så det är de högsta platsnumren. Kevins egen kod behöll de lägsta.
6. P7 (gäståtkomst och "Bjud in"), P12 (serverkedjan för vilan: koppla in eller radera) och P13 (desktop).
