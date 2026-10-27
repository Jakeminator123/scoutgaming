# Croupier: mediafiler som används i runtime jämfört med hela trädet

Repo: `v1clean`, branch `kevin-merge-admin` @ `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`. K = `kevin/croupier-scoutgg`. Alla sökvägar i TSV-filen är relativa till `K/public`, och file:line-hänvisningar är relativa till K.

## Binärerna finns på disk
- Ingen git LFS. `.gitattributes` sätter bara `binary`/`-text`, och `git lfs ls-files` är tomt. Varje mp4/png är en riktig blob.
- `git status --short --ignored` visar bara ignorerade `answers/`, `data/` och `node_modules/`, så disken stämmer med HEAD. Stickprov: `git hash-object public/media/dealers/dragge/v2/pos1-iv.mp4` = blob `29803c30…` = ls-tree.
- sha256 räknades med hashlib på diskfilerna. Bytes kommer från `git ls-tree -l`, och diskstorleken är kontrollerad mot den (assert). Git-blobens SHA-1 ligger som extra kolumn 7 i TSV-filen.

## Aktiva dealers
Det finns fem i `public/dealers.js:66-92`: `astrid` (classic, filmad), `dragge` (visas som "Dragan"), `paow`, `marten` och `astrid2` (visas som "Astrid").
- `PUBLIC_HIDDEN = ['marten']` (`public/dealers.js:96`). `pick()` (`:97-106`) tillåter marten bara när URL:en har `?table=` (Table Studio-bord). I den publika demon är alltså **astrid, astrid2, dragge och paow** aktiva. Marten nås bara via studiobord, och servern förbereder honom ändå (`server/server.mjs:82` READY_TAKES, `:119` RORLIG_DEALERS-default).
- Standard är `astrid` (`dealers.js:104-105`).

## Upplösningsregler (file:line)
1. **Manifestet.** Klienten läser aldrig `manifest.json` direkt. Servern läser det och kör `classifyManifest` (`server/server.mjs:52`, `server/media-registry.mjs:4-15`), och klienten hämtar resultatet via `GET /api/clips` (`server/server.mjs:436`, `public/app.js:527`). `classifyManifest` behåller bara de 11 GAME_SPEECH-repliker (`media-registry.mjs:3,5`): `goodluck_1, sidebet_2, insurance_1, double_1, bust_1, blackjack_1, dealerblackjack_1, dealerbust_1, win_1, push_1, lose_1`. Det gäller också `repliker_sprak` (es/fr/zh, `:10`) och `handelser.varianter` (`:13`). De andra 40 replikerna per språk klassas som `legacy_training`.
2. **Språk för Astrid classic.** `speechBank` (`public/dealer-language.js:5`) använder en, och es/fr/zh från `repliker_sprak`. sv, pt och ko faller tillbaka på engelska. `speechForEvent` finns i `:9-11`.
3. **Deal-takes för keyed dealers.** `dealerClipUrl` (`dealers.js:112-116`) skriver om `/media/deal/<take>.mp4` till `/media/dealers/<id>/v2/<take>[-variant].mp4`. Förladdaren hämtar `'' , i, u, iu` (`dealerClipVariants`, `:119-122`). Servern döper också stegvarianterna `-v` och `-iv` när `meta.json frames` har dem (`server/shared-table.mjs:124-128`). Det blir 10 takes × 4 + 8 × 2 (pos1-7 och posdealer, inte hole/flip) = **56 per dealer**. `hands.mp4` (`shared-table.mjs:168`) används inte, eftersom ingen meta.json har `hands`.
4. **Idles.** Dragan har `h3IdlesFor(…,'v2',…)` med 8 och `extraIdles` med 13, alltså 21 filer i `v2/` (`dealers.js:52,62,71`). Paow har 7 + 16 = 23 i `v2/` (`:76`). astrid2 har 9 H3-takes i `idle-v2/` (`:62-63,91`). Marten har `idlesFor` med 3 Kling-loopar i `idle-v2/` (`:26-27,85`). Klientens idle-kedja tar takes från `dealer.idles` (`app.js:113,571`).
5. **Repliker för keyed dealers.**
   - `dealerLineUrl` (`dealers.js:145-151`) mappar Astrids replik-id till `<linesDir><lang>/<id>.mp4`, där `lang` ∈ `dealer.lines`, annars en.
   - Varianterna `bust/blackjack/twentyone/win_1..n` räknas av servern från filerna (`server/server.mjs:91-105`) och väljs av `variantOf` (`shared-table.mjs:75-81,146,158`). Det ger n = 7/7/7/3 för alla fyra.
   - Extra repliker går via `dealerExtraLineUrl` (`dealers.js:157-160`, `app.js:274-277`). Det är `remark_hit20_1`, `remark_hit17_1/2` och `remark_stand11_1` (`dealer-remarks.js:17-19`), `banter_1` (`:26`), `greet_<7 namn>` och `greet_guest` (`:31-34`), `table_trust_1` och `table_cash_1` (`:38`), samt `placebets_/chatter1_/chatter2_1..3` (`shared-table.js:89,92-95`).
   - Lip-sync-workern förhämtar `goodluck_\d+` på en och sv (`server/rorlig-lipsync.mjs:411-416`). Det gäller bara staging/RORLIG.
   - Totalt blir det 56 filer per språk, och 58 för en/sv.
