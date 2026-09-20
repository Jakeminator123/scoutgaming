# OpenClaw som avgränsat mellanlager för croupiern
### Arkitekturförslag v1.0 · 2026-09-19

> **Källstatus:** s00–s03 i bilagan är primärt underlag. De beskriver ett inofficiellt önskat system, inte nödvändigtvis den kod som körs. `spelsajt` är en jämförelsereferens och `sajtmaskin` en gateway-/avatarreferens. Det riktiga croupierrepot har inte granskats. Källnycklar finns i `KALLOR-OCH-BESLUT.md`.

## 1. Slutsats

Ja, OpenClaw kan användas som den föreslagna ”hjärnan”, men den ska vara **personlighet och samtal — inte spelauktoritet och inte frame-scheduler**.

Placera den funktionellt mellan regelmotorns tillåtna presentationsmöjligheter och det slutliga presentationsvalet. Placera den däremot inte som ett obligatoriskt, blockerande steg mellan spelfaktum och kortets landning. Den ordinarie motorn ska kunna köra exakt samma korrekta spel när OpenClaw är avstängd, långsam eller felkonfigurerad.

I din s03 finns redan huvuddelen som ska förbli vanlig kod: linjen, variant, trigger, prioritet, tystnad, cooldown, budget och landning. OpenClaw behöver inte hitta på detta system. Dess mervärde är att förstå relevant chatt, hålla en avgränsad personlighet och välja mellan uttryck som systemet redan har godkänt. [B2 s03]

## 2. Orden behålls

| Ord | Innebörd i lösningen |
|---|---|
| `rng.*` | Faktum som det auktoritativa spelet redan fastställt och som får offentliggöras |
| `show.*` | Det som ska visas, exempelvis `show.line.lose` eller `show.hand.think` |
| linjen | Eventets normala pool av takes, inklusive tyst alternativ där det är definierat |
| variant | En tillåten gren under ett show-event, öppnad av en sann trigger |
| trigger | Kodkontrollerat villkor från spel, session, chatt eller tid |
| take | Hel godkänd inspelning: text, ljud, video och kalibrering |
| landning | Det oföränderliga presentationsankaret som linjen och varianten måste respektera |

`DirectorAdviceV1` och `PresentationOpportunityV1` i paketets exempel är **interna API-meddelanden**, inte nya spel- eller show-eventnamn. Det införs inget tredje namnlagersystem bredvid `rng` och `show`. [B2 s02]

`spelsajt` använder faktiskt `GameEventV2`. `rng.*` är här en gemensam begrepps-/adapterkarta, inte en order att byta befintliga wire-namn i det repot.

## 3. Den föreslagna kedjan

```text
Auktoritativ spelserver / Partner API
     │ endast tillåtna publicerade fakta
     ▼
Adapter till gemensam faktamodell
     ▼
Befintlig regelmotor
     │ show-event, prioritet, tillåtna grenar, normal start och landning
     ├──────────────────────────────────────────────────────┐
     │                                                      │
     ▼                                                      ▼
Omedelbart giltigt basval                         Avgränsad möjlighet till råd
(linjen/variant enligt s03)                       + sanerad chatt/personlighet
     │                                                      │
     │                                            OpenClaw i privat Docker
     │                                                      │
     │                                              kandidat eller avstå
     │                                                      ▼
     │                                             Deterministisk kodgrind
     │                                                      │
     └──────────────► Frys ett slutval vid ordinarie start ◄──┘
                              │
                              ▼
                 Befintlig take-spelare / Avatar Director
                              │
                              ▼
                 Bild, ljud och DOM vid rätt landning
```

Chattsvar är en separat, modererad utgång. Det kan returneras till kasinochatten utan att ett talande videotake spelas. Spelmekanik eller kundens satsningsbeslut går aldrig genom den vägen.

**Inte tillåtet:** spelserver → vänta på LLM → välj kort → spela video → bokför. Inte heller: LLM → skriv valfri scenkod eller valfri fil-URL till klienten.

## 4. Placering i de olika projekten

### Det verkliga croupiersystemet enligt bilagan

s01 beskriver en adapter runt snapshots från Partner API och ett befintligt visuellt flöde med exakta take-nycklar och `landAt`/frame-kalibrering. Lägg rådgivningen **efter** att systemet identifierat rätt show-event men **före** att det låser en valfri, redan tillåten uttrycksgren. Spelfaktat, kortet, mottagande box och landningen förblir låsta. [B2 s01–s03]

