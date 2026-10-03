# Aktuell handoff — Croupier

Uppdaterad 3 oktober 2026. Detta är den enda löpande John-handofffilen.
Uppdatera de fem befintliga filerna i docs; skapa inga nya arbetsrapporter.

## Börja här vid övertagande

Arbeta i `C:\Users\jakem\Projects\croupier`, på `main` i
`Jakeminator123/github-work`. Följ `agent-talk/README.md`, claim före ändring,
och leverera med `node tools/push-github-work.mjs`. Ingen annan branch/worktree,
Jira eller GitLab. Läs även `ENVIRONMENT-RESTORATION.md` före spel-/medieändring.
Senaste verifierade QA är exakt `190399386d93a02882d9b18a5ce5af53bb91fe23`;
de tre deployment-ID:na och 90-kvittot står nedan. Läs `git log -1` och GitHub
main för slutlig källleverans: senare dokument-/testfixar gör inte automatiskt
den frysta QA-koden nyare. **80 % är en grov arbetsbedömning, inte acceptans.**

GitGuardian för `190399`: check-runs/check-suites/status är lästa, men ingen
GG-check-run finns och GG-suiten är queued. UI:s kända incident `37830671`
är fortfarande Triggered; root levererar en syntetisk-fixturrättning i
`test/studio-cutover-integration.mjs`. Varken fix eller grön vanlig CI bevisar
rensad incidentlista; läs slutlig SHA/status igen vid leverans enligt agent-talk.

Fortsätt i denna ordning:

1. **P6: koppla den verkliga egna QA-kedjan.** Core-hookar är opt-in och
   avstängda; det enda SDK-textsvaret bevisar inte installerad produkt-routing.
   Implementera faktisk Director-översättning av `/api/studio/advice`
   (`catalog,input`) med oförändrad rollprompt och samma begränsade stagebudget.
   Koppla egen SDK-worker/authority/router till faktisk serverägd session,
   färsk policy, signerad stage-ticket och readback av PID/source/nonce/env.
   Full Render-env och SDK-barnets verkliga env har separata hashbindningar.
   Använd inte shared OpenClaw som QA-runtime eller deterministisk baseline
   som Director-/providerbevis.
2. **Lös bara de konkreta återstående åtkomst-/kostnadsgapen.** Den senaste
   läsningen saknar counting-tariff/explicit gratisbevis, Cartesia-kontots
   USD/credit (`/usage/credits` gav 401) och RunPods avsedda endpoints faktiska
   GPU-/idle-/storage-/rabattgräns (adminläsning 403; health 200 är inte pris).
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
   förbrukat: högst nio återstår av befintliga tio. Gamla fullkampanjens worst
   case tio ytterligare dispatches ryms därför inte oförändrat.
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

Molnacceptansen verifierar runtime/media i 22dca5c4; senare slutcommits ändrar bara dokumentation och guide.
Frontend och Lab är aktiverade på de kanoniska Vercel-adresserna och uppdateras
från main. Slutleveransen fb3c0860 ändrar bara dokumentation och guideinnehåll;
båda UI-byggena är publicerade och kontrollerade igen. Render-koden och godkända media är oförändrade.

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
Ingen ytterligare kod-/diskradering är verifierat säker före detta byte.

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
