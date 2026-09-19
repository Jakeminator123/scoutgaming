# Animation events V3 · s02 språket

> **V3 · 9-dagars MVP.** Språket på den här sidan ska göra Kevins befintliga Croupier-motor lättare att diskutera. Det skapar inte en ny RNG, döper inte om runtime och blir inte ett kontrakt förrän motsvarande symbol är verifierad och Kevin har accepterat förändringen.

Grundregeln är enkel: **kodens exakta namn är canonical; våra svenska ord förklarar vad namnen betyder.** Ett praktiskt alias i ett diagram får aldrig presenteras som om servern redan emitterar det.

## Statusmarkeringar

| Markering | Användning |
| --- | --- |
| **BESLUTAT** | Roll, arbetsgräns eller riktning beslutad i mötet. |
| **VERIFIERAT** | Exakt symbol eller beteende bekräftat i aktuell Croupier-kod. |
| **VERIFIERAS** | Kandidat från äldre dokumentation som ännu inte är bekräftad i aktuell branch. |
| **JAKOBS FÖRSLAG** | Dokumentationsord eller adapterbegrepp ovanpå Kevins motor. |
| **BESLUT KRÄVS** | Föreslagen ändring som Kevin behöver ta ställning till vid en etapp. |

Statusen ska stå bredvid saken den gäller. En hel sida får inte kallas “verifierad” bara för att några av dess ord finns i koden.

## Källhierarkin

När två namn säger olika saker gäller följande ordning:

1. Körbar kod på den uttryckligen verifierade revisionen av Kevins Croupier-branch.
2. Partner API:s faktiska request-, response- och SSE-form.
3. Aktuella manifest/index och kalibreringsdata för media.
4. Tester och reproducerbar rehearsal-evidens.
5. Den här V3-dokumentationen.
6. V2, spelsajt och Emils äldre repo som referenser — aldrig som Croupier-runtime.

## Verifierade runtimeord

Tabellen nedan använder bara symboler som finns på revisionen som anges i `RUNTIME-EVIDENCE.md`. Betydelsen är sammanfattad; koden är fortfarande facit och kontrollen ska göras om när Kevin uppdaterar sin branch.

| Lager | Canonical symbol | Betydelse i aktuell kod | Status |
| --- | --- | --- | --- |
| Table-command | `state` | Läs publik table view utan att ändra rundan. | **VERIFIERAT** |
| Table-command | `start` | Starta en ny runda efter validering av insatser och saldo. | **VERIFIERAT** |
| Table-command | `act` | Utför en legal handling i aktuell decision-fas. | **VERIFIERAT** |
| Table-command | `insurance` | Ta eller avstå försäkring när den är tillgänglig. | **VERIFIERAT** |
| Table-command | `collect` | Boka resultatet efter att rundan är settled. | **VERIFIERAT** |
| Publicerad vy | `phase` | Rundans aktuella publika fas. | **VERIFIERAT** |
| Publicerad vy | `hands`, `dealer`, `active`, `holeDraw`, `legalActions` | Det publika underlaget för spelare och presentation. | **VERIFIERAT** |
| Presentation | `speak` | Spela en verifierad talrad. | **VERIFIERAT** |
| Presentation | `deal` | Visa ett redan serverbestämt kort till publicerat mål. | **VERIFIERAT** |
| Presentation | `reveal` | Visa ett tidigare dolt dealerkort när publiceringsgränsen passerats. | **VERIFIERAT** |
| Presentation | `settle` | Beskriv publicerade handresultat för presentationen. | **VERIFIERAT** |
| Presentation | `turn` | Visa aktiv box/hand och publicerade legal actions. | **VERIFIERAT** |
| Presentation | `idle` | Återgå till väntande presentation. | **VERIFIERAT** |
| Partner response | `presentation[]` | Ordnad lista av presentationshändelser för ett command-resultat. | **VERIFIERAT** |
| Media | `takes[].id`, `action`, `status`, `media`, `events` | Fält som används i Astrids performance-manifest. | **VERIFIERAT** |
| Kalibrering | `events.land` / härledd `landAtMs` | Landningsdata som Partner API:s assetmanifest räknar fram. | **VERIFIERAT** |

Källorna för tabellen är sammanställda i `RUNTIME-EVIDENCE.md` och pekar vidare till `web/shoe-game.mjs`, `web/partner-api.mjs`, `web/partner-presentation.mjs` och `web/public/dealers/astrid/performance/manifest.json`.

