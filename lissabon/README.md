# Lissabon stream lane · Astrid

Vår fortsatta lokala demoingång: Emils filmer, gemensamma klippval,
idle-reaktioner, OpenClaw-chatten och ElevenLabs/RunPod-svar med läppsynk
i samma bildformat. Basversion före paketering: `e46bc8b`.
Milstolpetagg: **`BRA_sammanbindning_av_KJE`** på `jakeminator123/work`.

## Starta

1. Dubbelklicka **Start-Lissabon.cmd** här eller i projektroten.
2. Starten bygger labbet och öppnar <http://127.0.0.1:4201/lissabon>.
3. Tryck **Anslut**. Astrid öppnas i en spelflik som följs av labbets logg.
   Välj eller skapa din lokala demoprofil, eller fortsätt som gäst.
   Spela och chatta där. Välj mobilstorlek i webbläsaren för mobilgranskning.
4. Behåll startfönstret öppet. **Ctrl+C** stoppar båda servrarna.

```powershell
node lissabon/start.mjs
node lissabon/start.mjs --check
```

`--check` provar befintliga privata anslutningar utan att starta spelet eller
generera tal. Produkt-speech-relayn visar `reachable: null` eftersom dess
smala endpoint kräver ett riktigt modellanrop för att provas; det betyder
inte anslutningsfel. `--no-open` används från Codex. `--skip-build` är bara för
utveckling efter ett verifierat `npm --prefix lab run build`.
En redan körande Lissabon öppnas igen. Andra processer på 4200/4201 stoppas
aldrig automatiskt; avsluta deras startprocess först.

Kräver Node 22.16+ med SQLite-stöd, `npm --prefix lab ci`, Emils befintliga
mediefiler och projektets privata miljöinställningar. Nycklar kopieras inte
hit. Se [anslutningsguiden](../open-claw/lab/docs/LOCAL-CONNECTION-SV.md).
Nya chattsvar använder konfigurerade modell-, ljud- och videotjänster.

## Arbetsytan

- **Ström:** Astrid och verkliga beslut och uppspelningskvitton.
- **Idle:** basloopar, automatiska variationer och OpenClaw-reaktioner,
  inklusive `idle_insulted`. Spara och ladda om spelfliken efter ändring,
  när handen är avslutad.
- **Klipp & varianter:** exakta filer per utdelning/replik och tillåtna
  alternativ. Sparade val läses vid nästa deal- eller replikhändelse.

Web är ensam spelare. Chattsvar genereras i spelet. Manuella klipp- och
idleförhandsvisningar är granskning, inte en andra spelström. Den äldre
studion finns kvar under `/tree` för avancerat arbete.

Läget **OpenClaw** gör en idlevariation till ett tillåtet alternativ. Vanliga
frågor ska normalt behålla grundloopen. `idle_insulted` är avsedd för en tydlig
förolämpning riktad mot Astrid i det senaste meddelandet; reaktionen ska inte
följa med till nästa vanliga fråga. Spara inställningar medan den lokala
servern kör. Vid anslutningsfel finns utkastet kvar i fliken; försök spara
igen innan du laddar om den.

I **Idle → Korta variationer** finns sex klipp: blink, cheek, glance,
insulted, smile och yawn. Lissabon erbjuder alla sex till OpenClaw.
**När passar klippet?** är en kort beskrivning (80 tecken) som skickas
tillsammans med klippets identitet vid nästa beslut. Exempel: leende vid
beröm/tack, gäspning när spelaren nämner trötthet, insulted enbart vid en
aktuell förolämpning. Beskrivningen är vägledning, inte en tvingande trigger.

**Används som** väljer ägare:
- **OpenClaw:** väljer efter ett nytt chattmeddelande; neutralt/no-op är tillåtet.
  Högst en spelad reaktion per minut, och ett råd förfaller efter 30 sekunder.
  Ingen modell frågas periodiskt bara för att spelaren väntar.
- **Automatisk:** intervall, slumpmarginal, minsta paus och maxfrekvens;
  chatten tolkas inte. Passar exempelvis blinkning.
- **Manuell:** bara knappen Spela i labbet.
- **Regelstyrd:** saknar ännu ansluten idle-trigger och kan därför inte
  nyväljas i panelen. Spel-/replikfamiljernas regler är en annan funktion.

