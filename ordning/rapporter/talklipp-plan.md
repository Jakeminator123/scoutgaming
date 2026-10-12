# Talklipp från vilobild

Läsande plan, 2026-10-12. Ingen kod, ingen data, ingen migration och inga betalda anrop i den här leveransen. Den gamla offline-kedjan som sträckte inspelat ljud och video ska ersättas av en väg som, från en VILA-bild, gör varje fras en gång per dealer och språk och lägger klippet i dealerns bank. Allt ska finnas på svenska och engelska. Spelaren ska använda samma uppspelningsväg som idag. Ingen klistrad mun i spelaren.

## 1. Det som redan finns

### Skapa material (Dealer Forge)

Fliken **Skapa material** sitter under Dealers & klipp, `/control/clips?view=generate` (`lab/lib/studio-navigation.mjs:7`, `lab/docs/README.md:375-377`). Sidan är `lab/components/dealer-forge-page.tsx` (rubrik rad 172–173). API:t är `lab/app/api/forge/[[...path]]/route.ts:1-9` och kräver moln-Studio. Klienten är `lab/lib/runway-client.mjs:1-6` mot `https://api.dev.runwayml.com`. Nyckeln är `RUNWAY_API_KEY` (`runway-client.mjs:17-18`).

VILA laddas upp, normaliseras till 1080×1920 på grönt och genereras inte (`dealer-forge-page.tsx:187`, `dealer-forge-catalog.mjs:57` och `236`). REDO kan genereras från VILA. Matrisen har gruppen Repliker (`dealer-forge-catalog.mjs:48`). En talrad blir `kind: 'speech'` från VILA till VILA (`dealer-forge-catalog.mjs:78`).

Två lägen finns redan för tal (`dealer-forge-catalog.mjs:223-247`):

- `avatar`: Runway `gwm1_avatars`, VILA plus text eller ljud. Pris i koden: 2 krediter plus 2 per påbörjad 6-sekundersperiod. 1 kredit = 0,01 USD före skatt (`dealer-forge-catalog.mjs:34-41`).
- `keyframe`: WAN 3, första och sista bild, valfritt ljud. 10 krediter/s i 720p, 20 i 1080p.

Rösten i Forge är en Runway-förinställning, standard `clara` (`dealer-forge-catalog.mjs:29-31`), inte dealerns ElevenLabs- eller Cartesia-röst. Avatar skapas från VILA i `dealer-forge-service.mjs:404-407`. Färdigt MP4 hashas och registreras som granskningsklipp i rätt fack, roll `standard` eller `alternative`, grön nyckling (`dealer-forge-service.mjs:230-241`). Inget publiceras av sig självt (`lab/docs/README.md:377`).

Jobb journalförs före betalning. Samma `requestId` betalar inte igen (`dealer-forge-service.mjs:381-391`). Oklart svar blir `submit_unknown` och ska kopplas till task-ID i Runway, inte skickas om (`lab/docs/README.md:383`).

Lagring: `ops/neon-studio/008-dealer-forge.sql:5-34`, tabellerna `forge_dealers` och `forge_jobs`. `provider` får bara vara `runway` (rad 25). 008 är redan körd och låst som obligatorisk (`docs/CLOUD-MIGRATION.md:125-145`).

### Röst

| Källa | Vad den gör | Bevis |
| --- | --- | --- |
| ElevenLabs | Ett betalt anrop, PCM 24 kHz, ingen reservleverantör | `services/astrid-gpu-worker/gateway/elevenlabs-source.mjs:3-15` |
| Cartesia | Samma idé, `tts/bytes`, PCM 16-bit 24 kHz | `cartesia-source.mjs:4-10` |
| Röst per dealer | Studio sparar leverantör, `voiceId` och `modelId`. Aktivering kräver videobildruta, inte bara röst | `web/public/dealer-speech-profile.mjs:17` och `40`; fält i `lab/components/dealer-speech-settings.tsx:68-69` |
| Astrids chattröst | Cartesia Victoria, `sonic-3.5`, röst `dc30854e-e398-4579-9dc8-16f6cb2c19b9` | `web/public/astrid-voice-profile.mjs:3-9` |
| Äldre Astrid-paket | ElevenLabs `eleven_multilingual_v2`, röst `EXAVITQu4vr4xnSDxMaL` | `astrid-voice-profile.mjs:13-18` |
| Fristående röstprov | Cartesia, Astrids röst, avstängt i molnläge | `lab/lib/voice-preview.mjs:16-28` |
| Talgranskning i Studio | Läser registrerad engelsk bank och klippindex. Hash är identitet, inte godkänd synk. `productionApproved` är alltid falskt | `lab/lib/studio-voice-lines.mjs:29-73` |