## Gemensamma förklaringsord

De här orden hjälper oss att rita och granska systemet. Kolumnen “nivå” hindrar ett dokumentationsord från att smyga in som ett påstått API.

| Ord | Betyder i V3 | Nivå | Exempel |
| --- | --- | --- | --- |
| motor | Kevins auktoritativa Croupier-kod för shoe, regler, state, saldo och payout. | **BESLUTAT** | Motorn validerar `act`; videon gör det inte. |
| RNG | Den del av Kevins spelmotor som bestämmer spelutfall. Presentationens variation är inte RNG. | **BESLUTAT** | Ett klippval får aldrig dra nästa kort. |
| command | En begäran till table-endpointen. Använd exakt `state`, `start`, `act`, `insurance` eller `collect` när det är den symbolen som avses. | **VERIFIERAT** | `act` med en handling. |
| publicerad vy | Den information motorn avsiktligt lämnar ut efter ett command. | **VERIFIERAT** | `phase` och `legalActions`. |
| presentationsevent | Ett objekt i `presentation[]` som säger vad klienten ska presentera. | **VERIFIERAT** | `deal` eller `turn`. |
| faktum | Mänskligt samlingsord för något motorn redan har avgjort och publicerat. Inte ett nytt `rng.*`-namespace. | **JAKOBS FÖRSLAG** | “Ett kort har publicerats till boxen.” |
| semantisk nod | Jakobs dokumentations-/adapternod som pekar tillbaka på en exakt verifierad källa. | **JAKOBS FÖRSLAG** | `sourceRef` till ett `deal`-objekt. |
| linjen | En föreslagen baspool av godkända takes som alltid kan användas för samma presentationsbehov. | **JAKOBS FÖRSLAG** | Tre likvärdiga godkända takes. |
| variant | En föreslagen undergren som bara är valbar när ett verifierbart villkor är sant. | **JAKOBS FÖRSLAG** | En lugnare resultattake när publicerad data räcker för villkoret. |
| trigger | Villkoret som gör en variant valbar. Den får bara läsa publicerade fält. | **JAKOBS FÖRSLAG** | Ett publicerat `outcome`, inte dolt hålkort. |
| take | En sammanhållen, identifierad mediaprestation med video, ljud, hash, frame-/eventdata och granskningsstatus. | Gemensamt mediaord | Ett objekt i performance-manifestet. |
| landning | Det kalibrerade ögonblick då den visuella handlingen når sitt mål. | Gemensamt mediaord | `events.land` och härledd `landAtMs`. |
| fallback | En redan säker presentation som används när en föreslagen take eller variant inte kan spelas. | Gemensamt säkerhetsord | Befintlig slide/DOM eller godkänd bastake. |
| katalog | Kevins publicerade manifest/index över godkända assets och metadata. | **BESLUTAT** | Assetmanifest byggt från branchens filer. |
| etapp | En avgränsad leverans som Jakob går igenom med Kevin innan nästa integrationssteg. | **BESLUTAT** | Verklighetskarta → eventträd → rehearsal. |

## Namnregler för V3

1. Skriv den exakta runtime-symbolen i kodstil när den är verifierad: exempelvis `presentation[]` eller `deal`.
2. Sätt **VERIFIERAS** efter ett namn som kommer från V2, minnet eller en extern referens.
3. Skapa inte ett parallellt `rng.*`- eller `show.*`-kontrakt i dokumentationen.
4. Om ett svenskt namn behövs i ett diagram ska noden även ha en `sourceRef` till canonical symbol eller texten “källa ej verifierad”.
5. Asset-/take-id:n hör hemma i katalogen. Servern ska inte ta emot ett videonamn som spelbeslut.
6. En trigger får aldrig förutsätta shoe-ordning, kommande kort, privat hålkort eller saldo som inte redan publicerats för rätt mottagare.
7. Ett namn blir inte canonical för att det låter bättre. Kevin accepterar ändringen och kod/kontrakt/test följer med.

## Semantiska familjer att verifiera

Detta är en arbetslista för Jakobs kartläggning, inte en lista över verkliga eventnamn.

