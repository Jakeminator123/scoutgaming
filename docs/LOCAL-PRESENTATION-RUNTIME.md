# Scoutgaming: lagring och uppspelning av presentationen

Det här är det tekniska kontraktet för hur dealerns media lagras, fryses vid publicering och spelas upp i spelet. Det beskriver vad koden på `main` gör i dag. Produktord står i [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md), användarsteg i [Studio-guiden](../apps/studio/docs/README.md) och aktuellt läge, deploy-SHA och acceptans i [NEXT-AGENT](NEXT-AGENT.md).

Kodens kontrakt går före texten. Källorna ligger i `packages/presentation/contracts/` (rena format och validering), `packages/presentation/server/` (publicering, frysning, urval), `packages/presentation/runtime/` (spelarens scen) och `services/game/` (spelmotorn och spelarens sida).

## Ansvar

| Del | Äger |
| --- | --- |
| Spelmotorn (Render `croupier-v3`, `services/game`) | Kort, sko, saldo, utfall, regler, tider och presentationsordningen. Den skriver presentationshändelser när ett spelsteg är committat. |
| Admin (`apps/studio`, Vercel) | Dealers, klipp, mallar, bolag, rum, paket och spelinställningar. Skriver bara via server-API:er med revisionskontroll. |
| Neon | Register: medieposter, dokument (projekt och administration), paket, spelinställningar, ledger och journaler. |
| Vercel Blob (privat) | Mediebytes. Levereras bara via behöriga medierutter efter kontroll av ID, hash och storlek. |
| Spelarens sida (`services/game/public`, `packages/presentation/runtime`) | Visar det spelmotorn har bestämt, med det material paketet har fryst. |

Presentationen påverkar aldrig kort, regler eller saldo. Ett klipp som saknas, inte laddar eller avbryts ger en synlig reserv (2D-kort, stillbild eller fast feltext), aldrig en annan dealers klipp eller en gissad ersättning. Ett valt klipp räknas inte som spelat förrän spelaren har kvitterat start, visad bildruta och slut.

## Medieidentitet

Varje klipp är en medieport i `croupier_studio.media_records`, validerad av `validateStudioMedia` (`packages/studio-registry/server/storage-contract.mjs`):

- `id` (UUID), `sha256`, `size`, `contentType` och Blob-`pathname`. Identiteten är UUID **och** SHA-256; ett namn, en etikett eller ett filnamn är aldrig identitet. Lika namn är skilda poster.
- `classification`: `dealerId`, `eventId` (fack), `kind` (`idle`, `action`, `speech` …), `role` (standard eller alternativ), `situation`, `familyId`, etikett och noteringar, samt `recordedSpeech` för talade repliker.
- Valfritt `mediaTiming` (se nedan) och `deletion` (papperskorg, bara för arkiverade poster).

Registret tar bara emot `video/mp4` och `video/webm` (upp till 128 MiB). MP3, WAV och PNG kräver separat schemastöd och får inte beskrivas som fungerande intag. Bilder och videor för lager (bakgrund, bord) är separata lagertillgångar enligt `packages/presentation/contracts/layer-asset-contract.mjs`: PNG, JPEG, WebP, MP4 eller WebM, 16 byte–128 MiB, heltalsmått 1–16 384 px.

Uppladdning går via privat Blob-grant, återläsning av SHA-256 och autentiserad commit med revisionsskydd. En osäker commit körs inte om automatiskt; den stäms av mot biblioteket. Ändrade bytes är ett nytt klipp och ogiltigförklarar tidigare mätning, talgranskning och visuellt godkännande. Sex bevarade Astrid-original (`retainedBank`) är skrivskyddade och kan bara läsas.

Runtime läser metadata enbart från Neon: `runtime_media_catalogs` (layout, Blob-index, presentationsmanifest och de publika JSON-originalens exakta text, under miljö och arbetsyta) och `speech_reply_records` (svarsbibliotekets metadata). Saknad eller felaktig katalog ger fel, aldrig ett tyst tomt register eller en lokal filreserv. Presentationsmanifestet är antingen en komplett låst bank (`schemaVersion: 2`) eller den tomma presentationen (`source: 'scoutgaming-empty'`, inga familjer eller poster). En katalog med spelets och sajtens tillgångar men utan dealerbank är alltså giltig; uppladdade klipp läses då bara från det sparade registret. Bara den helt tomma katalogen får sakna tillgångar. `media/layout.json`, `media/blob-index.json` och `media/catalog/*.json` är källor för uttryckligt authoring- och importarbete (`ops/neon-studio/runtime-media-import.mjs` med förberedelse, läsande plan och uttrycklig apply); de är inte produktens register. Dekorativa lobbyfilmer under `apps/studio/client/lobby/public/videos/` är UI-resurser i Git, inte spelmedia.

## Inspelat tal med bild och ljud i samma MP4

En talad replik är en MP4 med ett videospår och exakt ett ljudspår. Kontraktet är `recordedSpeech.schemaVersion: 2` med `sourceKind: 'embedded-mp4-av'` (`packages/presentation/contracts/recorded-speech.mjs`). Identiteten binder `dealerId`, `lineId` (replik), `takeId` (tagning), `language`, `exactText`, `videoSha256`, `fps`, `frameCount`, `videoTrackId`, `audioTrackId` samt `entryPose` och `exitPose`. Ingen separat ljudfil, indexfil eller kalibreringshistorik behövs. Repliken får vara högst 120 sekunder.

Två oberoende statusar:

- **Källa** (`source.status`): börjar som `pending`. Servermätningen (`saveMediaTiming`) verifierar Blob-bytes, videospåret och det enda ljudspåret och stämplar `verified-embedded-av` med autentiserad aktör, serverns UTC-tid och exakt identitet i samma CAS- och audittransaktion. Vanlig klassificering kan bevara beviset men inte skapa, flytta eller återspela det. Ändrad identitet kräver `pending` och ny mätning.
- **Granskning** (`review`): den mänskliga AV-bedömningen. Enda skrivaren är `POST /api/videos/speech-review` (Röst & tal → **Godkänn tal**, **Underkänn**, **Ta bort bedömning**) med `id`, `sha256`, `dealerId`, `lineId`, `language`, `expectedIdentity` och `verdict` (`approved`, `rejected` eller `null`). Den kräver Admin-session, samma origin och scope, och godkännande kräver `verified-embedded-av`. Felkoder: 409 `studio_speech_source_unverified`, 409 `studio_speech_identity_changed`, 404 `studio_speech_take_missing`. Bytes, hash, källbevis och mätning ändras aldrig av granskningen.

Ordinarie uppspelning kräver godkänd granskning. Den uttryckliga repetitionsvägen (`rehearsal`) får använda verifierad källa med väntande granskning. Underkänd eller omätt källa blockeras alltid. Frysta paket behåller sin granskning tills paketet publiceras igen.

Det äldre `recordedSpeech` v1 (separat ljud, index, kalibrering, `audioDelayMs`) behåller sin betydelse för befintliga poster. Ny v2-metadata, även `pending`, kräver runtimekapabilitet **v30** (`recordedEmbeddedAv: 'embedded-mp4-av-v2'`), också för paket, publicering och livscykeländringar som bevarar materialet.

