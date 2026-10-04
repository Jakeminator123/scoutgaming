# Aktuell handoff — Croupier

Uppdaterad 4 oktober 2026. Detta är den enda löpande John-handofffilen.
Uppdatera de fem befintliga filerna i docs; skapa inga nya arbetsrapporter.

## Beställd slutföring och avgränsat prisundantag — 4 oktober

Jakob har uttryckligen beställt AI/tal/GPU-aktivering, produktionsimport och
omkoppling, följd av faktisk avveckling med QA kvar. Egna lokala taskbrancher
och worktrees är tillåtna för detta arbete; originalcheckouten stannar på
main och endast merge-agenten integrerar/pushar via ordinarie helper.
Startpunkten är återläst GitHub-main
`95c2f046594292c9c4a27ba5c810a8715b06ba8d`; appkoden är oförändrad mot
godkänd installerad QA `e461ef073b63b2d1c937454bbfa31289774fcb8f`.

Exakta Cartesia-/counting-priser är backlog enligt det nya beslutet.
Avgränsade funktionstester får därför genomföras med explicit dokumenterad
okänd monetär kostnad och mätt usage, inom ursprungliga numeriska budget-
och dispatchreservationer. Undantaget är inget nollpris, ingen verifierad
faktura och ingen generell produktionskostnadsapproval. Journaler, redan
förbrukade reservationer, ägarskap, idempotens, lease/cancel/terminal och
skydd mot dubbeljobb består; okända belopp återbetalas inte. Tidigare krav
nedan att först lösa Cartesia/counting-tariff gäller inte detta avgränsade
funktionstest. Verklig workerdränering och källa/runtime/playback-bevis krävs
fortfarande före produktionsomkoppling och borttagning.

Arbetsområden: ai-gpu, prod-data, studio-ux, clean-bo, clean-storage och
verify, med gemensam absolut agent-talk-tavla och konkreta filöverlämningar.
Produktionsskrivningar samordnas i ett gemensamt skrivfönster. Checklistan
bockas endast av med aktuella verifierade resultat; full migration återstår.

Studio-/Git-rättningen är nu lokalt integrerad i main som `438a824b`, från
workercommit `c40503af`; ingen ny driftsversion är publicerad ännu. Resetens
spelentré använder konfigurerad game-origin och `/player-login`, partner-
öppning följer gemensamma adresspolicyn. Hookens riktiga commit-index bevaras
för egen inspektion, medan Git-fixturer och checkbarn får isolerad Git-miljö.
Det förhindrar att en temporär testrepo ändrar gemensamma worktree-inställningar.
`core.bare=false` och `core.hooksPath=.githooks` är återställda och återlästa.
Färskt separat Nextbygge med fyra workers, typkontroll och obligatorisk
fullhook: 1 254 PASS, 5 SKIP, 0 FAIL. Tidigare misslyckade QA-/hookkvitton
bevaras. AI:s första paket är lokalt integrerat som `9ea65dba`, från
`123d3f1f`; exakt samma Git-träd återanvänder dess fullhook med 1 264 PASS,
5 SKIP och 0 FAIL. Paketet innehåller avgränsad ursprunglig budget/journal,
providergränser och rättad disk-/Neon close/cancel-race. Ingen aktivering
eller produktionsimport har ännu körts. Följdfixen är lokalt integrerad som
`1af6d491`, från `7cf88ba6`, med identiskt Git-träd och fullhook 1 268 PASS,
5 SKIP, 0 FAIL. Fullfilspolicyns reservation når Web även under streaming
enbart för den verifierade bounded-QA-transporten med Neon-journal. Fyra
privata SDK-källfiler sparas checksumförseglade före budgetaktivering och
återställs före Web-start efter containerbyte; Dockerbygget förbereder endast
de två nödvändiga privata katalogerna med UID 1000 och mode 700.
Städarnas P8-borttagningar hålls separata till dess
ersättningen är verifierad aktiv. Slutacceptans kräver faktisk provider-,
spel- och produktionsdrift.

## P6: parallellt QA-pass och avgränsade kostnadsgap — 4 oktober

Fryst källversion är `e461ef073b63b2d1c937454bbfa31289774fcb8f` på main.
Aktuell GitHub-återläsning: Actions-run `37155095975`, samtliga tre jobb
completed/success och båda ordinarie Vercel-statusar success. GitGuardian-
suite är queued utan run; den separat fullständigt paginerade incidentlistan
för workspace `795524`/source `30689542` visar fem IGNORED och noll öppna.
Fil/rad i API är fortsatt partial för två historiska ID:n; ingen incident ändrades.

Tre befintliga isolerade QA-tjänster är installerade på exakt e461ef07;
QA-alias är bundna och faktiskt återlästa 4 oktober 00:15:56 svensk tid.
Render `dep-db0nq30u01pc73b6ep40` är LIVE med health 200, frontend
`dpl_2tY7tigYk7ZDXoQGzfGC3ekvSnws` och Studio
`dpl_CMoZh3VwNx8FVc17gF8iWjnbEN5K` är READY. Alla tio före/eftergrupper
PASS: samma env/disk, konton/saldon, hela QA-volymen, råmedia och journaler.
SDK 7.12.1 är faktiskt laddat och dess 2 962 filer bevarade; 17 privata
flyktiga källfiler är återlagda, fyra kontexter och nio publika spelmoduler
matchar faktisk Linux/Git-källa. `/api/auth/session` visar sharedCredentials.
Privat kvitto: `native-p6-qa-release-e461ef07/ready.json`. Ingen QA-env,
beständig plan/SDK, SQL, provider eller produktionsaktivering ändrades.

QA-installation, riktad shared-credential-acceptans och AI/GPU-förberedelse
delades mellan tre parallella agenter. Privat käll-overlay för exakt e461ef07
omfattar 202 filer; 193 fokuserade offlineguards PASS, noll skip. Detta är
förberedelse, inte installerad full AI/GPU-acceptans. SDK:s gamla cb9b6b53-
plan är prepare-only med null budget/providerContext; den blir aldrig en
full-run-admission genom att återanvända dess manifest.

Riktad live authacceptans på denna SHA: 80/80 kontroller PASS över 68 riktiga
HTTPS-anrop. Admin fick spel, `/studio`, native `/studio/administration`
utan iframe och sessions-/konto-/overview-API på båda QA-origins. Spelare
nekades native login/session/admin och gamla BO/Lab-cookies rensades.
Native spelarpasswordbyte återkallade gammalt lösenord och cookie före OK;
samma spelar-ID/saldo/transaktioner/historik/presentation bestod. Render skrev
verklig cancellation-probe-epoch 1/reason inactive. Reader/staff förblev
game-only efter verklig engångsreset utan mejl; adminreset återkallade gamla
spel- och båda Studio-sessioner. Tre egna användare/fyra spelare städades;
27 återläsningsgrupper PASS, noll egna rader kvar och övriga konton/saldo/
historik/signer oförändrade. 14 riktade auth-/password-/authorityprov PASS.
Privata HTTP- och städkvitton finns i
`p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/`.
Verkligt pågående providerjobb är inte provat; väntan på pending cancellation
är fortfarande isolerat testbevis. Inga mejl/provider-/produktionsanrop gjordes.

Verkliga loginformulär i isolerad Chrome på samma QA: 18 UI-kontroller,
två städ-/paritetskontroller och två laddade källmoduler PASS (22/22).
Admin nådde Studio/native Konton med spelcookien; faktisk utloggning och
spelarnekande verifierades. Egna fixtures är borttagna och användarens
Chrome-profil/flikar bevarade. Provets första råkälljämförelse missade den
avsiktliga tvåstegsbyggomskrivningen; originalkvittot är bevarat och separat
återattest verifierar fångade bytes mot exakt e461-bygge utan ny loginrunda.
Privat `p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`.

Samordnande agenten verifierade Astrid/Vera/Amira/Mei var för sig i faktisk
QA-rehearsal på e461: rätt greeting/matching clip och Play twice låst under
sekvensen, återaktiverat efteråt, utan synligt fel. Kvittot
`p6-browser-evidence-e461ef07/receipt.json` har inget explicit ended-tal,
nytt mediehashbevis eller mänsklig läppsynkapproval. Detta bevisar befintliga
klipps tvåspelskontroll; nytt AI→tal→GPU-paket och dess acceptans återstår.

Färsk läsning på denna QA verifierar originalets två journalposter:
10 USD totaltak, 5,251152 USD förbrukad/kvarhållen reservation och
4,748848 USD oreserverat; ett SDK-anrop är förbrukat och nio återstår.
Ingen återbetalning görs och äldre GPU-reservation är inte dränerad.
Aktuell scoped QA har noll aktiva leases/osäkra anrop/request-/kostnadsrader,
men saknar installerad GPU-/fullfilspolicy och operatörskampanj. Router/authority
är inaktiv; full-run-admission och immutable basimage är inte verifierade.
Privat beredskapskvitto `p6-ai-readiness-e461ef07/readiness.json` har exakta
käll-, SDK-, budgetkvitton och avgränsade fortsättningskommandon.

Den riktade offentliga prisåterläsningen ligger privat i
`lab/data/platform-private/p6-cost-evidence-20261004.json`. Tre kontounderlag
saknas fortfarande: Cartesia-nyckelägarens credit-/overagepris, uttryckligt
counting-pris/gratisbevis samt Runpods totala workerstart/körning/idle/stopp
och lagringstak. Se P6 i masterplanen för officiella källor. Utan nytt
underlag behöver nästa agent inte upprepa samma dokumentationssökning.
Ingen ny budget/journal, providerdispatch eller produktionsaktivering görs.
Färska full-run worker/router/entry/authority-manifest och faktisk
speluppspelning krävs fortsatt efter giltig admission.

## Gemensamma credentials och två behörigheter — 3 oktober

På Jakobs uppdrag används ett gemensamt användarnamn/e-post och lösenord,
utan kontotypsval. **Admin** kommer in i spel, Studio och hela Backoffice;
**spelare** kommer bara in i spelet. Befintlig `superadmin` är adminalias,
medan äldre CRAIG `reader`/`staff` är game-only. Råroller, konton, kopplade
player-ID:n, saldo och historik bevaras; inga livekonton eller DB-scheman
ändrades av denna källleverans. En admin som spelar har samma lösenord.

`web/account-credentials.mjs` läser båda befintliga credentialregistren före
lösenordsprov. Exakt en kandidat krävs; kollision, pending invitation och
fel lösenord ger generiskt avslag utan fallback eller klientvald roll.
BO-cookies använder egen audience och live roll/fingerprint/auth_epoch.
Spelarlogin rensar gamla BO/Lab-cookies. `/api/auth/session` annonserar
`sharedCredentials:true` först från en backend med den nya resolvern.
Frontend läser kapabiliteten före login och bevarar äldre entry-/modalroutes
tills Render är uppgraderad. Ingen lösenords-/namespacefallback sker efter
nekad POST. Misslyckad kapabilitetsläsning blockerar dispatch.
Guestpolicyn för lokal utveckling
är oförändrad.

Native Backoffice → Konton kan skapa spelare och byta deras lösenord genom
signerad Render-authority: `POST /studio/api/admin/players/password`.
Formen kräver två lika lösenord och anledning, tömmer lösenordsfälten direkt
och väntar på serverkvittot. Endast aktiva/blockerade konton med faktisk
`player_accounts`-credential får formen (`passwordChangeAllowed`).
CRAIG-kopplade spelare använder kontots befintliga invitation/resetväg;
reader/staff återfår aldrig Studioåtkomst av en lösenordsåterställning.
Bytet låser konto/spelare, ersätter salt/hash och återkallar gamla sessioner.
Render väntar på runtimecancel före OK; lösenord lämnar inget svar/auditvärde.
Saldo, transaktioner, rundor och kostnadsjournaler berörs inte.
Adminborttagning skyddas mot att två samtidiga åtgärder tar bort sista admin.

Källcommit `220d5dfa60e52e4426f572bc733d10a23b7d25ce` är verifierad:
obligatorisk full commit-hook 1 251 PASS, 5 SKIP, 0 FAIL, inklusive fristående
HTTP-fixtures och pipelineaudits. Lab 785 PASS/1 SKIP, frontend 40/40 PASS;
båda explicita TypeScript-kontrollerna och produktionsbyggena PASS. Dealer-
audit med `--probe` PASS. Skip täcker tre live PostgreSQL/Neon-fixtures,
browser cold-submit och Linux-processfallet; dessa är inte livebevis. Ingen
ny fyrdealer-/mänsklig läppsynkacceptans eller ny QA-installation hävdas.
Den obligatoriska hooken/CI tar nu även nya resolver-, password- och native-
credentialtester. Windows lokala test-/Next-workers begränsas till fyra;
CI/publicering behåller sina tidigare workerinställningar.

**Nästa driftprov:** installera samma nya källversion i alla tre QA-tjänster.
Prova admin från spel till Studio, spelarnekande, gamla cookie-/lösenords-
återkallelser, legacy game-only reset och saldo/historik före/efter. Använd
syntetiska QA-konton. Detta är en del av P6:s återstående authacceptans,
inte bevis på installerad QA eller färdigt produktionsbyte.

