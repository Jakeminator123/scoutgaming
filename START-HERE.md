# Scoutgaming: börja här

Live-dealer blackjack för spelbolag: Admin publicerar dealer, material och rum, lobbyn startar spelet och spelmotorn äger kort, sko och saldo. Den här filen är ingången för människor och agenter; Jakobs aktuella beslut gäller före allt annat.

Läsordning:

1. **START-HERE** (den här filen): produktväg, identiteter, publiceringsordning, hur man kör, testar och levererar.
2. **[docs/NEXT-AGENT.md](docs/NEXT-AGENT.md)**: aktuellt läge, återstående aktiviteter och vem som agerar.

Reglerna står i [AGENTS.md](AGENTS.md). [Ordlistan](apps/studio/docs/TERMINOLOGI.md) förklarar produktens identiteter och deras kodnamn. Dokument och historiska planer beskriver arbetet; de fryser inte UX, mappar eller implementationer.

## En produktväg

| Del | Kod | Drift |
| --- | --- | --- |
| Admin, lobby, partner | `apps/studio` (basePath `/studio`; publika vägar `/admin`, `/lobby`, `/partner`) | Vercel, team `scoutgaming`, projekt `scoutgaming` → www.scoutgaming.tech |
| Startsida och spelstart `/game?game=…` | `apps/web`; äldre `/play/blackjack` omdirigeras hit | Vercel, samma projekt (`vercel.json` styr tjänsterna) |
| Tal | `apps/speech` | Vercel |
| Spelbackend: regelkärna, saldo, sessioner och spel-API:er | `services/game` | Render `croupier-v3` |
| Talkedjan i drift | `packages/director` (Director-biblioteket) och `services/openclaw/lab` (Director-tjänsten; Gateway-image och deploy i `deploy/`) | Render `croupier-lab-director`, `croupier-lab-openclaw` |
| Produktregister och konton | Neon Postgres, scheman `croupier_game`, `croupier_auth`, `croupier_studio` (SQL i `ops/neon-game`, `ops/neon-studio`) | Neon |
| Media | Vercel Blob | Blob |
| Delade tjänster | `packages/*` (presentation, storage, studio-registry, operators, navigation …) | Byggs in i båda apparna |

Beslut (Jakob 2026-10-27): Vercel + Render + Neon + Blob är den enda vägen, och `main` är den enda produktvägen. Ingen SQLite, inga lokala produktregister, inga parallella QA-ytor. `/control` och `/lab` svarar bara med redirect till `/admin`; `/bo` är borta. PGlite är ett dev-beroende för tester, inte en produktväg. Kvarvarande rester är avvecklingsobjekt, inte bevarandekrav.

