# Orkestratorns överlämning, 8 oktober 2026 kl 01:00

Du tar över som orkestrator för Croupier/Scoutgaming. Du granskar, beslutar inom Jakobs
ramar, delegerar till underagenter och mergar. Läs i ordning: `AGENTS.md`, `CLAUDE.md`,
`.cursor/rules/subagents.mdc`, den här filen, `lab/docs/TERMINOLOGI.md`,
`random/beslutsmatris-2026-10-07.md` (rader 37–44 är öppna), `random/losa-tradar-2026-10-07.md`
(L1–L24), översta tabellen i `docs/JOHN-HANDOFF.md`.

## Startrutin

```
git fetch origin main && git status            # ska vara rent och i nivå
node tools/agent-talk.mjs status <ditt-id>
node tools/inbox.mjs list --to me              # Jakobs inbox på main
node tools/security-status.mjs                 # bara läsning
gh run list --repo Jakeminator123/scoutgaming --branch main --limit 3
```

Produktion verifieras i Cursors webbvy inloggad som `LLM` på
<https://www.scoutgaming.tech/control/login>; Jakob loggar in, lösenordet är inte i Git.
Offline-labbet ger 500 på Neon-beroende sidor; verifiera i produktion.

## Jakobs ramar, ordagrant i sak

- Repots logik är facit. John styr design. Kevins nivå 2 anpassas till repot, inte tvärtom.
- Ingenting får bli sämre: ingen länk, åtgärd eller sida som nås i dag försvinner utan
  omdirigering eller Jakobs beslut. Rött test som går sönder av misstag återställs; test som
  kodar avsiktligt borttaget beteende skrivs om mot verifierat beteende och listas i commit.
- Tveksamt går till Jakob före merge. Han säger ofta "kör på det du föreslår"; då gäller
  rekommendationen, men varje avvikelse får en rad i matrisen.
- Agenter via Jakob pushar direkt till `main` med `node tools/push-github-work.mjs`. John,
  Kevin, Emil går via PR från sina grenar.
- Inga hemligheter i Git eller chatt. Högst fem Markdown-filer i `docs/`. Arbetsanteckningar
  i `random/`.
- Underagenter: `grok-4.7-xhigh-fast`, full brief, rapport slutar med `Tveksamt`.

## Vad en lane är, Jakobs ord 8 okt

Ett paket som ges till ett spelbolag. Det innehåller klipp och sekvenser som är skapade i
klippdelen på nivå 1. Bolaget får paketet och en begränsad redigeringsyta för egna
justeringar (bordsfärg, branding) och sina egna spelare. Klippdelen har fyra delar: idle,
action-sekvenser vid kortutdelning, klipp vid bakgrundsbyte, probe-sekvenser. OpenClaw är
hjärnan som ger råd och kan skriva till spelaren. Jakob kan ändra ytan något; det spelar
ingen roll för datamodellen.

## Läge, main = `32e4f702`

| Område | Klart | Kvar | Ungefär |
|---|---|---|---|
| Repo-hygien: CI, karta, tester, docs, inbox | Pinnad Ubuntu, körare för alla tester, D1–D32 rättade, teaminbox med `/ping`, terminologiblad | ffmpeg-cache (hängde igen 00:21, 8-min-gränsen fungerade), GPU-workflows, orphan-test-steg, karttrimning (rad 42) | 90 % |
| Nivå 1 skal och design | Johns skal, sidmall, en kodgeneration, ljust/mörkt | Johns rader 11, 12, 14, 17b; zones på mallen (43); ljust läge på två sidor; events+tree en sida (37) | 80 % |
| Klipplogik, ett system | Idle fungerar för Astrid | Deal i två system (38); bakgrund styr inte spelet (L16); probe ej verifierad (L4); tre dealers delvis (L19) | 30 % |
| Lane som produkt | Lagring `operator_packages` med lanes/spel/bord/branding | Skapa lane av delarna, exportera, bolagets yta, demo-operatör (L1–L3, rad 44) | 15 % |
| Nivå 2 | Inloggning, scopad data, medlemskap läsbart, spärr för sista admin i lagret | Skrivande rutter (L11), spelare/transaktioner (L10), onboarding, journal (L12), Kevins svar | 50 % |
| Nivå 3 | Lobby, profil, historik | Operatörskontext i lobbyn (L13), redigerbar profil | 60 % |

Mot Jakobs målbild: ungefär **hälften**. Av det som återstår är klipplogik + lane runt 60 %
av arbetet. Grov tid i agentdagar: klipplogik 2–3, lane-flöde 4–6, nivå 2-rutter 3–4,
Johns design 1, mekaniskt 0,5. Totalt 2–3 veckor om ett spår i taget, kortare parallellt.

## Tre spår, kan gå parallellt

| Spår | Brief | Rör | Krockar med |
|---|---|---|---|
| **K. Klipplogik** (svårast, först) | `random/prompt-klipplogik.md`. Steg 1–2 är fakta och förslag; Jakob säger go före kod | `lab/lib/studio-model.mjs`, `web/clip-mapping.mjs`, `web/presentation-api.mjs`, `lab/components/control-events-page.tsx`, `control-tree-page.tsx`, `lab-studio.tsx` | M rad 5 (zones) om den rör sidmallen; sekvensera |
| **M. Mekaniskt** | Nedan | `/control/activity`, tre texter, GPU-workflows, CI-steg, `/control/zones` | K bara via zones |
| **D. Johns design** | Skrivs när John svarat i #2, eller 9 okt enligt tvådagarsregeln | Sidmall, menyn, inloggningskortet, filterchips i klipplistan | K via `lab-studio.tsx` (klipplistan); gör D efter K steg 3 |

