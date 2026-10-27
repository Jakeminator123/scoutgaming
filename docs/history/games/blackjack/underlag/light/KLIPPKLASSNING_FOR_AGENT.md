# Klippklassning för dealerklipp (instruktion till AI-agent)

Version 1, 2026-10-13. Projekt: Dealerverkstad-Light (blackjack, dealer "jakob" och fler).

Din uppgift: ta emot en batch med 20 till 25 dealerklipp och avgöra för varje klipp vad det är, vilken plats det hör till och om det håller kvalitet. Du ska **inte gissa**. Är du osäker flaggar du klippet.

## 1. De två nyckelbilderna (keystones)

Allt bygger på två låsta stillbilder per dealer. Varje klipp börjar och slutar i en av dem, så att klippen kan klippas ihop sömlöst i spelet.

| Nyckelbild | Fil (exempel) | Pose | Syfte |
|---|---|---|---|
| **VILA** | `arbetsyta/locked/VILA-<hash>.png` | Vilopose. Dealern står rakt, tittar fram, båda händerna vilar stilla framför sig i nedre delen av bilden. Ingen hand vid skon. | Start och slut för idle-loopen och för alla talklipp. Ankare för loopen: när inget händer i spelet visas VILA. |
| **REDO** | `arbetsyta/locked/REDO-<hash>.png` | Redo-pose vid skon. **Vänster hand** (bildens högra sida, x runt 931) vilar vid skon, höger hand redo att ta emot kortet. | Start och slut för varje utdelning och varje vändning av hålkort. Spelet växlar till REDO innan kortgivning och tillbaka till VILA efteråt. |

Regel: ett klipp som inte börjar och slutar i VILA eller REDO kan inte användas i kedjan.

## 2. Klasser

| Klass | Start -> slut | Rörelse i mitten | Mapp |
|---|---|---|---|
| `idle` | VILA -> VILA | Bara andning, små blinkningar. Händerna står still. | `idle/` (`jakob_idle.mp4`, varianter `jakob_idle_2.mp4` ...) |
| `till_skon` | VILA -> REDO | Vänster hand går till skon. | `overgang/to_shoe/` |
| `fran_skon` | REDO -> VILA | Handen lämnar skon och vilar. | `overgang/from_shoe/` |
| `utdelning` | REDO -> REDO | Vänster hand drar kort ur skon, höger hand lägger det på en plats (box 1 till 7, dealer öppet, dealer hålkort). | `box/box_1/` ... `box/box_7/`, `dealer/open_card_dealer/`, `dealer/hidden_card_dealer/` |
| `vand_halkort` | REDO -> REDO | Dealern vänder sitt hålkort på dealerplatsen (540,895). | `dealer/reveal_hole_card/` |
| `tal` | VILA -> VILA | Munnen rör sig tydligt (replik), lätta huvudrörelser. Inga handrörelser mot skon. | `talklipp/<replik>/` (greeting, bust, win, lose, push ...) |
| `okand` | annat | Allt som inte passar ovan. | flaggas, flyttas inte |

Skillnad `idle` mot `tal`: båda är VILA -> VILA. Mät munområdets rörelse. Tydlig, upprepad munrörelse = `tal`. Bara blink och andning = `idle`. Osäkert = flagga.

## 3. Metod steg för steg

1. **Probe:** kör `ffprobe` och spara bredd, höjd, fps, längd, codec, pixelformat, ljud ja/nej.
2. **Plocka ramar:** första ram, sista ram och 6 till 8 jämnt fördelade mellanramar.
3. **Jämför ändramar med nyckelbilderna.** Skala VILA.png och REDO.png till klippets upplösning. Räkna för både första och sista ramen:
   - SSIM (gråskala) och medel-absolut pixeldiff (0 till 255).
   - Riktvärden: SSIM >= 0,90 eller diff <= 4 = träff. SSIM 0,80 till 0,90 = trolig träff, kontrollera pose. Under 0,80 = ingen träff.
   - Välj den nyckelbild som ger bäst värde. Ligger VILA och REDO inom 0,02 SSIM från varandra: avgör på pose (punkt 4).
   - Referens: ett bra idle-klipp (jakob_idle_2) gav diff 0,6 mot VILA i första ramen och 0,9 i sista.
4. **Pose-ledtrådar** när siffrorna inte räcker:
   - VILA: båda händerna symmetriskt framför kroppen, inget nära x 931.
   - REDO: vänster hand (bildens högra sida) vid skon nära 931,802.
5. **Klassa på paret start -> slut** enligt tabellen i avsnitt 2.
6. **För REDO -> REDO:** följ höger hand och kortet i mellanramarna. Hitta ramen där kortet landar och ta närmaste koordinat i avsnitt 4. Avståndet ska vara under ca 60 px på 1080x1920-planet, annars flagga.
7. **Kvalitetskontroll** (avsnitt 6).
8. **Skriv JSON** (avsnitt 8).

## 4. Koordinater (kanoniskt plan 1080x1920)

Kortets mittpunkt där det landar. Kortet är 79x106 px.

