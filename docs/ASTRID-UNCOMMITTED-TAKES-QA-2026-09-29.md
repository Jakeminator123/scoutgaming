# Astrid: läsande inventering och granskningslista för ocommittade takes

Status 2026-09-29. Ingen fil i `emil/dealklipp-v1` har ändrats, stageats,
återställts eller visuellt godkänts i denna granskning. Paketets README anger
Emil som kontakt för v1, men den som gjorde **dessa ocommittade ändringar**
är ännu inte verifierad via agent-talk. Root-orchestrator känner till en separat
Python-agent men saknar dess id och uttryckliga variantbeslut. Bevara allt
tills ägare och avsikt är kvitterade.

Manifestet har 28 familjer och 51 poster. Nedanstående 12 påverkade MP4-filer
matchade sina manifesthashar vid inventeringen. Riktad `ffprobe` visade
H.264, 1080×1920, 24 fps och **noll ljudströmmar** för var och en.
Manifesttestets sju delprov och `node pipeline/audit-dealer-sync.mjs --probe`
passerade. De proven är inte visuell acceptans.

## Varje take som Astrid ska granska

`Text/ljud` för dessa deal-/idle-takes är preliminärt **ingen replik, inget
ljud** enligt paketets README och filmetadata. Bekräfta ändå exakt tillåten
händelse och att ingen policy låter en talreplik använda filmen som ersättning
för en riktig talvideo. Ett framtida talbyte kräver separat exakt text,
inspelat ljud, video, frame index, kalibrering och acceptansnotering.

| Take | Manifesthändelse och avsedd plats | Rutor | Särskild visuell kontroll |
| --- | --- | ---: | --- |
| `deal/deal_pos1/variant/box_1_variant.mp4` | `deal.player.left`, box0 / plats 1, centrum (110, 1025) | 93 | Kortuttag ur skon, en rak kortglidning och kontakt vid vänster ytterplats; ny storlek jämfört med tidigare fil. |
| `deal/deal_pos2/variant/box_2_variant.mp4` | `deal.player.left`, box1 / plats 2, (253, 1075) | 80 | Kortets landning, fri hand och återgång; ny storlek jämfört med tidigare fil. |
| `deal/deal_pos3/variant/box_3_variant_shoefix.mp4` | `deal.player.centre`, box2 / plats 3, (396, 1105) | 80 | Bekräfta att skons och spårkortets form inte hoppar mellan stillbild och take. |
| `deal/deal_pos4/variant/box_4_varaint.mp4` | `deal.player.centre`, box3 / plats 4, (540, 1115) | 79 | Bevara källfilens stavning i manifestet; kontrollera verklig mittplats och kortkontakt. |
| `deal/deal_pos5/variant/box_5_variant.mp4` | `deal.player.centre`, box4 / plats 5, (684, 1105) | 91 | Jämför bildruta för bildruta med shoefix-alternativet; ägaren måste välja avsedd variant/prioritet. |
| `deal/deal_pos5/variant/box_5_variant_shoefix.mp4` | Samma `box4` / plats 5, (684, 1105) | 82 | Samma familj har **två** varianter; jämför skons kontinuitet, kortets bana och slutbild. |
| `deal/deal_pos6/variant/box_6_variant_shoefix.mp4` | `deal.player.right`, box5 / plats 6, (827, 1075) | 85 | Kontrollera skons kontinuitet och högerkortets landning under handen. |
| `deal/deal_pos7/variant/box_7_variant.mp4` | `deal.player.right`, box6 / plats 7, (970, 1025) | 91 | Kontrollera ytterhögerns perspektiv, kant och handkontakt. |
| `deal/deal_posdealer/variant/box_dealer_variant.mp4` | `deal.dealer`, dealer-up, (540, 895) | 75 | Kortet måste landa på dealerns egen yta, inte på spelarmitten. |
| `idle/variant/idle_resa_sig.mp4` | `idle.ready/ready` | 217 | Start/slut mot neutral idle, kropp och skobakgrund; känd ljus väggskillnad i handoffen. Bekräfta om varianten ska behållas. |
| `idle/variant/idle_smile.mp4` | `idle.ready/ready`; policy: manuellt leende | 73 | Naturligt leende utan talrörelse; neutral övergång vid två uppspelningar. |
| `idle/variant/idle_yawn.mp4` | `idle.ready/ready`; policy: manuell gäspning | 102 | Gäspning endast vid avsedd trötthetskontext, ingen falsk talmunsynk; neutral övergång. |

För **var och en** av de tolv raderna ovan återstår följande kryss:

- [ ] Ägare kvitterar filens avsikt, manifestroll och event-/policyval. För
  box 5 väljs eller motiveras båda varianternas exakta användning.
- [ ] Exakt text är dokumenterad som `ingen replik`; ljud är dokumenterat
  som `ingen ljudström`, eller en uttrycklig tal-asset-set skapas om avsikten
  faktiskt är tal. Jämför policy och verklig spelhändelse.
- [ ] Titta hela videon: startbild, kortuttag/rörelse/kontakt/släpp/återgång
  eller idle-gest, slutbild, beskärning, ljus, flimmer, skarv och anatomi.
  Inget överklistrat munlager.
- [ ] Registrera **exakta frame index** för händelse, landning/släpp och
  återgång i en separat stagingkatalog; saknad eller ombyggd indexfil får
  inte kringgå kalibreringsskyddet.
- [ ] Jämför med `kortpositioner.json`: målkoordinaten ovan och kortstorlek
  63×85 px för deal; dokumentera per-take kalibrering/överlapp och
  start-/slutbildskontinuitet för idle.
- [ ] Kör två konsekutiva uppspelningar i den **riktiga spelaren** med
  `?dealer=astrid&rehearsal=1` och dokumentera synligt resultat per gång.
  Kontrollera sedan samma delade uppspelningsväg för alla fyra dealers.
- [ ] Efter varje avsedd media/player-ändring: kör
  `node pipeline/audit-dealer-sync.mjs --probe` och
  `.githooks/pre-commit`. Uppdatera endast berörd baslinje **efter**
  dokumenterad visuell acceptans.

Beslut nu: **ingen av de tolv takesen eller deras manifest-/policyändringar
är redo för media-commit eller baslinjeändring**. Strukturella kontroller och
hashar räcker inte; ägare, variantbeslut, frame index, kalibrering och
tvåspelsgranskning saknas.
