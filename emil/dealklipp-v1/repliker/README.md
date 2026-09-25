# Astrid – repliker med läppsynk, version 1 (2026-09-24)

Alla 17 repliker i Astrids replikbank (`web/public/dealers/astrid/audio/en/bank.json` på main) som färdiga talklipp.
Filnamnet är replikens id, samma som i `bank.json` och `speech-lines.mjs`.

## Teknik

| | |
|---|---|
| Format | MP4, H.264 (crf 12), yuv420p, BT.709, 24 fps, **1080×1920** (9:16) — **med ljud** (AAC, mono, 24 kHz) |
| Startbild | `../astrid_startbild_spel_1080x1920.png` — varje klipp **börjar och slutar exakt i startbilden**, precis som deal- och idle-klippen. Kan spelas mellan dem utan övertoning |
| Rörelse | bara munnen och käken rör sig; resten av bilden är startbilden orörd |
| Ljud | 0,22 s tystnad före rösten och ~0,5 s efter (munnen hinner stänga innan klippet slutar). Alla repliker har samma ljudnivå (−16 LUFS) |
| Röst | Cartesia `sonic-3.5`, rösten **Victoria – Refined Coordinator** (`dc30854e-e398-4579-9dc8-16f6cb2c19b9`), engelska |

Ljudet går att ta ut separat om spelet vill spela det för sig: `ffmpeg -i blackjack.mp4 -vn -c:a copy blackjack.m4a`.

## Klippen

| Fil | Text | Spelas när (app.mjs på main) | Längd |
|---|---|---|---|
| `greeting.mp4` | Welcome to the Dark Hall. I'm Astrid. Take a seat whenever you're ready. | spelaren kommer in | 5,0 s |
| `placebets.mp4` | Place your bets whenever you are ready. | ny runda, insatser öppna | 3,0 s |
| `goodluck.mp4` | Bets are closed. Good luck at my table. | insatserna stängs | 3,6 s |
| `sidebet.mp4` | Your side bet pays, nicely done. | en sidobet vinner | 3,4 s |
| `insurance.mp4` | Insurance is open if you want it. | försäkring erbjuds | 3,2 s |
| `double.mp4` | Doubling down, one card coming. | spelaren dubblar | 3,4 s |
| `bust.mp4` | That is a bust. | spelarens hand över 21 | 2,1 s |
| `blackjack.mp4` | That's blackjack right away, and it pays three to two. | spelaren får blackjack och vinner | 4,5 s |
| `dealerblackjack.mp4` | Dealer has blackjack this round. | dealern har blackjack | 2,8 s |
| `dealerbust.mp4` | Dealer busts this time, and the round goes to all of you. | dealern över 21 | 4,0 s |
| `win.mp4` | Well played. Your winnings exactly as earned. | spelare vinner | 3,9 s |
| `push.mp4` | A push, your stake goes back. | oavgjort | 3,0 s |
| `lose.mp4` | The house takes this one. | spelaren förlorar | 2,3 s |
| `peek.mp4` | Let me take a quick look to see if the house has blackjack. | *anropas inte i dag* | 3,5 s |
| `farewell.mp4` | Thanks for playing, come back soon. | *anropas inte i dag* | 3,0 s |
| `chatter1.mp4` | The cards are being rather kind to everyone tonight. | *anropas inte i dag* | 3,7 s |
| `chatter2.mp4` | Take your time, there is no rush. | *anropas inte i dag* | 3,5 s |

`bank.json` i den här mappen är texterna klippen gjordes från. Ändras en text i spelet behöver det klippet göras om —
säg till, så görs det med samma röst och samma utseende.

## Chattsvar i realtid

Spelbilden har en egen läppsynk-endpoint på RunPod (Kevins konto): `astrid-spel-lipsync` = `tdkbn6qxcyh4so`, avatar
`astrid_spel2x`. Den ger samma bild och börjar/slutar i startbilden. Den finslipade munnen (färg, skärpa och mjukt
slut) som klippen här har är ännu inte inbyggd i endpointen — kommer i nästa version.

## Kontakt

Emil (konsult).
