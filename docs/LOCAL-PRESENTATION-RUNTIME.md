# Gemensam presentationsruntime

Arbetsrepo: `C:\Users\jakem\Projects\croupier`, branch `main`.
Starta med [anslutningshelpern](../open-claw/lab/docs/LOCAL-CONNECTION-SV.md).
Mobile Phone Lane använder Astrids porträttvideo i det riktiga spelet:
<http://127.0.0.1:4200/blackjack>.
Lab på <http://127.0.0.1:4201/activity> öppnar samma läge via **Anslut**.

I molnet finns [spelet](https://www.scoutgaming.tech/blackjack) och
[Backoffice/Lab](https://www.scoutgaming.tech/studio) på samma exakta origin.
Vercel visar gränssnitten; Render äger auktoritativ spelmotor och live-transport.
Produktion och isolerad native-QA har Studio/admin-API på Vercel och sparad
policy/metadata/journaler i Neon, med separata scopes. Medier ligger i privat
Blob. Produktionsimport och policybyte är genomförda; aktuell driftversion
och avvecklingsstatus finns i [driftkartan](CLOUD-MIGRATION.md).
**Anslut & följ spelet** använder BO-inloggning och den faktiska spelflikens
native-kvitton även utan Partner-konfiguration. Privat Blob levereras via
behöriga mediarutter. Tal och lipsync-worker har varsin autentiserad native
Node-WebSocket-ingress på Vercel och behåller Render som sessionsägare.

Aktuell speluppspelning, QA-version och acceptansgränser redovisas i
[handoffen](JOHN-HANDOFF.md). QA:s AI-flaggor är OFF; journaler och
reservationer bevaras. Faktisk leverantörskostnad är fortsatt okänd/null.

## Lokal byggcache och runtime

Next skriver byggutdata under respektive apps `.next` och disponibel byggcache
under `.next/cache`. TypeScript kan skriva `tsconfig.tsbuildinfo`.
Lab-regressionen använder byggd runtime; cache och runtime är olika saker.
Cache hör till den checkout där bygget körs. Vercels byggcache hanteras separat.
`lab/data/platform-private`, SDK/sourcepins, QA-receipts, kostnadsjournaler,
konton och media är beständig arbetsdata och ingick inte i cacheborttagningen.
Om hela Lab-runtime behöver byggas om används `npm --prefix lab run build` med
projektets kompatibla Node och aktuell workergräns. Detta startar ingen server.
Kör inte dubbla tunga byggen i samma checkout och radera inte `.next` under
pågående bygge, server eller regression. Följ sessionsvakt och agent-talk.

## Gemensam kontoåtkomst

Spelets `/api/auth/login` och native Studios `/studio/api/auth/login` använder
samma serverresolver för befintliga CRAIG- och player_accounts-credentials.
Inloggningsnamn/e-post normaliseras; exakt en kandidat i båda registren krävs
innan hashkontroll. Klienten väljer varken kontoägare eller behörighet.
Admin/superadmin ger effektiv admin; äldre reader/staff och spelarkonton
ger effektiv spelare. Studio/Backoffice kräver admin på alla administrativa
ytor och actions, med färsk lagrad roll/fingerprint/auth_epoch.

Kapabiliteten `sharedCredentials:true` i `/api/auth/session` binder den nya
gemensamma frontendloggen till installerad backend. Saknad signal bevarar
de tidigare entry-/modalprotokollen; ingen lösenordsfallback eller klientroll
läggs till. En misslyckad kapabilitetsläsning blockerar login-POST. Detta
behövs när Vercel och Render uppdateras vid olika tidpunkter.

Cookies behåller separata game-/backoffice-audiences. Adminlogin kan utfärda
båda via befintlig signerare på samma tillåtna origin; spelarlogin rensar
BO/Lab-cookie. En gemensam credential gör inte cookies giltiga på andra
QA-/produktionshostar. Både namnrymder, live roll och epoch kontrolleras före
utfärdande, och Origin/Host/CSRF består.

Spelarlösenord hanteras i native Backoffice via signerad Render-command
`players/password`. Game-Neon äger salt/hash och sessioner; Render låser
konto/spelare, återkallar och väntar på runtimecancel. `passwordChangeAllowed`
visas endast för konton med eget spelarlösenord. CRAIG-konton använder
befintliga invitations-/resetlänkar, även när deras äldre roll är game-only.
Ingen kontoflytt, plånboksjustering eller schemaändring ingår.
## Ägarskap och ordning

Spelmotorn och Web behåller kort, shoe, wallet, resultat och presentationsordning.
`presentation-runtime/selection.mjs` väljer exakt familj och tillåten variant
med samma triggers, regler, slump och Director-kontrakt som Eventstudion.
Labbets tidigare moduler återexporterar den gemensamma implementationen.

Web använder `PerformancePlayer.playLocalClip` för hashverifierade MP4-filer
från `media/dealers/astrid/runtime/presentation`. En film äger ytan i taget. Den tidigare Astridmotorn,
dess talmedia och supervisor laddas inte i det lokala läget. Lab monterar ingen
parallell följningsspelare för någon dealer vid anslutning, återanslutning
eller **Ny observation**. En separat Lab-preview kräver ett uttryckligt val
och har egna kvitton; fristående editorprov är fortfarande möjliga.

Det autentiserade `/api/presentation/select` slår upp dealinstruktionen i
serverns publicerade `native_presentations` för aktuell spelare och version.
Browserns kort/handindex används inte. Dolt hålkort maskeras även i urvalet.
Exakt familj gäller för både standard och variant; en annan box/replik lånas
aldrig. Ingen tredje server eller alternativ spelmotor har tillkommit.

## Sparad policy och chatt

Studio/Backoffice är den gemensamma arbetsytan. Native administration använder
befintliga konton och deras rollkontroller. **Dealer & klipp** visar exakta
klippflöden för alla fyra dealers och behåller Studiofamiljerna. Äldre
BO-tilldelningar är historik och används inte som parallell policykälla.
Endast en exakt match i dealer, situation/destination och registrerad fil
kan importeras uttryckligen till Lab-utkastet. Osäkra tal-/stagedkopplingar
finns kvar för granskning och lånas aldrig till en annan replik/plats.

`legacyClipPolicy` styr originalmotorernas befintliga rörelseval och exakt
verifierade staged-destinationer. Dessa läses vid sidstart; ladda om mellan
händer efter sparning. Inspelat tal följer sitt befintliga exakta audio/video-par.
Astrids `presentation=local` använder fortsatt `mediaPolicy`/`idlePolicy`.
Projekt, versioner och historik använder revisionsstyrd Neon-lagring i både
produktion och isolerad native-QA. Äldre `lab/data` bevaras som lokal historik;
`/var/data/studio` är ingen aktiv produktionspolicykälla.
Medieregistren återanvänds med bevarade fil-ID och bytes.

Helpern ger Web och Lab samma isolerade projektkatalog. Spara ändringar i
Eventstudion. Nästa deal/replik läser sparad policy; idlepolicyn läses vid
sidstart, så ladda om spelfliken efter idleändringar. Osparade editorändringar
är inte produktens policy. En ny helperkörning börjar med en ny testkatalog.

Välj **Standard**, **Regler**, **Slump**, **OpenClaw** eller **OpenClaw · skugga**
i spelfliken. Tom variantmapp ger standard utan modellanrop. Den anslutna
Studio-profilen startar med OpenClaw/active; utan den är startläget Standard/off.
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

**Uppspelning och spår** visar aktiv native-session, presentationsläge,
sparad/kvitterad revision och event → familj/variant/orsak → start/bild/slut.
Nya urval har egna kvittorader; sena slutkvitton kan inte godkänna nästa klipp.
Genererat tal visar sin egen besluts-/genererings-/uppspelningskedja. Partner-SSE
är tydligt märkt diagnostik. Registrering, preview och runtimebindning är
separata statusar från spelarens faktiska kvitto.

Hela 1080×1920-filmen visas med `object-fit: contain`, även på dator.
Spelkorten är auktoritativa 2D-överlägg. Råfilmerna har ännu ingen kalibrerad
pickup/release/land-kontakt; DOM-kortets landningskvitto anger uttryckligen
`calibratedContact: false`. Filmens slut är inte bevis för handkontakt.
Saknat eller otillgängligt exakt klipp ger synlig **2D-reserv**.

Inspelade fria chattsvar är text-only när deras exakta text/video-paket inte
är verifierat. Native-eventrepliker använder sina exakt registrerade filmer och
inbäddat ljud. Genererad läppsynk kräver fortsatt mänsklig granskning.
Inga mediabytes, kalibreringar eller visuella godkännanden ändras här.

Sparade `gameLanes`/`gameLane` styr renderer, dealer och mediesamling.
Mobile Phone Lane är förval. Äldre `original` migreras vid läsning till Mobile;
gamla `dealer`/`presentation`-parametrar återaktiverar inte den pensionerade lanen.
En uttryckligen registrerad `indexed-video`-lane kan använda den gemensamma
indexspelaren för dealerbanken. Ingen automatisk videofallback införs.
Källkontrakt: `web/public/game-lanes.mjs`.

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
`media/dealers/astrid/runtime/presentation/lab-video-manifest.json` och `presentation-runtime/`.
Studio följer native-kvitton; Partner-SSE är kompletterande instruktioner.
Transportanslutning är inte speldata, valt klipp är inte spelat klipp.
