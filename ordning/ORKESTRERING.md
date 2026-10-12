# Orkestrering

Så körs aktiviteterna med grok-agenter, av Jakob själv eller av en
orkestrerande chatt. Huvudcheckouten är `C:\Users\jakem\Projects\croupier`.

## 1. Roller

| Roll | Gör | Gör aldrig |
| --- | --- | --- |
| **Orkestrator** (Jakob eller en Cursor-chatt) | Skapar worktree och branch, registrerar claims, startar underagenter, granskar, kör full pre-commit, gör commit/push/PR, mergar efter Jakobs ok, verifierar deploy och uppdaterar registret i `README.md` | Mergar något tveksamt utan Jakobs ord |
| **Underagent** (`grok-4.7-xhigh-fast`) | Arbetar i sin egen worktree med sina ägda filer, kör riktade prov och skriver en rapport | Committar, pushar, skapar brancher, kör migrationer, rör produktion, startar `lab/start.mjs`, ändrar filer utanför sin lista |

## 2. Förbered en aktivitet (orkestrator, PowerShell)

```powershell
$repo = 'C:\Users\jakem\Projects\croupier'
$id   = 'a10'                                   # aktivitetens id, gemener
$wt   = "C:\Users\jakem\.cursor\worktrees\croupier\ordning-$id"
$base = 'origin/main'                           # 'origin/jakob/repo-ordning' om planen ännu inte är mergad (B2)

node "$repo\tools\agent-talk.mjs" status "ordning-$id"
node "$repo\tools\agent-talk.mjs" claim "ordning-$id" ".git" "Skapar worktree för $id"
git -C $repo fetch origin --prune
git -C $repo worktree add -b "jakob/ordning-$id" $wt $base
git -C $wt branch --unset-upstream              # ingen oavsiktlig push till main
$locks = 'lab/package-lock.json','web/package-lock.json','services/astrid-gpu-worker/gateway/package-lock.json','apps/croupier-frontend/pnpm-lock.yaml'
git -C $repo diff --quiet HEAD $base -- $locks   # 0 = huvudcheckoutens låsfiler = basens
if ($LASTEXITCODE -eq 0) {
  foreach ($d in 'lab','web','services\astrid-gpu-worker\gateway','apps\croupier-frontend') {
    cmd /c mklink /J "$wt\$d\node_modules" "$repo\$d\node_modules"
  }
} else {
  npm --prefix "$wt\lab" ci; npm --prefix "$wt\web" ci --ignore-scripts
  npm --prefix "$wt\services\astrid-gpu-worker\gateway" ci --ignore-scripts
  npx --yes pnpm@10.33.2 --dir "$wt\apps\croupier-frontend" install --frozen-lockfile
}
npm --prefix "$wt\lab" run build                 # krävs av full pre-commit, se nedan
node "$repo\tools\agent-talk.mjs" claim "ordning-$id" "<ägda sökvägar, kommaseparerade>" "<kort uppgift>"
```