Vera, Astrid, Amira och Mei är roster i `studio-voice-lines.mjs:8`. Bara Astrid har en hårdkodad genererad röst. Övriga röster ligger i respektive talprofil, om någon har fyllt i dem.

### GPU-worker och läppsynk

Workern är `services/astrid-gpu-worker/`. Modellen är **MuseTalk 1.5** (`Dockerfile:1-7`, `workers/lipsync_worker.py:1-9` och `62-63`). Den körs som RunPod Serverless (`handler.py:1-4`, `README.md:34-40`). CI-jobbet `lipsync-worker` (`.github/workflows/croupier.yml:143-164`) kör tester och syntax. Det startar inget betalt GPU-jobb (`README.md:16-17`).

In och ut:

- Stillbild: PNG, exakt 1080×1920 (`workers/dealer_avatar.py:14-18`).
- Ljud: WAV, 16-bit PCM, base64 (`handler.py:8`).
- Ut: MP4 i base64, bildrutor och tider (`handler.py:8` och `14`). 24 bilder/s (`lipsync_worker.py:35`).
- Munnen blandas in i videofilen. Utanför munnen ska rutorna vara samma bytes som stillbilden, och klippet ska börja och sluta i stillbilden (`Dockerfile:3-5`). Spelaren klistrar inte en mun ovanpå.

`op: lipsync` använder den avatar som redan är laddad. En ny stillbild kan bindas när motorn startas (`handler.py:26-38`, `dealer_avatar.py:17-18` och `65-72`). Det är bild plus ljud till video. Det är inte en färdig bankväg: livechattens paket är förhandsvisning, bara Astrid, och får inte ha status godkänd (`web/public/speech-package.mjs:74-87`, `test/speech-package-contract.mjs:72-79`).

Historiskt RunPod-underlag, inte en prisgaranti: endpoint `zsudl8tmzcmiv1`, RTX 4090, 1,10 USD/timme (`docs/CLOUD-MIGRATION.md:937-941`). Aktuell taxa, kallstart och lagringspris är inte låsta. Kallstart kan ta upp till 180 sekunder (`handler.py:46`).

### Fraser, paket och bank

Engelska standardtexter, 17 stycken, ligger i `web/public/speech-lines.mjs:3-19`: `greeting`, `placebets`, `goodluck`, `insurance`, `peek`, `blackjack`, `bust`, `dealerbust`, `win`, `lose`, `push`, `dealerblackjack`, `sidebet`, `chatter1`, `chatter2`, `farewell`, `double`. Exempel `goodluck`: ”Bets are closed. Good luck at my table!”.

Händelsekatalogen har fyra talhändelser (`lab/policies/studio-contract.json:214-254`):

- `speak.goodluck` → `goodluck`
- `speak.insurance` → `insurance`
- `speak.double` → `double`
- `speak.other` → de övriga 14, bland annat `greeting`, `blackjack` och `bust`

Fack byggs som händelse plus situation (`lab/lib/dealer-media-library.mjs:5-16`). Svenska visningsnamn, till exempel ”lycka till”, är bara etiketter (`lab/lib/clip-label.mjs:23-33`). De är inte repliktext.

De registrerade engelska bankerna skiljer sig från standardlistan och från varandra. Astrid, Amira och Mei har 17 nycklar. Astrids `goodluck` är ”Bets are closed. Good luck at my table.” Amira och Mei säger ”Bets are closed, good luck.” Veras indexbank har 23 andra rader (regler) och saknar de 17. Ingen `audio/sv`-bank finns.

Talpaketet (`web/public/speech-package.mjs:60-120`) är en hel tupel: exakt text, ljudhash, videohash, bildrutor, kalibrering, revision och granskning. Ändras en del faller hela paketet. Inspelad rad kräver läppsynkad video. Genererad text i version 1 kräver neutral video. Version 2 är läppsynkad förhandsvisning, bara `pending`, bara Astrid. Registret avvisar dubbletter (`speech-package.mjs:124-130`).