`services/game` innehåller mer än spelregler. Bara regelkärnan avgör kort och utfall; klient, presentation, tal och driftsadaptrar är ändringsbar kod runt den. Se [kodgränsen](services/game/README.md#vad-som-får-ändras).

## Systemkarta: vem äger vilket beslut?

```text
Admin / partner → behörighet + revision → Neon: utkast och publicerade paket
                                              ↓
Lobby → /game?game=… → spelarsession + publicerat rum → Render: spelmotor
                                              ↓               ↓
                                     Blob: mediebytes    Neon: spel och saldo
```

Ansvar nedan betyder kodens beslut, inte en fryst mapp eller en permanent agentägare. Vid varje ändring får berörda filer en ensam skrivare; uppdragets tilldelning avgör vem som samordnar integration och release. Aktuella uppdrag står i [körplanen](docs/plans/organisation/KORPLAN-v2.md).

| Produktväg / ansvar | Kod att börja i | Data och drift | Verifiering av gränsen |
| --- | --- | --- | --- |
| Admin: redigera valt bolag, team och material. HTTP-lagret äger session, origin och tillåtet scope. | [Admin-route](apps/studio/app/admin/[[...path]]/route.ts), [klienten](apps/studio/client/admin), [runtime](apps/studio/lib/studio-native-runtime.mjs) och [behörighet](packages/studio-access/README.md) | Vercel Studio → Neon; runtime tillför pooler och obligatorisk schemakontroll. | [Bolags-API:s behörighets- och scopeprov](apps/studio/test/operator-admin-api.test.mjs), revisionskonflikt, sista administratören och sparade utkast. |
| Bolag och publicering: medlemskap, paket, historik och atomisk audit. Ett rums inställning hålls skild från den delade mallen. | [Bolagslagring](packages/operators/server/operator-store.mjs), [publicerade rum](packages/operators/server/public-rooms.mjs), [branding och roomOverrides](packages/operators/contracts/branding.mjs) | Neon: bolag, medlemskap och versionsbundna paket; apparna äger anrop och pooler. | [Bolagsprov](test/operator-store.mjs), [rummets paketauktoritet](test/package-room-authority.mjs), scope/CAS och livscykelprov. |
| Register och media: exakt identitet, snapshot och läsbara bytes. Ett sparat projekt är inte automatiskt publicerat. | [Registerkontrakt](packages/studio-registry/README.md), [registerkärnan](packages/studio-registry/server/repository.mjs), [publicerad scen](packages/presentation/runtime/published-scene.mjs) | Neon bär register/revisioner; privat Blob bär bytes. Provideradaptrar: [Studio](apps/studio/lib/cloud-media-store.mjs) och [spelmotorn](services/game/blob-media.mjs). | [Mediegränsens prov](test/studio-media-runtime.mjs), Hash/Range/origin, frysta snapshots och negativa referens-/behörighetsprov; AV-acceptans är separat. |
| Lobby och spelstart: välj publicerat rum och kontrollera spelarsession. | [Lobbykatalog](apps/studio/client/lobby/lib/catalog.mjs), [gemensamma adresser](packages/navigation/game-entry.mjs), [webbens start](apps/web/lib/server-ui.mjs) | Vercel → Render. `/game` väljer spel; motorns `/play/roulette` är ett internt dokumentsteg. `/play/blackjack` är en äldre redirect. | [Bolagsbunden start](test/game-entry-operator.mjs), [routing](test/platform-room-routing.mjs), okänt bolag/spel och saknad session. |
| Spel och pengar: servern avgör kort, sko, utfall och atomiska saldoförändringar. Klienten visar serverns tillstånd. | [Spelbackendens ansvar](services/game/README.md), [handregler](services/game/games/blackjack/round.mjs), [regelkärna](services/game/games/blackjack/core.mjs) och [bordsadaptrar](services/game/games/blackjack/table/) | Render → Neon. [Transaktionskärnan](packages/storage/README.md) får appens pool; den skapar ingen egen produktdatabas. | [Regelprov](test/blackjack-core.mjs), [PostgreSQL-/walletprov](test/postgres-shared-table.mjs), [rumsåtkomst](test/shared-room-access.mjs) och browserprov för klienten. Verklig PostgreSQL krävs för samtidighet. |
| Tal: generering, distribution och mediebunden uppspelning runt spelkärnan. | [Ingress](apps/speech/service.mjs), [genererad talruntime](packages/presentation/server/generated-speech-runtime.mjs), [Director-kontrakt](packages/director/product-speech.mjs), [Director-tjänst](services/openclaw/lab/src/server.mjs) och [spelmotorns taladapter](services/game/generated-speech-runtime.mjs) | Vercel-ingress, Render Director/Gateway och medielagring. | **Arbetet är pausat.** [Transportprov](test/platform-native-websocket.mjs) och [startprov](test/speech-startup.mjs) är inte godkänd rumsdistribution eller läppsynk; se [aktuellt läge](docs/NEXT-AGENT.md). |

Bolagsvyns route väljer bolaget: [CompaniesPage](apps/studio/client/admin/components/studio/companies-page.tsx) → [CompanyTeam](apps/studio/components/company-team.tsx) → [scopead teamläsning](apps/studio/lib/admin-workspace-data.mjs) → [bolags-API](apps/studio/lib/operator-admin-api.mjs). [Skapaformuläret](apps/studio/components/company-create.tsx) använder API-svarets bolags-id. Team behöver inte läsa projekt eller video; schema, kontoåtkomst och signer måste fortfarande vara tillgängliga.

Admins isolerade Provspel går från [förhandsvisningen](apps/studio/client/admin/components/studio/saved-scene-preview.tsx) via [startklienten](apps/studio/lib/studio-preview-client.mjs) till [serverns sessionshanterare](services/game/studio-preview.mjs) och [tabellen i minnet](services/game/preview-table.mjs). Det är en levande klient-/lagringsadapter skild från det delade bordet; [gränsproven](test/studio-preview.mjs) kontrollerar bland annat scope och återkallad åtkomst. Avveckling kräver att konsumenten ersätts; se [spelbackendens guide](services/game/README.md). Tekniska ord som `operator`, `lane`, `studio` och `croupier` översätts i [ordlistan](apps/studio/docs/TERMINOLOGI.md). Namnet ensamt avgör inte om koden används.

Generera den lokala, interaktiva **Atlas** med `python tools/system-map.py` (Python 3.10+ och Git). Öppna `.cache/system-map/index.html` direkt i webbläsaren; ingen server eller installation av paket behövs. Överblick, kodkedjor, sökbart kodnät och prov/luckor finns i samma karta. Välj en nod eller pil för konsumenter, kodankare och provreferenser. Ansvar kommer från tabellen ovan, handgranskade samband från kartans manifest och statiska JS/TS-referenser från spårad kod. Inget av detta bevisar runtimeanvändning eller godkända tester. [Kartans guide](tools/system-map/README.md) beskriver underhåll och begränsningar. Utdata är privat arbetsmaterial och ska inte publiceras som en produktvy.

## Identiteter

| Miljö | Tjänst | Identitet |
| --- | --- | --- |
| Produktion | GitHub | `Jakeminator123/scoutgaming`, repo-ID `1380630440`, målbranch `main` |
| Produktion | Vercel | team `scoutgaming` `team_Scxorb9qtZHjNae1YEQnFCaT`, projekt `scoutgaming` `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`, www.scoutgaming.tech; deployar `main` automatiskt. Projektets "Ignored Build Step" släpper bara igenom `main` (`vercel.json` delas av båda projekten och tillåter `main` och `preview`; filtret per projekt får inte tas bort) |
| Produktion | Render, workspace `tea-d19jsa63jp1c73ch0sc0` | spelmotor `croupier-v3` `srv-dbd6nfon74is73aiblf0` (manuell deploy efter grön CI); Director `croupier-lab-director` `srv-danhlpjtqb8s73bv530g`; Gateway `croupier-lab-openclaw` `srv-danhiv3tqb8s73burkq0` (privat tjänst) |
| Produktion | Neon | org "Vercel: scoutgaming" `org-green-butterfly-00780270`, projekt `croupier-production` `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game` med scheman `public`, `croupier_auth`, `croupier_game`, `croupier_studio` |
| Produktion | Blob | `croupier-media-private` `store_AqwvebTbBHarOjvG` |
| Preview | GitHub | samma repo, långlivad branch `preview` (skapad 2026-10-29 från `main` a05917c3); tar emot push från `main`/`jakob/*` och PR:er med bas `preview`. Rulesetet "preview: no deletion, no force push" (`26090808`) är aktivt utan bypass och förbjuder radering och force-push; pre-push-hooken ger dessutom lokalt skydd |
| Preview | Vercel | projekt `scoutgaming-preview` `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14` (bytte namn 2026-10-29), preview.scoutgaming.tech (`CROUPIER_PUBLIC_ORIGIN`); den gamla adressen `croupier-k06-k07-staging.vercel.app` finns kvar som alias, och Vercels inloggningsskydd gäller alla adresser utom den egna domänen; deployar branchen `preview` automatiskt. Projektets "Ignored Build Step" släpper bara igenom `preview` (samma `vercel.json` som produktionen; filtret per projekt får inte tas bort) |
| Preview | Render | spelmotor `scoutgaming-preview-engine` `srv-dbf61l0m7kps73ft7mk0` (bytte namn 2026-10-29; adressen är fortfarande `https://croupier-k06-k07-staging.onrender.com`), byggs automatiskt från branchen `preview`; `CROUPIER_SHARED_TABLE_ENABLED=1` sedan 2026-10-27 |
| Preview | Neon | projekt `scoutgaming-preview` `red-violet-36066351` (verifierat 2026-10-30), branch `br-plain-voice-b9yu49xi`, databas `croupier_staging` |
| Preview | Blob | `croupier-k06-k07-staging` `store_7E06N1P4w9Mu1dZD` (riktigt, godkänt material får ligga här; aldrig produktionstoken eller riktiga spelardata) |
| Raderat | Render | `croupier-v2` och `croupier-vercel-preview-qa` raderades 2026-10-27 (Jakobs beslut). Äldre dokument som nämner dem beskriver historik. |

Andra tjänster i samma Render-workspace och Neon-orgen `org-lucky-cake-48388035` hör till andra projekt; rör dem inte. Kevin har läsrollen `kevin_migration_readonly` i produktionens Neon och sin GitHub-åtkomst (Jakobs beslut 2026-10-27). Hans brancher (`kevin*`, `codex/kevin-*`) rörs aldrig; bra beteenden skrivs om i mains moduler.

Git-gren, Vercel-projekt, Render-tjänst och Neon-projekt/branch är olika identiteter. Git `preview` använder det separata Neon-projektet `scoutgaming-preview`; en Neon-gren som heter `main` i det projektet betyder inte produktion. Följ projekt- och branch-ID:n i tabellen vid driftkontroll.

## Publiceringsordning

En godkänd leverans når produktion i denna ordning. Grön CI visar kodkontroller; ändringens uppdrag och relevanta driftvillkor avgör release:

1. Schemamigrering före kravhöjning: Jakob applicerar SQL i `ops/neon-*` (`node tools/check-migration-readiness.mjs --apply`) innan kod som kräver schemat mergas. CI läser produktionens migreringsledger.
2. Merge till `main` efter grön full CI. Vercel deployar `main` automatiskt.
3. Render `croupier-v3` deployas manuellt (Render MCP) efter varje grön merge; kontrollera `https://croupier-v3.onrender.com/__cloud/version` och `/__cloud/health`. Director och Gateway deployas om när deras kod ändras.
4. Admin-publicering (paket och rummets spelinställningar) sist, när koden är live.

`CROUPIER_SHARED_TABLE_ENABLED` (delat bord) är `=1` i produktionen sedan O03 (satt 2026-10-28 13:52Z, deploy `dep-dbgvsc5g1s2s73cdoqkg` på `5f5bc88d`) och i preview. F11:s överlapp och återanslutning är [driftverifierade på e8d0b935](docs/plans/organisation/F11-DRIFTKVITTO.md). En kod- och schemakompatibel Render-release har därför ingen generell F11-spärr med tomma bord; flaggbyte och publicering följer fortfarande sina egna tomt-bord-krav ([ENVIRONMENT-RESTORATION](docs/ENVIRONMENT-RESTORATION.md#återställ-den-samlade-produkten)). Se [ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling).

## Preview

Två miljöer räcker (Jakobs beslut 2026-10-29): `main` är produktion och branchen `preview` är preview. Preview är den tidigare stagingen, som behålls efter O03 (Jakobs beslut D5, 2026-10-28); Vercel-projektet heter `scoutgaming-preview` och Render-tjänsten `scoutgaming-preview-engine` (adressen `croupier-k06-k07-staging.onrender.com` är oförändrad), Neon-projektet heter `scoutgaming-preview` och Blob-lagret heter fortfarande `croupier-k06-k07-staging`. Källan är branchen `preview` på GitHub, inte längre en låst SHA via API: Vercel-projektet `scoutgaming-preview` deployar varje push till `preview` till preview.scoutgaming.tech, och Render-tjänsten byggs från samma branch. Till `preview` får bara `main` och `jakob/*` pushas (pre-push-hooken tillåter fast-forward, nekar radering, force-push och push från en lokal `kevin*`-checkout), aldrig Kevins arbete; `preview` är ingen featurebranch och mergas aldrig till `main`, inte heller indirekt: `origin/preview` mergas aldrig in i `main` eller en `jakob/*`-branch, och `merge-pr.mjs` nekar en PR mot `main` vars head bär previews historik. `preview` innehåller alltid `main`: så länge `preview` inte divergerat fast-forwardas den från `main` (`node tools/push-github-work.mjs --environment preview` på `main`), annars synkas den med en PR från `main` med bas `preview` som mergas med `node tools/merge-pr.mjs <nr> --head <full-sha> --base preview`. Preview är inget obligatoriskt steg före produktion: orkestratorn avgör när en visuell koll behövs. Jakob startar och stoppar Render-tjänsten; en agent startar den bara under ett prov och säger till när provet är klart. Testkonton är syntetiska, utöver Jakobs egna inloggningar (Admin och spelare) som speglats dit från produktionen (Jakobs beslut 2026-10-28). Previews Admin-inloggning ligger i gitignorerad `.env.local` under nycklarna `STAGING_ADMIN_LOGIN_UN` och `STAGING_ADMIN_LOGIN_PW`. Lösenord skrivs aldrig i Git eller chatt. Produktion och Johns Bet-demon rörs aldrig vid prov. Acceptanskvitton skrivs som `docs/*-ACCEPTANCE.json` med versions-, deploy- och databasidentiteter.

## Köra och testa

1. Node 24 via Volta (`apps/studio/package.json` pinnar versionen). `npm ci` i `apps/studio`, `services/game` och `services/astrid-gpu-worker/gateway`; `pnpm install` i `apps/web`. I en ny worktree behöver pre-commit `npm ci` i `apps/studio` och i det paket som provas.
2. `node apps/studio/start.mjs --no-open` skriver den publicerade lobbyns adress och startar inga lokala servrar.
3. Riktade prov: `node --test --test-concurrency=4 <filer>`. Sviter: `sh .githooks/pre-commit-full <svit>` med `studio`, `admin`, `contracts`, `database`, `presentation`, `access`, `speech`, `gameplay` eller `engine`. PGlite-proven (`test/fixtures/pglite-pool.mjs`) kör utan Postgres-installation; motorn över HTTP mot riktig Postgres körs med `node tools/run-engine-qa.mjs --postgres-bin <bin>`.
4. Pre-commit (`.githooks/pre-commit`) kör riktade kontroller på ändrade filer; `node tools/precommit-checks.mjs --plan` visar urvalet. Full regression och isolerad Postgres körs i CI (`.github/workflows/croupier.yml`) på PR:er som är klara för granskning, vid push till `preview`, nattligen på `main` (02:00 UTC) och manuellt, eller lokalt med `sh .githooks/pre-commit --full`. Push till `main` kör bara dokumentationskontroller, migreringsberedskap och Gateway-containern när dess indata ändrats; PR:ens egen CI har redan kört regressionen. Chrome-jobbet `Regression (browser)` körs på PR och krävs för `CI` när PR:en ändrar `services/game/public/**`, `apps/studio/client/**` eller `apps/studio/components/**` (`browserAcceptanceRequired` i `tools/ci-changes.mjs`); på andra PR:er blockerar det inte `CI`. Nattkörningen och push till `preview` kräver det alltid. En utkast-PR (draft) kör bara klassificering och `node tools/precommit-checks.mjs --pr-diff` (samma riktade kontroller på merge-diffen) och får ingen kontroll med namnet `CI` förrän den markeras klar; CI väljer dessutom regressionsben efter ändringens omfång (matrisen står i `tools/ci-changes.mjs`).
5. Prova det ändrade beteendet i preview när det behövs. För ett ändrat publicerings-/spelflöde följs Admin → spara → publicera → lobby → `/game?game=blackjack` → spelad hand → omladdning. Dokumentstädning kräver länkkontroll och dokumenthook. Ändrade talmedier behöver Jakobs ljud-/läppsynkacceptans; orelaterade godkända medier spelas inte om som generell grind.

## Leverera

1. `git fetch`, sedan egen branch `jakob/*` från färsk `origin/main` (Claude-underagenter: `jakob/claude-*` i en worktree under `.claude/worktrees`).
2. Committa med repots hookar, aldrig `--no-verify`. Läs `node tools/security-status.mjs` före push och merge.
3. `node tools/push-github-work.mjs` pushar och skriver PR-kommandot (eller `git push -u origin <branch>` och `gh pr create`). PR mot `main`, öppnad som klar (inte draft). Jakobs agenter skriver exakt `#Jakobs agent` på en egen synlig rad för sina verkliga uppdrag från Jakob; märkningen ersätter inte verifierat ägarskap. Ange också raden `Buggranskning: <verktyg/modell>, <nivå>, <fynd>` efter egen granskning av diffen ([AGENTS.md](AGENTS.md#leverans-och-merge)).
4. Den obligatoriska kontrollen heter `CI` och gäller PR:ens head; branchen behöver inte vara à jour med `main`. Vänta på grön CI, merga. Vem som får merga står i [AGENTS.md](AGENTS.md#leverans-och-merge); alla verifierade Jakobs agenter får inom sin tilldelning merga hans arbete med `node tools/merge-pr.mjs <nr> --head <full-sha>`. Samma ändrade filer, inklusive namnbyten, och kod på båda sidor i samma paket kräver ny CI mot aktuell main. En överlappning som enbart beror på granskade dokumentvägar kan passera först när den betrodda länkkontrollen godkänt det kombinerade trädet för exakt main/head. Okänd CI-bas eller ofullständigt underlag nekas; merga då in `origin/main` och låt CI köra om.
5. Till preview, när en ändring ska ses på preview.scoutgaming.tech före eller i stället för merge: `node tools/push-github-work.mjs --environment preview` från `main` eller `jakob/*` (fast-forward av `preview` till HEAD; flaggan krävs även på en lokal `preview`). Har `preview` divergerat nekar verktyget; öppna då en PR med bas `preview` (`gh pr create --base preview --head jakob/<branch>`), så gör GitHub mergen på preview-sidan. Merga aldrig `origin/preview` in i `main` eller en `jakob/*`-branch: det drar previews innehåll in i nästa PR mot `main`, och `merge-pr.mjs` nekar en sådan head. En PR mot `preview` mergas av en verifierad Jakobs agent inom sin tilldelning med `node tools/merge-pr.mjs <nr> --head <full-sha> --base preview` efter grön `CI` (samma ägar-, CI- och kevin-kontroller som mot `main`) eller av Jakob personligen; agenter använder aldrig GitHubs merge-knapp. `main` är fortfarande den enda produktvägen: en ändring på `preview` når produktionen bara via en PR från sin `jakob/*`-branch mot `main`.
6. Uppdatera [docs/NEXT-AGENT.md](docs/NEXT-AGENT.md) vid överlämning. Samordning sker i PR:er och [teaminboxen](inbox/README.md).

## Kanoniska dokument

| Fråga | Dokument |
| --- | --- |
| Läge, återstående arbete, kända fällor | [NEXT-AGENT](docs/NEXT-AGENT.md) |
| Regler för agenter | [AGENTS](AGENTS.md) |
| Vad orden betyder | [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md) och Admins Hjälp `/admin/guide` |
| Arbetssteg i Admin | [användarguiden](apps/studio/docs/README.md) |
| Drift, moln och återställning | [CLOUD-MIGRATION](docs/CLOUD-MIGRATION.md), [ENVIRONMENT-RESTORATION](docs/ENVIRONMENT-RESTORATION.md), [RENDER-V3](ops/cloud/RENDER-V3.md) |
| Miljövariabler | [ENVIRONMENT-VARIABLES](docs/ENVIRONMENT-VARIABLES.md) |
| Lagrings- och uppspelningskontrakt | [LOCAL-PRESENTATION-RUNTIME](docs/LOCAL-PRESENTATION-RUNTIME.md) |
| AI-verktyg och OpenClaw | [docs/AI](docs/AI/README.md) |
| Alla dokument: vad, för vem, när de uppdateras | [docs/README](docs/README.md) |
| Aktuell organisationskörning och releasebevis | [KORPLAN-v2](docs/plans/organisation/KORPLAN-v2.md), [F11-DRIFTKVITTO](docs/plans/organisation/F11-DRIFTKVITTO.md) |
| Raderade dokument (historiken läses i Git) | [HISTORIK](docs/HISTORIK.md) |
