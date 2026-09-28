# Astrid: kamera, tal och granskning

28 september 2026. **Bild och ljud är Av som standard. Servertranskription är
implementerad och leverantörsprovet godkänt; syntetiska Chrome-prov passerar.
Bildtolkning genom Director/OpenClaw har nu passerat med syntetisk JPEG.
Fysisk inspelning och kontroll av faktisk bildlagring återstår.**
Aktuell källa för uppdraget är [agentprompten](ASTRID-CAMERA-AGENT-PROMPT.md).
Designunderlaget finns i [kameraplanen](../../open-claw/lab/docs/ASTRID-CAMERA-VOICE-PLAN.md).

## Aktivering för det godkända provet

Jakob har godkänt driftsättning och generalrepetition. Ett syntetiskt
bildprov genom produktens `openClawChat` och befintlig Director/Gateway gav
korrekt svar 28 september: blå cirkel till vänster, röd kvadrat till höger.
Luna begärdes uttryckligen; svarstid 1 875 ms, JPEG 5 764 byte. Ingen kamera,
spelardatabas, röstgenerering eller privat bild användes. Den faktiska
modellidentifieraren i Gateway och bildens lagring kunde inte läsas eftersom
Codex fortfarande nekas Render av en sparad webbplatsbehörighet.

1. Vid en ny installation på Render: driftsätt aktuell `jakeminator123/work` för både
   `croupier-lab-openclaw` (Gateway) och `croupier-lab-director`. Gateway ska
   ha `CROUPIER_SPEECH_VISION=1`. Behåll befintlig version, modellnycklar och
   verktygsgränser. Verifiera först en syntetisk bild och dess lagring enligt
   checklistan nedan. Den befintliga bildvägen har redan klarat bildprovet
   ovan; ingen ny deployment gjordes för att åtgärda den lokala knappen.
2. Avsluta det befintliga lokala serverparet via dess startfönster när handen
   är avslutad. Från reporoten: `node lissabon/start.mjs --astrid-camera --no-open`.
   Använd QA-launcherns `astridCamera: true` när det isolerade provparet ska
   köras. Ett andra startkommando ändrar inte flaggan i en redan körande server.
3. Lissabon → Probe: välj **GPT-6 Luna** och spara. Öppna Astrid via **Ström →
   Anslut**, med `presentation=local`. Ladda om befintlig spelflik.
   Med en annan modell fungerar mikrofon/transkription separat; knappen
   heter då **Starta mikrofon** och inga kamerabilder tas.
4. I spelfliken: **Bild och ljud · Av → Starta kamera och mikrofon**, godkänn enheterna,
   tala och granska text/bilder. **Skicka till Astrid** skickar just den turen.
   Funktionen delar stillbilder och transkriberat tal, inte kontinuerlig video
   eller rått mikrofonljud till OpenClaw. Bilder kan finnas i OpenClaws historik.

Codex webbplatsbehörighet och Chromes kamera-/mikrofonbehörighet är separata.
Den första behövs bara för agentens browserkontroll; den andra behövs för
själva produktfunktionen.

### Varför knappen kunde vara låst

Den 28 september körde Jakobs aktuella Chrome-flik åter vanliga Lissabon
på 127.0.0.1:4200/4201. Luna var sparad, men startprocessen saknade
`--astrid-camera`. Den gamla gemensamma feltexten skilde inte detta från
saknad Cartesia-konfiguration eller annat modellval. Tidigare fungerande
QA-start på localhost:4210/4211 hade inte aktiverat denna separata start.

Servern rapporterar nu funktion, transkription och bildkapacitet var för sig.
Klienten visar den konkreta orsaken och läser om inställningar när panelen
öppnas utan att ändra aktiv inspelning eller granskning. Tal fungerar även
med Terra; bildkontraktet kräver fortsatt Luna. Inga modellval ändrades.

## Produktflöde

I Astrids riktiga Lissabon-spelare (`?dealer=astrid&presentation=local`) finns
**Bild och ljud · Av**. Starta begär kamera och mikrofon. Välj Svenska eller English
för det egna talet. Förhandsbild, mikrofonnivå och Stoppa visas under upptagning.
Ingen behörighet begärs när sidan öppnas, och Probe kan inte starta enheterna.

