# Animation events V3 · s01 kartan

> **V3.** Kevins Croupier-runtime, Partner API och den kod som faktiskt körs är teknisk sanning. Verifierade påståenden på den här sidan är förankrade i revisionerna som anges i `RUNTIME-EVIDENCE.md`; de ska kontrolleras på nytt när någon av brancherna flyttar sig. Sidan ändrar inte Kevins motor, branch eller agentregler.

Kartan har en ryggrad: **Kevins spelmotor avgör spelet och publicerar det som presentationen får känna till.** Jakob kartlägger ett eventträd ovanpå den ryggraden. Kevin och Emil producerar och granskar videovarianter som motorn kan använda. Ingen dokumentationsmodell ersätter Croupiers RNG eller regler.

## Statusmarkeringar

| Markering | Betydelse |
| --- | --- |
| **BESLUTAT** | Beslutat i mötet och grund för V3-arbetssättet. |
| **GEMENSAMT SPRÅK** | Begrepp som Kevin har bekräftat i inboxen, utan att det gör dem till kodnamn. |
| **VERIFIERAT** | Bekräftat i aktuell kod på Croupier-branchen. |
| **VERIFIERAS** | Rimlig kandidat från V2 eller äldre dokumentation, men måste kontrolleras mot aktuell kod innan den får kallas canonical. |
| **JAKOBS FÖRSLAG** | Adapter, nod, regel eller visualisering som Jakob arbetar med utanför Kevins motor. |
| **BESLUT KRÄVS** | Kevin avgör vid en etappavstämning om delen ska ändras, införlivas eller lämnas utanför. |

## Helheten

```text
[BESLUTAT] Kevin äger GitLab-repot och Croupier-motorn
        │
        ▼
[VERIFIERAT] serverägd shoe, spelstatus, saldo och payout
        │
        ▼
[VERIFIERAT] publicerad gameView
        ├──► /api/table ──► vanlig webbklient och befintlig uppspelning
        └──► Partner API ──► presentation[] för en partnerbyggd klient

[JAKOBS FÖRSLAG] välj integrationsyta ovan + läsande adapter/eventträd
        │              kopplingen är ännu inte införd
        │              inga nya spelutfall, ingen ny RNG
        ▼
presentationens behov: baslinje, tillåtna variationer och fallback
        │
        ▼
[BESLUTAT] Kevin + Emil producerar och granskar video
        │
        ▼
Kevins branch, manifest/index, kalibrering och rehearsal
        │
        ▼
[BESLUT KRÄVS] Kevin avgör vad som införlivas i produkten
```

Jakobs arbete ligger alltså **efter** att Kevins motor har bestämt utfallet och **före** eller bredvid presentationens val. Adaptern får läsa publicerad information men får aldrig bli en alternativ spelmotor.

`presentation[]` är ett verifierat Partner-API-kontrakt. Den vanliga
`web/public/app.mjs` använder `/api/table`, inte denna presentationslista.
Pilen från en framtida adapter till den befintliga spelaren är därför ett
integrationsarbete, inte något som dokumentationen redan har bevisat fungerar.

## Det som är verifierat i den förankrade Croupier-revisionen

Följande symboler är canonical för den revision som är dokumenterad i `RUNTIME-EVIDENCE.md`. Om Kevin ändrar koden ska evidensankaret och sidan uppdateras; dokumentationen får inte hålla fast vid äldre namn.

