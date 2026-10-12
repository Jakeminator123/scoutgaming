# Plan: radera dealer och klipp på riktigt

Läst på `07cd1c47732f9908be100119343b97f13c7c2304` (`jakob/repo-ordning`). Ingen kod, ingen databas, ingen Blob och ingen migration är ändrad eller anropad.

**Slutsats:** Arkiv går att ångra. En knapp som heter permanent radering finns redan. Den tar bort Blob-objektet men lämnar databaseraden, med sökvägen kvar. Det Jakob vill ha — att både objektet och raden försvinner — finns inte. Publicerade och frysta paket stoppar redan den befintliga raderingen.

## 1. Nuläget

### Dealer arkiveras och kan komma tillbaka

Knappen sitter under **Hantera dealers** på `/control/clips` (`lab/components/lab-studio.tsx:280`, `lab/components/lab-studio.tsx:305`).

1. `POST /api/dealers/archive-check` med `dealerId` och `expectedRevision` (`lab/lib/studio-dealer-api.mjs:12`, `lab/lib/dealer-lifecycle.mjs:81`).
2. Servern bygger en konsekvenslista och en token (`lab/lib/dealer-archive-impact.mjs:123`). Listan visar klipp, sammansättningar, rum och bolag (`lab/components/dealer-removal.tsx:148`).
3. `POST /api/dealers/archive` med `archived: true` och `impactToken` (`lab/lib/dealer-lifecycle.mjs:87`).
4. Dealern flyttas till `project.dealerTrash`. Tal sätts till `preparation` (`lab/lib/dealer-lifecycle.mjs:9`, `lab/lib/dealer-lifecycle.mjs:20`). Sammansättningar som använder dealern eller dess klipp följer med (`lab/lib/dealer-lifecycle.mjs:19`). Aktiva klipp märks `archived: true` (`lab/lib/dealer-lifecycle.mjs:120`).
5. Rum som använder dealern tas ur administrationsdokumentet och läggs i bolagspaketets livscykel. Berörda sammansättningar tas ur det **aktuella** paketet. Äldre paketrevisioner skrivs inte om (`lab/lib/dealer-archive-impact.mjs:91`, `lab/lib/dealer-archive-impact.mjs:140`).
6. Återställning (`archived: false`) lägger tillbaka dealer, klipp och sammansättningar som utkast. Tal förblir av. Rum och bolag publiceras inte igen (`lab/lib/dealer-lifecycle.mjs:41`, `lab/components/dealer-removal.tsx:162`).

Behörighet: inloggad `admin` eller lagrad `superadmin`, samma scope, `Origin` måste vara sidans egen och `Sec-Fetch-Site` måste vara `same-origin` eller `none` (`lab/lib/studio-dealer-api.mjs:13`). Sessionen läses igen mitt i skrivningen (`lab/lib/studio-dealer-api.mjs:16`). Det finns ingen separat CSRF-token; Origin-kontrollen är den spärr som policyn kallar Origin/CSRF (`lab/lib/studio-access-policy.mjs:2`). Sessionen slås upp på nytt vid varje anrop (`lab/lib/studio-native-auth.mjs:85`).

Prov: `lab/test/dealer-archive-impact.test.mjs`, `lab/test/dealer-lifecycle.test.mjs`, `lab/components/dealer-removal.test.mjs`.

### Klipp arkiveras för sig

I biblioteket på samma sida: **Flytta till papperskorgen** (`lab/components/dealer-media-library.tsx:149`).

`POST /api/videos/archive` med `id`, `archived`, `previous` och `sha256` (`lab/lib/studio-media-api.mjs:70`). Klippet måste vara oanvänt i aktuella dokument. Historiska dokument räknas inte som ägare (`lab/lib/studio-media-api.mjs:86`). `retainedBank` kan inte arkiveras (`lab/lib/studio-media-api.mjs:81`). Återställning kräver att dealern fortfarande finns.

### Det som redan heter permanent radering

