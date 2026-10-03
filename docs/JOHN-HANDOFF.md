# Aktuell handoff — Croupier

Uppdaterad 3 oktober 2026. Detta är den enda löpande John-handofffilen.
Uppdatera de fem befintliga filerna i docs; skapa inga nya arbetsrapporter.

## Pågående uppdrag: en Studio — inte genomförd migrering

Pågående fortsättning 3 oktober: gemensam Neon-policy mellan Studio/Render,
native konto-/partner-/authhandlers och tillhörande formulär är implementerade
på main. Grovt cirka 65–70 % av sammanslagningen; källbyte, full helhetsacceptans
och faktisk avveckling återstår. Inget i detta kodsteg har aktiverat produktion.
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
Aktuellt verkligt isolerat PostgreSQL-/HTTPS-/restartprov PASS: 40
acceptansgrupper och 44 oförändrade källhashar, plus runnerguard. Fyra rena
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

Read-only Neon-kontroll visar att 001/002 saknas i drift; även 003 krävs före
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
Render-QA är nu suspenderad för samordnad kandidatändring till den nya
databasen/scope och en separat datarot; gamla QA-filer och en gammal öppen
reservation bevaras oförändrade. Tal-/stream-/kameraproviders är avstängda.
Två separata Vercel-QA-projekt är skapade; kandidatbyggen pågår utan byte av
befintliga produktions-/QA-alias. Faktisk molnacceptans återstår.

Kodleverans [58536d63](https://github.com/Jakeminator123/github-work/commit/58536d63cc82d2c17936437aa784b2310b599a86)
är pushad på GitHub main och alla tre CI-jobb PASS. Vercel-frontend är READY.
Senaste [c667aa22](https://github.com/Jakeminator123/github-work/commit/c667aa22205fba9e872e744cfe1aba2add3adf84)
är pushad på main efter full hook och alla tre CI-jobb PASS. Vercel-Lab är
nu READY för denna leverans; lokal traceguard/build PASS med 50 sanerade
traces. Senaste [3a5f0517](https://github.com/Jakeminator123/github-work/commit/3a5f0517db5f7f74d494e742f6a0401ed551bb8a)
är pushad efter full hook med de 40 SQL-/HTTPS-/restartgrupperna ovan,
röstgranskning, mejl-/skoöversikt och childless PostgreSQL-underhållsläge.
CI och Vercel-Lab för den leveransen kontrolleras fortfarande; frontend är
READY. Ett kandidatbygge hittade en legacy-middleware-fixture som ärvde
nativeflaggan. Testmiljön anger nu båda flaggorna explicit av; alla 31
frontendtester PASS även när omgivande native-/Neonflaggor är på.
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
cirka 65–70 % enligt statusen överst.
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

Isolerat QA-testkonto och dess lösenordsfil är borttagna; endast QA-Render är suspenderad.
Databas, media, backuper och förbrukningsjournaler bevaras. Oanvända provider-/integrationsnycklar
rensades från Vercels frontend; nödvändiga backend-, databas- och lagringsnycklar behålls.
Inga lokala produkt-/labbservrar eller egna QA-browserprocesser lämnas igång.

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
