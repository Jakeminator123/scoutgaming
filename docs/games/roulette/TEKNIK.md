Utgångspunkt: main `426fa11417695025e2a0ee194825110f48f6b4af`, kontrollerad 13 oktober 2026. Läs [spelmanualen](README.md) först. Detta är dokumentation av befintlig kod; driftåtgärder nedan kräver separat mandat.

# Roulette — kod och integration

Europeisk roulette med enkel
nolla, 37 lika sannolika fack (0–36). Varje snurr är oberoende och samma nummer
kan komma flera gånger i följd. Nollan är grön och tillhör inga röd/svart-,
udda/jämn- eller låg/hög-satsningar.

[`index.mjs`](../../../services/game/games/roulette/index.mjs) körs bara i Node på spelservern. Den använder
[`node:crypto.randomInt(0, 37)`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomintmin-max-callback)
utan modulo-bias. Inga paket behöver installeras. Ingen kortsko, brännkort,
förblandad nummerlista, egen seed, viktning eller blackjackkod används.

## Gränssnitt

```js
import { createSpinResult } from './services/game/games/roulette/index.mjs';

// Endast på servern, efter stängda satsningar för en ny runda.
const event = createSpinResult({
  operatorId: 'sg-test',
  roomId: 'roulette-1',
  roundId: 'round-123',
});
```

Resultatet är ett JSON-kompatibelt event med `schemaVersion: 1`,
`type: 'roulette.spin.resolved'`, `game: 'roulette'`,
`variant: 'european-single-zero'`, `eventId` (UUID), `occurredAt` (UTC), de tre
ID-fälten och `outcome: { number, color }`. Färgen är `green`, `red` eller
`black`. `describePocket(number)` beskriver ett givet fack utan slumpning;
`ROULETTE_RULES` anger varianten och intervallet.

ID:n är 1–100 tecken, börjar med bokstav/siffra och får därefter innehålla
bokstäver, siffror, punkt, understreck, kolon och bindestreck. Extra indata,
inklusive seed eller önskat nummer, avvisas. Inget event skapas om slumpkällan
misslyckas. Modulens frysning skyddar objekten i processen, inte datatransporten.

## Koppling till rum och Render

`ops/cloud/Dockerfile` kopierar redan `services/game/` till samma Node 24-image som
blackjack. Ingen ny Render-tjänst, port eller miljövariabel behövs.

Den separata testytan `/roulette-test` (`games/roulette/preview.mjs`,
`public/roulette-test/`, `POST /api/roulette-test/spin`) togs bort 22 oktober
2026. Spelserverns enda roulettekontrakt är rummets `POST /api/roulette/table`
och spelingången `/play/roulette`. Vercel-ingressens och plattformsroutingens
kvarvarande `/roulette-test`-poster tas bort av respektive ägare (J05/C).
## Spelrum

Studio erbjuder Blackjack eller Roulette när ett rum skapas per bolag.
Partnerportalen visar publicerade rum, tillåtna utseendeval och provspelningslänk;
den skapar inte rum. Användarguiden finns i `lab/docs/README.md`.
Speltyp sparas som `game: 'roulette'`; äldre rum utan fältet är blackjack.
Rum och bolagets frysta presentation publiceras i samma befintliga transaktion.
Lobbyn följer aktuell publicering och öppnar
`/play/roulette?operator=<slug>&table=<room-id>&dealer=<dealer-id>`.

`room.mjs` validerar satsningar och räknar av dem. `rules.mjs` är den gemensamma
satsningskatalogen som också skickas till webbläsaren. `storage.mjs` låser
spelarens plånbok och sparar saldo, bokföring och rundkvitto i samma SQLite-/
PostgreSQL-transaktion. `access.mjs` kontrollerar bolag, speltyp, publicerat
rum och dealer; PostgreSQL kontrollerar publiceringen igen före commit.
Utfallet lämnar transaktionen först efter lyckad commit.

