# Blob och Neon: mediestruktur och avstämning

Detta är den aktuella referensen för fysisk Blobstruktur och kopplingen till
Neons mediaregister. Produkttermer kommer från [TERMINOLOGI](../../lab/docs/TERMINOLOGI.md);
uppspelning och format beskrivs i [LOCAL-PRESENTATION-RUNTIME](../LOCAL-PRESENTATION-RUNTIME.md).
Den fullständiga filförteckningen finns i [inventeringen](BLOB-NEON-INVENTERING-2026-10-16.md).

## Verifierat underlag, 16 oktober 2026

- Blob: privat `croupier-media-private`, `store_AqwvebTbBHarOjvG`, team `scoutgaming`, region `arn1`.
- Full SDK-listning med två sidor: **1710 objekt, 904081512 byte (904,08 MB)**.
  Första listningen 2026-10-16 16:37:50; oförändrad vid omläsning 2026-10-16 16:44:26.
  Dashboardens tidigare räknare 1 711 används inte som inventeringsantal.
- Neon: `croupier-production` / `wandering-hill-60561912`, aktiv branch
  `main` / `br-flat-fog-b161a6r8`. Alla sex tillgängliga databaser på denna branch lästes.
  Varje anslutning verifierade rätt databas och `transaction_read_only=on` i en
  `REPEATABLE READ READ ONLY`-transaktion som avslutades med `ROLLBACK`.
- Alla inventerade databastabeller var oförändrade vid omläsning 2026-10-16 16:46:23.
  SQL och Blob har ingen gemensam atomisk snapshot; stabilitetskontrollerna avgränsar observationen.
- Källkod/katalog: checkout `d064dce232caa9a8c7423fb23b33ca910488f5ae`.
  Relevanta mediefiler är oförändrade mot kontrollerad remote main
  `4fa35ab9db90682fcad50e6de84940a28a74621f`.
- Inga molnobjekt, databasrader, behörigheter, miljövariabler eller publiceringar ändrades.
  Endast lokal dokumentation och privat granskningsunderlag skrevs.

## Fysisk struktur

Följande mappar är verifierade med den fullständiga Blob-listningen:

```text
croupier/
├── media/
│   ├── dealers/
│   │   ├── anna-jonsson/
│   │   ├── astrid/
│   │   ├── dragan/
│   │   ├── mei/
│   │   ├── paow-kevin/
│   │   └── vera/
│   ├── backgrounds/
│   ├── tables/
│   ├── game/
│   └── site/
└── reply-library/
    └── <scope-hash>/
        ├── paow/
        └── paow-v2/
```

`paow`, `paow-v2` och `paow-kevin` är skilda sparade dealer-ID:n. De får inte
slås ihop utifrån namnet. Jakob finns som dealer i produktionens projekt men
har ingen videofil i det inventerade lagret.

Den generella namnmodellen i koden är:

```text
croupier/media/dealers/<dealer-id>/
├── source/<ursprung>/<objekt-id>/<sha256>.<format>
├── runtime/<bank-eller-format>/<objekt-id>/<sha256>.<format>
├── review/uploads/<video-UUID>/<sha256>.mp4|webm
└── staging/<arbetssteg>/<objekt-id>/<sha256>.<format>

croupier/media/backgrounds/<lager-UUID>/<sha256>.<format>
croupier/media/tables/<lager-UUID>/<sha256>.<format>

croupier/reply-library/<scope-hash>/<dealer-id>/<replik-UUID>.json
croupier/media/dealers/<dealer-id>/runtime/conversation-replies/
    <scope-hash>/<replik-UUID>/<sha256>.mp4|wav
```

Alla dealers har inte alla undermappar. Nya klipp för Anna, Dragan och PAOW
ligger i `review/uploads`. Astrid har både uppladdningar, presentationsbank,
`retained-bank`, äldre runtimefiler, källmaterial och staging.
Mei och Vera har äldre runtimefiler. `review/uploads` är en lagringsplats;
namnet är inte en granskningsstatus. Val och publicering flyttar inte filen
till `runtime`.

## Sambandet mellan avatar, klipp och användning

```text
Dealer i sparat Studio-projekt
    └── dealerId
        └── Klippregister
            ├── Neon: media_records (nya och retained-bank-klipp)
            └── Repo: presentationskatalog + blob-index (äldre gemensam bank)
                └── video-ID + exakt Blob-sökväg + SHA256 + storlek
                    └── händelse / situation / replik / tagning
                        └── projektets videoGenerationId / videoId
                            └── valda standarder, alternativ och publicerade paket
```

