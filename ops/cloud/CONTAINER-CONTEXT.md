# Produktcontainerns byggkontext

`ops/cloud/Dockerfile` använder reporoten som byggkontext:

```sh
docker build -f ops/cloud/Dockerfile .
```

Dockerfilen kopierar kontexten efter `.dockerignore`, installerar beroenden
för Web, Lab och talreläet, och bygger Lab med `/studio` som `basePath` som
standard. `container-entry.mjs` startar sedan runtime i `start.mjs` efter
lagringskontroller och byte till användaren `node`. `apps/studio/` är Studios
källmapp; Lissabon är ingen separat produkt eller image.

| Innehåll som kontexten behåller | Nuvarande roll |
| --- | --- |
| `web/`, `apps/studio/`, `apps/web/` | Spelserver, Studio och spelargränssnittets källkod. `web/public/` behåller publik kod och resurser; produktens medieauktoritet är scoped Neon och privat Blob. |
| `packages/`, `tools/`, `ops/` | Gemensamma paket, byggverktyg och produktstart. Guide- och policydata under `apps/studio/docs/` och `apps/studio/policies/` följer också med. |
| `services/astrid-gpu-worker/gateway/` | Talreläet vars beroenden denna Dockerfil installerar. GPU-imagen har en egen Dockerfil och byggs inte av kommandot ovan. |
| `media/**/runtime` | Filträdet utesluts inte generellt. Eventuella medföljande filer blir inte metadata- eller bytesreserv: produktens runtime använder Neon och Blob. |
| `tools/media/` | Bevarade verktyg och byggrecept, beskrivna i [mappguiden](../../tools/media/README.md). Mappen följer med men är ingen tjänst som containern startar. |

`media/layout.json`, `media/blob-index.json` och hela `media/catalog/` är
uttryckligen uteslutna ur denna byggkontext. De är lokala authoring-/importkällor,
inte deployade runtime-register. Native Studio och spelservern hämtar layout,
Blob-index och presentations-/JSON-metadata ur scoped `runtime_media_catalogs`;
svarsbibliotekets metadata ligger i `speech_reply_records`. Mediebytes hämtas
från privat Blob med oförändrade identitets- och hashkontroller. Saknad eller
felaktig katalog får inte ersättas med filinläsning från imagen.

`web/storage/video-registry.mjs` komponerar den gemensamma registerkärnan som
validerar det levererade mediemanifestet och referenserna; den
importerar inte längre `tools/media/build-lab-video-manifest.mjs`. Den gamla
lokala omskanningen svarar 410. De tidigare rötterna `emil/dealklipp-v1/`
och `content/dealers/` är inte bankens kanoniska lagringsplatser.

`.dockerignore` utesluter bland annat Git, lokala cache-/beroendemappar,
hela privata `arkiv/`, hemligheter, muterbara Web-/Lab-/OpenClaw-data, `docs/`, `test/`, `apps/studio/test/`
och mediernas `source`, `staging`, `review`. Vissa redan borttagna mappnamn
står kvar bland undantagen för att filtrera en återställd äldre kopia.
Reglerna filtrerar byggkontexten och raderar inga lokala filer.

OpenClaw-imagerna använder egna Dockerfiler och ignore-filer
(`open-claw/lab/.dockerignore` eller `Dockerfile.dockerignore` beroende på
byggkontext). Kommandot ovan publicerar inte dessa imager.

Konfiguration och beständiga data kommer från driftsmiljön, inte från en
kopierad `.env` eller lokal databas. Uppstarten accepterar de lagringslägen
som `container-entry.mjs` och `config.mjs` uttryckligen validerar. Efter en
kontextändring ska den byggda imagen, uppstart, inloggning och åtkomst till
de medier produkten använder verifieras. Denna guide beskriver kod och
kopieringsregler; driftsacceptans följs i den befintliga
[molnplanen](../../docs/CLOUD-MIGRATION.md).
