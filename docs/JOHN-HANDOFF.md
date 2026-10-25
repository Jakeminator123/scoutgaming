# Aktuell handoff — Scoutgaming

## Inspelat spel utan obligatorisk AI-infrastruktur — 25 oktober 2026

Cloud kan sakna både `OPENCLAW_PRODUCT_SPEECH_URL` och token när genererat tal,
kamera och moving är av. Ett halvt par eller aktiv AI-media utan relä avvisas.
Ingen produktionskonfiguration ändras. Inspelad media och serverns spelregler
behöver därmed ingen extra AI-tjänst i en tom installation. Utan relä är chatten
okonfigurerad: verklig beslutsväg ger 503 utan provideranrop eller påhittat svar.
Riktade konfigurations-/chattprov: 38/38. Full CI och molnacceptans återstår;
detta kvitterar varken chatt, tal eller K06/K07.

## Render-starten avvecklad till en spelprocess — 25 oktober 2026

CI hittade också ett kvarvarande inventeringstest som krävde Studios
`cloud-media-store` och `video-registry` i Render. Kravet är rättat till deras
verkliga Verceltjänst; spelets aktiva media-/miljökontroller består. Docker-
provet på första PR-head var grönt, men full CI måste återköras efter rättningen.

Den kombinerade Dockerfilen, Studio-processen, Next-förkontrollen, interna Lab-proxyn och dess hemlighet är borttagna i kod (`b7ff284d` + `bb6140df`, integrerade som `acdbd18e7` + `111b322d6`). CI/Docker kräver inte längre `CROUPIER_CLOUD_LAB_CHILD=0`; osatt värde ger samma enprocess-start och pensionerad aktivering nekas. Gamla tvåprocessprov är avvecklade. Signerad ingress, Webs verkliga sessionskontroll, dokumentredirects, medieintervall, strömmar, rumssockets och ordnad avstängning bevaras.

**Verifiering:** oberoende produkt-/testgranskning utan blockerare. Agentens normala hook gav 115 pass och tre uttryckliga Linux-skips; testnamnsrättningen 24/24. Roots integration med aktuell v3-CI och katalogkod gav 126 pass, noll fel och tre Linux-skips. Linux-signalprov och faktiskt Dockerbygge återstår i leveransens CI. Miljöguiden rättar också ett felaktigt påstående: valfria zones-URL används fortfarande för att neka sammanblandning med game/auth, inte för att köra pensionerade zonroutes.

**Ytterligare avveckling i samma leverans:** den gamla QA-tjänstens diskbundna stream-start, syntetiska provider-preload, klient och tolv exklusiva prov är borttagna (`f375aeb1`, integrerad som `395b6f145`): sju filer, 630 borttagna rader. Bara kedjans två produktkrokar tas bort: alternativ child-transform och global unpaid-diagnostik. Ordinarie diagnostik, talbudget/session/Neon-journal, WebSocket och containerbehörigheter består. Root har spårat konsumenterna och granskat deltat. Slutlig integration med P6-rättningen gav 147 pass, noll fel och tre Linux-skips, inklusive verklig tal-HTTP. Inga gamla QA-resurser eller data raderas av kodavvecklingen.

Vercel `dpl_4ybApMopithSip7N1THUMrnjpBLE` är återläst READY på PR391:s main `2faa327e`. Render är fortfarande på det tidigare verifierade `23debde7`; tom-katalog-, P6- och startändringarna är ännu inte runtimeverifierade där. Ingen isolerad app, schema, roll, seed eller Blob-bank har skapats. Full migrationsstatus är fortsatt 45 %.

## Pensionerad P6-kedja avvecklad i kod — 25 oktober 2026

Den frusna P6-kampanjens privata SDK-bootstrap, QA-router, aktiveringsverktyg, spelklientkoppling och särskilda fullfilsundantag är borttagna: 27 filer, 129 tillagda och 2 470 borttagna rader i kodleveransen `6cb4ba29` (integrerad som `0358a192`). Tre P6-sviter och två P6-playback-fall är avvecklade med funktionen. Det aktiva miljöregistret beskriver bara kvarvarande kontrakt. Återställningsguidens gamla krav på privat P6-material är borttaget.

**Verifiering:** underagenten körde 244/244 riktade prov och ordinarie hook 273/273 utan skip, inklusive typkontroll, miljöinventering och testregistrering. Root har granskat produkt-, klient-, route-, test- och miljödeltat samt den gamla kedjans exakta service-/scopebindning utan blockerare. Eget integrationsprov av tom katalog, publicering, ingress och talbudget gav 125/125 pass utan skip. Negativa prov visar att gamla endpoints nekas även genom autentiserad Vercel-ingress, att aktiverade P6-flaggor avvisas och att providerinjektion med giltig Neon-journal inte öppnar fullfilsgenerering under streaming. Slutlig CI och deploy redovisas i leverans-PR:en; detta är ännu inte liveacceptans.

**Full-CI-fynd rättat före merge:** PR392:s första fulla körning fann en kvarlämnad `nativePlaybackContext`-referens i gästkontrollen efter att P6-definitionen tagits bort. Verkliga HTTP-anrop gav därför 503. Referensen är borttagen utan ändrade testkrav; tre lokala HTTP-fall reproducerade felet före rättningen. Berörda media-/offline-/strömprov passerade efteråt; två lokala starttimeouts kontrollerades om sekventiellt och gav 44/44 pass i auth-/chattproven. Ny full CI på rättad head krävs fortfarande.

Talreläet behövs fortfarande för genererad text, operatörsrepetition och andra aktiva konsumenter även när genererad röst är av. Ordinarie auth, budget, Neon/Blob och registrerade medier består. Den äldre kombinerade tvåprocess-starten är nästa separata avvecklingssteg; den är ännu kvar i denna leverans. Inga gamla QA-resurser öppnas och inga molninställningar, privata journaler, dealers eller bolag ändras. VID arbetar separat med PAOWs filmprofil/varianter och bolagsdemo; P6-/katalogarbetet ändrar inte dessa bindningar. Full migrationsstatus står kvar på 45 %.



## Tom molnkatalog utan historiska dealerkrav — 25 oktober 2026

Nya scopes kan starta med en explicit, exakt tom runtimekatalog. Den kräver inga gamla Astrid-/Emil-filer eller lokala produktregister. Saknad, blandad eller felaktig katalog avvisas fortfarande; alla fyllda kataloger behåller befintlig validering. Förberedelsefunktionen använder samma målgranskning, schema-/revisionskontroll, transaktionslås och audit som ordinarie import. Tom init kan aldrig ersätta en fylld bank.

**Verifiering:** underagentens katalog-/importprov 23/23, konsumentprov 11/11, publiceringssvit 52/52 och oförändrade legacy-/uppladdningsprov 27/27 passerar. Första commit-hooken gav 230 pass, fyra uttryckliga browser-/PG-skips; den skärpta publiceringssviten gav 52/52 utan skip. Root har granskat produktdiffen och verifierat oförändrad befintlig katalog/revision, JSONB-nyckelordning och att äldre läsare avvisar den nya tomma formen. Det nya publiceringsfallet börjar med tom projektmodell, tom administration och noll media; en ny syntetisk dealer når fryst paket och rätt spelentré, medan annan operatör nekas. Root körde därefter de fyra integrerade katalog-/import-/register-/publiceringssviterna: 86/86 pass. Detta är domän-/providerfixturer, inte verklig moln- eller mediaacceptans.