## Nästa agent: slutför P6:s AI/GPU-acceptans — 3 oktober

Städleveransen på main är `63d0e917c9828be82e25b0f039c4ef9a1c8f92f4`.
Dess tre GitHub-CI-jobb och båda Vercel-publiceringar är verifierade success.
Senaste dokumenterade installerade native-QA och fyrdealerprov gäller däremot
`966991ef`; native90-kvittot gäller `190399`. Frys aktuell main och återläs de
faktiska tre QA-publiceringarna före nästa prov. En senare källcommit gör inte
äldre runtime-/browserkvitton aktuella.

**Förväntat resultat:** ett verifierat verkligt AI/GPU-varv i isolerad QA,
med giltig kostnadsadmission, rätt autentiserad spelägare och två avslutade
uppspelningar genom samma produktspelare. Det visar att Director kan välja
ett svar, SDK/modellen generera det, talmotorn skapa ljudet, GPU:n skapa den
synkade videon och spelaren faktiskt visa och spela resultatet. SDK-import,
inspelade greetings och enbart WebSocket-bytes täcker inte detta resultat.

1. Läs `AGENTS.md`, `agent-talk/README.md`, denna handoff,
   `ENVIRONMENT-RESTORATION.md` och P6-checklistan i `CLOUD-MIGRATION.md`.
   Arbeta i befintliga `C:\Users\jakem\Projects\croupier` på main. Kontrollera
   Node/engines och projektpins; Volta-resolverad Node är nu v22.22.2 och Lab
   kräver >=22.16.0. Kör status/security och registrera faktiska ändringspaths.
2. Återläs befintlig kampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`, budget,
   reservationer, sourcepins och stageadmission. Senaste dokumenterade totaltak
   är 10 USD, kvarhållen reservation 5,251152 USD och oreserverat 4,748848 USD;
   ett av tio SDK-dispatches är förbrukat. Dessa siffror måste återläsas före
   användning. Behåll originaljournalen och dess numeriska budgetankare.
   Lös Cartesia USD/credit, counting-tariff eller uttryckligt gratisbevis och
   RunPods hela startup/execution/idle-gräns. Cartesia-nyckeln är extern och
   Jakob saknar kontoinloggning; begär inte en ny sådan. Mät usage separat från
   dollarpris. Ingen påhittad nolltariff, ny journal eller återställd budget.
3. Bygg färska full-run-manifest för exakt vald källa och immutable basimage,
   inklusive entry-contexts `routerManifestSha256`. Återläs SDK, privata
   contexts, faktisk child-env, authority/router och installerade spelmoduler.
   Prepare-only/router-off ger avsiktligt 404 på playback-context och räknas
   inte som acceptans. Normal QA-login finns redan; använd befintlig syntetisk
   operatör. Befintlig operatör återskapas inte. Separata auth-/resetprov använder
   bara ägda syntetiska QA-konton; inga produktionskonton eller mejlprov.
4. Kör den verkliga ägda QA-kedjan: cookieautentiserad idle-advice/Director i
   shadow, faktiskt SDK-svar, tal via avsedd Cartesia-konfiguration och GPU via
   avsedd RunPod-endpoint. Bind sparad Neon-policy, serverägd session/runda,
   request/job-ID, source/env/manifest och mediahashar till samma körning.
   Använd redan utfärdad descriptor genom spelets faktiska posegrind/talkö och
   `playGeneratedSpeech`; kvittot ska visa `decoded-product-game-queue`, faktisk
   integration och laddad källa. Tre färska cookieägarkontroller, presenterade
   avkodade bildrutor, hörbart ljud och två verkliga ended/playback-ACK krävs.
5. Verifiera kostnadsjournal före/efter, cancel/terminal/drain, retry och restart
   utan extra providerdispatch eller dubbeldebitering. Återanvänd samma ägda
   spelare/WS/video. Full P6 omfattar även text/bild/STT, fullfil och stream,
   SQL/HTTPS/restart samt auth/revoke och invitation/reset där de återstår.
   Alla fyra dealers provas två gånger enligt checklistan. Fysisk kamera,
   mikrofon, mobil/Safari och mänsklig läppsynk redovisas separat; ändra ingen
   assetbaseline utifrån enbart hashar, automatiska tester eller stillbilder.
6. Bevara privata receipts och FAIL-historik. Bocka bara av verifierade delmål
   och sätt `fullP6Passed` först när hela kontraktet är uppfyllt. Leverera
   taskägda ändringar och faktisk drift-SHA via ordinarie main-helper, med
   uppdaterad handoff och säkerhetsstatus. Koordinera .git med andra agenter.

AI/GPU är nästa stora acceptanspass. Produktionsbyte **P7** kräver därefter
verifierad P2–P6 och ett uttryckligt genomförandeuppdrag; **P8** avvecklar sedan
ersatta gamla UI/API-/disk-/envgrenar med referens-, paritets- och restartbevis.
Det är därför inte färdig migration efter en lyckad GPU-render ensam.

### GitGuardian efter den beställda triagen

API/MCP fungerar med befintlig läsnyckel. Workspace `795524`, source `30689542`
och repo `Jakeminator123/github-work` har verifierats både via API och webbfilter.
På Jakobs uttryckliga uppdrag granskades fem öppna incidenter mot testkod och
stängdes i webbgränssnittet med **These are test credentials**. API-återläsning
bekräftar **IGNORED** för samtliga fem; ingen incident markerades som en verklig
återkallad produktionsnyckel. Inga scopes, nycklar eller generella scanregler ändrades.

| Incident | Verifierad fixtureplats | Status efter triage |
| --- | --- | --- |
| 37827237 | `lab/test/studio-native-runtime.test.mjs`, `lab/test/studio-native-request.test.mjs` | IGNORED |
| 37828386 | `ops/cloud/test/container-entry.test.mjs:30` | IGNORED |
| 37828691 | `ops/cloud/test/storage-export.test.mjs` (webbplatslista; API saknar location) | IGNORED |
| 37830671 | `test/studio-cutover-integration.mjs` (två webbplatser; API saknar location) | IGNORED |
| 37840514 | `ops/cloud/test/native-p6-router-hook.test.mjs` | IGNORED |

Testvärdena är lokalt deklarerade fixtures. Exportprovet använder temporär
SQLite/lokal server och städar efter sig; cutover-provet kontrollerar en ny
ägd localhost-pool innan seedning, och URL-fixturen ansluter inte till Neon.
Cutover-fixturens tidigare kodrättning i `bba3cc28` består. Rå scannerutdrag och
credentialvärden är inte återgivna. Direkt efter triagen gav API:t temporärt
`gg_read_incident_count_mismatch`. Ny full paginerad återläsning efter att
källräknarna uppdaterats bekräftar hela källans fem IGNORED-ID:n och noll öppna.
Incidenttäckning är `complete-for-source`; fil/rad-täckning är fortsatt partial
för två i API:t, kompletterad med webbplatslistorna ovan. Detta är ingen grön
GitGuardian-check på main. Läsnyckeln har fortsatt bara `incidents:read,sources:read`.

## Städning och aktuell systemkarta — 3 oktober

Städningen utgår från ren GitHub-main `b7940dd82078794d38ff9e2466e5aea615aae877`.
Den tar bort 62 frontendfiler: oanvänd klientblackjack, UI-/tema-/hookscaffold
och dubbla stylesheet, samt 41 exklusiva direktberoenden. Låsfilen regenererades
offline utan nya versionsbindningar; fryst installation tog bort 134 lokala paket. Aktiv Button, landningssida,
kortsymboler, serverägda spelrutter och fyrdealerspelaren behålls. Sista
referensgranskningen tog även bort 13 oanvända klientspellogikexports från
`lib/blackjack.ts`; bara oförändrade `Suit` och `SUIT_SYMBOL` har aktiva importörer.
Pensionerad GitLab-GPU-CI och den gamla dubbla miljökartan tas bort;
dokumentlänkar går till de befintliga fem docs och aktuell OpenClaw-guide.
Duplicerade agentprompter i masterplanen ersätts av dess aktuella acceptanschecklista.

Lokal Next-/TypeScript-cache rensas på exakta paths efter read-only kontroll:
sessionsvakten har ingen sessionspost, inga lokala produkt-/labbportar lyssnar
och de main-bundna Node-processerna är GitGuardian-MCP. Inga privata QA-bevis,
SDK, sourcepins, kostnadsjournaler, konton, råmedia eller kalibreringar raderas.
Labbets gamla hela `.next` rensades först. Full regression visade då ett enda
fel: anslutningstestet kräver en verifierad Next-runtime. Den är återbyggd;
första städleveransen behöll 8 211 983 byte Lab-runtime och frigjorde netto
1 032 360 345 byte bygglagring (cirka 1,03 GB). Credentials-passens verifierade
byggen återskapade cache; efter full hook rensades 292 363 385 byte på de två
exakta `.next/cache`-paths och båda TypeScript-cachefilerna. Nu behålls färska
runtimes: Lab 8 306 510 byte, frontend 3 503 289 byte. Den återskapade cachen
räknas inte som ytterligare nettofrigjord lagring. Beständig data är bevarad.

Den uppdaterade [systemkartan](CLOUD-MIGRATION.md#ytor-och-datalagring--produktion-och-nya-qa)
skiljer produktion, nya QA och mål efter P7. Senaste QA-installation/fyrdealerprov
gäller `966991ef`; native90 gäller äldre `190399`. Full AI/GPU,
loader/cookie-bevis, produktionsimport, P7 och den större P8-avvecklingen återstår.

GitHub-startstatus på `b7940dd8`: 3/3 CI success, båda Vercel-statusar success,
GitGuardian-suite queued och ingen GG-run. Intended workspace/source är återläst
med read-only MCP: fem TRIGGERED-ID:n `37827237`, `37828386`, `37828691`,
`37830671`, `37840514`; en incidentsida/fem locationsidor, full incidenttäckning
men partial fil/rad för två. Inga incidentstatusar ändras av städningen.
Verifierat: frontend 32/32, explicit TypeScript och produktionsbygge PASS;
Lab-produktionsbygge inklusive typkontroll och 50 sanerade buildtraces PASS;
det isolerade native/Next-startprovet PASS efter återbygget. Labbets tsconfig
utesluter nu privata `data/` ur app-typkontrollen, så SDK-källpaket inte kräver
leverantörernas utvecklingsberoenden. 123 lokala dokumentlänkar och diffkontroll
PASS. Den första fulla regressionen gav 1 216 PASS, fem skip och endast felet
om saknad runtime ovan. Efter rättelsen är full obligatorisk commit-hook PASS:
1 217 tester PASS, fem skip, noll fail. Kod- och dokumentstädningen är committad
på `be204ed8719dcc9577f3118c7145caec12bfe1d7`, kompletterad med
`d6e39a01427e7708999202580513d2e069122f26` för sista klientregelstädningen. Även den senare committens fulla
hook gav 1 217 PASS/fem skip/noll fail, efter ny frontend 32/32, typkontroll
och produktionsbygge PASS. Denna slutnotis ändrar bara docs.
Kontrolloggar ligger privat i Windows temp som `croupier-housekeeping-*.log`.
Push sker via ordinarie main-helper; slutlig SHA/checkstatus läses från GitHub,
och detta arbete bockar inte av P6/P7/P8.

## Börja här vid övertagande

Arbeta i `C:\Users\jakem\Projects\croupier`, på `main` i
`Jakeminator123/github-work`. Följ `agent-talk/README.md`, claim före ändring,
och leverera med `node tools/push-github-work.mjs`. Ingen annan branch/worktree,
Jira eller GitLab. Läs även `ENVIRONMENT-RESTORATION.md` före spel-/medieändring.
Senaste fullständiga 90-checkars QA-acceptans är exakt `190399386d93a02882d9b18a5ce5af53bb91fe23`;
de tre deployment-ID:na och 90-kvittot står nedan. Läs `git log -1` och GitHub
main för slutlig källleverans: senare dokument-/testfixar gör inte automatiskt
den frysta QA-koden nyare. **80 % är en grov arbetsbedömning, inte acceptans.**

Övertagandet 3 oktober fortsätter från ren GitHub-main
`bba3cc281a31bffb27c1df8199f0e669a0103159`. Director använder nu faktisk
`askDirector`, oförändrad rollprompt och SDK-översättning; Web binder anropet
till verklig session, aktuell spelstatus och återläst sparad policy. Director
och texttal delar samma beständiga text-slot. Idle-cache binds till ägare och
policy. Starten binder råa router-/worker-manifest och verklig Web-child-env;
full Render-env och SDK-child-env hålls separata. Detta är testad kod,
inte installerad QA-runtime eller ny liveacceptans. Nya sourcepins/manifest
måste byggas efter slutlig kod; gamla `minimum-proposal.json` är historisk
utgångspunkt och dess gamla worker-/routerhashar får inte återanvändas.
186 riktade worker/brygga/entry/router/runner/hook/idle/API-prov PASS i den
sammanhållna återkörningen. Obligatorisk full hook och fyra-dealer-audit
`--probe` PASS; befintliga saknade takes och mänsklig synkacceptans består.
Loggar finns privat i `migration-root-{directed,full}-check.log` och
`migration-root-dealer-probe.log`. Inget nytt SQL-/HTTPS-/restart-livekvitto
eller fyra-dealer-native90-kvitto hävdas för denna senare källkod.
Nästa obetalda kodpaket binder en opt-in GET
`/api/presentation/native-p6-playback-context` till den verkliga auth-cookien,
exakt egen länkad QA-spelare, serverägd session/runda och återläst sparat projekt.
Den är avstängd som standard, skapar ingen gäst och tar inga klientrevisioner.
Den privata `native-p6-product-playback.mjs` kör nu själva hashbundna
`playGeneratedSpeech`-wrappern och dess tre produktberoenden: en video/WS,
samma mottagna bytes, presenterad rVFC-bildruta och video-ended. Tre färska
cookieägda GET-kontroller krävs före connect, före play och efter slut.
25 collector-, 21 runner- och 32 produktströmprov PASS. Importen gör inga
liveanrop; fixturprov bevisar inte faktisk cookie-/browser-/CSP-acceptans.
Kvittot anger `decoded-product-wrapper-qa-mount`, `productWrapperExecuted:true`,
`gameWrapperIntegrated:false`; verklig spelkö, wire-/descriptor-/GPU-korrelation
och liveacceptans återstår. `fullP6Passed` är fortsatt false.
Spelkopplingen har därefter implementerats i själva `app.mjs`: exakt egen
QA-origin, Astrid/local, explicit `nativeP6GamePlayback=1` och lyckat cookieägt
GET krävs innan `window.croupierNativeP6GamePlayback.run(...)` exponeras.
Den tar redan utfärdad descriptor genom befintlig posegrind/talkö och ordinarie
`playChatDecision`/`playGeneratedSpeech`; inget nytt `/chat`, provideranrop,
extra WS/video eller Blob-importerad ersättningswrapper. Per-play-observation
får en kopia av accepterade decoderbytes och verklig frame-/ended-lifecycle.
Renderer-sessionens klient-UUID hålls separat från serverns cookieägarhash,
men båda binds till samma aktuella runda. De tre ägarkontrollerna och verkligt
köslut/idle-stages krävs. 85 riktade offlineprov och fyra-dealer-audit PASS;
mänsklig synkacceptans återstår. Senare inspelade live-rehearsals redovisas
nedan; ingen ny AI/GPU-körning eller full P6-acceptans hävdas.
Nytt kvittoscope är `decoded-product-game-queue`, `gameQueueExecuted:true`;
`gameWrapperIntegrated:false`, `liveIntegrationVerified:false` och
`sourceVerification: same-origin-source-readback-loaded-module-unverified`
redovisar kvarvarande installation/browserbevis. Runner får inte förväxla
detta kod-/fixturbevis med full liveacceptans eller godkänna ett äldre mountkvitto
som verklig spelkö. De nya funktionstesterna ingår nu i obligatorisk hook.
`migration-root-source-readiness-20261003.json` är historisk privat metadata
för den tidigare källversionen; dess gamla privata hashvärden får inte återbrukas.
Full obligatorisk hook och fyra-dealer-audit `--probe` PASS för endpointpaketet;
loggar är `migration-root-resume-{full-check,dealer-probe}.log`.

Senaste spelkopplingen är levererad som
`5b51af0ecf850a329f46ac4da00cec02340100ca`; full obligatorisk commit-hook PASS.
Den privata source-overlayn `native-p6-runtime-artifacts/source-5b51af0e/`
omfattar 200 filer/401 importrelationer, descriptor-råhash
`11abe4e774b1326d85149563bc45cfafbd646410ef1dcfd0d415a0fa961ca312`.
9/9 stagingprov PASS. Egen Render-QA-deploy `dep-db0k7j7avr4c7383kheg` är
live på samma SHA, med oförändrad env och utan cachetömning. SDK 7.12.1 är
nu faktiskt installerat som UID/GID 1000 på QA:s beständiga disk: 2 962 filer,
worker-trädfingerprint `ebbb70cbf3b784adcee13323880215dc360ac0e1c5d78891f9813368e6c3da0a`.
Separat SSH-återläsning verifierar SDK, fyra privata source-contexts och nio
spelkällor; de nio matchar exakt denna commits Linux/Git-bytes. Inga provider-
anrop eller journalhändelser. Prepare-only run `cb9b6b53-e7b0-4fa9-bc53-c5152ddbb1f2`
hör till befintlig kampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`; budgeten
är oförändrad. Detta är paket-/källinstallation, inte körande workeracceptans.
Privata kvitton: `native-p6-qa-release-5b51af0e/{actual-install-receipt,actual-linux-readback}.json`.
Frontendens exakta allowlist saknade också playback-context-GET. Den routen
är levererad i `966991ef4e4ad4a4ca9f446216c71d14a5d92841`; nio routing/
middleware/entry-prov, full obligatorisk hook och 3/3 GitHub-CI PASS.
Render-QA är live på denna SHA som `dep-db0kostg1s2s73eh0uk0`. Alla 17 privata
källfiler är återlagda efter containerbytet, med oförändrad beständig plan
och SDK-trädhash. Oberoende SSH-återläsning som UID 1000 verifierar åter nio
spelblobs mot Git och laddar faktiskt SDK-modulen/constructor utan klient,
provideranrop, tjänstestart eller journaländring. Kvitton finns privat i
`native-p6-qa-release-5b51af0e/{rehydrate-966991ef-receipt,actual-linux-readback-966991ef}.json`.
Vercel-QA:s första 5b51-publicering tappade tidigare per-deployment env/build
overrides: READY bevisade inte fungerande UI. Korrigerade byggen på 966991ef
använder exakt tidigare accepterade QA-overrides; ingen ny tariff,
produktionsenv eller nyckel. Båda korrigerade Vercel-byggen är READY och
QA-alias är faktiskt bundna/återlästa på samma SHA: frontend
`dpl_8Bsu9hFD7U7c7wqDTbBcXBC77aZB`, Studio `dpl_PLfAczMttfMAUx3HcwgiPN6bDj8w`.
Frontendens nio spelmoduler ger HTTP200 och exakt samma SHA256 som Git;
kvitto `vercel-source-hash-proof-966991ef.json` i samma privata releasekatalog.
Unauth BO/API returnerar 401/403 och router-off-context404 enligt gränserna.
Den befintliga syntetiska QA-operatören är live-verifierad med read-only SQL
och normal Studio-login/BO→spel-handoff genomfördes därefter i IAB. Ingen ny
användare, inbjudan eller mejlleverans. Astrid greeting i delad Studio-spelare
visar faktiskt `2/2 completed`; bild `qa-astrid-local-966991ef.jpg`. Detta är
inspelad uppspelning med giltig QA-cookie, inte betald AI/GPU-acceptans.
Browsern kan nu öppna spelet; tidigare browser-blockering är inte aktuell på
den korrigerade publiceringen. En separat CDP-källkontroll fastnade länge och
gav ingen full huvudram/context-bindning; loaded-module-bevis hävdas inte.
Alla fyra greeting-rehearsals är därefter faktiskt begärda med Play twice
på korrekt dealer-URL i samma QA-spelflik. Vera, Amira och Mei återgår med
aktiva kontroller, matching clip och utan Playback failed; deras gamla UI
har ingen explicit sluträknare. Astrid/local visar explicit 2/2. Detta är
funktionell observation, inte nytt läppsynkgodkännande eller assetbaseline.
Den separata QA-labbdomänens normala login är också faktiskt genomförd:
AstridStudio visas och Spara är disabled; inga projektinställningar ändrades.
Sammanhållet privat UI-kvitto: `live-qa-ui-966991ef.json` i releasekatalogen.
Browsertransporten stängdes efter kontrollerna; slutstädning av agentens två
QA-flikar kan därför inte bekräftas. RunPod-fliken och andra användarflikar
är inte stängda av agenten.
QA-bilder finns i samma privata releasekatalog som
`qa-{vera,amira,mei}-default-966991ef.jpg` och Astrid/local-bilden ovan.