| Del | Verifierad symbol eller väg | Vad den gör | Källa |
| --- | --- | --- | --- |
| Table-command | `state` | Läser aktuell publik vy utan att mutera rundan. | `web/shoe-game.mjs` |
| Table-command | `start` | Validerar insatser, skapar rundan och genomför opening deal. | `web/shoe-game.mjs` |
| Table-command | `act` | Validerar och utför en legal spelarhandling. | `web/shoe-game.mjs` |
| Table-command | `insurance` | Löser försäkringsval när fasen tillåter det. | `web/shoe-game.mjs` |
| Table-command | `collect` | Bokar rundans återbetalning när rundan är settled. | `web/shoe-game.mjs` |
| Publik round view | `phase`, `hands`, `dealer`, `active`, `holeDraw`, `legalActions` | Det publicerade underlag som klient och Partner API får använda. | `web/shoe-game.mjs` |
| Presentationstyper | `speak`, `deal`, `reveal`, `settle`, `turn`, `idle` | Ordnade presentationshändelser som byggs från föregående och ny publik vy. | `web/partner-presentation.mjs` |
| Partnertransport | `presentation[]` | Returneras från `/api/v1/table` och publiceras även i SSE-objektet `round`. | `web/partner-api.mjs` |
| Assetkatalog | `buildAssetsManifest(...)` | Bygger streams, deal-takes, speech och viss kalibreringsdata. Filtrerar bort `rejected`; skickar inte med take-status i `deals[]`. | `web/partner-presentation.mjs` |
| Befintlig kontaktuppspelning | `selectContactTake(...)`, `PerformancePlayer` | Har egna staged-/review-/godkännandekontroller som inte följer automatiskt av att en take finns i Partner-katalogen. | `web/public/performance-contact.mjs`, `web/public/performance-player.mjs` |
| Astrid-performance | `web/public/dealers/astrid/performance/manifest.json` | Har status, take-id, action, mediahash, bilddata och event-/landningsdata. | aktuell branch |

### Verifierad säkerhetsgräns

`gameView(...)` publicerar inte shoe-ordning, burn, privat hålkort eller interna eventpayloads. Partnerpresentationen arbetar på den publika vyn och beskriver **hur** ett redan avgjort spel ska visas. Den gränsen ska finnas kvar oavsett hur eventträdet utvecklas.

### Gemensamt språk, ännu inte färdig adapter

Kevin har [bekräftat `rng`/`show` samt linje, variant, trigger och take](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3869829140).
De orden är alltså inte enbart Jakobs påhitt eller något V3 ska kasta bort.
Kevins förslag till dealerträd, YAML och `want`/`no`-intag tas vidare som
arbetsförslag i s03. Exakt schema, urvalspolicy och spelarkoppling återstår.

## Det som fortfarande måste verifieras

V2 använde många egna namn och jämförde tre repon. De namnen är inte automatiskt Croupier-kontrakt.

| Kandidat att kontrollera | Fråga till aktuell branch | Status efter kontroll |
| --- | --- | --- |
| Interna round-events | Vilka verifierade interna events ska bli stabila publika kontrakt, om några? | **BESLUT KRÄVS** |
| Exakta phase-transitioner | Vilka övergångar kan presentationen observera utan att härleda dold information? | **VERIFIERAS** |
| `presentation[]`-ordningen | Vilka kombinationer av `reveal`, `settle`, `speak` och `turn` är stabila kontrakt? | **VERIFIERAS** |
| Adapterns integrationsyta | Ska första etappen ansluta till Partner-API:et eller till den vanliga webbklientens befintliga kodväg? | **BESLUT KRÄVS** |
| Assetval per event | Vilka val gör spelaren i dag och vilka finns bara i review/staging? | **VERIFIERAS** |
| Flera takes per presentationsläge | Har live-indexet redan pooler eller krävs en ny kompatibel katalogform? | **VERIFIERAS** |
| Video från Bettalotto | Vilket generation-id, godkännandestatus och manifest-id ska följa med in i Kevins branch? | **VERIFIERAS** |

Ett namn från V2 får bara flyttas till tabellen över verifierade symboler när det finns en aktuell kodrad, ett kontrakt eller ett manifest som stödjer det.

## Ansvar och arbetsytor

