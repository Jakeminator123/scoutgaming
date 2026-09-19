# V3 · nio relativa steg till MVP

> **[BESLUTAT FÖR V3]** Detta är arbetsordningen för Jakobs spår på `jakeminator123/work`. “Nio dagar” är nio relativa arbetssteg, inte kalenderlöften och inte automatiska uppdrag till Kevin eller Emil. Kevin äger repo, motor och slutlig integration.

## Roller och arbetssätt

| Person | Roll i V3 | Samarbetsform |
| --- | --- | --- |
| Kevin | Chef, repo-/motorägare och slutlig integrationsbeslutare. | Jakob visar verifierbara milstolpar och ber om beslut; dokumentet ändrar inte Kevins branch eller agentregler. |
| Emil | Arbetar nära Kevin med videor och varianter. Ny media landar i Kevins branch genom deras flöde. | Jakob använder färdiga artefakter och metadata. Direkt samarbete hålls tunt. |
| Jakob | Backend/logik på `jakeminator123/work`: eventträd, mappning, fallback, tester och beslutsunderlag. | Arbetar isolerat mellan milstolpar och föreslår integration, men mergar inte åt Kevin. |

Statusord i planen: **[ÖPPEN]** inte påbörjad, **[PÅGÅR]** har aktuell branch/evidens, **[GRÖN]** verifierad, **[BLOCKERAD]** behöver ett uttryckligt beslut eller en extern artefakt. Status ska uppdateras från kod och tester, inte från önskemål.

## Steg 1–9

| Steg | Status vid start | Jakobs arbete | Bevis för att steget är klart | Milstolpe eller beroende |
| --- | --- | --- | --- | --- |
| **1. Frys verklighetsbilden** | **[PÅGÅR]** | Registrera aktuell commit/branch, läs Croupiers events, uppspelning och säkerhetsgränser. Märk varje påstående `verifierat`, `förslag` eller `att verifiera`. | En kort nulägeslista med källfiler och inga V2-namn presenterade som runtimefakta. | Ingen åtgärd krävs av Kevin. |
| **2. Avgränsa MVP-eventen** | **[ÖPPEN]** | Välj den minsta eventmängd som ger ett helt spelbart flöde. Börja med de eventtyper som faktiskt finns, exempelvis `deal`, `reveal`, `settle`, `speak`, `turn` och `idle`, och notera vilka som bara behöver baspresentation. | En tabell där varje valt event har källa, önskad presentation och ägare. | **M1 · verklighetskarta:** Jakob ber Kevin bekräfta scope och exakta runtime-namn. |
| **3. Rita eventträdet** | **[ÖPPEN]** | För varje bekräftat event: dokumentera baspresentation, offentliga triggerfakta och möjliga videovarianter. Ingen ny RNG och ingen dold information. | Trädet kan följas från event till samtliga möjliga slutval; varje gren har en testbar trigger. | Ändringar efter **M1** införs innan kodning. |
| **4. Bygg mappningen på Jakobs branch** | **[ÖPPEN]** | Implementera minsta adapter/mappning runt befintligt presentationsflöde. Återanvänd Kevins urvalsregel där den finns; annars föreslå ett deterministiskt, testbart val utan att röra spelutfallet. | Enhetstester visar basval, en sann variant, flera sanna triggers och oförändrat spelresultat. | **M2 · eventträd:** Kevin granskar gränsen mot motorn. Ingen merge till Kevins branch. |
| **5. Koppla godkända videovarianter** | **[ÖPPEN]** | Läsa media och metadata som Kevin och Emil har lagt i Kevins branch, sedan koppla endast godkända id:n i Jakobs mappning. | Katalogtest visar att alla refererade kandidater finns, har rätt status och kan valideras av befintlig spelare. | **Beroende:** färdig media kan komma senare; baspresentationen ska ändå fungera. |
| **6. Gör fallback obruten** | **[ÖPPEN]** | Implementera och testa kandidat → annan kandidat → bas → neutral → UI-only. Logga varför fallback skedde utan hemlig speldata. | Tester täcker saknad fil, fel hash/kalibrering, uppspelningsfel och timeout; rundan fortsätter korrekt. | OpenClaw ingår inte. |
| **7. Kör hela MVP-flödet** | **[ÖPPEN]** | Köra relevanta repo-tester och rehearsal/end-to-end för de valda eventen, inklusive flera rundor och upprepade uppspelningar. Dokumentera verkliga gap. | Reproducerbar testnotering med kommando, commit, resultat och kända avvikelser. Spelutfall och settlement är oförändrade. | **M3 · video + rehearsal:** Kevin och Emil bekräftar media; Jakob visar logiken och evidensen. |
| **8. Anpassa efter Kevins granskning** | **[ÖPPEN]** | Ta in uttryckliga beslut från M3, hämta och jämför Kevins aktuella branch utan att skriva om delad historik och rätta endast överenskomna gap. | Ny grön testkörning på aktuell bas samt beslut dokumenterade i wiki eller versionsdokument. | **Blockeras** om integrationen kräver ett oklart produktbeslut. Ingen automatisk styrning av Kevin. |
| **9. Lämna integrationsförslag** | **[ÖPPEN]** | Förbered en liten, granskbar merge request/patch från `jakeminator123/work`, uppdatera V3-status och lista sådant som flyttas efter MVP. | Kevin kan granska diff, testbevis, eventkarta och fallback utan att läsa chatthistorik. Merge sker först efter hans beslut. | **M4 · handoff:** Kevin väljer integrera, justera eller avstå. |

## Definition av klar MVP

- **[KRAV]** Lösningen bygger på Kevins faktiska motor/events och befintliga presentationsflöde.
- **[KRAV]** Valda MVP-event har baspresentation och obruten fallback till UI-only.
- **[KRAV]** Minst ett event kan ha flera godkända videovarianter som öppnas av testbara triggers.
- **[KRAV]** Ingen presentationsgren kan påverka kort, shoe, regler, saldo eller settlement.
- **[KRAV]** Media från Kevin/Emil konsumeras via katalog/metadata; Jakob skapar inte en parallell mediesanning.
- **[KRAV]** Kod, tester och beslut går att granska på `jakeminator123/work` innan integration.
- **[KRAV]** Wiki och V3-dokument beskriver samma aktuella beslut och skiljer plan från implementation.

## Efter MVP

Följande är **[SENARE]** och får inte göra de nio stegen beroende av sig:

- OpenClaw i skuggläge för att jämföra presentationsförslag mot basval.
- Friare språk/persona eller chattstyrda presentationer.
- Fler triggers, fler dealers och långsiktigt spelarminne.
- Byte av Kevins RNG/motor eller jakt på en “ultimativ” RNG.

Om OpenClaw senare provas ska kod först begränsa kandidaterna, ha ett basval och ignorera sena eller ogiltiga svar. Kevin fattar separat beslut om någon sådan del får gå vidare till integration.
