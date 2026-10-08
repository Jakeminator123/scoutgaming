# Prompt L8: spelmotorn läser operatörspaketet

Kör i en egen agent/chatt. **Modell: Claude Opus 5.5 (max) eller GPT-5.3-codex**, inte
grok fast – detta rör den serverägda spelvägen (kort, lanes, dealerval) och måste
resonera om säkerhet och fallback. Orkestratorn granskar före merge.

Skriven 8 okt 2026 av orkestrator 2 efter `79737a5d`. Checklista: L8, N3.2.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md`,
`docs/JOHN-HANDOFF.md`, `lab/docs/TERMINOLOGI.md` (Lane, Operatörspaket),
`random/checklista-2026-10-08.md` (L3, L8, N3.2), `random/k1-fakta-spelvagen-2026-10-08.md`
och `random/k2-forslag-2026-10-08.md` innan du rör kod. Ingen commit/push/branch utan
orkestratorns ord. Inget mot produktions-Neon eller Render: all körning sker mot isolerad
databas/annan hostname (AGENTS.md). Agent-talk-id `l8-paket`:
`node tools/agent-talk.mjs status l8-paket` vid start, var 30:e sekund, före rapport.

## Nuläge (fakta)

- Lane publiceras från `/control/lanes` → `POST /studio/api/admin/operator-package` →
  `publishPackage` i `web/storage/operator-store.mjs:453` → tabellen
  `croupier_studio.operator_packages` (`ops/neon-studio/005-operators.sql`):
  `operator_id, package_revision, lanes (id-lista), games, tables, branding`.
- Spelmotorn väljer lane i `web/server.mjs:1094–1105` för `/blackjack`:
  `studioPolicyRuntime.policy.readGameConfiguration()` → `gameLaneSelection(query,
  policy.gameLane, policy.gameLanes)` i `web/public/game-lanes.mjs:35`. `?lane=` kan bara
  välja inom serverns katalog; `?dealer=` bara för `indexed-video`.
- Spelaren har **ingen** koppling till ett bolag i dag (N3.2). `web/account-role.mjs`,
  auth i `web/`. Operatörer finns bara i `croupier_studio.operators`.
- Studio-projektets `lanes[]` (presentation lane: dealers, lager, OpenClaw) ligger i
  Studio-dokumentet (`lab/lib/studio-model.mjs:76–165`), inte i serverns katalog.
  `lab/lib/operator-package-api.mjs` kräver att publicerade lane-id:n finns i
  `project.lanes` (eller standardlanen `mobile-phone`).

## Mål

Spelmotorn läser det aktuella operatörspaketet och begränsar lane- och dealerval till
paketet, utan att dagens spelväg utan bolag blir sämre.

1. **Läsare i servern.** `web/storage/operator-package-reader.mjs` (nytt): läs senaste
   `package_revision` för `operator_id` i rätt scope med samma `sql`/scope-mönster som
   `operator-store.mjs` (`createOperatorStore(...).getCurrentPackage` kan återanvändas om
   serverns runtime redan har en pool mot `croupier_studio`; annars egen minimal läsning
   med taggad fråga `/* operator-package-reader:current */`). Cache ≤30 s per operatör.
   Fel i läsning → fallback till dagens beteende, loggat en gång, aldrig 500 för spelaren.
2. **Operatörskontext in i spelet, steg 1.** `/blackjack?operator=<slug>` (slug-regex
   som `lab/lib/partner-session.mjs:113`). Om slug finns och paketet finns: tillåtna lanes
   = `package.lanes ∩ policy.gameLanes`; `gameLaneSelection` får en `allowedLanes`-parameter
   (ny, valfri; utan den = dagens beteende, alla befintliga tester oförändrade). Begärd
   `?lane=` utanför paketet → paketets första tillåtna lane. Tom snittmängd → fallback
   till `policy.gameLane` + varning i serverlogg. Okänd slug → 404-sida `Bolaget finns
   inte`, inte fallback (ingen gissning).
3. **Dealerbegränsning.** Om Studio-projektets lane (läs via `studioPolicyRuntime.policy`
   om projektet exponeras där; annars `readSaved()`-motsvarigheten i `web/storage/
   studio-game-policy.mjs`) har `layers.dealer.allowed`, begränsa `?dealer=` till den
   listan; default = `layers.dealer.default`. Saknas lane i projektet → dagens regel.
4. **Exponera valet till klienten** i samma `decorateGameEntryHtml`-dataset som i dag
   (`gameLane`, `gameDealer`, `gamePresentation`) plus `gameOperator` (slug) och
   `gamePackageRevision`. Klienten (`web/public/app.mjs`, `game-lanes.mjs:48
   gameLaneFromDocument`) får läsa men inte välja om; validera i `gameLaneFromDocument`.
5. **Branding steg 0.** Lägg `gameBranding` (paketets `branding`, redan kanoniserad av
   `canonicalBranding`) i datasetet. Ingen rendering i detta pass; N3.4 använder det.
6. **Inget** i wallet, kort, shoe, payouts, auth rörs. `web/shoe-game.mjs` orörd.

## Tester

- `test/operator-package-reader.mjs`: minnes-sql med taggade frågor; senaste revision;
  saknat paket → null; sql-fel → null + en loggrad.
- `test/game-lanes.mjs`: `gameLaneSelection` med `allowedLanes`: snitt, utanför → första
  tillåtna, tom → fallback; befintliga tester oförändrade och gröna.
- `test/table-http.mjs` eller nytt `test/game-entry-operator.mjs`: `/blackjack?operator=
  sg-test` med fixturpaket `['mobile-phone']` ger `data-game-lane="mobile-phone"` och
  `data-game-operator="sg-test"`; okänd slug 404; utan `?operator` identiskt med i dag
  (snapshot av dagens HTML-dataset före/efter).
- `node test/fuzz-blackjack.mjs` grönt (motorn orörd).
- Kör `.githooks/pre-commit`-testerna.

## Rapport

Tabell Åtgärd | Status | Verifierat hur | Risk %. Exakt var paketet läses (fil:rad) och
vilken pool/scope. Vad som händer i varje fallback. Avsluta med **Tveksamt**: varje val
Jakob ska se före merge (särskilt 404 vs fallback för okänd slug, cache-tid, och om
Studio-projektets lane ska få styra dealern redan nu).