Knappen **Radera dealer permanent…** visas bara på en arkiverad dealer (`lab/components/dealer-removal.tsx:181`). **Radera permanent…** på ett klipp visas bara i papperskorgen, och bara för egna uppladdningar. Skyddade original får texten «Skyddat original» (`lab/components/dealer-media-library.tsx:150`).

| Steg | Vad koden gör | Bevis |
| --- | --- | --- |
| Förhandskoll | Bara arkiverat. Inte `retainedBank`. Inte om en annan post äger samma id eller `pathname`. Inte om ett aktuellt dokument eller något bolagspaket innehåller id eller sökväg. Uppladdningstoken måste vara äldre än 15 minuter. | `lab/lib/studio-media-deletion.mjs:20` |
| Bekräftelse | En knapp efter kontrollen. Ingen namntext. Dealerns kontroll returnerar `allowed` och antal, inte arkivets rumslista. | `lab/components/dealer-removal.tsx:184` |
| Databas först | Raden får `deletion.state = pending`. Sökvägen ligger kvar. | `web/storage/studio-repository.mjs:310` |
| Blob | `@vercel/blob` `del(pathname)` med `BLOB_READ_WRITE_TOKEN`. Saknat objekt räknas som redan borta. | `lab/lib/cloud-media-store.mjs:182` |
| Databas efter | Samma rad får `state = deleted`. Raden och `pathname` finns kvar. | `lab/lib/studio-media-deletion.mjs:108`, `lab/test/dealer-lifecycle.test.mjs:163` |
| Dealer | När alla ägda rader är `deleted` tas posten ur `dealerTrash`. Medieraderna tas inte bort. | `lab/lib/studio-media-deletion.mjs:138`, `lab/test/dealer-lifecycle.test.mjs:287` |

Avbrott efter `del` men före `deleted` lämnar en rad som pekar på ett objekt som redan är borta. Även lyckat slut lämnar den pekaren. Det är gapet mot Jakob: raden och sökvägen ska försvinna, och ett avbrott får aldrig lämna en levande pekare till ett raderat objekt.

Historiska dokument blockerar inte denna radering. Kommentaren säger att de får finnas kvar, och att ett senare försök att aktivera dem måste falla stängt (`lab/lib/studio-media-deletion.mjs:47`). Prov: `lab/test/dealer-lifecycle.test.mjs:172`.

### Var klippets byte ligger

Nya Studio-klipp skrivs till Vercel Blob, privat, utan överskrivning. Sökvägen är `croupier/media/dealers/<dealer>/review/uploads/<uuid>/<sha256>.<ändelse>` (`lab/lib/cloud-media-store.mjs:18`, `lab/lib/studio-upload-service.mjs:61`). Registret är `croupier_studio.media_records.record` (jsonb), inte en egen filtabell (`ops/neon-studio/001-studio-metadata.sql:51`).

`media/blob-index.json` (via `CROUPIER_MEDIA_BLOB_INDEX`) är bankens index, inte de nya uppladdningarna. En managed upload får inte stå i det indexet (`lab/lib/media-blob-index.mjs:17`). Systemkartan: «Byteidentiska registrerade poster kan dela storage.pathname; logiskt ID och dess åtkomst består.» (`docs/system-map/storage.json:6236`). Delning syns i databasen: en annan rad med samma id eller samma `record.pathname` (`web/storage/studio-repository.mjs:122`). Uppladdning nekas om en sådan rad finns, utom för `retainedBank` (`web/storage/studio-repository.mjs:248`).

### Tabeller (lästa ur migrationer och kod, inte ur databasen)

Dealer, sammansättning och rum är JSON i dokument, inte egna tabeller.