`speech-pose-gate` (`web/public/speech-pose-gate.mjs:1-10` och `66-68`) håller tal tills vilopositionen är visad. Den är inte en kö av klipp. Spelaren säger replik-id, till exempel `goodluck`, utan språk (`web/public/app.mjs:138-168`).

Forge lägger MP4 i medieregistret. Den skriver inte talpaket, inte engelsk bankfil och inte svensk bank.

### Regler som gäller

`AGENTS.md:62-65`:

- En taländring är ett set: exakt text, inspelat ljud, video, bildindex, kalibrering och acceptansanteckning. Ny ljud- eller videohash gör tidigare synk ogiltig.
- Provspelning med den riktiga spelaren, `?dealer=<namn>&rehearsal=1`, två uppspelningar i rad, alla fyra dealers vid media- eller spelarändring.
- Hash, vågform, test eller första munrörelse är inte godkännande. Inga klistrade munoverlays.

### Det som ska bort, senare

Offline-kedjan finns kvar: `pipeline/sync-existing.py`, `sync-audio-warp.py`, `auto-phrase-warp.py`, `measure-lipsync.py`, `measure-onset.py`, `retime-video-map.py`, `retime-video-warp.py`, `apply-lipsync.py`, `trim-speak-start.py` (`docs/LOCAL-PRESENTATION-RUNTIME.md:95-98`). `auto-phrase-warp.py:1-7` tidsmappar ljud mot mun. `apply-lipsync.py:1-6` stämplar `audioDelayMs`. Den här planen tar inte bort dem. De tas bort först när de nya klippen är mänskligt godkända och spelaren inte längre behöver den kedjan.

## 2. Föreslagen väg

Mål: för varje dealer, varje fras och varje språk (`sv`, `en`) finns högst ett väntande eller godkänt talklipp i banken. Klippet spelas av samma spelare som idag.

1. **Lås frasboken.** Exakt text per dealer, fras och språk. Engelska utgår från den registrerade banken där den finns, annars från `speech-lines.mjs`, och Jakob bekräftar vilken som gäller. Svenska finns inte och får inte hittas på. `speechTextFor` kan redan läsa språk om texten är ett objekt (`dealer-forge-catalog.mjs:273-278`), men listan är engelska strängar.
2. **Kräv underlag.** VILA-ankare med SHA-256, 1080×1920. Dealerns egen röst: leverantör, röst-id, modell. Saknas något genereras inget.
3. **Tala.** Ett betalt TTS-anrop med den exakta texten och dealerns röst. Spara WAV och dess hash. Inget andra försök om det första svaret är oklart.
4. **Läppsynka.** Rekommenderad motor: MuseTalk på RunPod, VILA-PNG plus WAV till MP4 i 24 bilder/s. Se tabellen nedan.
5. **Validera före registrering.** MP4-huvud, längd mot ljudet (samma storleksordning som paketets 1 sekund i `speech-package.mjs:87`), första och sista rutan nära VILA, par av ljudhash och videohash, språk, fras-id. Frysbild i mitten eller avvikande längd stoppar registrering.
6. **Registrera som väntande.** Mediepost i rätt talfack, som Forge redan gör för video (`dealer-forge-service.mjs:230-241`), plus ett talpaket version 1 med `recordedLine`, `reviewStatus: pending`. Inte chattens version 2: den kan inte godkännas och är låst till Astrid. Ljud och video är skilda poster. Inget blir standard i publicerat rum förrän en människa valt det.
7. **Kö och en gång.** Nyckel: miljö, dealer, fras, språk. Finns ett lyckat eller pågående jobb returneras det. Omgörning är en ny, namngiven beställning efter att den gamla markerats ersatt. Samma begäran-id betalar inte två gånger. ”Generera saknade” visar antal, text och tak och väntar på ja.
8. **Studio.** Knappen sitter på talraden under Skapa material, bredvid dagens Skapa, med språk SV/EN och status: saknas, köad, väntar på granskning, godkänd, fel. Omgörning är en egen knapp. Dagens Runway-knapp rörs inte i första etappen.
9. **Människa.** Provspelning `?dealer=<namn>&rehearsal=1`, två gånger i rad, anteckning per rad. Först därefter får paketet bli `approved` och väljas som standard. Spelaren väljer språk först när båda paketen finns. Tills dess fortsätter dagens engelska väg.

