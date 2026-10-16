# Aktuell handoff — Scoutgaming

Uppdaterad 16 oktober 2026. Detta dokument beskriver pågående leverans.
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
- Ingen mainmerge, produktionsdeploy, ny migration, ny molnresurs,
  produktionsskrivning eller visuellt spelprov ingår i det pågående passet.

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
- Färsk läsande Vercel-/Render-/Neon-avstämning är klar enligt kvittot ovan;
  PR190 är fortfarande en separat kod-/dokumentleverans utan mainmerge/deploy.

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

PR190 och separat CI-PR188 lämnas för granskning; ingen merge/deploy ingår.
Välj därefter ett konkret produktspår ur CLOUD-MIGRATION. Nya auth-/rums-/
publiceringsfel prioriteras efter reproduktion. Återskapa inte raderade
demorum eller produktionsprovdata för en gammal lista.

## Tidigare kvitton och separat PR

- [Handoff på migrationsbaseline b38c5657](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/JOHN-HANDOFF.md).
- [CLOUD på samma baseline](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/CLOUD-MIGRATION.md).
- [Strukturpassets kvitto på f066ba4d](https://github.com/Jakeminator123/scoutgaming/blob/f066ba4d713f5af0191b7ba09f4b299755ad55c3/docs/JOHN-HANDOFF.md).
- [PR188](https://github.com/Jakeminator123/scoutgaming/pull/188), head
  `1eb42c3e`, [full CI 38961755164](https://github.com/Jakeminator123/scoutgaming/actions/runs/38961755164)
  grön: frivillig kartrapportering får inte ersätta produktprovets status.
  Den är separat och inte mergad genom detta pass.
