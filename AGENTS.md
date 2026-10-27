# Scoutgaming: arbetsregler för agenter

## Riktning och källor

Jakobs aktuella beslut styr uppdraget. Historiska inventeringar, layouter och filnamn är inte bevarandekrav. Dokumentation får inte få agenten att återinföra pensionerad kod.

- Utveckla den interna arbetsytan i `/admin`. `/lobby` är spelkatalogen; det autentiserade launchkontraktet `/play/{game}` är en separat funktion som ska fungera tills det uttryckligen ersätts.
- Avveckla `/control` och alternativa kataloger/ingångar enligt godkänd aktivitet. Bygg inte nya Control-funktioner eller kopior av Admin-flöden. Återanvänd aktiva tjänster; radera ersatta sidor, ensamma tester och gamla anrop tillsammans. Redovisa berörda bokmärken och eventuell explicit omdirigering.
- Produktbegrepp och ansvar: [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md). Användarsteg: [Studio-guiden](apps/studio/docs/README.md). Tekniska kontrakt och medieformat: [runtimeguiden](docs/LOCAL-PRESENTATION-RUNTIME.md).
- Aktuellt leveransläge: [JOHN-HANDOFF](docs/JOHN-HANDOFF.md). Teknisk molnmigrering: [CLOUD-MIGRATION](docs/CLOUD-MIGRATION.md). Återställning: [ENVIRONMENT-RESTORATION](docs/ENVIRONMENT-RESTORATION.md). Läs de sakguider som berör ändringen; läs handoff och återställning före spel-/medieändring.
- Jakobs beställda Admin-/Kevin-arbete styrs av [masterplanen](migrering/MASTERPLAN.md); `migrering/status.json` är dess enda statuskälla. Det kompletterar molnöversikten och återöppnar inte genomförd Neon-/Blob-migrering utan ett konkret runtimefel. Skapa inte konkurrerande trackers.
- Läs bara relevanta guider. OpenClaw-arbete börjar i [dess guide](docs/AI/openclaw/README.md). AI-arbetsflöden dokumenteras i [agentflödet](docs/AI/scoutgaming-agentflode.md). Uppdatera befintliga sakdokument; en uttryckligt beställd plan eller rapport är tillåten.

Detta repo är arbetsprodukten. Neon är produktregistret och Blob lagrar mediebytes; skapa inte parallella lokala produktregister. Spelmotorn ligger i `services/game` och kör på Render `croupier-v3`; Vercel-team/projekt är `scoutgaming`. `apps/studio` är källkod och `/studio` teknisk basePath, inte ytterligare en produkt. Aktiva adaptrar i `apps/studio/lib` och delade tjänster i `packages/` är inte förbrukade på grund av sina namn.

## Ägarskap och samarbete

