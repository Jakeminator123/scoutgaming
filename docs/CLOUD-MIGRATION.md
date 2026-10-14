# Scoutgaming: aktuell källa, drift och leverans

## Admin på huvuddomänen — migrationslogg 13 oktober 2026

Denna logg skiljer flytten av N1-arbetsytan till `/admin` från en framtida
avveckling av gamla hostnamn och från flytt av källkoden i `lab/`. Ingen
procentangivelse ersätter verifiering av varje flöde. Startpunkt: main
`4d6b1ebc` (PR104), Vercel READY och Render live.

### Arbetsytan och verifiering

- [x] Dealers i `/admin`: skapa, arkivera, återställ och lämna i papperskorgen
  verifierat med det uttryckligen godkända produktionsprovet Adminprov 2026-10-13.
- [x] Verklig Dragan-import: sex filer med ett gemensamt OK och en direkt via
  Adminroboten; 21 registrerade klipp efter återläsning. Den separata importen
  tar upp till 30 videor per omgång. Filer i banken är inte spelpublicering.
- [x] PR104:s rena talformulär och avslutade importchatt kan lämnas i produktion
  utan falsk varning. Verkliga utkast och pågående uppladdningar skyddas.
- [x] Befintliga bolag/team, rum/publicering, sammansättningar, dealerinställningar,
  medier, svar, provspelning, regler, småprat, dealeragent och guide öppnar inom
  Admin. PR102 återanvänder samma sparade data, API:er och granskade skrivningar.
- [x] Talgranskningens gamla `administration?tab=media-review`-länk öppnar
  rätt Admin-verktyg med dealer. Rättningen ingår i levererad PR110.
- [x] Materialbibliotekets bakgrundsval bevaras för både `tab=backgrounds`
  och `role=background` vid omladdning i PR110.
- [x] Äldre bokmärken bevaras: `lanes?tab=companies` öppnar bolag och
  `clips?dealerId=dragan` behåller dealer-valet i PR110.
- [ ] Slutverifiera rättningarna och full rutt-/funktionsinventering, inklusive
  autentisering, behörigheter, kontext och skydd för osparat arbete, på levererad SHA.

PR110 är mergad som `1595fb451cf19fbcbba1ece04e4bb8c7c74a9bc6`.
Vercel `dpl_aZKAibo81bFLGUfKuyHPSnkckPNm` är READY och Render
`dep-db7aknmi0phs738sv6e0` är live på samma SHA. Full regression före
leverans: 3 552 pass, 11 skip, 0 fel; samtliga CI-kontroller passerade.
Utloggad `/admin/deletion` går till rätt Studio-inloggning med returnTo.
Inloggat beroendeträd kontrollerades 14 oktober efter att webbläsartransporten
åter fungerade. På PR117:s levererade `0511206d` öppnades de 13 Adminverktygen;
Dragan följer med mellan de dealerbundna verktygen. Talgranskning läser rätt
administratörssession och Dragan-val. Utloggade Dealers-, Talgranskning- och
Radering-länkar går till login med rätt returnTo. Detta stänger inte den bredare
acceptansen av samtliga behörigheter, verkliga utkast och spelstarter ovan.

Global ändringslogg saknar ännu eget anslutet API; det fanns inte heller ett
motsvarande fungerande Control-flöde. Bolagets journal finns i Bolag & team.
Det är separat produktarbete och ska inte döljas bakom påstådd migrationsparitet.

### Underlag inför senare frikoppling

- Vercelprojektet `scoutgaming` (`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`) äger
  www/apex och de tidigare Studio/frontend-aliasen. På 4d6b1ebc består bygget
  av `web`, `studio` och `speech`: två Next-appar samt taltransport. En äldre
  Lab-adress är inte automatiskt ett separat aktivt projekt.
- Det dokumenterade reservprojektet `prj_I6KkhVlk4qMSPlAwSPZdnz4aVQ2s` gav
  404 i nuvarande scoutgaming-scope. Det bevisar inte radering; verifiera
  ägarskap/scope och faktisk återställningskälla före eventuell avveckling.
- `/studio` är fortfarande teknisk basePath på huvuddomänen för Admin,
  partner/lobby, autentisering, API:er och mediefiler. Behåll tjänsten/routningen.
- `lab/lib/studio-native-runtime.mjs` och `studio-native-request.mjs` kräver
  fortfarande två olika tillåtna HTTPS-origins. Ta inte bort
  `CROUPIER_LAB_UI_ORIGIN` innan Host-/originvalideringen ändrats och positiva
  samt negativa autentiseringsprov passerat. Inga origin-/miljöändringar ingår här.
- Admin importerar modeller och komponenter från `lab/`; Render importerar
  bland annat media-, Blob- och projektkod och bygger Lab i Docker.
  Mappen får tas bort först efter flytt av samtliga konsumenter, byggspår,
  SQL/migrationsspår och autentisering. Behåll `open-claw/lab/` och aktiva
  legacyflaggor tills deras egna konsumenter har ersatts.
- Neon/Blob-data, konton, publiceringshistorik och frysta paket är samma källa
  genom flytten. Behåll gamla länkar som kompatibilitet och verifiera verklig
  N1→publicering→N2→N3 samt spelstart innan någon beroende tjänst stängs.

### Kevins aktiva dealerfiler

Färsk kontroll av refs: `kevin` = `f15b2af16ea7113d451f5c5da14fda031901392a`,
`kevin-staging` = `315cfc554330f1d5541a7ed3bb84044877a6b992`. Materialet
sorteras efter faktiska kodreferenser för Dragan/Dragge och Paow, inte efter
alla filer i mapparna. Senaste Git-build är inte bevis för senaste körande
Kevin-deployment. Manifest, kopior och hashjämförelse hålls privat utanför Git.
Första inventeringen via ordinarie UI/API visade Dragan 21, paow 5 och
paow-v2 1. Efter den uttryckliga rensningen och importen den 14 oktober visar
produktions-Admin Dragan 27 och ren PAOW (`paow-kevin`) 11. De gamla
Paow-identiteterna är borttagna; deras tidigare granskningar är inte ärvda.

Per dealer refererar ordinarie spelkod 35 giv-/vändningsklipp, tre grundloopar
samt 70 repliker. Ytterligare tio är preview/fallback och elva bara förladdade.
77 Dragan- och 62 Paow-filmer väljs inte i den granskade spelvägen. Det privata
paketet `kevin-active-dragan-paow-f15b2af1.zip` innehåller 274 kodrefererade
filer med manifest och dealer/fack/sökväg/hash-CSV; SHA-256
`a69caf28bd1aa1db0a703d63e4a17aad37fd2da2222763c1bc83c208996a8866`.
Arkivet är 325 280 137 byte. Alla 274 källfiler kontrollerades mot Git-blob
och disk, och samtliga 279 ZIP-poster öppnades och hashverifierades.
Sju befintliga Dragan-poster matchade Kevins material och återanvändes.
Sex nya Dragan- och elva rena PAOW-filer är importerade via de befintliga
native-tjänsterna med konto-/schema-/grant-/CAS- och fullbyteskontroller.
Alla 17 är alternativ och ogranskade; inga händelseval, publiceringar eller
betalda jobb skapades. Privata slutkvitton bekräftar registrering och hash.
Detta är filproveniens och urval, inte godkänd pose/läppsynk eller publicering.
Staging-grenens villkorade dynamiska talväg ingår inte i Admin-migreringen.

### Uttrycklig rensning och bevarat material

Jakob har begärt permanent borttagning av gamla `paow`, `paow-v2`, Amira
och Johanna, deras exklusiva klipp och övergivna sammansättningar, samt de
fyra bolagen Johns spelbolag, Kevins Spelbolag, SG test och Nordic Bet med
gamla rum. Efter ett motstridigt besked från en annan chatt bekräftade han
åter att även gamla `paow-v2` ska ersättas med ren PAOW från Kevins material.
Detta är ett avgränsat rensningsmandat, inte en ändring av vanlig papperskorg.

Dragan, Astrid, nya PAOW, Anna och roulettens tillhörande material ska
bevaras, liksom alla bakgrundsfiler och de fem nya standardborden.
`Nordic Bet Roulette` är ett gammalt rum bundet till PAOW Studio, inte
Annas separata roulettekonfiguration. Rumsborttagning får inte radera filerna.
`mobile-phone` delas av flera dealers; gammalt dealerval tas bort utan att
hela mallen eller Astrids fungerande spel-/talväg försvinner.

- [x] Leverera den röda menyraden Radering med anslutet beroendeträd och
  tydlig skillnad mellan sparad mall, publicerade val och tillgänglig historik.
  PR110 är driftsatt; den inloggade visuella kontrollen på huvuddomänen
  14 oktober verifierar röd meny, registerläsning och Anna-/Dragan-kopplingar.
- [x] Läsande lokal registerbackup: 3 dokument, 60 mediaposter, 43 paket,
  157 dokumenthistorikposter och befintliga Forge-/bolagsberoenden exporterade
  i en read-only repeatable-read-transaktion. Filen hålls privat utanför Git.
  De 12 bolagsrollerna kompletterar exporten i en separat privat fil.
- [x] Fysisk lokal kopia av 232 inventerade objekt under fyra gamla
  dealerprefix och två gamla bord: 145 404 657 byte, alla SHA-256 verifierade.
  Ingen extra kopia skapades i Blob.
- [x] Lokala gamla preview-/porträtt-/Amirafiler har kopierats privat och
  hashkontrollerats före borttagning: 13 Paow-previewfiler (4 245 767 byte)
  samt ytterligare 84 filer (16 917 281 byte). Dragge, tre delade previewassets
  och Kevins originalurval bevaras. Kodändringen är driftsatt med PR117.
- [x] Slutför exakt objektägande och kvarvarande konsumenter före radering.
  Förinventeringen hade 28 gamla dealer-mediaposter, varav 20 redan var
  raderingstombstones; Forge hade dessutom två privata PAOW-ankarbilder.
- [x] Avsluta gamla Forge-jobbets möjliga commit-väg, gallra beroenden och
  radera överenskomna objekt permanent. Databas-COMMIT och 232 Blob-raderingar
  är bekräftade; skyddade resurser verifierades i samma databastransaktion.
- [x] Registrera ren PAOW utan gammal Forge-profil och importera 11 utvalda
  Kevin-filer, samt komplettera Dragan med sex filer. Slutkvittot och Admin
  visar 27 Dragan-/11 PAOW-klipp; sju befintliga Dragan-filer återanvändes.
- [ ] Koppla utvalda filer till faktisk uppspelning, granska poser och
  publicera önskat Dragan-rum efter sammanhängande spelprov.
- [x] Slutverifiera denna rensning/import i produktion, inklusive att skyddade material och dealers
  är kvar och att borttagna identiteter inte skapas som syntetiska lobbykort.
  Admin visar 27 Dragan-/11 rena PAOW-klipp, Astrid och Anna med sitt rum.
  Beroendeträdets kompletta registerläsning visar inga gamla målidentiteter,
  samtliga bevarade bakgrunder, fem Blackjack-bord och Annas roulettebord.
  `/lobby` visar Scoutgaming Demo med Annas publicerade Roulette-rum; de
  fyra gamla bolagen är borta. Ingen ny spelrunda kördes i detta slutprov.

PR117 är mergad som `0511206dec4cb8468fe92d5f03202718d3bf2585`.
Vercel `dpl_5aP2rJ1C9NbXWJXT4HWc1giMAsxS` READY och Render
`dep-db7c56ss728c73d0fgs0` live verifierades på samma SHA före rensningen.
Full lokal regression efter main-integration: 3 592 pass, 11 skip, 0 fel;
PR- och main-CI passerade. En första skrivskyddad SSH-kontroll nådde äldre
revision under instansbytet och stoppade utan skrivningar; ny anslutning
verifierade rätt revision och samtliga 304 originalrader.

Rensningsplan `93a8b26b37e24e9370164a4ea975d662c5c5485eef089caab9594679f0bec3b6`
gav 164 uppdateringar och 139 borttagningar, med 162 historikrader kvar och
979 kontroller av skyddade delträd. Skyddade tabellfingeravtryck var oförändrade.
Blobmanifest `956871f14885339f23d044d6678166264e6cd9ca122e50a3314b286fec881f4d`
verifierade noll kvarvarande referenser och 232 borttagna objekt, 145 404 657 byte.
Ingen ny Blob-backup eller papperskorg skapades. Konton, plånbok, spel och QA
ingick inte i rensningen. Importens egna temporära Render-filer är borttagna.

### Nästa Dragan-flöde — avgränsning 14 oktober

Swedish Games (`swedish-games`) är skapat i produktions-Admin på Jakobs
uttryckliga namnval. En separat sparad sammansättning för Dragan använder
hans val Lounge varm (video) och Blackjack Oak; endast Dragan är tillåten.
Den har ID `swedish-games-dragan-black-81c0867c-5de8-4b48-bcc5-1fe3ce578b39`.
Dragan är registrerad men saknar ännu kopplat rum. Elva lokala MP4-original
matchar redan hans bevarade biblioteksfiler; de behöver inte laddas upp igen.
Två PNG-filer är VILA-/REDO-referenser. Importgränsen 30 betyder högsta antal
videor per omgång, inte att 30 nya original har inventerats.

Kevins positionsklipp ger REDO→REDO, medan grundlooparna ger VILA→VILA.
Full filmad givning med hålkort/vändning och 52 alternativa poseklipp kräver
explicit sekvenshantering. Detta blockerar inte ett grundspel med egen
grundloop och serverstyrda kort; inga filmade giv-/talklipp krävs för publicering.
`transitionClipsForDealer` har ännu ingen produktionskonsument; fackval räcker
inte för att aktivera Till/Från skon. Inga av de 13 Kevin-Dragan-hasharna har
matchande befintlig kortkalibrering. De 140 talfilmerna saknar komplett
takebunden text/ljud-/kalibreringsacceptans och är inte aktiverade.

Fortsätt med uttrycklig klipp-/posebindning och Blackjack-rum;
granska den valda bakgrunden och bordet på desktop/mobil och
två följande uppspelningar före publicering. Anna/roulette ska bevaras.
En privat HTML-steglogg på användarens begäran beskriver detta flöde utanför Git.

Grundloopen Kevin V2 · andning är sparad på Dragan. Oak-bordets överkant
justerades visuellt till `table.y=0.35` i båda format; bredd mobil `1`,
desktop `0.31640625`. Provspela öppnade faktisk spelkod med separat
minnesdatabas och syntetiskt testsaldo. En desktoprunda avslutades och
mobilvyn kontrollerades, men spelacceptansen är underkänd: spelarkort och
insatsplatser följer äldre dealerbundna ankare och hamnar vid bordets fot.
Det finns ingen sparad separat Oak-geometri i nuvarande Studio. Återstår
gemensam, sparad projektion för kort och insatsplatser samt ny acceptans.
Rummet är därför inte publicerat. Två godkända sammanhängande rundor i
båda formaten är fortfarande ett öppet krav; ett fungerande testsaldo
eller en snygg editorbild uppfyller inte det.

Kodgranskningen visar att Blackjack tillåter bordbyte mellan rundor men
spärrar det vid `round || busy`; Roulette saknar intern bordsväljare.
`/lobby` och `/play` använder samma publicerade operatörs-/rumsläsare, men
`/lobby` saknar ännu `/play`-vyns bordval. `/game` är Blackjack-alias och
URL-fältet `table` betyder rum, inte förgrundsbord. Detta är ett konkret
kvarvarande spelarflöde och ska inte beskrivas som full lobbyparitet.

Inför rensningen låg två gamla uppladdade bord endast i materialpapperskorgen:
`4b688411-d186-4229-8f8a-046cd1b0a2c5` och
`b52b9077-de4e-4691-a570-a41a90312f6a`. De har samma bildhash men olika
Blob-sökvägar. De refererades av 112 respektive 105 historiska projektrader,
inklusive delade Astrid-mallar, men inget av de 43 operatörspaketen.
Exakta referenser och objekt togs bort i den genomförda rensningen ovan;
historikraderna bevarades i stället för att raderas i sin helhet.
Johannas och en Astrid-fil har också samma hash men olika objektvägar;
hashlikhet är aldrig bevis för ägande eller tillstånd att radera båda.

`tools/studio-retirement-plan.mjs` är en ren offlineplan/transform med
exakta ID:n, komplett inventeringskrav och revisions-/hashkontroll.
Den gör inga databas- eller Blob-anrop. Faktisk verkställighet måste läsa om
aktuellt underlag och bevara skyddade resurser. Spelarkonton, saldo,
transaktioner och roulettens aktiva arbete ingår inte i rensningen.