Nästa obetalda gräns är faktiskt kontrollerad: SDK-importen ovan fungerar, men
cookie-endpointen registreras först efter initierad P6-router/authority-brygga.
Prepare-only plan och avstängda router/providerflaggor ger därför avsiktligt
404, inte ett godkänt spelkvitto. För start krävs fulla färska manifest,
ursprunglig giltig initialAdmission och befintlig numerisk budgetjournal;
entry kräver också tariff/counting-underlag. Skapa inte påhittad admission,
ny budget eller ersättningsjournal för att kringgå denna gräns.

GitGuardian: remote `966991ef4e4ad4a4ca9f446216c71d14a5d92841` är återläst med
alla check-runs/check-suites/status: 3/3 CI och båda Vercel-statusar success;
ingen GG-run, GG-suite queued. Detta visar inte en tom incidentlista.
Jakob godkände separat två lässcope och därefter ett års giltighet. Årsnyckeln
för workspace `795524` är Active, endast `incidents:read,sources:read`, och
lagras Windows-DPAPI CurrentUser-krypterad utanför Git i
`~/.codex/private-connections/gitguardian-795524.dpapi`. Den egna oanvända
sjudagarsnyckeln är återkallad. Inga incidenter eller övriga rättigheter ändrades.
Den lokala Codex-MCP:n `gitguardian` använder `tools/gitguardian-mcp.mjs` med
bara `read_source_binding` och `read_repo_incidents`. Bryggan är låst till
`Jakeminator123/github-work`/source `30689542`, GET och metadata; ingen scan,
scannertext, secret reveal eller write. Inga nyckelvärden finns i konfigurationen.
Hosted OAuth stoppades av Cloudflare; den lokala stdio-anslutningen är faktiskt
verifierad genom initialize, tools/list och båda autentiserade läsverktygen.
Verktygen har också laddats i Codex och `read_source_binding` är återläst där.
Manuell läsning:
`node tools/gitguardian-read.mjs --source` eller `--incidents`.
API-incidentlistan är nu fullständigt läst för denna källa: en incidentsida och
fem locationsidor, fem TRIGGERED-ID:n `37827237`, `37828386`, `37828691`,
`37830671`, `37840514`. Filpositioner finns för tre: `lab/test/studio-native-`
`{runtime,request}.test.mjs`, `ops/cloud/test/container-entry.test.mjs` och
`ops/cloud/test/native-p6-router-hook.test.mjs`. ID `37828691` och `37830671`
saknar locations i API:t; fil/rad-täckningen är därför partial. Läsning av de
tre lokaliserade incidenternas aktuella källrader visar isolerade testfixtures
med uttryckliga fixturelösenord eller syntetiska testvärden. Det bevisar inte
historiska incidentsnippets eller rensade incidenter; de två övriga är okända.
Rå incidenttext eller sekretessvärden är inte lästa. Alla fem är fortsatt TRIGGERED.
Privat metadata och stdio-kvitto: `migration-root-gitguardian-mcp-verified-20261003.json`;
15 riktade redaktions-/paginering-/behörighetsprov PASS.

Fortsätt i denna ordning:

1. **P6: installera och återläs den verkliga egna QA-kedjan.** Core-hookar är
   fortsatt opt-in och avstängda. Kodkopplingen ovan använder signerad
   stage-ticket samt färsk PID/source/nonce/env. Bygg samstämmiga nya privata
   manifest, inklusive entry-contexts obligatoriska `routerManifestSha256`,
   och verifiera faktisk installation/readback. Använd inte shared OpenClaw
   som QA-runtime eller deterministisk baseline som providerbevis.
   `native-p6-runtime-stage.mjs --stage <full-HEAD> source-<kort-SHA>` bygger
   endast en privat käll-overlay och en derivative Docker-recipe. Offentliga
   filer måste matcha HEAD:s Git-blobs; privata filer och image-bytes hashbinds.
   `QA_BASE_IMAGE` måste vara en immutable digest för samma källa. Inga manifest,
   secrets, journaler, SDK-downloads eller aktiverande env skickas med. SDK
   `openai@7.12.1` är nu faktiskt installerat och återläst enligt ovan; aktiverad
   worker, färska full-run-manifest och betald admission återstår. En source-
   artifact ensam är inte bevis för något av detta.
   Staging omfattar nu även transitiva literal-relative imports och de nio
   faktiska spelkällorna (200 filer/401 relationer vid kodgranskningen).
   Externa paket och fem beräknade importkällor redovisas som uttryckliga
   installationsgap; immutable basimage, byggd frontend och runtimepaket är
   inte verifierade av källkopieringen. Gamla source-artifacts överlagras aldrig.
   Officiellt npm-paket `openai@7.12.1` är hämtat och separat återläst privat i
   `native-p6-sdk-source-20261003/verified-source`: 2 962 filer, 15 733 385 bytes;
   npm-integritet samt oförändrade package/client-pins matchar exakt.
   Arkiv-SHA256 `8b70fcbcee7ee7398edf93ed729d2b77ea3b08e65df16d1237cbff6f71968d55`;
   source-tree `6b2d24b71e129725534d85b5b2197f70d6091c29a899d67ca64fdd31ff3695fa`.
   4/4 separata parser-/återläsningsprov PASS. Inga lifecycle-skript, imports,
   SDK-runtimeinstallationer eller provideranrop gjordes. Worker-readerns
   annorlunda trädfingerprint är `ebbb70cbf3b784adcee13323880215dc360ac0e1c5d78891f9813368e6c3da0a`;
   jämför samma format, inte dessa två olika fingerprintformat med varandra.
   Första source-only-artifact för `8da9d636` finns privat i
   `native-p6-runtime-artifacts/source-8da9d636/`: 59 filer, descriptor-råhash
   `5c8125f7b6328324a97c2796b585d868a4ee97a245d2da1a77ce905d60177c45`.
   Den är historisk efter senare källändringar; ingen build/install/aktivering
   gjordes. 107 riktade offlineprov PASS i
   `migration-root-annual-directed-check-2.log`; full hook PASS under commit
   i `migration-root-annual-commit-check.log`. Ursprunglig testkörning saknade
   egen TEMP-katalog; katalogen skapades och alla prov återkördes utan kodundantag.
