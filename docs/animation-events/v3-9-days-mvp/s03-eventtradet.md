# Animation events V3 · s03 eventträdet

> **V3.** Detta är Jakobs separata backend-/logikförslag ovanpå Kevins befintliga Croupier-motor. Det är inte en ny RNG och det skriver inte om Kevins events. Kevins aktuella kod avgör spel, saldo och publiceringsgräns; Kevin avgör vid varje etapp om någon del ska införlivas.

Eventträdets uppgift är att svara på en begränsad fråga:

> När Croupier redan har publicerat en viss presentationshändelse, vilka godkända videor får presentera den — och vilken säker fallback gäller om inget extra val kan göras?

## Statusmarkeringar

| Markering | Betydelse |
| --- | --- |
| **VERIFIERAT** | Finns i aktuell Croupier-kod eller aktuellt manifest. |
| **VERIFIERAS** | Kandidat som måste kontrolleras mot aktuell branch och tester. |
| **JAKOBS FÖRSLAG** | Nod, trigger, urval eller test som ligger ovanpå runtime. |
| **KEVIN + EMIL** | Video-/takearbete, katalogstatus, kalibrering och visuell granskning. |
| **BESLUT KRÄVS** | Kevin avgör om förslaget ska in i produkten. |

## Arkitekturen

```text
                 KEVINS AUKTORITATIVA RUNTIME

command ──► shoe + Round + regler ──► publik gameView
   │                 │                       │
   │                 └── kort/saldo/payout   └── ingen shoe-ordning,
   │                     avgörs här              inget privat hålkort
   ▼
presentationEvents(prevView, view, op)
   │
   └──► presentation[]: speak · deal · reveal · settle · turn · idle
                              │
                              ▼
                 JAKOBS LÄSANDE EVENTTRÄD
                 sourceRef + publik payload
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              säker baslinje      valbara varianter
                    │             (bara sann trigger)
                    └─────────┬─────────┘
                              ▼
              KEVIN + EMILS GODKÄNDA TAKE-KATALOG
                              │
                       kalibrering/fallback
                              │
                              ▼
                    befintlig presentation
```

Det finns ingen pil tillbaka från video eller eventträd till shoe, `Round`, legal actions, saldo eller payout.

## Den verifierade ryggraden

Följande beteende är bekräftat mot revisionen i `RUNTIME-EVIDENCE.md` och kan användas som source references. Innan en integrations-MR ska samma kontroll göras mot Kevins då aktuella branch.

| Source reference | Verifierad roll | Eventträdets tillåtna läsning |
| --- | --- | --- |
| `command(...)` i `web/shoe-game.mjs` | Hanterar `state`, `start`, `act`, `insurance`, `collect`, versionskontroll och idempotens. | Ingen direkt mutation. Trädet får bara använda resultat som publiceras vidare. |
| `gameView(...)` i `web/shoe-game.mjs` | Publicerar säker table-/round-vy och döljer shoe-ordning, burn, privat hole card och interna payloads. | Publicerade fält efter att vyn skapats. |
| `presentationEvents(...)` i `web/partner-presentation.mjs` | Diffar föregående och ny publik vy och bygger en ordnad lista. | Eventobjektet och dess redan publicerade payload. |
| `presentation[]` i `/api/v1/table`-svaret | Bär de presentationsevents som hör till command-resultatet. | Listordning, typ och publika fält. |
| SSE-objektet `round` | Publicerar samma presentationslista med op, version och phase när listan inte är tom. | Endast mottagarens publicerade eventström. |
| `web/public/dealers/astrid/performance/manifest.json` | Beskriver review-takes med id, action, status, mediahash, camera och eventframes. | Bara poster som katalogpolicyn tillåter för aktuellt läge. |
| `buildAssetsManifest(...)` | Samlar streams, deal-takes, speech och härledd `landAtMs`. | Publicerad katalog, aldrig godtycklig filsökning i runtime. |

### Verifierade presentationstyper

