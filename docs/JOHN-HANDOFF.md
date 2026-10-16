# Aktuell handoff — Scoutgaming

## Dragan: registerbundet bankunderlag — 17 oktober 2026

Jakob valde befintliga Dragan-filmer i Blob för en egen avatarbank.
Ny kod finns på `codex/dragan-lipsync-registry`; detta är förberedelse och
en testad adapter, **inte aktiverat rörligt tal i spelet**.

- Neon `production/croupier` innehöll 56 Dragan-poster. Alla 56 Blob-filer
  lästes och verifierades mot registrerad SHA-256 och storlek. Separat
  återläsning visade oförändrade ID:n, revisioner och hashvärden.
- 50 rörelseklipp exporterades med sina exakta medie-ID:n. Fyra inspelade
  repliker ligger kvar på sitt befintliga talflöde. Två äldre `idle`-poster
  har samma 30-fps-fil och ingår inte i 24-fps-banken. Ingen fil konverterades,
  ersattes, raderades, laddades upp eller fick ändrad acceptans.
- Lokalt byggt CPU-underlag: 2 479 unika fullständiga YUV-bildrutor,
  `pool.mp4` 471 469 184 byte och explicit vila i ruta 0 av profilens
  `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f` (Kevin V2 · andning).
  Källmanifestets SHA-256 är
  `e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d`.
  Privat authoring-underlag finns utanför Git; det är inget nytt runtime-register.
- `createRegisteredMovingSpeech` kopplar ett verifierat källmanifest till
  befintlig PCM-/bildruteplan och transport. Den kräver både aktuellt register,
  exakt media i spelarens frysta publiceringskontext och verifierad bank.
  Ett bildkvitto från GPU-leverantören räcker inte som bankverifikation.
- Verifierat: riktade tester för export, bankbygge, metadataförändring,
  nekad åtkomst, bildruteplan, PCM, sockettransport och dealerlagrets mask.
  Python/ffmpeg-provet byggde en syntetisk bank med exakt deduplicering.
  Det opt-in webbläsarprovet kördes inte; inga betalda eller visuella talprov gjordes.
- Kvar: GPU-beredning i verifierat egen miljö, bank-/workerattestering,
  inkoppling mot befintlig autentiserad talsession och budgetjournal samt
  serverns tidsplanering/replanering och spelarens ljudklocka.
  Inga molninställningar eller produktionsprofiler ändrades. Slutkontroll av
  GitGuardian via ordinarie CLI gav 0 öppna och 18 ignorerade incidenter,
  aktiv övervakning, partiell platsmetadata och historisk scan `too_large`.
  Detta är inte bevis för fullständig historisk täckning.

Fortsättning 17 oktober: CPU-underlaget kan nu överföras separat till GPU-steget
med ett på källdatorn låst kvitto och filhashar. Riktat Python/ffmpeg-test
verifierar separat beredning, bevarade poolbyte och avvisning av ändrad karta
eller ändrat kvitto; modellberedningen ersätts av en uttrycklig teststub i detta
test och är ingen GPU-/bildacceptans.

RunPods inloggade konsol visar `croupier-astrid-gpu-test` (`zsudl8tmzcmiv1`),
imagen `ghcr.io/jakeminator123/astrid-gpu-worker:sha-a041e48b9085a3cc4e324fa960551dde2822229b`,
en GPU i klassen 24 GB Pro och högst en worker. Koden i repot stöder fler dealers
via referensbild, men det är inte verifierat att denna driftsatta image innehåller
samma senare stöd. Den separata rörliga motorn använder en bildrutebank per dealer.
Avsikten är en gemensam talväg och delade workers, inte en permanent GPU per avatar.
Lokal RunPod-nyckel matchar Jakobs angivna maskerade kännetecken, skiljer sig från
Emils separata nyckel och visas som Restricted. Endpoint-hälsa fungerar medan
resurshantering ger 401. Ingen nyckel eller endpoint har ändrats. Resursbehörighet
och ett konkret kostnadstak för det separata GPU-provet återstår.