Text, ljud, bild, bildindex och godkännande hör ihop. Använd aldrig ungefärlig klipplängd, en loopad mening eller en fristående munanimation som ersättning. Hash, vågform, första munrörelse eller ett testpass bevisar inte läppsynk; det bedömer Jakob.

## Uppmätt tidslinje (`mediaTiming`)

`POST /api/videos/measure-timing` tar bara `id`, `sha256` och `expectedRevision`. Servern läser oförändrade Blob-bytes utanför SQL-låset och sparar ett bytebundet kvitto med behörighet, scope, revision och audit (`packages/presentation/contracts/media-timing.mjs`, mätare `apps/studio/lib/mp4-media-timing.mjs`).

Kvittot (`schemaVersion: 1`) innehåller `mediaId`, `sha256`, `size`, `recordedSpeechIdentitySha256` (digest av talidentiteten, eller `null`), `video` (`trackId`, `frameCount`, `fps`, `firstPtsUs`, `lastPtsUs`, `endUs`), `audio`, `endUs` och `audioTailUs`. Bara progressiv MP4 med entydig tidslinje mäts; bildrutor, fps, sample- och edit-slut och alla ljudspårs slut måste stämma, annars nekas mätningen. Avbrott städar delvis hämtade filer.

Kvittot bevisar containertider och bindning till exakt de bytes som mättes, inte avkodning eller läppsynk. Ändrad talidentitet ogiltigförklarar det. Nya kvitton kräver runtimekapabilitet **v29**.

## Runtimekapabilitet

Vercel (Admin) och Render (spelmotorn) uppdateras vid olika tidpunkter, och spelmotorns läsare är strikta: ett okänt fält i ett dokument eller paket gör att hela dokumentet nekas. Därför annonserar spelmotorn vilka format den läser (`packages/presentation/capability-contract.mjs`), och Admin skriver ett nytt fält först när kapabiliteten finns.

- Förhandling sker med headern `X-Presentation-Capability-Version` (v1–v32). Utan header svarar endpointen med v2. En felaktig eller okänd version väljer aldrig tyst en annan.
- Admins readiness (`apps/studio/lib/presentation-runtime-readiness.mjs`) kontrollerar kravet före SQL och igen under transaktionen; den gör inga provideranrop under SQL-lås och höjer inte generella startkrav.
- Deploya kompatibla läsare före nya skrivningar. En äldre release som inte läser ett lagrat format är ingen giltig rollback när sådana poster eller paket finns; då måste fältet först tas bort ur lagringen.

| Version | Nytt format |
| --- | --- |
| 2–4 | Bolagsägda rum (`operator-owned-v2`), registrerade dealers och fryst grundloop (paket v2), frysta dealerhändelser (paket v3) |
| 8 | `backgroundPlayback: 'rules-v1'` |
| 12 | `mediaAlpha: 'png-vp9-v1'`, `rouletteMedia: 'action-pose-slots-v1'` |
| 13 | `tableGame: 'immutable-game-v1'` (bordet märkt `blackjack` eller `roulette`) |
| 16 | `blackjackTableGeometry` (kort- och insatsplatser per bord) |
| 17 | `recordedSpeech: 'exact-take-review-v1'`, `filmedDealVariants` |
| 18 | `presentationCompression: 'gzip-brotli-v1'` |
| 19 | `blackjackBetMode: 'under-cards-v1'` |
| 20 | `speechSlots: 'explicit-line-standard-v1'` (talfack med vald standardtagning) |
| 21 | `blackjackAnchors: 'v1'` |
| 22 | `clipPoses: 'vila-redo-v1'` |
| 23 | `roomGameConfigs: 'administration-drafts-v1'` (utkast till spelinställningar) |
| 24 | `layerPlayback: 'table-and-jitter-v1'` |
| 25 | `blackjackAutoScale: 'dealer-source-v1'` |
| 26–27 | `blackjackCardView: 'saved-layout-v1'`, `blackjackGameUi: 'responsive-controls-v1'` |
| 28 | `idleRotation: 'pose-graph-v1'` |
| 29 | `extendedPresentation: 'bounded-envelope-v2'` och `mediaTiming` |
| 30 | `recordedEmbeddedAv: 'embedded-mp4-av-v2'` |
| 31 | `nativeFilmedPlanning: 'frozen-topology-v2'` |
| 32 | `idleRotationOffers: 'rest-proposals-v1'` (ett viloklipp i vilosekvensen får `use` `openclaw`/`rules`) |

## Fryst paket och presentationskuvert

Ett **paket** är bolagets publicerade mallar, spel, rum och varumärkesval, fryst med ett revisionsnummer i `croupier_studio.operator_packages`. Raden skrivs aldrig om; en ändring är en ny revision. `OperatorStore.publishPackage` (`packages/operators/server/operator-store.mjs`) låser bolaget, jämför `expectedRevision` (`null` = första paketet) och lägger in nästa revision i samma transaktion. Spelet läser bara paket, aldrig utkast. Klienten skickar aldrig egna betrodda mediereferenser till publiceringen; servern läser projekt och medieposter i en sammanhängande snapshot.

Presentationen ligger i paketets `branding` under den reserverade nyckeln `_scoutPresentation` som ett komprimerat kuvert `{format, encoding, sha256, data}` (`packages/presentation/server/presentation-package.mjs`). Det uppackade innehållet är kanonisk JSON, högst 256 KiB, och `sha256` gäller de uppackade bytena.

| Kuvert | Kodning och gräns | Krav |
| --- | --- | --- |
| `croupier-lanes-v1` | `gzip-base64url` ≤ 6 500 tecken, annars `br-base64url` ≤ 7 400 tecken | Inga. Befintliga kuvert behåller exakt sina bytes. |
| `croupier-lanes-v2` | `br-base64url` ≤ 30 KiB | Studio-migrering 020 och runtimekapabilitet v29. Väljs bara när v1 inte räcker och skrivaren uttryckligen tillåter det. |

Den redigerbara delen av `branding` får vara högst 8 000 byte. Med ett v2-kuvert får hela `branding` vara högst 32 KiB, men den vanliga delen är fortfarande högst 8 000 byte. Studio-migrering **020** (`ops/neon-studio/020-extended-presentation.sql`) höjer bara de två CHECK-gränserna på `operator_packages.branding` och `operator_branding_drafts.branding` till 32 768 byte; den ändrar inga befintliga rader. Skrivaren kontrollerar på samma transaktionsanslutning att 020 finns i `storage_migrations` med exakt checksumma och att båda CHECK:arna är validerade (`assertExtendedPresentationStorage` i `packages/presentation/server/presentation-storage.mjs`), annars 503 `studio_extended_presentation_storage_unavailable`. 020 är applicerad i produktionen.