| Vad | Var | Kolumner som bär det |
| --- | --- | --- |
| Dealer, klippval, sammansättning (`lanes`), papperskorg | Studio-Neon `croupier_studio.documents` kind `project` | `value` jsonb, `revision` (`ops/neon-studio/001-studio-metadata.sql:13`) |
| Rum, spellanes | samma tabell, kind `administration` | `value` jsonb |
| Äldre dokument | `croupier_studio.document_history` | `kind`, `revision`, `value`, `actor` (`ops/neon-studio/001-studio-metadata.sql:24`) |
| Mediapost | `croupier_studio.media_records` | `id`, `revision`, `record` (innehåller `pathname`, `sha256`, `classification`, ev. `deletion`, ev. `retainedBank`) (`ops/neon-studio/001-studio-metadata.sql:51`) |
| Revisionslogg | `croupier_studio.audit_events` | `action` är låst till fem namn, däribland `classify_media`. Radering återanvänder det namnet (`ops/neon-studio/001-studio-metadata.sql:39`, `web/storage/studio-repository.mjs:323`) |
| Bolagspaket, alla revisioner | `croupier_studio.operator_packages` | `package_revision`, `lanes`, `games`, `tables`, `branding` (`ops/neon-studio/005-operators.sql:43`) |
| Arkiverat rum inne i paketet | `branding._scoutLifecycle` | gzip, inte en ny tabell (`web/storage/operator-lifecycle.mjs:8`) |
| Fryst presentation | `branding._scoutPresentation` | gzip av lanes, dealers och `playback.media` (`web/storage/presentation-package.mjs:7`) |
| Taljournal | `croupier_studio.speech_requests` | `package_metadata` jsonb, upp till 32 KiB (`ops/neon-studio/002-generation-journals.sql:11`) |
| Forge | `croupier_studio.forge_dealers`, `forge_jobs` | inställningar och jobb. Klippbytena ligger fortfarande i `media_records` (`ops/neon-studio/008-dealer-forge.sql:1`) |
| Spel-Neon | `croupier_game.players`, `transactions`, `blackjack_tables`, `native_presentations`, `partner_rounds` | saldo, bordsläge, kvitto (`payload`), rondvy (`view`). Ingen mediakolumn (`ops/neon-game/product-schema.sql:5`, `ops/neon-game/product-schema.sql:17`, `ops/neon-game/product-schema.sql:37`) |
| Zoner | `croupier_zones.clips`, `documents` | egen databas, bara Astrid (`lab/lib/zone-cloud-schema.sql:5`) |

`partner_rounds.view` är rondens kortläge, inte en Blob-sökväg (`web/partner-api.mjs:176`). Kvittots händelser namnger klipptyp (`astrid-dealer-*`), inte ett media-id (`web/partner-presentation.mjs:46`).

### Frysta paket

«Originalbytes och frysta paket skrivs inte om.» (`docs/JOHN-HANDOFF.md:451`).

Ett publicerat paket bär en gzippad kopia av presentationen. I den kopian ligger hela medieregistret för de valda klippen: id, sökväg, hash, storlek (`web/frozen-dealer-playback.mjs:81`). Arkivets städning filtrerar bara det **nya** aktuella paketet och väljer ingen ersättare (`lab/lib/dealer-archive-impact.mjs:26`). Alla sparade paketrevisioner läses vid raderingskontroll (`web/storage/studio-repository.mjs:328`, `lab/lib/dealer-lifecycle.mjs:68`). Träff på dealer-id eller media-id/sökväg ger `studio_dealer_published` eller `studio_media_published`.

Uppslagningen av dokumentreferenser säger uttryckligen att spelmanifest och jobbjournaler ligger utanför, och att svaret inte är komplett (`web/storage/studio-repository.mjs:345`).

### Bolag och rum

`lab/lib/resource-lifecycle-api.mjs` arkiverar bolag och rum. Media och historik behålls (`lab/lib/resource-lifecycle-api.mjs:88`, `lab/components/control-resource-lifecycle.tsx:124`). Det är inte dealer-radering. Ett öppet rum i administrationsdokumentet, eller ett rum som fortfarande står i paketets `tables`, ska stoppa radering av den dealer eller det klipp rummet använder.

## 2. Vad som måste gälla

