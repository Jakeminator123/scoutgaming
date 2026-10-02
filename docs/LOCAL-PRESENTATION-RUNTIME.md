# Gemensam lokal presentation

Arbetsrepo: `C:\Users\jakem\Projects\croupier`, branch `main`.
Starta med [anslutningshelpern](../open-claw/lab/docs/LOCAL-CONNECTION-SV.md).
Astrids lokala läge finns i det riktiga spelet:
<http://127.0.0.1:4200/?dealer=astrid&presentation=local>.
Lab på <http://127.0.0.1:4201/activity> öppnar samma läge via **Anslut**.

## Ägarskap och ordning

Spelmotorn och Web behåller kort, shoe, wallet, resultat och presentationsordning.
`presentation-runtime/selection.mjs` väljer exakt familj och tillåten variant
med samma triggers, regler, slump och Director-kontrakt som Eventstudion.
Labbets tidigare moduler återexporterar den gemensamma implementationen.

Web använder `PerformancePlayer.playLocalClip` för hashverifierade MP4-filer
från `emil/dealklipp-v1`. En film äger ytan i taget. Den tidigare Astridmotorn,
dess talmedia och supervisor laddas inte i det lokala läget. Lab monterar ingen
parallell följningsspelare för Astrid, inte heller före anslutningskvittot eller
efter **Ny observation**. Fristående editorprov är fortfarande möjliga.

Det autentiserade `/api/presentation/select` slår upp dealinstruktionen i
serverns publicerade `native_presentations` för aktuell spelare och version.
Browserns kort/handindex används inte. Dolt hålkort maskeras även i urvalet.
Exakt familj gäller för både standard och variant; en annan box/replik lånas
aldrig. Ingen tredje server eller alternativ spelmotor har tillkommit.

## Sparad policy och chatt

Helpern ger Web och Lab samma isolerade projektkatalog. Spara ändringar i
Eventstudion. Nästa deal/replik läser sparad policy; idlepolicyn läses vid
sidstart, så ladda om spelfliken efter idleändringar. Osparade editorändringar
är inte produktens policy. En ny helperkörning börjar med en ny testkatalog.

Välj **Standard**, **Regler**, **Slump**, **OpenClaw** eller **OpenClaw · skugga**
i spelfliken. Tom variantmapp ger standard utan modellanrop. Standard är default.
Idleråd bygger på färsk chatt och samma befintliga begränsningar och tillåtna
varianter, inklusive `idle_insulted`. Skugga kan aldrig spela AI-förslaget.

Chatta i spelfliken. Serverbunden identitet, synliga kort, minne och den
befintliga Cartesia/RunPod-vägen är kvar. `--generated-speech` krävs för
genererad läppsynk. Ett talpaket får förberedas under deal men får uppspelning
först efter en ny faktiskt renderad primär-idle. Deal avbryter pågående tal.
Sena chatt-/idlecallbacks får inte avbryta en ny deal eller öppna talgrinden.

Produktens taladapter behåller sin separata credential. Presentationsadaptern
använder samma befintliga Director-credential som Lab, genom de serverbundna
`CROUPIER_PRESENTATION_DIRECTOR_URL/TOKEN`; den är inte en ny smalare token.
Helperns nätvakt tillåter samma konfigurerade Director-origin för Web. Ingen
modellnyckel skickas till browsern och ingen Render-/modellkonfiguration ändras.

## Kvitton och begränsningar

Native-observationen rapporterar urval, faktisk start, presenterad videobild,
slut, avbrott och reserv. Ett valt klipp räknas inte som spelat. MP4-slut kräver
verkligt `ended` och presenterad bild. Avbrott/stall slutar aldrig med falskt
completion-kvitto. Lab kan valfritt spegla spelfliken med browserns bilddelning.

Hela 1080×1920-filmen visas med `object-fit: contain`, även på dator.
Spelkorten är auktoritativa 2D-överlägg. Råfilmerna har ännu ingen kalibrerad
pickup/release/land-kontakt; DOM-kortets landningskvitto anger uttryckligen
`calibratedContact: false`. Filmens slut är inte bevis för handkontakt.
Saknat exakt klipp, till exempel dealer-hålkort, ger synlig **2D-reserv**.

Inspelade fria chattsvar är text-only när deras exakta text/video-paket inte
är verifierat. Native-eventrepliker använder sina exakta lokala filmer och
inbäddat ljud. Genererad läppsynk kräver fortsatt mänsklig granskning.
Inga mediabytes, kalibreringar eller visuella godkännanden ändras här.

Originalvägen utan `presentation=local` finns kvar för regression/jämförelse;
den är inte en automatisk videofallback inuti det lokala läget. Vera, Amira
och Mei använder sin befintliga gemensamma spelare.

Verifiering och kvarstående arbete dokumenteras vid leverans i
[JOHN-HANDOFF.md](JOHN-HANDOFF.md).


## Kamera och mikrofon

Record aktiverar lokal lyssning efter ”Astrid”; Play styr spelljudet.
Efter aktiveringsordet skickas turen vid 1 150 ms tystnad. Ljudbufferten är
högst tre sekunder i RAM; turen högst 30 sekunder. Kamerabilder tas först
efter aktivering. Dold flik, spelarbyte och Record av avbryter. Första
aktiveringen begär samtycke. Text/bilder visas i en tillfällig logg via
fem sekunders långtryck, inte i normalvyn.

Webbläsarens lokala talstöd krävs för aktiveringsordet. Produktservern
använder Whisper `whisper-1` via audio/translations för engelsk text;
Cartesia ger utgående röst. Nycklar finns enbart på servern. Modell- och
bildåtkomst måste verifieras separat. Syntetiska adapter-/bildprov är
inte slutgodkännande av fysisk mikrofon/kamera eller exakt läppsynk.

Källkontrakt: `lab/policies/studio-contract.json` (sex eventtyper/16 grupper),
`emil/dealklipp-v1/lab-video-manifest.json` och `presentation-runtime/`.
Studio följer native-kvitton; Partner-SSE är kompletterande instruktioner.
Transportanslutning är inte speldata, valt klipp är inte spelat klipp.