Spara och ladda om spelfliken för att synka policyn. **OpenClaw behöver inte
startas om.** Endast registrerade, tillåtna och tillgängliga filer skickas
som kandidater. Fler filer i mappen kräver uppdaterat manifest och en
idlepolicy-post med uppmätt längd; en fil på disk aktiveras inte av sig själv.

## Spelarprofil och minne

**Byt profil** i Astrids spelflik väljer en sparad profil eller skapar en ny.
Varje profil har ett eget server-ID. Visningsnamnet skickas till OpenClaw,
men namnet används aldrig som nyckel för chatthistoriken. Namnkrockar kräver
att du väljer den befintliga profilen eller ett annat namn.

Det är lokala demoprofiler utan lösenord: den som använder denna dator kan
välja dem. API:t är bara aktiverat i Lissabons isolerade loopback-körning.
Vanliga Scout-konton och den riktiga användardatabasen används inte.

Astrids minne består av de senaste 12 chattinläggen, högst 8 000 tecken och
30 dagar utan nya meddelanden. Det är sparad samtalshistorik, inte obegränsat
långtidsminne. **Minne → Radera mitt minne hos denna dealer** rensar den.
Avsluta handen och invänta svaret före profilbyte. Profilbyte laddar om öppna
Lissabon-spelflikar på samma origin; gamla svar får inte följa med.

Mobilchatten öppnas med **Chatt** och stängs med samma knapp eller Escape.
Nya meddelanden öppnar inte loggen automatiskt på mobil. En punkt visar ett
nytt dealersvar. Väntestatus visar förberedelse, kö till ledigt bord och tal.
Kort och insatsmarkeringar ligger ovanpå talfilmen under hela uppspelningen.

Chatten visar nu vilket steg som pågår: Astrid tänker, rösten skapas,
läppsynken köas/renderas och uppspelningen förbereds. Labbloggen får samma
steg och tid sedan frågan skickades. Talet börjar fortfarande först när
hela ljud-/videopaketet är färdigt. Ett flikbyte under genereringen behåller
svaret tills du återvänder; redan påbörjat tal avbryts fortfarande när
fliken döljs. Ny hand/bordsversion, profilbyte, navigation eller avstängt
ljud kan avbryta ett svar och får en förklaring i chatten.

**Väntar på video-GPU** betyder RunPods jobbkö, inte köade idle-klipp.
Kedjan är text → röst → GPU-kö → färdig läppsynksfilm → neutral startposition
→ uppspelning. Idlecontrollern har ett aktuellt klipp och högst ett färskt
reaktionsförslag; den bygger ingen lång spellista. Färdigt tal går före.
I ett uppmätt 40,396-sekundersprov tog GPU-kön 31,228 s, rendering/hämtning
6,835 s och steget från färdigt paket till uppspelningsstart 0,126 s.