Det frysta innehållet omfattar mallarna (`lanes`) med tre lager (bakgrund, dealer, bord), tillåtna val och förval, `playback.media` med fullständiga medieposter och `registeredDealers` (eget ID, visningsnamn och grundloopens medieport med UUID, SHA-256, storlek, MIME, sökväg och klassificering). Spelklienten och partnerportalen läser samma projektion (`readPackagePresentation`); kuvertet exponeras aldrig råt. Ett paket utan fryst lagerformat måste publiceras om innan det kan redigeras i de nyare vyerna.

Rum (schema 2) skiljer presentationsmall och spelmall: `{schemaVersion: 2, id, name, operatorId, presentationLaneId, gameLaneId, state}` och ett `game` (saknat fält läses som blackjack). Rummets ägare, paketets `tables` och `lanes`, den frysta presentationen och spelmallen måste stämma; en uttrycklig `table`-query kräver ett levande rum och ger aldrig ett annat rum som reserv. Ett valt rum gör inte en ändring i mallen rumsspecifik; rummets egna val går via `roomOverrides`.

## Rummets effektiva dealer

Materialproducent, publiceringsvalidator, launch och åtkomst till delat bord använder samma paketbundna val (`resolvePackageRoomDealer`): rummets `roomOverrides` före bolagets standard och därefter mallens standard, alltid inom mallens publicerade `allowed` och bolagets rum. Bolagets `dealer: null` rensar dess standard. Ett ogiltigt uttryckligt rumsval ger ingen reserv. I ett rum med publicerade spelinställningar nekas en avvikande `?dealer=` före klientstart; rum utan publicerade spelinställningar behåller sitt tillåtna queryurval.

## Spelinställningar och materialbindning

Spelinställningar (`room game config`, `packages/presentation/contracts/room-game-config.mjs`) gäller blackjackrum och består av `language` (`en` eller `sv`) och `limitPreset`:

| Insatsnivå | Min–max | Sidoinsats max | Marker | Påfyllning |
| --- | --- | --- | --- | --- |
| `casual` | 1–500 | 50 | 1, 5, 10, 25, 50, 100 | 500 |
| `prive` | 5–2 000 | 200 | 5, 10, 25, 50, 100, 500 | 1 000 |
| `high` | 100–25 000 | 1 000 | 100, 500, 1 000, 5 000, 10 000, 25 000 | 50 000 |

Tiderna är fasta: 20 s för insatser och 15 s per beslut.

Flödet (`apps/studio/lib/room-game-config-api.mjs`, `GET`/`POST /studio/api/admin/room-game-config`):

1. **Utkast.** `save-draft` sparar `{roomId, operatorId, revision: 'room-config-<uuid>', basePackageRevision, gameConfig}` i administrationsdokumentets `roomGameConfigs` (kräver v23) med revisionskontroll mot både dokument och paket.
2. **Materialprov.** Servern härleder materialet ur det frysta paketet, inte ur Admins begäran: `{revision, dealerId, language, leadMs, cardMs, media: [{id, sha256}], film?}`. Varje medieport måste finnas fryst i paketet för rätt dealer, vara oförändrad i registret, inte arkiverad eller raderad, och en talad replik måste ha godkänd tagning för rätt språk och replik. Saknat material blockerar publiceringen med en namngiven orsak (`native_material_*`), aldrig med fixturtider eller ett annat språk.
3. **Publicering.** `publish` kräver att utkastets `basePackageRevision` är det aktuella paketet. Det skriver i samma transaktion en ny paketrevision, en fryst rad i `croupier_game.shared_table_configs` (`configVersion`, rum, bolag, paketrevision, presentationsmall, presentationens hash, språk, gränser, marker, tider, `leadMs`, `cardMs`, material) och flyttar rummets huvud i `shared_table_config_heads`. Paketets `branding.roomGameConfigVersions[roomId]` pekar på versionen.

En senare vanlig paketpublicering tar med bundna rum: är rummets effektiva presentation oförändrad behålls versionen, annars skrivs en ny version med samma språk och insatsnivå och omräknat material. En paketpayload kan inte själv ändra `roomGameConfigVersions`. Spelmotorn läser alltid spelinställningarna via den frysta versionen.

**Filmat material.** Nytt material använder `native-film-v2-<sha256>` och kräver runtimekapabilitet **v31** innan spelinställningar skrivs. Producenten (`packages/presentation/server/native-room-game-material.mjs`) utgår från den frysta presentationen, vald dealer, registrerad filmprofil, exakta UUID, hashar och storlekar, talidentiteter och mätkvitton; den läser inget gammalt dealerregister. Den härleder nödvändiga tagningar genom samma sekvensplanerare som servervalet: alla sju platser, öppning, split, vändning, dealerns dragkedjor och de sparade skoövergångarna med uppmätta längder (`film: {schemaVersion: 1, profileId, transitions: {toShoe, fromShoe}}`). Blandade språkbanker och ofullständigt material nekas. Historiskt `native-film-v1` behåller sitt fullbankskontrakt. Den kompletta händelselistan planeras före commit, och en saknad nåbar tagning rullar tillbaka spel, saldo, ledger, kvitto och outbox.

## Publiceringsordning

1. Kompatibla läsare deployade (Vercel och Render) och erforderlig migrering applicerad av Jakob.
2. Tal mätt och godkänt i Admin (Röst & tal).
3. Paketet publicerat.
4. Rummets spelinställningar publicerade.

Ordningen skyddar mot att ett paket eller en spelinställning pekar på material som spelmotorn inte kan läsa eller som inte är godkänt. Admin-publicering i produktionen görs av Jakob, när koden är live.

## Presentationshändelser

Spelmotorn skriver presentationshändelser först när spelsteget är committat; klientens kort, tillåtna drag eller resultat ersätter aldrig serverns kvitto.

**Enspelarbord.** Spelarens senaste presentation ligger i `croupier_game.native_presentations` (en rad per spelare med `request_id`, `version` och payload). `POST /api/presentation/select` slår upp dealinstruktionen där för aktuell spelare och version; browserns kort och handindex används inte, och dolt hålkort maskeras även i urvalet. Fel version, fel hand eller saknad händelse avvisas. Exakt familj gäller både för standard och variant; en annan box eller replik lånas aldrig.

**Delat bord.** Koordinatorn (`services/game/games/blackjack/table/coordinator.mjs`) skriver varje committat steg som en rad i `shared_table_outbox` med kontraktet `blackjack-presentation/1`: sorterad offentlig vy före och efter, åtgärd, `windowId`, `configVersion`, språk och tider. Mottagaren (`services/game/games/blackjack/presentation/postgres-receiver.mjs`, schema 010) gör en låst kontroll per rum: högre version lagras, exakt samma version med samma innehåll godtas utan ny skrivning, lägre version är inaktuell och samma version med annat innehåll är ett leveransfel. Mottagarens rad är rummets aktuella presentation vid återanslutning. Mottagaren har ingen skrivväg in i spelet.

`presentationForRow` (`outbox-presentation.mjs`) översätter raden till händelser i katalogens fack:

| Spelhändelse | Fack |
| --- | --- |
| Utdelning till spelare | `deal.player.left`, `deal.player.centre`, `deal.player.right` (box 0–1, 2–4, 5–6) |
| Utdelning till dealern | `deal.dealer` |
| Kortvändning | `reveal.dealer` |
| Vila | `idle.ready` |
| Replik | `speak.goodluck`, `speak.insurance`, `speak.double`, annars `speak.other` med replik-ID |

