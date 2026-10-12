# A15 · Pipeline-verkstaden

| Fält | Värde |
| --- | --- |
| Våg | 2 · parallell med A10, A12, A13, A16 · före A14 |
| Väntar på | B9 provisoriskt ja, läppsynk- och kalibreringskedjan behålls · A05 körs parallellt i omgång 1 |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 15 % |

## Mål

`pipeline/` innehåller bara verktyg som körs av krok, CI, andra verktyg eller
dokumenterade arbetsflöden. Läppsynk- och kalibreringskedjan står kvar om B9
inte säger annat.

## Fakta (00ea55c5)

`node ordning/verktyg/pipeline-consumers.mjs`: 109 filer, varav 6 i krok/CI,
2 externa, 14 bara interna och 87 utan konsument.

**Ägs av andra:** 3D, Blender, ansikte och hår (A10). Grön nyckling och
composited, t.ex. `test-astrid-green-*.mjs`, `test-amira-*.mjs`,
`test-astrid-folded-rest-lifecycle.mjs`, `test-astrid-idle-scheduler.mjs` och
`build-dealer-v2-release.mjs` (A16).

**Kandidater för A15** (utan konsument, utanför A10 och A16):
`align-dealer-speech-export.mjs`, `auto-rescue.py`, `bake-cutout.sh`,
`bake-with-table.sh`, `build-astrid-actor-mattes.py`, `build-contact-review.mjs`,
`build-previews.sh`, `build-return-continuation.mjs`, `capture-astrid-speech.py`,
`debug-burn.py`, `export-kf.py`, `face-keyframes.py`, `harvest-speak.py`,
`harvest-visemes.py`, `kf-sheet.py`, `make-master-v2.py`,
`merge-astrid-master.py`, `mouth-crops.json`, `normalize-bake.sh`,
`normalize-stream-order.py`, `prepend-contact-entry.mjs`, `room-voice.py`,
`save-checkpoint.py`, `submit-speak-batch.py`, `test-actor-composite.mjs`,
`test-actor-edge-blend.mjs`, `viseme-render.py` och `viseme-timeline.py`.
Interna som kan bli föräldralösa: `bake-composite.sh`, `build-hands.sh` och
`encode.sh`.

**Läppsynk- och kalibreringskedjan, behålls utan B9:** `sync-audio-warp.py`,
`auto-phrase-warp.py`, `measure-lipsync.py`, `retime-video-map.py`,
`retime-video-warp.py`, `apply-lipsync.py`, `trim-speak-start.py`,
`measure-onset.py` och `sync-existing.py`. AGENTS.md: "Preserve … calibration
scripts".

## Ägda filer

Kandidaterna ovan, efter justering mot A05 och kontroll av varje fil.

**Rör inte:** skript i krok/CI (`audit-dealer-sync.mjs`, `audit-performance.mjs`,
`audit-astrid-actor.mjs`, `build-lab-video-manifest.mjs`, `build-index.mjs` och
de övriga som klassas `hook/CI` eller `external`), läppsynkkedjan och A10:s och
A16:s filer.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kör `pipeline-consumers.mjs` och jämför.
1. **Per kandidat:** `git log -1 --format="%h %ad %s" --date=short -- <fil>`,
   eventuella anrop från andra skript (även `.sh`) och om något aktivt dokument
   beskriver användning. Är skriptet en del av en dokumenterad
   media-omtagningsprocess, märk det `kräver beslut`.
2. **Ta bort** de bekräftade med `git rm`. Interna skript tas bara bort när
   ingen kvarvarande fil anropar dem.
3. **Prov:** `pipeline-consumers.mjs` (0 `none` utanför A10 och A16, eller
   motiverade), `node tools/check-orphan-tests.mjs`,
   `node docs/system-map/verify.mjs --check` och
   `rg` på varje borttaget namn (utan `ordning/`).
4. **Lista** "Verktyg som finns kvar" (namn och syfte på en rad) under
   "Dokumentändringar som behövs" i rapporten. A17 för in listan i
   `docs/LOCAL-PRESENTATION-RUNTIME.md`.

## Klart när

- [ ] Inga skript utan konsument kvar utöver läppsynkkedjan och det som
      uttryckligen behålls.
- [ ] Proven är gröna.

## Tveksamt att lyfta

- Skript som kan behövas för att göra om en godkänd tagning.
