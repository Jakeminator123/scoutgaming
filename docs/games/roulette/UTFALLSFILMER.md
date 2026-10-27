# Roulette: krav på utfallsbank

Krav på en framtida bank med 37 utfall. Inget av detta är implementerat; i dag visar spelet serverns utfall med det ritade hjulet och kulan i `wheel-motion.mjs`. Anna-proven, Runway-filmerna, trackingutredningen och genomförandeplanen från oktober finns i [historiken](../../history/games/roulette/UTFALLSFILMER-2026-10.md).

## Vad banken ska innehålla

Ett godkänt visuellt utfall för vart och ett av 0–36, utan luckor eller dubbletter. Rekommendationen är ett gemensamt bord och hjul med en separat, deterministiskt styrd kula mot 37 kalibrerade mål; banken behöver inte vara 37 stora filmer. Alla utfall visar samma europeiska hjul, kamera, skala, ljus och mask. Nummerföljd och färger ska stämma med [rules.mjs](../../../services/game/games/roulette/rules.mjs); en film med förvrängda eller felordnade nummer är underkänd även om slutnumret ser rätt ut.

Hjul och kula är ett eget lager. Scenen använder en vald dealervila, och ingen dealer är inbakad i utfallsfilmen. Hjulimpuls och kulsläpp är två gester, och en dealerhandling väljer aldrig vinnande fack. Kulans mål är ett fack i roterande hjulkoordinater; det rena underlaget saknar gammal kula och skugga, så att lagret aldrig visar två kulor. Leveransprofilen (mått, crop, fps, codec, färgrymd, alfa eller mask, ljudpolicy, stoppmarkering) låses innan hela banken produceras.

## Koppling till serverresultatet

Filmen följer ett bekräftat och sparat resultat; den bestämmer aldrig utfall eller pengar.

1. Samma kommando (`requestId`, version, valuta, satsningar) sparas före sändning. Ingen lokal slump eller förvald film.
2. Utfallet väljs ur den versionsbundna banken först efter serverns offentliggörande, med kontroll av spel, rum, bankversion och filhash. Saknad post ersätts aldrig av närmaste nummer.
3. Filmen spelas en gång. Avslutet avräknar inte igen och skickar inget nytt spin.
4. Vid tappat svar återförsöks exakt det sparade kommandot; servern behåller 20 kvitton per scope.
5. Rundans kvitto måste binda bankens revision, så att samma runda inte byter media när en ny bank publiceras. Det fältet finns inte i dag.

## Resultatsekretess

I dag innehåller kvittot redan nummer, färg, utbetalning och saldo, så resultatet är känt för klienten före varje film. En verklig sekretessgräns kräver ett nytt serverkontrakt: satsning, dolt utfall, pending-status, serverstyrd reveal-tid och fryst presentationsversion sparas atomärt; före reveal lämnas bara neutrala fält ut, även i `/api/player`, `/api/profile` och roulettehistoriken. En webbläsare kan aldrig hålla utfallet hemligt ända till bildrutan där kulan landar; dold DOM, oskärpa eller obskyra filnamn är inget skydd.

## Reserv och acceptans

Före reveal ger mediafel en neutral väntvy; efter reveal visas serverns nummer och avräkning även utan film, med en verifierad resultatstillbild för rätt nummer eller en neutral bordsvy med text. Acceptans kräver full visuell granskning av alla 37 utfall per hash, isolerade serverprov (alla nummer, tappat svar, exakt återförsök, inaktuell version, rollback), bankbyte utan att gamla kvitton påverkas, reservläge och verklig mobil och desktop.