2. **Lös bara de konkreta återstående åtkomst-/kostnadsgapen.** Den senaste
   läsningen saknar counting-tariff/explicit gratisbevis, Cartesia-kontots
   USD/credit (`/usage/credits` gav 401) och RunPods avsedda endpoints faktiska
   GPU-/idle-/storage-/rabattgräns (adminläsning 403; health 200 är inte pris).
   Läsande fortsättning har nu verifierat avsedd RunPod-UI i konto
   `Jakeminator123`: endpoint `zsudl8tmzcmiv1`, RTX 4090 ×1, max workers 1,
   active workers 0, idle timeout 5 s, execution timeout 600 s, 20 GB disk,
   ingen network volume; UI visar 1,10 USD/h. Kontorabatt och maximal
   kallstartstid är inte verifierade. Ny läsning av Jakobs inloggade RunPod-webview
   bekräftar samma endpoint, RTX 4090/24 GB Pro, 1,10 USD/h och ovanstående
   gränser. FlashBoot är Standard/enabled; ingen inställning eller worker ändrades.
   UI säger millisekunddebitering medan aktuell officiell pricing-doc säger
   uppåtrundning till sekunder. Använd den konservativa sekundgränsen tills
   avvikelsen klarlagts. Ingen network volume; container disk är 20 GB,
   med dokumenterat ungefärligt pris 0,10 USD/GB/månad i femminutersintervall.
   Billing räknar start/execution/idle
   tills worker helt stannat, uppåt till hela sekunder; execution timeout
   ensam begränsar inte all kallstart. Detta är härledd UI-metadata, inte
   ett immutable råkvitto eller aktuell full kostnadsadmission. Jakob har
   klargjort att Cartesia-nyckeln är extern och att han saknar kontoinloggning;
   inga fler inloggningsförsök begärs. Public counting/pricing gav inget
   uttryckligt tariff-/gratisbevis. Dessa kvarvarande gap får inte döljas
   genom att sätta nollkostnad eller blanda in en annan kontoägares åtkomst.
   **Prisbacklog enligt Jakob:** usage kan mätas utan en verifierad dollaravgift
   (input/output-tokens, talets tecken/credits, GPU start/execution/idle-tid).
   De så kallade pristesterna är budget-/admissionskontroller för betalda prov:
   de binder rätt konto, modell, tariff, maxförbrukning och journal innan dispatch,
   och testar även restart/retry/parallellitet så kostnad inte räknas bort.
   De testar inte spelkvalitet. Kontoägarens Cartesia USD/credit/plan, officiellt
   counting-tariff-/gratisunderlag och RunPods totala GPU-/startup-/idlekostnadsgräns
   är återstående underlag. Dokumentera usage och prisosäkerhet separat; detta
   stoppar nya betalda prov men inte obetald kod, source-staging eller fixtur-QA.
   Nya QA:s GPU-/fullfilspolicy och operatörskampanj är ännu inte installerade;
   regelbunden SDK-runtime/readback saknas. Privata faktakällor:
   `native-p6-readonly-phase/{host-actual.json,remote-actual-final-2.jsonl,minimum-proposal.json}`.
   Förslaget är inte genomförande- eller utgiftstillstånd; räkna om dess
   råhashar mot aktuella filer före användning och gör ingen ny bred förstudie.
3. **Verifiera därefter full P6**, inklusive text/bild/STT, faktisk Director,
   en fullfil, en ägd streamsession med två playback-ACK, cancel/terminal/drain,
   kostnadsadmission och isolerat SQL-/HTTPS-/restartprov. Behåll originalets
   totaltak 10 USD, budgetankare, numeriska källa och journal; reservation
   5,251152 USD står kvar, oreserverat 4,748848 USD. Ett SDK-dispatch är redan
   förbrukat: högst nio återstår av befintliga tio. Ny runner använder verklig
   cookieautentiserad `/api/presentation/idle-advice` i shadow som text-stage:
   en Director-Terra plus högst fyra Terra/Deep-par = nio nya dispatches.
   Sparad Neon-policy och tillgängliga modellcandidates måste återläsas före
   betald submission. WS-done/binary bevisar inte två avkodade playback-ACK;
   faktisk produktspelar-/browseracceptans är fortsatt ett separat krav.
4. **P7 först efter verifierad ersättning:** frys verkliga skrivare, verifiera
   GPU-drain, importera aktuell policy/media/kostnadsstate med paritet och byt
   källa en gång. Produktion är inte omkopplad; produktens mejlkonfiguration
   och full invitation/reset-acceptans återstår.
5. **P8 efter P7:** radera faktiskt ersatta iframe/UI/API-/disk-/envgrenar
   enligt den konkreta tabellen i `CLOUD-MIGRATION.md`. Behåll aktiva
   `test/fixtures`, `tools`, `web`, `pipeline`, spelklipp/kalibrering,
   konton/saldo, förbrukade journaler/reservationer och OpenClaws state.

Starta ingen devserver. Inga ytterligare betalda provideranrop, kontomejl eller
återskapande av testkontot görs under denna överlämning. Arbeta vidare med
koden och lyft bara saknad avsedd åtkomst eller ett konkret beslut som hindrar
nästa steg; ny livekampanj måste ha verklig färsk budget-/stageadmission.

**Mejl och testkonto:** ett godkänt native QA-invite gav HTTP 200/
`emailSent:true` 3 oktober 15:31:35 UTC. Resend-email
`01a10264-60cd-7c83-9d28-e3c30bae8644` visar `delivered`. Läsande kontroll i
Jakobs rätta Gmailkonto hittade avsändare/ämne i **Skräppost**, daterat
3 oktober 17:31 svensk tid. Body/token är inte öppnade, ingen mailbox ändrad.
Den disponibla inaktiva QA-readern raderades via ett kvitterat
`users/remove` före den senare STOP-instruktionen. GET 15:47:37 UTC bekräftade
frånvaro och oförändrad kvarvarande identitet; samma transaktion raderar
kontots tokens, så den gamla invitationen ska inte användas. Ingen recreate,
resend eller nyinvite är gjord/beställd. Privata send-/cleanupkvitton anges
i mejlstatusen nedan. Detta var endast QA, inte Jakobs produktkonto.

## Pågående uppdrag: en Studio — inte genomförd migrering

