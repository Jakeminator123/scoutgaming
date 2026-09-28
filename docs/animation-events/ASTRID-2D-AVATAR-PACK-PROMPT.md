# Prompt: bygg ett nytt 2D-avatarpaket för Astrid

Kopiera allt från och med rubriken **UPPDRAG** till agenten som ska skapa paketet.

---

## UPPDRAG

Du är både senior 2D-karaktärsdesigner och teknisk animator. Skapa ett nytt, sammanhållet 2D-avatarpaket för croupiern Astrid i Croupier-projektet. Figuren ska tydligt påminna om Astrid i projektets referensbilder, men vara en stiliserad, högkvalitativ 2D-tolkning. Den ska se betydligt mer genomarbetad ut än den nuvarande enkla CSS-figuren, samtidigt som identitet, proportioner, kläder, kamera och färger är helt konsekventa i alla rörelser.

Arbeta i två steg:

1. Skapa och få godkännande på en neutral masterbild och den separerade 2D-riggen.
2. Använd exakt samma godkända master och rigg för att skapa de 64 namngivna rörelsevarianterna nedan.

Skapa inte 64 nya oberoende porträtt. Alla varianter ska komma från samma låsta karaktärsdesign och samma lager. Detta är avgörande för att undvika att ansikte, hår, kroppsform, kläder eller händer ändras mellan klippen.

### Arbetsplats och säkerhet

Projektet finns i:

`C:\Users\jakem\Projects\croupier`

Läs projektets `AGENTS.md` innan du gör något. Andra agenter arbetar i samma workspace. Ändra, flytta, återställ, rensa eller committa ingenting i repot. Använd repot som skrivskyddad källa i detta uppdrag.

Lägg allt nytt material utanför repot. Hämta den riktiga Desktop-sökvägen med operativsystemets Desktop-funktion, inte genom att anta att den alltid är `C:\Users\jakem\Desktop`. Skapa sedan:

