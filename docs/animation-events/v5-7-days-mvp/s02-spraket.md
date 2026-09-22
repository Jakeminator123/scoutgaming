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

1. Öppna labbets **Händelselogg** och tryck **Anslut**. Partner-åtkomst
   verifieras, rätt originalsession öppnas och labbet följer nya instruktioner.
2. Spela i originalfliken. Välj den uttryckligen i webbläsarens bilddelning
   om du vill se originalbilden bredvid labbet. Bilden visas lokalt utan
   inspelning/uppladdning eller fångat ljud. Dataobservationen är separat.
3. Grundläget **Bara standard** spelar labbets exakta originalförval. Välj
   ett annat variantläge för att jämföra; OpenClaw/Skuggläge kan göra modellanrop.
   **Pausa labbet** stoppar lokal följning. Originalspelets regler ändras inte.
4. Jämför publikt serversvar, originalets instrumenterade klientsignaler,
   labbval och labbkvitto. Öppna ett sekvenssteg i Eventstudion med samma
   exakta replik, kort och destination. Diagnostik rymmer de manuella verktygen.
5. Exportera före omladdning. Händelseloggen har högst 150 poster; protokollet
   begränsas till 300 meddelanden eller 4 MiB. Båda är lokalt flikminne.
   När gränsen nås: exportera och välj **Ny observation** i Diagnostik.
   Det ersätter protokollet och följer bara kommande instruktioner; spelet
   och anslutningen behålls.

Native-observern visar den senaste publika bordsvyn; med bara SSE kan bordet
endast härledas delvis från mottagna presentationer och märks därför som
partiellt. Det är samma serverfakta, inte en andra motor eller frame-synkron
återskapning av originalfilmen. Kontexträknare bygger på mottagna avgjorda
händer sedan senaste luckan. Saknad historik/språk/chattklassificering anges
som okänd; neutrala reservvärden räknas inte som observerade fakta.

Högst åtta user/assistant-meddelanden från native-observationen får ge
variantkontext, med källa och tid före eventet. Gränsen är 600 tecken per
meddelande och 3 200 totalt; en lucka bryter historiken. Separata identitets-,
saldo- och authfält följer inte med. Chatttext är indata, inte instruktioner.
Den uppdaterade Director måste kvittera kontrakt v2 och antal mottagna
meddelanden. Äldre remote ger `remote_context_not_supported_baseline` och
standarduppspelning tills redeploy/nytt prov belägger stödet.

Det äldre isolerade provet med 12 importerade steg avser revisionen från
21 september. Aktuell integration och operatörens flikval behöver sina egna
testkvitton; se handoffen.

## Vad dagens privata loggar säger

Jakobs lokala `jakob-log-files/backoffice.bettalotto` innehåller utdrag av
overview, clips, generations och verdicts. Flera slutar med utelämnade rader
och är inte fullständiga JSON-svar. De ger register-/bindningsunderlag och
exempel på avvisade generationer, inte en komplett spelad tidslinje.

Den tillförda observationen har två statusposter och noll rundposter. Ett
partiellt kopierat tabellsvar och en motorlista ersätter inte `round.events`.
Nästa riktiga inspelning av underlag behöver en sammanhängande, avidentifierad
sekvens med rundposter. Den nya native-observern samlar instrumenterade
klientsignaler när rätt spelarkod körs, men ändrar inte den äldre observationen
till en komplett tidslinje. Råkopiorna ligger kvar privat.
