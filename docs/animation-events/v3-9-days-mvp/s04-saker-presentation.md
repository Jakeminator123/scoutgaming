# V3 · säker presentation från event till video

> **[BESLUTAT FÖR V3]** GitLab-projektet `scout-gg/croupier`, dess wiki och den körbara koden är den gemensamma grunden. Den här sidan beskriver målbilden för Jakobs arbete på `jakeminator123/work`; den ändrar inte Kevins motor och är inte en automatisk instruktion till Kevins agenter.

## Målet för den första avgränsade etappen

Kevins befintliga motor avgör spelutfall och publicerar de fakta eller events som presentationen behöver. Presentationslagret väljer därefter en redan godkänd video. En trasig eller saknad video får aldrig ändra, fördröja eller räkna om spelet.

`Kevins motor och events` → `presentationstabell` → `tillåtna videovarianter` → `val med befintlig motorregel` → `validerad uppspelning` → `säker fallback`

Status för delarna:

| Status | Del |
| --- | --- |
| **[VERIFIERAT I REPOT]** | `web/partner-presentation.mjs` skapar presentations-events av en tabellrespons. Nuvarande eventtyper omfattar `speak`, `deal`, `reveal`, `settle`, `turn` och `idle`. |
| **[VERIFIERAT I REPOT]** | `web/public/dealer-engine.mjs` läser ett klippindex och spelar klipp, och `web/public/performance-player.mjs` validerar media och kalibrering innan kontakt-takes spelas. |
| **[BESLUTAT FÖR V3]** | V3 ska utgå från dessa befintliga flöden och Kevins RNG/events, inte bygga en konkurrerande “bästa RNG”. |
| **[JAKOBS FÖRSLAG]** | En liten, testbar mappning läggs mellan befintliga presentations-events och godkända videovarianter. Fältnamnen på den här sidan är arbetsord tills Kevin har verifierat dem mot runtime. |
| **[SENARE, EJ FÖRSTA ETAPP]** | OpenClaw kan utvärderas efter den första etappen. Det får i så fall bara föreslå presentation inom en redan godkänd mängd och får aldrig påverka spelutfall. |

## Gränsen som inte får flyttas

| Motorn äger | Presentationen får göra | Presentationen får aldrig göra |
| --- | --- | --- |
| Kort, shoe, utfall, turordning, lagliga handlingar, saldo och settlement. | Välja mellan videor som redan är godkända för det publicerade eventet och dess offentliga kontext. | Dra om RNG, räkna fram ett eget resultat, ändra settlement eller hitta på ett event. |
| Eventets ordning och det faktum som ska visas. | Välja neutral, talad eller annan godkänd variant när dess trigger är sann. | Hårdkoda ett visuellt utfall som kan motsäga eventet. |
| När rundan får fortsätta. | Falla tillbaka till en enklare presentation. | Blockera spelet i väntan på video, AI eller nätverk. |

## Minsta mappningsmodell

Nedanstående namn är **[JAKOBS FÖRSLAG]**, inte påståenden om färdiga runtime-kontrakt.

| Arbetsfält | Syfte | Regel |
| --- | --- | --- |
| `sourceEvent` | Pekar på ett eventnamn som faktiskt finns i Kevins runtime. | Får inte fyllas från gamla V2-exempel utan verifiering i kod eller logg. |
| `presentationKey` | Stabilt namn för det som ska visas, oberoende av fysisk fil. | Ska beskriva presentation, inte spelutfall som klienten själv räknat fram. |
| `when` | En trigger byggd av redan publicerade fakta. | Får aldrig läsa seed, kommande kort eller dold information. |
| `candidates` | Godkända take-/klipp-id:n för varianten. | Varje kandidat måste finnas i katalogen och ha rätt status. |
| `base` | Normal presentation för eventet. | Måste fungera utan specialtrigger och utan AI. |
| `fallback` | Nästa säkra presentationsnyckel. | Kedjan ska sluta i neutral rörelse eller UI utan dealer-video. |

