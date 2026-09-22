# Studio, JSON och lagring

[Till systemkartan](../README.md) · [Nästa: OpenClaw och drift](../05-openclaw-rost-och-drift/README.md)

**Projektet sparar val och referenser. Schemat beskriver deras tillåtna form.
Medierna ligger separat.** Ett begripligt träd behöver inte bli nya diskmappar.

```text
lab/
├── policies/project.seed.json    startdata
├── policies/studio-contract.json fasta grupper och situationer
├── schemas/                     läsbara formatkontrakt
├── animations/                  64 eventrörelser + separat social rörelse
└── data/                        lokalt, Git-ignorerat
    ├── project.json + history/   sparat policyprojekt och revisioner
    ├── videos/                  uppladdningar, index och classifications.json
    ├── social-policy.json       eget socialt kontrakt
    ├── social-history/          tidigare sociala policyversioner
    ├── voice-cache/             panelens MP3 och exakt text/röst/hash
    └── voice-previews/          äldre fristående CLI-prov
```

Startprojektet `studio.2026-09-20.2` har fyra dealers, sexton noder, nio
triggers, 64 dealerlinjer, 256 varianter och 64 assets. Alla startvarianters
`videoGenerationId` är `null`. Ett sparat användarprojekt kan vara äldre
eller redigerat och ska inte ersättas av seed.

En dealerlinje är dealer + eventnod + standard/alternativ. Den är inte
talrepliken `speak.line`. En variant pekar på en animation och högst ett
video-ID; fältet heter fortfarande `videoGenerationId` även för uppladdningar.
`selection.rules/model/random` styr vilka automatiska urval som får använda
ett alternativ. Triggers ger ytterligare villkor.

## Vad sparas när?

Videointake sparar MP4/WebM och metadata i den lokala banken. Att koppla en
film ändrar projektutkastet; **Spara projekt** gör kopplingen beständig.
Befintliga original kategoriseras via en separat hashbunden metadatafil;
originalbytes flyttas eller ändras inte. Den nuvarande previewpolicyn är
`once`; generell loopredigering finns inte.

Projektlagringen använder revision, historik och atomiskt skrivande.
Social policy och ljudcache är separata från `project.json`. Inga av dessa
lokala filer innebär automatiskt en driftsättning eller produktbindning.

Generationsoriginalen ligger även utanför repot, i
`C:/Users/jakem/CroupierAssets/bettalotto-generations`. Detta är labbets
befintliga lokala arkivförval; `LAB_VIDEO_ARCHIVE` kan ange annan plats.
224/224 snapshot-ID:n och filstorlekar matchade i metadata-inventeringen
22 september. Inventeringen är inte en ny byte-/hash- eller visuell granskning.
Behåll filmbytes där; media behöver inte kopieras in i Git eller inkluderas
i semantisk repoindexering för att kunna spelas via en explicit lokal koppling.
Mappen ska inte blandas ihop med det pensionerade personarkivet eller antas
vara Jakobs tidigare nämnda slaskmapp utan separat belägg.

Produktserverns valfria `CROUPIER_GENERATIONS_DIR` väljer läskatalog för BO
och Generations-API, med `web/public/bo/gen` som oförändrat standardläge.
Labbets `LAB_VIDEO_ARCHIVE` har separat ansvar. Den isolerade startarens
`--media-directory` sätter båda till samma befintliga mapp i processerna;
den skriver inte `.env`, kopierar inte filmer och raderar inte arkivet vid
avslut. Varken variabeln eller flaggan är en ny uppladdning eller en automatisk
Git-synk av video. Katalog-ID, filnamn, auth och realpath kontrolleras vid läsning.

## Vem läser vad?

- [Studio-modellen](../../../../lab/lib/studio-model.mjs) kontrollerar
  referenser och omvandlar projektet till katalog för vald dealer.
- [Studio-servern](../../../../lab/lib/studio-server.mjs) testar nodens
  `exampleEvent` med manuella kontextvärden och avgränsat urvalsläge.
- [Projektlagringen](../../../../lab/lib/project-store.mjs) ansvarar för
  sparning. [Videoregistret](../../../../lab/lib/video-registry.mjs),
  [intake](../../../../lab/lib/video-intake.mjs) och
  [klassificering](../../../../lab/lib/video-classifications.mjs) hanterar
  mediereferenser och deras kategorisering.

Den äldre [Director-katalogen](../../../../open-claw/lab/config/catalog.json)
har separat lagring. Studion skickar en tillfällig katalog per projekt/dealer
för råd; den skriver inte över Directors sparade katalog.

**Förslag:** dela vid behov register efter ansvar, med samlad validering och
säker sparmodell. En fil per variant behövs inte. ID-referenser kan redan
visa samma trigger eller take på flera ställen i en logisk vy.

Använd [Guide i labbet](http://127.0.0.1:4188/guide).
Teknisk fördjupning finns i [lab/README](../../../../lab/README.md),
[policyerna](../../../../lab/policies/README.md),
[videobanken](../../../../lab/VIDEO-LIBRARY.md) och
[eventregistret](../../2026-09-20-eventregister-och-mental-modell.md).
