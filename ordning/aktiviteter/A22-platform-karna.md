# A22 · `packages/platform`: delad kärna mellan spelmotor och Studio

| Fält | Värde |
| --- | --- |
| Våg | 3 · efter A21 · ensam · i två delar: utredning (22a), sedan en skiva i taget (22b, 22c …) |
| Väntar på | A21 · B12 (för 22b och framåt) |
| Branch / worktree | `jakob/ordning-a22a` (sedan `-a22b` …) · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a22a` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 45 % · spelmotorns och Studios lagring och behörighet |

## Mål

Kod som både spelmotorn (`web/`) och Studio (`lab/`) behöver ligger i
`packages/platform/`, med tydliga gränser: kontrakt, lagring, policy och media.
Inga appar importerar längre från varandras kataloger. Beteendet är oförändrat.

## Fakta (00ea55c5)

- `lab/lib → web(server)`: 125 importer. Mest använda:
  `web/storage/studio-contract.mjs` (37), `web/dealer-identity.mjs` (11),
  `web/presentation-layers.mjs` (9), `web/storage/operator-store.mjs` (8),
  `web/storage/presentation-package.mjs` (7),
  `web/storage/frozen-presentation-capture.mjs` (7),
  `web/presentation-room-contract.mjs` (6), `web/partner-access-policy.mjs` (4),
  `web/account-role.mjs` (4), `web/storage/studio-game-policy.mjs` (4),
  `web/presentation-capability-contract.mjs` (4),
  `web/storage/postgres-store.mjs` (3), `web/speech-reply-library.mjs` (3),
  `web/storage/studio-repository.mjs` (3) och ytterligare cirka 11 filer.
- `web(server) → lab/lib`: 34 importer. Mest använda:
  `lab/lib/studio-model.mjs` (10), `cloud-media-store.mjs` (6),
  `probe-policy.mjs` (4), `video-registry.mjs` (4), `video-intake.mjs` (3),
  `probe-fixtures.mjs`, `project-store.mjs`, `studio-media-runtime.mjs`,
  `idle-advice-server.mjs`, `media-file-types.mjs`,
  `speech-reply-blob-client.mjs`, `studio-access-policy.mjs`,
  `studio-game-authority.mjs` och `studio-native-auth.mjs`.
- Dessutom `lab/lib → web/public` (30), `lab/components → web/public` (21),
  `apps/croupier-frontend → web/public` (26) och `ops/cloud → web(server)` (10).
- Miljöregistret `docs/environment-variables.json` listar källfiler per tjänst.
  Flyttade filer som läser env måste uppdateras där (projektregel).
- Render bygger hela repot (`COPY . .`). Vercel-tjänsterna har roten
  `apps/croupier-frontend` och `lab`, med `outputFileTracingRoot` på repo-roten,
  så filer utanför roten följer med via spårning.

## 22a · Utredning (läsande)

1. Steg 0 enligt ORKESTRERING §4. Kör `node ordning/verktyg/cross-imports.mjs --edges`.
2. Bygg en graf över alla moduler som korsar `web` ↔ `lab/lib`: per modul,
   importörer på båda sidor, egna importer, sidoeffekter vid import, env-läsning,
   databas eller Blob, och om modulen är ren (kontrakt, validering).
3. Föreslå **skivor** i ordning från lägst risk:
   - (1) rena kontrakt (`studio-contract`, `dealer-identity`,
     `presentation-layers`, `presentation-room-contract`,
     `presentation-capability-contract`, `layer-asset-contract`, `account-role`,
     `partner-access-policy`) → `packages/platform/contracts/`;
   - (2) policy;
   - (3) lagring (`web/storage/*`, `lab/lib/project-store`, `video-registry` …);
   - (4) media (`cloud-media-store`, `video-intake` …).

   Ange per skiva filer, importörer, prov och risk. Ta också upp A21:s
   beroendekarta, `runtime → lab/lib`.
4. Rapport: `ordning/rapporter/A22a-platform.md`. Jakob godkänner skivorna (B12).

## 22b och framåt · En skiva per PR

1. Steg 0 och ombasering.
2. Commit 1: `git mv` till `packages/platform/<del>/`. Commit 2: sökvägar i alla
   importörer. Inga omvägsfiler ("shims") om det inte finns en extern konsument.
   Behövs en: dokumentera den och ta bort den i nästa skiva.
3. Uppdatera `docs/environment-variables.json` (`sources`) och
   `ENVIRONMENT-VARIABLES.md` för flyttade env-läsare. Kör
   `node tools/check-environment-variables.mjs`.
4. Uppdatera `docs/system-map/*.json` (källsökvägar) och rader i kroken.
5. Prov: alla tester som importerar skivan, partner- och åtkomsttesterna
   (`test/partner-access-policy.mjs`, `test/operator-store.mjs`,
   `lab/test/studio-access-policy.test.mjs`, `lab/test/partner-*.test.mjs`),
   spelmotorns tester (`test/shoe-game.mjs`, `test/fuzz-blackjack.mjs`,
   `test/table-http.mjs`) och lagringstesterna. Orkestratorn bygger Studio och
   frontend, kör hela sviten, och kör om möjligt den isolerade PostgreSQL-acceptansen
   som i CI.
6. Efter deploy (orkestratorn): N1-inloggning, `/partner/login`, ett rum i
   `/play` och rehearsal.

## Klart när

- [ ] 22a-rapporten finns och skivorna är godkända.
- [ ] Varje godkänd skiva är mergad och deployad, med gröna prov.
- [ ] `cross-imports.mjs` visar 0 importer `lab/lib ↔ web(server)` för flyttade moduler.

## Tveksamt att lyfta

- Moduler med sidoeffekter vid import.
- Allt som rör saldo, kortlek, publicerade paket eller behörighet. Beteendet ska
  vara bit-för-bit oförändrat.