Lane-flödet (export, bolagets yta) startar efter K; det bygger på K:s datamodell.
Nivå 2-rutter startar efter Kevins svar i #3.

### Brief M, klistra in till en underagent

> Mekaniskt pass i `C:\Users\jakob\dev\projects\scoutgame`, main. Läs `AGENTS.md`,
> `random/handoff-2026-10-08-orkestrator.md`, `lab/docs/TERMINOLOGI.md`. En commit per punkt,
> grön CI mellan. (1) Rad 39: montera det rullande observationsfönstret
> (`createPartnerTrace({ rolling: true })`, läget `focused` i `ActivityLog`) på
> `/control/activity` så Uppspelning inte stannar vid 300 meddelanden; samma beteende som gamla
> Händelser-sidan. (2) L20–L22: tre gränssnittstexter enligt `random/losa-tradar-2026-10-07.md`.
> (3) `astrid-gpu-build.yml` och `astrid-gpu-publish.yml` till `ubuntu-24.04`. (4) ffmpeg i CI:
> cacha `.deb`-filerna med `actions/cache` nyckel `ubuntu-24.04-ffmpeg-<version>` så apt
> installerar från cache; nedladdning som reserv; ingen tredjepartsaction. (5) CI-steg "orphan
> tests": fel om en fil i `test/` eller `lab/test/` inte nås av någon körare (workflow,
> `tools/precommit-checks.mjs`, `.githooks/pre-commit-full`, labbets glob); undantag i en fil
> med motivering. (6) Rad 43: `/control/zones` på sidmallen, kortad text, alla funktioner kvar.
> Rör inte `events`, `tree`, `clips`, `studio-model.mjs`, `clip-mapping.mjs`,
> `presentation-api.mjs`. Bevarandelistan i `random/handoff-2026-10-07-kvall.md` gäller.
> Rapport med tabell per punkt och `Tveksamt`.

## Öppet hos människor

| Vem | Vad | Var |
|---|---|---|
| Jakob | Bekräfta rader 37–44; radera Vercel `scoutgaming-legacy-frontend` (40); Render manuell deploy av `croupier-v2`; rotera Neon-rollen `croupier_game`; stäng testping #4 | matrisen, Vercel, Render, Neon, #4 |
| John | Rader 4, 6, 11–15, 17–19, 17b. Terminologibladet är ett förslag tills han sett det | #2, fyra kommentarer, inget svar 01:00 |
| Kevin | Rad 7, T1–T3; acceptera GitHub-inbjudan | #3, ser den först efter accept |
| Emil | Acceptera GitHub-inbjudan (`EmaCodeHero`) | GitHub |

Tvådagarsregeln: svarar John inte i #2 senast 9 oktober körs rekommendationerna och han
ändrar efteråt.

## Fällor

- Pre-commit-kroken (`core.hooksPath .githooks`) stoppar lokalt på ffmpeg och jq om de
  saknas; `winget install Gyan.FFmpeg jqlang.jq`. `--no-verify` bara efter egen
  `node tools/precommit-checks.mjs --full` med `C:\Program Files\Git\bin` på PATH.
- `test/backup-render-state.mjs` föll en gång på EPERM i Windows TEMP, grönt vid omkörning.
- PowerShell saknar heredoc: commit-text via fil och `git commit -F`.
- CI `presentation-studio` kan falla på "Install ffmpeg when missing" när Ubuntus
  paketservrar hänger; `gh run rerun <id> --failed`. Punkt 4 i brief M tar bort orsaken.
- Cursor GitHub-appen saknar åtkomst till repot; molnagenter kan inte pusha. Kör lokalt.
- Vercel preview saknar databasvariabler; bara produktion går att verifiera.
- `stash@{0}` är ersatt av levererad kod; `git stash drop` när Jakob vill.
- Hooken kräver `lab/.next/BUILD_ID` (`open-claw/lab/deploy/local-connection.mjs:526`). Ett avbrutet
  `npm --prefix lab run build` tar bort den; bygg om före commit. Får `next build` ett typfel som
  `tsc --noEmit` inte ser ("has no exported member") är orsaken Nexts egen cache
  `lab/.next/cache/.tsbuildinfo`; ta bort den och bygg igen (8 okt natt).
- Flera underagenter i samma arbetsträd: committa inget förrän alla är klara, hooken testar hela
  trädet. Ge dem disjunkta filer; delade filer (`scout-navigation.mjs`, `routes.json`) redigerar
  orkestratorn själv efteråt.

## Filer per spår

| Spår | Läs först |
|---|---|
| K | `lab/lib/studio-model.mjs`, `lab/policies/project.seed.json`, `web/clip-mapping.mjs`, `web/presentation-api.mjs`, `lab/components/control-events-page.tsx`, `lab/components/idle-policy-editor.tsx`, `test/clip-mapping.mjs` |
| M | `lab/components/activity-log.tsx`, `lab/app/control/activity/page.tsx`, `.github/workflows/croupier.yml`, `tools/precommit-checks.mjs`, `lab/components/background-zones.tsx` |
| D | `lab/components/page-template.tsx`, `lab/lib/scout-navigation.mjs`, `lab/app/scout-theme.css`, `lab/components/studio-login.tsx` |
| Lane | `web/storage/operator-store.mjs`, `ops/neon-studio/005-operators.sql`, `lab/lib/partner-data.mjs`, `lab/lib/operator-catalog.mjs` |