Exakta filer, exports och vem som äger presentationsloopen måste verifieras i det riktiga repot. Detta dokument hittar inte på en sökväg där OpenClaw sägs kunna klistras in direkt.

### Jämförelsen med `spelsajt`

Dess dokumenterade kedja är `GameEventV2 → planGameEvent(...) → PresentationCue → sceneVisualIntent(...) → CroupierVisualPose`. Där passar en runtime-adapter i den **valfria server-side Personality Service** som dokumenten beskriver, efter den deterministiska basreaktionen. Game-core och ledger ska inte ändras för denna koppling. [G4–G5]

`spelsajt` beskriver främst riggad GLB/3D och talförfining. Bilagan beskriver hela inspelade takes. Det är två olika presentationskontrakt; detta förslag använder bilagans take-kontrakt som förstahandsval och 3D som separat adapter.

### Jämförelsen med Sajtmaskin

Sajtmaskins D-ID-brygga använder OpenClaw för text och en separat leverantör för uppspelning. Det bekräftar mönstret med en fristående hjärna, men inte att D-ID:s fria textflöde kan användas över croupierns redan inspelade munrörelser. [G2–G3]

## 5. Precis vilka spakar får OpenClaw röra?

| Spak | Modellen kan föreslå | Kodens sista ord |
|---|---|---|
| Chattens avsikt | Exempelvis tilltal, fråga, tack eller behov av support | Moderation, rätt målgrupp, längd, ingen verktygseskalering |
| Uppmärksamhet | En kandidat för en nick/blick i nästa giltiga `think`/`deal.watch` | Aktuell plats, signalens TTL, cooldown och rätt tillfälle |
| Uttryck | En av de just nu erbjudna kandidaterna | Endast redan sanna triggers och tillåten prioritet |
| Ton i fri text | Kort, neutral eller varm enligt publicerad persona | Textpolicy och granskning av faktapåståenden |
| Inspelad line/take | Ett opakt kandidathandtag som servern redan känner | Godkänt manifest, full inspelning, rätt landning och tillgänglig asset |
| Avstå | Inget råd | Ordinarie motor fortsätter |

**Aldrig:** seed/shoe, kortidentitet, rouletteficka, payout, saldo, `collect`, legal actions, fasbyte, start av runda, längre bettingfönster, godtyckliga benrotationer, nya asset-URL:er, utökade rättigheter eller direkta chattpubliceringar utan grind.

En kandidat är inte en fri instruktion som ”le 74 % och böj armen 18 grader”. Den betyder exempelvis ”godkänd lugn blick mot verifierad box inom detta event”. Manifestet och renderern översätter den till den faktiskt tillgängliga presentationen.

## 6. Reglerna som ska bevaras från s03

Utgångspunkten är en variant per event och prioriteten **spel → session → chatt → tid**. Sanna triggers, tre rundors take-cooldown, budgeten tre session/chatt/tid-varianter per tio rundor och fallbacktrappan ska ligga i kod. Personlighetsvikter är publicerad konfiguration, inte något modellen ändrar under samtalet. [B2 s03]

Gör först kodens normalval och beräkna vilka frihetsgrader som faktiskt återstår. OpenClaw får inte öppna en lägre prioriterad chattvariant som undantränger en beslutad spelvariant. Tystnadsval och variantbudget får inte överstyras genom att modellen alltid ”vill säga något”.

Om exakt s03-urval ska bevaras väljer koden grenen och OpenClaw kan högst förfina bland likvärdigt tillåtna kandidater eller ge chattförståelse. Om ägaren vill ge modellen större valfrihet inom en öppen gren ska det beskrivas som **en ny urvalspolicy**, loggas och jämföras mot baslinjen. Det ska inte smygas in som om determinismen var oförändrad.

### Två detaljer att besluta uttryckligen

**Presentationsslump:** bilagan återanvänder samma `r` för benägenhet, tystnad och take. Det kan ge kopplade, villkorade sannolikheter. Ett föreslaget senare alternativ är domänseparerade hashdrag för `variant`, `silence` och `take`, baserade på offentliga presentations-id:n. Det är en algoritmändring som behöver golden tests, inte en rättelse som redan gjorts. Använd aldrig hemligt RNG-material till LLM-kontext eller kosmetisk slump.