6. **Stillbilder och rum.** `keyed.still` är `v2/vila.png` (`dealers.js:70,75,84,90`, `stage-pending.js:24`). `ROOMS` har 4 png och 4 thumb (`dealers.js:187-190`, `app.js:662`). `rooms-wide/darkhall.jpg` finns i `dealers.js:187` och `desk-mode.js:15`. Ansiktsbilderna `faces/<id>.jpg` finns i `dealers.js:67-89`, och `startbild.png` i `dealers.js:67` och `stage-pending.js:19`.
7. **Ljud och övrigt.**
   - `/sfx/ambience.mp3` (`public/game-audio.js:10`)
   - `/media/silent.wav` (`public/voice-pool.js:10`)
   - `cards/back-scout.png` (`game-cards.js:40`, `index.html:18`)
   - `table-styles/variant-b.png` (`table-style.js:87`)
   - `/brand/scout-mark.svg` (`index.html:54`, `game-presentation.js:29`)
   - favicons (`index.html:5`)
   - Röstsvar och TTS skapas i runtime under `answers/` och finns inte i trädet.
8. **Table Studio (/studio/).** `greetingClip` (`public/studio/studio.js:58-61`) spelar `greeting_1` per dealer och röstspråk. `login-film.mp4` och poster (`studio/index.html:39,317`), cut-outs och felt-masks (`studio.js:5`), samt `rooms/<rum>-v2-720.png` (`studio.js:32,53`) och miniatyrer (`index.html:348-392`).
9. **Filer utan mediereferenser.** `idle-chain.js`, `lip-layer.js`, `table-audio.js`, `settings-rooms.js` och `video-preloader.js` refererar inte till några mediesökvägar. De spelar URL:er som de får in. `media-fetch.js` och `app.js:64` byter bara origin via `MEDIA_BASE_URL`, och sökvägarna är desamma.

## Runtime-mängden (media-runtime.tsv, 1 267 rader)
| Del | Filer | varav ljud/video | Bytes |
|---|---:|---:|---:|
| A. Publik demo (astrid, astrid2, dragge, paow, delat) | 932 | 908 | 628 967 818 |
| B. Marten (bara studiobord) | 289 | 287 | 157 992 256 |
| C. Table Studio (greeting_1-förhandsvisning + assets) | 46 | 20 | 20 943 644 |
| **Totalt** | **1 267** | **1 215** | **807 903 718** (ljud/video 785 210 438) |

Per dealer och syfte (filer / bytes):
- **astrid**: deal-clip 10 / 9 231 199; idle 5 / 3 298 740; repliker 44 (11 × en, es, fr, zh) / 14 475 379; still 1 / 1 628 428; face 1 / 9 256; studio-preview 4 / 1 604 556.
- **astrid2**: v2-deal-take 56 / 97 058 553; idle-v2 (H3) 9 / 13 953 549; repliker 170 (en 58, pt 56, ko 56) / 50 510 210; keyed-still 1 / 845 513; face 1 / 10 271; studio-preview 3 / 1 054 313.
- **dragge**: v2-deal-take 56 / 86 492 922; v2-idle-take 21 / 21 783 438; repliker 228 (sv 58, en 58, pt 56, ko 56) / 107 119 440; keyed-still 1 / 876 364; face 1 / 11 876; studio-preview 4 / 1 417 569.
- **paow**: v2-deal-take 56 / 86 582 688; v2-idle-take 23 / 22 617 237; repliker 228 / 102 514 885; keyed-still 1 / 940 613; face 1 / 12 519; studio-preview 4 / 2 812 179.
- **marten**: v2-deal-take 56 / 82 446 079; idle-v2 (Kling) 3 / 5 800 443; repliker 228 (sv 58, en 58, es 56, pt 56) / 68 813 128; keyed-still 1 / 921 569; face 1 / 11 037; studio-preview 4 / 1 388 721.
- **shared**: rooms 9 / 7 364 476; ambience.mp3 1 / 240 579; silent.wav 1 / 844; övrigt (kortbaksida, bordsstil, logga, 4 favicons) 7 / 1 388 839.
- **studio**: bilder 26 / 8 672 519; login-film.mp4 1 / 3 993 787.

## Hela trädet: ljud/video (verifierat: exakt 1 790)
`git ls-tree -r HEAD` i K och `find` på disk (utan node_modules) ger båda **1 790** filer på **1 032 081 678 bytes**: 1 787 mp4, 2 wav och 1 mp3. node_modules har 0, och resten av repot har 0, så alla 1 790 ligger i K.