| Typ | Nuvarande betydelse | Fråga för första etappen | Status |
| --- | --- | --- | --- |
| `speak` | Spela en namngiven talrad; kan vara blocking. | Kan flera visuellt godkända takes höra till samma exakta line utan att talet ändras? | **BESLUT KRÄVS** |
| `deal` | Visa ett redan draget kort till publicerat mål, med action/prefer/fallback. | Vilka befintliga actionfamiljer kan få fler kalibrerade takes? | **VERIFIERAS** |
| `reveal` | Visa dealerns tidigare dolda kort när det blivit publikt. | Behövs mer än befintlig presentation i den första etappen? | **BESLUT KRÄVS** |
| `settle` | Publicera dealerresultat och handutfall för presentation. | Första kandidat för ett litet variantträd, eftersom payloaden är explicit. | **JAKOBS FÖRSLAG** |
| `turn` | Visa aktiv box/hand och legal actions. | Kan idle/think få variation utan att störa turordning eller deadline? | **VERIFIERAS** |
| `idle` | Återgå till väntande presentation. | Behövs variation i den första V3-leveransen eller räcker befintlig loop? | **BESLUT KRÄVS** |

## Vad en föreslagen nod måste innehålla

Varje nod ska vara spårbar och möjlig att avslå utan följdeffekt på motorn.

```text
node
  sourceRef        exakt verifierad runtimekälla
  sourceStatus     VERIFIERAT | VERIFIERAS
  semanticNeed     vad spelaren ska se eller höra
  publicPayload    minsta tillåtna publicerade fält
  baseline         befintlig säker presentation / tillåtna bastakes
  variants[]       trigger + tillåtna take-id:n + fallback
  landing          kalibrering som alla relevanta takes måste respektera
  owner            Jakob föreslår · Kevin integrerar · Kevin + Emil äger media
  evidence         test, rehearsal och reviewresultat
  decision         ej granskad | ändra | acceptera | avstå
```

`sourceRef` får aldrig vara ett minne av ett äldre repo. Om en exakt källa saknas ska noden stå som **VERIFIERAS** och inte kopplas till produktion.

## Första arbetsexemplet: ett litet settle-träd

Detta är uttryckligen ett **JAKOBS FÖRSLAG**. Bara källtypen `settle` och dess publicerade payload är verifierade. Poolstorlek, variantnamn och urvalsregel är inte befintlig Croupier-runtime.

```text
[VERIFIERAT] presentation type = settle
  public payload: dealerTotal, dealerBlackjack,
                  hands[].box, stake, returned, outcome
        │
        ▼
[JAKOBS FÖRSLAG] semantisk nod: round-result
        │
        ├── linjen / baseline pool
        │     ├── result-a    video 1
        │     ├── result-b    video 2
        │     └── result-c    video 3
        │
        ├── variant: player-blackjack
        │     trigger: publicerat hands[].outcome innehåller blackjack
        │     ├── blackjack-a
        │     └── blackjack-b
        │
        └── variant: dealer-bust
              trigger: publicerat dealerTotal > 21 och minst en vinnande hand
              ├── dealer-bust-a
              └── dealer-bust-b

alla vägar ──► [KEVIN + EMIL] katalogkontroll, kalibrering, review
           ──► saknad/underkänd take: befintlig säker presentation
```

Exemplet visar önskad form — ett event kan ha tre basvideor och två varianter med två videor vardera — men binder inte Kevin till just dessa antal eller namn. Etappavstämningen avgör om trädet är rätt avgränsat.

## Kandidatträd för den första avgränsade etappen

| Rot | Baslinje i dag | Minsta möjliga V3-utvidgning | Ägare | Status |
| --- | --- | --- | --- | --- |
| `settle` | Befintlig settle + vald `speak`-rad. | En begränsad takepool och högst två varianter som bara läser settle-payload. | Jakob föreslår; Kevin + Emil levererar media. | **BESLUT KRÄVS** |
| `deal` | Befintlig action/prefer/fallback och kalibrerade/review-takes. | Flera godkända takes inom samma action, utan ändrad målpunkt eller landning. | Kevin + Emil; Jakob dokumenterar urvalskrav. | **VERIFIERAS** |
| `turn` | Aktiv hand/box och legal actions publiceras. | En baspool för think/attention som aldrig blockerar spelarens command. | Jakob föreslår; Kevin beslutar. | **BESLUT KRÄVS** |
| `speak` | Exakt line väljs av befintlig kod. | Visuell variation för samma line och samma ljud/text, om kalibrering tillåter. | Kevin + Emil. | **VERIFIERAS** |