```
VILA + exakt text
    → TTS (dealerns röst)
    → MuseTalk (bild + wav → mp4)
    → hash, längd, frysbild
    → mediepost + talpaket pending
    → provspelning, två gånger
    → godkänd bank
```

### Alternativ

| | A. MuseTalk 1.5 + dealerns röst | B. Runway-avatar `gwm1` | C. WAN 3 + ljud |
| --- | --- | --- | --- |
| Vad | Stillbild och ljud blir MP4. Kroppen ska ligga kvar | Runway talar med förinställd röst, eller med uppladdat ljud | Bild till video, ljud kan bifogas. Ingen läppsynkmodell |
| Kvalitet | 7/10 för bank: mun i filen, vila i start och slut. Visuell synk är inte bevisad | 6/10: kan se levande ut, men ansikte, händer och pose kan glida | 4/10: rörelsen är påhittad |
| Kostnad per klipp | GPU enligt timpris. Historiskt 1,10 USD/h. Ett varmt kort klipp är sekunder. Kallstart kan bli minuter. TTS tillkommer. Taxan är inte låst | 5 s ≈ 4 krediter. Katalogen: 0,01 USD/kredit. UI visar samma siffra som ”kr” (`dealer-forge-page.tsx:264`) | 5 s i 720p = 50 krediter. 1080p = 100 |
| Tid | Varm: sekunder. Kall: upp till några minuter | Pollning var 5:e sekund, plus att avataren måste bli `READY` | Samma pollning |
| Integritet | Bild och ljud på egen RunPod. Texten går till Cartesia eller ElevenLabs | Bild och text eller ljud går till Runway. Rösten är deras, om inte eget ljud skickas med | Bild och ljud till Runway |
| Passar banken | 8/10. Samma spelare, egen röst, vila-lås | 5/10. Redan i Forge, men fel röst och svagare poselås | 3/10. Dyrt och inte läppsynk |
| Rekommendation | **Ja, för banken** | Behåll för övriga klipp (idle, givning) | Inte för talklipp |

136 klipp om alla fyra dealers, 17 fraser och två språk körs på en gång. Det ska inte ske. En pilot är en dealer, `goodluck`, svenska och engelska.

## 3. Datamodell och drift

**Migration: ja, ny och valfri.** Ändra inte `008`. `forge_jobs.provider` får bara vara `runway` (`008-dealer-forge.sql:25`). Nästa isolerade tabell följer trestegen i `docs/CLOUD-MIGRATION.md:125-138`: tolerant kod först, operatören kör migrationen efter deploy, en senare PR låser versionen. Förslag `009-talkclip.sql`: en rad per miljö, dealer, fras och språk, med status, begäran-id, text-hash, ljud-hash, video-hash, VILA-hash, röstprofil och `reviewStatus`. Unik nyckel är idempotensen.

Mediebytes ligger kvar i privat Blob. Neon håller journalen. Inget skrivs i den engelska bankfilen förrän klippet är godkänt.

**Nya hemligheter: nej.** Återanvänd `CARTESIA_API_KEY` eller `ELEVENLABS_API_KEY`, `RUNPOD_API_KEY` och `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` (`docs/ENVIRONMENT-VARIABLES.md:547-559`). `RUNWAY_API_KEY` behövs bara om Jakob väljer B eller C.

**Ny miljövariabel: ja, om banken ska ha eget tak.** Förslag: ett dags- eller batchtak skilt från chattens `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` (högst 10 USD i dag, `ENVIRONMENT-VARIABLES.md:556-559`). Då ska `docs/ENVIRONMENT-VARIABLES.md` och `docs/environment-variables.json` uppdateras i samma leverans, utan värden. Utan egen variabel kan en bankkörning äta chattbudgeten.

**Var det körs**

| Del | Plats |
| --- | --- |
| Knapp och status | Vercel, Studio `/control/clips?view=generate` |
| Journal | Studio-Neon |
| TTS och GPU-anrop | Render `croupier-v2`, som redan har röst och RunPod. Inte en kort Vercel-funktion (Forge-routen har 120 s, `route.ts:5`) |
| Modell | RunPod Serverless, befintlig MuseTalk-image |
| Filer | Privat Blob |
| Uppspelning | Delad spelare, provspelning på samma väg |