Inför rensningen hittades ett Forge-race: en nedladdning som passerat den
tidigare dealer-kontrollen kunde återskapa profil/media efter radering.
Kodrättningen återläser exakt jobb/lease och aktuell dealer under samma
Studio-lås som varje skrivning; profil-/jobbskapande och medieägande
kontrollerar också registret. 60 isolerade Forge-/repositoryprov passerar.
Chattminnets profilskapande återläser samma dealerregister under lås.
Låsordningen följer befintlig native Admin: game först, därefter Studio;
ett samtidighetsprov omfattar de separata anslutningarna.
Produktionsgallringen genomfördes först efter levererad rättning och färskt CAS-underlag.
Ett nytt sparat projekt upptäcktes; endast current project och dess fyra
tillkomna historikrader återlästes för att bevara det parallella Anna-arbetet.
Senare adminändring har också återlästs separat. Backupens förlust av
mikrosekunder i tidsstämplar är reproducerad; exakt precision kompletterar
originalet utan att skriva om det. Färsk read-only serverkontroll matchar
samtliga 304 målposter. Planen bevarar samtliga 162 historikrader och gör
164 exakta dokumentuppdateringar samt 139 raderingar av gamla beroenden.
Fullhook på `2f7b891a` passerar: 3 585 pass, 11 skip, 0 fel (74 grupper).
En separat Blob-kontroll håller Studio-skrivlåset genom färsk referenskontroll,
exakt objektradering och återläsning. 15 isolerade prov omfattar återstart
efter två avbrott och förlust av låsanslutningen; ingen livekörning följer av dem.

## OpenClaw dashboard utan terminal — liveacceptans öppen

- [ ] Driftsätt Gateway, Director och Vercel med N1-engångslänken. Befintlig
  privat helper och Gatewaycredential används; inga nya hemligheter krävs.
- [ ] Verifiera direktöppning från /admin/ai/models i en ny profil och att
  utloggad, partner och spelare nekas utfärdande. Native OpenClaw-sessionen
  är separat och finns kvar efter utloggning från sajten.
- [ ] Verifiera Sol 6.1 genom Gateway efter den additiva katalogmigrationen,
  välj sedan endast önskad administrationsroll via N1/CAS. Alla befintliga
  primary/fallback-val och talroller är bevarade av migrationen.
- [ ] Mät rollernas faktiska trafik före eventuell pensionering. Fem
  registrerade roller och samma grundmodell bevisar inte inaktivitet;
  produktens talanrop kan dessutom välja modell per anrop.


## Adminroboten på alla sidor — kod klar, liveacceptans öppen

- [ ] Granska och driftsätt den separata chattknappen: publik Scoutguide utan
  interna data, N1 Adminroboten och N1 OpenClaw. Sol 6.1/high för administration,
  Luna 6 för publik hjälp. Klippimport och dealerspelchatt behåller egna flöden.
- [ ] Verifiera Vercels befintliga Studio-modellkonfiguration och båda modellerna
  i den driftsatta tjänsten. Lokala syntetiska modellanrop lyckades 13 oktober.
- [ ] Liveacceptans med separata konton: partner/spelare/utloggad nekas interna
  läsningar och skrivningar; aktuell N1 kan granska konsekvenser, skriva mål-ID
  och bekräfta. Kontobyte/rättighetsändring tömmer lokal historik och spärrar
  gamla godkännanden. Inga riktiga produktionsobjekt raderas som test.
- [ ] Bekräfta anslutna datakällors täckning samt önskat Gatewaymodellbyte.
  Levande Gateway 2026.9.5 hade fem roller på 5.6-terra vid statusläsning
  13 oktober; denna kodleverans ändrar inte livekonfigurationen.

Full lokal regression, produktionsbyggen och isolerat dialogprov passerar.
Renderkontots loggar/diskar, godtyckliga OpenClawverktyg, fri SQL och kontinuerlig
övervakning ingår inte. TalkingHead har ingen integration i denna leverans.
Detaljer och bekräftelsemodell finns i [handoff](JOHN-HANDOFF.md).

Statusförtydligad 12 oktober 2026. Detta är den enda migrationschecklistan. Daterade kvitton nedan avser respektive leverans; aktuell Studio-/paket-/portalöverlämning finns i [JOHN-HANDOFF.md](JOHN-HANDOFF.md). T2–T4 är fortfarande öppna där full acceptans saknas, även om flera delsteg nu är levererade.
Äldre checkpoints och avslutade delstegs detaljer finns i
[fryst historik på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md).
Privata kvitton, FAIL-historik, journaler och backups bevaras på sina platser.
Aktuell terminologi och flödeskarta finns i [systembeskrivningen](LOCAL-PRESENTATION-RUNTIME.md).
Senare kodversion uppgraderar inte ett äldre acceptansprov automatiskt.

## PNG och ljud i Studios mediaregister

**Inte aktiverat, 13 oktober 2026.** Status-only systemmetadata verifierar
`media_records_check` i project `wandering-hill-60561912`, main
`br-flat-fog-b161a6r8`, databas `croupier_game`: bara `video/mp4` och
`video/webm` tillåts. Faktiska 001–008 i isolerad PostgreSQL 16.15 ger samma
23514 för PNG/WAV/MP3. Parser/v12, alfaprov eller en positiv minnespool
ersätter inte detta databasprov. Den omedelbara rättningen spärrar övriga
MIME med typed 415 före native grant/bytes och repositorytransaktion.

Plan för separat granskad leverans; ingen SQL eller ledgerändring ingår här:

1. Samordna ett nytt migrationsnummer **011 eller senare**. 009 är reserverad
   för B18 och 010 för B19. Ändra aldrig 001–008 eller deras checksummor.
   Lägg den nya migrationen i den ordinarie explicita migrationslistan och
   gör den obligatorisk. Ingen `deploymentOptional` för ett befintligt bord.
2. Utöka endast MIME-villkoret, med transaktion, migrationslås, exakt
   target/constraintkontroll och ordinarie checksum-/structure-ledger.
   **Nuvarande runner kan inte utföra detta ensam:** `migrations.mjs`
   jämför varje äldre `structure_checksum` med aktuell tabelldefinition.
   En ALTER skulle därför göra 001:s fingerprint avvikande. Förbered först
   en explicit versionerad strukturevolution för exakt denna CHECK:
   bevara alla äldre ledgerposter/checksummor och validera både tidigare
   historisk struktur och den nya tillåtna strukturen mot rätt version.
   Oförklarad drift, saknad ny ledgerpost eller fel tidigare fingerprint
   måste fortsatt nekas. Testa även att den äldre runtimeversionen nekar
   det nya schemat; använd inte ett generellt driftundantag.
   Behåll alla tidigare identitets-, objekt- och hashvillkor. DDL-utkast,
   **inte ett direkt körkommando med dagens runner**:

   ```sql
   ALTER TABLE croupier_studio.media_records
     DROP CONSTRAINT media_records_check;
   ALTER TABLE croupier_studio.media_records
     ADD CONSTRAINT media_records_check CHECK (
       jsonb_typeof(record) = 'object'
       AND record ?& ARRAY['id','sha256','contentType']
       AND record->>'id' = id::text
       AND record->>'sha256' ~ '^[a-f0-9]{64}$'
       AND record->>'contentType' IN (
         'video/mp4','video/webm','image/png','audio/mpeg','audio/wav'
       )
     );
   ```

3. Kör hela faktiska kedjan före/efter i ny isolerad PostgreSQL, även med
   giltiga äldre videorader. Verifiera bevarade id/hash/object-spärrar,
   ogiltig MIME, korrekt PNG/MP3/WAV, register/audit-atomicitet, rollback,
   återförsök, omstart och att kontrollprovet inte längre bara använder minne.
4. Förbered den separata aktiverings-PR:en. Behåll tidig formatspärr tills
   den erforderliga migrationen är verifierad; utökad whitelist ska bindas
   till den nya obligatoriska schemaversionen, inte till filnamn, AI eller
   enbart Render v12. Ofullständigt schema får inte utfärda Blob-grant.
5. Först med separat uttryckligt mandat får operatören applicera den
   granskade migrationen mot produktions-Neon, **före kodmerge**, enligt
   befintlig `check-migration-readiness.mjs`-procedur. CI-readiness måste
   sedan vara grön; ingen bypass eller försvagad CHECK används.
6. Efter deploy verifieras ett separat godkänt medieintag med faktisk
   PNG/ljudregistrering, avkodning, exakt privat återläsning, audit och retry.
   Ingen dealer/rumsregel publiceras automatiskt. Runtime v12 måste fortfarande
   stödja alfa/roulette. Tidiga mediefiler kräver sina separata visuella prov.

Rollback efter nya records innebär att intake spärras och en läsande
kompatibel runtime behålls. Återställ inte video-only-constrainten över
nya giltiga records och radera inte sådana records för att göra rollback grön.

## Avvecklade arbetsanteckningar, 12 oktober 2026

Spårade arbetsanteckningar och de åtta planfilerna tas bort ur trädet i denna leverans. Git-historiken på `00ea55c5` behåller dem. Lokala ignorerade env-kopior och bildmappar är oförändrade och ingår inte i produkten.

Öppet som fortfarande gäller, och som inte redan har en egen rad nedan:

- Probe är fortfarande Astrid-specifik (handoff 12 oktober). Checklistans C9, textprov verifierat i produktion, är inte stängd av senare handoff.

Övriga öppna rader från checklistan 8 oktober finns redan i denna tracker: spelare, transaktioner och rapporter (N2.4, JN2-E), marker (JN2-D), partnerns lösenordsåterställning (JN2-J), visuell partneracceptans (JN2-B) och samlad P6 med fyra dealers. Operatörsjournalen (N2.5) är levererad i JN2-C och öppnas inte igen. Systemkartans planerade ruta N2.4 pekar på `docs/system-map/planned.json`.

## Repo-ordning, slutläge 12 oktober 2026

