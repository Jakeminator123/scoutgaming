# Förenkling av Admin: en knapp för att publicera rummet

> **Utkast, flyttat till repot 27 oktober kväll** från orkestratorns lokala arbetsmapp, oförändrat utom sökvägar. Det finns inte i [masterplanen](../../migrering/MASTERPLAN.md) och Jakob har inte beslutat omfattningen. Radnummer gäller `e7a4e251`; läs om koden innan något byggs.

Underlag: `main` e7a4e251 (341a8344 + #440, som bara ändrar dokument och status). Allt nedan är läst i koden. Inget är ändrat. Radnummer gäller e7a4e251.

Datamodellen ändras inte: operatörer, rum, sammansättningar (`lanes`), frysta paket (`operator_packages`) och rumskonfigurationer (`shared_table_configs`/`_heads`) står kvar. Ingen ny tabell och ingen ny runtime-kapabilitet behövs. Det som ändras är Admins flöde och en ny serveråtgärd som kombinerar befintliga skrivningar.

`migrering/MASTERPLAN.md` innehåller inget avsnitt "Admin-förenkling", varken på 341a8344 eller e7a4e251. Om planen godkänns ska den läggas in där som ett eget scope.

---

## 0. Varför det känns överdrivet: läget i dag

Rummet `/admin/rooms` har i dag **fem olika publiceringsknappar**. Alla höjer bolagets paketversion:

| # | Knapp | Var | Vad den skriver |
|---|---|---|---|
| 1 | **Publicera för …** / **Publicera igen** under den hopfällda *Spelmallar för bolaget* | `registered-studio.tsx:303-322` | `POST operator-package {operatorId,lanes,expectedPackageRevision}`. Fryser om allt material från det sparade projektet (`operator-package-api.mjs:161-197, 248-269`) |
| 2 | **Spara spelinställningar** → **Publicera spelinställningar** | `room-game-config.tsx:62-63` | `POST room-game-config` med `save-draft` och sedan `publish` (`room-game-config-api.mjs:110-133`) |
| 3 | **Publicera PAOWs viloklipp** (hårdkodat `paow`) | `registered-studio.tsx:193-209, 287-292` | `POST operator-package {action:'refresh-dealer-idle'}` (`operator-package-api.mjs:86-100, 210-228`) |
| 4 | **Spara utkast** → **Granska publicering** → **Publicera granskat utkast** (rummets bakgrund, dealer och bord) | `partner-appearance.tsx:179, 187` | `POST /studio/api/partner/branding` (save-draft, review, publish). Publicering höjer paketet +1 (`partner-appearance.tsx:139`, `operator-store.mjs:690-708`) |
| 5 | **Publicera sparad placering** (i Sceneditor) | `scene-publication.tsx:44` | `POST operator-package {action:'publish-scene-layout'}` (`operator-package-api.mjs:77-84, 229-247`) |

Utöver knapparna finns de här fällorna:

- **Publiceringen syns inte förrän man letar.** Knapp 1 ligger i en hopfälld `<details>` med rubriken *Spelmallar för bolaget* (`registered-studio.tsx:303`). Knapp 2 visas bara när rummet redan är publicerat, live och blackjack (`registered-studio.tsx:45, 294`). Knapp 4:s publiceringsknapp visas först efter **Granska publicering**, eftersom panelen annars är dold (`partner-appearance.tsx:180`).
- **Paketet ogiltigförklarar spelinställningarnas utkast utan att det syns.** Publiceringen kräver `draft.basePackageRevision === pack.revision` (`room-game-config-api.mjs:123`). Efter knapp 1, 3, 4 eller 5 svarar **Publicera spelinställningar** därför 409. Meddelandet lyder "Uppgifterna har ändrats. Läs in aktuella uppgifter" (`room-game-config-client.mjs:34`). Det fungerar först när man trycker **Spara spelinställningar** igen utan att ha ändrat något. K05-skriptet gör just så: det sparar utkastet igen vid aktuell paketversion (runbook, avsnittet "publicering via skript").
- **Felmeddelandet pekar fel.** Om paketet stoppas av rummets talmaterial (se nästa punkt) visar knapp 1 texten "Kontrollera lagerfiler, vald grundloop och tillåtna val" (`operator-package-client.mjs:46`). Servern skickar bara en kod för `room-game-config` (`studio-admin-api.mjs:166-169`), och publiceringsfel är medvetet generiska (`room-game-config-api.test.mjs:207-217`).
- **Spelinställningarna följer redan med paketet.** När ett rum har en publicerad konfiguration återberäknar varje paketpublicering den med samma språk och insatsprofil. Saknas giltigt material stoppas hela paketet atomiskt (`room-game-publication.mjs:129-148`, `operator-store.mjs:579-583, 594`). Ett separat steg 2 behövs alltså bara första gången och när språk eller insatsprofil ändras.
- **Tre namn används för samma sak (lane).** UI:t säger "Sammansättning" (`admin-publication-page.tsx:260`, `connected-clip-map.tsx:354`), "Spelmall"/"Spelmallar för bolaget" (`registered-studio.tsx:303, 311, 324`) och "Gemensam mall" (`registered-studio.tsx:300`). TERMINOLOGI säger "mallar" och "Meny, rubrik och länk använder samma namn" (`TERMINOLOGI.md:30-31`). Menyn heter "Spelbolag & rum" (`packages/navigation/admin-navigation.mjs:10`) medan sidans rubrik är "Spelutbud" (`registered-studio.tsx:246`).
- **Två meddelanden beskriver två publiceringssteg.** Röst & tal skriver "Publicera paketet igen och därefter spelinställningarna" (`studio-speech-panel.tsx:127`). Klippkartan skriver "Rumspublicering hanteras separat" (`connected-clip-map.tsx:274`).
- **STEG 1–3 nås inte via normal routing.** `admin-publication-page.tsx:234-290` renderas bara för `section==='publication'`, men `/admin/publication` omdirigeras till `/admin/rooms` (`packages/navigation/admin-workspace-routes.mjs`, `destinations.publication`, och `entry.tsx:33-40`). `/admin/companies` använder bara grenen `companiesOnly` (`admin-publication-page.tsx:229-232`).

---

## 1. Målflöde: en knapp, **Publicera**, på rummet

### 1.1 Vad Jakob ser

Rumssidan (`/admin/rooms`) får ett enda innehåll när det finns ett aktivt bolag med ett rum:

1. **Rubrik:** "PAOW Blackjack · Johns Bet". Bredvid står **Live · version 7 · publicerad 27 okt 18:40 av jakob** och en primär knapp, **Publicera**. Knappen är inaktiv med texten "Inget att publicera" när det sparade läget inte skiljer sig från live.
2. **Scen och rummets val:** bakgrund, dealer och bord som i dag. Ändringar sparas som utkast men publiceras bara med **Publicera**.
3. **Spelinställningar:** bordsspråk och insatsprofil. Fälten sparas med **Publicera**. Det finns ingen egen Spara- eller Publicera-knapp.
4. **Avancerat** (hopfällt): mallar som bolaget får använda (dagens *Spelmallar för bolaget*), Bolag & team, Lägg till spel, Återställ borttaget spel, versionshistorik och tekniska ID.

**Före publicering.** **Publicera** öppnar rutan *Det här ändras jämfört med live*:

- **Tal:** en rad per replik som ändras, till exempel "Lycka till · sv: goodluck_1 → goodluck_3 (godkänd av jakob 27 okt)".
- **Klipp:** antal giv-, visnings- och viloklipp som byts.
- **Vila:** basloop och antal beteendeklipp, om de ändras.
- **Placering:** "ändrad" eller "oförändrad".
- **Inställningar:** till exempel "Språk en → sv" och "Insatsprofil Privé → Casual".
- **Rummets val:** bakgrund, dealer och bord före → efter.
- **Hinder** i rött, med länk till exakt rätt ställe. Exempel: "Försäkring · sv: ingen godkänd tagning → Öppna i Röst & tal" och "36 klipp saknar mätt speltid → Mät speltid".

Knappen **Publicera nu** är aktiv bara när hinderlistan är tom.

**Efter publicering:** ett kvitto med "Publicerat · version 8 · 27 okt 21:14 · av jakob". Under **Detaljer** visas `configVersion` och paketversionen före och efter. Kvittot har länken **Öppna rummet** (`playUrl`).

**Vid fel:** ett meddelande på svenska och en kod, till exempel "Inget publicerades. Någon annan ändrade rummet efter förhandsvisningen. Läs in igen. *(studio_conflict · package)*". Klienten försöker aldrig igen automatiskt, vilket stämmer med regeln i `README.md:112`.

### 1.2 Server: en orkestrerad åtgärd med ett kvitto

**Ny åtgärd** `POST /studio/api/admin/operator-package` med `action:'publish-room'`. Den läggs på samma endpoint som `refresh-dealer-idle` och `publish-scene-layout` för att återanvända den befintliga preparation-kedjan (`operator-package-api.mjs:161-163`, `studio-admin-api.mjs:132-138`). Kroppen ska ha exakt dessa nycklar:

```
{action:'publish-room', operatorId, roomId, gameConfig:{language,limitPreset},
 expectedPackageRevision, expectedProjectRevision, expectedAdministrationRevision, previewToken}
```

**Steg 1: prepare** (utanför SQL-låset, som dagens paketpublicering):

- Kontrollera att operatören är aktiv och att rummet är live och blackjack.
- Kontrollera att `current.revision === expectedPackageRevision`. Annars svarar servern 409 och skriver ingenting.
- Fånga materialet med samma `captureFrozenPresentation` och `selectedRegisteredIdleDefaults` som i dag (`operator-package-api.mjs:172-193`). `lanes` = bolagets nuvarande lanes; urvalet av mallar förblir en åtgärd under Avancerat.
- Kör `videoRegistry.verifyCapturedMedia` för providerkontrollen.
- Räkna fram kandidatpaketets branding med `withPackagePresentation(current.branding, presentation)`.
- Räkna ut skillnaden och dess hash. Hashen ska vara lika med `previewToken`, annars svarar servern 409 `studio_release_preview_stale`. Detta följer partnergranskningens `reviewToken` (`partner-appearance.tsx:113`).

**Steg 2: en SQL-transaktion med ett operatörslås och en versionsökning N→N+1.**

1. Läs om project- och administration-revisionerna och paketet. Vid avvikelse svarar servern 409 `studio_conflict` med `step:'project' | 'administration' | 'package'`. Kontrollen är densamma som `operator-package-api.mjs:259-260`.
2. `assertCapturedPresentationMedia` och `assertPublishedRoomBindings`, som `operator-package-api.mjs:261-263`.
3. Lös rummets material mot **kandidatpaketet** (revision N+1) med `resolveNativeRoomGameMaterial`, plus samma kontroller som `room-game-config-api.mjs:58-89`: `validateRoomGameMaterial`, `recordedSpeechForVideo` och mediaposternas revision. Om materialet inte är klart svarar servern 422 `studio_room_game_material_unavailable` med `materialReason` från den fasta listan (`room-game-config-api.mjs:20-25`) och skriver ingenting.
4. `operators.publishRoomGameConfig({expectedRevision:N, lanes, games, tables, branding:kandidat}, {roomId, gameConfig, material})`. Det är den befintliga J08-skrivaren (`operator-store.mjs:601-605`). Den ger en versionsökning och en auditrad. Den låser rummen och flyttar konfigurationens head med CAS (`room-game-publication.mjs:109-110, 179-184`). Andra rum återberäknas eller behålls som i dag (`room-game-publication.mjs:129-148`).
5. Ta bort rummets `roomGameConfigs`-utkast i administration-dokumentet med CAS, som `room-game-config-api.mjs:129-130`.
6. Svaret är ett kvitto: `{ok, operatorId, roomId, previousPackageRevision:N, packageRevision:N+1, configVersion, publishedAt (published_at_ms), actor, changes}`.

**Tomgång (idle).** Ingen separat uppdatering behövs. Full infångning tar med `dealerIdlePolicies` (`frozen-dealer-idle.mjs:156-161`) och viloklippens standardval (`operator-package-api.mjs:190-192`). Endpointen `refresh-dealer-idle` får finnas kvar i koden, men knapp 3 tas bort.

**Placering.** Full infångning tar med den sparade mallens `composition` (`frozen-presentation-capture.mjs:57, 81`). Knapp 5 blir därmed ett specialfall och flyttas till Avancerat.

**Rummets val.** Två alternativ:

- **(a) Första versionen:** Finns ett opublicerat utkast för rummets val stoppar åtgärden med 409 `studio_room_choices_draft_pending`. Förhandsvisningen visar då "Rummets val har ett opublicerat utkast".
- **(b) Andra versionen:** utkastet tas med i samma transaktion. `changeBrandingDraft` och `publishWithin` kan dela `txQuery` (`operator-store.mjs:690-708`).

Jag föreslår (a) först, eftersom PAOW, Blackjack Oak och Midnight sällan ändras. Version (b) kommer i PR C2 nedan.

**Förhandsvisning:** `GET /studio/api/admin/room-release?operatorId&roomId`.

- Endpointen läggs till i `STUDIO_ADMIN_ENDPOINTS` (`studio-admin-contract.mjs:26-27`) och i listan över tillåtna läsfrågor (`studio-admin-contract.mjs:68-84`, `studio-admin-api.mjs:85`).
- Den returnerar live och kandidat per område (tal per replik och språk med `takeId` och granskning, klipp-id per fack, vila, placering, inställningar och rummets val), `ready` med hinder och kod, samtliga revisioner och `previewToken`.
- Livevärdena läses ur den publicerade konfigurationens `material.media` (`room-game-publication.mjs:75-84`) och paketets presentation. Förhandsvisningen gör **ingen** provider-I/O, eftersom den kontrollen görs i POST-stegets prepare. Det håller sidan snabb.

**Transaktionsalternativ i API-lagret.** Ny gren i `studio-admin-api.mjs:147-156` för `operator-package` med `publish-room`. Den behöver `presentationDocuments: ['project','administration']`, `presentationOperatorIds: [operatorId]` och `presentationMutation` som omfattar:

- `presentation-package` (kandidaten),
- `{kind:'administration', value:{roomGameConfigs:[]}}`,
- `NATIVE_FILMED_PLANNING_MUTATION`.

Det är samma byggstenar som de två befintliga grenarna använder (rad 150-152 och 156).

### 1.3 Felkontrakt (409, 422 och 503)

Alla fel returneras som `{error, code, step}`. `code` kommer alltid från en fast lista och innehåller aldrig rådata, vilket är samma princip som `room-game-config-api.test.mjs:355-369`. Inget fel lämnar en halv publicering, eftersom allt sker i en transaktion.

| HTTP | code (step) | När | UI-text (kort) |
|---|---|---|---|
| 409 | `studio_conflict` (`package` / `project` / `administration` / `room_config_head`) | En revision har ändrats efter förhandsvisningen, eller en dubbel publicering har förlorat | "Inget publicerades. Rummet ändrades under tiden. Läs in och granska igen." |
| 409 | `studio_release_preview_stale` (`preview`) | Kandidatens skillnad är inte den som visades | "Ändringarna är inte desamma som du granskade. Läs in igen." |
| 409 | `studio_room_choices_draft_pending` (`room_choices`) | Rummets val har ett opublicerat utkast (version a) | "Rummets val har ett opublicerat utkast. Publicera eller kasta det först." |
| 422 | `studio_room_game_material_unavailable` + `materialReason` (`material`) | Talet är inte godkänt eller kopplat, mätning saknas, banken är ofullständig och så vidare | Befintliga texter i `room-game-config.tsx:6-29`, plus länk till repliken eller **Mät speltid** |
| 422 | `studio_release_invalid` (`request`) | Felaktig kropp | "Begäran var ogiltig. Ladda om sidan." |
| 404 | `studio_room_not_found` (`room`) | Rummet är inte live eller tillhör ett annat bolag | "Rummet är inte tillgängligt för bolaget." |
| 503 | `studio_presentation_runtime_update_required` (`runtime`) | Spelmotorn är för gammal (`studio-admin-api.mjs:170-172`) | "Spelmotorn behöver uppdateras. Inget publicerades." |
| 503 | `studio_room_config_storage_missing` (`storage`) | Tabellerna i `croupier_game.shared_table_config*` saknas (migrering 009 är inte körd i produktion, se K05-runbook) | "Rumsinställningarnas lagring är inte installerad. Inget publicerades." |
| 503 | `studio_media_registry_unavailable` (`media`) | Registret eller Blob-kontrollen är otillgänglig | "Klippregistret svarar inte. Försök igen senare." |

Den nya koden `studio_room_config_storage_missing` kräver en läskontroll i transaktionen innan något skrivs (`to_regclass`). I dag skulle samma situation ge ett okänt SQL-fel.

### 1.4 Endpoints som åtgärden bygger på

- `operator-package` (prepare och transaktion, `operator-package-api.mjs:161-269`).
- `room-game-config` (materiallogiken i `room-game-config-api.mjs:58-89`; själva endpointen behålls för utkast och för flerrumsläget).
- `operator-store.publishRoomGameConfig` (`operator-store.mjs:601-605`).
- `room-game-publication.prepareRoomGamePublication` och `writeRoomGamePublication` (oförändrade).

Endpointen `presentation-room` (`presentation-room-api.mjs:217-335`) berörs inte. Den används bara för att skapa rum.

---

## 2. Dölj sammansättning och lane för en operatör med ett rum

- **Automatiskt val.** När det finns exakt ett aktivt bolag, en mall och ett rum visas varken bolagsväljare, spelkort eller mallväljare. Defaulten finns redan: första bolaget i `registered-studio.tsx:139`, första mallen i `:148`, och i klippkartan `connected-clip-map.tsx:354`. Begreppen ligger kvar i modellen och visas under **Avancerat** när det finns fler än ett.
- **Automatiskt skapande:** behövs inte för Johns Bet, eftersom "PAOW Studio · Blackjack" redan finns. Finns ingen mall alls ska en enda knapp, **Skapa scen**, visas i stället för länken "Skapa en sammansättning" (`registered-studio.tsx:308`).
- **Spelmallar för bolaget** flyttas in i rummets **Avancerat** under namnet **Mallar som bolaget får använda**. Det finns ingen egen Publicera-knapp där. Ändras urvalet publiceras det med rummets **Publicera**, eller med en egen knapp "Publicera mallurval" i Avancerat för flerbolagsfallet.
- **Namn enligt TERMINOLOGI:**
  - Synliga "Sammansättning", "Spelmall" och "Gemensam mall" blir **Mall** (scenens mall). Det tekniska ID:t visas under Detaljer (`TERMINOLOGI.md:32`).
  - Sidrubriken "Spelutbud" (`registered-studio.tsx:246`) blir **Spelbolag & rum**, samma som i menyn. Om bolaget bara har ett rum blir rubriken rummets namn.
  - "Paket" och "Publicerad version" blir **version** i UI:t.
- **Dubbletter som tas bort:**
  - I Admins rumsläge (`roomLayout` med `adminChoices`) tas **Granska publicering** och **Publicera granskat utkast** bort (`partner-appearance.tsx:179-187`). Partnerportalen (N2) behåller sin granskning oförändrad.
  - I klippkartan ersätts *Rum och publicering* (`connected-clip-map.tsx:359-366`), med både **Rummets val** och **Granska rumspublicering**, av en statusrad: "Johns Bet · PAOW Blackjack · Live v7 · 3 ändringar ej publicerade → **Publicera i rummet**".
  - Knapp 3 (PAOW-vila) och den hårdkodade `paow` (`registered-studio.tsx:193-209, 287-292`) tas bort.
  - Knapp 5 flyttas till Sceneditorns Avancerat.
- **Flera bolag förblir möjligt.** När antalet aktiva bolag, mallar eller rum är större än 1 visas dagens väljare, oförändrade, under **Avancerat**. Detsamma gäller `/admin/companies`.

---

## 3. Klippkarta och Röst & tal efter #436/#437

Det som fortfarande förvirrar:

1. **Samma koppling har två namn.** Klippkortet säger **Kopplat i sparat utkast** (`connected-clip-card.tsx:72, 127`). Röst & tal säger **Standard: …** och **Sätt som standard i talfacket** (`studio-speech-panel.tsx:143, 151-152`). Inget av dem talar om vad som är **live**. Klippkartan säger uttryckligen att den inte jämför med det publicerade (`connected-clip-map.tsx:365`).
2. **"Sätt som standard" kräver tre steg på tre ställen.** Utkastet ändras (`studio-speech-panel.tsx:87-89`), sedan **Spara utkast** i klippkartans rubrik (`connected-clip-map.tsx:348`), och sedan två publiceringar (`studio-speech-panel.tsx:88, 127`).
3. **"17 fack" i rubriken** (`connected-clip-map.tsx:375`, `{slots.length} fack`) blandar obligatoriska och frivilliga fack. TERMINOLOGI säger att frivilliga beteenden inte ska visas som saknat material (`TERMINOLOGI.md:62-63`).
4. **Varje kort har samma knapp, "Förhandsvisa och redigera"** (`connected-clip-card.tsx:130`). Det blir visuellt brus, och man ser inte vad som är klart.
5. **AI-delarna syns för PAOW** fast de inte fungerar för PAOW ("I dag har bara Astrid en verifierad koppling", `studio-speech-panel.tsx:199`). Astrids "Tal vid inaktivitet" ligger kvar i klippkartan (`connected-clip-map.tsx:412`).
6. **Olika namn i dokumentationen:** "Tal-klipp & ljud" (`README.md:264, 386`) och "Röst & tal" (`README.md:178`).

Små förbättringar, i ordning efter nytta:

- **Live-märke per replik i Röst & tal:** "Live: goodluck_1 · Utkast: goodluck_3". Datan hämtas från förhandsvisningen (`room-release`).
- **"Använd i spelet"** ersätter **Sätt som standard i talfacket**. Knappen sätter standard **och** sparar utkastet med samma `bindClip` och spara-väg som i dag. Därefter visas "Ej publicerat → Publicera i rummet".
- **Kortstatus:** **Kopplat i sparat utkast** blir **Standard (sparad)**. Har kortet ändrats sedan live läggs märket **Ändrat sedan publicering** till.
- **Fackräknare:** "Krävs för spel: 10/10 tal · 34/34 giv · 1/1 vila · Frivilligt: 3". Frivilliga fack fälls ihop.
- **Klick på kortet öppnar detaljpanelen.** Knappen **Förhandsvisa och redigera** byter namn till **Öppna** eller tas bort.
- **Genererat tal, realtidstal och Testa dialog** fälls ihop under **Avancerat · AI-tal** för dealers utan verifierad röstprofil.
- **Texterna "publicera paketet igen och därefter spelinställningarna"** (`studio-speech-panel.tsx:88, 127, 194`, `connected-clip-map.tsx:274`) blir "Publicera i rummet" med länk.

---

## 4. Ren start: ordning

Handoffen säger "Clean slate: först efter K05" (JOHN-HANDOFF, avsnittet 27 oktober kväll). K05 kräver dessutom migrering 009 i produktion innan rumspubliceringen kan göras (K05-runbook, "Hinder i produktion").

**Viktig risk:** arkivering av en dealer flyttar **varje mall som bara tillåter dealern** till papperskorgen tillsammans med dealern, och berörda rum avpubliceras.

- Regeln finns i `laneUsesDealer` (`apps/studio/lib/dealer-archive-impact.mjs:18-20`) och i `lifecycleProject` (`apps/studio/lib/dealer-lifecycle.mjs:19, 22, 38`).
- Om "PAOW Studio · Blackjack" listar Dragan eller Astrid som tillåten dealer skulle arkivering av dem ta Johns Bets mall och avpublicera rummet.

Ordning:

1. **K05 klart:** tal godkänt, talfack kopplade, paketet publicerat och rummet publicerat, med dagens UI eller skriptet `--publish-package` och `--publish-room`.
2. **Säkerhetskopia:**
   - En Neon-gren eller snapshot av produktionen, till exempel `pre-clean-slate-YYYYMMDD`.
   - Notera Johns Bets paketversion, `configVersion` och listan över id:n som ska arkiveras: operatörer, rum och dealers.
   - Det finns i dag **inget** verktyg som laddar ner privat Blob till disk. `tools/export-media-blob.mjs` går åt andra hållet (lokalt → Blob). Permanent radering av dealerfiler ska därför vänta (steg 7).
3. **Rensa mallen:** i Sceneditor → mallen "PAOW Studio · Blackjack" → **Tillåtna dealers**, behåll bara PAOW. Spara och **Publicera** rummet. Kontroll: förhandsvisningen ska bara visa ändringen "Dealers: … → PAOW".
4. **Testrum hos Johns Bet** (om sådana finns): **Ta bort** på spelkortet, det vill säga arkivering av rummet (`registered-studio.tsx:269` → `room-lifecycle`).
5. **Andra bolag:** Bolag & team → **Flytta till papperskorgen** (`resource-lifecycle-api.mjs:88-123`). Åtgärden går att ångra. Rum kopplas loss och historiken bevaras. Bolag och rum kan **inte** raderas permanent, eftersom API:t bara har arkivering och återställning. Ingen sådan funktion behöver byggas: arkiverade bolag syns inte i några aktiva val (`registered-studio.tsx:134-136`).
6. **Dealers Astrid och Dragan:** Dealers → **Ta bort** (arkivering). AI-talet stängs av automatiskt (`dealer-lifecycle.mjs:9`). **Kontroll i bekräftelserutan:** den får inte lista något rum eller någon mall hos Johns Bet. Gör den det, avbryt och gå tillbaka till steg 3.
7. **Kontrollera efteråt:**
   - Lobbyn visar bara PAOW Blackjack.
   - `/game` startar.
   - Rumsinställningarna läses tillbaka med samma `configVersion` om inget annat är publicerat.
   - Om du publicerar något nytt ska versionen öka med exakt 1.
8. **Senare, efter en till två veckor:** papperskorg → **Radera permanent** för dealers (tidigast 15 minuter efter arkivering, `README.md:471`), och först sedan Blob-filerna har exporterats till en kopia.

**Kod som blir död efteråt.** Den tas bort i ett senare steg. Följ konsumenterna först (AGENTS.md:56). Schemat lämnas orört.

| Område | Platser (urval) | Beslut som krävs |
|---|---|---|
| Astrid-probe (tal vid inaktivitet) | `connected-clip-map.tsx:412`, `components/probe-editor.tsx`, `lib/probe-server.mjs`, `app/api/probe/route.ts`, `services/game/probe-runtime.mjs`, `services/game/storage/async-probe-runtime.mjs`, `packages/director/product-probe.mjs`, `packages/presentation/contracts/probe-policy*` | Nej |
| Filbyggaren (genererat tal) | `lib/studio-speech-build-service.mjs`, `app/api/speech-build/route.ts`, sektionen "Ny generering" i `studio-speech-panel.tsx` (cirka rad 200) | **Ja.** Det är den enda verifierade AI-röstkopplingen. Utan den finns inget AI-tal för PAOW förrän en ny röstprofil har verifierats |
| Kamera och transkription | `services/game/astrid-transcription.mjs`, `services/game/public/astrid-camera-audio-worklet.mjs`, `test/astrid-camera*.mjs`, `astrid-wake-word.mjs`; flaggan `lissabon-stream-lane` (`README.md:322`) | Nej |
| Moving speech med hårdkodad Dragan | `services/game/server.mjs:1317` (`moving_speech_test_dealer_required`), `services/game/moving-speech-*.mjs`, `services/moving-gpu-worker/`, `packages/presentation/contracts/filmed-profiles/registry.mjs:5` | **Ja** (GPU-spåret som helhet) |
| Hårdkodade dealeruppsättningar | `media-catalogue.mjs:18`, `material-revision.mjs:37` (`dragge`, `astrid2`, `marten`); 59 filer med `'astrid'` utanför tester | Nej, men stort. Dela upp per paket |
| Demobolag | `operator-package-api.mjs:19-29, 288-297` (`sg-test`, `operator-create-demo`), `PARTNER_PREVIEW_OPERATORS` | Nej |
| Gamla publiceringsytor | `admin-publication-page.tsx:234-290` (STEG 1–3), knapp 3 i `registered-studio.tsx`, eventuellt `refresh-dealer-idle` | Nej |

---

## 5. PR-lista, tester och risker

| PR | Innehåll | Storlek | Dagar |
|---|---|---|---|
| **A** | Etiketter och dubbletter, bara klient: *Mall* i stället för sammansättning/spelmall, rubrik lika med meny, texterna om publicering i Röst & tal och klippkartan, kortstatus "Standard (sparad)", **Öppna**, statusrad i stället för *Rum och publicering*, AI-sektioner hopfällda för dealers utan profil. Rena strängtester ersätts (AGENTS.md:31) | S | 0,5 |
| **B** | Server: `publish-room` och `GET room-release`, inklusive felkontrakt och kontroll av 009-lagringen. Filer: `operator-package-api.mjs`, ny `lib/room-release.mjs`, `studio-admin-contract.mjs`, `studio-access-policy.mjs`, `studio-admin-api.mjs`. Ingen schemaändring | L | 2,5 |
| **C1** | Rumssidan: **Publicera** med granskningsruta och kvitto. `RoomGameConfig` blir bara fält. Admin-läget i `PartnerAppearance` utan granskningsknappar. *Spelmallar för bolaget* och väljarna flyttas till Avancerat och döljs när det bara finns ett av varje. Knapp 3 tas bort | M | 1,5 |
| **C2** | Utkast för rummets val ingår i samma transaktion (alternativ b) | M | 1 |
| **D** | Röst & tal och klippkartan: live-märke, **Använd i spelet**, fackräknare | M | 1 |
| **E** | Dokument: README (Spelbolag & rum, Talgranskning `README.md:400`, rad 155-176), TERMINOLOGI (ordlista: mall = lane), handoff och K05-runbookens steg 3–4 | S | 0,5 |
| **F** | Ren start, en driftåtgärd utan kod, enligt avsnitt 4 | S | 0,5 plus väntetid |
| **G1–G4** | Död kod enligt tabellen ovan, en PR per område, efter beslut om AI-tal och GPU | M var | 2–3 |

**Summa:** A–F ungefär 7,5 arbetsdagar. G tillkommer med 2–3 dagar. B och C1 kan utvecklas och provas i staging parallellt med K05. De bör dock driftsättas efter att K05 är klart, så att Jakob inte byter flöde mitt i en produktionsprocedur.

### Teststrategi

- **API** (förläng befintliga mönster):
  - `apps/studio/test/operator-package-api.test.mjs`: åtgärderna med scope, CAS och återställning (rad 295-500) är mallen.
  - `apps/studio/test/room-game-config-api.test.mjs`: J08-proven på rad 89-369 körs om mot `publish-room`, nämligen inaktuell revision, dubbel publicering med en vinnare, fel som rullar tillbaka paket, audit, config, head och utkast tillsammans, fel bolag och fel rum, och ändrad hash eller ändrat språk.
  - Nya prov:
    - En publicering ökar versionen med exakt 1 (i dag 2: 5→6→7 i J08-kvittot).
    - Inaktuell förhandsvisning ger 409 utan skrivning.
    - Saknad 009 ger 503 utan skrivning.
    - `materialReason` kommer bara från den fasta listan.
    - Andra rums konfigurationer återberäknas eller behålls.
    - En avvisad eller väntande tagning stoppar publiceringen.
- **Kedja:** `test/admin-publication-chain.mjs` får en variant som publicerar med `publish-room` och läser tillbaka i lobby och spelval.
- **Klient:** `apps/studio/components/room-game-config.test.mjs`, `apps/studio/test/room-game-config-client.test.mjs` och `apps/studio/test/partner-appearance.test.mjs`. Det sistnämnda ska bevisa att N2 behåller **Granska publicering**.
- **Acceptans i webbläsare (staging), samma steg som J08-kvittot:**
  - Ett klick ger paket N→N+1 och en ny `configVersion`.
  - En inaktuell flik får 409.
  - Replay får 409.
  - Grannrummet är oförändrat.
  - Operatör B får 404.
  - `/game` visar `data-game-package-revision = N+1`.
  - Samma version läses tillbaka efter Render-redeploy.
  - J08-harnessen (`j08-harness.mjs` i orkestratorns lokala arbetsmapp, inte i Git) kan återanvändas.

### Detta får inte gå sönder

- **J08:s CAS och isolering:** operatörslås, rumslås (`room-game-publication.mjs:109-110`), CAS på head (`:179-184`), förbud mot att ändra andra rums bindningar (`:99-100`) och 404 mellan bolag (`room-game-config-api.mjs:46-52`).
- **K05:s materialgrindar:**
  - Samma `resolveNativeRoomGameMaterial`.
  - Samma `recordedSpeechForVideo`-kontroll av godkänd exakt tagning (`room-game-config-api.mjs:79-80`).
  - Samma revisionskontroll av mediaposter (`assertCapturedPresentationMedia`).
  - Ingen ny, lösare väg och ingen reservdealer.
- **Beständighet över omstart:** ingenting i minnet. Kvittot läses alltid tillbaka från `operator_packages` och `shared_table_configs`.
- **Partnerportalen (N2):** granskningsflödet ändras inte.
- **Flera bolag:** urvalet av mallar och provet "advanced republication" (`operator-package-api.test.mjs:546`) behålls.

### Övriga risker

- **Allt som är sparat går live.** Full omfrysning publicerar allt sparat i projektet, även ändringar man inte tänkte på. Förhandsvisningens skillnad är skyddet mot det.
- **Tidsgräns på Vercel.** Providerkontrollen i prepare är lika tung som dagens paketpublicering. Förhandsvisningen gör ingen provider-I/O.
- **Produktionen saknar 009.** Både dagens och den nya rumspubliceringen stoppas tills migreringen är körd.
- **Kaskaden vid dealerarkivering** (avsnitt 4) kan avpublicera Johns Bet om steg 3 hoppas över.
