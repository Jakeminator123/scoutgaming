# 3D-spåret återupptaget — 18 september 2026

Blender 5.2.2 LTS installerad; öppnar 4.5-filerna utan konvertering.

## Vad som redan finns
- `assets/blackjack-3d/editable-project/astrid-blackjack-editable.blend` (56 MB): hela bordet, 7 betting spots, chip-tray, komplett sko (Shoe_Outlet, Shoe_CutCard, Shoe_Pusher, Shoe_CardStack), kort (Card_Face/Back/Edge + Card_Template), rum, kamera "Player seated lens", Astrid riggad (54 ben, fulla fingerkedjor).
- 12 actions x 2 (armatur + kort): Deal_Seat_01..07, Deal_Own_Card, Reveal_Hole_Card, Collect_Card, Greeting_Wave, Accept_Bets_Nod. Kortet är animerat parallellt med handen, så kontakten är deterministisk.
- `assets/astrid-3d/anatomical/`: ARKit-liknande shape keys (jawOpen, mouthPucker, browInnerUp...) på face/eyes/teeth/tongue/lashes = lipsync möjlig i 3D.

## Rendrat här (EEVEE, 960x540, ~2 s/bild)
- `scene-seat03.jpg`: seat 3, frames 1/18/30/40/51. Handen går till skon, kortet kommer ut och landar på felten.
- `seven-seats-f40.jpg`: alla sju sitsar vid release-frame. Samtliga fungerar.
- `seat03-strip.jpg`: samma action ur `astrid-animated.blend` (ingen scen, bara figuren) — visar att den filen är en ren riggstudie.

## Läget
3D har exakt det videospåret saknar: fysisk kontakt hand-sko-kort och alla sju sitsar. Video har exakt det 3D saknar: ett ansikte som ser äkta ut.
Kända 3D-brister (samma som stoppade spåret 13 sep): likhet, hår, ögonlock, hud/hals-övergång. Armrörelsen är stel.

## Vägval
A. Full 3D: kräver ansikts- och hårarbete. Det var det som underkändes.
B. Hybrid: rendera ENDAST underarmar/händer/kort ur 3D med alfa, komposita över den filmade Astrid. Ansiktet rörs aldrig. Kräver att 3D-kameran matchas mot filmkameran (Shoe_Outlet mot 0.636,0.599 och boxCentres i 1920x1080).
C. 3D som rörelsereferens för nya videogenereringar. Kräver credits (1.92 kvar).