| Regel | Hur det avgörs |
| --- | --- |
| Bara arkiverat | Klipp: `classification.archived === true`. Dealer: post i `dealerTrash`, inte i `dealers`. Pågående `pending` får bara slutföras, inte ångras. |
| Aldrig publicerat eller fryst | Varje rad i `operator_packages` i samma scope. Avkoda `_scoutPresentation`. Träff på dealer-id, media-id eller `pathname` i lanes, branding eller `playback.media` stoppar. Avkodning som misslyckas stoppar också (som i dag, `lab/lib/dealer-lifecycle.mjs:76`). |
| Aldrig aktivt rum | `administration.rooms` och aktuellt pakets `tables` / spellane. Arkiverade rum i `_scoutLifecycle` är inte aktiva rum, men deras frysta presentation är fortfarande spärrad om den innehåller media-id. |
| Aldrig spelhistorik eller kvitto | Skriv inte i spel-Neon. Rondvyn och kvittot pekar inte på Blob-sökvägar. De ska inte raderas och inte skrivas om. |
| Bara N1-admin, färsk session, CSRF | Samma som arkivet: `admin`/`superadmin`, scope, Origin, `Sec-Fetch-Site`, och sessionen läses igen omedelbart före skrivning och igen före `del`. |
| Förhandsvisning | Samma sorts lista som arkivet: klipp, sammansättningar, rum, bolag, och om Blob-objektet verkligen tas bort eller delas. Token över revisionerna. |
| Dubbel bekräftelse | Listan plus att namnet skrivs. En ensam knapp räcker inte. |
| Revision | `expectedRevision` på projekt och på varje mediapost, plus `sha256`. Avvikelse ger `studio_conflict`. |
| Revisionslogg | Ny journalrad. `audit_events.action` kan inte få ett nytt namn: migreringsläsaren förbjuder `ALTER` (`ops/neon-studio/migrations.mjs:65`). |
| Ordning | Journal med sökväg, sedan ta bort `media_records`-raden, sedan `del`, sedan läs tillbaka 404, sedan nolla journalens sökväg. Avbrott före `del` lämnar en föräldralös Blob-fil, inte en databasrad som pekar på ett raderat objekt. |
| Läs tillbaka | `getMedia` saknas, listan saknar id, Blob-`get` är 404, dealern saknas i både `dealers` och `dealerTrash`. Svaret skickas först då. |
| Delade byte | Lås `pathname` (`web/storage/studio-repository.mjs:116`). Räkna andra `media_records` med samma `pathname`, i alla scope. Om någon finns kvar: ta bort bara denna rad, anropa inte `del`. |

Uppladdningens 15-minuterstoken ska fortsätta blockera (`lab/lib/studio-media-deletion.mjs:27`).

## 3. Förslag

```
[Arkiv] --> [Kontroll + lista] --> [Skriv namnet]
                                      |
                                      v
                    [Journal] --> [Radera rad] --> [del om ensam] --> [404] --> [Nolla sökväg]
```

### API

Behåll stigarna. Utöka svaret. Inga nya publika URL:er.

| Anrop | Kropp | Svar | Fel |
| --- | --- | --- | --- |
| `POST /api/dealers/delete-check` | `dealerId`, `expectedRevision` | `allowed`, `token`, `clips[]`, `sharedPathnames[]`, `blockedBy[]` (paketrevision, rum, taljournal, forge) | 403 session, 409 conflict / published / in use / retained / grant, 503 ofullständig täckning |
| `POST /api/dealers/delete` | ovan plus `impactToken`, `confirmLabel` | `{project, inventory, purged, sharedKept}` först efter läsback | samma, plus 503 `studio_dealer_delete_pending` om Blob-steget inte är verifierat |
| `POST /api/videos/delete-check` | `id`, `expectedRevision`, `sha256` | samma form för ett klipp | samma |
| `POST /api/videos/delete` | ovan plus `impactToken`, `confirmLabel` | `{project, inventory}` | samma |

`confirmLabel` måste vara exakt dealer- eller klippetiketten från den lästa posten. Token är sha256 av scope, id:n, revisioner och paketrevisioner, samma idé som arkivet (`lab/lib/dealer-archive-impact.mjs:123`).

### UI

