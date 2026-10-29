# packages/presentation

Paketet äger presentationskompositorn, rena projekt- och mediakontrakt samt urvals- och vilereglerna,
och används av både Admin (`apps/studio`) och spelmotorn (`services/game`). En mall (i Admin "Sammansättning"
eller "Spelmall", `lane` i koden) är en presentation; ett sparat lane-ID är en kompatibilitetsidentitet, inte en
extra produktnivå. Begreppen står i [ordlistan](../../apps/studio/docs/TERMINOLOGI.md) och lagrings- och
uppspelningskontraktet i [runtimekontraktet](../../docs/LOCAL-PRESENTATION-RUNTIME.md).

- `compositor/` — kompositor (`compositor.js`) och geometri (`geometry.js`). Den fristående redigeraren, spelaren, bryggan och lagerpaketen (`/layer-packs`) är borttagna.
- [Speldokumentation](../../docs/games/README.md) — blackjack och roulette på en gemensam ingång.
- `contracts/` — ren projektmodell, video-/rouletteregler, browserpolicy, schema och seeddata. Studio, Admin och spelserver importerar samma källa. Inventarie- och legacy-datatyper ägs också här; UI och lagring behåller sina egna funktioner.
- `runtime/` — gemensam scen, spelarval, bakgrund, taluppspelning, idle, filmfamiljer, legacy-klipp och skobyten. Rena modell-/medieregler, kortkalibrering och filmprofiler använder `contracts/`, utan import tillbaka till spelappen.
- `server/` — urvalsfabrik, ren bindningsvalidering och fabrik för registrerade idle-regler. Den sistnämnda får samma `prepareDecision` från appens Director-komposition, utan att paketet importerar OpenClaw. Kärnan får projektmodell, Director och medieregler från separata appkompositioner i `apps/studio/lib/presentation-selection.mjs` och `services/game/presentation-selection.mjs`; varje anrop skickar sitt eget register. Bindningskompositionen i `packages/presentation/server/default-video-bindings.mjs` behöver ingen Director.
- `public-modules.mjs` — explicit lista över browserfiler och deras kanoniska/äldre URL:er. HTTP-server, Vercelroutning, statiska byggkopior och isolerade källfixturer delar listan. Serverfabriker, projektseed och privata appar ingår aldrig.
- `capability-contract.mjs` — importfritt kontrakt för versionsförhandling mellan spelserver och Studio. Serverendpoint, readiness och bundlad klient använder samma representation; kontraktet ger ingen registrering eller behörighet.

Dessa läser paketet:

- `apps/web/tools/prepare-platform-ui.mjs` kopierar `compositor.js` och `geometry.js` till `apps/web/public/composition-runtime/`.
- `services/game/composition-runtime.mjs` serverar `/composition-runtime/*`.
- `apps/studio/tools/prepare-preview.mjs` kopierar `compositor.js` och `geometry.js` till `apps/studio/preview-build`, och Studio serverar bara dem under `/preview/*` (Admins sammansättningsförhandsvisning). Den fristående förhandsvisningssidan med katalog och medier är borttagen.
- `apps/studio/lib`, `apps/studio/components`, `services/game/presentation-api.mjs`, `services/game/storage` och `services/game/studio-preview.mjs` importerar `runtime/`.
- `services/game/public/local-presentation.mjs` importerar `runtime/live-idle.mjs` direkt. Servern tillåter bara de exakta kontrakts-/runtimeadresserna i `public-modules.mjs`; de äldre `/presentation-runtime/*`-adresserna fungerar fortsatt. Den statiska frontendbyggaren genererar både kanoniska och äldre outputadresser och anpassar relativa importer för varje kopia.

Flyttade browsermoduler använder relativa importer som når samma `/packages/...`-källa både från den gamla URL:en och från paketets kanoniska URL. Röstkatalogens JSON och filmprofilernas inbäddade proveniens behåller sina bytes. Rena spelval ligger i `contracts/game-selection.mjs`; definitioner och ID-predicate importeras direkt från `game-lanes.mjs` respektive `game-lane-id.mjs`.

Publika adresser är stabila: `/composition-runtime/*`, `/presentation-runtime/*` och Studio `/preview/*` (publikt `/studio/preview/*`). Katalogens designnamn, mediehashar och schema-ID:n behålls. Importvägarna följer den kanoniska källan.

