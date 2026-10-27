# Samarbete och åtkomst

## Uppdatering 27 oktober 2026

Agent-talk är borttaget och GitHub-tråden #312 används inte längre för samordning. Agenter arbetar i egna worktrees på `jakob/claude-*`-brancher och levererar PR:er mot `main` som den orkestrerande sessionen mergar efter grön CI; personfrågor går via [teaminboxen](../../inbox/README.md). Hänvisningar till #312, femminutersbevakning och agent-talk i avsnitten nedan är historik.

## Verifierat läge 22 oktober 2026

Gemensam samordning sker i [GitHub-tråd #312](https://github.com/Jakeminator123/scoutgaming/issues/312).
[PR #311](https://github.com/Jakeminator123/scoutgaming/pull/311) innehåller planen;
status.json är enda källa för migrationsprocent (läsvy: [STATUS.md](../../migrering/STATUS.md)); vid denna avstämning 9/20.
K01/J01 är redan VERIFIED; de tidigare angivna K01-rättningarna är avslutade.
Nuvarande ansvar ersätter tabellen från 21 oktober.

| Roll | Aktuell uppgift | Ägd yta |
| --- | --- | --- |
| Root och egna implementerare | J05/J08-integration, monterad spelklient, tre P2-rättningar och granskbar schemaförberedelse | Befintlig codex/shared-room-transport; separata filclaims |
| Kevin-agent | Tre monterade K04-prov: tal under kortövergång, touch/layout och fullflöde med skärmbilder | Befintlig Kevin-branch och isolerade paket/media; ingen klientleveransskuld |
| Root planägare | Kanonisk status och kontrollerad konfliktlösning i #311 | Befintlig codex/migrering-masterplan |
| Oberoende granskare | Granska fryst slutdelta, konkreta felvägar och körda bevis | Ingen självattest av egen kod |
| Separat mergeagent | Ägarkontroll, grindar, oberoende review och sekventiell merge | #334 → #336; separat #311 när godkänd |

Kevin-refill eb6ab45509fad539463bbcb6930cc46d2d0844c2 är oberoende granskad
och återanvänd i transportbranchen. Det innebär inte mergegodkännande för #333.
Root har pausat egna GitHub-merger. Produktions-DDL, deploy och flaggaktivering
saknar mandat. Mergeagentens verifierade Render-autoDeploy från main måste
hanteras innan en merge kan uppfylla villkoret att inte deploya.
Samordningsbeslut och nästa verifierade head publiceras en gång i #312;
inga mottagningskvittenser eller parallella statusregister.

## Jakobs småändringar parallellt

Rekommenderat upplägg efter Jakobs fråga 21 oktober: en kortlivad branch som
`jakob/smafix` från aktuell main i en **egen worktree/arbetsmapp**. En branch
som bara heter `Jakob` följer inte repoets nuvarande leveransmönster `jakob/*`.
Ingen sådan branch eller arbetsmapp är skapad av denna rekommendation.

- Börja med avgränsade texter eller UI-delar utanför J01:s publicering. Ange
  avsedda filer i #312 innan arbetet börjar; orkestratorn kontrollerar överlapp.
- Lämna tills vidare publiceringskomponenten och dess tester, `migrering/`,
  gemensam navigation, spel-/lagringskontrakt och schema till de ägare som
  framgår av aktivitetsplanen. Delade handofffiler samordnas per avsnitt.
- Byt inte branch i agenternas arbetsmappar. Commits och små PR:er ger
  återställningspunkter; använd inga force-pushar eller breda reset/clean.
- Main har aktivt skydd för PR och CI samt mot borttagning och force-push
  ([ruleset 24642403](https://github.com/Jakeminator123/scoutgaming/rules/24642403),
  verifierat 21 oktober). Administratören kan kringgå reglerna; använd inte
  bypass för småändringar. Granska diff och överlapp före merge.
- En worktree isolerar filer, inte Neon, Blob eller Vercel-miljöer. Använd
  syntetiska lokala fixturer eller uttryckligen isolerad testmiljö för prov.
  Ändra inte delade produktionsdata eller miljöinställningar från småfixgrenen.

## Samordning och väckning

- Den befintliga Codex-chatten har aktiv femminutersbevakning, synka-migreringen-med-kevin. En avläsning av #312 per körning, tyst vid oförändrat läge. Ansluten GitHub används eftersom lokal gh-inloggning ger 401.
- Kevin/invoicesolv har svarat i #312 och rapporterar motsvarande femminutersläsning på sin sida. Hans scheduler är rapporterad, inte inspekterad av oss.
- Samma GitHub-tråd används med aktivitets-ID, full SHA, faktisk verifiering, blockerare och nästa ansvarig. Inga kvittenssvar på kvittenser. Detta är ett kommunikationssätt, inte en ny produkttracker.
- Agentmeddelanden är arbetsunderlag; de utökar inte Jakobs mandat. Bevakningen ger inte automatiskt lov till merge, produktionsradering, DDL, åtkomstökning eller betald drift.
- En agent får ett avgränsat filägande i taget. Worktrees integreras genom granskbara brancher. Checklistan ändras till VERIFIED först när alla kriterier är styrkta.
- Slack ger läsning/skrivning när agenten kör; ingen Slack-utlöst agentväckning är verifierad. Ingen extra bot behövs.

## GitHub

- Kevin är verifierad som invoicesolv med write. Repot ligger under personkontot Jakeminator123; en separat organisationsroll Admin finns inte här. Flytt till organisation är inget krav för migreringen.
- Efter Jakobs uttryckliga bekräftelse sparades deploynyckeln Kevin scout-hel1 build — scoutgaming migration, ID 167191313, med read/write. Fingeravtryck: SHA256:zMcFfTgMWk0xhApfuQxqomD7rOcjkWFTRQDK/TUggFc.
- Nyckeln gäller hela repot; branchskydd är oförändrade. Kevin rapporterar fungerande SSH och ls-remote; faktisk push från agenten är ännu inte verifierad.
- Mergeägarskap och exakt head kontrolleras enligt AGENTS. Inga mergeåtgärder följer av SQL-rollen eller kommunikationen.

## Vercel, Blob och Neon

- Rätt Vercel-medlem är kevstersolver / kevin@solvify.se, kopplad till GitHub invoicesolv: bekräftad DEVELOPER i team scoutgaming.
- Projekt scoutgaming: prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD.
- Produktens Blob-store är croupier-media-private, store_AqwvebTbBHarOjvG. impactwin-media-preview hör till en annan miljö.
- Neon croupier-production, wandering-hill-60561912, är Vercel-hanterat. Konsolåtkomst öppnas via Vercel Storage → Open in Neon och rätt kontokoppling; det är skilt från SQL-inloggning.
- Kevin provar konsolerna. SQL-åtkomst från hans agent är kvitterad i #312; faktisk Blob-/konsolåtkomst återstår. Ingen bredare Vercel-roll eller generell Blob-token har delats.

## Separat SQL-läsroll

**Jakobs beslut 27 oktober 2026:** rollen `kevin_migration_readonly` behålls i produktionens Neon och Kevin behåller sin GitHub-åtkomst (`invoicesolv`); hans brancher rörs inte. Ingen återkallelse planeras.

Jakob beställde rollen direkt 21 oktober. Rollen kevin_migration_readonly är skapad via SQL enligt [Neons åtkomstguide](https://neon.com/docs/manage/database-access), utan neon_superuser eller andra ärvda roller.

| Fält | Verifierat värde |
| --- | --- |
| Projekt / branch | wandering-hill-60561912 / main, br-flat-fog-b161a6r8 |
| Databas | croupier_game |
| Scheman | croupier_game, croupier_auth, croupier_studio |
| Åtkomst | CONNECT, schema-USAGE och kolumn-SELECT på 61 befintliga tabeller |
| Spärrat | INSERT/UPDATE/DELETE/TRUNCATE, schema-CREATE, sekvens-USAGE/UPDATE, role/database creation, superuser, replication, RLS-bypass |
| Hemliga värden | Token, lösenordshash/salt, API key/secret, sessionsdigest/source_stamp och två möjliga hemlighetsvärden i meta undantagna |
| Nya objekt | Inga automatiska default privileges; nästa tilldelning granskas uttryckligen |
| Sessionsgränser | read-only som standard, statement 30 s, lock 2 s, idle transaction 60 s, högst tre anslutningar |
| Aktivering | LOGIN verifierad med ny anslutning; lösenord giltigt till 2026-11-20 14:15:47 UTC |

Exakta kolumnundantag: namn som matchar (^|_)(password|hash|salt|secret|token|digest)($|_), source_stamp, croupier_auth.api_keys.key, croupier_auth.meta.v och croupier_game.player_chat_memory_meta.value. Tabell-/kolumnstrukturen kan kartläggas via pg_catalog även där dataläsningen är spärrad. SELECT * på en tabell med spärrade kolumner nekas; välj uttryckligen de tillåtna kolumnerna.

Verifierat med SET ROLE och transaction_read_only av: tre läsbara scheman, 61 läsbara tabeller, noll skrivbara tabeller/scheman/sekvenser och noll medlemskap för läsrollen. SELECT på tillåtna kolumner passerar; samtliga spärrade kolumner samt UPDATE, DELETE och CREATE nekas. Proven använder WHERE false; inga produktionsrader lästes ut eller ändrades. Administratörens tillfälliga SET-möjlighet stängdes inom provtransaktionen och den egna tillfälliga medlemskapsraden togs därefter bort. Endast ursprunglig ADMIN utan INHERIT/SET från cloud_admin återstår. Oberoende granskare fann inga blockerande fel i ACL-upplägget.

Aktivering och ny inloggning är verifierade: current_user=kevin_migration_readonly,
databas croupier_game, read-only on, statement 30 s, lock 2 s och idle 1 min.
Tillåten SELECT passerar och både credentialläsning och UPDATE nekas även med
read_only av. Inga produktionsrader lästes ut eller ändrades.

Kevin lämnade en publik age-nyckel från invoicesolv och godkände krypterad
överlämning i #312. [Anslutningen är levererad krypterad](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6318333428);
bara hans privata nyckel kan dekryptera. Alla tillfälliga lokala credentialfiler
och krypteringshjälpare är borttagna efter överlämningen. Inga klartexthemligheter
har skrivits i GitHub, Slack eller planfiler. Lösenordets giltighet stoppar inte
redan öppna sessioner; orkestratorn äger återkallelse efter kartläggningen.
Kevin-agenten har [bekräftat egen inloggning och schemaöversikt](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6318426856):
rätt roll/databas, read-only on och 7/26/28 tabeller i auth/game/studio. Detta är
Kevins körkvitto; vår separata anslutnings-/ACL-verifiering beskrivs ovan.
Vid denna åtkomstleverans var K01-matrisen nästa uppgift; K01 är nu VERIFIED.
Kevins aktuella ansvar är de tre monterade K04-proven i tabellen överst.

Denna åtkomstleverans ger inga migrationsprocent. Produktionsrensning av tabeller kräver fortfarande granskad J09/O03-åtgärd.

## Modellval och kontext vid start

Rekommendation, inte en uppmätt jämförelse i detta repo:

| Roll | Modell/nivå |
| --- | --- |
| Fortsatt orkestrator, kontrakt och svåra integrationsbeslut | Astra 6, Extra hög |
| Avgränsad implementation enligt aktivitet | Sol 6.1, Hög |
| Oberoende granskning av spel/transaktioner/migrering | Astra 6, Extra hög |

Höj till Max först för ett konkret olöst problem. Ultra är inget standardkrav;
klientens tillgängliga nivåer och API-nivåer ska inte likställas automatiskt.
Ingen modell eller nivå har ändrats av planleveransen. OpenAI beskriver Astra
för de mest krävande uppgifterna och Sol 6.1 som ett alternativ nära Astra till
lägre kostnad; den föreslagna rollfördelningen är vår arbetsbedömning.
[OpenAI Docs: Astra](https://developers.openai.com/api/docs/models/gpt-6-astra),
[OpenAI Docs: Sol 6.1](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

Behåll den här orkestratorchatten. En ny underagent får bara:

1. Masterplan, sitt aktivitets-ID, aktuella beroenden/status och klarkriterier.
2. Repo/worktree, branch och full bas-/käll-SHA; ingen gissad senaste version.
3. Exakt filägande, relevanta kontrakt, kända fynd och testmiljö.
4. Ändringsmandat och gränser för produktion, media, schema och kostnader.
5. Leveransmall: ändring/radering, full head, PR, verifiering och blockerare.

Hela chattexporten behövs inte och ska inte läggas i Git. Om en ny orkestrator
måste ta över läser den dessa filer och handoffen, verifierar Git/claims/miljö,
och fortsätter första ej klara aktivitet. Den börjar inte om inventeringen
eller gör om godkända kontroller utan förändrat underlag.