| Plats | Text |
| --- | --- |
| Arkiverad dealer, `/control/clips` → Hantera dealers | Knappen finns kvar: «Radera dealer permanent…». Dialogen visar samma listor som arkivet, plus «Blob-objektet tas bort» eller «filen delas, objektet blir kvar». |
| Bekräftelse | «Skriv dealerns namn» och knappen «Radera dealer och filer permanent». Avbryt finns kvar. |
| Klipp i papperskorgen | Samma mönster. Etiketten skrivs. «Skyddat original» har ingen knapp. |
| Pågående | «Slutför radering» kör samma anrop igen. Det är idempotent. |

### Datamodell

Ja, en migration. Ny tabell `croupier_studio.media_purge_journal` i `ops/neon-studio/009-media-purge-journal.sql`, registrerad i `ops/neon-studio/migrations.mjs`. Bara `CREATE TABLE` och `REVOKE`. Inget `ALTER` (läsaren nekar det).

Kolumner: `environment_id`, `workspace_id`, `media_id`, `sha256`, `pathname` (null efter verifierad 404), `dealer_id`, `state` (`intent` eller `verified`), `actor`, `requested_at`, `verified_at`. Primärnyckel scope + `media_id`.

Inget nytt tillstånd på dealern. `dealerTrash` försvinner när journalen är `verified` för alla ägda klipp. `media_records`-raden raderas av applikationen, inte av migrationsfilen.

Följ huvudregeln i `docs/CLOUD-MIGRATION.md:119`: PR, CI röd tills 009 finns i produktions-Neon, Jakob kör `node tools/check-migration-readiness.mjs --apply` med `CROUPIER_MIGRATION_CONFIRM=apply-pending`, sedan merge. Inte `deploymentOptional`. Den flaggan är för en isolerad funktion som tål att tabellen saknas (`docs/CLOUD-MIGRATION.md:125`). Här byts den befintliga raderingsvägen. Kod som deployas före tabellen skulle antingen 503:a eller falla tillbaka till tombstone, och då försvinner inte raderna.

När raden är borta måste en projektsparning som nämner media-id:t nekas, även om id:t bara finns i `document_history`. Dagens tombstone gör det (`lab/test/dealer-lifecycle.test.mjs:172`). Utan den kontrollen kan ett gammalt dokument peka på en fil som inte finns.

### Blob

Återanvänd `purgeManagedMedia` (`lab/lib/cloud-media-store.mjs:184`): `client.del(pathname)` med befintlig `BLOB_READ_WRITE_TOKEN`, timeout 15 s, `BlobNotFoundError` = redan borta. Inget prefix-radering under `dealers/<id>/`. Försök igen genom samma endpoint. Radera bara om referensräknaren är 0, sökvägen inte finns i blob-index, och posten inte är `retainedBank`.

### Prov

Isolerad PostgreSQL och en falsk Blob-klient, samma mönster som `deletionFixture` i `lab/test/dealer-lifecycle.test.mjs`. Aldrig produktions-Neon, aldrig riktig Blob.

Prov som måste finnas: arkiverat krav, publicerat paket blockerar, fryst `playback.media` blockerar, aktivt rum blockerar, delad `pathname` tar bort raden men inte objektet, avbrott efter rad-radering men före `del` lämnar journal och ingen mediapost, andra försöket slutför, läsback 404, `retainedBank` orörd, fel session 403, fel revision 409, namnet måste stämma.

## 4. Risker och vad som inte ska raderas

| Risk | Skydd | Risk |
| --- | ---: | --- |
| Fryst paket eller äldre paketrevision pekar på filen | Spärra, skriv inte om paketet | låg om kontrollen kopieras från dagens `assertLifecyclePackages` |
| Delad Blob-fil | Radera rad, behåll objekt | medel om räknaren missar en scope |
| Taljournal eller forge har samma sökväg | Spärra. Dagens kontroll läser dem inte (`web/storage/studio-repository.mjs:345`) | medel tills de ingår |
| Tombstone tas bort och ett gammalt dokument återaktiveras | Neka projektsparning när media-id saknas | medel, ny spärr på skrivvägen |
| Journalen har sökvägen kvar en stund efter `del` | Spelaren läser inte journalen. Nästa anrop nollar sökvägen. Ingen `media_records`-rad pekar | låg |
| Någon raderar bank eller Git-filer | Knappen rör bara `media_records` för arkiverade uppladdningar | låg om `retainedBank` och blob-index fortfarande nekas |

