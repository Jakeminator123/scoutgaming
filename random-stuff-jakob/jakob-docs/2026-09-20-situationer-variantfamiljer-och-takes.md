# Samsyn: situationer, variantfamiljer och takes

20 september 2026. Förtydligande av Jakobs mentala modell efter
[eventregistret](2026-09-20-eventregister-och-mental-modell.md).
Dokumentet är ett designunderlag, inte en ändring av spelmotor, schema eller
mediefiler. Kontrollerat mot lokal kod vid `c0a5681`.

## Vad Jakob uttryckligen vill kunna se

Jakob gillar mappmodellen **spel → dealer → presentationsbehov → variant →
take**, tills vidare. Han vill kunna öppna ett behov och förstå vilka
konkreta situationer det omfattar, vilka alternativ som finns och vilket
material som saknas. Han har uttryckligen skiljt denna mentala vy från
hur filer faktiskt måste ligga på disk.

Hans exempel är kortutdelning: "dela ett kort" räcker inte för att beskriva
varje behov. Vilken plats, vilken hand och vilket kort i handen spelar roll.
Han vill förstå om dessa dimensioner multiplicerar antalet nödvändiga
videor. Antalet labbnoder besvarar inte den frågan.

Detta är vår tekniska rekommendation utifrån önskemålet: behåll hans träd
och lägg in **den konkreta situationen före uttrycksvarianten**. Återanvänd
definitioner och filer genom ID-referenser när samma material faktiskt är
kompatibelt. Anta varken att varje löv kräver en unik video eller att en
bred rörelsefamilj redan täcker alla löv.

## Tre olika tal som inte ska blandas ihop

| Antal | Vad som räknas | Vad det inte räknar |
| --- | --- | --- |
| 10 | Interna händelsetyper i `Round`, exempelvis `card.dealt` | Inspelningar eller alla presentationer |
| 6 | Partner-adapterns presentationstyper: speak/deal/reveal/turn/settle/idle | Alla konkreta situationer för varje typ |
| 16 | Labbets grupperingar av de sex presentationstyperna | Händelser från slumpgeneratorn eller komplett videobehov |

**10 + 6 råkar bli 16. Labbets 16 noder är inte summan av de två listorna.**
En typ kan förekomma många gånger i samma omgång. Slumpdelen bestämmer
kortordningen; spelmotorn hanterar drag, regler och tillstånd.

Partner-adaptern skapar presentationer genom att jämföra föregående och ny
publik spelvy tillsammans med command-kontext. Den vidarebefordrar inte
motorns interna eventlista. Initiala kort omfattas inte heller av interna
`card.dealt` på samma sätt som hit/double/split. Den publika typen `deal`
är därför lämpligare som gemensam utgångspunkt för utdelningsregistret.

## En eventtyp kan behöva täcka många situationer

| Dimension | Exempel | Källa eller status |
| --- | --- | --- |
| Spel och dealer | Blackjack, Astrid | Projekt-/sessionsval |
| Mottagare | Box 0–6 eller dealern | Publika `to` och `box` |
| Hand | Ursprunglig hand eller en splithand | `handIndex` och publik handstruktur; index kan flyttas vid split |
| Kortposition | Första, andra eller senare kortet i handen | Härleds ur publika kort/drag; inget eget sådant fält finns i dagens `deal` |
| Anledning | Initial utdelning, hit, double, kort efter split | Command och jämförelse av publika vyer; inte ett färdigt `deal.reason` |
| Synlighet | Öppet kort eller dolt hålkort | `faceDown`; dolt `card` är null |
| Rörelsesekvens | Från vila, fortsatt delning, retur | Spelarens sekvens och granskade övergångar |
| Uttryck | Standard, lugn, varm | Variantfamilj; labbpolicy eller framtida produktpolicy |
| Inspelning | Take A/B/C | Take-registret och dess granskning |

Det finns **sju fysiska bordsplatser** i denna kod, inte sex. En plats är
inte automatiskt en egen spelare. En box kan dessutom ha flera händer.
`shoeDraw` identifierar draget; det är inte "kort nummer två i handen".

Så kan en gren se ut i den mentala vyn:

```text
Blackjack
└── Astrid
    └── Kortutdelning [publik typ: deal]
        └── Till spelare
            └── Box 3
                └── Andra kortet i vald hand [härledd situation]
                    ├── Standardfamilj
                    │   ├── Take A
                    │   └── Take B
                    └── Lugn variantfamilj
                        ├── Triggerreferenser
                        └── Take C
```

Hand, kortposition och rörelsesekvens kan också visas som filter eller
egenskaper på samma registerpost. Alla dimensioner måste inte bli permanenta
undermappar. Samma `takeId` kan visas under flera grenar om täckningen är
dokumenterad och godkänd. Det innebär inte flera kopior av filen.

## När behöver vi verkligen en ny video?

Destination och kortposition är kompatibilitetskrav. En lugn gest till fel
plats är inte en giltig variant för rätt plats.

- En filmad hand som lägger kortet på en bestämd punkt kan kräva en annan
  inspelning för en annan punkt.
- En granskad rörelse tillsammans med kalibrerad digital kortförflyttning
  kan eventuellt betjäna flera mål eller kortpositioner.
- Första och andra kortet kan dela take om grepp, släpp, landning och pose
  fungerar i båda situationerna. Annars behövs annan take eller övergång.