| Semantiskt behov | Verifierad källa i dag | Vad som återstår | Status |
| --- | --- | --- | --- |
| Runda startar | Command `start` och resulterande publik vy/presentation. | Dokumentera exakt sekvens och stabila payloadfält. | **VERIFIERAS** |
| Kort visas | Presentationstyp `deal`. | Kontrollera mål, face-down-regel, ordning och fallback för varje väg. | **VERIFIERAS** |
| Hålkort visas | Presentationstyp `reveal`. | Lås publiceringsgräns och verifiera att ingen tidigare nod läcker rank/suit. | **VERIFIERAS** |
| Spelaren ska agera | Presentationstyp `turn`. | Kontrollera dubletter, timing och hur aktiv hand byts. | **VERIFIERAS** |
| Försäkring öppnas | `phase === "insurance"` ger en `speak`-rad i nuvarande presentation. | Avgör om MVP behöver en egen visuell familj eller bara befintligt tal. | **BESLUT KRÄVS** |
| Resultat presenteras | `settle` följt av `speak` i nuvarande mappning. | Fastställ vilka variationer som kan väljas enbart från publicerad settle-data. | **VERIFIERAS** |
| Ny bettingcykel | Command `collect` ger i dag `speak` och `idle`. | Kontrollera önskad ordning och visuell återställning. | **VERIFIERAS** |
| Shoe byts | Publik shoe view har shufflefält. | Avgör om en presentation behövs i 9-dagars MVP. | **BESLUT KRÄVS** |

## Mall för varje eventrad

Använd följande fält när s03-eventträdet fylls i:

| Fält | Krav |
| --- | --- |
| `sourceRef` | Exakt fil/funktion/symbol eller kontraktsfält i aktuell Croupier-kod. |
| `sourceStatus` | **VERIFIERAT** eller **VERIFIERAS**. |
| `publicPayload` | Bara fält som är publicerade för rätt mottagare vid den tidpunkten. |
| `semanticNeed` | Kort mänsklig beskrivning av vad spelaren behöver se/höra. |
| `baseline` | Befintlig säker presentation eller godkänd takepool. |
| `variants` | Noll eller flera förslag med tydlig trigger och fallback. |
| `mediaOwner` | Kevin + Emil. |
| `logicOwner` | Jakob för förslaget; Kevin för eventuell produktintegration. |
| `decision` | Accepterad, ändras, avstår eller ännu ej granskad. |

## Säg så här

| Undvik | Säg i V3 | Varför |
| --- | --- | --- |
| “Jakobs RNG är bättre.” | “Jakobs adapterförslag använder Kevins RNG-resultat utan att ändra dem.” | Roller och auktoritet blir rätt. |
| “Facit-eventet är `rng.card.dealt`.” | “Semantiskt behov: kort utdelat; exakt Croupier-källa verifieras.” | V2-alias får inte låtsas vara runtime. |
| “Emils klipp ska in i Jakobs index.” | “Kevin och Emil lägger godkänd media i Kevins branch; Jakob läser kataloghandoffen.” | Den tunna samarbetsgränsen bevaras. |
| “Videon avgör vilken händelse det blev.” | “Motorn avgör händelsen; presentationen väljer en tillåten take.” | Backend förblir auktoritativ. |
| “Det här gäller eftersom wikin säger det.” | “Det här är verifierat i aktuell kod” eller “det här är ett förslag”. | Dokumentation och runtime blandas inte. |
| “OpenClaw väljer.” | “9-dagars MVP använder en kodad, verifierbar policy; AI-regissör ligger utanför kärnan.” | MVP:n hålls avgränsad. |

## Ord som bevaras från V2

`linjen`, `variant`, `trigger`, `take`, `landning` och `fallback` är användbara, men deras status har ändrats:

- `take`, `landning` och manifestmetadata har stöd i nuvarande mediaflöde.
- `linjen`, `variant` och `trigger` är Jakobs modell för att organisera en möjlig utvidgning.
- Ingen av dem får ändra spelmotorns utfall.
- Cooldown, budget och deterministiskt urval är möjliga regler, inte verifierad Croupier-runtime; de kräver separat beslut.

## Utanför språkets kärna för 9-dagars MVP

- personbetyg och vinnare mellan Kevin, Jakob och Emil,
- ett nytt “ultimativt” RNG-språk,
- rouletteord som bara kommer från ett annat repo,
- OpenClaw-kontrakt och agentlanes,
- känslo- eller stämningsevents,
- namn som inte kan spåras till kod, kontrakt, manifest eller uttryckligt beslut.

---

V3 · `v3-9-days-mvp` · s02 språket · koden behåller sina namn · förslag märks som förslag · Kevin avgör kontraktsändringar.
