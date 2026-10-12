# A14 · Staging- och experimentmedia

| Fält | Värde |
| --- | --- |
| Våg | 2 · mergas efter A10 och A15 (som tar bort skripten som pekar hit) |
| Väntar på | B8 · A04 · A10 · A15 |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 15 % |

## Mål

Avslutade, daterade medieexperiment ligger inte längre i det aktiva trädet.
Spårbarheten finns kvar: filerna ligger i Git-historiken
(`00ea55c5`) och den privata backupen.

## Fakta (00ea55c5)

| Träd | Filer | MB |
| --- | ---: | ---: |
| `media/game/staging/` (2026-09-11 till 2026-09-20; 2026-09-13 har 791 filer) | 852 | 9,11 |
| `media/dealers/astrid/staging/` (2026-09-10, -19, -20) | 452 | 6,04 |
| `media/dealers/amira/staging/2026-09-20/` | 37 | 0,32 |

- 181 av repots 296 Markdown-filer ligger här (QA-anteckningar).
- Konsumenter utanför `media/`: pipeline-skript (ansikte, hår, IK, `build-hands.sh`,
  `build-return-continuation.mjs`), som tas bort av A10 och A15, samt
  `test/dealer-reach.mjs`, som körs i kroken.
- `.dockerignore` och `.ignore` utesluter redan `media/**/staging`, så trädet
  finns inte i Render-imagen. Vinsten är tydlighet och mindre checkout.
- **Astrids staging (6,3 MB) innehåller arbets- och kalibreringsmetadata**
  (Codex, BASLINJE §8). Den får inte raderas med en generell staging-regel.
  Klassa varje undermapp i `media/dealers/astrid/staging/` (t.ex.
  `2026-09-19/astrid-green-speak-elevenlabs/mask-face-repair`,
  `2026-09-20/astrid-seam-repair/audit`): används den av läppsynk- eller
  kalibreringskedjan (`pipeline/sync-*.py`, `retime-*`, `measure-*`,
  `docs/dealer-sync-baseline.json`), eller är den enda kopian av ett
  godkännandeunderlag? Behåll i så fall.
- `web/public/review/2026-09-09/3lager/` är ospårat material från Jakob och finns
  inte i molnet. Det är inte staging och berörs inte.
- Kvarlämnad säkerhetskopia:
  `media/dealers/astrid/source/calibration/lipsync-overrides.json.pre-retime`
  (167 byte). Den nämns i `pipeline/sync-existing.py` och i JOHN-HANDOFF.

## Ägda filer

`media/game/staging/**`, `media/dealers/*/staging/**`,
`media/dealers/astrid/source/calibration/lipsync-overrides.json.pre-retime`,
fixtur- och sökvägsrader i `test/dealer-reach.mjs` (bara om testet läser
staging och inte är 3D; 3D-fallet hanteras av A10).

**Rör inte:** `media/**/runtime/**`, `media/**/source/**` utöver filen ovan,
samt `.dockerignore` och `.ignore` (reglerna skyddar framtida staging).

## Steg

0. Steg 0 enligt ORKESTRERING §4. Ombasera efter A10 och A15. Kör
   `rg -l --glob '!media/**' --glob '!ordning/**' 'staging/2026-09|/staging/' .`.
   Bara `test/dealer-reach.mjs`, `.dockerignore`, `.ignore` och dokument får
   finnas kvar.
1. **Bekräfta återställningsvägen:** `git ls-tree -r --name-only 00ea55c5 -- media/game/staging | Measure-Object`
   ska ge 852. Skriv i rapporten hur en fil återställs:
   `git checkout 00ea55c5 -- <sökväg>`.
2. **test/dealer-reach.mjs:** läser testet staging, gör om fixturen så att den
   använder runtime-data eller en minimal fixtur i `test/fixtures/`, utan att
   försvaga asserten. Lyft det under `Tveksamt` om det inte går.
3. **Ta bort** med `git rm -r`: `media/game/staging/`, Amiras staging och de
   Astrid-undermappar som steg 1–2 klassat som avslutade experiment, samt
   säkerhetskopian. Astrid-mappar med kalibrerings- eller godkännandevärde står
   kvar och listas i rapporten.
4. **Prov:** `node --test test/dealer-reach.mjs`,
   `node tools/build-runtime-media-catalog.mjs --check`,
   `node pipeline/build-lab-video-manifest.mjs --check`,
   `node docs/system-map/verify.mjs --check` och
   `node pipeline/audit-dealer-sync.mjs --probe`.

## Klart när

- [ ] Inga spårade filer under `media/**/staging/`.
- [ ] Proven är gröna, och audit-dealer-sync är oförändrad.

## Tveksamt att lyfta

- Om något i staging är den enda kopian av en godkänd tagning. Kontrollera mot
  `docs/dealer-sync-baseline.json` och `docs/qa/*.json`.
