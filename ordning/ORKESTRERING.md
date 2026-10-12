# Orkestrering

Arbetssätt beslutat 2026-10-12: molnagenter, integrationsbranch och
milstolps-PR:er. Huvudcheckouten är `C:\Users\jakem\Projects\croupier`.
Orkestratorns worktree för integrationsbranchen är
`C:\Users\jakem\.cursor\worktrees\croupier\repo-ordning`.

## 0. Flödet i korthet

```text
origin/main ──merge──► jakob/repo-ordning (integrationsbranch, utkast-PR #19)
                            │  push
                            ▼
              molnagenter (grok-4.7-xhigh-fast), en branch var
                            │  push egen branch + rapport
                            ▼
              orkestratorn: granska → merge --no-ff → prov → push → CI på #19
                            │
              våg klar ──► PR jakob/repo-ordning → main (en PR per våg, Jakobs ok)
```

1. **Före varje omgång:** `git fetch origin --prune`, sedan
   `git merge --no-ff origin/main` i integrations-worktreen. Lös konflikter,
   uppdatera briefar och promptar efter det som ändrats, kör hela sviten och pusha.
2. **Starta** molnagenterna i ett meddelande (§3).
3. **När en agent är klar:** granska, merga in, prova och pusha (§6). CI körs
   på PR #19 för varje push.
4. **Milstolpe:** när en våg är inmergad och grön öppnas eller uppdateras PR:en
   `jakob/repo-ordning → main`. Den mergas först efter Jakobs ok och följs av en
   produktionskontroll.

**Påminnelse till Jakob:** arbetet ligger på `jakob/repo-ordning`, inte på
`main`. Orkestratorn påminner i varje statusrapport tills sista milstolpen är
mergad.

## 1. Roller

| Roll | Gör | Gör aldrig |
| --- | --- | --- |
| **Orkestrator** (denna chatt eller Jakob) | Mergar `main` in i integrationsbranchen, justerar briefar, startar agenter, granskar, mergar in agentbrancher, kör hela sviten, pushar, öppnar milstolps-PR:er, verifierar deploy, raderar inmergade agentbrancher och uppdaterar registret | Mergar till `main` utan Jakobs ok |
| **Molnagent** (`grok-4.7-xhigh-fast`, `environment: cloud`) | Arbetar på sin egen branch med sina ägda filer, kör riktade prov, committar och pushar sin branch och skriver rapport | Öppnar PR, mergar, pushar till `main` eller `jakob/*`, rör produktion, kör migrationer, rör filer utanför sin lista |

## 2. Integrations-worktree och beroenden (orkestratorn, PowerShell)

```powershell
$repo = 'C:\Users\jakem\Projects\croupier'
$wt   = 'C:\Users\jakem\.cursor\worktrees\croupier\repo-ordning'
node "$repo\tools\agent-talk.mjs" status masterplan
node "$repo\tools\agent-talk.mjs" claim masterplan "ordning,.git" "Synk/merge på jakob/repo-ordning"
git -C $repo fetch origin --prune
git -C $wt merge --no-ff origin/main -m "Merge origin/main into jakob/repo-ordning"
$locks = 'lab/package-lock.json','web/package-lock.json','services/astrid-gpu-worker/gateway/package-lock.json','apps/croupier-frontend/pnpm-lock.yaml'
foreach ($l in $locks) { "{0}: wt={1} main={2}" -f $l, (git -C $wt rev-parse "HEAD:$l"), (git -C $repo rev-parse "HEAD:$l") }
Remove-Item -Recurse -Force "$wt\lab\.next" -ErrorAction SilentlyContinue   # rent bygge efter merge
npm --prefix "$wt\lab" run build                 # krävs av full pre-commit, se nedan
```

- **Rent Studio-bygge efter varje merge.** Ett inkrementellt bygge efter
  `merge origin/main` gav 2026-10-12 ett tomt `lab/.next/prerender-manifest.json`.
  Servern kraschade då med "Unexpected end of JSON input", och launcher-provet
  fallerade med "fetch failed". Ta därför bort `lab/.next` före bygget.

