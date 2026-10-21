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

Jakob har uttryckligen startat J01/J02 med underagenter, parallell K01/O01-granskning och separat SQL-läsroll. J01, J02 och K01 är verifierade; aktuell färdiggrad är 15% enligt status.json. Leveranserna är ännu inte mergade. På Jakobs uppdrag har J03-delarna Guide/Videor (PR318, grön CI) och Probe/Replies (PR320, grön CI) levererats ovanpå J02. Events/Tree är nu lokalt verifierad i PR322/head 2ea99899228b9574bbf142ae80f3e7a776af0a5b ovanpå PR320; GitHub CI39649419165 är success på samma head. Compositions/Rehearsal är lokalt verifierad i PR324/head 43c0ca8155fdc9f3f8f3b3be22a8d10fd99082ee ovanpå PR322: två ytterligare wrappers borta, rumskontext och navigeringsskydd rättade. Ordinarie hook350/350,0skip, build/typer och oberoende review passerar; CI39657917855 pågår. Tre underagenter, inklusive oberoende granskning, deltog. Aktuell main644b565 är separat läst men inte integrerad i leveransen. O01 är fortfarande olåst och J04 är läskartlagd. Ren dokumentrouting kräver inte nya spelkontrakt; hela J03 behåller O01 som slutberoende. Förarbete och start ger inga migrationspoäng.

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

### O01 — Lås kontrakt och funktionsansvar

Beroende: K01. Kan förberedas samtidigt som J01.

- [ ] Jämför main och exakt Kevin-SHA i en funktionsmatris: behåll, porta, ersätt eller radera, med konsument och testfall.
- [ ] Bestäm vilka spelbeteenden som faktiskt omfattas: regler, seats, countdown, reconnect, saldo, sko, idle, tal, kort och tillgänglighet. ”Bäst” måste få observerbara acceptanskriterier.
- [ ] Lås kontrakt för kommandon, händelser, lagring och presentation samt configversion/rum/paket.
- [ ] Ange varje Admin-inställnings ägare, tillåtna värden, skrivmål, publiceringsgräns och verkan i aktiva/nya sessioner.
- [ ] Bekräfta kontrakten med båda ägarna och placera dem i befintliga kanoniska kontrakt/docs, med ändrade beteendetester. Inga nya parallella register eller regelböcker.

Klart: Kevin och Jakob kan implementera sina sidor utan att behöva kopiera varandras runtime eller gissa schemasemantik. Bevis och granskad SHA förs till status.json.

#### O01: kontraktsförslag för avstämning — ännu inte låst

