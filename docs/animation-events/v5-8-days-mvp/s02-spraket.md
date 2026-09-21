# S02 · från RNG till uppspelningskvitto

Håll isär spelbeslut, presentationsinstruktion, variantbeslut och vad spelaren
faktiskt lyckades visa. Varje steg behöver egen identitet och status.

## Serverfakta först

RNG är en del av serverns spelmotor. Servern äger även sko, kort, tur, tillåtna
handlingar, insatser, wallet och utbetalningar. De publika instruktionerna
använder sex typer: `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
Framtida kort och dolt hålkort får inte läcka till modell eller labblogg.

Exempel: `settle` redovisar ett redan avgjort resultat och `speak` kan ange
den exakta resultatrepliken. `turn` visar spelarens tur. `reveal` vänder det
redan existerande kortet; det behöver inte ha en egen dealerfilm. Saknad film
på dessa noder betyder därför inte automatiskt en trasig nedladdning.

## Samma instruktion i flera leveranser

HTTP-svarets `presentation[]` och SSE:s `round.events` kan bära samma presentation. Labbet korrelerar kanal, request-ID,
tabellversion, presentationsindex och kanoniskt innehåll. Samma instruktion
får flera leveranskvitton men ett sekvenssteg. Konflikt eller saknat steg
stoppar följningen. SSE har ingen historisk replay-buffer; återanslutning
fyller inte automatiskt luckan.

Native-bryggan skickar först efter commit. Retry, state-read, stale/nekade
kommandon och rollback får inte bli nya spelade rundor. En publiceringsstörning
ska inte återkalla ett redan committat spelkommando.

## Variantbeslut är inte playback

`POST /api/presentation/decision` tar emot ett eget besluts-ID och separat
källreferens. Samma ID och samma innehåll återanvänder beslutet; ändrat innehåll
ger 409. Nuvarande cache är processlokal: 128 jobb, fem minuter efter slutfört
beslut, högst fyra samtidiga beslut. Det skyddar modellval, inte all playback
över flera processer eller flikar.

Loggen visar om OpenClaw, regler, slump eller standard gjorde valet. Modellen
får bara kandidater som klarat tillgänglighet och exakt semantisk kompatibilitet.
Dess svar kontrolleras mot begärans-ID, projektversion och tillåtna variant-ID:n.
Ett accepterat val betyder fortfarande inte att en bild målats eller tal hörts.

## Prova observationen

1. Öppna labbets **Händelselogg**. Verifiera serverns Partner-konfiguration
   och samma nyckel/spelare; håll nycklar utanför delade dokument och skärmbilder.
2. Öppna originalspelet via Partner-launch. **Visa spelflik** använder den
   flik som operatören uttryckligen väljer. Bilden visas lokalt; inget ljud
   fångas och inget spelas in eller laddas upp av denna funktion.
3. Välj **Labbets presentation** för lokalt material. Starta sekvensen eller
   välj **Följ nya instruktioner** uttryckligen; mottagning ensam startar inte.
4. Öppna ett sekvenssteg i Eventstudion. Exakt replik, kort och destination
   följer med och ersätts inte av en bekvämare exempelrunda.
5. Exportera före omladdning. Händelseloggen har högst 150 poster; protokollet
   begränsas till 300 meddelanden eller 4 MiB. Båda är lokalt flikminne.

Isolerad native-sekvens med 12 steg har spelats till avslut. Webbläsarens
manuella flikvalsflöde behöver fortfarande ett fullständigt operatörsprov.
Sekvensvisning är inte ännu hela handens beständiga kortscen med alla splitar.

## Vad dagens privata loggar säger

Jakobs lokala `jakob-log-files/backoffice.bettalotto` innehåller utdrag av
overview, clips, generations och verdicts. Flera slutar med utelämnade rader
och är inte fullständiga JSON-svar. De ger register-/bindningsunderlag och
exempel på avvisade generationer, inte en komplett spelad tidslinje.

Den tillförda observationen har två statusposter och noll rundposter. Ett
partiellt kopierat tabellsvar och en motorlista ersätter inte `round.events`.
Nästa riktiga inspelning av underlag behöver en sammanhängande, avidentifierad
sekvens med rundposter. Originalklientens faktiska klippstart/slut och kortlandning
måste instrumenteras separat. Råkopiorna ligger kvar privat.