`POST /api/roulette/table` accepterar `op: 'state'` eller `op: 'spin'`.
Spin anger UUID `requestId`, aktuell `version`, `playerId`, `currency`,
`bets: [{id, amount}]` och `context: {operator, table, dealer?}`.
Sessionen äger spelar-ID; ändrat konto/valuta kan inte använda gamla insatser.
Upprepade kommandon återfår samma kvitto; konkurrerande kommandon med gammal
version avvisas. De senaste 20 kvittona sparas per spelare/bolag/rum.
Äldre anrop stoppas av versionskontrollen. Webbläsaren sparar väntande
kommando före anropet och erbjuder exakt återförsök efter anslutningsfel.

Samma inloggning och demosaldo som blackjack används. Detta är personliga
rundor som i blackjack; ett gemensamt tidsstyrt multiplayerhjul ingår inte.
Standardvinster är 35:1, 17:1, 11:1, 8:1, 5:1, 2:1 eller 1:1 netto;
ingen La Partage/En Prison. Gränser: 1–2 000 per fält, 10 000 per runda.
Kompositionen återanvänder lobbyns `published-scene.mjs`. Fryst blackjack-idle
lämnas inte ut till roulette; en egen dealer-/händelsekoppling återstår.
Inga blackjackrepliker eller nya rouletteinspelningar spelas. Externa
partner-launch-konton är spärrade tills deras plånbokskontrakt stöder roulette.
Profilens blackjackstatistik är oförändrad; roulettehistoriken finns i rummet.

## Spelargränssnitt och UI/UX-arbete

Rouletterummet är en serverlevererad HTML-/ES-modulsida, inte en Next-/React-sida.
Vercel vidarebefordrar dess kanoniska adress och tillgångar till Render.
Det befintliga gränssnittet är en spelbar första version som kan omarbetas.

| Ansvar | Källa |
| --- | --- |
| Sidstruktur, kontroller och dialoger | `services/game/public/roulette/index.html` |
| Layout, färg, responsivitet och rörelse | `services/game/public/roulette/style.css` |
| Satsningsutkast, hjul, resultat, historik och återförsök | `services/game/public/roulette/app.mjs` |
| Bolagets frysta dealer, bord och bakgrund | `services/game/public/roulette/scene.mjs` |
| Delad scenrenderare för lobby och roulette | `packages/presentation/runtime/published-scene.mjs` |
| Lobby och rummets ingång | `apps/web/components/player/` |

`app.mjs` kopplar kontroller till HTML-elementens ID:n. Ändra HTML och dessa
kopplingar tillsammans. Scenen använder samma publicerade underlag som lobbyn:
`GET /api/operators/<slug>/rooms/<room-id>/preview?revision=<paketversion>&dealer=<id>`.
Parametern heter `revision`, inte `packageRevision`. Ändringar i den delade
scenrenderaren kräver också kontroll av lobbyn och blackjackens presentation.

En ny design ska behålla serverns regler, RNG, inloggning, plånbok och
publiceringskontroller. Animationen visar det mottagna utfallet; den väljer
inget nummer. När ett svar saknas ska samma sparade `requestId`, version och
satsningar återanvändas. Skapa inte en ny snurr för att lösa ett osäkert svar.
Satsningar förblir låsta tills det väntande kommandot har hanterats.

Utforma och kontrollera även laddning, otillräckligt saldo, ändrad session,
utgången publicering, tappat svar, återförsök och saknad dealerscen. Säkerställ
mobil/desktop, tangentbord, synlig fokusmarkering, begripligt upplästa resultat
och reducerad rörelse. Röd/svart ska kunna förstås utan enbart färg.
Rundans utfall och saldo visas först från serverns bekräftade kvitto.

Aktuell leverans, Nordic Bets exempelrum och den samordnade dealerfrågan finns
i `docs/JOHN-HANDOFF.md`. Hårdkoda inte PAOW eller en annan dealer i gränssnittet.

## Anna: tal och rörlig läppsynk, 14 oktober 2026