Inget jobb startar för att en VILA laddats upp. Inget jobb startar i CI.

## 4. Risker

| Risk | Får inte hända |
| --- | --- |
| Godkännande utan människa | Paket stannar `pending`. Hash, test och första mun bild är inte acceptans |
| Betalning utan ja | Knappen visar antal, text, språk och tak. Tyst kö vid sidladdning är förbjuden |
| Dubbel debitering | Oklart TTS- eller GPU-svar skickas inte igen. Samma nyckel returnerar samma jobb |
| Fel språk i spel | Spelaren byter inte språk förrän båda paketen är valda. Dagens engelska väg består |
| Chattpaket i banken | Version 2 förblir förhandsvisning. Banken är version 1, inspelad rad |
| Annan fras rörs | Omgörning av en rad regenererar inte de andra (`AGENTS.md:65`) |
| Pythonkedjan raderas för tidigt | Kvar tills nya klipp är godkända och spelaren inte läser den |
| Munoverlay i spelaren | Ut är en hel MP4. Spelaren spelar filen |
| Produktionsdatabas i prov | Isolerad databas, annat värdnamn |

Övrigt: MuseTalks synk på en ny VILA är inte sedd. RunPod-taxan kan ha ändrats sedan 1,10 USD/h. Cartesia-kontots taxa är inte läst, och Jakob saknar det externa kontots inloggning (`CLOUD-MIGRATION.md:934-936`). Skicka inte nya inloggningsförsök.

## 5. Uppskattning

| Etapp | Filer (senare, inte nu) | Risk | Jakob |
| --- | --- | --- | --- |
| 1. Lås texter SV/EN per dealer | `web/public/speech-lines.mjs` eller en syskonfil | 15 % | Skriver eller godkänner varje mening |
| 2. Kö, tak, knapp, ingen betalning | ny `009`, forge-UI, tester | 25 % | Kör valfri migration efter att koden är ute |
| 3. Pilot: en dealer, `goodluck`, SV+EN | Render-anrop mot befintlig TTS och RunPod | 40 % | Bekräftar röst, VILA, tak och att två anrop får gå |
| 4. Registrera pending paket | mediepost, talpaket v1, tester | 30 % | — |
| 5. Provspelning två gånger | inga nya filer om anteckningen redan finns | 35 % | Ser och säger ja eller gör om |
| 6. Övriga fraser, sedan övriga dealers | samma väg | 30 % | Nytt ja per batch |
| 7. Ta bort Python-kedjan | `pipeline/*.py` i listan ovan | 20 % | Först när banken bär spelet |

Hela vägen innan en godkänd bank: risk cirka 40 %, mest synk och taxa. Etapp 1–2 kan landa utan ett enda betalt anrop.

## 6. Beslut

| # | Fråga | Rekommendation |
| --- | --- | --- |
| 1 | Vilken motor gör talklippet? | **A. MuseTalk plus dealerns egen röst.** B och C stannar för andra klipp |
| 2 | Hur stor är första körningen? | **En dealer, `goodluck`, svenska och engelska**, efter att text, VILA, röst och tak är låsta. Inte 136 klipp |
| 3 | Vem låser de svenska meningarna? | **Jakob, innan någon betalning.** Engelska banktexter bekräftas i samma lista, eftersom de redan skiljer sig mellan dealers |

## Tveksamt

- UI räknar Runway-krediter som ”kr” (`dealer-forge-page.tsx:264`) medan katalogen säger 0,01 USD per kredit. Vilken siffra som ska visas för Jakob är inte avgjord.
- MuseTalk blandar munnen inne i MP4-filen. Det är den befintliga workern, inte en mun som spelaren ritar. Om det ändå räknas som förbjuden munoverlay faller alternativ A.
- Talprofilens referensbild och VILA kan vara två olika bilder. Planen använder VILA. Ett klipp från VILA kan skära sig mot en grundloop från en annan bild.
- `speak.other` samlar 14 fraser i en händelse. Språk finns inte på medieposten idag. Unik nyckel dealer+fras+språk behöver den nya tabellen, annars kan svensk och engelsk rad krocka i samma fack.
- Veras bank saknar de 17 fraserna. Hon kan inte ingå i piloten förrän hennes texter och röst finns.
- Spelaren har inget språkval för repliker (`app.mjs:138-168`). Svenska klipp spelas inte av sig själva.