Pågående fortsättning 3 oktober: gemensam Neon-policy mellan Studio/Render,
native konto-/partner-/authhandlers och tillhörande formulär är implementerade
på main. Grovt cirka **80 % klart / 20 % kvar** av sammanslagningen;
full helhetsacceptans, produktionskällbyte och faktisk avveckling återstår.
P6/P7/P8 är fortsatt öppna. Verifierad QA-runtimeleverans är nu
`190399386d93a02882d9b18a5ce5af53bb91fe23`, pushad på GitHub main efter
full obligatorisk hook och fyra-dealer-audit `--probe` PASS. Samtliga tre
[GitHub-CI-jobb](https://github.com/Jakeminator123/github-work/actions/runs/37129420281)
PASS för samma SHA. Produktion är inte omkopplad.

| Egen isolerad QA | Faktisk publicering på `190399` |
| --- | --- |
| Render `srv-datj7l893c1s73ar3u50` | LIVE `dep-db0h5vu0tbcc73fr4220`, HTTPS-health 200; env-fingerprint oförändrad |
| Vercel `croupier-native-qa-abc92154cb15` | READY `dpl_7ct3jqmAUdD4bxRvmaXaeDhYB3yr`, befintligt QA-alias återläst |
| Vercel `croupier-native-studio-qa-abc92154cb15` | READY `dpl_HBNwDkdV4W6xHM9wFrpv9cnJn1yP`, befintligt QA-alias återläst och godkänd mejlkonfiguration ärvd |

Neon-QA är `croupier_studio_qa_abc92154cb15`, scope
`qa_native_abc92154cb15/croupier`, datarot
`/var/data/native-studio-qa/abc92154cb15`. Additiv 004:s tidigare installation
bevarade 45 befintliga QA-tabeller och 32 tabeller vardera i produktion/äldre QA;
ingen budget/grind seedades. Aktuell kod har 41 isolerade SQL-/HTTPS-/restartgrupper,
fyra retained-guards och 46 oförändrade källhashar PASS.
Render-deployens före-/efterbevis verifierade konton, råmedia, schema och äldre
journaler. Senare egna `p6-*`-prefix innehåller avsiktligt nya prov-/budgetfiler;
hela volymen påstås därför inte vara oförändrad efter dessa prov. Äldre öppen
GPU-reservation har bevarad hash/mtime och påstås inte vara dränerad.

Senaste obetalda native-molnprov är **90/90 PASS** i
`7bf33ee7-35a2-470c-a202-c00299af4443`, 3 oktober 15:14:38–15:17:50 UTC,
på de tre faktiska `190399`-publiceringarna ovan. Privat immutable receipt:
`native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
SHA256 `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
Vera, Amira, Mei och Astrid kvitterade samma sparade Neon-revision
`studio-ed573eba-18f9-42ed-8b16-b07ec2fb62d4` och två verkliga avkodade,
hörbara, avslutade plays vardera. Tre exakta Astrid-heartbeats gav 200/JSON/off;
blockerade, mejl- och betalda endpointanrop var noll i denna körning.
Testetikett och Probe-mode ändrades endast i eget QA-projekt med CAS.
Ägd CDP-spärr och route-drain kvitterades före återställning; projekt/pit har
identiska innehållshashar före/efter och originalets `automatic`-mode består.
Browser/context är stängda och separat faktisk resultatvalidator PASS.
14 färska bootkontroller och 41 riktade guardprov PASS. Loginprovet är skopat
till loginformuläret eftersom den nya resetformen har samma användarnamnslabel.
Alla åtta första-/andra-play-bildrutor är granskade för dealer/layout;
statiska rutor ger ingen ny läppsynk-/take-approval. Äldre `4d84bffc`-kvitton,
inklusive tidigare FAIL, består som historik och är inte aktuell `190399`-acceptans.

Privat P6-körförberedelse har 28 offlineprov och tre isoleringsguards PASS.
Sju faktiska PostgreSQL-/restartgrupper binder 38 oförändrade källhashar:
aktuella 001–004, låst auth-epok, tappad COMMIT-kvittens utan återförsök,
befintlig grind/stale JWT, verklig memory-HMAC och ägarbundet färdigt paket,
förbrukad nyckel/cache efter omstart samt elva läsande kostnadsfingerprints.
Den fysiska 004-kolumnen `reserved_at_ms` och den faktiska
`web/generated-speech-chat.mjs` är rättade i P6-kontraktet. Ett fake-provideranrop
användes; nätverksanrop till providers och skrivningar till befintliga databaser
var noll. Eget kluster/process städades. Den privata STT-fixturen är 2,03 s WAV
från exakt befintligt Astrid-goodluck-ljud/text/baseline; originalet är oförändrat
och detta ger ingen ny mänsklig eller visuell approval.
Gatewayens observerade retryräknare kan minskas och är ingen absolut gräns
för betalda dispatches eller input-tokenmängd. Jakob har nu uttryckligen godkänt
**totalt högst 10 USD för den avgränsade livekampanjen, inklusive alla försök**.
Det oföränderliga privata budgetankaret har SHA256
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Beloppet är ett totaltak, inte en tillåtelse att återställa förbrukning eller
öka budgeten per omstart/dygn. Ett avgränsat verkligt SDK-textprov är nu utfört
under detta originalankare: HTTP 200, `gpt-5.6-terra`, 11 input-/5 outputtokens,
ett dispatch och ingen retry. Run `6841477f-3370-4684-93b3-69a51fc6b3fb` har
privat actual-/kostnadskvitto i `native-p6-short-text-execute/`.
Providerkostnaden uppskattas till **0,000082 USD** från usage/pris;
faktura är inte verifierad. Den konservativa reservationen **5,251152 USD**
ligger kvar; **4,748848 USD** är ännu oreserverade inom totaltaket.
Journalen återbetalas/nollställs inte. Pending/uncertain är noll och provbarnet
är avslutat. Detta är ett fristående SDK-diagnostikprov, inte full P6 eller
produktens spel-/tal-/GPU-kedja.
Separat beständig numerisk admission samt SDK-/Render-fasadaptrar har nu
36/44/27 offlineprov PASS, inklusive faktisk SDK 7.12.1 mot simulerad HTTP.
Root har granskat exakta filhashar och återkört 106 PASS/1 SKIP; det överhoppade
provet använder underagentens redan verifierade och borttagna SDK-fixtur.
Separat fasattestering och opt-in SDK-worker har dessutom 21/22 offlineprov
PASS, återkörda av root. Workern använder faktisk product-speech/adaptive-
kod och exakt rollprompt, signerade stage-tickets och bundna process-/SDK-
fakta. Fasattesteringen ändrar inte ursprunglig plan, budget eller TTL.
Isolerat SDK-källpaket och originalets privata numeriska budgetjournal är nu
installerade för det enda textprovet. Faktiskt ägd SDK-worker/routing med
input-/dispatch-/retry- och prisgräns samt kopplade färska fasobservationer
återstår för produktkedjan. Adapterprov och fristående SDK-svar ersätter inte
full P6; den betalda helhetskampanjen och produktionen är fortsatt oaktiverade.

Den avstängda QA-kopplingen går nu genom verkliga serveranrop: exakt tre
privata routes före Vercel-ingress på enbart den separata Render-QA-tjänsten,
aktuell spelar-/sessionsägare, färsk spelstatus och operatörens verkliga
kampanj. Web/SDK/Render-miljöer binds separat. Director returnerar 503 om dess
verkliga adapter saknas. 55 riktade core-prov PASS och ett Windows-symlinkprov
SKIP; privata routerprov 35/35, senaste SDK/fas/transportprov 115 och
budget/brygga 61 PASS. En separat QA-startfil har 15 offlineprov PASS.
Obligatorisk regression hittade en statisk cloud-import i det avstängda
läget; importen sker nu först efter opt-in. Det riktiga isolerade BO/Lab-
authprovet och alla åtta nya route-/ägartester passerar efter rättningen.
Dealer-audit med `--probe` passerar för alla fyra befintliga tillgångsset.
Historisk läsande SSH-kontroll 3 oktober 13:26:40 UTC verifierade
runtime `4d84bffc`, samma PID/startidentitet, exakt QA-scope och fyra avstängda
providerflaggor. Privat råkvitto finns i `native-p6-runtime-recheck-20261003.json`;
det är historiskt observationsbevis, inte nytt utgiftstillstånd.
SDK-provkällor och den privata budgetjournalen finns nu i egna P6-prefix;
faktisk helhetskörning återstår. Senaste fasläsar-/attesteringspaketet har
38 riktade guards PASS. Faktisk SSH-/Render-/SQL-läsning på `190399` verifierar
originalbudgetens två journalposter och äldre reservation utan skrivningar.
QA:s kostnads-/requesttabeller är tomma, budgetpolicy saknas och kampanjlistan
är tom; audit/schema är egna bevarade tabeller, inte nollade journaler.
Regelbunden SDK-root/readback saknas. Moln-/providerläsare finns, men den
fulla fasattesteringen stoppas av ovanstående faktiska runtime-/tariffgap.
QA-tjänstens tal-/stream-/kameraflaggor är fortfarande av; det enda SDK-provet
fick sin nyckel i RAM. Ingen full P6 eller produktionsaktivering.

Adresskontraktet är också implementerat bakom gemensamma policyflaggan:
`/blackjack` visar spelet, `/game` omdirigerar med godkända query-parametrar
och `/player-login` visar spelarentrén. BO/partner launch och callback följer
den nya effektiva adressen. Dagens flagga-av-adresser består tills bytet.
Spelarstatus, partner rotate/revoke/launch/credit kräver den signerade
Render-kommandogränsen; Vercel får inte skriva saldo eller ersätta runtime-
cancellation med en no-op. Invite/resend och nyckelskapande använder den
befintliga Neon-identiteten. Native login/lösenordsval finns på `/studio/login`
och `/studio/set-password`, med exakt returnTo för Studio/administration.
Nya lösenordstokens lagras hashade och förbrukas atomiskt; äldre utestående
råtokens kan fortfarande användas en gång. Login läser befintlig signer/roll/
fingerprint/epoch och använder en gemensam beständig begränsning av försök.
Logout/lösenordsbyte återkallar Lab-sessioner/handoffs. Mejl annonseras bara
med serverkonfigurerad sändare; återställning avslöjar inte kontots existens.
Partnercredentials och spellänk visas i en tillfällig separat resultatvy,
aldrig listmetadata/storage, och rensas vid omladdning/gruppbyte/logout.

57 riktade konto-/auth-/partner-/UI-prov samt Lab-TypeScript PASS.
Aktuellt verkligt isolerat PostgreSQL-/HTTPS-/restartprov PASS: 41
acceptansgrupper och 46 oförändrade källhashar, plus runnerguard. Fyra rena
retained-media-guards PASS. 85 riktade
tal-/journal-/Blob-/import-/operatörsprov PASS. SQL-provet täcker sparad revision/CAS,
konkurrens/rollback, native login/invite/resend/engångslösenord, logout/roll-
revoke, signerad actor/scope och walletnonce utan dubbel kreditering.
Fixtureprocesser, certifikat och databas städades. Inga riktiga konton,
providermejl, molndatabaser eller betalda jobb användes.

Native röstgranskning binder nu exakt text/audio/video/preview/index och
kalibrering till sparad CAS-revision och aktuell granskarroll. Äldre obundna
eller ändrade medier får ingen automatisk approval. Fyra mejlmallar visas
lokalt utan iframe eller mejlanrop. Skoöversikten visar endast SQL-projicerade
regler/räknare, aldrig kortordning, hålkort eller spelaruppgifter; korrupt
JSON stoppas och högst 500 tabeller visas med explicit delresultat. Dessa
flöden inklusive negativa roller, ändrat mediepar och restart PASS i verklig
isolerad SQL/HTTPS. Den äldre direkta betalda röstpreviewn stoppas före
disk/provider i gemensamt/native läge. 52 kombinerade fokuserade BO-/röst-/
readout-/UI-prov PASS; detta är inte mänsklig läppsynkacceptans.

Talets aktiva fullfil-/stream-/sessionscallers är kopplade till Neon-journalen
under gemensamma policyflaggan. Nya fullfilspaket använder befintlig privat
Blob, exakta text-/audio-/video-hashar och ägarbunden färdig SQL-metadata.
Enbart egen temporär OS-cache används och städas; detta läge läser/skriver
inte beständiga paket- eller budgetfiler på disk. Saknad journal eller
Blobadapter stoppar jobbet. Den befintliga budgetpolicyn måste redan vara
installerad/importerad, aldrig seedas med noll förbrukning. Nedstängning sparar
stream-cancellation innan journalens databasanslutning stängs.

Förberedelseverktygen kräver frysta exakta källbytes/hashar för Studio/BO-
policy och gamla kostnadsjournaler, stoppade skrivare och dränerad worker.
Osäkra/förbrukade jobb bevaras och får inte återbetalas eller skickas om.
Separat additiv `003-operator-speech-qa.sql` bevarar operatörens kampanjer,
grind och förbrukade försök; 001/002 och product-v1 är oförändrade. Den explicita
frysta journalimporten binder scope/källchecksumma och en atomisk SQL-receipt.
Den bevarar budget, UTC-dygnsreservationer, opaka requestnycklar och gamla
försök med rå källhash och utan påhittad actor. Saknad aktiv grind förblir
avstängd. Exakt återkörning skapar inga dubletter; senare förbrukning eller
ändrad lease blockerar import. Ett fel vid sista receipt rullar tillbaka alla
kostnads- och operatörsrader. Färdiga paket kräver separat exakt privat
Blob-metadata och verifierade bytes; inga publika metadata fabriceras.

Read-only Neon-kontroll visar att 001/002 saknas i drift; även 003/004 krävs före
aktivering. Ingen Studio-migration eller fryst dataimport är genomförd i drift.
Render-API och SSH fungerar nu: Jakob godkände
registrering av datorns befintliga publika Ed25519-nyckel på sitt Render-konto.
Ingen privat nyckel har överförts, ändrats eller skapats. Read-only pwd på
produkten PASS. Läsande export finns, men är uttryckligen **ofryst**: 129
journalfiler, 18 terminala GPU-jobb, 46 streamrequestkvitton samt
tre operatörskampanjer med sju försök och ingen aktiv grind. Rå BO- och
socialpolicyfil saknas; effektiva standardvärden har separat proveniens och
får inte presenteras som exporterade sparade filer. Importen kräver fryst
fullständighet och verifierade källor före byte och avveckling.

PostgreSQL-underhållsläget `studio-export` är implementerat och isolerat
verifierat men inte aktiverat i drift. Det kräver explicit avstängd gemensam
policy och fullfils-/streamtal, startar inga Web-/Lab-barn och ansluter inte
till databasen. Exakt health visar läge/noll barn/skrivare/provideranrop;
övriga routes ger 503. Frysta bytes hämtas privat via SSH och extern
GPU-dränering måste verifieras separat. Äldre SQLite-export består.

Det sparade projektet har 18 aktiva bindningar. Tolv matchar exakt dagens
lokala och inventerade Render-register. Sex bundna UUID saknas i båda:
`891c432a` den 29 september ersatte klipp med samma filnamn/familj/roll men
andra bytes, hash och storlek. Det sparade projektet behåller de äldre
referenserna. De sex exakta originalvideorna är nu återfunna i `365f283b`:
6/6 matchar originalhash/storlek och har inget ljud. Detta är identitetsbevis,
inte ny visuell acceptans. Kodgrunden för bevarande i privat Blob/Neon och
en strikt resolver för de sex oförändrade bindningarna är verifierad i riktig
isolerad PostgreSQL/HTTPS/restart: scope, oföränderlighet, exakt återkörning,
nekad korrupt tuple och beständighet efter omstart PASS. Alla sex original är
nu uppladdade som nya immutabla privata Blobobjekt: totalt 8 262 169 bytes,
full återläsning/hashkontroll PASS. Det privata kvittot
`retained-bank-blob-receipt.json` har `blobReadbackVerified:true`.
Ingen retained-media-SQL/import i drift är ännu genomförd.
Liknande filnamn får inte automappas till ersättningsbytes.

Den äldre Neon-QA-databasen har 25 befintliga konton och ska inte återanvändas
för ett tomt importprov. En separat QA-databas och begränsad roll är nu
skapade. Den nya databasen är nu initierad med checksumverifierad product-v1,
Studio 001/002/003, en syntetisk administratör och tre neutrala dokument.
Spelar-/kostnadsstate är tomma. De sex originalens exakta mediemetadata är
nu registrerade enbart i nya QA med sex auditposter; exakt återkörning skrev
noll rader. Den aktuella projektkopian med alla 18 verifierade bindningar är
sparad där via explicit CAS, med oförändrad neutral BO-/socialpolicy. Privat
`native-qa-project-replica-imported.json` är kvitto för QA-kopian, inte fryst
produktionsimport. Produktions- och äldre QA-rader är oförändrade.
Render-QA är återstartad på exakt `ae54a61b`, nya databasen/scope och separat
datarot. Faktisk health/konfiguration PASS; gamla QA-filer och en gammal öppen
reservation har samma hash och mtime efter återstart. Tal-/stream-/kamera-
providers är avstängda. Två separata Vercel-QA-projekt är READY på samma SHA.
Den exakta Lab-QA-domänen behövde registreras som projektets produktionsdomän
eftersom Vercel förkortade standardnamnet; native login ger nu 200 och auth-
methodkontrollen 405. Standard-SSO och befintliga projekt/domäner består.
Bankprovet är separat från aktuell native-browseracceptans (90/90 ovan);
full P6 och produktionsaktivering återstår.

Den första riktiga native-API-kontrollen hittade stripad Next-basePath och
olika transport-/publik host genom frontendens Vercel-rewrite. En gemensam
serveradapter återställer bara exakt konfigurerade Studio-namespaces/origins
för auth, administration, projekt, socialpolicy, video och clip-controls samt
SSR-sidor. Cookie, body, Origin, roller, CAS och transaktionskontroller består;
främmande/mixade hosts, protokoll och actions nekas. 63 relevanta prov och
Lab-TypeScript PASS; två oberoende läsgranskningar har inga kvarvarande
materiella fynd. Rättningen är levererad i `6efb50ee` efter full obligatorisk
hook och alla tre GitHub-kontroller PASS. Det sista riktiga isolerade SQL-/
HTTPS-/restartprovet passerade åter alla 40 grupper och fyra retained-kontroller;
44 källhashar består och separat städkontroll fann noll fixturkataloger/processer.
Nya QA-molnbyggen på samma SHA är READY/LIVE. Login-boot och session/overview
ger förväntade 200/401 på båda canonicaldomänerna. Full browseracceptans
stoppades efter fyra lyckade åtkomstkontroller: Nexts SSR-redirect dubblerar
basePath till `/studio/studio/login` och ger 404. Inget login-
POST, projekt-/pitbyte eller provideranrop gjordes i det stoppade provet.
SSR-rättningen använder nu apprelativ `/login` och behåller publik `returnTo`;
även Lissabons gamla redirect ger ett enda prefix. 24 fokuserade prov, inklusive
fem som kör de verkliga SSR-sidorna/guards genom installerad Next/SWC, samt
Lab-TypeScript PASS. API- och klientnavigeringens fulla adresser består.
SSR-rättningen är pushad i `7fe032a8` efter obligatorisk full regression;
alla tre GitHub-kontroller PASS. Båda nya Vercel-QA och Render-QA är READY/LIVE
på samma SHA. Alla 14 verkliga bootkontroller PASS, inklusive exakt enkel
loginredirect och följd login-GET på båda origins. Nästa fullprov stoppades
åter efter fyra godkända åtkomstkontroller: formuläret kunde skickas före
React-hydration som browserns vanliga GET. Ett separat anonymt browserprov
bekräftar kall GET och `user`/`pass` som FormData-namn, medan JS senare kopplas
in utan fel; inga nya credentials skickades i diagnosen. Den tidigare
requestens query är redigerad ur underlaget och kan inte rekonstrueras.

Authformulären använder nu explicit intern POST, initialt spärrade fält/knappar,
laddningsstatus och noscript-information. Fallback nekas med 415 före auth/mejl;
alla 12 native administrationsformulär använder också POST. 38 riktade prov
PASS, inklusive installerad React/SWC-SSR och faktisk headless React-hydration,
kall Enter/submit samt JSON-POST efter hydration. Lab-TypeScript PASS.
Enbart den nya QA:s syntetiska operatör har fått bytt lösenord och epoch+1;
egna sessions-/handoff-/lösenordstokens är återkallade, signer och övriga
identiteter består. Rättningen är levererad i `b5c0ddc7` efter full obligatorisk
hook och alla tre GitHub-kontroller PASS. Render och båda nya Vercel-QA är
LIVE/READY på samma SHA; alla 14 bootkontroller och faktisk kall/hydrerad
formulärkontroll på båda origins PASS utan credential-submit.
Två fullprov passerade 76 kontroller: login, sex administrationsgrupper,
14 sektioner, åtta readouts, utkast/CAS-konflikt, fyra Render-revisionskvitton
och privata originalklipps HEAD/Range/fullhash. Båda stoppades därefter i
Vera-rehearsal. Första provets för snäva nätverksguard blockerade det egna
spelaruppslaget och de aktiva typsnitten; andra provet hade noll blockerade
anrop men saknade förväntat konfigurationskvitto. Ett avgränsat faktiskt
molnprov bekräftade samma sparade Neon-revision på båda API-vägar, men gamla
`lab/project.json` i legacy-kvittot. Native-adaptern anger nu korrekt källa;
23 fokuserade prov PASS, nytt fullprov kräver den nya leveransen.
Projekt-/pitinnehåll återlästes efter exakt CAS-återställning
i båda proven; providers användes inte. Oföränderliga FAIL-kvitton består.
Ingen komplett browseracceptans eller produktionsaktivering är verifierad.

Fullfilsvägen hade ett separat kostnadsgap: request-/submitjournalen skapade
ingen monetär reservation före TTS/GPU. Additiv 004 och en requestägd,
beständig reservation är implementerade; beloppet ska anges explicit och
delas i dygnssumman med streamkostnader. Tidigare kostnader bevaras och inga
legacy-fullfilsrequests får fabricerade nollkostnader eller återbetalningar.
83 fokuserade journal-/service-/provider-/molnprov PASS. Faktisk separat lokal
PostgreSQL/restart gav 15/15 grupper plus tre isoleringsguards PASS: båda
admissionsordningarna/samtidighet, UTC-dygn, minskat tak, oföränderlig policy,
tappad faktisk COMMIT-kvittens, gamla oreserverade nycklar och fenced ägare.
Verkliga serviceanrop nekas före provider vid saknat belopp/policy/budget
eller försenad ny auth. Åtta minuter måste återstå av ursprungliga tolv;
300 sekunders maximal klientdeadline och 180 sekunders separat RunPod-TTL
täcks även vid osäker POST. Alla 13 källhashar består; egen databas/process
är städade. Det breda uppdaterade SQL-/HTTPS-/restartprovet gav 41/41
grupper samt fyra retained-kontraktsprov PASS. Alla 46 källhashar är
oförändrade; separat kontroll bekräftar noll egna fixturkataloger.
Totaltak 10 USD är godkänt och ett litet SDK-prov är kvitterat enligt ovan;
full tal-/GPU-/restartacceptans och produktionsaktivering återstår.
Migration/import seedar ingen fullfilspolicy i den äldre förbrukade
produktionsjournalen; en explicit verifierad policyadoption krävs där.

Native mejladaptern kräver nu både Resend-nyckel och explicit
`CROUPIER_STUDIO_MAIL_FROM`; den tidigare hårdkodade avsändaren är borttagen.
Fyra obetalda adapterprov PASS, med exakt mottagare/tokenorigin och nekad
osäker leverans utan automatisk retry. Egen sändardomän, QA-nyckelkoppling och
ett native invite med Resend-status delivered/Skräppost är verifierade nedan;
användbar invitation efter cleanup och full reset-acceptans återstår.
Aktuellt Lab-produktionsbygge/TypeScript PASS med 50 sanerade traces och
noll kvarvarande privata referenser. Administration/authspår innehåller alla
fyra SQL-versionerna. Dealer-audit --probe PASS mot oförändrad baseline;
befintliga mänskliga läppsynkgap kvarstår.

Den privata produktionsimporten kräver normaliserade hashkontroller för
kritiska beroenden/SQL/aktiva manifest och Blob-index mot levererad main-SHA.
Den aktuella kritiska källmängden är 132 filer; gamla planer ska inte återbrukas.
87 privata importguards och 36 paritetskontroller PASS utan anslutningar.
Bytesverktyget kräver alla fyra aktuella SQL-checksummor och elva kostnadstabeller;
19 fasguards och 13 runtimeparitetsprov PASS. Planberedningen kräver explicit
main-SHA och gör inget vid import. Den nya policyn för en redan förbrukad
journal har en separat preparer och avgränsad injicerad executor med elva
obetalda guards. Den ändrar endast en ny policy, aldrig gamla kostnadsrader,
och saknar ännu verklig fas-/anslutningsadapter. Alla produktionsskrivande
molnfaser är fortsatt spärrade tills full faktisk P6-acceptans finns.
Alla 18 aktiva videobindningar ska fullåterläsas/hashas före SQL-skrivning.
Samma skarpa läsare har nu fullverifierat alla 18 i nya QA mot Blob med
tom egen OS-cache, inklusive sex original; noll SQL-/provider-skrivningar.
Efter import krävs exakt sex-medieparitet, oförändrade konton/spelrader och
en andra kostnadsimport som skriver noll rader. 86 privata spärrprov PASS
utan anslutning eller skrivning. Återupptagning binder originalpayloaden och
separata färska driftbevis; originalreceipt, källtid och kostnader skrivs inte om.
En fullbordad import kan endast återkontrolleras med läsanslutning och ett nytt
oföränderligt paritetskvitto för tre dokument, sex registerposter, 18 mediefiler,
kostnads-/operatörstabeller och skyddade spel-/kontorader. De nya privata
paritetskraven omfattar även 004:s båda fullfilstabeller; äldre kvitton gäller
sin tidigare schema- och källversion. Sex tidsgränsprov
nekar även bevis som hinner gå ut under ett awaitat driftsanrop; 17 ytterligare
freeze-/recovery-/providerprov PASS. Ingen importplan/apply har körts mot drift.
Den privata readonly-kontrollen efter driftstart binder separat oföränderlig
runtime-anchor och observerad aktuell journal, två databasjämförelser och
faktisk fullavläsning av 18 klipp mellan dem. 13 offlineprov PASS; den förnyar
inget childless-/frysningsbevis. Produktionsdriverns mutationer är uttryckligen
blockerade tills verklig full P6-acceptans finns, inklusive mejl och AI/ström.

RunPods faktiska endpoint-health visar kö/pågående jobb 0/0, men idle/ready 1/1.
Den befintliga konsolen visar samma Croupier-endpoint under Jakobs profil,
min workers 0, max 1, idle timeout 5 s och en individuell idle worker.
Detta är inte ett dräneringsbevis. Jakob uppger att befintliga nycklar kan
tillhöra Emil; inga nycklar eller kontoövergripande inställningar ändras.
Färsk endpoint-/processkontroll krävs vid frysningen. Jakob har valt sitt
befintliga **Resend Free**-team; ingen betald mejlplan är aktiverad.
`scoutgaming.tech` är verifierad i Resend, region Irland. Resend visar **Verified**
3 oktober 14:11 svensk tid, kontrollerat i dashboarden 14:19.
Exakt tre DNS-poster är tillagda: DKIM TXT `resend._domainkey`, MX `send`
med prioritet 10 och SPF TXT `send`. Alla fem ursprungliga zonposter är
hashverifierat oförändrade; de nya värdena är också återlästa i publik DNS.
Första DNS-kvittot stannade på MX-adressens kanoniska slutpunkt; läsande
kontroll bekräftade rätt värde och en separat fortsättning lade endast till
saknad SPF, utan återförsök av redan skapade poster. Privat slutkvitto
`mail-resend-dns-finish-result-20261003.json` har status `three-records-verified`.
Färsk OAuth/callback är färdig och integrationen är installerad **endast** i
QA Studio `prj_aPooGMUUKTGbyKlp0yEZUrEZtUmh`, configuration
`icfg_33VhY6BuYW1NJHPZFxLYATRl`. Actual readback 14:57:48 UTC verifierar
integrationsägd krypterad `RESEND_API_KEY` och explicit
`CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech`; värden/nycklar sparas
inte i Git. QA:s Vercel-targetnamn `production` avser det isolerade QA-projektet,
inte produktens drift. Den nya Studio-deployen ovan ärver konfigurationen.
Privat `mail-resend-qa-connect/sender-result.json` är konfigurationskvitto.
Jakobs uttryckligen godkända **enda** testmejl skickades genom native
`POST /studio/api/admin/users/invite`: 3 oktober 15:31:35 UTC, HTTP 200,
`emailSent:true`, ny inaktiv reader efter verifierad frånvaro före testet.
`mail-resend-qa-connect/mail-test-{intent,result}.json` binder det faktiska anropet;
initialt result anger ännu ingen leveransbekräftelse. Separat Resend-dashboard-
kontroll visar email `01a10264-60cd-7c83-9d28-e3c30bae8644` som **delivered**.
Snäv sökning i rätt inloggat Gmailkonto hittade exakt avsändare/ämne i
**Skräppost**, daterat 3 oktober 17:31 svensk tid (=15:31 UTC). Body/token
öppnades inte och inga mailboxändringar gjordes.
Den tidigare beställda QA-cleanupen hann klart före STOP: ett `users/remove`,
HTTP 200/ok, GET 15:47:37 UTC saknat konto och samma hash för enda kvarvarande
QA-identitet. API:s `active:0` är `(hash IS NOT NULL)::integer`, alltså inaktivt;
den atomiska raderingsvägen tar även bort identity-tokens/sessioner/handoffs.
Privat `mail-resend-qa-cleanup-confirmed-result.json`, SHA256
`1f3978ba4e58bab9e22e75e32fe8357911ba34c2b17b2e97809c6a9bbcabeb23`, är cleanupkvitto;
första preflighten nekade boolformatet utan removeförsök och är också bevarad.
Den skickade invitationens token ska därför inte användas. Ingen återskapning,
resend eller nyinvite efter STOP; full invitation/reset-acceptans är fortsatt öppen.
Produktion/Render har inte fått mejlnyckeln. Inga fler betalda prov eller
budgetåterställningar följer automatiskt av mejlkonfigurationen/SDK-textprovet.

Kodleverans [58536d63](https://github.com/Jakeminator123/github-work/commit/58536d63cc82d2c17936437aa784b2310b599a86)
är pushad på GitHub main och alla tre CI-jobb PASS. Vercel-frontend är READY.
Tidigare [c667aa22](https://github.com/Jakeminator123/github-work/commit/c667aa22205fba9e872e744cfe1aba2add3adf84)
är pushad på main efter full hook och alla tre CI-jobb PASS. Vercel-Lab är
nu READY för denna leverans; lokal traceguard/build PASS med 50 sanerade
traces. Tidigare [3a5f0517](https://github.com/Jakeminator123/github-work/commit/3a5f0517db5f7f74d494e742f6a0401ed551bb8a)
är pushad efter full hook med de 40 SQL-/HTTPS-/restartgrupperna ovan,
röstgranskning, mejl-/skoöversikt och childless PostgreSQL-underhållsläge.
Alla tre CI-jobb och båda Vercelbyggen för leveransen PASS/READY.
Ett kandidatbygge hittade en legacy-middleware-fixture som ärvde
nativeflaggan. Testmiljön anger nu båda flaggorna explicit av; alla 31
frontendtester PASS även när omgivande native-/Neonflaggor är på. Rättningen
är levererad i `ae54a61b` efter full obligatorisk hook och alla tre CI-jobb PASS.
Den publicerade flagga-av-koden är inte ett produktionskällbyte.
Lab-TypeScript samt lokala Lab-/frontend-produktionsbyggen PASS. Privata env,
lokala databaser, QA-underlag och agentstate har noll referenser i de 50
kontrollerade lokala traces. Spelmediers aktiva
index/bank/speech-metadata är fortsatt inkluderade. Dealer-audit med --probe
PASS för baselinen; detta är inte mänsklig läppsynkacceptans.

Riktad städningskontroll: iframe/`BackofficePanel` och gamla BO-routes är
fortfarande aktiva när nativeflaggan är av; de raderas efter verifierat
källbyte. `StudioPage`/`Studio` används av sex äldre/avancerade routes,
inklusive tree; hela komponenten är därför inget bevisat oanvänt raderingsmål.
Ingen ny integration refererar GitLab, Jira eller Supabase. Aktiva spelklipp,
konton/saldo, kostnadsjournaler och OpenClaw-state har inte rensats. Ingen
devserver har startats; SQL/HTTPS-provet var en kortlivad isolerad fixture.

Jakobs extra städfråga: `services/test` och `services/test/fixtures` finns inte.
De faktiska mapparna `services/astrid-gpu-worker/gateway/test` och
`services/astrid-gpu-worker/tests` används av CI/testskript och manuella
browser-/benchmarkverktyg. Fyra Node- och fyra Python-filers syntax PASS.
Rootens `test/fixtures` har sex spårade filer: fem JavaScript-fixtures används
av auth/server/SQL/stream/camera-/Lab-tester; HTML-filen är manuell syntetisk
QA utan verifierad ersättare. `test/tools`, `test/ttols`, `test/web` och motsvarande
vägar under `services/test` finns inte. `tools` och `web` är separata mappar i
repo-roten, inte under `test`. Inget obsolet raderingsmål hittades; allt behålls.

Jakobs nästa önskemål är en granskad svarskatalog: frågor/text och valda bild-/
ljudbilagor kopplas till exakt svarstext/audio/video och kategorier som
hälsning, komplimang, spelregler och tid. Rekommenderad minsta utbyggnad är
explicit sparning av en Studio-/QA-kandidat, först från färdiga fullfilspaket:
bytes i samma privata Blob; sökbar text, scope/ägare, ursprung/request, exakt
paketrevision/hashar, kategori, kontext och granskningsstatus i Neon.
Återanvändning kräver godkänt biblioteksexemplar och aktuell spelpolicy;
namn, aktuellt klockslag, rundor och saldo får inte återanvändas globalt.
Streaming har ännu inget färdigt AV-arkiv och kräver senare exakt capture,
aldrig betald fullfilsfallback. Ingen automatisk inspelning av alla spelare
eller ny katalogimplementation är införd. Avvisade/retired biblioteksbytes
kan tas bort efter referensprov; kostnads-/requestjournaler ska alltid bestå.

Läsgranskningen fann ett återspelningsfel när en signerad body fördröjdes
förbi nonce-städningen. Rättningen återkontrollerar signaturens tidsfönster
efter body, auth, låsväntan och SQL före mutation. Samma obetalda repro ger
nu 403 och en enda originalkreditering; sex riktade kommandoprov PASS.
Rättningen ingår i leverans `c667aa22` ovan.

Föregående grundkodsteg 3 oktober: Neon-/jobbjournalgrund samt native BO bakom
**avstängd** `CROUPIER_STUDIO_NATIVE_ADMIN`. Då var läget cirka 40 % av den nya
sammanslagningen, inte live-cutover. Tre agentdelar integrerades på main:
`web/storage/studio-{contract,repository}.mjs`, `ops/neon-studio/001/002` och
migrationsrunner; `web/postgres-speech-journal.mjs`; native komponent och
`lab/lib/studio-{admin-api,admin-data,native-auth,native-runtime}.mjs`.
Native routes finns för admin och auth/session; flagga-av ansluter aldrig DB
eller skriver något. Påslagen flagga kräver explicit miljö/workspace, verifierat
product-v1 och båda Studio-migrationerna. Saknad sparad administration/fel DB
ger fel, aldrig seed, iframe eller diskfallback i native-läget.
Samma BO JWT/opaque Lab-session används med live roll, passwordfingerprint och
auth_epoch; inga nya lösenord/OAuth/konton har skapats i drift. Reader/staff får
endast sina BO-rättigheter, inte därigenom Studio-projekt-/medieskrivning.
Exakt login-returnTo `/studio/administration` är tillagt utan generell URL-allowlist.
UI återvaliderar sessionen, använder endast annonserade handlers, sparar med
strängrevision/CAS och kastar inte äldre formulärutkast tyst efter omladdning.
API-grunden har säkra errors, Origin/Host/JSON-gräns, explicita specialgates och
serverägd actor/scope. Partnerlistan väljer inte credential-kolumner.

Produktionsaktivering kräver fortfarande hela återstående P2–P6: aktuell
fryst import/paritet, exakta aktiva mediereferenser och riktig transport-/
dealeracceptans. Aktiva journalcallers är verifierade isolerat, inte i drift.
Nuvarande produktdrift använder
fortfarande bo.json/Studio-disk tills det samordnade källbytet genomförs.
Den aktuella isolerade SQL/HTTPS-verifieringen ovan ska inte upprepas som
förstudie eller förväxlas med produktions-/GPU-/mänsklig acceptans. Byt
källa samordnat och ta sedan faktiskt bort ersatta kodvägar/diskberoenden.
Förbrukade kostnadsjournaler
ska importeras, aldrig återinitialiseras. Ingen live-migration, moln-env-ändring,
disk-/Blob-radering eller betald provkampanj har gjorts i detta kodsteg.

Verifiering av föregående grund: 90 riktade prov PASS (44 lagring/journal och
46 native API/auth/data/runtime/UI), TypeScript och Next-produktionsbygge PASS.
En tidig serverbundlingskrasch reparerades: pg-loadern är lazy och native
schema-check läser uttryckligt spårade SQL-källfiler, inte webpack asset-URL:er.
Byggkvitto visar product-v1 samt 001/002 i native admin-routens file trace.
Det tidigare PostgreSQL-/restartprovet (15 PASS) är äldre; aktuell
SQL-/restart-/HTTPS-verifiering för fortsättningssteget anges ovan.
Ordinarie full hook PASS och omfattar nu även de nya testerna. Kodleverans
`1efcbb9c011893ae9aad03bd317cd33833655e5d` är verifierad på GitHub main.
Vid leveranskontrollen var två av tre [CI-jobb](https://github.com/Jakeminator123/github-work/actions/runs/37080063154)
gröna och dealer-regression fortfarande igång; frontend var READY och
`croupier-lab-ui` BUILDING för samma SHA. Kontrollera aktuella slutstatusar innan
nästa driftsteg. Native-flaggan är fortsatt avstängd; publicerad kod är inte
live-cutover och ingen produktionseffekt ska härledas från enbart fixturprov.
Jakob bad att stänga Backoffice-webview och eventuell devserver: CUA kunde inte
starta (kernel-sökväg), så flikstängningen är inte bekräftad. Read-only kontroll
visade även efter testerna inga Croupier-nodeprocesser eller lyssnare på
4173/4179/4188/4190/4191. Ingen
ny devserver startas; andra projekts/verktygens processer lämnas ifred.
`test/` och `pipeline/` är inte raderingsmål i sin helhet: vid inventeringen
fanns 107 respektive 119 spårade filer, med många aktiva CI-/mediaanrop. Ingen
av dem har blindrensats. Befintlig John-handoff räcker för sömlös fortsättning.

Jakob har nu preciserat UI:t: Dealer & klipp, Backoffice och OpenClaw som tre
huvuddelar. Den faktiska startsidan använder `LabStudio`; dess Astrid-menyer
var kvar även efter föregående städning av den andra `Studio`-komponenten.
Fokuserat dealerskal är ombyggt; gamla event-/simulatorvyer flyttas inte in.
Astrids idle/familjer/Probe består; andra dealers får sina egna exakta register
och ärver ingen Astrid-policy. Probe-textprov, genererad film och faktiskt
spelad film ska skiljas åt. Bakgrundszonernas preview är inte spelintegration.
Den lokala Backoffice-menyn återställs i sex grupper med alla 14 funktioner;
dess befintliga backend/iframe består till native API-/lagringsersättningen.
OpenClaw blir en fokuserad autentiserad portal till den befintliga dashboarden.
Ingen devserver, modell-/GPU-ändring eller generell Render-omstart aktiveras.
Dealer-UI och OpenClaw har byggts parallellt; navigation, Backoffice-gruppering,
guide och docs är integrerade. Läsgranskningens observationsfel är rättade:
panelen behåller sin monterade observation och frysta dealer; befintlig
molnspelflik med fel/saknad/tvetydig dealer nekas utan att navigeras eller stängas.
Kodleverans `d8b1b928d3feef9f4004ea6ee26697af2613a10f`: 43 riktade
UI-/navigationstester, Lab-TypeScript och normal pre-commit PASS. Alla tre
[CI-jobb](https://github.com/Jakeminator123/github-work/actions/runs/37077434621)
är gröna; frontend och `croupier-lab-ui` är READY på Vercel för samma kod-SHA.
Anonym åtkomst till Studio, Backoffice och OpenClaw-portalen kräver fortsatt
inloggning. De nya testerna ingår i normal pre-commit och Lab-CI. Automatisk
webview-kontroll kunde inte starta; visuell livegranskning kvarstår. Detta är
inte ny gameplay-/läppsynk-/GPU-acceptans eller native API-cutover.
Ingen Croupier-devserver är kvar på de vanliga lokala portarna efter testernas
isolerade fixtures. Inga andra projekts servrar har stoppats i detta UI-steg.

Byggloggen rapporterar en befintlig kritisk Next.js-varning
[GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).
Den gäller Node-baserad `next/og` med användarstyrt SVG-innehåll; ingen sådan
route hittades i Lab/app eller frontend/app. Beroendeuppdatering återstår;
ingen automatisk `audit fix --force` har körts och inga paket har ändrats.

[Masterplan och återanvändbara agentprompter](CLOUD-MIGRATION.md#masterplan-en-croupier-studio)
är införda i befintlig migrationsguide. Jakob har godkänt målbilden och vill
att ersatta delar faktiskt avvecklas, inte sparas som parallella legacy-system.
Tre underagenter har gjort avgränsad läsanalys av UI/auth, lagring och OpenClaw/GPU;
orchestratorn äger checklistan, gemensamma kontrakt, docs och senare integration.
Första fristående kodpaketet för sektioner/behörigheter/API är skrivet; inga aktiva
routes använde det då. Neon-schema/adaptrar och fenced jobbjournaler ingår nu
i det avstängda integrationspaketet ovan; tidigare 15 isolerade PostgreSQL-prov och 47
fixturprov passerade på äldre arbetsversion. Det är inte produktionsmigrering. Ingen kontoförändring,
mediaregenerering, disk-/objektradering eller betald provkampanj har gjorts.
Aktuell driftskarta nedan gäller fortfarande.

Senaste uppdraget: fortsätt faktisk implementation, ge grova procentuppdateringar
för hela den nya Studio-sammanslagningen och förenkla överlappande menyer.
Gamla Studio-granskningsklipp/generationer/cache behöver inte migreras; Jakob kan
ladda upp nytt manuellt. Ingen ny arkiv-/backupkampanj för bortvalt medieslask.
Aktiva spelklipp, konton/saldo och OpenClaw påverkas inte av det bortvalet.
Request-/GPU-kostnadsjournaler måste bestå så att tidigare försök inte debiteras igen.
Tre implementationer körs på exklusiva filer: dokument/CAS/migration, fenced
request-/budgetjournal och aktiv förenkling av Studio-navigationen. Gemensamma
runtimecallers och driftkällor byts inte förrän delarna verifierats/integrerats.
Efter kontrakt, isolerade lagringsutkast och publicerat UI-steg var läget cirka 30 %;
native integrationsgrund gav då grovt cirka 40 %; aktuell fortsättning är
cirka 80 % klart / 20 % kvar enligt statusen överst.
Detta är en grov omfattningsbedömning, inte uppmätt tidsåtgång eller ett tidslöfte.
Äldre GitHub-/Vercel-kvitton gäller sina angivna SHA, inte automatiskt senaste kodsteget.

Adressprecisering: idag är `/blackjack` spelarens inloggningsentré och `/game`
spelet. Målbilden är `/blackjack` som spel och `/game` som redirect; launch,
callback, returnTo och partner-allowlists måste följa samma samordnade ändring.
BO:s `/api/bo/config` används fortfarande av spelet och kan inte blindraderas.
Render-disken har även jobbidempotens och RunPod-reservations-/budgetjournaler;
beständigt Blob-media ersätter inte dessa. Bevara checksumlåst product-v1,
befintliga auth-/spelarroller och OpenClaw/GPU-funktioner. Director/Gateway-
diskar är aktiv systemlagring, inte avvecklingsmål för den här flytten.
Planen har sakgranskats av alla tre underagenter. Miljövariabelregistret och
17 lokala dokumentations-/leverans-/hooktester: PASS. Detta är inte ny
spel-/media-/GPU-acceptans eller en full liveinventering. docs har fortsatt
exakt fem Markdown-filer.

Jakobs senaste beslut: Jira/CAC och gamla GitLab-trackerflöden ska inte
användas. Kravet är borttaget ur AGENTS.md, chef-instruktionen och masterplanens
prompter. GitHub plus den befintliga checklistan är arbetsflödet; ingen ny tracker.
Läsande startkontroll: GitHub-repo har admin/push-åtkomst; main är synkad,
tre CI-jobb och båda Vercel-publiceringarna på `cd4d8480` är gröna. Vercel-CLI
är autentiserad och når rätt frontend-/Studio-projekt. Detaljverktyget i
Vercel-kopplingen har ett parameterfel; CLI fungerar som verifierad reservväg.
Render API och Director health/status svarar; befintliga rollnycklar matchar.
Neon game/auth och zones anslöts i READ ONLY-transaktion med SELECT/schema-
metadata; rätt scheman och schema-create-privilegium finns. Inga kontorader
lästes och ingen DDL/live-migrering kördes. Full diskinventering kvarstår i P1.

Kodpaket `studio-native-admin-contract-v1`: två nya MJS-moduler med
TypeScript-deklarationer i lab/lib och två tester i lab/test. Bevarar 14 sektioner,
31 explicita actionregler, fem auth-adresser och nuvarande rollgolv; nekar
okända/spelarroller, prototypnycklar, fel metod och icke-exakta paths.
11 riktade tester och sex befintliga navigationstester PASS; Lab-TypeScript PASS.
Full lokal pre-commit-regression PASS, med miljöbundna prov skippade där avsedd
isolerad Neon/Linux-miljö saknas. Det är inte ny live-/media-/GPU-acceptans.
De nya testerna ingår i den fulla pre-commit-hooken och Lab-CI.
Rollhelpers är inte sessions-/Origin-/CAS-/providerauktorisering. Self-role/remove,
spelarstatusens runtime-cancellation och speech-QA-gate är uttryckliga framtida
handlerkrav, inte genomförda i dessa helpers. Ingen UI-/API-aktivering ingår.

## Drift och ansvar

- [Startsida](https://www.scoutgaming.tech/), [spel](https://www.scoutgaming.tech/game)
  och [Backoffice/Lab](https://www.scoutgaming.tech/studio) visas på Vercel.
  BO-inloggning och den befintliga projektrevisionen är verifierade på den riktiga adressen.
- Render äger slump, kort, shoe, regler, saldo, resultat, API/SSE och sparade Lab-projekt.
  Native Node-ingress på Vercel vidarebefordrar speech-stream och lipsync-worker
  efter Render-auth; gränserna är 300 respektive 600 sekunder.
- Game/auth ligger i separat Neon, skild från zonernas databas. Befintlig
  superadmin och båda spelarna är verifierade; inga produktionskonton eller rundor skapades för QA.
- Privat Blob använder det aktiva gemensamma media/blob-index.json.
  Studio-projekt, historik och familjeindex ligger fortfarande på beständig Render-disk.
  Director/Gateway behåller sina befintliga tjänster och diskar.

Dessa produktionsflyttkvitton gäller `22dca5c4` och dokument-/guideleveransen
`fb3c0860` från 2 oktober. Frontend och Lab är aktiverade på de kanoniska
Vercel-adresserna från main. Senare native-QA-kod, installation och städning
har separata revisioner och bevis överst; dessa äldre kvitton är inte en
aktuell P6-acceptans.

## Verifierat

- Blob-städning 2 oktober: samma privata Stockholm-lager döpt till
  `croupier-media-private`. Den fristående `astrid/`-roten är borta; zonklippet
  (67 342 byte, SHA `022ad98b747149501b014f1bd04f4251808f9332e4f1e69b4ab605f250b4b668`)
  bevaras oförändrat under `croupier/media/dealers/astrid/source/background-zones/`.
  Återställning av gamla adressen kan göras från denna verifierade kopia.
  Tolv äldre uppladdningsadresser behålls tills diskindex/historik kan inventeras;
  samtliga tolv runtime-dubbletter återlästa med identisk storlek och SHA.
  Aktivt Blob-index, media-ID:n, kalibrering och spelval är oförändrade.
  Produktions-BO, Studio-projekt och videoregister lästes utan ändring;
  zonernas molnregister innehöll inga klippreferenser. Detta är inte ny visuell acceptans.
  QA:s bootstrap-lösenord gav HTTP 401; inga konton eller lösenord ändrades.
  Render-diskarnas ansvar och live-konfiguration är tydliggjorda i driftskartan;
  direkt full diskinventering/extern backup återstår.
  Dealer-audit med ffprobe: PASS mot oförändrad fyrdealerbaseline. Dokumentations-
  och leveranskontroller: 17 tester PASS. Inga nya visuella speltester behövdes
  för namnbytet/arkivflytten; aktiv presentation och medias bytes är oförändrade.

- Produktionsimport: noll Web/Lab-skrivare, hashverifierade SQLite-backuper
  utanför Git, 24 källtabeller/102 rader och full backup/restore-paritet för
  32 PostgreSQL-tabeller inklusive radhasher och sekvenser. Inga aktiva externa wallet-kopplingar.
  Återaktivera aldrig gammal SQLite efter nya Neon-skrivningar.
- Riktig isolerad Neon QA: samtidiga native-starts med ett avdrag,
  transaktionsrollback, CRAIG-epoch, block/revoke/reactivate, kontoavslut,
  chat-forget-race och beständig runda med saldo/ledger-paritet.
- Native WebSocket-molnprov på exakt 22dca5c4: klient och worker 101,
  faktisk serverkod och syntetisk worker, exakt mediehash/32 byte och terminal 1000.
  Fel användare, återanvänd biljett och fel worker-token nekas.
  Detta är transportprov, inte mänskligt godkänd talfilm.
- Isolerat Blob-browserprov på samma revision: alla fyra originaldealers,
  Astrids Studio-väg och Astrid/Amira V2, två verkliga uppspelningar per väg
  (14 starter/14 avslut), ljud- och bildframsteg samt native-kvitton i Lab.
  Sex filer verifierade med full SHA, HEAD och Range; fem privata käll-/layoutadresser nekade.
  Inga JS-fel/HTTP 500, inga projektändringar eller betalda provideranrop.
  HEAD-storleksprov använder identity eftersom Vercels Brotli-svar saknar Content-Length.
- På riktig scoutgaming.tech: befintlig BO-login, Lab SSR/projektrevision,
  privata Blob-bytes och hash, nekad anonym administration och oförändrat projekt.
- Native 4/4, frontend 26/26, Next-produktionsbygge, installerad Node-byggare,
  TypeScript, obligatorisk full hook och fyrdealerprobe godkända.
  Samtliga tre GitHub CI-jobb på 22dca5c4 är gröna.

## Backoffice/Lab och media

Före: separat BO-navigation och klippval, Studio-projekt samt privata Lissabon-profiler.
Efter: gemensam meny med Studio, klippbibliotek, Event, zoner, OpenClaw,
uppspelningsspår och befintlig BO-administration (14 sektioner).
BO:s rollkontroller finns kvar; Lab ger inga extra administratörsrättigheter.

Originalmotorerna läser legacyClipPolicy; Astrids presentation=local läser
mediaPolicy/idlePolicy. Allt redigeras och versionssparas i samma Lab-projekt.
Äldre BO-tilldelningar är bevarade men inaktiva/skrivskyddade (skrivendpoint 410).
Import kräver uttrycklig exakt match i dealer, situation, destination och fil.
Observation följer en faktisk spelflik och startar ingen andra uppspelning.
Registrerat, valt eller nedladdat betyder aldrig spelat utan spelarens kvitto.
Partner-SSE och genererat tal visas separat. Återanslutning återspelar ingen gammal kö.

Hela lissabon/ är borttagen. 39 privata datafiler (4 568 960 byte) flyttades
utan överskrivning till lab/data; 42 originalfiler har hashverifierad extern backup.
Startare och sessionsvakt återskapar inte Lissabon; äldre länkar är kompatibilitetsalias.
Se ENVIRONMENT-RESTORATION.md för backup och återställning.

Media ligger i media/dealers/<dealer>/{runtime,source,review,staging} samt
media/game och media/site. 4 924 filer/2 911 452 931 byte verifierades före källradering.
ID, bytes, kalibrering, Emil/Kevin-proveniens och explicita URL-kopplingar bevaras.
Blob: 4 265 filer/2 907 216 339 byte, 4 162 unika objekt, verifierad återläsningshash.
Saknad/felaktig aktiv källa ger 503 utan diskfallback. Äldre Blob-objekt bevaras.
Runtime är en användning, inte ett visuellt godkännande.

## Städning

main är enda lokal/GitHub-branch i Jakeminator123/github-work; gammal ren worktree borttagen.
GitLab är pausat. docs har minskats från 99 till exakt fem Markdown-filer.
Obsoleta random-stuff-jakob, GitLab-wikihelper, ändringslogg och tomma mappar är rensade.
test och pipeline används av CI/mediebygge och behålls. Värdefullt reference/content/Emil-material
är flyttat till media med oförändrade bytes. Personarkivets läsgräns gäller.
Ignorefiler utesluter beroenden, byggcache, binär media och privat data från sökning/index.

Tidigare QA-städning tog bort sitt testkonto/lösenordsfil. Den nya separata native-QA
är nu LIVE med sin syntetiska operatör och länkade spelare; den är inte suspenderad.
Databas, media, backuper och förbrukningsjournaler bevaras. Oanvända provider-/integrationsnycklar
rensades från Vercels frontend; nödvändiga backend-, databas- och lagringsnycklar behålls.
Inga lokala produkt-/labbservrar eller egna QA-browserprocesser lämnas igång.

Nästa P8-radering är villkorad av verifierat P7-källbyte: `BackofficePanel`/CSS,
iframe-/legacy-navigationshelpers och ersatta BO-HTML/skrivare ska bort.
Native-UI använder fortfarande Backoffice-gruppkonstanterna; spelmotorn använder
`/api/bo/config` som Neon-projektion och Render äger auth/handoff/spelkommandon.
`StudioPage`/`Studio` har sex aktiva routes och får inte raderas som helhet.
Diskens projekt/historik/index/bo.json och gamla talpaket kan avvecklas först när
exakt Neon/Blob-motsvarighet, journalparitet och restart utan diskfallback är bevisade.
Konkreta käll-/env-/diskmål finns i [P8](CLOUD-MIGRATION.md#checklista-och-beroenden).
Aktiva `test/fixtures`, `tools/`, `web/`, `pipeline/`, medier/kalibreringar,
konton/saldo, kostnadsjournaler och Director/Gateway/OpenClaw-state behålls.
De större legacy-/diskmålen kan inte raderas före detta byte; den avgränsade
frontend-, dokumentations- och cachestädningen redovisas överst.

## Kända öppna kvalitetsfrågor

- Exakt läppsynk, lång GPU-kallstart, riktig mikrofon-till-svar och fysisk mobil/Safari
  är ännu inte slutgodkända. Hashar, transportprov och bildframsteg ersätter inte mänsklig granskning.
- Startsidesdarr/flimmer är undersökt men inte ändrat; perspektivgolv/parallax/kortjolt
  är möjliga orsaker. Datorintrot är live och rensar overlay/videonoder efter avslut;
  mobil/surfplatta laddar inte introfilmer.
- Råfilmernas kortkontakt är inte kalibrerad; calibratedContact kan vara false.
  Publik lösenordsåterställning och full zonlagringsacceptans återstår.
- Full extern diskbackup för Studio/Director/Gateway återstår. Diskarna är bevarade;
  game/auth-databasens externa backup och återläsning är verifierade.

Senaste riktiga röstprov 1 oktober: två svar utan 404/Voice off, färgfix och två
CANCELLED-sessioner verifierade. Total/ första bild: 104,803/99,917 s och 14,187/7,723 s.
Det bevisar inte exakt fonemsynk. Privata inspelningar i Downloads:

| Fil | SHA-256 |
| --- | --- |
| astrid-qa-turn-1 (2).webm | 2c12ff37bdc4491e1944e000e00de498cab6f3a8e29250ea6b96d2b2d7bd5987 |
| astrid-qa-turn-2 (1).webm | b091dff159deab06e17e89548840077043473f890e77e6dc0de1882e7e7a69f1 |

Budgetjournaler bevarade: USD 3,00 reserverat (ingen uppmätt faktura), dygnstak 9,94,
sessionsreserv 0,50, worker min 0/max 1. Ingen ny automatisk betald provkampanj startad.

Uppmätt lokal tröghet: cirka 46 GiB ledigt RAM, CPU 0–14 %, ingen diskkö;
Git-status 84–124 ms. Långa modell-/browser-/molnbyggen dominerade väntan.
Docs har nu snabba hooks; kod/media kör full regression. Rensningen minskar sökbrus
men bevisar inte att Codex har en bakgrundsindexerare. OpenClaw får begränsad publik
spelar-/samtalskontext och ingen direkt saldoåtkomst.
