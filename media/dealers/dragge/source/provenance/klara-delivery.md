# Dragge: färdiga utdelningsklipp (greenscreen)

**Spelet ska använda `produktion/`. Inget annat.**

| Mapp | Vad | Vem använder den |
|---|---|---|
| `produktion/` | **De färdiga filerna som går ut i spelet** (gröna klipp + stillbilder) | Spelet |
| `forhandsvisning/` | Samma klipp keyade över rummet + `hela_bordet_komp.mp4` (demo) | Människor som vill titta |
| `original_h3/` | H3:s originalklipp, orörda | Bara om `produktion/` ska byggas om (`metodik/videoklipp/skript/greenscreen/bygg-klara.sh`) |

## produktion/ — färdiga filer för spelet

| Fil | Från → till | Längd |
|---|---|---|
| `VILA.png` | stillbild: dealern i vila (händerna på bordet). Läppsynkens/idle-klippens läge | — |
| `REDO.png` | stillbild: redo att dela ut (vänster hand på kortet i skon) | — |
| `in_vila_till_redo.mp4` | VILA → REDO | 28 rutor, 1,2 s |
| `deal_pos1.mp4` … `deal_pos7.mp4` | REDO → REDO + vitt kort på plats 1–7 | 26–27 rutor, ~1,1 s |
| `deal_posdealer.mp4` | REDO → REDO + vitt kort på dealerplatsen | 26 rutor |
| `deal_poshole.mp4` | REDO → REDO + svart kort (hålkortet, vänds aldrig) på dealerplatsen | 27 rutor |
| `ut_redo_till_vila.mp4` | REDO → VILA | 28 rutor, 1,2 s |

Alla klipp är 1080×1920, 24 fps, och har grön bakgrund. Första och sista rutan är byte för byte `REDO.png`/`VILA.png`
(+ kortet), så klippen kan spelas i valfri ordning utan skarv: `in → deal_pos7 → deal_pos6 → … → ut`. Kortet i klippet är
en attrapp (vitt = framsida upp, svart = baksida upp); spelet ritar det riktiga kortet ovanpå.

Klippen är redan rensade från grönt spill på den vita skjortan (`rensa-gron-spill.py`). Annars blir skjortan
flimrig i spelets nyckel.

## Källor (för den som bygger om)

| Plats | `original_h3/` | Prompt (`prompter/dragge2/`) | Seed |
|---|---|---|---|
| 1 | `pos1_redo10_s3402_hq.mp4` | `redo10_pos1.txt` | 3402 |
| 2 | `pos2_redo10_s3401_hq.mp4` | `redo10_pos2.txt` | 3401 |
| 3 | `pos3_redo10_s3401_hq.mp4` | `redo10_pos3.txt` | 3401 |
| 4 | `pos4_redo_pos4_v3_s3101_hq.mp4` | `redo_pos4_v3.txt` | 3101 |
| 5 | `pos5_redo7_s3101_hq.mp4` | `redo7_pos5.txt` | 3101 |
| 6 | `pos6_redo7_s3101_hq.mp4` | `redo7_pos6.txt` | 3101 |
| 7 | `pos7_redo10_s3403_hq.mp4` | `redo10_pos7.txt` | 3403 |
| dealer | `posdealer_redo10_s3403_hq.mp4` | `redo10_posdealer.txt` | 3403 |
| hålkort | `poshole_hole10_poshole_f39_s3701_hq.mp4` | `hole10_poshole.txt` | 3701 |

REDO = ruta 27 ur `resultat/05_2026-10-07_V3_IN/in_redo_f39_s3001_hq.mp4`.
In- och ut-klippen = rutorna 0–27 ur samma klipp (ut = baklänges).