AudioWorklet spelar in samma mikrofonspår som nivåmätaren använder, i minnet
som mono PCM16/WAV. Web Speech/SpeechRecognition används inte längre.
En lokal nivådetektor med brusgolv och 180 ms in-/utträdeskrav avgör
ljudaktivitet; den kan inte säkert skilja tal från exempelvis bakgrundsmusik.
Efter cirka tre sekunders ackumulerad aktivitet tas en mellanbild. 650 ms
tystnad efter detektorns utslag, Stoppa eller 30-sekunderstimeout avslutar
upptagningen. Kort tal ger bara slutbild, tystnad inga bilder, högst två tas.

Enheterna stängs **före** transkriptionen. Inspelningen skickas till den
autentiserade `/api/astrid/transcription`, som validerar faktiskt WAV-format,
längd, bytegräns, origin, Astrid, profil samt sessions-/rundrevisioner. Gränsen
är 30 sekunder, mono PCM16, högst 48 kHz (2 880 044 byte); browsern begär 16 kHz.
Servern använder befintlig `CARTESIA_API_KEY` för
[Cartesia batch STT](https://docs.cartesia.ai/api-reference/stt/transcribe),
`ink-whisper`, API-version `2026-08-14`, med `sv` eller `en`. Den nyare
[Ink 2](https://docs.cartesia.ai/build-with-cartesia/stt/latest) anger inte
svenskt stöd och används därför inte här. Inga automatiska återförsök sker.

Appen skriver inte råljudet till filer, databas, chatt eller loggar. PCM-buffrar
nollställs vid avslut; leverantören behandlar ljudet. Ett tomt transkript tar
bort kandidatbilderna. Vid nätfel går det att skriva egen text till bilderna
eller kassera och spela in igen. Ingen ny inspelning sker automatiskt.

Texten är redigerbar och bilderna visas före **Skicka till Astrid**.
Kassera tar bort oskickat material ur fliken. Byte av profil/bord, utloggning,
dold flik, navigation, stängd panel, enhetsfel och sena tillstånd avslutar
samtliga tracks. En gammal preview-promise kan inte stoppa en ny upptagning.
Probe väntar också under granskningen. Astrids befintliga språkpolicy för
svar gäller fortfarande; talets språk styr bara transkriptionen.

## Befintlig kedja och gränser

Web → autentiserad backend → Director → privat Gateway → `croupier-speech`.
Ingen andra spelare, minnesmotor eller ny verktygsbehörighet. Den separata
transkriptionsvägen är Web → autentiserad produktbackend → Cartesia; råljudet
går inte till Director eller OpenClaw.

- Endast Astrid via Lissabon. Modellvalet är fortfarande redigerbart; bilder
  kräver GPT-6 Luna. Övriga modeller fortsätter fungera för vanlig textchatt.
- `observation`: exakt version 1, turnId, consentTurnId, profileRevision och
  1–2 images. Samtycke binds till aktuellt request-ID. Web kontrollerar samma
  origin, autentiserad profil och befintliga sessions-/rundrevisioner.
- Bara JPEG-data-URL:er, högst 384 px, 64 KiB per bild och 128 KiB totalt.
  Web och Director kontrollerar base64, formatmarkörer, tabeller och dimensioner.
  Detta är en strukturell JPEG-validering, inte en full pixelavkodare.
- Bilder följer endast aktuella användarmeddelandets `image_url`-delar.
  Spelarminnet och vanliga requestloggar får inga råbilder eller råljud.
  Serverns kort, saldo och resultat har företräde över bildobservationer.
- Director behåller sin deduplicering: samma request ger samma resultat;
  ändrade bilder under samma ID avvisas. Cachen innehåller digest och svar.
- Standard är Av. Web kräver `CROUPIER_ASTRID_CAMERA=1` och rätt stream lane.
  Gatewayns separata `CROUPIER_SPEECH_VISION=1` lägger till bildmetadata för
  Luna utan att ändra agenternas primärmodell, fallbacks eller verktygsgräns.

Den samordnade launchern har `astridCamera: true` som uttryckligt opt-in,
och `lissabon/start.mjs` erbjuder `--astrid-camera`. Flaggan går endast till
Lissabons produktprocess och använder samma sessionsspärr som övriga starter.
Ärvda miljövariabler aktiverar inte kameran; labbprocessen får ingen kameraflagga.
En redan körande session ändras inte av ett nytt startkommando.
Transkriptionen behöver den redan konfigurerade Cartesia-nyckeln i
produktprocessen. Den samordnade launchern vidarebefordrar den vid
`generatedSpeech: true`; inga nya miljövariabler eller Renderändringar
behövs för transkriptionsfixen. Utan nyckeln begär panelen inga enheter.

Kod: [kamerakontroll](../../web/public/astrid-camera-control.mjs),
[ljudinspelare](../../web/public/astrid-camera-audio.mjs),
[transkriptionsbackend](../../web/astrid-transcription.mjs),
[VAD/bildsession](../../web/public/astrid-camera-session.mjs),
[gemensamt bildkontrakt](../../open-claw/lab/src/astrid-observation.mjs),
[Director](../../open-claw/lab/src/product-speech.mjs).

## Historisk drift- och lagringskontroll före bilddeploy

Läsande kontroll i Gateway-containern bekräftade **OpenClaw 2026.9.5**.
Gateway kör fortfarande `70ef43f`; Director kör minnesfixen `e6ea969`.
Lunas faktiska metadata var `input: [text]`. `croupier-speech` har
`deny: [*]`, elevated=false och memory.search.enabled=false.
Ingen konfiguration, miljövariabel eller driftsättning ändrades vid kontrollen.

Rollens beständiga databas finns på
`/data/openclaw/agents/croupier-speech/agent/openclaw-agent.sqlite`.
Endast filmetadata och tabellnamn lästes, inga spelarsamtal. Den låsta
[sessionsreferensen](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/concepts/session.md)
anger SQLite för aktuella sessioner/transkript. Standardunderhåll arkiverar
vanliga beständiga sessioner efter 30 dagar; detta garanterar inte fysisk
radering. Ingen särskild session-/logging-/diagnostics-policy var konfigurerad.
Avstängd minnessökning och ett nytt sessions-ID innebär alltså inte lagringsfrihet.
Exakt lagring av en bildturn återstår att mäta med en syntetisk bild efter deploy.

Den nya transkriptionsvägen behandlar ljud hos Cartesia; browserns externa
taligenkänning används inte.
OpenClaw och modellleverantören behandlar skickad text/bild. Ingen verifierad
nollagring eller särskild leverantörsretention utlovas. Granskningsvyn säger
uttryckligen att skickat material kan sparas i OpenClaws samtalshistorik.
Ingen verklig kamera används före syntetiskt driftprov och lagringskontroll.

Den låsta [HTTP-källan](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/gateway/openai-http.ts)
tar `image_url` och har inte något verifierat `store: false`-fält i sitt
requestschema. Externa bild-URL:er är av som standard; vårt kontrakt avvisar
dem dessutom alltid. [Lunas modellreferens](https://developers.openai.com/api/docs/models/gpt-6-luna)
anger bildinput. Det bevisar inte att den ännu odriftsatta Croupier-kedjan fungerar.

## Utförd verifiering

### Servertranskriptionsfixen

- `node --test test/astrid-camera.mjs test/astrid-camera-control.mjs
  test/astrid-camera-audio.mjs test/astrid-transcription.mjs`: **32/32 godkända**.
  Täcker tystnad, kort/lång aktivitet, inspelningsgräns, enhetsstopp före upload,
  manuell sändning, avbrott/sena svar, WAV-validering, origin/profil/runda,
  samtidighet, deduplicering, storleksgränser och redigerade leverantörsfel.
- Ett riktigt Cartesia-prov godkänt med just den befintliga
  `web/public/dealers/astrid/audio/en/goodluck.mp3`, efter Jakobs uttryckliga
  tillstånd till den filen och mottagaren: **HTTP 200, 472 ms**, 2 030 ms ljud,
  `ink-whisper`, exakt **“Bets are closed. Good luck at my table.”**
  Samma nya backendadapter användes med syntetiskt request-/profilkontext,
  utan HTTP-server, mikrofon, Render, ljudfiler på disk eller medieförändringar.
- Första nätprovet stoppades av sandboxens `EACCES`. Automatisk
  godkännandegranskning avvisade därefter filuppladdningen utan uttryckligt
  payload-/mottagargodkännande; inget kringgående gjordes. Efter Jakobs JA
  godkändes det avgränsade provet ovan.
- Browser-fixturen är uppdaterad för riktig AudioWorklet och syntetisk ton,
  med ersatt STT-svar samt separat lokal inspelning av den befintliga repliken.
  **Fixturen har nu körts i Chrome 154:** tystnad 0 JPEG, kort tal 1, långt
  tal 2 och tal med kort paus 2. Alla fall passerade inklusive enhetsstopp
  före simulerat transkriptionsanrop och manuell granskning. Den befintliga
  repliken gav 71 468 WAV-byte och 18 aktivitetsprov via riktig AudioWorklet.
  Den riktiga mikrofonen och IAB-inspelningen är ännu inte provade.
- Ett vanligt chattprov genom den omstartade produkten skapade och spelade
  röst/läppsynkvideo utan rapporterat browserfel, 16 124 ms till talstart
  (RunPod-kö 132 ms, rendering 10 877 ms). Mänsklig läppsynkacceptans återstår.
- Den sparade modellen var Terra vid browserprovet. Den fungerar för vanlig
  textchatt, men nuvarande bild/ljudkoppling tillåter endast Luna. Jakob har
  fått instruktionen att välja Luna i Lissabon → Probe. Browserverktyget
  når nu produkten 4210 men nekas fortfarande labbet 4211 av sparad behörighet.
- Bild → Render → Gateway → Luna och bildlagringen återstår att verifiera
  separat med syntetisk bild. Ett godkänt STT-prov bevisar inte den bildvägen.

### Tidigare kameraversion (Web Speech)

Resultaten nedan gäller den tidigare implementationen, före transkriptionsfixen.

| Kontroll | Resultat |
| --- | --- |
| Samtliga 27 kommandon i `.githooks/pre-commit`, inklusive nya serverspärren | Godkända; därefter 37/37 riktade kamera-/launchertester efter flaggkopplingen |
| `audit-dealer-sync.mjs --probe` | Alla fyra dealers matchar assetbaseline |
| Gatewaykonfiguration + Director | 25/25 godkända; inkluderar bilddelar, modellval och deduplicering |
| Kamera/VAD/livscykel/startflagga | 13/13 godkända; även sen behörighet, fel, profilbyte, timeout och sen preview |
| Browser med syntetisk canvas/video + injicerad VAD | Tystnad 0 JPEG; kort tal 1; långt tal 2; kort paus 2; samtliga tracks avslutade; sändning först efter granskning |
| Riktig Chrome 154-transkription från befintlig Astrid-testreplik via ljudspår | Godkänd: “welcome to the dark Hall”, VAD=1; ingen riktig mikrofon |
| Samma transkriptionsprov i Codex in-app browser | Nätverksfel; API-närvaro är inte fungerande transkription |
| Riktig Astrid-spelare, 390×844 | Av synligt, panel läsbar, inga behörigheter; åtgärdat kapad status och överlappande klippväljare |

Browser-fixturen finns i [test/fixtures/astrid-camera-browser.html](../../test/fixtures/astrid-camera-browser.html).
Den kan tillfälligt serveras som `_astrid-camera-qa.html` från **ett redan
körande** isolerat QA-par; kopian ska tas bort efter prov. Ingen riktig
enhet, spelardatabas eller modell används av den uppdaterade fixturen. Det
separata ljudprovet spelar bara in en befintlig testreplik lokalt och gör
inga nätanrop till en transkriptionsleverantör.

Befintliga saknade takes och mänsklig läppsynkacceptans är oförändrade.
Tidigare Astrid-rehearsal genomfördes två gånger i både äldre och lokal
spelare av minnesarbetet. Den fullständiga browserregressionen med två
uppspelningar per dealer återstår för denna leverans. Servrarna stängdes
av under slutkontrollen; inga ersättningsservrar startades.

## Kvar innan aktivering

1. Driftsätt enligt Jakobs godkännande: ny Director och Gateway från aktuell
   work-version, med Lunas bildmetadata opt-in.
2. Starta högst ett isolerat Lissabon-par, på annan hostname än vanliga spelet,
   med separat bevarad QA-spelardatabas. Återanvänd browserflikarna.
   Använd `startIsolatedConnection` med `astridCamera: true`, aldrig en direkt
   serverstart som går förbi sessionsspärren. Generalrepetitionen är godkänd;
   samordna med det enda befintliga paret innan dess nästa start.
3. Prova syntetisk JPEG genom hela Web → Director → Gateway → Luna-vägen.
   Bekräfta faktisk modell och var bilddata finns i session/transkript/loggar.
4. Slutför fyradealerrehearsal och registrera per-line-resultat. Tekniska
   testpass är ingen visuell läppsynkacceptans. Behåll featureflaggan Av som
   standard och stoppa QA-paret när provet är klart.

Jira CAC saknas bland anslutna verktyg; ingen ärendestatus har ändrats.
Grundimplementationen är sparad som `d02758a` och verifierad på båda
work-mirrorerna. Ingen automatisk deployment följer av pushen. Mina
tillfälliga testflikar och den publika QA-fixturkopian är borttagna.
Källindex för fortsatt OpenClaw-arbete:
[OPENCLAW-DOCS.md](../../open-claw/lab/docs/OPENCLAW-DOCS.md).