`reveal`, `idle`, shufflepresentation, långsessionstriggers, chatt och fler dealerpersonligheter ligger utanför kärnträdet tills den första vertikala skivan är verifierad.

## Föreslagen urvalspolicy

Det här är inte implementerad runtime. Varje punkt behöver Kevin-beslut innan integration.

1. Motorn producerar först sitt vanliga command-resultat och `presentation[]`.
2. Adaptern hittar en nod via exakt `sourceRef`; okänd källa ger omedelbart befintlig presentation.
3. Varianten är valbar bara om dess trigger kan avgöras från eventets publicerade payload.
4. Högst en variant väljs för eventet i den första avgränsade etappen.
5. Om ingen variant är valbar används linjen/baslinjen.
6. En take får bara väljas om dess katalogstatus och kalibrering tillåter det aktuella körläget.
7. Ett misslyckat assetval går tillbaka till befintlig presentation; eventet stoppas inte.
8. Hur takevalet görs — exakt nyckel, godkänd hash eller annan deterministisk metod — är **BESLUT KRÄVS**. Det får inte använda eller exponera hemlig shoe-ordning.
9. Samma publicerade input och samma godkända katalogrevision bör ge reproducerbart val om Kevin väljer determinism som krav.
10. Adaptern skickar aldrig tillbaka spelbeslut till `command(...)`.

## Video- och takekontraktet

Kevin och Emil äger materialet. Jakob behöver bara den information som krävs för att mappa och testa.

| Data | Varför trädet behöver den | Regel |
| --- | --- | --- |
| Stabilt take-id | Loggning, test och reproduktion. | Får inte återanvändas för andra bytes. |
| Action/presentationsfamilj | Säkerställer att taken hör till rätt rörelse. | Måste matcha nodens behov. |
| Review-/godkännandestatus | Hindrar råa generationer från att bli live. | Draft/review är inte automatiskt live. |
| Mediahash | Upptäcker att videon har bytts. | Ny hash ogiltigförklarar tidigare visuell acceptans. |
| Exakt text och ljud för speech | Håller mun, ljud och betydelse som en enhet. | Ingen ny mun ovanpå befintlig video. |
| Frame-/eventdata | Kalibrering och landning. | Variant får inte flytta kortets mål eller landning. |
| Fallback | Gör runtime robust när media saknas. | Befintlig säker presentation ska alltid finnas kvar. |
| Rehearsal-evidens | Visar faktisk playback, inte bara filvaliditet. | Testa i den riktiga spelaren, inklusive två följande uppspelningar. |

Nya videor går genom Kevin och Emil och hamnar i Kevins branch. Jakob ska inte skapa ett konkurrerande live-index; han använder en handoff eller publicerad katalogrevision.

## Felfall

| Felfall | Krav i första etappen |
| --- | --- |
| Okänd source reference | Använd befintlig presentation; logga att nod saknas. |
| Trigger kräver dolt fält | Varianten är ogiltig och får inte erbjudas. |
| Take saknas i katalogen | Välj annan tillåten take eller befintlig fallback. |
| Take har ny hash | Behandla tidigare kalibrering/acceptans som ogiltig tills ny review finns. |
| Take har en status som inte är tillåten för aktuellt körläge | Använd den inte. `rejected` ska alltid nekas; exakt allowlist för rehearsal och live är **BESLUT KRÄVS**. |
| Landningsdata saknas för en fysisk deal | Använd inte taken som kalibrerad dealvariant. |
| Adapterfel eller timeout | Låt befintligt flöde fortsätta; spelet väntar inte på V3-logik. |
| Två möjliga varianter | Använd dokumenterad prioritet eller baslinje; improvisera inte i klienten. |

## Säkerhetsregler som bevaras