Uppdaterad 17 oktober 2026. Detta dokument beskriver pågående leverans.
Teknisk migrationsstatus, öppna produktspår och Admin C1–C9 finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md). Användarguide:
[lab/docs/README](../lab/docs/README.md). Ingen ny tracker finns.

## Arbetsbranch, ägare och fryst leverans

- Huvudcheckout: `C:\Users\jakem\Projects\croupier`.
- Branch: `codex/structure-cleanup`; migrationsbaseline/main:
  `b38c56572158d6deaeb6823b3a66bf5fbca8af7e`.
- Jakobs strukturpass levereras i
  [PR190](https://github.com/Jakeminator123/scoutgaming/pull/190).
  Föregående verifierade head: `f066ba4d713f5af0191b7ba09f4b299755ad55c3`;
  [full CI 38962282358](https://github.com/Jakeminator123/scoutgaming/actions/runs/38962282358)
  grön. Detta kvitto gäller det headet; PR190 visar senaste head och dess CI.
- Huvudagenten `structure-pass` äger Git, integration och PR190.
  Dokumentationsagenten har lämnat över handoff och CLOUD-MIGRATION.
  Kodagenten har avstämt återstående källberoenden. Tavlan i `agent-talk`
  gäller per checkout; byt inte branch medan någon skriver.
- Jakob godkände 17 oktober merge av PR188 följt av PR190 och ordinarie
  automatisk leverans. PR188 är mergad som
  `620ab98198914d83c51e51d9eb28b192e18d9cf3` och integreras här i PR190.
  PR190:s aktuella head, merge och kontroller visas i dess GitHub-länk ovan.
  Inga nya migrationer, molnresurser eller visuella spelprov ingår.

## Levererat före detta pass

[PR186](https://github.com/Jakeminator123/scoutgaming/pull/186) är mergad som
`2ea080bc3e75cf0207e3c155f9b4018f6a8d301e` och kräver installerad migration 012.
Neon är enda produktregistret; privat Blob innehåller mediebyte. Import och
oberoende återläsning är genomförda. Den tekniska register-/runtimeflytten är
avslutad i produktion på `b38c56572158d6deaeb6823b3a66bf5fbca8af7e`.
Huvudagentens färska läsande kontroll 16 oktober verifierar Vercel
`dpl_FuDAT4aRmniTWGbvgEPXpa874rip` READY, Render `dep-db97r50ae00c739b10d0`
live på samma SHA, health/version 200, Neon-katalog/ledger och två nya publika
mediestickprov mot exakta Neon-hashar. Kodavstämningen fann inget konkret
migrationsfel och produktionsvägarna är oförändrade sedan baselinen.
De 514 fulla Blob-återläsningarna är äldre PR186-bevis, inte en ny körning.
Inga produktionsdata skrevs eller nya visuella bedömningar gjordes.
Exakta tjänst-/schema-/CI-identiteter och bevisgränser finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md#levererat-och-verifierat).

Admin-konsolidering, zoom och Astrids märkning levererades i
[PR185](https://github.com/Jakeminator123/scoutgaming/pull/185).
Dragan är ordinarie dealer. Astrid är märkt legacyreferens utan trelagersversion.
Befintligt tal och exakta medier/historik bevaras på samma molnväg.
PR181/183/184 stängdes som innehållsmässigt ersatta av PR185 efter jämförelse;
deras sidobrancher raderades inte som del av leveransen.

## Strukturpasset och återanvänd testförenkling

Redan på PR190:s pushade `f066ba4d`:

- Förbrukad lokal demo-/registeruppgradering, tom idle-loop och ensam wrapper
  borttagna efter anroparkontroll. Helper, fingeravtrycksregister och förbrukat
  migrationstest är avvecklade. Fixturestart validerar befintliga projektbyte
  utan revisions-/historikskrivning; historiska kompatibilitetstester använder
  uttryckliga fixtures och behåller beteendeassertionerna.
- Sex befintliga README rättar lokalstart, Neon/Blob, Admin/spelmotor och
  testkataloger. `node lab/start.mjs --no-open` skriver produktens adress;
  endast `--offline` startar ett isolerat tillfälligt serverpar.
- Lokal kontroll: 36/36 berörda beteendeprov, syntax/diffkontroll och
  111 lokala länkmål passerade. Oberoende statisk granskning fann inga
  blockerande fel. 143 befintliga användarfiler var hashbevarade.
  Inga nya browserprov eller visuella mediebedömningar gjordes.

I denna sammanhållna fortsättning av PR190:

- [PR189](https://github.com/Jakeminator123/scoutgaming/pull/189), head
  `318a60b9`, hade grön full CI. Dess testpolicy och borttagning av 16
  kosmetiska/strukturella testfall återanvänds här. Nio testfiler berörs,
  varav tre avvecklas. PR190 ersätter PR189 innehållsmässigt;
  ingen separat mainmerge av PR189 ingår.
- CLOUD-MIGRATION och denna handoff kortas till aktuellt ansvar, bevis och
  kvarvarande frågor. Äldre kvitton bevaras i exakta GitHub-versioner nedan.
- CLAUDE är en kort ingång till AGENTS och de kanoniska guiderna. Gamla
  branchlistor, dubblerade regler och historiska testgrindar är borttagna.
- Ordinarie commit-hook verifierar integrationen; PR190:s checkar och
  leveransbeskrivning redovisar resultat för dess senaste fullständiga head.
- Läsande Vercel-/Render-/Neon-avstämning från 16 oktober gäller kvittot ovan.
  Den säger inte att ett senare PR-head är driftsatt. Efter integrationen
  kontrolleras CI på PR190:s nya head och sedan leveranserna på dess main-SHA.

## Testpolicy och bevisgränser

Jakobs senaste beslut ersätter det generella kravet på två spel/uppspelningar
och manuell spelacceptans som godkännandegrind. Riktade prov följer ändringen
och en konkret felrisk; återstart/städning/flera uppspelningar provas när det
är det ändrade beteendet. Full CI och relevant täckning för auth, bolag/rum,
revision, sparande, pengar och spelregler består.

Borttagna kosmetiska fall låste färger, meny-/knappantal, exakt markup och
historiska layouter. Det upphäver inte krav på reducerad rörelse, läsbarhet,
behörighet eller livscykel. Tidigare 23/23 ändrade och 34/34 närliggande prov
är PR189:s kvitto, inte en ny körning på det integrerade arbetsinnehållet.
Ingen ny läppsynk-/visuell kvalitetsbedömning påstås från kod, hash eller tester.

<a id="2-öppna-kontroller-och-kända-fel"></a>

## Öppna kontroller och kända fel

Klassificeringen och de unika öppna punkterna finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md#verkliga-migrationsfel-och-kvarvarande-utredningsspår):

- **Levererat:** teknisk Neon-/Blob-/runtimeflytt avslutad i produktion,
  schema/import och tidigare Admin-konsolidering. Historiska checkboxar
  är inte nya migrationsfel; detta påstår ingen färdig ny produktfunktion.
- **Möjliga fel att reproducera:** historisk 16/17-event-publicerings409,
  automatisk korsdomänretur, authlatens, uppladdning→idle-val och
  frame-/zon-/flimmerobservationer. Dessa är inte omverifierade här.
  Nytt konkret auth-/rums-/publicerings-/lagringsfel får inte avföras som kosmetik.
- **Separat produktarbete/driftansvar:** N2:s motordata/rapporter, marker,
  global ändringsloggs API, lobbyns bordval, kontoaktivering/reset/MFA/
  integration, OpenClaw/Adminrobotens avgränsade
  driftprov, nytt tal/läppsynk, B18/B19, plattformsbeslut #52 och externa
  Director-/Gatewaybackuper. Baselinekvittots noll aktiva bolag/rum/mallar
  var avsiktligt; antalet är inte en ny kontroll i detta pass.
- **Ersatta krav:** generell tvåspels-/fyradealers-/manuell spelacceptans.
  Äldre accepterade resultat gäller sina versioner och bevisar ingen ny körning.
- **Säkerhet/QA:** huvudagentens läsning 16 oktober gav GitGuardian aktiv,
  0 öppna/18 ignorerade med ofullständig plats-/historiktäckning.
  QA/Preview-utbyggnad är pausad; ursprunglig ingresshemlighet är inte återställd.

## Skyddat material och återställning

Användarens smutsiga `.codex/config.toml`, `apps/croupier-speech/package.json`,
ospårade `.agents/skills/source-command-ping`, `.cursor/settings.json` och
`web/public/review` bevaras. Privata original, arbetsdata, medier, backups och
import-/kostnadsjournaler rörs inte. `arkiv/` är gitignorerat och inte en ny
aktiv dokumentationskälla. Konversationsexporter stannar utanför Git.

Filinventeringen av `web/public/review` omfattar 139 ospårade filer, cirka
302 MB: 123 MP4 samt bilder, verktyg och stödfiler. Grönt i Codex anger här
nya Git-filer, inte fel eller godkänd raderingsbarhet. En framtida sortering
bör skilja publiceringsmaterial från privata arbetsoriginal utanför
`web/public`; avslutade återställningskopior hör till befintliga
`arkiv/<datum>/<ursprunglig-sökväg>`. Ingen fil har flyttats eller raderats.

[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) beskriver bevarade
backuper, QA-luckor och rollback. [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md)
äger miljö-/providerprofiler och konfigurationsansvar. En äldre SQLite/disk
får aldrig återaktiveras som parallell writer efter nya Neon-skrivningar.
Lokala fullhooks kan ärva explicita `*_QA_CONFIG`-opt-ins; grön CI är inte
bevis för central isolering av varje lokal profil. Välj profil före prov.

## Nästa beslut

PR188 är mergad; PR190 slutför den godkända leveransen efter integrations-CI.
Välj därefter ett konkret produktspår ur CLOUD-MIGRATION. Nya auth-/rums-/
publiceringsfel prioriteras efter reproduktion. Återskapa inte raderade
demorum eller produktionsprovdata för en gammal lista.

## Tidigare kvitton och separat PR

- [Handoff på migrationsbaseline b38c5657](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/JOHN-HANDOFF.md).
- [CLOUD på samma baseline](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/CLOUD-MIGRATION.md).
- [Strukturpassets kvitto på f066ba4d](https://github.com/Jakeminator123/scoutgaming/blob/f066ba4d713f5af0191b7ba09f4b299755ad55c3/docs/JOHN-HANDOFF.md).
- [PR188](https://github.com/Jakeminator123/scoutgaming/pull/188), granskat head
  `70872b858074e9dc7cf87c1e2373360550a4adcd`,
  [full CI 38976695835](https://github.com/Jakeminator123/scoutgaming/actions/runs/38976695835)
  grön på Linux/Node 24.21. Normal POSIX-ledarexit 0/7 städar underprocesser,
  även när de ignorerar SIGTERM, och bevarar slutstatus. Timeout 124 och
  avbrott 130 består; frivillig kartrapportering ersätter inte produktprov.
  Windows: 15 passerade, 5 POSIX-fall överhoppade. Kvittot gäller detta
  PR188-head, inte PR190:s kombination, produktion eller visuell acceptans.

## Automatisk leverans efter merge

Läsande provideravstämning 17 oktober: Vercels GitHub-koppling har
`main` som produktionsbranch, deploy-skapande aktiverat och automatisk
koppling till produktionsdomäner. Render `croupier-v2` följer samma repos
`main` med `autoDeploy=yes` och `autoDeployTrigger=checksPass`.
En merge kan alltså publicera webb/Studio och, efter godkända kontroller,
spelmotor automatiskt. GitHub CI, respektive providerbygge och faktisk
live-version är separata resultat. Dessa PR:er lägger inte till någon ny
schemaändring eller mediegenerering. Leveransstatus läses tillbaka efter merge.
