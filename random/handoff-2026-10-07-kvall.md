# Handoff 7 oktober 2026, kväll

För nästa chatt. Läs i ordning: `AGENTS.md`, `CLAUDE.md`, den här filen, sedan underlaget
för ditt pass (tabellen nedan). Status och kvitton står i `docs/JOHN-HANDOFF.md`.

## Startrutin

```
node tools/agent-talk.mjs status <ditt-id>
node tools/inbox.mjs list --to me
node tools/security-status.mjs
git fetch origin main && git status
```

Produktion verifieras i Cursors webbvy, som är inloggad som `LLM` på
<https://www.scoutgaming.tech/control>. Lösenordet finns inte i Git, och `.env.local`
innehåller inte längre `LLM_LOGIN_*` (Vercel skrev om filen 7 okt 18:52).

## Läge, main = `588d7802`

| Område | Läge |
|---|---|
| `/control` | En kodgeneration. Alla sidor på sidmallen; gamla `lab/components/studio.tsx` borttagen. Delat tillstånd i `lab/components/studio-session.tsx`, data via `lab/app/control-studio-data.tsx` |
| Adresser | `?dealer=&event=` på alla Studio-sidor, `&variant=` på Händelser och Klippbibliotek, `&tab=` på Händelser (event/triggers/variants) och OpenClaw (`chat`) |
| Borttaget | Inre sidomeny, spelväljare med Roulette, chattgenvägar, kort logg, sidfot, dubbla piller, sökattrapp, dold dealerlista, flikarna Probe/Bakgrund på Dealers & klipp (nu länkar), nio döda Kevin-adresser (404), rotens startfiler |
| Omdirigeringar | `/control/operator-chat` → `/control/openclaw?tab=chat`; `/control/backgrounds` → `/control/zones`; gamla `#probe`, `#background`, `#stream` → sina sidor |
| Kontroller | 942 labbtester (940 gröna, 2 skippade), typecheck, build, systemkartan gul utan fel, full regression lokalt utom `test/bugshot-report.mjs` (kräver `jq`) |

Beslut tagna av orkestratorn på Jakobs delegering: `random/beslutsmatris-2026-10-07.md`
rader 21–33, och kortversionen överst i `random/control-inventering-2026-10-07.md`.
Tabellen ligger som kommentar i issue #2 till John.

## Nästa pass

| Pass | Underlag | Filer | Parallellt? |
|---|---|---|---|
| A. Teststädning | `random/test-inventering-2026-10-07.md` | `test/`, `lab/test/`, `lab/components/*.test.mjs`, `.githooks/pre-commit-full`, `lab/lib/studio-navigation.mjs` | Ja med B |
| B. Dokumentation mot kod | `random/docs-avvikelser-2026-10-07.md`, `random/losa-tradar-2026-10-07.md` | `AGENTS.md`, `CLAUDE.md`, `README.md`, `lab/README.md`, `lab/docs/README.md`, `lab/docs/guide.json`, `docs/*.md`, `.cursor/rules/*.mdc` | Ja med A |
| C. Sista administratören på nivå 2 + granskning av sqlite-vägen | `random/losa-tradar-2026-10-07.md` L9, beslutsmatrisen rad 7 och "Större beslut" | `web/partner-access-policy.mjs`, `web/storage/operator-store.mjs`, tester | Efter A |

A och B rör olika filer. Kör dem i varsin chatt eller som två underagenter från en.

## Prompt A: teststädning

Du städar testsviten i `C:\Users\jakob\dev\projects\scoutgame` (main, GitHub
`Jakeminator123/scoutgaming`). Läs `AGENTS.md`, `CLAUDE.md`, `random/handoff-2026-10-07-kvall.md`
och `random/test-inventering-2026-10-07.md`. Underagenter kör `grok-4.7-xhigh-fast`;
varje rapport slutar med `Tveksamt`. Inventeringen är gjord; verkställ den.

1. Lägg in de sex gröna testfilerna som ingen körare startar i `.githooks/pre-commit-full`
   (`player-history`, `operator-store`, `check-migration-readiness`, `lane-media-audit`,
   `astrid-chat-visibility`, `performance-player-source`). Kör var och en först.
2. Ta bort test-DOM i rätt ordning: skriv om testet, sedan tas DOM:en bort. Gäller
   `sr-only`-texten "Nivå 1 · ScoutGamingGroup" i `lab/components/workspace-navigation.tsx`
   (krävs av `lab/test/studio-navigation.test.mjs`) och konstanterna
   `STUDIO_PRIMARY_NAVIGATION`/`STUDIO_TOOL_NAVIGATION` i `lab/lib/studio-navigation.mjs`
   som bara tester använder.
3. Pensionerade namn enligt inventeringens avsnitt (Lissabon-sidor, Backoffice/Lab,
   Kontrollpanel). Levande: `/bo` → `/control`, `studio/login`, flaggan `lissabon-stream-lane`.
4. `test/backoffice-lab-browser.mjs` väntar på menyn "Backoffice/Lab": uppdatera till
   dagens meny eller fråga Jakob.
5. `tools/croupier-inbox.mjs` i två steg (beslut P): flytta `identity` och `acquireLock`
   till `tools/croupier-chef.mjs` eller en liten delad modul, sedan bort med sina tester.
6. Död CSS för gamla Studio i `lab/app/globals.css` (`event-sidebar`, `studio-header`,
   `game-selector`, `sidebar-*`, `studio-chat-shortcuts`): ta bort det som inget använder.