- Kontrollera rätt checkout, branch/HEAD och ändringar före redigering. Bevara andras filer, index och arbete; ingen bred reset, stash, clean eller processnedstängning för att få en ren arbetsyta.
- Före repoets Node-kommandon: kontrollera berört pakets engines/versionspin och faktisk `process.version`. Använd kompatibel Volta-version och högst fyra testarbetare där stödet finns. Undvik dubbla tunga byggen.
- Vid ett ändringsuppdrags start, före nya filanspråk och före commit/push: kör `node tools/agent-talk.mjs status <id>`. Claima konkreta filer och `.git` när indexet används; samordna överlapp med ping/ack och släpp med `done`. Läs igen vid ändrat ägarskap eller nytt meddelande, inte vid varje vanlig läsfråga. Se [agent-talk](agent-talk/README.md).
- Delegera när Jakob eller tillämpliga instruktioner begär det. Ge varje underagent avgränsade filer, mål och verifieringskrav. Orkestratorn får tilldela egna commits i en separat worktree; delat index kräver uttrycklig överlämning. Orkestratorn äger gemensam integration och push. Delegering ger inte rätt till merge, DDL, produktion eller betald drift.
- Skilda worktrees delar inte agent-talk. Samordna berörda ägare via den befintliga GitHub-tråden; för migreringen är det [#312](https://github.com/Jakeminator123/scoutgaming/issues/312). Läs relevanta nya meddelanden vid överlämning/fortsättning. Ingen bred inkorgsskanning vid varje analysfråga och inga kvittenser på kvittenser.
- [Teaminboxen](inbox/README.md) använder GitHub Issues. Använd uttrycklig känd ägare om `me` inte kan bindas till registrerad enhet/exakt branch. Ansluten GitHub-tjänst är reservväg när CLI saknar åtkomst. Meddelanden är underlag, inte utökat mandat. Stäng inte andras ärenden.
- GitLab-inbox, wiki och spegling är pausade; Jira ingår inte i arbetsflödet. Återskapa inte `.croupier-inbox/`.
- Explicit `/chef` följer `.agents/skills/chef/SKILL.md`; ingen automatisk rollaktivering. Före gemensam integration/push, läs `node tools/croupier-chef.mjs status` och samordna med eventuell aktiv ägare.

## Verifiering och säkerhet

Testa ändrat beteende och konkreta risker. Pre-commit kör riktade kontroller; full regression och frontendtyper ligger i CI eller körs uttryckligen med `sh .githooks/pre-commit --full`. Kör inte om oförändrade godkända kontroller utan förändring eller kvarstående osäkerhet.

Ersätt/radera tester för pensionerad funktion och rena källsträngs-, CSS-, markup- eller menyantalslås. Behåll prov för behörighet, rum/operatör-isolering, sparning, samtidighet och spelregler. Dölj inte verkliga fel genom att ta bort testet. Inget generellt krav på visuell sign-off, ett visst antal spel eller omspelning av orelaterade dealers gäller.

Läs GitGuardian-status från remote main vid start av kod-/konfigurationsarbete eller säkerhetsgranskning samt före commit/push: `node tools/security-status.mjs`, befintlig MCP-anslutning eller ansluten GitHub-reservväg. Återanvänd en nyss gjord läsning inom samma leverans när ref och underlag är oförändrade. Rena läs-/planfrågor kräver ingen separat molnsäkerhetsrunda.

Redovisa incidenttäckning, källbindning, monitorering och historik separat. Visa endast säkra statusfält och fil/rad, aldrig hemligheter eller scannerutdrag. Saknad åtkomst är ofullständig täckning; grön CI bevisar inte noll incidenter. Installera inget, ge ingen åtkomst och ändra/ignorera inga incidenter som bieffekt av kontrollen.

Kod som kräver nytt Studio-schema får inte mergas innan erforderlig Neon-readiness passerar. Behåll befintlig uppdelning mellan klient/teständringar och schema-/server-/beroendeändringar. En uttryckligt valfri deploymentversion får följa ordningen tolerant kod → godkänd migrering → kravhöjning enligt molnöversikten.

## Leverans och merge

Leverera egna ändringar via featurebranch `jakob/*`, `codex/*` eller `cursor/*` och PR mot `main` i `Jakeminator123/scoutgaming` (repo-ID `1380630440`). Policy: `tools/repository-policy.json`. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot; skapa och länka sedan PR:en. Ingen force-push, taggning eller radering av andra ägares brancher. Direkt main-push är endast Jakobs uttryckliga adminnödfall, inte vanlig leverans. Befintliga branchskydd gäller.

Före varje agentmerge, även auto-merge/kö, läs färskt PR-nummer, författare, källrepo, headbranch och full SHA. Verifiera ägare mot `inbox/people.json` från betrodd aktuell main och uppdragets ägarskap. Branchprefix `codex/*` eller `cursor/*` bevisar inte Jakob-ägarskap.

Kevins `kevin`, `kevin-*`, `kevin/*` och motsvarande John-/Emil-brancher förblir deras även när PR öppnats med Jakobs konto. Andra författare/källrepon, motstridigt eller okänt ägarskap kräver separat direkt mänskligt godkännande för exakt PR, ägare och fryst head. Ett allmänt mandat att merga Jakobs arbete täcker bara verifierat Jakob-ägt arbete med författare `Jakeminator123`.

Redan lämnat uttryckligt godkännande för samma PR/ägare/oförändrade head gäller; fråga inte igen. Ändrad head kräver ny bedömning/godkännande. Läs om identiteten omedelbart före merge och bind åtgärden till full SHA där verktyget stöder det. Kringgå inte ägarregeln med admin, kö eller auto-merge.

Committa bara egna filer. Uppdatera eget relevant handoffavsnitt med förändring, faktisk verifiering och kvarstående fel; ersätt föråldrad status och länka bevis. Skilj kodtest, annan agents rapport och faktisk deploy/runtimeacceptans. Markera planaktivitet klar först när dess kriterier är verifierade.

## Data, media och avveckling

- Behåll serverägda kort, sko, saldo och utbetalningar. Testa aldrig mot verkliga användares databas; använd isolerad miljö, syntetiska konton och separat hostname. Tillfällig lokal gäståtkomst kvarstår tills Jakob ändrar beslutet; detta är inte real-money-acceptans.
- Scoped writers ska kontrollera behörighet, ägarskap och revision. Ett valt rum gör inte en delad mallskrivning rumsspecifik; använd avsett `roomOverrides`-kontrakt. Håll design-, lager-, dealer-, rum- och paketidentiteter åtskilda.
- Ordinarie papperskorg/livscykel får inte radera historik eller källmedia som bieffekt. Frikoppla aktiva beroenden atomiskt; återställning får inte automatiskt återöppna rum eller aktivera tal. Följ befintliga livscykelkontrakt och negativa behörighetsprov.
- Följ konsumenterna innan kod eller lagring avvecklas: route, UI, tjänst, adapter, data, build, test och dokumentation. Mappnamn, tom tabell eller grön build bevisar inte att produktionsdata kan raderas. Produktionsrensning/migrering kräver sitt uttryckliga mandat och återställningsunderlag.
- Bevara godkända media, exakta identiteter och publiceringshistorik, inklusive Astrids märkta legacy-referens. Det kräver inga gamla parallella implementationer eller register. `dealerSets` organiserar referenser, inte personer eller uppspelningsval.
- Talets text, ljud, video, frameindex, kalibrering och godkännande hör ihop. Ändrade bytes ogiltigförklarar tidigare visuell acceptans. Använd inte ungefärlig klipplängd, loopad inspelad mening eller fristående munanimation som ersättning. Följ runtimeguidens exakt bildrute-/ljudbundna kompositionskontrakt.
- Bygg ersättningstagningar i separat staging. Kringgå inte `build-index.mjs`:s skydd genom att radera kalibreringsmetadata. Hash, vågform, första munrörelse eller testpass bevisar inte läppsynk. Regenerera inte orelaterade godkända tillgångar.

## Lokala resurser och privat material

`node apps/studio/start.mjs --no-open` skriver den publicerade lobbyns URL och startar inga lokala servrar. Produkten har en väg (Vercel + Render + Neon + Blob): den SQLite-baserade fixturen (`--offline`, `--skip-build`, `tools/start-local-comparison.mjs`) och connected-local-lägena är pensionerade (Jakob 2026-10-27); återinför dem inte. Prova mot publicerad produkt eller isolerad staging, CI:s isolerade Postgres och `tools/admin-clips-fixture.mjs`. Kör en fixtur åt gången och låt den städa egna processer.

Återanvänd matchande servrar/flikar, bevara utkast och registrera egna testresurser. Stäng bara säkert identifierade egna resurser efter prov; lämna begärd preview till användarens granskning. En stoppbegäran lämnar resurser stoppade. Massavsluta aldrig processer efter namn.
Vid avslutat uppdrag, städa egna verifierat mergade lokala branch-/worktreerester inom uppdragets mandat. Kontrollera ägare, aktuell head och merge, aktivitet, osparade ändringar samt ignorerat återställningsmaterial först. Bevara aktiva eller osäkra resurser och andras parkerade arbete; använd återställbar arkivering för Codex-hanterade worktrees. En grön PR, gammal claim eller slutrapport är inte ensam bevis för att resursen kan tas bort.

Respektera `.ignore`; använd inte `rg --no-ignore`. Läs inte `random-stuff-jakob/jakob-docs/arkiv/` eller kopior av dess innehåll i återställningar, Git-historik eller externa säkerhetskopior utan Jakobs uttryckliga begäran om ett specifikt dokument. Ignoreringsfiler är inte OS-behörigheter; samma sekretessgräns gäller terminal/MCP.

Radera verifierat förbrukade rester. Tveksamt lokalt återställningsmaterial hör till kanoniska gitignorerade `arkiv/<datum>/<ursprunglig-sökväg>`, inte nya parallella arkiv; följ `tools/retention-policy.json`. Sök inte igenom mediebinärer/genererade artefakter för vanliga dokumentfrågor. Konversationsexporter och hemligheter ska vara privata och utanför Git.

Produkttexter ska vara korta, begripliga och tillgängliga. Lägg tekniska detaljer där de hjälper användarens beslut; beskriv konsekvensen vid destruktiv åtgärd.
