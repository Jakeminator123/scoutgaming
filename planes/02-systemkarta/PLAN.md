# 02 — HTML-karta över system och spelflöde

## Syfte och mål

Skapa en vanlig HTML-sida i repot som Jakob och nästa utvecklare kan öppna
utan Codex-/Cursor-canvas. Den ska förklara systemet från grunddata till
synlig uppspelning och länka till källa, test och aktuellt verifieringsläge.
Första läsande versionen finns nu i
[`docs/system-map/index.html`](../../docs/system-map/index.html). Källorna är
inventerade på `5270c8ab93bf593512d0374cb9c36033e59dc103`; tidigare avgränsade
driftbevis på `3da83bf8` visas med eget datum. En inventering är inget nytt liveprov.

## Levererad grund — 4 oktober 2026

Tre arbetsagenter kartlade routes/inloggning, databas/lagring och spel-/talflöde.
Merge-agenten kontrollerade och sammanställde underlaget. Mappen innehåller:

| Fil | Ansvar |
| --- | --- |
| `catalog.json` | Tjänster, samband, dokumenterat driftbevis och öppna fel |
| `routes.json` | 9 sidgrupper, 11 API-grupper, 7 alias, 2 lanes samt login/save; 56 exakta Next-filer med 61 uttryckliga HTTP-exporter |
| `storage.json` | 4 scheman, 49 källkodstabeller, 299 kolumner med datatyp/nullbarhet, 49 primärnycklar, 22 explicita FK, lagringslager och befintliga tester |
| `flows.json` | 3 spel-/talflöden med 16 steg, faktiska events och testkopplingar |
| `build.mjs` | Läser katalogerna och befintligt envnamnsregister; bygger HTML offline |
| `index.html` | Fristående HTML med sök/filter, överblick och klickbara käll-/testdetaljer |

Öppna `index.html` direkt i en vanlig webbläsare. Den behöver ingen server,
databas eller Codex-canvas. Vid ändrat underlag, kör från aktuell checkout:
`node docs/system-map/build.mjs`. Generatorn läser nyckelnamn direkt från
`docs/environment-variables.json`; det finns ingen konkurrerande nyckellista.
Den kontrollerar filreferenser och samma käll-SHA, inte drift eller testresultat.
Kodlänkar och radbundna dokumentbevis pekar på inventerad SHA;
arbetsdokument utan radankare pekar på `main`.

Browserkontrollen omfattar navigation, sökning/filter, tabellfält, käll-/testlänkar
och GPU-flödets sex steg. JSON/JavaScript och 284 unika referensvägar är kontrollerade.
Inga nya providerjobb eller driftändringar ingår.

Den 5 oktober är de insamlade SQL- och Next-underlagen införlivade direkt i
katalogerna och HTML-detaljerna. De är inga separata researchrapporter.
SQL-källorna beskriver hela sitt definierade schema; de är inte en läsning av
installerade grants eller verkliga rader. Next-inventeringen beskriver filrutter
och uttryckliga verb; övergripande Web-/gateway-grupper återstår att detaljera.

## Föreslagen fortsättning

1. Bind sluträttningarnas faktiska driftacceptans i
   [plan 01](../01-slutratningar/PLAN.md) till redan passerade riktade tester.
2. Detaljera återstående Web-/gateway-handlers för vald kodversion.
   SQL-kolumner/FK och Next-filrutter är införlivade. Installerat live-schema,
   grants och fysiska mikrofon-/kamera-/mobilprov är separat verifiering.
3. Visa resultat från befintlig CI per definierat kontrakt enligt
   [plan 04](../04-tester-och-granskning/PLAN.md). Lägg driftvarning först;
   en avsiktlig kolumnändring ska inte automatiskt göra kartan eller en push felaktig.

Detta är en gemensam dokumentations- och granskningsyta som utökas stegvis.
Den inför ingen andra testmotor eller generella nya merge-/pushspärrar.

## Första leveransen: karta som går att lita på

Visa produktion, QA och historiska/avvecklade delar separat. Varje ruta ska
ange ansvar, tjänst, källa, senast verifierad SHA/datum och vad som ännu
inte är verifierat. Historiska alias ska märkas som sådana. En kodinventering
ska inte presenteras som ett genomfört driftprov.

