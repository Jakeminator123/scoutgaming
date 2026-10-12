# B11 · Beslutsunderlag: indexerad bank och partnerprotokoll

Läsande underlag. Inget är flyttat, raderat eller avregistrerat.
Mätt på `1105e6fa` (branchen `jakob/repo-ordning` vid läsningen).
Storlek är Git-blob (`git ls-tree -l`). Blob-objektens existens är inte läst.

## 1. Vad den indexerade banken är

Det är den gamla filmbanken för fyra dealers: råa H.264-strömmar, ljud, stillbilder och Astrids packade utdelningar. Den ligger under `media/dealers/{astrid,amira,vera,mei}/runtime/indexed`.

| Del | Filer | Byte | MiB |
| --- | ---: | ---: | ---: |
| Astrid | 244 | 159 079 843 | 151,71 |
| Amira | 108 | 43 982 149 | 41,94 |
| Vera | 178 | 50 764 250 | 48,41 |
| Mei | 102 | 38 717 484 | 36,92 |
| **Banken** | **632** | **292 543 726** | **279,0** |

Astrids rigg (cirka 62 MB) är redan borta. Siffran ovan är det som är kvar, samma mängd som A30 räknade utöver riggen. Astrids `performance` är 115 filer och 105 276 616 byte (100,40 MiB) av Astrids rad.

**Spelaren använder den inte.** Spelet kräver `portrait-video` eller `layered` (`web/public/game-lanes.mjs:7-9`). Annat kastas. Klienten kräver `local` eller `layered` (`web/public/app.mjs:79-81`). En sparad lane med `indexed-video` ger inga dealers (`web/public/game-lanes.mjs:167`).

**Partner-API:t försöker, och får tomma listor.** Se fråga 2. Händelselistan på bordet (`presentation[]`) byggs utan att läsa filerna (`web/partner-presentation.mjs:38-65`).

**Studio läser registret, inte som spel.** `GET /api/v1/generations/mapping` läser index och Astrids performance-manifest via layout (`web/generations-api.mjs:20`, `web/clip-mapping.mjs:15-20` och `:71`). Varje rad har `actualPlayback: false`. Talrader och klippkontroll i Studio läser katalogen och Blob-pekare (`lab/lib/studio-voice-lines.mjs:47-52`, `lab/lib/studio-media-runtime.mjs:10-11`).

**Krok och CI läser bytena.** `audit-dealer-sync` (alla fyra dealers), `audit-performance` (Astrids manifest) och `audit-astrid-actor` (Astrids mattor och två talpar) körs i `.githooks/pre-commit-full:71-73` och i `.github/workflows/croupier.yml:135-137`.

**Render-imagen tar med hela banken.** `ops/cloud/Dockerfile:6` är `COPY . .`. `.dockerignore:43-46` utesluter källa, staging och review, inte `runtime`.

**Det som ingen spelare läser.** `streams/pre-trim` (17 604 349 byte) och `audio/en/dry` (4 841 794 byte) har ingen träff i pipeline eller produktkod. `streams/orig` (21 658 024 byte) och `audio/en/orig` (2 838 571 byte) spelas inte; läppsynkverktygen använder dem som orörd källa (`pipeline/retime-video-warp.py:16-20`, `pipeline/sync-audio-warp.py:7`). Mapparna `rhythm`, `smooth60` och `joins` (14 247 839 byte) öppnas inte av granskningen. 20 rader i layout (9 525 921 byte) pekar på indexerade filer som redan saknas i Git. En saknad läsare är en kandidat, inte ett bevis (README §3 punkt 8).

Presentationsbanken är en annan mapp: `media/dealers/astrid/runtime/presentation`, 83 filer, 173 985 094 byte. De 12 skyddade klippen ligger där, inte i den indexerade banken.

## 2. Partnerkontraktet (T7)

`POST /api/v1/assets` ger 0 strömmar, 0 utdelningar och 0 tal för Astrid, Vera, Amira och Mei. Dokumentet visar fyllda listor (`web/public/docs/partner-api.md:89-91`), med Astrids `centre-native-review` och repliken goodluck.

Listorna är tomma eftersom läsaren stannade i `web/public` när filerna flyttade. Ingen rad säger uttryckligen att svaret ska vara tomt. Läsaren tar `web/public` och sväljer läsfel (`web/partner-presentation.mjs:12-20`). Den anropas från `web/partner-api.mjs:143` med samma rot som servern sätter i `web/server.mjs:48` och `:301`. Under `web/public/dealers` och `web/public/dealer` finns 0 filer. Layout mappar de gamla adresserna till banken (`media/layout.json:69-74`). Granskningen följer kartan. Partner-API:t gör det inte. Ett lokalt anrop mot den här checkouten gav 0/0/0 för alla fyra, medan layout träffar manifestet.

Scen-URL:erna fylls ändå, till exempel `/dealers/astrid/scene.png`. GET av `/dealer/…` och `/dealers/{astrid,vera,amira,mei}/…` svarar **410** `local_dealer_retired` innan filen kan lämnas ut (`web/server.mjs:1171-1173`). Den spärren är avsiktlig. En fylld lista skulle alltså peka på adresser servern redan nekar.

**Att fylla listorna** kräver två saker: läsaren måste följa layout, och 410 måste hävas eller URL:erna bytas till en adress som faktiskt får lämna ut bytena. Det ändrar svaret partners får. Inget test låser listornas innehåll. Det är ett partnerbeslut, inte städning.

**Att låta dem vara tomma** kräver att dokumentet skrivs om så exemplet visar tomma listor, och att det står att scen-URL:erna svarar 410. Spelaren, Studio och imagen ändras inte. Ingen leverantörspanel.