**Otursminnet:** underlaget har både beskrivningar av att `otur` armar `comeback` och pseudokod som armar utifrån den spelade varianten. Bestäm om en sann trigger eller ett faktiskt valt/spelat take ska arma eftertriggern. OpenClaw ska inte få välja tolkning själv.

## 7. Tid, avbrott och ett sent råd

**Ingen extra väntan på AI inför kritisk handling.** Ett råd får användas om det redan finns före den starttidpunkt som den vanliga motorn ändå skulle använda. Inget råd i tid betyder direkt basval. Finns inget naturligt planeringsfönster ska inget modellanrop göras för den aktuella handlingen.

En vald take fryses när eventet startar. Ett sent svar får inte byta filmen mitt i dealen, flytta landningen eller skrivas om till ett ”nästan samma” nytt event. Rådet kastas för den stängda möjligheten.

En separat, fortfarande giltig chattsignal kan däremot få bilda en **ny** möjlighet vid nästa `show.hand.think` eller `show.deal.watch`. Den ska få nytt id, ny kontroll och ny deadline. Förväxla inte en återanvändbar signal med ett förbrukat presentationsråd.

Som ett initialt driftsförslag kan fri chatt ha exempelvis två sekunders modellbudget, medan uttrycksråd bara får använda redan tillgängligt spelrum. Detta är inställningar att mäta, inte leverantörslöften om realtid. Gör inga modellfallbackkedjor som förlänger en utgången uttrycksdeadline.

## 8. Exemplet: någon skriver till henne under dealen

1. Spelet har redan fastställt kort Y till box X. Dealen startar med låst take och landning.
2. En chatthändelse kommer från verifierad box B. Texten filtreras. OpenClaw får bara den sanerade text och kontext som behövs för att förstå tilltalet.
3. Modellen kan föreslå ”riktat tilltal”. Det räcker inte ensamt: kod kontrollerar att personen tillhör bordet, att signalen är aktuell och att ett event får reagera.
4. Den pågående dealen spelas klart. Ingen film byts, inget kort väntar.
5. Vid nästa giltiga `think`/`deal.watch` finns eventuellt en kandidat för `uppmärksam`. Prioritet och budget kontrolleras på nytt.
6. Godkänt take ger en diskret blick eller nick. Chatten kan samtidigt få en kort text: ”Jag såg din fråga. Vad undrar du?”
7. Spam eller otrevlighet ska inte belönas med fler reaktioner. Moderation hanteras separat. ”Ett ögonblick” i själva dealen är fortfarande fas 2 med nya kalibrerade takes, som bilagan anger. [B2 s03]

## 9. Tre presentationsadaptrar — blanda inte kontrakten

| Adapter | Vad OpenClaw levererar indirekt | Vad måste produceras eller byggas |
|---|---|---|
| Inspelad croupier | Godkänd kandidat som mappar till hel take | Kalibrerade takes, manifest, landningar och rättigheter |
| Inhouse 3D/GLB | Godkänd semantisk uttryckskandidat; ev. separat text | Rigg, lokala klipp, director, audio/visemes och avbrottsregler |
| Inköpt avatar, exempel D-ID | Validerad taltext via leverantörsadapter | Sessioner, kvoter, felhantering, leverantörskontrakt |

En inspelad take innehåller redan röst och munrörelse. Fri AI-text får visas som chatt, men ska inte läggas som nytt tal ovanpå den filmen. Nytt dynamiskt tal kräver en separat, uttryckligen vald pipeline som kan synkronisera ljud och ansikte. [B2 s02–s03; G4–G5]

OpenClaw skapar inte saknade fysiska uttryck bara för att prompten beskriver dem. Saknas en godkänd take används fallback. En modellvald ”lugnare” ton får inte implementeras genom att godtyckligt tidssträcka en film som har kalibrerad kortlandning.

## 10. Flera spelare: ett auktoritativt presentationsbeslut

Bilagan fastställer inte en komplett multiplayer-koordinator. Följande är ett **nytt förslag** för bord där flera personer ska se samma dealer:

En separat presentationskoordinator är enda skrivaren för bordets show-beslut. Den konsumerar offentliga spelfakta och publicerar validerade presentationsbeslut till bordets klienter. Varje klient ska inte fråga OpenClaw separat och få olika take för samma gemensamma händelse.