Kodkontroll: main `0511206dec4cb8468fe92d5f03202718d3bf2585` och
`kevin-staging` `315cfc554330f1d5541a7ed3bb84044877a6b992`.
Detta avsnitt är aktuell integrationsanvisning, inte utförd liveacceptans.
Roulette-agentens tidigare två spelprov gäller tyst idle, startgest, bord,
bakgrund och separat hjul/kula. Agenten bekräftar ingen aktuell Anna-röstprofil,
talreferens eller verifierad taluppspelning. Efter radering/nyregistrering ska
aktuella dealer-ID:n, publiceringar och mediehashar läsas igen; historiska
Anna-kvitton nedan innebär inte att materialet fortfarande är registrerat.

### Vad vi redan har och vad som saknas

| Del | Verifierat underlag | Återstår |
| --- | --- | --- |
| Röst | Befintlig ElevenLabs-nyckel kunde läsa Paow/Dragges exakta röst-ID:n. | Välj och verifiera Annas egen röst, modell och språk. Ingen röst har valts åt Anna här. |
| Rörlig GPU | RunPod-läsning identifierade staging-endpoint, template och image-tagg. | Verifiera svarskontrakt och exakt avatarbank med verkliga talprov. API-hälsa bevisar inte detta. |
| Planering | #116 införde `web/moving-speech-plan.mjs` med exakta rutor och versionsbindning. | Koppla in server, worker-relay, avkodning och spelare; adaptern är fortfarande inaktiv. |
| Roulette | `services/game/public/roulette/scene.mjs` använder `mountPublishedScene` för frysta lager, idle och startgest. | Roulette har ingen inkopplad dealerchatt eller genererad talspelare i granskad kod. |
| Anna i workern | Kevins standardlista för rörligt tal innehåller Paow, Dragge och Astrid2. | Anna finns inte i den listan; hennes worker-avatar och underlag måste förberedas/verifieras. Att lägga till ett namn räcker inte. |

Cartesia och ElevenLabs skapar ljud; RunPod kör GPU-arbetet som skapar
läppsynken. OpenClaw levererar vårt chattsvar. Paow/Dragge använder ElevenLabs
på den granskade rörliga vägen, så en Cartesia-inloggning löser inte den
saknade talkopplingen. Inloggning i en leverantörs webbgränssnitt behövs inte
för API-anrop när rätt befintlig nyckel har åtkomst.

