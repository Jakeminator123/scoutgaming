# Studio, JSON och lagring

[Till systemkartan](../README.md) · [Nästa: OpenClaw och drift](../05-openclaw-rost-och-drift/README.md)

**Projektet sparar val och referenser. Schemat beskriver deras tillåtna form.
Medierna ligger separat.** Ett begripligt träd behöver inte bli nya diskmappar.

```text
lab/
├── policies/project.seed.json    startdata
├── policies/studio-contract.json fasta grupper och situationer
├── policies/idle-policy.seed.json basvikter och idlebehörigheter
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

För Astrids manifestägda familjer skapar studion i stället en tillfällig vy av
exakt mottagen box/replik. Manifest v2 i `emil/dealklipp-v1` har 31 filer och
26 familjer. `mediaPolicy` tillåter högst fyra varianter per deal-/replikfamilj;
tom `variant/` ger standard. `idlePolicy` äger två basloopars vikter och de
fyra idlevarianternas användning: manuell, automatisk, regelstyrd eller
OpenClaw-valbar. De två policyerna ska inte konkurrera om idle.

## Vad sparas när?

Videointake sparar MP4/WebM och metadata i den lokala banken. Att koppla en
film ändrar projektutkastet; **Spara projekt** gör kopplingen beständig.
Befintliga original kategoriseras via en separat hashbunden metadatafil;
originalbytes flyttas eller ändras inte. Den nuvarande previewpolicyn är
`once`; generell loopredigering finns inte.

Projektlagringen använder revision, historik och atomiskt skrivande.
Social policy och ljudcache är separata från `project.json`. Inga av dessa
lokala filer innebär automatiskt en driftsättning eller produktbindning.

Den aktuella standardkällan för Astrids nya familjer är den versionshanterade
`emil/dealklipp-v1/`; inga MP4 kopieras till `lab/data/`. `LAB_VIDEO_ARCHIVE`
kan endast ersätta roten med en annan katalog som har samma manifeststruktur.
Det tidigare externa generationsarkivet är inte längre standard efter att dess
MP4-filer flyttades till papperskorgen den 25 september. Produktens separata
`CROUPIER_GENERATIONS_DIR` och BO-katalog har ett annat ansvar.

Idleeditorns planerade minut är deterministisk utifrån seed, vikter, intervall,
jitter, cooldown och maxfrekvens. **Grundvikt är inte faktisk tidsandel**:
engångsvariationernas klipptid minskar baslooparnas andel. Det lokala
minutprovet spelar filerna, loggar start/slut och återgår till bas, men är inte
bevis på produktens live-scheduler eller en godkänd poseövergång.

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
[eventregistret](../02-events-triggers-urval/EVENTREGISTER.md).