- **Beroenden:** `$wt` har kataloglänkar till huvudcheckoutens `node_modules`
  (`lab`, `web`, `services\astrid-gpu-worker\gateway`, `apps\croupier-frontend`).
  De gäller när låsfilernas Git-blobbar är lika (`rev-parse` ovan) och
  huvudcheckouten är installerad från dem. Skiljer de sig: ta bort länken och kör
  `npm --prefix "$wt\lab" ci` (motsvarande för övriga). Exempel: Dealer Forge
  lade till `sharp` i `lab`. Skapa länkarna med versal enhetsbokstav
  (`C:\Users\…`). Med `c:\Users\…` läser webpack in Next två gånger, och
  frontendbygget faller på "`<Html>` should not be imported outside of
  pages/_document" när `/404` förrenderas. Ta bort en länk med `cmd /c rmdir`,
  som lämnar målet orört.
- **Bygg Studio före varje full svit.** Provet
  `open-claw/lab/deploy/local-connection.test.mjs` ("launcher starts isolated
  native and the real Next Eventstudio …") kräver ett verifierat
  Next-produktionsbygge i `lab/.next`. Utan bygget stoppas commiten med
  "A verified Next production build is required" (sett 2026-10-12).
- **Full svit utan commit:** `node tools/precommit-checks.mjs --full` (cirka
  3,5 minuter lokalt). En svit i taget på maskinen.
- Starta inga lokala servrar (`lab/start.mjs`) från integrations-worktreen
  medan en annan session kör.

## 3. Starta molnagenter (Task-verktyget)

| Parameter | Värde |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `grok-4.7-xhigh-fast` |
| `environment` | `cloud` |
| `cloud_base_branch` | `jakob/repo-ordning` (måste vara pushad med senaste ändringar) |
| `run_in_background` | `true`, alla i samma meddelande |
| `description` | `Ordning A10 3D-spåret` (unik per aktivitet) |
| `prompt` | Mallen nedan, fullständigt ifylld |

Molnagenter kör på egna VM:ar, så antalet begränsas inte av den lokala
maskinen. Orkestratorn mergar in dem i den ordning som §5 anger.

### Promptmall (molnagent)

```text
Du är molnagent för aktivitet {ID} ({TITEL}) i ordningsplanen för repot Jakeminator123/scoutgaming.
Du arbetar i en Linux-VM. Repot är utcheckat från branchen jakob/repo-ordning, en integrationsbranch som
innehåller färsk main och planen i ordning/. Använd bash. Windows-sökvägar, PowerShell, agent-talk och
"orkestratorn"-steg i planfilerna gäller inte dig. node-, git- och rg-kommandona fungerar likadant.

LÄS I ORDNING:
1. ordning/README.md
2. ordning/ORKESTRERING.md, avsnitt 4 "Regler för agenter"
3. ordning/BASLINJE.md (särskilt §6 känd rörelse, §7 toleranser, §8 produktionsfakta)
4. ordning/aktiviteter/{FIL}   <- din uppgift; följ stegen
5. AGENTS.md (regler för media, spelmotor och dokument)

JAKOBS BESLUT SOM GÄLLER: {B-id: text ordagrant, eller "inga"}
ÄGDA FILER: {lista}
JUSTERINGAR FÖR DENNA OMGÅNG: {orkestratorns ändringar mot aktivitetsfilen, eller "inga"}

MILJÖ: Använd Node 24 (som CI) om det finns. Installera beroenden bara när ett prov kräver det:
npm --prefix lab ci; npm --prefix web ci --ignore-scripts;
npm --prefix services/astrid-gpu-worker/gateway ci --ignore-scripts;
npx --yes pnpm@10.33.2 --dir apps/croupier-frontend install --frozen-lockfile.
Installera ffmpeg med apt om ett prov kräver det och det går. Kör riktade prov plus
node docs/system-map/verify.mjs --check och node tools/check-orphan-tests.mjs. Hela pre-commit-sviten
körs av orkestratorn.

LEVERANS: committa på din egen branch, med engelska commitrubriker. En flytt med git mv är en egen
commit. Pusha din branch. Öppna ingen PR, merga inget, pusha aldrig till main eller jakob/*.

FÅR INTE: läsa eller skriva produktion (Neon, Blob, Render, Vercel), köra migrationer, skriva
hemligheter, läsa random-stuff-jakob/, köra docs/system-map/verify.mjs --refresh-baseline, ändra ett
rött befintligt test för att få det grönt, ändra filer utanför listan (behövs det: skriv under Tveksamt).

RAPPORT (sista meddelandet, högst cirka 300 ord plus bevis) med exakt dessa rubriker:
Branch och sista SHA · Gjort · Filer (ändrade/borttagna/nya) · Prov (kommando → resultat) ·
Avvikelse mot baslinjen (med origin/main-SHA) · Dokumentändringar som behövs · Kvar · Tveksamt
```

## 4. Regler för agenter

1. **Steg 0 i varje aktivitet:** kör `git log -1 --format="%H %s"`. Läs
   BASLINJE §6, kör de verktyg aktiviteten anger och jämför med baslinjen.
   Följ toleranserna i BASLINJE §7.
2. Ändra bara ägda filer. Behövs en annan fil: stoppa den delen och skriv det
   under `Tveksamt`.
3. **Inget blir sämre:** ta inte bort en nåbar sida, länk eller handling utan att
   motsvarande B-beslut står i prompten. Pensionerade adresser får en omdirigering.
4. **Tester:** ta bort ett test endast tillsammans med funktionen det skyddar,
   och lista varje borttaget test. Ett rött test som inte hör till aktiviteten
   ska stå i rapporten och lämnas orört.
5. **Delade filer:** i `.githooks/pre-commit-full`,
   `tools/orphan-tests-exceptions.json`, `docs/system-map/*.json`, `AGENTS.md`
   och `CLAUDE.md` ändras bara de egna raderna. Kör aldrig
   `--refresh-baseline`. Gult i systemkartan är tillåtet, rött är det inte.
6. **Dokument i våg 2:** ändra inte `docs/*.md`, `lab/docs/*` eller
   `lab/README.md`. Lista behovet under "Dokumentändringar som behövs";
   A17 för in ändringarna samlat.
7. **Media:** AGENTS.md:s medieregler gäller. Regenerera eller ersätt aldrig
   godkända filer. Avregistrera aldrig något som sparade projekt refererar (BASLINJE §8).
   Har media- eller spelarfiler ändrats, kör `node pipeline/audit-dealer-sync.mjs --probe`
   och redovisa resultatet.
8. **Miljövariabler:** varje tillägg, borttagning eller flytt av en fil som läser
   env uppdaterar `docs/environment-variables.json` (`sources`) och
   `docs/ENVIRONMENT-VARIABLES.md`. Kör sedan
   `node tools/check-environment-variables.mjs`.
9. **Flytt:** varje strukturell flytt är byggbar som helhet. `git mv`,
   importuppdateringar och nödvändiga konfigurations- och testvägar ligger i
   samma gröna commit, utan ändrad affärslogik. Git hittar ändå flytten
   (rename detection), så historiken följer med.
10. **Riktade prov:** kör `node --test <filer>` för det du rört, samt
    `node docs/system-map/verify.mjs --check` och
    `node tools/check-orphan-tests.mjs`.
11. **Tomma mappar:** Git spårar inga tomma mappar. Ta bort platshållare
    (`.gitkeep` m.m.) som bara håller en oanvänd mapp vid liv. Kontrollera med
    `git ls-files <mapp>` att inget spårat finns kvar.
12. **Ospårat lokalt material** (BASLINJE §9) finns inte i molnet. Skriv aldrig
    att det kan raderas, och skriv inte regler som skulle radera det.
13. **Ignorerade sökvägar:** `.ignore` (ripgrep) döljer `media/**/source`,
    `media/**/staging`, `media/layout.json`, `media/blob-index.json`, `vendor/`
    och binärer. Sedan B17 (A17) håller `.cursorignore` bara hemligheter,
    privata data och genererat; de spårade medietexterna ligger i
    `.cursorindexingignore`, som stoppar indexering men tillåter en uttrycklig
    läsning. `.cursorignore` begränsar
    också Cursors egna filverktyg (Read/Grep/Glob), medan terminal- och
    MCP-verktyg inte omfattas. Sök därför i **spårade** textfiler med
    `git grep -n <mönster> -- <sökvägar>` (läser bara spårat innehåll och
    struntar i `.ignore`) och läs enskilda filer med `git show HEAD:<sökväg>`.
    Använd inte `rg --no-ignore`: det tar med `lab/data/`, `web/data/` och annan
    privat lokal data. Läs aldrig `.env*`, `lab/data/`, `web/data/` eller
    `random-stuff-jakob/`.
14. **Rapport:** slutar alltid med `Tveksamt`. Skriv "inget" om det är tomt.
15. **"Ingen konsument" är bara en kandidat.** Innan en fil tas bort ska du
    kontrollera dynamiska sökvägar (mallsträngar, `path.join`, URL:er som byggs
    i koden), byggskript, manuella arbetsflöden (verktyg som körs för hand
    behöver ingen importör) och referenser i spårat käll- och stagingmaterial
    (`git grep` över alla spårade textfiler, även `media/**`). Ett läsfel är
    osäkerhet, aldrig tomt innehåll: verktygen i `ordning/verktyg/` avslutar med
    kod 2 och listar filer som inte kunde läsas.
16. **Täckning är ett leveranskrav.** Inventerande rapporter innehåller en
    täckningstabell från `node ordning/verktyg/coverage.mjs`: varje spårad mapp i
    aktivitetens omfång, med antal filer och storlek, och om den analyserats
    eller varför inte. Lokala, ospårade mappar finns inte i molnet. Molnagenter
    markerar dem aldrig som inventerade; de täcks av A19.

## 5. Delade filer och merge-ordning

| Fil | Berörs av | Regel |
| --- | --- | --- |
| `.githooks/pre-commit-full` | A03, A10, A11, A12, A14, A15, A16, A17, A18 | Egna testrader. Konflikter löses radvis vid merge. |
| `tools/orphan-tests-exceptions.json` | A10–A18 | Undantag bara med Jakobs ok |
| `docs/system-map/{routes,flows,contracts,catalog}.json` | A01, A10, A11, A12, A16, A18, A20–A23 | Egna poster. Baslinjen uppdateras bara i A99. |
| `apps/croupier-frontend/lib/server-ui.mjs`, `ops/cloud/vercel-ingress.mjs`, `apps/croupier-frontend/test/platform-ui.mjs`, `apps/croupier-frontend/tools/prepare-platform-ui.mjs` | A11, A16, A18, A20 | Merge i ordningen A18 → A11 → A16 → A20 |
| `docs/environment-variables.json`, `docs/ENVIRONMENT-VARIABLES.md` | A18, A22 | Egna poster |
| `docs/JOHN-HANDOFF.md` | A02, A17, A99, och andra agenter på `main` | `main` mergas in före varje omgång |
| `docs/CLOUD-MIGRATION.md` | A01, A17, A99 | Samma |
| `AGENTS.md`, `CLAUDE.md` | A03, A17, A20–A23 | A03 först |

Merge-ordning i omgång 1: rapporterna A04, A05, A06 och A30 →
A02 → A01 → A03 → A15 → A10 → A13 → A18. Senare omgångar: A11 → A12 → A14 →
A16 → A17. Därefter strikt sekventiellt.

## 6. Merge-in och leverans (orkestratorn)

```powershell
$b = '<agentens branch>'                        # står i rapporten
git -C $repo fetch origin $b
git -C $wt log --oneline "HEAD..origin/$b"
git -C $wt diff --stat "HEAD...origin/$b"       # bara ägda filer?
git -C $wt merge --no-ff "origin/$b" -m "Merge <ID>: <titel>"
```

1. Läs rapporten. Lyft allt under `Tveksamt` till Jakob. Tveksamma ändringar
   mergas inte in, eller backas ur (`git revert -m 1`) tills han svarat.
   **Integrationsgrind för raderingar:** innan en branch som tar bort filer
   mergas in, jämför dess lista med A04/A05:s klassning och med aktuell
   integrations-SHA:
   - `git diff --name-status --diff-filter=D HEAD...origin/<branch>` ger listan;
   - för varje borttagen fil: `git grep -n <filnamn>` över alla spårade
     textfiler på integrationsbranchen, inklusive `media/**`, plus kontroll av
     dynamiska sökvägar och manuella arbetsflöden enligt §4 punkt 15;
   - bara filer märkta `säker` i A05 (eller som orkestratorn bevisat säkra)
     mergas in. Övriga återställs i samma merge
     (`git checkout <bas> -- <fil>` före merge-commiten) eller lyfts till Jakob.
   - `node ordning/verktyg/raderingsgrind.mjs <bas>` gör hela kontrollen på en
     gång, för en grupp merger: IMPORT (relativa importer som pekar på en
     borttagen fil), MENTION (hela sökvägen eller de två sista leden) och
     REGISTRY (rader i `media/layout.json` och `media/blob-index.json`).
     IMPORT och REGISTRY ska vara 0. Varje MENTION läses: ett vanligt
     tvåledsnamn som `streams/index.json` kan vara en levande fil.
   - **Registerkonflikt** mellan två raderande brancher i `media/layout.json`
     eller `media/blob-index.json` löses som unionen av båda sidornas
     borttagningar, i basens ordning, och med räkning: bas − A − B = resultat.
     Om någon sida har lagt till eller ändrat en post, eller ändrat något utanför
     `files`, löses konflikten för hand. Rader under `runtime/` avregistreras
     aldrig i våg 2.
2. Kontrollera att diffen bara rör ägda filer. Kör riktade prov i `$wt`, samt
   `node docs/system-map/verify.mjs --check` (0 röda) och
   `node tools/check-orphan-tests.mjs`.
3. Efter en grupp merger: bygg Studio, kör `node tools/precommit-checks.mjs --full`
   och, när frontendkod ändrats, `pnpm --dir apps/croupier-frontend build`.
4. `node tools/security-status.mjs`: inga nya öppna incidenter.
5. Pusha integrationsbranchen från `$wt`, utan bypass:
   ```powershell
   Set-Location $wt
   node tools/push-github-work.mjs --check   # förhandskontroll, pushar inget
   node tools/push-github-work.mjs           # pushar aktuell branch, jakob/repo-ordning
   ```
   Sedan A03 (B1) levererar `push-github-work.mjs` aktuell branch när den
   matchar `jakob/*`, `codex/*` eller `cursor/*`. Pre-push kör
   `check-push-target.mjs`: godkänd destination, branch och ref, förbud mot
   radering, taggar och historikomskrivning, samt systemkartan för de
   transporterade commitarna. `--no-verify` används inte. `main` nås bara via
   PR; `--admin-main` är Jakobs uttryckliga nödväg.
6. CI på PR #19: `gh pr checks 19 --watch --fail-fast` i bakgrunden. Vid fel:
   `gh run view <id> --log-failed`, filtrerat på felrader.
7. Radera den inmergade agentbranchen:
   `gh api -X DELETE repos/Jakeminator123/scoutgaming/git/refs/heads/<branch>`.
8. Uppdatera registret i README (`inmergad`) och committa det med nästa merge.
9. **Milstolpe:** när vågens aktiviteter är inmergade och CI är grön:
   uppdatera PR #19:s brödtext, eller öppna en ny PR från samma branch efter en
   tidigare merge. Ta bort utkastläget och be Jakob om ok. Efter merge:
   kontrollera att Render-deployen för `croupier-v2` är live och att Vercel är
   READY, och kör acceptansen i A99 §"Acceptans": verkliga, godkända bolag
   och spelrum, hela kedjan N1 → publicering → N2 → N3, tre lager på mobil och
   desktop, två uppspelningar i rad, tal/OpenClaw via testadapter, och negativa
   prov.

## 7. Återställning

- En inmergad agentbranch backas ur med `git revert -m 1 <merge-sha>` på
  integrationsbranchen.
- En mergad milstolpe återställs med en revert-PR mot `main`.
- Borttagna filer finns kvar i Git-historiken:
  `git checkout 00ea55c5 -- <sökväg>`. Originalmedia före historikrensningen
  finns i den privata backupen (`docs/ENVIRONMENT-RESTORATION.md`, BASLINJE §8).
- Rör aldrig `lab/data`, `web/data` eller lokala sparade profiler vid återställning.

## 8. Om Jakob kör själv

Varje aktivitetsfil fungerar som startprompt för en molnagent eller en ny
Cursor-chatt med grok 4.7 extra hög snabb. Fyll i promptmallen i §3. Lokalt
fungerar samma mall med en egen worktree enligt §2.
