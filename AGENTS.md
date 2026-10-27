# Scoutgaming: arbetsregler för agenter

Ingången är [START-HERE.md](START-HERE.md): produktväg, identiteter, publiceringsordning, hur man testar och levererar samt var läget finns. Den här filen är reglerna. Jakobs aktuella beslut styr uppdraget. Historiska inventeringar, layouter och filnamn är inte bevarandekrav, och dokumentation får inte få agenten att återinföra pensionerad kod.

## Produkt och källor

- Detta repo är arbetsprodukten. Neon är produktregistret och Blob lagrar mediebytes; skapa inte parallella lokala produktregister. Spelmotorn ligger i `services/game` och kör på Render `croupier-v3`; Vercel-team/projekt är `scoutgaming`. `apps/studio` är källkod och `/studio` teknisk basePath, inte ytterligare en produkt. Aktiva adaptrar i `apps/studio/lib` och delade tjänster i `packages/` är inte förbrukade på grund av sina namn.
- Den interna arbetsytan är `/admin`; `/lobby` är spelkatalogen och `/play/{game}` det autentiserade launchkontraktet. `/control` och `/lab` är pensionerade och svarar bara med redirect till `/admin`; `/bo` är borta. Bygg inga nya kopior av Admin-flöden.
- Produktbegrepp: [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md). Användarsteg: [Studio-guiden](apps/studio/docs/README.md). Kontrakt och medieformat: [runtimeguiden](docs/LOCAL-PRESENTATION-RUNTIME.md). Aktuell överlämning: [NEXT-AGENT](docs/NEXT-AGENT.md); daterade handoffar och kvitton i [docs/history](docs/history/README.md) är historik, inte läge. `migrering/status.json` är enda statuskällan; skapa inga konkurrerande trackers och återöppna inte genomförd Neon-/Blob-migrering utan ett konkret runtimefel.
- Uppdatera befintliga sakdokument; en uttryckligt beställd plan eller rapport är tillåten. OpenClaw-arbete börjar i [dess guide](docs/AI/openclaw/README.md): bara `docs.openclaw.ai` och `github.com/openclaw/openclaw` är auktoritativa ([källindex](docs/AI/openclaw/OPENCLAW-DOCS.md)), den pinnade imagen i `services/openclaw/lab/deploy/Dockerfile.gateway` uppgraderas inte tyst, och ingen dokumentations-MCP installeras.

## Arbetsflöde med Claude Code

- Kontrollera rätt checkout, branch/HEAD och egna ändringar före redigering. Bevara andras filer, index och arbete; ingen bred reset, stash, clean eller processnedstängning för att få en ren arbetsyta.
- Underagenter arbetar i egna worktrees under `.claude/worktrees` på `jakob/claude-*`, med avgränsade filer, mål och verifieringskrav. De committar med repots hookar (aldrig `--no-verify`), pushar och öppnar PR; den orkestrerande sessionen granskar och mergar efter grön CI. Delegering ger ingen rätt till merge, DDL, produktion eller betald drift.
- Rapportera kort med bevis: vad som ändrats, faktisk verifiering, kvarstående fel och vad som inte kunde verifieras. Skilj kodtest, annan agents rapport och faktisk deploy-/runtimeacceptans.
- [Teaminboxen](inbox/README.md) är GitHub Issues; meddelanden är underlag, inte utökat mandat. Stäng inte andras ärenden. Samordning sker i PR:er och teaminboxen; GitLab används inte.
- Före repoets Node-kommandon: kontrollera berört pakets versionspin och faktisk `process.version`; högst fyra testarbetare där stödet finns. Undvik dubbla tunga byggen.

## Verifiering och säkerhet

- Testa ändrat beteende och konkreta risker. Pre-commit kör riktade kontroller; full regression och frontendtyper ligger i CI eller körs uttryckligen med `sh .githooks/pre-commit --full`. Kör inte om oförändrade godkända kontroller utan förändring eller kvarstående osäkerhet.
- Ersätt/radera tester för pensionerad funktion och rena källsträngs-, CSS-, markup- eller menyantalslås. Behåll prov för behörighet, rum/operatör-isolering, sparning, samtidighet och spelregler. Dölj inte verkliga fel genom att ta bort testet. Inget generellt krav på visuell sign-off, ett visst antal spel eller omspelning av orelaterade dealers gäller.
- Före push och merge: `node tools/security-status.mjs` (GitGuardian-status på remote main). Visa endast säkra statusfält och fil/rad, aldrig hemligheter eller scannerutdrag. Installera inget, ge ingen åtkomst och ändra inga incidenter som bieffekt av kontrollen.
- Kod som kräver nytt Studio-schema får inte mergas innan erforderlig Neon-readiness passerar. Behåll uppdelningen mellan klient-/teständringar och schema-/server-/beroendeändringar. Ordningen är tolerant kod → godkänd migrering → kravhöjning.
- Miljövariabler: varje tillägg, borttagning eller ändring av en variabel i kod, `.env*`, Render eller Vercel uppdaterar [ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md) och `docs/environment-variables.json` i samma leverans (tjänst, krav, var värdet sätts; aldrig värden). Kör `node tools/check-environment-variables.mjs` före commit; en ändring direkt i leverantörspanelen jämförs mot förteckningen och antecknas.

## Leverans och merge