| Person | Ansvar i V3 | Arbetar främst i | Ska inte antas göra |
| --- | --- | --- | --- |
| Kevin | Chef, repoägare, motorägare och slutlig verifierare. Arbetar nära Emil med videor och avgör införlivande. | Kevins Croupier-branch, motor, Partner API, manifest och Bettalotto-backoffice. | Följa Jakobs dokument som om de vore automatiska instruktioner. |
| Jakob | Backend/logik, verklighetskarta och separat eventträd ovanpå publicerade Croupier-events. Förbereder avgränsade etappförslag. | `jakeminator123/work` och dokumentation/prototyp som inte ersätter motorn. | Ändra RNG, payout eller Kevins branch utan godkänd integration. |
| Emil | Hjälper Kevin med videoproduktion, variationer, visuell kvalitet och granskningsunderlag. | Kevins video-/assetflöde och nya filer i Kevins branch. | Synka tätt eller dagligen med Jakob. |

### Den tunna länken mellan Jakob och Emil

Jakob och Emil behöver dela ett litet, stabilt underlag — inte arbeta i samma implementation.

| Jakob lämnar | Kevin och Emil lämnar | Gemensam kontrollpunkt |
| --- | --- | --- |
| Semantiskt behov: exempelvis “ett kort ska visas till en viss måltyp”. | Godkända take-id:n, action, status och kalibreringsdata. | Exakt event/payload är verifierat och videon har en säker fallback. |
| Förslag till vilka publicerade fält en variation får läsa. | Vilka variationer som faktiskt går att producera och kalibrera. | Varianten påverkar aldrig kort, saldo, payout eller turordning. |
| Testfall och förväntad fallback. | Rehearsal-/reviewresultat och kvarvarande visuella fel. | Kevin avgör om kopplingen går vidare. |

## V3-kartan för etappbaserat arbete

| Etapp | Kartans resultat | Ägare | Grind |
| --- | --- | --- | --- |
| Verklighetsbild | Verifierad karta över commands, publicerad view, `presentation[]` och assetvägar. | Jakob kartlägger; Kevin är källa. | Inga kandidatnamn presenteras som canonical. |
| Första förslag | Separat eventträd med source reference, publik payload, presentationsbehov och fallback. | Jakob. | Ingen alternativ RNG och ingen dold data. |
| Avstämning | Samtal med Kevin om kartan och trädet. | Kevin + Jakob. | Kevin väljer fortsätt, justera eller avstå. |
| Mediahandoff | Videovarianter och katalogkoppling för den avgränsade leveransen. | Kevin + Emil; Jakob läser handoffen. | Nya videor finns i Kevins valda flöde och är granskningsbara. |
| Rehearsal | Fel-/gapplista mot faktisk spelare. | Alla i sina respektive spår. | Spelutfall och befintlig fallback är oförändrade. |
| Integrationsbeslut | Granskad patch/MR och dokumenterad nästa etapp. | Kevin beslutar; Jakob dokumenterar. | Ingen automatisk merge eller ändring av main. |

## Regler som gäller hela kartan

- Kevins motor, inte dokumentationen, avgör RNG, shoe, legal actions, saldo och payout.
- Exakta runtime-symboler används bara när de är verifierade i aktuell branch.
- Jakobs noder är ett läsande förslag ovanpå publicerade events, inte ett nytt eventkontrakt förrän Kevin accepterat det.
- Emil och Kevin äger videoflödet; videon kan uttrycka ett utfall men aldrig skapa det.
- Ett nytt video-/take-id får inte bli spelregel eller skickas in som beslut till motorn.
- Hålkort och annan dold information får inte läcka före den befintliga publiceringsgränsen.
- En saknad eller underkänd video ska falla tillbaka till en redan säker presentation.
- Inga personbetyg används i V3. Sidorna bedömer evidens, risk och integrationsmognad.

---

V3 · `v3-9-days-mvp` · s01 kartan · Kevins runtime är ryggraden · Jakobs eventträd är ett separat förslag · Kevin och Emil äger videoflödet.