- Servern äger kort, shoe, legal actions, phase, saldo, collect och payout.
- Frontend och video får inte räkna fram eller överstyra utfall.
- Dold information blir inte tillgänglig för att ett presentationsförslag “behöver” den.
- Välj aldrig en speaking-video efter ungefärlig längd.
- Loopa aldrig en inspelad mening över fortsatt ljud och lägg inte en ny mun ovanpå.
- Varje speechändring hålls som en enhet: exakt text, ljud, video, frame-index, kalibrering och acceptansanteckning.
- En variant för fysisk handling måste ärva målpunkt och verifierad landning från sin familj.
- Assetbaseline är regressionsskydd, inte bevis på korrekt lipsync.
- En ny katalog eller take får inte slå ut en fungerande fallback.
- Ingen AI-regissör är del av kärnan i den första V3-leveransen.

## Tester för första vertikala skivan

| Test | Bevis som krävs |
| --- | --- |
| Oförändrat spelutfall | Samma commandsekvens ger samma auktoritativa game view och delta med eventträdet av/på. |
| Ingen dold dataläcka | Eventträdets logg innehåller bara fält som redan fanns i rätt publicerad payload. |
| Canonical källa | Varje aktiv nod pekar på aktuell fil/funktion/symbol eller kontraktstest. |
| Baslinje alltid spelbar | Varje aktiv nod har en verifierad fallback till befintlig presentation. |
| Varianteligibility | Varje vald variant har ett sant, loggat villkor från publicerad payload. |
| Katalogskydd | Okänt id, fel status, ny hash eller saknad kalibrering avvisas. |
| Landning | Fysisk take granskas i riktig spelare och håller godkänd landning/frame. |
| Två följande spelningar | Ingen loop-, reset- eller restpose-regression mellan uppspelningar. |
| Adapter avstängd | Produkten beter sig som före V3-förslaget. |

## Föreslagen etappsekvens för eventträdet

| Etapp | Resultat | Grind |
| --- | --- | --- |
| 1 | Frys V2 som historik och samla mötesbeslut. | Inget gammalt alias kallas runtime. |
| 2 | Verifiera commands, publicerad view, presentationstyper och manifestvägar. | Källreferenser dokumenterade. |
| 3 | Rita skelettet: sourceRef → semantisk nod → baslinje → fallback. | Ingen variant ännu. |
| 4 | Lägg första lilla variantträdet på ett verifierat event. | Bara publicerad payload används. |
| 5 | Samtal Jakob–Kevin. | Kevin väljer fortsätt, justera eller avstå. |
| 6 | Kevin och Emil inventerar/producerar den avgränsade takepoolen i Kevins valda flöde. | Stabilt id, status och mediahash. |
| 7 | Koppla kataloghandoff och negativa tester i Jakobs spår. | Saknad/underkänd media faller tillbaka. |
| 8 | Rehearsal i faktisk spelare och dokumenterad gapplista. | Spelutfall oförändrat; visuell evidens sparad. |
| 9 | Slutlig etappgenomgång med Kevin. | MR/integration bara om Kevin väljer det. |

## Beslutspunkter för Kevin

1. Vilken presentationsfamilj är den första vertikala skivan: `settle`, `deal`, `turn` eller något annat?
2. Är `presentation[]` det långsiktiga canonical inflödet till adaptern?
3. Vilka katalogstatusar får användas i rehearsal respektive live?
4. Ska takevalet vara exakt, deterministiskt hashat eller en annan kodad policy?
5. Vilka triggers är tillåtna i den första etappen, och vilka publicerade fält får de läsa?
6. Ska flera visuella takes dela exakt samma speech-line och ljud, eller ska varje take vara ett komplett separat paket?
7. Vilken evidens krävs innan en video från Bettalotto flyttas från generation/review till Kevins produktbranch?
8. Ska förslaget integreras, fortsätta separat eller avslutas efter etappgenomgången?

## Utanför kärnan

- en ny eller “bättre” spel-RNG,
- nya spelregler eller alternativa payouts,
- OpenClaw som realtidsregissör,
- chatt-, känslo-, natt- och långtidsminnestriggers,
- ett komplett bibliotek för alla dealers,
- automatisk ändring av Kevins branch, wiki eller agentregler,
- tätt dagligt samarbete mellan Jakob och Emil.

---

V3 · `v3-9-days-mvp` · s03 eventträdet · Kevins motor avgör · Jakobs adapter föreslår · Kevin och Emil äger media · Kevin avgör integration.