Avlästa RunPod-inställningar 2026-09-26: workersMin 0, workersMax 5,
idleTimeout 60 s, QUEUE_DELAY 4 s och FlashBoot på. Kön kan omfatta väntan
på en ledig arbetare och kallstart; det enskilda provet skiljer inte dessa.
En varm arbetare under demon är nästa åtgärd att prova, med löpande kostnad.
Ingen kapacitet eller debiteringsinställning har ändrats.
Se [RunPods workerinställningar](https://github.com/runpod/docs/blob/main/serverless/endpoints/endpoint-configurations.mdx)
och [latensoptimering](https://github.com/runpod/docs/blob/main/serverless/development/optimization.mdx).

Astrids Lissabon-chatt väljer genererade svar i stället för äldre bankrepliker
som den lokala filmspelaren bara kunde visa som text. Om OpenClaw väljer
tystnad visas det uttryckligen.

Astrid ska svara på engelska som standard. Be uttryckligen om ett annat
språk i den aktuella frågan om du vill byta. Spelresultaten kommer från
profilens serverbokföring: avslutade, utbetalda rundor, uppdelade per valuta.
Vinster/förluster är nettot per runda; återbetald insats räknas inte som vinst.
Pågående insats redovisas separat. Insättningar och startpengar ingår inte.

Lissabons logg följer den valda profilens spelflik direkt. Den synliga loggen
visar högst 150 senaste poster och döljer upprepningar av samma idle-varv.
Observationsprotokollet fortsätter efter 300 poster med ett rullande fönster
(även begränsat till 4 MiB); exporten markerar när äldre poster saknas.
Hela presentationslistor behålls inom fönstret. Exportera före omladdning om
du vill behålla diagnostiken. Detta är inte profilens sparade spelhistorik.

## Sparande

- `profile.json`: Astrid, portar, genererat tal och källversion. OpenClaw är
  standardklippval i denna körprofil; andra startvägar behåller sina val.
- `project.snapshot.json`: fryst projekt från den fungerande strömmen.
  Första start kopierar det till `data/project.json`. Befintliga ändringar
  skrivs inte över; nya registrerade idleklipp och saknade beskrivningar
  läggs till via vanlig revisionshistorik. Det gemensamma schemat innehåller fyra dealers;
  Lissabons arbetsyta är begränsad till Astrid.
- `data/project.json` och `data/history/`: lokala inställningar och
  revisionskopior överlever omstart men ligger utanför Git. Säkerhetskopiera
  dem separat eller gör en granskad ny snapshot vid nästa milstolpe.
- `data/players/`: isolerade demodatabaser med profiler, demo-bord, saldon,
  sessioner och chatthistorik överlever omstart. De är privata och ignoreras
  av Git. Säkerhetskopiera vid behov medan servrarna är stoppade.
- Genererade ljud-/videopaket är fortfarande tillfälliga per start i en
  separat Windows Temp-mapp. Normal avstängning rensar den. Sparat chattminne
  innebär inte att gamla talfilmer finns kvar eller kan spelas igen.

## Gemensamma källor

Ingen kopierad spelmotor eller extra videoarkiv:

- [Emils manifest](../emil/dealklipp-v1/lab-video-manifest.json) och
  `emil/dealklipp-v1/{deal,idle,repliker}/`: filmer, familjer och varianter.
- [Arbetsytan](../lab/components/lissabon-studio.tsx) och
  [gemensam runtime](../presentation-runtime/): editor och beslut.
- [Produktkoppling](../web/presentation-api.mjs),
  [lokal filmspelare](../web/public/local-presentation.mjs) och
  [genererat tal](../web/public/generated-speech-player.mjs).
- [Isolerad start](../open-claw/lab/deploy/local-connection.mjs): befintliga
  privata anslutningar; Web och Lab läser samma absoluta `lissabon/data`.

Git-taggen låser kod, snapshot och mediereferenser. Den packar inte privata
nycklar, externa tjänster eller lokala filer som inte ligger i Git.

## Känt inför demo

Chattsvar genereras färdigt innan uppspelning. Tidigare prov tog 15–25
sekunder; Lissabon-provet tog 81 sekunder. Stegmätta prov den 25 september
gav 8,1 och 8,5 sekunder för korta svar och 16,6 sekunder för ett längre
svar med cirka 11 sekunders tal. OpenClaw tog 1,5–1,7 sekunder, rösten
0,7–1,3 sekunder och videokedjan 5,5–13,6 sekunder. De äldre mycket långa
proven saknar stegmätning och är inte förklarade ännu. Ett senare resultatprov
tog 29,8 sekunder, varav 15,4 sekunder i videokö och 11,4 sekunder i
rendering/hämtning. Ett annat tog 39,4 sekunder med 32,2 sekunder i
rendering/hämtning. Sista kortsvaret tog 40,4 sekunder, varav 31,2 i
videokö. Videokedjan är den största uppmätta flaskhalsen.
Planera för varierande väntetid. Utdelning går före tal. Bildformatet är verifierat; röstens
naturlighet och fonemvis läppsynk är inte slutgodkända.
Mobilens automatiska chattöverlägg och talfilmens täckning av korten är
åtgärdade. Kortens placering, kortkontakt och saknade exakta filmer behöver
fortsatt granskas. Detta är en säkrad utvecklingsmilstolpe.
Se [handoffen](../docs/JOHN-HANDOFF.md) för prov och kvarvarande fel.