`<Desktop>\astrid-2d-avatar-pack\`

Om mappen redan finns, skapa en ny versionsmapp inuti den i stället för att skriva över tidigare arbete.

### Vad antalen betyder

Det finns 16 nuvarande eventgrupper och fyra rörelsevarianter per grupp: totalt **64 unika 2D-klipp**. Samma 64 klipp delas i dagens labb mellan fyra dealers. Projektets 256 variantkopplingar betyder därför inte att 256 bilder ska produceras. Det här uppdraget gäller ett Astrid-paket med 64 klipp.

Den fristående sociala reaktionen i `lab/animations/social-reactions.json` räknas inte in i de 64. Kopiera den inte in i huvudleveransen. Du får lägga en separat skiss för den under `extras/` först efter att de 64 obligatoriska klippen är klara.

### Läs dessa källor innan du börjar

Visuella referenser, i prioriteringsordning:

1. `web/public/dealers/astrid/poster.jpg` — huvudreferens för helhetsintryck, kläder, sittställning och proportioner.
2. `web/public/bo/img/astrid-portrait.jpg` — huvudreferens för ansikte, hår, ögon och färgpalett.
3. `web/public/lab/astrid-kf-full.png` — referens för att samma ansikte måste hålla ihop över flera uttryck.
4. `web/public/lab/astrid-atlas-sheet.png` — referens för ansiktsformer; detta uppdrag ska inte påstå att det levererar lipsync.
5. `web/public/dealers/astrid/scene.png` — referens för placering i spelscenen. Bakgrunden ska inte bakas in i själva riggen.

Tekniska källor:

1. `docs/animation-events/README.md`
2. `lab/animations/README.md`
3. `lab/animations/index.json`
4. De 16 eventfilerna i `lab/animations/`
5. `lab/policies/project.seed.json`
6. `lab/components/stage.tsx`
7. `lab/lib/motion-library.mjs`
8. `lab/lib/motion-player.mjs`

Inventera källorna selektivt. Skanna inte videobibliotek, råmedia, byggmappar eller privata arkiv.

### Visuell riktning

Astrid ska vara en elegant, vuxen kvinnlig croupier i en modern, semi-realistisk 2D-stil med rena former och diskret cell-shading/editorial shading. Hon ska kännas mänsklig och professionell, inte fotorealistisk, 3D-renderad, anime, barnslig eller karikerad.

Behåll följande igenkänningstecken från referensen:

- ljust blont hår, sidbena och stramt uppsatt frisyr
- ljusa blå/grå ögon
- balanserat ovalt ansikte och lugnt, fokuserat uttryck
- små diskreta örhängen
- svart, skräddad kavaj över en elfenbensvit V-ringad blus
- upprätt, samlad hållning bakom blackjackbordet
- varm, dämpad premiumkänsla utan starka färgstick

Figuren ska vara frontvänd och kameran helt låst. Visa minst huvud, överkropp, båda armarna och hela händerna. Inga handleder eller fingrar får kapas i de yttersta spelposerna. Använd en transparent bakgrund för riggen. Lägg aldrig bord, kort, marker, text, logotyper eller casino-bakgrund i karaktärslagren.

Undvik plastig hud, överdrivna leenden, sexualisering, stora animeögon, slumpmässiga smycken, förändrad frisyr, asymmetriska ansiktsdrag, extra fingrar, sammansmälta händer och nya accessoarer mellan varianter.

### Steg 1: neutral master och rigg

Skapa först tre neutrala stilförslag på ett gemensamt kontaktark. Alla tre ska följa samma kamera, pose och kläder. Välj inte själv bort de andra två och börja inte batchen direkt. Presentera kontaktarket och be Jakob välja eller godkänna ett förslag.

När ett förslag är godkänt ska du låsa dess referensbild, seed/referens-ID, färgpalett, canvas, proportioner och lagerstruktur. Dokumentera dem i `rig/rig.json` och `reports/generation-log.json` så att varje senare variant kan spåras till samma master.

Den godkända riggen ska minst innehålla separata transparenta lager för:

- `actor` — övergripande rot/pivot för hela figuren
- `body` — bål, kavaj och blus
- `face` — huvud, hår och neutralt ansikte
- `leftArm` — vänster arm och neutral hand
- `rightArm` — höger arm och neutral hand
- `blush` — valfri diskret kindton, normalt osynlig
- `sadFace` — valfritt uttryckslager för framtida social reserv
- `coverHands` — valfri separat pose med båda händerna framför ansiktet

För bättre framtida animation får du även leverera separata ögonlock, ögonbryn, munformer och handposer, men den obligatoriska kompatibilitetsriggen måste fortfarande kunna mappas till nuvarande mål `actor`, `face`, `leftArm`, `rightArm` och `blush` utan att spelaren först måste byggas om.

Leverera mastern som redigerbar SVG om möjligt, plus transparenta PNG-lager i minst 2048 × 2048 px. Alla lager ska ha samma canvas, samma origo och dokumenterade pivotpunkter. Den sammansatta neutrala figuren ska också finnas som `astrid-neutral-master.png`.

Godkännandesteg innan batchproduktion:

- rendera neutral helfigur
- rendera vänster, mitten och höger räckvidd utan kort
- rendera ett diskret leende och ett neutralt taluttryck
- kontrollera särskilt ansikte, händer, kavajens kanter och att silhuetten inte hoppar mellan poser

### Vad som ska animeras

Avatarens kropp och gester ska presentera en spelhändelse som redan är beslutad av spelmotorn. Figuren får inte förutse kort, odds, utfall eller spelarval.

Kortvärde, färg, placering, box, marker och utbetalning ägs av spelet och får inte bakas in i avatarbilderna. Vid en deal får handen göra en naturlig kortgrepps- och räckrörelse, men själva kortet ska fortsatt ritas av spellagret. Förhandsvisningar kan visa ett separat överlagrat demokort för tydlighet.

Riktningsregler:

- `deal.player.left`: räck tydligt mot vänster spelarzon, motsvarande box 0–1.
- `deal.player.centre`: räck tydligt mot mittzonen, motsvarande box 2–4.
- `deal.player.right`: räck tydligt mot höger spelarzon, motsvarande box 5–6.
- `deal.dealer`: kort rörelse till croupierns egen kortyta.
- `reveal.dealer`: tydlig men lugn vänd/presentera-rörelse mot egen kortyta.
- `turn.player`: inbjudande turmarkering mot redan publicerad box; aldrig spelråd.
- `settle.*`: reagera först efter publicerat resultat.
- `speak.*`: diskret talgest; ingen lipsync behöver skapas eller utlovas.
- `idle.ready`: subtil levande vila som kan avbrytas rent.

Varje klipp ska spelas exakt en gång, börja i neutral pose och sluta exakt i neutral pose. Inget klipp får loopa. Håll rörelserna små nog för att fungera bakom ett bord. Vänster, mitten och höger måste vara visuellt läsbara utan att karaktären lämnar sin fasta kamera.

### De 64 obligatoriska klippen

Använd exakt dessa `assetId`, etiketter, grundrörelser och längder. Behåll versaler, punkter och stavning i ID:n exakt. Etiketterna är mänsklig beskrivning; rörelsen ska tolka etiketten utan att ändra eventets betydelse.

| assetId | Etikett | Grundrörelse | ms |
|---|---|---:|---:|
| `deal.dealer.standard` | Dela croupier | deal-dealer | 1400 |
| `deal.dealer.contextual` | Lugn delning croupier | deal-dealer | 1700 |
| `deal.dealer.motion3` | Varm nick · eget kort · labb | deal-dealer | 2100 |
| `deal.dealer.motion4` | Liten cirkelgest · labb | deal-dealer | 2300 |
| `deal.player.centre.standard` | Dela mitten | deal-centre | 1400 |
| `deal.player.centre.contextual` | Vänlig delning mitten | deal-centre | 1700 |
| `deal.player.centre.motion3` | Tacksam nick mot mitten · labb | deal-centre | 2100 |
| `deal.player.centre.motion4` | Litet studsande svep · labb | deal-centre | 2300 |
| `deal.player.left.standard` | Dela vänster | deal-left | 1400 |
| `deal.player.left.contextual` | Lugn delning vänster | deal-left | 1700 |
| `deal.player.left.motion3` | Varm blick åt vänster · labb | deal-left | 2100 |
| `deal.player.left.motion4` | Lätt svep åt vänster · labb | deal-left | 2300 |
| `deal.player.right.standard` | Dela höger | deal-right | 1400 |
| `deal.player.right.contextual` | Lugn delning höger | deal-right | 1700 |
| `deal.player.right.motion3` | Leende åt höger · labb | deal-right | 2100 |
| `deal.player.right.motion4` | Lätt svep åt höger · labb | deal-right | 2300 |
| `idle.ready.standard` | Vänta | idle | 1400 |
| `idle.ready.contextual` | Välkommen tillbaka | wave | 1700 |
| `idle.ready.motion3` | Generad hälsning · labb | idle | 2100 |
| `idle.ready.motion4` | Liten hälsningsdans · labb | idle | 2300 |
| `reveal.dealer.standard` | Vänd kort | reveal | 1400 |
| `reveal.dealer.contextual` | Lugn kortvändning | reveal | 1700 |
| `reveal.dealer.motion3` | Mjuk blick · visa kort · labb | reveal | 2100 |
| `reveal.dealer.motion4` | Lätt presenterande gest · labb | reveal | 2300 |
| `settle.blackjack.standard` | Bekräfta blackjack | celebrate | 1400 |
| `settle.blackjack.contextual` | Lågmäld bekräftelse | nod | 1700 |
| `settle.blackjack.motion3` | Tacksam bugning · labb | celebrate | 2100 |
| `settle.blackjack.motion4` | Lätt dubbelhälsning · labb | celebrate | 2300 |
| `settle.dealerBust.standard` | Visa resultat | celebrate | 1400 |
| `settle.dealerBust.contextual` | Tacka för beröm | wave | 1700 |
| `settle.dealerBust.motion3` | Rodnande leende · labb | celebrate | 2100 |
| `settle.dealerBust.motion4` | Litet axelryck · labb | celebrate | 2300 |
| `settle.other.standard` | Visa resultat | reassure | 1400 |
| `settle.other.contextual` | Neutral gränssättning | neutral | 1700 |
| `settle.other.motion3` | Vänlig omtanke · labb | reassure | 2100 |
| `settle.other.motion4` | Mjuk huvudlutning · labb | reassure | 2300 |
| `settle.push.standard` | Visa oavgjort | neutral | 1400 |
| `settle.push.contextual` | Lugn bekräftelse | reassure | 1700 |
| `settle.push.motion3` | Vänligt leende · labb | neutral | 2100 |
| `settle.push.motion4` | Lekfull balansgest · labb | neutral | 2300 |
| `settle.win.standard` | Bekräfta vinst | celebrate | 1400 |
| `settle.win.contextual` | Lågmäld vinstreaktion | nod | 1700 |
| `settle.win.motion3` | Varm gratulation · labb | celebrate | 2100 |
| `settle.win.motion4` | Lätt öppen-handsgest · labb | celebrate | 2300 |
| `speak.double.standard` | Bekräfta | point | 1400 |
| `speak.double.contextual` | Vänlig bekräftelse | nod | 1700 |
| `speak.double.motion3` | Hand på hjärtat · labb | point | 2100 |
| `speak.double.motion4` | Dubbel nickning · labb | point | 2300 |
| `speak.goodluck.standard` | Standardhälsning | wave | 1400 |
| `speak.goodluck.contextual` | Välkommen tillbaka · tyska | wave | 1700 |
| `speak.goodluck.motion3` | Rodnande tack · labb | wave | 2100 |
| `speak.goodluck.motion4` | Lekfull dubbelvink · labb | wave | 2300 |
| `speak.insurance.standard` | Informera | neutral | 1400 |
| `speak.insurance.contextual` | Lugn information | nod | 1700 |
| `speak.insurance.motion3` | Varmt tack · öppen hand · labb | neutral | 2100 |
| `speak.insurance.motion4` | Lätt nick · tydlig information · labb | neutral | 2300 |
| `speak.other.standard` | Läs spelreplik | neutral | 1400 |
| `speak.other.contextual` | Lugn gränssättning | neutral | 1700 |
| `speak.other.motion3` | Generat leende · labb | neutral | 2100 |
| `speak.other.motion4` | Lekfull huvudlutning · labb | neutral | 2300 |
| `turn.player.standard` | Visa tur | point | 1400 |
| `turn.player.contextual` | Vänlig turmarkering | point | 1700 |
| `turn.player.motion3` | Varm inbjudan · labb | point | 2100 |
| `turn.player.motion4` | Två lätta pekningar · labb | point | 2300 |

### Runtimeformat och kompatibilitet

Skapa en speglad kopia av nuvarande animationsregister under leveransmappens `animations/`. Behåll nuvarande 16 eventfiler, fyra klipp per fil och nuvarande JSON-schema:

- `schemaVersion`
- `eventId`
- `clips[]`
- per klipp: `assetId`, `eventId`, `label`, `durationMs`, `tracks[]`
- tillåtna obligatoriska mål: `actor`, `face`, `leftArm`, `rightArm`, `blush`
- varje frame använder normaliserad `at` mellan 0 och 1 samt relevanta `x`, `y`, `rotate` och `opacity`

Använd befintliga JSON-filer som semantisk och teknisk bas. Du får förbättra timing och poser i kopian, men du får inte ändra ID, eventkoppling eller varaktighet. Lägg inte kod, CSS, webbadresser eller fria selektorer i JSON.

Skapa även ljudlösa previewfiler för mänsklig granskning. Använd WebM med transparens om verktygskedjan säkert stöder det; annars MP4 på en tydligt märkt enfärgad granskningsbakgrund. Previewfilerna är bevismaterial, inte automatiskt runtimeformat. De ska vara 30 fps, exakt matcha angiven längd och inte loopa.

Skapa ett `manifest/asset-manifest.json` som för varje `assetId` anger:

- event-ID
- etikett
- längd
- sökväg till animations-JSON
- sökväg till preview
- vilken neutral master och riggversion som användes
- canvasstorlek, fps och transparensstatus
- kontrollvärden för första och sista neutrala pose

### Obligatorisk mappstruktur

```text
astrid-2d-avatar-pack/
  README.md
  rig/
    astrid-neutral-master.svg
    astrid-neutral-master.png
    rig.json
    layers/
  animations/
    index.json
    <16 eventfiler>.json
  previews/
    <64 assetId>.webm eller .mp4
    posters/
  contact-sheets/
    neutral-options.png
    all-64.png
    deal-directions.png
    face-and-hands.png
  manifest/
    asset-manifest.json
    asset-map.csv
    checksums.sha256
  reports/
    generation-log.json
    visual-qc.md
    unresolved.md
  extras/