Detta stänger inget JN2-steg och ingen medieacceptans. Det är trädläget efter planen (V1 #19, V2 #23, V3a #34, V4 #40 och avslutet #51 `a5441feb`, 13 oktober 00:35, med A21 och A99), inte ett nytt produktionskvitto. #53 (`36d6d13f`) är dokumentmergen därefter. Därefter kom #54 (`426fa114`). Före/efter-tabellen står i handoffen. Planmappen `ordning/` är borttagen; den finns i historiken på `faf0e822`.

- `github-work-vercel-entry` finns inte (A18:s env-granskning). Spelarbygget är `apps/croupier-frontend/tools/player-ui-build.mjs`. `ops/vercel-entry/` är borttagen.
- `ops/caddy/bettalotto-game-auth.Caddyfile` är borttagen. A18: bettalotto.se svarar 301 till `https://croupier.scoutgg.dev/` och använder inte filen. Aktuell Caddy: `kevin/croupier-scoutgg/drift/`.
- `/casino.html` är 308 till `/play`. Granskningssidorna är borta. `/v2` är kvar som 307. Originalmedia-API:t i Studio är borta. Registrerad video stannar på den gemensamma scenen.
- Källkoden `test-videoeditor/` ligger i `packages/presentation/{compositor,docs,preview}` och källkoden `presentation-runtime/` i `packages/presentation/runtime/`. Publik URL `/presentation-runtime/*` är oförändrad. Shimmen `presentation-runtime/live-idle.mjs` finns kvar avsiktligt för `web/public/local-presentation.mjs`, som laddas i både Node och webbläsare.
- Indexerade banken, läppsynkverktygen och bankauditarna är borta ur Git och Render-imagen. Av 632 filer togs 598 bort (cirka 278 MiB). 34 MP3 (17 Astrid, 17 Amira) i `runtime/indexed/audio/en` står kvar för de bevarade green-speak-talparen. `runtime/presentation`, GPU-workerns läppsynk, dess CI-jobb och röstkällor är inte avvecklade.

**Avgränsad överlämning 13 oktober: delat spelkommandokontrakt.**
`studioCommandSignature` ligger i `packages/shared/studio-game-command.mjs`;
spelmotorns `web/studio-game-commands.mjs` behöver därför inte längre importera
Studios HTTP-authoritymodul. Den gamla sökvägen återexporterar samma funktion.
HMAC-format, felbeteenden, behörighet, publicering och lagring är oförändrade;
övriga `lab/lib`- och OpenClawberoenden finns kvar. På bas `60defa5` passerade
Studio-bygget och 29 riktade kontrakts-/kommandotester. Full ordinarie hook:
3 339 godkända, 7 överhoppade, 1 fel i oförändrat `local-session.test.mjs`
(processens startidentitet saknas här); samma fel återkom på ren `435c496`.
Inga testgrindar ändrades. Systemkartans kontroll passerar med varningar om
historiskt/ändrat underlag; miljöregister, testregistrering och diffkontroll
passerar. GitHub CI återstår. Ingen merge eller produktionsdeploy ingår.
Notisen ligger här för att hålla `JOHN-HANDOFF.md` orörd under PR #91.

Öppet efter planen:

- [ ] Acceptans efter deploy av slut-SHA:n: Vercel READY och Render live; röktest av `/`, `/play`, `/play/blackjack?operator=…`, `/control/login`, `/partner/login` och `/casino.html`; N1 → publicering → N2 → N3 för `sg-test`, `johns-spelbolag` och `nordic-bet`; tre lager på mobil och desktop med två uppspelningar i rad; negativa prov (fel bolag, saknad media); rehearsal för paketens registrerade dealers. Delkvitton 13 oktober, inte full acceptans: egen läsande kontroll 01:03 visade att Render och Vercel kör `a5441feb`, att sökvägarna svarar som förut och att runtime-hasharna är oförändrade. Rum paow3 hos `nordic-bet` provspelades av föregående agent 00:45 på `a5441feb`.
- [ ] B18 permanent radering av klipp (beslutad 12 oktober): raden och sökvägen bort med journal (migration 009). Varje sparad paketrevision, fryst presentation eller öppet rum som refererar klippet spärrar. Bekräftelse kräver inskrivet namn. Egen PR; migrationen körs mot produktions-Neon före koden.
- [ ] Bankens Blob-objekt saknar indexrad. De rensas först med B18:s journal.
- [ ] B19 talklipp från vilobilden (beslutad 12 oktober): MuseTalk 1.5 på RunPod med dealerns egen röst, pilot Astrid `goodluck` på svenska och engelska, migration 010 efter B18. Betalda anrop bekräftas med Jakob först. Förtydliga regeln i `AGENTS.md`: förbudet gäller inklistrade munnar i spelaren, inte MuseTalk-genererade. Språkval i spelaren saknas. Utkastet #41 föreslår `009-talkclip.sql`, men enligt besluten är 009 B18 och 010 B19 (senaste Studio-migrationen är `008`). Numret rättas när B19-PR:en öppnas. Den äldre plan-PR:n #41 stängdes vid PR-städningen 13 oktober; beslutskommentaren och grenen bevaras, och B19 är fortfarande öppet här.
- [ ] A22b och framåt, `packages/platform`: utredningen A22a är ärende #52 (`beslut`). Skivorna börjar först efter Jakobs beslut (B12). Proceduren står i `ordning/aktiviteter/A22-platform-karna.md` på `faf0e822`.
Efterarbetet 13 oktober (bas `426fa114`, branch `jakob/ordning-slutfix`) har gett SL-raderna nedan:

- [x] SL-01/SL-02: `tools/raderingsgrind.mjs` räknar den gamla sökvägen vid rename som borttagen, så länge ingen shim finns kvar. `--strict` ger exit 1 för trasiga importer eller aktiva registerrader; historiska omnämnanden är diagnostik. `--staged` läser indexets diff, kod och register; standardläget läser HEAD. Egna verkliga Git-prov: 10/10, inklusive de fyra tidigare läsfelsskyddsproven. Den byteidentiska gamla grinden på `426fa114` och `8c77d05a` faller på de nya regressionerna.
- [x] SL-03, kodskydd återkontrollerat 13 oktober på `cc63db71`: `preservePublishedRoomEnvironment` nekar ändrad bakgrund/policy och jämför hela den frysta viloposten för inbakad miljö. `presentation-room-api.test.mjs` provar oförändrad delad miljö, konflikt utan skrivning och bevarad film vid nya rum. Uppgiften på `426fa114` ovan är historisk; detta lokala regressionsbevis ersätter inte den öppna produktions-/rehearsalacceptansen.
- [x] SL-04: `astrid-select-baseline` arkiverar hela urvalets importkedja, inklusive `web/public/dealer-speech-profile.mjs`. Utan `--write`: 160 fall, 0 avvikelser mot HEAD och guldresultaten, inga nätverksanrop. Basens version ger exit 1 (`ERR_MODULE_NOT_FOUND`). Nytt test kräver att `ARCHIVE_PATHS` täcker importgrafen.
- [x] SL-05: aktiva krav på den borttagna `pipeline/audit-dealer-sync.mjs --probe` är ersatta med `.githooks/pre-commit` och provspelning av berörda registrerade dealers. Daterade kvitton står kvar som historik.
- [ ] SL-06: `node tools/migrate-media-layout.mjs --verify` faller på `dealers/astrid/runtime/presentation/repliker/bank.json`, som togs ur Git i `c474544c` (5 oktober, före planen) men står kvar i `media/layout.json` och `media/blob-index.json`. `astrid-zones-manual-snapshot-2026-09-29.json` är en giltig ospårad källa (hash och storlek stämmer). Raden tas bort med B18:s journal, inte separat.
- [ ] SL-07: `speech-media.json` pekar på `dealers/astrid/speech/{win,goodluck}.mp4`, som saknas. Spelaren läser inte filen; labbinventeringen märker posterna som ej uppspelade. Filens bytes är låsta mot layout och blob-index, så den ändras inte separat. B19:s `goodluck` är ett nytt klipp, inte dessa filer.
- [x] SL-08: alla tre källorna finns kvar och används. Render-/Studio-inventeringen omfattar nu `cloud-media-store` och `video-registry`; Studio omfattar även `legacy-clip-inventory`. Befintliga läsningar av `LAB_PUBLIC_URL` och `CROUPIER_DATA_DIR` är tillagda som villkorade Studio-namn. Inga miljövärden eller tjänsteinställningar ändrade.
- [ ] SL-09: läsande utredning 13 oktober på main `161957f1`: utan inloggning ger Render `/blackjack?lane=layer-preview&rehearsal=1` 307 till www `/game?rehearsal=1`; www `/play/blackjack?lane=layer-preview&rehearsal=1` ger 303 till `/player-login` med lane/rehearsal kvar. Inget 503 reproducerat före inloggning. Serverns möjliga 503-vägar är selector-/lagringsfel (`web/game-entry-operator.mjs:59–65`, `web/server.mjs:1253–1254`), avsiktligt tom startläge utan Neon (`:1265–1268`) och yttre transport-/lagringsfel (`:1291–1296`). Samma startfelsvägar finns på `00ea55c5`, `faf0e822`, `a5441feb` och `426fa114`; selectorvägen refererar inte `test-videoeditor` eller gamla runtime-filer. Inloggad rehearsalacceptans är fortsatt öppen; ingen reservväg eller driftändring tillagd.
- [ ] SL-10: `build-hands.sh` är enda byggaren för bevarade `runtime/hands` men kräver borttagna Vera-strömmar. `build-previews.sh` gör ingenting utan `streams/index.json`, och `prepend-contact-entry.mjs` skriver till borttagna `runtime/indexed/performance`. `build-contact-review.mjs` och `encode.sh` nämner inte banken. Ingen byggare raderas; `runtime/hands` saknar audit.
- [x] SL-11: generatorn delar inte tabellceller vid Markdown-escapad pipe. `act` och `insurance` har tre celler med hela kodvärdet. HTML är regenererad från oförändrad Markdown; nytt synkprov kontrollerar även Copy-for-LLM-texten. Ingen publik route tillagd.

## Flödesomstrukturering, 12 oktober 2026

N1:s nya huvudyta är `/admin`; `/control/compositions`, `/control/companies`, `/control/rooms` och kontextuell `/control/rehearsal` behåller fungerande övergångsverktyg. Sammansättning ersätter presentationslane i användarflödet, medan kompatibla lagrings-ID:n och intern uppspelningskonfiguration behålls. N2 samlar rummets inställningar på `/partner/{slug}/rooms` med bevarade utkast och navigationsskydd.

Förenklingen 13 oktober skiljer rummets befintliga `roomOverrides` från den
gemensamma sammansättningsmallen. Adminens rumsval öppnar exakt bolag och rum
i partnereditorn; mallredigering visar alla berörda rum innan redigering.
Moderna administrationsdokument behöver inte historiska tiers/pitboss/turneringar.
Historiska rum behåller sitt kontrakt och inga sparade fält tas bort automatiskt.
Både Studio och spelmotorn måste ha denna validering innan ett separat explicit
intag använder dokument utan legacyfälten. Ingen SQL-migration ingår.

Senaste mains produktmodell i `TERMINOLOGI.md` gäller; rapportens förslag om
flerspelsrum blir inget nytt krav här. Eventuell utökad miljöidentitet med
bakgrundsvarianter eller publicerad klipp-/mallversion per användning behöver
ett separat kontrakt. Singleton- och konfliktspärrarna behålls tills nya
skrivare, läsare och faktisk runtime har motsvarande isoleringsbevis.
Studio 009/010 förblir reserverade för B18/B19.

Bolags- och rumsarkiv bevarar historik och har revisionskontroll. Ingen SQL-migration eller produktionsdatastädning ingår. De nya mutationerna kräver spelmotorns capability v6 `resourceLifecycle: operator-room-archive-v1`; äldre runtime nekar dem före skrivning. Ägarlösa gamla rum och tidigare avstängda bolag utan arkivmarkör får ingen gissad ägare/automatisk återaktivering. Dealerarkivets samlade konsekvensplan och atomiska avpublicering kräver dessutom capability v7 `dealerArchiveCascade: dealer-compositions-rooms-v1`. Historiska paket behålls; återställning ger utkast utan att starta AI-tal eller spelrum. Full leverans-, UI- och runtimeverifiering redovisas i aktuell handoff; denna kodändring stänger inte JN2 eller medieacceptans.

## JN2-C: slutimplementation och acceptans, 12 oktober 2026

Team använder nu verkliga roller/rättigheter, skyddad avstängning/återaktivering och revisionskontroll. Beständig operatörsjournal ingår i samma SQL-transaktion som varje lyckad konfigurationsändring; nekade ändringar eller auditfel ger ingen affärsskrivning. Läsning är bolagsavgränsad, paginerad och åtkomstkontrollerad. Ingen historisk backfill eller app-radering; retention tills separat beslut.

11 isolerade PostgreSQL-prov (två databaser och verklig omstart) samt 18 browserprov PASS; återkallade roller, bolagsgränser, samtidighet och auth-COMMIT-kompensation är verifierade. Tidigare kvittos begränsning till minnes-/SQLite-fixturer är därmed ersatt för dessa teamflöden. QA är inlagd i befintlig CI-runner. Windows native; inga betalda provideranrop, budgettak 5 USD kvarstår. Produktionsleveransen går via kompatibilitetscommit `d72f392f`, därefter additiv migration006 och först därefter slutkod. Båda förberedelsevärdarna samt grön CI verifierades före migration006; Neon har nu verifierad kedja001–006 och tom journal vid installation, utan affärsskrivningar. Se aktuell handoff för full bevisgräns och legacygranskning. JN2-A/B:s övriga visuella/produktövergripande acceptans och D–K är fortsatt öppna.

## Aktuellt testmandat och N2-snabbkontroll, 11 oktober 2026

Jakobs standardtestbudget är **högst 5 USD totalt per avgränsad testomgång**. Större budget kräver nytt mandat; historisk kostnad och tekniska budgetspärrar återställs inte. Punkt 1 (ny läppsynksacceptans) hoppas över på Jakobs begäran; han verifierar PAOW i runtime.

86 riktade N2-tester passerade på `2fb18004` med högst fyra workers och syntetiska minnes-/SQLite-fixturer. Begränsade/återkallade roller, bolagsgränser och revisionsskydd ingår. Riktig PostgreSQL-konkurrens och komplett acceptans med separata konto-/operatörsdatabaser är fortfarande **ej verifierade**; JN2-A/B/C stängs inte av detta kvitto. Inga produktionsskrivningar eller betalda provideranrop. Detaljer och testfiler finns i aktuell handoff.
## Tre åtkomstnivåer på www.scoutgaming.tech

Apex `scoutgaming.tech` är en 308 till www. Vercelprojektet heter `scoutgaming`.
Spelmotorn ligger kvar på Render-tjänsten `croupier-v2`. `/studio` är Next.js-basePath
för labb-servicen, inte en fjärde produkt och inte namnet i gränssnittet.
`/lissabon`, `/lab`, `/labb` och `/bo` är avvecklade alias. Flaggningen
`lissabon-stream-lane` är inte en produktadress.

### Ett gemensamt Vercelprojekt — 6 oktober 2026

Efter uttrycklig samordning har Kevin-chatten släppt alla anspråk. Services i
rotens `vercel.json` samlar webb (`apps/croupier-frontend`) och labb (`lab`,
basePath `/studio`) i ett bygge/projekt utan att slå ihop deras Next-versioner.
Aktiverad `CROUPIER_VERCEL_UNIFIED_UI` flyttar den befintliga exakta ingressgränsen
till labb-servicen när Services skickar dit dokument/API direkt. Render behåller spel/live.
T2 är påbörjad, inte klar. Levererat till 11 oktober: 005-lagring, partner_session, scoped snapshot, N1:s Bolag & team samt publicerade paket/spelrum. Kvar är komplett mottagaraktivering/N2-sparprov, åtkomstjournal för operatörsskrivningar och spelare/transaktioner/rapporter. T3 och T4 behåller sina öppna acceptanspunkter; paketpublicering och bolagslobby är inte längre saknade funktioner.
Tio riktade routingtester och Lab-typkontroll/produktionsbygge är lokalt gröna.
Repo och aktivt Vercelprojekt heter nu `scoutgaming`. Repo-ID `1380630440` och
tidigare Studio-ID `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD` är bevarade, inklusive
Neon/Blob/Resend. Kod `cef3af5c` är READY på `dpl_J4uTPNKzhaBH1XnNYETX266UfKfV`;
Senaste avslutade dokumentleverans `4ed55a56` är READY på
`dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP`, CI `37451320053` har tre success och fullhook PASS. www, rot, login, spelgenvägar,
API-spärrar och statiska filer är läsande verifierade mot den leveransen.
8 oktober 2026 är Vercel-projektet `scoutgaming` (web och studio, båda services) deployat från `main`: CI grön på `0019df59` och `7445b5a5`. Inget nytt deployment-id är avläst i den här filen. Kevin-chatten har
bekräftat sin befintliga adminsession. Kevins importerade backoffice
(`lab/components/kevin-bo`) på `/partner` har två lägen: intern fixturförhandsvisning och scoped operatörsdata. Det är inte kontrollpanelen.
Båda webbdelarna använder `fra1`; Git-autobyggen från main är på igen.
Den gamla GitHub-adressen och gamla frontend-adressen vidarebefordras.
Det domänlösa frontendprojektet sparas som `scoutgaming-legacy-frontend`, med
autobyggen och domäntilldelning avstängda; isolerade QA-projekt/data bevaras.

Jakob har godkänt överföringen av Kevins backoffice och följande indelning.
Det gäller inloggning och åtkomst på samma sajt, inte separata kodplattformar:

| Nivå | Yta | Behörighet i målbilden |
| --- | --- | --- |
| 1 | `/control` | Intern personal. Verktyg samlas under `/control/clips`, `/control/administration`, `/control/videos`, `/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`, `/control/events`, `/control/preview`, `/control/probe`. `/control/tree` och `/control/operator-chat` omdirigerar. |
| 2 | `/partner`, `/partner/login`, `/partner/{operatorSlug}` | Operatör (Unibet m.fl.). PR #12 implementerar riktiga partners även med samma N1-adminlogin; produktionsacceptans återstår. Operatör loggar in via `/partner/login` med `partner_session` och scoped snapshot (partner-API:t svarade 503 i produktion 7–8 okt tills `e97f32df`). Bolag, roller och medlemskap skapas under Administration → Bolag & team på `/control/lanes?tab=companies`; ny e-post får aktiveringslänk. Bolagets utseende (`branding`, bordsfärg) läses och skrivs inom lanen av `presentations.configure`. Spelare, transaktioner och rapporter är inte anslutna (N2.4). T2 är påbörjad, inte klar. |
| 3 | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack` | Spelare. Spellobby, egen profil (namn, saldo, valuta) och egen historik finns som sidor. Profilen kan redigeras (namn och språk) när `006-player-profile.sql` körts mot spel-Neon. Lobbyn visar publicerade bolag och deras verkliga rum. Allmän `/play/blackjack` går till lobbyn; enbart operator går till bolagets lobby. Explicit rumslänk begränsar dealer och miljö till paketet. Renders direkta spelväg behålls. Historiksidan anropar `POST /api/history`. T4 är öppen. |

Samma identitetsresolver ska användas; URL eller ett menyval ger aldrig en roll.
Interna medarbetare har tilldelade rättigheter, och ett spelarkonto får inte
personalåtkomst. `/studio` är labbets basePath. Avvecklade alias är inte
produktadresser. Giltiga signerade direktstarter behåller sin serverkontroll.

- [x] **T1. Överförd och uppdelad intern förhandsvisning.** Redigerbar källa från
  GitLab `codex/john-final-backoffice` på `7dee0901c75b7470c16a178079d5a5ebe4f11b9f`
  anpassas till befintlig React/Studio-runtime. Partnerdelen saknar Dealer archive,
  Rooms legacy, Voice lines, Dealing clips, Game media, Action tree och Generations;
  dessa nås endast genom den interna ytan. Delade vyer skiljer godkända val från
  intern produktion. Samtliga 24 ursprungliga destinationer ska redovisas, med
  fungerande navigation/direktlänkar och tydlig status för oanslutna funktioner.
  Första etappen är enbart för befintligt inloggad intern admin med två isolerade
  exempeloperatörer. Detta inför inte kundinloggning eller en livekundanslutning.
  Det gäller T1:s etapp. Operatörsinloggning är påbörjad i T2, inte klar.
  Verifierat lokalt 6 oktober: alla 24 vyer öppnade i webbläsare, rätt team efter
  operatörsbyte/omladdning, lokala designutkast och stängning vid administratörsbyte
  respektive återkallad session. 24 riktade integrationstester samt frontend- och
  Studio-byggen passerar. Publicerad kod `5524b968` är provad med befintlig intern
  adminsession: båda ytorna, menybyten, operatörsbyte och direktlänkar fungerar.
  Oinloggade besök går till login; API ger 401. Riktig kundinloggning ligger i T2.
- [ ] **T2. Verkliga tre inloggningsklasser och organisationsmedlemskap.** Påbörjad, inte klar. Levererat: migration `005-operators.sql`, `partner_session`, scoped snapshot, N1:s Bolag & team och paketpublicering med verkliga spelrum. Kvar: slutverifierad mottagaraktivering/N2-sparning, åtkomstjournal för operatörsskrivningar, spelardata, transaktioner och rapporter. Behåll
  dagens kollisionssäkra credentialresolver, inför uttrycklig `partner`-klass och
  separat partner-session med färsk identitets-, roll-, auth-epoch- och
  medlemskapskontroll. Inga automatiska reader/staff-uppgraderingar. Nivå 1
  administrerar operatörer och personal; nivå 2 delegerar endast tillåtna roller
  inom sin organisation. Isolerade tester ska bevisa aktivering, login, spärr,
  återkallelse och nekade direkta anrop mellan två organisationer.
  Migration `005-operators.sql` (7 oktober) lägger till `operators`,
  `operator_roles`, `operator_memberships` och `operator_packages` i Studio-schemat.
  Ändra inte den checksumfrysta `product-schema.sql` eller tidigare migrationsledger.
  Native runtime kräver nu exakt migration 001–005: en Neon-databas där 005 inte
  är applicerad svarar `unavailable` tills migrationen körts. Kör den granskade
  migrationen mot produktions-Neon innan koden deployas, aldrig tvärtom.
  Ordning vid ny Studio-migration:
  1. PR mot main.
  2. CI kör readiness mot produktionsledgern och blir röd om migrationen saknas.
  3. Operatör kör `node tools/check-migration-readiness.mjs --apply` med CROUPIER_MIGRATION_CONFIRM=apply-pending från en terminal med produktionsnyckeln.
  4. Merga PR, Vercel bygger.
  7 oktober 2026 pushades migration 005 till main innan den körts mot produktions-Neon; Vercel byggde inom tre minuter och varje /control-sida svarade att labbet inte kunde läsas.
  **Fastställd ordning för deploy-valfria migrationer (beslut 12 oktober 2026).**
  En migration som bara en ny, isolerad funktion behöver (först ut: `008-dealer-forge.sql`,
  `forge_dealers` + `forge_jobs`) märks `deploymentOptional` i `ops/neon-studio/migrations.mjs`
  och levereras i tre steg, i denna ordning och aldrig omvänt:
  1. **Kod först.** PR:en gör båda runtime-kontrollerna (Lab `studio-native-runtime.mjs`,
     Render `web/storage/studio-runtime.mjs`) toleranta för ledgern **med och utan** den nya
     versionen. Readiness listar versionen under `optionalPending`, inte `pending`, så CI är
     grön och mergen deployas. Funktionen svarar `forge_migration_pending` tills tabellerna finns.
  2. **Migration efter deploy.** När Vercel och Render kör den toleranta koden kör operatören
     `node tools/check-migration-readiness.mjs --apply` med
     `CROUPIER_MIGRATION_CONFIRM=apply-pending`; `--apply` tar även valfria versioner och
     `optionalPending` blir `[]`. Funktionen aktiveras utan ny deploy.
  3. **Lås i uppföljning.** En senare PR tar bort `deploymentOptional`, pinnar runtime till
     exakt 001–008 och återgår därmed till huvudregeln (migration före merge) för allt därefter.
  Att köra 008 mot produktion **före** steg 1 bryter den körande koden
  (`studio_migration_ambiguous_ledger`: ledgern har fler rader än koden känner). Precedens: 007
  levererades så (`508c8f33`, "Prepare optional Studio branding drafts migration").
  - [x] 008 genomförd 12 oktober 2026: steg 1 i #16, steg 2 körd ~11:08 som rollen `croupier_game`
    mot databasen `croupier_game` (`appliedNow: ["008"]`, ledger 001–008, `forge_dealers`/`forge_jobs`
    ägs av `croupier_game`), steg 3 i uppföljnings-PR:en: flaggan borttagen och Lab, Render och
    speech-importen kräver exakt 001–008. Mekanismen finns kvar för nästa isolerade funktion.
  Åtkomstjournal för operatörsskrivningar saknas; `audit_events` tar bara dokument/media.
  Delsteg 6 oktober: `web/partner-access-policy.mjs` har explicita
  operatörsrättigheter, scope-/organisationsbindning och begränsad rolltilldelning.
  Både aktuell och ny målroll måste vara uttryckligt delegerbara av nivå 1;
  egen rolländring och ändring av överordnad personal nekas. 22 riktade tester
  passerar inklusive befintlig credentialresolver/Studio-policy. Oberoende review
  är avklarad. `lab/lib/partner-data.mjs` anropar `allowsPartnerResource` för den
  scopade snapshoten. Partner-login, medlemslagring och `partner_session` finns.
  Isolerat bevis för spärr, återkallelse, nekade anrop mellan två organisationer
  och skydd för sista administratören återstår. Spärren mot att ta bort sista
  operatörsadmin finns i lagret sedan 7 oktober (`186c6bc4`), provad mot minnesfixtur;
  isolerat bevis mot riktig Postgres saknas. T2 är påbörjad, inte klar;
  rena policytester är inte acceptans för riktiga konton.
  Förtydligande 6 oktober: intern adminpersonal ska ha åtkomst till alla tre
  nivåer med samma konto. Befintlig intern adminauktorisering skyddar redan
  nivå 2:s förhandsvisning. Före PR #12 valde `/partner` exempelvyn utan
  `partner_session`. PR #12 ersätter normal demoväg med lagrade bolag, även
  för färskt auktoriserad N1-admin med samma login; JN2-A nedan kräver fortfarande
  produktionsacceptans. Kundpersonal når bara egna aktiva medlemskap. Val av
  riktiga operatörer och paketpublicering är redan levererade i N1. Operatörslagring, `partner_session`
  och scoped snapshot finns; T2 är påbörjad, inte klar.
- [ ] **T3. Anslut en operatörsfunktion i taget.** Öppen. Scoped snapshot kan visa sparat paket (presentationer, bord, revision) och medlemskap. Spelare, transaktioner och rapporter är inte anslutna. N1:s bolagsadministration och paketpublicering är levererade; N2:s kompletta liveacceptans och övriga integrationer återstår. Koppla revisionerade
  presentationer och egna bord, sedan rapporter, team och integrationer. Varje
  funktion behöver organisationens ägarskap genom UI, API, lagring och export.
  Render behåller kort, regler, plånbok och avräkning. Importera inte Kevins
  SQLite-konton, gamla miljöfiler eller loopbackbrygga. En generell proxy till
  globalt admin-API är inte kundisolering.
- [ ] **T4. Spelarens lobby.** `/play` visar tillgängliga spel i verifierad
  operatörskontext och ger endast spelarens egen profil/historik. Börja med
  Blackjack; giltiga partnerstarter får öppna spelet direkt utan extra login.
  Ändra inte spelaridentitet eller signerade launch-kontrakt genom namnbytet.
  Delsteg 7 oktober: `/play` är spellobby, `/play/profil` visar namn, saldo och
  valuta, `/play/historik` anropar `POST /api/history` för egna aggregerade
  resultat, och `/play/blackjack` återanvänder befintlig sessionskontroll,
  sparad lane och signerad launch. Äldre speladresser leder vidare i det
  gemensamma molnprojektet. Lobbyn kan visa Spelar hos från `?operator=`.
  Profilens namn och språk kan redigeras när `006-player-profile.sql` körts mot spel-Neon.
  Delsteg 11 oktober: Vercels spelstart begränsar dealer/miljö till bolagets publicerade paket och verkliga rum. Den allmänna ingången leder till bolagsportalen. Liveprov av bolagsval → rum → Johanna med tre lager passerade på c48c6754; giltiga signerade starter behåller sin separata validering. T4 förblir öppen för återstående full acceptans, inte för ett saknat bolagsval.

Författaren till det frysta GitLab-headet är ImpactPL; identiteten är ännu inte
bekräftad som Kevin. Överföringens källrevision är därför explicit dokumenterad.
Tidigare privata arbetsanteckningar är inte del av produkt eller deployment. Git-historiken på `00ea55c5` behåller dem. Lokala ignorerade env-kopior och bildmappar står kvar utanför Git.

### Johns N2-skiss — implementationsplan, 11 oktober 2026

Denna nedbrytning hör till **T2/T3 i denna tracker**, inte till ett nytt projekt.
JN2-punkterna nedan visar respektive implementations- och acceptansgrind. Planen
är inte ett påstående att hela funktionerna är produktionsgodkända. Befintliga N2.2/N2.4-namn
behålls; JN2-ID:n avser endast denna skissintegration.

**Första kodleveransen, 11 oktober 2026 — JN2-A/B för granskning.** Implementerad
på `codex/john-n2-admin-partners`, ursprunglig bas `f8e5bdfd`, synkad med main
`52bcab1f`, på Jakobs uttryckliga begäran om egen branch och PR. Normal `/partner` och `/partner/{slug}` använder
nu det riktiga operatörslagret även för intern admin med samma N1-session. Johns
spelbolag och SG:s bolag kommer från lagret; inget nytt bolag, medlemskap eller
partnercookie skapas. Utan publicerat paket är bolaget fortfarande synligt.
Demo North/South och fallback till exempeldata är borttagna från produktvägen;
den separata N1-skyddade diagnostikförhandsvisningen och dess testfixturer består.

N1-admin och partner är två explicita åtkomstklasser. Färsk adminauktorisering,
workspace/miljö, operatör och rättigheter kontrolleras; när båda sessionerna
finns har N1-kontexten företräde och en ogiltig N1-session får inte falla tillbaka
till partnercookie. Partnerpersonal är fortsatt begränsad till sina medlemskap.
Teamdata kräver `team.read`; varje teamändring återkontrollerar exakt rättighet
under operatörslås. Utseendeskrivning behåller resursvalidering, revisionskontroll
och verklig adminaktör. Konto- och operatörslager är separata: detta är inte en
distribuerad transaktion. Beständig audit återstår i JN2-C.

Johns visuella grund är integrerad i befintliga React-komponenter: sidomeny A,
PageHeader, neutrala ljusa ytor/lime, mörkt läge, EN/SV, bolagsval och mobil
sidväljare. Partneringången har egen avsiktlig CSS i stället för saknade N1-klasser.
Riktiga paket-/bordstal visas; ej ansluten speldata visar tydliga tomlägen, inte
låtsas-GGR. Äldre demoingång och felaktigt delat stylingberoende har städats bort
utan DB-/medieradering eller ändring av N1:s gränssnitt.

**Verifiering före PR:** 44 isolerade backend-/åtkomsttester, 22 navigation-/
visuella regressionstester och 13 ytroutetester passerar. Slutligt Lab-
produktionsbygge/TypeScript och byggspårskontroll passerar (fyra workers,
82 spår, omkört efter main-synk `52bcab1f`). Befintlig previewtestharness har
anpassats till Johns komponenter och passerar 11 tester. Browserprov av de faktiska komponenterna i isolerad UI-fixtur täcker
360/820/1440 CSS-px, bolagssökning, språk/tema, refresh och sidnavigering utan
horisontell overflow. Det är inte ett produktionslogin- eller databasprov.
Ordinarie fullhook är godkänd för kodcommit `684864b618010caf11d2c7bef719b8fa8faf8e17`:
2 442 PASS/9 skip/0 fail (55 testgrupper). Ingen hook eller täckning har kopplats bort.
De tidigare stoppade körningarna räknas separat: äldre previewharness behövde uppdateras
och lokal Gateway-testdependency `ws` saknades; verifieringen kördes därefter om med låsta beroenden.

**Granskningskomplettering i [PR #12](https://github.com/Jakeminator123/scoutgaming/pull/12):**
Byt konto/Logga ut är tillbaka i riktig katalog och bolagsvy, SV/EN och mobil,
via befintliga API:er och serverns uttryckliga åtkomstklass. Admin avslutar
sekundär partnersession och N1; partner endast partnersessionen. Misslyckat
anrop stoppar navigation och kan provas igen. Ogiltig/utgången N1-cookie
går till N1-login med säker exakt partner-undersida som returnTo. Partnerlogin
behåller sin befintliga `/partner`-landning; exakt undersideretur är endast
verifierad för N1. Föråldrade fixturepåståenden i README och inventeringen är
rensade eller historiskt märkta. Sessionssviten ingår i befintlig fullhook.

Kompletteringens 29 ytrouter-/navigationstester och 29 fokuserade sessions-/
visuella-/previewtester PASS, noll skip. TypeScript och Lab-produktionsbygge
inklusive 82 byggspår PASS. Isolerade browserprov av faktiska komponenter
bekräftar kontobyte, utloggning, anropsordning och serverfel utan navigation,
SV/EN, ljust/mörkt och 360/1440 CSS-px. Detta är inte produktionslogin eller
databasacceptans. Ordinarie fullhook på kompletteringens kodcommit
`00511089a922c3df1f7cde81d19701a1094ef194`: 2 453 PASS/9 skip/0 fail
(55 testgrupper), inklusive sessionssviten. Ingen hook eller täckning bortkopplad.

**JN2-A/B är fortsatt öppna acceptansgrindar:** efter granskning/deployment krävs
verklig N1-login → Johns/SG → direktlänk/refresh, begränsad/återkallad identitet,
tenantisolerad skrivning och riktiga Postgres-konkurrensprov. JN2-B:s övriga
affärsformulär och toppmeny B ingår inte i detta grundskal. Ingen produktions-DB,
migration, provider/env eller deployment har ändrats av kodleveransen.

**Underlag och nuläge.** Johns [beskrivning och skiss i inbox #9](https://github.com/Jakeminator123/scoutgaming/issues/9#issuecomment-6099185493)
pekar på Johns fristående HTML-skiss på revision `aaadfb49` (historiken behåller filen; den finns inte i det här trädet).
Skissen är fristående HTML/JS med exempeldata och simulerade anrop, inte en
färdig backend. Den historiska kodinventeringen före PR #12 nedan utgår från main
`9d151fa6be364f4af5999c8163a6055dd8fc5fc8`. Webbläsarobservationerna gjordes
11 oktober på www; deras exakta deployment-SHA är inte fastställd av denna kontroll.

| Del | Finns och ska återanvändas | Lucka som faktiskt återstår |
| --- | --- | --- |
| Bolag och åtkomst | Studio `005-operators.sql`: bolag, roller, medlemskap och revisionerade paket; partnerlogin/aktivering; N1 Bolag & team | Adminens N2-ingång väljer fixture utan `partner_session`. Gemensam bolagsingång och separata säkra admin-/partnerkontexter behövs. |
| N2-gränssnitt | Kevins importerade komponenter; riktiga paket-/teamvyer och appearance-loader | Johns navigation, utseende och arbetsflöden är inte genomgående integrerade. Startsidan refererar CSS-klasser som saknas. |
| Anpassning/publicering | `partner-branding-api.mjs` validerar tillåtna ändringar, rättigheter och förväntad revision; N1 äger fryst presentation/rum | Dagens sparning publicerar paketrevision. Johns separat sparade utkast, återställning och granskningsflöde saknas som sammanhängande kontrakt. |
| Speldata | Render/spel-Neon har spelare, transaktioner, partnerrundor och API-nycklar | N2-snapshot markerar players/transactions/reports som ej anslutna. Entydigt bolagsägarskap, läs-API och avstämning krävs före N2.4. |
| Revision/audit | Pakethistorik och befintlig loggning | `operator-journal.mjs` skriver serverlogg, inte en beständig operatörsjournal som går att läsa och exportera. |

**Varför Johns spelbolag saknas i bilden.** Inloggad intern admin såg på
`/partner` Demo North, Demo South och SG-test som demonstrationer. På
`/partner/sg-test` stod uttryckligen intern förhandsvisning/exempeldata.
Samtidigt visade N1 Bolag & team **Johns spelbolag**, slug
`johns-spelbolag`, med ett aktivt medlemskap; `/play` visade också bolaget.
Bolaget saknas alltså inte i den observerade bolagskatalogen. I
`lab/app/control/surface-page.tsx` används riktig N2-data bara när
`partnerSessionPresent(request)` är sann; annars väljs `partnerPreviewInitialData`.
Det är ett åtkomst-/datakälleval, inte något som ska lösas genom att skapa ett
dubblettbolag eller lägga admin som kundmedlem i varje bolag.

**Arkitektur och avgränsning.** Behåll Next/Route Handlers på Vercel för N2,
Studio-Neon för operatörer/paket/konfiguration och Render/spel-Neon som auktoritet
för rundor, kort, regler, saldo och avräkning. Samma konto för intern admin över
tre nivåer betyder inte samma behörighet för varje N1-användare: read-only och
andra begränsade roller får inte automatiskt adminrättigheter. Demo North/South
tas bort ur normal navigering, inte genom att radera verkliga DB-poster eller
testfixturer. Riktiga bolag visas även utan publicerat paket, med korrekt tomläge.

#### Första leveransen: riktig bolagsingång och Johns visuella grund

- [ ] **JN2-A — P0: samma adminlogin, riktiga bolag, inga demokort.**
  **Frontend:** ersätt normal `/partner`-lista med riktiga bolag som den aktuella
  identiteten får se; sök/bolagsval och länkar till `/partner/{slug}`. Visa
  ”Intern admin · Johns spelbolag” respektive partnerns egen identitet. En admin
  ska gå N1 → N2 → N3 utan separat partnerlogin; partnerpersonal når endast sina
  aktiva medlemskap. Ta bort Demo North/South och missvisande footertext; SG:s
  riktiga bolag ska komma från lagret, inte från en namngiven fixture.
  **Backend:** återanvänd N1:s färska adminauktorisering och operatörslager i
  `surface-page.tsx`/`partner-data.mjs`. Inför en explicit intern operatörskontext
  och gemensam snapshotbyggare; behåll partnerpolicyn intakt. Både initial sida,
  omladdning och varje N2-API måste kontrollera identitet, miljö/workspace, valt
  operatorId och rättighet på nytt. Adminskrivningar ska gå genom samma
  resursvalidering/CAS, med verklig admin som aktör; ingen falsk `partner_session`,
  medlemskap eller generell proxy till oskopade admin-API:er. Bestäm explicit
  läge när båda sessionerna finns. Utgången/återkallad session ger login/nekande,
  aldrig automatisk övergång till demo eller högre rättighet.
  **Databas:** återanvänd operators/roles/memberships/packages från 005; ingen
  kontomigrering eller bolagsseed behövs för katalogen. Slug är URL, operatorId
  är ägarskap. Beständig audit för skrivningar färdigställs i JN2-C.
  **Beroenden:** befintlig N1-auth och 005-lagring; första blockerande steg.
  **Verifiering:** admin ser Johns och SG:s riktiga bolag och rätt paket vid
  direktlänk/refresh utan ny login; bolag utan paket är synligt men opublicerat.
  Partner A får 403/404 för B även vid manipulerad URL/body; read-only kan inte
  skriva; indragen adminroll/session slår igenom nästa anrop. Anonym användare
  får ingen privat bolagslista. Inget fixturesvar vid 401/403/503.

- [ ] **JN2-B — Johns visuella språk på befintliga komponenter.**
  **Frontend:** implementera först skissens sidomeny (A), gemensam PageHeader,
  grupper Översikt/Spel/Spelare/Finans/Inställningar, tydligt aktivt bolag och
  konsekventa kort, tabeller, statusmarkeringar, drawers och formulär. Behåll
  befintliga fungerande loaders/komponenter, byt inte till hela HTML-skissens
  globala state. Använd dess ljusa neutrala ytor/limeaccent, med mörkt läge och
  samlade EN/SV-texter. Alternativ toppmeny (B) skjuts upp tills A är godkänd.
  Åtgärda `/partner` separat: `partner-workspace.tsx` använder `tools`, `tool`,
  `help`, `notice`, `levels` som saknas i importerad `control-workspace.module.css`.
  Ge partneringången avsiktlig egen styling eller riktiga gemensamma komponenter
  utan att återställa N1:s nya CSS. Filter visas bara där datakontraktet stöder dem.
  **Backend:** återanvänd snapshot/capabilities från A; exponera unavailable,
  tomt och fel som skilda tillstånd. Inga nya business-API:er för enbart layout.
  **Databas:** inga nya tabeller för UI-skalet; använd befintlig profil för
  språkpreferens där den gäller, lagra inte affärsutkast som endast localStorage.
  **Beroenden:** A:s mode-/bolagskontrakt; kan utformas samtidigt med A.
  **Verifiering:** jämför startsida, översikt, bord, branding och team med Johns
  skiss i 360/820/1440 CSS-pixlar, ljust/mörkt, EN/SV. Kontrollera tangentbord,
  synlig fokus, dialogens fokus/återgång, etiketter, kontrast, tabellscroll och
  laddning/fel/tomläge. Exempeldata får inte se ut som verkliga pengar eller drift.


  **Bekräftad visuell skuld 12 oktober, fortfarande öppet:** På verkliga
  `/partner/johns-spelbolag/table-design` använder appearance-formuläret
  Studios `--sg-text` (#F2F1ED) över partnerns ljusa `--paper` (#F2F1ED),
  medan rätt partnertext är `--ink` (#0A0B0D). Rätta temakopplingen för text,
  ytor, kantlinjer och knappar tillsammans; kontrollera båda teman och fokus.
  `PartnerPackageView` renderar paneler utan invändig padding, tekniska ID:n/
  MIME/filnamn och hela paketlistan före flera vyer. Samla kompakt paketstatus,
  aktuell redigering och faktisk förhandsvisning i en konsekvent layout; behåll
  N1:s frysta mediaurval och N2:s granskade publiceringsflöde. Den här visuella
  acceptansen är inte bevisad av JN2-C/D:s isolerade funktionstester. Bristerna
  föregår 270aaa38; ingen ny merge-regression är belagd av snabbgranskningen.
#### Säker konfiguration och publicering

- [x] **JN2-C — rättigheter, beständig audit och bolagsgräns (första leveransen).**
  **Frontend:** koppla Johns teamvy till befintlig invitation/aktivering och
  team-loader. Visa tillåtna åtgärder och faktiskt aktiva roller, inte bara fem
  hårdkodade rollnamn. Skilj bolag från varumärke/marknad; första leveransen kan
  ha ett varumärke per bolag, men ska inte visa påhittade marknader/licenser.
  **Backend:** mappa skissens Owner/Pit boss/Finance/Branding/Read-only mot
  `web/partner-access-policy.mjs` och befintliga anpassade roller; dokumentera
  delegerbara rättigheter. Nya skrivförmågor för RG/integrationer kräver explicit
  policy, inte återanvändning av `*.read`. Lägg läs-API för journal och skriv
  audit tillsammans med konfigurationsändringen; fail closed vid saknad journal.
  **Databas:** additiv Studio-migration för operatörsaudit (scope/operatorId,
  aktör och accessClass, åtgärd/resurs, gammal/ny revision, tid, requestId;
  inga hemligheter). Bestäm retention och index för operatör/tid. Vid flerbrands-
  leverans: scoped brands/markets och kopplingar till rum, valuta och paket;
  backfyll endast verifierad bolagstillhörighet, bevara befintliga operatorId:n.
  **Beroenden:** A; audit är en grind för nya verkliga skrivflöden D/F/G/I/J/K.
  **Verifiering:** isolerad Postgres, samtidiga rollbyten, sista aktiva admin,
  avstängning och återkallelse; en lyckad ändring ger exakt en beständig auditpost,
  nekad ändring ändrar inga affärsdata. Ingen läsning/export över scopegräns.

  **Levererat i teamsteget:** riktiga tillåtna åtgärder, rollrättigheter och delegerbarhet; atomisk beständig journal med scope/aktör/revision/request-ID; två databasers aktiveringskompensation och isolerad Postgres/browseracceptans. Johns rollnamn mappas mot befintliga förmågor: Owner behöver administratörsrätten `team.roles.assign` och uttryckliga övriga teamgrants; Pit boss använder `tables.read/configure`; Finance använder `reports.read`; Branding använder `presentations.read/configure`; Read-only får bara relevanta läsrättigheter. Befintliga anpassade roller återanvänds. N2 får bara delegera markerade roller vars samtliga rättigheter ryms i aktörens egna. Nya RG-/integrationsskrivrättigheter får inte härledas från läsrättigheter. Första leveransen har bolagets befintliga brand; flerbrands-/marknadsmodell kräver separat implementation och lämnas öppen. Ingen journalexport utlovas.

- [ ] **JN2-D — brandutkast, preview, granskat publicera/återställ.**
  **Frontend:** integrera Johns logga, filt/rail/tryck, bakgrund, chips och
  knappstilar stegvis med `partner-appearance.tsx`. Visa tydligt utkast kontra
  publicerad revision, sparstatus, ändringslista, berörda rum och versionshistorik.
  Lägg brandstandard, separat rumsöverskrivning och ”använd standard igen”. Preview
  omfattar faktisk tillgänglig speltyp, spelfas och desktop/mobil; N1:s frysta
  placering/skala är inte redigerbar. Chips/knappar får inte markeras klara innan
  samma kontrakt renderas i N3 (inklusive kvarvarande L4-arbete).
  **Backend:** skilj spara-utkast från publicera i befintligt branding-API.
  Validera serverledes allowlist, färger/kontrast, logoformat/storlek, publicerat
  Scout-paket, dealer/bakgrundskompatibilitet och förväntad basrevision.
  Återställ skapar utkast, inte tyst liveändring. 403/409 och ändrat grundpaket
  behåller användarens utkast men blockerar felaktig publicering. Frysta
  presentationer/rum och privata mediereferenser förblir N1-ägda.
  **Databas:** separat scoped utkast med baspaketrevision och egen revision;
  återanvänd `operator_packages` för publicerad historik, skapa inte ett parallellt
  N1-paketsystem. Bestäm och validera explicit lagring av tillåtna brand-/rums-
  overrides. Logo i befintlig behörighetsstyrd medielagring, inte stora data-URL:er
  i paket eller osanerad SVG/HTML. Publicering och audit atomiskt i Studio;
  spelmotorns tillämpning kvitteras separat, inte som en distribuerad DB-transaktion.
  **Beroenden:** A–C, befintligt package-/roomkontrakt och N3-renderer.
  **Verifiering:** två redigerare → konflikt utan förlorat utkast; ändrade
  rättigheter/paket efter öppnad dialog → nekande. Reload behåller utkast;
  publicering syns från nästa runda, pågående runda behåller sin look.
  Brandbyte påverkar rätt rum, rumsundantag består och reset fungerar.
  Prova felaktig logo/kontrast samt alla tillgängliga dealers utan att ändra media.

  **Genomfört i utkaststeget, 12 oktober 2026:** Separata beständiga utkast med bas- och utkastrevision, granskning med ändringslista och berörda rum, uttrycklig publicering och återställning till ett nytt utkast. Brandstandard och rumsundantag använder samma publicerade paket; återgång till standard är en granskad ändring. Paket, publiceringsmarkör och beständig journal skrivs atomiskt. UI behåller egna ändringar vid 403/409, gammalt grundpaket eller försenat svar efter bolagsbyte. Förhandsvisningen använder det publicerade paketets tillåtna lager och gemensam kompositor i desktop/mobil. Publicerad revision kontrolleras före nästa runda; insatsval bevaras vid nödvändig omladdning.

  **Verifieringsgräns:** 27 isolerade native Windows/PostgreSQL-kontroller och 24 browserkontroller PASS, inklusive konkurrens, återkallade roller, rollback, omstart, SV/EN och 360/1440 px. Browserfixturen använder syntetiska bilder med verklig kompositor; verkliga dealerfilmer och samtliga spelfaser är inte accepterade av detta prov. Inkoppling och produktionskvitto redovisas i aktuell handoff. Testkostnad 0 USD inom taket 5 USD; ingen WSL.

  **Breda JN2-D lämnas öppet:** logotyper, chips och knappstilar saknar ett gemensamt kontrakt genom N2 och N3. Full förhandsvisning av spelhändelser och dealerfilm kräver separat implementation/uppspelningsacceptans. Dessa reglage utlovas inte av den levererade utkastfunktionen.

#### Spelmotorkoppling: data före statistik och driftknappar

- [ ] **JN2-E — N2.4: auktoritativt, bolagsavgränsat läskontrakt.**
  **Frontend:** dashboard/livebord/spelare/transaktioner får samma period-,
  valuta- och bolagskontext. Visa ”inte anslutet”/”data fördröjd” med asOf;
  okänd GGR eller beläggning är inte noll. Dölj ej stödda filter och exportknappar.
  **Backend:** inför autentiserad läsyta på Render med serververifierat operatorId,
  roomId, tidsintervall, valuta, paginering och mätdefinitioner. N2 använder
  server-till-server-adapter, inte globalt spelar-admin-API från browsern.
  Definiera GGR från avräknade insatser minus utbetalningar, separera öppna
  insatser, annulleringar och valutakonvertering; en spelare kan ha olika
  operatörsrelationer. Återanvänd befintliga rund-/transaktionskällor.
  **Databas:** inventera faktisk mål-DB före migration. Granskad bas i
  `ops/neon-game/product-schema.sql` har `partner_players`/`partner_rounds`
  med key_id men saknar explicit operatorId-koppling där; globala transactions
  är player_id-bundna. Inför verifierad API-key → operatorId-bindning samt
  rums-/rund-/varumärkesscope där nödvändigt, med FK/index och unika eventnycklar.
  Backfyll endast bevisad historik; okänd legacydata hålls utanför kundrapporter.
  Härled inte ägarskap från bolagsnamn, key creator eller global player_id.
  Lagra eventuella läsprojektioner idempotent; kopiera inte en skrivbar plånbok
  till Studio. Redovisa valutans precision och hantera pengar utan flyttalsdrift.
  **Beroenden:** A/C och verifierad nyckel-/operatörsmappning; integrationsvyn i
  J kan komma senare. D och E är separata leveranser, inte beroende av varandra.
  **Verifiering:** två operatörer med separata och överlappande spelaridentiteter,
  retry/dubbla events, negativa dagar, öppna/avräknade/annullerade rundor, flera
  valutor och periodgränser. Avstäm varje summa mot motorns ledger. Testa att
  nyckelbyte, URL/body/operatorbyte och export inte läcker ett annat bolags data.

- [ ] **JN2-F — livebord, dealer/limitbyte och schemalagda ändringar.**
  **Frontend:** Johns Floor/List och driftpanel visar faktiska rum, dealer,
  status, platser och väntande åtgärder. Skilj skickad/accepterad/tillämpad/misslyckad
  från live. Paus, återuppta och ändrade limits kräver tydlig bekräftelse.
  **Backend:** återanvänd N1:s atomära presentationsprofil + game lane + room-
  skapande; N2 begär/utför bara tillåtna paketbundna ändringar. Render validerar
  dealer, regler, valuta och limits, kvitterar idempotenta kommandon och tillämpar
  säkra ändringar vid rundgräns. Schemalägg serverledes med uttrycklig tidszon,
  konfliktregel, avbryt och återauktorisering vid exekvering. Klienttimer räcker inte.
  **Databas:** beständig kommandologg/outbox/schemaläggning med operator/room,
  expectedRevision, requestId, önskad tid och engine-ack. Bestäm en enda ägare
  för exekvering i motorn; ingen dubbel sanning mellan Studio och spel-Neon.
  **Beroenden:** C/E samt verifierat package-/room- och revisionskontrakt från D.
  **Verifiering:** pågående runda slutförs före paus; omstart/retry ger inte
  dubbla ändringar; gammal revision nekas, indraget paket/rättighet stoppar
  väntande ändring. Prova alla tillgängliga spel; Roulette/Baccarat förblir
  otillgängliga tills motorn faktiskt stöder dem, oavsett skissens demoväxel.

- [ ] **JN2-G — spelarhistorik och ansvarsfullt spel.**
  **Frontend:** anslut spelardetalj, transaktioner, noter, flagga/block och limits;
  visa källa, faktisk effekt och tid. Inför separata rättigheter för varje
  skrivåtgärd. Självavstängning från operatörsplattformen kan inte hävas i N2.
  **Backend:** ägarskap genom hela läs-/skrivkedjan; Render kontrollerar striktare
  limit och spärr vid varje ny insats. Återanvänd `player_admin_events` där dess
  kontrakt passar och komplettera med operatorscope. Kundvisning väntar på
  motorns ack; en UI-flagga får inte påstå att spel stoppats.
  **Databas:** scoped limits med typ/period/valuta/källa/ikraftträdande, noter och
  audit samt index. Bevara serverägda saldon, historik och kontoidentiteter.
  **Beroenden:** C/E/F:s säkra kommando-/kvittensprincip.
  **Verifiering:** gränsöverskridande insats, samtidiga insatser, striktare av två
  limits, dygn/vecka/månad och tidszon, aktiv runda vid spärr, obehörig upplåsning,
  PII/CSV/export och tvåbolagsisolering i separat testdatabas; aldrig riktiga
  kundkonton för test. Dealerförslag får inte kringgå limits eller exkluderingar.

- [ ] **JN2-H — rapporter, statements och senare intäktsdelning.**
  **Frontend:** börja med sammanfattning/transaktioner/bordsrapport och riktiga
  CSV/XLSX-exporter; därefter månadens öppna respektive låsta statement.
  **Backend:** samma beräkningskontrakt som E i UI/export. Kontraktets avgifter,
  FX-datum, negativ GGR och periodisering ska vara explicit versionsbundna.
  Skissens 10 procent/avgifter och ”Paid” är exempel, inte produktregler.
  Intäktsdelningsavtal och månadsutskick är en separat senare delgrind med
  förhandsgranskning, godkända mottagare, deduplicering och leveransstatus.
  **Databas:** scoped kontrakt/avgifter, frysta statementunderlag och FX-källor;
  senare avtal/report-jobs/outbox. Betaldstatus kräver verklig betalningskälla,
  inte att en månad har passerat. Bevara revisionsspår och undvik dubbelräkning.
  **Beroenden:** C/E och riktiga brand/market-kopplingar innan sådana brytningar.
  **Verifiering:** avstäm UI/CSV/statement mot samma ledger för positiv/negativ
  månad, delmånad, flera valutor och gränsdatum; låst månad ändras inte tyst.
  Export åtkomstkontrolleras på nytt och skyddas mot formelinjektion.

#### Utökningar från skissen — införs bara med verkligt underlag

- [ ] **JN2-I — dealerkatalog, statistik och spelintegritet.**
  **Frontend:** katalog och preview visar publicerade/tilldelade dealers, inte
  Scouts privata mediebibliotek. Statistik och integrity-vy kommer separat när
  underlaget finns; inga simulerade populäritetstal, chattvärden eller proof-hashar.
  **Backend:** aggregera vistelsetid/beläggning/retur med definierad population
  och minsta gruppstorlek; inga privata chattmeddelanden eller obestyrkt kausalitet.
  Katalogbegäran är inte omedelbar tilldelning. Skor/spins/proof måste komma från
  motorns faktiska integritetskontrakt; ingen ny egen slump-/kortlogik i N2.
  **Databas:** scoped aggregat och requeststatus där de saknas; återanvänd
  befintliga motorkällor för rundor/skor/proof. Avstå från ålders-/VIP-segment
  utan verifierad datakälla, tillåten behandling och tillräcklig gruppstorlek.
  **Beroenden:** A/C/D för katalog, E för statistik/integritet, F för tilldelning.
  **Verifiering:** otilldelade/private assets nekas, små grupper maskeras,
  filtrering följer bolaget och flaggade/avstängda spelare utesluts från förslag.
  Prova återspelning/verifiering mot verkligt proof; ändra inte godkända media.

- [ ] **JN2-J — scoped integrationer, återställning av lösenord och 2FA.**
  **Frontend:** sandbox/production, nycklar, wallet-test, webhookstatus och IP-
  regler ansluts en funktion i taget. Visa engångshemlighet bara vid tillåten
  skapning/rotation. Partnerns lösenordsåterställning och riktig 2FA ersätter
  skissens simulerade sexsifferkontroll/QR; de är egna acceptansgrindar.
  **Backend:** återanvänd partner-API och `croupier_auth.api_keys` efter E:s
  operatorbindning; inför separata skrivrättigheter, omauktorisering för känsliga
  ändringar, revokering/rotation och säkert verkligt anslutningstest. Servervalidera
  wallet/webhookdestinationer mot SSRF och begränsa tid/storlek/redirects.
  Produktionsaktivering sker enligt befintlig N1-policy, inte en klientväxel.
  Auth: tidsbegränsade engångstoken, rate limits, sessionsåterkallelse och riktiga
  verifierings-/återställningskoder; inga nya parallella kontodatabaser.
  **Databas:** verifierad nyckelägare och miljö, rotation/revokering, leveranslogg/
  idempotens samt hashade engångstoken/recoverykoder och skyddad 2FA-hemlighet.
  Hemligheter får inte ligga i audit, loggar, vanlig snapshot eller export.
  **Beroenden:** A/C/E:s identitetsbindning; full N2.4 behöver inte vänta på hela J.
  **Verifiering:** ett bolag kan inte lista/rotera ett annat bolags nyckel,
  replay/expired token nekas, gammal session återkallas, rotationens överlapp
  stämmer med kontraktet, felaktig MFA nekas och webhook-retry dubblar inte events.

- [ ] **JN2-K — onboarding och säker brandimport.**
  **Frontend:** Johns setupsteg återanvänder D:s editor och A/C/J:s riktiga
  bolag/team/integration. Separera engångssetup från daglig drift. Review visar
  verkliga blockerare och vad ett go-live-besked innebär; inga lokala checkrutor
  kan aktivera produktion. PDF-/URL-import införs efter manuell branding.
  **Backend:** beräkna readiness från sparat paket, rum, rättigheter och verkliga
  verifieringar. Go-live skapar en spårbar begäran för N1-granskning. Brandimport
  föreslår ändringar som granskas före applicering; begränsad fil-/URL-läsning,
  SSRF-skydd och sanitiserad metadata, inga instruktioner från filer får exekveras.
  **Databas:** scoped setup-/go-live-request med revision/status och audithistorik;
  återanvänd D:s utkast, inte ett parallellt onboardingpaket. Importstatus endast
  om faktisk serverimport levereras; skissens simulerade läsning kopieras inte.
  **Beroenden:** A–D samt relevant F/J-readiness; import är senare förbättring.
  **Verifiering:** reload/annan enhet fortsätter samma utkast, paket- eller
  rolländring efter review blockerar, ofullständiga integrationer kan inte bli
  produktionsklara och upprepad begäran ger inte dubbelt go-live/utskick.

#### Leveransordning och gemensamma slutprov

1. **Första synliga leverans: JN2-A + B.** Admin öppnar Johns och SG:s riktiga
   bolag utan extra partnerlogin; normal partneringång är välformgiven utan
   demokort. Befintliga riktiga funktioner består, oanslutna delar märks ärligt.
2. **Första kompletta konfigurationsflöde: C + D.** Beständig audit, säkra
   rättigheter och utkast → publicering → nästa N3-runda. Inte beroende av färdig
   statistik. Enbart snygg preview eller lyckad spara-knapp är inte acceptans.
3. **Speldataleverans: E → F/G/H.** Gör nyckel-/bolagsmappning och avstämda
   läsdata först; anslut därefter drift, RG och rapporter i separata verifierbara
   deländringar. I:s statistik/integritet följer samma datagrind.
4. **Utökningar: I/J/K.** Katalog kan komma tidigare när paketen stöder det.
   Flerbrand/marknad, intäktsdelning/utskick, brandimport, 2FA och toppmenyvariant
   får inte maskera ofärdig kärna och bockas av var för sig.

**Databassäkerhet:** föreslagna tabeller/fält ovan är designarbete, inte godkända
DDL-körningar. Kontrollera målprojekt/schema och befintlig migrationhistorik
read-only; prova additiva migrationer både på tom och uppgraderad isolerad DB,
inklusive FK, unika nycklar, index, race och återställningsplan. Ingen dump av
verkliga användare, gissad historikmappning eller produktionsbackfill för test.
Produktionsmigration kräver separat mandat och Studio-readiness ska vara uppfylld
före beroende kod levereras till main/deployment enligt befintlig migrationsregel.

**Kodverifiering per delsteg:** kontrollera engines/pins och vald Node före körning;
använd högst fyra testworkers där stödet finns. Utöka befintliga
`lab/test/workspace-surface-pages.test.mjs`, `partner-preview.test.mjs`,
`partner-session.test.mjs`, `partner-team-api.test.mjs`,
`partner-branding-api.test.mjs`, `partner-presentation-flow.test.mjs` samt
`test/partner-access-policy.mjs` och `test/operator-store.mjs` för respektive
ändring; kör dem med `node --test --test-concurrency=4 <berörda testfiler>`.
Följ därefter ordinarie hooks/CI och de runtime-/medieprov som ändringen kräver.
Tester mot minnesfixtur räcker inte som Postgres- eller tenantacceptans.

**Produktacceptans:** dokumentera exakt SHA/deployment och två isolerade bolag.
Prova admin → riktig bolagslista → Johns/SG:s paket → N2-ändring → N3 efter
rundgräns, samt separat partnerlogin → endast egna bolag. Prova 401/403/409/503,
indragna roller, föråldrad browserflik och bolagsbyte utan kvarhängande data eller
utkast från föregående bolag. Jämför visuellt med John efter riktig integration,
inte bara med fixtures. Ingen T2/T3-bock förrän full förväntad effekt verifierats.

**Denna planuppdatering:** kod- och läsande webbläsargranskning; ingen produktkod,
databas, kundinloggning, roll, nyckel, paketpublicering eller driftinställning
ändrad. Separat partnerkontos end-to-end-login och N2-skrivning har inte provats
i produktion. Att adminvägen behöver förbättras är ett bekräftat fynd, inte ett
krav på att användaren ska logga in en gång till för att planeringen ska gå vidare.

### Terminologi och navigation — 6 oktober

Aktiv guide och ordlista skiljer lane, klippuppsättning, adapter, urval,
uppspelningsplan och operatörspaket. PDF:erna används som underlag, aktuell
kod avgör status. Nivå 1 är ScoutGamingGroups gemensamma adminyta på `/control`, med riktiga
verktygsingångar, inte en parallell uppsättning av Kevins exempelpaneler.
`/studio` är labbets basePath, inte produktnamnet i gränssnittet. Nivå 2 på
`/partner` hade i den här passningen den importerade förhandsvisningen; sedan
7 oktober finns också scoped operatörsdata, se T2. Kevins backoffice hör
inte hemma i `/control`. Äldre hashbokmärken fungerar; interna klipp/tal/media/konton
leder till befintliga verktyg och oanslutna vyer får en tydlig förklaring.
Nivå 2:s lane-/designnotiser visar saknad spelkoppling;
lokala utkast fungerar fortsatt i den befintliga bordsförhandsvisningen.
Den här passningen ändrade ingen partner-login, DB-migration, spelregel eller mediefil. `partner_session` och migration 005 kom 7 oktober.

## Öppen arbetschecklista: personalyta under /control

Målet är att `/control` samlar tidigare Lab- och personalverktyg: samma
inloggning, begriplig navigation och fungerande dealer-, klipp-,
administrations- och OpenClawflöden. `/studio` är labbets basePath, inte
ytans namn. Kevins backoffice stannar på `/partner`. Detta är den öppna arbetslistan för fortsatt
arbete, inte en ny migrationsplan. Huvudagenten samordnar och uppdaterar den.
En ruta kryssas först när resultatet nedan har verifierats; äldre PASS räcker
inte för ett ändrat flöde. Senaste gemensamma startversion: `3e613186`.

- [ ] **A. Administratör kan logga in till `/control`.** Jakob har bekräftat att han
  skapade `john.g` i Backoffice från det inloggade kontot `Jakob`. `john.g`
  fungerar som blackjackspelare. Synlig kontometadata bekräftar aktivt
  spelarkonto, ingen synlig Studio-användare med samma namn. Spelarkonton har
  enligt nuvarande kontrakt ingen Studioåtkomst; headerns Administratör gäller
  inloggade Jakob. Kontoformulären förtydligas. Ett separat administratörskonto
  behöver invitation/aktivering via e-post; produktionsmail är punkt F.
  Klart när det avsedda administratörskontot når `/control`, med rätt behörighet,
  och spelarkonton fortfarande nekas. Kontodata ändras först utifrån belagd orsak.
- [ ] **B. Backoffice går rimligt snabbt att navigera i.** Föreprov på
  `3e613186` gav fyra gruppbyten 7,468 / 4,944 / 4,859 / 10,018 s.
  Authrättningen grupperar fyra färska identitetsläsningar i en transaktion
  (12→6 databasfrågor, utan cache). Produktionsomprov på `ba0cb7ee` gav
  7,195 / 3,325 / 5,937 / 2,913 s: varierande väntan kvarstår och 18 GET
  var oförändrat. Nästa riktade rättning tar bort sju extra sessionanrop:
  varje native data-GET lämnar identiteten från sin färska behörighetskontroll,
  och klienten avvisar identitetsbyte, saknade headers och revoke före visning.
  81 riktade tester passerar; legacy- och skrivkontroller kvarstår. Klart när
  faktiskt publicerat flöde är ommätt med rätt data och bevarad behörighet.
  Publicerat `cb8e5254`: 11GET200, fyra fulla mätningar 2,553 / 4,834 /
  6,653 / 2,682s. Anropsminskning bevisad, latenstoppar kvar. Publicerat cd9f5b21
  sammanför färska authprojektioner (utan cache): två SELECT/fyra frågeanrop
  mot tidigare fyra/sex. 118 riktade PASS; signer/sessionförst, collision,
  roll/stamp/epoch och mutationslås bevarade. Numerisk Server-Timing skiljer
  runtimeväntan från API/auth; 18 riktade PASS. SQL8 och CI37305177411 passerar.
  Live cd9f5b21: 11GET200, 9,361 / 2,112 / 2,088 / 1,426s. Första bytet
  innehöll 3,04 respektive 2,76s serverinitiering; senare initiering under1ms.
  Ingen generell latensgaranti. Publicerat 34f64e34 tar bort fyra inledande
  sessionGET och tillåter menybyte under läsning, med gemensam färsk identitet
  kontrollerad före bodyläsning, sena svar avvisade och skriv-/utkastspärrar kvar.
  101 riktade PASS, oberoende review och fullhook 1554PASS/9skip/0fel.
  CI37307380711 har tre successjobb. Live:7dataGET200/0session/0POST,
  1,472 / 5,544 / 4,709 / 1,181s. Byte under pågående läsning fungerade;
  gammalt anrop avbröts och rätt vy visades utan fel. Latenstoppar i initiering
  och dataläsning kvarstår; punkten förblir öppen för dem.
  Regionprov 6 oktober på samma `019dba6d14c0b8b9c9de900af572e916316649b3`:
  Studio-projektets sparade Vercelregion ändrades från `iad1` till `fra1`,
  nära Neon i Frankfurt. Aktiv produktion är
  `dpl_24S1idmMEHgzpPYqrwPPLf2P6YNk`, READY, med oförändrad Studio-adress.
  Första Studio→Backoffice gav 7,879→3,041 s. Overview GET gav
  7,208→2,449 s (runtime 2646,53→319,49 ms; API 1307,22→88,18 ms),
  shoes 3,648→0,934 s (runtime 2683,45→546,38 ms; API 666,36→63,00 ms).
  Varm omläsning gav overview 1,595→0,328 s och shoes 0,866→0,267 s.
  Båda data-GET var 200 och faktiska svar visade `fra1` i `x-vercel-id`.
  Oinloggade overview/shoes gav 401; Studio-login och game-session GET gav 200.
  Neon-plan, DB-data, behörighetskod och produktkod ändrades inte.
  Ett tidigare redeployförsök är CANCELED: det ärvde `iad1` trots regionoverride.
  Det accepterade provet byggdes från samma explicita Git-SHA efter sparad
  regionändring. Första overview har fortfarande cirka 2,04 s utanför
  Server-Timing-faserna. Detta är ett första-/varmprov med befintlig adminsession,
  inte ett nytt lösenordsloginprov eller en garanti för alla grupper/enheter.
  B förblir öppen. Nästa arbete: lokalisera återstående start-/proxyväntan,
  minska sekventiella startläsningar med bibehållen färsk behörighetskontroll,
  och pröva navigation utan full sidomladdning med bevarade utkast.
- [ ] **C. Personalverktyg samlas under `/control`.** OpenClaw samlas på
  `/control/openclaw` och operatörschatt på `/control/operator-chat`.
  `/studio` är labbets basePath. Intern
  navigation, direktlänk, reload och loginens målroute är rättade. Båda vyerna
  samt spelarkonto/adminförtydligandet är verifierade i publicerad `ba0cb7ee`.
  Native/Neon spärrar det äldre fristående röstprovet; UI ska visa detta och
  göra noll röst-GET/POST, med serverns spärrar kvar. Neutrala miljö-/spartexter
  och denna UIrättning har 65 riktade PASS. Publicerat cb8e5254/reload visar
  otillgängliginfo, inga kontroller/alerts och noll röst-GET/POST/API503.
  Klart när menyrutter/direktlänkar/login fungerar ihop, utkast bevaras och
  kvarvarande desktop-/mobil- och användarflöden faktiskt är verifierade.
- [x] **D. P6:s isolerade SQL/HTTPS-prov — verifierat lokalt och i CI 5 oktober.** Huvudagenten har rättat testfixturens
  saknade `gameDb` i både auth- och kontofabriken samt äldre reader/staff-
  antaganden. Osäker talleverantörssubmission ska förbli spärrad vid shutdown,
  inte förväntas vara rent avslutad. Behåll negativa rollprov,
  verkliga SQL-transaktioner, reset/revoke, omstart och cleanup. Klart när samma
  befintliga provmotor passerar på aktuell källa i eget tillfälligt kluster.
  Körning 3: exit0, 17 äldre och 25 aktuella integrationschecks samt fyra
  retained-bank-kontroller. Verklig SQL/HTTPS/omstart och cleanup passerade;
  versionskvitto har stabila inputbytes. Körning 1–2 FAIL är bevarade. Detta
  stänger den isolerade deluppgiften, inte återstående mänsklig/live-P6 i H.
  Samma motor har nu faktiskt PASS i CI37308717362 på exakt e49f6f36.
- [x] **E. Systemkartan visar faktiskt provutfall — verifierat på e49f6f36.** Samma isolerade SQL-motor
  används i CI. `ba0cb7ee`, CI `37300874695`, failed före databasstart när
  runnerns installerade PGDG-libpq saknade nedladdningskälla. Exporten är
  korrekt röd för `studio.sql-restart-https`, med exakt SHA och observationstid.
  Failure-exporten bevaras privat.
  Rättningen använder egen tom paketstatus och installerar/ändrar inget på
  värdsystemet. Klart när ett faktiskt SQL-prov och exporter visar rätt
  resultat/SHA/datum; saknat eller skippat prov får aldrig bli grönt.
  Nästa `cb8e5254`-CI37303118034 stoppade efter databasstart vid delprovets
  resultatavläsning: CI använder Node24.21.0, lokal Node22.22.x. Runnern väljer
  nu uttryckligen TAP, som dess räknare läser, och CI=true lokal SQL7 passerar.
  Även denna exakta failureexport är röd och bevarad. CI37305177411 har tre
  successjobb och faktiskt SQL PASS på exakt cd9f5b21, med observationstid.
  Export: 19green/0red/5grey, inga valideringsfel; okända delar förblir grå.
  routes.studio saknade ett befintligt event-treeprov i CI. CI37307380711 på
  exakt 34f64e34 kör det:14PASS, routekontrakt GREEN. Färsk export har20green/
  0red/4grey och faktiskt SQL PASS. Två ytterligare kvittoluckor är rättade:
  befintligt shoe-prov körs före exporten/genom reportern utan dubbelkörning,
  och befintligt zone-cloud-store-prov ingår fullhook;15lokalaPASS/0skip.
  CI37308717362 på exakt e49f6f36 har tre successjobb och export22green/0red/
  2grey, errors[], observedAt2026-10-05T12:22:56.667Z. Faktisk SQLentry
  passed1/failed0/skipped0; event-tree14PASS, zone14PASS och shoe1filPASS
  med197internaassertions. Spel-/zonkontrakten är GREEN. Fullhook1569PASS/
  9befintligaskip/0fel/cancel. De två persistencekontrakten behåller
  GREY: deras riktiga concurrency/persistenceprov kräver isolerad
  croupier_game_qa och kördes inte. Separat Studio-SQL-PASS ersätter det inte.
  Efterföljande dokumentcommit04baf354, CI37309484604, stoppades före första
  steg i alla tre jobb. GitHub anger betalningsfel eller Actionsgräns utan att
  särskilja orsakerna. Ingen ny kodprovning utfördes. Actions-budgeten är därefter rättad av Jakob; senare 6 oktober-körningar
  har tre successjobb. Det äldre hindret är historik. Funktionsbeviset på e49 och privata failurekvitton bevaras.
- [ ] **F. Produktionsmail och användbar invite/reset.** Samordnad Resend-leverans
  6 oktober har återläst produktionsnyckel och `no-reply@scoutgaming.tech` i
   samma Studio-projekt som nu heter `scoutgaming`. Den befintliga nyckeln har avgränsad sending-access för den
  verifierade domänen. READY-deployment `dpl_G7tZPZ5QAPTdppLhHuGgkpPWwnxh`
  publicerar fryst `184fe66ba22acf63704f2a955f895b359e05027e` i `fra1` utan
  partnerarbetets då lokala ändringar. Den verkliga native mail-adaptern fick
  HTTP 200 och Delivered för både invite och reset till Resends sandbox
  `delivered@resend.dev`. Login och set-password gav 200, utloggad session 401;
  reset-formens action är `/studio/api/auth/reset-request`.
  Den oanvända extra Marketplace-installationen är borttagen efter kontroll av
  noll resurser/projekt/fakturor och noll env-referenser i 71 lästa projekt.
  Fungerande Resend-konto, domän och QA-koppling är bevarade. Tidigare QA-401
  vid domänlistning betydde restricted_api_key för sending-only, inte ogiltig nyckel.
  Produktionskonfiguration och providertransport är därmed verifierade.
  Verklig kontoinvitation, token/aktivering, återställning och mottagarens inkorg
  återstår; inga riktiga konton eller tokens ändrades i sandboxprovet. F förblir
  öppen. Privat kvitto: `lab/data/platform-private/resend-setup-20261006.json`.
  Förtydligande 6 oktober: native Resend-mejl har nu både text och HTML med
  avsändarnamnet ScoutGamingGroup, uttrycklig **intern adminpersonal, nivå 1**
  och åtkomst till hela nivå 1, nivå 2 samt nivå 3 med samma konto/lösenord.
  Mejlet förklarar att nivå 2 tills vidare visar demonstrationer. Formuläret
  i Administration → Konton säger samma sak. Engångslänkarna behåller 72 timmar
  för aktivering och två timmar för återställning. Spelarroller får egna
  mejltexter utan adminbehörighet; okända roller skickar inget mejl.
  Riktade mail/auth/UI-tester och Lab-typkontroll PASS. De två begärda verkliga
  personalinbjudningarna och mottagarnas aktivering/inkorg verifieras separat;
  denna kodleverans markerar inte F komplett och ändrar inga lösenord.
  Jakob tar över de två verkliga utskicken enligt senaste instruktionen.
  Agenten skickar inga mejl eller skapar konton i denna fortsättning.
  Senare läsande kontroll den 6 oktober visar Johns inbjudan som **Bounced**:
  **Recipient not found**, adressen ligger på Resends suppression-lista och
  kontot väntar på aktivering. Rätt adress krävs före nytt utskick; spärren är
  oförändrad. Jakobs dg97-adress visar **Delivered** och kontot är aktiverat.
  Den tidigare begärda Gmail-adressens leverans, faktisk inkorg och resetflöde
  är inte verifierade. F är fortsatt öppen. Privata mottagar-/providerkvitton:
  `lab/data/platform-private/level-two-takeover-delivery.json`.
- [ ] **G. GitGuardian-fynd utredda och hanterade.** Senast återläst
  workspace795524/source30689542 den 6 oktober: 12 öppna och fem ignorerade,
  komplett incidentlista (1 incident-/17 locationsidor). Sex positionerade
  öppna fynd täcker sju källhashpositioner i `docs/system-map/contracts.json`,
  verifierade mot exakt e49f6f36. Senaste nya ID är 37880359/60. Äldre matchning
  för 37867512/37879729 är fryst eftersom deras källfiler har ändrats och dagens
  metadata saknar positioner. Även 37862641/37863164/65/66 saknar positioner.
  Totalt nio positionsluckor, varav sex öppna. Historisk fixtureklassning är
  inte ett nytt bevis för saknad metadata.
  Klart när varje fynd har aktuell belagd klassning och konkret hantering.
  Alla tolv är fortsatt öppna; ingen automatisk ignore/resolve eller breda
  filundantag. GitHub queued/missing GitGuardianrun betyder inte incidentfrihet.
- [ ] **H. Återstående spel-, media- och enhetsacceptans.**
  **Nytt bildfynd 5 oktober:** upload `kortflipp_kling_1080p.mp4` (8,29 MB)
  visas sparad/återläst i ready med användning Idle, men Jakob kan inte
  placera den som idle-variant; ”Välj hur klippet ska användas →” upplevs
  inte reagera. Utred ready-listning, filtrering och knappens navigation/fokus.
  Separat klartkrav: isolerad upload går att hitta, tilldela som idle-variant,
  spara och återläsa efter omladdning. Rotorsak ännu inte reproducerad;
  ingen ändring/aktivering av produktionsmedia utförd. Övriga krav: fyra dealers/två
  faktiska plays, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/
  omstart och naturligt provider-COMPLETED där det saknas. Mänsklig läppsynk,
  kortkontakt och fysisk mic/kamera/mobil/Safari redovisas separat. Klart när
  varje krav har aktuellt bevis eller ett exakt kvarstående hinder. QA AI/GPU
  förblir OFF; betalda prov kräver färsk avgränsad auktoritet.
- [ ] **I. Resterande drift och backup.** Läsutredningen skiljer följande krav:
  frame-varningen täcker saknad uppspelningsstart, presenterad bildruta eller
  avslut; ursprungskvittot saknar flaggorna. Nästa steg är snäv diagnostik
  och reproduktion med exakt idlefilm, med bildrutespärren kvar. Zoner har
  separat editorlagring/versionsskydd och styr ännu inte spelet; full isolerad
  spar-/återläsnings-/omstartsacceptans saknas. Startsidan byter asynkront
  hero-layout och introoverlay; möjlig flimmermekanism kräver faktisk bildserie
  och laddningsmätning innan rotorsak/rättning hävdas. Extern produktbackup har
  matchande verifierat kvitto, men Director/Gateway saknar angivna fullbackup-
  och återläsningskvitton. Nästa steg är samordnad faktisk skrivarfrysning,
  export av `/data/catalog` respektive `/data/openclaw`, extern kopia och
  hash-/SQLitekontroller enligt återställningsreglerna. Exportåtkomst är inte
  prövad. Klart när omprov/fix eller exakt kvarstående hinder är belagt per
  driftfel, och båda tjänster har verifierad extern fullbackup.
Detaljer och kvittoplatser: [den enda löpande handoffen](JOHN-HANDOFF.md#nästa-arbete-och-viktiga-gränser).
Avslutade migrationssteg och deras historiska bevis står kvar nedan.

## Källa och historiska driftkvitton

Aktiv källa är [Jakeminator123/scoutgaming](https://github.com/Jakeminator123/scoutgaming),
enbart main. Gamla github-work-adressen vidarebefordras; skapa inte ett nytt
repo där. GitLab är fryst proveniens och används inte för leverans.
Samlad tidigare drift-/importhistorik finns i den frysta historiklänken ovan.
Nuläge, acceptans och historiska kvitton ska aldrig blandas ihop.

## Fem dokument i docs

- [JOHN-HANDOFF.md](JOHN-HANDOFF.md): verifierat nuläge, överlämning och öppna fel.
- [ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md): backup/återställning och data/mediaregler.
- [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md): namn, tjänsteplacering och villkor.
- [LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md): ansvar/kontrakt/uppspelning.
- Detta dokument: källa, målbild, checklista, driftskarta och leverans.

Behåll högst fem Markdownfiler i docs; uppdatera dem i stället för nya rapporter/
sprintarkiv. [Labbguiden](../lab/docs/README.md) och
[OpenClaws versionsbundna källindex](../open-claw/lab/docs/README.md) ligger nära koden.
JSON-register/systemkarta, media/baseline och privata QA-kvitton bevaras.
Tre ersatta Lab-dokument och redundant `Start-Lissabon.ps1` är borttagna.
Cmd-startfilerna i roten är borta. `node lab/start.mjs` och sessionsvakten
i `open-claw/lab/deploy/local-session.mjs` består.
Take/preview/tillgänglighetsregler finns i guiden.
Gallringen i `6ced437e` tog bort fem historiska V3-kartfiler under `docs/animation-events/`,
en ersatt releaseinventering och två Polarlotto-filer om andra operatörer:
åtta filer/1 143 070 byte. De har inga aktiva konsumenter och finns i Git `6b9dad55`.
Två QA-kvitton med öppna takebeslut och alla aktiva miljö-/baseline-/kartregister behålls.
De tekniska guiderna kortas; inaktuella produktdiskkommandon ersätts av aktuella
Neon-/Blobregler. Inga `.env`-filer, providerinställningar eller databasvärden ändras.

## Masterplan: en sajt, tre nivåer

### Mål och städprincip

En sajt och ett repo, tre åtkomstnivåer enligt systembeskrivningen.
Städa ersatt kod och dokumentation efter verifierad ersättning. Bevara privata
backup-/QA-/kostnadskvitton och andras arbetsdata. Radera inte en tjänst för
att dess UI-namn har ersatts: verifiera dess aktiva läsare och ansvar först.

### Gemensamma kontrakt

1. **Identitet:** gemensamt username/e-post/lösenord, ingen kontotypsväljare.
   Admin får spel och hela personalytan på `/control`; superadmin är adminalias; reader/staff är game-only.
   Befintliga råroller/IDs/saldon/historik bevaras, ingen ny OAuth/kontoreset.
   Credentialresolver kräver exakt en kandidat; collision/pending/fel lösenord ger
   generiskt avslag utan fallback/klientroll. Kapabilitet `sharedCredentials`
   läses före dispatch; misslyckad läsning blockerar, inte alternativ namespace.
   Sessions-/Origin/CSRF/Host/JSON/roll/fingerprint/auth_epoch gäller på servern.
2. **Sparad policy:** Render och labb-servicen använder samma explicita Neonmiljö/workspace.
   `CROUPIER_STUDIO_NEON_POLICY=1` och native `CROUPIER_STUDIO_NATIVE_ADMIN=1`
   får inte skapa två writers. Gemensam spelrevision binder projekt/adminrevision,
   exakt projektrevision består i spelarens kvitto. Repeatable-read/CAS/transaktion/
   historik/audit och bevarade utkast krävs; disk-lock/rename räcker inte.
   ”Profiler” avser presentationsinställningar, inte companion-minne/agentstate.
3. **Media/jobb:** privat objekt-ID/hash/metadata, behörig tidsbegränsad upload/commit,
   servervaliderad filtyp/storlek/hash och säker delete. Ingen Blob-/providerhemlighet
   till klienten. HEAD/Range och privat source/layout-spärr består.
   Blob ersätter filer, inte idempotens, ägare, lease/budget eller GPU-reservationer.
   Fullfil får Blobpaket; stream får inte tvingas genom Blob/betald fullfilsfallback.
4. **Spel/AI-gräns:** Vercel gör lätta adminanrop; Render/RunPod äger live spel/
   långvariga jobb. `/speech-stream` och `/lipsync-worker` bevarar auth/workerbiljetter.
   Molnets Cartesia-anrop får starta efter accepterat GPU-jobb, medan workern kopplar upp; PCM lämnar
   inte spelprocessen förrän spelarbiljetten är autentiserad. Workern använder
   den publika ingressen. Reconnect återspelar inte gammal kö/startar inte nytt betalt GPU-jobb.
   OpenClaw får tillåten publik kontext/katalogrevision, ingen direkt saldoauktoritet.
   Kamera består; mic transkriberas före modellen. Råljud/modell-/GPU-uppgradering ingår inte.
5. **Schema/authkommandon:** checksumlåst product-v1/`ops/neon-game/product-schema.sql`
   ändras inte retroaktivt. Separata additiva 001–005 och återläsningsprov krävs.
   `/api/bo/config` är aktiv Neon-spelprojektion, inte generell raderingskandidat.
   Spelarstatus/partner rotate/revoke/launch/credit kräver signerad Renderauthority,
   nonce/tidsfence och verklig runtimecancel före OK; Vercel skriver inte eget saldo.
   Självrollbyte/radering/sista-admin-race skyddas. Engångstokens är atomiska;
   partnerhemligheter visas tillfälligt, aldrig i listmetadata/storage/audit.

### Migrationsstatus och beroenden

P0–P5 och P7–P9 är levererade med sina dokumenterade avgränsningar.
Fulla acceptansvillkor, importparitet, källhashar och rollbackkvitton finns i
[den frysta migrationschecklistan](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/CLOUD-MIGRATION.md#checklista-och-beroenden).
P7:s avgränsade aktivering var inte ett godkännande av full P6.

- [ ] **P6 — samlad helhetsacceptans.** Fyra dealers/två faktiska plays,
  auth/revoke, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/
  omstart och naturligt provider-COMPLETED där bevis saknas. Mänsklig läppsynk,
  kortkontakt, fysisk mic/kamera/mobil/Safari är separata krav i H.
- [x] P6:s isolerade SQL/HTTPS-fixtur och faktisk CI-resultatkoppling är rättade;
  se D/E. Äldre misslyckade kvitton bevaras. Separat game-persistenceprov saknas.
- [ ] Produktionsmailens hela användarflöde återstår enligt F trots konfigurerad Resend.
- [ ] GitGuardian-fynd och positionsluckor återstår enligt G.

Framtida migration börjar med källinventering och frysta skrivare, därefter
kontrakt/lagring/UI och integration; acceptans, aktivering och avveckling
samordnas. Historiskt godkännande är ingen ny budget eller driftauktoritet.

### P6: kostnadsundantag och acceptansgränser

Jakob beställde AI/GPU/produktion/avveckling med QA kvar och tillät egna worker-
brancher/worktrees för uppdraget. Bara MERGE integrerar main.
Exakta Cartesia/counting-priser är backlog, inte ny blockerande förstudie:
funktionstester får dokumenterad okänd USD/null och mätt usage inom befintlig
numerisk budget/reservation/dispatchauktoritet. Ingen nolltariff/faktura,
automatisk förlängning/refund/journalreset eller generell kostnadsapproval.

Originalkampanj f2c28b62-9ae7-4cd6-abcd-e2137f2206d6, totaltak 10 USD inklusive
alla försök, ankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historisk reservation 5,251152/oreserverat 4,748848 USD; ingen nollställning.
Jakob höjde tvåtaket till sex genereringar totalt. Closed39:
usage 4 gen/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null; två generationer var kvar,
inte färsk dispatchauktoritet. Head
`8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Den gamla policyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Generationstak är inte monetärt utrymme; förbrukat/pending/uncertain återanvänds inte.
Originalets tio SDK-dispatchexempel är historiska; läs aktuell usage före nytt prov.

Fullfilsbelopp reserveras före TTS/GPU; stream/fullfil delar UTC-dygnstak.
Originalets tolvminutersfönster kräver åtta minuter kvar; klientdeadline 300 s och
RunPod-TTL 180 s förlängs inte tyst. Utgången auktoritet återöppnas aldrig.
Successor append-only binder föregående journalhash; ingen retry/dubbeljobb.
Nytt prov kräver färska Gitblobs/immutable image/worker-router-entrymanifest,
SDK 7.12.1 och faktisk processreadback, separata Render/Web-child/SDK-envbindningar.
Prepare-only/router404/SDKimport/deterministisk baseline/WSbinary är inte acceptans.

Bind Director/SDK/Cartesia/RunPod, sparad Neonpolicy, serverägd session/runda,
request/jobID och mediahashar till samma körning. Tre cookieägda kontroller före
connect/play/efter END. Redan utfärdad descriptor går genom posegrind/talkö/
`playGeneratedSpeech` i samma produktspelare/WS/video.
`decoded-product-game-queue` behöver faktisk integration/laddad källa,
presenterade avkodade frames/hörbart ljud och två verkliga ended/playbackACK.
Wrappermount utan spelkö, extra WS/video, greeting och framehash räcker inte.
Retry/restart/cancel/terminal/drain/journal före-efter och SQL/HTTPS/restart
krävs också. fullP6Passed förblir false tills hela kontraktet uppfylls.

Prisbacklogens befintliga underlag:
`lab/data/platform-private/p6-cost-evidence-20261004.json`.
Cartesia-nyckelägarens credit/overage/plan, counting-tariff/uttryckligt gratisbevis,
RunPods hela startup/execution/idle/stopp/lagringstak saknas.
Jakob saknar externa Cartesia-kontots inloggning; begär inte nya loginförsök.
Historisk RunPod-UI: endpoint zsudl8tmzcmiv1, RTX 4090 ×1, 1,10 USD/h, max 1/active 0,
idle 5 s/execution 600 s/20 GB disk/ingen networkvolume/FlashBoot Standard ON.
UI-ms mot docs sekundavrundning och kallstart/rabatt/lagring är inte fulltariff;
600 s execution eller TTL404 bevisar inte workerstopp. Daterat underlag,
inte aktuell prisgaranti eller skäl till ny providerinventering.
Historiska primärkällor: [Cartesia](https://www.cartesia.ai/pricing),
[OpenAI tokenräkning](https://developers.openai.com/api/docs/guides/token-counting),
[RunPod debitering](https://docs.runpod.io/serverless/pricing).

Fysisk mic/kamera kräver samtycke/browserpermission och startar OFF på sidöppning;
bilder kräver Luna/Terra. Manuell engångsmic finns utan lokal wakeword.
Produktkameran ON/configGET/ett syntetiskt STT-prov är inte fysisk acceptans.
Ändrad text/audio/video/revision invalidaterar mänsklig approval; baseline/test/
waveform/stillbild/mun-onset bevisar inte synk/kortkontakt.
Fyra dealers delar spelare, två rehearsalplays krävs vid media/spelarändring.
Gamla tysta BO-videor är inte aktivt lipsyncmaterial. Granskad svarskatalog
och automatisk global spelararkivering är inte infört. Katalogens framtida återbruk
kräver godkänt exemplar/exakt paketrevision/ägare/aktuell kontext; namn/klockslag/
rundor/saldo får inte globalåterbrukas. Gallring nollställer inte kostnadsjournaler.

### Avvecklad källa och ansvar som består

| Avvecklad ersatt del | Aktivt ansvar som bevaras |
| --- | --- |
| Adminiframe/BackofficePanel/CSS, legacyadministration, gamla BO-HTML | Nativegrupper/behörigheter, auth/mail/media/operatorhandlers och sparad data |
| boLoad/boSave/bo.json och ersatta konto/partner/adminskrivare | /api/bo/config Neonprojektion; Render spelkommando/wallet/handoff/cancellation |
| Produktens diskprojekt/social/historik/profil/videoindexskrivare | NeonCAS/revision/audit; StudioPage/Studio har tree/activity/events/guide/probe/videos |
| Gamla beständiga generations/speech/voicecachegrenar | Privat Blobpaket/Neonrequest/cost/GPU/operatorjournaler, aktiva klipp/index/kalibrering |
| Legacy produktdisk/envgrenar, CROOT/LAB_VIDEO_ARCHIVE | BO_URL/origins/auth/ingress, Neon/Blob/provider/streamnycklar, QA/Director/Gatewaydisk |

Historiska disk-envmål LAB_STUDIO_DATA_DIR/CROUPIER_PRESENTATION_STUDIO_DIR/
CROUPIER_GENERATIONS_DIR/CROUPIER_GENERATED_SPEECH_DIR avvecklades först efter
ersatta child-config/läsare/skrivare. QA:s 37 envvärden/disk/SDK/journal består OFF.
Dolda pitboss/turnerings-API är inte nya raderingsmål.
Aktiva GPUworker-testmappar, rotens sex testfixtures, tools/web/pipeline/open-claw/
medier/konton/kostnadsjournaler består. De föreslagna services/test/test/ttols/
test/web-vägarna fanns inte. Disponibel byggcache är inte Labtestruntime.

### Import, rollback och backups

P7:s frysta underlag/paritet och P8:s faktiska borttagningar finns i handoffen.
Käll/SQL/manifest/index binds till exakt main; gamla 132-filersplaner/source-artifacts
är historik, inte återanvändbara råhashar efter ändring.
Fyra SQL-checksummor/elva kostnadstabeller/18 aktiva+sex retainedposter/
32 konto-/speltabeller bevaras. Avslutad import återkontrolleras läsande,
inte med nyimport/ändrade kvittotider. Receiptfel ger transaktionsrollback;
ändrad lease/förbrukning blockerar merge/reset. Rättat transportformat fick
separata fortsättningskvitton, inte fabricerad kontinuerlig TTL.

Full extern backup:
`C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`.
206 filer/10 mappar/125 745 905 källbyte; inventering/metadata/arkivläsbarhet/
remote-lokal-arkivhash PASS. Receipt
`12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9`.
Importreceipt
`0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d`.
Admission/plan/BEFORE/runtime/postdelete står i JOHN och snapshoten.
Gamebackup `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`:
24 källtabeller/102 rader, 32 Postgrestabellers rad-/sekvensparitet.
Labbbackup/syskonstädning/privat OpenClawdevice-backup står i handoffen.

Återgång kräver stoppade/frysta skrivare, separat kopia av senaste Neon/ledger,
rätt scope/schema/media, aktuell paritet och samordnad rollbackpunkt.
Äldre SQLite/disk aktiveras aldrig blindt efter nya Postgresskrivningar.
Produktbackupen är historisk, inte fallback; aldrig två aktiva writers.
tools/backup-render-state.mjs produktprofil är historisk diskbackup, inte den
nya Neon/Blob-metoden. --quiesced är operatörsförsäkran, inte mätt writerdrain.
QA/Director/Gateway har separat backupansvar; aktiv disk/state består.
[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) beskriver procedurerna.

QA:s äldre player_probe_sessions-gap 17→15 och 19→18 består. 24h TTL är möjlig
men inte radvis verifierad utan gamla seen-metadata. Övriga 31 kontotabeller matchar;
original FALSE/compose=false ändras inte. Senare 10/10-bevarandekvitton ersätter
inte äldre luckor. Parent-envs direkta EACCES efter UID-byte är ett redovisat gap,
med barnprocess/källa/stabil deploy/envbindning i stället.

## Ytor och datalagring — produktion och nya QA

| Ansvar | Aktiv källa / gräns |
| --- | --- |
| Publik webb | Vercelteam/projekt `scoutgaming` på www.scoutgaming.tech (apex 308 till www). Nya ytor `/admin` och `/lobby`; `/control`, `/partner` och `/play` behåller sina befintliga flöden. Service web från apps/croupier-frontend; service studio är labb-appen med basePath `/studio`, inte en egen produkt. Spelmotor: Render `croupier-v2`. |
| Konton/wallet/rundor | Neon croupier_game/croupier_auth; Render äger spelauktoritet |
| Zoner | separat croupier_zones/CROUPIER_ZONES_DATABASE_URL, ingen DBfallback |
| Studio/adminpolicy/historik/mediaregister | Neon croupier_studio med scope/CAS/history/audit; Render samma policy |
| Mediefiler/färdiga talpaket | gemensam privat Blob; exakt ägarmetadata/hash i Neon |
| LiveAI/GPU/stream | Render/Director/Gateway/RunPod, Neonjournal/lease/reservation |
| Isolerad nativeQA | separat DB/scope/hostname, befintlig disk/SDK/kvitton, AI/GPU OFF |
| Lokal utveckling | ett koordinerat par, sessionsvakt/lab/data; privata utkast/cache |

SQLite-koden är kvar för lokal/isolerad kompatibilitet och bevisar inte aktiv
SQLite-produktion. `web/server.mjs` väljer backend med `CROUPIER_DATABASE`;
`ops/cloud/config.mjs` och `container-entry.mjs` stöder diskfri PostgreSQL/Neon-
policy med privat Blob och avvisar pensionerade produktdiskkataloger.
Läsande metadata 13 oktober bekräftade Vercelprojektet i teamet `scoutgaming`
och Neonprojektet `croupier-production` i organisationen Vercel `scoutgaming`.
Renderinställningar avlästes inte på nytt; dess driftbeskrivning stöds här av
aktuell kod och de daterade kvittona nedan, inte av en ny deploykontroll.

### Blob är ett gemensamt filarkiv, inte två tjänster

`store_AqwvebTbBHarOjvG`/`croupier-media-private` är privat Stockholm.
croupier/media/dealers/{astrid,vera,amira,mei}/{runtime,source,review,staging}
samt game/site är filgrupper, inte tjänster. runtime är usage, inte visuell approval.
Layout/blobindex binder ID/path/URL/hash/storlek/proveniens/kalibrering.
Gamla astrid-roten/tolv croupier/videos-adresser är avvecklade efter exakt
migrering; ersättningar består. source/staging kan fortfarande ha aktiva beroenden.

5 oktobers rensning: 2 410 lokalfiler/2 133 120 568 byte,
2 313 Blobobjekt/2 131 771 483 byte. Dedup: 64 lokalkopior/14 216 404 byte,
58 Blobobjekt/12 787 392 byte. Alla 2 514 logiska ID/hash/URL-gränser består
via exakt canonicalPath. Kvar 2 450 fysiska/764 115 959 byte;
Blob 1 800 objekt/769 901 848 byte. 62 huvudobjekt HEAD/fullSHA och 88
prod/QA-GET/fullhash/storlek PASS. Kompletta efterlistor och privata
`lab/data/lane-media-audit/`-receipts/plan/hashar bevaras.
Ingen generell medieradering eller ny mänsklig synkapproval följer av dedup.

### Vad ligger kvar på Render-diskarna?

| Tjänst | ID / disk | Ansvar |
| --- | --- | --- |
| croupier-v2 | srv-datg3j6gekts73amgli0; gamla 5 GB-disk borta | Diskfri Neon/Blob, backup kvar. Historiskt var `autoDeployTrigger: off`. Den 11 oktober nådde c48c6754 Render genom Auto-Deploy och exakt SHA verifierades via /__cloud/version; kontrollera aktuell deploystatus före en eventuell manuell åtgärd. 8 oktober 2026 kl. 12:45 återstartade Jakob manuellt; den deployen innehåller L8/N3. `/api/profile` och `/api/operators/<slug>` svarar live. `ops/neon-game/006-player-profile.sql` kördes 8 oktober 16:48 mot databasen `croupier_game` i Neon-projektet `croupier-production` (hette `croupier-astrid-background-zones-db` till 17:15 samma dag); kolumnerna verifierade, 4 spelare oförändrade. |
| croupier-vercel-preview-qa | srv-datj7l893c1s73ar3u50; /var/data, 1 GB | Separat QA/SDK/data/journal/cache |
| croupier-lab-director | /data/catalog, 1 GB | Katalog/historik/CompanionDB |
| croupier-lab-openclaw | /data/openclaw, 1 GB | Konfiguration/agentfiler/sessioner/sökDB |

Studio-projekt betyder sparade presentationsinställningar/revisioner i Neon,
inte en app eller spelarkontosamling. Vercel-projekt betyder webbpublicering.
Produktens diskfria restart/hash/paritet är verifierade; QA/Director/Gateway behålls.
spelsajt-game-server tillhör Jakeminator123/spelsajt och openclaw-sajtagenten tillhör
Jakeminator123/sajtmaskin; de är inte Croupiers avvecklingsmål.
Karta/envregister anger tjänstebindning/nyckelnamn, aldrig hemliga värden.

### Varför finns flera kort kvar i Vercel? — verifierat 6 oktober

| Projekt | Roll |
| --- | --- |
| scoutgaming | Enda aktiva produktionsprojektet; web + studio från samma repo/main, region fra1. Deployad 8 okt: CI grön `0019df59` och `7445b5a5` |
| scoutgaming-legacy-frontend | Tidigare croupier-frontend; domänlös reserv med Git-byggen och automatisk domäntilldelning avstängda |
| croupier-native-qa-abc92154cb15 | Befintlig isolerad testfrontend |
| croupier-native-studio-qa-abc92154cb15 | Tillhörande isolerad Studio |
| croupier-player-preview-qa | **Raderat 8 okt 18:40** på Jakobs beslut (legacy; inga egna domäner). Hade förlorat Neon-kopplingen 17:25 när Neon `croupier-production` och Blob `croupier-media-private` flyttades till teamet `scoutgaming` (se `ENVIRONMENT-VARIABLES.md`) |

Ett repo/en produktionssajt finns genom ett projekt med två Services.
Det gamla croupier-lab-ui-ID:t bär nu hela projektet, vilket bevarar dess
Neon/Blob/Resend och nycklar. croupier-lab-ui.vercel.app består som kompatibelt
Studio-alias; croupier-frontend.vercel.app ger 308 till www.scoutgaming.tech.
Reservprojektets pause-API gav invalid_deployment eftersom aktiv produktion
saknas; det är inte markerat paused och får inte beskrivas som raderat.
NativeQA byggs manuellt/API från samma explicita reposSHA; ConnectGitRepository
betyder saknad automatisk Gitkoppling.
Äldre player-preview är READY på 22dca5c4/dpl_6ksHgAKr7NoW5NEAuP4xVcJucAok;
proxyrot apps/croupier-frontend, session-GET 421 och /studio 500 i avläsningen.
Den är inte fungerande alternativfront, men Blob/Neonägarskap får inte blindraderas.
Produktionen kräver inte QA-fronter; deras data/delade media ska ändå skyddas.
QA behålls/AI-GPU OFF. Webbapparnas paket/Next-versioner är fortfarande separata.

Frontendpreview kan peka mot produktion; syntetiska konton/rundor kräver isolerad
backend/annan hostname. presentation=local gäller också i molnet.
Speluppspelning/Studioobservation/PartnerSSE/genererat tal är olika kvittoflöden;
Studio startar inte andra uppspelningar. Originalpolicy legacyClipPolicy och
Astrid mediaPolicy/idlePolicy sparas i samma projekt; gamla BO-val read-only 410/
explicit exakt import. Privat Blob går via servern; frontend får inga hemligheter.
Vercelkoppling kopierar inte nycklar till Render.

## Nyckelansvar, säkerhet och kvarvarande luckor

Serverkonfiguration äger hemligheterna: Studio DB/Blob/auth/OpenClawadmin,
Render spel/signering/provider/stream, Director/Gateway egen state/pairing.
QA saknar Cartesia-/RunPodnycklar. Vercelkeys är inte automatiskt Renderkeys.
OPENCLAW_API_KEY/OPENCLAW_STUDIO_ADMIN_DEVICE_KEY är adminservervägen,
inte runtime-token eller publik credential. Jakobs egna lokala Cartesiakey
ligger ignorerad i `.env`/`lab/.env.local` med förebackup; driftkey är inte därmed bytt.
Bevara privata anslutnings-/utvecklarprofiler och hemligheter utanför Git.

GitGuardian följer scoutgaming i workspace 795524/source 30689542.
Senast verifierat: 12 TRIGGERED/5 IGNORED, en incidentsida/17 locationsidor,
partiell fil-/radtäckning. Se G för öppna fynd och bevisgränser. Historiska
färre incidenter eller fixtureklassningar ersätter inte aktuell läsning.
GitHub queued/no runs, vanlig grön CI eller neutral/skipped är inte incidentfrihet.
Följ AGENTS metadataredaktion; använd befintlig läsbrygga, inga nya scopes
eller automatiska resolve/ignore-ändringar.

Öppna restpunkter: full P6/ny take/läppsynk/kortkontakt, fysisk mic/kamera/
mobil/Safari, ursprunget till ”Film ended without a presented frame”, kvarvarande menyfördröjning,
full zonlagringsacceptans/startsidesflimmer/extern Director/Gatewaybackup och
produktionsmail/invitation/reset. Auth/session-GET200 observerades 1,3–6,45 s,
static mest 0–15 ms; ingen totalmätning eller isolerad rotorsak/freeplan-/providerförklaring.
Två begränsade rättningar ingår: oanvända BO-anrop tas bort utan ändrat authskydd,
och gammal idle-feltext rensas först vid aktuell faktiskt visad bild. Rotorsaken till
den historiska frame-varningen och authlatensen är fortfarande okänd.
QA Resend Free/delivered→Skräppost/testkontocleanup är avgränsat historiskt,
inte användbar invitation/reset i produktion; nya mejl/konton följer inte automatiskt.
Produktion har nu giltig domänbegränsad Resend-sändnyckel och
`CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech`. Sandboxtransporten är
verifierad; full riktig invitation/reset återstår enligt F. Sending-only ger
inte behörighet att lista domäner och en sådan 401 bevisar inte ogiltig sändnyckel.
GPUshutdown/privat zonbild/OpenClawnavigation är rättade och verifierade avgränsat,
inte kvarstående obehandlade funktionsfel; detaljer/shutdownbudget i JOHN.

## Lokal start och sökning

Starta bara när begärt: `node lab/start.mjs --offline --no-open` är isolerad
preview; `node lab/start.mjs --no-open` följer sparad ansluten profil.
Ett serverpar/sessionsvakt, bevarade utkast/spel och återanvända browserflikar.
Efter Neoncutover kan offlineStudio ge 503 studio_read_storage_unavailable,
ingen auth/lagringsfallback till QA. Lokal guestpolicy består enligt AGENTS.
Byggcache rensas bara utan berörda sessioner/processer; behåll Labtestruntime.

`.ignore` döljer tung spårad media och hemligheter för vanlig sökning.
`.cursorignore` behåller hemligheter och privat data. Ofarlig tung projekttext
(`media/layout.json`, `media/blob-index.json`, `media/**/source/*.json`,
`media/**/staging/*.md`) ligger i `.cursorindexingignore`: den indexeras inte,
men kan läsas uttryckligen. Reglerna ändrar inte Git, bygge eller att filerna finns.
Sök riktat källtext/JSON; binärer/cache/dependencies/private state undantas.
Personarkivets gräns kringgås inte med no-ignore/Githistorik/backups.
Tools används delvis i runtime; test/pipeline/media är inte generella raderingsmål.

## Leverans och kontroll

Filclaims via absoluta agent-talk, status mellan steg och .git-claim vid commit.
Före integration/push: `node tools/croupier-chef.mjs status`, ingen autoroll.
Samordna med eventuell aktiv ägare innan gemensam integration. Gamla
arbetsfördelningar i historiken gäller inte automatiskt ett nytt uppdrag.
Leverans: `node tools/push-github-work.mjs --check`, sedan helpern utan --check.
Verifiera repo/main/fast-forward/remoteSHA, aldrig forcepush/annan destination.
Hooks ny checkout: core.hooksPath=.githooks. GPUimage är separat release.

Rena docs/indexignorecommits kan ha snabba env/GitHubpolicy/hooktester;
kod/config/test/media fullregression, CI alltid full.
Fullmanuell: `sh .githooks/pre-commit --full`.
Plan: `node tools/precommit-checks.mjs --plan`.
Media/spelarändring kräver testerna i `.githooks/pre-commit` och provspelning
av berörda registrerade dealers, `?dealer=<name>&rehearsal=1`, två uppspelningar
i rad i den faktiska spelaren. Ny visuell approval krävs för ändrad
audio/video/hash. Här ändras inga sådana bytes.
Efter push återläs SHA/CI/Vercel/Render/GG; testpass/hash är inte synk/mobil/backup.

Systemkartans exporter är frysta till sitt käll-SHA och observationstid.
Aktuell resultatkoppling beskrivs i E. Saknat eller skippat prov är inte grönt.
Den passiva CI-reportern och dess artifacts gör inga provider-/DB-mutationer.

## Historik

Den fullständiga tidslinjen och tidigare deployments ligger i den frysta
historiklänken överst. Privata loggar och backupfiler är inte borttagna.
Den aktiva checklistan ovan är statuskällan.