Utgår från main 15988f32fd572c453d2189502acbe324c4566815 och Kevin-kod
5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc. Kevins [O01-svar](https://github.com/Jakeminator123/scoutgaming/blob/24cacc5a2830b265604624a3ee371e8a3f4ab2a7/migrering/kevin-ks-migrering/K01/O01-svar.md)
är oberoende kodgranskade, inte runtimeprovade. K01:s två blockerare är stängda
och inventeringen är VERIFIED i PR #314. Inga kontrakt är låsta och detta
startar ingen runtimeport, DDL eller mediaimport.

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

**O01-avstämning 362ad39 — konsoliderad läsgranskning, fortsatt olåst:**

Kevins [specifikation](https://github.com/Jakeminator123/scoutgaming/blob/362ad392acd70f49d7a6198f91e2f61c02ebd572/migrering/kevin-ks-migrering/K01/O01-svar.md#L80)
i PR314 är dokumentation; produktkällan är oförändrad5aa7ed10.
Underagent och root granskade 551b2e8. Root har nu även läst dess enda efterföljande dokumentdelta 362ad39: savepointtexten följer beslutet i6322089912. K02 utan I/O,
scoperade ledgernycklar, beständig outbox och speech_choice i global audit är
preciserade. Accepterat insurance-ja är nu bindande även vid pause/leave/frånvaro;
kontogeneration fångar leave→rejoin. Scheduler utan first-caller och ingen
kvittogallring under migreringen är införda. Det är specifikationsgranskning,
inte implementerad funktion eller utförda samtidighets-/recoveryprov.

| Kontraktspunkt | Ägare och nästa steg |
| --- | --- |
| Demo-/aggregatorgräns | Jakobs demo-först-beslut ovan gäller. Omfattningen är nu explicit i551b2e8; root äger mains demoadapter och reservationswriters i J07. Extern aggregatorimplementation ligger utanför denna migrering. |
| Medlemsidentitet | Rättad i551b2e8: accountMembershipGen gäller kontot, memberGen gäller (rum, aktör). |
| Beständig blockering efter nekad consume | blocked finns i outcome-enum. Root väljer inom J07 samma klient och yttre transaktion: hela G/R/P/A-låsplanen före savepoint; återställ nekade försökets spel/wallet/ledger/outbox, behåll låsen och skriv blocked-kvitto samt audit före yttre COMMIT. Misslyckad persistens ger full rollback. Formuleringen är verifierad i362ad39; två fulla transaktioner används inte. Verkliga samtidighets-/kraschprov återstår. |
| Omprövning | Riktningen är godkänd via Kevins besked, vidarebefordrat av Jakob: inga accepterade insatser rensas automatiskt; nytt försök först efter relevant ändring. K03/J07 provar att omstart behåller blockeringen och att samma tillstånd inte ger retry-loop. |
| Pausepolicy | 24h från commit är varaktighet. Behandling av ett sent första kommando är fortfarande en kontraktspunkt att fastställa, skild från accepterat kommandos idempotenta replay. |

[Granskningsbesked](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6322089912)
och [walletavgränsning](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6321854403)
ersätter tidigare öppna antaganden om redan fungerande aggregatorintegration.
Bordsspråk ägs av Admin enligt Jakobs mål; privat UI-lokalisering får inte byta
bordets media/ljud. Språkets publiceringsgräns följer fryst configVersion.
Exakt dealer/take/frame/ljud/planversion är mediegränsen. Deklarerade sista-frame-
och vila-ekvivalenser samt ±48-tolerans är ännu inte verifierad läppsynk eller
acceptans att importera media. K04 måste pröva kompatibiliteten separat.

Audit-headläsning/INSERT i fryst Kevin-kod är synkrona separata autocommit-satser
utan await. Förgrening är en risk vid konkurrerande skrivare, inte ett nytt
verifierat driftfel i en ensam synkron process. Global verifiering läser hela
sekvensen; filtrerad rumsvy är inget kontinuitetsbevis. Shoe proof gäller hela
stängda skon. Main server.mjs:209 saknar ännu ledger-id via SQL RETURNING.

Acceptans i K03/J07 omfattar samtidiga identiska kommandon över deadline,
reservationer över flera bord och annan writer, insurance-ja/livscykel,
pause med medlemskapsrace och leave/rejoin, nycklar i två rum, atomisk
wallet/audit, konkurrerande append samt krasch efter commit/före kvittens
utan ny outboxversion. O01 är IN_PROGRESS. Ingen runtime, DDL eller GPU-körning
gjordes i denna läsgranskning.

**Adminfält på main — O01/J08:s läsverifierade återanvändningskarta:**

Granskad på main15988f32 av jakob_plan; orkestratorn har kontrollerat centrala
kontrakt/writers. Detta är inventering, inte accepterat funktionsurval eller
implementerad rundbunden configVersion. Befintlig paketrevision räcker inte
ensam för att bestämma när nya värden börjar gälla i ett pågående spel.

| Kandidat | Faktiskt stöd och införandebeslut |
| --- | --- |
| Språk per bord | Nytt rums-/publiceringsfält. Befintlig en/sv-validering i apps/studio/lib/studio-admin-accounts.mjs:117 gäller launch-JWT, inte bordsspråk. Admin ska äga gemensamt språk; klientlokalisering hålls separat. |
| Logga/placering | Ingen aktiv motsvarighet funnen i granskade Admin-writers. packages/operators/contracts/branding.mjs:2 tillåter bara table/background/dealer/color i roomOverrides. Nytt fält kräver validator och konsument, inte extra rå-JSON. |
| Insatsnivåer | Ny Admin/publiceringskoppling. services/game/shoe-game.mjs:52 och games/roulette/rules.mjs:5 använder hårdkodade validatorer. Tillåtna värden och verkan per insatsfönster behöver avtalas. |
| Rundtimers | Nytt kontrakt; presentation-room.mjs:5 saknar timerfält. Timer/deadline måste vara serverägd och beständig, inte en fristående UI-nedräkning. |
| Lipsync-worker och nyckelreferenser | Återanvänd miljöscopad moving-drift: off/saving/warm, profileId, expectedRevision och commandId; kontrakt moving-drift.mjs:9, writer moving-drift-admin.mjs:42. Detta är inte en färdig per-rums-knapp och ger inget mandat till betald drift. |
| RNG shoe-proof-rapport | Ny port av skobeviset; befintlig studio-admin-readouts.mjs:20 ger skostatistik och certificationVerified:false. Visa bara tillåtna bevis efter stängd sko, bevara råtext och global auditgräns. |
| Wallet rollback | Saknar motsvarande produktfunktion. Positiv demo-credit och SQL-rollback vid misslyckad transaktion är inte återföring av genomfört spel. Föreslås ligga senare och kräva uttryckligt produkt-/bokföringskontrakt. |
| Dealer till avatarpaket/workerURL | Återanvänd exakt profil/video/hash/offset och bank-/profilrevision, studio-speech-panel.tsx:95 och dealer-speech-runtime.mjs:95. Fritt avatarpaket eller rå workerURL saknar likvärdigt kontrakt; använd validerad profilreferens. |
| Djuplänk dealer/bord | Befintlig roomPlayPath i presentation-room.mjs:7 och serverval i game-entry-selector.mjs:76. Behåll autentiserad rum/paket/spel/dealer-validering; länken skriver ingen konfiguration. |

Återanvänd scoped draft/review/publicering med revisionskontroll i
apps/studio/lib/partner-branding-api.mjs:259 och atomisk rum/paket-writer i
presentation-room-api.mjs:306. Gemensam mall får inte ersätta roomOverrides.
J08 behöver explicit fält→validator→writer→fryst configVersion→spelkonsument;
nya språk/limit/timer/logofält och ekonomisk återföring blir inte automatiskt
accepterade bara för att de finns bland Kevins kandidater.

**Gemensamma gränser och kvarvarande beslut:**

- Mains auth bestämmer actor, operatör och tillåtet rum. Kommandot bär roomId,
  commandId, configVersion samt relevant fönster-/turidentitet. Detaljer för
  expectedVersion och state-/tick-transaktioner måste avtalas med båda ägarna.
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

Kevin behöver rätta underlagets beskrivningar av retry/audit, limitlåset och
patchidentitet samt komplettera fönster-/kommando-/tickmatrisen enligt avstämningen ovan.
K01 är klar som inventering. O01 blir VERIFIED först när båda ägare har stämt av kontrakten och
nödvändiga beteendeprov finns. Media är fortsatt kandidater, inte importgodkända.

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