- **Bygg Studio i varje ny worktree före första commit.** Provet
  `open-claw/lab/deploy/local-connection.test.mjs` ("launcher starts isolated
  native and the real Next Eventstudio …") kräver ett verifierat
  Next-produktionsbygge i `lab/.next`. CI bygger det före sviten. Utan bygget
  stoppas commiten med "A verified Next production build is required" (sett
  2026-10-12). Bygg om efter ändringar i `lab/` innan commit.

- Kataloglänkarna för `node_modules` gäller bara när låsfilerna är identiska med
  huvudcheckoutens och dess `node_modules` är installerade från dem. Skriptet
  ovan kontrollerar låsfilerna. Exempel: Dealer Forge (`234614e3`) lade till
  `sharp` i `lab`, så en äldre huvudcheckout räcker inte för en worktree på nyare
  bas. Ändrar en aktivitet beroenden: ta bort länken och kör riktig installation
  enligt `else`-grenen.
- Kör inte `npm ci` i huvudcheckouten medan worktree-prov pågår.
- Läsande aktiviteter (A04, A05, A06, A30 fas 1) kan dela en worktree, eftersom
  de bara skriver i `ordning/rapporter/`.

## 3. Starta underagenter (Task-verktyget)

| Parameter | Värde |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `grok-4.7-xhigh-fast` |
| `run_in_background` | `true` när flera körs parallellt, alla i samma meddelande |
| `description` | `Ordning A10 3D-spåret` (unik per aktivitet) |
| `prompt` | Mallen nedan, fullständigt ifylld |

Högst fyra underagenter samtidigt. De delar maskinens CPU med testsviterna.

### Promptmall

```text
Du är underagent för aktivitet {ID} ({TITEL}) i ordningsplanen för repot Jakeminator123/scoutgaming.

ARBETSYTA: {WT} på branch jakob/ordning-{id}. Alla läsningar, ändringar och kommandon sker där
(Shell: working_directory={WT}; filverktyg: absoluta sökvägar under {WT}). Rör aldrig
C:\Users\jakem\Projects\croupier eller andra worktrees, utom att köra
node C:\Users\jakem\Projects\croupier\tools\agent-talk.mjs status ordning-{id}
vid start och före rapport. Läs pingar där; registrera inga egna claims.

LÄS I ORDNING:
1. {WT}\ordning\README.md
2. {WT}\ordning\ORKESTRERING.md, avsnitt 4 "Regler för underagenter"
3. {WT}\ordning\BASLINJE.md
4. {WT}\ordning\aktiviteter\{FIL}   <- din uppgift; följ stegen exakt
5. Rapporter som din aktivitet anger under "Underlag" i {WT}\ordning\rapporter\
6. {WT}\AGENTS.md (regler för media, spelmotor och dokument)

JAKOBS BESLUT SOM GÄLLER: {B-id: beslutstext ordagrant, eller "inga"}
ÄGDA FILER: {lista från aktivitetsfilen, justerad av orkestratorn}

FÅR INTE: committa, pusha, skapa brancher eller worktrees, köra migrationer, läsa eller skriva
produktion (Neon, Blob, Render, Vercel, GitGuardian-ändringar), starta lab/start.mjs eller servrar
på standardportar, köra docs/system-map/verify.mjs --refresh-baseline, läsa
random-stuff-jakob/jakob-docs/arkiv/, skriva hemligheter, ändra ett rött befintligt test för att
få det grönt.

LEVERERA en rapport (högst cirka 300 ord plus bevis) med exakt dessa rubriker:
Gjort · Filer (ändrade/borttagna/nya) · Prov (kommando → resultat) · Avvikelse mot baslinjen
(med aktuell origin/main-SHA) · Dokumentändringar som behövs · Kvar · Tveksamt
```

### Parallell start av våg 1 (exempel)

Ett meddelande med sex Task-anrop (A01–A06), alla med
`run_in_background: true` och var sin `{WT}`. Läsande aktiviteter kan dela
`ordning-inventering`. Orkestratorn väntar på aviseringarna och pollar inte.

## 4. Regler för underagenter

1. **Steg 0 i varje aktivitet:** kör `git log -1 --format="%H %s" origin/main`
   och `git log --oneline 00ea55c5..origin/main -- <ägda sökvägar>`, kör
   verktygen som aktiviteten anger och jämför mot `BASLINJE.md`. Följ
   den kända rörelsen i BASLINJE §6 och toleranserna i §7.
2. Ändra bara ägda filer. Behövs en annan fil: stoppa och skriv det under
   `Tveksamt`.
3. **Inget blir sämre:** ta inte bort en nåbar sida, länk eller handling utan att
   motsvarande B-beslut finns i prompten. Pensionerade adresser får en
   omdirigering.
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
   godkända filer. Har media- eller spelarfiler ändrats, kör
   `node pipeline/audit-dealer-sync.mjs --probe` och redovisa resultatet.
8. **Miljövariabler:** varje tillägg, borttagning eller flytt av en fil som läser
   env uppdaterar `docs/environment-variables.json` (`sources`) och
   `docs/ENVIRONMENT-VARIABLES.md`. Kör sedan
   `node tools/check-environment-variables.mjs`.
9. **Flytt:** använd `git mv`, utan innehållsändring i samma steg. Uppdatera
   sedan importerna.
10. **Riktade prov:** kör `node --test <filer>` för det du rört, samt
    `node docs/system-map/verify.mjs --check` och
    `node tools/check-orphan-tests.mjs`. Hela pre-commit-sviten körs av
    orkestratorn, en åt gången.
11. **Skal:** PowerShell saknar heredoc. Använd `rg`, filtrera utdata och läs
    stora filer med offset/limit.
12. **Rapport:** slutar alltid med `Tveksamt`. Skriv "inget" om det är tomt.

## 5. Delade filer och merge-ordning

| Fil | Berörs av | Regel |
| --- | --- | --- |
| `.githooks/pre-commit-full` | A03, A10, A11, A12, A14, A15, A16, A17 | Egna testrader. Ombasera före merge och lös konflikter radvis. |
| `tools/orphan-tests-exceptions.json` | A10–A17 | Lägg bara till undantag med Jakobs ok |
| `docs/system-map/{routes,flows,contracts,catalog}.json` | A01, A11, A12, A16, A20–A23 | Egna poster. Baslinjen uppdateras bara i A99. |
| `apps/croupier-frontend/lib/server-ui.mjs`, `ops/cloud/vercel-ingress.mjs`, `apps/croupier-frontend/test/platform-ui.mjs` | A11, A16, A20 | Merge i ordningen A11 → A16 → A20 |
| `docs/JOHN-HANDOFF.md` | A02, A17, A99 | A02 i våg 1, A17 i våg 2, A99 sist |
| `docs/CLOUD-MIGRATION.md` | A01, A17, A99 | Samma |
| `AGENTS.md`, `CLAUDE.md` | A03, A17 (rader om media/legacy), A20–A23 (sökvägar) | A03 först |

Merge-ordning: **våg 1** A04, A05, A06 (rapporter) → A02 + A01 i samma PR
eller A02 först → A03. **Våg 2:** A10 → A11 · A12 · A13 · A15 → A14 · A16 →
A17. **Våg 3–4:** strikt sekventiellt.

## 6. Granska och leverera (orkestrator)

1. Läs rapporten. Lyft allt under `Tveksamt` till Jakob innan något mergas.
2. `git -C $wt status --short` och `git -C $wt diff --stat origin/main`:
   bara ägda filer får vara ändrade.
3. I `$wt`: `node docs/system-map/verify.mjs --check` (0 röda),
   `node tools/check-orphan-tests.mjs`, och
   `node tools/check-environment-variables.mjs` om env berörts.
4. Bygg när koden berör dem: `npm --prefix lab run build` (Studio) och
   `pnpm --dir apps/croupier-frontend build` (webb). En byggprocess i taget.
5. Säkerhet: `node tools/security-status.mjs`. Inga nya öppna incidenter.
6. Claim `.git`, sedan commit. Pre-commit kör hela sviten och ska vara grön.
   Använd aldrig `--no-verify` vid commit.
   ```powershell
   node "$repo\tools\agent-talk.mjs" claim "ordning-$id" "<ägda>,.git" "Commit/push $id"
   git -C $wt add -A -- <ägda sökvägar>
   git -C $wt commit -m "<rubrik>" -m "<brödtext: vad, varför, prov>"
   ```
7. Push. Tills B1 är genomförd blockerar pre-push andra brancher än `main`.
   Kör därför spärrens kontroll manuellt och pusha med `--no-verify`, som i
   PR #15 och #17:
   ```powershell
   node docs/system-map/verify.mjs --check --ref HEAD     # i $wt, ska ge 0 röda
   git -C $wt push --no-verify -u origin "jakob/ordning-$id"
   ```
8. PR: skriv brödtexten till en fil och kör
   `gh pr create --base main --head "jakob/ordning-$id" --title "<ID> <titel>" --body-file <fil>`.
   Använd `--draft` om `Tveksamt` är öppet.
9. CI: `gh pr checks <nr> --watch --fail-fast` i bakgrunden, sedan AwaitShell.
   Vid fel: `gh run view <id> --log-failed`, filtrerat på felrader.
10. Merge först efter Jakobs ok. Main har auto-deploy till Render och Vercel.
11. Efter merge, läsande: Render-deploy för `croupier-v2` live, Vercel-deploy
    READY, röktest av `/`, `/play` och `/control/login`. Har media eller
    spelare ändrats: rehearsal `?dealer=<namn>&rehearsal=1` för fyra dealers med
    två uppspelningar i rad, samt `?lane=layer-preview&rehearsal=1`.
12. `node "$repo\tools\agent-talk.mjs" done "ordning-$id" "<SHA, prov, kvar>"`.
    Uppdatera registret. Ta bort worktreen när PR:en är mergad eller stängd:
    `git -C $repo worktree remove $wt` (länkarna försvinner med mappen; kontrollera
    först att `git -C $wt status` är tom).

## 7. Återställning

- En mergad PR återställs med en revert-PR: `git revert -m 1 <merge-sha>` på en
  ny `jakob/revert-<id>`-branch, sedan PR.
- Borttagna filer finns kvar i Git-historiken:
  `git checkout 00ea55c5 -- <sökväg>`. Originalmedia före historikrensningen
  finns i den privata backupen (`docs/ENVIRONMENT-RESTORATION.md`).
- Rör aldrig `lab/data`, `web/data` eller lokala sparade profiler vid återställning.

## 8. Om Jakob kör själv

Varje aktivitetsfil fungerar som startprompt i en ny Cursor-chatt med modellen
grok 4.7 extra hög snabb. Klistra in promptmallen från §3 med värdena ifyllda.
Ge chatten ett eget worktree enligt §2, eller låt den skapa det om du uttryckligen
ber om det. Chatten gör då själv orkestratorns steg i §6.
