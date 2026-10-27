# Tysta 2D-rörelseprov

Här finns 64 syntetiska spelexempel: 16 händelsegrupper × fyra rörelser.
Separat finns `social-reactions.json` med `social.ledsen`: neutral → lite ledsen →
två händer framför ansiktet → neutral. Det är inte ett nytt motor-event eller en
ny sparad projektvariant. Sociala exempel får bara visas mellan spelhändelser
med befintlig `idle.ready`, aldrig ersätta delning eller kortvändning.
Fyra dealers kan dela samma exempelrigg; den är inte fyra färdiga dealerfilmer.
Inga nya spelmotor-events, repliker, ljudspår eller produktionsvideor skapas här.

- `index.json`: manifestet, alltså en innehållsförteckning över de 16 eventfilerna.
- `<eventId>.json`: fyra klipp med `assetId`, beskrivning, längd och numeriska rörelsespår.
- `social-reactions.json`: fristående sociala reaktioner med `scope: social-lab`
  och `reactionId`, utan `eventId`. Manifestet räknar dem separat.
- `../lib/motion-library.mjs`: läser och validerar registret.
- `../lib/motion-player.mjs`: spelar en ändlig sekvens på 2D-figurens fasta delar.

Kopplingen är `variant.assetId → clip.assetId`. Befintliga `.standard` och
`.contextual` behålls; `.motion3` och `.motion4` är ytterligare exempel.
Policyprojektet väljer **vilket** klipp; dessa JSON-filer beskriver bara **hur**
figuren rör sig. Triggerregler och OpenClaws beslut hör inte hemma i rörelsedata.

Varje spår har ett fast mål: `actor`, `face`, `leftArm`, `rightArm` eller `blush`.
Sociala klipp kan också använda `sadFace` och `coverHands`. Det sistnämnda är
en enkel böjd-arms-pose i 2D-riggen; raka armar tonas bort samtidigt så att
figuren inte visar fyra händer. Armspår kan därför ha valfri `opacity` med
neutralt värde 1. Inga foton eller produktionsfilmer överlagras.
`at` anger tiden 0–1. `x`/`y` är pixlar, `rotate` grader och `opacity` 0–1.
Alla klipp går från neutral pose tillbaka till neutral pose, med en enda
uppspelning. Rotationer/förflyttningar är begränsade; JSON får inte innehålla
egen kod, CSS, webbadresser eller fria DOM-selektorer. Vid avbrott tas spåren bort.
Operativsystemets inställning för minskad rörelse respekteras.

Du kan ändra poser, timing och namn i JSON, men detta är ännu ingen visuell
keyframe-editor. Projektets händelse-, variant- och villkorsetiketter redigeras i Admin.
När ett riktigt klipp binds med `videoGenerationId` visar videoläget den exakta
filen; tyst rörelse, språkönskemål och neutral slutpose är **inte** bevis på
tal, lipsync eller godkänd produktionsmedia. Rodnad är en skriven dealerreaktion,
inte upptäckt av en verklig spelares känslor.

Kör `node --test apps/studio/test/motion-library.test.mjs`. Testerna kontrollerar antal,
ID-kopplingar, skilda poser, validering, avbrott och minskad rörelse.
Webbläsarkontroll behövs fortfarande för att bedöma hur rörelserna ser ut.

Scenens **Testa event** kör regelvalet. **Spela vald variant** visar
det valda klippet direkt utan modell-/regelval; den ändrar inte spelutfallet.
Avslutscallback skickas en gång efter uppspelning, inte efter avbruten rörelse.

Spelaren använder webbläsarens [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)
och [cancel](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel) för städning.
