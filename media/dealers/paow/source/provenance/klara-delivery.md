# Paow: färdiga utdelningsklipp (greenscreen)

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
| `in_vila_till_redo.mp4` | VILA → REDO | 22 rutor, 0,9 s |
| `deal_pos1.mp4` … `deal_pos7.mp4` | REDO → REDO + vitt kort på plats 1–7 | 26–27 rutor, ~1,1 s |
| `deal_pos6b.mp4` | samma som `deal_pos6`, annan tagning (för variation i spelet) | 26 rutor |
| `deal_posdealer.mp4` | REDO → REDO + vitt kort på dealerplatsen | 28 rutor |
| `ut_redo_till_vila.mp4` | REDO → VILA | 22 rutor, 0,9 s |

**Saknas:** hålkortet (`deal_poshole.mp4`). Kandidaterna ligger i `resultat/paow/04_HOLE/`.

Alla klipp är 1080×1920, 24 fps, och har grön bakgrund. Första och sista rutan är byte för byte `REDO.png`/`VILA.png`
(+ kortet), så klippen kan spelas i valfri ordning utan skarv. Kortet är en attrapp (vitt = framsida upp,
svart = baksida upp); spelet ritar det riktiga kortet ovanpå. Klippen är rensade från grönt spill.

## Källor (för den som bygger om)

| Plats | `original_h3/` | Prompt (`prompter/paow/`) | Seed | Not |
|---|---|---|---|---|
| 1 | `pos1_v10_pos1_f39_s3602_hq.mp4` | `v10_pos1.txt` | 3602 | |
| 2 | `pos2_v10_pos2_f39_s3601_hq.mp4` | `v10_pos2.txt` | 3601 | |
| 3 | `pos3_v10_pos3_f39_s3601_hq.mp4` | `v10_pos3.txt` | 3601 | |
| 4 | `pos4_v3_pos4_f39_s3602_hq.mp4` | `v3_pos4.txt` | 3602 | |
| 5 | `pos5_v7_pos5_f39_s3604_hq.mp4` | `v7_pos5.txt` | 3604 | |
| 6 / 6b | `pos6_…s3601`, `pos6b_…s3602` | `v7_pos6.txt` | 3601, 3602 | |
| 7 | `pos7_v13_pos7_f39_s3801_hq.mp4` | `v13_pos7.txt` | 3801 | **en hand**: med två händer ville hon lägga kortet med båda |
| dealer | `posdealer_v11_posdealer_f39_s3609_hq.mp4` | `v11_posdealer.txt` | 3609 | **en hand** |

Vilan = `indata/paow/start_1088.png` (bildgen/06, B1ref_s21).
REDO = ruta 21 ur `indata/paow/redo/in_redo_s3503_hq.mp4`. In- och ut-klippen = rutorna 0–21 ur samma klipp.
