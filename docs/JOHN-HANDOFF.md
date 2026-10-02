# Aktuell handoff — Croupier

Uppdaterad 2 oktober 2026. Detta är den enda löpande John-handofffilen.
Uppdatera de fem befintliga filerna i docs; skapa inga nya arbetsrapporter.

## Pågående uppdrag: en Studio — inte genomförd migrering

[Masterplan och återanvändbara agentprompter](CLOUD-MIGRATION.md#masterplan-en-croupier-studio)
är införda i befintlig migrationsguide. Jakob har godkänt målbilden och vill
att ersatta delar faktiskt avvecklas, inte sparas som parallella legacy-system.
Tre underagenter har gjort avgränsad läsanalys av UI/auth, lagring och OpenClaw/GPU;
orchestratorn äger checklistan, gemensamma kontrakt, docs och senare integration.
Första fristående kodpaketet för sektioner/behörigheter/API är skrivet; inga aktiva
routes använder det ännu. Ingen implementerad Neon-migrering, kontoförändring,
mediaregenerering, disk-/objektradering eller betald provkampanj.
Aktuell driftskarta nedan gäller fortfarande.

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
