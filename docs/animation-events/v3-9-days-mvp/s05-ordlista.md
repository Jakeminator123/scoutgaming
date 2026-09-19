# V3 · gemensam ordlista

> **[BESLUTAT FÖR V3]** Vi skiljer på tre sorters ord: sådant som är verifierat i Kevins runtime, gemensamma presentationsord och Jakobs förslagsord. Bara den första gruppen får citeras som exakta kodnamn.

## Statusetiketter

| Etikett | Betydelse |
| --- | --- |
| **[RUNTIME-VERIFIERAT]** | Namnet har kontrollerats i den förankrade Kevin-revisionen som anges i `RUNTIME-EVIDENCE.md`. |
| **[GEMENSAMT BEGREPP]** | Ordet beskriver hur vi pratar om lösningen men är inte nödvändigtvis ett fält eller en symbol i koden. |
| **[JAKOBS FÖRSLAG]** | Arbetsnamn för designen på Jakobs branch. Det blir inte ett kontrakt förrän Kevin godkänt det och koden använder det. |
| **[ATT VERIFIERA]** | Exakt namn eller beteende ska läsas ur Kevins aktuella branch innan implementation. |
| **[SENARE]** | Utanför den första V3-leveransen. |

## Kevins runtimeord

De här exakta namnen är verifierade mot `origin/codex/restore-casino-environment` på revisionen som anges i `RUNTIME-EVIDENCE.md`. De ska kontrolleras på nytt när Kevins branch flyttar sig och vid integrationsmilstolpen.

| Exakt namn | Betyder i nuvarande kod | Verifierad källa |
| --- | --- | --- |
| `presentationEvents` | Bygger en ordnad lista av presentations-events från föregående och aktuell tabellvy. | `web/partner-presentation.mjs` |
| `speak`, `deal`, `reveal`, `settle`, `turn`, `idle` | Eventtyper som `presentationEvents` kan skapa i nuvarande flöde. | `web/partner-presentation.mjs` |
| `line` | Id för en talrad i ett `speak`-event; det är inte fri AI-text. | `web/partner-presentation.mjs` |
| `DealerEngine` | WebCodecs-baserad spelare för indexerade dealer-klipp. | `web/public/dealer-engine.mjs` |
| `streams/index.json` | Index som kopplar klippnycklar till media- och bildruteinformation. | `web/public/dealer-engine.mjs`, `pipeline/build-index.mjs` |
| `PerformancePlayer` | Spelar och validerar kontakt-/performance-takes, inklusive mediahash och kalibrering. | `web/public/performance-player.mjs` |
| `SHOE_RULES` | Nuvarande frysta shoe-parametrar i serverns shoe-spel. | `web/shoe-game.mjs` |
| `state`, `start`, `act`, `insurance`, `collect` | Nuvarande kommando-operationer i shoe-spelet. | `web/shoe-game.mjs` |
| `decisions`, `insurance`, `settled` | Faser som kontrolleras uttryckligen i nuvarande shoe-spel. | `web/shoe-game.mjs` |
| `rehearsal` | Repots granskningsläge för att prova den verkliga spelaren, inte en synonym för automatisk godkänd status. | `AGENTS.md` |
| `baseline` | Hash-/regressionsskydd mot oavsiktliga assetändringar; inte bevis på visuell kvalitet. | `AGENTS.md` |

**[ATT VERIFIERA]** Det kan finnas fler aktuella event, kommandon och faser på Kevins senaste branch. Den här listan är ett golv, inte ett nytt komplett kontrakt.

## Gemensamma presentationsord

| Ord | Gemensam betydelse | Inte samma sak som |
| --- | --- | --- |
| **event** | Ett redan producerat runtime-meddelande som presentationen reagerar på. | Ett nytt utfall som frontend räknar fram. |
| **trigger** | Ett kontrollerbart villkor från publicerade fakta som gör en variant tillåten. | Fri “stämning”, dold speldata eller ett nytt RNG-drag. |
| **variant** | En alternativ, godkänd presentation av samma spelhändelse. | Ett annat spelutfall. |
| **baspresentation** | Den normala presentation som fungerar utan specialtrigger. | En AI-rekommendation. |
| **take** | En granskad medieprestation med de metadata uppspelningen kräver. | Ett godtyckligt filnamn från chatt eller nätverk. |
| **kandidat** | Ett godkänt take-/klipp-id som får väljas i en viss variant. | En fil-URL som modellen hittar på. |
| **katalog** | Den maskinläsbara listan över tillgänglig och godkänd media. | En mappinventering som automatiskt innebär godkännande. |
| **landning/kontakt** | Det synkroniserade ögonblick där visuell handling möter kort eller bord. | En ungefärlig videolängd. |
| **fallback** | Nästa säkra presentationsval när önskad media inte kan spelas. | Omdragning av spelutfall. |
| **eventträd** | Dokumenterad logik från runtime-event via triggers till möjliga presentationer. | En ny motor bredvid Kevins. |
| **milstolpe** | Punkt där Jakob visar bevis och frågar Kevin om nästa integrationssteg. | Automatisk order eller merge. |
| **Kevins branch** | Platsen där Kevin och Emil samlar integrerbar motor och ny video. | Jakobs arbetsbranch. |
| **Jakobs branch** | `jakeminator123/work`, där backend-/logikförslag byggs och verifieras isolerat. | `main` eller Kevins ägarbranch. |

## Jakobs förslagsord

De här orden gör V3 lättare att diskutera men är **inte** verifierade runtimefält.

| Arbetsord | Avsedd betydelse | När det får bli ett exakt kodnamn |
| --- | --- | --- |
| `presentationKey` | Stabil länk mellan ett runtime-event och en presentation. | Efter att Kevin bekräftat var kopplingen hör hemma. |
| `sourceEvent` | Det verifierade runtime-event som en mappningsrad reagerar på. | När värdet hämtas från faktisk kod eller logg, inte V2-dokumentet. |
| `eligibleVariants` | De varianter vars triggers är sanna och vars media är godkänd. | När kontrakt och test finns i Croupier. |
| `basePresentation` | Standardvalet innan någon specialvariant övervägs. | När det mappats till nuvarande uppspelningsflöde. |
| `selectionTrace` | Loggrad som visar event, kandidater, val och fallback. | När loggens datagräns och format godkänts. |
| `fallbackChain` | Den ordnade kedjan variant → bas → neutral → UI-only. | När samtliga steg har testfall. |
| `videoVariantSet` | Samling utbytbara, godkända takes för samma presentationsbetydelse. | När Kevin och Emil har fastställt katalogmetadata. |

## Ord från V2 som inte är runtime-sanning

Följande uttryck kan finnas kvar i det arkiverade V2-materialet men ska inte föras in som fakta i V3 utan ny verifiering:

- `rng.round.settled`, `show.line.lose` och andra påhittade namnrymder.
- `PresentationOpportunityV2`, `DirectorAdviceV2`, `open[]`, tre OpenClaw-lanes och “13 grindkontroller”.
- “ultimativ RNG”, “bästa RNG” eller en fristående presentations-RNG.
- den gamla tiodagarsplanen och påståenden om att OpenClaw redan är en del av Croupier-runtime.

**[BESLUTAT FÖR V3]** När ett gammalt ord och Kevins faktiska kod skiljer sig vinner koden. Wiki och dessa sidor uppdateras därefter. OpenClaw behandlas som **[SENARE]**, inte som en förutsättning för den första V3-etappen.