Håll `gameSeq`/faktasekvens och `showSeq` isär. Uppspelning och återanslutning kräver en aktuell presentationssnapshot. Vid sekvensgap hämtas snapshot; systemet gissar inte saknade spelutfall eller spelar om alla redan passerade gester.

Spelservern fortsätter skicka fakta, inte take-namn. Den separata **presentationstjänsten** kan skicka ett godkänt take-id på sin egen kanal. Det är en tydligt märkt utbyggnad av s03:s serverregel, inte ett införande av filmnycklar i spelprotokollet.

Privata chattsvar går bara till rätt mottagare. Rumschatten får inte avslöja en spelares privata supportfråga eller ekonomiska historik. Reduced motion kan ge olika visuellt utförande, men samma korrekta spelfakta.

## 11. Informationen agenten aldrig ska se

Skicka inte server seed, full shoe, kommande kort, hålkort före reveal, intern wallet, privata andra spelarchattar eller administrativa tokens.

Var särskilt försiktig med snapshotbaserade system: backend kan redan känna till mer än det som ännu ska vara synligt. Kontextadaptern behöver därför en **publiceringsgräns**, inte bara en regel som tar bort fält med namnet `secret`. Ett resultat som är beräknat men ännu inte publicerat till den aktuella publiken får inte avslöjas i ord, ansiktsuttryck eller förhandsval.

Ge inte LLM information om ”kommande vinst” ens när den ska säga något oskyldigt. Blick eller entusiasm kan också läcka ett utfall. Kontext byggs endast från den auktoriserade publikens publicerade faktasekvens.

## 12. Ansvarsfull presentation och fri chatt

Agenten ska inte uppmuntra till högre insats, fler rundor eller att vinna tillbaka förluster. Den ska inte påstå att ett resultat snart vänder eller ge sken av att kunna påverka odds. Regelbeskrivningar ska komma från godkänt, versionsbundet spelunderlag; osäker fråga hänvisas vidare.

Bilagan innehåller `nära`, `otur`, `comeback` och `storinsats`. Dessa behålls som dokumenterade källidéer, men detta förslags **förval för en verklig pengaspelsprodukt** är att förlust-/insatsbaserad personanpassning är avstängd tills ansvarig produkt-, integritets- och licensfunktion godkänt exakt beteende. Det är ett nytt försiktighetsbeslut, inte en uppgift om vad källan redan kräver.

Detta dokument är ingen licens- eller efterlevnadscertifiering. Bedömning av marknad, ålderskrav, persondata, presentation och leverantörsrättigheter görs för den faktiska produkten. Den lästa `spelsajt`-referensen beskriver uttryckligen play-money. [G6]

## 13. Dashboardprofil för croupiern

Operatören kan ändra publicerad persona, språk, godkänd kunskapsversion, aktiverat take-manifest, tillåten textkanal, kostnadstak och om rådgivningen körs av, i skuggläge eller aktivt.

Operatören kan inom granskade gränser välja chattsvarsfrekvens, tillåtna uttryckskategorier och profilvikter. En sådan ändring ger en ny revision och påverkar bara nya beslut. Kalibrering, spelregler och större behörighetsutökning hör inte till en vanlig personlighetsslider.

Visa fyra tydliga lägen: **AI av**, **skuggläge**, **begränsad chatt/uppmärksamhet**, **godkända uttrycksval**. Global avstängning stoppar nya AI-beslut och nya AI-chattsvar men låter påbörjad korrekt spelhandling slutföras.

## 14. Första leveransen

Börja där bilagan själv börjar: en Astrid-baslinje för win/lose med flera godkända takes och tyst alternativ. Gör den korrekt helt utan AI. Lägg därefter OpenClaw i skuggläge och logga vad den hade föreslagit, utan effekt på uppspelningen. [B2 s00, s03]

Aktivera sedan textchatt och `uppmärksam` i `think`/`deal.watch` under liten, godkänd testtrafik. Först därefter prövas större uttrycksval och andra dealers. Nya deal-varianter kräver sina egna takes och landningsprov.

Det går att få mycket av variationen med bara regelmotorn. OpenClaw ska införas där semantisk förståelse och samtal ger mervärde, inte användas som en dyr slumpgenerator för varje blinkning.