Rör inte:

- Astrids presentation-bank. Sparad projektkonfiguration refererar 12 klipp under `media/dealers/astrid/runtime/presentation` (72,3 MB) och de ska stå kvar (`ordning/aktiviteter/A04-medieinventering.md:35`). De 12 sökvägarna är inte identifierade i Git (`ordning/rapporter/A04-medieinventering.md:104`).
- De sex hårdkodade `RETAINED_BANK_VARIANTS` (`web/storage/studio-contract.mjs:120`). De är inte samma tolv. Båda mängderna ska vara orörda.
- `media/blob-index.json` och Git-filerna under `media/`.
- Genererat tal: sökvägar `dealers/<dealer>/runtime/generated/` och `speech_requests` (`web/speech-blob-artifacts.mjs:25`).
- `document_history`, `operator_packages`, spel-Neon (spelare, transaktioner, `partner_rounds`, `native_presentations`) och `croupier_zones`.

## 5. Uppskattning

| | |
| --- | --- |
| Filer | cirka 16: ny `009-media-purge-journal.sql`, `migrations.mjs`, `studio-repository.mjs`, `studio-media-deletion.mjs`, dealer- och video-API, två UI-filer, återkopplingstexter, riktade prov, en rad i `docs/CLOUD-MIGRATION.md` och leveransnotis i `docs/JOHN-HANDOFF.md` |
| Tid | en implementeringsomgång, ungefär 8–12 timmars kod, isolerade prov och granskning |
| Risk | 40 % |
| Jakob | När implementations-PR:en är uppe och CI är röd: kör 009 mot produktions-Neon **före** merge, med befintlig bekräftelseflagga. Ingen ny Blob-token. `BLOB_READ_WRITE_TOKEN` används redan av `del` (`docs/ENVIRONMENT-VARIABLES.md:286`, `docs/ENVIRONMENT-VARIABLES.md:497`). |
| Miljövariabler | Inga nya. `docs/ENVIRONMENT-VARIABLES.md` och `docs/environment-variables.json` ska inte ändras, så länge ingen väljer en separat raderingstoken. |

## 6. Beslut

| # | Fråga | Rekommendation |
| --- | --- | --- |
| 1 | Ska mediaposten försvinna, eller ska dagens tombstone med sökväg vara kvar? | Låt raden försvinna. Journal i 009, enligt huvudregeln migration före merge. Ingen ny token. |
| 2 | Ska varje gammal paketrevision kunna stoppa raderingen, eller bara aktuellt paket och öppna rum? | Varje sparad paketrevision och dess frysta presentation stoppar. Aktuellt rum stoppar också. Skriv inte om historiken. |
| 3 | Räcker dagens kontroll plus en knapp, eller ska namnet skrivas? | Skriv namnet, ovanpå listan och token. |

## Tveksamt

- Uppdraget sade att permanent radering saknas. Koden har redan knapp, Blob-`del` och tombstone. Det som saknas är att raden och sökvägen försvinner.
- De 12 presentationsklippen och de sex `RETAINED_BANK_VARIANTS` är olika mängder. A04 kunde inte peka ut de 12 sökvägarna. Planen skyddar båda, men utan en produktionsläsning vet vi inte om någon av de 12 också ligger som en vanlig `media_records`-rad.
- `inspectMediaDeletion` läser paket utan scope-filter och högst 1000 rader (`web/storage/studio-repository.mjs:304`). Över gränsen är radering redan spärrad. En ny kontroll får inte höja det taket i tysthet.
- Att neka projektsparning när media-id:t saknas vidgar en skrivväg som i dag bara tittar på rader som finns kvar. Det behövs för att tombstonens skydd inte ska försvinna, och det ska ha egna prov innan det mergas.