Neons `croupier_studio.media_records` lagrar poster per
`environment_id + workspace_id + id`. Posten innehåller Blob-sökväg,
filhash, storlek och klassificering såsom `dealerId`, `eventId`,
`situation`, `label` och eventuell `familyId`.
Projektets sparade bindningar avgör klippets användning; `dealerSets`
är bara biblioteksorganisation. Filnamn och mappar ersätter inte dessa bindningar.

`media/blob-index.json` innehåller 1027 logiska referenser till
995 unika blobobjekt. Skillnaden 32 är extra referenser/alias till
samma objekt, inte 32 fysiska filkopior. Alla indexets objekt finns i lagret.
Indexet är inte en fullständig lista över nya Neon-uppladdningar eller kvarvarande äldre Blobobjekt.

Replikbibliotekets JSON-poster ligger själva i Blob, inte i `media_records`.
`scope-hash` är SHA256 av JSON-arrayen `[environment, workspaceId]`.
Varje sådan post pekar på ett exakt ljud-/videopar. Texten i replikerna ingår
inte i denna dokumentation eller filförteckning.

## Antal klipp per avatar

| Dealer-ID | Videofiler i Blob | Klipp i Neon prod | Äldre presentationsbank | Explicit prodreferens | Neonklipp utan explicit prodreferens | Videor utan hittad referens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| anna-jonsson | 2 | 2 | 0 | 2 | 0 | 0 |
| astrid | 208 | 10 | 51 | 20 | 2 | 77 |
| dragan | 56 | 56 | 0 | 39 | 17 | 0 |
| jakob | 0 | 0 | 0 | 0 | 0 | 0 |
| mei | 16 | 0 | 0 | 0 | 0 | 14 |
| paow-kevin | 11 | 11 | 0 | 0 | 11 | 0 |
| vera | 35 | 0 | 0 | 0 | 0 | 33 |

Totalt finns **328 dealervideofiler** i Blob och **79 klipposter** i produktionens
Neon-register. Den äldre presentationsbanken tillför **51 Astrid-klipp**;
den ska inte räknas som saknade Neon-rader. Övriga videofiler kan exempelvis
vara äldre indexerade filmer, kompositversioner eller pilotmaterial.
Filantal avser MP4/WebM/MOV/MKV, inte ljud, H264-strömmar, index eller bilder.

”Explicit prodreferens” betyder en exakt identifierad referens i aktuella
projekt-/paket-/speldata. Det bevisar inte genomförd uppspelning och räknar
inte automatiska standardval i äldre familjer som uttryckliga projektval.
Kolumnerna överlappar och ska inte summeras till Blobantalet.

## Filer som saknas

**Inga av de 79 produktionsklippen eller de sex QA-registerposterna saknar
sin blobfil.** QA-posterna refererar till sex befintliga Astrid-filer i
`runtime/retained-bank`, vilka också är registrerade i produktion.
Alla jämförda filstorlekar stämmer. Inga olösta `videoId`/`videoGenerationId`
hittades i de genomlästa dokumenten.

**12 äldre replikposter saknar däremot båda sina mediafiler: 12 MP4 + 12 WAV.**
Tre poster hör till `paow`, nio till `paow-v2`. Samtliga 24 sökvägar gav
not-found även vid separat privat GET-kontroll 2026-10-16 16:45:02.
Själva JSON-posterna finns kvar och har `reviewStatus=pending`.
Detta gäller de äldre ID:na, inte `paow-kevin`: dess elva klipp finns.
Exakta sökvägar och replik-ID:n finns i inventeringens avsnitt ”Saknade filer”.

## Dubbletter

Fem grupper omfattar tolv fysiska objekt med identiskt innehåll inom respektive grupp.
Alla tolv lästes och SHA256-beräknades på nytt; byteantal och hash matchar.

| Grupp | Kopior | Extra byte jämfört med en kopia |
| --- | ---: | ---: |
| Astrid: kortflipp_kling_1080p.mp4 | 2 | 8 697 170 |
| Dragan: deal_pos4 | 2 | 1 035 146 |
| Dragan: idle | 2 | 4 284 756 |
| Bakgrund, hash 1e03fe5e… | 2 | 3 634 186 |
| Bakgrund, hash 934407a5… | 4 | 13 522 566 |

Summan är sju extra kopior, 31,17 MB.
Detta är en innehållsjämförelse, inte en rekommendation att slå ihop deras
identiteter. Distinkta UUID:n kan ha skilda referenser och historik.
Övriga objekts innehåll har inte laddats ned och hashberäknats på nytt;
dubblettsökningen utgår från de innehållshashar som ingår i objektens sökvägar.

