# OMKODADE KLIPP (crf 20), 2026-09-25: alternativ till `public/media/`

Den här mappen är ett **alternativ**. `public/media/` är orörd, och demot använder fortfarande den. Välj själv vilken
uppsättning spelet ska använda.

## Skillnad mot `public/media/`

| | `public/media/` | den här mappen |
|---|---|---|
| Kodning | x264 crf 12 | x264 **crf 20**, preset slow, keyframe var 48:e ruta |
| Storlek | ca 4× större (t.ex. `deal/pos1.mp4` 4,35 MB) | ca 4× mindre (`deal/pos1.mp4` 1,11 MB) |
| Upplösning, fps, antal rutor | 1080×1920, 24 fps | **samma** |
| Start/slut | exakt i startbilden | **samma** (ruta 0 mot startbilden 0,90, sista 1,08) |
| Idle-klipp | 6 st | 6 st + **2 nya** (se nedan) |

Allt annat är samma innehåll: 8 utdelningsklipp (`deal/`), 51 repliker (`repliker/`, samt `bank.json`),
`deal/kortpositioner.json` och `startbild.png`.

## Nya idle-klipp (2026-09-25)

| Fil | Innehåll | Längd |
|---|---|---|
| `idle/still_short.mp4` | sitter stilla och andas | 2,3 s (56 rutor) |
| `idle/hands_together.mp4` | händerna glider ihop på filten, vilar och glider isär till samma läge | 3,75 s (90 rutor) |

Båda börjar och slutar exakt i startbilden, precis som de andra klippen.

## Byta till den här mappen

`manifest.json` här är samma som `public/media/manifest.json`, med två skillnader:
- alla sökvägar pekar på `/media_omkodad_crf20_2026-09-25/…`
- de två nya idle-klippen är tillagda (vikt 20 och 4)

Demoservern läser `public/media/manifest.json` (`server/server.mjs` rad 28). Byt den sökvägen till
`public/media_omkodad_crf20_2026-09-25/manifest.json`, eller kopiera mappens innehåll över `public/media/`.

Emil
