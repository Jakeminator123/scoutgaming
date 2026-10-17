# Klipp, format och godkännande

Gemensam begreppsreferens för [blackjack](blackjack/README.md) och [roulette](roulette/README.md). Spelens geometri och handlingar beskrivs i respektive manual. Detta är dokumentation, inte ett nytt uppladdningsschema eller en implementerad automatisk klassificerare. Webbplatsens AI-funktion ingår inte i denna leverans.

## Sex saker som ska hållas isär

| Begrepp | Besvarar | Exempel |
| --- | --- | --- |
| Medietyp och lagerroll | Vad föreställer tillgången och var används den? | Bakgrund, bord, dealerbild, dealerklipp, mask, talets ljudfil. |
| Handling | Vad händer i klippet? | Idle, till skon, utdelning till box0, hålkortsvändning, exakt replik, rouletteutfall. |
| Startpose och slutpose | Vilka kroppslägen kan klippet anslutas till? | VILA → REDO. Två olika handlingar kan båda vara REDO → REDO. |
| Filformat | Vad innehåller de faktiska bytesen? | Container, codec, mått, fps, rutor, alfa, ljud och färgprofil. |
| Visningsprofil | Hur placeras samma källa på skärmen? | Crop, skala, offset, mask och kort-/kontaktkoordinater. |
| Speltillhörighet | Vilket spel och vilken bank är materialet avsett för? | Blackjack, roulette eller uttryckligen delad bakgrund. |

Ett filnamn som `deal_pos1` är ett förslag till handling. Det bevisar varken målplats, pose, rätt dealer, rätt nummer eller godkänd kvalitet. En porträttfil kan visas på desktop utan att bli en ny kameratagning. Visningsprofilen får inte väljas genom filnamnet.

## Klipptyper och poser

| Typ | Förlopp | Uppspelning och krav |
| --- | --- | --- |
| Grundloop / idle | VILA → VILA | Får loopa först efter kontroll av hela skarven. En vald aktiv dealer-idle per scen. |
| Till skon | VILA → REDO | En gång. Blackjackens övergång; ingen automatisk roulettekoppling. |
| Utdelning / hålkortsvändning | REDO → REDO | En gång, med uppmätt målplats och kontaktruta. Separata handlingar trots lika poser. |
| Från skon | REDO → VILA | En gång. Återgång till samma låsta VILA. |
| Tal | Planen anger VILA → VILA | En gång med exakt text, språk, röst, ljud, video och cue-data. Ingen loopad mening över fortsatt ljud. |
| Rouletteutfallsfilm | Hjul/kula till ett bestämt fack | En gång efter bekräftat serverkvitto. Separat från dealer-idle; se [37-filmskontraktet](roulette/UTFALLSFILMER.md). |
| Bakgrundsvideo | Miljöns egen rörelse | Egen publicerad uppspelningspolicy; inte dealerpose eller spelresultat. |

VILA och REDO måste vara identifierade referenser för den aktuella dealern och mediefamiljen. De är inte bara ord i ett filnamn. Roulette behöver egen geometri och egna eventuella rörelser; skon och blackjackens sju kortplatser följer inte med automatiskt. En stillbild i REDO är inte ett extra obligatoriskt idle-klipp.

## Format är mätdata; exportprofil är ett beslut

Behåll originalet. Registrera SHA-256 och byteantal samt uppmätta dimensioner, rotation, SAR, codec/container, bildruteantal, bildfrekvens och tidsbas (CFR/VFR), duration, ljudspår, alfainnehåll och kända färgtaggar. Skilj uppmätt från okänt. Att skriva sRGB/BT.709 i metadata bevisar inte att källan har konverterats rätt.

| Underlag | Avgränsning |
| --- | --- |
| [Blackjack FORMATLASNING](blackjack/FORMATLASNING.md) | Historiskt H.264/MP4-paket, 1080×1920, 24 CFR, tyst och grön bakgrund. Ingen universell exportregel för alla spel. |
| [Blackjack dealerplan och Light](blackjack/DEALERBANK.md#format-och-lager) | Skilda förslag för H.264 respektive WebM/VP9-alfa. Tal med Opus står mot ett ljudlöst klassningsunderlag. Valet är öppet. |
| [Roulettens prototyp](roulette/README.md#mottagen-bordsspecifikation) | Äldre beställning är inte bevis på slutformat; senare PR47-mätning gäller en enda prototypfilm. |

Godkänd MIME/header i [media-file-types.mjs](../../packages/shared/media-file-types.mjs) bevisar inte avkodning, alfakanal eller läppsynk. H.264/yuv420p har inte den alfakanal som ett separat lager kan behöva. WebM som container garanterar inte alfa. Kontrollera faktiskt innehåll och hela målspelaren innan en exportprofil godkänns.

Blackjack har två dokumenterade desktopprofiler: Forge-beskärning och Light-höjdfit. Deras olika formler finns bara i [DEALERBANK](blackjack/DEALERBANK.md#två-olika-desktopprofiler--välj-medvetet). Ingen automatisk crop, förflyttning eller förstoring får lösa konflikten i tysthet. Kortmått, mask och kontaktpunkter måste använda samma identifierade koordinatsystem som bilden.

## Lager, friläggning och ljud

Friläggning gäller dealerlagret och kan behövas för både VILA, REDO och video. Originalet bevaras; preview och exporterade varianter har egen härledning. Ta inte bort bordets gröna filt eller bakgrundens gröna detaljer. Svart runt ett roulettehjul är inte transparens och får inte nycklas bort globalt tillsammans med svarta nummerfält.

En dealerbild är inte automatiskt en mask. Maskens roll (synlighet eller redigering), polaritet, upplösning, registrering och tillhörande bildhash ska vara tydliga. Transparent canvas får inte trimmas så att ankare flyttas. Kropp och händer som delas runt bord/kort ska komma från samma avkodade frame, inte två videospelare som kan glida isär.

För tal krävs exakt en avsedd ljudkälla. Separat ljud och inbäddat ljud får inte spelas dubbelt. Tysta idles, övergångar och roulettefilmer får inte bära oavsiktligt tal. Nytt ljud eller nya videobytes upphäver tidigare synkgodkännande.

## Från fil till godkänt material

Önskat granskningsflöde: **fil → klassning och mätning → sammansatt förhandsvisning → uttryckligt godkännande**. Här definieras vilka bevis som behövs; flödet påstår inte att automatiseringen redan finns.

1. Bevara originalet och mät tekniska fakta. Felaktig eller okänd typ ska synas.
2. Föreslå lagerroll, handling, start-/slutpose, dealer/familj och spel separat. Markera vad som bara bygger på namnet och vad som stöds av innehåll. Visa konflikter och obesvarade frågor.
3. Förhandsvisa i rätt spel, bord och visningsprofil. Kontrollera hela klippet och minst två uppspelningar, med relevant loopskarv, kortkontakt eller rouletteutfall. Kontrollera mobil och desktop samt ljud där det ingår.
4. Registrera beslut med identitet, tid, versions-/filhashar, profil och acceptansens omfattning. Teknisk validering, visuell acceptans, registrering och publicering är olika steg. Ett godkännande av preview publicerar inte ett rum.

Denna lista är ett granskningskontrakt, inte namn på befintliga databasfält. En framtida implementation måste koppla den till dagens register, revisioner och behörighetskontroller. Hashar skyddar identitet; de bevisar inte anatomi, läppsynk, skarv eller rätt resultat. Publicerade paket och historiska referenser ska fortsatt skydda medier från radering och tysta ersättningar.