## Filer utan hittad användning

Två olika resultat ska hållas isär:

1. **30 registrerade produktionsklipp saknar explicit prodreferens:** Astrid 2,
   Dragan 17 och PAOW 11. De finns i biblioteket och är inte föräldralösa blobfiler.
   Inga referenser till dessa 30 hittades heller i genomläst dokumenthistorik.
   Inventeringen listar varje klipp med namn, händelse, situation och UUID.
2. **602 befintliga blobobjekt, 408,81 MB, saknar referens i de
   genomlästa Neon-källorna, det aktuella blob-indexet och replikmetadata.**
   Av dem är 124 videor. Gruppen innehåller även stöd- och originalfiler.

| Prefix | Objekt | Videor | MB |
| --- | ---: | ---: | ---: |
| `croupier/media/dealers/astrid/runtime/assets/` | 1 | 0 | 40,38 |
| `croupier/media/dealers/astrid/runtime/composited/` | 35 | 0 | 4,31 |
| `croupier/media/dealers/astrid/runtime/indexed/` | 249 | 76 | 223,53 |
| `croupier/media/dealers/astrid/source/3d/` | 23 | 0 | 24,12 |
| `croupier/media/dealers/astrid/source/background-zones/` | 1 | 1 | 0,07 |
| `croupier/media/dealers/mei/runtime/indexed/` | 102 | 14 | 38,72 |
| `croupier/media/dealers/vera/runtime/indexed/` | 178 | 33 | 50,76 |
| `croupier/media/game/runtime/assets/` | 7 | 0 | 25,58 |
| `croupier/media/game/source/3d/` | 5 | 0 | 0,02 |
| `croupier/media/tables/` | 1 | 0 | 1,33 |

”Ingen hittad referens” är en avgränsad granskningsklass, inte bevis för att
filen aldrig används eller får raderas. Källmaterial kan vara avsiktligt
bevarat. Den arkiverade Neon-branchen `codex-zone-storage-qa`
(`br-soft-base-b1z5814s`) återstartades inte och dess data ingår inte.
Externa konsumenter, lokala privata arbetskopior, återställningspunkter och
faktisk trafik är inte inventerade. Inga raderingsbeslut följer av rapporten.

## Databastäckning och metod

| Databas på main | Mediaposter | Dokument | Historikrader | Operatörspaket |
| --- | ---: | ---: | ---: | ---: |
| croupier_game | 79 | 3 | 183 | 6 |
| croupier_game_qa | 0 | 0 | 0 | 0 |
| croupier_game_restore_check | 0 | 0 | 0 | 0 |
| croupier_studio_qa_abc92154cb15 | 6 | 3 | 25 | 0 |
| neondb | 0 | 0 | 0 | 0 |
| postgres | 0 | 0 | 0 | 0 |

Alla rader lästes, utan LIMIT-trunkering, i förekommande mediaregister,
aktuella dokument, dokumenthistorik, operatörspaket, brandingutkast,
Forge-profiler/-jobb, speech_requests, operatörsauditens referensfält,
native_presentations och sparade blackjack-/roulettillstånd samt det äldre
zonregistret. Ägarnas personuppgifter, hemligheter, spelinnehåll och repliktext
exporterades inte; endast relevanta medieidentiteter/referenser sammanställdes.
Det nuvarande repo-indexet och presentationskatalogens 51 ID:n matchades också.
Arkiverad branch och privata/externaliserade källor avgränsas ovan.

Filer matchades på exakt sökväg och video-ID, inte på ungefärligt namn eller
längd. Metadata jämfördes mot Blob-listningens storlek. Tolv misstänkta
dubbletter verifierades med full hash-läsning och 24 saknade filer med GET.
Stabilitetskontrollen jämförde filernas sökväg/storlek/uppladdningstid och
SHA256-fingeravtryck av varje genomläst tabells rader, oberoende av radordning.

## Kodkällor

- [Blob-sökvägar och oföränderliga filer](../../lab/lib/cloud-media-store.mjs)
- [Uppladdning och videoregistrering](../../lab/lib/studio-upload-service.mjs)
- [Neons videoregister](../../lab/lib/neon-video-registry.mjs)
- [Databasens register, dokument och historik](../../web/storage/studio-repository.mjs)
- [Klippens klassificering och användning](../../lab/lib/dealer-media-library.mjs)
- [Replikmetadata och ljud-/videopar](../../web/speech-reply-library.mjs)
- [Äldre bankens blob-index](../../media/blob-index.json)