Ett schematiskt exempel, inte ett nytt API:

```text
settle-event från runtime
├─ nära resultat + godkända nära-varianter  → välj en nära-take
├─ förlustsvit + godkända svit-varianter    → välj en svit-take
└─ annars                                   → baspresentation för förlust
                                              └─ neutral dealer-rörelse
                                                  └─ UI visar resultatet utan video
```

Flera triggers kan vara sanna samtidigt. Den första etappen ska därför ha en enkel och dokumenterad prioritet eller låta Kevins befintliga urvalsregel avgöra bland den redan filtrerade mängden. Jakob ska inte lägga till en andra, fristående RNG. Samma indata ska kunna följas i en logg: vilket event kom, vilka varianter var tillåtna, vilket klipp valdes och om fallback användes.

## Fallback-kedjan

1. Spela vald, godkänd kandidat för den sanna triggern.
2. Om kandidaten saknas eller underkänns: prova en annan godkänd kandidat i samma variant.
3. Om varianten saknar giltig kandidat: använd eventets baspresentation.
4. Om baspresentationen saknas: använd en neutral, godkänd idle-/gestpresentation.
5. Om även video är otillgänglig: visa spelets korrekta UI och fortsätt rundan utan dealer-video.

Följande fel ska gå genom kedjan och lämna spår i loggen: okänt klipp-id, saknad fil, fel hash, underkänd kalibrering, avbruten uppspelning och timeout. Fallback får inte skapa ett nytt spel-event eller byta resultat.

## Videoleverans och ansvar

| Person | V3-arbete | Gräns |
| --- | --- | --- |
| Kevin | Äger GitLab-repot, motorn, de verkliga eventnamnen och slutlig integration. Arbetet granskas med honom vid milstolpar. | V3-dokumenten ger inte hans agenter nya order och ändrar inte hans branch automatiskt. |
| Emil | Tar fram video och varianter tillsammans med Kevin. Nya videor landar i Kevins branch med de metadata och den granskning deras befintliga flöde kräver. | Jakob leder inte Emils produktion och kopierar inte råmedia mellan parallella sanningar. |
| Jakob | Arbetar på `jakeminator123/work` med backend/logik, eventträdet, förslagen till mappning, fallback och tester. | Integrerar först efter en milstolpegenomgång med Kevin. Kontakten med Emil sker främst via färdiga artefakter i Kevins branch. |

## Acceptans för den första avgränsade etappen

- **[KRAV]** Varje event i den valda etappytan har en baspresentation eller en dokumenterad UI-only-fallback.
- **[KRAV]** En variant kan bara väljas när dess trigger bygger på publicerade fakta och är sann.
- **[KRAV]** En videofil är katalogiserad och godkänd innan den kan väljas.
- **[KRAV]** Ett videofel påverkar inte spelutfall, settlement eller fortsättningen av rundan.
- **[KRAV]** Loggen visar event, tillåtna kandidater, val och fallback utan att exponera hemlig speldata.
- **[KRAV]** Tester bevisar minst: normal kandidat, alternativ kandidat, saknad kandidat, trasig media och full UI-only-fallback.
- **[ATT VERIFIERA MED KEVIN]** Exakta runtime-event, nuvarande urvalsregel och var mappningen bäst kopplas in.

## OpenClaw efter den första etappen

OpenClaw är **[SENARE, VALFRITT]**. Ett framtida experiment kan få rekommendera ett take-id ur den mängd som kod redan har godkänt. Basval och fallback ska alltid finnas, svaret ska ha deadline och ett sent eller ogiltigt svar ska ignoreras. Första läget ska vara loggning/skugga; ingen spelare ser valet innan Kevin uttryckligen har godkänt en integration.

OpenClaw får aldrig se eller påverka seed, shoe-ordning, kommande kort, privata kort, saldo, payout eller lagliga handlingar. Den första V3-leveransen ska vara komplett utan OpenClaw.
