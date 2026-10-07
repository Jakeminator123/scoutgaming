# Handoff 7 oktober 2026, natt

För nästa chatt. Läs i ordning: `AGENTS.md`, `CLAUDE.md`, den här filen. Status och kvitton står i
`docs/JOHN-HANDOFF.md`, beslut i `random/beslutsmatris-2026-10-07.md` (rader 34–36 och
sqlite-tabellen), lösa trådar i `random/losa-tradar-2026-10-07.md` (L1–L24).

## Läge

Pass A–C från `random/handoff-2026-10-07-kvall.md` är levererade på `main`.

| Commit | Innehåll | CI |
|---|---|---|
| `1aba4ff6` | A. Teststädning: körare för lösa tester, test-DOM och GitLab-inboxens verktyg borta, pensionerade namn | grön (med `8ebb53e2`) |
| `a2402600` | B. Dokumentation mot kod, D1–D32, L20–L23 | grön (med `8ebb53e2`) |
| `8ebb53e2` | Systemkartans baslinje, grå med 0 röda | grön |
| `186c6bc4` | C. Lagret spärrar sista operatörsadmin (409, samma transaktion) | se senaste körning |
| efter `186c6bc4` | Den här överlämningen, beslutsmatris, lösa trådar, handoff | se senaste körning |

Kommentaren till John om rad 13 och 15 ligger i
[#2](https://github.com/Jakeminator123/scoutgaming/issues/2#issuecomment-6046505566).
GitGuardian har stått i kö sedan `a2c07702`; incidentlistan är inte läst.

Lokalt: kroken (`core.hooksPath=.githooks`) stoppar på `jq` i `test/bugshot-report.mjs`.
Leveranserna kördes med kontrollerna för hand och `git commit --no-verify`; CI har `jq`.

## Startrutin

```
node tools/agent-talk.mjs status <ditt-id>
node tools/inbox.mjs list --to me
node tools/security-status.mjs
git fetch origin main && git status
gh run list --repo Jakeminator123/scoutgaming --branch main --limit 1   # senaste CI ska vara grön
```

## Tveksamt, väntar på Jakob

- Backupformatet behåller `schema: 'croupier-lissabon-backup-v1'` så att gamla kopior går att
  verifiera; bara verktyg, test och funktionsnamn bytte namn.
- Chefens register ligger kvar i `.croupier-inbox/chef.json`, och låsets feltext säger "Inbox busy".
  AGENTS.md säger att katalogen inte ska återskapas; en flytt kräver ändring i chefen och ignore-filerna.
- CSS som inte stod i listan är kvar (`studio-shell`, `studio-brand`, `main-nav`, `studio-body`,
  `dealer-selector`, `studio-footer`), även om ingen `className` hittades.
- `test/backoffice-lab-browser.mjs` är uppdaterad men inte körd (opt-in, kräver servrar).
- Guiden på `/control/guide` visar L-nummer (t.ex. L13) i text för intern personal.
- Det rullande observationsfönstret monteras inte sedan `studio.tsx` togs bort (L23). Uppspelning
  stannar vid 300 meddelanden eller 4 MiB. Möjlig försämring från `/control`-passet.
- Spärren i C: ingen databasspärr, så SQL utanför lagret kan fortfarande ta bort sista admin. Utan
  pool med `connect()` ger även en ny roll 503. Samtidighetstestet körs mot minnesfixturen, inte
  riktig Postgres.

## Nästa

1. Designpasset nedan, när John har svarat i #2 på rader 11, 12 och 14 eller när Jakob säger att
   deadline har passerat.
2. Lås `.github/workflows/astrid-gpu-build.yml` (rad 15) och `astrid-gpu-publish.yml` (rad 21) till
   `ubuntu-24.04` före 19 oktober.
3. Små gränssnittstexter L20–L22, och beslut om L23 (montera rullande fönster på Uppspelning eller
   acceptera gränsen).
4. Inte ditt: Render-deploy (R), Neon-lösenordet (N), T2 och team-vyns serverkoppling (Kevin, L5,
   L11, L24), Johns rader.

## Startprompt: designpass för ljust läge (kör inte förrän villkoret ovan är uppfyllt)

Läs `AGENTS.md`, `CLAUDE.md`, `random/handoff-2026-10-07-natt.md`, issue #2 och beslutsmatrisens
rader 3, 11, 12 och 14. Gör först Johns rader enligt hans svar i #2: rad 11 (klipplistans
filterchips och triggerpiller), rad 12 (Administrationens fyra etiketter som djuplänkar till rätt
flik) och rad 14 (inloggningskortet med sidmallens tokens). Därefter ljust läge: ingen inre yta på
`/control` får vara mörk i ljust läge (rad 3), till exempel eventlistan på Händelser och korten i
OpenClaw-chatten. Använd tokens i `lab/app/scout-theme.css` och sidmallen, inga nya färger.
Bevarandelistan i `random/handoff-2026-10-07-kvall.md` gäller; rör inte spelmotor, plånbok, media
eller repliklistan. Offline-labbet ger 500 utan Neon, så verifiera i Cursors webbvy (inloggad som
`LLM` på https://www.scoutgaming.tech/control) efter deploy, med skärmbild i ljust och mörkt läge
per sida. Kör `npm --prefix lab test`, typecheck, build och `node docs/system-map/verify.mjs --check`.
Underagenter kör `grok-4.7-xhigh-fast`; rapporter slutar med `Tveksamt`. Leverera med
`node tools/push-github-work.mjs`, grön CI före nästa push, och uppdatera `docs/JOHN-HANDOFF.md`.