Regler: ett rött befintligt test som går sönder av misstag återställs; ett test som kodar
avsiktligt borttaget beteende skrivs om mot verifierat beteende och listas i commit-texten.
Rör inte `web/shoe-game.mjs`, `pipeline/`, `media/`, `test/dealer-*`, `test/rigged-*`,
`test/speech-*`, `test/generated-speech*`. Bevarandelistan nedan gäller. Kör
`npm --prefix lab test`, typecheck, build, `node docs/system-map/verify.mjs --check`, och
`node tools/precommit-checks.mjs --full` med `C:\Program Files\Git\bin` på PATH (stoppar
lokalt på `jq` i `test/bugshot-report.mjs`; kör stegen efter den för hand). Leverera med
`node tools/push-github-work.mjs`, grön CI före nästa push, uppdatera `docs/JOHN-HANDOFF.md`.

Frågor till Jakob från inventeringen (lägg i Tveksamt, rör inte utan svar): får
`backup-lissabon-state` döpas om; ska `test/fixtures/astrid-camera-browser.html` bort; ska
`bo-lab-auth` fortsätta tillåta returvägen `/lissabon`; ska `player-area`, `landing-motion`
och `intro-device` in i `dealer-regression`.

## Prompt B: dokumentation mot kod

Du rättar dokumentationen i `C:\Users\jakob\dev\projects\scoutgame` (main). Läs `AGENTS.md`,
`CLAUDE.md`, `random/handoff-2026-10-07-kvall.md`, `random/docs-avvikelser-2026-10-07.md`
(32 avvikelser D1–D32) och `random/losa-tradar-2026-10-07.md` (19 lösa trådar L1–L19).
Underagenter kör `grok-4.7-xhigh-fast`; rapporter slutar med `Tveksamt`.

Grundregel: koden är facit. Där dokumentationen ligger efter koden rättas texten. Där den
lovar mer än koden skrivs att det inte är klart, med hänvisning till L-numret; ingenting
skrivs om som klart. Döda referenser tas bort eller pekas om.

Viktigast först: `AGENTS.md` (tabellens rad 2 och 3 säger att partnerinloggning och lobby
saknas; avsnittet om lokala servrar talar om startfiler som är borttagna, sessionsspärren
finns i `open-claw/lab/deploy/local-session.mjs`), `.cursor/rules/local-servers-and-tabs.mdc`
och `.cursor/rules/work-branch-mirror.mdc` (säger `github-work`), `lab/docs/README.md`
och `lab/docs/guide.json` (gamla namnen Nodträdet, Händelselogg, Videobanken; nya är
Händelser → klipp, Uppspelning, Klippbibliotek, Talgranskning, Guide & hjälp; OpenClaw har
flikarna Agentmodeller och Chatt), `README.md`, `lab/README.md`. Uppdatera `/control`-
beskrivningarna mot dagens sidor (se tabellen "Läge" ovan). Lägg en kort lista "Kopplingar
som saknas" i `docs/JOHN-HANDOFF.md` med L-nummer, där `koppling saknas: ja`.

Regler: högst fem Markdown-filer i `docs/`, inga nya rapporter, inga hemligheter. Kör
`node tools/check-environment-variables.mjs` om du rör miljövariabler. Kör
`node tools/precommit-checks.mjs` (dokumentationsläget) före commit. Leverera med
`node tools/push-github-work.mjs`.

## Prompt C: sista administratören på nivå 2, och granskning av sqlite-vägen

Läs `AGENTS.md`, `CLAUDE.md`, den här filen och `random/losa-tradar-2026-10-07.md` (L5, L9,
L11, L14). Nivå 1 har redan spärren mot att ta bort sista interna admin
(`lab/lib/studio-admin-data.mjs:155`). Bygg motsvarande för operatörsadmin i
`web/storage/operator-store.mjs`/`web/partner-access-policy.mjs`: en membership-ändring som
skulle lämna ett bolag utan aktiv admin avvisas med 409, i samma transaktion. Ingen UI-
koppling (T2 väntar på Kevin). Tester i `test/operator-store.mjs` och
`test/partner-access-policy.mjs`. Migration bara om absolut nödvändigt; i så fall först mot
produktions-Neon, sedan kod (AGENTS.md). Därefter en läsgranskning utan ändringar av
sqlite-vägen i `web/server.mjs` (11 grenar, 15 P6-referenser): vad används i produktion, vad
kan tas bort, vilka tester skyddar. Resultatet som rader i beslutsmatrisen; inget tas bort.

## Bevarandelista, rör ej i något pass

Användarkonton och roller i `croupier_auth.users` (admin, superadmin, staff, reader),
`croupier_studio.operator_roles`/`operator_memberships`, inbjudningar och
lösenordsåterställning, `/control/login`, `/partner/login`, spelarinloggning,
lane-paketen i `operator_packages`, de 39 ljudfilerna under `media/dealers/astrid`,
repliklistan `lab/lib/studio-voice-lines.mjs`, probe-ytan, spelmotor och plånbok.

## Kvar från /control-passet, inte gjort

- Situationen från en videomapp följer inte med till Händelser (händelsen öppnas, inte mappen).
- Systemkartans baslinje är inte uppdaterad; två gula poster kommer från andras ändringar
  (`.github/workflows/croupier.yml`, `apps/croupier-frontend/lib/platform-routing.mjs`).
- Probe kan inte bedömas utan körning i produktion (L4).
- Inte ditt: Render-deploy (R), Neon-lösenordet (N), team-vyns serverkoppling (T2),
  Johns rad 11, 12, 14 och 17b. Rad 13 och 15 är verkställda på delegering.