```

Lägg en rad per obligatoriskt klipp i `asset-map.csv`. Filnamnet ska vara dess exakta `assetId` plus filändelse. Inga mellanslag eller översatta filnamn.

### Kontrollscen som måste visas

Skapa en separat demo för `deal.player.centre.standard` där den synliga spelarplatsen 4 får sitt första kort och kortet visas som **8♥**. Figuren ska bara utföra mitt-deal-rörelsen. 8♥ ska ligga i ett separat spellager och får inte vara inritat i Astrid-riggen eller i hennes händer. Märk demon tydligt som granskningsscenario och inte som hårdkodad speldata.

### Kvalitetskontroll

Kontrollera samtliga 64 klipp och dokumentera resultatet i `reports/visual-qc.md`.

Godkänt kräver:

- exakt 64 unika obligatoriska `assetId`, varken 63 eller 65
- identiskt ansikte, hår, hudton, kläder, kroppsproportioner och kamera i samtliga klipp
- samma canvas, origo och pivotpunkter i alla lager
- neutral första och sista pose i varje klipp
- exakt angiven längd och en enda uppspelning
- rätt riktning för vänster, mitten, höger, dealer och reveal
- anatomiskt rimliga armar, händer och fingrar utan hopp eller sammansmältning
- inga inbakade kortvärden, marker, spelresultat eller odds
- transparent karaktärsrigg utan bakgrund eller text
- läsbara uttryck utan överdrift
- inga påståenden om lipsync eller godkänd produktionsvideo

Generera kontaktarket `all-64.png` från de verkliga previewfilerna, inte från fristående nygenererade stillbilder. Markera varje ruta med `assetId` och längd.

Kör en automatisk manifestkontroll som jämför leveransen med `lab/animations/index.json` och `lab/policies/project.seed.json`. Rapportera saknade, dubbla eller felstavade ID:n. Räkna och rapportera både 16 eventfiler och 64 klipp.

### Viktigt om video och 2D

Det får aldrig visas en lokal 2D-avatar ovanpå en aktiv dealer-video. I nuvarande produktlogik är 2D en reserv eller ett uttryckligt förhandsvisningsläge. Paketet ska därför vara en ren 2D-resurs utan automatiskt uppspelande lager. Dokumentera integrationskravet i `README.md`: runtime ska välja exakt ett presentationsmedium per event — kopplad video/original eller 2D-reserv — och städa bort föregående medium vid byte, fel eller avbrott.

Implementera inte denna runtimeändring i repot under uppdraget. Leverera bara paketet och integrationsnoteringen.

### Slutrapport

När allt är klart ska du svara med:

1. den absoluta sökvägen till leveransmappen på Desktop
2. vilken neutral master som godkändes och dess riggversion
3. verifierat antal eventfiler och klipp
4. resultatet av manifestkontrollen
5. sökvägar till `neutral-options.png`, `all-64.png`, kontrollscenen med 8♥ och `visual-qc.md`
6. alla kvarvarande visuella eller tekniska problem
7. en tydlig bekräftelse på att inga filer i Croupier-repot ändrades

Markera inte paketet som produktionsklart. Det är en visuell kandidat tills Jakob har granskat riggen, alla riktningar och integrationen i den verkliga spelaren.
