# Tekniskt kvitto · motor, API och öppna integrationssteg

”Runtime-evidence” är inte en separat motor. Det är ett tekniskt kvitto som
visar vilken Croupier-kod ett dokumentationspåstående bygger på. Syftet är att
förhindra att en plan eller gammal canvas råkar beskrivas som redan införd kod.
Det betyder här **källkodsverifiering**, inte att en komplett runtime har
startats eller att hela V3-flödet har körtestats.

## Revisionsbild · kontrollerad 20 september 2026

| Yta | Verifierad revision | Vad revisionen betyder |
| --- | --- | --- |
| Jakobs publicerade branch | `origin/jakeminator123/work` vid `51aea06e1f56fb01dceac022c22713de7d25d035` | Revisionsankare före denna dokumentationsleverans. Lokala opushade commits kan finnas separat. |
| Kevins aktuella arbetsbranch | `origin/codex/restore-casino-environment` vid `626554db9e859ba7a374819b96099b7437dea818` | Senaste verifierade Kevin-head och head för MR !1 vid granskningen. |
| Gemensam bas | `b14765971ca9f697a7fa14ffc0ea13570453b789` | Punkten där Jakobs och Kevins senare arbete delar historik. |

Brancherna har därefter olika dokumentations-, media-, klient- och API-commits.
Det betyder inte att Jakobs branch saknar motor.

## Var motorn finns

Följande kärnfiler finns i `jakeminator123/work` och var byte-identiska med
Kevins verifierade branch:

| Del | Fil | Git-blob på båda brancherna |
| --- | --- | --- |
| Serverägd shoe, publicerad round view och speloperationer | `web/shoe-game.mjs` | `ea47b3721de7fe92effba1a308b83accb87180a9` |
| Blackjackregler och interna events | `web/public/blackjack.mjs` | `b60a60d3fd91a2561b882a60c17651f024ecaf42` |
| Partner-API | `web/partner-api.mjs` | `72bd4d83ccc9696eb8018ace332b7cb2bba162ea` |
| Presentation från publicerad spelvy | `web/partner-presentation.mjs` | `5669f154a6277d36f391cf38d1c36b7446e295c6` |
| Dealeruppspelning | `web/public/dealer-engine.mjs` | `5f7c19f0fd8601eec0ad790f2eed8093433fce89` |

`web/generations-api.mjs` finns däremot på Kevins `626554d` och inte i den
granskade `51aea06`-versionen av Jakobs publicerade branch. Det är ett read-only media-API,
inte RNG- eller blackjackmotorn.

## Vad Kevins senare arbete tillför

Kevins 32 commits efter den gemensamma basen rör främst media, Astrids
video-/3D-/kameraflöde, klient, backoffice och QA. De fem kärnfilerna ovan är
oförändrade mellan de granskade brancherna. Det finns alltså inte 32 nya
RNG- eller spelevent som Jakob måste ersätta sin motor med.

| Skillnad | Relevans för V3 |
| --- | --- |
| `GET /api/v1/generations` och `GET /api/v1/generations/:id/video` i `web/generations-api.mjs` | Nytt read-only medieintag med generation-id, metadata och video. Kräver rätt behörighet; ändrar inte spelutfall. |
| `cfg.clipAssignments` i Kevins `web/public/app.mjs` | Kopplar valda klipp till dealer-/presentationsdelar. Relevant när Jakobs föreslagna träd ska hitta sin integrationspunkt. |
| Mediacues som `pickup`, `release`, `land` och `rest` | Bildrute-/kalibreringshändelser för uppspelning, inte nya publika RNG-events. |
| Nya video-/kamera-/3D-assets och granskningsunderlag | Relevanta för Kevin och Emils mediaflöde; inte automatiskt media som Jakob ska kopiera eller godkänna. |

## Verifierade spel- och presentationskontrakt

På den gemensamma kärnan finns bland annat:

- operationerna `start`, `act`, `insurance` och `collect`;
- faserna `dealing`, `insurance`, `decisions`, `dealer` och `settled`;
- serverägda kort, shoe, hole card, wallet och settlement;
- interna events som `round.dealt`, `card.dealt`, `hand.split`,
  `dealer.reveal`, `dealer.draw` och `round.settled`;
- presentationstyperna `speak`, `deal`, `reveal`, `settle`, `turn` och `idle`.

Interna events är inte automatiskt publika payloads. Jakobs adapter får endast
läsa det som den valda integrationsytan faktiskt publicerar. Två befintliga
kodvägar ska hållas isär:

| Kodväg | Verifierad kedja | Gräns |
| --- | --- | --- |
| Partner-/headless-API | `command(...)` → publik `gameView(...)` → `presentationEvents(...)` → `presentation[]` i `/api/v1/table`-svaret och `events` i SSE-objektet `round`. | Ett kontrakt för en partnerbyggd klient, inte bevis på vad den vanliga webbklienten konsumerar. |
| Croupiers webbklient | `web/public/app.mjs` → `/api/table` → serverns tabellsvar → appens befintliga spel- och uppspelningskod. | Den granskade `app.mjs` konsumerar inte Partner-API:ets `presentation[]`. |

Steget `presentation[]` → variantadapter → en vald spelare är därför ett
**integrationsförslag**, inte en redan verifierad end-to-end-kedja. Vilken
kodväg första etappen ansluter till behöver stämmas av med Kevin.

## Assetkatalog är inte samma sak som godkänd uppspelning

- `buildAssetsManifest(...)` i `web/partner-presentation.mjs` filtrerar bort
  `rejected` från performance-takes. Den publicerade `deals[]`-posten tar inte
  med `status`, mediahash eller komplett granskningsunderlag. Katalogen ensam
  bevisar därför inte att en take är livegodkänd.
- `selectContactTake(...)` i `web/public/performance-contact.mjs` har separata
  kontroller för staged review respektive godkänd uppspelning. Utan staged-läge
  krävs bland annat godkänt manifest, godkända takes och föreskrivna reviews.
- `PerformancePlayer` i `web/public/performance-player.mjs` validerar en take
  utifrån sitt staged-läge och kontrollerar media/kalibrering. Detta är en
  annan kontrollpunkt än Partner-API:ets katalogbyggare.
- V3:s föreslagna variantadapter behöver en uttrycklig statuspolicy och ett
  tillräckligt metadataunderlag. Den får inte tolka ”finns i API-katalogen” som
  ”visuellt godkänd för live”. Ingen sådan ny adapter eller policy har införts
  genom denna dokumentationsändring.

## Det tidigare ankarets fel

Den äldre V3-texten använde `eaffbb850d24cc6c6881cab83acbdac19e2609bb`
som enda revisionsankare men beskrev samtidigt filer som inte fanns där:

- `web/partner-presentation.mjs` introducerades i `d188236a772230a4bb8d8debbb7afd710d44641f`;
- `web/generations-api.mjs` introducerades i `e71854679656548ace4d488058d2faba2f8234f7`.

Det är därför ersatt av den tvåbranchsbild som står ovan.

## Vad detta inte godkänner

Den här sidan godkänner inte automatiskt video, visuell kvalitet, läppsynk,
kalibrering eller en merge. RNG:n är en server-side kryptografisk shuffle för
den nuvarande demon; sidan påstår inte regulatorisk RNG-/RGS-certifiering.

## Uppdateringsregel

När någon av brancherna flyttar sig ska nästa granskning registrera nya
commits, jämföra de berörda filernas blobbar och uppdatera endast de påståenden
som faktiskt ändrats.
