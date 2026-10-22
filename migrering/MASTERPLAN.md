# Masterplan: ett Admin, en lobby och en gemensam spelmodul

Beslut och planunderlag: 21 oktober 2026. Planleverans: [PR #311](https://github.com/Jakeminator123/scoutgaming/pull/311). Utförandestatus finns bara i [status.json](status.json), med läsvy i [STATUS.md](STATUS.md). Denna plan beställdes uttryckligen av Jakob och kompletterar [produktens befintliga migrationsöversikt](../docs/CLOUD-MIGRATION.md); den återöppnar inte den redan genomförda Neon-/Blob-flytten.

## Rekommendation och mål

**Behåll main som bas. Förnya Admin och lyft ut valda spelbeteenden från Kevins rensade branch som en avgränsad modul. Radera det som ersätts i samma leverans.** Planens lämplighet: **9/10, bedömning**. Att först storstäda hela repot och databasen utan en körbar ersättningskedja är **4/10, bedömning**: det skjuter upp användarvärdet och gör beroendefel svåra att lokalisera.

Det behövs ingen tom main, inget nytt produktrepo och ingen generell merge av Kevin över main. En granskbar featurebranch skapas från aktuell main per aktivitet. En tillfällig integrationsbranch kan användas för samprov; den är ingen ny permanent produktlinje. Jakobs säkerhetsgren lämnas kvar. Begrepp och produktansvar ägs fortsatt av [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).

När hela planen är verifierad ska användaren kunna:

- Arbeta i ett sammanhängande /admin, inklusive den zoombara klippkartan, utan en parallell /control-yta.
- Välja rum i /lobby och starta spelet genom ett enda autentiserat launchkontrakt.
- Spara och publicera de överenskomna spel-, dealer-, tal-, idle- och presentationsvalen i Admin och se rätt version i spelet efter omstart.
- Använda de utvalda Kevin-beteendena med mains behörighet, rumskoppling, Neon och Blob.
- Förstå en funktion genom UI → tjänst/kontrakt → lagring eller presentation, med färre alternativa körvägar.

J01, J02, J03, J04, K01, O01, K02, K03 och J07 är VERIFIED: **45% (9/20), 55% återstår**. J05, J08, K04 och K05 är IN_PROGRESS. Main6bcf812e är grön och PR331/335 mergade; ingen ny godkänd mergekö. PR334/J08 d7d139b9f7bf59b1bd924280ab456af12e1c8b5a har verifierad grön CI39708223137 och GitGuardian; full J08/materialbindning återstår.

PR336/d0086f5fc2391ea68f92b558ad846f7b285ea66d levererar appkomposition av samma gamePool, auth/access, K04-mottagare och scheduler, exklusiv upgrade-dispatcher samt schemaförestart och drain före poolstängning. Flaggan CROUPIER_SHARED_TABLE_ENABLED är osatt; ingen publik aktivering. Normalhook84/84 och samkörning78/78,0skip överlappar; oberoende service/server/dispatcher/parserreview utan blockerare. Bevisen är injicerad komposition och SQL-minnesklient, inte ny egen PG-/listener-/visuell acceptans. CI39716312896 pågår och GitGuardian119619175840 är success på exakt d008; ingen ny CIacceptans eller merge.

K04/23d4cd0bcb8c57e7d57a79e59dd5aff3d592a540 stänger bindLine-urvalsfyndet med egna4/4 prov och9 verifierade Gitblobbar. Kevins nya8 PG-grupper/totalt34/34 är rapporterade. Transportimporten har22/24 exakta källblobbar; endast reproducerad Windows-CRLF-parserfix och regression avviker, med1293 LF/CRLF-rader och fem aktiveringsmängder verifierat identiska. K05-head159cc134d3a57db4ccbe3a871a3a5eb16fec3656 är oförändrad. Inga nya hela aktivitetsbockar eller produktions-/deploybevis.

## Nästa samlade leverans

Orkestratorn fortsätter i denna chatt. **Root fortsätter med publik gateway/relay/Vercelrumsväg, klientreplay/presentation och samlad PG/start/readiness/drain-verifiering från PR336; Kevin fortsätter K04:s monterade klient-, felvägs- och visuella kriterier. K05-dokumenträttningen är läsgranskad; root förbereder konkret promotion/importplan före separat molnmandat.** Appkompositionen med K04-version/notifiering och scheduler är levererad bakom osatt flagga, inte aktiv publik transport. J08-materialbindning återupptas när verkliga registeridentiteter och godkänt tal finns. Återanvänd befintlig Render croupier-v2, ingen ny tjänst/skalning. Vercel API/CLI och administrationsvy är nu inloggade. Den uttryckligen godkända tomma Neon-stagingmiljön är fortfarande oskapad: formuläret saknar PGversion/CU/autosuspend och samma exakta godkända värden måste verifieras före Create. Ingen resurs/DDL skapad. Samma godkännande gäller fortsatt. Ingen ny PR ingår i automatisk mergekö.

K05-underlag159cc134 är nu granskat:1321unika rader och36/36egna validatorprov;582valda/155uppskjutna/6JS-källbevis. Riktad livekontroll bekräftar att tre Dragan-repliker saknar talgodkännande/katalogkoppling. Dessa K05-rättningar är nu verifierade på159cc134 och synkade motK04afba:unknownsource nekar,G13/TableStudio äruppskjutna,review/JS/PNG-gränser dokumenterade. Runtimekatalogen nekar review/uploads och legacy.entries tar bara JSON. Root planerar Dragan först; identiska bytes kan dela media-ID men källvariant bevaras. Ingen automatisk dealeråterställning,nyttrum,grundloopändring eller utökning av mediaschema. **Endast den beroende materialbindningen är pausad tills verkliga identiteter och godkänt tal finns.** Molnregistrering kräver separat mål/mandat; ingen importerad metadata är ett sådant mandat. Aktuell main6bcf812e är nu integrerad konfliktfritt i J08/9b43e3e7: oberoende deltareview utan blockerare, normalhook159pass/0fail/1valfrittbrowserskip. CI39701503691 och GitGuardian119571576203 är nu completed/success på exakt9b43e3e7f7cde871cdba9efe81800bf8b5c4d329; alla tillämpliga jobb körda,documentation förväntat skip. Grön kodintegration innebär inte full J08/material-/produktionsacceptans. Lokal primary main är orörd. **45% klart/55% kvar** avser nio hela aktiviteter.

**Mergeordning och mandat (22 oktober):** Den uttryckligen beställda kön PR331/335 är avklarad; **inga nya PR:ar är tillåtna för automatisk merge**. PR331 mergades till64e4c680; PR335:s frysta e4df5cba mergades med SHA-kontroll till6bcf812eff63fbec99ef0e2c931cfaa8a7e47dad efter färsk author/source/head, oberoende reviewkedja samt grön CI och GitGuardian. Inga schema-, beroende- eller produktdelta tillkom sedan review. Första automatiska godkännandekontrollen avvisade kvarvarande queued suites. Root läste därefter faktisk regelspecifikation: ruleset24642403 kräver CI, ruleset25556822 skyddar mot branchradering; efter färsk identitetskontroll godkändes vanlig merge utan bypass. Main och mergeutfall återlästes. Lokal primary main och andra agenters filer är orörda; inga grenar raderades. Main-CI39697930664 är completed/success på oförändrad6bcf812eff63fbec99ef0e2c931cfaa8a7e47dad: changes, dealer, lipsync och CI success; doc/moving förväntade skips. Main-GitGuardian-suite är queued utan checkrun, och incident-API-täckning är ofullständig; ingen ny säkerhetsklarering eller deployacceptans. PR332/334 samt Kevin- och andra ägares PR:ar har inget nytt automatiskt mergemandat. Nödvändig databasberedskap, integrationsacceptans och ägarregler enligt AGENTS gäller fortsatt. Äldre del-PR:ar är granskningshistorik och mergas inte separat. Ingen produktions-DDL, betalningsändring eller separat deploy följer av den avslutade kön.

## Frysta utgångspunkter

| Källa | Full SHA | Användning |
| --- | --- | --- |
| main | 15988f32fd572c453d2189502acbe324c4566815 | Plattform, Admin, publicering, auth, Neon/Blob; inkluderar PR310:s Talade repliker och Vila/Idle |
| jakob-gren | 15988f32fd572c453d2189502acbe324c4566815 | Verifierad säkerhetsgren, inte arbetsmål |
| kevin-merge-admin | 5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc | Fryst källa efter läppsynksfix; deltat från c4818f5 är oberoende granskat; K01-inventeringen är verifierad |
| kevin-staging | 238d6dd681745ca87a813b969443e7edee3f820b | Äldre analysunderlag; inte migrationskälla |

Refarna kontrollerades på GitHub 21 oktober. En senare käll-SHA kräver granskning av deltat; en branchs namn räcker inte som versionsbevis. Medieborttagningen är ingen garanti för att alla SQL-/runtimekopplingar är borta. K01 har verifierat inventeringen av den frysta källan; portning kräver O01:s kontrakt.

## Vad ”bäst av allt” betyder

| Område | Bas/urval | Konkret avveckling |
| --- | --- | --- |
| Admin och publicering | Main; förbättra användarflödet, behåll aktiva tjänster | Ersatta Control-sidor, formulärkopior, gamla entrypoints och deras enda tester |
| Spelkatalog och launch | /lobby + serverkontrollerat rum/paket | /game och äldre /play-katalog, gamla navlänkar och alternativa produktstarter |
| Regelkärna | Välj verifierade regler per funktion | SQL, HTTP, filer, UI, video och timers inne i själva regelkärnan |
| Delat bord och spelklient | Kevins dokumenterade beteenden som klarar K01/O01 | Kopierat auth-/wallet-/lagringssystem, hårdkodade bord/video och lokala produktregister |
| Data och identitet | Mains Neon, serverägd wallet, befintliga scoped writers | SQLite som produktfallback och bevisat oanvända tabeller efter konsumentavveckling |
| Media, tal och idle | Befintliga exakta identiteter och frysta paket i Neon/Blob | Oanvända V1-klipp från Kevin återimporteras inte; inga parallella fillager |
| Lokal utveckling | Explicit isolerad fixture där den behövs | Dolda fallbackvägar som råkar starta en annan produkt |
| Test och CI | Regler, auth, isolering, samtidighet, sparning, publicering | CSS-/sträng-/antal-lås för pensionerad implementation och redundanta byggjobb |

/play/{game} är i dag spelstart, medan /play även har varit en katalog. J04 tar bort dubbel katalog och fastställer en enda väg; en URL-radering får inte samtidigt radera serverns paket-, ägar- och autentiseringskontroller. Profil och historik får en uttrycklig destination innan gamla sidor tas bort. /studio är en teknisk basePath, inte ännu en produkt.

## Motorn ska renodlas före sammanfogning

Det finns redan åtskillnad mellan delar av regler och lagring, men serverns startkod innehåller även auth, presentation, media, äldre läsare och runtimeval. Kevins delade bord behöver granskas som tjänst, inte antas vara en fristående deterministisk motor.

Målgränser:

1. **Regelkärna:** tillstånd + kommando + explicit slump/tid → nytt tillstånd + spelhändelser. Ingen databas eller nätverksåtkomst. Reproducerbar med samma ingångar; produktionsslumpen försvagas inte.
2. **Bordstjänst:** sessioner, platser, deadlines, återanslutning, kommandon och idempotens. Tiden drivs utifrån; schemaläggning ägs här, inte av klienten.
3. **Lagringsadapter:** Postgres-transaktioner och lås för både delat bord och berörda spelare. Wallet, sko, resultat och ledger måste förbli konsistenta vid samtidighet och omstart.
4. **Presentation:** översätter committade spelhändelser till publicerade media-/talkontrakt. Misslyckad video eller tal får inte ändra utfallet eller debitera igen.
5. **Admin:** producerar validerad, versionerad konfiguration. Aktiva sessioners versionspolicy bestäms i O01; inga halvpublicerade ändringar mitt i en hand.

**Ta bort SQL ur regelkärnan, inte Postgres ur produkten.** SQLite för en namngiven, isolerad testfixture kan vara rimligt om den tillför värde; den ska inte bli en andra driftväg. Portningen ska inte börja med generell omskrivning av all SQL.

## Etapper, ansvar och procent

Varje godkänd aktivitet väger 5 procentenheter. Etappernas mål är kumulativa. Måttet avser verifierade leveranser, inte arbetsvolym eller utlovad tid. En större aktivitet kan därför ta längre tid utan att procentsiffran ökar. Förberedelser får gå parallellt enligt beroendena i status.json; en etappgrind blir inte godkänd förrän den och tidigare etapper är klara.

| Etapp | Aktiviteter | Synligt resultat/grind | Etappmål |
| --- | --- | --- | ---: |
| E1 | J01 J02 K01 O01 | Förbättrad Admin-publicering med sparning/återläsning, ersatt Control-kod borta, modulkontrakt överenskomna | 20% |
| E2 | J03 J04 J05 J06 | En Admin och en lobby; aktiva launchkontroller bevarade; runtime och tester följer produkten | 40% |
| E3 | K02 K03 J07 K04 | Kevins utvalda spel kör genom rena kontrakt och mains Postgres-adapter i isolerad miljö | 60% |
| E4 | J08 K05 J09 K06 | Admin styr publicerad konfiguration och rätt media; avvecklingsmigrering granskad och provad isolerat; produktions-DDL återstår till O03 | 80% |
| E5 | K07 J10 O02 O03 | Oberoende integration, exakt-head-granskning, erforderlig migration, leverans och faktisk driftkontroll | 100% |

- [Jakob: J01–J10](jakob-main-migrering/AKTIVITETER.md): plattform, Admin, lagring, routes, CI och städning.
- [Kevin: K01–K07](kevin-ks-migrering/AKTIVITETER.md): spelregler, delat bord, spelklient och mediakontrakt.
- Orkestratorn äger O01–O03, integration, beroenden och status. En agent implementerar, en annan granskar samma SHA. Högst ett avgränsat uppdrag per agent åt gången.

### Beslutsmandat och frågepott

Jakob gav 21 oktober orkestratorn mandat att avgöra mindre frågor inom den
beställda migreringen. Reversibla val för UI, navigation, filstruktur och
implementation behöver inte invänta Kevin. Grundkedjan prioriteras: Admin
sparar och publicerar, lobby väljer rätt rum, autentiserad launch startar
demospelet och återanslutning återläser rätt tillstånd.

Oberoende ändringar genomförs parallellt med tydligt filägarskap och separat
granskning. Gemensamma kontrakt, samma skrivvägar/index och beroendeintegration
hanteras sekventiellt. En verklig osäkerhet om auth, reservation/debitering,
spelutfall eller dataförlust löses före berörd inkoppling; den stoppar inte
oberoende Admin-städning. Befintliga ägarskaps- och produktionsgränser gäller.
Tester för avvecklat beteende ändras eller raderas; verifieringen fokuseras på den aktuella produktens beteende och berörda risker.

| Frågepott | Hantering | Blockerar grundmigreringen? |
| --- | --- | --- |
| Verklig aggregator och dess API | Separat senare integration; demo och explicit walletgräns är redan beslutade | Nej |
| Ytterligare externa tjänster eller fördjupad rapportering utöver överenskommen grundfunktion | Dokumentera konkret behov här när det uppstår; ingen parallell implementation utan behov | Nej |
| K02:s reserverad konsumtion kontra ny fri insats | Avslutad sakfråga: rättningsdelta0493af3e läsgranskat, exakt head har grön CI39660600012; K02 är VERIFIED | Finansieringsfyndet blockerar inte längre |
| K03:s reservationsåterhämtning | K03 är VERIFIED som isolerad port påb8e1c957; faktisk adapterverifiering återstår i J07 | Ingen kvarstående blockerare i rättningsdeltat; ingen runtimeacceptans |
| Undo efter passerad insatsdeadline | Första demoetappen använder clear för återhämtning före start; senare utökning får bedömas separat | Nej |
| Logo/placering, återföring av avslutade spel, fler bordsspråk och fria timerprofiler | Ingår inte i första demon. Återanvänd befintliga språk en/sv, exakta mediereferenser och standardtider; pröva utökning när ett konkret behov finns. SQL-rollback och demo-credit är inte ekonomisk återföring. | Nej |

Frågepotten flyttar inte bort avtalade krav på klippkarta, sparning, behörighet,
publicering, korrekta spelregler eller exakt mediaidentitet. Status uppdateras
vid verifierad leverans; en beslutad förenkling ger inte i sig färdigprocent.
### O01 — Lås kontrakt och funktionsansvar

Beroende: K01. Kan förberedas samtidigt som J01.

- [x] Jämför main och exakt Kevin-SHA i en funktionsmatris: behåll, porta, ersätt eller radera, med konsument och testfall.
- [x] Bestäm vilka spelbeteenden som faktiskt omfattas: regler, seats, countdown, reconnect, saldo, sko, idle, tal, kort och tillgänglighet. ”Bäst” måste få observerbara acceptanskriterier.
- [x] Lås kontrakt för kommandon, händelser, lagring och presentation samt configversion/rum/paket.
- [x] Ange varje Admin-inställnings ägare, tillåtna värden, skrivmål, publiceringsgräns och verkan i aktiva/nya sessioner.
- [x] Bekräfta kontrakten med båda ägarna och placera dem i befintliga kanoniska kontrakt/docs, med ändrade beteendetester. Inga nya parallella register eller regelböcker.

Klart: Kevin och Jakob kan implementera sina sidor utan att behöva kopiera varandras runtime eller gissa schemasemantik. Bevis och granskad SHA förs till status.json.

#### O01: kontrakt, Adminurval och provspårning verifierade

Utgår från main15988f32fd572c453d2189502acbe324c4566815 och Kevin-kod
5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc. Root accepterar backenddelen i
[fryst O01-specifikation](https://github.com/Jakeminator123/scoutgaming/blob/9c669e67e40c387c84fea6d02449698d373c4c49/migrering/kevin-ks-migrering/K01/O01-svar.md) efter
root/kevin_plan-granskning och plan_review-avstämning. [Beslut6325862074](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6325862074).
Följande preciseringar gäller tillsammans med specifikationen:

- next tar R → P(lämnande spelare, sorterade) → A innan utträde/rundreset.
- Reservationskontroll sker före ren core; faktisk consume efter core på samma
  transaktion. Vägran återställer samtliga försökets effekter.
- Mottagaren applicerar endast högre planversion. Identisk senast accepterad
  version kvitteras applied utan ny applicering; lägre version ger stale.

K01 och O01 är VERIFIED. Backendöverenskommelsen på9c669e67, Adminmatrisen
nedan och 44/44 faktiskt körda isolerade kontraktsprov är granskade av root
och plan_review utan blockerande fynd. Jakobs mandat omfattar detta avgränsade
demourval. J07 har därefter verifierats separat mot riktig PostgreSQL;
J08:s writer-/publiceringsacceptans pågår och ingår inte i O01-beviset. Ingen runtimeinkoppling, DDL eller mediaimport görs här.

**Fastställt av Jakob 21 oktober: demo först, aggregatorgräns förbereds.**

Beslutet är lämnat direkt i denna chatt och [förmedlat till Kevin](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6321854403).
K02 äger inga pengar eller saldo och gör inga I/O-anrop. K03 samordnar via en
explicit WalletPort; J07 binder den till mains serverägda demowallet och
Postgres-transaktioner. Reservation, konsumtion/frisläppning, ledger, kvitto,
rumsstate och audit får den avtalade atomiska gränsen i denna demoadapter.
Alla berörda main-writers ska respektera samma reservationer.

En verklig aggregator äger saldo och betalningar i en senare separat integration.
Denna migrering förbereder adaptergränsen men implementerar eller aktiverar ingen
extern betalningskoppling. En sådan adapter får inte antas vara ett direkt byte
av SQL-klient: HTTP-effekter delar inte lokal rollback. Framtida API-underlag
måste specificera stödda reservationer/bet/win/reversal, valuta, idempotens,
statuskontroll, osäkra svar och avstämning innan extern acceptans kan göras.

Kodverifierat på main15988f32 av root och underagent: server.mjs:155 väljer
storage/async-partner-api.mjs, som på rad137 blockerar extern wallet med503.
Callbacken i services/game/partner-api.mjs:97/161 hör till SQLite-spåret och
anropar HTTP före lokal transaktion; den återinförs inte. Befintlig extern-wallet-
spärr behålls tills en separat integration är verifierad. Extern konfiguration
får inte tyst falla tillbaka till demopengar. Demo betyder syntetiska pengar,
inte en ny lokal produktdatabas. Ingen drift- eller aggregatoranslutning är
verifierad av denna läsgranskning.

Skydd mot dubbla insatser och förlorade svar krävs även med extern wallet.
Kevins retrygodkännande, vidarebefordrat av Jakob, accepterar riktningen för
nekad consume: återställ startens spel-/walleteffekter, bevara accepterade val
och reservationer och ompröva först efter relevant tillståndsändring. Beständig
blocked-markering sparas enligt den valda savepointmekaniken nedan.
Databasmappning och isolerad verifiering följer J07/J09; root kopplar in Kevin
när en konkret schemamappning behöver hans hjälp. Beslutet är inte DDL-mandat.

**Verifierade skillnader som portningen måste hantera:**

| Nuvarande Kevin-beteende | Föreslagen kontraktsriktning |
| --- | --- |
| Bara act kräver exakt globalversion; andra operationer använder fas/ägarskap. Ett sent kommando kan anlända i nästa rundas samma fas. | Separera snapshotversion från insatsfönster-/rund-/turidentitet. Tillåt samtidiga insatser på egna boxar inom samma öppna fönster; avvisa försenade kommandon till annat fönster. Rättighets- och saldokontroll sker server-side i transaktionen. |
| seen/advance körs före requestId-kontrollen; en retry kan driva tidsövergång/audit och returnerar aktuell snapshot. | Spara stabilt kommandoresultat under (roomId, actorId, commandId), avvisa ändrad input och håll aktuell snapshot separat. Skilj tidsdrivna övergångar från kommandoåterspelning så att sidoeffekter får en egen beständig identitet. |
| limitsFor läses under drift; efter deadline kan nya gränser stoppa advance före både state och clear. Klientens länkspråk kan skriva bordsspråk även vid senare poll. | Admin äger gemensam configVersion, inklusive språk. Frys versionen innan insatsfönstret öppnas och genom avräkningen; lagra den över omstart. Ny publicering väntar till nästa fönster. Redan accepterade insatser ändras/rensas inte som bieffekt. En spelares länk eller login får aldrig skriva bordets konfiguration. |
| onPlan anropas före databasens COMMIT; rollback tar inte tillbaka startat workerarbete. | Lagra presentationshändelsen atomiskt med kommandot och leverera först efter commit med återläsbar sekvens och dubblettskydd. |
| Läppatchar söker inom ±48 tidsindex vid 24 fps och har slutrute-/VILA-reservval. Gamla indexnycklar rensas inte vid patchbyte. | Bevara exakt dealer/källbildruta/ljud/bank och planversion. Andra bildrutor kräver verifierad ekvivalens och separat ljudtidskontrakt. Rensa ersatta index och spärra tysta/äldre versioner; saknad giltig patch ger kropp/ljud utan munlager. Tidsfönstret är inte bevis för synk. |

Kodreferenser: K server/shared-table.mjs:207–232,329–346; public/shared-table.js:70–72;
public/lip-layer.js:53–60,74–90,143–161; server/rorlig-lipsync.mjs:260–268.
Kodriskerna är läsverifierade, inte observerade i en ny körning. SQLite-skrivlåset
gäller databasfilen även mellan processer; dess serialisering får inte antas gälla
automatiskt när lagringen flyttas till Postgres.

**Mains skrivvägar — läsverifierad bas på 15988f32:**

G är befintligt advisory-lås 1129467984, P spelarens radlås, S Studio-scope.
A nedan är ett föreslaget separat spel-auditlås; ingen DDL är utförd.

| Skrivväg | Befintlig transaktion/auktoritet | Samordning före J07-port |
| --- | --- | --- |
| /api/table → services/game/postgres-native-table.mjs:14 | P; blackjackstate per spelare, saldo, ledger och senaste presentationskvitto i samma commit. | Bevara gemensamt spelarlås; besluta beständig återspelningshorisont. |
| /api/roulette/table → services/game/games/roulette/storage.mjs:44 | P; roulette-state/ledger och senaste 20 kvitton. Publiceringskontroll använder samma klient men tar inget publiceringslås. | Rouletteägaren måste samordna reserveringar och versionsgräns. |
| /api/deposit och /api/currency → services/game/server.mjs:265 | G → P → ledger; ingen kommandoidempotens. Valutaspärren läser bara gamla blackjackstate. | Valuta och tillgängligt saldo måste ta hänsyn till samtliga aktiva bord/insatsreservationer. |
| Partner-table/demo-credit/Studio-credit → services/game/storage/async-partner-api.mjs:95 | G → P. Partner-replay jämför spelare/op, inte hela input; Studio använder kortlivad nonce. Externa wallets är spärrade. | Beständigt kommandoresultat och full inputfingerprint; inga kopierade externa wallets. |
| Admin konto/status/lösenord och relaterade sessioner → packages/storage/server/player-administration.mjs:23 | G → P → konto/session/adminaudit. Kontostängning kontrollerar gamla blackjackstate. | Admin/auth måste känna till delade händer, reserveringar och avräkning. |
| Admin rum/publicering → apps/studio/lib/studio-native-runtime.mjs:132 | G → S → operatörslås; Studio-/operatörsaudit, ingen spelhashkedja. | J08/publiceringsägaren samordnar configVersion; Studio-audit ersätter inte spel-audit. |

Fasadens AsyncLocalStorage delar endast arbete inom samma pool/transaktionskontext.
Råa gamePool-transaktioner deltar inte automatiskt: injicera den redan låsta SQL-klienten
i alla berörda adapters. Se packages/storage/server/postgres-store.mjs:70–107.
Återanvänd inte G som auditlås efter P: befintligt G → P skulle då få motsatt
låsordning. Om G behövs i ett flöde tas det först, följt av deklarerade berörda rum
i sorterad ordning → sorterade spelare → separat A. Ingen senare låsutvidgning.
Studio-/operatörslås ska inte hämtas efter spelar-/auditlås på en ny anslutning.
Den slutliga ordningen och publiceringskontrollen måste stämmas av med alla skrivägare.

Orkestratorns 9/9 befintliga isolerade prov, 0 skip, verifierar mockade kontrakt för
G → S, nekad låseskalering, gemensam klient, rollback och wallet/state/ledger/kvitto.
Kommando och logg finns i status.json. Detta är inte ett faktiskt Postgres-raceprov
och godkänner inte den föreslagna flerbordsordningen. Mains ledger är inte en
spelhashkedja. Kevins fortsatta förslag avgränsar den nya kedjan till spelens
egna händelser; övriga walletwriters behåller mains ledger/audit.

Tidigare rättningsfynd och deras beslut finns i status.json[O01/K02/K03] och
[GitHub-tråden](https://github.com/Jakeminator123/scoutgaming/issues/312).
Aktuellt bevis: plan_review körde13/13 K02,30/30 K03 och1/1 kompletterande
språkprov på blobhashverifierade källor; root läste loggar och språkprovet.
52/52 och tidigare hookkörningar på Kevins sida är fortsatt rapporterade.
[Provmappning och kommandon](kevin-ks-migrering/AKTIVITETER.md#o01--faktiskt-körda-isolerade-kontraktsprov-21-oktober).

**Adminfält — fastställd minimiomfattning för O01/J08:**

Urvalet nedan gäller första demon inom Jakobs mandat. Kodunderlag: main
15988f32, Kevin 5aa7ed10, K03 b8e1c957 och O01-spec 9c669e67. **Befintlig**
betyder läst writer/validator på main. **Mål J08/J07** betyder beställd
koppling, inte implementerad Adminfunktion eller verifierad PostgreSQL-adapter.
Spelaren får inte skriva bordskonfiguration via join, poll, språkval eller URL.

| Fält och ägare | Tillåtet värde / validator | Writer | Publiceringsgräns | Konsument |
| --- | --- | --- | --- | --- |
| Rumsnamn, företag, komposition och spel — N1 | name 1–100 tecken utan kontrolltecken; registrerat operatorId/presentationLaneId. Kevin-modulen omfattar blackjack; befintlig roulette behåller sin väg. | Befintlig presentation-room-api med idempotencyKey och projekt-/admin-/paket-CAS | Atomisk rum/paket-publicering; autentiserad ägar- och mediebindning kontrolleras igen. Mål J08/J07 binder spelconfig till samma publicerade rum/paket. | Lobby, roomPlayPath, mains game-entry-selector, K03-rumsadapter |
| Insatsprofil — N1 | limitPreset = casual/prive/high, standard prive; hela limits/chips/refill-paketet i tabellen nedan. Inga fria belopp eller rå JSON i första demon. | Mål J08: validerat rumsutkast och publicering genom befintlig rum/paket-writer; J07 ConfigPort.latest/frozen | Ny configVersion; samma profil fryses för ett fönster och dess runda. Publicering ändrar inte lagda insatser. | K03 bet/ready/refill, K02 step med limits; refill går via mains globala demo-wallet/ledger |
| Bordsspråk — N1 | language = en/sv. Valet kräver motsvarande exakta tal-/mediabindning i valt paket; saknat stöd nekas vid publicering, ingen tyst språkfallback. Privat UI-lokalisering är separat. | Mål J08/J07: samma configpublicering som insatsprofil | Språk binds till configVersion/windowId och gäller även återanslutning/omstart. Join/poll ändrar inget. | K03 presentation.plan/outbox.language; K04 väljer exakt inspelning/tal för publicerad dealer |
| Rundtider — N1, standardprofil i första demon | betMs=20000 och actionMs=15000, befintliga Kevin-standardvärden. Visas i Admin; fria timerfält ingår inte i första demon. | Mål J08/J07: värdena sparas i samma publicerade configVersion | Servern lagrar deadlines; klientnedräkning får inte styra start eller ändra ett öppet fönster. | K03 första insats, action/insurance-deadline och självständig scheduler |
| Rummets bord, bakgrund, dealer och färg — N1; partner endast enligt befintlig grant | roomOverrides[roomId].table/background/dealer från publicerade tillåtelselistor; color enligt /^#[a-f0-9]{6}$/ och tillåten palett. Rätt rum/företag/dealer krävs. | Befintlig partner-branding-api save-draft/review/publish med draft-/paket-CAS och reviewToken | RoomOverrides för rätt rum; delad mall är inte rumswrite. Mål J08/K04 binder det valda paketet till configVersion så pågående runda behåller sitt material. | Mains paketresolver, därefter K04:s presentation |
| Dealer, klipp, grundloop och talunderlag — N1 | Registrerade dealer-/media-ID:n och exakt hash. Idle: validateRegisteredIdlePolicies/validateIdlePolicy, samma dealers baseline. Talprofil: normalizeDealerSpeechProfile + validateDealerSpeechReference; state preparation/enabled, egen röst och egen video/hash/offset. Enabled är inte i sig drift- eller kvalitetsgodkännande. | Befintlig saveProject med expectedRevision och paketpublicering; ingen ny person-/mediekatalog | Exakt paket/playbackrevision fryses. Mål K04/K05 mappar Kevins take/frame/audio till godkänd identitet; ingen återimport av bortvald V1. | Gemensam presentation, lugn idle, K04-tal/kort/lipsync; K02 förblir utan media |
| Lipsync-drift — N1, miljöscopad | Befintligt mode off/saving/warm, validerad profileId; warm durationSeconds 1800/7200/86400; expectedRevision och commandId. Inga råa worker-URL:er eller hemligheter som rumsfält. | Befintlig moving-drift-admin/controller; miljögrind krävs | Egen driftrevision, inte configVersion. Ändrar inte spelutfall eller publicerad medieidentitet. Ingen ny providerstart/GPU-körning beställs här. | Tal-/moving-kopplingen efter befintlig sessionsverifiering; utan worker gäller avtalade inspelade steg/idle |
| Djuplänk till rum/spel/dealer — härledd, skrivskyddad | Befintlig roomPlayPath och serverkontrollerat rum/paket/spel/dealer; query är aldrig konfigurationsauktoritet | Ingen ny writer | Länken pekar på publicerat rum; launch revaliderar session, ägare och paket | Lobby och mains launch/game-entry-selector |
| Shoe-proof/auditrapport — N1-läsning | commitment för öppen sko, full proof först efter stängning; råtext/nyckelordning bevaras och global auditsekvens verifieras | K03 AuditPort skriver i speltransaktionen; mål J08 visar läsvy. Befintlig skostatistik är inte detta bevis. | Ingen Admininställning för RNG, kort eller utfall; config-/rund-/skoreferens följer beviset | K02 verifyShoe och global verifyChain; ingen certifierings- eller lipsyncacceptans påstås |

Profilerna är exakt Kevins befintliga LIMIT_PRESETS, inte mains tidigare
hårdkodade sololimiter. Beloppen är demoenheter. refill är beloppet för ett
uttryckligt idempotent refill-kommando; join skapar ingen lokal startplånbok.

| limitPreset | min / max / sideMax | chips | refill |
| --- | --- | --- | --- |
| casual | 1 / 500 / 50 | 1, 5, 10, 25, 50, 100 | 500 |
| prive (standard) | 5 / 2000 / 200 | 5, 10, 25, 50, 100, 500 | 1000 |
| high | 100 / 25000 / 1000 | 100, 500, 1000, 5000, 10000, 25000 | 50000 |

**Gemensamt målkontrakt för publicering:** Spara skapar endast utkast.
Mål J08: de befintliga revisions- och behörighetskontrollerna omfattar alla nya
fält; publicering gör paketbindningen och en oföränderlig configVersion
tillgängliga atomiskt. J07:s ConfigPort läser den publicerade versionen på
den redan låsta SQL-klienten. Ett nytt fönster binder den senaste versionen
och behåller den genom avräkning och omstart. Endast tomt bord utan main
och deadline får genom ett uttryckligt serversteg skapa nytt windowId med
ny version; snapshot/replay gör aldrig detta. Ogiltiga fält, fel ägare och
inaktuell revision nekas utan delvis publicering. Befintlig paketrevision
ersätter inte denna fönsterbindning.

Presentationens leadMs/cardMs är K04:s serverägda planering, inte fria
operatörsfält. K03-fixturens 700/500 ms är testdata, inte accepterad timing för
ett visst klipp. K04 binder verklig planering till exakt publicerat material;
regeln om kropp/ljud utan giltig munpatch gäller fortsatt.

Läsbevis för matrisen:

- main: packages/presentation/contracts/presentation-room.mjs:5 och apps/studio/lib/presentation-room-api.mjs:286–320 (rum, CAS, atomisk publicering); partner-branding-api.mjs:164–215,259–291 (allowlist, roomOverrides, review/publicering).
- main: packages/presentation/server/saved-game-policy.mjs:145–173 (projektwriter); contracts/dealer-speech-profile.mjs:8–42,82–87 och runtime/registered-idle-policy.mjs:22–35 (exakt profil/idle); contracts/frozen-dealer-playback.mjs:51–95 (paketets mediebindningar). Sökvägarna under contracts/runtime avser packages/presentation/.
- main: packages/presentation/contracts/studio-speech.mjs:39 (en/sv); contracts/moving-drift.mjs:3–22 och apps/studio/lib/moving-drift-admin.mjs:42–49 (drift); services/game/storage/async-partner-api.mjs:198–200 (demo-credit, inte spelåterföring).
- Kevin 5aa7ed10: kevin/croupier-scoutgg/server/studio-tables.mjs:8–14,38–43 (profiler; standardvalet prive fastställs här); server/shared-table.mjs:42 (20s/15s). K03 b8e1c957: services/game/games/blackjack/table/ports.mjs:30 och coordinator.mjs:101–135,297–343 (config, språk, refill, limits, deadlines).
- Spårbara kontraktsprov:13/13 K02,30/30 K03 och1/1 språk, inga skips; se provmappningen ovan. Dessa verifierar inte framtida Adminvalidatorer, HTTP-auth, media, PostgreSQL eller K06:s hela spara→publicera→spel-flöde.

**Gemensamma gränser och kvarvarande beslut:**

- Mains auth bestämmer actor, operatör och tillåtet rum. Kommandot bär roomId,
  commandId och relevant fönster-/rund-/turidentitet enligt accepterad matris.
  configVersion binds server-side till fönstret; global version är snapshotversion.
  Replay och state/tick följer det delaccepterade kontraktet ovan.
- Behåll mains globala saldo. Rum, saldo, avräkning, kvitto, idempotens och audit
  committas atomiskt. Mains skrivvägar ovan kräver separat auditlås och G först
  där G behövs; slutlig ordning stäms av med berörda ägare. J07 verifierar
  implementationen. Dolda kort och utfall förblir serverägda.
- Rumsstate inklusive shoe proof, auditpayload och separat proof bevaras som text.
  Nyckelordning/numeriska typer kräver kompatibilitetsprov; rowid ersätts uttryckligen.
  Studio-audit ersätter inte spelhashkedjan.
- Bevara deterministisk lugn väntekedja, klippgräns vid hit/stand, tal/idle och
  fortsatt kropp/ljud vid sena eller saknade patchar. Utan worker används befintliga
  godkända inspelade videosteg; väntekedjan filtreras fortfarande till calm/andas.
  vilaMap byter patchkarta, inte kroppens uppspelning. Exakt VILA-ekvivalens och
  kompatibel worker krävs innan sådana reservval kan accepteras.
- Nödvändiga kontraktsprov: parallella insatser; sent kommando i ny runda;
  retry över deadline med stabilt resultat och inga dubbla effekter; rollback utan
  presentation; publicering med liggande insatser och omstart; språk vid join/poll;
  omordnad patchavkodning, ersatta index, tysta rutor, sen version och workerbortfall.
  Riktade isolerade prov räcker för kontraktsarbete; visuell läppsynk kräver separat
  acceptans och inga nya GPU-prov är beställda här.

O01 är verifierad som kontraktsaktivitet efter oberoende slutreview av
Adminurvalet och provspårningen. Detta godkänner inte framtida writers eller
full K02/K03-integration. Faktiska PG-/GPU-/produktionsprov följer egna
aktiviteter; media är fortsatt kandidater, inte importgodkända.

### O02 — Oberoende samprov

Beroende: K07 och J10.

- [ ] Frys en integrerad kandidat och verifiera schema, miljö, webb, motor och media separat.
- [ ] Kör Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning.
- [ ] Verifiera negativa fall: fel rum/ägare/roll, inaktuellt paket, dubbelkommandon, samtidiga spelare, avbruten presentation och felaktiga media-ID.
- [ ] Visa att borttagna ytor inte kan starta en alternativ produkt, och att testfixturer aldrig använder riktiga användardata.
- [ ] Granskare redovisar observerat resultat, testmiljö och kvarvarande brister; tidigare agentkvitton tillskrivs sina författare.

Klart: inga blockerande fynd; verkliga driftprov redovisas åtskilda från automatiska tester.

### O03 — Integration och leverans

Beroende: O02.

- [ ] Kontrollera aktuell main, PR-ägare, källrepo, full head, konflikter, obligatorisk CI och säkerhetsstatus.
- [ ] Följ AGENTS.md:s ägarregel: Kevin-ägd PR kräver Jakobs uttryckliga godkännande för just PR och oförändrad head. Citerade Slack-meddelanden är inte det godkännandet.
- [ ] Kör schemaändringar i godkänd ordning. Krävd Neon-readiness måste passera före merge; expansion/tolerant kod/avveckling får delas i flera PR:er där det behövs.
- [ ] Godkänd release ska ha verifierad Vercel-/Render-SHA, schema, vanlig inloggning, Admin-sparning, launch och relevant spelfunktion.
- [ ] Dokumentera återställning som fungerar med faktiskt migrerat schema, uppdatera befintlig handoff och stäng egna claims.

Klart: den integrerade produkten är faktiskt levererad och verifierad. Ingen förhandsmarkering av 100% för grön CI eller färdig plan.

## Radera med ett konkret slutdatum

I varje ändring ska agenten ange **vad som ersätts och vad som därför raderas**. Följ konsumenterna hela vägen: route → komponent → tjänst → adapter → data → build/env/test/docs. Ett gammalt namn räcker inte som raderingsbevis; en pensionerad implementation behöver inte behållas för sitt namn eller sin historik.

- **Kod:** ersatt eller utan aktiva konsumenter tas bort tillsammans med registreringar, tillhörande ensamma tester och instruktioner. Git är återställningen för versionerad kod.
- **Oklarhet:** gör en avgränsad konsumentkontroll i den aktuella aktiviteten. Notera konkret återstående fråga och ansvarig; bygg inte en permanent extra kompatibilitetsväg för att slippa avgöra.
- **Databas:** ta först bort läsare/skrivare och uppdatera schema/readiness. Prova migrering och återställning isolerat, därefter separat godkänd produktionsåtgärd. Noll rader är inte ett tillräckligt bevis för att tabellen kan släppas.
- **Media:** koppla exakta ID/hashar till aktiva och historiska paket. Oanvända Kevin-filer ska inte importeras. Historiskt refererade main-media raderas inte genom namnmatchning.
- **Ignorerat:** inventera bara utpekade metadata och konsumenter i exempelvis lab/data och open-claw/lab/data. Respektera .ignore; läs inte hemligheter, binärmassor eller det privata historiska dokumentarkivet. Ingen rg --no-ignore. Återställningsmaterial är inte en alternativ produktkälla.
- **Tester/regler:** avveckla gamla layoutlås samtidigt med ersättningen. Behåll säkerhets-, transaktions- och spelregler. Referenser till gamla repon får inte få agenten att återställa pensionerad kod.

Aktiva gemensamma tjänster flyttas eller får neutralt namn endast när det underlättar ansvarsfördelningen. En filflytt utan bättre flöde eller borttagna alternativ räknas inte som slutförd aktivitet.

## Arbetsordning nu

1. Läs [STATUS.md](STATUS.md), aktivitetsfilen, AGENTS och relevanta kanoniska dokument. Bekräfta rätt checkout, full bas-SHA och filägande.
2. Starta J01 och K01 parallellt. O01 samlar kontraktsbesluten. J02 följer direkt på den verifierade ersättningen.
3. Fortsätt enligt beroendena; integrera små granskbara PR:er. Orkestratorn gör Git-operationer i gemensam checkout; andra agenter äger separata filer eller worktrees.
4. Avrapportera vid blockerare eller färdig leverans, med aktivitet, SHA och bevis. Uppdatera status.json och generera STATUS.md. Gemensam GitHub-tråd #312 bevakas högst en gång per schemalagd femminuterskörning; inga vänteloopar eller kvittenssvar.
5. Använd [samarbets- och åtkomstguiden](SAMARBETE-OCH-ATKOMST.md) för GitHub-samordning, Slack och behörigheter.

**Tidsbild, grov uppskattning:** första synliga J01-jämförelse inom 2–4 arbetstimmar efter implementationens start; det är en återkopplingspunkt, inte löfte om en färdig sida. E1 ungefär 1–2 arbetsdagar. Hela programmet ungefär 7–12 arbetsdagar med två tillgängliga implementerare och en orkestrator, om kontrakt och åtkomst kan fastställas tidigt. Skatta om efter K01/O01; schemaavvikelser, samtidighetsfel och mediakrav kan ändra utfallet. Separat beställd femminutersbevakning av GitHub-tråden är aktiv; den ger inget utökat ändringsmandat.