## Byggkällor och kompatibilitet

`apps/studio/preview-build/` är en genererad kopia av renderarmodulerna och
byggs om med `node apps/studio/tools/prepare-preview.mjs`.

`runtime/` behåller äldre klipp- och
filmfamiljsregler för deras verkliga konsumenter; de anger inte hur varje ny
registrerad dealer måste organiseras. Radera inte kortkalibrering eller
publicerade identiteter för att en mall pensioneras.

För aktuella mediaformat och acceptans, använd [spelguiderna](../../docs/games/README.md)
och [överlämningen](../../docs/NEXT-AGENT.md). En referensexport innebär
ingen publicering eller verifierad läppsynk.

`server/studio-project-bindings.mjs` validerar projektets befintliga bindningar
med explicita register- och legacyläsare. `server/legacy-clip-inventory.mjs`
äger en enda inventeringsimplementation; apparna tillför roots, filpolicy,
mediesökvägsresolver och kontaktvalidatorer. `reviewSafetyVerified`,
`neverAgain` och den snäva möjligheten att sakna pensionerade index bevaras.
De appägda kompositionerna finns i `apps/studio/lib/legacy-clip-inventory.mjs` och
`services/game/storage/legacy-clip-inventory.mjs`; inga nya browseradresser exponeras.

Publiceringens codec, snapshotfångst, paket-/ruminspektion och frysta dealer-/
mediakontexter ägs av `server/`. Rena layer-/material-/playbackkontrakt ligger
i `contracts/`; talprojektionen ligger i `runtime/recorded-speech-selection.mjs`.
Apparna binder samma pooler, auktorisering och privata medialäsare. Fångade
snapshots, walletägda transaktioner, historiska grants och protokollets
`owner: "web"` ändras inte. Inga nya publika moduladresser tillkommer.

`server/director-transport.mjs` äger en gemensam relay-implementation.
`server/idle-advice.mjs` äger idle-validering, katalog och begränsad request-/
meddelandecache för två utlösare: observerad chatt (`renderer-idle`) och en
committad tur eller resultat (`game-event`, `idleGameEvent`); apparna tillför
Director/model, settingsläsare, register, klocka och fetch. Studio behåller HTTP och sin process-singleton; game behåller sin
API-instans och explicit current/frozen-register. Tidsgränser, cancellation,
fingerprints, cacheScope och rategränser är oförändrade.

`contracts/probe-fixtures.mjs` och deklarationen innehåller samma fiktiva,
opt-in-scenarier för Studio-editor, game-probe och QA. De är inte riktiga
spelardata och läggs inte till i den publika modulallowlisten.

Genererat tals befintliga fullfile-tjänst, HTTP-provider och journal-lease ägs av
`server/generated-speech-*.mjs` och `server/speech-journal-lease.mjs`. En kanonisk
modul äger runtime, journalreferenser, config key och WeakMap för exakta providerfunktioner.
Game och Studio tillför samma ursprungliga repository-root via varsin appkomposition;
återhämtning av facaden återställer inget tillstånd. Skilda processer/modulgrafer har
eget minne; ingen global eller HMR-persistens införs. Game behåller SQL-journal,
Blob-artifacts och sessionsbootstrap. Studio skapar ingen alternativ journal.

De två rena browserkontrakten `speech-package` och `astrid-voice-profile` ligger
under `contracts/`; gamla publika URL:er och kanoniska paket-URL:er når samma källor.
Servermodulerna ingår aldrig i den publika allowlisten. Talidentiteter, originalmedia,
godkännanden, tidsgränser, lease-/kostnadsregler och avbrottshantering är oförändrade.

`server/speech-reply-library.mjs` och `speech-reply-repository.mjs` äger svarsbankens
validering, scope/hash, CAS och rollback. Appar tillför sina befintliga Blob-metoder
med oförändrade options och cachekatalog. `server/game-entry-selector.mjs` binder
samma sparade policy och frysta paket till spelarens val.

`server/studio-policy-runtime.mjs` behåller bootstrapordningen installerat schema,
Studio-migrationskontroll, repository, idle och readSaved. Explicita portar binder
appens migrationskontroll och lazy medialäsare; serverkärnan importerar inga appfiler.
Game behåller sin HTTP-handler och Studio sina readonly-stores och poolstädning.