Det går att anropa en befintlig worker utan att först läsa dess källkod.
Workeråtkomst, känt protokoll och rätt avatarunderlag är driftkraven;
källkod/åtkomlig image behövs för full granskning, reproduktion och eget
underhåll. Be Emil bekräfta aktuell release, avatarpaketens version/hashar
för Paow/Dragge samt hur en ny Anna-avatar förbereds. Läsåtkomst till
worker-repot eller en byggbar export är önskvärd; en ny Cartesia-nyckel är
inte huvudfrågan. Endpointen `mq7eiwanda72fg` är det observerade rörliga
stagingmålet; `RUNPOD_ENDPOINT_ID` i Kevins exempel avser en annan väg.
Fullt protokoll, röst-ID:n och åtkomstkvitton finns i
[den gemensamma runtimereferensen](../../LOCAL-PRESENTATION-RUNTIME.md#kevins-draganpaow-filmurval-och-rörligt-tal-13-oktober-2026).

### Bygg i tre steg

1. **Fastställ Annas underlag.** Läs aktuell registrering och välj Annas
   röstprofil och ägda referens. Godkänn en gemensam scenreferens med rätt
   perspektiv, kroppsskala, ljus/skuggor och handkontakt innan fler filmer
   produceras. Scenreferensen är ett visuellt mål; worker-referensen är en
   separat, kompatibel dealerbild. Den befintliga generiska stillbildsvägen
   avvisar alfa- och bakgrundsinbakade referenser. Använd ett verifierat grönt
   original om det finns; Annas alfa-klipp kan inte bara matas in som de är.
   Stöd för alfa som speech-reference kräver en egen implementation och provning.
2. **Få tal i vila att fungera först.** Återanvänd gemensamma tjänster för
   serverägd dealer-/rumsidentitet, OpenClaw, röstprofil, budget, GPU-acceptans
   före TTS och avbrott. Lägg till rouletteanpassad chatt-/talstyrning och
   renderingskoppling till dealerlagret. Befintlig roulette-scen monterar inte
   `generated-speech-player.mjs`; en serverinställning ensam räcker inte.
   Prova två sammanhängande svar i den riktiga spelaren innan rörligt tal
   aktiveras. Bakgrund och bord behåller sina egna lager.
3. **Lägg till tal under rörelse.** Bind Annas exakta 24 fps-underlag till
   worker-avatar och en verifierad bildrutebank. Roulettens tidslinje måste
   omfatta vila, startgest och återgång; kopiera inte blackjackens givplan.
   Använd #116-adaptern för exakta källrutor, tal-/ljud-/profilhashar och
   omplanering. Avkoda workerns svar och komponera den ljudbundna bilden i
   dealerlagret före beskärning/keying. Bevara befintliga masker och
   hjul-/bordslager. En gammal eller felaktig bildruta får aldrig visas som
   ersättning för en saknad synkruta.

En gemensam worker-tjänst kan hantera flera registrerade avatarer med
separerade sessioner; en egen pod eller OpenClaw-instans per dealer är inget
krav i denna design. Samtidig kapacitet måste mätas. Roulettens tal får inte
avgöra eller blockera serverns snurr, kvitto, saldo eller återförsök.
Om rörligt tal saknas används endast en i förväg verifierad reservväg till tal
i vila; annars visas text och ett tydligt fel. Avbryt hela gamla taljobbet vid
byte av dealer/rum, ändrad publicering, ny plan eller stängd spelflik.

En senare förbättring är ett kort inandningsklipp (högst cirka 0,5 s) före
rösten och en lugn tal-idle med små kroppsrörelser. Dessa behöver egna exakta
klipp, övergångar och workerunderlag. Inandningen är en kroppsrörelse och ska
inte förväxlas med protokollets 220 ms ljudförskjutning. Lägg till dem först
när basflödet är godkänt.

### Tester och kriterier för att kalla det fungerande

De befintliga isolerade testerna kan köras utan riktiga provideranrop:

```sh
node --test --test-concurrency=4 test/moving-speech-plan.mjs test/dealer-speech-runtime.mjs test/dealer-speech-reference.mjs
```

Den 14 oktober: 21 godkända, 0 fel, 0 överhoppade på ovanstående main.
De täcker identitets-/röst-/mediebindning, felaktiga referenser, gamla versioner,
avbrott och exakt rutmatchning, inklusive syntetisk FFmpeg-extraktion. De
provar inte Emils GPU eller den kompletta roulettevägen. Vid implementation
ska även fulla krav i `.githooks/pre-commit` köras.

| Kompletterande prov | Vad som måste bedömas |
| --- | --- |
| Två svar i följd per dealer | Rätt röst och text, hela svarets synk och korrekt återgång till vila; ingen rest från föregående svar. |
| Startgest medan Anna talar | Exakt kroppsruta följs efter omplanering; händer, hjul, bord och masker ligger rätt. |
| Långsamt/saknat/omkastat svar | Ingen gammal munbild eller annan persons röst visas; kontrollerad reservväg och spelmotorn fortsätter. |
| Avbrott, rum-/dealerbyte, dolt/stängt fönster | Gamla paket avvisas; TTS, relay, avkodade rutor och RunPod-jobb frigörs, inte bara lokal plan. |
| Kall/varm start och samtidiga användare | Mät tid till ljud/första bild, kötid, avkodningsbortfall och skillnaden mellan faktiskt visad källruta och ljudklocka. |
| Munbilder 0,5–4 s sena vid talstart | Fördröj worker-svar i ett isolerat prov. Ljud och rätt bild ska starta tillsammans inom bestämd väntetid, annars kontrollerad reservväg/avbrott. Ingen visning av gamla munrutor. |
| Ljudnivå före GPU | Samma slutliga PCM till worker och ljuduppspelning; normalisering bevarar sampelantal/tid och provar även tystnad, kort replik och toppbegränsning. |
| Behörighet och ändrade underlag | Fel rum/bolag/publicering, inaktiverad profil och ändrade mediehashar stoppar nya kostsamma steg och uppspelning. |

Det isolerade Studio-provspel som använder `studio-preview-client.mjs`
stänger av chatt, OpenClaw och genererat tal. Det kan alltså inte ensamt vara
acceptansmiljö för denna funktion. Använd ett uttryckligen godkänt demorum
eller en isolerad taltestmiljö med dessa funktioner aktiva och oförändrade
behörighetskontroller; starta inte ett andra lokalt serverpar.

Kevins besked den 14 oktober bekräftar demokällan och rösterna men anger
också upp till cirka fyra sekunders eftersläpande munbilder vid chattsvar.
Det är ett känt fel att testa, inte en accepterad kvalitetsnivå för Anna.
[Den gemensamma runtimereferensen](../../LOCAL-PRESENTATION-RUNTIME.md#kevin-bekräftar-demokällan-14-oktober-2026)
har källkontrollen och skiljer kortspår från workerns ansiktsunderlag.

Spelarens verkliga videoklocka och ljudklocka ska mätas över hela svaret.
Kevins tolerans på ±48 rutor är inte vårt kvalitetskrav. Bestäm godtagbar
mätt avvikelse tillsammans med visuell/hörbar granskning och spara testkvitto
med exakta text-, ljud-, video-/avatarhashar, profil och worker-version.
Hashar, vågformer och gröna tester ersätter aldrig granskning av själva talet.
Inga Anna-talprov, GPU-jobb eller nya materialgodkännanden har utförts i denna
dokumentationsleverans. Planerade tester i tabellen är inte genomförda prov.

## Driftsättning

Applicera den additiva `ops/neon-game/007-roulette-tables.sql` i den verifierade
game-databasen efter godkännande. Den skapar endast
`croupier_game.roulette_tables` med referens till befintliga spelare.
Inga konton eller saldon ändras av migreringen. Render-kapabilitet 9 svarar
inte redo innan tabellen finns; Studio vägrar publicera roulette mot äldre
motorer. Befintliga blackjackrum fungerar före migreringen.
Ingen ny tjänst, hemlighet eller miljövariabel behövs. Återställning sker genom
att avpublicera rouletterummen; behåll tabellen och bokförda kvitton.

Generatorn i `index.mjs` är fortfarande stateless och får inte anropas direkt
som återförsök av en redan avgjord runda. Certifiering och riktiga pengar ingår inte.

## Verifiering

Använd Node 24 för hela repo-/Studio-flödet. Kör från reporoten:

```sh
node --test --test-concurrency=4 test/roulette.mjs test/roulette-preview.mjs test/roulette-room.mjs test/roulette-room-storage.mjs test/roulette-room-http.mjs test/roulette-publication.mjs test/roulette-postgres.mjs
```

Tester för generator och testyta kontrollerar
alla 37 fack och färger, slumpanropets gränser, upprepade nummer, eventets
kontrakt, felaktiga indata och fel i slumpkällan. Statistiska stickprov är inte
bevis för en rättvis eller certifierad generator. HTTP-testerna använder en
isolerad loopback-server utan databas och kontrollerar också Origin, tomma
anrop, belastningsgräns, felsvar och exakta proxyvägar. Rumstesterna täcker
satsningar, utbetalningar, idempotens, session/origin, publicering och SQLite.
`test/roulette-postgres.mjs` kräver den isolerade PostgreSQL-fixturen för
databastesterna; upptäckta eller hoppade tester är inte körd PG-verifiering.
CI:s `tools/studio-isolated-qa.mjs` kör dessa med riktig isolerad databas,
inklusive åtta samtidiga spelare, rollback och omstart. Hela uppsättningen
ingår i `.githooks/pre-commit-full` och CI.

Efter UI-ändringar: kontrollera ett fullständigt spelvarv i en isolerad miljö,
inklusive ett tappat svar efter servercommit, exakt återförsök och omladdning.
Kontrollera också mobil, desktop och den faktiska dealerscenen. Ett godkänt
API-test är inte visuellt godkännande. Använd inte produktionskonton eller
ändra riktiga användares demosaldon för testning. Starta lokalt enligt
`AGENTS.md` med `node apps/studio/start.mjs --no-open`; endast ett serverpar åt gången.