**Levererat:** [PR #391](https://github.com/Jakeminator123/scoutgaming/pull/391) är mergad som `2faa327e69ae6bac2646009063f4b25c237898bf`. Full CI `40211795949` passerade på exakt head `9da680f7c91ce3f61e2f99495a3103ab3ab0e9ca`: alla åtta regressionsgrupper, isolerade SQL-/omstarts-/HTTPS-prov och faktisk Studio-ledger-readiness. Detta verifierar kodleveransen; kompatibel runtime-deploy och tom init återstår.

**Inför installation:** deploya kompatibla läsare i Vercel och Render före tom init. Rollback måste också förstå sparat tomt format; återställ inte historiska kataloger för att få gammal kod att starta. [Installationsordning och resurskvitto](ENVIRONMENT-RESTORATION.md#konkret-fortsättning-ännu-inte-utförd) gäller fortsatt. Neon-endpointets autosuspend är nu separat observerad som idle; ingen app, roll, schema eller seed har installerats. Migrationsstatus är fortsatt 45 % (9/20).


## Render v3 och borttagna v2-lås — 25 oktober 2026

Jakob gav förtydligat mandat att rensa ersatt kod och regressioner som låser historiska beteenden. Container-CI riktas därför till den faktiska `Dockerfile.game`: det gamla kombinerade Studio/v2-jobbet och dess krav på privat bootstrapmapp är borttagna, medan beroende-/cachekontrollen flyttas till v3. Nätverkslösa bild-/startkontroller kräver att Studio, lokala medieregister och äldre bootstrapdata saknas i spelimagen. Detta skapar ingen lokal produkt eller molnresurs.

Render-guiden och byggkontexten beskriver nu v3 som aktiv drift; det gamla receptet att återgå till suspenderad v2 är borttaget. Färsk tjänst- och HTTP-kontroll visar `23debde7155346e30ee5a3f3dfbe54cd09ea2789`, health200 och v28/rotation. V2 är suspenderad. Main `4abbf1985e183c145c5a7772fe02631c6ee9b274` saknar senare ändringar i motsvarande runtimefiler. Ingen produktion ändras av denna CI-/dokumentleverans.

Den äldre kombinerade Dockerfilens och QA-hookarnas återstående kodkonsumenter är separat avvecklingsarbete. Historiska Astrid-/Emil-krav ska inte användas för att fylla en ny Neon-installation; exakt tom katalog och ordinarie uppladdningar är kodprovade enligt avsnittet ovan; faktisk molninstallation återstår. Testskydd för saldo, auth, scope, revisioner och bytesidentitet behålls. Migrationsstatus står kvar på 45 %.

**Levererat:** [PR #390](https://github.com/Jakeminator123/scoutgaming/pull/390) är mergad som `d9ef40c886d294a7d24e8cbada95d7aa177cfd05`. Full regression `40210908372` och verklig Linux-image/cache/nätverksfri startkontroll `40210908364` passerade på exakt `43a3efa18d3f65557bbec6ed169c754a09afce46`. Oberoende review utan blockerare; ingen runtime-/produktionsändring. Containerprovet är inte full molnacceptans.

## Tom Neon-staging skapad och begränsad — 25 oktober 2026

Jakob godkände uttryckligen Create med Vercels startvärden och omedelbar begränsning. `croupier-k06-k07-staging` är skapad i rätt organisation: projekt `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, endpoint `ep-billowing-surf-b93x7p3c`. Separat GET verifierar PG18, Frankfurt, fast 0,25 CU och autosuspend 300 s. Endast `neondb` finns och inspektionen visar noll användartabeller. Ingen app är ansluten; inga roller/schema/seeds eller produktionsdata har ändrats.

Projektets standardcompute och användningskvot kunde inte ändras i den Vercel-hanterade organisationen; endpointbegränsningen lyckades. Skapa inga ytterligare computes från de gamla standardvärdena. Autosuspend är återläst och faktiskt observerad som idle 16:06:19 UTC; provideruppdatering 15:58:31 UTC. Äldre Render-QA är verifierat suspenderad/maintenance och har inte återöppnats.

[Resurskvitto och konkret installationsordning](ENVIRONMENT-RESTORATION.md#verifierad-provisionering-25-oktober) beskriver separat databas/roller, mains schemaström, tom projektmodell, syntetiskt Admin-underlag, privat Blob, aktuell appdrift och återstående samprov. Databasskapandet är färdigt. Granskningen fann att äldre kod nekade tom runtimekatalog genom krav på historiska Emil-familjer; denna initlucka är nu rättad i kod enligt avsnittet ovan, utan legacyimport; kompatibel deploy och faktisk init återstår. Installations-/driftbeslut och full K06/K07-acceptans återstår. Detta ändrar inte migrationsstatus **45 % (9/20)**.

Föregående leverans [PR #388](https://github.com/Jakeminator123/scoutgaming/pull/388) är mergad som `4abbf1985e183c145c5a7772fe02631c6ee9b274`: CI40208080904 grön på head `03b507a04af6d0644ec9f081e7ff51e56d3f6010`, verkligt migrationsreadinesssteg lyckat och Vercel `dpl_Ci4syM9c556TNiM593c8a9uWoYEq` READY på merge-SHA. Äldre kommentarer om att Neon ännu saknas beskriver läget före detta nya resurskvitto.

## J06: slutgrinden kräver verklig Neon-readiness — 25 oktober 2026

En fork-PR med server-/schemaändring kunde tidigare få grön CI när säkerhetsvakten korrekt hoppade över produktionskontrollen. Slutgrinden krävde inget separat migrationskvitto. Den kräver nu ett rapporterat, lyckat utfall från det faktiska readinesssteget när ändringsklassificeringen anger migrationskrav. Saknat, felaktigt, avbrutet eller överhoppat kvitto stoppar leveransen. Produktionsåtkomstens befintliga fork-skydd är kvar; granskad kod behöver levereras genom en auktoriserad repobranch. Klient-/test-/dokumentundantag behåller sina tidigare gränser.

**Verifiering:** regressionen mot workflowets verkliga slutskriptet var röd före rättningen (saknat kvitto gav exit 0). Efteråt passerar 40/40 CI-/workflow-/precommit-prov, 0 skip, Node 24.21.0. Proven täcker samma repo, fork, main-push, annan push, manuell körning, okänd händelse och saknade/felaktiga utfall. Oberoende kodreview och egen VM-reproduktion av grindskriptet fann inga blockerare. Full CI redovisas i leverans-PR:en. Ingen schema-, data- eller driftändring ingår; full J06 och migrationsstatus 45 % ändras inte.

## Rotationsgrind i Admin — 25 oktober 2026

Levererat genom [PR #387](https://github.com/Jakeminator123/scoutgaming/pull/387), efter [PR #386](https://github.com/Jakeminator123/scoutgaming/pull/386): befintlig native readiness kräver v28 för rotationspolicy i aktivt projekt, dealerspecifik policy, arkiverad policy/globalpolicy och fryst paket. Även fältets närvaro eller `use: rotation` kräver stödet; en äldre läsare får inte accepteras genom generell dealer-/layout-capability.

Negativ readiness stoppar före SQL. Ett verifierat mutationssammanhang kan inte i efterhand få rotationsbehörighet, och gör inget HTTP-anrop inne i transaktionen. Policy utan rotation behåller sitt tidigare krav. Ingen ny writer, lagring, schemaversion eller mediaimport.

**Verifierat lokalt:**71/71 readinessprov,0skip, Node24.21.0. Prov täcker aktiv/arkiverad/fryst policy, verkligt validerbart fryst paket, bevarad data, versionsnedgradering och lifecycle-writer. Oberoende kodgranskning av `36979feee4232f6bc36e5f6aa1343203166dfffa` utan blockerande fynd. Slutlig [CI40206706124](https://github.com/Jakeminator123/scoutgaming/actions/runs/40206706124) är grön på exakt head `86f193137b94e700c53f2042486816bb8fb69423`, inklusive åtta regressionsgrupper och Linux SIGTERM natural/cancel/timeout utan skip. PR #387 är mergad som `095a10397acf7ec5fcde5e3207c52ca89938daf6`.

**Runtimeförutsättning klar:** #386 är mergad som `23debde7155346e30ee5a3f3dfbe54cd09ea2789`. Render `dep-dbf1qie7bikc73bsg650` är live; faktisk HTTP-läsning visar samma SHA, health200, v27/200 och v28/200 med `idleRotation: pose-graph-v1`. Vercel `dpl_4MozvRpRga4F4CmFrxxuAebf3cW7` är READY på merge-SHA `095a10397acf7ec5fcde5e3207c52ca89938daf6`, med verifierat alias `www.scoutgaming.tech`. Inloggad Sceneditor laddades om från sparat läge och visade PAOW/West Bet samt sparat utkast; ingen produktskrivning eller publicering gjordes. Readiness-validatorn provades dessutom mot verkligt v28-svar med syntetisk featuredescriptor och tom repository: en GET, noll SQL-skrivningar. Återställning får bara ske till en läsare som hanterar redan sparad rotation; ny skrivning kräver fortsatt v28. Detta är ett avgränsat kompatibilitetsbevis, inte full migrationsacceptans.

## Migreringsgrind: runtimeannonsering och obligatoriska K07-prov — 25 oktober 2026

Första kompatibilitetssteget från main `8093797cfb920f31de9e2d775d3bad50d1d7b69b`: spelmotorns befintliga posebaserade idle-rotation annonseras uttryckligen genom förhandlad capability v28, `idleRotation: pose-graph-v1`. Standardv2 och version1–27 är byte-identiska med baslinjen. Svaret är1281bytes och ryms inom befintlig2048bytes-gräns. Ingen ändring av sparad policy, klipp, register, paket eller databas ingår.

Fyra befintliga K07-sviter körs nu i obligatoriska `gameplay/shared-blackjack`: idleparitet, bordsbeteenden, insatsgränser och återstart. Deras opt-in-undantag är borttagna. Minnesstore-provet bevisar koordinatoråterhämtning, inte verklig process-/Neon-beständighet.

**Verifierat lokalt:**62/62 kontrakts-/HTTP-/CI-/hookprov,18/18 K07-prov,27 äldre kapabilitetssvar bytejämförda,571 testkandidater/0orphan, `git diff --check`. Node24.21.0, högst fyra arbetare. PR #386 hade grön CI, dealer-regression och GitGuardian på exakt `a1bd30587eae0734ae37243a87e578a8e7f13d15`, samt oberoende review utan blockerare. Renderkvittot finns ovan.

**Nästa steg:** den granskade Admin-grinden är levererad enligt kvittot ovan. Runtime v28 och de negativa proven är klara som delsteg. Den tomma Neon-testmiljön är nu skapad; schema, isolerad appkedja och samprov återstår enligt [aktuell åtkomst- och resurskontroll](ENVIRONMENT-RESTORATION.md#isolerad-k06k07-staging--historiskt-beslut-22-oktober). Före en återgång måste mottagande kod läsa redan sparade rotationspolicyer; en äldre läsare som avvisar formatet är ingen giltig återställning. Full K04/K05/K06/K07/J10/O02/O03-acceptans återstår; dokumentleverans eller dessa testpass höjer inte45%.

## Studio-scener, materialval och responsiva kontroller — 25 oktober 2026

**Studio → Sceneditor**, `/admin/scenes`, är den enda placeringseditorn för kort, marker, kortspridning, dealer, bakgrund, bord och spelkontroller i mobil respektive desktop. Klippkartans gamla lagerflik och scenbokmärken leder dit, med samma projekt och sparning. `/admin/rooms` binder rum och väljer tillåtna material; den tidigare separata geometriändraren och dess API-kontrakt är borttagna. `/admin/assets` är materialregistret. Varje tillåtet grundbord, bakgrund och dealer kan förhandsvisas utan att standardvalet ändras. Placering för kort och marker kan kopieras mellan tillåtna bord i båda formaten. Gemensam förflyttning omfattar dealer, bakgrund och bord.

**Publicering:** spara projektet och publicera den sparade placeringen från Sceneditorn. Servern läser den kanoniska mallen och kontrollerar projekt-, paket- och registerrevisioner. Alla berörda rum visas, även när flera delar scen. Frysta media, materialval, branding och materialutkast bevaras. Ingen ny databasmodell behövs. Dragan-mallen har fått den faktiskt publicerade paketversion 14:s geometri och placeringen har kopierats till dess fem tillåtna bord; projektkvittensen är `studio-2cf6052f-3a48-4d44-bf3a-0e4574d5f777`. Oak-profilens mobilkort är därefter minskade från 4,5 till 4,4 procent för mer marginal. Hela projektet utanför denna geometri, inklusive PAOW-lanen, är återläst identiskt. Leveransens slutliga CI-, merge- och produktionskvitto finns i [PR #385](https://github.com/Jakeminator123/scoutgaming/pull/385).

**Förenkling:** den begränsade mobil-offset-funktionen och dess två hjälpfiler har ersatts av en gemensam scenändring. Klippkartans utkast sparas direkt utan extra granskningsmodal. Osparade ändringar och bolagets sparade materialutkast kan kastas; historiska utkast återuppstår inte vid senare publicering. Oanvändbara High Roller/VIP-val och permanent avstängd Autobet har tagits bort. Gamla meny-/pixeltestlås har ersatts med beteendeprov. Kvarvarande isolering, samtidighet och serverregler är faktiskt verifierade beteenden, inte argument för att behålla gammal UX.

**Levererat:** [PR #380](https://github.com/Jakeminator123/scoutgaming/pull/380) och [PR #383](https://github.com/Jakeminator123/scoutgaming/pull/383) är mergade med grön full CI och oberoende buggranskning utan kvarvarande blockerande fynd. Båda leverantörerna har verifierats på `1c842b5b`: Vercel `dpl_ATgcRZ5znvqthitNJuaxToJcHDpf` READY, Render `dep-dbf01eon74is73b31c1g` live samt versionsendpoint och hälsa 200. PR #383 döljer den inaktiva Ditt bord-menyn under rundan, skyddar utloggning vid placering och ger mobilchatten ett eget fullbrett skrivfält. Lokala beteendeprov, Admin-typkontroll och bygge passerade; 20 riktade action-/chattprov täcker uppföljningen.

**Dragan och acceptans:** publicerat paket 14, draft null. En komplett demorunda 25 oktober 14:41–14:43 genomfördes med ordinarie driftsatt frontend och Render, utan lokala kodöverlagringar: insats 5, kort 3♦/2♥, HIT 7♦ till 12, STAND, återbetalt 10 och saldo 947 → 952. Samma hand granskades visuellt vid CSS 320×568, 390×600 och 1280×720, inklusive öppen chatt och beslutsknappar. Fysisk iPhone/Safari och sju samtidiga händer är inte provade. Det gamla materialutkastets enda skillnad var ett redundant explicit Dragan-val; det är kastat. Inga godkända dealers eller material har konstaterats förbrukade: liknande materialnamn avser skilda PNG-/MP4-filer. PAOWs sparade lane och publicerade paket är oförändrade av layoutarbetet.

**Publiceringsgräns:** [PR #384](https://github.com/Jakeminator123/scoutgaming/pull/384), merge `444caabb`, löste ett verkligt paket som var sju tecken för stort med en förlustfri Brotli-reservväg. Alla 38 media och två lager behölls. Full CI, 82 riktade prov, typkontroll och oberoende granskning passerade. Vercel `dpl_4omJApXcHTkTqwWh2DjsS6oEckBD` är READY på denna SHA; Render står på `1c842b5b`, vilket är rätt runtime för denna klient-/codecändring. Dragan publicerades därefter till version 14 med mobilens kortgrupp Y 32 %. Inget schema eller lagringsgräns ändrades.

**Överlämning till annan dator:** utgå från `origin/main` i `Jakeminator123/scoutgaming`, inte en gammal lokal Croupier-kopia. Repoets Studio-paket använder Volta/Node `24.21.0`; installera respektive pakets låsta beroenden på den nya datorn. Registrerade projekt/media finns i Neon och Blob, inte i denna arbetskopias cache. Följ [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) för miljöåtkomst; kopiera inte personliga agentinställningar eller hemligheter mellan datorerna. Render-tjänsten är `croupier-v3`, Vercel-team/projekt `scoutgaming`. AGENT2:s PAOW-resultat följer nedan; dess lokala original-/bevismapp är återställningsunderlag, inte ett nytt produktregister.

## PAOW: 24 valda viloklipp — 25 oktober 2026

Jakob beställde uppladdning av elva nya original till mains Blob, återanvändning
av de tretton befintliga och inkoppling av alla 24 med rätt ordning/övergångar.
Ordinarie Admin-intag kvitterade **11/11 sparade hos PAOW**. Källurvalet är fryst
på `kevin@f664c54dfce870a4ea048ed93dfda181d0df9600`, med SHA-256, Git-blob,
byteantal och 39 bilder/24 fps per klipp. Äldre importerade media behålls.

Admin får en exakt hashmatchad inkoppling till den valfria posepolicyn i den
gemensamma filmspelaren. Insats-/beslutsfas, knäpp-in/knäpp-ut, huvudrörelser,
talets standardpose och avbrott omfattas. Saknade/dubbla/avvisade original
stoppar inkopplingen. Inga kortfilmer eller repliker aktiveras.

Rummets **Publicera PAOWs viloklipp** uppdaterar bara den sparade idlepolicyn
och dess exakta media i det befintliga publiceringspaketet. Publicerade
placeringar, andra dealers, repliker, lager, branding, utkast och historik
behålls. Detta behövs eftersom sparat projekt och publicerad layout skiljer
sig åt. Behörighet, runtime-readiness och revisioner kontrolleras före skrivning.

**Verifierat lokalt:** 7 nya tester, inklusive 4 000 klippval med full 24/24-täckning,
exakta poseövergångar, avbrott, talprioritet och publiceringspaket/CAS. Befintliga
idleprov 23/23, lokalspelarens 136/136 (inklusive nytt integrationsprov),
relaterade publicerings-/registrerings-/Kevin-paritetsprov och Admins typkontroll
passerar. Publiceringssviten passerar 36/36, inklusive avgränsning, N1,
konkurrerande ändringar och rollback. PR #378 har grön full CI inklusive
production-ledger readiness och är mergad som `51165e9a`.
PR #381 kopplar samma originalmatchning till native Admins riktiga regelflik;
22/22 panelprov inklusive knappanrop, typkontroll och full CI passerar.
Vercel `dpl_AVUrroma9Nz4Jcf2jsGx5dz8QSA8` är READY på `e57ed4d7`; Render
`dep-dbev7au7bikc73bk852g` är live på backendversion `51165e9a`. Versionendpoint
och hälsa (200) är återlästa. Klientuppföljningen kräver ingen ny backenddeploy.

**Publicerat och återläst:** West Bet paketversion **2**, rummet
`room-a8ffcb55-46c5-9424-9c1c-39d614383bf3`, har 24/24 källmatchade media
(19 548 980 bytes) och exakt posepolicy. Projektets sparningskvittens är
`studio-51fef509-d399-4471-8864-70656f15d1aa`. Branding, baseline-record och allt
övrigt presentationsinnehåll är JSON-identiskt före/efter. Brandingutkast är
fortsatt null. Sparad PAOW-policy är aktivt underlag och ska inte städas bort.

Livekontroll i den publicerade spelarvyn visar riktiga videobilder, 8 olika klipp
med uppspelnings-/bildkvittens och 9 observerade klippidentiteter på 45 sekunder.
Observerade övergångar följer grafen, inklusive vila → knäppta händer → vila;
inga status- eller konsolfel. Ingen insats eller spelrunda genomfördes.
Alla 24 val och beslutsfasens regler är verifierade offline; samtliga 24 har
inte spelats igenom manuellt i produktion. MAIN har fått slutkvittensen och
kan fortsätta sin separata layoutdriftsättning.

## Mobilens beslutsknappar på korta skärmar — 25 oktober 2026

Ett extra verkligt webviewprov av Dragan vid 320 × 568 visade att beslutsknapparna behöll gamla koordinater efter resize, eller föll tillbaka till en placering över saldot. Osynliga gamla DOM-kort och totaler samt tomma resultat räknades som hinder, medan synliga SVG-kort saknades i mätningen. Placeringen använder nu synliga kort/totaler och skyddar även HUD och chatt. Gamla koordinater rensas; fullstor knapprad används där den ryms, annars en kompakt 198 × 50 px rad med 44 × 44 px tryckytor. Verklig platsbrist ger en tydlig status i stället för dolda kontroller utanför skärmen; normal layout återställs när utrymmet kommer tillbaka.

**Verifiering:** två regressioner var röda före rättningen. Underagenten rapporterar **39/39** riktade prov gröna, däribland verkliga uppmätta mobilhinder, SVG, resize, kompakt/normal återgång, chatt och oförändrade lagliga/betalbara spelval. Även 77 splitkontroller och 50 000 lokalt simulerade rundor passerar. Root har granskat produktdiff och regressioner utan blockerande fynd. [PR #375](https://github.com/Jakeminator123/scoutgaming/pull/375) är mergad efter [grön full CI på 65e88bb1](https://github.com/Jakeminator123/scoutgaming/actions/runs/40140355935) och GitGuardian. Vercel `dpl_5iLLHYVirWZ5jDUpnd9gVzVfvAzF` och Render `dep-dbejhdvb9u1s739u96s0` publicerade main `a9d6a2f7`; version-endpoint matchar. Verklig webview bekräftar kompakt placering efter storleksbyte, men en färsk omladdning visade att den första mätningen kunde ske medan scenen fortfarande var dold. Uppstartsordningen rättades därefter i PR #376, se runtimekvittensen nedan. Spelregler, pengar och publicerad rumsdata ändras inte av denna kodrättning.


**Uppstartsordning:** spelklienten gör nu en engångsvis omlayout när både dess platser och rätt dealers första presenterade bild är klara. Det gäller oavsett vilken som blir klar först. Close/navigation avvisar en redan köad callback; första-bildsskyddet och spelstatus är oförändrade. Den verkliga initiala 320 × 568-layouten återges i beteendeprovet: utan hooken är det rött, med rättningen får knappraden fri plats även utan resize. Underagenten rapporterar **189/189** berörda beteendeprov gröna. Root har granskat hela produktdiffen och regressionsproven utan blockerande fynd. [PR #376](https://github.com/Jakeminator123/scoutgaming/pull/376) är mergad som **554622356b75bcc9ee365802b4c8c5f0d6e9bd37** efter [grön full CI på 7abe2b64](https://github.com/Jakeminator123/scoutgaming/actions/runs/40141554682), GitGuardian och 26/26 pre-commit-prov.

**Runtimekvittens:** Vercel `dpl_2R5zT5Zaw8QeRRcLgs1WWGy1d772` är READY och Render `dep-dbejof7b9u1s739v3tmg` är live på samma 55462235. Version-endpoint matchar, health svarar 200/ok och publik `app.mjs` innehåller första-bildshooken. Färsk Dragan-start vid **320 × 568** ger kompakt rad cirka **198 × 50 px vid (61, 359)**. Färsk start vid **390 × 844** ger normal rad cirka **268 × 74 px vid (61, 513)**, fri från uppmätta kort, insatsbågar, chatt och HUD. Återgång till 320 × 568 ger samma fria kompakta rad utan omladdning. Båda starter visar rätt video i uppspelning och inga geometri-/placeringsvarningar. Insatsytorna ligger kvar enligt paketrevision 10. Ingen insats eller spelhandling utfördes; den befintliga handen lästes bara. Bilder: `dragan-mobile-320-final-20261025.jpg` och `dragan-mobile-390-final-20261025.jpg` i chattens privata verifieringsartefakter. Inga error-loggar rapporterades i det avgränsade Render-fönstret efter denna deploy.

**Kvarstående acceptans:** Jakobs fysiska iPhone/Safari ska bekräfta start efter längre väntan på Starta videon samt insatsplacering i stående läge. Frågan är ställd; webviewproven ovan räknas inte som Safari-acceptans.

**Avslut:** de fyra egna, verifierat mergade lokala funktionsbrancherna för gestväntan, publicerad mobilplacering, knapprad och första bild är borttagna. Tillfälliga testflikar 10/11 är stängda och viewportöverskrivningen återställd; West Bet lämnas på den delbara lobbylänken. Återanvänd arbetskopia, installerade beroenden, andras grenar och huvudcheckoutens osparade arbete bevaras. PR #352 är fortsatt utkast; Kevin-ägda #315/#323/#333 har inte mergats. Ny säkerhetsläsning på main 55462235: källbindning verifierad, incidenttäckning komplett för källan, 0 öppna/23 ignorerade, aktiv monitorering. Historisk skanning är fortfarande ofullständig (too_large), platsmetadata partiell.
## Kevin → main: reviderad plan, K05 och slutkriterier — 25 oktober 2026

[Masterplanen](../migrering/MASTERPLAN.md) och [K05-mappningen](../migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md) uppdateras i [PR #379](https://github.com/Jakeminator123/scoutgaming/pull/379) inför Jakobs beställda integration och fortsatta selektiva migrering. Matrisen anger befintlig funktion, återstående lucka och acceptansgräns. [Motiv och slutkriterier](../migrering/MASTERPLAN.md#motivering-och-när-migreringen-är-klar) kvarstår. Denna PR ändrar bara dokumentation.

**Aktuellt underlag:** main `0e457589e84dcef3147ee54f01883ce5e459e356` efter #378/#380–#385. Mergade #380/#383/#384/#385 återanvänds: Studio → Sceneditor (/admin/scenes) är enda placeringseditorn. publish-scene-layout publicerar geometri från kanonisk sparad mall med projekt-, paket- och registerrevisioner; materialutbud publiceras separat. Den separata bolagsgeometrin och update-scene-layout är borttagna och ska inte återskapas. PR385:s driftkvitto och handoffens kompletta Dragan-demohand är delacceptans; fysisk Safari och sju samtidiga händer är inte verifierade. Redundant Dragan-materialutkast är kastat, medan aktuella material, fem bordsprofiler och PAOW-data bevaras. Kodgranskning bekräftar sparad-mall-publicering och borttagen ersatt writer. #333:s granskade innehåll finns redan på main; #315/#323 är äldre test-PR:ar. West Bet revision 2 med 24 exakta idleoriginal återanvänds utan omimport. Kvittot omfattar ingen PAOW-insats/full runda.

**Anpassning och motiv:** Admins auth/scoped writers/revisioner, Neon-register, privat Blob och trelagersspelaren är målmodellen. Neon använder PostgreSQL/SQL. Rena kodprov och befintlig isolerad PG-harness är delbevis; ingen ny SQLitefixture, lokal produktväg eller SQL-direktskrivning ska ersätta Admin. Aktiva moduler med äldre namn och verifierad temporär Blob-cache bevaras. Importerad, bunden och visuellt accepterad media hålls isär; osäkra giv-/talfilmer förblir avstängda.

**Historiskt fynd, kompletterat genom #386/#387 ovan:** #378 lägger till `rotation`/`use: rotation` i strikt idleformat utan specifik capability-/readinessgrind. Föregående main-läsare på `34c6c22f` avvisade fältet i ett direkt kontraktsprov. #381 ändrar klientkopplingen; #382 visar fungerande aktuella versioner men ersätter inte skydd för versionsblandning/rollback. Explicit stöd och negativa prov är nu implementerade; full kompatibel återställning kvarstår. Detta var inte en observerad produktionsstörning. Dealerpolicyn kan påverka flera rum i operatörspaketet.

**Färdiggräns:** dokumentpushen avslutar planleveransen. Kevin-migreringen blir klar först när de 20 aktiviteternas gällande resultat är verifierade, inklusive O02:s samprov och O03:s leverans/drift/restore. Full Kevin-paritet eller fler dealers/språk krävs inte. Bortval kräver uttryckligt scopebeslut, inte tyst statusändring. **45 % = 9/20** står kvar; baslinje, statusar, vikter och beroenden ändras inte. Teknisk Neon-/Blob-flytt är ett separat redan dokumenterat avslut.

**Verifiering och avgränsning:** dokumentlänkar/ankare, statusgenerator, oförändrade skyddade statusfält och dokumentdiff kontrolleras inför leverans med ordinarie hooks. Tidigare kod-/Adminprov och andra agenters driftkvitton anges med sina bevisgränser; ingen ny spel-/produktionsacceptans hävdas. Ursprungliga main-checkoutens osparade arbete och annan IDE:s test-/Adminarbete bevaras. Lokala fixture-/beroendefel används inte som produktfel eller poängavdrag.

## Avgränsad mobilkalibrering av publicerat rum — 25 oktober 2026

Admins rumsvy kan nu förhandsvisa och publicera en lodrät justering av de tre mobila kortankarna när markerna följer korten. Den utgår från aktuellt fryst paket, inte projektutkastet. Samma rena beräkning används i förhandsvisning och server. Publicering kräver N1, aktivt blackjackrum, dess faktiskt valda bord, en sammansättning utan andra publicerade rum i bolaget och oförändrad paket-/administrationsrevision. Ankare och autoskalning som behöver annan kalibrering avvisas. Readiness granskar den exakta nya presentationen innan befintlig transaktion, audit och ny historikpost används.

Alla andra publicerade värden, media, desktop, projektutkast och sparade materialval bevaras. Efter POST kräver klienten separat GET med exakt presentation, version och bevarat materialutkast. Gamla svar, dubbla klick och samtidiga ändringar kan inte kvittera fel rum eller skriva över en nyare version.

**Verifiering:** backendens regression var röd före implementation; **52/52** backendprov och **47/47** UI-prov passerar, inklusive revisionskonflikt, rollback, behörighet och bevarade utkast. Admin-typkontroll passerar. Root har granskat produktdiff och tester. Förhandsförslaget för Dragan/Oak är −7 procentenheter av bordbildens höjd: endast mobila `seats[0..2].card.y` ändras, cirka 27 px vid 390 px scenbredd. Efter granskad mobilförhandsvisning publicerades Dragan genom den nya Admin-knappen, paketrevision **9 → 10**. Separat GET och publik rums-preview bekräftar exakt tre ändrade `card.y`, oförändrade övriga presentationsvärden, rum, branding och sparat materialutkast (revision 3). Utkastets äldre basversion är bevarad och markeras i Admin. [PR #374](https://github.com/Jakeminator123/scoutgaming/pull/374) är mergad efter [grön full CI på daa30674](https://github.com/Jakeminator123/scoutgaming/actions/runs/40138938421) och GitGuardian. Vercel `dpl_F1ivLeeBxVxEKgfcreAkrENLPK5G` är READY och Render `dep-dbej8bbncjis73ee68rg` är live på **8df6b9a9a5e27fd71747c313315fb1bd6fba304c**; version-endpoint matchar och health svarar 200/ok. Ingen fellogg på error-nivå i Render under det avgränsade driftsättningsfönstret.


## Mobil uppföljning: gestväntan och Dragan-placering — 25 oktober 2026

Jakobs verkliga iPhone/Safari-prov visar att spelet öppnas efter **Starta videon**, men **Ladda om** hann visas under väntan. Orsaken är att sidans 30-sekundersvakt inte kände till filmspelarens väntan på användargest. Den vakten pausas nu endast för den aktuella, hashverifierade filmägarens gestväntan och startas om när användaren trycker. Scenen förblir dold tills rätt dealers bild faktiskt presenterats. Filmens absoluta 128-sekundersgräns, avbrott, cachelease och synkrona `video.play()` i klicket är bevarade; fel dealer, gammal timer/film/version och avslutad presentation kan inte återaktivera väntan.

**Verifiering:** tre nya regressioner var röda före rättningen. Underagentens två hela berörda sviter ger **148/148** godkända beteendeprov i Node 24.21.0 med fyra testarbetare. Root har granskat produktdiffen och integrerat callbacken i spelstarten. [PR #373](https://github.com/Jakeminator123/scoutgaming/pull/373) är mergad som `56d1c711` efter [grön full CI på 2856ed41](https://github.com/Jakeminator123/scoutgaming/actions/runs/40138195720) och GitGuardian. Rättningen ingår i den verifierade driftsättningen `8df6b9a9` ovan. Ett nytt verkligt iPhone/Safari-prov har efterfrågats; webview bevisar inte Safari-acceptans.

**Insatsytorna:** Jakob preciserar Dragan i stående mobil. Publicerad revision 9, rummet `room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2`, använder Oak-bord `f00be01d-fe7c-4a43-85b9-952e378f7331`. Vid faktisk CSS-viewport 390 x 844 ger sparad mobilgeometri insats-Y 476,36/487,88 px; DOM ger 476,349/487,869 px. Placeringen vid framkanten följer alltså kalibreringen, inte ett påvisat projektionsfel. Mobilkalibreringen ovan ger nu DOM-centra Y **449,467 / 461,001 / 449,467 px** vid 390 × 844, med tre cirka 44 × 44 px tryckytor. Videon spelar och ingen geometrivarning visas. Det gemensamma projektutkastet har andra, opublicerade scen-/bordsvärden och har inte publicerats. Ett extra prov vid 320 × 568 hittade ett separat fel i beslutsknapparnas placering efter resize och vid verkligt utrymmesbrist; det rättas i den separata knappradsändringen ovan. Webviewens storleksprov är ingen Safari-acceptans.


## Rättad driftvägledning — 24 oktober 2026

Runtimeguidens aktuella driftstycke beskrev fortfarande Control, Studio från `lab`, två Verceltjänster och gamla Render `croupier-v2`. Det hänvisar nu till aktiva Admin-/lobbyingångar, de tre tjänsterna i `vercel.json` och återställningsguidens exakta resurs-ID:n. Det separata autentiserade `/play/{game}`-kontraktet och historiska mediebeskrivningar är kvar. Verifierat mot `vercel.json`, Admin-/spelroutningen och live tjänstmetadata för `croupier-v3` (rätt repo/main, ej suspenderad, manuell deploy). Endast dokumentation ändrad. Ingen ny iPhone-acceptans eller medieacceptans påstås.

## PAOW / West Bet: import och publicerad demonstration — 24 oktober 2026

West Bet (`west-bet`) och rummet PAOW Blackjack (`room-a8ffcb55-46c5-9424-9c1c-39d614383bf3`) är publicerade genom Admins ordinarie rumsflöde. Egen sammansättning: `west-bet-paow-blackjack-dd3977f5-c619-47c1-a877-085c3f21954c`, dealer `paow`, Lounge · varm och Blackjack · Oak. [Delbar lobby](https://www.scoutgaming.tech/lobby?operator=west-bet). Desktop-spelstart och Admins båda scenformat har granskats visuellt; grundloopen visas. Ingen insats eller spelrunda utfördes.

**Källor och lagring:** fryst `kevin-staging@c713875923cd854b26f89c1db0d0f47064619c1d`, manifest `kevin-paow-c7138759`. Alla 414 lokala källfiler verifierades mot storlek, SHA-256 och Git-blob. Ordinarie intag sparade 153 utvalda original: 56 posklipp, 23 viloklipp, 37 svenska och 37 engelska repliker. Återläst register: 153 egna UUID i privat Blob, tillgängliga, 152 130 447 bytes, exakt hashmultimängd och noll storleksavvikelser. Gammal `paow-kevin` ligger kvar återställbar i papperskorgen; dess identiteter och bytes har inte tagits över.

**Verifieringsgräns:** endast egen `andas.mp4` är bunden som grundloop. Givfilmer och inspelade repliker är lagrade som alternativ, inte visuellt godkända eller aktiverade. PAOW saknar verifierad filmprofil: K04 har olika landningsvärden i 17/18 kortspår och ingen separat verifierad handsläppsbild. Exakt kortkontakt, övergångar och repliksynk får inte utläsas ur filnamn/hash. Serverägda kort fortsätter utan dessa filmer.

**Importbugg:** intagets förslag innehöll käll-, språk- och tagningsnotis, men klientmappningen kastade bort den och skrev tomma notes. Den avgränsade rättningen bevarar endast textnotisen och validerar den genom befintligt metadataförfarande; dealer/fack/roll byggs fortfarande från aktuell katalog och ingen talacceptans skapas. Två regressioner reproducerade felet före rättningen. Klippintaget kan nu kontrollera och uttryckligen återställa tomma källnotiser mot det frysta importmanifestet: exakt SHA + byteantal, entydigt namn vid källalias och samma klassificering krävs. N1-behörighet, bolagsgränser och ordinarie classify-skrivning med SHA + previous/CAS gäller; fyllda notiser, arkiverade klipp och inspelat tal hoppas över. 111/111 riktade prov och Admin-typkontroll passerar. Därefter rättades privat Blob-listningens faktiska unchecked-kontrakt: fem riktade prov passerar och oförändrad liveinventering ger 153/153 entydiga kandidater. Root har granskat produktdiffen. 85/85 pre-commit-prov och [full CI 40105646992](https://github.com/Jakeminator123/scoutgaming/actions/runs/40105646992) samt GitGuardian passerade på 2149a656. [PR #370](https://github.com/Jakeminator123/scoutgaming/pull/370) är mergad som 26e57eb2ffb6af20fdb4ba7d7ff21a035b33e939; Vercel dpl_b4KSvjZskuadhDZh2W2W65UwkG4T är READY på samma SHA. Den publicerade Admin-knappen återställde 153/153 notiser med 0 konflikter och 0 obekräftade skrivningar. Återläst register har exakt förväntade notiser och oförändrade UUID, SHA, storlekar och all övrig klassificering. Ny kandidatläsning ger 0 kvarvarande poster. Mediebytes, publicerade kopplingar och godkännanden ändrades inte.

**Avslutande ordning:** fyra egna, verifierat mergade lokala grenar är borttagna: operator-arbetsyta, ci-stream-fixture-cost, mobile-game-recovery och paow-import-source-notes (samtliga codex/*). Andras arbetsytor, huvudcheckoutens osparade ändringar, återställningsmaterial och gamla PAOW-källmedia är bevarade. Tillfälliga granskningstabbar stängs efter verifiering; West Bet-lobbyn lämnas till Jakob. PR #352 är fortsatt utkast; Kevin-ägda #315/#323/#333 är inte mergade inom Jakobs generella mandat.

**Säkerhetsstatus 24 oktober:** källbindning till main 26e57eb2 verifierad; incidenttäckning komplett för källan, 0 öppna och 23 ignorerade. Monitorering aktiv. Historisk skanning är ofullständig (too_large) och platsmetadata partiell; ingen full historisk täckning påstås.

## Mobil spelstart: återhämtning och driftkontroll — 24 oktober 2026

Två verifierade kodluckor rättas: videoladdningen kräver inte längre `AbortSignal.any`, och blockerad initial ljudlös uppspelning får **Starta videon** utanför den dolda scenen. Knappen startar samma hashverifierade video direkt i användargest, med kvarvarande cacheägarskap. Avbrott och absolut tidsgräns frigör video och knapp. En misslyckad start visar **Ladda om**; endast rätt dealers faktiskt presenterade bild öppnar scenen. Tidsgränser, hashkontroll och serverägda spelregler är oförändrade.

**Verifiering:** underagentens fyra nya felande regressioner reproducerades före fix. Efteråt passerar **187/187** riktade beteendeprov och **21/21** kompletterande distributions-/signalprov. Frontendens faktiska GET/HEAD följer spelklienternas importkedjor till den nya signalhjälparen med 200 och utan backendanrop. Fulltestregistret har 567 kandidater, 0 föräldralösa. Root har granskat produktdiff och regressioner. 364/364 commitkontroller samt [full CI 40102726871](https://github.com/Jakeminator123/scoutgaming/actions/runs/40102726871) och GitGuardian passerade på bd16c9dc; PR #369 är mergad som ebf1f0b33340951d52a8ed87dcfd12d60da8af78.

**Aktuell diagnos:** iPhone/Safari-anrop 24 oktober 14:19 UTC nådde session, spelare, bord, Dragan-konfiguration och media med 200/206. Det bevisar inte visad bild eller lyckad ny inloggning. Den observerade Safari-versionen har `AbortSignal.any`, så kompatibilitetsfixen är inte belagd rotorsak för Jakobs telefon. Inloggad desktop öppnade rätt rum; verklig iPhone med tangentbord och synlig första bild återstår.

**Drift:** Vercel dpl_9Rv4wc7vMMMvos8ftdTqb93xZdzB är READY och Render dep-dbec60brjlhs73f7ipl0 är live på samma main ebf1f0b3. Aktiv server är `croupier-v3` (`srv-dbd6nfon74is73aiblf0`), med manuell deploy och `ops/cloud/Dockerfile.game`. Exakt SHA återlästes från versionendpointen, hälsa och den nya signalmodulen gav 200. Dragan och PAOW visar video i inloggad webview. Anonyma publikkataloger och rumsdata ger 200; spelstart omdirigerar till spelarlogin med bevarat bolag/rum. Privata Admin-katalogens 401 är korrekt. Webviews viewportbyte ändrade inte faktisk skrivbordsstorlek och räknas därför inte som mobilacceptans. Verklig iPhone/Safari-inloggning återstår. Gamla croupier-v2 är fortsatt suspenderad.
## CI: snabbare strömfixtur och tidigare kontroll av fixturberoenden — 24 oktober 2026

Normalfallet i `test/activate-native-ai-qa.mjs` returnerade alltid `IN_PROGRESS` även efter att dess syntetiska worker stoppats. Avslutningen väntade därför hela fönstret för naturligt stopp innan cancellation. Fixturen övergår nu till `COMPLETED` först vid stopp av rätt worker och verifierar samma jobbs statusendpoint, GET, ett enda stopp, terminalstatus, frigiven session och oförändrad reservation. Separata prov i `test/speech-journal-runtime.mjs` behåller fallback-cancellation och kravet att invänta terminalstatus/dränering. Produktionskod och tidsgränser är oförändrade.

**Verifiering:** Node 24.21.0, högst fyra testarbetare; båda testfilerna **116/116 godkända**. Det berörda provet tog lokalt **15 227,6 ms före → 87,7 ms efter** (99,4 % kortare tid för detta prov). Tidigare CI mätte 15 057 ms före rättningen. Hela CI-körningens tids- eller dollarbesparing är inte mätt. Oberoende statisk granskning: inga blockerande fynd. [Full CI på bdb3727d](https://github.com/Jakeminator123/scoutgaming/actions/runs/40101501392) och GitGuardian passerade; PR #368 är mergad som `63297845`.

**Tidigare felupptäckt:** pre-commit följer statiska relativa ESM-importer från toppnivåprov genom `test/fixtures/` och väljer berörda konsumentprov även för ändrade eller borttagna hjälpfiler. Produktionsmoduler är slutpunkter och läses inte; cykler och symlänkar/junctions hanteras avgränsat. Därmed väljs mikrofonintegrationen vid ändrad mikrofonfixtur eller kamerakontroll. Full CI och högst fyra testarbetare är oförändrade. Två selektionsregressioner var röda före ändringen; **17/17** selektionsprov passerar efteråt. Efter integrationskontrollen begränsades följningen till fixturkedjor; direktimporterad produktkod utökar inte detta urval. Importörens befintliga prov kräver fortsatt sina båda obligatoriska tester men tillåter ytterligare fixturkonsumenter. **32/32** selektions- och importörsprov passerar. Beräknade dynamiska importer och `require` omfattas inte av denna begränsade importföljning.

## Spelvy: kortvisning och samlad chatt — 24 oktober 2026

**Leverans:** `codex/spelvy-kort-chatt` bygger vidare på PR #361, head `904d3f01`. Hela #361 ingår i historiken och ska landa tillsammans med profilrättningen här, så main inte får mellanläget med 63 px i Admin men 78 px för Dragan i spelaren. Spelarens kortvisningsbubbla och webbläsarval tas bort. **Studio → Scen & lager → Kort och marker → Kortvisning** sparar På bordet/Upplyfta separat för bordets mobil- och desktopformat. Utan eget val gäller På bordet. Manuella kort-/markerplaceringar bevaras; autoskalan från #361 gäller där den valts och för nya placeringar.

**Rotorsaker rättade:** den gamla spelkalibreringen kunde återläsa webbläsarsparade CSS-värden och separata per-platsregler. Panel, lokala läsare och dess CSS är borttagna; `/calibration` nekar alltid skrivning. `?cal=1` och C öppnar inte längre en konkurrerande editor. Kortvisningen styrdes också lokalt per webbläsare; Admins scenförhandsvisning saknade Dragans filmprofil (78 px rekvisitakort jämfört med standardens 63 px); chatten ändrade öppet läge vid svar, formatbyte och efter en timer. Editor och spel använder nu samma profil och kortdjup. Text, mikrofon och kamera samlas i chatten, med mobil bottenpanel, tydliga knappar och omedelbar stoppknapp för aktiv inspelning. Inkommande svar markerar oläst men ändrar inte användarens öppet/stängt-val.

**Verifiering:** klientbygge inklusive Admin/lobby-typer; Studio 2 118 godkända/17 överhoppade; Admin 351/1; presentation 791/4; tal 624/0; spelregler 484/0. Efter separat skrivskyddad granskning rättades tillgängliga knappnamn och 78 berörda prov passerade; tillgänglighetsprovet kördes också separat. Testregistret: 0 föräldralösa av 562 kandidater. Isolerat CSS-prov med syntetisk chatt vid 900×700 och 390×844 verifierade öppna/stängda ytor. Egna provservern och provfliken är stängda. Lokal npm-packning utelämnade en hårdlänkad transportfil; den installerade testkopian återställdes från exakt hashkontrollerad repokälla. Ingen produktionsdata ändrades.

**Slutlig integration:** synken med rättad #361 gav 66 godkända riktade prov. Efter avvecklad lokal kalibrering passerade 71 berörda beteende- och säkerhetsprov, inklusive nekad skrivning i vanlig lokal körning, samt klientbygget. Separat granskning gav inga blockerande fynd. Strikt raderingsgrind godkänd för två filer utan kvarvarande anropare; testregistret har fortfarande 0 föräldralösa av 562 kandidater. Fullsvitssiffrorna ovan avser revisionen före denna sista avveckling.

**Mergegranskning 24 oktober:** delade rum tvingade fortfarande Upplyfta när kompositionen saknade eget kortvisningsval, trots standarden På bordet i Admin och den övriga spelklienten. Både projicerad film/bordsgeometri och reservlayout följer nu samma standard; ett uttryckligt sparat Upplyfta bevaras. Sex felande standardfall reproducerades före rättningen. Efter rättning passerar de nya beteendeproven för alla tio kombinationer av mobil/desktop och layout/sparat val samt samtliga riktade prov i elva testfiler för kort, geometri, delade rum, chatt/kamera och publiceringskapabilitet. Körningen använder Node 24.21.0 och högst fyra testarbetare. De tidigare fullsvitssiffrorna ovan är inte omkörda på denna revision.

**Integration 24 oktober:** separat granskning av #361 och återstående #367-diff gav inga blockerande fynd för kombinationen. #366 och #347 är mergade efter grön full CI. Main `029aebc7` är integrerad; enda tidigare konflikten var två handoffavsnitt, som båda bevarats. **60/60** riktade prov för rumskontext, livscykel, klippintag och kortvisning samt **227/227** commitkontroller passerar. Slutlig [full CI på d80dcd5a](https://github.com/Jakeminator123/scoutgaming/actions/runs/40100342536) och GitGuardian passerade. #367 och dess ingående #361 är mergade som `5e664d45` den 24 oktober.

**CI-rättning 24 oktober:** [första fulla integrationskörningen](https://github.com/Jakeminator123/scoutgaming/actions/runs/40099569933) hittade tre mikrofonprov som fortfarande sökte knappens gamla tillgängliga namn. Testfixturen väljer nu den verkliga knappen Mikrofon; samtyckesdialogen, originalspråk genom STT/Director/PCM och avbruten identitet är oförändrade. Alla tre fel reproducerades lokalt före rättning; efteråt passerar **48/48** integrationer och kamerakontroller. Övriga CI-grupper passerade. Den nya fulla körningen på d80dcd5a passerade; ingen produktkod ändras av denna fixturrättning.

**Driftsatt 24 oktober:** frivilligt layoutfält `cardView` kräver spelserverns kapabilitet 26; gamla servrar blockeras före skrivning, även utkastssparning av det nya valet. Ingen databasmigrering. Aktiv Render croupier-v3 är nu byggd från integrerad main ebf1f0b3. Actions-budgeten är upplåst. Full CI och merge är klara för kombinationen med #366/#347. Verklig mobil med skärmtangentbord och produktionsacceptans med publicerade medier återstår; lokalt godkänt är inte produktionsacceptans.

## Granskningsrättningar för PR #361 — 23 oktober 2026

Tre verifierade fel är rättade: automatiska mobilmarker får separata tryckytor utan ändrade filmkontakter/boxidentiteter; grundklippets inramning når både scenbild och placeringslager; gruppåterställning återställer respektive automatiks val och justeringar. Manuella punkter, explicit markerförskjutning och andra format/grupper bevaras. Admin visar kvarstående platskonflikter.

Verifiering: 63 riktade beteendeprov, inklusive bråkdelsoffset vid 320 px, presentationssviten och klientbygge med Admin/lobby-typer godkända. PR #367 kompletterar med gemensam Draganprofil, sparad kortvisning och chatt. Ingen produktionsdata ändrad. #361 integrerades atomiskt genom #367 efter full CI som `5e664d45`; separat produktionsacceptans återstår.

## PR #347: klippintag och raderingsdialog — granskning 24 oktober 2026

Klippkartan får fil-/mappsläpp, dragbara placeringsförslag och uttryckligt godkännande före uppladdning. Gemensamma dialoger används för befintliga arkiverings- och permanenta raderingskontrakt. Inga writers, scheman eller behörigheter ändras; publicerade beroenden prövas fortfarande på servern.

Konflikterna med main är lösta med nuvarande Admin-navigation kvar, utan återinförd OpenClaw-sida. Frysta importkällor, exakta pose-/språk-/tagningsförslag och nuvarande dealerregistrering bevaras. PR #366 är mergad som `08f47853` efter grön full CI; main inklusive dess beteendeprovsrättning är integrerad för att behålla den granskade operatörsytan.

**Bugggranskning 24 oktober:** den tidigare kontrollen täckte dealer-dialogen och kartans mappsläpp men missade motsvarande klippdialog och intagspanel. Fyra ytterligare fel är nu rättade: en återöppnad klippdialog accepterar bara sitt eget kontrollsvar; en senare spärr från föräldern blockerar även en tidigare fångad bekräftelse; panelens mappinläsning avbryts vid kontextbyte, stängning och avmontering; katalogsidor läses i begränsade omgångar i stället för att hela mappen läses före filgränsen. Serverns beroende-, behörighets- och revisionskontroller är kvar. Köade filer skyddas fortfarande under uppladdning.

**Verifiering av rättningen:** Node 24.21.0, högst fyra testarbetare. Nya regressioner reproducerade felen före rättningen. Därefter **76/76** riktade prov för klippintag, dialoger, dealerimport och livscykel; både avvisade och godkända åtgärder samt dubbelbekräftelse täcks. Admin-typer passerar med klientens pinnade TypeScript 5.7.3. Föräldralösa tester: **0/566**. Ett första typkommando använde fel pakets TypeScript 7 och avvisade befintligt baseUrl; rätt klientkompilator användes utan konfigurations- eller beroendeändring. Tidigare full Studio **2 116/17**, full Admin **373/1** och klientbygge gäller föregående head, inte denna rättning. Ingen produktionsacceptans påstås.

**Mergegrind:** Actions-budgeten är upplåst och [slutlig full CI för #366](https://github.com/Jakeminator123/scoutgaming/actions/runs/40098197509) är grön på `c6d22790`. Den versionen är nu på main och integrerad här. [#347:s fulla CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/40098912491) är grön på `e5165b3e` och PR:en är mergad som `029aebc7`. Inga skydd har kringgåtts.

**GitGuardian:** källbindning till remote main cbc0acd3 verifierad; incidentrapporten anger 0 öppna och 23 ignorerade. Historisk skanning och platsmetadata är ofullständiga, och kontrollernas status kunde inte bekräftas av denna säkerhetsläsning. Ingen fullständig historisk säkerhetstäckning påstås.

## Mergegranskning — testadapter i PR #364 — 23 oktober 2026

`studio-context.test.mjs` kompilerade endast `RegisteredStudio` och försökte därefter läsa den nya TSX-komponenten `OperatorGameBoard` som vanlig Node-modul. Adaptern kompilerar nu även spelkortskomponenten. Befintliga beteendeprov använder dess rum-/bolagsval och öppnar skapandeformuläret uttryckligen. Proven för ägarisolering, osparade ändringar, pågående skrivningar, publiceringsrevision och kvitto är kvar; inga tester är borttagna.

Verifiering: syntaxkontroll och **24/24 tester** i `apps/studio/client/admin/lib/studio-context.test.mjs` godkända lokalt med Node 24.19 och högst fyra testarbetare. Ingen produktkod är ändrad av denna rättning. Full CI krävs på den nya headen före merge; ingen produktionsacceptans påstås.

## Operatörsytan: sammanhållen redigering — 23 oktober 2026

**Leverans:** `codex/operator-arbetsyta`, från main `cbc0acd3` efter mergade #359 och #364. Produktionsgranskningen på /admin/rooms visade att ett enda spelkort fyllde bredden med en tom affisch och sköt redigeraren långt ned. Korten har nu kompakt storlek. På bredare arbetsytor ligger scen och materialval sida vid sida; på mindre ytor staplas de. Neutralare ytor ersätter stora gröna paneler.

**Förenkling:** en rad för sparstatus, Spara utkast och Granska publicering. Granskningspanelen visas först efter begärd granskning. Versionsnummer finns i historiken; färg/standardval är hopfällda. Den dubbla Publicering-knappen i rumsrubriken är borta. Studio-mallar tilldelas under Spelmallar för bolaget. Befintliga adresser och bokmärken är oförändrade.

**Rättelse efter #364:** pausa/öppna och ta bort skickas som en enda typad begäran med både åtgärd och roomId. En ny avsikt kan inte kombinera föregående korts id med en annan åtgärd. Beteendeprovet verifierar endpoint, bolag, rum och revisionsvillkor efter sådana klick. Behörighet, roomOverrides, CAS och save-draft/review/publish är oförändrade.

**Verifiering:** Node 24.21.0; full Studio **2 111 godkända / 17 överhoppade**, full Admin **351 godkända / 1 överhoppat**, klientbygge inklusive Admin-/lobbytyper godkänt. Efter slutjusteringarna passerar 14/14 förhandsvisningsprov och 18/18 livscykelprov. Föräldralösa tester **0/562**. Bygget har befintliga CSS-composes-varningar i andra komponenter. Isolerat webbläsarprov med syntetiska data verifierar separata lager, bakgrundsbyte utan dealer-/bordsbyte, spara/omladdning, granskning av rätt rum, publicering, bolagsbyte och byte mellan pausa- och borttagningsbekräftelse. Detta är klient-/fixturbevis, inte produktionsskrivning eller ny mediaacceptans.

**Bugggranskning 23 oktober:** inga blockerande fynd i sparning, bolags-/rumskontroll eller publicering. Kompakt förhandsvisningsknapp fick ett tillgängligt namn som innehåller den synliga texten Uppdatera/Refresh, så talstyrning fungerar på båda språken. Befintliga förhandsvisningsprov verifierar att dess beteende är kvar.

**CI:** #364 är mergad som `8a3551c8`; [slutlig CI på f201d52c är grön](https://github.com/Jakeminator123/scoutgaming/actions/runs/39877455580). Det senare [CI-jobbet på main cbc0acd3](https://github.com/Jakeminator123/scoutgaming/actions/runs/39879449512/job/120175758677) startade inte: GitHubs annotation anger misslyckad kontobetalning eller för låg utgiftsgräns. Nya PR:ens kontroller bedöms separat. Inga workflow- eller betalningsändringar ingår.

**Mergegranskning 24 oktober:** GitHub Actions kunde åter starta efter Jakobs godkända budgethöjning. [CI på b84f7fda, försök 3](https://github.com/Jakeminator123/scoutgaming/actions/runs/39984045589/attempts/3) hittade två föråldrade text-/versionslås i `studio-context.test.mjs`; övriga regressionsgrupper passerade. Testerna verifierar nu de faktiska publiceringsvalen och publicerat material för rätt rum, inklusive fördröjd status från ett annat rum och tömd status. Produktkod, behörighetsprov, publiceringsrevisioner och kvittokontroller är oförändrade. Riktade prover: **24/24 godkända** med Node 24.21.0 och högst fyra testarbetare. Full CI krävs på rättningens head före merge och redovisas i PR #366.

**GitGuardian vid start:** källbindning verifierad, monitorering aktiv. Incidenttäckning komplett för källan: 0 öppna / 23 ignorerade. Historisk skanning ofullständig (`too_large`), platsmetadata delvis saknad. Full historisk säkerhetstäckning påstås inte.

## Visuell operatörsyta — PR #364, mergad 23 oktober 2026

#359 och #364 ligger på main. #364 tillförde bolagsval, spelkort, skapa/ta bort/återställ och tre separata lagerval. [Slutlig full CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/39877455580) är grön på `f201d52c`. Paus/öppning finns för valt spel.

Bakgrundsbyte bevarar dealer, bord, andra rum och bolagsstandard. Befintliga roomOverrides, behörigheter och revisionsvillkor används. Inbakad bakgrund är låst; nya rum kräver en kompatibel sparad spelmall. Paketets materialurval utökas inte automatiskt.

J08:s fulla runtime-/materialbindning, produktionsacceptans med godkända medier och separat permanent radering kvarstår i sina egna arbeten. Ingen aktivitet i status.json markeras klar av dessa UI-leveranser.

## Mergegranskning — assistentens bolagslänkar i PR #359 — 23 oktober 2026

Serverns `companies` och `audit` pekar på `/admin/companies`, men widgetens tillåtlista saknade adressen. Länkarna doldes därför. `apps/studio/public/assistant-widget.js` tillåter nu denna exakta sökväg; samma-origin-kontroll, fragmentspärr och äldre tillåtna adresser är kvar.

Verifierat lokalt med Node 24.19 (paketet kräver 24.x): syntaxkontroll och 7/7 körda navigationsfall ur widgetens faktiska kodblock. Bolagslänk med/utan query samt befintliga klipp-/operatörslänkar visas; extern origin, fragment och okänd sökväg nekas. Ingen full lokal regression eller webbläsaracceptans har körts. Ny CI måste vara grön på ändringens head före merge. GitGuardian-kontrollen på föregående PR-head var grön; incidentlista, källbindning, övervakning och historik är inte verifierade här.

## Admin / Studio — PR #359 — 23 oktober 2026

**Leverans för Claudes granskning:** branch codex/admin-en-ingang, worktree scout-wt/admin-en-ingang. Senaste main 8e34d4a382e7539fe3c7c42ca7f54d9df91f72b1 är integrerad, inklusive #349, #345 och #350. Sista synken gick utan konflikter; båda tidigare leveransavsnitten är bevarade. #354 inklusive Docker-skyddet ingår i basen. #358 är nu mergad och integrerad från main; denna PR gör inga egna ändringar i dess skyddade filer.

**Ändrat:** CSS för dialogpanelen följer nu komponenten och Admin-bygget inkluderar klassanvändningen i återanvända Studio-komponenter. Sidomeny och hjälp delar menykarta. Studio och Administration är tydliga grupper; brödsmulor, små pilrader och extra verktygs-/importflikar är borttagna. Klippkartan samlar vald dealers klipp, tal, inställningar och sceneditor. LabStudio, gamla video-/sceneditorerna samt separata Probe och Provspelning & logg är pensionerade. Materialskapandet har en fokuserad sida med egna utkastspärrar. Äldre dokument och inloggningsreturer går till rätt arbetsyta. De gamla läs-API-namnen behålls för redan laddade klienter; datamodell och skrivkontrakt är oförändrade.

**Verifiering:** hela [CI-körningen på ecf2c8fe](https://github.com/Jakeminator123/scoutgaming/actions/runs/39869956525) är grön: Studio 2 100 godkända/17 överhoppade, Admin 351 godkända/1 överhoppat, frontendtyper, produktionsbygge, åtkomst, spelregler och isolerad lagring/återstart. Sex rena URL-/menylås är borttagna; 49 kvarvarande riktade prov för behörighet, kontext och utkast passerar. Sista main-synkens commitkontroller och aktuella CI-resultat redovisas i PR #359. Föräldralösa tester: 0 av 558 kandidater. Separat UI-prov av byggd klient verifierade den samlade talvyn, dialoglayouten, flikbyten och skapande/val av scen i minnesutkast, med syntetiska data och nekade serverskrivningar. Strikt raderingsgrind: 42 borttagna filer, 0 kvarvarande importer och 0 registerreferenser. Enda textreferensen är den historiska ADMIN-KARTA. Testserver och provflik är stängda.

**Kvar:** den visuella operatörsytan enligt bolag → spel → kompatibla dealers/bord och gemensamma bakgrunder; fullständig produktionsacceptans efter integration; separat avgränsning av permanent radering/frikoppling av aktiva beroenden. Varken databas, media, drifttjänster, rumssidan eller produktion är ändrade. Specialiserad regelredigering och talgranskning finns kvar. Ingen planaktivitet är markerad klar.

**Säkerhet:** befintlig skyddad GitGuardian-koppling kunde inte läsa incidenter/platsmetadata. Källbindning och monitorering är inte verifierade i denna kontroll; ingen full historisk täckning påstås. GitGuardians commitkontroll för den fullverifierade committen ecf2c8fe är godkänd; det ersätter inte incidentsynlighet. Slutlig CI-status för PR:ns aktuella head redovisas i GitHub.

Karta, rotorsak, bokmärken och kvarvarande målbild: [ADMIN-KARTA avsnitt 6–7](../migrering/jakob-main-migrering/ADMIN-KARTA-2026-10-22.md#6-pr-359--rättad-css-och-samlad-navigation--23-oktober-2026).

## Spelklientens legacy (storstädning, arbetare B) — 22 oktober 2026

**Gren:** `codex/spelklient-legacy` (bas main `7afae426`), PR #356. Underlag: `migrering/jakob-main-migrering/STORSTADNING-UNDERLAG-2026-10-22.md`.
Varje kandidat fick en konsumentkarta med `git grep` (route, UI, tjänst, adapter,
data, build, test, doc) innan radering; `node tools/raderingsgrind.mjs main --strict`
ger IMPORT 0 / REGISTRY 0 och `node tools/check-orphan-tests.mjs` 0 orphans.

**Raderat (med exklusiva tester, verktyg, flaggor, CSS, README-rader):**
`public/lab/`, `public/bo/emails/`, `public/bo/generations.json`
(`test/generation-media.mjs` använder syntetiska katalogposter);
`public/docs/partner-api.html` + `build-docs.py` + `test/partner-docs.mjs`
(`partner-api.md` flyttad till `docs/games/partner-api.md`); `/roulette-test`
(`games/roulette/preview.mjs`, `public/roulette-test/`, servergrenen,
`test/roulette-preview.mjs`, `tools/roulette-ui-fixture.mjs`,
`tools/roulette-scene-fixture.mjs`); Lissabon-gästprofiler (`lissabon-profiles.mjs`, `public/lissabon-profile.mjs`,
`CROUPIER_LISSABON_PROFILES`, `test/lissabon-profiles.mjs`); de oanvända
Astrid-modulerna `astrid-green-dealer/speak`, `astrid-speech-join`,
`astrid-folded-rest`, `astrid-idle-scheduler` med fyra opt-in-prov i
`tools/media` samt `rigged-review.css` (ingen kod sätter `html.rigged-review`).

**Behållet med bevis:** `card-presentation/` (app.mjs → `renderer-support.js`,
`local-card-overlay.mjs`), `vendor/three/`, `shared-room-*`,
`layered-presentation.mjs`, `performance-player.mjs`, `local-presentation.mjs`,
`dealer-version-switcher.mjs` (app.mjs + fyra tester), `calibrate.mjs`
(lazy import i app.mjs, serverns APPLY-route), `bo/speech-qa.*` och `/bo`-redirects (J05).
**Kamera och röst behålls som produktfunktion** (Jakobs beslut 22 oktober):
`public/astrid-camera-*.mjs`, `astrid-wake-word.mjs`, `astrid-voice-*.css`,
`astrid-transcription.mjs`, `/api/{astrid,dealer}/{observation,transcription}`,
`CROUPIER_ASTRID_CAMERA`/`CROUPIER_ASTRID_TRANSLATION_KEY` och testgruppen
`speech/astrid-camera`. En första radering på grenen återställdes med revert.
Kameran är fortfarande Astrid-märkt och flaggstyrd; att göra den dealer-generisk
och styrbar från Admin är ett separat, ej påbörjat arbete.

**Verifiering:** `node --test` grönt för de berörda sviterna i gameplay/speech
samt `table-http`, `game-entry-*`, `shared-room-app`, `local-presentation`,
`layered-presentation`, `product-chat-http`, `apps/web/test/player-ui-build`;
pre-commit-hooken kördes på varje commit; `check-environment-variables` grön.
Lokal Studio-start kräver junction till arkivets `apps/studio/node_modules`.

**Kvar för andra ägare (inte redigerat här):** `ops/cloud/config.mjs` rader
101 och 378 (`CROUPIER_LISSABON_PROFILES`), `ops/cloud/vercel-ingress.mjs:63`
(`/roulette-test`); `packages/navigation/server/platform-routing.mjs` rad 44
(`ROULETTE_PREVIEW`) och 62 (`ROULETTE_PREVIEW.has`) — rad 68–69
(`/api/dealer/observation`, `/api/dealer/transcription`) och kameraflaggorna i
ops/cloud ska **stå kvar**; `services/openclaw/lab/deploy/local-connection.mjs`
(`CROUPIER_LISSABON_PROFILES`); `docs/environment-variables.json`
(`CROUPIER_LISSABON_PROFILES` kvarstår tills ops/cloud slutar läsa den); `apps/studio/README.md:361` länkar
`bettalotto.se/docs/partner-api.html` som inte längre serveras;
`apps/studio/docs/README.md:450` nämner `/roulette-test`.

## J05/J07/J08 — aktuell leverans — 22 oktober 2026

**Mål/status:** huvudprioriteten är begripligt Admin för Blackjack: Jakobs
befintliga klippkarta, tre separat valbara kompatibla lager och sparade val som
når rätt operatör/rum och spelets presentation. Produktmodellen finns enbart i
TERMINOLOGI. Kevin/Emils videor och övergångar anpassas till main; tvålagersmodellen
ska inte införas. Bevara fungerande transport, ingen total omskrivning.
[Masterplanen](../migrering/MASTERPLAN.md) och status.json är kanoniska:
9/20 hela aktiviteter VERIFIED (45%),55% kvar; ingen tids-/kod-/driftsprocent.
Förenkling J05/J06/J09/J10 är inte färdig. Nya flerspelarutökningar och QA-seeds
är pausade som aktiv prioritet. RunPod/lipsync ligger sist manuellt med Jakob/Kevin.
Driftflaggan är fortsatt AV; inga nya godkännanden eller produktionsåtgärder.

**Integration:** draft PR336, codex/shared-room-transport, arbetskopia
C:/Users/jakem/.codex/worktrees/shared-room-transport/croupier. Senast levererad
head83f5810d33c483868ac0ce2bab728efb813d51b4 har verifierad grönCI39753242313,
mainbas47756bdf1df372c7aa5047dc165a2d721614c4a2. Server/klient/command/select,
manifestbunden readonlyfixture och konstruktorbundna testportar är levererade.
Produktionsdefaults, behörigheter och deployspärr består. Gröna tester bevisar
inte färdig Admin-UX, full medieacceptans eller slutförd förenkling.

Separata mergeagenten har levererat PR334/head24e9f0264bc244e2ddabdac0cc12b1537ab164bd:
mainintegration39a348b4 och rumsreturrättning. Agentrapporterad CI39757805089
success attempt1, normalhook43/43 respektive40/40 och oberoende slutreview.
Root reproducerade rumsfelet2/2 och verifierade rättningen68/68,0skip; exact-byte
review utan blockerare. Val av rum B bär table till Klippkarta och tappar gammal
composition/lane/game, utan återställt formulärutkast. Rootpatchen togs bort ur
transport först sedan samma bytes säkrats i J08. Den rättade334-versionen ska
integreras kontrollerat före nästa beroende slutattest. Root mergar inga PR:ar.

**Oförändrade skydd och rättningar i63c:** samma-PG G → S → sorterade R/P/A,
låst session/credential/epoch/proveniens före receipt/replay, säker svarsläsning
före COMMIT. Strikt14-operationers POST och readonly WS; snapshot före presentation,
samma commandId/bytes vid osäkert nätutfall. Två låsta selectfångster runt olåst
mediaarbete omkontrollerar session/version/material; inga nativejournalwrites.
Exakt dealer/språk/hash och talgodkännande gäller. Global walletavisering till
samma aktörs andra rum sker först efter yttersta COMMIT, även tick utan outbox.
Observerfel ändrar inte durable resultat/health. Fryst total presentationsbudget
och separat stallstopp stöder långa tal/övergångar, färskt zero-window placebets,
korrekt kortcursor, abort och reconnect. Ingen legacy/shared-writerblandning.

**Ny lokal QA-port:** tools/run-shared-room-k04-qa.mjs startar verklig server via
en separat sanitiserad barnprocess och engångscapability. Ingen miljöflagga eller
HTTP-route kan avaktivera ordinarie TLS/Neon-vakter. Före fixtureimport verifieras
literal127.0.0.1, faktisk PG-address/port/DB/roll/system-ID och syntetisk testscope;
prod-/provider-/molnkontext nekas. Produkt-/Studio-readiness och saved-policy
kontrolleras, sedan färsk identitet före capabilitykonsumtion. Serverns listener,
origin, storage/policy och privata media bindas till dessa explicita testportar.
Inga migrations-/seed-/mediaimportskrivningar i launchern. Befintlig graceful
shutdown används. Körkommando/fixturekontrakt står i ENVIRONMENT-RESTORATION.
Detta är en isolerad verifieringsväg; inget parallellt produktregister.

**Verifierad transportbas83f:** normalhook106/106,0skip,Node24.21,max4;
shared/frozen-presentation35/35; Studio tsc --noEmit grön;573 kandidater/0orphan.
Oberoende slutreview utan blockerare. Fixture11/11 använder syntetiska bytes och
instrumenterad SQLpool; mediesvit7/7 innehåller två nya verkliga loopbackfall.
Ingen ny full PG/server/K04-mediaacceptans eller visuell Adminacceptans.
Oförändrade63c-bevis PG46/46 och Chrome1440/390 med syntetiska media återanvänds.
c39:s capability/identityprov5/5 är verklig PG16.15 men instrumenterad policy/media.
Tidigare appearance-fixturfel rättades i4b0 med grönCI39745790572; produktcallbacken
hade redan rätt bindning. Taskservrar, kluster, pooler och browser är stoppade.

**Slutcheckpointens förenkling:** STÄD levererade ett avgränsat sjufilsdelta: fyra gamla
apps/web/lib-wrappers utan produktkonsumenter bort, tre tester använder aktiva
shared-moduler direkt. 65pass/0fail/1valfrittbrowserskip av66 enligt STÄD;
oberoende exakt review utan blockerare. Auth/rum/redirect-negativprov består.
Detta är ett J06-delsteg; full J06 är inte klar. Slutcheckpointens normalhook,
fulla commit och push/CI-status dokumenteras i PR336 och det privata stoppkvittot.
Inga raderingar av aktiva appar, register, authadaptrar eller mediehistorik.

Den kort påbörjade nya seedfunktionen är pausad, privat hashbevarad som
partial/unreviewed i seed-paused. Root tog bara bort dess två egna otrackade
arbetsfiler efter verifierad backup. PrepareCLI skrevs inte. Ingen PG-/medie-
acceptans eller produktleverans av detta arbete. Återuppta inte automatiskt.

**Schemaförslaget:** tools/prepare-shared-schema.mjs är offline utan driver/apply,
för exakt008→009→010 i en transaktion med identitet/ägare/product-v1-ledger,
fresh-only/balans/ägargrindar, begränsade lås och slutkontroller. Ägarens ACL-kontroll
är inte bevis på driftens credential/roll. Ingen produkt-DML/
nyledger. Privat schema-preparation/game008-010-review.sql SHA256
585db737e9732cf0d5ab8fcefa8b24e8b0615bceaf51825ce75669088f098e34.
Nu faktiskt provat10/10 även på PostgreSQL18.6 (Node22.22), oförändrad63c-kod.
Samtliga11källkopior/27artifacthashar oberoende verifierade; clusterStopped:true,
port35437 ECONNREFUSED, ägda binärer/temp borttagna. Testets minimum-major16
behölls; faktisk motor18.6. Separat syntetisk dump/restore är nu klar8/8 på
PG18.6/Node22.22: 47 tabeller/fyra sekvenser, data/ledger/reservation/receipt,
ägare/ACL och replay efter ny anslutning utan dubbel effekt. Elva readonly
preflightfrågor körda före008 och efterrestore. Första försökets rena NUMERIC-
textassert rättades smalt efter review; slutprovet grönt. Privat
recovery-shared-restore/manifest.json + probe.log; PID608/port36911 stängda,
kluster/binärer/temp borttagna. Roller förskapades; ingen Neon/PITR/prodrestore.
Detta stänger det syntetiska återställningsprovet, inte liveACL/operativ restore/DDL.
Faktisk runtimecredential är ännu obestyrkt: Render saknar env-read, browser use
är avstängd och SSH nekade befintliga nycklar efter verifierad Frankfurt-värdnyckel.
Granskningsplanen och rättad skillnad mellan DDL-ägare och driftroll finns i
ENVIRONMENT-RESTORATION; inga produktionsåtgärder har gjorts.
Tidigare PG46/46 och Chrome1440/3901/1 på63c består. Chrome använder isolerade
data/mediaersättningar;27moduler, cleanuptrue, inte K04-mediaacceptans.
Bevis privat under denna chatts visualizations/2026/10/22/
01a161cd-294a-7951-8190-5cf396ab8c13/{recovery-pg18-schema,recovery-qa-identity,
recovery-shared-room-qa-context,recovery-shared-room-k04-qa,qa-entry-focused.log}.
Körningar överlappar; inga nya hela aktivitetsbockar.

**Nästa rekommenderade synliga leverans (första steget levererat av Claude,
se avsnittet ”Admin: rummets lager” nedan):** gör befintliga
Admin-flödet för ETT Blackjackrum sammanhängande: Klippkarta → val av kompatibel
bakgrund/dealer/bord och mobil-/widescreenpreset → spara → återöppna samma rum
med samma val → ordinarie publiceringssteg/förhandsvisning. Visa tydligt vilket
rum som ändras och skillnaden mellan sparat utkast och publicerad version.
Utgå från befintliga komponenter och servicekontrakt; kartlägg endast luckorna
i detta flöde innan en liten ändring. Ingen ny trelagersbugg är belagd av den
avbrutna reviewn. Det kända rumsreturfelet är redan rättat i PR334/24e; återinför
inte rättningen dubbelt i336. Ingen ny QA-plattform eller omskrivning av spelet.

Kevin har ingen klientleveransskuld; refill eb6ab455 är redan granskad/inkluderad.
Ny läst6337164200 rapporterar81 lokala Draganfiler, isoleratPG16 med schema men
utan seed och två förberedda nonspeechprov. Detta är inte utförd acceptans.
Root tog först seedhindret i6337875026, men Jakobs senare direkta prioritering
ersätter det i6337998848: inga fler seed-/spelarprovsuppdrag nu. Kevin får lämna
befintliga övergångsfunktioner/klippsekvenser med exakt head och de beroenden till
tvålagersrenderern som måste anpassas till tre lager. Main är gemensam produktgrund.

Talunderlag6337159642 på9ab3701179d5edf46beee505752cd6080dad708e och RunPod-
underlag6337071717 på134c3b6997bb5d6d00a51451c2d46b49a84d2963 är bevarade för
sista manuella etappen. Inga godkännanden eller nya GPU/API-/benchmarkjobb.
Oberoende läsning visar att endpointbyte inte räcker och versions-/framekontrakt
behöver jämföras senare. Hashtest är ingen lipsyncacceptans. Inga approvalundantag.
PR333 saknar mergemandat. Svara endast på faktiska nya leveranser/beslut/blockerare,
inte på egna poster eller mottagningskvittenser.

**Merge/produktion:** separat chatt01a1624f-b0af-7202-bda5-9a3c06566976 äger alla
PR-merger. PR311 är mergad98174fd8 och PR337 är mergad47756bdf; root mergar inga
PR:ar. Mergeagenten verifierar PR337:s main-CI39750982149 completed/success,
identiskt träd med granskad a04. Inga nya deployer observerade. Eftermerge-CI
39740157570 attempt1 föll på rapporterad250ms timingflake; attempt2 startade
inga tester pga Billing/spending. Efter Jakobs budgethöjning rapporterar
merge-agenten attempt3 completed/success utan teständring. Den äger separat
Actions-kostnadsuppdrag och ensam plankopian/workflowändringar; root gör inga
överlappande CI-/hookoptimeringar. c39:s eget fixturefel är redan rättat i4b0.
334/336 har dessutom schema/liveACL/restore/
K04- och integrationsgrindar. Exakt-head grön obligatorisk CI och fräsch
owner/source/headkontroll gäller; inga bypass/force/queue/automerge/branchraderingar.
**Rättat deploybeslut 22 oktober (Jakob direkt):** main ska deployas till
produktion som förut; endast förhandsgrenar ska inte få deployments. Den
tidigare tolkningen ”ingen deploy alls” var ett missförstånd. `vercel.json` i
PR336 sätter `git.deploymentEnabled` till main=true och alla andra grenar
false; Render croupier-v2 får autoDeploy åter på för main genom Jakobs egen
CLI-körning (`render services update srv-datg3j6gekts73amgli0 --auto-deploy`),
eftersom agentsessionen inte får göra produktionsändringar.
Övriga spärrar kvarstår: ingen produktion-DDL, env-/flaggaktivering, GPU eller
betald drift utan separat beslut. Mediaimport av Kevins verifierade tagningar
är beslutad av Jakob och körs genom Admins ordinarie uppladdning.

Produktion wandering-hill-60561912/br-flat-fog-b161a6r8/croupier_game är PG18.6,
6players/0ogiltiga balanser; game008–010 saknas. Studio-readiness täcker inte dessa.
Verklig runtime-ACL och återställningsberedskap återstår före konkret DDL-beslut.
Senast lästa K05PR314/head9ab3701179d5edf46beee505752cd6080dad708e tillför
talgranskningsunderlag ovanpå tidigare metadata/validator; faktisk registry-/
Blobbindning och talgodkännande är fortsatt ofullständiga.
Bevara exakta media, Astridlegacy, MårtenPUBLIC_HIDDEN; ~~ingen Paowrestore~~
ersatt av Jakobs beslut 22 oktober 2026 (PR #342): Paow är återställd och visas
med Mårten som låst lobbyporträtt, se
[Lobbyns dealerporträtt](#lobbyns-dealerporträtt-tillbaka-i-steg-3--22-oktober-2026).
Ta inte bort Paow igen.
Senast fullständigt lästa GitGuardian-underlag på98174fd8:0open/23ignored,
sourceverified/monitoringactive, incidentcompleteforthissource,
locationspartial/historicaltoo_large. Denna körnings CLI saknar GitHub/protected
GitGuardian-åtkomst; connectorn bekräftar nya main47756bdf med queued
GitGuardian-suite utan checkrun. Aktuell incident-/platsläsning är därför ofullständig;
tidigare kvitto eller queued suite är inte full incidentfrihet. Mergeagentens nya
källbundna läsning på477 rapporterar0open/23ignored/monitoringactive, med fortsatt
locationspartial/historicaltoo_large; detta är tillskrivet bevis. Inga incidenter ändrade.

**Arbetskopior:** arkivering, inte merge, tog gamla kopior. De är återställda på
exakt gamla paths och Gitlåsta; app-attach ownerless nekas ännu. Ursprungschatt
01a15e6b-61f9-7843-aa06-3a47dee6a194 ska vara oarkiverad. Inga extra kopior/brancher.
Primarymain028a199b tillhör andra och förblir orörd. Godkända TOMMA Neonstaging
PG18/Frankfurt/fast0.25CU/300s är oskapad eftersom Vercelmanaged-parametrarna ännu
inte kan verifieras; fråga inte igen eller skapa okända defaults. Render förblir en instans.


**Stopp och överlämning till nästa agent — 22 oktober 2026:** Jakob begär en
ren checkpoint och överlämning till Claude i annan IDE på samma dator. Root
slutför bara detta elvafilsdelta (sju städfiler och fyra befintliga plan-/
handofffiler) med normalhook och normalpush. Inget nästa produktarbete startas.
Automationen synka-migreringen-med-kevin är PAUSED, target
01a161cd-294a-7951-8190-5cf396ab8c13; femminutersregeln är bevarad. Återstarta
inte automatiskt. Inga chattar eller arbetskopior arkiveras.

- **Mergat:** PR311 plan/regler/deployspärr och PR337 CI-kostnadsändring.
  GitHub-main är47756bdf1df372c7aa5047dc165a2d721614c4a2, nyss verifierad med grönCI.
- **Levererat men inte mergat:** PR334/24e (Admin/versionerad konfiguration
  och rumsretur) samt PR336/83f (delat spel, behörighet/sparning, klient-/
  mediekoppling och schemaförslag). Detta städ-/checkpointdelta är förberett;
  dess leverans fastställs först av slutkvittot efter normalcommit och normalpush.
  PR332:s arbete ingår i334; öppna inte ett parallellt integrationsspår för det.
- **Gjort i sista checkpointen:** fyra oanvända testwrappers bort, tre tester
  pekar på aktiva moduler; aktuell plan/status prioriterar Admin och tre lager.
  Den större avvecklingen och Admin-acceptansen är fortfarande ofärdiga.
- **Varför det återstår:** transport, SQL-lås, auth, sparning och återställning
  behövde integreras och granskas. QA-anslutningen tog ett separat delspår men
  full medieacceptans uppnåddes inte. Jakob prioriterar nu synligt Adminflöde;
  mer QA-seedarbete är parkerat och får inte användas som ny förhandsgrind för
  en oberoende UI-förbättring. Faktiska schema-/auth-/sparningskrav består.
- **Återstår i planen:** J05/J06 runtime-/testrensning, J08 Adminintegration,
  K04 presentation/övergångar, K05 exakta mediekopplingar; sedan J09/J10
  verifierad avveckling/återställning, K06/K07 integration/spelbeteende och
  O02/O03 oberoende slutgranskning/verifierad drift. STATUS.md anger fulla
  beroenden. 45% betyder nio helt verifierade aktiviteter, ingen tidsprognos.
- **Parkerat:** nya QA-seeds/spelarprov/flerspelarutökning; RunPod/lipsync
  sista manuella etappen med Jakob/Kevin. seed-paused innehåller partiellt,
  ogranskat underlag, inte en färdig leverans. PrepareCLI skrevs aldrig.
- **Blockerat före produktintegration/drift:** game008–010 saknas i rätt
  Neonproduktion; deployed runtime-ACL och operativ backup/restore saknar
  bevis. Offlineförslag och syntetiska prov är klara, produktions-DDL/deploy
  kräver separat beslut. Saknad talgranskning får aldrig ersättas med QA-undantag.

**Exakt övertagande:** använd samma befintliga
C:/Users/jakem/.codex/worktrees/shared-room-transport/croupier, branch
codex/shared-room-transport, origin git@github.com:Jakeminator123/scoutgaming.git.
Kontrollera git status/HEAD och agent-talk innan writes; läs AGENTS, denna första
sektion, ENVIRONMENT-RESTORATION och migrering/MASTERPLAN.md/status.json/STATUS.md.
Ingen ny clone/worktree/branch, checkout/reset/stash eller ändring i primarymain.
Slutligt fullHEAD och renhets-/CI-kvitto ska dokumenteras efter commit/push i
PR336 och privat stop-checkpoint/manifest.json under denna chatts befintliga
evidensrot. Ny CI är ännu inte verifierad;83f:s gröna CI gäller inte nya bytes.
Privata underlag får inte kopieras till Git; bara kanoniska guider gäller som plan.

STÄD (chatt01a16304-a4b9-7250-8c2f-0bec74573ac4) har släppt paketA och startar
inte paketB. Rootunderagenterna är färdiga; ingen ny trelagersreview pågår.
Mergeagenten01a1624f-b0af-7202-bda5-9a3c06566976 äger ensam PR-merger samt
J08-kopian och migrering-masterplan-kopian; den får ingen konkurrerande writer.
Ingen transportöverlämning till mergeagenten har gjorts. Kontakt med Kevin
fortsätter i samma GitHubissue312 vid återupptaget arbete; senaste aktuella
uppdraget är6337998848. Läs nya ID och ändrat innehåll, aldrig svar på egna
poster/kvittens. agent-talk når enbart samma checkout. Root startade inga
nya testservrar/PG/browser i stoppet; tidigare ägda resurser är stängda.

## Paow från kevin-staging: fryst källa och automatisk placering — 23 oktober 2026

**Beställning (Jakob, 23 oktober):** hämta hela Paow-paketet från Kevins
`kevin-staging`, låt Admins Klippassistent/Adminrobot placera det rätt i
klippkartan, och registrera annars Paow som ny dealer utan operatörs- eller
bolagstilldelning. Branch `jakob/paow-kevin-staging-import` (Claude).

**Levererat:**
- `apps/studio/lib/dealer-import-kevin-source-paow.json`: 414 filer från
  `origin/kevin-staging` @ c7138759 (56 utdelningstagningar, 23 H3-idle och
  3 utfasade idle-v2, 81 repliker × sv/en/pt/ko, vila/redo, meta, texter,
  porträtt) med gitBlob, storlek, SHA-256 ur blobbytes, K05-matrisens urval per
  fil (318/318 hashar lika med matris f00a8c2d), Kevins klipplista 2026-10-22
  (alla 324 repliker `ej-godkand`) samt `PAOW_READY` och idlelistan ur
  `dealers.js`. Paow-bytes är oförändrade sedan K05-frysningen 5aa7ed10.
- `apps/studio/lib/dealer-import-sources.mjs` delar frysta källor mellan planen
  och assistenten; `createFrozenKevinImportPlan` tar `--source-alias paow`,
  CLI:t verifierar lokala bytes mot vald källa och har `--summary`.
- Klippassistenten och Adminroboten (`finishDealerImportRows`) känner igen
  frysta filer på exakt filnamn och storlek och sätter fack, poskedja, språk och
  tagning automatiskt med `evidence` på raden och en notering i API-svaret.
  Saknat fack (G13-repliker), pt/ko och ej K05-valda filer får varning i stället
  för tyst placering. Importen ger aldrig operatörs-, bolags- eller rumstilldelning.
- Lokal byte-exakt kopia för Admins uppladdning och `--source-root`:
  `lab/data/kevin-import/paow-c7138759/` (gitignorerad, 414 filer, 264 MB).

**Verifiering (Node 24.21, max 4 arbetare):** `node --test` på
dealer-import, dealer-import-plan, dealer-import-integration, clip-naming och
test/filmed-profile: 71/71. `tools/dealer-import-plan.mjs --source-alias paow
--source-root lab/data/kevin-import/paow-c7138759 --summary` mot seed-projekt
med Paow registrerad: 414/414 bytes verifierade, 56 utdelningstagningar,
23 idle och 37 sv- plus 37 en-repliker placerade i befintliga fack (review:
inventarie ej läst, ingen filmprofil), 254 exkluderade med skäl (pt/ko 162,
G13 44, ej i K05-matrisen 44, idle-v2/redo 4), 7 referensfiler. Inga Neon-,
Blob-, Render- eller Vercel-skrivningar. Ingen visuell eller talacceptans påstås.

**Kvarstår, kräver Jakob:**
- Registrera Paow i Neon via Admin → Dealers → **Skapa ny dealer** (id `paow`,
  namn Paow) med N1-session; registreringen tilldelar inget bolag eller rum.
  Agenten har inte gjort produktskrivningen.
- Ingen filmprofil för Paow: Dragans kontaktrutor gick inte att härleda ur
  Kevins kortspår (0/33 i prov), så kortöverläggningen väntar på K04.
- Åtta Paow-tagningar finns redan i Neon under arkiverade `paow-kevin` (K05);
  planen markerar samma bytes `keep-protected` för en ny `paow`. pt/ko- och
  G13-repliker ligger kvar i källan med skäl, inte valda.

## K04: Kevins matte och tidsättning per tagning på mains treskiktsruntime — 22 oktober 2026

Branch `codex/k04-chain`, direkt på main enligt Jakobs besked. Taget ur
kevin/croupier-scoutgg 5aa7ed10 och anpassat till mains givningsprofil,
kompositionsruntime och delade rumsportar. Inga nya payloadfält, kontrakt
eller capability-versioner; Kevins mediekatalog, outbox, room-idle och DDL
togs inte.

- **Matte (kompositor).** Fast alfa med mjukat 5-punktskors, unspill av
  kvarvarande grönstick mot dealerns hudton (median hue/mättnad ur den keyade
  bilden, cachad 1 s), kantrensning med liten choke och hudskydd framför det
  filmade propkortet. Sparade threshold/softness/despill är fortfarande de enda
  rattarna. Den syntetiska fixturen kan inte bedöma matten (färgbalkar, ingen
  green screen); kontrollera dealerkanterna i produktion efter deploy och
  återställ med `git revert c426fac9` om de blivit sämre.
- **Tidsättning.** `packages/presentation/runtime/filmed-deal-timeline.mjs`
  (ren planerare): steglängd ur tagningens bildrutor vid profilens fps, REDO
  rygg mot rygg, annars 80 ms lucka, öppningsförsprång 700 ms (1500 ms när
  planen börjar med vändningen), överlämning på sista 1,5 bildrutorna men
  aldrig före clear-rutan, sök in i fasen förbi 0,15 s och aldrig in i sista
  0,04 s, ikappkörning över 0,4 s drift, anpassning med playbackRate 0,6–2 när
  fönstret är kortare än materialet. `shared-room-presentation.mjs` tidsätter
  varje filmat steg mot bordsklockan (startAt/endAt), väntar in stegets tid,
  söker vid sen start, visar statiskt kort när tiden gått; en kedja efter tal
  ankras där den börjar. `local-presentation.mjs` och `local-film-player.mjs`
  spelar den exakta tagningen med startOffset/handoverAt/playbackRate/clockTime
  och är oförändrade utan de alternativen.
- **Kvar.** Taltidsättning (scheduleTalks, lipsync-fönster) och Kevins
  1000 ms "talar"-försprång väntar på talspår med känd längd; återanslutning
  mitt i en plan behåller mains regel (ögonblicksbild, aldrig omspelning).
- **Verifiering.** 320 prov i presentation-, levande lager- och
  rumssviterna efter merge med main; pre-commit 208 fokuserade prov.


Branch `codex/admin-ux-pass-2`. Jakobs besked: Admin var fullt av dubbletter och
gammal partnerlogik läckte in i rumssidan. Ingen regel eller test förbjöd att ta
bort ytor; J03 hade flyttat Control-sidorna under System i stället för att välja
en. Detta pass väljer en plats per funktion och omdirigerar resten.

- **Ett rumsflöde.** `/admin/rooms` (Spelbolag & rum) har förhandsvisningen i
  full bredd, Rummets val (bakgrund, dealer, bord) bredvid Spelinställningar,
  status (publicerad version, utkast, vad spelaren möter), och under det
  bolagets Publicering, Skapa rum och Spelrum (livscykel). Paketlogiken ligger i
  `apps/studio/lib/operator-package-client.mjs` och delas med Bolag & team.
  `/admin/publication` omdirigeras (klient och server, GET/HEAD; skrivningar
  aldrig). Rumskorten är borttagna ur den gamla sidan.
- **Admin väljer fritt bland mallens lager.** `adminLayerAdjustments(lane)`
  (partner-package-view.mjs) i klient och server: en N1-session
  (`audit.accessClass==='internal-admin'`, satt server-side ur cookien) får
  välja bakgrund, dealer och bord inom `allowed` även när
  `operatorAdjustable` saknar dem. Partnersessioner oförändrade. "Låst i
  publicerat paket" visas inte längre för Admin.
- **System utan dubbletter.** Verktyg → Fördjupning (Talgranskning,
  Svarsbibliotek, Spelhändelser & regler, Guide). Kopplingar och Användning &
  beroenden → en sida `/admin/structure` "Kopplingar & användning";
  `/admin/deletion` omdirigeras. Sammansättningar nås från Scen & lager
  ("Avancerad sammansättning").
- **OpenClaw på en sida.** `/admin/openclaw` med flikarna Driftläge (taldrift
  flyttad från Drift), Agentmodeller, Dealerns agent, Tal vid inaktivitet,
  Adminroboten. Gamla adresser omdirigeras till rätt flik. Drift behåller
  spelstatus, skobevis och integritet (dess Logga ut-knapp försvann med
  taldriftskortet; finns kvar på Konton, Betalningar, Integrationer).
- **Konton delade.** Spelarkonton `/admin/players` under Verksamhet;
  adminpersonal kvar på `/admin/admin/accounts` under System.
- Destinationslås i tester är ompekade, behörighets-, isolerings- och
  "skrivningar omdirigeras aldrig"-prov behållna. Ingen ny API, writer, schema
  eller capability. Kvar: zoom och placering per rum är ett eget kontraktspass
  (rumsöverstyrning + spelkonsument + paketbudget).
- **Leverans direkt på main.** Jakob bad 22 okt ~18:00 om direkt push till
  main i stället för PR (flera agenter och worktrees skapade förvirring).
  UX-pass 2 landade som main cea6ab3e; branchen `codex/admin-ux-pass-2` finns
  på origin men behöver ingen merge. Vercel-bygget av cea6ab3e rapporterade
  fail medan samma commit bygger grönt lokalt (`npm run build` i apps/studio,
  traces sanerade); loggen finns bara i Vercel
  (`npx vercel inspect dpl_4g4jjNGcX8SR8JKR36f4qHRo4eMQ --logs`). Föregående
  deployment (712be3e8) är kvar i produktion tills ett bygge går igenom.
- **Kvar efter passet.** Playwright-sviten `apps/studio/test/admin-ai-browser.test.mjs`
  (bara lokal, kräver `CROUPIER_BROWSER_FIXTURE_MODULE`) monterar fortfarande de
  gamla OpenClaw-sidorna och behöver en fixtur mot `/admin/openclaw`; CI kör den
  inte. Dealerns agent-flik visar ännu chattsidans egna flikar (Agentmodeller,
  Chatt) under OpenClaw-sidans flikrad.

## Levande lager: bord och variation (capability 24) — 22 oktober 2026

PR #343 (`codex/levande-lager`), mergad till main 20f89d42. Uppföljning i
PR #346 (`codex/levande-lager-geometri`).
Jakobs beställning: var tredje minut och femton sekunder, med 74 sekunders
variation, ska ett kort mp4-klipp spelas över bakgrunden; en mp4 ska kunna
vara basen; samma för bordet och dealern.

- **Kontrakt.** Intervallregler i `backgroundPlayback` får `jitterMs`
  (0–120 000, kortare än `everyMs`); starter dras ur `everyMs ± jitterMs`.
  Nytt valfritt `tablePlayback` på sammansättningen med samma form, mot
  bordslagrets tillåtna videor. Standardregel 195 s ± 74 s, 10 s max, 1/min.
  Capability 24 `layerPlayback: table-and-jitter-v1`; readiness kräver 24 för
  fälten och avvisar dem mot äldre spelservrar. Inget schema, ingen SQL.
- **Runtime.** `background-playback.mjs` tar `role` och injicerbar `random`.
  `presentation-composition.mjs` kör en scheduler per lager; bordsklipp
  ritas som bordslager medan de spelas och basen återställs efteråt.
  `tablePlayback` följer med i frysta paket (game-entry-selector) och
  Studio-prov; papperskorgen tar bort bordsregler som refererar filen; båda
  spelklienterna skickar spelhändelser även till bordslagret (`tableEvent`).
- **Admin.** `LayerPlaybackEditor` för bakgrund och bord med Variation ± och
  klartextsammanfattning; Scen & lager, Sammansättning och förhandsvisningen
  (bordsklipp provas i CompositionPreview) använder den. Dealerns beteendeklipp
  är oförändrat vilopolicyn i Körregel.
- **Verifiering.** 505/505 i de berörda sviterna (kontrakt, scheduler,
  komposition, studio-preview, entry-selector, material-trash, readiness,
  room-api, editor, preview, panel) plus 552 befintliga modell-/lagersviter;
  Admin-bygge (tsc admin+lobby, esbuild) och Studio-tsc passerar.
- **Produktion.** v24 är live i produktion sedan main 20f89d42. Såvitt känt
  är inga bordsklipp publicerade än. Fasta intervall utan bordsklipp fungerar
  som förut.
- **Uppföljning efter granskning (PR #346).** (1) Spelplanet (platser,
  insatser, dealerns kort, kortprojektion) räknas från det monterade
  basbordet, aldrig från ett spelande bordsklipp. Ett klipp med annat format
  flyttade tidigare spelet mitt i en hand. (2) Bordsklipp spelas bara över
  standardbordet. Väljer spelaren eller rummet ett annat bord är bordets
  scheduler pausad. (3) Media som `tablePlayback` refererar till är inte
  bordsval. De finns kvar i bordslagrets tillåtna lista eftersom reglerna
  kräver det, men erbjuds inte i spelarpanelen, lobbyns rumsval eller Admins
  Utseende. Ett sparat spelarval eller en override som pekar på ett klipp
  faller tillbaka till standardbordet, och Admin avvisar att spara ett klipp
  som bord (422). Utan `tablePlayback` är allt som förut. (4) Mute-testet i
  `test/background-playback.mjs` gick igenom vacuöst och kontrollerar nu
  verkligen att lagerhändelserna kommer före mute-returen.
  Bordsklipp bör ha samma pixelmått som basbilden: ett avvikande klipp
  flyttar inte spelet men ritas i sitt eget format och linjerar inte visuellt.
  Verifiering: nya tester fallerar mot koden före fixen. Riktade sviter
  (scheduler, komposition, card-view, presentation-layers, studio-preview,
  capability, game-lanes, player-choices, public-operator-rooms,
  partner-package-view, partner-branding-drafts) och hela Studio-sviten är
  gröna. Moving-speech-grupperna kördes inte lokalt (`ws` saknades i
  worktree) och berörs inte.
- **Midnight-bakgrunden.** Skript för Jakob: `C:\Users\jakem\CroupierBackups\
  midnight-background-2026-10-22\KOR-MIDNIGHT.cmd` registrerar stillbild,
  loop och två varianter via Admins ordinarie lageruppladdning och binder dem
  till vald sammansättning med intervall 195/255 s; `--jitter` efter deploy.

## Admin UX-pass 1: klippkartan — 22 oktober 2026

Branch `codex/admin-ux-klippkarta` från main `34060c4d` (PR336 mergad och
deployad). Bara Admin-klientens vyer, CSS, en test och användarguiden ändras;
inga kontrakt, writers, API:er, scheman eller medier. Jakobs riktning: klippkartan
och redigeringen är grunden, varianterna ligger bakom standardklippet, och
beteendeklipp styrs av intervall, spelhändelse eller OpenClaw.

- **Körregel som egen vy.** Knappen Redigera körregel öppnar nu vyn Körregel i
  panelen bredvid Klipp, med det valda klippet som kontext överst. Beteendeklipp
  i Vila har fyra startlägen som knappgrupp: Av, Ibland · intervall, Vid
  spelhändelse, OpenClaw. Intervallfälten (ungefär var, variation ±, minsta paus,
  högst per minut) har enheter och en klartextsammanfattning av schemat.
  Varianter i övriga fack visar Regler/Slump/OpenClaw som val med sammanfattning
  av den sparade regeln. Samma data och writers som förut
  (`applyStudioIdleVariantPolicy`, `applyStudioVariantPolicy`).
- **Klippkartans kort** visar en stillbild av valt klipp. Roulette, planerade
  och intagsfack är oförändrade.
- **Sammansättning** väljs direkt i klippkartans kontextrad, så Scen & lager
  kan öppnas utan rumsval. Scen & lager inleds med tre lagerkort: bakgrund,
  dealer och bord med förval och antal tillåtna val.
- Verifiering: isolerat visuellt harness `node tools/admin-clips-fixture.mjs
  --scene` med Playwright mot installerad Chrome, 1440 och 390 px, före- och
  efterbilder i sessionens scratchpad (inte i git). `node apps/studio/client/
  build.mjs` med `CROUPIER_LAB_BASE_PATH=/studio` (tsc admin+lobby, esbuild)
  passerar. Riktade sviter studio-layout, studio-policy (ny test för vilovyn),
  roulette-clip-map, studio-composition-panel, clip-guide, navigation och
  studio-login-form: 92/92, 3 browserfall överhoppade utan fixturmiljö.
  Ingen produktion, databas eller deploy berörd; full regression i CI.

## Admin: rummets lager på Spelrum & publicering — 22 oktober 2026

Claude (annan IDE) tog över från rootens checkpoint `4e094fbb` på samma
arbetskopia och branch; CI39762134151 på den checkpointen är verifierad grön.
Luckkartan för flödet ”ett Blackjackrum” visade att rummets val låg på tre
ytor med tre skilda utkast: sammansättning/paketpublicering och J08:s
spelinställningar på `/admin/rooms` (`admin-publication-page.tsx`), rummets
bakgrund/dealer/bord (`roomOverrides` via `partner-branding-api`) bara i
klippkartans rumspanel (`registered-studio.tsx`) och partnerportalen, samt
mobil-/desktopplacering per borddesign i sammansättningspanelen. Rumssidan
hänvisade bara till ”befintliga tillåtna val”.

Ändring: `/admin/rooms` monterar nu befintliga `PartnerAppearanceLoader` i
rumsläge för det valda verifierade publicerade rummet, i ett eget kort
”Rummets lager · <rum>” ovanför spelinställningarna, med länk till klippkartan
för samma rum och till sammansättningen för placering. Panelen visar själv
publicerad version och sparat utkast och sparar/granskar/publicerar genom
oförändrat branding-API med befintlig N1-behörighet och revisions-CAS.
Panelens utkast och pågående skrivning ingår i sidans befintliga skydd:
bekräftelse före byte av bolag/sammansättning/rum, beforeunload, spärrad
”Återöppna sparat läge” och spärrad paketpublicering med statusen ”Spara
rummets ändringar först”. Regeln är ett rumsutkast i taget: ett osparat eller
pågående rumskort låser syskonkortet, rumsskapandet och rummens livscykel,
så att en publicering eller omläsning aldrig kan montera om det andra kortet
över osparade ändringar. Båda rumskorten nycklas på resursrevisionen och
laddar därför om på den nya paketrevisionen efter en publicering; kvittot för
en äldre paketpublicering nollställs samtidigt (gällde tidigare även J08-kortet).
Inga nya writers, API:er, kontrakt eller schema. `chooseRoom`:s URL-hantering
är orörd: rumsreturrättningen finns bara i PR334 och integreras av mergeagenten.

Verifiering: `apps/studio/test/admin-publication-page.test.mjs` 38 → 43 prov,
0 skip, Node 24.21.0, högst fyra workers; `admin-publication-workspace.test.mjs`
1 pass och 1 valfritt browserprov överhoppat (ingen Playwright i arbetskopian);
`control-operator-directory`/`lane-editor` 27/27; Studio `tsc --noEmit` exit 0.
Oberoende läsreview av diffen: inga blockerande fynd; tre bör-fixar (stale
paketrevision mellan rumskorten, osparat utkast låste inte syskonwriters,
kvarstående paketkvitto) är rättade enligt ovan och täckta av proven.
Ingen browser-/visuell acceptans, ingen PG-, live- eller mediekörning.
Kvar i flödet: mobil-/widescreenförval per rum saknar kontrakt (placeringen
ligger per borddesign), ett ovisst resursläsningssvar avmonterar rumskortet på
samma sätt som J08-kortet, Kevins övergångssekvenser är inte kartlagda mot tre
lager (begärt i #312/6337998848, obesvarat) och Kevins mandat om sex svenska
talrepliker (#312/6338036945) väntar på Jakobs beslut om uppladdning.

**Senare samma dag, tre commits på samma branch (Claude):**

- Spelvyn i delat rum: retry-knappen låg i den klickdöda statusrutan, gamla
  enspelarkontroller syntes trots `hidden` (stilregler vann), dollargränsen kom
  från gamla HUD:en och platskontrollerna krympte under 44 px och överlappade.
  Rättat i `shared-room-view.mjs` och `styles.css`: retry i kontrollraden,
  display:none på gamla ytor, rummets gränser i kr från serverns inställningar,
  insatsknappar bara på egen plats, kontrollskala aldrig under 0,8. 27/27 prov.
  Motsvarar Kevins B1/B2/C1/C2 i #312/6339094902; hans omkörning återstår.
- Klippval styrs av Admin, inte av spelaren: det frysta rumspaketet exponerar
  sammansättningens sparade OpenClaw-lägen per fas (idle/deal/reveal/speak),
  servern härleder läget för select, idle-regler och idle-advice från den
  publicerade sammansättningen i stället för klientens begäran, och den
  publicerade spelaren döljer rullgardinen ”Klippval”. Studio-prov utan rum
  behåller kontrollen. 271 prov över presentation, selection och vy.
- QA-launchern: Kevins tre startrader (ingen `LAB_PUBLIC_URL`, slumpad
  ingress-hemlighet per process, Lab-sessionskontroll av) är bundna till
  engångskapabiliteten `sharedRoomQa`; inga produktionsvakter ändrade.

Välkomstfilm: Kevins `dragge/repliker/{sv,en}/greeting_1–3.mp4` samt svenska
`win_1`, `dealerbust_1` och `placebets_1` är hämtade från frysta `5aa7ed10`,
verifierade mot mains importunderlag (gitblob och storlek), sha256-hashade och
probade med ffprobe (1080×1920, CFR 24, AAC) i privat arbetsyta utanför Git.
Registrering via ordinarie upload-API är inte utförd: klippkartans uppladdning
nekar talmedia, identiteten kräver audio-/indexhash enligt recorded-speech v1,
och sessionen saknar tillstånd för produktionsanrop. Attestation är begärd av
Kevin i #312/6339673965. Kvarstående luckor: K04:s serverkedja för idle
(`room-idle.mjs`) saknar automatiska intervall och OpenClaw-val, och mobil-/
widescreenförval per rum saknar kontrakt.

## J08 — Admins rumsutkast och skobevis — 22 oktober 2026

**Integration inför PR334:** tidigare granskad head
`d7d139b9f7bf59b1bd924280ab456af12e1c8b5a` förenas med betrodd main
`47756bdf1df372c7aa5047dc165a2d721614c4a2`. J08:s funktioner bevaras;
mainens CI-konsolidering, policyprov, arbetsregler och deployspärr följer med.
Endast handoffen behövde konfliktlösning. Oberoende slutreview, normalhook och
exakt-head-CI krävs före merge. Ingen GitHub-merge, produktions-DDL, deploy,
flaggaktivering eller ny medieacceptans ingår i denna lokala integration.

**Rättad returkontext vid rumsbyte:** publiceringen skriver nu kanoniskt
`table=<valt rum>` och tar bort aliaset `room`. Vid byte till ett annat rum
tas gammal `composition/lane/game` bort ur länken, så Klippkarta kan lösa
det nya rummets kontext. Formulärets fristående sammansättningsutkast behålls;
behörigheter och spar-/publiceringsvägar ändras inte. Samma två filer som i
huvudagentens frysta leverans har hashverifierats före övertagandet. Rootens
riktade regressionsbevis är två röda fall före rättning och 68/68 gröna efter,
0 skip/Node24.21/max1 worker över publication, routing och workspace-tools.
Det är huvudagentens körning med instrumenterad UI, inte verklig K04-media
eller ny browser-/PG-acceptans. Rättningen samlas före PR334:s enda slutpush.

**Granskningsrättningar före merge (mergeagenten, 22 oktober):** oberoende
läsgranskning av exakt `24e9f0264bc244e2ddabdac0cc12b1537ab164bd` fann att koden
fungerar utan game008–010, eftersom publiceringen är stängd utan resolver. Fältet
`roomGameConfigs` saknade däremot kapabilitetsspärr: ett sparat utkast hade fått
äldre Studio och spelserver att neka hela administrationsdokumentet (503) vid
versionsglapp eller återställning. Rättat med v23 enligt befintligt mönster, se
[runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md). Dessutom visar rumsväljaren bara
live-blackjackrum som API:t godtar, och spelinställningarna öppnas inte för andra
rum (en andra oberoende granskning hittade kvarvarande rouletterum), länken till sammansättningen bär inte längre ett rum
från en annan sammansättning, och ett skobevis med intakt men för lång auditkedja
visas som `incomplete` i stället för `failed`. Kvar som uppföljning: läsningarna
tar Studios skrivlås eftersom repositoryt inte lämnar SQL-klient i läsläge;
revisionsbesked och brandingbudget när resolvern kopplas in; bevis bortom 10 000
auditrader kräver checkpoints. Nya prov föll 11/156 mot gamla koden och passerar
156/156 efter rättning; berörda readiness-/J08-sviter grönt utom ett valfritt
browserprov; Studio `tsc` grön; Node 24.21.0, högst fyra workers. Ingen DDL,
deploy eller produktionsåtgärd.

**IN_PROGRESS, utkast på `codex/admin-room-config-j08`.** Arbetskopian utgår från
`4852f92f11635e20edd974c3261e0fc179ab7d1b`, med samlad Admin och J07 integrerade.
Aktiviteten är inte VERIFIED; delverifieringen ger ingen ny färdigbock.

- N1 kan läsa och spara språk `en/sv` och limitprofil `casual/prive/high` för
  ett befintligt publicerat blackjackrum. Runtiderna är skrivskyddade 20s/15s.
  Separata utkast skyddas av administrationsrevision, paketrevision, ägarskap
  och rumskontroll. Konflikt kräver omläsning och nytt sparande före publicering.
- Publiceringssteget använder samma Studio-transaktion/PG-klient för befintlig
  paketwriter, ny oföränderlig J07-config och senaste versionspekare. J07:s
  R-lås, paket-CAS och befintlig runtime-readiness behålls. Inget join/poll-flöde
  skriver konfiguration och inget nytt schema installeras här.
- Native N1-läsning av skobevis verifierar rum/företag/paket före bounded SQL.
  Öppen sko visar endast commitment; stängd sko kan lämna exakt proof-JSON.
  Global auditkedja och persistenta drag jämförs, ofullständigt/felaktigt bevis
  visas inte som verifierat. UI håller svar bundna till valt rum och avbryter
  gamla läsningar. `closedAt` följer lagrad numerisk millisekundtid; även epoch
  noll betyder stängd, medan ogiltiga tider nekas.

**Återstår:** exakt register-/paketbindning och inkoppling av K04-producenten.
K04 har nu en planeringsproducent på `d226f53370e4355267d8875bc9168e91357f41ba`.
Den nya rena adaptern `room-game-material.mjs` kräver explicit identitetsmappning
för operator/paketversion/rum/dealer och källans sökväg, variant och tal-tagning.
Hashar och timingbytes hämtas från validerad fångad runtimekatalog, med medie-ID/hash
i det frysta paketet och verifierad/godkänd talidentitet för rätt språk. K04:s egna
katalogpåståenden får aldrig ersätta saknade registeridentiteter.

Adaptern har 5/5 fokuserade provgrupper på Volta Node24.21.0,0skip. j04_resume har
oberoende läst båda filerna och berörda kontrakt utan blockerande fynd; root har
läst modul/prov. Proven använder injicerad producentstub och isolerade data.
Det är inte faktisk K04-/Blob- eller visuell acceptans. Adaptern är registrerad i
CI:s befintliga presentationsgrupp. API:t binder nu resolveranropet till befintlig
`readPresentationSnapshot` på samma scopelåsta transaktionsklient: scope och
administrationsrevision kontrolleras, katalogen valideras och separata kopior av
rum/paket/katalog lämnas till producenten. Använda medier måste fortfarande finnas
med exakt identitet i både fryst paket och aktuellt register; arkiverat/raderat
material nekas, tal kräver godkänd exakt språk-/tagningsidentitet. Befintlig
`assertCapturedPresentationMedia` återkontrollerar revision/post före paketwriter.
Katalogimport och registerwriters delar scopelåset; ingen extra katalogläsning
eller provider-I/O införs. Fem nya regressionsgrupper gav före 8 pass/5 fail,
efter 13/13 API-prov; slutprov inklusive ren adapter 18/18, 0 skip på Node24.21.0.
Bevis: `arkiv/2026-10-22/j08/material-snapshot-{before,after,final,commands}.log`.
Root körde dessutom den ändrade vägen med riktig PostgreSQL16.15/Node24.21:
9/9 grupper med två klienter, CAS, SQL-triggerrollback, R-lås, fryst konfiguration,
proofbytes och fysisk omstart. Befintlig isolerad fixture kompletterades med
project/media/katalog och befintligt schema012; inga produktionsmigrationer.
Första fixturestarten rättades från vanlig JSON-serialiserare till befintliga
runtimeCatalogJson; produktkoden ändrades inte av den rättningen. Slutlogg:
`arkiv/2026-10-22/j08/material-snapshot-pg.log`. Eget kluster stoppat och borttaget;
port35029 och temporär Node-runtime verifierat frigjorda. j04_resume läste hela
femfilsdeltat och provloggar utan blockerande fynd; root läste kod/loggar.
Detta verifierar isolerade handlers med injicerad planering, inte K04/Blob/live.
Den verkliga K05-identitetsmappningen och nativebindningen återstår. Saknad mappning/producent/timing
nekas; inga 700/500-fallbacks. Native publicering är fortsatt nekad utan resolvern.
Ingen K04-import, live transport-/spelinkoppling eller produktions-DDL har utförts.

**K05-katalogkompatibilitet, 22 oktober:** rättat underlag159cc134d3a57db4ccbe3a871a3a5eb16fec3656
och K04afba9dc22e77aecb89c1527fde37088d0ad1b7a4 behåller producentens API men
byter materialmängd/revisionshashar. Äldre planningrevisions återanvänds inte.
J08 tillåter nu `still`/`keyed-still` via exakt validerad PNG-katalogpost,
null media-ID/tal och fryst identitetskarta/katalogrevision/paketpresentation;
ingen påhittad videopost. Video- och inspelat-talgodkännanden består.
Före6pass/1fail på korrektPNG, efter20/20adapter/API,0skip. Samtidigt nekar
media-layouts historiska fyrnamnslista giltiga `dealers/dragan/...`-poster.
Den använder nu delad `isDealerId` för sökvägssyntax, med befintligt traversal-,
alias- och privatskydd. Giltig syntax registrerar ingen dealer och ger ingen
paket-/speltillgång. Reproföre1/1fel; slut23/23layout/katalog/importprov,0skip.
Ett negativt testfall rättades från giltig dealerx med underkatalogy till en
faktiskt ogiltig kodad dealerkomponent; ingen produkträttning av det testfelet.
Oberoende j04_resume läste hela fyrfilsdeltat och loggar utan blockerare; root
läste kod/loggar. Node24.21.0,max4workers. Loggar:
`arkiv/2026-10-22/j08/png-binding-{commands,before,after}.log` och
`dealer-path-{before,after,final}.log`. Detta är kontrakts-/fixturbevis,
inte egen Blobbyte-/K04-/fullnativeacceptans. Ingen import, DDL eller aktivering.

**Verifiering:** tidigare serverprov 73/73 och senare 27/27 API/HTTP-prov,
UI-agentens 162/162 fokusprov och Studio `tsc`, rootens 7/7 proof-prov samt
12/12 UI/server-proof-prov efter numerisk timestampfix. Körningar överlappar.
PR334/head `61144fdac28832238130e2c24d10a21bf2badb61` hade normal hook249/249.

CI39696563383 på `6ab4cd5e9448fad91cf85174c4e93c697fc5f74e` visade två
ofullständiga VM-fixturer: `studio-registered-dealers.test.mjs` saknade
`SharedTableProof`, och `workspace-tools.test.mjs` saknade `RoomGameConfig`.
Endast motsvarande barnkomponenters fixtureimporter lades till; alla assertions
och produktfiler är oförändrade. Före 15 pass/4 fail (en fil laddades inte), efter
20/20,0skip på Volta Node24.21.0 med högst fyra workers. Registrerade dealers,
sparspärr, bolags-/rumskontext och 401/403/503-proven består. Loggar:
`arkiv/2026-10-22/j08/pr334-fixtures-{before,after,commands}.log`.
Ingen produktserver startades. Senare CI39699893800 är verifierat completed/success
på J08-head `08736cf37980cfbf6ceee2e3c36b9bb81b3cf04e`.
Fjärr-main `6bcf812eff63fbec99ef0e2c931cfaa8a7e47dad` (J04/lobby) är nu
integrerad konfliktfritt från denna head. De identiska lobbylänksändringarna
sammanföll; J04:s och J08:s separata handoff-/fullhookblock är bevarade.
Importerade mainfiler är jämförda mot det frysta källträdet; inga produktfiler
avviker. Diffkontroll passerar. CI39701503691 och GitGuardian119571576203 är nu
verifierat completed/success på exakt9b43e3e7f7cde871cdba9efe81800bf8b5c4d329;
kevin_plan har oberoende läst hela integrationsdeltat utan blockerande fynd.
Root har läst överlappen. Denna gröna CI gäller basen före PNG-/dealersökvägsdeltat; ny CI krävs för den nya headen. Ingen K04-/K05-aktivering,
produktions-DDL eller tung omkörning följer av integrationen.

Nu även **9/9 riktiga PostgreSQL-grupper**, Node24.21.0/PostgreSQL16.15 i ägt
tillfälligt WSL-loopbackkluster. Två fysiska klienter verifierar sparning/återläsning,
stale administrations-/paket-/utkastrevision och en enda vinnande dubbelpublicering.
Felinjektion med riktig SQL-trigger vid sista auditsteget återställer dokument,
historik, paket, immutable config, head och audit tillsammans. J07:s fysiska R-lås
stoppar J08-publicering med befintligt 423-svar utan delskrivning. Publicerad config
behålls genom fönster, runda, settlement och rekonstruerad koordinator; först nästa
fönster tar den nya versionen. Riktigt lagrat skobevis skyddar öppen sko, bevarar
stängt proof-JSON inklusive epoch0 och nekar manipulerade drag. Fysisk PG-omstart
bevarar paket/config/utkast och proofbytes. Logg: `arkiv/2026-10-22/j08/pg-verification.log`.

Detta använder uttryckligt injicerad **testmaterialplanering**; verklig K04-producent,
aktiverad native publicering, HTTP/readiness mot verkligt mål, browser/live-media,
production och deploy är fortfarande overifierade. Native publicering utan resolver
nekas även efter omstart. Inga produktwriters ändrades av testleveransen. J08-runnern
återanvänder J07:s isolerade klusterlivscykel och är registrerad i CI som
`database/room-game-config`; ingen ny grön GitHub-CI påstås. Egna kluster, tillfälliga
Node-runtime och portar är stängda/borttagna (`pg-cleanup.log`). Nästa steg är
materialkoppling efter granskad K04-producent. Oberoende j04_resume har läst samtliga fem PG-deltafiler samt körnings-/städloggar: inga blockerande fynd. Root har läst samma kod och bevis; ingen ny omkörning av oförändrat prov behövdes.

## J07 — delat blackjackbord på mains PostgreSQL — 22 oktober 2026

J07 är nu implementerad på `codex/postgres-shared-table-j07` från main
`95ac98dcb1608bd89bb2ac44488b2a82a376682d`. Det tidigare beskedet ”nästa steg J07”
var en plan, inte påbörjad kod. Kevin förbereder K04:s händelse-/mediemappning;
den aktiva presentationen ska kopplas till den här adaptern efter leverans.

- K02/K03:s isolerade modulslutning kommer från verifierad Kevin-head
  `b8e1c957c99c5a16ee861f9767ec28041b2270dd`. Enda ändringen i importerad
  produktkod är rum-ID-gränsen 40 → 128 för mains verkliga `room-<UUID>`.
  Frysta jämförelsefixturer behåller exakta Git-blobbytes med LF.
- `postgres-store.mjs` implementerar K03-portarna: samma PG-klient/yttertransaktion,
  G→R→P→A före savepoint, lagrade svar, fryst konfiguration, sko/journal och
  commitbunden outbox. JSON-text bevarar de ordnade bytes som skobeviset använder.
- `postgres-wallet.mjs` använder mains spelare/saldo/transaktionsledger.
  Reservationer och spelande händer skyddar även befintliga writers genom
  databastriggers. Idempotensnycklar/fingerprints skiljer rum, aktör, kommando/tick,
  berörd spelare och ekonomisk effekt. Ingen egen SQLite-wallet eller identitet.
- `postgres-runtime.mjs` driver deadlines utan spelarens polling och har explicit
  start/stopp. Appen äger poolen och måste invänta startens schemakontroll.
  Utan K04-sink ligger committad outbox kvar; leveranshint är inte mottagarens CAS.

**Integrationsgräns:** fabriken tar en uttrycklig demokonfiguration och en rå
applikationsägd PG-pool. Befintlig autentisering/rumbehörighet ska kontrollera
kommandoidentiteten före koordinatorn. K04 äger presentation och beständig
mottagarversion; J08 binder godkänd rumspublicering till den interna config-porten.
Inga aktiva HTTP-routes, befintliga launcherflöden eller publiceringswriters har
kopplats om i denna leverans. Join/poll publicerar aldrig konfiguration.

**Schema och drift:** `008-shared-wallet.sql` och `009-shared-blackjack.sql` är
explicit tilläggs-DDL för spel-databasen, inte Studio. Startup installerar inget;
saknat schema och extern wallet nekas. Produktionsidentitet, godkänd applicering
och schemaberedskap måste verifieras före merge/aktivering. Ingen produktions-DDL,
merge, deploy, betald drift eller medieimport har utförts.

**Senare aggregator:** en framtida adapter måste använda stabila externa
idempotensnycklar och varaktig status/reconciliation för osäkert transportsvar.
Ett timeout får inte tolkas som nekad debit; återläs extern transaktionsstatus före
ny effekt. Databasrollback kan inte återställa ett redan committat externt saldo.
Därför behålls dagens externa PG-walletspärr tills den separata integrationen är
implementerad och verifierad; ingen tyst demofallback.

**Verifiering:** isolerad riktig PostgreSQL16.15/Linux Node22.22.0, två klienter,
processavbrott före/efter COMMIT och fysisk PG-omstart; exakta saldo-/journal- och
replaykontroller: 20/20 SQL-grupper passerar efter timeoutfixen för fristående
frågor/outbox. Låst outboxrad avbryts även utan poolens query_timeout och kan
kvitteras efter återhämtning. Runtime9/9 på Windows Node24.21.0; lokal logg `arkiv/2026-10-22/j07/plan-review-sql.log`.
Tre underagenter hade skilda implementation/granskningsuppgifter. Ingen faktisk
spelklient, live-mail, provider, media eller produktionsdatabas ingick.

**CI-rättning PR #332:** körning `39685636720` stannade först på fyra oregistrerade
testfiler; installations-/byggstegen hoppades därför över och gav efterföljande
modulfel. De tre direkta K02/K03/runtimeproven ingår nu i full regressionens
`gameplay/shared-blackjack`. SQL-filen klassas som exporterad hjälpfil och körs
fortsatt av den befintliga isolerade PostgreSQL-runnern i CI. Produktkod och
provassertioner är oförändrade. Samma orphan-repro går från fyra fel till 534
kandidater/0 orphans; de nyregistrerade proven plus orphan-verktygets prov passerar
56/56, 0 skips, med Node24.21.0. Loggar: `arkiv/2026-10-22/j07/ci-fix-{before,after,tests}.log`.
Ingen ny fullbuild, SQL-körning eller fjärr-CI har gjorts för denna registerrättning.

## Migreringsplan och ansvar — 22 oktober 2026

[Masterplanen](../migrering/MASTERPLAN.md) och [status.json](../migrering/status.json)
är kanoniska. **45% (9/20 hela aktiviteter) är VERIFIED; 55% återstår.**
J01, J02, K01, O01, J03, J04, K02, K03 och J07 är verifierade.
Detta är aktivitetsandel, inte tids-, kod- eller produktionsprocent.
J03/PR331 och J04/PR335 ingår sedan tidigare i main. PR311 och PR337 är nu
mergade som `98174fd8cc906137783ea842e529f711e06cfadb` respektive
`47756bdf1df372c7aa5047dc165a2d721614c4a2`. Båda har grön eftermerge-CI.

J05/J08/K04/K05 är fortfarande IN_PROGRESS. Root äger klientmontering, rumsväg,
server och byggkedja. Kevin har ingen utestående klientleveransskuld; hans
refill `eb6ab45509fad539463bbcb6930cc46d2d0844c2` är granskad och återanvänd.
Transport-PR336:s aktuella frysta head är
`83f5810d33c483868ac0ce2bab728efb813d51b4`. Tidigare P2-fynd är rättade;
hela nya deltat är oberoende slutgranskat utan blockerande fynd och dess
CI39753242313 är completed/success på exakt denna head. Den generella lokala
QA-fixturen är levererad. Kevin fortsätter touch/layout och fullflöde med
skärmbilder utan speech; verkliga körresultat återstår. Lipsync/RunPodval och
nya jobb i det spåret är pausade till sista manuella etappen med Jakob/Kevin.
Detta är ingen tal- eller K04-acceptans.

Game008/009/010 saknas i daterat verifierad Neonproduktion. Faktisk deployed
runtimeidentitet/ACL, operativ återställningsberedskap och produktions-DDL-mandat
är fortfarande öppna. Isolerade PG18.6-uppgraderingsprov10/10 och syntetisk
restore8/8 är granskade bevis; de ersätter inte dessa produktionsgrindar eller
verkliga K04-medieprov. Planprocenten ändras inte av nya dokument eller delprov.

Jakobs separata mergeagent äger sekventiell integration, #334 före #336.
#332 ingår i #334; #333 saknar mergemandat. PR334:s lokala mainintegration är
förberedelse: ny fryst head, oberoende slutreview, normalhook och exakt-head-CI
krävs. Ingen schemaberoende produktmerge sker innan föreskrivna grindar är gröna.
Ingen produktions-DDL, deploy, env-/flaggaktivering eller medieimport är godkänd.

Vercels `git.deploymentEnabled:false` följer med från main och bevaras.
Mergeagenten har tidigare verifierat Render autoDeploy=no/triggeroff,
not_suspended samt repo delete_branch_on_merge=false; detta är ingen ny
providerändring eller driftverifiering från Adminintegrationen. Spärrarna får
inte återaktiveras automatiskt. Aktuell samordning sker i
[GitHub #312](https://github.com/Jakeminator123/scoutgaming/issues/312).

## Förenklade agentinstruktioner — 21 oktober 2026

På Jakobs begäran förenklas AGENTS i PR #311: masterplanen erkänns,
Control avvecklas enligt aktiviteterna och sakdetaljer hänvisas till befintliga
guider. Skydd för data, ekonomi, media, behörighet, schema och mergeägarskap
kvarstår. Oberoende regelgranskning har inga blockerande fynd. Denna
regeländring godkänner ingen produktion eller ändring av CI-/branchskydd.

## Lägre CI- och byggkostnad — 22 oktober 2026

Lipsync-proven återanvänder nu regressionsjobbets Node 24, FFmpeg och låsta
gateway-beroenden. Alla fyra workerprov behålls: gatewaytest, Python-unittest,
Python-compileall och Bash-syntax. Python 3.11 väljs separat utan att ändra
övriga provs Pythonmiljö. Slutgrinden kräver ett uttryckligt slutförandekvitto;
saknat kvitto, fel, avbrott och oväntat överhoppade jobb blockerar fortfarande.
Klassificeringen använder slims förinstallerade Node 24 med blockerande
majorkontroll och åtta nödvändiga filer via sparse checkout. Hela commitdiffen
klassificeras fortfarande, även för filer som inte checkats ut. Separat
Node-hämtning tas bort efter mätningen 24 s setup av totalt 53 s; ny starttid
måste mätas på den nya headen. Slutgrinden CI behåller ubuntu-slim; full
regression, Moving och produktionsledgergrindens urval är oförändrade.

Historiska stegtider för 1 101 matchade körningar uppskattar 1 281 färre
avrundade VM-minuter med konsolideringen (cirka 7,69 USD brutto vid 0,006
USD/minut); detta är ingen verifierad minskning av fakturan. Lokalt passerar
13/13 CI-policyprov med Node 24 och fyra workers, inklusive simulerat fel i
vart och ett av de fyra workerkommandona, felaktig/saknad Node och en verklig
sparse Git-fixture med kod, worker, borttagning och rename utanför worktree.
Policyn körs också från de åtta filerna; saknat importberoende blockerar.
Den separata testprocessen rensar ärvd `NODE_TEST_CONTEXT` och verifierar
faktiskt antal körda prov; exitkod noll ensam räcker inte som kvitto.
Ny exakt-head-CI krävs före merge.
Budgetar, behörigheter, deployspärrar och produktionsdata ändras inte.

Produktcontainern installerar nu låsta beroenden före källkopieringen, så en
vanlig kodändring kan återanvända installationslagret. En selektiv CI-kontroll
bygger Linux-imagen, kontrollerar cacheträff efter en källändring och provar
beroenden samt privata bootstrap-rättigheter utan nätverk.

Main kör fortsatt full regression och produktionsledgergrind. Endast
Moving-imagens ombygge väljs från GitHubs kompletta, verifierade pushintervall.
Saknad historik, avvikande SHA, ogiltigt event och manuella körningar behåller
ombygget. Ändrad eller borttagen worker-kod kan inte döljas av en senare
dokumentationscommit. Lokalt passerar 174 fokuserade tester utan överhopp.
Linux-bygget och cachekvittot körs i den aktuella pull requestens
`Product container cache check`; Docker finns inte på denna Windows-värd.
Ingen merge eller produktionsdriftsättning ingår i denna kvittens.

Medie-/behörighetskontrakt och migrationsspåret är oförändrade.
Bandbreddsbesparing är ännu inte verifierad; faktisk månadsbesparing måste
mätas efter integration.

## Talade repliker och tysta Idle-beteenden — 21 oktober 2026

På Jakobs beslut samlas tal under **Talade repliker** och tysta beteenden
under **Vila/Idle**. De sex tomma tur-/resultatfacken tas bort från klippkarta
och import; spelhändelserna finns kvar som villkor. Kort, reveal och skon har
egna handlingsfack. Skarp inventering före ändringen: inga registrerade
`turn.player`-/`settle.*`-filer, Dragan har fem idlefiler. Inga mediefiler,
talgranskningar eller historiska paket har flyttats eller raderats.

Idle-editorn sparar händelseregler i befintligt projektformat. Tur och resultat
väljer tysta beteenden endast från serverns committade händelser, med paket-/
versionskontroll och väntan på kort, tal och klippgräns. Inställningarna kräver
sparning, rumspublicering och klippval **Regler**; inga befintliga beteenden
aktiveras som bieffekt. Lokalt 149 fokuserade tester samt 137 tester i den
utökade kontrollen gröna (delvis överlappande), därefter 230 tester i
commitkontrollen. Studio- och Admin-typkontroll passerar. Materialskaparen
följer samma indelning; äldre tester som krävde sex reaktionsfack är ersatta
med kontroll att sådana fack inte skapar betalda jobb. Leveransstatus och
CI för denna ändring följs i [PR #310](https://github.com/Jakeminator123/scoutgaming/pull/310). Ingen
databasmigrering krävs. Granskningsrättningen bevarar egna villkor vid lägesbyte,
behåller resultatval genom lyckad collect och blockerar dem i nästa runda.
Specifika resultat går före generella; likvärdiga alternativ väljs med begärans-ID.
Astrids bundna globala Idle-policy följer med som en explicit fryst dealerpolicy.
Neon Launch är aktiverad med Jakobs prisgodkännande; migrationsberedskapen
passerar igen. Fast 0,25 CU har inte aktiverats: RunPod gör bildberäkningen,
men Neon ligger i strömmens återkommande kontroller och låsförnyelser.
Låg observerad belastning bevisar inte kapacitet under samtidig läppsynk.

## Dragan: separata skonfack och automatisk filmövergång — 21 oktober 2026

`Till skon` och `Från skon` delar händelsegrupp, men ska behålla separata
standardklipp och egna alternativ. Den tidigare sparfunktionen vägrade koppla
en andra riktning när gruppens standard redan hörde till den första.
Admin sparar nu den andra riktningen som ett separat val i befintligt format,
utan att ersätta den första. **Lägg till som variant** behåller standarden och
lägger till det valda klippet endast i sitt fack. Den befintliga gemensamma
variantgränsen, N1-kontrollen och revisionskontrollen behålls.

Lokalt verifierat: båda riktningarna genom sparning/återläsning och serverns
mediekontroll, separata alternativ, byte av ett standardval utan grannändring
och avvisning av fel fack: 59 fokuserade tester gröna, inklusive Admin-knappen.
Admin- och Studio-typkontroll passerar. Ingen databasmigrering eller medieuppladdning krävs.
PR [#304](https://github.com/Jakeminator123/scoutgaming/pull/304) är mergad
som `3c3f27e19e8cdaa38b65d2ce4cf0883d7fa34e98`: full PR-CI grön och
automatisk kodgranskning utan fynd. Vercel-produktion
`dpl_B77rPVKWdtSM9mNf9RtAFbV1euRY` är READY på samma SHA och har
`www.scoutgaming.tech` som aktiv alias. Till skon har därefter kopplats och
sparats genom Admin med ny serverrevision. Efter full omladdning visar båda
riktningarna **Kopplat i sparat utkast**.

På Jakobs begäran väljer filmplaneraren nu
de sparade skonstandarderna vid VILA/REDO-gränser och behåller inbakade
returer. Fryst publicering och vanlig förhandsvisning använder samma urval;
spelaren håller övergång och kortfilm under samma avbrytbara ägare utan att
ge övergången kortspår. 125 fokuserade tester passerar, inklusive publicering,
medieisolering, posegränser och avbrott. PR
[#305](https://github.com/Jakeminator123/scoutgaming/pull/305) är mergad som
`f7c11c48663b090f4ef1bc890520ddc2f23b4b98` efter godkänd obligatorisk CI,
inklusive migrationskontroll och Studio-typkontroll. Äldre öppna
GitGuardian-flaggor i `test/moving-speech-budget.mjs` (incident 38406810 och
38786588) gäller testetiketter från main; de har inte ändrats eller ignorerats.
Vercel `dpl_6GzXaGAQ8pBszZzuJ8KdbWi9QVzQ` är READY på samma SHA med
`www.scoutgaming.tech` som alias. Hela main-CI passerar. Render
`dep-dbc9bm0u01pc73d1akt0` blev live 10:40:14 UTC på samma SHA;
`/__cloud/version` bekräftar SHA och `/__cloud/health` svarar 200 `ok`.
Det isolerade visuella scenprovet startade inte: Admin begärde ny inloggning.
Inget visuellt spelprov på den nya versionen påstås verifierat.
Redan öppna spelflikar behöver laddas om för att begära de separata klippen;
äldre klienter fortsätter med sina tidigare kompletta kortfilmer.
Genererad talutdelning och automatisk variantrotation ingår inte.

Skarpt verifierat 21 oktober: `in_vila_till_redo`
(`d8817df6-77ee-4cf4-b2f4-0cbad4e38201`) är standard i Till skon och visades
VILA → REDO. `ut_redo_till_vila`
(`9c2c2285-e80b-42c3-acee-8682276e47d7`) behålls som standard i Från skon.
Ingen film laddades upp eller ersattes. Dragan tests enda sammansättning
publicerades genom Admin till **paket 6**, 21 oktober 10:18:00 UTC, för
`room-8bd056a2-d5c5-a622-2766-faf75dbbcfa2`. Kvittot och versionen verifierades
efter omladdning samt genom en läsande registerkontroll. Projektkopplingarna
lästes separat: Till skon har eget slot-ID och Från skon behåller sin baseline.

## Dragan: varför svaret visas som text — läsdiagnos 19 oktober 2026

Jakob såg ”Dragans röstvideo saknas. Svaret visas som text.” i produktion
och tolkade det som en saknad inspelad video. Orsaken är en annan: genererat
tal skickas bara när dealerns `speechProfile.state` är `enabled` i Studio och
Render kör `CROUPIER_MOVING_SPEECH_ENABLED=1` (`services/game/server.mjs`
rad 1141–1171, `generated-speech-chat.mjs`). Läst i Admin 19 oktober ~12:00 UTC:
Dragans profil står i `preparation`, Drift visar önskat Av (revision 12),
`connected:false`/`drift_runtime_unavailable` och senaste observation från
POST-LIPSYNC5:s closeout 10:43 UTC. Det är provprotokollets avsedda slutläge,
inte en regression. Klienttexten är ändrad till ”Genererat tal är inte aktiverat
för Dragan just nu. Svaret visas som text.”; `test/chat-decision-player.mjs`
passerar 14/14. Inga serverkontrakt, grindar eller prov ändrades.

Klippinventering ur registret (56 Dragan-filer, alla tillgängliga): 35 Kevin-
tagningar (plats 1–7, öppet/dolt, vändning med i/iv/v/base), 10 äldre `deal_pos*`,
5 grundloopar, båda skövergångarna (`in_vila_till_redo`, `ut_redo_till_vila`)
och fyra inspelade repliker (goodluck, insurance, double, win). I projektet är
goodluck/insurance/double bundna; `win_1` är uppladdad men obunden och övriga
13 repliker, inklusive välkomsthälsningen, saknar film. Skövergångar och
reaktionsfack spelas inte av spelaren ännu oavsett uppladdning. Rummet
`Dragan · dynamiskt taltest` är öppet på paket 4 (publicerat 18 oktober
14:31:54) utan väntande utkast. Radera inte dealern/klippen: bankens 50 källor
hashbinds i `server.mjs` rad 1420–1427 och ger `moving_speech_bank_source_missing`.
Papperskorgen innehåller `paow-kevin` (11 arkiverade filer), `anna-jonsson` (2)
och `adminprov-2026-10-13`; permanent radering är ett separat beslut.
`origin/kevin-staging` är inte mergad i main (190 commits utanför); Kevins
bidrag i main är de registrerade källklippen från PR124/128.

Molnläsning samma tid, inget ändrat: Vercel production
`dpl_FkpqF9VDGiHu8hSzBUZLfEK8qhmY` och Render `dep-dbb001rrjlhs73d2u1eg` är båda
LIVE/READY på main `1c8dc82f`; inga 5xx eller fel i loggarna. Render har
`CROUPIER_MOVING_SPEECH_ENABLED=0` och alla `CROUPIER_MOVING_SPEECH_*`-namn
satta; RunPod-kontot har 0 pods, 0 körande workers och endpoint `zjsdlni6cn8dvo`
(max 1, idle 60 s, CA-MTL-1). Vercel-pluginens anslutning ger 403 för teamet
`scoutgaming`; CLI fungerar. `CROUPIER_STUDIO_MOVING_DRIFT_API/_PROFILES` saknas
i `docs/environment-variables.json` för både Studio och spelservern.

## Budgettaken höjda: grant 150 USD, dygn 60 USD, provider 250 USD — 21 oktober 2026

Jakob frågade vilken budget som stoppade och bad om höjning. Det är våra egna
reservationer (1,20 USD per försök, aldrig återförda), inte RunPods saldo:
RunPod gick 26,91 → 26,16 USD under hela 19 oktober. Granten var 44,40 av
45 USD (37 reservationer) när arbetet började. PR306 (`d924d330`): kodtak
`MOVING_BUDGET_MAX` 45 → 150 USD, provider 75 → 250 USD, dygn 40 → 60 USD;
migration 019 (`deploymentOptional`) vidgar de tre moving-CHECK:arna till
150 USD och dygns-CHECK:en till 60 USD, planeraren projicerar tillbaka för
017/018/011/002. 019 applicerad i produktion ~11:55 UTC (ledger 001–019,
återläst). Amendment `24a07c73` (grant 45 → 150 USD, fönster 105,6 USD,
täckning 154,4 ≤ 250 USD, arbetare dränerad) och policyraden 40 → 60 USD
bokförda via journalens bekräftade funktioner; bevis-JSON i Jakobs `%TEMP%`.
Render deployar `d924d330` efter CI på main; tills dess gäller min(kod 45,
sparat 150) = 45 på servern. GitGuardian flaggade PR306 (incident 38786588);
diffen innehåller bara konstanter och test-ID:n — granska/avfärda i panelen.
Ingen ”budgetlös” variant finns; taket är avsiktligt. Rotfil
`DRAGAN-TAL-FORKLARING-2026-10-19.txt` (PR303) förklarar hela kedjan enkelt.

## Fem repliker i följd i produktion — 19 oktober 2026, 19:06–19:13 UTC

Jakobs krav ”4–5 repliker i följd” uppfylldes på `main` `4a4d502b` (Render
LIVE 18:55 UTC), spelvy `/play/blackjack?operator=dragan-test`, Klippval
OpenClaw, uppspelning av (Voice off), alla fem `generated-lipsync-stream`
`ended`, `completed:true`, samtliga bildrutor mottagna:

| Skickad (UTC) | Fråga → svar | Totalt | Ström→bild | Rutor |
| --- | --- | --- | --- | --- |
| 19:06:54 | ”Blanka och Zelda är bäst” → ”Blanka och Zelda är bäst.” | 116 s (kall) | 13,6 s | 57/57 |
| 19:08:57 | namn/spel → ”Jag heter Dragan, och vi spelar blackjack.” | 45 s | 18,3 s | 69/69 |
| 19:09:50 | lycka till → ”Lycka till på nästa hand, Jakob!” | 47 s | 19,6 s | 65/65 |
| 19:10:43 | kortlekar → ”Jag har inte information om hur många kortlekar som finns i skon.” | 61 s | 30,4 s | 110/110 |
| 19:11:50 | god natt → ”God natt, Jakob. Sov gott!” | 51 s | 20,7 s | 62/62 |

Render-loggen 19:05–19:14 UTC: fem arbetar-websocketsessioner (18–35 s),
inga `moving_drift_readback_failed`, guard-, bank- eller budgetavslag.
Varm arbetare (nästa fråga direkt efter föregående svar) ger 45–60 s helt
förlopp mot 116 s kallstart; den återstående tiden är främst text + röst +
GPU-kö, inte spegelfönstret. Svenska frågor gav svenska svar. OpenClaw
svarade fel i sak på kortleksfrågan (skon har åtta lekar) — modellfråga, inte
transport. Kvalitet på röst/läppsynk är fortfarande inte granskad av människa
(`reviewStatus pending`); canvas-export av bildrutor ger tomma bilder, så
visuell granskning sker i spelvyn.

Vad som krävdes samma kväll för att komma dit:

1. **Dygnsbudget.** 16 reservationer (19,20 USD) hade fyllt dygnets 20 USD;
   chatten visade ”Dagens budget för läppsynk är nådd”. Taket sitter i tre
   lager: kod (`MOVING_TRIAL_BUDGET`, sessionsvalidering, journalens max),
   policyraden `gpu_budget_policies` och dess CHECK-constraint (011).
   PR299 (`4a4d502b`) höjer koden till 40 USD och inför
   `journal.amendBudgetPolicy` (bekräftelse `apply-explicit-daily-budget-
   amendment`); PR301 (`eeb85eff`) är migration 018 (`deploymentOptional`)
   med constraint 40 USD. 018 applicerades i produktion 19:04 UTC med
   `tools/check-migration-readiness.mjs --apply` (ledger 001–018, alla
   strukturbevis OK, återläst), därefter policyraden 20 → 40 USD via
   `amendBudgetPolicy` (bevis-JSON i Jakobs `%TEMP%`). Dygnet 2026-10-19 har
   efter serien 21 reservationer / 25,20 USD av 40; granten 45 USD har
   35 reservationer / 42 USD — **tre 1,20-fönster kvar** innan en ny
   grant-amendment behövs (journalens maxtak är 45 USD; högre kräver kod).
2. **Grundloopsgrinden** (”Svar klart · väntar på ledigt bord” i minuter,
   18:21 och 18:30 UTC igen): Chrome avbryter video-only-uppspelning i en dold
   flik med ”paused to save power”; `live-idle.failed()` svartlistade då
   grundloopen permanent, ingen idle-bildruta kom och talgrinden öppnades
   aldrig förrän sidan laddades om. PR300 (`cursor/idle-powersave-retry`)
   gör om försöket för övergående avbrott och återupptar vid synlig flik;
   regression med Chromes exakta text. Mergad som 82b112a5 (PR300); Render-
   deploy följer CI på main och är inte verifierad live i detta stycke.
3. **Spegelfönstret** (PR297) nekar fortfarande en fråga som skickas ~60–80 s
   efter föregående svar, nu med `drift_busy` → `drift_not_admitting` i
   guard-fasen i stället för observationsfel. Kvar: låt guard-fasen vänta på
   nästa observation i stället för att falla direkt.

## Kvällsprov med Jakob: budget, spegelfördröjning, grundloopsgrind — 19 oktober 2026, 16:30–17:30 UTC

Jakobs egna försök 16:41–16:47 UTC föll med
`generated_speech_total_budget_exhausted` i chatten visad som den allmänna
texten ”Rösten eller läppsynken kunde inte skapas. Försök igen.”; journalen var
25 reservationer / 30 USD. Åtgärder: amendment `5fa14c5f` (grant 30 → 45 USD,
journalens tak; provider-tak 75 USD oförändrat) och PR296 (`25e80444`) som
visar ”Provbudgeten för läppsynk är slut …” i stället för att föreslå nytt
försök. Ett `moving_bank_rejected code=stale_round_revision` 16:34:56 var inte
ett fel: svaret avbröts för att rundan ändrades under förberedelsen.

Prov 16:51 UTC (”välkommen till bordet, Jakob”) blev klart på servern efter
27 s (`ready` 27,3 s) men klienten stod i ”Svar klart · väntar på ledigt bord”
i över tre minuter. Orsak på klienten: talgrinden öppnas först när dealerns
grundloop visat en bildruta, och grundloopen låg fast i Chromes
”play() request was interrupted because video-only background media was
paused to save power” från när fliken var dold; felkoden ingår inte i
grundloopens omstartslista, så bara omladdning hjälpte. Öppen klientbrist:
återuppta grundloopen när fliken blir synlig igen. Efter omladdning spelades
prov 17:02 UTC (”Välkommen till bordet, Jakob.”) i publicerad spelvy: `ended`,
`completed:true`, 61/61 bildrutor, ström→första bild 21,1 s, helt förlopp
129 s (text + förberedelse ≈ 105 s). Render-loggen hade inga avslag.

Prov 17:04:56 UTC (”Blanka och Zelda är bäst”) nekades av guarden
(`moving_speech_unavailable`, fas guard) efter 3,5 s. Loggen belägger
**spegelfördröjningen vid nedstängning**: arbetaren stängde 17:03:42, podden
försvann ur REST vid 60 s tomgång, och 17:04:44–17:05:01 rapporterade health
fortfarande `running=1` medan REST-listan var tom (samma mönster 16:53:04–:24
och 16:35:58–16:36:14). Observatören nekade varje tick i fönstret. PR297
(`d9c27979`): en enda olistad frisk arbetare utan pågående jobb rapporteras som
ett upptaget jobb (dränering, aldrig kapacitet, aldrig Off); två olistade,
unhealthy/throttled eller jobb utan pod nekas fortfarande. Praktiskt: en fråga
cirka 60–80 s efter föregående svar träffade fönstret; efter PR297 ska den
i stället vänta på ledig plats. Render blev LIVE på `d9c27979` 17:37:15 UTC.
Tre spelade händer 17:36–17:43 UTC (vinst, förlust, bust) körde filmade
giv/hit-klipp utan presentationsfel; inget nytt talprov har ännu körts på den
rättade observatören, så spegelfönstret är rättat i test men inte belagt live.
Jakobs eget prov 17:33 UTC (”?” → ”What's up, Jakob?”, på kod `25e80444`)
spelades: `ended`, `completed:true`, 48/48 bildrutor, ström→bild 13,5 s,
helt förlopp 123 s. Jakob bekräftade i chatten att det fungerade. Kvar för
människa oförändrat: röst/läppsynk-kvalitet, svarstid (~105 s text +
förberedelse före GPU), OpenClaw svarar på engelska på svenska frågor.

Övrigt samma kväll: Vercel `commandForIgnoringBuildStep` bygger nu bara
`main`, `jakob/*`, `codex/*` och `cursor/*` (tidigare hoppades bara exakt
`kevin` över; `kevin-staging`, `roulette-on-kevin-staging`, `emil`, `john`,
`jakob-export` byggde förhandsvisningar). Render `croupier-v2` har inga
PR-förhandsvisningar (`previews.generation=off`, autodeploy `main` efter CI).
Miljövariabler: alla sju obligatoriska `render-game`-nycklar finns på Render;
saknade villkorliga nycklar gäller lokala kataloger, P6-QA, Bettalotto och
lagringsexport, inte Dragans tal. Kevins grenar refererar 40-talet egna namn
(`DRAGGE_LIPSYNC_ENDPOINT`, `RORLIG_*`, `LIPSYNC_POD_*`, `GEMINI_*`,
`CARTESIA_VOICE`, `TABLE_DB` …) som hör till hans separata server under
`kevin/croupier-scoutgg/` och inte används av `main`; inget saknas för Dragan.
Odokumenterade nycklar satta på Render: `CROUPIER_BACKEND_ORIGIN`,
`CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_STUDIO_NATIVE_ADMIN` (ej åtgärdat).

## Bank-403 belagd och rättad; Dragan svarade med tal — 19 oktober 2026, 14:27–14:35 UTC

Med barndiagnostiken från PR292/293 live (`7d9886ce`) och amendment
`cfb73003` (grant 24 → 30 USD, 20 historiska reservationer bevarade) visade
tredje provet 14:28 UTC hela orsakskedjan i Render-loggen:
`moving_drift_readback_failed drift_observation_unverified` varje tick under
jobbet → `moving_drift_guard_rejected phase=dispatch reason=runtime_unavailable
observationAge=missing` → `moving_bank_rejected 403` → `moving_worker_closed`.
Ett läsande prov mot verklig RunPod-REST/health 14:31:01–14:31:12 UTC visade
varför observatören föll: när jobbet dispatchas till en **cachad idle-slot**
rapporterar REST podden `RUNNING` med `jobs.inProgress=1` i cirka tolv sekunder
medan health fortfarande säger `idle=1, running=0, initializing=0`.
Observatörens villkor `initializingPods <= workers.initializing` (1 ≤ 0) föll,
exekutorn ogiltigförklarade observationen och guarden nekade bankhämtningen.
Kallstart (prov 4 kl 09:54) och sena bankhämtningar (prov 14:30) klarade sig
för att health hann ikapp. Det är den historiska bank-403:ans orsak.

Rättning i `moving-drift-observer.mjs`: en levande pod som health ännu inte
räknar som running får förklaras av `initializing` **eller** den cachade
`idle`-slot den värms från, och rapporteras som `initializing` (aldrig ready
eller dold); oförklarade poddar, unhealthy och dubbla slots nekas fortsatt.
Regression med exakt den observerade providerbilden; 163 moving-prov passerar.

Fjärde provet 14:30:49 UTC (”Säg bara: hej igen Jakob.”) gick igenom i
publicerad spelvy: chatten ”hej igen Jakob.”, `generated-lipsync-stream`
`ended`, `completed:true`, 50/50 bildrutor, ljudstart 17,3 s efter ström,
klientens hela förlopp 122 s (varav ~94 s text + förberedelse). Hörbar röst och
läppsynkens kvalitet är inte granskade av människa (`reviewStatus pending`).
Journalen är nu 24 reservationer (2 nekade 403-försök, 1 budgetnekat utan
reservation, 1 lyckat) inom grant 30 USD; cirka tre 1,20-fönster återstår.

**Verifierat på rättad kod:** PR294 mergad som `3fd3b843`, Render
`dep-dbb2tr942hec73e74ip0` LIVE 14:56:34 UTC. Femte provet 15:02:13 UTC
(”Vad heter du och vilket spel delar du?”) svarade ”I'm Dragan, and we're
playing blackjack.” med `ended`, `completed:true`, 71/71 bildrutor, ljudstart
20,5 s efter ström, hela förloppet 117 s; Render-loggen hade **inga**
observations-, guard- eller bankavslag under jobbet. Flaggorna och Sparläge
är kvar på; journalen har efter detta cirka två 1,20-fönster kvar inom 30 USD.
Kvar för människa: hörbar röst, läppsynkens kvalitet och svarstid (text ≈ 80 s
innan GPU-steget startar; se `reply_ready_ms`), samt att OpenClaw svarade på
engelska på en svensk fråga.

## Flaggor på, första prov och synlig barndiagnostik — 19 oktober 2026, ~12:30–12:45 UTC

På Jakobs uppdrag (”sätt på alla flaggor”): Render `croupier-v2` fick
`CROUPIER_MOVING_SPEECH_ENABLED=1` via API (deploy `dep-dbb0r1ff3r2c73frpa2g`,
LIVE 12:33:09 UTC på samma kod `1c8dc82f`); Drift sattes till Sparläge/Basprofil
(revision 13, `connected:true`, `admission.allowed:true`); Dragans talprofil sattes
till `enabled` genom det ordinarie projektskrivaren (revision
`studio-c4666576-db78-421a-a69d-5885c8bc9075`). Flaggorna lämnas på; Av i Drift är
ordinarie stoppväg. RunPod-endpointen har max 1 worker och 60 s tomgång, så
vilokostnaden är noll. Journalens grant 24,00 USD har 1,20 USD kvar efter
POST-LIPSYNC5:s 19 reservationer; fler jobb än ett kräver en ny append-only
CAS-höjning inom Jakobs tak.

**Provet 12:35:30 UTC** (text ”Svara kort på svenska: säg hej Jakob.”, OpenClaw,
ljud på) misslyckades efter 22,4 s i förberedelsen med klientkoden `chat_failed`
(stages text 630 ms, video-queue 4,6 s och 15,6 s). Enda serverloggen är
gatewayns `moving_bank_rejected stage=authorization code=drift_not_admitting
httpStatus=403`: workerns bankhämtning nekades av driftguarden medan jobbet
pågick — samma symptom som det tredje provets bank-403. Guardens exakta orsak
syns inte, eftersom spelprocessens stdout kastas i produktion
(`process-group.mjs`, `stdio:'ignore'`); H6:s `moving_drift_guard_rejected`-
och `readback_timing`-diagnostik har därför aldrig nått Render-loggen. Observationens
ålder i vila är 1,2–3,5 s mot 15 s gräns; under jobb är den omätt.

Rättning i denna leverans: `ops/cloud/child-diagnostics.mjs` vidarebefordrar
endast allowlistade, ändliga barnhändelser (guardorsak, readback-timing/fel,
förberedelse-/strömkvitton med säkra koder och id:n, recovery) till
plattformsloggen med `source:"game"`, högst 2000 rader per process; startrader,
fri text och allt annat kastas fortsatt. Ingen grind, tidsgräns eller budget ändrades.

**Uppföljning 13:42 UTC på main `b018590d` (PR292 mergad och LIVE 13:33):**
nytt textprov nekades efter 8,3 s med `generated_speech_total_budget_exhausted`
— det nekade jobbet 12:35 behöll sin 1,20 USD-reservation, så granten 24,00 USD
är fullt reserverad (20 reservationer). Ett nytt prov kräver en append-only
amendment via `authorizeMovingBudgetAmendment`; dess 50 USD-providertak
(`MOVING_PROVIDER_BUDGET_MAX_MICRO_USD`) är i praktiken nått eftersom alla
äldre fönster räknas som behållna (kalkyl 49,72 USD). Jakob gav 15:45 UTC
mandatet ”om detta inte går har du tillåtelse” med målet fungerande tal inom
några timmar; providertaket höjs därför till **75 USD** i kod (denna leverans)
och en amendment 24 → 30 USD (fem 1,20-fönster; kalkyl 1,02 + 47,00 + 6,00 =
54,02 USD) appliceras efter deploy via journalens `authorizeMovingBudgetAmendment`
med färsk drained-läsning från providern. Journalkapaciteten 45 USD och alla
20 historiska reservationer består. Första vidarebefordran missade dessutom att spelet
loggar dessa händelser med `console.warn` (stderr); `process-group.mjs` observerar
nu båda strömmarna genom samma allowlist, verifierat med en riktig barnprocess.

## Klippnamn och poskedja — 19 oktober 2026

Ny gemensam namnregel i `packages/presentation/contracts/clip-naming.mjs`
(fack + Kevins i/iv/v/base-suffix som poskedja + språk/tagning för repliker)
driver importassistentens filnamnsförslag och täcker alla 36 fack inklusive
skövergångar, reaktioner och VILA/REDO-bilder. Utdelnings-, vändnings- och
övergångsklipp kan nu bära `startPose`/`endPose` = VILA/REDO i klassificeringen
(schema och `validateClipPoses`); importraden visar och låter ändra kedjan,
klippkartan och mediebiblioteket visar den som läsbricka. Deklarationen är
authoringmetadata; spelarens filmade sekvens använder fortfarande den verifierade
profilen. Verifierat: 163 Studio-prov (importkatalog, intake, klient, komponenter),
36 ops-prov, båda typkontrollerna, env-register och orphan-kontroll. Guide i
[README](../apps/studio/docs/README.md) och teknik i
[runtime-referensen](LOCAL-PRESENTATION-RUNTIME.md#klippnamn-och-deklarerad-poskedja-19-oktober-2026).

## MERGE4: verifierad legacy-städning och main-flöde — 19 oktober 2026

Den avslutade registerflyttens `prepareLegacyStudioSnapshot` hade endast
ett eget test som konsument. Hjälparen, det testet och dess enda fullrunnerpost
är borttagna. Två andra testfall som endast låste gamla Control-wrappers har
rensats; sex aktiva komponentprov för dealer-/policygräns och klippval kvarstår.
Oberoende konsumentinventering och egen sökning omfattade kod, verktyg,
guider och CI. Aktiva legacy-fixturer, middleware, klipppolicy och återanvända
Control-redigerare behålls; de har konkreta Admin-/runtimekonsumenter.

Main-flödet och återställningsproceduren finns i CLOUD-MIGRATION,
ENVIRONMENT-RESTORATION och docs/AI/scoutgaming-agentflode. Förbrukade
separata frontend-/Studio-återgångsinstruktioner har ersatts med kontroll av
den samlade produktens faktiska web-/gameversion, schema och miljökontrakt.
Användarsteg, produkttermer och tekniska format behåller sina kanoniska guider.

Egen verifiering: 67 repository-/policy-/kontrollprov samt det isolerade
cutoverprovet och sex kvarvarande komponentprov passerade. Cutoverprovet
kunde först inte laddas utan `ws`; låsta beroenden installerades i denna
arbetskopia och provet passerade därefter. Delade Studio-beroenden återanvändes
först efter identisk package-/lockhash. Ordinarie hook passerade 39/39; dess
första Windows-timeout i ett FFmpeg-fixturprov passerade både separat och vid
hel omkörning. Samlad main har 525 JS/TS-testkandidater och 0 föräldralösa;
Pythoninventeringen är separat. Inga privata data, medier, molninställningar
eller andra agenters arbetskopior rensades.

[PR281](https://github.com/Jakeminator123/scoutgaming/pull/281) är mergad som
f03c5ccf efter grön CI och oberoende slutgranskning utan blockerare. Även
PR278/280/282/283 är mergade. Samlad main
`a2dc503e2c63ef49107c0a1074880349e1898c61` har grön
[main-CI 39206231216](https://github.com/Jakeminator123/scoutgaming/actions/runs/39206231216),
Vercel `dpl_GtYpcfRMYV32jFxGcgcExZziLFhH` READY/www och Render
`dep-dbar0qu7bikc73euh400` LIVE. MERGE4 återläste publik version och hälsa
05:55:42 UTC den 19 oktober. Egen integrationskontroll bekräftar att de sju
pensionerade filerna saknas och de granskade UI-/beteendefilerna är bytebevarade.
Det är kod-/publiceringsbevis; bankens HTTP403 och talacceptans är separata.

## Driftväljare: Av och Sparläge — 19 oktober 2026

HUVUDAGENT6 äger backendrättningen nedan, UI/UX2 Admin och POST-LIPSYNC5
aktivering/prov. API/kontrollplanet i PR270 är mergat via `cb0c3275`. MERGE4
bekräftade PR275:s granskning, grön CI/readiness och publicering på Vercel/Render
från main `087f4fd5f8b354371521d49c52d8ab210f9ee6b0`. Det är tillskriven
publicering, inte HUVUDAGENT6:s GPU-/talacceptans.

GET/POST återanvänder N1, färsk session, origin/CSRF och miljö/workspace.
Behörighet och POST-state delar SQL-transaktion. Browserkontraktet är oförändrat;
önskat läge är aldrig ett kvitto på genomförd GPU-drift. `connected` kräver nu
en matchande färsk executorlease/observation i samma databas, inte bara en envflagga.
Första runtimekopplingen gäller exakt en verifierad profil/endpoint med min0/max1,
Av och Sparläge. Varm drift och jämförelse/profilbyte är inte anslutna.

Talets första admission-token bevaras genom förberedelse och väntan. SQL-journalen
kontrollerar den atomiskt vid reserve/current/submit och sist före provider-POST,
i låsordningen Studio → drift → speech. Av revokerar äldre försök; en snabb
Av → Sparläge behåller krav på avbrott/drain. Sessionsavbrott, bankhämtning och
tal/utdata använder samma token. Astrid behåller sin tidigare journal utan hook.

Executor gör endast leverantörsläsning och avbryter journalägda jobb. Den skapar
eller ändrar ingen endpoint. Ny/felande/gammal observation blir unknown; Av
kräver färsk tom leverantörskapacitet och tömd journal. Health/deploymentdata
påstår aldrig att modell/bank redan är varm. Befintlig exakt runtimeattestering
och faktisk kostnadsreservation gäller fortfarande vid varje talstart.

Gräns: avbruten eller okänd submission utan känt jobb behåller reservation och
kan hålla status i stopping/blockera nästa körning. Ingen automatisk återhämtning,
återbetalning eller retry hävdas. Ett redan tillåtet/pågående nätanrop kan inte
göras oskickat av Av; det hanteras som pågående/osäkert tills kvittot kan verifieras.

SQL017 är nu required efter POST-PISYNK4:s verifierade apply 19 oktober 02:32:59 UTC
(endast 017; äldre ledger oförändrad). POST verifierade även enbart 016 apply
03:02:56 UTC med oförändrad ledger/budget och tom kontrolltabell. Det är
tillskrivna kvitton, inga egna molnkörningar. 016 är fortsatt deployment-optional
i manifestet; runtime kräver installerad tabell och separat aktivering.
Verifierat på föregående `c5c85bda`: 209 fokuserade tester samt 29 legacy- och 77 integrationskontroller
i verklig isolerad SQL/HTTPS/omstart, plus fyra mediekontraktsprov. Både Windows
och sista Linux/WSL-provet använde Node 24.21.0. 214 namngivna källfiler var
oförändrade genom det breda provet; detta är inte liveprovider- eller GPU-acceptans.
De två importernas dubbla schema-listor ersattes med gemensam required-readiness;
installerad ledger och rollback kontrolleras fortsatt. Egna fixturekluster och
den tillfälliga Linux-Node-installationen rensades efter provet.
Sluträttningen klarade 39 fokuserade och fem browserbindningsprov; integrationen
med PR274/main `b3ff83d4` klarade 125 prov. PR275:s slut-CI/readiness passerade
enligt MERGE4; den separata konfigurationsrättningen nedan har egen CI.
Inga molnvariabler, produktionsdata, mediefiler eller GPU-jobb ändrades här.
[Tekniskt kontrakt](LOCAL-PRESENTATION-RUNTIME.md#driftvaljare-kontrollplan) och
[serverkonfiguration](ENVIRONMENT-VARIABLES.md#driftvaljarens-api).

### Säker driftorsaksdiagnostik — HUVUDAGENT6

Det tredje produktionsprovets bank403 är fortsatt olöst; POST:s exakta
prov-/stopp-/budgetkvitto finns i [egen sektion](#post-lipsync5-produktionsprov).
En kontrollerad offlinekedja visar att 2 s pollintervall +14 s lyckad läsning
kan ge 16 s gammalt föregående bevis och nekat dispatch utan readback-fel.
Det är en reproducerad mekanism, inte prov3:s fastställda historiska orsak.

Diagnostiken fångar nu första fallande guardorsak/fas, ändliga ålders-/
leaseklasser och matchningsbooler från samma nekande SQL-state/DB-klocka.
Allowlistad metadata överlever felkloningen; loggning sker först efter
kvitterad rollback. Läsvarvens ändliga fas/tidsklass skiljer långsam success
från failure. [Kanoniskt loggkontrakt](LOCAL-PRESENTATION-RUNTIME.md#driftvaljare-kontrollplan).

191 fokuserade observer-/executor-/controller-/diagnostik-/SQL-journal-/
session-/runtime-/bankprov passerar med Node24.21.0 och fyra workers.
De täcker orsaksprioritet, samma snapshot utan extraläsning, rollback/ACK,
metadata/getter/proxyfiltrering, loggerfel och långsam lyckad läsning.
CI upptäckte att det nya säkerhetstestet saknade fullsvitsregistrering. Det
är nu inkopplat i befintlig database/moving-drift; orphan-grinden behålls.
SQL-fixturens befintliga källista hashbinder också den importerade hjälparen.
Kontrollen finner 526 JS/TS-testkandidater och 0 orphans; registrerad grupp
passerar 66/66. Verktygsproven ger 17 PASS och fem POSIX-fall är explicit
överhoppade på Windows. Ingen orphan-exception eller grind har ändrats.
Oberoende slutgranskning fann inga blockerande fynd. POST:s överlämnade
stoppcommit7def8fe9 är integrerad med egen sektion bevarad.

Inga freshness-, Av-, fence-, auth- eller budgetgrindar sänks. Publika felkoder,
bankheader, providergränser och scheman är oförändrade. Inga moln-, GPU-,
finansierings- eller migrationsåtgärder gjordes. MERGE4 äger slutlig CI,
granskning och publicering; POST äger eventuellt senare avgränsat prov.

### Gateway-RPC: deterministiskt deadlineprov — HUVUDAGENT6

MERGE4 rapporterade att PR288:s OpenClaw-prov nådde korrekt timeout men fick
noll serveranslutningar i stället för testets förväntade en. En isolerad lokal
WebSocket med 120 ms fördröjd handskakning reproducerar detta: klientens
40 ms-deadline avslutar säkert innan någon serveranslutning registreras.
Det är ett race i testantagandet, inte bevis för ett produktionsfel.

Deadlineprovet använder nu befintlig WebSocketImpl-injektion för tyst
handskakning respektive obesvarad config.get. Verklig klienttimer är kvar;
exakta frames, en konstruktion och en stängning verifieras. config.patch
ligger efter lyckad get och skickas därför aldrig vid timeout. De övriga
riktiga WebSocket-proven för signering, scope/version och osäker mutation
är bevarade. 13/13 prov och oberoende läsgranskning passerar utan blockerare.

Endast testet och denna handoff ändras. Produktkod, tidsgränser, auth,
OpenClawkonfiguration, moln, media, GPU och budget är orörda; PR288 hålls
fryst i den leveransen. PR289 är nu mergad/publicerad med full grön main-CI
39218098988 på2c7f1c0e enligt MERGE4:s publiceringskvitto.

### Cacheinitialisering och pinnad session — HUVUDAGENT6

Ett offlineprov visar att driftobservatören avvisade färsk providerdata med
exakt aktuell EXITED-cache och en extra initializing-räknare. Samma kalla
form godtas redan av kapacitetskontraktet. Avvisningen fick executorn att
ogiltigförklara observationen; controllern nekade då nästa current/dispatch
med `drift_not_admitting` trots oförändrad pinnad session.

Observatören räknar nu bara den extra initialisering som styrks av aktuell
scaled-down-cache med exakt image/version och `isStale:false` som cache.
Verkliga pods, oförklarade räknare, okända workers, färskhet och min0/max1
kontrolleras fortsatt. En cachepost blir aldrig modell-/bankattestering.
Ingen admission-, SQL-, lease-, Av- eller budgetgrind har ändrats.

Tre nya positiva regressioner föll före rättningen. Efteråt passerar 180
observer-/executor-/controller-/kapacitets-/provider-/SQL-journal-/session-/
runtimeprov med Node 24.21.0 och fyra workers; ordinarie hook passerar 28/28.
Provet med verklig observer/controller/executor behåller current/dispatch
för samma pinnade jobb, spärrar ny admission/reserve och nekar efter Av.
Saknad, gammal eller felaktig cache samt oförklarad kapacitet förblir nekade.
Oberoende läsgranskning fann inga blockerande fynd.

Det historiska felet 06:41:32 UTC saknar motsvarande exakt health/pod-snapshot.
Detta är en verifierad kodmekanism, inte bevis för just den körningens orsak
eller fungerande bankhämtning i produktion. POST:s stopp-/budgetkvitto och
återstående talacceptans finns i
[produktionsprovet](#post-lipsync5-produktionsprov). Inga moln-, provider-,
GPU-, finansierings- eller medieändringar gjordes i rättningen. MERGE4 äger
slutgranskning, CI och publicering; ett nytt betalt prov kräver nytt beslut
och ett faktiskt finansierat fönster.

### Avslutat providerjobb före callback — HUVUDAGENT6

POST-LIPSYNC5 belade 19 oktober att ett providerjobb blev `COMPLETED` med
workerresultat `failed/bank_http_rejected` redan vid receipthämtningen. Ingen
callback öppnades, men `ready()` väntade tidigare på den upp till startupgränsen.

Väntan övervakar nu det redan accepterade jobbets status och avvisas med den
befintliga säkra koden `moving_worker_closed` när jobbet är terminalt före callback.
Ordinarie cancellation/journalfinalisering gäller fortsatt; inga nya betalda
försök, återbetalningar eller ändrade timeout-/budget-/workergränser tillkommer.
Okänd providerstatus behåller callbackens ursprungliga tidsgränser och reservation.
Övervakningen upphör vid readiness/fel och bevarar callbackens eget abort-/attestfel.

Terminalregressionerna visade felet före rättningen. 129 session-/runtime-/provider-/
journalprov samt 38 transportprov passerar efteråt, inklusive användarabort under statusläsning och sent
terminalsvar. Gatewayns låsta `ws` installerades i denna arbetskopia för proven.
Oberoende läsgranskning fann inga blockerare. Bankens faktiska HTTP403 har ett
separat diagnosspår hos POST-LIPSYNC5; rättningen bevisar varken fungerande
bankhämtning eller godkänt tal/uppspelning. PR284 är mergad och publicerad;
POST:s andra produktionsprov nedan bekräftar felavslut efter 16,1 sekunder.

### Molnstart: driftprofil till spelprocessen — HUVUDAGENT6

Molnstartens explicita child-env tappade `CROUPIER_STUDIO_MOVING_DRIFT_API` och
`CROUPIER_STUDIO_MOVING_DRIFT_PROFILES`. Vid talflagga 1 blir då driftkonfigurationen
null och executorn avvisar initieringen. Det är ett reproducerat kodfel, inte
bevis att den historiska misslyckade deployen hann fram till just denna grind.

`codex/moving-drift-cloud-env` validerar en enda profil och exakt endpoint/release
i preflight. Endast det validerade JSON-värdet och flagga 1 går vidare till
spelprocessen när tal är aktiverat; Lab och avstängt läge får inga driftfält.
Bankhashen verifieras fortsatt mot verkligt bankarkiv av befintlig runtimegrind.

Två beteenderegressioner visade felet före rättningen; 42 cloud-config/runtime/
launch-prov passerar efteråt, inklusive source-closure-import utan frontend-/
speechberoenden. Isoleringsprovet behövde en tillfällig tom Lab-node_modules-katalog
för sitt realpath-krav; den är borttagen. Inga beroenden installerades.

POST-LIPSYNC5 äger talflagga, stoppväg, budget och aktiveringsprov; MERGE4 äger
granskning/CI/merge. Ingen produktions-/provider-/GPU-ändring gjordes i rättningen.
Bankförladdning före listen och 30-sekunders readiness är ett separat diagnosspår;
inga tidsgränser eller loggningsregler har ändrats.

### Avgränsad teststädning — HUVUDAGENT6

`test/astrid-chat-visibility.mjs` använder nu endast chattfunktionens verkliga
indata; upprepade dealerprov och ett ogrundat viewportpåstående är borttagna.
Kamerans dealer-/local-/previewmatris, ARIA, unread och privatpanelsskydd finns kvar.
`test/studio-preview-client.mjs` släpper det exakta HTML-kravet på disabled-knapparnas
etikett/markup; beteendeproven för Classic, insatser, limiter, ägarskap och isolering
är kvar. De två filernas 20 tester passerar med Node 24.21.0 och fyra workers.
Ändringen är mergad i PR283. Samlad grön main-verifiering och publicering
finns i MERGE4:s avsnitt ovan.

### Rättad produktionsbehörighet — HUVUDAGENT6, 19 oktober 2026

Normal autentiserad N1-GET till `/studio/api/admin/moving-drift` är verifierat
rättad från 503 till 200. Produktionsrollen `croupier_game` saknade SELECT,
INSERT och UPDATE på `croupier_studio.moving_drift_control`, ägd av `neondb_owner`.
Endast de tre rättigheterna tilldelades på Jakobs uppdrag cirka 04:14 UTC;
DELETE och PUBLIC-åtkomst förblir nekade. SQL016/ledger och molnvariabler är orörda.

Samma browseranrop gav 200 04:14:48 UTC och 04:16:00 UTC på publicerad main
`b3ff83d442e58c9f6956142003bc9ccaca64f0d3`, Vercel
`dpl_F8Ppa6Y2B56B5Fyt8ikPzJ7rgEvT`. Standardraden är nu revision 0/önskat Av;
`connected:false` och nekad admission är väntade före executoranslutning.
Ingen GPU-/talaktivering eller ny koddeploy gjordes. Vercels anslutningshemlighet
är fortsatt maskerad; före/efterprovet belägger den riktade rättningens effekt.

PR275:s granskade head `3c1343fbdcdd051738996240057b44140ff407c8` ändrades inte
av denna rättning. MERGE4 bekräftade senare merge till main
`087f4fd5f8b354371521d49c52d8ab210f9ee6b0`; publiceringen följs separat av MERGE4.
POST-LIPSYNC5 äger senare liveaktivering/prov.
Detta kvitto löser 503-hindret men ersätter inte deras executor-/providerkontroller.
[Exakt behörighetsändring och återgång](ENVIRONMENT-VARIABLES.md#runtime-rollens-tabellbehörigheter--verifierat-19-oktober-2026).
Privata SQL-/browserkvitton och skärmbild finns utanför Git i HUVUDAGENT6:s
visualiseringsmapp för chatten `01a15252-32a8-7c22-a0df-56b5e1aae7d3`.
Filer: `drift-permissions-apply.json`, `admin-drift-before-after.json` och
`admin-drift-after.png`.

## Lobbyns dealerporträtt tillbaka i steg 3 — 22 oktober 2026

Jakob bad om porträtten igen. Steg 3 visar åter Astrid, Mårten, Dragge, Anna
och Paow som låsta förhandsporträtt under glaset innan bolag och rum är valda;
den 13 oktober tömdes listan i e3404cf4. Efter rumsval kommer rummets
publicerade dealers först, sedan de porträtt rummet saknar som låsta kort.
Porträttkort ger aldrig val eller startlänk. Exakta ID-alias, ingen
namnmatchning: `dragan` visar Dragge (Kevin-importens `dragge` → `dragan`) och
`paow-v2` visar Paow. Paows bild och film togs bort i 2f7b891a och är
återställda med samma bytes; filmen är identisk med Jakobs råfil. Jakob bad
uttryckligen om Paow. Kevin har bara stillbild och läggs inte till.
Tomgångsvideon upprepas 45 s efter avslutad uppspelning, även under glaset.

Verifierat: lobbyns enhetstester, `test/public-lobby.mjs` med lokal Chrome,
bygge med typkontroll och skärmdumpar på 1440 och 390 px av byggd lobby med
syntetisk katalog (video spelar under glaset och i dialogen, ingen
horisontell överströmning). Ingen livekatalog eller produktion är provad.

## Spelarlobby J04 — 22 oktober 2026

Återupptaget på codex/player-lobby-j04 från PR331:s frysta
471549a8f02f9165be39c7077afef98f37a67ad0, inklusive dåvarande main95ac.
/lobby är den enda spelkatalogen. /play:s katalogkomponenter och exklusiva
preview-/portraitfallbackhjälpare är borttagna; /play, /demo och /casino.html
är kontextbevarande katalogredirects. /play/{game}, /play/profil och
/play/historik behåller befintlig autentisering och serverägda data.
Profil/historik nås från lobbyhuvudet. Aktiva retur-/login-/webblänkar pekar
på /lobby; gamla bokmärken behåller bolag, rum, dealer och tillåtna miljöval,
men överför inte launch-token eller godtycklig returnTo till katalogen.
Rumseditorns publiceringskvitto pekar också direkt på bolagets /lobby.

Bord och bakgrund väljs bland samma publicerade rums-/dealeralternativ.
Val ligger i URL för reload/historik och sparas i befintlig spelpreferenslagring
före launch; motorn omvaliderar dem mot rummets publicerade paket.
Chromeprovet fann att återöppnad dealerdialog tappade valt bord; rättat.
Tomma nullable val över gamla preferenser och misslyckad lagringsrensning
är också hanterade. Oberoende review fann att verklig spelretur saknade dealer:
lobbyn återläser nu enbart fortfarande tillåten lagrad dealer när URL saknar
explicit dealer, och roulette får båda returlänkarna från servervaliderat rum. Felaktigt bolag/rum/dealer breddar aldrig åtkomsten.
Katalogalias nekar skrivmetoder/action-anrop. Inga spelregler eller saldo-
writes flyttades till klienten.

Verifiering: 117/117 fokuserade auth-/paket-/rum-/profil-/routingprov,
inklusive faktiskt Chrome-flöde val → reload → dialog → launch → tillbaka →
profil/historik och negativa rum/bolagslänkar, 0 skip. Senare route-/registry-
körning 42/42, 0 skip; den överlappar tidigare prov och inkluderar ny
metod-/aliasregression. Returrättningen verifieras i 24/24 ytterligare
överlappande prov inklusive faktiskt Chrome och roulette HTTP, 0 skip.
Publiceringscallerns närprov passerar 40/40, 0 skip. Lobby- och web-typkontroll passerar. Gamla katalog-
layouttester togs bort/ersattes med beteendeprov, deras två exklusiva fullhook-
registreringar borttagna. Public game-entry-modulgrafen byggs i routingprovet.
Loggar: arkiv/2026-10-22/j04/{final-focused,final-route-registry,browser-before,
browser-after,return-review,publication-caller,lobby-typecheck,web-typecheck}.log. Inga blockerande lokala fel.
Oberoende produktreview och roots slutreview har inga kvarvarande blockerande
fynd. PR335:s första CI39693575758 föll endast i access/game-lanes
på test/player-choices.mjs:194 som fortfarande krävde /play. Faktisk footer
var redan /lobby. Endast förväntad adress rättades; före 1/1 fel, efter
10/10 i hela filen, 0 skip. Rum/bolag/dealer och separat provspelsretur
prövas fortsatt. Ingen produktändring. Loggar:
arkiv/2026-10-22/j04/pr335-footer-{before,after,commands}.log.
Ordinarie rättningshook passerar 10/10,0skip. Fjärr-main64e4c680a045eb3aed92043032fdbaa35e666359 integrerades utan konflikt; dess produktträd är identiskt med redan ärvda PR331/471549a8.
CI39695713814 föll därefter endast på samma förbrukade katalogadress i
test/blackjack-entry-http.mjs. Förväntan följer nu login-klientens /lobby;
före 1/1 fel, efter 1/1 godkänt, 0 skip. Hela HTTP-provet behåller auth,
serverägd konto-/bordsidentitet, logout och återhämtning efter serveromstart.
En avgränsad läsning av aktiva launch-/login-HTTP-prov fann inga fler sådana
adresskrav; /play/{game} och giltiga kompatibilitetslänkar består. Ingen
produktändring. Loggar: arkiv/2026-10-22/j04/pr335-login-{before,after,commands}.log.
Ny fjärr-CI krävs på rättningshead före PR335-merge.

Browsern använder riktiga lobbykomponenter med syntetiska publicerade paket,
syntetiska kontosvar och en isolerad launchmottagare; det är inget faktiskt
spel-/betalnings-/medie-/Neon-/deployprov. Node24.21.0 och lokala beroende-
junctions användes. Taskägd Chrome och tillfällig loopbackserver är stängda
av provets avslutning; inga produktservrar startades. Ingen DDL/merge/deploy.

## UX/UI: Admins arbetsområden och rumseditor — 19 oktober 2026

J03 · 21 oktober 2026. Tidigare delarna PR318/320/322/324/326/329 har
verifierad grön CI på dokumenterade slutheads. PR330:s första CI39675471027
föll på ett saknat login-fixtureberoende och en gammal administrationsadress.
Endast två tester/handoff rättades i 9627cfa26179038ebd7cba5bc78e8a8061669628;
30/30 fokuserade/hookprov passerar, tre valfria browserfall ej körda där.
Uppföljande CI39677936564 är verifierat success på oförändrad head9627cfa2.

Senaste del: codex/admin-control-auth-j03 från PR330-produkthead
b60ecf993b609136b32861b0ae433ca769489ba7, med samma två CI-testfixar.
Admin har egna /admin/login och /admin/set-password. Control-catchall,
authwrappers, gamla formulärsidor, navigationsskal, temaomkopplare och
exklusiv översiktskod är borttagna. Kända bokmärken går till Admin; okända
Control-ytor och skrivförsök skapar ingen alternativ backoffice-väg.
Kända gamla hashval får en enda handoff före Admin-mount. Partner och
zoomkartan behåller egna funktioner och behörighetsgränser.

Login, återställningslänkar, retur-URL och logout använder Adminmålen.
Gamla t-länkar bevaras; dubbla/ogiltiga tokens nekas, referrer/cache stängs
för authredirect. Båda mountformerna och separat Studio-värd går genom
validerad publicOrigin. Host-only cookies, signerade Game/Lab-handoffs,
atomisk tokenförbrukning, sessioner och serverägd ekonomi är oförändrade.
Föråldrade Control-/layoutassertioner har ändrats eller raderats; skydd för
aktiva auth-, rum-, sparnings- och spelbeteenden består.

Verifiering: root middleware/transport27/27 och shell31/31, 0 skips;
auth89 unika fall över slutkörningar och12 form/Partner/browserfall,0skip.
Körningar överlappar; exakta kommandon och sista rättningar finns i loggar.
Ordinarie hook redovisas i PR/status.json.
Samlat Studio-build med /studio och alla frontendtyper passerar,
traces63/44; manifest har Admin-auth och Partner, inga Control-pages.
Lokala beroendejunctions och syntetiska API/sessioner används; inga
produktions-, databas-, medie- eller deployprov påstås. Loggar finns i
arkiv/2026-10-21/j03-auth/ i leveransworktreen. Oberoende slutreview inklusive sista logoutdeltat har inga blockerande fynd.
Slutbygget efter produktfrysning passerar. Egna authfixtureprocesser och
browserkontexter är stängda; inga produktservrar startades.

O01 är VERIFIED som kontraktsaktivitet på
4f45a59c763874466986fc1bb3f3e76b12edba53: Adminmatris och44/44 isolerade
kontraktsprov. Totalt20%, E1 100%; J03:s slutliga CI/aktivitetsacceptans
återstår. Aktuell main95ac98dcb1608bd89bb2ac44488b2a82a376682d är integrerad
konfliktfritt i denna egenbranch/PR331; andra agenters ändringar bevaras.
CI39680259777 på integrationshead b46e8d1c misslyckades i fyra föråldrade
test-/fixturekrav. Studio-build/alla frontendtyper och isolerad SQL/restart/HTTPS
passerade i CI. Fyra testfiler har rättats utan produktändring: gammal
Control-källsträngskoppling borttagen, preview-authfixture kompletterad och
två adresskrav flyttade till Admin. Före4/4 reproducerade fel; efter58/58,
0 skips, på Node24.21.0. Auth-före-dataläsning, hash/ingen bearer, atomisk
inbjudan och signerad engångshandoff bevarade. Oberoende deltareview av
kevin_plan och root utan blockerare. Loggar pr331-ci-{before,after,commands}.log.
CI39682283055 på c7578ede050d21dec3ede098f193fe0276b25027 passerade Studio,
övriga regressionsgrupper och isolerad SQL/restart/HTTPS, men föll på samma
föråldrade loginadress i två sync/async-provenancefall i account-credentials.
En enda testassertion är nu flyttad från /studio/login till /admin/login;
produkt och kontroller av återkallad epoch, ogiltig provenance och noll nya
sessioner är oförändrade. Lokal reproduktion: 2/2 fel före; hela berörda
filen efter rättning: 17/17, 0 skips, Node24.21.0. Exakta kommandon/loggar:
pr331-epoch-{before,after,commands}.log i samma privata arkiv.
Ny CI återstår för denna rättning; ingen push, merge till main eller deploy
påstås av det lokala kvittot.

J02 · 21 oktober 2026, `codex/admin-control-publication-j02`, från J01
`ab4c8c98ed029b61aaf30b2ca6137b2fb8e93868`: Admin använder nu
`admin-publication-page.tsx` med flyttad CSS och beteendeprov. De gamla
`app/control/rooms/page.tsx`, `companies/page.tsx` och `operator-page.tsx`
är borttagna tillsammans med deras tracingposter och renderer-specifika testlås.
Aktiva UI-/återhämtningslänkar går direkt till Admin. Bokmärken till
`/control/rooms` och `/control/lanes` går till `/admin/publication`;
`/control/companies` och `lanes?tab=companies` går till `/admin/companies`.
Omdirigering gäller GET/HEAD med och utan native/unified-flagga och /studio-mount;
querykontext, fragment och lane→composition bevaras. Skrivanrop och next-action
omdirigeras inte. Befintlig N1-auth, Partner, tjänster och scoped writers kvarstår.
Verifierat: 383 unika fokuserade prov (106 routing/publicering/browser och
277 konsument/auth); sista riktade omkörningar 36/36 preview och 19/19 Next-navigation.
J01-browserflödet körs utan skips via gamla rooms- och monterade lanes-bokmärken,
inklusive ny signerad session, spara/publicera/återöppna, konflikt och mobil.
Studio-typkontroll och komplett `npm --prefix apps/studio run build` med
`CROUPIER_LAB_BASE_PATH=/studio` passerar; Admin/lobby-typer ingår. 78 byggspår,
0 privata filer rensade. Orphan-kontroll: 530 kandidater, 0 orphan-prov.
Lokala kommandoutfall/bilder: `arkiv/2026-10-21/j02-ui/` (gitignorerat).
Befintliga CSS-composes-/Next middleware-varningar kvarstår. Proven använder
syntetiska konton/minneslagring; ingen produktion, DDL eller GPU kontaktad.
Testresurser stängs av egen cleanup. Kvar: fryst oberoende granskning, PR/CI;
resterande Control-ytor och lobbyavveckling hör till J03/J04.


J01 · 21 oktober 2026, branch `codex/admin-publication-j01` från main
`15988f32fd572c453d2189502acbe324c4566815`: publicering visar bolag/rum/version,
redigering och sparning, publiceringsval och bekräftat kvitto som skilda steg.
Osparat projekt och konflikt blockerar publicering; återöppning läser sparade
värden och behåller bolag, sammansättning, dealer, rum, spel och fragment.
Befintliga scoped writers/auth används. Ersatt formulärmarkup och oanvända
styles är borttagna; avveckling av Control-ingången hör till J02.
Grundverifiering på 2f3a5b50: 160/160 prov utan skips (control-lanes-page, workspace-tools,
presentation-room-create, presentation-room-api, studio-session-save och nya
admin-publication-workspace), Studio-typer och typkontrollerat klientbygge.
Testupptäckt: 530 kandidater, noll orphan-prov. Browserprovet kör den verkliga
komponenten och API-handlers med syntetiska konton och minneslagring:
spara/publicera/omladdning, ny separat signerad N1-session för samma konto/scope,
konfliktlösning, 390 px utan horisontell överrullning samt 401/409 utan otillåten skrivning.
Sessionskomplettering: 23/23 prov utan skips med `node --test --test-concurrency=4`
`apps/studio/test/admin-publication-workspace.test.mjs` och
`apps/studio/test/studio-native-auth.test.mjs`; samma Chrome/browser-env som grundprovet.
Fixturen utfärdar en distinkt JWT och den verkliga cookievalidatorn verifierar
samma N1-konto/scope. Ny cookie i ny browserkontext återläser sparat namn och
publicerad version 2; API-provet kontrollerar också den sparade projektrevisionen.
Ingen produkt-auth eller endpoint har ändrats. Produktbygget har inte upprepats.
Det är inte en verklig ny lösenordsinloggning eller PostgreSQL-durabilitetskontroll.
Lokala stegvisa bilder och loggar: `arkiv/2026-10-21/j01-ui/` (gitignorerat).
Fixturservrar och browserkontexter stängs av provens cleanup. Inga prodskrivningar,
mediaändringar eller deployer. Klientbygget har befintliga CSS-composes-varningar.
PR [313](https://github.com/Jakeminator123/scoutgaming/pull/313) är draft; ny head
ska granskas och få CI. Egen hostläsning av main före kompletteringscommit:
0 öppna/23 ignorerade, sourceBinding verified, aktiv övervakning;
historik `too_large` och partiell platsmetadata kvarstår.


Klippkartans scenreglage i [PR267](https://github.com/Jakeminator123/scoutgaming/pull/267)
och bredare scenpanel/driftväljare i [PR274](https://github.com/Jakeminator123/scoutgaming/pull/274)
är publicerade. Föregående UI/UX-agents 92 prov och visuella kontroller är
tidigare evidens; gemensam mall och rummets egna val använder skilda writers.

[PR277](https://github.com/Jakeminator123/scoutgaming/pull/277) är mergad som
989e74e2 och publicerad på webb enligt MERGE4:s exakta Vercel-kvitto.
Startsida och desktop-/mobilmeny använder samma Skapande/Verksamhet-länkar.
Egen verifiering: 61 navigations-/åtkomstprov, typer/klientbygge, isolerad
CSS-bredd 1280/960/390 px och 338 Admin-prov i 13 grupper utan skips.

[PR278](https://github.com/Jakeminator123/scoutgaming/pull/278), fryst
82ddf669, integrerar samma navigation med bolagets exakta rumskort och
rumsdetalj. Den är mergad som f2881516 efter grön CI och slutgranskning;
72 rums-/navigationsprov, klientbygge/typer
och hela Admin-gruppen (338 prov) passerar. Syntetisk GET-katalog och blockerade
skrivningar verifierades vid CSS-bredd 1600/1280/390 px. Inget livepaket ändrades.

[PR282](https://github.com/Jakeminator123/scoutgaming/pull/282), mergad som
1985b7dc, rättar stale dealer=astrid i
rumsadresser, även befintliga bokmärken. Exakt bolag/rum, extra queryvärden och
fragment bevaras; normaliseringen respekterar delad navigering och pågående
redigering/operationer. Den publicerade rumspresentationen väljer fortsatt sin
riktiga dealer. Rumseditorn får samlad versions-/arbetsstatus, tydlig scenyta
intill tillåtna val och breddstyrd layout. Tom granskning döljs tills ett
utkast finns. Ett enda rum slipper ett dubblerat rumskort.

Aktivt rum är no-op före history/dirty-reset. Regressionen verifierar aktivt
dirtykort, direkt väljare, gammalt bokmärke och fortsatt bytes-/unloadskydd.

Teststädning inom UI-scope tar bort förbrukade pixel/breakpoint-, exakt-markup-,
textantal- och DOM-ordningskrav i studio-layout/clip-guide/partner-appearance
samt gammal Control-textassertion. Aktivt rumsscope, behörighet, sparning,
historik, exakta media och revisionsbunden granskning/publicering behålls.
Nytt roomLayout-prov verifierar spara → granska → publicera med exakta
revisionsvärden/token och bevarat annat rums val. Egen verifiering: 94 riktade UI-/routing-/appearanceprov efter integration av reviewrättningen utan skips samt slutligt integrerat Admin/lobby-typkontrollerat klientbygge passerar. Hela Admin-gruppens 338 prov i 13 grupper är ett tidigare kvitto före den separata återvalsrättningen. Isolerad scen använder neutrala testbilder och inga videor/GPU-anrop; GET-fixturer och blockerade skrivningar behålls. Faktisk CSS-bredd 1600 och 390 px är kontrollerad utan horisontell sidöverrullning; Desktop/Mobil-val fungerar och dold granskning har display:none. Normaliseringen bevarar bolag/rum/hash i browsern. Uppföljningen är publicerad på webb i main a2dc503e, Vercel
`dpl_GtYpcfRMYV32jFxGcgcExZziLFhH` READY/www enligt MERGE4:s egen läsning.

UI/UX2 gjorde en separat normal N1-läsning 19 oktober 07:50 CEST: ett äldre
`/admin/rooms?dealer=astrid&game=blackjack` rensades till `?game=blackjack`.
Rätt Dragan-rum, paket 4 utan utkast, scen/lager, samlad versionsstatus,
stängd hjälprad och dold granskning visades. CSS-bredd 1427 px gav ingen
horisontell sidöverrullning eller alert. Inga Play-/spara-/publiceraåtgärder
eller lokala serverstarter gjordes. Detta är tillskriven UI-/adresskontroll,
inte tal-, spel- eller samlad main-CI-acceptans.

H6:s 503→200-kvitto och MERGE4:s executor-publicering är tillskriven evidens.
POST-LIPSYNC5 äger verkligt tal, exakta videoidentiteter och GPU-aktivering.
Kvar utanför denna UI-etapp: övriga Admin-arbetsytor, PNG-idle, chattregeleditor,
var åttonde utdelning per box och enhetliga lagerlås. Produktmodellen finns
endast i [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md), användarstegen i
[README](../apps/studio/docs/README.md). Privata demoer i
C:/Users/jakem/Desktop/STUDIO JÄMFÖRELSE/ bevaras.

<a id="post-lipsync5-produktionsprov"></a>

## Dragan: produktionsprov — POST-LIPSYNC5, 19 oktober 2026

**En genererad uppspelning har nu gått igenom i den publicerade spelvyn.**
Det fjärde provet skickade exakt en fråga 09:54:26.916 UTC:
”Svara kort på svenska: säg Hej Jakob.” Spelchatten visade ”Hej Jakob.”
GPU-resultatet och webbläsarens eget mediekvitto avslutades komplett.
Mikrofon → transkription → OpenClaw-text är separat belagt nedan.
Hela kedjan till hörbar röst och upplevd läppsynk, tal under utdelning
och svarstid för vanlig drift är ännu inte godkända.

Provet körde publicerad web/game-kod
`913ad8e679aed2d90865ec1328da414c18d14716` från PR290.
MERGE4 verifierade PR-CI 39228212145 och main-CI 39229477481, inklusive
riktig SQL/schema-readiness och workerbygge. POST återläste samma faktiska
web/game-SHA. POST äger prov och stopp, HUVUDAGENT6 backend, UI/UX2 Admin
och MERGE4 granskning/publicering.

Färsk ansluten executor, faktisk Av och kallt Sparläge med
`admission.allowed=true` verifierades före normal CAS-aktivering av exakt
Draganprofil. Den oberoende stoppvakten band den faktiskt lästa planfilens
hash till PID och högst 12 minuter. Endpoint `zjsdlni6cn8dvo`, template
`5dkkc3wolw`, min0/max1, image, bank, röst och referens bevarades.
OpenClaw var valt; mikrofon och kamera var av. Inga insatser, DEAL eller
walletändringar gjordes.

| Faktisk evidens | Resultat |
| --- | --- |
| GPU-jobb | `a6978302-bd43-4f7d-bfa1-8e4bc279f6b4-e1`: COMPLETED och output complete |
| Session/ström | `69289f94f054eda576f83dd367fbfdb3`, samma ID i journal och klientkvitto |
| Bankhämtning | Receipt 1287,569 ms, arkiv 6592,18 ms; båda cache miss |
| GPU-utmatning | 45 läppsynkbilder fördelade på fyra bildpaket |
| Webbläsare | `generated-lipsync-stream`, ended, completed=true, started=true, firstFrame=true |
| Klientens mottagning | 45/45 bilder mottagna; `released=33` är ett tidsstyrt bildindex för bufferten, ingen visuell täckningsgrad |
| Tid | Kö 1101 ms, GPU-execution 89348 ms, klientens hela förlopp 104634 ms |
| Visuell acceptans | `reviewStatus=pending`; fysisk hörsel- och synkgranskning återstår |

Klientens completed kräver ljudets media-playing-kvitto följt av normalt
media-lifecycle-avslut. Första synliga bild markeras efter lyckad rendering;
detta är starkare än enbart färdig svarstext men bevisar inte läppsynkens kvalitet.
Separata avgränsade loggläsningar 09:54:26–09:56:20 hittade ingen
guard-, readback-timing- eller bank-rejection-rad. Tidigare HTTP403-orsak
är fortfarande obelagd. PR290 tillför diagnostik och tillskrivs ingen
bevisad reparation av det historiska felet.

Normal Av/CAS 9→10 kvitterades 09:57:03.911 UTC. Faktisk Av, blockerad
antagning, 0 workers, 0 öppna sessioner och ingen åtgärd verifierades
09:57:49 UTC. Exakt preparation återställdes via normal PUT200 09:58:05.
Flagga 0-deploy `dep-dbaujdrncjis73ag4h50` blev LIVE 09:59:13.394 UTC
på samma kod. Stoppvakten bekräftade själv Av vid sin deadline 10:00:07
utan fjärrwrite och avslutades med exit 0. Closeout 10:01:04.330 UTC
återläste preparation, flagga 0, globalt 0 GPU och 0 öppna sessioner;
merge-/deployhållet släpptes. Efter flagga 0 påstås ingen ny ansluten executor.

Jakobs delegerade budgetbeslut användes med ändligt 50 USD kumulativt
providerskydd inklusive alla behållna reserver. En granskad normal
append-only CAS 21,60→22,80 USD kvitterades 09:49:43.772 UTC; alla
18 äldre reservationer/21,60 USD och deras historikhash bevarades.
Efter jobbet finns 19 reservationer/22,80 USD och grant 22,80 USD, 0 öppna.
Journalens 45 USD-kapacitet, 1,20 USD per jobb och 20 USD-dagstak består.
Skyddskalkyl 48,018985 USD omfattar rapporterad provider 1,015650 USD,
behållna 44,603335 USD och detta fönster 2,40 USD. Den är ingen slutfaktura;
providerredovisning kan släpa och externa TTS-/lagringskostnader ingår inte.
Inga reserver frigjordes. Ett senare fönster måste även behålla detta
2,40 USD. Nästa faktiskt öppnade fönster redovisas separat nedan.
Ingen automatisk omkörning, återbetalning, migration eller provisionering.

43 privata kontrollprov passerade före körningen. H6:s oberoende
läsgranskning fann inga blockerande fynd i de sju exakta helperhasharna,
journal-CAS, historikbevarande och planbunden stopp-/aktiveringskedja.
Dessa kod- och grindprov hålls skilda från den faktiska uppspelningen ovan.

Senaste säkra slutläge är **10:43:05.830 UTC**, efter femte provfönstret.
Jakob godkände uttryckligen ett mikrofonprov inom 50 USD totalt, åtta
minuters Off-timer och två minuters stoppsvans. H6 läsgranskade sju nya
helperhashar; 44 riktade kontroller passerade. Alla fyra äldre fönster
behölls: 47,003335 USD. Ny reserv 1,70 USD täcker den kortare faktiska
vakten vid högst 10 USD/timme; den gamla tolvminutersvakten nekas.
Normal CAS 22,80→24,00 kvitterades med samtliga 19 bindningar/22,80 USD
oförändrade. Ingen ny reservation eller GPU-körning uppstod i detta fönster.

Flagga 1 blev LIVE 10:35:40.925 på samma kod. Färsk Av och kallt Sparläge
med ansluten executor/admission verifierades före exakt profil-PUT200
10:36:40.239. Mikrofonen skulle därefter startas av Jakob med **Record
one message**. Den synliga röstloggen styrker en inspelning med kamera av,
transkriptionen ”Yeah I got that.”, automatisk sändning till Dragan och
avslutad rösttur; chatten visar ”Got it.” Loggen saknar tidsstämplar.

En senare fråga, ”säg någtot”, stod i ”Svar klart · väntar på ledigt bord”.
Dess klientkvitto 4b8a55a7-a069-45d6-a6e4-b2e65255af18 slutade cancelled,
completed=false, failureCode=muted, elapsedMs=383527. Kvittot sparades
10:41:51.645; frågan hade alltså startat **senast 10:35:28.118 UTC**,
före profilaktiveringen. Chattordningen placerar även mikrofonturen före
den frågan. Detta är inte ett genomfört prov av den nyaktiverade GPU-vägen.
Pågående runda ensam bevisar inte orsaken till väntan: posegrinden kräver
matchande identitet, synlighet, ljud och ett faktiskt presenterat ledigt
läge utan annan ägare. Held-väntan saknar timeout; exakt saknat villkor
är inte belagt. Ingen produktionsgrind har kringgåtts eller ändrats.

Normal Off/CAS 11→12 kvitterades 10:40:29.789. Färsk Av/admissionfalse,
0 workers, 0 öppna och ingen åtgärd verifierades före normal återställning
till preparation 10:41:18.658. Vakten hade faktiskt armerats 10:33:28.536
med deadline 10:41:28.394; den bekräftade själv Av 10:41:29.690 utan write.
Flagga 0-deploy dep-dbav7ktg1s2s73dlpsq0 blev LIVE 10:42:25.713.
Closeout 10:43:05.830 verifierade preparation, flagga 0, globalt 0 GPU,
min0/max1, 0 workers/busy/sessioner, Off revision 12 och nextAction none.
Projekt: studio-70eb9543-b220-44f1-a65e-51f7726bf025. M4-holdet släpptes.

Slutjournalen är 19 reservationer/22,80 USD, grant 24,00 USD. Kalkylen
49,718985 USD är rapporterad provider 1,015650 + behållet 47,003335 +
fönster 1,70. Ingen slutdebitering eller extern TTS/lagring är verifierad;
redovisning kan släpa och inga reserver frigjordes. Fönstret ska behållas
även inför ett eventuellt nytt prov. Gamla planer/intents/kvitton får inte
återanvändas; engångshjälparen vägrar redan ändrad grant.

Det kvarhängande svaret avbröts med ordinarie ljudknapp och spelarens
ljudval återställdes. Mikrofon och kamera är av. Jakob hade själv en
pågående spelrunda; POST rörde inga kort, insatser eller walletdata.
Fysisk hörsel/synk och mikrofon → GPU i samma aktiva fönster återstår.

Privata bevis finns i den befintliga checklistans provmapp:
`trial4-start.json`, `trial4-playback-detail.json`,
`trial4-browser-result.json`, senaste `speech-observation-*.json` och
`closeout-1792404064330.json`. Femte fönstret har
`trial5-visible-voice-log.json`, `trial5-client-closeout.json`,
`trial5-waiting-on-round.png` och `closeout-1792406585830.json`.
Tidigare tre prov-/stoppkvitton bevaras;
deras nekanden tillskrivs inte automatiskt samma historiska orsak.

PR280 pensionerade den inventerade lokala filmvisaren och dess testkopplingar;
13 förbrukade privata hjälpfiler har städats med inventerade beroenden.
Originalmedia, 50 verifierade bankkällor, historik och acceptanskvitton bevaras.
Fyra pending-repliker och publicerat bord med 0/13 godkända inspelade repliker
är en separat innehållsgranskning. Namnbyte eller bred omuppladdning bevisar ingen synk.
Nästa produktprov behöver knyta den fysiska mikrofonen till rätt hörbar
röst/visuell synk i samma aktiva fönster och därefter tal under utdelning,
med färsk drift, finansiering och mänsklig närvaro.
[Användarflöde](../apps/studio/docs/README.md#dragan-prova-publicerad-chatt-och-tal),
[tekniska grindar](LOCAL-PRESENTATION-RUNTIME.md#driftvaljare-kontrollplan).

<a id="dragan-talstatus"></a>

## POST-PISYNK4 — talflöde och isolering, 19 oktober 2026

Genererade OpenClaw-svar normaliseras till en rad innan förhandsvisning,
TTS och hashning; inspelade repliker behåller exakt text och medieidentitet.
PCM-insamling och bildplan delar nu workerens 220/530 ms marginaler och
600-rutorsgräns. För lång replik avbryts före render-dispatch med begripligt fel;
TTS och GPU-förberedelse kan redan ha skett. Ingen image eller kalibrering ändras.
Text-/längdgränserna är mergade i [PR266](https://github.com/Jakeminator123/scoutgaming/pull/266).
Nästa etapp kopplar riktiga appmoduler i två isolerade integrationsprov:
SQLite-blackjack-commit → beständigt spelkvitto → moving-runtime/WebSocket,
och mikrofonkontroll/WAV → transkriptions-API → Director/NDJSON → vald
Dragan-röstadapter → hashbundet PCM. Proven kontrollerar engångsdebitering,
exakta utdelningsrutor, dolt kort, rum/browser/spelare samt avbrott vid nästa
spelkommando eller spelarbyte under transkription. Svenska och engelska
behåller texten genom förhandsvisning och TTS. Klientkvittot får tider för
verifierat media, komplett svar, ljudstart och första renderade talruta.

Enheter/DOM, modell, externa TTS-/GPU-anrop och mediebytes är syntetiska i
integrationsproven. Full utdelning med registrerade originalbytes och faktisk
mikrofon/OpenClaw/GPU i isolerad drift återstår, liksom inspelad synkgranskning.
Klientens `play()` är inte mätt hörbar ljudstart. Ingen GPU-resurs eller
produktionsinställning ändras av kodleveransen.
Fokuserat: 3 utdelningsprov, 3 mikrofonbryggprov och 22 spelarprov passerar;
2 valfria browserprov är överhoppade utan installerad fixturemodul.
En oberoende läsande Codex-granskning hittade inga blockerande fynd.
CI upptäckte att de två nya integrationerna saknades i fullsvitens register;
de är nu registrerade i grupperna `moving-speech-deal` och `astrid-camera`.
UI/UX äger Admin och HUVUDAGENT5 driftstyrningen; gemensamma filer samordnas.
Jakob har satt totaltaket till45USD, inte45USD extra. En separat valfri017
breddar endast teknisk kapacitet; initial13,2, försöksreserv1,2 och dygn20USD
är oförändrade.73 fokuserade tester och verklig isolerad PostgreSQL med
omstart/HTTPS passerar, inklusive45/+1mikro och bevarad historik.
Produktionens017, kompatibel driftsättning och separat finansierat belopp är
ännu inte verifierade här. Dagens planerade fönster är2,4USD och ryms även
inom befintligt40USD-tak. Ingen GPU-/visuell kvittens ingår i denna ändring.
CI upptäckte tre kvarvarande förväntningar på föregående tekniska tak/manifest.
De två sessionfallen och Studio-fixturen är uppdaterade till45USD/optional017;
initialbelopp, dags-/försöks-/tidsgränser och produktkod är oförändrade.


## Lipsync 3 — verifierad slutstatus 18 oktober 2026, UTC

Dragan talar med källbundet ansikte under självutdelning i det isolerade
rörelseprovet. Jakob godkände **enbart filmen med hash nedan**. T6 verifierade
senare två vilorepliker i produktion, kall modell följd av varm återanvändning.
T6 prövade ingen DEAL, insats eller saldoändring och fick inget nytt visuellt
godkännande. Provresurserna är avvecklade och talflaggan är åter av.

[Runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md) beskriver tekniken;
[TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md) är enda produktmodellen.
[Historiskt detaljkvitto före förkortning](https://github.com/Jakeminator123/scoutgaming/blob/0ff9467d3230c30219126ee9b2c87b2724220529/docs/JOHN-HANDOFF.md#dragan-talstatus) och
[privat backup](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/final-documentation/lipsync3-detaljkvitto-0ff9467d-2026-10-18.md) bevarar hela föregående avsnitt:
äldre prov, amendmenthistorik och exakta kvitton. De är historiskt underlag, inga extra aktiva guider.

### Leverans och exakta bindningar

Modellcache och varm antagning är levererade i PR255–257. T6 körde PR262:s
`4cee9bc20254f6eaceb9b34271cae8c98b41a56b`; www och Render verifierades på
revisionen 21:23:13 UTC och återställningen efter provet använde samma kod.
Migration **015 applicerades 21:24:12 UTC**: tre CHECK-gränser 15→40 USD,
oförändrad budget-/reservationshistorik och inget nytt beviljat belopp.
**Denna leverans gör 015 obligatorisk** för readiness, Studio och båda
importörerna. 94 fokuserade prov samt verklig isolerad PostgreSQL passerade;
detaljkvittot skiljer dessa kontroller från den daterade appdriften.

| Underlag | Exakt identitet |
| --- | --- |
| Enda visuellt godkända filmen, ”Ulf Lundell är bra.” under självutdelning | SHA-256 `769c5d901775e05ca88773ee3e47174410367ae9c8d0fdb935b4cbcc6080c8f4`, 711 053 byte, H.264/AAC, 1280×720 |
| 50 oförändrade Dragan-källor | source-set-SHA `e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d` |
| Rörelsekälla, 66 rutor vid 24 fps | `d9c7fefb-141c-4809-aecf-3904392f22f5`, SHA `061e82f2d4be69d3a73a2e6842692eb2d23c7b7e11fcd9d246fbb0c85e9f72c0` |
| Vilokälla, ruta 0 | `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f`, SHA `2b8d6ea7829bde6212f6145038569747a389c5e20166b3ea08fc26efda81c9e3` |
| Fullbank, 2 479 poolrutor / 594 432 000 byte | SHA `5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c` |
| Workerrelease | `5908716a81532d29e8b2e9aece3a8639258a7f56dad2ee3b6d98fcc343d0c08c` |
| Publicerad image | `ghcr.io/jakeminator123/moving-gpu-worker@sha256:eb5a6b4707eaba54839cc562b554ff7a8af37f5897e739a5533f2357f867135a` |

En ändrad ljud-/videohash är en annan tagning; godkännandet ärvs inte.
Lagren är bakgrund → dealer → bord, med serverägda kort och spel-UI ovanpå.

### Senaste produktionsprov och avveckling

T6 `728d0e03-1f46-4ab5-936b-01a99e1dbe1e` gav två naturligt avslutade
svar på Dragan-testbordet. Båda har `mediaCompleted=true` och
`captureComplete=true`, med exakt text-, PCM-, bank-, käll- och releasebindning.

| Replik | Samma A40-worker `nc0qem1vw69ad2` | Mottagna rutor / release-callbacks | Providerkö / execution | Klick→slut, monotont |
| --- | --- | --- | --- | --- |
| ”Ulf Lundell är bra.” | Cachemiss | 57/57 / 44 | 64,805 s / 85,954 s | 164,088 s |
| ”Jakob är kung.” | Cacheträff | 51/51 / 38 | 0,147 s / 25,773 s | 37,176 s |

Motorförberedelsen tog 52,761 respektive 2,180 s. Olika repliker och enstaka
prov ger ingen p95-/hastighetsgaranti. Mottagna rutor, callbacks och glesa
JPEG-bilder bevisar inte att varje ruta visades eller ny visuell acceptans.
Mottagen PCM är inte inspelat systemljud. Det isolerade RTX4090-provet
verifierade även avbrott och ny motor efter avbrott; kvitton finns i paket 2.

Cleanup stängdes **21:59:46.560 UTC**, sju godkända steg utan fel: profil
preparation, fyra egna Render-nycklar återställda med flagga 0, endpoint/mall
borta och inga aktiva workers, öppna reservationer eller levande leases.
Render `dep-dbak20ijnfac73816bsg` var LIVE på PR262. Journalen behåller
**14 avslutade reservationer/16,8 USD**, varav 12 USD för dagen; separat
beviljat totalutrymme är 16,8 USD. Ingen historik nollställdes.
[T6:s resultat](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/two-reply-result.json)
och [cleanup](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/cleanup-receipt.json)
är de lokala kvittona; deras fullständiga hashar finns i detaljkvittot.

### Bevarande och lagring

Fem privata Blob-manifest är fullåterlästa. Länkarna öppnar deras verifierade
lokala kopior; objekten ligger under `croupier/media/dealers/dragan/staging/lipsync-review/`.

| Manifest | Bevarat underlag |
| --- | --- |
| [1. Källor och rörelseprov](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/preservation-manifest.json) | Referens-ZIP, käll-/bankreferenser, ljud och granskningsmedia; derivat skiljs från original. |
| [2. Varm cache och avbrott](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/warm-cache/plans/warm-cache-1526eeb3-a526-48a7-8e43-d3665ca09d59/manifest.json) | Kompletta A/B/D-resultat, uttryckligen partiellt C-resultat och sanerade kvitton. |
| [3. Historiskt T3-svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/historical-single-reply/plans/32c15e27-a1e9-472f-a290-9ee11bc04084/manifest.json) | Kompletta medier men ofullständig capture; inget tvåsvarsbevis. |
| [4. T4-svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/t4-single-reply/plans/3001c02f-ee64-4b7a-9681-aad822af40a3/manifest.json) | Ett komplett fångat svar och 62 passiva JPEG-prov. |
| [5. T6:s två svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/production-trial04/plans/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/manifest.json) | 94 unika objekt / 28 001 366 byte: två PCM, tio H.264, två sanerade kvitton, 79 unika JPEG med 82 tidsreferenser och manifest. Fullåterläst 22:04:20.559 UTC. |

Emils `lappsynk-export-fe1b55e.zip` är bevarad oförändrad, 145 846 625 byte,
SHA `949443c1084ab3f515792fe66c5e2d381e985f9bdc743e792e5fbca36a9240a3`.
Bevarandet importerade inga API-, SQL- eller env-mallar. Kevins 50
registrerade källklipp behåller originalbytes; det verifierar inte hans privata miljö.
Inga källor flyttas automatiskt. För registrerat spelmaterial är Neon registret
och Blob mediekällan. Bevarandet skapade inga Neon-/Admin-klipp; ZIP, bank
eller råa ansiktspaket hör inte hemma i `/admin/clips` som spelbara klipp.
Inspelade repliker följer `recorded-speech`/`preserve-recorded-audio` med
originalnamn och exakt ljud-/videobindning. Moving-resultat sparas ännu inte
automatiskt i svarsbiblioteket. Manifesten är ingen ny visuell acceptans.

### Kostnad, varm drift och kvarvarande ansvar

Avläsningen **22:00:19.322 UTC** visade **0,8236155684862752 USD** rapporterad
RunPod-kostnad för lästa 20 endpoints och kontots pods under 16 oktober
00:00–18 oktober 22:00:18.918 UTC. T3–T6:s slutdebitering är obekräftad;
tomma billing-listor betyder inte nollkostnad. **35,003335 USD** i
providerreserver behölls, inget frigavs automatiskt. TTS/ElevenLabs och
nätverksvolymer ingår inte. [Kostnadskvittot](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/provider-budget-1792360819748.json)
länkar till fakturaunderlaget. Reservationer är inte fakturor. Jakobs tidigare
mänskliga provtak är återkallat; tekniska journal-/kostnadskontroller består.

**24 timmars varm drift är inte aktiverad eller verifierad.** Nuvarande
antagning kräver min 0/max 1 worker och högst 60 s tomgång; min 1 avvisas.
T6 hade en 720 s provguard. Cachen saknar egen TTL/jobbegränsning men försvinner
med processen eller vid identitetsbyte, fel och avbrott. Ett längre varmtest
behöver eget avgränsat drift-/kostnadsfönster med antagnings-, avbrotts- och städskydd.

Kvar: kortare svarstid, tal under produktionsutdelning, automatisk beständig lagring av moving-resultat, riktig mikrofon-/bild-E2E
och slutlig kostnadsavstämning. 56 äldre generiska `submission_uncertain` är
separat olöst observationsskuld; de har inte rensats eller frikänts.

### Arbetskopior och ägarskap

Primärcheckouten var 21:41:47 UTC på `codex/scout-visual-product-model`,
`7a6fc8a70b7c3b810829c2736ad98bd26fcf9bb1`. Dess sex dirty/oregistrerade poster
`.codex/config.toml`, `.cursorignore`, `.agents/skills/source-command-ping/`,
`.cursor/settings.json`, `a.zip` och `web/` är andra ägares och orörda.
`a.zip` är agentmaterial, inte Emils export. Ingen mass-staging eller städning.
Lipsyncs två arbetskopior är `C:/Users/jakem/.codex/worktrees/lipsync3-server-diagnostics/croupier`
och `C:/Users/jakem/.codex/worktrees/lipsync3-bank-http/croupier`. Studio-beroenden
länkar mellan dem; lämna dem kvar tills junctionens konsumenter är avvecklade.
Huvudagentens slutkontroll identifierade inga egna provprocesser i dessa träd
eller provbasen, inga lyssnare på 8765/8766, och Admins talcheckbox var av.
Impactwins avvecklade `game-engine`/`preview-v2` ska inte återställas;
produktionens `croupier-v2`/main består. Vercel Preview delar produktionsbackend
och får inte antas vara isolerat. Övrigt ägarskap samordnas med HUVUDAGENT5.

## Historiskt Lipsync 2-kvitto

Följande daterade diagnos är bevarat underlag; aktuell status och aktuellt
kostnadsmandat står ovan och ersätter dess tidigare start-/stoppvillkor.
## Dragan: avslutat diagnosprov, bank_length_mismatch — 18 oktober 2026 10:10 UTC

Detta var slutläget efter molnprovet, före den lokala HTTP-rättningen ovan.
Ingen GPU eller fortsättningsbevakning lämnades igång. Jakob önskade en bra
överlämningspunkt. Den dåvarande leveransen ändrade bara handoffen.

**Verifierat:** PR240 är mergad och appen körde
`209d62f436786f9dae69c7ee6f1b256253ab6805`. Diagnostikimagen från PR238
är publicerad och använd i provet: image
`sha256:3ede7d24fd7885f2a8ffcd1ad4798d2d1caa8799f926c610b576d196cc92db6c`,
release `3bec5b4be9954d929fcc60d281b89981a7be3d7a9027008466c240b90c1e44ad`.
OpenClaw svarade exakt "Hej Jakob, nu testar vi ljudet.". Budget/admission,
nyckelåtkomst och workerstart passerades. Ingen spelinsats gjordes.

**Bekräftat fel:** RunPod-jobbet
`878f6561-7d54-4203-a091-cf4935386642-e1` väntade 214835 ms och exekverade
1328 ms. Providern rapporterade COMPLETED men output var
`status:failed, code:bank_length_mismatch`. Render loggade kvitto-GET200
10:06:14.906Z; inget efterföljande arkiv-GET. Browsern tog emot noll ljud-/
bildbytes och ingen worker-WebSocket. Detta är inte ett lyckat talprov.
`services/moving-gpu-worker/bank_download.py` använder samma felkod för
otillåten transfer/content encoding, fel Content-Length och för stor kropp.
Exakta svarshuvuden fångades inte. Chunked är en hypotes, inte fastställd orsak.
Det nya utfallet stärker underagenternas statiska kvitto-/framinganalys;
deras procenttal är bedömningar, inte ytterligare runtimeprov.

**Avvecklat:** guarden stängde 10:06:20.952Z. Oberoende återläsning
10:10:08.646Z verifierade endpoint `4aissnsig9exnz` och template `vcd0ebcbmw`
404, tom workerlista samt terminal/frisläppt session
`a409d4882815adb907e93c6b26846091`. Journalens COMPLETED återger providern,
inte lyckad workeroutput. Renderflaggan0 blev LIVE 10:07:37.980Z via
`dep-dba9k9uq1p3s73armh90` på samma209d. Dragan-profilen är sparad avstängd.
Förbrukad endpointvariabel är borttagen med Save only och återläst;
den körande avstängda deploymenten har fortfarande sitt gamla env-snapshot.
Astrids endpointinställningar min0/max1 och originalmedia är oförändrade.

**Budget:** Jakobs uttryckliga totaltak är40USD. Append-only amendment
`4a6363d5-5e26-4da5-874b-20e4b977dd48` är genomförd: samma budget-ID
`dragan-test-20261017`, journaltak6→7,2USD. Sex reservationer om sammanlagt
7,2USD och två amendments är bevarade; inga öppna sessioner på testendpointen.
Detta är reservationer, inte leverantörsfaktura. Även provets försiktiga
providerreserv2,333334USD ska behållas tills färsk kostnad avstämts.
40USD-godkännandet är klart. Runtime och journal har nu båda7,2USD som
fullt reserverat tak. Ett senare prov kräver avstämd kostnad, motsvarande
ändring av runtimegränsen och append-only journaländring inom40USD;
återställ inte historiken och skapa inte ett nytt budget-ID för att kringgå den.

**Nästa agent:** börja med kvittoöverföringen, inte nya nycklar eller samma
GPU-omtag. Läs bara säkra status-/framing-/storleksfält; exponera inte
capability-URL:er, credentials eller råa undantag. Reproducera relevant
HTTP-beteende offline och rätta det med bibehållen TLS/origin, storleksgräns,
SHA-256, tidsgräns och avveckling. Först därefter granskning, förseglad release,
containerprov och pinnad image före ett nytt kontrollerat talprov.
Faktiskt hörbar röst och visuellt synkron mun återstår att verifiera.

Jakob påpekade dessutom olika videoversioner och idle efter handdragning,
samt en möjlig SHA-/bildrutebindning i Kevins staging. Jämför exakt branch,
video/hash, avatarpaket och frame-index före playbackacceptans; byt inte
media på namn eller ungefärlig längd. Metoden på staging är inte verifierad
i denna omgång. Studio visade referensvalet "Kevin V2 · andning", vilket
ensamt inte bevisar att bankpaket och visad film matchar. Det nu bekräftade
hämtfelet inträffar före användning av videopaketet.

Privat operativ källa (ingen ny publik tracker):
`C:/Users/jakem/.codex/visualizations/2026/10/17/01a14afa-f423-7011-bbdf-30a7f44609d1/budget-resume-checkpoint.json`.
Den länkar terminaloutput, browserresultat, budgetamendment och oberoende
stoppkvitto. Privata helperfiler ska läsas innan återanvändning; den avslutade
guarden eller förbrukade endpointen får inte startas igen. Aktuell worktree:
`C:/Users/jakem/.codex/worktrees/dragan-admission-diagnosis/croupier`, branch
`codex/dragan-bank-failure-handoff`. Merge-agenten och HUVUDAGENT3 har fått
stoppkvitto och deployhållet för övrigt arbete är släppt.

Uppdaterad 18 oktober 2026. Den beslutade strukturflytten är levererad och
verifierad, inklusive rättningen av lokal klippmappning. Inga fler rotflyttar
återstår i strukturplanen. Tal/läppsynk och övriga öppna produktfunktioner är
separata arbeten; hela casinoprodukten är inte slutverifierad.

## Navigationstester — 19 oktober 2026

`apps/studio/test/scout-navigation.test.mjs` härleder menygrupp och dold panel
från aktuell navigation i stället för att kräva fyra grupper, deras gamla ID:n
och tre dolda paneler. Detta följer arbetslägena i [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).
Alla registrerade länkar provas mot aktivmarkering med och utan `/studio`;
alias, N1-/partneravskiljning, utkastskydd och tangentbordsbeteende behåller sina prov.

**Verifierat:** 45 riktade Admin-/navigationstester passerar. Ett minnesbaserat
omgrupperingsprov med identiska länkar gav tidigare tre layoutfel och passerar
nu alla elva tester. Ett separat negativt prov där biblioteksrutten tappar sin
aktivmarkering stoppas av den nya länkassertionen. Produktkoden är oförändrad;
två arbetslägen är här ett testprov, ingen levererad UI-ändring.

## HUVUDAGENT4: avgränsad rutinstädning — 18 oktober 2026

[PR243](https://github.com/Jakeminator123/scoutgaming/pull/243) och
[PR246](https://github.com/Jakeminator123/scoutgaming/pull/246) är mergade
efter full grön PR-CI. Strukturplanen förblir avslutad. Agent-talk visar
riktade samtal för berörda agenter, behåller kvittens/köarkiv och kräver
egen done. Delade filer är inte privata och andras claims frigörs inte automatiskt.

Lokal kontroll och CI delar dokumenturval; flyttad klientkod har rätt
migrationsurval. Moving-workerns befintliga CPU/image-workflow ingår i
obligatorisk CI när relevant. Inget generellt tvåuppspelningskrav finns kvar.

Efterfixen flyttar chattens visning, avbrott och beslutade uppspelning till
en importerbar klientmodul. Beteendeprov ersätter regex/VM-utskärning och
källtextassertioner; liveägarskap, dealer/session/revision, exakt media,
textfallback och avbrott behålls. Testnamnet är `test/chat-decision-player.mjs`.
Den extraherade modulen ingår också i serverns och browserns QA-källhashregister;
avvikande bytes eller saknad pin stoppar innan kö eller strömning öppnas.
Studios guide skiljer direkt Next-env från anslutningshjälparens avsiktliga
bakåtkompatibilitet. Inga privata env-/data-/mediefiler flyttas.

**Lokalt verifierat:** 71 passerade beteende-/regressionsprov; två valfria
Playwright-prov överhoppades eftersom browsermodulen saknas i arbetskopian.
Två nya QA-regressionsprov reproducerade hashregisterluckan före rättning;
efteråt passerade 158/158 prov i QA-/chattpaketet, helt utan betalda anrop.
515 JavaScript-/TypeScript-kandidater har inga föräldralösa tester, och
miljövariabelregistret stämmer. Obligatorisk CI följs på efterfixens PR.
Detta är inget nytt produktions- eller läppsynkprov. Lipsync 3:s handoff ovan består.

**Avslutat:** efterfixen levererades i [PR252](https://github.com/Jakeminator123/scoutgaming/pull/252),
merge `2e9b53388636effa42bea27f451845280375b9ef`. MERGE3 verifierade grön
PR-CI och [main-CI 39145319537](https://github.com/Jakeminator123/scoutgaming/actions/runs/39145319537).
Det efterföljande renklonprovet redovisas nedan. Lipsync 3:s arbete och
primärcheckoutens inställningar, råmedia och data lämnades orörda.

## HUVUDAGENT5: renklon och organisationsavslut — 18 oktober 2026

Direktklon av GitHubs main i `C:/Users/jakem/Projects/scoutgaming-clean-20261018`,
fryst på **`2e9b53388636effa42bea27f451845280375b9ef`** efter PR252.
Klonen har egen fysisk `.git`, en revisions historik och inga Git-alternates.
Arbetskatalogen var ren både före provet och efter alla körningar, innan detta
dokumentkvitto lades till. Inga moduler, byggfiler, miljöfiler eller privata
data kopierades från äldre arbetskopior. Lipsync 3 lämnade aktuell
bevarandelista; dess worktrees, moduljunction, råmedia/banker och processer
bevarades. MERGE3 bekräftade att inga blockerande H4-fynd kvarstod.

| Egen körning i klonen | Resultat |
| --- | --- |
| Installation och bygge | Låsta npm-installationer för Studio, designklient, spelmotor, Speech och transport-Gateway; webb med pnpm 10.33.2 och frozen lockfile. Node 24.21.0 respektive Speech 22.23.1 enligt paketen. Studio/design och webb byggdes från början, inklusive Next-typkontroll; designens separata typkontroll och Speechs syntaxbygge passerade. |
| Fokuserade Windows-prov | 52 struktur-/chattprov, 3 Director-paket/startprov, 2 jämförelsefixtureprov, 33 anslutningsprov, 11 sessionsprov och webbbyggets 117 tester passerade. Ett Linux-specifikt sessionsprov hoppades över på Windows. |
| Verklig lokal start | Nybyggt Studio och spelserver via `--offline --skip-build --no-open`: lokal hälsa och Studio-sida 200, opublicerat spel avvisat med 503, syntetiskt projekt i temporär datarot. Stopp tog bort dataroten och frisläppte sessionen. Vanlig publicerad Studio-start räknades inte som prov. |
| SQL, omstart och HTTPS | Befintliga `tools/studio-isolated-qa.mjs` kördes som icke-root i WSL mot samma klon/SHA och ett nytt PostgreSQL 16-kluster: 4 retained-kontraktsprov, 26 SQL-kontroller och 59 integrationskontroller. 196 källhashar var oförändrade; klustret stoppades och togs bort. Den importerade testmodulens fristående SQL-test var överhoppat; verktyget körde den verkliga SQL-kedjan uttryckligen. |
| Isolering | Ny allowlist-miljö redan vid installation/bygge, tomma användar-/npm-profiler och egen paketcache. Inga ärvda apphemligheter, NODE_PATH eller NODE_OPTIONS. 122 interna länkar och 101 byggspår med 19 329 referenser gav noll mål utanför klonen; inga privata envfiler. Båda befintliga guards blockerade läsning av i förväg skapade syntetiska envfiler samt extern fetch/TCP. |

SQL-pakethämtningen gav först `Hash Sum mismatch` från Ubuntu via HTTP,
före databasstart. Samma prov passerade med en uppgiftsspecifik `APT_CONFIG`
för Ubuntus HTTPS-källor, med bibehållen signatur-/hashkontroll. Inga
systempaket, systemkällor eller externa databaser ändrades.
Leveransverktygets push verifierades på GitHub men upstreamsteget behövde
klonens main-begränsade fetchspec utökad med den egna featurebranchen.
`git remote set-branches --add origin <featurebranch>` följt av fetch och
ordinarie leveranskommando räckte; ingen gammal arbetskopia behövdes.

**Kvarvarande särskilda förutsättningar:** inga gamla lokala projektfiler
behövdes för de prövade flödena. Director-adaptrarnas äldre relativa
`open-claw/lab` är en bevarad konfigurations-/datarot; välj uttrycklig
temporär datarot och `envFiles: []` för isolerad körning. Privat native-AI-QA
kräver fyra filer i `lab/data/platform-private` och sitt exakt pinnade
OpenAI-SDK 7.12.1-träd. Minsta åtgärd för just det verktyget är att separat
bevara/verifiera dess egna underlag, inte återföra dem som ordinarie
byggberoenden. Browserprov kräver separat Playwright/Chrome. SQL-provet
kräver Linux/WSL, OpenSSL och verifierade PostgreSQL-binärer. Se
[återställningsguidens avgränsning](ENVIRONMENT-RESTORATION.md#renklonprov-och-separata-qa-förutsättningar).

**Inte provat:** full lokal regression, browser-/visuell produktacceptans,
GPU-/taljobb, produktionsskrivningar eller molnändringar. Processmiljö,
Node-guards och sökvägs-/byggspårskontroller är ingen OS-sandbox eller
bevis för alla historiska privata verktyg. Produktdrift kräver fortsatt
uttrycklig Neon/Blob/auth/provider-konfiguration enligt miljöguiden. För native
Admin omfattar det `CROUPIER_GAME_DATABASE_URL`,
`CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`,
`CROUPIER_STUDIO_NATIVE_ADMIN=1`, `CROUPIER_STUDIO_NEON_POLICY=1`,
`CROUPIER_PUBLIC_ORIGIN` och
`CROUPIER_LAB_UI_ORIGIN`; Blob-läget använder `CROUPIER_MEDIA_STORAGE`
och `BLOB_READ_WRITE_TOKEN`. Inget av dessa skarpa värden behövdes för byggena
eller den syntetiska fixturen.

Privata körloggar, plan och maskinläsbara kvitton finns under
`C:/Users/jakem/.codex/visualizations/2026/10/18/01a14fb1-2374-7ce1-8105-d61ce1796718/`
(`clone-baseline.json`, `results.jsonl`, `offline-smoke-result.json`,
`isolation-audit-result.json`, `sql-result.json` och `sql-run.log`).
Detta stänger det avgränsade organisations-/efterstädningsprovet. Admin-UX,
Lipsync 3:s pågående integration och övrigt produktarbete har egna kvitton.

## Strukturens slutkvitto

Accepterad strukturrevision är **`2ba5bf03437b8f7da8a60d06335831abaf50f162`**,
[PR237](https://github.com/Jakeminator123/scoutgaming/pull/237), ovanpå
[PR236](https://github.com/Jakeminator123/scoutgaming/pull/236). Slutlig
mappkarta och ansvar finns i [README](../README.md#source-and-folder-map).
Neon är produktregister och Blob mediekälla. Källkodens nya rötter ändrar
inte sparade medieidentiteter, publika URL:er eller privata datarötter.

| Kontroll | Verifierat resultat |
| --- | --- |
| CI | [PR-CI 39112069295](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112069295) och [main-CI 39112728886](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112728886) SUCCESS på slutliga revisioner. |
| Lokal klippmappning | Nytt prov av verklig isolerad HTTP-server reproducerade felet före rättning. Efteråt återfinns 17 talposter, 2 native-talposter och 2 filmade tagningar; token saknas ger 401 och autentiserat cloudRuntime ger 404. Ingår i CI. |
| Databas | Isolerad PostgreSQL/omstart/HTTPS i CI; produktionsledger ready med pending=[] kl. 08:53:56 UTC. Required schema 014 är installerat. |
| Frontend | Vercel `dpl_JBah2ng3jCQtKDpk25P4f7MVpqrW` READY på accepterad SHA; 17/17 produktionskontroller. |
| Spelserver | Render `dep-dba8id8ae00c739g70fg` LIVE 08:56:42 UTC på accepterad SHA. Version, health/lobby 200, privata gränser 401, Admin-retur 307 och oautentiserad klippmappning 401 med Bearer/no-store verifierades 08:57:42–43 UTC. |
| Gateway/Director | Gateway på `d55ce412714e9e0c85103358f381098ce3d35077`, normal deploy `dep-dba28hnavr4c73fsf3fg` LIVE 01:45:00 UTC. SIGTERM/ny start utan EPERM eller kvarvarande lease; signerad config.get 200 och connected/applied 01:45:22 UTC. Director på `9f7f415d9896ca05b8c240f210ea64a1c30f2b04`, deploy `dep-dba30r2jnfac73e5err0` LIVE 02:36:29 UTC; health/autentiserat API och signerad Gateway config.get 200/connected/applied verifierade 02:37:34 UTC. PR237/238 ändrar inte Directors byggda kod. Modellval, disk och autoDeploy oförändrade. |

Driftkvittot ovan kommer från mergagentens kontroller, inte en ny körning i
dokumentationspasset. Det autentiserade cloudRuntime-provet gjordes i CI,
inte direkt mot produktion. Gateway/Director behövde ingen ny leverans för
PR237. Grönt CI och dessa driftprov är inte visuell läppsynkacceptans.

Klippfelet berodde på att servern gav clipMapping den nya fysiska roten
medan katalogen behåller `web/public`-alias. PR237 ansluter alla berörda
läsningar till den befintliga filresolvern `publicAssetPath`. Det tidigare
GO:t för PR236 var därför för brett; regressionen är nu rättad och täckt.

## Senaste app- och workerleverans

[PR238](https://github.com/Jakeminator123/scoutgaming/pull/238) levererade säkra
workerfelkoder och den privata diagnostikimagen som användes i provet ovan.
CPU-containerprovet passerade 52/52 tester, inklusive renderaren;
[imagepublicering 39114263475](https://github.com/Jakeminator123/scoutgaming/actions/runs/39114263475)
är SUCCESS. Detta verifierar bygget och publiceringen, inte hörbar röst eller
synlig läppsynk. Den tidigare apprevisionen 4c782b3b var driftsverifierad.

[PR240](https://github.com/Jakeminator123/scoutgaming/pull/240) är mergad som
`209d62f436786f9dae69c7ee6f1b256253ab6805` och skiljer providerredovisningens
godkända totaltak 40 USD från journalens oförändrade schemagräns 15 USD.
Runtime 7,20 USD kan inte ensamt höja den sparade journalgränsen. Samma
budget-ID och historiska reservationer bevaras; aktuell förbrukning och
kraven före nästa prov finns i inledningens stoppkvitto.

[PR-CI 39115861445](https://github.com/Jakeminator123/scoutgaming/actions/runs/39115861445)
och [main-CI 39116605256](https://github.com/Jakeminator123/scoutgaming/actions/runs/39116605256)
är SUCCESS. Main körde verklig isolerad PostgreSQL, omstart och HTTPS på
13,946 sekunder, inklusive blockering utan amendment och exakt en ny
reservation med bevarad historik. Produktionsledger 001–008 och 011–014
var ready med pending=[] och optionalPending=[] 09:53:32 UTC.

Mergagentens egen produktionskontroll 09:56:49 UTC verifierade exakt
209d62f4 på spelservern och Vercel `dpl_8PC4t8tYzTN6WvLZCfrsR7C5fJNu`:
health, startsida och lobby 200, privata Studio-API:er 401 och Admin-retur
307 till inloggning. Studio kontrollerades separat 17/17. Render
`dep-dba9eajm8hqs73b5hj3g` blev LIVE 09:56:12 UTC. Provets senare
avstängningsdeploy på samma kodrevision dokumenteras i stoppkvittot ovan.
Director och Gateway ändrades inte av PR238/240.

Det aktuella diagnos-, budget- och stoppkvittot i inledningen är lipsync2:s
verifiering, bevarad från [PR241](https://github.com/Jakeminator123/scoutgaming/pull/241).
Struktur- och appkvittot är mergagentens tidigare egna kontroller.
Denna samlade dokumentationsleverans kör inga nya GPU- eller spelprov och
ändrar varken HTTP-hämtning, budgetjournal, miljövariabler eller media.

## Avslutsstädning och skyddat lokalt arbete

**Verifierat 21 oktober 2026:** 23 lokala och 34 fjärrbrancher rensade efter
färsk kontroll av exakt mergad PR-head, Jakob-ägarskap, öppna PR:er och
registrerade worktrees. Före/efter: 43 → 20 lokala brancher, 58 → 24 på GitHub.
Tre övergivna restmappar utan Git-koppling är borttagna; 124 beroendejunctions
lossades utan att deras målkataloger rördes. Alla fem registrerade arbetskopior,
öppna PR:er, aktiva agenter och osparade ändringar är bevarade. Tre ytterligare
lokala brancher lämnades efter avvisad automatisk säkerhetsgranskning av
head-/backupbevisningen; de ingår inte i de redovisade raderingarna.

GitHubs automatiska featurebranchradering är avstängd vid kontroll 22 oktober
(`delete_branch_on_merge=false`). Regel 25556822 skyddar de
långlivade teambrancherna endast mot radering; main-regel 24642403 är oförändrad.
Lokal `fetch.prune=true` är verifierad. Framtida slutstädning har lagts in av den
aktiva migrationsagenten i dess [PR311](https://github.com/Jakeminator123/scoutgaming/pull/311);
ingen annan agents branch eller PR har mergats som del av städningen.
Privat refmanifest, verifierad Git-bundle och backup av `ai-system-map` finns
lokalt under `arkiv/2026-10-21/smafix-cleanup/` och ingår inte i Git-leveransen.

Bevarat arbete värt att känna till: `ai-system-map` har 37 lokala statusposter
och en användbar idé om att prioritera schema-/evidensvarningar före hashbrus.
Verktyget är pensionerat; återinför inte dess kod som del av städning.
`codex/blob-neon-storage-audit-20261016` innehåller en daterad referensinventering
för möjlig framtida lagringsgranskning, utan aktuell verifiering av molnläget.
Scenzoom från `codex/studio-view-zoom` finns redan i main under Studios nya
sökvägar; en separat import rekommenderas inte. Osäkra eller omergade original
är kvar för riktad bedömning.

Förbrukade flyttinstruktioner, aktivitetskort och motsägande väntelägen ska
inte finnas kvar som aktiva uppdrag. Denna handoff ersätter den löpande
flyttloggen; äldre exakta kvitton finns i [Git-historiken](https://github.com/Jakeminator123/scoutgaming/blob/4c782b3be4f49dc5743f27e3af3dfcb52e407939/docs/JOHN-HANDOFF.md).
Ingen ny strukturplan eller parallell migrationslista behövs.

Gamla kodrötter är tömda i accepterad main. En äldre lokal checkout kan
fortfarande visa dem. Synka först efter kontroll av branch, egna ändringar,
ägarskap och eventuella aktiva processer. Radera verifierat förbrukade rester;
bevara osäkra original i det kanoniska gitignorerade `arkiv/<datum>/`.
`lab/data`, `web/data`, OpenClaw-data, env, råmedia, kalibrering och privata
QA-kvitton får inte raderas som en följd av källkodsflytten. Avvecklade egna
worktrees kan arkiveras efter kontroll av opushat och ignorerat arbete;
andra agenters worktrees och claims är inte del av rutinmässig städning.

## Övrigt kvarvarande produktarbete

**HUVUDAGENT4, 18 oktober:** produktionens `croupier_game` på Neon-main
är källan för aktuella bolag, rum och dealers. Den tidigare läsningen visade
Dragan test och Nordic bet. Preview-grenen `preview-v2` raderades senare
enligt det daterade kvittot i [miljöguiden](ENVIRONMENT-VARIABLES.md#aktuellt-miljöval-för-admin--verifierat-18-oktober-2026).
Det andra Blob-lagret hör till Impactwin. Preview är ännu ingen verifierad
skrivtestmiljö; ingen ny molnavläsning eller full Admin-UX-acceptans påstås här.
Lipsync 3 äger tal-/workerarbetet och dess aktuella verifieringsstatus ovan.
Moving-kontrollen är levererad i PR246; renklonprovet är avslutat enligt HUVUDAGENT5-avsnittet.

<a id="2-öppna-kontroller-och-kända-fel"></a>

[CLOUD-MIGRATION](CLOUD-MIGRATION.md#separat-produktarbete-och-öppna-driftansvar)
är den enda listan över öppna produktfunktioner och äldre observationer.
Där finns operatörsledger/rapporter, konto/invite/reset, Admin-/lobbyluckor,
OpenClaw-funktionsprov, medieradering, backup och pausad QA. De innebär
inte att den levererade strukturflytten ska öppnas igen.

Välj prov efter ändrat beteende. Ingen generell manuell spelacceptans eller
ett fast antal spel krävs för vanlig leverans. Auth, rum/bolagsgränser,
revisioner, sparande och serverägda pengar/spelregler behåller täckning.
Hash, waveform och testpass bevisar aldrig synlig läppsynk; exakta
ljud-/videoidentiteter och befintliga godkännanden ska bevaras.

GitGuardian-läsningen inför detta avslut visade 2 öppna och 19 ignorerade
incidenter. Platsmetadata är delvis ofullständig och helhistorikskanningen
har status too_large. Grön produkt-CI betyder inte full säkerhetstäckning;
inga incidenter har ändrats av strukturavslutet.

Begrepp: [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).
Teknisk verklighet: [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md).
Konfiguration: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).
Återställning: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).

## Bandbredd för publicerade presentationsmedia — 21 oktober 2026

PR #321 är mergad som `644b5653936ed890d11c35a8ffb8780161b0a744` och Render
rapporterar den som live i `dep-dbcgqc9srm7s73cvqqu0`. Loggkartläggningen
8–21 oktober omfattar 3 754 lyckade GET och 8,30 GB loggade responseBytes:
Lounge varm 1,86 GB, Casino/bakground 1,67 GB (två ID:n, identisk SHA),
historisk Johanna-video 0,84 GB, Dragan/Kevin V2 andning 0,49 GB och Oak-bord
0,26 GB. Detta är ett avgränsat loggurval, inte hela månadsfakturan; äldre
PNG-täckning är partiell och vissa historiska filnamn/hasher saknas.

De två mediarouterna tillåter nu privat webbläsarcache med obligatorisk
revalidering, först efter färsk kontroll av publicering och exakt SHA-ETag.
Oförändrade bytes kan besvaras med 304. Avpublicering, fel rum/revision och
felaktiga eller overifierade svar får fortfarande inte återanvändas.
Blob-token, privata lagringsadresser, medieidentiteter och spel/auth är
oförändrade. Ingen delad CDN-cache eller ny publicering av media införs.

75 riktade tester passerar utan överhopp. Ett isolerat Chrome-prov med samma
syntetiska 3 350 764-bytevideo och fem sidöppningar jämförde tidigare no-store
med revalidering: 16 753 820 respektive 3 350 764 överförda body-bytes,
80 procent mindre i detta prov. Båda alternativen gjorde fem färska
publiceringskontroller; avpublicering gav 404 även efter uppvärmd cache.
Första hämtningen kostar lika mycket och återanvändning inom samma sida
fungerade redan i Chrome. Faktisk månadsbesparing återstår att mäta.

Uppföljningen på `codex/render-avatar-bandwidth` utökar privat revalidering
till registered-idle/registered-video, äldre presentation/videos och Studio
previewmedia. Färska auth-, rums-, paket-, ursprungs- och sessionskontroller
ligger kvar före återanvändning; stängda/utgångna previews och ändrade bytes
stoppas även med varm cache. En 304 utan verifierad SHA får inte återuppliva
gamla bytes. Inga ljud, video, bildrutor, kalibreringar eller godkännanden
ändras och ingen DDL eller publicering införs.

69 riktade avatar-/transportprov, 32 befintliga publicerade-mediaprov och
117 native-spelarprov passerar. Native-HTTP-provet verifierar också 304 efter
en exakt ranged hämtning; fil-, spelar- och revisionskontroller behålls.
Det nya cachetestet ingår i fullsvitens befintliga mediegrupp och
orphan-kontrollen passerar. Ett separat isolerat Chrome-prov
mot den riktiga registered-idle-routern ger samma 80 procents minskning vid
fem sidöppningar: 16 753 820 till 3 350 764 body-bytes, fem färska kontroller
i båda fallen och 404 efter indragning. SHA för hämtade bytes är identisk.
PR #321:s adresser stod för 77,1 procent av loggurvalet; med uppföljningens
adresser omfattas 99,1 procent. Detta mäter adressernas trafiktäckning, inte
besparing. Uppföljningen levereras i separat PR utan merge eller deploy;
migreringsagenten är informerad och dess kodfiler/egen handoffsektion lämnas
orörda. Bildkomprimering har lägre prioritet; byte av medieadresser och första
hämtningar kan fortfarande vara betydande och ska bedömas från nya driftdata.