| Del | Känd placering/roll att utgå från | Inventeringen ska visa |
| --- | --- | --- |
| Publikt spel och Studio | `www.scoutgaming.tech`, två tekniska Vercelbyggen | Canonicaladress, route, omdirigering, login och behörighet |
| Spelmotor | Produktens Render-tjänst | Serverägda kort, shoe, wallet, rundor, API och live-transport |
| Game/auth och Studio | Neon/Postgres | Scheman, tabeller, kolumner, nycklar, ägande och läs-/skrivvägar |
| Zoner | Explicit separat zonanslutning | `croupier_zones`, bild/klippkoppling och API |
| Beständiga medier | Privat Vercel Blob | Original, aktiva klipp och genererade paket; metadata pekar från Neon/register |
| Tillfälliga filer | Produktens disponibla runtime-temp | Ägare, livslängd och vad som kan återskapas |
| OpenClaw Director | Render | Presentations-/social-/talgränser, policy och `/data/catalog` |
| OpenClaw Gateway | Privat Render-tjänst | Modeller, separata agentroller, `/data/openclaw`, egen dashboardauth |
| Tal | Cartesia | Text → ljud; serverägda credentials och requestkoppling |
| Läppsynk | RunPod GPU | Worker/session, ljud+registrerad videokälla, ström/paket och avslut |
| QA | Egna Render/Vercel/Neon-scopes och bevarad disk | Samma kontrakt, isolerade data och avsiktligt avstängda providers |

### A. Alla användaradresser och API-adresser

- Inventera [frontendens app](../../apps/croupier-frontend/app),
  [Studios app](../../lab/app), rewrites och serverhandlers i
  [web/server.mjs](../../web/server.mjs) samt molngatewayen.
- Ta med `/`, `/blackjack`, `/player-login`, `/game`, `/studio` med dess
  undersidor, `/bo` och äldre kompatibilitetsadresser. Visa verkligt beteende:
  sida, redirect, privat API, borttagen route eller dynamiskt mönster.
- Skilj `/studio/administration` från dess interna flikar/actions. Varje
  menyval är inte en egen slug. Dynamiska `[id]`/catch-all-rutter listas som mönster.
- Visa publik URL och faktisk tjänst sida vid sida, inklusive QA-adresser.
  Inventera Vercelaliases via metadata; öppna inte varje gammal deployment som en aktiv app.

### B. Databaser och lagring

- Utgå från [product-schema](../../ops/neon-game/product-schema.sql),
  [Studio-migrationerna](../../ops/neon-studio/migrations.mjs) med SQL 001–004
  och [zonschemat](../../lab/lib/zone-cloud-schema.sql).
- För varje tabell: syfte, schema/kolumner, primär-/främmande nycklar,
  scope, skrivande tjänst, läsande flöde och relevant migration/test.
- Visa personuppgifter som kategorier; visa aldrig verkliga rader,
  lösenordshashar, anslutningssträngar eller sessionsvärden i HTML.
- Markera faktisk live-schemajämförelse som separat, läsande kontroll.
  SQL-filerna ensamma bevisar inte aktuell installation.
- Produktens gamla disk är avvecklad. OpenClaws och QA:s kvarvarande diskar
  har andra uppgifter och ska inte ritas som bortglömda produktdubbletter.

### C. Spelaren → spel → presentation → klipp/AI

Rita följande som två sammanhängande spår med verkliga händelsenamn från koden:

1. Login/session → behörig spelaridentitet → begäran om hand/action.
2. Render validerar session, rundläge och action och utför serverägd spelregel,
   kort/shoe/RNG och eventuell wallet-/rundtransaktion.
3. Verifierat spelresultat och presentationshändelse når den gemensamma
   spelarens kö. BO är administration; det är inte en extra spelmotor.
4. Sparad Studio-policy väljer tillåten presentation. Registrerade idle-,
   deal-/kort-/övergångs- och fasta talpaket får ett eget spår.
5. Vid genererat tal: serverns kontext/policy → OpenClaw/modell → exakt text
   → Cartesia-ljud → GPU-läppsynk → autentiserad ström eller paket → spelkö/END.
6. Visa avbrott, återanslutning, dubbla requests, cancellation, terminalstatus,
   journal och reservation. Samma GPU-jobb får inte förväxlas med samma spelrunda.

”RNG skickar signal till BO” är en förenkling som behöver ersättas med den
verkliga kedjan. Spelmotorn äger spelutfallet; AI/Director får inte ändra
kort, vinst, saldo eller shoe. Exakt antal signaler fastställs i koden,
inte genom att rita två antagna pilar.

För varje klipptyp visas ID, register, text/audio/video-koppling, pose/
framegränser, kalibrering och godkännande. Historiska BO-klipp är tysta
förhandsvisningar och ska inte beskrivas som automatisk lipsyncgenerering.

## Avgränsning och godkännande

- Bygg första kartan som läsande HTML med inbyggda eller lokala, maskerade
  inventeringsdata. Ingen ny backend, databas eller abonnemang behövs för den.
- Inga nycklar, administrativa mutationsknappar eller automatisk provideraktivering.
- Varje routegrupp, dataägare och pil har en befintlig källa eller tydlig
  markering ”behöver verifieras”. Sök/filter och klickbara detaljer ska hålla kartan läsbar.
- [Konton/nycklar](../03-konton-och-nycklar/PLAN.md) och
  [testkoppling](../04-tester-och-granskning/PLAN.md) ansluts till samma karta.
- Färdigt först när inventeringen täcker den valda källversionen och en
  granskare kan följa en spelhandling samt ett Studio-save hela vägen genom systemet.