- Fortsatt utdelning och retur till vila kan behöva olika slutsekvenser även
  om själva kortleveransen kan återanvändas.
- Tal kräver rätt exakt replik och ljud-/videopaket. Samma ungefärliga
  längd eller en språkpreferens räcker inte.

Nuvarande klient placerar kort efter antal kort i handen och splithändernas
position. I Astrids staged performance-väg väljs en tillgänglig
vänster/mitten/höger-take utifrån kortets faktiska mål; dealerutdelning har
egen familj. Källor: [app.mjs](../../web/public/app.mjs),
[performance-contact.mjs](../../web/public/performance-contact.mjs).
Detta är befintlig mekanik, inte ett bevis på att alla kombinationer har
visuellt godkänd täckning.

Om varje kombination får en unik inspelning blir ett begränsat räkneexempel:

**7 spelplatser × 2 kortpositioner × 3 uttryck × 4 dealers = 168 videor.**

Det exemplet saknar dealerutdelning, senare kort, split och övergångar.
Det är ingen beställning på 168 videor. Godkänd återanvändning kan minska
antalet; extra takes av samma uttryck kan öka det. Alla tänkbara kombinationer
är inte heller möjliga eller relevanta i spelet.

Ett framtida täckningsregister bör därför kunna svara så här:

| Behov/situation | Kompatibla takes | Review | Faktisk bindning |
| --- | --- | --- | --- |
| Dealer + exakt mål/hand/kortposition/sekvens, eller exakt talrad | Stabil lista över take-ID:n med underlag för täckningen | Knuten till mediehash och kalibrering | Katalogrevision och körläge, eller ännu obunden |

Tabellen beskriver föreslagna fält. Ingen ny sådan runtimekatalog skapas
här. **256 labbvarianter och 64 syntetiska rörelser mäter inte videotäckning.**

## Triggers och OpenClaw kommer efter de faktiska kraven

Rekommenderad framtida urvalsordning:

```text
Publik händelse + härledd konkret situation
    ↓
Kontrollera dealer, mål/exakt tal, sekvens, tillåten status och media
    ↓
Standardfamilj och alternativa familjer med kompatibla takes
    ↓
Triggers avgör vilka alternativ som är valbara
    ↓
Regel eller giltigt OpenClaw-råd väljer familj
    ↓
Välj en kompatibel take inom familjen
    ↓
Uppspelning; saknad giltig take hanteras enligt uttryckligen definierad säker fallback
```

Kompatibilitet är obligatorisk även om en trigger matchar eller modellen
föreslår ett ID. En variant med flera takes ska filtrera poolen till den
aktuella situationen innan någon take väljs.

Det gäller även standardfamiljen. Den obligatoriska standardposten är en
konfigurationsfallback, inte ett undantag från kraven på dealer, mål, exakt
tal och sekvens. En familj utan kompatibla takes får inte bli valbar. Om
ingen giltig film finns måste registret visa luckan och använda en för
situationen uttryckligen definierad säker presentation; en ungefärligt
passande film är inte en godkänd fallback. Denna fullständiga kontroll är
ett framtida kontrakt, inte något som dagens labb redan garanterar.

Denna framtida kedja stämmer med
[röstprovets urvalsförslag](2026-09-20-rostprov-och-urvalsmodell.md): en
familj kan ha en eller flera takes, och viktat val inom den kompatibla poolen
är ett möjligt förslag. Presentationsslump är separat från spelets RNG.
Ersättning av samma presentation och en extra reaktion efteråt kräver
olika sekvenshantering.

**Dagens implementation är enklare:** en variant har ett `assetId` och
högst ett `videoGenerationId`. `rules` väljer högst prioriterade tillåtna
variant; `active` kan acceptera ett giltigt OpenClaw-val. Takepooler,
täckningsmatris, viktad slump och kö för extra reaktioner är inte införda.
Ett känt `videoGenerationId` ger en previewreferens; det bevisar inte att
videon uppfyller det framtida kontraktet för situation och godkänd take.

## Hur agenten och Jakob kan använda samma språk

1. Börja med vad spelaren ska se: "Astrid lägger andra kortet i den här
   handen på box 3". Ange sedan källa och eventnamn.
2. Säg om något är en **typ**, en **enskild händelse**, en **situation**,
   en **uttrycksvariant** eller en **inspelning**.
3. Visa både antal situationer och antal unika takes. Räkna inte mappar,
   animations-ID:n och verkliga filmer som samma sak.
4. Beskriv vilket material som täcker behovet och vad som saknas innan
   ytterligare trigger- eller AI-logik föreslås.
5. Använd Jakobs träd som presentationsvy. Dagens 16 labbnoder får vara
   grova ingångar; de behöver inte bli den slutliga detaljnivån.
6. Markera befintligt, labbexempel och förslag. Klargör även om ett förslag
   ändrar fysisk lagring, schema eller bara vyn.

Detta är kommunikations- och designrekommendationer, inte en instruktion
till andra uppgifter att ändra kod, generera media eller driftsätta något.

OPENCLAW-uppgiften har läst underlaget och bekräftat samsynen den 20 september:
spel → dealer → presentationsbehov → konkret situation → variantfamilj →
kompatibel take. Bekräftelsen gäller begreppsmodellen, inte ny produkt- eller
driftverifiering.
