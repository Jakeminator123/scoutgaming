# A20 · Flyttplan: kompositor och layer-preview till `packages/presentation`

Läsande plan på `cf011b1cacb01416c626ebcdb5092ca598c4e8da` (träd `4e5c6a5177b5761791628bb528ca2773201140ae`). Ingen kod är flyttad. Genomförandet mäter om mot dåvarande `origin/main` innan första `git mv`.

`origin/main` är `061294abe7f6716a067cf365c597bf2a5e5750b2` (merge av PR #23, föräldrar `ff1d6e53` och `cf011b1c`). Trädet är identiskt med den här basen. `origin/jakob/repo-ordning` är `cf011b1c`. GitGuardian på `061294ab`: kontrollen köad, incidentlistan oläst, täckningen ofullständig.

Starta inte flytten förrän V2 är verifierad i produktion och PR #21 inte längre rör de två dokumenten nedan. B12: A20 ensam, sedan produktionskontroll, sedan A21. A22 bara utredning. A23 inte nu.

## Täckning

`test-videoeditor/` är 51 spårade filer, 12 353 093 byte (11,78 MiB). Delträd som täckningsverktyget räknar: `test-videoeditor/`, `test-videoeditor/program/`, `test-videoeditor/preview/`. Inget ospårat under mappen lästes. Mediebinärer öppnades inte; storlek och blob kommer från `git ls-tree -l`.

| Del | Filer | Byte | Mål |
| --- | ---: | ---: | --- |
| rot (`README.md`) | 1 | 410 | ny pakets-README, gamla filen bort |
| `program/web/` | 11 | 90 144 | `packages/presentation/compositor/` |
| `program/docs/` | 2 | 9 554 | `packages/presentation/docs/` |
| `preview/` utom media | 8 | 50 408 | `packages/presentation/preview/` |
| `preview/site/media/` | 29 | 12 202 577 | `packages/presentation/preview/site/media/` |

## 1. Inventering

| Källa | Byte | Blob | Mål |
| --- | ---: | --- | --- |
| `test-videoeditor/README.md` | 410 | `8d3a070fdf8d` | tas bort; ersätts av ny packages/presentation/README.md |
| `test-videoeditor/preview/README.md` | 1817 | `2eb116477844` | `packages/presentation/preview/README.md` |
| `test-videoeditor/preview/prepare.mjs` | 1554 | `ef2886925a5b` | `packages/presentation/preview/prepare.mjs` |
| `test-videoeditor/preview/prepare.test.mjs` | 2144 | `cf2af7fd73be` | `packages/presentation/preview/prepare.test.mjs` |
| `test-videoeditor/preview/site/catalog.json` | 32236 | `c7efaca5e343` | `packages/presentation/preview/site/catalog.json` |
| `test-videoeditor/preview/site/index.html` | 2213 | `7f2b25c93acb` | `packages/presentation/preview/site/index.html` |
| `test-videoeditor/preview/site/media-hashes.json` | 4127 | `82de1f85de30` | `packages/presentation/preview/site/media-hashes.json` |
| `test-videoeditor/preview/site/media/001f0238e3f341cb1aefa9c319c7c6b8c5f0d304f564cdf9e4506fbad276dd9b.mp4` | 300348 | `56fbfb6843c8` | `packages/presentation/preview/site/media/001f0238e3f341cb1aefa9c319c7c6b8c5f0d304f564cdf9e4506fbad276dd9b.mp4` |
| `test-videoeditor/preview/site/media/0371f88454e5ceb54ab96fe667b48218faeacf0d417e45a500a871e1386dd83d.mp4` | 317881 | `25e7b7c82377` | `packages/presentation/preview/site/media/0371f88454e5ceb54ab96fe667b48218faeacf0d417e45a500a871e1386dd83d.mp4` |
| `test-videoeditor/preview/site/media/068ff560711fd999918c39d4c4c606fb77e1edba6023fa98aa6977c4c74914a9.mp4` | 308562 | `d5f596f6b931` | `packages/presentation/preview/site/media/068ff560711fd999918c39d4c4c606fb77e1edba6023fa98aa6977c4c74914a9.mp4` |
| `test-videoeditor/preview/site/media/0ce07b537ab1e5565a6d3232e696100cf6b3829c8b79bdf4150843c523850d5a.mp4` | 311503 | `91b31bf53a3b` | `packages/presentation/preview/site/media/0ce07b537ab1e5565a6d3232e696100cf6b3829c8b79bdf4150843c523850d5a.mp4` |
| `test-videoeditor/preview/site/media/0e5d689d35dc4272aaf5f5b7faf5094e97e18f296556098d25125808931154e6.mp4` | 288256 | `a9c7583e9b66` | `packages/presentation/preview/site/media/0e5d689d35dc4272aaf5f5b7faf5094e97e18f296556098d25125808931154e6.mp4` |
| `test-videoeditor/preview/site/media/0f6b22bf3bde228829c260881244fa7ad951e0fb41d91ff40caa0d48b29c02a1.mp4` | 323128 | `e2a7b73597ad` | `packages/presentation/preview/site/media/0f6b22bf3bde228829c260881244fa7ad951e0fb41d91ff40caa0d48b29c02a1.mp4` |
| `test-videoeditor/preview/site/media/2b2d7d1a763f0baa6dd2e085057ee19a53c144000410a2027dabf1976c851ce7.mp4` | 179211 | `3d0a17495a27` | `packages/presentation/preview/site/media/2b2d7d1a763f0baa6dd2e085057ee19a53c144000410a2027dabf1976c851ce7.mp4` |
| `test-videoeditor/preview/site/media/35df83e718866de5838f097be4f90dab99f0df4953957d594df589e2ac1fbad1.webp` | 381036 | `efb55bac1bfc` | `packages/presentation/preview/site/media/35df83e718866de5838f097be4f90dab99f0df4953957d594df589e2ac1fbad1.webp` |
| `test-videoeditor/preview/site/media/38bc467ab8308672f6bb22e6c3da986fb467ed4f7b0b04792f51d2e1a43e21d8.webp` | 113728 | `f8297e598f51` | `packages/presentation/preview/site/media/38bc467ab8308672f6bb22e6c3da986fb467ed4f7b0b04792f51d2e1a43e21d8.webp` |
| `test-videoeditor/preview/site/media/46de9210486548655c3d4747fca9ad2e90ef128ff96b164a02566504630390fa.mp4` | 319097 | `45c64264129f` | `packages/presentation/preview/site/media/46de9210486548655c3d4747fca9ad2e90ef128ff96b164a02566504630390fa.mp4` |
| `test-videoeditor/preview/site/media/52522c64bd05253489720adc18785f4d153b33e69cb729d55f0c0f0ef41b7fcc.mp4` | 335525 | `dbf668954bc0` | `packages/presentation/preview/site/media/52522c64bd05253489720adc18785f4d153b33e69cb729d55f0c0f0ef41b7fcc.mp4` |
| `test-videoeditor/preview/site/media/5bb47bcab3b29f1e3d57ca29cf73007f003d8ba767ff3566bfcca554994ccf04.mp4` | 319323 | `e35d5f1c23e8` | `packages/presentation/preview/site/media/5bb47bcab3b29f1e3d57ca29cf73007f003d8ba767ff3566bfcca554994ccf04.mp4` |
| `test-videoeditor/preview/site/media/642d95ee717fc0fde18e4cecd4daf73b4b44438432224704c20353f84599cd05.mp4` | 321915 | `7fee14a9be14` | `packages/presentation/preview/site/media/642d95ee717fc0fde18e4cecd4daf73b4b44438432224704c20353f84599cd05.mp4` |
| `test-videoeditor/preview/site/media/69a56f7b13ee996dc8de4b233b50691bfef3b0e9f15575d30c60b762ebf24eb3.webp` | 538960 | `b2f480cc6792` | `packages/presentation/preview/site/media/69a56f7b13ee996dc8de4b233b50691bfef3b0e9f15575d30c60b762ebf24eb3.webp` |
| `test-videoeditor/preview/site/media/7d764489b3d6ed11a8316546ad94e9c80b30d709248d9c481087e2db2e8834ab.mp4` | 334001 | `12c58e6de0ed` | `packages/presentation/preview/site/media/7d764489b3d6ed11a8316546ad94e9c80b30d709248d9c481087e2db2e8834ab.mp4` |
| `test-videoeditor/preview/site/media/82b02a6187636a125f34c77934b353dac0b2d71a552d8056313c0fca54fd40a3.mp4` | 303573 | `881131f0db7e` | `packages/presentation/preview/site/media/82b02a6187636a125f34c77934b353dac0b2d71a552d8056313c0fca54fd40a3.mp4` |
| `test-videoeditor/preview/site/media/8a40114d9158da29ccec608c83b3a91491a5a9e10a635b1b97a0548f2c24c59a.mp4` | 335808 | `871e870e92ab` | `packages/presentation/preview/site/media/8a40114d9158da29ccec608c83b3a91491a5a9e10a635b1b97a0548f2c24c59a.mp4` |
| `test-videoeditor/preview/site/media/90e907d020cc385cb692830fabb512ee4503cbca51722603ab76fe5f877c71de.mp4` | 3196171 | `23439d947a69` | `packages/presentation/preview/site/media/90e907d020cc385cb692830fabb512ee4503cbca51722603ab76fe5f877c71de.mp4` |
| `test-videoeditor/preview/site/media/9455419780d32d1b97839a179e475af70ed15567cc9cef03eae7967e02a0d990.mp4` | 342909 | `f455cc2724bc` | `packages/presentation/preview/site/media/9455419780d32d1b97839a179e475af70ed15567cc9cef03eae7967e02a0d990.mp4` |
| `test-videoeditor/preview/site/media/9dc6f6c1e6cf927c83b938bf4951bf84a83031e36a3486a7eb2a5b9a2e9abdf4.mp4` | 175887 | `3db9e92e4c08` | `packages/presentation/preview/site/media/9dc6f6c1e6cf927c83b938bf4951bf84a83031e36a3486a7eb2a5b9a2e9abdf4.mp4` |
| `test-videoeditor/preview/site/media/a166d3ea28ab2e29b80b18e20795390e2e2717eaebaccf16eedcbd94ae08cd0e.mp4` | 254295 | `34e5a5c34a1e` | `packages/presentation/preview/site/media/a166d3ea28ab2e29b80b18e20795390e2e2717eaebaccf16eedcbd94ae08cd0e.mp4` |
| `test-videoeditor/preview/site/media/af5b4486d231bca242f7f4bd08fb927179a754d448343df57397a08fe8216ba3.mp4` | 317698 | `d850bd2e7533` | `packages/presentation/preview/site/media/af5b4486d231bca242f7f4bd08fb927179a754d448343df57397a08fe8216ba3.mp4` |
| `test-videoeditor/preview/site/media/b93567b26138711b74de6d8b96fa829da63369e9541fdb5b491171d6b3466ac7.mp4` | 313855 | `f20d5271a225` | `packages/presentation/preview/site/media/b93567b26138711b74de6d8b96fa829da63369e9541fdb5b491171d6b3466ac7.mp4` |
| `test-videoeditor/preview/site/media/cafc1e8b27ad1e60d50d49ba7580efef200a39172ecc7b68f9d54fac7e8340af.mp4` | 324336 | `fd7e1ce48b35` | `packages/presentation/preview/site/media/cafc1e8b27ad1e60d50d49ba7580efef200a39172ecc7b68f9d54fac7e8340af.mp4` |
| `test-videoeditor/preview/site/media/d0c4dd49577569d0f5d4a1c4392a29634f0384b11ddff3edbc758f0e3e122fdc.mp4` | 258309 | `f6aaa4c49d85` | `packages/presentation/preview/site/media/d0c4dd49577569d0f5d4a1c4392a29634f0384b11ddff3edbc758f0e3e122fdc.mp4` |
| `test-videoeditor/preview/site/media/d537f0fdde4b58bac518988990602982955b8c6549b4b6e047d7e166695650c5.mp4` | 330982 | `6bdeda8e2e97` | `packages/presentation/preview/site/media/d537f0fdde4b58bac518988990602982955b8c6549b4b6e047d7e166695650c5.mp4` |
| `test-videoeditor/preview/site/media/db5485e0e16996f7505a120d059948c06b532165cbe4b0ce8127ee590b33b5b6.webp` | 552224 | `856b11bd87af` | `packages/presentation/preview/site/media/db5485e0e16996f7505a120d059948c06b532165cbe4b0ce8127ee590b33b5b6.webp` |
| `test-videoeditor/preview/site/media/e0bf3143f50ba23795e7503f903644a4bc03512bff5d6bdd9b9bbab1aed23b00.webp` | 389438 | `96cfcb21cf25` | `packages/presentation/preview/site/media/e0bf3143f50ba23795e7503f903644a4bc03512bff5d6bdd9b9bbab1aed23b00.webp` |
| `test-videoeditor/preview/site/media/f9cfcda0073650e28da7b9ff890be2dce88e1fdc5921604c79da686e527d6f43.webp` | 414618 | `33a7068cc28c` | `packages/presentation/preview/site/media/f9cfcda0073650e28da7b9ff890be2dce88e1fdc5921604c79da686e527d6f43.webp` |
| `test-videoeditor/preview/site/preview.css` | 2880 | `171a989d8d8c` | `packages/presentation/preview/site/preview.css` |
| `test-videoeditor/preview/site/preview.js` | 3437 | `5bc2bd2570e1` | `packages/presentation/preview/site/preview.js` |
| `test-videoeditor/program/docs/FORMATLASNING.md` | 5015 | `ccc5f98ab79b` | `packages/presentation/docs/FORMATLASNING.md` |
| `test-videoeditor/program/docs/INTEGRATION.md` | 4539 | `34a127f9e281` | `packages/presentation/docs/INTEGRATION.md` |
| `test-videoeditor/program/web/app.js` | 25634 | `e73dc27dcc00` | `packages/presentation/compositor/app.js` |
| `test-videoeditor/program/web/bridge.js` | 3379 | `bc478e1fcfce` | `packages/presentation/compositor/bridge.js` |
| `test-videoeditor/program/web/compositor.js` | 14497 | `9930f2e2bea5` | `packages/presentation/compositor/compositor.js` |
| `test-videoeditor/program/web/geometry.js` | 1355 | `718720314f48` | `packages/presentation/compositor/geometry.js` |
| `test-videoeditor/program/web/index.html` | 13769 | `c7543b5045ff` | `packages/presentation/compositor/index.html` |
| `test-videoeditor/program/web/lanes.js` | 2179 | `7845dbd08aea` | `packages/presentation/compositor/lanes.js` |
| `test-videoeditor/program/web/player.js` | 11181 | `5bca2e27952c` | `packages/presentation/compositor/player.js` |
| `test-videoeditor/program/web/style.css` | 13914 | `c0e8c5c03140` | `packages/presentation/compositor/style.css` |
| `test-videoeditor/program/web/viewer.css` | 1290 | `7968469c2149` | `packages/presentation/compositor/viewer.css` |
| `test-videoeditor/program/web/viewer.html` | 918 | `3379603fd41c` | `packages/presentation/compositor/viewer.html` |
| `test-videoeditor/program/web/viewer.js` | 2028 | `168be4e1a87a` | `packages/presentation/compositor/viewer.js` |

`packages/` finns inte på basen. `presentation-runtime/` (14 filer) rörs inte. Den är A21.

## 2. Konsumenter

`git grep -n -F test-videoeditor` på `cf011b1c`: 25 filer. Strängen finns inte i `media/**`, `.githooks/**`, `.github/**`, `ops/**`, `apps/**` utöver de två raderna nedan, `open-claw/**`, `services/**`, `Dockerfile`, `vercel.json`, `render.yaml` (ingen spel-`render.yaml` i roten), `tsconfig`, `next.config`, `.dockerignore`, `.gitignore`, `.ignore`, `.cursorignore`, `.cursorindexingignore`. Ingen `.vercelignore`.

| Klass | Antal | Filer |
| --- | ---: | --- |
| Kod/konfiguration, måste ändras | 5 | `prepare-platform-ui.mjs`, `web/composition-runtime.mjs`, `web/layer-packs.mjs`, `lab/tools/prepare-preview.mjs`, `lab/lib/dealer-forge-catalog.mjs` |
| Prov, måste ändras | 5 | `platform-ui.mjs`, `dealer-framing.test.mjs`, `preview-prepare.test.mjs`, `test/composition-runtime.mjs`, `browser-runtime-bindings.mjs` |
| Dokument, måste ändras | 6 | `CLAUDE.md`, `LOCAL-PRESENTATION-RUNTIME.md`, `routes.json`, `system-map/index.html`, de två README under `test-videoeditor/` |
| Historiskt citat, får stå | 9 | `ordning/README.md`, `ordning/BASLINJE.md`, `ordning/aktiviteter/A04`, `A17`, `A20`, `ordning/rapporter/A04`, `A06`, `A17`, `ordning/verktyg/cross-imports.mjs` |

Utan strängen, men samma commit: `preview/prepare.mjs:25` (`../program/web`), `docs/JOHN-HANDOFF.md:422`, `.githooks/pre-commit-full:42`, `tools/check-orphan-tests.mjs` (steg 4). Indirekta prov utan radbyte: `test/layer-packs-route.mjs`, `test/layered-presentation.mjs`, `lab/components/composition-preview.test.mjs`, `apps/croupier-frontend/test/player-scene-canvas.mjs`.

`media/blob-index.json` träffar inte kompositorn. `geometry.js` är prefix i `second-card-geometry.json` (rad 24641). Lämna registret.

### Kod

| Fil:rad | Nu | Efter |
| --- | --- | --- |
| `apps/croupier-frontend/tools/prepare-platform-ui.mjs:36` | `join(repo,'test-videoeditor/program/web',name)` | `join(repo,'packages/presentation/compositor',name)` |
| `web/composition-runtime.mjs:4` | `new URL('../test-videoeditor/program/web/compositor.js', import.meta.url)` | `new URL('../packages/presentation/compositor/compositor.js', import.meta.url)` |
| `web/composition-runtime.mjs:5` | `…/geometry.js` samma prefix | `../packages/presentation/compositor/geometry.js` |
| `web/layer-packs.mjs:7` | `resolve(root, 'test-videoeditor/program/web')` | `resolve(root, 'packages/presentation/compositor')` |
| `lab/tools/prepare-preview.mjs:22` | `join(repoRoot, 'test-videoeditor/preview')` | `join(repoRoot, 'packages/presentation/preview')` |
| `lab/tools/prepare-preview.mjs:23` | `join(repoRoot, 'test-videoeditor/program/web')` | `join(repoRoot, 'packages/presentation/compositor')` |
| `packages/presentation/preview/prepare.mjs:25` (idag `test-videoeditor/preview/prepare.mjs:25`) | `join(root, '../program/web', filename)` | `join(root, '../compositor', filename)` |
| `lab/lib/dealer-forge-catalog.mjs:4` | kommentar `test-videoeditor (Paow catalog)` | `packages/presentation (Paow catalog)` |
| `lab/lib/dealer-forge-catalog.mjs:10` | `From test-videoeditor/preview/site/catalog.json` | `From packages/presentation/preview/site/catalog.json` |

`dealer-forge-catalog.mjs:11` kopierar tal, läser inte filen. Bara kommentaren ändras.

`join`/`resolve` syns inte i `cross-imports`. De är ändå konsumenter.

### Prov

| Fil:rad | Nu | Efter |
| --- | --- | --- |
| `apps/croupier-frontend/test/platform-ui.mjs:292` | `../../../test-videoeditor/program/web/` | `../../../packages/presentation/compositor/` |
| `lab/test/dealer-framing.test.mjs:5` | `../../test-videoeditor/program/web/compositor.js` | `../../packages/presentation/compositor/compositor.js` |
| `lab/test/dealer-framing.test.mjs:6` | `…/geometry.js` | `../../packages/presentation/compositor/geometry.js` |
| `lab/test/preview-prepare.test.mjs:14` | `join(repo, 'test-videoeditor/preview')` | `join(repo, 'packages/presentation/preview')` |
| `lab/test/preview-prepare.test.mjs:15` | `join(repo, 'test-videoeditor/program/web')` | `join(repo, 'packages/presentation/compositor')` |
| `test/composition-runtime.mjs:10` | `../test-videoeditor/program/web/geometry.js` | `../packages/presentation/compositor/geometry.js` |
| `test/composition-runtime.mjs:11` | `…/compositor.js` | `../packages/presentation/compositor/compositor.js` |
| `test/composition-runtime.mjs:77` | `new URL('../test-videoeditor/program/web/compositor.js', …)` | `new URL('../packages/presentation/compositor/compositor.js', …)` |
| `test/browser-runtime-bindings.mjs:24` | `'test-videoeditor/program/web/'` | `'packages/presentation/compositor/'` |

Rad 24 behåller `'web/public/'` och `'presentation-runtime/'`. A21 flyttar den andra.

### Dokument

| Fil:rad | Nu | Efter |
| --- | --- | --- |
| `CLAUDE.md:12` | test-videoeditor/preview/site | packages/presentation/preview/site |
| `docs/LOCAL-PRESENTATION-RUNTIME.md:290` | material i test-videoeditor/preview/site | material i packages/presentation/preview/site |
| `docs/system-map/routes.json:278` | `test-videoeditor/README.md` | `packages/presentation/README.md` |
| `docs/system-map/routes.json:4137` | `prepared from test-videoeditor/preview/site` | `prepared from packages/presentation/preview/site` |
| `docs/system-map/routes.json:4158` | `from test-videoeditor/program/web` | `from packages/presentation/compositor` |
| `docs/system-map/index.html` | samma tre strängar inbäddade (en rad, tre träffar) | samma tre delsträngar; bygg inte om index.html |
| `test-videoeditor/preview/README.md:17` | från program/web/ | från ../compositor/ |
| `test-videoeditor/preview/README.md:20` | mappen test-videoeditor | packages/presentation |
| `docs/JOHN-HANDOFF.md:422` | meningen som kräver att A20/A21 flyttar katalogerna i test/browser-runtime-bindings.mjs | Kompositorns katalog är packages/presentation/compositor/. A21 flyttar fortfarande presentation-runtime/ i samma lista. |

`verify.mjs:98` tar inte med `test-videoeditor/` eller `packages/` i `refs()`. Källsträngen på kartans rad 278 är därför inte en hård existenskoll. `--check` blir inte rött av den raden ensam. Uppdatera den ändå, annars lämnar `git grep` en träff utanför `ordning/`. Kör inte `docs/system-map/build.mjs` mot den committade `index.html`: byggaren skriver om inbäddad assurance. Byt de tre delsträngarna.

Handoffens rader 352–353 och 441 är historiska leveransnoter utan mappsökväg. De får stå.

### Krok och orphan

`prepare.test.mjs` ligger inte bland de 344 filer `auditOrphanTests()` såg på basen (0 orphans, 0 fel). `isTestFile` kräver en katalog som heter `test`. `packages/presentation/preview/prepare.test.mjs` har ingen sådan katalog. `coverageRoots` (`tools/check-orphan-tests.mjs:6`) saknar `packages`.

I samma commit:

1. `.githooks/pre-commit-full:42`, lägg till `packages/presentation/preview/prepare.test.mjs` sist i det `run_node_tests`-anrop som redan kör `test/composition-runtime.mjs` och `lab/test/dealer-framing.test.mjs`.
2. `tools/check-orphan-tests.mjs:6`: lägg `packages` i `coverageRoots`.
3. `isTestFile`: behåll krysset på katalogsegmentet `test`. Lägg till att `packages/**/*.test.*` också är ett prov.
4. `auditOrphanTests` rad 305: `collectTree('packages')` tillsammans med `test` och `lab/test`. Grinda inte med `targetsTree`: sökvägen har inget segment `test`, så grinden skulle aldrig slå till.

CI kör redan kroken (`.github/workflows/croupier.yml:97`, `sh .githooks/pre-commit --full`) och `npm --prefix lab test` (rad 46), som täcker `lab/test/*.test.mjs`. Ingen workflow-rad behöver en ny sökväg.

`ordning/verktyg/cross-imports.mjs:4`, `:23` och `:30` får stå. `packages/<paket>` klassas redan på rad 21. Specialfallet för `test-videoeditor` blir dött och ger inga kanter.

## 3. Adresser och hashar

Publika sökvägar och frågeparametrar ändras inte: `/composition-runtime/compositor.js`, `/composition-runtime/geometry.js`, `/layer-packs/*`, Studio `/preview/*` (publikt `/studio/preview/*`), `?lane=layer-preview&rehearsal=1`.

| Adress | Vem serverar | Källa på disk | Prov som låser innehåll |
| --- | --- | --- | --- |
| `www` `/composition-runtime/{compositor,geometry}.js` | Vercel-tjänsten `web`. `platformRoute` faller till `frontend` (`apps/croupier-frontend/lib/platform-routing.mjs:137`). Sökvägen finns inte i `backendPlatformPath` (rad 50–72) | Byggkopia `apps/croupier-frontend/public/composition-runtime/`, gitignorerad rad 40 i appens `.gitignore`. Skapas av `prepare-platform-ui.mjs:33–37` med `readFile`/`writeFile` utan omkodning | `apps/croupier-frontend/test/platform-ui.mjs:289–292` jämför texten med källfilen |
| Render `/composition-runtime/*` | `web/server.mjs:707–708` anropar `compositionRuntimeResponse` | `web/composition-runtime.mjs:3–5` läser de två källfilerna. Bara GET/HEAD, frågesträng 400, annat verb 405 | `test/composition-runtime.mjs:75–81` kräver att svaret är exakt källfilens text |
| `/layer-packs/runtime/{player,compositor,bridge,geometry,lanes}.js` | `web/layer-packs.mjs:123–137`, inkopplad vid `web/server.mjs:709`. Utan kakan `croupier_layer_preview=1` blir det 404 (rad 111) | Samma källkatalog som kompositorn, inte `preview-build` | `test/layer-packs-route.mjs:26–36` gör HEAD range mot riktiga `player.js` och kräver 206 |
| `/layer-packs/<dealer>/manifest.json` och `…/media/…` | samma route, rad 139–167 | `lab/preview-build` (`web/layer-packs.mjs:6`) | `prepare-preview.mjs:44–47` och `lab/test/preview-prepare.test.mjs:47–49` hashar varje mediafil mot `media-hashes.json` |
| Studio `/preview/*`, publikt `/studio/preview/:path+` | `lab/app/preview/[...path]/route.ts:32` via `openPreviewFile`. Systemkartan `routes.json:4127–4137`, grupp `layer-preview`. `composition-preview.tsx:71` laddar `labUrl('/preview/compositor.js')` | Gitignorerad `lab/preview-build` (`.gitignore:29`). `lab/next.config.mjs:30` spårar `./preview-build/**/*` in i bundlen | `lab/test/preview-prepare.test.mjs:52–53` kräver att kopierad `player.js` är samma text som källan |

`www` serverar inte `/layer-packs/`. Kontrollera den adressen på spelmotorns origin (Render), inte på www.

Byte-identitet: `git mv` behåller blob för varje fil vars innehåll inte ändras. Det gäller alla 11 filer i `compositor/`, båda dokumenten, `catalog.json`, `media-hashes.json`, `preview.css`, `preview.js`, `site/index.html` och alla 29 mediafiler. Bara `prepare.mjs`, `preview/README.md` och den nya pakets-README:n får nytt innehåll, plus konsumenternas sökvägsrader.

| Fil | Git-blob | sha256 | Byte |
| --- | --- | --- | --- |
| `compositor.js` | `9930f2e2bea5` | `a668ed9380e62314e3ddaef236f2e2dea823609a4587b930f6c76fe53866906e` | 14497 |
| `geometry.js` | `718720314f48` | `8bf5cb1052fcdefc1d60006b1825a58d802c6fc5725db9461ba1fcfd73a31ffc` | 1355 |
| `player.js` | `5bca2e27952c` | `a6b8419d1610830a91b70582c618f177c1c691033d8d58c1079f648def267ffc` | 11181 |
| `bridge.js` | `bc478e1fcfce` | `6efe55203fb0abfe3d853aa461d95a459ce3824b9ae188cf25ef0af6bd07b3d2` | 3379 |
| `lanes.js` | `7845dbd08aead8` | `d24de4da83f1dffc34df4e567232ae8e1de3148c8a160a2d22d67389babdf05f` | 2179 |

`media-hashes.json` (blob `82de1f85de30`, 4127 byte) har 29 nycklar. De är exakt samma 29 filnamn som `git ls-files` i `preview/site/media` (23 mp4, 6 webp). `prepare-preview.mjs:44–47` kastar om sha256 avviker. `catalog.json` har fältet `branch: test-video-jakob`. Det är data, inte en filsökväg. Rör inte filen.

Byggkopian är inte helt rå. `prepare-preview.mjs:64–75` skriver om bara `index.html` och `preview.js` (`/test/…` blir relativa). Media, katalog, hashar och de fem JS-modulerna kopieras med `cp`. Därför är `/studio/preview/compositor.js` samma byte som källan, medan `/studio/preview/index.html` medvetet inte är det.

`prepare.mjs:7–27` kan fortfarande skriva `public/test/` om `VERCEL_ENV=preview` och `VERCEL_GIT_COMMIT_REF=test-video-jakob`. Ingen byggkedja anropar `prepareLanePreview`. Grenen är raderad. Funktionen flyttas med, och den relativa sökvägen på rad 25 måste ändras så att dess eget prov förblir grönt. Den skapar ingen ny publik adress.

## 4. Tre byggkedjor

### Render

`ops/cloud/Dockerfile:6` är `COPY . .`. Rad 11 kör `npm --prefix lab ci && npm --prefix lab run build`. Ingen rad nämner `test-videoeditor`. `.dockerignore` (69 rader) utelämnar inte `test-videoeditor/` och inte `packages/`. Mönstret `docs` (rad 62) matchar varje katalog med det namnet, så `packages/presentation/docs/` stannar utanför imagen liksom dagens `program/docs/`. Det är två markdownfiler, inte runtime.

Ingen ändring i `Dockerfile` eller `.dockerignore`. `packages/presentation/compositor/` och `preview/` följer med `COPY . .`. `lab/preview-build` skapas i image-bygget av `prepare-preview`, inte från Git.

### Vercel `web`

`vercel.json:12–14`: root `apps/croupier-frontend`, `buildCommand` `npm run build`. `apps/croupier-frontend/package.json:6` kör `node tools/prepare-platform-ui.mjs` före `next build`. Repot är `resolve(app, '../..')` (`prepare-platform-ui.mjs:8`). Enda raden som byts är rad 36. Utdata förblir `public/composition-runtime/`. Ingen `vercel.json`-ändring.

### Studio

`lab/package.json:7–9`: `prepare:preview`, `dev` och `build` anropar `node tools/prepare-preview.mjs`. `lab/start.mjs:79` och `:108` anropar `preparePreview()` utan argument, alltså standardrötterna på rad 22–23. Vercel-tjänsten `studio` har root `lab` och `npm run build` (`vercel.json:21–23`). Byt bara rad 22–23. `lab/next.config.mjs:30` fortsätter att spåra `./preview-build/**/*`. `outputFileTracingRoot` är redan repots rot (rad 21).

## 5. Föreslagen flyttcommit

En commit. Affärslogik, URL:er, `catalog.json` och mediafiler orörda.

```sh
mkdir -p packages/presentation
git mv test-videoeditor/program/web packages/presentation/compositor
git mv test-videoeditor/program/docs packages/presentation/docs
git mv test-videoeditor/preview packages/presentation/preview
git rm test-videoeditor/README.md
rmdir test-videoeditor/program test-videoeditor 2>/dev/null || true
```

Ny `packages/presentation/README.md`: paketet äger `compositor/`, `docs/` och `preview/`; konsumenterna är de fyra bygg-/serverfilerna ovan; publika URL:er är stabila; `git mv` behåller blobbar; `index.html`, `app.js` och `viewer.*` följer med men serveras inte. Ta med de två fakta som annars bara står i den borttagna README:n: Python-verkstaden fanns bara på raderade `test-video-jakob`, och mediabitarna stannar som filer.

Sedan radbytena i avsnitt 2, inklusive krok och orphan-verktyg. Avsluta med:

```sh
git ls-files test-videoeditor
git grep -n -F test-videoeditor
node ordning/verktyg/cross-imports.mjs --all-edges
```

Första kommandot ska vara tomt. Andra ska bara träffa `ordning/**` (historiska citat och den döda klassaren).

### Kanter på basen

`node ordning/verktyg/cross-imports.mjs --all-edges` ger sex kanter, alla in till `test-videoeditor/program`:

| Antal | Kant | Filer |
| --- | ---: | --- |
| 2 | `lab/test -> test-videoeditor/program` | `lab/test/dealer-framing.test.mjs` => `compositor.js`, `geometry.js` |
| 2 | `test -> test-videoeditor/program` | `test/composition-runtime.mjs` => samma två |
| 2 | `web(server) -> test-videoeditor/program` | `web/composition-runtime.mjs` => samma två (`new URL`) |

Inga kanter ut från `test-videoeditor/preview`. `prepare.mjs` använder `join`, inte `import`.

### Förväntat efter flytten

Samma sex kanter, nytt områdenamn `packages/presentation`:

- `lab/test -> packages/presentation` (2)
- `test -> packages/presentation` (2)
- `web(server) -> packages/presentation` (2)

Noll kanter ut från paketet. Antalet ska inte sjunka. `join`/`resolve` i `prepare-platform-ui.mjs`, `layer-packs.mjs`, `prepare-preview.mjs` och `preview/prepare.mjs` förblir osynliga för verktyget och ska ändå vara bytta. Intern `./geometry.js` och `<script src="app.js">` stannar i samma område och räknas inte.

## 6. Krockar

Spärrar nu:

1. V2 är mergad till `main` (`061294ab`) och trädet är redan det här. Produktionskontrollen av den SHA:n är inte gjord i den här läsningen. B12 och uppdraget säger att flytten väntar på den.
2. Öppen PR: bara #21 `cursor/speech-audio-overlap` (bas `main`). Filer: `docs/CLOUD-MIGRATION.md`, `docs/JOHN-HANDOFF.md`, `docs/LOCAL-PRESENTATION-RUNTIME.md`, `test/generated-speech-stream.mjs`, `web/generated-speech-session.mjs`, `web/generated-speech-stream.mjs`, `web/speech-journal-runtime.mjs`. Den rör två dokument som flyttcommiten också skriver. Hunkarna överlappar inte A20:s rader: handoffen får 8 rader efter rad 2, runtime-dokumentet 6 rader efter rad 208. A20 skriver handoff rad 422 och runtime-dokumentet rad 290. Efter merge av #21 måste de radnumren mätas om. Aktivitetens steg 0 släpper inte igenom en öppen PR som rör de filerna.
3. Lane-uppdraget (handoff rad 137–180) har ingen kod och ingen PR. Det förbjuder samtidig flytt av samma moduler. Dess startfiler (`web/public/game-lanes.mjs`, `web/presentation-room-contract.mjs`, `web/game-entry-operator.mjs`, `AGENTS.md`, `docs/CLOUD-MIGRATION.md`, `lab/docs/TERMINOLOGI.md`) ingår inte i A20:s radlista. `lanes.js` i kompositorn är redigerarens UI och ska bara byta katalog.

`git log origin/main --since=3.days` har inget commit efter `cf011b1c` som ändrar en konsumentfil. Äldre träffar i fönstret ligger redan i basen (`bf23b987` rör `pre-commit-full`, `composition-preview.tsx`, `presentation-composition.mjs`; `0c04d1a2` rör kompositionsprov och `composition-runtime`-provet; `dda785ec` lade till bindningsprovet; `bd5fb094` rör `prepare-platform-ui.mjs`).

Lokala agent-talk-anspråk syns inte här. Orkestratorn kontrollerar dessa filer innan flytten:

`test-videoeditor/**`, `packages/presentation/**`, `apps/croupier-frontend/tools/prepare-platform-ui.mjs`, `apps/croupier-frontend/test/platform-ui.mjs`, `web/composition-runtime.mjs`, `web/layer-packs.mjs`, `web/server.mjs`, `lab/tools/prepare-preview.mjs`, `lab/lib/preview-files.mjs`, `lab/lib/dealer-forge-catalog.mjs`, `lab/app/preview/[...path]/route.ts`, `lab/components/composition-preview.tsx`, `lab/test/dealer-framing.test.mjs`, `lab/test/preview-prepare.test.mjs`, `lab/package.json`, `lab/next.config.mjs`, `lab/start.mjs`, `test/composition-runtime.mjs`, `test/browser-runtime-bindings.mjs`, `test/layer-packs-route.mjs`, `test/layered-presentation.mjs`, `docs/system-map/routes.json`, `docs/system-map/index.html`, `CLAUDE.md`, `docs/LOCAL-PRESENTATION-RUNTIME.md`, `docs/JOHN-HANDOFF.md`, `.githooks/pre-commit-full`, `tools/check-orphan-tests.mjs`, `ops/cloud/Dockerfile`, `.dockerignore`.

Mät om vid genomförandet: `git rev-parse origin/main^{tree}`, `git grep -n -F test-videoeditor`, `node ordning/verktyg/cross-imports.mjs --all-edges`, `gh pr list --state open` och `gh pr diff <nr> --name-only`. Om trädet inte längre är `4e5c6a51` eller en konsumentfil har en ny rad, skriv om den raden i planen innan `git mv`.

## 7. Provplan

Läsande körning på den här molnmiljön (Node 22.14.0, `lab/node_modules/proper-lockfile` saknas):

| Prov | Resultat |
| --- | --- |
| `node --test test/layer-packs-route.mjs` | 3/3 gröna. Range-provet läser riktiga `player.js` |
| `node --test test/composition-runtime.mjs` | startade inte: `ERR_MODULE_NOT_FOUND` `proper-lockfile` från `lab/lib/project-store.mjs`. Inte ett produktfel på basen |
| `auditOrphanTests()` | 344 filer, 0 orphans. `prepare.test.mjs` ingår inte |

Genomförandets prov, efter radbytena och med Studio-beroenden installerade (CI använder Node 24):

```sh
node --test --test-concurrency=4 \
  test/composition-runtime.mjs \
  lab/test/dealer-framing.test.mjs \
  lab/test/preview-prepare.test.mjs \
  packages/presentation/preview/prepare.test.mjs \
  apps/croupier-frontend/test/platform-ui.mjs \
  test/layer-packs-route.mjs \
  test/layered-presentation.mjs \
  test/browser-runtime-bindings.mjs
node docs/system-map/verify.mjs --check
node tools/check-orphan-tests.mjs
node ordning/verktyg/cross-imports.mjs --all-edges
```

Ytterligare prov som läser flyttade filer eller deras URL:er och redan ligger i kroken: `lab/components/composition-preview.test.mjs` (stubbar `/preview/compositor.js`), `apps/croupier-frontend/test/player-scene-canvas.mjs` (stubbar `/composition-runtime/compositor.js`). `npm --prefix lab run build` kör `prepare-preview` och ska hasha om de 29 filerna. Frontendbygget med plattformsmiljö ska skriva `public/composition-runtime/` med samma sha256 som tabellen ovan.

Efter deploy, orkestratorn:

1. Öppna den befintliga spelaren med `?lane=layer-preview&rehearsal=1`. Panelen i `web/public/app.mjs:1919` har `Play twice` (rad 1926). Två uppspelningar i rad. Ingen ny läppsynkacceptans.
2. `https://www.scoutgaming.tech/composition-runtime/compositor.js` ska ha sha256 `a668ed9380e62314e3ddaef236f2e2dea823609a4587b930f6c76fe53866906e`. Samma summa på Render-originens `/composition-runtime/compositor.js` och, med lane-kakan, `/layer-packs/runtime/compositor.js`.
3. Studio `/studio/preview/compositor.js` ska ha samma summa. `/studio/preview/index.html` ska inte: den är omskriven.

Ingen ny miljövariabel. `docs/ENVIRONMENT-VARIABLES.md` rörs inte.

## 8. Återställning

`git revert <flyttsha>` utan force. Rename-detektion återställer `test-videoeditor/**` och konsumentraderna. Genererade kataloger ligger utanför Git och återställs inte av revert:

- `node lab/tools/prepare-preview.mjs` eller `npm --prefix lab run build` (skriver om `lab/preview-build`)
- frontendens `npm run build` när plattformsmiljön är satt (`preparePlatformUi` returnerar `enabled:false` före kopieringen om konfiguration saknas, `prepare-platform-ui.mjs:12`)
- ny Render-image (`Dockerfile` rad 6 och 11) och ny Vercel-deploy av tjänsterna `web` och `studio`

Om flytten inte är deployad räcker revert i Git. Kopiornas kompositorbyte är ändå desamma, eftersom källblobbarna inte ändrades. Bygg om ändå innan nästa start, så processen inte beror på en halvglömd katalog.

## Tveksamt

- `tools/check-orphan-tests.mjs` står inte i A20:s ägda filer, men steg 4 kräver att `prepare.test.mjs` hittas. Utan den ändringen förblir provet osynligt (inte ett orphan, bara okontrollerat). Orkestratorn bör säga ja innan flyttagenten rör filen.
- `app.js`, `index.html`, `viewer.html`, `viewer.js` och `viewer.css` har ingen importör utanför trädet. `browser-runtime-bindings.mjs` parsar varje `.js` i katalogen. Produktionskopian tar bara `player.js`, `compositor.js`, `bridge.js`, `geometry.js` och `lanes.js`. `app.js` anropar `/api/` med `X-Studio-Token`. `viewer.js` hämtar `./manifest.json`, som inte finns i trädet. Flytta med. Pensionera inte i A20.
- `preview/site/` är 29 filer och 12 202 577 byte. Målstrukturen lägger dem i `packages/presentation/preview/site/`. Alternativet `media/` är inte beslutat. Planen följer aktivitetens mål. En annan plats skulle byta fler konsumenter och är inte den här commiten.
- Ingen av de tre publika adresserna behöver byta. `/test` på en återskapad gren `test-video-jakob` är en död port i `prepare.mjs`, inte en adress som produktion serverar idag.
- `verify.mjs:98` kan senare få prefixet `packages` så att kartans README-rad blir en hård referens. Det ingår inte i flyttcommiten.
- PR #21 kan mergas före flytten och flytta radnummer i handoffen och runtime-dokumentet. Mät om. Skriv inte om de historiska PAOW-avsnitten.