## 3. Motsägelsen A30 ↔ A05/T3

A30 föreslog att börja med Astrids `performance`, eftersom partnerns `deals[]` redan är tom. A05/T3 säger att `audit-performance.mjs` skyddar manifestet som partner-API:t läser, och att granskningen ska vara kvar.

Båda stämmer, på var sitt lager. Koden namnger manifestet (`web/partner-presentation.mjs:20`), men träffen missar, så listan är tom. Granskningen träffar: den läser samma fil via layout och kontrollsummerar de packade filmerna (`pipeline/audit-performance.mjs:9` och `:17-19`). Manifestet har status `draft`, fyra tagningar och två fortsättningar, alla `review`. De sex mp4-filerna plus manifestet är 31 501 062 byte. Kroken (rad 72) och CI (rad 136) kör den kontrollen. De filerna kan inte lämna Git utan att granskningen pekas om, eller pensioneras med Jakobs ja.

Det som måste följa med om just den delen flyttas: manifestet, de sex tagningarna, `audit-performance.mjs`, katalogkontrollen som bäddar in JSON (`tools/build-runtime-media-catalog.mjs:10-14`, krok rad 63) och Studios klippkontroll (`lab/lib/legacy-clip-inventory.mjs:54`). Partner-svaret förblir tomt i båda fallen. Övriga 73 775 554 byte i performance-mappen öppnas inte av den granskningen. Det är inte ett frikort.

Actor är en annan granskning (`pipeline/audit-astrid-actor.mjs:8-22`, krok rad 73, CI rad 137). Den jämför Astrids strömmar med mattor och talparen goodluck och win. Strömmarna för alla fyra dealers skyddas av `audit-dealer-sync` (`pipeline/audit-dealer-sync.mjs:34-37`). De står kvar även när `deals[]` är tom.

## 4. Alternativ

Vinsten i (b) och (d) är checkout eller Render-image. Git-historiken krymper inte (A31). De 12 klippen ingår inte i någon vinst.

| Alternativ | Vid ja | Vid nej | Vinst | Risk | Vem påverkas | Panel |
| --- | --- | --- | --- | --- | --- | --- |
| **(a)** Låt banken ligga. Starta inte A30 fas 2 eller A31. | Inget flyttas. Spel, Studio, det tomma partner-svaret och imagen är som i dag. Dokumentet visar fortfarande fyllda listor. | Frågan förblir öppen. Ingen sparad megabyte. | 0 MB | 5 % | Ingen ny effekt. En partner som läser dokumentet kan fortfarande tro att listorna är fyllda. | Nej |
| **(b)** Flytta det som inte läses i produktion ut ur Git, till Blob eller privat arkiv, med läsback och samma hash. | Checkout och image kan tappa upp till 279 MB. Kroken blir röd om granskade filer följer med utan att auditarna pekas om. | Inget lämnar trädet. | upp till 279 MB checkout och image, 0 MB historik | 50 % | Spelaren: nej, om presentation lämnas. Partner: tomma listor kvar. Studio-videokarta och kroken: ja, om JSON eller granskade filmer försvinner. Render-imagen: ja. | Ja, om ett Blob-objekt saknas och måste läggas upp. Existensen är inte läst. |
| **(c)** Rätta partnerkontraktet först (T7), ta banken sedan. | Dokumentet skrivs om till tomma listor, och banken ligger kvar. Om Jakob i stället vill fylla listorna är det ett nytt svar: layout-läsning plus att 410 hävs eller URL:erna byts. | T7 förblir öppen, och bankbeslutet förblir trassligt. | 0 MB | 15 % för dokumentet. 40 % om listorna fylls. | Partner som läser dokumentet. Spelare, Studio och imagen orörda vid en ren dokumenträttelse. | Nej |
| **(d)** Ta banken ur Render-imagen med `.dockerignore`. Låt den ligga i Git. | Imagen tappar cirka 279 MB. Kroken ser fortfarande filerna. Videokartan i den körande imagen ser inte filmfilerna. Lätt att backa. | Imagen förblir stor. | cirka 279 MB image, 0 MB Git | 25 % | Render-imagen och Studio-videokartan. Spelaren läser inte banken. Partner-listorna förblir tomma. | Nej |

## 5. Rekommendation

Rätta partnerdokumentet så det visar tomma strömmar, utdelningar och tal, och låt banken ligga kvar i Git och i Render-imagen; börja inte med Astrids performance, eftersom granskningen fortfarande läser manifestet och sex tagningar fast partner-svaret är tomt.

De 12 sparade bankklippen i `media/dealers/astrid/runtime/presentation` (72 276 298 byte, BASLINJE §8) avregistreras inte, tas inte bort ur Blob och ingår inte i något alternativ ovan. De är inte utpekade fil för fil i den här läsningen. Hela presentationsmappen lämnas orörd.

## Tveksamt

- Ingen har i den här läsningen frågat produktion om någon partner anropar `POST /api/v1/assets`. De tomma listorna kan redan vara det som är i drift.
- Blob-index har en rad för alla 632 Git-filer, `access: public`, och storleken stämmer. En rad är inte ett bevis på att objektet finns.
- De 12 klippen ska inte blandas ihop med QA-kvittot från 29 september, som är ett mindre och äldre tolvtal (A04).
- BASLINJE §8 visar att Astrids registerposter inte matchar gamla Git-filer. Vera, Amira och Mei är inte med i det beviset.
- `partner-api.md:204` säger att videokartan visar klipp spelet kan spela. Kartan själv säger att de inte spelas, och spelaren kräver `local` eller `layered`.
- GitGuardian mot `main` var köad vid läsningen. Incidentlistan lästes inte. Inget påstås vara rent.
