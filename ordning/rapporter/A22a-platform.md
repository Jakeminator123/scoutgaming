# A22a · Platformkarta (läsande)

Mätt på `cursor/a21-presentation-runtime-00a5` `24dbb9a4` (`Record the A21 presentation-runtime move report`). Ingen kod, inget prov och ingen konfiguration är ändrad. `origin/main` är `003a8bce` (PR #48). GitGuardian mot den SHA: GitHub-täckning komplett, kontrollen köad, incidentlista och plats olästa (`gg_read_windows_connection_required`). Ingen incidentpost lästes.

## Steg 0

Baslinje `00ea55c5`. A05 på `43bb429c` står inom parentes. Tolerans: notera under 5 %, lyft över.

| Kant | Bas | A05 | Nu | Avvikelse |
| --- | ---: | ---: | ---: | --- |
| `lab/lib → web(server)` | 125 | 131 | 131 | +4,8 % |
| `web(server) → lab/lib` | 34 | 34 | 34 | 0 |
| `lab/lib → web/public` | 30 | 31 | 33 | +10 % |
| `apps/croupier-frontend → web/public` | 26 | 26 | 34 | +31 % |
| `lab/components → web/public` | 21 (A22-fakta) | — | 34 | över 5 % |
| `ops/cloud → web(server)` | 10 | — | 10 | 0 |
| `presentation-runtime → lab/lib` | 13 | 13 | 13 som `packages/presentation → lab/lib` | A21 bytte områdesnamn |
| `lab/lib → open-claw/lab/src` | 15 | 15 | 15 | 0 |
| `pipeline → web/public` | 46 | 46 | 18 | −61 %, orsak inte isolerad |

`node ordning/verktyg/cross-imports.mjs --edges` exit 0. `--all-edges` finns och gav 2268 rader, exit 0. Inga olästa filer.

## Kanttal nu

| Riktning | Kanter | Moduler |
| --- | ---: | ---: |
| `lab/lib → web(server)` | 131 | 29 |
| `web(server) → lab/lib` | 34 | 14 |
| `lab/lib → web/public` | 33 | 16 |
| `lab/components → web/public` | 34 | 12 |
| `apps/croupier-frontend → web/public` | 34 | 12 |
| `ops/cloud → web(server)` | 10 | 8 |
| `ops/cloud → web/public` | 3 | 2 |
| `packages/presentation → lab/lib` | 13 | 6 |

Intill, inte i A22-fakta: `lab/components → web(server)` 5/4, `apps/croupier-frontend → web(server)` 3 (alla `web/game-entry-operator.mjs`), `apps/croupier-frontend → lab/lib` 1 (`workspace-surfaces.mjs`), `web(server) → lab/policies` 1 (`project.seed.json`).

Ingen läst korsmodul kör vid import: env, timer, DB-pool eller Blob. Fil vid import = statisk JSON-import. `M` = modul-Map. Env och DB/Blob nedan sker inuti funktioner.

## Graf, webbmoduler som lab importerar

| Modul | Kanter lab/lib | Ren | Import | Env (registret) | DB/Blob |
| --- | ---: | --- | --- | --- | --- |
| `web/storage/studio-contract.mjs` | 39 | nej | drar `studio-model`, `social.mjs`, `managed-media-contract`, `game-lanes` | — | nej |
| `web/dealer-identity.mjs` | 13 | ja, återexport | `web/public/dealer-identity.mjs` | — | nej |
| `web/presentation-layers.mjs` | 7 | nej | frozen playback, composition, managed media, layer-asset | — | nej |
| `web/storage/presentation-package.mjs` | 7 | nej | gzip av publicerat paket; i cykeln nedan | — | nej |
| `web/storage/frozen-presentation-capture.mjs` | 7 | nej | rum, lager, `studio-model`, frozen idle | — | nej |
| `web/presentation-room-contract.mjs` | 6 | nej | läser paket i minnet; cykel | — | nej |
| `web/storage/operator-store.mjs` | 6 | nej | SQL via injicerad `sql` | — | ja, anrop |
| `web/partner-access-policy.mjs` | 4 | nej | bara `validateStudioScope` | — | nej |
| `web/presentation-capability-contract.mjs` | 4 | ja | inga | — | nej |
| `web/storage/studio-game-policy.mjs` | 4 | nej | `postgres-store`, `studio-model` | `CROUPIER_STUDIO_NEON_POLICY`, `CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`, `CROUPIER_GAME_DATABASE_URL`, `CROUPIER_ZONES_DATABASE_URL` (render-game + vercel-lab-ui) | anslutningssträng, ingen pool här |
| `web/account-role.mjs` | 4 | ja | inga | — | nej |
| `web/storage/studio-repository.mjs` | 3 | nej | dealer-identity, studio-contract | — | ja, pool in |
| `web/storage/postgres-store.mjs` | 3 | nej | `pg` via `web/package.json`; schema-URL | — (läser inte env själv) | pool i `createPostgresStore`; tabellistan har `players` och `transactions` |
| `web/storage/operator-lifecycle.mjs` | 2 | nej | cykel mot rumskontraktet | — | nej |
| `web/layer-asset-contract.mjs` | 2 | ja | inga | — | nej |
| `web/storage/frozen-dealer-idle.mjs` | 2 | nej | runtime idle, video-intake, layers | — | nej |
| `web/account-credentials.mjs` | 2 | nej | account-role | — | nej, tar db in |
| `web/storage/async-bo-auth-epoch.mjs` | 2 | nej | inga importer, läser epoch | — | ja, anrop |
| `web/storage/async-craig-identity.mjs` | 2 | nej | scrypt mot users | — | ja, anrop |
| `web/storage/studio-runtime.mjs` | 2 | nej | repository, game-policy, migrations | `CROUPIER_DATABASE` (render-game) | ja |
| `web/speech-reply-library.mjs` | 2 | nej | blob-klient, cloud-media-store | — | ja |
| `web/generated-speech.mjs` | 1 | nej | — | flera `CROUPIER_GENERATED_SPEECH_*`, `RUNPOD_API_KEY` (render-game) | journal |
| `web/storage/partner-branding.mjs` | 1 | ja | inga | — | nej |
| `web/demo-operators.mjs` | 1 | ja | inga | — | nej |
| `web/frozen-dealer-playback.mjs` | 1 | nej | runtime idle, studio-model | — | nej |
| `web/partner-api.mjs` | 1 | nej | — | — | blob i funktion |
| `web/storage/player-administration.mjs` | 1 | nej | — | — | INSERT `players.balance` 1000 och `transactions` |
| `web/email-templates.mjs` | 1 | ja, text | inga | — | nej |
| `web/shoe-game.mjs` | 1 | nej | `web/public/blackjack.mjs` | — | skon och rundan; lab tar bara `SHOE_RULES` |

`web/public` som lab/lib importerar, alla utan import-I/O: `game-lanes` 7, `dealer-identity` 3, `composition-settings` 3, `dealer-speech-profile` 3, `speech-lines` 2, `speech-pose-gate` 2, `background-playback-policy` 2, `speech-reply-library` 2, `dealer-framing` 2, och en vardera av `operator-rooms-contract`, `performance-contact`, `lab-speech-bridge`, `chat-response`, `game-entry-contract`, `dealer-compositing`, `astrid-voice-profile`. Rena validerare: dealer-identity, composition-settings, dealer-compositing, speech-reply-library (kategorier), background-playback-policy. `game-lanes` är delat spelval, inte ett löv. Samma filer hämtas som ESM av `web/public/app.mjs` och `local-presentation.mjs`.

## Graf, labmoduler som web importerar

| Modul | Kanter web | Ren | Import | Env | DB/Blob |
| --- | ---: | --- | --- | --- | --- |
| `lab/lib/studio-model.mjs` | 10 | ja enligt filen | JSON `project.seed` + `studio-contract.json`; runtime idle/legacy; web/public | — | nej |
| `lab/lib/video-registry.mjs` | 4 | nej | cloud-media, project-store, fil | `LAB_PUBLIC_URL` saknas i registret | fil + Blob |
| `lab/lib/video-intake.mjs` | 3 | nästan | JSON-seed, schema, `media-families` | — | nej |
| `lab/lib/cloud-media-store.mjs` | 3 | nej | `M` pending + verifiedFiles | `CROUPIER_MEDIA_STORAGE`, `BLOB_READ_WRITE_TOKEN` saknas i registret | Blob lazy `import('@vercel/blob')` |
| `lab/lib/project-store.mjs` | 2 | nej | studio-model, lockfile | — | fil `project.json` |
| `lab/lib/probe-fixtures.mjs` | 2 | ja, QA-data | inga | — | nej |
| `lab/lib/probe-policy.mjs` | 2 | nästan | JSON-seed vid import | — | nej |
| `lab/lib/studio-media-runtime.mjs` | 2 | nej | neon-registry, bindings | — | ja, anrop |
| `lab/lib/media-file-types.mjs` | 1 | ja | inga | — | nej |
| `lab/lib/idle-advice-server.mjs` | 1 | nej | open-claw, studio-model, runtime | — | nej vid import |
| `lab/lib/studio-native-auth.mjs` | 1 | nej | studio-contract, access-policy | — | nej |
| `lab/lib/speech-reply-blob-client.mjs` | 1 | ja, lazy | 4 rader, ingen kontakt vid import | — | Blob först vid anrop |
| `lab/lib/studio-access-policy.mjs` | 1 | ja | bara `account-role` | — | nej |
| `lab/lib/studio-game-authority.mjs` | 1 | nej | HMAC, `fetch` till motorn | `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`, `CROUPIER_VERCEL_INGRESS_SECRET` (vercel-lab-ui) | nej plånbok här |

## Övriga ytor och A21

`lab/components → web/public`: flest `dealer-framing` 7, `dealer-compositing` 5, `background-playback-policy` 4. Tillkommer `background-playback`, `generated-speech-player`. `apps/croupier-frontend → web/public`: `operator-rooms-contract` 5, `composition-settings` 5, `operator-preview-contract` 4, `game-entry-contract` 4, `game-lanes` 3, plus `published-scene`, `player-choices`, `auth-modal`, `blackjack-entry` (mjs/css/html), `dealer-identity`. Next packar dem. Render-spelet hämtar samma `web/public`-filer som ESM.

`ops/cloud → web`: `graceful-shutdown` 3, och en vardera `postgres-store`, `native-ai-qa-private`, `operator-speech-qa`, `native-p6-qa-hook`, `openclaw-chat`, `bo-lab-auth`, `presentation-capabilities`, samt `game-entry-contract` 2 och `game-lanes` 1. Bootmoduler hör inte hemma i platform.

A21, oförändrad riktning (`packages/presentation/runtime`):

| Runtime | Mål | Hör hemma |
| --- | --- | --- |
| `idle-policy.mjs` | `web/public/dealer-identity`, `lab/policies/idle-policy.seed.json` | kontrakt + policy-JSON |
| `registered-idle-policy.mjs` | `web/dealer-identity`, `video-intake` | kontrakt, sedan media |
| `registered-idle.mjs` | samma | samma |
| `registered-idle-rules.mjs` | publik dealer-identity, `studio-model`, `video-intake`, `open-claw/.../engine.mjs` | open-claw stannar |
| `selection.mjs` | openclaw, engine, `studio-model`, `project-store`, `video-registry`, `video-intake` | lagring/media; open-claw stannar |
| `shoe-transitions.mjs` | `video-intake` | media |
| `legacy-clip-policy.d.mts`, `registered-idle-policy.d.mts` | `studio-model`, `legacy-clip-inventory`, `idle-policy`, `studio-types` | typer följer studio-model |
| `lab/lib/idle-policy.mjs` | återexport av runtime | shim, inte platform |

`video-intake` importerar `media-families.mjs`. Flyttas intake till platform medan families ligger i presentation blir det `platform → presentation → platform`.

## Skivor, lägst risk först

Varje skiva: `git mv`, bara sökvägar, inga shims utom webbläsar-URL. `.githooks/pre-commit` anropar bara `tools/precommit-checks.mjs`. Källsökvägar sitter inte där. `pre-commit-full` listar proven; raden ändras bara om en testfil flyttas. `docs/system-map/verify.mjs` ger rött om en registrerad sökväg saknas, gult om `expectedHashes` inte matchar. Uppdatera nyckeln för den filen. Kör inte `--refresh-baseline`. Vercel: `outputFileTracingRoot` är redan repo-roten i `lab/next.config.mjs` och `apps/croupier-frontend/next.config.mjs`. Paket under roten följer statiska importer. Render: `ops/cloud/Dockerfile` har `COPY . .`. Ingen av dem behöver ny rot. `packages/` har inget `package.json`; A21 använde relativa importer.

| Skiva | Filer | Importörer | Prov | Risk |
| --- | --- | --- | --- | --- |
| 1 | `presentation-capability-contract.mjs`, `layer-asset-contract.mjs`, `lab/lib/media-file-types.mjs` | 11, 5, 7 | `test/presentation-capability-contract.mjs`, `test/presentation-capabilities.mjs`, `lab/test/presentation-room-api.test.mjs`, `lab/test/presentation-runtime-readiness.test.mjs`, `lab/test/dealer-lifecycle.test.mjs`, `test/layer-asset-store.mjs`, `lab/components/background-playback-editor.test.mjs`, `lab/test/dealer-media-library.test.mjs`. Krok: full rad 39, 42, 44, 64 | 10 % |
| 2 | `account-role.mjs` | 7: `studio-access-policy`, `studio-admin-accounts`, `studio-native-auth-actions`, `studio-native-mail`, `account-credentials`, `operator-store`, `test/partner-access-policy.mjs` | krok rad 31. Systemkarta `contracts.json` + `routes.json` | 18 % |
| 3 | `partner-branding.mjs`, `demo-operators.mjs` | 6 och 2 | `lab/test/partner-branding-drafts.test.mjs`, `test/partner-branding-postgres.mjs` | 12 % |
| 4 | `partner-access-policy.mjs`, `studio-access-policy.mjs` | 10 och 19 | `test/partner-access-policy.mjs`, `test/operator-store.mjs`, `lab/test/studio-access-policy.test.mjs`, `lab/test/partner-*.test.mjs`. Krok rad 30–33. Kartan har hash på båda policyfilerna | 28 % |
| 5 | `studio-model.mjs` + de två JSON-filerna den importerar | 212 (98 produkt, 114 test) | `lab/test/studio-model.test.mjs` och i praktiken Studio-sviten. För stor att lista här | 42 % |
| 6 | `studio-contract.mjs` | 78 (60 produkt). Båda sidor, `ops/neon-studio` 5 | `test/studio-repository.mjs`, `test/studio-retained-bank.mjs`, `test/operator-store.mjs`, `lab/test/studio-media-api.test.mjs`. Karta: två olika expectedHashes för samma sökväg | 48 % |
| 7 | cykeln `presentation-room-contract` + `presentation-package` + `operator-lifecycle` | 15, 39, 6 | `test/presentation-rooms.mjs`, `lab/test/room-lifecycle.test.mjs`, `test/roulette-publication.mjs`. Krok rad 40–42 | 52 % |
| 8 | `presentation-layers.mjs` | 39 | `test/presentation-layers.mjs` m.fl. Krok rad 42. Karta har sökväg och hash | 40 % |
| 9 | `operator-store.mjs` | 25 | `test/operator-store.mjs`, partner-testerna. Krok rad 31. Hash i kartan | 55 % |
| 10 | `project-store.mjs` | 33, varav `web/server.mjs` och `web/presentation-api.mjs` | `lab/test/project-store.test.mjs`, `lab/test/neon-project-store.test.mjs`. Krok rad 48 | 35 % |
| 11 | `postgres-store.mjs` | 15, inkl. `ops/cloud` | `test/postgres-persistence.mjs`, `test/sqlite-postgres-migration.mjs`. Karta `storage.json` + hash. Relativ URL till `ops/neon-game/product-schema.sql` måste räknas om | 60 % |
| 12 | `frozen-presentation-capture.mjs`, `frozen-dealer-idle.mjs` | 16, 11 | krok rad 39. Publicerat paket | 58 % |
| 13 | `cloud-media-store.mjs` | 24, inkl. `web/server.mjs` | `lab/test/cloud-media-store.test.mjs`, `lab/test/blob-source-routing.test.mjs`. Krok rad 68. Karta `storage.json` tre sökvägar. Env saknas i registret | 45 % |
| 14 | `video-intake.mjs`, sedan `video-registry.mjs` | 48, 22 | `lab/test/video-intake.test.mjs`, `lab/test/video-registry.test.mjs`, `lab/test/neon-video-registry.test.mjs`. Families först, annars paketcykel | 40 % |
| sist | `player-administration.mjs`, `studio-game-policy.mjs`, `studio-runtime.mjs`, `studio-game-authority.mjs`, `account-credentials.mjs`, `async-craig-identity.mjs` | saldo, policy, HMAC | `test/studio-game-policy.mjs`, `test/studio-game-authority.mjs`, `test/player-password.mjs`, `test/postgres-persistence.mjs` | 70 % |

Skiva 1-importörer, alla: capability → `presentation-room-api`, `presentation-room-client`, `presentation-runtime-readiness`, `studio-native-runtime`, `presentation-capabilities` + sex prov. layer-asset → `dealer-forge-service`, `studio-model`, `presentation-layers`, `public-operator-preview` + ett prov. media-file-types → `dealer-media-library.tsx`, `dealer-forge-service`, `neon-video-registry`, `studio-upload-service`, `upload-native-video`, `managed-media-contract` + ett prov. Ingen av dem står i `environment-variables.json`.

Flyttas inte: `shoe-game.mjs` (lab importerar bara `SHOE_RULES` från `studio-admin-readouts.mjs`; resten är sko och runda, även `web/server.mjs`, `native-table.mjs`, `postgres-native-table.mjs`). Inte heller ops-boot (`graceful-shutdown`, native-ai-qa, `openclaw-chat`). `web/public/*` som spelet hämtar som ESM stannar på URL:en, samma skäl som A21-shimen.

Båda sidor muterar, och `web/server.mjs` ligger i samma process som lab-importerna: `cloud-media-store` (Maps), `project-store`, `video-registry`, `operator-store`, `studio-repository`, `presentation-package`, `player-administration`.

En cykel i mängden: `presentation-room-contract` → `presentation-package` → `operator-lifecycle` → tillbaka. `studio-contract` → `studio-model` är enkelriktad.

## Täckning

`node ordning/verktyg/coverage.mjs`: 87 mappar, 3 utan rapport. Omfånget:

| Mapp | Filer | MiB | Lästa här |
| --- | ---: | ---: | --- |
| `web` | 77 | 0,65 | korsande servermoduler, inte hela mappen |
| `web/storage` | 28 | 0,25 | korsande moduler |
| `web/public` | 89 | 0,66 | korsande kontrakt, inte hela ytan |
| `lab/lib` | 222 | 0,94 | de 14 som web importerar, plus intake/model |
| `lab/components` | 168 | 1,47 | bara som importörer |
| `apps/croupier-frontend` | 10+ underliggande | — | importörerna mot `web/public` |
| `ops/cloud` | 31 | 0,24 | kanterna mot web, inte hela booten |
| `packages/presentation` | 65 | 11,85 | A21-kartan, inte mediabinärer |
| `packages/platform` | 0 | 0 | finns inte |

`web/games/roulette` (8), `web/public/roulette` (4) och `web/public/roulette-test` (3) saknar rapport och ingår inte i korsgrafen. De är inte lästa. Mediabinärer är inte skannade.

## Tveksamt

- Skiva 1 i aktivitetsfilen är inte rena löv. `studio-contract`, `presentation-layers` och `presentation-room-contract` drar andra moduler. Förslaget skjuter dem till skiva 6–8. Jakob avgör om den ordningen gäller.
- `account-role` är ren men mappar `superadmin` → admin och `reader`/`staff`/`player` → player. Egen skiva, eller ihop med skiva 1?
- `web/public/dealer-identity.mjs` är kanon och webbläsar-ESM (`local-presentation`, `game-lanes`, `app.mjs`). Flytt utan fil kvar på URL:en ger 404. Ska implementationen stanna i `web/public` tills spelklienten packas?
- Cykeln rum/paket/lifecycle måste flyttas i en commit. Delning lämnar en kant.
- `shoe-game.mjs` ska inte flyttas. Ska `SHOE_RULES` brytas ut, eller får lab fortsätta importera modulen?
- `player-administration.mjs` skriver startsaldo 1000 och importeras av `lab/lib/studio-admin-data.mjs`. Den stannar i spelmotorn om inte Jakob säger annat.
- `cloud-media-store`, `video-registry` (`LAB_PUBLIC_URL`) och `legacy-clip-inventory` (`CROUPIER_DATA_DIR`) läser env och saknas i `sources`. Kontrollen skannar bara listade filer. Ska luckan fyllas i samma skiva?
- `video-intake` före `media-families` skapar paketcykel. Vilken fil flyttas först?
- `studio-model` har 212 importörer och JSON vid import. Fullständig sökvägslista ryms inte här.
- `contracts.json` har två olika expected hashes för `studio-contract.mjs`. Jag har inte räknat om vilken som matchar trädet.
- `demo-operators.mjs` säger att Render-imagen bara bär `web/`. Dockerfilen gör `COPY . .`. Jag hittade ingen test som kopierar enbart `web/*.mjs`.
- `pipeline → web/public` 46 → 18 och frontend/components över 5 % är inte förklarade. Mätningen är A21-branchen, inte `003a8bce`. Mains två nya commits ändrar inte importen i `platform-routing.mjs`; kroken får `test/public-lobby.mjs`.
- open-claw-anrop från runtime stannar. De är inte platform.
