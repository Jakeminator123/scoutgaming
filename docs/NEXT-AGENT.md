# Nästa agent

Aktuell samordning 2 november 2026. Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. Läs [START-HERE](../START-HERE.md) och [AGENTS](../AGENTS.md); den äldre checkouten `dev/projects/scoutgame` och andras prototyper är inte integrationsytor.

Kodstädningen och de två publiceringsrättningarna är levererade genom
[#795](https://github.com/Jakeminator123/scoutgaming/pull/795),
[#799](https://github.com/Jakeminator123/scoutgaming/pull/799) och
[#804](https://github.com/Jakeminator123/scoutgaming/pull/804).
Slutintegrationens [CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/41365808370)
är grön på head `86f469d032866275c396f2eb62682e768a33d4da` och mergad som
`e49fbae90adee013dfbf287089b3d7bb7aef41b0`. Kontrollera färska Git-heads vid
återupptagning; daterade kvitton nedan är inte aktuell molnacceptans.
Astrids produktionsdata och startsidemedier är inte avvecklade. Nästa dataetapp
behöver exakta aktiva referenser, säkerhetskopia och verifierad återställning.

## Funktionsgrupper för produktprov 2 november

Rotens blackjack-, roulette- och delade rumsprov har samlats under
`test/blackjack/`, `test/roulette/` och `test/rooms/`; se [testguiden](../test/README.md).
Svitregistret behåller samma prov i samma sviter. Vanlig hook följer även
nästlade prov och lokala/delade fixturer; motorharness och Chromes CI-upptäckt
stöder undermappar. Atlas visar dessa körbara samband. Spelkärna, produktkod,
schema, molnresurser och mediebytes ändras inte. Faktisk verifiering och PR-head
rapporteras i PR:en; MERGAGENT3 äger granskning/merge och CI-uppföljning.

## Leveranskontroller 2 november

Ignoreringsgränserna beskrivs i [IDE-guiden](../START-HERE.md#byta-ide-eller-återuppta-arbete). Spelbyggkontexten utesluter nu lokala cacher, worktrees och Codex-tillstånd; dess explicita runtimeindata består. Sökundantaget för det aktiva importmanifestet låser inte implementationen. Inga Git- eller Cursor-undantag för privata filer har tagits bort.

Dokument följer samma gräns på 1 MiB och exakta krympande undantagslista som andra filer. Git-objekt-/eventkontrollen och medieskyddet består. Full CI kör samma sviter på fyra befintliga ben: Studio ensam, Admin/contracts på databasbenet, access/presentation och speech/gameplay. CSS och OpenClaw-deploy behåller sina två tidigare ben och stegflaggor. Två före-körningar och en efter-körning med identiska produktträd visade 41–44 sekunder kortare kritiskt ben och 19–33 sekunder kortare totalt; urvalet är litet och ingen generell tidsvinst garanteras. Mergegrindens paketspärr är oförändrad. [Kontrollguiden](../tools/system-map/README.md#leveranskontroller) och Atlas visar körbara samband. Exakt-head CI, mätunderlag och faktiskt mergekvitto hör till PR:en.

Mätkvitton: [före 1](https://github.com/Jakeminator123/scoutgaming/actions/runs/41358712764),
[före 2](https://github.com/Jakeminator123/scoutgaming/actions/runs/41361052019) och
[efter](https://github.com/Jakeminator123/scoutgaming/actions/runs/41361775310).

## Avgränsat materialbyte för ett spelbord 2 november

Admins Utseende erbjuder **Publicera materialval** när hela utkastets enda
ändringar gäller det valda blackjackbordets bakgrund eller bordsgrafik och
bordet redan har publicerade spelinställningar. Den befintliga brandingvägen
verifierar gränsen under låset och använder det frysta paketets tillåtna
material. Projektutkast och nytt bolagsmaterial följer inte med.
J08 skriver rummets nya config tillsammans med paket och journal; ett pausat
grannrum behåller sin configVersion och historiska packageRevision.

Reproduktionen i `room-release.test.mjs` visar att den fullständiga
publiceringen ger 409 efter en orelaterad projektsparning när ett annat
konfigurerat rum är pausat. Samma prov verifierar avgränsat byte, obehörighet,
CAS, främmande material, ändrade medier och rollback vid journalfel.
UI- och Chromeproven täcker spara → granska → publicera på mobil och dator.
Lokala resultat och slutlig SHA hör till PR:en; CI och driftacceptans följs
separat. Ingen produktdata eller process i Render ändras av uppdraget.

## Återuppta arbete mellan IDE:er 2 november

Nya agentworktrees ligger under `.worktrees/<uppdrag>`. [START-HERE](../START-HERE.md#byta-ide-eller-återuppta-arbete) beskriver det fristående [portable-workflows](../tools/portable-workflows.mjs): `list`, `record` och `resume` med explicit `--repo`. Git visar aktuell kodstatus; en privat överlämning i `.worktrees/.handoffs` bär uppdrag och nästa steg. `resume` läser bara valt uppdrag och varnar vid avvikande HEAD/branch, aktiv ägare eller saknad worktree. Claude och Cursor pekar till samma gemensamma instruktioner.

Sex verkliga temporära Gitrepon provar ren/ändrad worktree, identitets- och ägarbyten, okänt metadataformat, sökvägsgränser och återupptagning från annan katalog utan ändringar av kod eller index. Dödhetsgranskning gäller aktuell main/preview och deras aktivt lästa fixerade refs; andra personers egna brancher lämnas orörda och låser inte mainstädning. Exakt huvud-/CI-bevis hör till PR:en; preview och driftacceptans samordnas separat.

## Funktionsmapp för Admins scener 2 november

Admins scenexport och förhandsvisningsmedia finns tillsammans med sina typer och
sex befintliga beteendeprov i [admin/lib/scenes](../apps/studio/client/admin/lib/scenes/).
Komponenternas importer, provens komponentläsning och fullsvitens registrering
följer flytten. Kodinnehållet och importmålen är oförändrade efter normalisering
av sökvägar. Riktade prov, typer och hookbevis anges i PR:en; CI och merge
följs av samordnaren. Ingen produktdata, media eller drift ändras.

## Funktionsmappar för portal, roulette och drift 1 november

Portalens sex skal-/teamfiler finns i [components/partner](../apps/studio/components/partner/README.md).
Roulettens tre modul-/typpar och fyra befintliga beteendeprov ligger i
[admin/lib/roulette](../apps/studio/client/admin/lib/roulette/); driftens tre kontraktsfiler
i [contracts/moving-drift](../packages/presentation/contracts/moving-drift/).
Importer, QA-kopiering, guider och explicit testregistrering följer de 19 flyttarna.
Publika moduladresser och driftlägen är oförändrade.

Lokalt passerar 269 riktade prov inklusive Chrome, Studio-/Admintyper och
Atlas med strikta ankare enligt implementationens kvitto. Oberoende granskning
bekräftar samma innehåll i 37 produktfiler efter normalisering av importmål.
Vid den flytten var testinventeringen oförändrad: 587 filer, inga föräldralösa prov.
Exakt PR-/hookbevis finns i det privata uppdragskvittot
`.cache/gpt-auto-boundaries-1101/funktionsmappar.md`; CI och leverans följs av samordnaren.

## Talets lagring och gamla QA-reservationer 1 november

De tre taladaptrarna kräver nu alltid Neon-journal; förbrukade diskjournaler,
lokala ljud-/videofiler och operatörs-QA:ns oanvända exklusivitets-API är borttagna.
Fullfils-, ström- och sessionsproven använder journalen och behåller scope,
budget, samtidighet, exakta artefakter, gamla svar och avbruten uppspelning.
Filformat-/fillåsprov och fem rena QA-reservationsprov är avvecklade;
dagens journalprov täcker dessutom återstart, kalla workers och osäkra submit.
Den förbrukade diskimporten och snapshotverktyget är också avvecklade genom
#796/#804; SQL-migreringarna och lagrade data är oförändrade.
Riktade prov passerar på Node 24.21.0; full CI hör till PR:en. Talet är fortsatt
pausat och ingen drift-, provider- eller AV-acceptans ingår.

## Atomisk bolagspublicering 2 november

Bolag › Tilldelning skickar kombinerade ändringar som
`publish-company-assignment`: valda miljöer och `branding.assignment`
publiceras i samma servertransaktion, med en paketrevision och en
`package.publish`-journalpost. Tilldelningen valideras mot slutkandidaten;
behörighet, bolag/scope, CAS, projekt-/adminrevision, media och eget material
återkontrolleras före skrivning. Enskilda ändringar använder sina tidigare kontrakt.
Felaktigt kvitto eller osäkert nätutfall kräver återläsning före nytt försök.
Riktade SQL-, native- och browserprov samt leveransbevis anges i ändringens PR.
Ingen DDL, produktionsdata, mediebytes eller driftacceptans ingår.
Avgränsat materialbyte är levererat enligt avsnittet ovan. Ett sammanhållet
ersätt-och-radera-flöde för flera beroende produktobjekt återstår separat.

## Social-/companionkod avvecklad 2 november

Eventstudios kvarvarande API, Director-endpoints, minneslager och Gateway-rollens
kodregistrering är borttagna. Aktiv operatörschatt, privat sökning och produkttal
har kvar sina egna vägar. Den generella registervalidatorn behåller läsning,
export och återställning av det kvarvarande `social-policy`-dokumentet.
Ingen data, molnkonfiguration eller deploy har ändrats. Separat avveckling av
Neon-dokumentet och lagrad Gateway-/companiondata återstår enligt
[AI-guiden](AI/README.md#avvecklad-labbchatt); provbevis hör till PR:en.

## Retained-originalens livscykel 2 november

De sex befintliga retained-posterna kan arkiveras, återställas och uttryckligen
raderas genom [medielivscykeln](storage/BLOB-NEON.md#radering). Grundidentitet,
proveniens och originalklassificering består; bara arkivflagga och den gemensamt
validerade tombstonen ändras. Dealerns cascade inkluderar originalen och flyttar
Astrids globala legacy-grundloop även när dess ID saknar en medieregisterrad.
Andra dealers policies och poster består; återställning öppnar inte tal eller rum.

Referenser i runtimekatalogen, inklusive tolkad legacy-JSON, ingår i raderingskontrollen.
Hela kataloginventeringen avkodas före jämförelsen: giltiga JSON-escapes får inte
gömma ett id eller en sökväg. Oläsbar eller ofullständig katalog stoppar radering;
prosa med ett id som delsträng och en ensam filhash räknas inte som ägare.
Pending/deleted stoppar återimport över scopegränsen och bytehämtning. Arkiverade
original återförs inte till aktiva familjevarianter. 192 riktade prov och ett
PGlite-flöde med alla sex original passerar lokalt på Node 24.21.0, med fel/resume,
alias, CAS, auth, referenser och oförändrade andra dealers/paket.

Ingen produktdata, Blob-byte, DDL eller miljövariabel ändras av leveransen.
Faktisk Astrid-avveckling följer [avvecklingsordningen](storage/BLOB-NEON.md#avveckling-av-produktdata-och-original)
och separat uppdrag; kodprov är inte drift- eller produktdataacceptans.

## CI-bas och historikprov 1 november

Storlekskontrollen binder PR-intervallet till GitHubs exakta mergecommit och dess verkliga bas, samma källa som testurvalet och mergeverktyget. En äldre bas i händelsens metadata orsakar inte längre ett falskt stopp; fel SHA/ref/head och dolda stora mellanliggande objekt avvisas fortsatt. Historikprovet använder Admins aktiva flikkomponent och behåller dealer-/rumskontext, kategorifilter, historik och utkastskydd.

## Masskontroll: Admin 1 november

Sju gamla Admin-actions utan implementation och fyra workspace-läsare utan UI-konsument är borttagna. Dealerverktygen använder hubbens navigation; den dubbla Studio-flikraden och dess förbrukade komponentkontrakt är borta. Filter, dealerbyte, historik, utkastskydd, CAS och scope verifieras fortfarande med beteendeprov. Den gamla Studio-probe-routen och dess adapter är avvecklade efter Jakobs uttryckliga godkännande; motorns probe är en separat aktiv tjänst. Exakta prov- och mergebevis hör till ändringens PR.

## Klientens beteendeprov 2 november

`action-placement`, `game-overlay-layout` och `dealer-chat-visibility` importerar
klientens [game-interface](../services/game/public/game-interface.mjs) och
[dealer-chat-controls](../services/game/public/dealer-chat-controls.mjs).
Mobilplacering, lagliga knappar, första frame/stängning, återupptagen ytterhand
och chatt-/röstreadiness har kvar beteendeprov. Dealerurval, previewkontroller,
repetition, filmägarskap, utfallsfeedback, utdelningschatt och roulette importerar
också produktens kontroller; källsnitt, omskrivna exporter och VM-körning är borta
ur de berörda proven. [Klientguiden](../services/game/public/README.md) visar
modulerna och de kvarvarande gränserna mot dokument, media och server.
De riktade klientproven och webbens modulbygge passerar lokalt på Node 24.21.0.
Endast konsumenter
på main/preview styr fortsatt avveckling. Exakta lokala prov och leveransbevis
hör till PR:en; ingen ny deploy- eller AV-acceptans ingår.

## Chattens beteendeprov 1 november

Spelklienten använder [chat-requests.mjs](../services/game/public/chat-requests.mjs) för spelarens chattanrop och native-bryggans `onSubmit`. Det rena källsnittet i [strömprovet](../test/generated-speech-stream-player.mjs) är ersatt med verkliga anrop genom spelklientens API: exakt JSON-body, NDJSON/JSON, strömflagga bara för spelaren, abort, upptagenstatus och gamla svar efter dealer-/session-/rundbyte. Befintlig playbackdiagnostik och dess livscykelprov är bevarade. 77 riktade chatt-/brygg-/klientprov och 2 webbbyggprov passerar lokalt på Node 24.21.0; ingen ny drift- eller AV-acceptans ingår.

De tidigare listade klientkällsnitten är nu ersatta. Beteendeproven behåller
maxinsatser, previewisolering, filmägare/hålkortsvisning, serverstyrda vinster,
exakta frame-/kortcommits och idempotenta roulettkvitton. De prövar även sena
svar efter dealer-/session-/rundbyte, stängd repetition och tvetydig start utan
automatisk ny insats. Detta är ingen inventering av alla andra testharness i repot.

## Funktionsmappar för dealers 1 november

Dealerns import, fabrik, filmprofil, röst, mediebibliotek och livscykel ligger
nu i [lib/dealers](../apps/studio/lib/dealers/), med sina frysta importmanifest.
De 15 befintliga dealerproven, inklusive dealergruppers CAS och medieägarskap,
ligger i [test/dealers](../apps/studio/test/dealers/). [Utvecklarguiden](../apps/studio/README.md#funktionsmappar)
beskriver gränsen. Importer, filankare, `.ignore` och källhänvisningar följer flytten;
de båda JSON-manifesten har oförändrade bytes och Git-blobbar.

Studio-kommandot och full regression hittar tester rekursivt med citerade
Node-globbar. Inventeringen går från 202 till 203 filer utan bortfall: tillägget
är dealergruppsprovet som tidigare låg i `lib` och kördes i adminsviten.
Orphan-audit, Studio-/klienttyper, miljöregister, dokumentlänkar och Atlas passerar.
Detaljer och slutligt PR-/hookbevis finns i det privata uppdragskvittot
`.cache/gpt-auto-boundaries-1101/mappstruktur.md`. CI och driftsättning följs av samordnaren.

## Avvecklad K04-testkedja 1 november

Den historiska mediekatalogen, revisionshjälparen och tre timingfixturer är
borttagna efter konsumentkontroll; de lästes bara av tester. [HISTORIK](HISTORIK.md#avvecklad-k04-testkedja)
anger sista Git-versionen. De blandade presentationsproven behåller kortordning,
idle, återanslutning och isoleringen av pengar/utfall från presentationsfel.
[Postgres-flödet](../test/postgres-presentation-flow.mjs) använder nu produktens
native-film-v2-resolver och medieselektorer med syntetiskt fryst material.

Lokalt passerar de 16 bevarade presentationsproven, film-/material-/selektionsproven
och resolverns negativa fall för mätning, språk, bolag och saknat fryst paket.
PostgreSQL-/restartproven passerade i [CI på `7d4a6931`](https://github.com/Jakeminator123/scoutgaming/actions/runs/41350833170).
Slutligt leveransbevis finns i [PR #785](https://github.com/Jakeminator123/scoutgaming/pull/785). Ingen ny drift-, data- eller AV-acceptans ingår. Spelregler och produktkonfiguration är oförändrade.

## Dokumentkonsolidering 1 november

Fem plan-/loggfiler efter #782 är avvecklade: KEVIN-PORT, NYCKEL-BOLAG,
STEG-F, REN-START och organisationens BESLUTSLOGG. Bolagskontraktet finns i
[Partner-API-guiden](games/partner-api.md#company-binding), verkligt restarbete
och de uttryckliga Johns Bet-/Paow-/Dragan-gränserna i [körplanen](plans/organisation/KORPLAN-v2.md),
och avvecklingsordningen i [lagringsguiden](storage/BLOB-NEON.md#avveckling-av-produktdata-och-original).
Avslutade etappkvitton och obeställda presentationsidéer finns i Git enligt
[HISTORIK](HISTORIK.md). F11-kvittot och de två beställda incidentunderlagen består.

Granskningen på `f6185c3663dc9101958c8aca78527a5fa2d0301b` verifierade att
012/014 fortfarande är optional och att spelarens skapvägar saknar bolagsfält.
Restarbetet består trots att planfilerna försvinner. De tidigare behållandena
var en försiktig innehållsbedömning, ingen teknisk bevarandespärr.
SQL-migreringarnas historiska kommentarvägar lämnas byte för byte eftersom
källbytes ingår i ledgerns checksumma; övriga konsumenthänvisningar är uppdaterade.

Verifierat: dokumentlänkar/ankare och miljöregister är gröna. Exekverbara token
är identiska i 41 käll-/testfiler; 012/014:s SQL är byte-identisk. Ordinarie hook:
861 godkända, 0 fel, 11 hoppade av 872 prov; demo-byggaren 14/14. Ingen
produktlogik, DDL, data, molninställning eller talaktivering ändras; ny runtime-
eller AV-acceptans ingår inte.

## Organisationsarbete

**Beteenden framför struktur, 1 november:** [#777](https://github.com/Jakeminator123/scoutgaming/pull/777) tar bort den oanvända importplanen och dess 14 planprov. Aktiva API-/panelprov använder importkällmodulen direkt; Dragan-provet behåller plats/pose, exakt taltext, playback/preload och granskningskrav. [#778](https://github.com/Jakeminator123/scoutgaming/pull/778) ersätter blackjackprovets råstate-hash med historiskt härledda observationer av kort, beslut, utfall och betalningar. Historiska skobevis behåller exakta digester; spelmotorn är orörd. [#779](https://github.com/Jakeminator123/scoutgaming/pull/779) tillåter dokumentorsakad paketöverlapp först efter länkkontroll i ett kombinerat, fryst main/head-träd. Samma filer, två kodändringar i samma paket samt ägar-/head-/CI-skydd kvarstår.

Alla tre PR:er passerade CI på sluthead. Riktade prov: 41 import/API och 9 oförändrade panelprov, 30 blackjackprov inklusive 17 negativa mutationer samt 23 mergeprov med verklig Git-historik. Samordnaren granskade slutdiffarna och räknade om historiska signaturer. Regeltexten skiljer skyddade personbrancher från ändringsbar kod i `main`; förbrukade konsumenter uppdateras med flytt/radering. Dokumentens särskilda storlekstak lämnades då kvar men togs senare bort i #794/#799. Säkerhetsläsningen observerade 0 öppna/25 ignorerade incidenter men hade historisk `too_large` och ofullständig platsmetadata; det är inte full säkerhetstäckning. Driftsättning och visuell kontroll redovisas separat i `.cache/behavior-unlocks-1101/final-result.md`.

**Förenklingsvåg 2, 31 oktober:** #769 avvecklar den pensionerade `bo:`-spelarsessionen; #770 tar bort godtyckliga rad-/test-/CI-antalslås och kontrollerar verkliga SQLite-importer; #771 ersätter käll-/CSS-/markup-lås med beteendeprov, inklusive verklig browser och semantiska transaktionslås. #772 monterar kamera-/röstkontroller först efter giltig enabled-konfiguration och kallar Studio-routing för `studio`; #773 tar bort den fristående operator-speech-QA-kedjan och dess syntetiska ägarundantag. Dagens Admin-/partnerautentisering, atomiska pengar och historisk SQL/import består. Exakta headar, CI, release och egen resursstädning redovisas i det beställda privata kvittot `.cache/wave2-final-result.md`; läs inte äldre release-SHA nedan som aktuell driftstatus.

Rapportfynd är prövade, inte automatiska raderingsorder. Three-kärnan, Provspel/gästpreview, gameLanes, Blob-index, importkällor och aktiva medietillgångar har konsumenter. `lab_sessions` har en aktiv producent; tomma gamla handofftabeller ger inget DDL-mandat. Det avgränsade materialbytet är nu levererat ovan; särskild historikgallring och eventuell tillgångsflytt är separata avgränsade produkt-/databeslut. Nio ignore-filer återställdes byte för byte efter riktad synlighetsgranskning; inga globala eller privata skydd öppnades. Miljögranskningen ändrade inga nycklar eller providerinställningar. Talet är fortsatt pausat.

**Avslutad migrationsadministration, 31 oktober:** `migrering/` och dess rapportgenerator, statuskontroller och specialfall i CI/hookar är avvecklade på Jakobs begäran. [HISTORIK](HISTORIK.md) anger Git-versionerna. 78 riktade Node-prov och 18 Atlasprov passerar; Atlas genereras utan fel eller varningar. Aktiva SQL-/readinesskontrakt och molndata är oförändrade. Ingen ny driftacceptans ingår.

**Atlas, 31 oktober:** [PR #761](https://github.com/Jakeminator123/scoutgaming/pull/761) förenar ansvarskartan och sambandskartan med sökbart kodnät, konsumenter, kodankare och provreferenser. `python tools/system-map.py` skapar den fristående `.cache/system-map/index.html`; se [kartguiden](../tools/system-map/README.md). Tidigare lokal browserkontroll av layout, sökning och klickbara samband är genomförd. Ankarändringen i mergade #768 gör att vanlig generering/CI varnar för inaktuella eller tvetydiga handankare; `--strict-anchors` ger exit 1 vid explicit kartgranskning. Trasig manifeststruktur ger fortsatt exit 2 utan ny karta; riktiga filreferensfel ger exit 1 i båda lägen. Lokalt passerar 19 Pythonprov och båda generatorlägena med 0 fel/varningar; Exakta CI- och mergebevis finns i ändringens PR. Förbrukade samband tas bort med koden. Statisk koppling är inte runtimeanvändning eller testtäckning, och ansvar betyder modulansvar, inte en härledd personägare.

**Kosmetiska testlås, 31 oktober:** [PR #767](https://github.com/Jakeminator123/scoutgaming/pull/767) är mergad efter [grön CI 41223336000](https://github.com/Jakeminator123/scoutgaming/actions/runs/41223336000) på `32e39bf6`. Kosmetiska filantal, filnamn, export-, klass-, radie-, exakt outline-, specificitets- och käll-CSS-lås har ersatts av browserprov för fokus/kontrast i båda teman och forced-colours samt kontroll av levererade byggtillgångar. Implementationens och orkestratorns granskning rapporterade 15/15 riktade Chromeprov och negativa fokusmutationer. Detta är inte ny driftacceptans.

**Extern uppföljning, 31 oktober:** [#762](https://github.com/Jakeminator123/scoutgaming/pull/762) synkar Claude/Cursor och gallrar kosmetiska Admin-/landingtestlås. [#763](https://github.com/Jakeminator123/scoutgaming/pull/763) tar bort den permanent avstängda fristående röstprovskedjan (netto 501 rader); socialtjänstens status/fallback är fortsatt false/503 och Render-talet är orört. Båda är mergade efter grön exakt CI. [#764](https://github.com/Jakeminator123/scoutgaming/pull/764) låter Tilldelning återanvända förälderns katalog och samordnar återläsningen efter publicering. Nio riktiga Chromiumprov omfattar läsantal, CAS, partialresultat, läsfel/återförsök, bolagsbundna utkast och sena avbrutna svar; oberoende kodgranskning fann inga blockerande fel. Ingen ny liveacceptans påstås. Atomisk publicering/materialbyte är ett eget produktuppdrag; den bredare filgallringen är inte genomförd fil för fil.

**Dokumentlänkar, 31 oktober:** [PR #760](https://github.com/Jakeminator123/scoutgaming/pull/760) är mergad med [grön CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/41219682447). `tools/check-documentation.mjs` kontrollerar spårade relativa mål och Markdownankare i de centrala guiderna. Beteendeprov omfattar privata mål, kodexempel och att ostagade reparationer inte maskerar fel i commitens index. CI upptäckte ett dubbelt testgruppsnamn som rättades före merge; gruppregistrets befintliga prov väljs nu även av lokal hook. Ingen ny driftacceptans ingår.

**Dokumentgranskning efter systemkartorna, 31 oktober:** sex ersatta planer avvecklades. Den senare konsolideringen ovan ersätter även bolags-/dataplanerna med befintliga sakguider och verkligt restarbete i körplanen. Äldre textversioner finns i HISTORIK; detta är ingen ny moln- eller dataacceptans.

**PR-märkning, 31 oktober:** [#759](https://github.com/Jakeminator123/scoutgaming/pull/759) är mergad. Jakobs agenter anger `#Jakobs agent` för sina verkliga uppdrag. Verifierade Jakobs agenter får merga hans arbete till `main`/`preview` inom sin tilldelning med `tools/merge-pr.mjs`; konto, källrepo, branch, känt uppdrag, exakt SHA och övriga grindar gäller fortsatt. Märkningen är en deklaration, inte autentisering. Se [leveransregeln](../AGENTS.md#leverans-och-merge).

[KORPLAN-v2](plans/organisation/KORPLAN-v2.md) är enda aktiva körordning. Den äldre inventeringen och områdesfilerna är ersatta; Git och [HISTORIK](HISTORIK.md) bevarar deras ursprung. Jakob har gett MERGEAGENTEN fullt beslutsmandat för nödvändiga merges och kontrollerade releaser utan fler godkännandefrågor. Ägar-, CI-, SHA- och verifieringsgrindarna gäller fortfarande. GitHubs normala auto-delete behålls vid godkända PR-merges. Äldre resurser gallras endast efter separat kontroll av ägarskap, merge och osparat arbete enligt AGENTS; kollegors resurser och RunPod-endpoints rörs inte.

Orkestratorn äger integration, denna överlämning och körplanen. Aktuellt restarbete står i körplanen och nya leveransbevis i respektive PR; den avslutade beslutsloggen finns i Git enligt HISTORIK. F11:s [verkliga driftkvitto](plans/organisation/F11-DRIFTKVITTO.md) omfattar två Render-instanser, pengar, återanslutning och negativa prov. Den särskilda F11-spärren är hävd för kompatibla releaser; flaggbyte/publicering och övrig acceptans följer egna kriterier. Äldre versionsuppgifter i kvittona nedan är daterade; aktuell leverans och kvarvarande prov finns i körplanen.

**Avslutad första genomförandevåg 31 oktober:** 4/4 + 3/3 + 2/2 leveranser (inklusive talstart och F11). Produktens övriga acceptans/backlog är inte 100 %. Nästa session börjar med denna överlämning och körplanen, inte gamla chattexporter.

**R1–R5 levererade genom #747:** två separata satsningsrutor och Ångra verifierade i den verkliga previewn; lokal mobil-/tangentbordsverifiering, riktig PostgreSQL, exakt CI och båda molnmiljöerna godkända på `bebe483c7f6c846c10d69545f6c67186839e808e`. 44 ersatta organisationsdokument och sex frysta exekverbara testkopior är borttagna; direkta app-typer och den centrala Git-objektkontrollen rättade. Efterrättningen av tomma rutors etiketter vid rundstart levererades i #748 (`7589d2ba453346ce6fca33b3d53c541f72185138`). Inga spelregler, env, schema eller talaktivering ändrades.

**S1–S3 levererade av MERGEAGENTEN 2:** #752 integrerar de tre teamchattarnas ändringar och #753 rättar det transportfel som verkligt previewprov upptäckte. Konstanta övergångsval och döda medie-/klippmappningsvägar är borta. Skapa bolag och Team har egna komponenter; Team läser ett bolag utan projekt/video eller nästlad bolagskatalog. Byggartefakterna kontrolleras i befintligt CI-bygge och rådgivande browserjobb ligger utanför obligatorisk väntan. [Systemkartan](../START-HERE.md#systemkarta-vem-äger-vilket-beslut) visar produktväg, kod, data, drift, ansvar och prov. Exakta daterade CI-/release-/UI-bevis finns i Git-versionerna av körplanen och beslutsloggen enligt HISTORIK; privata bildbevis ligger i `.cache/cleanup-1031/`.

**S4–S6 mergade genom #755–757:** systemkartans kodreferenser är förankrade i spårad kod. `python tools/system-map.py` skapar `.cache/system-map/index.html` från tabellen i START-HERE; sex områden och 37/37 referenser verifierade på integrerad kod, med zoom/expandering provade i webbläsare. CI kan välja två UI-/byggben i stället för fyra vid enbart vanliga ändringar i tre befintliga Admin-CSS-filer; obligatorisk Chrome och full körning för osäkra/blandade ändringar består. Exakt grön PR-CI, 8 Pythonprov och orkestratorns 22 CI-urvalsprov finns i körplanens daterade Git-version enligt HISTORIK.

De tre tidigare teamuppdragen är avslutade. Normalt auto-delete används efter godkända PR-merges; egna verifierat mergade resurser städas enligt AGENTS. Äldre eller osäkra worktrees och den okända `.pnpm-store/` bevaras. Våg 2:s avgränsning och separat produktarbete står ovan. Återöppna inte migrationen eller F11 som generell startuppgift.

## Spelkontroller och filmtempo, 31 oktober

PR #740 samlar #738 (exakt talfri native-v2-filmlängd), #739 (förbrukad satsnings-/insamlingsreplik släpper nästa serverpresentation) och en stabil insats-/beslutspanel med plats, belopp och serverstyrd nedräkning. Mergad och deployverifierad på `3caafd3dccc6c2376d63bd85c438392b925584f0` i båda miljöerna; Render health=ok, Vercel READY. Oberoende granskningar, 630/630 lokala hookprov och CI [41199193439](https://github.com/Jakeminator123/scoutgaming/actions/runs/41199193439) passerade. I verkligt demoprov tog Hit cirka 5,3 sekunder från klick till aktiva beslutsknappar; serverns exakta filmplan var 4 155 ms, tidigare 22 119 ms, med hela 15 sekunders beslutstid för nästa hand. Filmhastighet, bildrutor, regler och serverägda pengar ändras inte. Talberoende öppning och avräkning har fortfarande konservativ reservtid; all presentationslatens är inte löst.

Det isolerade previewrummet `room-3fdcf4e9-bcba-ab49-779a-2293853001ef` har dessutom publicerats via Admin som version 2 med korrigerad bordplacering. Djupjämförelse bekräftade oförändrade mediebytes och filmkontrakt; andra publicerade rum ändrades inte. Slutliga runtimebevis och skärmbilder samlas privat i `.cache/ui-review-1031/REPORT.md`. Detta är en avgränsad spelrättning, inte acceptans av all teknisk skuld eller hela talprodukten.

Uppföljningen #741 integrerar #742: återhämtad idle/ljudgest lämnar inte kvar en gammal generell varning i tillgänglighetsvyn, och kortens extra 220 ms-layoutanimation tas bort. Animationen blandade gamla lokala koordinater med det nya föräldraplanets skala; slutankaret var rätt men övergången hoppade. Verkliga Chrome-bbox-prov reproducerade felet före rättningen och höll spelar-/dealerkortens skärmcentrum inom 0,01 px efteråt, i båda riktningar genom koordinatbytet. Bildrutestyrd filmrörelse och handfläkt bevaras. Den stabila bordkalibreringen flyttas inte igen.

## Leveransen som avslutas

- **L3 steg 5–6:** Studio 023 är installerad i båda miljöerna. Nya paketrevisioner bär produktionens fyra och previews sex befintliga rum (nio respektive fyra bolagspaket). Den gamla dokumentlistan avvecklas med vanlig CAS-sparning efter kodens driftsättning, utan att skriva om material eller låsta spelkonfigurationer. Paketens `rooms` är enda aktiva rumsregistret; Admins `administration.rooms` är en härledd svarsvy. `gameLanes` är kvarvarande uppspelningskonfiguration, inte en andra rumslista; dess avveckling var L3 steg 7, inte någon av de två beställda delarna.
- **Rapportens pengar/valuta:** #708 rättade reserverat saldo i roulette och belopp under en cent. #551 tog bort dubblerade blackjackhandregler. #711 rättar kontovaluta i klienten, bevarar avräkningsvaluta efter valutabyte och beskriver att extern partnerwallet ännu är blockerad. Browsergranskningen rättade även överlappande valutatexter på små skärmar. Intern demoplånbok är fortfarande stödd väg; detta är inte real-money-acceptans.
- **Insatsrutor och perspektiv:** sju rutor är inte sju olika spelare. En spelare får satsa på flera lediga rutor; kamerans/lokalvyns fokus är separat. #714 rättar klient/server-glappet för huvudinsats på en ledig ruta. Annans ruta, sidobet utan huvudinsats och stängt insatsfönster förblir spärrade. Köregeln om högst tre behållna rutor gäller efter rundan när bordet är fullt och någon väntar.
- **Admin:** #713 förbättrar den befintliga sökningen för mobil, aktuella katalogdata och direktnavigation. Materialets användningar länkas till befintliga miljöer. Radering får inte tyst välja en godtycklig dealer eller publicera om olika bolags rum; filmprofil, vald röst, bord och godkänt material måste passa ihop.

Slutliga PR-, CI-, deploy- och städkvitton samlas privat i `.cache/l3-closeout-20261030/REPORT.md`. Äldre `.cache/closeout-20261030/REPORT.md` beskriver det föregående avslutet och har ersatts som lägesbild av denna leverans.

## Jakob-2 och tal: fortsatt pausat

OpenClaw-trimning (AGENT TVÅ, 31 oktober): #717 och JSON-rättningen #720 är
mergade efter buggranskning och grön full CI. Gateway kör `eb41edc03378789a371be8f22965e7ca06f3ddcd`;
Director, spelbackend och Vercel kör `c5cc98d68b219a77d728813f233e27e32a3b54a2`.
Gatewaykoden är oförändrad mellan dessa revisioner; imagen är fortsatt pinnad till 2026.9.5.
Sparade Admin-val är tillämpade: Director/social/tal använder Luna, chatt/operator
Sol 6.1. Native standarder är low för Director/social, medium för chatt, high
för operator och modellbundna low/high för tal. Alla fem agenter har deny-all
för verktyg och avstängda elevated-rättigheter, verifierat i Gatewayens driftkonfiguration.

Director är åter i `adaptive` efter en godkänd tillfällig återställning till `fixed`.
Luna kan eskalera högst en gång till Sol 6.1 inom samma deadline. #720 lägger en
fast applikationsägd JSON-instruktion även bland indata, eftersom Gatewayen flyttar
systemtext till `instructions`. Båda passeringarna täcks av regressionsprovet.
Tio driftkontroller passerade efter deploy: tokenisolering, tillämpade modellval,
syntetiska svenska svar/offentlig handbeskrivning/nekad kort- och saldoändring samt
backendens hälsa och exakta revision. Spelbackend deployades efter en läsande
kontroll med noll aktiva medlemmar, aktuell närvaro och pågående händer.

Chattkontraktet beskriver tillåtna offentliga fakta och egna sparade demoresultat;
en Slack-koppling till samtliga spelares namn och utbetalningar är inte verifierad.
Slack `files:read` och ominstallation är godkända av Jakob men inte utförda;
webbläsarstyrningen blockerades och kunde därefter inte ansluta till sidan.
AGENT TVÅ:s privata kvitton finns i `.cache/agent-tva-openclaw/REPORT.md`.
Ingen tal-/GPU-aktivering ingår.

Ingen ny bank, GPU-körning eller talaktivering ingår. Jakob-2 har en registrerad ElevenLabs-röst och previewmaterial, men saknar en verifierad egen GPU-bank och godkänd nygenererad läppsynk i spelet. Förinspelade godkända repliker är inte samma sak som genererat livetal.

- LIPSNK: `.cache/jakob2-moving-probe-20261030/PAUSED-HANDOFF.md`. Offlinekontrakt, 39 originalrutor, ljud och runner/transport finns; egna tillfälliga GPU-poddar är borttagna. Senaste stoppet var container-/proxy-readiness HTTP 404, skilt från tidigare IMAGE_AUTH_ERROR.
- Importagenten: `.cache/jakob2-realtime-preview-20261030/PROVRUM-HANDOFF.md`. Preview har 48 klipp, filmprofil med 35 tagningar och tio inspelade svar. 96 verifierade tillfälliga videokopior (cirka 225 MB) är borttagna. Inga original eller publicerade rum raderades.
- Röstnyckeln som senast API-verifierades på Render når Jakob/ABYDM, inte Paow/Dragan. Kevins andra konto och endpointägarskap måste verifieras före ett senare byte. Inga hemligheter ska kopieras till Git eller handofftext. `.cache/elevenlabs-kevin-consolidation/` innehåller privat förberedelseunderlag, inte genomförd röstflytt.
- RunPod-mall `5dkkc3wolw` pekar nu på `https://croupier-v3.onrender.com`. Lokal RunPod-nyckel och produktionens movingnyckel når olika konton; deras endpoints är inte utbytbara. Rättningen aktiverade inte Jakob-2.
- Previews tre talhemligheter är separata, 64 tecken och olika från produktionens. Två olästa produktionsvariabler togs bort med privat krypterad återställningskopia. Aktuell miljökarta: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md). En L3-/UI-ändring kräver ingen ny nyckelrotation.

Kvar för senare taluppdrag: delat bords `generated-speech-stream` behöver komplett `assertCurrent`-/distributionsväg; `/studio-preview` har AI/tal av. Taladaptrar delar ännu Render-process med spelet, medan TTS/GPU sker utanför regelkärnan. Se [TALKEDJA](plans/TALKEDJA.md) och [RunPod-underlaget](TALKEDJA-RUNPOD.md). Bank- eller hashkontroller bevisar inte läppsynk.

## Kända återstående frågor

1. **Dragan-test:** det befintliga rummet saknar publicerad spelkonfiguration (`room_config_missing`) både före och efter L3 på den isolerade produktionsklonen. Tre andra produktionsrum ger identiskt materialurval och konfiguration. Rummet ska inte öppnas genom en gissad standardkonfiguration.
2. **Materialersättning och gallring:** dagens materialpapperskorg kan avpublicera och arkivera berörda spelbord. Ett framtida “ersätt och radera” ska visa berörda rum/bolag, välja uttryckligen kompatibelt material, publicera atomiskt och därefter ta bort förbrukade referenser. Ingen ny global reservdealer eller reservbank har införts. Dokument-/pakethistoriken är inte ett parallellt aktivt produktregister; refererade versioner behövs fortfarande av låsta rum. Oanvänd kod och arbetsfiler ska däremot raderas, inte sparas av vana.
3. **Lounge/prototyper:** #707/#709 är återanvändbara bordstillgångar, inte full loungeintegration. Två lokala test-worktrees behålls under `C:/Users/jakob/dev/worktrees/scoutgaming`: `dealer-table-template-1030` på `local-test/bordmall` och `interactive-lounge-1030` på `local-test/lounge`. Loungen har ocommittat arbete, även Admin-ändringar; testmaterialet får inte mergas som en hel gammal produktbranch. De rena hjälparbetskopiorna `lounge-runtime-1030` och `lounge-tsx-1030` avvecklades 31 oktober efter verifierade Git-bundles i privat `arkiv/2026-10-31/dev/worktrees/scoutgaming/`. Testbrancherna saknar upstream och ligger utanför produktens tillåtna pushmönster. Läs testmappens README och privat handoff `C:/Users/jakob/.codex/visualizations/2026/10/30/01a18a56-82c3-7a11-903f-4b0c42deb6c2/next-lounge/HANDOFF-v6.md` före fortsatt arbete; handoffens äldre sökvägar kan vara inaktuella.
4. **Native och drift:** native-/partner-/provspelsadaptrar har levande konsumenter trots gemensam regelkärna. Ersätt deras anrop innan de raderas. `game-013` är separat schemaefterregistrering, inte bevis på saknade pengaposter. F11:s överlapp/återanslutning är driftverifierade på e8d0b935; se kvittots gränser. Tomma bord/noll reservationer gäller fortfarande vid flaggbyte och där publiceringskontraktet kräver det. V2-tjänsten är raderad; `croupier-v3` är nuvarande spelbackend. Den oanvända socketdiagnostiken för de raderade preview-värdarna är borttagen tillsammans med sitt ensamma test; transportens autentisering, tidsgränser och kögränser är kvar.
5. **Säkerhet:** GitGuardian återlästes 31 oktober: noll öppna incidenter, 25 ignorerade. Incidenterna 39166318 och 39166319 är ignorerade som `test_credential`: påhittade Postgres-uppgifter i Studios tester av loggmaskering. Monitoreringen är aktiv. Den historiska skanningen från 2 oktober står däremot kvar som `too_large` med noll skannade commits; noll öppna incidenter bevisar därför inte full historisk täckning.

Miljöinventeringen från 29 oktober är borttagen; aktuella kontrakt och återstående kontroller finns i [miljöguiden](ENVIRONMENT-VARIABLES.md) och [återställningsguiden](ENVIRONMENT-RESTORATION.md#kvar-att-bedöma-för-gallring). Dokumentstädningen ändrar inga molnresurser eller prototypers arbetsfiler.

**AGENT 1 avslutar, 31 oktober:** lokal Git-städning, full Git-backup, två bevarade tester och rapportleverans är klara. [Incidentrapporten](incidents/2026-10-31-repository-history.md) innehåller även den läsande Neon-kontrollen: små appdatabaser, ingen akut radering, befintlig gallring av chatt/probe och kvarstående revisioner/loggar samt återställningskopior. Inga Neon-resurser ändrades. [Övergångsplanen](incidents/2026-10-31-clean-repository-plan.md) beskriver alternativet på cirka 65 MiB; GitHub-historiken och driftvägen är ännu inte utbytta. Ett senare byte måste skydda nya commits/utkast och testernas nuvarande Git-lager. Ingen fortsatt bakgrundsuppgift eller automatisk radering lämnas aktiv av AGENT 1.

## Arbetsgräns och avslut

Regler, slump, sko, kort och spelutfall är spelkärnan. Hela `services/game` är inte orörbar kod: klient, sessioner, rum, presentation och taladaptrar får förenklas och flyttas med bibehållen behörighet, serverauktoritet och atomiska pengatransaktioner. Läs [ansvarsgränsen](../services/game/README.md#vad-som-får-ändras).

De ursprungliga fyra chattarna har avslutat och lämnat över. KOPPLINGSAGENTENs äldre rapport `.cache/kopplingsagent-audit-20261030/HANDOFF.txt` har bedömts mot aktuell kod; importera inte dess gamla reproduktionsskript som smoke tests. #550 stängdes som ersatt; #551, #593, #701, #709 och #710 är mergade. Den nya L3-/valuta-/Adminleveransen har egna slutkvitton ovan. Återuppta inte avslutade underagenter; starta ett avgränsat nytt uppdrag vid behov.