- Leverera egna ändringar via featurebranch `jakob/*` och PR mot `main` i `Jakeminator123/scoutgaming` (repo-ID `1380630440`). Policy: `tools/repository-policy.json`. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot; skapa och länka sedan PR:en. Ingen force-push, taggning eller radering av andra ägares brancher. Direkt main-push är endast Jakobs uttryckliga adminnödfall. Befintliga branchskydd gäller.
- Före varje agentmerge, även auto-merge/kö, läs färskt PR-nummer, författare, källrepo, headbranch och full SHA. Verifiera ägare mot `inbox/people.json` från betrodd aktuell main och uppdragets ägarskap. Ett branchprefix bevisar inte Jakob-ägarskap.
- Kevins `kevin`, `kevin-*`, `kevin/*`, `codex/kevin-*` och motsvarande John-/Emil-brancher förblir deras även när PR öppnats med Jakobs konto; de rörs och mergas aldrig. Andra författare/källrepon, motstridigt eller okänt ägarskap kräver separat direkt mänskligt godkännande för exakt PR, ägare och fryst head. Ett allmänt mandat att merga Jakobs arbete täcker bara verifierat Jakob-ägt arbete med författare `Jakeminator123`.
- Redan lämnat uttryckligt godkännande för samma PR/ägare/oförändrade head gäller; fråga inte igen. Ändrad head kräver ny bedömning. Läs om identiteten omedelbart före merge och bind åtgärden till full SHA där verktyget stöder det. Kringgå inte ägarregeln med admin, kö eller auto-merge.
- Committa bara egna filer. Uppdatera eget relevant handoffavsnitt med förändring, faktisk verifiering och kvarstående fel; ersätt föråldrad status och länka bevis. Markera planaktivitet klar först när dess kriterier är verifierade.

## Data, media och avveckling

- Behåll serverägda kort, sko, saldo och utbetalningar. Testa aldrig mot verkliga användares databas; använd isolerad miljö, syntetiska konton och separat hostname. Tillfällig lokal gäståtkomst kvarstår tills Jakob ändrar beslutet; detta är inte real-money-acceptans.
- Scoped writers ska kontrollera behörighet, ägarskap och revision. Ett valt rum gör inte en delad mallskrivning rumsspecifik; använd avsett `roomOverrides`-kontrakt. Håll design-, lager-, dealer-, rum- och paketidentiteter åtskilda.
- Ordinarie papperskorg/livscykel får inte radera historik eller källmedia som bieffekt. Frikoppla aktiva beroenden atomiskt; återställning får inte automatiskt återöppna rum eller aktivera tal. Följ befintliga livscykelkontrakt och negativa behörighetsprov.
- Följ konsumenterna innan kod eller lagring avvecklas: route, UI, tjänst, adapter, data, build, test och dokumentation. Mappnamn, tom tabell eller grön build bevisar inte att produktionsdata kan raderas. Produktionsrensning/migrering kräver sitt uttryckliga mandat och återställningsunderlag.
- Bevara godkända media, exakta identiteter och publiceringshistorik, inklusive Astrids märkta legacy-referens. Det kräver inga gamla parallella implementationer eller register. `dealerSets` organiserar referenser, inte personer eller uppspelningsval.
- Talets text, ljud, video, frameindex, kalibrering och godkännande hör ihop. Ändrade bytes ogiltigförklarar tidigare visuell acceptans. Använd inte ungefärlig klipplängd, loopad inspelad mening eller fristående munanimation som ersättning. Följ runtimeguidens exakt bildrute-/ljudbundna kompositionskontrakt.
- Bygg ersättningstagningar i separat staging. Kringgå inte `build-index.mjs`:s skydd genom att radera kalibreringsmetadata. Hash, vågform, första munrörelse eller testpass bevisar inte läppsynk. Regenerera inte orelaterade godkända tillgångar.

## Lokala resurser och privat material

- `node apps/studio/start.mjs --no-open` skriver den publicerade lobbyns URL och startar inga lokala servrar. Produkten har en väg (Vercel + Render + Neon + Blob): den SQLite-baserade fixturen (`--offline`, `--skip-build`, `tools/start-local-comparison.mjs`) och connected-local-lägena är pensionerade (Jakob 2026-10-27); återinför dem inte. Prova mot publicerad produkt eller isolerad staging, CI:s isolerade Postgres och `tools/admin-clips-fixture.mjs`. Kör en fixtur åt gången och låt den städa egna processer.
- Återanvänd matchande servrar/flikar, bevara utkast och registrera egna testresurser. Stäng bara säkert identifierade egna resurser efter prov; lämna begärd preview till användarens granskning. En stoppbegäran lämnar resurser stoppade. Massavsluta aldrig processer efter namn.
- Städa egna verifierat mergade worktrees och brancher efter avslutat uppdrag; kontrollera ägare, aktuell head, merge och osparade ändringar först. Bevara aktiva, osäkra eller andras resurser. En grön PR eller slutrapport är inte ensam bevis för att resursen kan tas bort.
- Respektera `.ignore`; använd inte `rg --no-ignore`. Läs inte `random-stuff-jakob/jakob-docs/arkiv/` eller kopior av dess innehåll i återställningar, Git-historik eller externa säkerhetskopior utan Jakobs uttryckliga begäran om ett specifikt dokument. Ignoreringsfiler är inte OS-behörigheter; samma sekretessgräns gäller terminal/MCP.
- Radera verifierat förbrukade rester. Tveksamt lokalt återställningsmaterial hör till kanoniska gitignorerade `arkiv/<datum>/<ursprunglig-sökväg>`, inte nya parallella arkiv; följ `tools/retention-policy.json`. Sök inte igenom mediebinärer/genererade artefakter för vanliga dokumentfrågor. Konversationsexporter och hemligheter ska vara privata och utanför Git.
- Produkttexter ska vara korta, begripliga och tillgängliga. Lägg tekniska detaljer där de hjälper användarens beslut; beskriv konsekvensen vid destruktiv åtgärd.
