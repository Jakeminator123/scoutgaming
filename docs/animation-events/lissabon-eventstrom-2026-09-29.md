# Lissabons faktiska eventkedja · 2026-09-29

Lissabon är den fokuserade vyn i gemensamma Lab (`/`); `/lissabon` leder dit.
**Anslut** öppnar den riktiga Web-spelaren med `dealer=astrid` och
`presentation=local`. Labbet observerar den flikens publika serversvar,
presentation, chatt och uppspelningskvitton via den läsande native-kanalen.
Web äger film och ljud. Labbet startar ingen andra Astridspelare.

## Från spelbeslut till synlig bild

1. Serverns bord bestämmer kort, shoe, saldo, tillåtna handlingar och utfall.
2. `web/partner-presentation.mjs` bygger ordnade `presentation[]` med typerna
   `speak`, `deal`, `reveal`, `settle`, `turn` och `idle`. Dolt kort saknar
   rank/suit före `reveal` och är inte en andra utdelning.
3. Web väljer exakt filmfamilj från det sparade Lab-projektet och det aktiva
   manifestet. Ett valt klipp är inte ett uppspelningskvitto.
4. Den gemensamma spelaren visar faktiskt filmrutan och rapporterar playback
   och tidsmarkörer. Labbet behåller serversvar och kvitton som skilda poster.

Kevins granskade GitLab-branch `codex/astrid-languages` vid
`0d12b7a559d328a333598b7e583b980e88d7925c` används endast som
referens. Kortprojektion, handmasker, dolt kort/vändning och förladdning har
redan förts in selektivt i vår Web-spelare; se
[Kevin/Lissabon-granskningen](../KEVIN-LISSABON-REVIEW.md). Spelmotorn,
delat bord och deadlines har inte importerats.

## Två olika observationsvägar

Den vanliga Web-vägen är `/api/table` plus native-observationen ovan.
Partnerns `/api/v1/table` returnerar `presentation[]` och kan publicera samma
instruktioner på `/api/v1/events` efter commit. SSE gäller en autentiserad
Partner-spelare, saknar replay och är inte automatiskt samma profil som
Lissabons lokala Web-flik. Fokuserade Lissabon följer därför bara Web-fliken.
Spela aldrig samma instruktion både från HTTP-svaret och SSE.

Labbet ger nu varje native-anslutning i Web-fliken en egen observationskanal.
Omladdning eller lokalt profilbyte kan börja om bordets versionsnummer;
äldre profils versionsgräns får då inte dölja den nya profilens events.
En anslutningslucka visas fortfarande öppet. Detta ändrar enbart Labbets
gruppering av observerade poster, inte spelkommando, filmval eller utfall.

## Kontroll och återstående arbete

Det riktade regressionstestet provar version 8 före omladdning och version 1
efteråt; båda instruktionerna syns. Native-, rullande observations- och
TypeScript-proven passerar. Ingen ny browseromgång eller fyra-dealer-granskning
gjordes, eftersom spelaren och medierna inte ändrades.

För molnprov: kontrollera att Vercel-spelaren får samma serverägda svar från
Render, att native-kanalen visar faktiskt uppspelad bild och att eventuell
Partner-SSE märks som en separat spelare. Låt en verklig lokal profilväxling
och omladdning bekräfta observationsgränsen. GPU/TTS-latens och läppsynk
kräver egna mätningar och visuell bedömning.
