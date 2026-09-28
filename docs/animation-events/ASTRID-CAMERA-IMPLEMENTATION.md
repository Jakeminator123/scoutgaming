# Astrid: kamera, tal och granskning

28 september 2026. **Implementerat lokalt, kamera Av. Ingen kameradeploy ännu.**
Aktuell källa för uppdraget är [agentprompten](ASTRID-CAMERA-AGENT-PROMPT.md).
Designunderlaget finns i [kameraplanen](../../open-claw/lab/docs/ASTRID-CAMERA-VOICE-PLAN.md).

## Aktivering för det godkända provet

Jakob har godkänt driftsättning och generalrepetition. Senaste verifierade
driftkontroll nedan föregår kameradeploy; ett fungerande lokalt spel bevisar
inte att bildvägen är driftsatt. Codex webbplatsbehörighet blockerar för
närvarande agentens kontroll av Render.

1. På Render: driftsätt aktuell `jakeminator123/work` för både
   `croupier-lab-openclaw` (Gateway) och `croupier-lab-director`. Gateway ska
   ha `CROUPIER_SPEECH_VISION=1`. Behåll befintlig version, modellnycklar och
   verktygsgränser. Verifiera först en syntetisk bild och dess lagring enligt
   checklistan nedan.
2. Avsluta det befintliga lokala serverparet via dess startfönster när handen
   är avslutad. Från reporoten: `node lissabon/start.mjs --astrid-camera --no-open`.
   Använd QA-launcherns `astridCamera: true` när det isolerade provparet ska
   köras. Ett andra startkommando ändrar inte flaggan i en redan körande server.
3. Lissabon → Probe: välj **GPT-6 Luna** och spara. Öppna Astrid via **Ström →
   Anslut**, med `presentation=local`, i Chrome. Ladda om befintlig spelflik.
4. I spelfliken: **Kamera · Av → Starta kamera och mikrofon**, godkänn enheterna,
   tala och granska text/bilder. **Skicka till Astrid** skickar just den turen.
   Funktionen delar stillbilder och transkriberat tal, inte kontinuerlig video
   eller rått mikrofonljud till OpenClaw. Bilder kan finnas i OpenClaws historik.

Codex webbplatsbehörighet och Chromes kamera-/mikrofonbehörighet är separata.
Den första behövs bara för agentens browserkontroll; den andra behövs för
själva produktfunktionen.

## Produktflöde

I Astrids riktiga Lissabon-spelare (`?dealer=astrid&presentation=local`) finns
**Kamera · Av**. Starta begär kamera och mikrofon. Välj Svenska eller English
för det egna talet. Förhandsbild, mikrofonnivå och Stoppa visas under upptagning.
Ingen behörighet begärs när sidan öppnas, och Probe kan inte starta enheterna.

Web Speech API transkriberar samma ljudspår som nivåmätaren använder.
`speechstart`/`speechend` är VAD-källan; RMS används bara som nivåmätare.
Efter cirka tre sekunders ackumulerat tal tas en mellanbild. Talslut efter
650 ms tystnad, Stoppa eller 30-sekunderstimeout avslutar upptagningen.
Kort tal ger bara slutbild, inget tal ger inga bilder, högst två bilder tas.

Texten är redigerbar och bilderna visas före **Skicka till Astrid**.
Kassera tar bort oskickat material ur fliken. Byte av profil/bord, utloggning,
dold flik, navigation, stängd panel, enhetsfel och sena tillstånd avslutar
samtliga tracks. En gammal preview-promise kan inte stoppa en ny upptagning.
Probe väntar också under granskningen. Astrids befintliga språkpolicy för
svar gäller fortfarande; talets språk styr bara transkriptionen.

## Befintlig kedja och gränser

Web → autentiserad backend → Director → privat Gateway → `croupier-speech`.
Ingen andra spelare, minnesmotor, råljudsendpoint eller ny verktygsbehörighet.

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

Kod: [kamerakontroll](../../web/public/astrid-camera-control.mjs),
[VAD/bildsession](../../web/public/astrid-camera-session.mjs),
[gemensamt bildkontrakt](../../open-claw/lab/src/astrid-observation.mjs),
[Director](../../open-claw/lab/src/product-speech.mjs).

## Faktisk drift och lagring

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

Webbläsarens taligenkänning kan behandla ljud hos browserleverantören.
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
enhet, spelardatabas eller modell används av komponentprovet. Det separata
transkriptionsprovet skickar bara en befintlig syntetisk testreplik till
browserns taligenkänning.

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
