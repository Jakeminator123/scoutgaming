# A31 · Tung media ut ur Git-trädet

| Fält | Värde |
| --- | --- |
| Våg | 4 · efter A30 · ensam |
| Väntar på | A30 · B11 · A04 |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning`; Docker- och offlineproven gör orkestratorn lokalt |
| Modell | grok-4.7-xhigh-fast |
| Risk | 45 % · Render-imagen och offline-läget |

## Mål

Kvarvarande stora mediefiler som inte behöver finnas i Git ligger i Blob eller
i det privata arkivet. Registren pekar rätt, Render-imagen innehåller bara det
spelmotorn behöver och offline-läget fungerar.

## Viktigt om storlek

- Att ta bort filer ur trädet **krymper inte `.git`**: historiken behåller
  blobbarna. Vinsten är mindre checkout, mindre Render-image (`COPY . .`) och
  snabbare deploy. En ny historikrensning är ett separat beslut som inte ingår
  i planen.
- **Snabb vinst utan radering:** rader i `.dockerignore` för media som inte
  behövs i spelmotorns runtime. Det minskar imagen direkt och är lätt att återställa.
  Enligt produktionsläsningen är dealerfiler på disk inte reservkälla för
  molnuppspelningen (BASLINJE §8). Bekräfta vad offline-läget och `layer-packs`
  läser innan `media/dealers/**` utesluts.
- **Får inte tas bort:** de 12 bankklipp i `media/dealers/astrid/runtime/presentation`
  (72,3 MB) som sparad projektkonfiguration refererar, och deras register och
  molnobjekt. Kontrollera Blob-existens för varje objekt innan något lokalt tas bort.
- Återställningsunderlag från historikrensningen: BASLINJE §8 (`approved/`).

## Steg

0. Steg 0 enligt ORKESTRERING §4. Mät
   `node ordning/verktyg/tree-sizes.mjs media 5` efter våg 2 och A30.
1. **Runtime-behov:** vilka filer läser Render-tjänsten under drift? Följ
   `web/server.mjs`, `web/presentation-api.mjs`, `web/layer-packs.mjs` och
   `web/storage/*` med A04 och A30. Allt annat kandiderar för `.dockerignore`.
2. **`.dockerignore`-förslag** med lista och bytevinst. Orkestratorn bygger
   imagen lokalt (`docker build -f ops/cloud/Dockerfile .`), startar den
   isolerat (ingen produktionsdatabas) och röktestar `/api/table` och en
   presentation.
3. **Utflytt** (bara det B11 godkänt): verifiera Blob-kopian per fil (hash i
   `media/blob-index.json`), uppdatera `media/layout.json` och katalogerna via
   verktygen, och `git rm`. Ett material vars enda kopia finns i trädet tas
   inte bort.
4. **Offline-läge:** följ `lab/docs/README.md` (`node lab/start.mjs --offline --no-open`,
   körs bara av orkestratorn, ensam session) och kontrollera att de dealers och
   rum som ska fungera offline gör det. Ändra annars dokumentationen med Jakobs ok.
5. **Prov:** katalog- och manifestkontrollerna (`--check`),
   `node pipeline/audit-dealer-sync.mjs --probe` (eller dess ersättare enligt
   A30), `node docs/system-map/verify.mjs --check` och hela sviten.
6. **Dokument:** `docs/ENVIRONMENT-RESTORATION.md` (återställning) och
   `docs/CLOUD-MIGRATION.md` (lagringskartan).

## Klart när

- [ ] Render-imagen är mindre och spelmotorn fungerar efter deploy (rehearsal
      för fyra dealers och layer-lanen).
- [ ] Offline-läget fungerar enligt dokumentationen.
- [ ] Inget material vars enda kopia fanns i trädet har tagits bort.

## Tveksamt att lyfta

- Varje fil utan verifierad Blob-kopia.
- Om offline-läget ska krympas till färre dealers.