| Katalog | Filer | Bytes |
|---|---:|---:|
| public/media/dealers | 1 501 | 921 083 566 |
| public/media/repliker (+ -es, -fr, -zh) | 51 + 51 + 51 + 51 | 28 500 345 + 14 292 706 + 12 811 570 + 13 005 388 |
| public/media/deal | 10 | 9 231 199 |
| public/media/idle | 5 | 3 298 740 |
| public/media (silent.wav) | 1 | 844 |
| public/media_omkodad_crf20_2026-09-25 (deal 8, idle 7, repliker 51) | 66 | 25 277 310 |
| public/sfx | 1 | 240 579 |
| public/studio/assets | 1 | 3 993 787 |
| verktyg/ (prov.wav), utanför public | 1 | 345 644 |

Fördelning i public/media/dealers:
- per dealer: repliker 81 mp4 per språk; v2 56 (astrid2, marten), 77 (dragge), 79 (paow); idle-v2 9 (astrid2) och 3 (övriga).
- per mapp och storlek: se `tools/unreferenced.out`.

**Runtime 1 215 + oanvända 575 = 1 790.**

## Oanvända ljud/video-filer (575 filer, 246 871 240 bytes)
- `media/repliker`, `repliker-es`, `repliker-fr` och `repliker-zh`: 39 per katalog, totalt 156 filer på 52 530 074 bytes. Det är manifestets 40 inaktiva repliker per språk (greeting, placebets, peek, farewell, chatter, varianterna _2/_3 och sidebet_1/_3). `greeting_1` (en, es, fr, zh) används bara av Studio.
- Keyed dealers' `repliker/<lang>`, de 22–25 id per språk som ingen regel når: `greeting_2/3`, `farewell_*`, `peek_*`, `insurance_2/3`, `double_2/3`, `sidebet_1/3`, `dealerblackjack_2/3`, `dealerbust_2/3`, `push_2/3`, `lose_2/3`, samt `goodluck_2/3` på språk utom en/sv.
  - dragge 92 / 53 199 911
  - paow 92 / 52 045 716
  - marten 92 / 29 825 632
  - astrid2 70 / 22 363 828
- `dealers/dragge/idle-v2` och `dealers/paow/idle-v2` (breath, glance, smile): 6 filer, 11 283 125 bytes. De har ersatts av v2-idles i `dealers.js:71,76`.
- `media_omkodad_crf20_2026-09-25/`: alla 66 filer plus egen manifest och startbild. Ingen kod refererar katalogen, bara dess egen README och manifest.
- `verktyg/prov.wav`: verktyg, inte runtime.

Oanvända bilder (inte i TSV): `media/deal/matte/*.png` (10), `dealers/*/v2/redo.png` (4), `studio/assets/{felt-mask-astrid,felt-mask-dragge,login-astrid,login-dragge}.png`, `studio/assets/scout-mark.svg` och `studio/assets/rooms/{azure,golden,mahogany}-720.png`.

## Saknade filer och avvikelser mellan manifest och kod
- **Saknas på disk eller i git: inga.** Alla 1 267 expanderade sökvägar finns. Alla 220 URL:er i manifestet finns. Det finns inga mp4-filer i `media/{repliker*,idle,deal}` som saknas i manifestet.
- Manifestposter som koden aldrig spelar: de 40 icke-GAME_SPEECH-replikerna × 4 språk. De filtreras bort av `classifyManifest` men finns kvar i registret som `legacy_training`. De enda undantagen är `greeting_1` och `greeting_1_<lang>`, som Studio använder.
- Kod som pekar på filer utanför manifestet: alla `/media/dealers/**`-sökvägar byggs från mallar i `dealers.js` och servern. Två sådana mallar ger ingen fil: `hands.mp4` (aldrig aktiv) och `ownLine` → `/media/repliker/twentyone_1.mp4` (`shared-table.mjs:57`). Den senare skrivs alltid om till dealerns egen fil av `dealerLineUrl` och används bara när dealern har `twentyone`-varianter.

## Metod och förbehåll
- Mallarna expanderades i `tools/runtime_media.py` och jämförelsen med trädet gjordes i `tools/unreferenced.py`. Utdata finns i `tools/runtime.json` och `tools/unreferenced.out`.
- "Runtime" betyder här att filen nås av en upplösningsregel i koden, inte att den har observerats i nätverkstrafik. Servern serverar ändå hela `public/` statiskt (`server.mjs:635`). Den interna audit-routen `internal/game-audit/media` (`server.mjs:420-424`) kan dessutom skicka vilken ljud/video-fil som helst under public, eftersom `mediaInventory` går igenom hela trädet.
- Följande räknas med men nås bara villkorligt:
  - `-v`/`-iv`-varianterna och `variantOf`-varianterna kräver att servern har READY_TAKES för rummet (publika dealer-rum och studiobord).
  - `goodluck_2/3` på en/sv kräver lip-sync-workern (staging/RORLIG).
  - Marten nås bara via `?table=`.
  - Studio-raderna kräver `/studio/`.
- Språk: varje språk i `dealer.lines` räknas som nåbart. Det stämmer exakt med repliker-mapparna (assert i skriptet).
- Rad-dubbletter: en fil räknas en gång. `dealer`-kolumnen listar alla dealers som når filen, och `shared` används för gemensamma filer.
