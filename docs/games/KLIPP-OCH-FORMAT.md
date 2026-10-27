# Klipp, format och godkännande

Gemensam begreppsreferens för [blackjack](blackjack/README.md) och [roulette](roulette/README.md). Spelens geometri och handlingar står i respektive guide, orden i [ordlistan](../../apps/studio/docs/TERMINOLOGI.md) och lagrings- och uppspelningskontraktet i [runtime-referensen](../LOCAL-PRESENTATION-RUNTIME.md). Detta är ett granskningskontrakt, inte ett uppladdningsschema.

## Sex saker som hålls isär

| Begrepp | Besvarar | Exempel |
| --- | --- | --- |
| Medietyp och lagerroll | Vad är tillgången och var används den? | Bakgrund, bord, dealerbild, dealerklipp, mask. |
| Handling | Vad händer i klippet? | Vila, till skon, utdelning till box0, hålkortsvändning, replik, rouletteutfall. |
| Start- och slutpose | Vilka lägen kan klippet anslutas till? | VILA → REDO. Två handlingar kan båda vara REDO → REDO. |
| Filformat | Vad innehåller bytesen? | Container, codec, mått, fps, rutor, alfa, ljud, färgprofil. |
| Visningsprofil | Hur placeras källan på skärmen? | Crop, skala, offset, mask, kort- och kontaktkoordinater. |
| Speltillhörighet | Vilket spel och vilken bank? | Blackjack, roulette eller uttryckligen delad bakgrund. |

Ett filnamn som `deal_pos1` är ett förslag. Det bevisar varken målplats, pose, dealer eller kvalitet, och visningsprofilen väljs aldrig genom filnamnet.

## Klipptyper och poser

| Typ | Förlopp | Uppspelning |
| --- | --- | --- |
| Vila (grundloop) | VILA → VILA | Loopar efter kontroll av hela skarven. En aktiv vila per scen. |
| Till skon | VILA → REDO | En gång. Bara blackjack. |
| Utdelning, hålkortsvändning | REDO → REDO | En gång, med uppmätt målplats och kontaktruta. |
| Från skon | REDO → VILA | En gång, tillbaka till samma låsta VILA. |
| Replik | VILA → VILA | En gång med exakt text, språk, röst, ljud och video. Ingen loopad mening över fortsatt ljud. |
| Rouletteutfall | Hjul och kula till ett fack | En gång efter bekräftat serverkvitto; se [utfallskraven](roulette/UTFALLSFILMER.md). |
| Bakgrundsvideo | Miljöns egen rörelse | Egen uppspelningspolicy; ingen dealerpose eller spelresultat. |

VILA och REDO är identifierade referenser för den aktuella dealern och mediefamiljen, inte ord i ett filnamn. Roulette har egen geometri; skon och blackjackens sju platser följer inte med.

## Format är mätdata

Behåll originalet. Registrera SHA-256 och byteantal samt uppmätta mått, rotation, SAR, codec, bildruteantal, fps och tidsbas, längd, ljudspår, alfa och färgtaggar. Skilj uppmätt från okänt; en färgtagg i metadata bevisar inte konvertering.

Godkänd MIME i [media-file-types.mjs](../../packages/shared/media-file-types.mjs) bevisar inte avkodning, alfa eller läppsynk. H.264/yuv420p saknar alfa, och WebM som container garanterar inte alfa. Kortmått, mask och kontaktpunkter använder samma koordinatsystem som bilden. Blackjackens två desktopprofiler står i [DEALERBANK](blackjack/DEALERBANK.md#två-desktopprofiler).

## Lager, friläggning och ljud

Friläggning gäller dealerlagret. Bordets gröna filt och bakgrundens gröna detaljer nycklas inte bort, och svart runt ett roulettehjul är inte transparens. En dealerbild är ingen mask: maskens roll, polaritet, upplösning och bildhash ska vara tydliga. Kropp och händer runt bord och kort kommer från samma avkodade bildruta.

Tal har exakt en ljudkälla; separat och inbäddat ljud spelas aldrig dubbelt. Vila, övergångar och roulettefilmer är tysta. Nya ljud- eller videobytes upphäver tidigare synkgodkännande.

## Från fil till godkänt material

1. Bevara originalet och mät tekniska fakta. Okänd typ ska synas.
2. Föreslå lagerroll, handling, poser, dealer och spel separat, och markera vad som bara bygger på namnet.
3. Förhandsvisa i rätt spel, bord och visningsprofil, minst två uppspelningar, på mobil och desktop med ljud där det ingår.
4. Registrera beslut med identitet, tid, filhash, profil och omfattning. Teknisk validering, visuell acceptans, registrering och publicering är olika steg; ett godkänt förhandsprov publicerar inget rum.

Hashar skyddar identitet men bevisar inte anatomi, läppsynk, skarv eller rätt utfall. Publicerade paket och historiska referenser skyddar media från radering och tysta ersättningar.