| Plats | Kodnamn | x,y |
|---|---|---|
| Box 1 | box0 | 110,1025 |
| Box 2 | box1 | 253,1075 |
| Box 3 | box2 | 396,1105 |
| Box 4 | box3 | 540,1115 |
| Box 5 | box4 | 684,1105 |
| Box 6 | box5 | 827,1075 |
| Box 7 | box6 | 970,1025 |
| Dealer (öppet och hålkort) | dealer | 540,895 |
| Skon (hämtpunkt) | shoe | 931,802 **(ej verifierad, använd bara som ledtråd)** |

- Viktigt: koden räknar **box0 till box6** för plats 1 till 7. Filer och mappar använder **box1 till box7**. Översätt alltid, blanda aldrig.
- Desktopvy: samma bild i skala 1, punkt blir **x + 420, y - 108**. Dealern blir inte mindre, man ser bara mer på sidorna.
- Klipp i 720x1280 (Veo-utdata): multiplicera koordinaterna med 2/3 innan jämförelse.

## 5. Namn och mappar

Rot: `arbetsyta/dealers/<dealer>/`

```
idle/                     jakob_idle.mp4, jakob_idle_2.mp4
overgang/to_shoe/         jakob_to_shoe.mp4
overgang/from_shoe/       jakob_from_shoe.mp4
box/box_1/ .. box/box_7/  jakob_box1.mp4 .. jakob_box7.mp4
dealer/open_card_dealer/  jakob_dealer_open.mp4
dealer/hidden_card_dealer/ jakob_dealer_hole.mp4
dealer/reveal_hole_card/  jakob_dealer_flip.mp4
talklipp/<replik>/        jakob_talk_<replik>.mp4
```

Varianter: `_2`, `_3` osv., t.ex. `jakob_box3_2.mp4`. Skriv aldrig över en befintlig fil, välj nästa lediga nummer. Varje mp4 har en `.json` bredvid med taskId, modell, start- och slutbild. Läs den om den finns, men lita på bilderna före metadata.

## 6. Kvalitetskontroller

Flagga (sätt `quality: "underkand"` eller `"tveksam"`) om något av detta syns:

- **Zoom eller kamerarörelse:** dealerns konturruta (allt som inte är grön bakgrund) ändrar storlek eller läge mer än ca 2 % mellan ramar.
- **Klipp (cut):** en enskild ramdiff som är många gånger större än medel (t.ex. > 5x medel och > 8).
- **Fel arm:** vänster hand (bildens högra sida) ska dra kortet ur skon, höger hand ska lägga ut det. Om handen från skon korsar kroppen och själv lägger kortet = fel arm.
- **Vita kortartefakter:** vita rektanglar som dyker upp ur ingenting, ligger fel eller syns i idle/tal.
- **Identitetsdrift:** ansikte, frisyr eller kläder ändras jämfört med nyckelbilden.
- **Extra objekt:** bord, sko, extra händer, text, bakgrundsbyte. Dealerlagret ska bara innehålla dealern.
- **Når inte fram:** kortet landar mer än ca 60 px från målet.
- **Loopskarv (idle/tal):** diff mellan sista och första ram ska vara låg (under ca 3).

## 7. Formatmål

| | Nuvarande leverans | Slutmål |
|---|---|---|
| Upplösning | ofta 720x1280 från Veo (måste skalas upp) | 1080x1920 |
| Bildfrekvens | 24 fps | 24 fps konstant |
| Codec | H.264 med grön bakgrund | WebM/VP9 med riktig alfa |
| Ljud | inget | inget |

Rapportera avvikelser i `format_issues`, men klassa ändå klippet.

## 8. Utdata per klipp (JSON)

```json
{
  "file": "box/box_3/jakob_box3_2.mp4",
  "class": "utdelning",
  "target": "box3",
  "code_name": "box2",
  "start_keystone": "REDO",
  "end_keystone": "REDO",
  "start_score": {"ssim_vila": 0.71, "ssim_redo": 0.94, "diff_vila": 11.2, "diff_redo": 2.1},
  "end_score": {"ssim_vila": 0.70, "ssim_redo": 0.93, "diff_vila": 11.8, "diff_redo": 2.4},
  "land_frame": 31,
  "land_xy_1080": [401, 1098],
  "land_error_px": 9,
  "specs": {"width": 720, "height": 1280, "fps": 24, "duration": 4.0, "codec": "h264", "alpha": false},
  "format_issues": ["720x1280, ska vara 1080x1920", "ingen alfa"],
  "quality": "godkand",
  "quality_issues": [],
  "suggested_path": "box/box_3/jakob_box3_2.mp4",
  "confidence": 0.88,
  "needs_human": false,
  "notes": ""
}
```

Värden: `class` en av idle, till_skon, fran_skon, utdelning, vand_halkort, tal, okand. `target` box1 till box7, dealer_open, dealer_hole eller null. `quality` godkand, tveksam, underkand.

Avsluta med en sammanställning: antal per klass, saknade klipp jämfört med listan i avsnitt 5 och alla flaggade klipp.

## 9. Osäkerhetsregel

- `confidence` under 0,75 -> sätt `needs_human: true` och skriv varför i `notes`.
- Start eller slut matchar ingen nyckelbild -> `class: "okand"`.
- Två platser lika nära landningspunkten -> välj ingen, flagga.
- Flytta, döp om eller radera aldrig filer själv. Föreslå bara `suggested_path`.
- Hellre flagga än gissa. Ett felklassat klipp i spelet syns direkt.
