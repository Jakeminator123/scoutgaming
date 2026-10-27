# Dealerbord – mått och instruktioner

Alla siffror kommer från `01_SPEC/SCENKONTRAKT.json` (koordinatsystem `emil-mobile-v3`), utom handmåtten som är uppmätta i Jakobs låsta VILA (`arbetsyta/locked/VILA-*.png`, hash b4f5b3de…). Inget är uppfunnet. Det som kontraktet själv kallar utkast står som UTKAST här.

## 1. Dukar (canvas)

| Syfte | Storlek | Anmärkning |
|---|---|---|
| Arbetsmaster (VILA/REDO, koordinater) | 1080×1920 | Origo uppe till vänster, x åt höger, y nedåt. Punkter = kortets mittpunkt. |
| Bred master för bord och bakgrund | 3414×1920 | Mobilutsnittet ligger på x 1167–2247 (1080 bred), y 0–1920. Ingen skalning: bred x = mobil x + 1167. |
| Transport/desktop | 1920×1080 | Skala 0,5625, förskjutning x +656,25: desktop x = 656,25 + 0,5625·x, desktop y = 0,5625·y. Bred master skalas med höjden (1920 → 1080), ger 1920,375 px bredd, 0,1875 px beskärs per sida. Sträck aldrig. |
| Runway-klipp (gen4.5/gen4_turbo) | 720×1280 | Skala 2/3 av arbetsmastern. |

Spelarvisning: s = viewporthöjd/1920, x = viewportbredd/2 + (x−540)·s, y = y·s. Samma höjd ger samma storlek på dealern oavsett bredd.

## 2. Kortmål (kortets mittpunkt)

Kortstorlek i arbetsmastern: 79×106 px, rotation 0°. Desktop 1920×1080: 44,4375×59,625 px. Tolerans: 2 px. Box 1 är längst till vänster sett från spelaren (inte dealerns vänster). Spegla aldrig.

| Plats | 1080×1920 (cx, cy) | Kortyta [V, Ö, H, N) | Bred 3414×1920 | Desktop 1920×1080 | Klipp 720×1280 |
|---|---|---|---|---|---|
| Box 1 | 110, 1025 | 70.5, 972, 149.5, 1078 | 1277, 1025 | 718.125, 576.562 | 73.33, 683.33 |
| Box 2 | 253, 1075 | 213.5, 1022, 292.5, 1128 | 1420, 1075 | 798.562, 604.688 | 168.67, 716.67 |
| Box 3 | 396, 1105 | 356.5, 1052, 435.5, 1158 | 1563, 1105 | 879, 621.562 | 264.00, 736.67 |
| Box 4 | 540, 1115 | 500.5, 1062, 579.5, 1168 | 1707, 1115 | 960, 627.188 | 360.00, 743.33 |
| Box 5 | 684, 1105 | 644.5, 1052, 723.5, 1158 | 1851, 1105 | 1041, 621.562 | 456.00, 736.67 |
| Box 6 | 827, 1075 | 787.5, 1022, 866.5, 1128 | 1994, 1075 | 1121.44, 604.688 | 551.33, 716.67 |
| Box 7 | 970, 1025 | 930.5, 972, 1009.5, 1078 | 2137, 1025 | 1201.88, 576.562 | 646.67, 683.33 |
| Dealer | 540, 895 | 500.5, 842, 579.5, 948 | 1707, 895 | 960, 503.438 | 360.00, 596.67 |

Kortskon (dealerns upplockningspunkt): 931.48, 802.25 i 1080×1920. Status i kontraktet: `LEGACY_USER_CLICK_REQUIRES_REVIEW`, alltså äldre klickpunkt som måste granskas, inte ett godkänt mått.

## 3. Bordskant i förhållande till VILA-händerna

- Bakre bordskant (där bordet möter dealern): y = 740 i arbetsmastern. Kontraktet märker den `DRAFT_NOT_MEASURED`.
- Bordets utkastform (arbetsmasterkoordinater, x kan vara negativt för sidorna): M −360,740 → L 1440,740 → C (1510,850) (1270,1710) → 540,1740 → C (−190,1710) (−430,850) → −360,740. Mask: `02_MALLAR/bord_silhuett_WIDE_L.png`.
- Jakobs låsta VILA (uppmätt): dealern syns y 156–842. Underarmar och händer ligger ungefär y 730–842, med fingertopparna längst ned vid y ≈ 842. Händerna ligger alltså på bordsytan strax nedanför bakkanten (740). Det är rätt: händerna ska vila på ytan, inte hänga över kanten.
- Dealerns eget kortmål (540, 895) och alla spelarmål (y 1025–1115) måste ligga på synlig bordsyta under händerna.
- Behöver bordet täcka dealerns underkropp: lägg en separat framkant (foreground), skär inte i dealerklippet.

## 4. Alpha och format för bordsbilden

- Rekommenderad master: 3414×1920 PNG, RGBA, 8 bit per kanal, sRGB, straight (unassociated) alpha. Transparent överallt utanför bordet.
- Mobilversion: 1080×1920 utsnitt av mastern, källrektangel [1167, 0, 2247, 1920], ingen skalning.
- I spelaren: förlustfri WebP med alpha, samma duk som mastern. Reserv: PNG RGBA.
- Undvik: JPEG (ingen alpha), grön bakgrund på bordet (det är dealern som keyas, inte bordet), automatisk beskärning av transparens utan placeringsdata, skalning efter synliga kanter, inbakad dealer eller rum.
- Stillbild rekommenderas. Ett animerat bord kräver separat testad alphavideo, inte vanlig H.264-MP4.

## 5. Säkra zoner

- Mobil: allt viktigt (kortmål, bordskant mot händerna) inom x 0–1080 i arbetsmastern, alltså x 1167–2247 i den breda mastern. Kortmålen ligger mellan x 70,5 och 1009,5.
- Desktop 1920×1080: den breda mastern fyller hela bredden. Mobilutsnittet hamnar på x 656,25–1263,75, så det som bara finns i sidorna syns bara på desktop.
- Lägg inga detaljer som måste synas inom 2 px från kortytorna ovan; korten ritas av spelmotorn ovanpå bordet.

## 6. Lagerordning (z, lägst först)

| z | Lager | Alpha | Innehåll |
|---|---|---|---|
| 0 | background | nej | Room only. No foreground blackjack table, dealer, cards, chips or UI. |
| 10 | dealer_body | ja | Optional split needed if table must cover lower body; not a second independently decoded video. |
| 20 | table | ja | Table only, transparent outside, no dealer or baked room. |
| 30 | cards | ja | Engine-driven separate card assets at registered targets. Never duplicate a generated physical card without a handoff mask. |
| 40 | dealer_hands | ja | Arbitrary automatic y-split is not anatomically correct across every action. |
| 50 | foreground | ja | Optional table rail/props requiring separate occlusion. |
| 100 | ui | ja | Screen-space interface, independent of world coordinate geometry. |

Bordet (z 20) ligger alltså ovanför dealerns kropp (z 10) men under korten (z 30) och dealerns händer (z 40).

## 7. Kontroll innan ett nytt bord används

1. Öppna bordet i "Välj fil och kontrollera" med rollen table.
2. Lägg det över låst VILA och REDO i 1080×1920 och kolla att händerna vilar på ytan och att alla åtta kortmål ligger på synlig bordsyta.
3. Kontrollera alpha: inga gröna eller svarta kanter.
