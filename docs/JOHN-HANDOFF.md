# Aktuell handoff — Croupier

Uppdaterad 6 oktober 2026. Detta är den enda löpande John-handofffilen.
Nuläge och kvarvarande krav står nedan; äldre checkpoints är inte aktuella instruktioner.
Detaljhistoriken finns oförändrad i Git-snapshot
[`91d0c4d9edcf27bd4fd5c76524185fa92e0551b9`](https://github.com/Jakeminator123/github-work/blob/91d0c4d9edcf27bd4fd5c76524185fa92e0551b9/docs/JOHN-HANDOFF.md).
Ingen ny arkiv-/rapportmapp skapas och privata kvitton flyttas inte.

### Tre personal-/spelarytor och Kevins frontend — 6 oktober 2026

Jakob har godkänt nivå 1 `/control`, nivå 2 `/partner` och nivå 3 `/play` på
scoutgaming.tech. Nivå 1 är intern personal, nivå 2 operatörens egna team/spelare,
nivå 3 spelarens egen lobby/profil. Detta arbete genomför första etappens
överföring av backofficegränssnittet med intern admininloggning. Riktig separat
partner-session, organisationsmedlemskap, teamadministration och lobby är fortsatt
öppna i T2–T4 i den enda migrationschecklistan.

Källan är GitLab-head `7dee0901c75b7470c16a178079d5a5ebe4f11b9f`, branch
`codex/john-final-backoffice`. ImpactPL:s identitet är inte bekräftad som Kevin.
13 redigerbara JSX-delar, avgränsad CSS och 11 referensbilder är porterade till
`lab/components/kevin-bo/`; originalets globala bootstrap/loader, extra React-root
och egna backend följer inte med. Partnern har 17 destinationer; arkiv, äldre rum,
röst-/dealklipp, media, Action tree och Generations är interna. Alla 24 ursprungliga
destinationer representeras; interna verktyg länkar till befintliga Studio-funktioner.

Preview-API och SSR återanvänder färsk native admin-auktorisering. Endast två
separerade exempeloperatörer visas, inga riktiga spelare/saldon eller livefallbacks.
GET är enda API-metoden. Klienten tömmer vy/utkast vid fel, operatörs- eller
administratörsbyte och avvisar sena svar. Lokala designutkast ändrar inget i spelet.
Ingen DB-migration, kontoändring, mediepublicering eller leverantörskoppling ingår.
Routingen bevarar `/studio`, `/bo`, `/blackjack` och launch-kontrakten.
Lokalt verifierat: alla 24 destinationer öppnade i webbläsare utan visningsfel,
17 partnerdestinationer och sju interna. Operatörsbyte följt av omladdning behåller
rätt team; lokala designutkast syns i bordets förhandsvisning. Administratörsbyte
och 401 stänger visningen och tömmer gamla utkast. Detta är ett isolerat fixtureprov,
inte ett riktigt partnerkonto eller godkännande av nya produktionsinloggningar.
24 riktade integrations-/SSR-/isoleringstester samt båda produktionsbyggena passerar.
Kodrevision `968ae40ae565494f22aab170298c91140e6dcdd5` klarade full pre-commit:
1 597 PASS, nio befintliga skip, noll fel. Nya sidors sanerade byggmanifest
innehåller nödvändig Studio-SQL men inga privata data eller `random/`-anteckningar.
Privata bygg- och testloggar finns i `lab/data/platform-private/partner-preview-qa/`.
Första publiceringen `8ff74882` klarade SSR och oinloggat skydd (307 till login,
preview-API 401), men webbläsarens klientstart avslöjade HTTP 400 för Nexts
procentkodade `[[...path]]`-chunk. En snäv routingregel tillåter nu endast de två
nya ytornas hashade JavaScript-filer; kodade API-/dokumentsökvägar nekas fortsatt.
Åtta riktade routingtester passerar. Publicerad klientstart måste provas igen
efter denna rättning; enbart SSR-svar är inte tillräcklig acceptans.
GitHub-körning `37436893516` på föregående `184fe66b` stoppades före alla teststeg:
samtliga tre jobb saknar steg och anger betalnings-/Actionsgräns. Det är en
extern CI-täckningslucka, inte ett observerat testfel. Kontogränsen ändrades inte.
GitGuardian före leverans: suite queued utan check-runs. Separat repoansluten
läsning bekräftar 12 TRIGGERED och fem IGNORED; full incidenttäckning för källan,
partiell fil-/radtäckning. Inga incidenter ändrades.

### Samordnad Resend-leverans — 6 oktober 2026

Den parallella Resend-agenten har konfigurerat produktionsmail med befintlig
domänbegränsad sändnyckel och `no-reply@scoutgaming.tech`. Fryst `184fe66b`
är READY på `dpl_G7tZPZ5QAPTdppLhHuGgkpPWwnxh`, fortsatt `fra1`.
Invite/reset genom verklig native mail-adapter är Delivered till Resends sandbox;
login/set-password HTTP 200 och session utan login 401 är verifierade.
Extra oanvänd Marketplace-installation är borttagen; fungerande konto/domän/QA
är bevarade. Privat kvitto: `lab/data/platform-private/resend-setup-20261006.json`.
Ingen riktig kontoinvitation, token/aktivering, återställning eller inkorg har
provats i denna leverans. Checklistans F förblir därför öppen. Äldre notiser om
tom produktionsnyckel och saknad avsändare nedan är historiska och nu ersatta.

### Studio-region och latenstest — 6 oktober 2026

På Jakobs begäran är Studio/Backoffice-projektet `croupier-lab-ui` nu sparat
med Vercelregion `fra1` (Frankfurt), tidigare `iad1` (Virginia). Samma
produktkod `019dba6d14c0b8b9c9de900af572e916316649b3` publicerades som
`dpl_24S1idmMEHgzpPYqrwPPLf2P6YNk`; READY, produktion, samma Studio-adress.
Faktiska svar har `fra1` i `x-vercel-id`. Första Studio→Backoffice gav
7,879→3,041 s; varm overview 1,595→0,328 s. Runtime/API-väntan minskade
utan byte av Neon-plan, databasskrivning eller produktkod. Oinloggade
overview/shoes avvisades med 401; login/game-session GET var 200.
Detaljer och bevisgränser finns i öppna punkt B i driftkartan.
Första overview har ännu cirka 2,04 s utanför de två Server-Timing-faserna;
uppstart, proxy och fortsatt gruppnavigation behöver riktad mätning.
Inget nytt lösenordsloginprov, spelprov eller skrivprov ingick.

Vercelprojekten är två produktionsbyggen av samma GitHub-repo: frontend
bygger `apps/croupier-frontend`, Studio bygger `lab`. De två native-QA-
projekten är isolerade testfronter, inte extra produktionsrepon.
`croupier-studio` är ett tydligare namnförslag för `croupier-lab-ui`;
ingen namnändring, QA-radering eller konsolidering är genomförd.
Frontend ligger kvar i `iad1`; endast Studio-regionen ingick i provet.
GitGuardian på ursprunglig main: suite queued, inga synliga check-runs.
Repoansluten incidentläsning gav 13 TRIGGERED, full sourcetäckning men
partiell file/line-täckning; dessa befintliga säkerhetsärenden kvarstår.

### Kort notis inför datorbyte — 5 oktober 2026

Jakob fortsätter från en annan dator om några timmar. Före denna notis var
main ren och allt arbete pushat på `f89c8a55f3c9fe5b684650aef8cd307128f7aafd`.
Funktionsleveransen `e49f6f36` har tre godkända CI-jobb, 1 569 lokala PASS/
9 befintliga skip och systemkarta med 22 gröna/2 okända delar. Liveprovet på
`34f64e34` verifierar sju dataanrop och menybyte under laddning; väntetoppar kvar.

Fortsätt genom att hämta aktuell GitHub main och läsa `AGENTS.md`, denna handoff
och den öppna checklistan i `CLOUD-MIGRATION.md`. Nästa hinder är GitHub Actions
(start nekas med hänvisning till betalning eller Actionsgräns) och produktionsmail
(Resendåtkomst, giltig sändnyckel och verifierad avsändare behövs). Gmail kan vara
mottagare men inte Resendavsändare. `john.g` är ett spelarkonto; ny adminåtkomst
behöver rätt administratörsflöde och utsedd mottagare. Tolv GitGuardianfynd,
serverväntan, särskilda persistenceprov och manuell media-/enhetsacceptans är öppna.

Privata kvitton i `lab/data/platform-private/`, nycklar och lokala anslutningar
följer inte med Git. Kontrollera åtkomsten på den nya datorn innan dessa behövs;
bevara dem på denna dator eller överför särskilt utpekade underlag privat.
Inga fortsatta writers, omprov eller mejlutskick ska startas under uppehållet.

Sista bildfyndet före datorbytet: Jakob kan ladda upp en film, men får inte in
den som exempelvis idle-variant. Bilden visar `kortflipp_kling_1080p.mp4`,
8,29 MB, status ”sparat och återläst”/ready och valt ”Idle · vänteläge”.
Knappen ”Välj hur klippet ska användas →” upplevs inte reagera. Under den
visas ”Vänteläge och reaktioner”, grundloop och 14 korta variationer med
sökfältet `kortf`. Detta är ett användarrapporterat fel, inte reproducerad
rotorsak. Börja nästa pass med ready-klippets väg till valbar idle-variant,
knappens navigation/fokus och påverkan av sökfilter. Klart först när en
isolerad upload kan hittas, tilldelas, sparas och återläsas efter omladdning.
Ingen aktivering eller ändring av Jakobs film/produktionsmedia är utförd.

## Börja här vid övertagande

Arbeta i `C:/Users/jakem/Projects/croupier`, på main i `Jakeminator123/github-work`.
Läs `AGENTS.md`, `agent-talk/README.md` och
[masterplanens aktuella checklista](CLOUD-MIGRATION.md#öppen-arbetschecklista-en-sammanhängande-studio).
Läs [återställningsreglerna](ENVIRONMENT-RESTORATION.md) före spel-/mediaändring.
Kontrollera Node/engines/pins; senast använd Node är 22.22.2, Lab kräver >=22.16.0.
Använd den absoluta agent-talk-tavlan i huvudcheckouten; claim före edits.
Den aktuella huvudagenten integrerar och pushar via `tools/push-github-work.mjs`.
MERGE har lämnat över och fortsätter inga ändringar eller integrationer.
Jakobs särskilda migrationsmandat tillät egna taskbrancher/worktrees;
det är inte en generell instruktion att skapa fler. GitLab/Jira/CAC är pensionerade.

Uppdatera de fem befintliga docs och labbguiden, inte nya sprint-/statusrapporter.
Starta inga lokala servrar om start inte är begärd. Ett koordinerat produkt-/labbpar,
`--no-open` från Codex, samma spel-/Studioflik och bevarade utkast/spel gäller.
Stoppade servrar förblir stoppade. Ordinarie sökningar följer `.ignore`.
Det pensionerade privata personarkivet får inte läsas via sökning, Git eller backup.

### Aktivt fortsatt arbete efter överlämningen

Jakob har bett huvudagenten att samla tidigare Lab och Backoffice i /studio,
förbättra långsam navigation och arbeta med parallella underagenter. Den enda
[öppna checklistan](CLOUD-MIGRATION.md#öppen-arbetschecklista-en-sammanhängande-studio)
finns i befintlig masterplan. MERGE fortsätter inga ändringar eller integrationer.

Senare dokumentcommit04baf35438498607b004e639a37d5f48cde3b7f5 fick
CI37309484604 completed/failure före första steg i alla tre jobb. GitHub
anger misslyckad betalning eller Actionsgräns; meddelandet särskiljer inte
orsakerna. Detta är ett start-/kontohinder, inget utfört regressionstest.
Kontoägaren behöver kontrollera Billing and usage. Inga betalningar/budgetar
ändras och inget blint omprov körs. Funktionsleveransen nedan har fortsatt
verifierad CI; senare dokument-SHA får inget nytt PASS utan faktiskt omprov.

Senaste funktions-/CIleverans är e49f6f36a9500761a0d65fe11c34b8777a45e369,
pushad på main. CI37308717362 har alla tre jobb success. Fullhook: 1 569 PASS,
9 befintliga skip, 0 fel/cancel; privat studio-map-reporter-commit-20261005.log.
Båda Vercel production READY exakt SHA: Studio dpl_8eAosJB21Xhs4qgkYrSFMFXia5vX
och frontend dpl_DFHjLNwRsP5MkrQQ6fQAh49CsccE. Båda region iad1, DBregion
inte belagd. Sedan UIversion34 har bara provkvitton och dokument ändrats.

Privat export system-map-e49f6f36-ci37308717362/: source/currentSha exakte49,
observedAt 2026-10-05T12:22:56.667Z, 22 green/0 red/2 grey, errors[]. Faktisk
SQLentry passed1/failed0/skipped0 (12:22:56.570Z); SQLkontrakt GREEN.
Event-tree14PASS, zone-cloud-store14PASS, shoe1filPASS med197internaassertions;
routes.studio, game.events och schema.croupier_zones är GREEN. Befintliga shoe-
och zone-prov går nu genom fullhookens reporter före export; shoe dubbelkörs
inte. Inga assertions, testmotorer eller persistencekrav ändrade. Två kontrakt,
schema.croupier_game/auth, behåller GREY: postgres-persistence har3PASS/1SKIP,
och dess riktiga concurrency/persistenceprov kräver isolerad croupier_game_qa.
Det provet kördes inte; separat Studio-SQL-PASS ersätter det inte.

UIleverans34f64e344d4885171f8a5f7e10c7644b33a6c96d har CI37307380711 med tre
successjobb, faktisk SQL PASS och fullhook1554PASS/9skip/0fel. Privat
studio-bo-navigation-commit-20261005.log och system-map-34f64e34-ci37307380711/
(20green/0red/4grey, exaktSHA/datum) bevaras. Nuvarande e49 har byteidentiska
produkt-/UIkällor, men livemätningen nedan är uttryckligen fryst på34.

Live34: 7 dataGET200/0 sessionGET/0 POST, fyra jämförelsebyten full/drained/
untruncated. Drift 1,472s/Bord 5,544s/Drift igen 4,709s/Konton 1,181s.
Spikar kvar: config runtime2634,84ms/API889,48ms/cirka2019,68ms utanför
instrumenteringen; shoes runtime3700,51ms/API663,38ms/cirka345,11ms utanför.
Separat snabbnav: byte Bord→Drift under busy och aktiverad meny, gammalt
configGET avbröts och därefter rätt Driftsektioner utan fel. Sena svar som
ignorerar abort producerades inte live; de är separat lokalt provade.
Snabbnav/återställning hade fem GET (fyra200, ett avbrutet), inga POST.
Konton/john.g-formulär/fokus återställda med noll ändrade fält och CDP av.
Privat wx-kvitto bo-navigation-after-34f64e34-20261005.json är parsevaliderat.
Anropsminskning och menybyte är bevisade; ingen generell latensgaranti.

Föregående cd9f5b21/CI37305177411 hade tre successjobb och faktiskt SQL PASS,
fullhook 1 533 PASS/9 skip. Kvitto studio-auth-timing-commit-20261005.log och
system-map-cd9f5b21-ci37305177411/ (19 green/0 red/5 grey, rätt SHA/datum)
bevaras. Region-/DBavstånd har inte utretts eller ändrats.

john.g skapades av inloggade Jakob i Backoffice och är ett aktivt spelarkonto.
Ingen synlig Studio-användare med samma namn. Headerns Administratör gäller
Jakob. KontoUI skiljer spelarkonto från separat e-postaktiverad admininbjudan;
john.g är inte promotat eller ändrat. Resendnyckeln är tom i produktion och
avsändare saknas; integrationen är endast QA-kopplad. Jakob avsåg Gmail som
avsändare, inte mottagare. Resend behöver verifierad ägd domän, exempelvis
no-reply@scoutgaming.tech. Befintlig admin bjuder in ny admin; inget separat
mejlgodkännande av superadmin finns. Inloggad Resendåtkomst och utsedd ny
provmottagare saknas. Historisk QA-invitation/nyckel ger inget nytt mandat.
Inga mejl, konto-/env-/providerändringar eller nyckelkopior har gjorts.

BO föreprov 3e613186: 7,468/4,944/4,859/10,018s för fyra gruppbyten; 18 GET.
Efter cb8e5254: 11 GET200, 2,553/4,834/6,653/2,682s. Senaste liveprov cd9:
9,361/2,112/2,088/1,426s, 11 GET200, full/drained/untruncated. Första sessions-
anropets 3,724s innehöll runtime 3037,40ms/auth 375,92ms. Shoes 5,635s innehöll
runtime 2759,07ms/API 676,63ms och cirka 2199ms utanför instrumenterade faser.
Senare runtime 0,05–0,07ms. Ingen generell snabbhetsgaranti eller full förklaring
av nätverksresten. Privata kvitton: bo-navigation-baseline-3e613186-20261005.json,
bo-navigation-after-{ba0cb7ee,cb8e5254,cd9f5b21}-20261005.json. Konton/john.g-
formulär och fokus återställda med noll ändrade fält, CDP av och inga POST.

Publicerad auth använder två färska SELECT/fyra frågeanrop/ett borrow-release,
utan credentialcache. Signer/session först och users LEFT JOIN bo_auth_epochs
bevarar roll/stamp/epoch/collisionkontroller samt mutationslås. 118 riktade PASS;
fyra kritiska fixturefiler har tidigare assertions oförändrade. Numerisk
Server-Timing skiljer runtime från API/auth: 18 riktade PASS och typecheck PASS,
ingen extra SQL. Nu färdig tvåfilers UIrättning: gruppens dataGET startar
parallellt och alla status/actorheaders/roller kontrolleras innan bodyläsning.
Inga inledande sessionGET eller gamla actorfallbacks. 501/503 blir resursfel
endast med gemensam färsk 2xxactor och användbar payload; annars spärras hela
vyn. Engångsresultat vid omläsning binds till POSTactor.

Menybyte tillåts under GET; skrivlås gäller hela POST inklusive omläsning.
Accepterat utkastbyte invaliderar sekvensen och aborterar gamla läsningar före
Reactvybytet. Nekad bekräftelse bevarar utkast/revision/unload. Sena svar som
ignorerar abort får inte hydrera, ge fel eller ändra den nya vyns busy. Legacy,
POSTpreflight, CAS, Origin och självskydd kvar. 101 riktade PASS utan skip,
typecheck/diff PASS och oberoende review PASS med egen 46-tests-körning.
Fyra native gruppbyten kräver 7 dataGET/0 sessionGET i real-auth fixture;
legacy behåller 18 GET. Fullhook/CI/produktionens omprov på34 är godkända
enligt ovan; återstående väntespikar håller checklistans punkt B öppen.

OpenClaws modellvy /studio/openclaw och operatörschatt /studio/operator-chat
har entydiga rutter/direktlänkar/reload; fem modellval bevaras. Login bevarar
exakt tillåten målroute och BOhandoff/utkastskydd. Native/Neon visar otillgänglig-
info för äldre fristående röstprov: noll kontroller/alerts/röstGET/POST/API503
i live cb8/reload. Serverns spärrar kvar, lokalt explicit röstprov kvar.
Fyra voicekomponentprov inklusive återaktivering ingår fullhook. Fysisk/mobile
och mänsklig media-/helhetsacceptans kvarstår separat.

Privata SQLkvitton: p6-system-map-20261005-huvudagent-{1..8}.jsonl och .log.
1 FAIL saknad gameDb, 2 FAIL osäker providersubmission; båda bevaras.
3–8 PASS: 17 äldre/25 aktuella checks/fyra retained-bank-kontroller,
verklig SQL/HTTPS/omstart/reset/revoke/fakeprovider/cleanup. 7–8 med CI=true
och explicit TAP. 8 har stabila arbetsbytes före cd9, inget rent cb8-bevis.
Inga /tmp/croupier-studio-qa-* kluster kvar. MERGEs p6-check-20261005 bevaras.

CI37300874695 på ba0cb7ee FAIL före DBstart: värdens PGDG-libpq saknade
paketkälla. Taskägd tom dpkgstatus rättar detta utan installation/sudo/
värdstatusändring. CI37303118034 på cb8e5254 FAIL efter DBstart:
retained_contract_checks_missing då Node24.21.0 defaultreporter avvek från
lokala Node22.22.x. Explicit TAP rättar. Båda röda exaktSHA-exporter/loggar
bevaras: system-map-ba0cb7ee-ci37300874695/, system-map-cb8e5254-ci37303118034/
och studio-ci-{37300874695,37303118034}-failed.log. Äldre fullhookloggar
studio-integration-commit-20261005.log, studio-input-binding-commit-20261005.log
(1 507 PASS/9 skip) och studio-bo-voice-commit-20261005.log (1 520 PASS/9 skip) kvar.

GG 12:20:02UTC: workspace795524/source30689542 verifierad före komplett lista,
1 incident-/17 locationsidor, 12 TRIGGERED/5 IGNORED. Sex positionerade öppna
fynd har sju källhashpositioner som matchar exakt e49: 37867511, 37879730/31/32,
37880359/60. De två sistnämnda är nya. Äldre 37867512/37879729 saknar nu
position och källfilerna ändrades; cb8-klassningen är fryst. Även 37862641/
37863164/65/66 saknar position. Totalt nio positionsluckor, sex öppna.
37862641 är oklassificerad. Alla tolv fortsatt öppna; ingen ignore/resolve/
credentialändring. GitHubcoverage komplett men GG queued/missingrun;
incidentfrihet är inte belagd. Incidenttabellen längre ned är historisk.

### Läsutredda drift- och backuprester — fortfarande öppna

Frame-varningen i `web/public/local-film-player.mjs:17` använder samma text
för saknad playing/presented/ended. Historiska goodluckprov är inte belägg
för ursprungligt idlefel. Behåll rVFC-spärren; nästa diagnos kräver terminal-
flaggor, readyState/currentTime/duration/visibility och exakt media-ID/SHA.
Zoner är editorlagring (lokala utkast+molnkoordinater+privataBlobklipp), inte
spelstyrning. Befintlig CAS/dimension/hash/Range/partialuploadkontroll saknar
full isolerad zonroundtrip/restartacceptans. Tidigare 88medieURLprov inkluderar
inte reference-poster. Startsideskoden byter SSRhero till annan layout och
asynkront intro; möjlig flimmermekanism kräver bildserie/layoutshift/laddnings-
tider inklusive mobile/reduced-motion före riktad fix.

Backupagenten återläste de uttryckligt angivna metadatafilerna utan bred
backup-/personarkivsökning. Extern produktbackupkvitto matchar dokumenterad
SHA256, 206filer/10mappar/125745905bytes och verifierade hash-/arkiv-/inventory-
flaggor. Gamebackupmanifest finns; tidigare32Postgrestabellers återläsning är
dokumentation, ingen ny DBkontroll. Privat OpenClawenhetsfil finns men är inte
fullbackup. Director `/data/catalog` och Gateway `/data/openclaw` saknar angivet
externt fullsnapshot/återläsningskvitto. Exportåtkomst har inte prövats. Kräv
faktiskt frysta/stoppade skrivare, fullsnapshot, externmanifest/hash och
SQLite integrity/FK/WAL enligt `ENVIRONMENT-RESTORATION.md:74`; maintenanceMode
eller quiesced-markör ensam bevisar inte writerdrain. Inga drift-/DB-/provider-
åtgärder, restore eller nya servertester gjordes i dessa läsutredningar.

## Återstående arbete i utförandeordning

Detta är den operativa överlämningen efter kontrollerna den 5 oktober, inte en
ny migration eller en ny masterplan. P0–P5/P7–P9 är levererade enligt sina
avgränsningar. **P6 (samlad slutprovning) och nedanstående restarbete är öppet.**
Tidigare 1 495 PASS eller tre gröna CI-jobb ersätter inte de återstående proven.
Isolerade punkt 1–2 är nu verifierade. Börja med första öppna punkt i checklistan.

| Ordning / status | Nästa konkreta arbete och berörda filer/ytor | Klart när |
| --- | --- | --- |
| 1. P6-testuppsättning — isolerad del PASS lokalt och i CI | `test/studio-cutover-integration.mjs` har `gameDb` i auth och kontofabrik samt aktuella admin/negativa rollprov. Reset/revoke, faktisk SQL och osäker-submission-spärr bevaras. Körning 3–8 passerade; 1–2 FAIL bevaras. Samma motor passerade faktiskt i CI37305177411 på cd9f5b21. | Den isolerade deluppgiften är klar på angiven version. Ny källa kräver nytt versionsbundet prov. Ingen riktig databas eller produktionsanvändare ändras; full P6 är separat punkt 5. |
| 2. Koppla provresultaten till kartan — verifierad FAIL och PASS | CI37308717362 på exakt e49f6f36 visar faktiskt SQL PASS, routing-/spel-/zonkontrakt GREEN och22green/0red/2grey. Båda äldre röda exporter och nya PASS med exakt SHA/datum bevaras. Shoe/zone går genom samma reporter utan dubbelkörning; inga tester försvagade. Två persistencekontrakt saknar fortfarande sitt riktiga isolerade prov. | Resultatkopplingen är klar på e49. Saknat/skippat prov blir aldrig grönt. Persistenceprov kräver isolerad croupier_game_qa; verkliga användardata används inte för test. Nedladdade filer är frysta ögonblicksbilder. |
| 3. Produktionsmail — konfiguration saknas | Vercel `croupier-lab-ui` är mål. `RESEND_API_KEY` är tom och `CROUPIER_STUDIO_MAIL_FROM` saknas. Befintlig Resend-integration/key/sender ligger på `croupier-native-studio-qa-abc92154cb15`; dess GET `/domains` gav401. Kontrollera befintligt konto, korrekt projektkoppling, giltig nyckel, avsändare `no-reply@scoutgaming.tech` och public origin enligt `lab/lib/studio-native-mail.mjs`. | Konfigurationen är återläst på faktisk produktionsdeployment och ett uttryckligt avgränsat invite/reset-prov är användbart hela vägen. Inga spontana mejl till befintliga användare, inga nycklar i chatten/Git; domänläsning401 bevisar inte ensam sändbehörigheten. Be Jakob om endast den uppgift/åtkomst som faktiskt saknas. |
| 4. GitGuardian — tolv öppna, sex öppna positionsluckor | Läs workspace795524/source30689542 via befintlig läsbrygga. Öppna ID: 37862641, 37863164/65/66, 37867511/12, 37879729/30/31/32, 37880359/60. Aktuell sexpositionerad källhashklassning gäller exakt cd9; äldre 37867512/37879729-klassning är fryst och deras positioner saknas nu. Incidenttabellen längre ned är historisk. | Varje fynd har aktuell belagd klassning och konkret hantering. Saknad position redovisas som lucka. Inga breda filundantag eller automatisk ignore/resolve; anslutningen är läsande. |
| 5. Återstående P6-medie-/driftacceptans — delbevis finns | Följ befintligt P6-avsnitt: fyra dealers/två faktiska plays, auth/revoke, privat media, AI/tal/fullfil/stream, cancel/terminal/journal/omstart samt naturligt provider-COMPLETED där det saknas. Mänsklig läppsynk/kortkontakt och fysisk mic/kamera/mobil/Safari hålls explicit åtskilda från maskinprov. | Varje återstående krav har aktuellt bevis eller ett exakt kvarstående hinder. Inga nya takeapprovals från enbart hash/stillbild; budget/journal läses före betalda prov, inga automatiska retries och QA AI/GPU förblir OFF om inte Jakob uttryckligen ändrar detta. |
| 6. Riktad Studio- och driftacceptans — menybyten rättade, väntespikar kvar | UI34 tillåter menybyte under GET och tar bort fyra seriella sessionGET.101riktadePASS/oberoende review/fullhook1554PASS/CI3PASS; faktiskt live7GET200/0session, avbruten gammal läsning och rätt vy utan fel. Initierings-/API-/nätverksväntan kvarstår. Separat: ursprunglig framevarning, zonroundtrip, startsidesflimmer och extern Director/Gateway-backup enligt återställningsreglerna. | Återstående serverväntan har belagd riktad rättning/omprov eller konkret hinder. Varje separat driftfel har motsvarande bevis. Båda tjänster har extern fullbackup och verifierad återläsning. |

Läsande utredning av punkt 3–4 och avgränsade UIarbeten kan göras parallellt
med tydliga filägare. Punkt 2 använder utfallet från punkt 1. Huvudagenten integrerar och
pushar; dela inte `.git` eller samma filer mellan samtidiga writers.
Ändra inte arkitektur, priser, miljöregister eller mediebaseline som sidospår.
Ytterligare kartdetaljer (Web-/gateway-rutter och live-schema/grants) finns i
`planes/02-systemkarta/PLAN.md`; det är fortsatt vidareutveckling, inte levererat
bara för att den interaktiva grundkartan finns.

### Historiskt startprov från MERGE — rättat i senare leveranser

Privat kvitto `lab/data/platform-private/p6-check-20261005.json` binder kontrollen
till `bc0f3d797153803446bfc1ce0e14e34497bd0489`. SQL/HTTPS-körningen stoppade
vid native Studio-login med503 i stället för200. Detta är det bevarade ursprungsfelet; rättade provutfall står i den aktiva
överlämningen ovan.
Logg: `p6-check-20261005.log` i samma privata katalog. Linux Node22.22.0/WSL,
eget tillfälligt Postgreskluster; klustret och temporära filer städades.
Repro: kör `node tools/studio-isolated-qa.mjs --download-postgres` från repot i
icke-root-Linux/WSL med kompatibel Node. Det hämtar paket till egen temporär
katalog, installerar ingen systemtjänst och använder inga molndatabaser.

Separat `node --test --test-concurrency=4 ops/cloud/test/shutdown.test.mjs
test/server-shutdown.mjs lab/test/studio-native-mail.test.mjs` gav14PASS/0skip
i Linux; logg `p6-shutdown-mail-20261005.log`. Autentiserad produktions-Studio
och fem OpenClaw-modellval laddades. Astrids befintliga goodluck-video nådde
ended/readyState4, 3,625s, 1080×1920, men var muted: ingen hörbar synkacceptans
och inget bevis för två nya spelkö-plays. Inga mejl, providerjobb eller driftändringar.

Privata kvitton, journaler, backup och skyddade anslutningar finns på denna dator
och följer inte med Git. En agent på annan dator måste först kontrollera att
nödvändigt underlag/åtkomst finns; återskapa inte saknade journaler eller nycklar.
DESIGN, GAMMAL och Hantera olika game lanes har avslutat sina leveranser;
de är integrerade och arbetsytorna arkiverade. Ingen ny arbetsagent är startad.
En äldre stash `65c68925` är bevarad som tidigare arbete och får inte blindraderas.

## Historiska verifierade leveranser

Senaste verifierade funktionsversion är `6ced437e`. Efterföljande slutöverlämning
uppdaterar dokumentationen och städar lokala arbetsytor, inte produktkod eller driftmiljö.
Senast återlästa driftversion är dokumentationscommit `bc0f3d79`, CI37256695695
tre jobb success, Render LIVE `dep-db1h0rmq1p3s73faduqg`, frontend READY
`dpl_5pBv5oyBsjs53euCsi8J5h4ePqVo` och Studio READY
`dpl_2TZXF1LKAFKsFcyHJd8a3Pbcbws2`. Tabellen nedan bevarar funktionspaketets kvitton.

| Yta | Verifierad version / kvitto |
| --- | --- |
| GitHub funktionsversion | `6ced437eb50637c0d8445c6d1d3c60348170c550`, pushad/remoteverifierad |
| CI | `37254441092`: tre jobb success; fullhook 1 495 PASS/9 befintliga skip/0 fel |
| Produkt-Render | LIVE `dep-db1ggutckfvc73dnp5q0`, finished `2026-10-05T02:18:51.251466Z`, samma SHA |
| Vercel frontend | READY `dpl_DWszpEvfBcN1V4T7GbCdEF9hkLme`, samma SHA |
| Vercel Studio | READY `dpl_AstvxoUUAA5HasMhiAYjaDuPqa8b`, samma SHA |
| Director | `ee0608044f7c78b80c4f46023cd67a7b391e17f0`, LIVE `dep-db1ek0navr4c73bi1log`; administrationskod oförändrad |
| Bevarad QA | samma `ee060804`: Render LIVE `dep-db1em4ad0e5s73fcv3f0`, frontend/Studio READY, 37 envvärden oförändrade, AI/GPU OFF |

QA:s Vercelkvitton: `dpl_8dp5dw8b38ubwLVCtJQT6mJvhDd1` och
`dpl_8fEjyiBqhGtx5ohPQKtkcmMvALGS`; alias-CAS/färsk GET och health200 PASS.
Genererat tal, streaming, tal-preview, cloud-tal, kamera, Lissabon-profiler och
native-admin är OFF; inga Cartesia-/RunPodnycklar finns i QA. Disk/SDK/data/journaler består.
QA behålls OFF; inga nycklar, provjobb eller QA-deployer ingår i detta slutpaket.

App/UI/medieläsarbytes till och med `6b9dad55` är oförändrade mot
`ebbbeb764aa9b42613596049887c178e5a9c1818`. De autentiserade UI- och media-
kvittona nedan gäller `ebbbeb76` och oförändrade bytes. Paketet nedan ändrar två UI-flöden.
P0–P5 och P7–P9 är verifierade enligt checklistan; **full P6 är fortfarande öppet**.
Tidigare 80/20 och ”0 % kvar” var grova/kategoriska migrationsbesked, inte helhetsacceptans.

### Samlad överlämning från alla arbetsagenter

| Arbete | Levererat och infört i main | Gräns / fortsatt ansvar |
| --- | --- | --- |
| AI/GPU och verklig spelström | AI→Cartesia→RunPod→spelad stream-END, beständiga journaler/reservationer; kontrollerad shutdown och cancellation | Full P6, naturligt live-COMPLETED och mänsklig takeacceptans är separata öppna krav; kostnad okänd |
| Produktionsdata | Fryst export, backup, verifierad konto-/spel-/Studio-/journalparitet och gemensam Neon-policy; privat Blob för medier | Ingen gammal SQLite-writer får återaktiveras efter nya Neon-skrivningar |
| Studio/OpenClaw | Gemensam inloggning/roller, native BO, upload/zonreferens, revisionsstyrd policy, fem modellval med autentiserad save/readback | Produktionsmail saknar fungerande konfiguration; fysisk mic/kamera är inte fullständigt accepterad |
| DESIGN | Kompakt dealer-/BO-yta, tydliga klippkontroller, mobil layout, färre onödiga meny-GET | Kvarvarande authlatens är inte rotorsaksbestämd; nya layouter är inte ny medieapproval |
| Hantera olika game lanes | Sparat serverägt lane-register/default, Mobile Phone Lane på `/blackjack`, create/remove, faktisk source/staging-/Blob-rensning och deduplicering; idle-textfix | Delade medier raderas separat efter referenskontroll; ny bank/renderer kräver implementation och acceptans |
| GAMMAL och tidigare städare | Ersatt BO/UI/API/diskfallback, produktdisk, gamla alias och verifierat oanvänt dokument-/mediematerial avvecklat | Aktiva register, råmedia/kalibrering, återställning och QA-journaler bevaras |
| Systemkarta och MERGE | En gemensam interaktiv HTML, käll-/SQL-/route-/envregister, versionsbundna CI-bevis och kontroller vid commit/push; samlad integration/driftverifiering | Källinventering och explicita prov är inte kontinuerlig liveövervakning eller fullständiga runtimebevis |

DESIGN, GAMMAL och Hantera olika game lanes har var för sig bekräftat 5 oktober
att inget färdigt arbete saknas i `6ced437e`. Inga ytterligare underagenter är aktiva.
Det finns inga öppna eller historiska PR:er i detta GitHub-repo vid avläsningen;
leveranserna har integrerats direkt på main enligt Jakobs beslut. Gamla taskbrancher
kan därför vara cherry-pickade eller ersatta trots att Git inte kallar dem mergade.

### QA, lane och produktion är olika saker

QA betyder den separata Croupier-testmiljön: Render `croupier-vercel-preview-qa`,
egna Vercel-testbyggen och separat Neon-scope/databas samt bevarad SDK/disk/journal.
Den är inte Kevin Lane och inte enbart ett OpenClaw-prov. OFF betyder att dess
genererade tal/streaming/preview/cloud-tal/kamera/Lissabonprofiler/native-admin
och gästläge är avstängda; Cartesia-/RunPodnycklar saknas där. Det ändrar inte
produktionens aktiva Mobile Phone Lane eller dess tal/GPU-funktioner.

En lane är ett sparat spel-/presentationsval. Remove ändrar den revisionerade
lane-konfigurationen; det tar inte bort Render/Vercel/Neon, SDK, journaler eller
delade mediefiler. Den gamla `original`/Kevin-definitionen är inte längre standard
i kodens register; äldre värden migreras till Mobile. En sparad extra lane kan tas
bort i Studio, men om den sista tas bort saknar nya spel en startbar lane.
Moln-QA behålls enligt Jakobs tidigare uttryckliga mandat och avvecklas inte som
bieffekt av lane-/lokalworktree-städning.

### Testernas roll när produkten förbättras

1 495 är antalet godkända automatiska testfall i senaste lokala fullhooken,
inte antalet nya tester i sista ändringen, funktioner eller betalda providerjobb.
Sviten omfattar bland annat spelregler, auth, samtidighet, lagring, återställning,
uppspelning och isolerade providerfel. Senaste UI-paketet ökade PASS från 1 491 till 1 495.
Antalet bevisar varken full användbarhet eller att varje test är väl avgränsat.

Tester av kontoskydd, serverägt saldo/kort, dataparitet, CAS och dubbeljobb skyddar
beteenden. Källtext-/strukturtester finns också och kan bli överkänsliga när intern
implementation eller avsiktlig UX ändras. Vid en godkänd förbättring ska berörda
krav, kod, test och kartregister ändras tillsammans. Återinför inte gammalt beteende
bara för att ett föråldrat test förväntar det; uppdatera eller ta bort det testet med
motivering. Gör inte heller en blind hashomskrivning för att dölja verklig drift.
Ingen bred testransonering eller ny testmotor ingår i denna överlämning.
Ren dokumentändring använder redan kort lokal hook (20 testfall); full CI består.

### Slutstädning och återställningsbar historik

Efter avläsning/backup finns enbart `C:/Users/jakem/Projects/croupier` på `main`
kvar i `git worktree list`; lokalt och på GitHub finns bara branch `main`.
Elva gamla migrationsbrancher och tre automatiska tillfälliga handoffbrancher
är borttagna. Huvudcheckoutens kod och privata data är bevarade.

De rena agentcheckouterna `18a4`, `f7f0`, `f5eb` flyttades via appens handoff till
huvudcheckouten och arkiverades sedan återställningsbart via `archive_worktree`.
Chattarnas historik finns kvar. De rena, ägarlösa resterna `0375`/`ccc8` från
misslyckad initiering hade inga ospårade/ignorerade filer, tillhörde exakt samma
Git-repo och låg på en ancestor till main; de togs bort utan force.

Privat verifierad backup före refstädning:
`C:/Users/jakem/CroupierBackups/repository-housekeeping-20261005/`.
`all-branches-before-cleanup.bundle` innehåller alla tolv dåvarande branchrefs,
inklusive main; `git bundle verify` och exakt refmatchning PASS, 2 812 925 324 byte.
SHA256 `eeaaeec8bb2f331a9a7ce17d5402a13e62c923dbac7559cf4477bd505896811c`.
`receipt.json` listar borttagna refs/commit-ID:n och orphan-worktrees.
DESIGN:s enda ignorerade statusfil bevarades separat i
`C:/Users/jakem/CroupierBackups/design-worktree-f7f0-20261005-043315/`.
Produktbackupen, privata QA-/rensningskvitton, `.env` och providerinställningar
har inte raderats eller flyttats. Produkt-/QA-driftsmiljöerna städas inte via Git.

### Avgränsat slutpaket: dokumentstädning och två UI-rättningar

Åtta referenskontrollerade gamla filer togs bort: fem under `docs/animation-events/`,
den daterade `docs/releases/dealer-v2-2026-09-20.manifest.json` och Polarlotto-PDF/text
om andra operatörer. De omfattade 1 143 070 byte och kan återfås ur Git `6b9dad55`.
Inga aktiva videofiler/pipelines tas bort. Två `docs/qa`-kvitton med kvarvarande
takeacceptans, `dealer-sync-baseline.json`, miljöregistret och systemkartan bevaras.
De tre övriga tekniska guiderna kortades till aktuella regler; gamla produktdisk-
återställningskommandon och ersatta QA-checkpoints togs bort. `.env`/providerinställningar
ändrades inte. Markdown/JSON är dokumentation och kontrollindata, inte processmiljö.

Backoffice slutar hämta oanvänd data: Drift behöver overview/shoes, Bord behöver config.
Session- och behörighetskontroll behålls vid varje läsning. En gammal Idle-feltext rensas
först när aktuell idlefilm faktiskt visar en bild; sena callbacks och nyare actionfel
skyddas. Detta löser den kvarliggande texten, inte den historiska frame-varningens orsak.
30 administrationsprov och sju riktade spelarprov, TypeScript och dealer-audit med
`--probe` passerar. Fullhook 1 495 PASS/9 skip/0 fel, CI3PASS och faktisk LIVE/READY
finns i `lab/data/platform-private/docs-cleanup-final-20261005.json`.
Färskt isolerat browserprov: Astrid Mobile, `goodluck` två gånger i följd, 2/2 completed,
video readyState4 och löpande media-tid; ingen idle-feltext. Den äldre SQLite-fixturen
injicerar inte den serverägda lane-bindningen och väljer därför Astrid även med annan
dealerquery. Övriga tre har inte fått ett nytt browsergodkännande här. Provfliken och
testservern är stängda, sessionsguard/listeners fria; ingen databas/provider i drift berördes.

## Studio, OpenClaw och systemkarta

### Aktiva Studioflöden

Tre huvuddelar: Dealer & klipp, Backoffice och OpenClaw. Dealerarbetsytorna använder
egna exakta register; Astrids policy kopieras inte till andra dealers.
Backoffice visar elva aktiva sektioner. Overifierade pitboss-/turneringsformulär och
två informationspaneler är borttagna ur menyn, inte ur API/schema/behörigheter/data.
Lane-/konto-/nyckelåtgärder och talgranskning är utfällbara; utkast/revisionsskydd består.

Idle-felet `studio_native_unavailable` kom från den avvecklade diskskanningen.
`archiveSource=emil-default` får inte initiera den. Cloud Studio läser banken med GET;
äldre POST `/videos/rescan` är en autentiserad färsk registerläsning utan import/mutation.
26 riktade UI/API/uploadprov PASS; ingen användarfilm skrevs över i driftprovet.

OpenClaw-fliken läser/sparar huvudmodell för fem befintliga agenter med Studio-
adminsession, signerad serveridentitet och native CAS. Fallbackordning bevaras;
versionskonflikt behåller utkast och save kräver faktiskt kvitto/readback.
Runtime-tokenet administrerar inte Gateway. OpenClaw 2026.9.5/protokoll 4 och
device-pairing gäller; auth/verktygs/providerinställningar exponeras inte i klienten.
Server-only production `OPENCLAWAPI_KEY` ligger i Vercel Studio;
Director använder `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY`. Privat återställningsfil:
`C:/Users/jakem/CroupierBackups/openclaw-studio-admin-device-20261005.json`.

No-op-save-rättningen i `ee060804` godtar hashfritt `noop:true` bara för konsekvent
oförändrad modell och tom changedPaths. Övriga kvitton kräver hash.
19 backend/transportprov PASS. Faktiskt save/readback PASS: `saved=true`,
oförändrad revision/alla fem modeller, `restartScheduled=false`, GET `applied=true`.
Ingen automatisk andra skrivning, omstart eller providerdispatch.
Privat `lab/data/platform-private/openclaw-admin-noop-receipt-20261005.json`.

### Verifierad layout och kontrollgränser

På `ebbbeb76`: autentiserad UI PASS vid 1486/1265 px och 390 px viewport:
Idle, tio deal-/sjutton replikkort med öppna inställningar, Probe/dealerbyte,
Backoffice-lane/kontodisclosures och fem OpenClaw-modeller. Ingen observerad
horisontell överrinning; Idle-listan 1 094→663 px, preview readyState4.
53 riktade prov/TypeScript/Nextbygge PASS före integration.
Privat `ui-final-pass-receipt.json` och bilder:
`C:/Users/jakem/.codex/visualizations/2026/10/04/01a108f1-324a-7c31-b5af-ad71943dada3/`.
Viewport återställd, utkast/flik bevarade; inga save/upload/delete/providerjobb i provet.

Tidigare `7d7814db0da0b5418a3965a8342d8a4c4db9b086` hade 77 riktade prov
och riktig Vercel-layout vid 1285/390 px. Standardpreview blackjack.mp4 gick
till slut, 4,5 s/readyState4/video.error=null. Det är klippgranskning, inte
full spel-/lane-acceptans. Den statiska offline-layoutbilden är återkallad som bevis.
Råfilsradering saknas i UI; avstängning ändrar policy och behåller råfil.
Separat faktisk upload/delete-/lane-acceptans får inte härledas ur layoutproven.

Menyfördröjning är delvis åtgärdad: oanvända GET tas bort i slutpaketet ovan.
Drift går från fyra till tre sessions-GET och tre till två administrations-GET;
Bord från tre till två respektive två till ett. Ingen authcache införs.
Kvarvarande enskilda auth/session-GET200 observerades historiskt
1,3–6,45 s, statiska anrop mest 0–15 ms. En äldre BO-laddning var cirka tio
sekunder med fyra sessions- och tre administrations-GET. Ingen isolerad rotorsak
eller aktuell totalmätning; inget bevis för freeplan-, Render- eller providerorsak.

### Systemkarta

[Fristående HTML](system-map/index.html) har klickbara rutor/pilar, tre grafvyer,
zoom/pan/filter och käll-/testdetaljer. JSON registrerar 23 kontrakt, 57 Nextfiler,
49 tabeller/299 kolumner, 49 PK/22 explicita FK. Faktiskt Gitträd binds med `--ref`.
Passiv fullhookreporter ger maskerade bevis utan omkörning. CI producerar HTML/status/
kvitto för exakt SHA, artifactretention 30 dagar. Konkreta katalogfel stoppar commit/push;
källdrift varnar. Grått/gult blir inte grönt utan relevanta aktuella prov.
Detta ändrar inte branch protection eller verifierar providers/databaser live.

Senaste kontrollerade CI-export `bc0f3d79`: 19 gröna, 0 röda/gula, 4 grå kontrakt, 0 errors/warnings.
Grått: saknat explicit reporterkvitto för game-events/zonprov respektive skippade
verkliga Postgresprov; inte bevis för produktionsparitet. Privat:
`lab/data/platform-private/ci-bc0f3d79-system-map-{status,evidence}.json`.
HTML: `C:/Users/jakem/Downloads/Croupier-systemkarta-bc0f3d79.html`.
Exporten är en fryst versionsbild, inte en sida som uppdateras av sig själv.
CI skapar en ny artifact per commit. Fyra grå kontrakt gäller game-events,
game/auth-Postgres och zonlagring. Web-/gateway-rutter är delvis grupperade;
hela den större framtidsidén i plan 02 är därför inte fullständigt genomförd.
23 riktade prov och oberoende läsgranskning utan konkreta fynd. Node24 cancellation-
fixturen är rättad med explicit abort/5 s yttre gräns; 23/23 PASS på Node22.22.2
och Node24.21.0 med dubbla CI-reportrar. Verkliga fel/timeouts förblir fel.
Syntetiska UI-prov PASS; automatiserat fil-URL-browserprov blockerades av policy,
inte genomfört. Inga alternativa omvägar eller nytt runtimebevis påstås.
Fortsatta faktakrav ligger i [plan 02](../planes/02-systemkarta/PLAN.md).

### Dokumentstädning

`91d0c4d9` tar bort tre ersatta Lab-dokument och redundant `Start-Lissabon.ps1`.
Giltiga take/preview/tillgänglighetsregler och dagens upload/save-knappar finns i
[guiden](../lab/docs/README.md#material-och-granskningsregler); schemaöversiktens länkar är lagade.
26 lokala länkar PASS. `Start-Lab.cmd`, `Start-Lissabon.cmd` och Start-Labb-paret består.
Checkpoint-historiken komprimerades i `6b9dad55`; senare docs-gallring och två
UI-rättningar levererades i `6ced437e`. Denna slutöverlämning ändrar inga appbytes.

## Lanes och faktisk medierensning

Mobile Phone Lane är sparat förval. Versionerade lane-definitioner har ID/namn/
renderer/dealer/mediesamling i `gameLanes`/`gameLane`. Saknat/äldre `original`
migreras vid läsning till Mobile; HTML binds till serverns val och gamla queryparametrar
kan inte återaktivera Kevin. `web/public/card-presentation` ersätter `kevin-cards`;
kortgrund, källproveniens och kalibrering består.

Admin create/remove är revisionsstyrda. Aktiv lane kräver ersättare eller `null`
för sista lane; då stoppas ny Blackjack-start tills lane läggs till. Nya porträttlanes
delar Astrids bank/policy. Ny renderer/mediebank behöver adapter/verifierad media;
fria URL:er nekas. Lane-borttagning raderar inte delade medier.
Separat lane-publicering, nya dealers/spel och granskad svarskatalog är inte därmed byggda.

| Utförd åtgärd | Exakt omfattning / slutbevis |
| --- | --- |
| Lokal source/staging-rensning | 2 410 binära filer, 2 133 120 568 byte; faktiska hashar/säkra paths kontrollerade |
| Motsvarande Blob-rensning | 2 313 objekt, 2 131 771 483 byte efter `8f265831` LIVE/READY; komplett paginerad efterlista |
| Lokal deduplicering | 64 byteidentiska kopior, 14 216 404 byte; kvar 2 450 fysiska filer/764 115 959 byte |
| Blob-deduplicering | 58 objekt, 12 787 392 byte efter produkt `ebbbeb76`/QA `ee060804` och exakt medieläsarekvivalens |
| Slutlista Blob | 1 800 objekt/769 901 848 byte; just målen saknas, alla andra gamla paths/storlekar oförändrade |
| Bevarade publika adresser | 88 GET200/fullhash/storlek PASS: 44 produktion + 44 QA; dessutom 62 huvudobjekt HEAD/full SHA PASS |

Alla 2 514 logiska poster/ID/hashar/URL/åtkomstgränser består. Layout v1:s
`canonicalPath` pekar direkt på registrerad huvudkopia med samma hash/storlek/ändelse.
Mobile-media, zonreferens, kortbild, runtime/kod/kalibrering, uploadfiler, GPU-resultat,
speechreferenser, journaler och övriga objekt består. Produktion/QA delar Blob;
deras Studio-dokument/historik/mediarecords/speechreferenser och produktzoner
lästes före radering. Ingen ny visuell approval och ingen omskriven Git-historik.

Privata underlag i `lab/data/lane-media-audit/`:
`blob-purge-receipt.json`, `blob-after-purge.json`, `kept-readback.json`,
`dedup-cloud-purge-receipt.json`, `dedup-blob-after.json`,
`dedup-http-verification.json`, plan och lokalkvitto.
35 dedup-prov, hela fysiska bankens hashar och fyra dealer-sync `--probe` PASS.
Lane/CRUD/kort/policy/startprov och TypeScript PASS; äldre fullhook 1 418 PASS/9 skip.
Kontrollens privata cachekopior är hashkontrollerat borttagna; receipts består.

## Produktionsimport, avveckling och återställning

P7 är utförd på b0bc efter fryst export, oberoende admission och faktisk ALL0-drain.
Underhåll `dep-db16rv0u01pc73d442p0` var LIVE/childless: inga barn/skrivare/providers.
RunPod var tillfälligt Max 0/Active 0/FlashBoot OFF och alla sex workerfält/båda jobbfält 0.
Efter import återställdes Max 1/Active 0/FlashBoot ON före provideraktivering.
Gemensam Neon-policy är aktiv; produktens tre tal-/streamflaggor ON, kamera ON.
QA är kvar OFF. Aktiveringen är inte en generell kostnads-/mänsklig acceptans.

Studio 001–004, tre dokument, talhistorik, 18 aktiva och sex retained-mediaposter
är importerade. Sex original (8 262 169 byte) återfanns i `365f283b` och
fullhashades privat; liknande filnamn/familj får aldrig automappas till nya bytes.
Production/version1 fullfilspolicy adopterades via ett additivt INSERT;
numeriska tak/historik/reservationer ändrades inte.
Paritet PASS: 32 skyddade konto-/speltabeller, elva kostnadstabeller och exakta
dokument/media. Alla 17 alias återlästes med historiska mål/domäninställningar/SSO bevarade.
Den avslutade importen körs inte om; nya läskvitton får inte skriva om originaltider.

P8:s slutkod `9ba2fd05`/CI `37222438373` tre success verifierade diskfri drift.
Produktdisk DELETE204/GET404/`service.disk` saknas; tolv äldre Blobalias borta,
gamla-lista0/ersättningar12 och noll gamla Neon-dokument-/historikreferenser.
Explicit restart200: faktisk ny process, 160 rätta källhashar, åtta avvecklade
runtimefiler, AI3/Neon ON/health200 och ingen `/var/data`/persistent produktmount.
TLS `verify-full` bevarades; 51 övriga produkt-envvärden kontrollerades oförändrade.
Parent-env var direkt oläsbar efter UID-byte (EACCES); barnprocess/källa och
stabila deploy-/envavläsningar ger bindningen, inte en påstådd direkt parentläsning.

Privat `C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`:
206 filer/10 mappar/125 745 905 källbyte; full inventering, oförändrad källmetadata,
arkivläsbarhet och remote/lokal/arkivhash PASS. Behåll backupen efter avveckling.
Befintliga privata P8-journal/kvitton: diskfri `6cf5030f…`, data/HTTP `4615366b…`,
postdelete `bf582b0b…`; fulla pinnar finns i snapshotens importförlopp.

| Verifierat privat kvitto | SHA256 |
| --- | --- |
| P7 admission | `77eccc3a1ca99bca328f2abec8e11d4d37ec62b3797a2a7b25aea1c616b751c1` |
| Cloudplan | `25fe34d42251b1f57de6ff0ae7505459c0448c6d0ba500646aa7281a9115c59d` |
| BEFORE | `0555b7988d5f686d4b918a966bd82d1865a9a83d22c805a076e6f46df648ccb2` |
| Importplan | `94a458599f0c77ca8aaf468feccf4cc7d5e1e050f2f31662be8740796cde7442` |
| Avslutad import | `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d` |
| Full diskbackup | `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9` |

Återställning är en samordnad återgång, aldrig en andra writer eller automatisk fallback.
Frys alla skrivare, bevara senaste Neon/ledger separat och verifiera rätt scope,
schema/checksummor, aktuell paritet, media och rollbackpunkt före operation.
Gamla SQLite-/diskbytes får inte aktiveras efter nya Neon-skrivningar utan datatillbakaföring.
Gamebackup: `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`
(24 källtabeller/102 rader; 32 Postgrestabeller med rad-/sekvensparitet).
Lissabonbackup: `C:/Users/jakem/CroupierBackups/lab-consolidation-20261002`;
lokal syskonstädning: `C:/Users/jakem/CroupierBackups/local-project-cleanup-20261004T210828Z`
(214 bevarade filer, två verifierade Gitbundlar, workercommits kvar).
Återställningsprocedurer: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
QA-, Director-/Gatewaydiskar är aktiva/bevarade, inte P8-mål; extern Director/
Gatewaybackup är fortfarande separat kvarvarande ansvar.

## P6: delbevis, numeriska skydd och kvarvarande acceptans

### Verifierade delbevis — inte full P6

Historiskt native90/90 på `190399386d93a02882d9b18a5ce5af53bb91fe23`:
alla fyra dealers, två avkodade/hörbara/avslutade plays, samma sparade Neonrevision,
CAS/utkast/privata medier/native administration utan iframe. Projekt/pit återställda
med identiska hashar; browser/route-drain städade; inga mejl/betalda anrop.
Privat `lab/data/platform-private/native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
SHA `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
Åtta layoutbildrutor godkänner inte läppsynk. Äldre FAIL-kvitton består.

På `e461ef073b63b2d1c937454bbfa31289774fcb8f`: 80/80 authkontroller över
68 HTTPS-anrop, 22/22 verkliga login-/städ-/källkontroller och 27 städgrupper PASS.
Admin når spel/Studio/BO, spelare nekas Studio, reader/staff-reset behåller game-only,
lösenord/epoch återkallar gamla sessioner, saldo/historik/paritet består.
Pending provider-cancellation är inte liveprovat av detta authprov.
Privat `p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/` och
`p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`
under `lab/data/platform-private/`; egna fixtures borttagna.
Greeting-rehearsal på e461 har matching clip/återaktiverade tvåspelskontroller,
men saknar explicit ended-räknare/nya hashbevis/ny mänsklig approval:
`p6-browser-evidence-e461ef07/receipt.json`.

Faktisk isolerad SQL/HTTPS/restart: 41 grupper, fyra retained-guards och 46
oförändrade källhashar PASS. Täcker CAS/rollback/token/epoch/roller, signerad
actor/scope, walletnonce utan dubbelkreditering, journalimport och kostnads-/QA-rollback,
review exakt talpar/revision/roll, privat media, lokal mailpreview och kortsekretess.
Fixturer/processer städade, inga riktiga konton/molndatabaser/mejl/betalda jobb.

Fullfil `generated-bd1123e6caec51e8a232036547b0f8fc` fick Director/SDK-svar,
Cartesia-ljud och färdigt RunPod-paket. Två game-queue/audio-ended härledda plays;
per-play synliga frame-/ownerobservationer hann inte sparas och är okända.
Privat `verify-final-qa/fullfile-two-play-derived-attestation-8712e00b.json`.
cc77-run `75eaf797-9342-4e2c-8995-f3c759fade75`: 6 562 941 streambyte,
synlig bild, hörbart ljud, faktisk spelkö-END/completed SQL-request och browsercleanup.
Efter END avlästes provider HTTP200 CANCELLED, terminal/released/lease0/uncertain0/OFF.
Det är avslutad speluppspelning enligt Jakobs krav, inte ett naturligt provider-
COMPLETED-kvitto. Exakt tid för providertransition saknas; b0bc:s naturliga COMPLETED
är bara lokalt testat. Sammansatt snäv P7-admission återanvänder dessa delbevis och
oförändrade godkända e461-playbackbytes; full P6 och nya take-approvals förblir öppna.

QA:s äldre närvarogap består: `player_probe_sessions` 17→15 på a0 och 19→18
vid 42→37-övergången. Övriga 31 kontotabeller matchar; 24h TTL är möjlig orsak,
men tidigare radmetadata saknas. Original FALSE/compose=false skrivs inte om.
Senare aktuella 10/10-bevarandekvitton gör inte dessa äldre jämförelser full-PASS.

### Budget och framtida prov

Exakta Cartesia-/counting-priser är backlog enligt Jakob. Avgränsade funktionstester
kan använda dokumenterat okänd USD/null och mätt usage inom ursprunglig numerisk
budget/reservation/dispatchauktoritet. Detta är inget nollpris, verifierad faktura,
extra testfönster eller generell produktionskostnadsapproval.
Upprepa ingen prisinventering utan nytt konto-/tariffunderlag; extern Cartesia-
nyckelägare saknar tillgänglig egen kontoinloggning. Privat `p6-cost-evidence-20261004.json`.

Originalkampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`, totaltak 10 USD inklusive
alla försök, budgetankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historiskt reservation 5,251152/oreserverat 4,748848 USD; inget refund/reset.
Jakob höjde testtaket från två till sex genereringar totalt, inte per omstart.
Senaste closed39: usage 4 generationer/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null,
head `8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Två av sex generationer var kvar; detta är inte ny färsk dispatchauktoritet.
Den gamla reservationspolicyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Återläs faktisk journal före nytt prov; förbrukat/pending/uncertain är aldrig ”nytt”.

Fullfilsadmission kräver explicit belopp/policy före TTS/GPU; stream/fullfil delar
UTC-dygnssumma. Originalets 12 min/krav 8 min kvar, klientdeadline 300 s och separat
RunPod-TTL 180 s får inte förlängas tyst. Utgångna fönster återöppnas inte.
Successor är append-only med föregående journalhash; inga automatiska retries,
budgetrefunds eller nytt providerjobb vid reconnect. Gamla FAIL/manifest/tider bevaras.
SDK-import/prepare-only/router404/WS-binary/deterministisk baseline är inte acceptans.

Nytt liveprov kräver aktuell källa/Gitblobs, immutable basimage, färska worker/router/
entry-manifest, faktisk SDK 7.12.1/readback och separata Render/Web-child/SDK-envbindningar.
Exakt serverägd session/runda/sparad Neonpolicy, request/job/mediahashar och ägargates
måste avse samma körning. Tre cookieägda kontroller före connect/play/efter END;
en produktspelare/WS/video genom posegrind/talkö, presenterade frames/hörbart ljud
och två verkliga playback-ACK. `decoded-product-game-queue`, faktisk integration/
laddad källa och cleanup/cancel/terminal/drain krävs; inga ersättningswrappers.
Full P6 omfattar också text/bild/STT, fullfil/stream, SQL/HTTPS/restart, auth/revoke
och verklig invitation/reset där de återstår. `fullP6Passed` får inte sättas true tidigt.

### Kända öppna kvalitetsfrågor

- Ny mänsklig läppsynk-/takeacceptans, råfilmernas kortkontakt
  (`calibratedContact` kan vara false), full P6 och naturligt live-provider-COMPLETED.
  Orsaken till idle-observationen `Film ended without a presented frame` är okänd;
  den kvarliggande feltexten efter fungerande idle är rättad separat ovan.
- Fysisk mikrofon/kamera, mobil/Safari och riktig mikrofon→svar. Kameraflaggan är
  ON i produktion; observation/transcription/vision gav200/enabled och ett syntetiskt
  translationsprov gav förväntat svar, kostnad okänd. Det är inte fysisk acceptans.
  Inspelning är OFF vid sidöppning; samtycke/behörighet krävs, bilder kräver Luna/Terra.
- Latens/kallstart: historisk varm stream ready 4,524/start 9,803/första bild 9,809/END 12,703 s;
  tidigare ready 52,3 s är möjlig kallstart, inte fastställd providerorsak.
  BO/sessionfördröjningen ovan är separat, utan rotorsaksbevis.
- Produktionsmail och full användbar invitation/reset. Ett enda godkänt QA-invite
  3 oktober 15:31:35 UTC gav emailSent/delivered men hamnade i Skräppost.
  QA-testkontot/tokens raderades före STOP; invitationen får inte användas.
  Ingen recreate/resend/nyinvite följer automatiskt. Resend Free/domänverifiering
  och QA-only sender/key-konfiguration är inte produktionsacceptans.
  Privata `mail-resend-qa-connect/` och `mail-resend-qa-cleanup-confirmed-result.json`;
  cleanup-SHA `1f3978ba4e58bab9e22e75e32fe8357911ba34c2b17b2e97809c6a9bbcabeb23`.
  Färsk Vercelläsning 5 oktober: produktions-Studio har tom `RESEND_API_KEY` och
  saknar `CROUPIER_STUDIO_MAIL_FROM`. QA:s befintliga nyckel gav HTTP401 vid GET
  `/domains` hos Resend. Det fastställer inte nyckelns rätt att skicka, men verifierar
  heller ingen produktionsavsändare. Ingen nyckel kopieras eller något mejl skickas.
  Nästa steg är en giltig Resend-anslutning för `no-reply@scoutgaming.tech`, därefter
  konfigurering/readback och ett uttryckligt beställt användbart invite-/resetprov.
- Historisk Next.js-byggvarning GHSA-vcvr-r3jv-pc5j noterades; ingen användarstyrd
  next/og-SVG-route hittades då. Aktuell beroende-/advisorystatus är inte omverifierad;
  ingen automatisk audit fix eller beroendeändring ingår här.
- Full zonlagringsacceptans, startsidesflimmer och extern Director/Gatewaybackup
  kvarstår där de inte täcks av avgränsade prov. Datorintro cleanup är verifierad;
  mobil/surfplatta laddar inte introvideor. GitGuardian har sex öppna incidenter och tre locationluckor.

## Funktionella regler som aldrig får komprimeras bort

Render äger kort/shoe/slump/wallet/rundor/resultat, sessionägarskap och cancellation.
Studio/Vercel sparar revisionsstyrd Neonpolicy, inte osparade utkast eller saldo.
En kandidat vid credentialresolver; collision/pending/fel lösenord ger generiskt
avslag utan fallback/klientroll. Admin får spel+Studio; superadmin är alias,
reader/staff är game-only. Playerlogin rensar gamla BO/Labcookies.
BO-audience/live roll/fingerprint/epoch och Origin/Host/JSON/CAS/audit består.
CRAIG-reset och native playerpasswordbyte behåller rätt identitet/saldo/historik;
Rendercancel kvitteras före OK. Självrollbyte/radering och sista-admin-race skyddas.
Engångstokens förbrukas atomiskt; hemliga partnerresultat är tillfälliga, inte listmetadata.

Alla fyra dealers delar spelaren. Tal är exakt text/audio/video/frame-index/
kalibrering/acceptans; ändrad audio-/videohash ogiltigförklarar visuell approval.
Ingen approximate-duration-match, gammal talvideo till ny text eller munoverlay.
Audit `pipeline/audit-dealer-sync.mjs --probe`, obligatoriska regressioner och
två rehearsalplays per dealer krävs för media/spelarändring, inte bara hashar.
Gamla BO-videopreviews är tysta historikklipp, inte lipsyncmaterial.
Observation följer faktisk spelflik utan andra playback; valt/laddat ≠ spelat.
Originalpolicy `legacyClipPolicy` och Astrid `mediaPolicy/idlePolicy` består;
gammal BO-tilldelning är read-only410 och import kräver explicit exakt match.
Privata chattar, secrets och signerade medielänkar hör inte hemma i publika logs/takes.
Neon/Blob-fel stänger med fel, aldrig diskfallback/fröprojekt/nollbudget.
Aktiva tools/test/fixtures/pipeline/web/media/kalibreringar/OpenClaw-state består.
Svarskatalog/automatiska spelararkiv är inte infört; kostnadsjournaler gallras inte.

GPU-shutdownrättningen börjar cleanup före gatewayväntan och signalerar båda barnen.
15 s naturligt provideravslut +15 s cancel +30 s journalmarginal, sedan högst 5 s HTTP
och 10 s lagring; barnets tvångsgräns 80 s/Render 90 s. Timeout lämnar återhämtningsbar
journal/reservation och felstatus, inte för tidigt släppt shared lease.
Isolerad Linuxkedja 4/4 och close 38/38 PASS, inklusive lease 0 före båda flushar/1 efter.
Zonbilden är registrerad privat PNG 1080×1920/1 628 428 byte,
SHA `eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`;
fel molnkälla ger 503 utan lokal fallback. Export 290×104 var pixelidentisk med befintlig zon.
OpenClawproxy tillåter endast avsedd toppnavigation till exakt /openclaw[/];
API/fetch/iframe/mutation/WS/Origin/Host/auth/pairing behåller separata kontroller.
Dessa prov ändrade ingen zonrevision, pairing, speldata eller betaldispatch.

## GitGuardian — historisk triage före senaste hashfynden

Aktuell återläsning med tio öppna och sju positionsluckor står i aktivt
fortsatt arbete ovan. Följande sexincidentkvitto och positioner är historiska.

Färsk läsning via befintlig MCP, återgiven av MERGE 5 oktober: avsedd workspace
795524/source 30689542/repo `Jakeminator123/github-work` verifierad.
Komplett incidentlista: en incidentsida/elva locationsidor, fem IGNORED och sex
TRIGGERED. Locationtäckning partial för 37828691/37830671/37862641.
Safe kvitto: `lab/data/platform-private/gitguardian-read-20261005.json`.
GitHub check-runs/suites/status på 6b9dad55 är komplett; GG-suite queued/inga runs.
Grön vanlig CI/queued/neutral/skipped är inte incidentfrihet.

| Öppna incident-ID:n | Lästa metadata, inte verifierat falsklarm |
| --- | --- |
| 37862641 | Filmetadata saknas |
| 37863164, 37863165, 37863166 | `ops/cloud/test/container-entry.test.mjs`, positioner 34/35/46/47/48/55 sammantaget |
| 37867511, 37867512 | `docs/system-map/contracts.json`, positioner 196/499; aktuell kod där är SHA256-indatahashar |

Scanner-match/secretvärden har inte lästs; inga incidenter resolve/ignored eller
skrivrättigheter skapades. Alla sex ska redovisas som öppna, inte automatiska fixtures.
Fil/rad-luckorna består även när hela incidentlistan är komplett. Direkt avläsning av
de tre locationsvaren gav HTTP200 med tom lista och ingen nästa sida, inte parserfel.

Historiskt efter Jakobs uttryckliga triageuppdrag 3–4 oktober: fem testcredentials
IGNORED/0 OPEN med en incidentsida/fem locationsidor. Dagens lista bekräftar dessa fem
IGNORED men också sex nya öppna; äldre 0 OPEN är inte nuläge.

| Historiskt IGNORED-ID | Verifierad fixtureplats |
| --- | --- |
| 37827237 | `lab/test/studio-native-{runtime,request}.test.mjs` |
| 37828386 | `ops/cloud/test/container-entry.test.mjs:30` |
| 37828691 | `ops/cloud/test/storage-export.test.mjs`; API-location saknades |
| 37830671 | `test/studio-cutover-integration.mjs`; två webbplatser, API-location saknades |
| 37840514 | `ops/cloud/test/native-p6-router-hook.test.mjs` |

Triagen märkte testcredentials, inte återkallade produktionsnycklar.
Färsk API-läsning 5 oktober bekräftade `ignore_reason=test_credential` för samtliga
fem ID:n ovan, utan att läsa/visa secretvärden eller ändra incidenter. Detta är
GitGuardians registrerade skäl, inte en ny fullständig verifiering av varje match.
Befintlig läsbrygga `tools/gitguardian-mcp.mjs`/`gitguardian-read.mjs` är GET/metadata/
repo-låst; årsnyckel endast incidents:read/sources:read, Windows-DPAPI utanför Git:
`C:/Users/jakem/.codex/private-connections/gitguardian-795524.dpapi`.
Privat `migration-root-gitguardian-mcp-verified-20261003.json` är historiskt kvitto.
Bind avsedd repo/workspace/source varje gång. Exponera bara app/name/status/conclusion,
numeriska incidentlänkar och repo-relativ fil/rad/tid, aldrig scannertext/secrets/
rå annotationsmeddelanden/tokens. Ingen ny scope/token/scan/write automatiskt.

## Kort tidslinje — historik, inte nya order

| Datum / källa | Bevarat resultat och avgränsning |
| --- | --- |
| 2 oktober, `22dca5c4` | Neon game/auth och privat Blob/transport infört; 14/14 inspelade plays, inte mänsklig syncapproval |
| 3 oktober, `190399` | native90/90 och SQL41/retained4; betald helhetsacceptans saknades |
| 3–4 oktober, `e461ef07` | gemensamma credentials/auth och SDK 7.12.1 installerat; specifika browser/readbackkvitton |
| 4 oktober, `5fca8983`→cc77→b0bc | fullfilsdelprov, misslyckade fönster append-only stängda, faktisk stream-END; kostnad okänd |
| 4 oktober, b0bc→`9ba2fd05` | samordnad import/policy/alias/provideraktivering, backup och fysisk P8 efter ALL0/paritet |
| 4–5 oktober, `3da83bf8`/`5270c8ab` | fysisk mic/kamera ej provad; route/kamera-config, shutdown/zon/OpenClaw-rättningar verifierade avgränsat |
| 5 oktober, `8f265831`→`ee060804`→`ebbbeb76` | Mobile/lane-register, source/staging/dedup, no-op-save, UI/karta; inga nya take-approvals |
| 5 oktober, `91d0c4d9` | sexfilsdokumentstädning/slutkvitton, CI3PASS och faktisk LIVE/READY; appbytes oförändrade |

Alla tidigare intentions-/FAIL-/cleanupkvitton, gamla deployment-ID:n, sourcepins,
budgetposter och privata röstinspelningars hashar kan följas i snapshoten ovan.
De är provenance, inte förnyad budget, runtimeidentitet eller order att läsa personarkivet.