`turn` och `settle` är spelfakta, inga mediefack; nya skrivningar till sådana videofack avvisas. Tyst beteende använder `idle.ready` och tal exakta `speak.*`-fack. Varje replik får ett stabilt `lineId` ur rum, `talkId`, index och replik, så samma committade rad ger samma ID vid omspelning. Ett nytt insatsfönster ger repliken `placebets` och vila; insamlingen (`collect`) rensar bordet utan egna klipp.

Ett avslutat kommandos `turn`/`settle` får trigga ett kopplat vilobeteende (`rules`) en gång per version och händelse. Svaret binds till version och fryst paket, löper ut efter 30 sekunder och går till samma vilokontroll som redan hanterar kvot, talprioritet och klippgränser.

## Delat bord

Flera spelare vid samma blackjackbord. Inkopplingen styrs av `CROUPIER_SHARED_TABLE_ENABLED` på spelmotorn och kräver Postgres med spelmigreringarna 008–010 (start avbryts annars; inget installeras vid start). Staging kör `=1`; produktionen har flaggan osatt tills O03 och Jakobs separata godkännande. Se [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md#delade-blackjackrum--avgränsad-inkoppling).

- Rumsvägarna är `/shared-room/*` (WebSocket via Vercel-tjänsten `speech`) och `/api/shared-room/*`. I enkel-origin-layouten (PR #442) godtas den publika originen som webbläsarorigin.
- Spelinställningarna binds per insatsfönster: ett nytt fönster binder rummets senast publicerade `configVersion`, och en pågående runda behåller sin version även om en ny publiceras. Plånbok, sko och audit är serverns.
- Fullt bord (K6, värdena i `FULL_TABLE` i `services/game/games/blackjack/table/coordinator.mjs`): en tittare utan plats vid fullt bord skickar kommandot `wait`. Registreringen gäller i 30 s, och klienten förnyar den var 10 s (`public/shared-room-waiting.mjs`). Finns en giltig registrering när rundan återställs (`next`), behåller varje spelare högst 3 platser, de som spelades först. Inget tas från en pågående runda. En spelare som varken satsar eller skickar något kommando på 90 s i insatsfönstret släpper sina platser (ticken `seat.idle`). Klockan hör till fönstret (`windowAt` med fönstrets id). Ett fönster som en motor utan klockan har öppnat får ingen sådan tick, till exempel ett äldre rum, den gamla instansen under en deploy eller efter en rollback. Där gäller bara frånvaroregeln. Registreringen syns inte i någon snapshot och ger ingen ny ram. En förnyelse inom 5 s skriver inte om rummet (`WAIT_WRITE_AFTER_MS`), så ett förlorat svar ryms inom de 30 s.
- Spelarens presentation läses via `GET /api/presentation/shared-room/<rum>/binding?configVersion&windowId` och `/config?operatorSlug&roomId&packageRevision&dealerId` samt `room-idle`, `room-video` och `room-layers` under samma prefix, alla bundna till rummets aktiva fönster och det frysta paketet (`services/game/shared-room-presentation-http.mjs`).
- Kommandon delar den scopade databastransaktionen; samtidiga och upprepade kommandon är idempotenta per `commandId`. Tysta rum får inga tick, och en ledig plats frigörs.
- En partnerlanserad session sitter vid bordet med en spelares rättigheter när partnernyckelns bolag (`croupier_auth.api_keys.operator_id`, spelmigrering 012) är rummets bolag ([NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md)). Ett annat bolag eller en nyckel utan bolag får sidan *Nyckeln gäller ett annat bolag* respektive *Nyckeln saknar bolag* (403) i stället för spelet, och rumssocketen stängs med 1008 och koden `partner_operator_mismatch` eller `partner_key_unbound`, som klienten visar utan nya försök.
- WebSocketen är en läsande snapshot-kanal (`services/game/shared-room-channel.mjs`); kommandon går över HTTP. En socket läser om rummet när den egna instansen committar (kommando, tick eller mottagarens presentationsversion) och när motorns pass rapporterar rummets committade versioner (`observeRoom`). Passet läser ändå varje rums tillstånd var 250 ms. En socket som har skickat en lägre version läser därför om en gång, utan extra SQL och utan polling. Det täcker commits från en annan motorinstans: vid Render-deploy och omstart kör gamla och nya instansen samtidigt i cirka tre minuter, och SIGTERM kommer först 60 s efter att trafiken har bytt (F11 i K04 RERUN-6). Har mottagarens rad inte kommit än skickas ingen ram med blandade versioner; samma observation provas om högst en gång per sekund. Vid SIGTERM stänger tjänsten varje rumssocket med 1012 `shared_room_restart` direkt, och klienten återansluter. Nya kommandon får då 503. Ett kommando som redan är inne blir antingen helt committat eller helt tillbakarullat; avbryts det före COMMIT lämnar det varken kvitto eller ändrat rum.
- Spelarens bordslayout (`services/game/public/shared-room-view.mjs`, regler i `shared-room-layout.mjs`, K04 F12–F16): platserna står där kompositionens bordsgeometri placerar dem. Med automatisk landning är det dealerns filmade landningar (`packages/presentation/contracts/filmed-profiles/`); med manuell geometri är det Admins placering på bordsgrafikens boxar. Utan kompositionsplan står de under dealerns filmade landningar, och den kalibrerade raden gäller bara en dealer utan filmprofil. Bordsgrafik som är bredare än landningarna ritas om efter dem, så att kort och markörer hamnar på samma box. Bara `#actions-top` beslutar (den nativa minibaren `#actions` döljs). När en av dess knappar har fokus väljer H, S, D och P Hit, Stand, Double och Split genom samma knapp (`shared-room-shortcuts.mjs`); utan fokus där gör bokstäverna ingenting, så en felaktig tangent aldrig dubblar eller splittar en insats. Panelen är en sammansatt kontroll: med fokus på vilken som helst av dess knappar gäller alla fyra tangenterna, också D och P ([KEVIN-PORT](plans/KEVIN-PORT.md#k10-tangenterna-hsdp)). Den skrivna bokstaven avgör (Dvorak och AZERTY skriver H på sin H-tangent); en layout utan latinska bokstäver (kyrillisk, grekisk, arabisk) faller tillbaka på den fysiska tangenten (`code` KeyH, KeyS, KeyD, KeyP). Efter varje ögonblicksbild får panelen fokus tillbaka; stängs knappen som hade fokus av den nya turen (Double efter ett kort) går fokus till panelens första öppna knapp, så nästa tangent inte går förlorad. Begränsning: Safari och Firefox på macOS ger ingen knapp fokus vid klick (systemets inställning för tangentbordsnavigering), så där verkar tangenterna först efter Tabb in i panelen. `aria-keyshortcuts` behålls: attributet betyder enligt WAI-ARIA en genväg som aktiverar eller ger fokus till elementet, inte att den gäller från hela sidan, och skärmläsaren läser den när knappen får fokus, vilket är just då tangenten verkar. Statusrad, Redo, Nästa runda, försäkring och beslutspanel ligger i en egen rad i bottenkontrollerna, så att varken saldo eller marker kan täcka dem. Resultatet (senaste vinst och *Rundan är avslutad*) följer den avräknade ögonblicksbilden. Spelmotorn skriver den först vid planens `endAt` (`round.settle`), och klienten tar emot den först när rundans presentation spelat klart eller dess tid är slut (`shared-room-client.mjs` spelar en presentation i taget), så vinsten syns aldrig före korten. Egna platser som ligger tätare än en insatsrad behåller sin huvudinsats, och bara den valda platsen visar Par, 21+3 och Lämna. En telefon visar tre boxar (*Visa platser 3–5*) och dockar den valda platsens insatser ovanför bottenraden. Med kompositionsplan men utan bordsgeometri behåller planet den högsta bottenrad som setts vid skärmstorleken, så att korten står still mellan faserna. **Ta paus i 24 timmar** sitter bland platskontrollerna, nås i varje fas och bekräftas i en dialog (namnet är inte Spelpaus, som är det nationella avstängningsregistret). Rubriken följer rummets insatsprofil (`limitPreset`, annars gränser och marker), och en bruten anslutning visar en skylt med **Återanslut**. Layouten provas i Chrome med `test/shared-room-layout-browser.mjs` vid 1440, 1920, 390 och 320 px, tangenterna med `test/shared-room-shortcuts-browser.mjs`.

## Uppspelning

### Scen och lager

Ordningen bakifrån är **bakgrund → frilagd dealer → bord → spelets kort, marker och knappar**. Bakgrunden är spelneutral och ljudlös; den får aldrig ersätta, blockera eller synka om dealerns tal eller kortflöde. Ett lager som är inbakat i en dealerfilm kan inte bytas separat, och grön bakgrund kräver friläggningsbart källmaterial (`packages/presentation/contracts/dealer-compositing.mjs`). Hela 1080×1920-filmen visas med `object-fit: contain`. Scenen monteras av `packages/presentation/runtime/published-scene.mjs` och hålls dold tills första bildrutan finns (`services/game/public/presentation-startup.mjs`).

Spelkorten är serverns 2D-överlägg. Ett filmat kontaktspår används bara när det är bundet till exakt filmhash, profil och aktuell spelplan; ändrad bindning återgår till stilla serverkort. Byte av bord, bakgrund eller dealer är spärrat under en pågående runda. Spelarens val begränsas av paketet; ingen URL från query eller localStorage hämtas.

### Klipp, vila och tal

- **Grundloop och vila.** Varje dealer har en grundloop och kan ha beteendeklipp i vila (`idlePolicy`, högst 30 beteenden). Klipp spelas hela till faktisk slutbild. Valfri `rotation.clips` (v28) beskriver varje klipp med `from`/`to` (`rest`/`clasped`), fas (`any`/`bets`/`decide`), vikt och lugn eller huvudrörelse. Fasbyte eller färdigt tal tvingar utgång till standardklippet för talets bildbevis. Avbrott för osynlig flik återupptar samma klipp och senast presenterade medietid. Återställning i Admin: **Återgå till enbart basklippet**, spara och publicera; originalen behålls. Ett klipp i sekvensen som börjar och slutar i vila kan dessutom ha `use` `openclaw` eller `rules` (v32): det ingår i sekvensen som förut och kan föreslås av OpenClaw eller en spelregel. Förslaget spelas en gång vid nästa klippgräns i vila och sekvensen fortsätter sedan; det gäller högst 30 s, högst ett föreslaget klipp startar per minut, och i spelarens beslut bara lugna klipp (`packages/presentation/runtime/idle-rotation.mjs`).
- **Vilosekvens per dealer.** `apps/studio/lib/idle-rotation-sources/<dealer>-<ref>.json` fryser Kevins urval för en dealer vid en exakt ref: Git-blob, SHA-256, byteantal, bildrutor, fas, pose, vikt, huvudrörelse och lugn per klipp. I dag gäller `kevin@de31659c`: PAOW 21 klipp (utan `andasb`, `rakrygg6101` och `plattaxlar5101`, som Kevin valde bort 27 oktober) och Dragan 16 H3-klipp, varav sex med knäppta händer i insatsfasen och två i spelarens beslut; alla 39 bilder vid 24 fps. `apps/studio/lib/idle-rotation-sources.mjs` validerar källan och binder Admins valda delmängd till registrerade original med exakt SHA-256, byteantal, ägare och viloklassificering; befintliga UUID återanvänds. Basklippet `andas` ingår alltid, knäppta händer kräver både in- och utgång, och ett valt original som saknas namnges och spärrar kopplingen tills det laddats upp eller valts bort. Kevins `once` (Dragans `blickhoger` högst en gång per viloperiod) finns inte i main; klippet är markerat som huvudrörelse, så minst fyra andra klipp spelas mellan två blickar. Rummets **Publicera PAOWs viloklipp** (`refresh-dealer-idle`) fryser PAOWs policy och medieposter utan att ersätta paketets övriga innehåll; andra dealers vilosekvens publiceras med bolagets paket.
- **Filmad utdelning.** `services/game/filmed-deal-selection.mjs` väljer den registrerade filmprofilens SHA-bundna tagningar för rätt box. I ett publicerat rum kommer både valen och filmhasharna från det frysta paketet, så en klippändring måste publiceras. Planeraren lägger Till skon före en REDO-start och Från skon efter ett REDO-slut vid filmsekvensens gränser; utan sparad övergång behålls profilens tidigare tagningar. Bara kortfilmen får kortspårets callbacks, och avbrott stoppar hela kedjan.
- **Talade repliker.** Inspelade repliker spelas från sin exakta MP4 med inbäddat ljud. Ett talpaket får förberedas under utdelning men spelas först efter en faktiskt renderad vila; en ny utdelning avbryter pågående tal. Sena chatt- eller vilocallbacks får inte avbryta en ny utdelning.
- **Urval.** `packages/presentation/server/selection.mjs` väljer exakt familj och tillåten variant med samma triggers, regler och slump i Studio och spelmotorn. OpenClaw-rådgivning får bara föreslå redan tillåtna klipp; skuggläget spelar aldrig förslaget. Automatik ändrar aldrig spelhandlingen eller utdelningspositionen.

### Talfel och autoplay

Webbläsare nekar ljud innan spelaren har interagerat med sidan. När ljudsatt tal nekas före start (PR #446, `local-film-player.mjs` och `local-presentation.mjs`):

- Spelet visar knappen **Slå på ljud** vid statusraden, aldrig webbläsarens råa text.
- Repliken behåller sin plats högst sin egen längd (8 s innan längden är känd), som om den hade spelats, och slutar sedan tyst med koden `local_film_sound_blocked`. Handen väntar aldrig på klicket.
- Ett riktigt klick (`isTrusted`) under den tiden startar samma verifierade video synkront i klicket, om repliken fortfarande är aktuell (samma ägare, serie och bordsversion). Ett senare klick slår bara på ljudet för resten av sessionen.
- Andra talfel, även fel i granskning eller identitet, visar den fasta texten *Talet kunde inte spelas.* Orsaken finns bara i uppspelningskvittot (`reason`, `code`).

Ljudlösa klipp, viloklipp och handlingsklipp påverkas inte. Ett spel utan klick är inget talbevis. Riktig iOS- och desktop-Safari är inte provad.

### Tal på delat bord

Mätningen i preview den 28 oktober (48 repliker i 17 händer) visade att varje replik väntade på `POST /api/presentation/select` (0,9–4,3 s), sedan på sin GET och sin hash: 1,0–7,4 s innan ljudet kom. Det gäller nu i stället:

- Motorns plan och insatsfönster bär varje repliks standardklipp som `speechTake: {id, sha256}` (`services/game/shared-room-filmed-steps.mjs`, `packages/presentation/server/native-room-speech-clips.mjs`). Det är samma klipp som select väljer i läget *off* för rummets frysta paket. Klienten spelar det direkt i select-svarets form när rummets tal följer standard (`openclaw.speak` är `off`) och vilan inte följer regler. Ett annat läge, en äldre motor utan fältet eller ett okänt klipp går via select som förut.
- Planens repliker förbereds och förvärms tillsammans med korten. Utan `speechTake` hittas tagningen via `recordedSpeech.lineId` i rummets språk, och mer än en kandidat ger inget val. Planens första kort laddas före talet.
- Efter dealerns första ruta förvärms rummets alla repliker, en fil i taget. För PAOW:s tio svenska fack är det cirka 7,7 MB. Förvärmningen sker bara mellan presentationer och aldrig i en dold flik, med datasparläge eller på 2G. Buffertens budget och LRU gäller.
- Ljudknappen ändrar bara den pågående replikens `video.muted`, så repliken stoppas eller startas aldrig om. Valet sparas för fliken i `sessionStorage` (`scoutgaming.shared-room.sound`), och en ny montering, till exempel efter en ompublicering, behåller ljudet. Utan lagring startar bordet ljudlöst.
- En ny montering spelar fortfarande insatsfönstrets placebets om fönstret är öppet. Repliken väntar högst 5 s på sin första ruta.
- `room-video` skickas med `Cache-Control: private, max-age=31536000, immutable` när servern har verifierat filen mot postens SHA-256. Adressen namnger en paketrevision som inte kan ändras och ett media-ID, så samma adress kan aldrig ge andra bytes. `room-idle`, `registered-*` och felsvar revaliderar eller lagras inte, som förut.

### Saknat media och långsam uppkoppling

Gäller sedan K04-rättningen (PR #451). På delat bord öppnas plats, marker, insats och **Redo** när presentationsadaptern är monterad och servern har bekräftat samma bindning före och efter monteringen; dealerns första filmruta är ingen grind längre. Tills den första verifierade rutan visas står *Dealern laddas…* på dealerns plats (*Dealern kunde inte visas.* om idlefilmen fallerar). Den verifierade bufferten begränsar en nedladdning med tystnad (15 s utan nya byte), aldrig med filens längd. Mottagna byte förnyar stegets framstegsvakt, och presentationens frysta totalbudget är fortfarande den absoluta gränsen. En ofullständig nedladdning som sista ägaren lämnar fortsätter i 5 s, så att en omstartad idle eller nästa steg återanvänder samma byte. Ett exakt klipp som svarar 404/410 eller `studio_presentation_idle_media_unavailable` avslutar sitt steg direkt utan standardfilm. Resten av samma presentationsversion visar sina committade kort utan film, och spelarens knappar öppnas vid serverns `turnAt`. Spelaren ser *Talet kunde inte spelas.* eller *Filmen kunde inte spelas.* i minst 6 s; kvittot behåller `reason`, `code`, `status`, `serverCode` och `unavailable`. Kontrollerna av SHA-256, UUID, paket och talidentitet är oförändrade.

Sedan K04-omprovet 28 oktober (F1 och F2) får media inte hålla bordet efter stegets tid. En tagning som bordsklockan eller överlämningen avslutar innan uppspelningen har börjat (`playing`) kom för sent: steget hoppas över utan standardfilm, feltext eller mediefel, och kvittot får `state: 'skipped'` med `late: true` i stället för `local_film_incomplete`. Ett steg är förfallet när dess fönster på bordsklockan är slut och, i en plan som öppnar ett beslut (`decisions` eller `insurance`), senast vid serverns `turnAt`. En filmdel som inte har visat någon ruta då lämnas: det committade kortet visas direkt, kvittot får `late: true` och `reason: 'step_time_over'`, och nedladdningen ligger kvar i buffertens 5 s grace för den som behöver samma bytes. Efter `turnAt` visar resten av planen sina kort utan film, så knapparna öppnas vid `turnAt` även om ett klipp inte hunnit laddas. En del som redan visar rutor spelar klart på sin egen klocka; klipp som hinner i tid har oförändrad tidtagning. Ett klipp som `/api/presentation/select` just har valt läser inte konfigurationen en gång till, eftersom select-anropet är paketkontrollen för det klippet. Vilofilmer och Studio-repetitionen läser konfigurationen före varje uppspelning som förut.

### Kvitton

Spelarens kvitto rapporterar urval, faktisk start, presenterad bildruta, slut, avbrott och reserv. MP4-slut kräver verkligt `ended` och presenterad bild; avbrott eller stopp ger aldrig ett falskt slutkvitto. Sena slutkvitton kan inte godkänna nästa klipp. Ett DOM-korts landningskvitto anger `calibratedContact: false` när ingen kontakt är kalibrerad; filmens slut är inget bevis för handkontakt. Transportanslutning är inte speldata, och ett valt klipp är inte ett spelat klipp.

## Mallens lagerinställningar

Alla fält nedan ligger i mallen (`composition`, `lane` i koden), skrivs via mallens revision och följer det frysta paketet. Saknat fält ger exakt tidigare beteende, och frysta paket ändras inte.

- **`backgroundPlayback`** (v8) och **`tablePlayback`** (v24): grundbild eller ljudlös loop som bas, och korta tillåtna klipp vid spelhändelse (`speak.*`) eller intervall med `jitterMs` (0–120 000, kortare än `everyMs`). Varje regel har maxlängd och rullande budget. Schemaläggaren `packages/presentation/runtime/background-playback.mjs` kör en per lager; slut, fel, paus eller maxlängd återställer basen, och dold flik stoppar effekten utan att köa missade tillfällen. Bordsklipp ändrar bara pixlar: spelplanet räknas alltid från basbordet. Media som `tablePlayback` refererar till är aldrig ett bordsval (`selectableLayerBases`); ett val som pekar på ett sådant klipp faller tillbaka till standardbordet och Admin svarar 422.
- **`blackjackTables`** (v16, högst 32): kort- och insatsplatser per uppladdat bords-UUID, mobil tre platser och dator sju, med `cardWidth` (0,02–0,15), `dealer {x,y}` och `seats [{card, bet}]` normaliserade 0–1 i bordbildens hela rektangel. Varje bordsdesign kalibreras separat.
  - `anchors.cards`/`anchors.bets` (v21): ram `{target: 'table' | 'dealer' | 'scene', rect}`; dealerplanet är kompositionens stabila 1080×1920-plan.
  - `betMode: 'under-cards'` (v19): markerna följer aktuell kortvy; sparade insatspunkter behålls för återgång.
  - `autoScale: {landing, cardSize, chips, adjust?}` (v25): korten landar på filmens boxposition och följer dealerplanets skala; `adjust` lägger kort- och markerjustering ovanpå.
- **Kortvy** (v26): sparad layout per bord och format. Upplyft eller På bordet är en lokal spelarpreferens som inte ändrar spelbeslut eller publicering.

En tillåten fil är inte en godkänd scen. Bakgrunder granskas i 16:9 och 9:16 med verklig beskärning och två loopvarv; bord behöver korrekt friläggning och geometri (JPEG saknar alfa). Bristande media ger tydlig status, aldrig en tyst ersättning.

## Medieformat för roulette och blackjack

Produktions- och acceptanskraven för spelens media ägs av spelmanualerna: [klipp och format](games/KLIPP-OCH-FORMAT.md), [blackjack](games/blackjack/README.md) och [roulette](games/roulette/README.md) med [37 utfallsfilmer](games/roulette/UTFALLSFILMER.md). Den uppmätta rouletteleveransen och Jakobs beslut finns i [media-specification.json](../services/game/games/roulette/media-specification.json). Gemensamma regler:

| Material | Leverans |
| --- | --- |
| Bakgrund, master | 3 840 × 2 160 PNG/WebP, 16:9, spelneutral (inga inbakade bord, dealers eller utfall) |
| Bakgrund, webbvideo | 1 920 × 1 080 MP4/H.264, 30 fps CFR, SDR Rec.709, utan ljud, låst kamera |
| Bord | Transparent PNG i spelets egen geometri; bordsvideo bara med PNG-alfamask från samma registrering |
| Dealer | Frilagd dealer bakom bordet, samma klipp för mobil och dator |

- Vanlig H.264 behandlas som opak video. En statisk PNG-alfamask fungerar för ett bord med konstant ytterkontur; en svartvit bild utan alfa fungerar inte som mask. Ingen grönnyckling av bordets gröna filt.
- Bord har oföränderligt `game: blackjack | roulette` (v13). Äldre omärkta bord är blackjack, och ett blackjackbord blir aldrig ett roulettebord genom namnbyte eller nya mått. Samma dealeridentitet kan finnas i båda spelen, men rörelse- och talbankerna är separata; publicerad blackjack-`idle.ready` exponeras inte för roulette.
- Roulette visar i dag PNG-bordet `services/game/public/roulette/assets/roulette-bord.png` (1 672 × 941 RGBA) i en logisk 1 920 × 1 080-scen vid x = 192, y = 216, bredd 1 536 (`desktop.table = {width: 0.8, x: 0, y: 0.2}`). Satsningsytorna ligger som polygoner i `services/game/public/roulette/table-layout.mjs`. Inga kodgenererade hjul- eller kulanimationer byggs; Jakob levererar roulettevideo separat, och en dekorativ snurrfilm får aldrig föreställa rundans utfall om den inte är kopplad till serverns bekräftade resultat.
- Blackjackens bordsgeometri kalibreras per bord i Admin; kopiera aldrig roulettens ankare.

## Klippnamn och import

`packages/presentation/contracts/clip-naming.mjs` är den enda tolkningen av filnamn till fack (`parseClipFilename`, `clipNamingGuide`). Den täcker vila, båda skoövergångarna, box 0–6, öppet och dolt dealerkort, vändning och standardrepliker. Reaktioner kräver prefix (`settle`, `reaktion`, `reaction`, `resultat`). Filnamnet är bara ett förslag och kan aldrig skapa fack, dealers eller media.

Posekedjan VILA/REDO (v22) är authoringmetadata på `deal.*`, `reveal.*` och `transition.shoe`: `-i`/`in` sätter starten till VILA, `-v`/`-u`/`ut` slutet, `-iv`/`-iu` båda; till skon är VILA → REDO och från skon REDO → VILA. Spelarens filmade utdelning läser fortfarande den verifierade profilens tagningar, inte dessa fält.

Samma poser gör inte `-u` till `-v`. I Kevins material för plats 1–7 och dealerns öppna kort är `-u` grundtagningen med en påbyggd återgång till VILA (60–66 bildrutor mot grundtagningens 39), medan `-v` är en egen filmad tagning på 39 bildrutor med eget rörelseförlopp, eget kortspår (`<plats>v`) och egna landningsrutor; `-iu` och `-iv` skiljer sig på samma sätt (`poseMetadata.frames` i `apps/studio/lib/dealer-import-kevin-source*.json`, `track` och `landFrame` i profilerna). De filmade profilerna i `packages/presentation/contracts/filmed-profiles/` har därför bara `base`, `i`, `v` och `iv` för plats 1–7 och dealerns öppna kort, plus `hole:base`, `hole:i` och `flip:base`. `planFilmedDealSequence` byter `u` mot `v` när profilen har en v-tagning för platsen och binder varje steg till tagningens exakta SHA-256, och **Koppla hela givbanken** binder bara profilens tagningar. Den filmade utdelningen spelar alltså aldrig `-u` eller `-iu`. Ladda inte upp dem: importkällorna (`apps/studio/lib/dealer-import-sources.mjs`) märker dem bara som förladdning och reserv i Kevins egen klient, och för `hole` och `flip` är de samma bytes som filen utan suffix respektive `-i`.

Importassistenten på `/admin/clips?tool=import` registrerar högst tio MP4/WebM-filer per gång som alternativ för en redan registrerad dealer; ingen standard, grundloop, mall eller publicering byts automatiskt. Frysta Kevin-källor (`apps/studio/lib/dealer-import-sources.mjs`) ger fack, poskedja, språk och tagning med hög konfidens när filnamn och storlek matchar exakt. Rådgivaren (`/studio/api/dealers/import-proposal`, N1-session) får bara en begränsad projektion av dealer- och fackkatalogen; servern väljer modell, och svaret är råd, aldrig en sparad ändring. Se [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) för modellinställningarna.

## Livscykel

- Arkivering av ett rum påverkar bara den spelbara ingången; dealer, mall och delade filer raderas inte. Ett återställt bolag öppnar inga rum, och ett återställt rum blir `pending` tills det öppnas uttryckligen (`apps/studio/lib/resource-lifecycle-api.mjs`).
- Papperskorgen flyttar egna uppladdningar till Borttagna med återställbar metadata. Aktuella dokumentreferenser stoppar borttagning, och historik och Blob-bytes bevaras. Återställning återställer utkast, aldrig tyst ompublicering eller betald talgenerering.
- Fysisk radering kräver att inga skyddade eller delade referenser finns och en separat uttrycklig handling. Visa objekttyp, ID, användningar och berörda publiceringar före bekräftelse.
- Livscykeländringar som rör frysta paket kontrollerar paketens faktiska fält mot runtimekapabiliteten före SQL och igen under låset.

## Rörligt tal (Dragan)

Status: live i produktionen för Dragan. Rörligt tal betyder att ansiktet genereras för **samma källfilm och bildruta som kroppen visar**. Dragan-bankens karta binder varje klipp-ID och SHA-256 till exakta poolrutor, ansiktsrektangel, latentdata och mask. Talplanen och workerattesteringen binder text, PCM, profil, bank och workerrelease. Bakgrund och bord läggs på efter dealerlagrets komposition. Ändrade originalbytes kräver ny verifierad bankbindning; ändrad scenplacering gör det inte. Workern finns i `services/moving-gpu-worker` (RunPod), körningen i `services/game/moving-speech-runtime.mjs` och aktiveringen i `CROUPIER_MOVING_SPEECH_ENABLED` (se [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md)).

- **Tider.** Workern kör ett uttalande åt gången, 24 kHz/24 fps, 220 ms förmarginal, 530 ms eftermarginal och högst 600 rutor; sista giltiga ljud är 582 999 samples (`services/game/moving-speech-timing.mjs`). Både worker och spelmotor kräver minst 30 uppmätta uppvärmningsrutor per sekund. Genererad OpenClaw-text normaliseras före förhandsvisning, TTS och hashning; inspelade repliker behåller originaltexten.
- **Spelaren.** Hela den komprimerade repliken och verifierat `done` krävs före ljudstart (högst 4 MiB komprimerat och 48 avkodade ansiktsrutor). Exakt genererat ljud och tillhörande bildrutor följer samma klocka; ingen separat munanimation. Den tillfälliga `playbackReceipt` innehåller socketöppning, första hashverifierade PCM, `reply_ready_ms`, ljudets `play()` och första renderade talruta, men varken repliktext eller transportbiljett.
- **Worker och antagning.** Endpointen är exklusiv för journalen: `workersMin=0`, `workersMax=1`, högst 60 s `idleTimeout`. En ledig egen worker får återanvändas bara med serverns färska RunPod-läsning (högst 15 s): exakt image-digest, template och version, ingen kö och högst en aktiv GPU. Kontrollen upprepas under journalens SQL-lås och precis före provider-POST. Osäker submission hålls reserverad utan automatisk omkörning. En EXITED-worker eller cachepost är ingen aktiv GPU.
- **Budget.** Varje dealer har en egen kumulativ budget, `movingTrialBudget(dealerId)` med ID `<dealerId>-test-20261017` (Dragans `dragan-test-20261017` är oförändrad); dygnstaket gäller miljön och delas av alla dealers. Det effektiva taket är det lägsta av koden och den sparade policyraden `gpu_budget_policies`, som bara ändras med `amendBudgetPolicy` och uttrycklig bekräftelse; schemats CHECK-gränser följer Studio-migreringarna 015, 017, 018 och 019. Reservationen är 1,2 USD per försök och historiken bevaras. Journalens reservationer är ingen faktura.
- **Lagring.** Moving-vägens PCM och ansiktspaket (H.264 Annex-B 256×512) är flyktiga och sparas inte i svarsbiblioteket. Originalfilmerna finns i privat Blob med identiteter i Neon; härledda renderingar och referens-ZIP är inte nya original eller godkända repliker. Ofullständiga eller avbrutna resultat får aldrig markeras färdiga.

### Genererat tal och svarsbibliotek

Dealerpostens privata `speechProfile` (v2) sparar röstleverantör, `voiceId`, `modelId` och en egen referensvideo med SHA-256 och offset. Profilen följer inte med det publika paketet; servern läser den aktuella profilen och kontrollerar bolagets publicering och sessionens ägare före varje betalt anrop. Betald TTS eller GPU startar först när exakt text och färska kontroller av spelare, runda, publicering och profil finns. Färdiga fullfile-svar sparas som privat WAV och MP4 i Blob med metadata i `speech_reply_records` (scopad, revisionskontrollerad, `reviewStatus=pending` tills någon har granskat); spelarens mikrofonljud sparas aldrig. Inspelade fria chattsvar är text-only när deras exakta text- och videopaket inte är verifierat.

### Driftväljare: kontrollplan

<a id="driftvaljare-kontrollplan"></a>

`packages/presentation/contracts/moving-drift.mjs` definierar kommandot `expectedRevision`, `commandId`, `mode` (`off | saving | warm`), `profileId` (för saving och warm) och `durationSeconds` (bara warm: 1 800, 7 200 eller 86 400). Servern bestämmer sluttiden; klienten anger aldrig endpoint, pris, budget eller workerstatus. `services/game/moving-drift-controller.mjs` ger serverklocka, revision, önskat läge, observerad status, profil, release- och bankberedskap och skälkod; saknad eller gammal observation ger `unknown`. `nextAction` är en intern plan, aldrig ett kvitto. Lagringen (`services/game/postgres-moving-drift.mjs`, Studio-migrering 016 och 017) använder databasklockan och en rad per miljö med ett läge per dealer (`state.dealers.<dealerId>`). Varje dealer har en egen profil och endpoint, en egen executor och en egen bank; en dealers Av tömmer bara den dealerns försök och sessioner. Journalen tillåter fortfarande en öppen GPU-session åt gången i miljön.

Admin registrerar `GET`/`POST /studio/api/admin/moving-drift` bakom N1, färsk session, exakt origin och CSRF. 200 bekräftar önskat läge, aldrig genomförd GPU-drift; konflikter ger 409 och saknad migrering 503. API:t är avstängt utan serverns opt-in och profilkonfiguration enligt [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md#driftväljarens-api). Första runtimeetappen tillåter Av och Sparläge på en befintlig verifierad min0/max1-endpoint; varm drift och profilbyte är spärrade. Av kräver nekad antagning, färsk observerad Av, noll aktiva workers och öppna sessioner. Nekanden loggas som `moving_drift_guard_rejected` och läsvarvens tidsklass som `moving_drift_readback_timing` (`services/game/moving-drift-diagnostics.mjs`), utan token, UUID, hashar, URL:er eller råfel.

## Kamera och mikrofon

Kamera och röst är en behållen produktfunktion (Jakobs beslut 22 oktober 2026), i dag Astrid-märkt och styrd av `CROUPIER_ASTRID_CAMERA`. Record aktiverar lokal lyssning efter vald dealers namn; Play styr spelljudet. Kameran väljs separat och är av från början. `/api/dealer/observation` och `/api/dealer/transcription` delar spelarens autentisering och validerar dealern mot aktuell publicering.

Efter aktiveringsordet skickas turen vid 1 150 ms tystnad. Ljudbufferten är högst tre sekunder i minnet och turen högst 30 sekunder. Kamerabilder tas först efter aktivering; dold flik, spelarbyte och Record av avbryter. Första aktiveringen begär samtycke. Servern transkriberar med Whisper `whisper-1` och behåller originalspråket; dealerprofilen väljer Cartesia eller ElevenLabs för rösten. Nycklar finns bara på servern. Syntetiska prov är inget godkännande av fysisk mikrofon, kamera eller läppsynk.
