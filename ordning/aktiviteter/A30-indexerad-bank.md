# A30 · Indexerad mediebank, originalmotor och partnerprotokoll

| Fält | Värde |
| --- | --- |
| Våg | 4 · fas 1 (utredning, läsande) kan starta efter A12 och A16 · fas 2 bara efter B11 |
| Väntar på | A12 · A16 · A04 · B11 (för fas 2) |
| Branch | Molnagentens egen branch per fas och skiva, inmergad på `jakob/repo-ordning` |
| Modell | grok-4.7-xhigh-fast |
| Risk | Fas 1 5 % · fas 2 50 % (partnerkontrakt, medieacceptans, offline-läge) |

## Mål

Ett beslutsunderlag (fas 1) för om den gamla indexerade banken (cirka 279 MB
utöver riggen) kan avvecklas eller flyttas. Underlaget visar vad som måste
ersättas först. Ingenting tas bort i fas 1.

## Fakta (00ea55c5)

- Storlek: Astrid `runtime/indexed` 213,7 MB (performance 100,4, streams 20,7,
  actor 13,2, scene/table 10,6, speech 3,8, preview 1,6, audio 1,3; rig 62,0
  hanteras av A10), Amira 41,9, Vera 48,4 och Mei 36,9.
- Konsumenter utanför `pipeline/`:
  - `web/partner-presentation.mjs`: partnertransportens `presentation[]` och
    `round.events` över SSE (externt kontrakt mot operatörer);
  - `web/clip-mapping.mjs`;
  - `lab/lib/legacy-clip-inventory.mjs` och `lab/lib/studio-voice-lines.mjs`;
  - `web/public/dealer-engine.mjs` (Studio-reserv, borta efter A12);
  - `tools/build-runtime-media-catalog.mjs --check` (i kroken),
    `tools/deduplicate-media.mjs` och `tools/migrate-media-layout.mjs`;
  - tester: `build-index`, `dealer-sync-audit`, `game-entry-offline`,
    `media-layout`, `legacy-clip-policy`, `studio-voice-lines`,
    `studio-project-bindings`, `blob-source-routing` m.fl.
- AGENTS.md:s medieregler, `pipeline/build-index.mjs`,
  `pipeline/audit-dealer-sync.mjs --probe` och `docs/dealer-sync-baseline.json`
  är byggda kring banken.
- Offline-läget (`node lab/start.mjs --offline`) använder lokala filmer.
- Produktion (BASLINJE §8): inga registerposter och inga paket refererar Astrids
  gamla filer via hash. Spelserverns gamla `/dealer/…` och `/dealers/astrid/…`
  svarar redan 410. Studios originalvisning läser index, talbank och
  performance-manifest. Dealerfiler på disk är inte molnuppspelningens reservkälla.
- Molnläget har `media/blob-index.json` (logisk sökväg → Blob) och
  `media/layout.json`.

## Fas 1 · Utredning (läsande)

Rapport: `ordning/rapporter/A30-indexerad-bank.md`.

1. Steg 0 enligt ORKESTRERING §4.
2. **Partnerprotokollet:** vad exponerar `web/partner-presentation.mjs` och
   `/api/v1/table` om media: klipp-id, URL:er eller tider? Vilka partnertester
   låser formatet? Kan formatet hållas oförändrat med registrerad media som källa?
3. **Studio:** vad behöver `legacy-clip-inventory` och `studio-voice-lines` från
   banken? Finns motsvarande data i registrerad media eller i Neon (enligt koden)?
4. **Spelet:** bekräfta med A04 att inget publicerat paket eller rum spelar från
   banken. Lista produktionsfrågor för orkestratorn.
5. **Offline och CI:** vad kräver offline-läget, katalogkontrollen och
   `audit-dealer-sync`? Föreslå ersättning: en liten fixtur, Blob-hämtning eller
   en pensionerad kontroll med Jakobs ok.
6. **Blob:** finns varje fil som ska bort ur trädet i `media/blob-index.json`
   med samma hash? Räkna fil för fil och redovisa avvikelser.
7. **Förslag i skivor:**
   - (a) dealer för dealer, eller
   - (b) del för del: performance, streams, actor …

   Ange vad som ersätts, vilka regler i AGENTS.md som ändras, prov och risk.

## Fas 2 · Genomförande (bara efter B11)

En skiva per PR, enligt det godkända förslaget. Krav:

- verklig återläsning av varje Blob-objekt som ska ersätta en fil i trädet
  (orkestratorn hämtar, läsande) och SHA-256 som stämmer med Git-blobben. En
  rad i `media/blob-index.json` räcker inte (A31 steg 3);

- partnerprotokollets prov är oförändrade;
- `audit-dealer-sync` är grön, eller pensionerad med Jakobs uttryckliga ok;
- offline-läget fungerar enligt `lab/docs/README.md`;
- rehearsal för berörda dealers två gånger i rad efter deploy;
- `docs/ENVIRONMENT-RESTORATION.md` beskriver hur banken återställs.

## Klart när

- [ ] Fas 1-rapporten finns, och B11 kan tas.
- [ ] (fas 2) Varje godkänd skiva är levererad och verifierad.

## Tveksamt att lyfta

- Allt som ändrar partnerprotokollet, även en enda nyckel.
- Ändringar i AGENTS.md:s medieregler.
