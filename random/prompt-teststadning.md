# Prompt: teststädning (klistra in i en ny chatt)

Du städar testsviten i `C:\Users\jakob\dev\projects\scoutgame` (main, GitHub `Jakeminator123/scoutgaming`). Läs `AGENTS.md`, `CLAUDE.md` och `random/handoff-2026-10-07.md` först. Följ `.cursor/rules/subagents.mdc`: underagenter kör `grok-4.7-xhigh-fast`, och varje rapport slutar med en sektion `Tveksamt`.

## Mål

Testsviten ska spegla produkten som den är i dag: tre nivåer `/control`, `/partner`, `/play`, labbet under basePath `/studio`, spelmotorn på Render. Inga tester för borttagna produkter, inga tester som hålls vid liv av dold DOM, inga testfiler som ingen körare startar.

## Regler som inte får brytas

- Ingenting får bli sämre. Ett rött befintligt test återställs, det skrivs inte om för att bli grönt.
- Rör inte spelmotor, plånbok, media eller dealer-synk: `web/shoe-game.mjs`, `pipeline/`, `test/dealer-*.mjs`, `test/rigged-*.mjs`, `test/speech-*.mjs`, `test/generated-speech*.mjs`, `media/`.
- Skilj på pensionerat och levande. `/bo` → `/control` är en levande omdirigering i `web/server.mjs`; testerna för den stannar. Flaggan `lissabon-stream-lane` är ett levande lane-namn; den stannar. Produktnamnet "Lissabon" och sidorna `/lissabon`, `/lab`, `/labb` är pensionerade.
- `tools/croupier-inbox.mjs` är det nedlagda GitLab-verktyget, men `tools/croupier-chef.mjs` importerar `identity` och `acquireLock` därifrån. Flytta inte och radera inte utan Jakobs ja; föreslå i Tveksamt.
- Inga hemligheter i Git eller chatt. Inga nya Markdown-filer i `docs/`.
- Kör `node tools/agent-talk.mjs status <ditt-id>` vid start, claim före redigering, done efteråt.

## Steg 1: inventering, inga ändringar

Leverera en tabell innan du ändrar något. Jakob säger go per rad.

| Kolumn | Innehåll |
|---|---|
| Fil | sökväg |
| Körs av | `.github/workflows/croupier.yml`, `tools/precommit-checks.mjs`, `lab` `npm test`, `.githooks/pre-commit`, eller **ingen** |
| Status | grön, röd, skippad, opt-in |
| Bedömning | behåll, uppdatera, ta bort, fråga Jakob |
| Skäl | en mening |

Kända utgångspunkter (7 okt 2026):

- `test/` 140 filer, `lab/test/` 91, `lab/components/*.test.mjs` 18. Workflowen listar bara åtta `test/*.mjs` explicit; resten går via `tools/precommit-checks.mjs` och labbets glob. Kartlägg vilka filer ingen körare startar.
- Skippade tester finns i `test/backup-lissabon-state.mjs`, `test/backup-render-state.mjs`, `test/operator-speech-qa.mjs`, `test/postgres-persistence.mjs`, `test/sqlite-postgres-migration.mjs`, `lab/test/lab-video-manifest.test.mjs`, `lab/test/studio-login-form.test.mjs`, `lab/test/video-registry.test.mjs`. Avgör per skip: kräver miljö (behåll, dokumentera) eller dött (ta bort).
- Ordet `lissabon` finns i 17 testfiler, `/bo/` i 19, `studio/login` i 7, `gitlab` i 3, `croupier-inbox` i 3. Varje träff är antingen levande alias eller pensionerat namn; avgör vilket.
- `test/backoffice-lab-browser.mjs` (opt-in, Playwright) väntar på `navigation name 'Backoffice/Lab'`. Det namnet finns inte i det nya skalet; menyn heter nu `ScoutGamingGroup administration`. Testet är troligen rött.
- Dold DOM som bara finns för tester: `lab/components/workspace-navigation.tsx` har en `sr-only`-span "Nivå 1 · ScoutGamingGroup" som `lab/test/studio-navigation.test.mjs` kräver; dealerns gamla `<select>` ligger dold bakom chipsen i `lab/components/lab-studio.tsx` för ett äldre test (rad 10 i `random/beslutsmatris-2026-10-07.md`). Föreslå att testet uppdateras och DOM:en tas bort, i den ordningen.
- Två labbtester kräver `ffmpeg` (`lab/test/zone-cloud-store.test.mjs`). De är gröna i CI och röda lokalt utan ffmpeg. Det är miljö, inte skräp; lämna dem.

## Steg 2: ändringar, efter go

- Små commits, en sak per commit. Rubrik på engelska, brödtext får vara svensk.
- Varje borttaget test: skriv i commit-texten vilket beteende det skyddade och varför det inte längre finns.
- Varje uppdaterat test: nya förväntningen ska vara verifierad mot körande kod, inte mot vad du tror.
- Kör efteråt: `node tools/precommit-checks.mjs --full` (med `C:\Program Files\Git\bin` på PATH), `npm --prefix lab test`, `npm --prefix lab run typecheck`, `node docs/system-map/verify.mjs`.
- Leverera med `node tools/push-github-work.mjs` först när Jakob sagt ja till Tveksamt-listan. Ingen annan gren.

## Rapportformat

Kort. Tabell för inventeringen, punktlista för ändringarna, sist `Tveksamt` med varje beslut Jakob ska se.
