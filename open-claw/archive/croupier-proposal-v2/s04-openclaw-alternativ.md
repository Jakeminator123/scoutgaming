# animation-events-v1-s04 · OpenClaw som alternativt personlighetsskikt

> **Nytt förslag, inte implementerat.** Kompletterar s01–s03; ersätter inte Partner API, RNG, regelmotorn eller godkännandet mellan Jakob och Kevin. Det riktiga croupierrepot har inte granskats här.

## Den ena meningen

**Servern säger vad som hände. Regelmotorn säger vad som får visas. OpenClaw föreslår hur hon uttrycker det — inom de möjligheter som redan är godkända.**

## Kedjan

```text
rng.* — publicerade fakta
  ↓
regelmotorn — show.*, trigger, prioritet, linjen och tillåtna varianter
  ├── korrekt basval direkt ──────────────────────────────┐
  └── avgränsad fråga → OpenClaw → kandidat eller avstå ──┤
                                                        ↓
                           kodgrind → frys vid ordinarie start
                                                        ↓
                                     godkänd take → samma landning
```

Ingen extra väntan på modellen. Finns inget giltigt råd före frysningen används basvalet. Fri chatt har en egen modererad utgång och ger inte nya spelbefogenheter.

## Vad OpenClaw tillför

Förstå tilltal och frågor i chatten. Hålla en publicerad persona. Föreslå en godkänd uppmärksamhetsreaktion. Välja mellan de uttryck som regelmotorn uttryckligen lämnat öppna. Formulera ett kort svar i textchatten.

Vanlig regelkod fortsätter göra det den är bättre lämpad för: fakta, exakta villkor, prioritet, budget, cooldown, timing och reproducerbar fallback. OpenClaw behövs inte för varje blinkning eller slumpmässigt take-val.

## Spakarna

| Får föreslå | Får aldrig ändra |
|---|---|
| Godkänt kandidathandtag | Kort, shoe, seed eller rouletteficka |
| Tillåten ton i chatt | Insats, saldo, payout eller `collect` |
| Uppmärksamhet på nästa giltiga think/watch | Pågående take, normal start eller landning |
| Avstå och låta linjen gälla | Prioritet, budget eller sina egna befogenheter |

En variant per event. **Spel före session före chatt före tid.** Ett råd får inte smita runt s03:s regler.

## Exempel: någon skriver mitt i dealen

Kort Y till box X är redan låst. Chatt från box B kommer in. OpenClaw kan tolka ett relevant tilltal, men filmen spelas klart. En kortlivad signal kan prövas igen vid nästa `show.hand.think` eller `show.deal.watch`. Först där kan en godkänd `uppmärksam`-take användas. Spam får ingen särskild reaktion.

Den dyrare ”ett ögonblick”-varianten i själva dealen är fortfarande fas 2 och kräver nya kalibrerade takes. AI skapar inte dessa assets åt motorn.

## Tre hårda kontroller

**Rätt tillfälle:** bord, runda, faktasekvens, show-sekvens, deadline och frysning stämmer fortfarande.

**Rätt rättighet:** kandidaten finns i serverns tillåtna mängd och policy/katalogrevision har inte bytts.

**Rätt presentation:** hela taken är godkänd, tillgänglig och kalibrerad. Ingen ny röst läggs ovanpå redan inspelad mun.

Alla kontroller utförs i kod. Ett ”jag följde reglerna” från modellen räknas inte.

## Docker och dashboard

Privat OpenClaw-gateway på Render. Separat produkt-API och skyddad operatörsdashboard. Inga CRM-, spelmotor- eller administrationsverktyg i croupierprofilen. Dashboarden hanterar persona, språk, godkänt manifest, kostnadsbudget och lägena av/skugga/begränsad/aktiv.

Originalblueprintens driftmönster återanvänds, men tokenexponering, versioner och beständiga dashboardändringar måste hårdnas enligt paket 1.

## Fallback

**Variant-take → annan tillåten take → linjen → tyst → DOM.**

Kortet och korrekt spelstate kommer först. Samma basflöde ska fungera utan AI, röst eller avatarleverantör.

## Införande

1. Verifiera den verkliga integrationspunkten och acceptansen med Kevin.
2. Leverera korrekt Astrid-baslinje utan AI, med flera takes och tyst alternativ.
3. Kör OpenClaw i skuggläge: mät utan att påverka spelaren.
4. Aktivera textchatt och uppmärksamhet i think/watch.
5. Utöka uttrycksval, dealers och deal-varianter endast efter separata godkännanden.

## Öppna beslut

Den verkliga koordinatorns placering, vilka takes som finns och är godkända, gemensam eller individuell dealer per rum, aktiv marknad/pengaspel eller play-money, retention och publiceringsgränsen för spelfakta.

Källorna har också en räkningsskillnad: s00 anger 64 namn; s02 listar 65. S04 byter inga eventnamn och försöker inte dölja den skillnaden. Även eftertriggerns arming och en eventuell ny hashpolicy behöver beslutas separat.

**Slutsats:** samma typ av fristående hjärna som i Sajtmaskins avatarbrygga, men med ett mycket smalare kontrakt: inte ”säg och gör vad du vill”, utan ”föreslå ett av dessa giltiga uttryck”.
