# V3 – videoregister, nuläge och placeringskarta

Granskning 20 september 2026, Europe/Paris. Analys och placeringsförslag på
Jakobs work-branch. Detta inför inget nytt live-index och flyttar inga videor.

## Lokala filer är hittade och verifierade

Råarkivet finns i:

[C:/Users/jakem/CroupierAssets/bettalotto-generations](C:/Users/jakem/CroupierAssets/bettalotto-generations)

Det innehåller 224 MP4-filer namngivna med generation-id samt catalog.json.
Alla 224 MP4-filer matchade det nyhämtade API-registret på både byte-storlek
och full SHA-256. Sammanlagd storlek: 1 022 561 047 byte. Inga filer laddades
ner igen.

Kevins befintliga placering är utgångspunkten:
[performance-manifestet](../../../web/public/dealers/astrid/performance/manifest.json)
beskriver bearbetade, kalibrerade Astrid-takes. Råarkivet och performance är
olika nivåer i samma materialkedja. Börja med logiska referenser till dessa
platser, inte en fysisk omflyttning.

## Öppna kartan från repot

[map.html](map.html) innehåller nodträdet, registeröversikten och
placeringsförslagen. Den kan öppnas direkt som lokal fil. All kartdata ingår;
videopreview kräver däremot en egen lokal kopia av råarkivet.

För karta med video, kör från repots rot med Node 22 eller senare:

```powershell
node docs/animation-events/v3-video-map/serve.mjs --archive "C:\Users\jakem\CroupierAssets\bettalotto-generations"
```

Öppna sedan http://127.0.0.1:4196/. Ange din egen arkivmapp på andra datorer.
Om porten redan används, lägg till exempelvis `--port 4197`. Utan `--archive`
fungerar kartan, men videopreview kräver att servern startas med arkivmappen.
Servern lyssnar endast lokalt, är läsande och hämtar inget från Bettalotto.
Den kontrollerar varje efterfrågad fils storlek och SHA-256 mot snapshoten
före uppspelning. En saknad fil ger 404 och en avvikande fil ger 409.

[snapshot.json](snapshot.json) innehåller den härledda inventeringen från
20 september, utan API-nyckel, fullständiga prompts eller absoluta lokala
arkivsökvägar. Statusar är daterade observationer, inte en automatisk livesynk.
Hashkontrollen av de 224 originalen gjordes på Jakobs dator; andra datorer
behöver egna videofiler. Källreferenser anges per fil eftersom handoffens
radnummer förändras när nya notiser läggs till.

Efter avsiktlig redigering av snapshot eller [HTML-mallen](map-template.html),
bygg om med `node docs/animation-events/v3-video-map/build.mjs`.
Skriptet återanvänder snapshoten och gör inga API-anrop. Genererade map.html
ska följa med samma commit. Filerna är en inventeringskarta under docs;
de ändrar inte produktens spelare eller runtime-manifest.

Ursprungliga privata leveransfiler på Jakobs dator finns också kvar:

- [Interaktiv karta med lokala videopreviewer](C:/Users/jakem/.codex/visualizations/2026/09/19/01a0bbdb-661e-74a2-beac-de30003775fb/croupier-v3-videokarta.html)
- [Canvas med karta och sökbart register](C:/Users/jakem/.cursor/projects/c-Users-jakem-Projects-croupier/canvases/croupier-v3-videokarta.canvas.tsx)
- [Härledd inventering och evidens](C:/Users/jakem/.codex/visualizations/2026/09/19/01a0bbdb-661e-74a2-beac-de30003775fb/croupier-v3-video-map.private.json)

Den ursprungliga previewn på port 4196 kan redan vara igång på Jakobs dator.
Dess äldre startkommando är `node .croupier-inbox/v3-video-audit/serve-preview.mjs`.
Råa API-snapshotar, hashningskvitto och ursprungliga hjälpfiler ligger kvar i
ignorerade `.croupier-inbox/v3-video-audit/`. Git-versionen av kartan kan
användas utan dessa privata hjälpfiler. Inget auth-material eller råvideo
ingår i den här leveransen.

## Källor och verifieringsgräns

- GET https://bettalotto.se/api/v1/generations, HTTP 200,
  hämtat 2026-09-19 22:51:07 UTC (20 september lokal tid).
  BETTALOTTO_API lästes server-side ur .env utan att exponeras.
- Publicerade streams/index.json och audio/en/bank.json för Astrid, Vera,
  Amira och Mei samt Astrids performance/manifest.json hämtades med HTTP 200.
- [Partner-presentation](../../../web/partner-presentation.mjs),
  [labbkatalog](../../../open-claw/lab/config/catalog.json) och
  [labbets matchning](../../../open-claw/lab/src/engine.mjs).
- [V3 eventträdet](../v3-9-days-mvp/s03-eventtradet.md),
  [säker presentation](../v3-9-days-mvp/s04-saker-presentation.md) och
  [beslutslogg](../v3-9-days-mvp/DECISIONS.md).
- Kevins [beskrivning av nuvarande placering](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3869613874)
  och [förslag om katalogträd och YAML](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3869829140).
- Lokal kod lästes vid 4492eea och jämfördes även efter den andra uppgiftens
  workflow-merge 8800753. Partner-presentation, labbkatalog och performance-
  manifest ändrades inte däremellan.
- Kevins kodreferens är lokalt tillgängliga 626554d på
  origin/codex/restore-casino-environment. Ny remote-head kunde inte
  verifieras eftersom git ls-remote stoppades av SSH known_hosts-åtkomst.
  Den referensen är inte bevis på nuvarande driftsatta app-revision.

Generations-API:t anger id, prompt, model, duration, aspect, verdict,
verdictReason, landedAt, size, sha256 och downloadUrl. Det anger **inte**
dealer, event, variant, aktiv användning, BO-plats, kalibrering eller
godkänd take. Här är landedAt registertid; det är inte kortets landningstid.

Det publika försöket att läsa /api/bo/config gav HTTP 401, liksom app.mjs.
Den befintliga webbläsarprofilen gick också till backoffice-inloggningen;
ingen inloggad BO-session fanns tillgänglig för läsning av klippvalen.
Den dokumenterat scope-begränsade generationstoken användes bara mot sitt
generations-API. Dagens faktiska cfg.clipAssignments är därför fortfarande
okända. Ett manifest, en filhash eller ett källomnämnande bevisar inte att
videon spelas i en aktuell session.

## Vad registret innehåller

224 poster och 224 unika videohashar:

- 17 want: kandidater som Kevin vill arbeta vidare med.
- 52 no: bortvalda i intake.
- 155 utan omdöme.
- Modeller: seedance_2_0 46, kling3_0 29, seedance_2_5 122,
  hf_mult_motion_control 2, minimax_hailuo 1 och cinematic_studio_video_4_0 24.

59 generationer matchar 60 identiska MP4-filer bland repots 277 spårade
MP4-filer. 67 generation-id:n förekommer i spårade text-/metadatafiler.
Dessa två mängder överlappar; de skall inte adderas eller kallas aktiva
videor. Bearbetade streams, mask-atlaser, retiming och sammansättningar får
egna bytes och måste spåras genom proveniens.

De 17 want-posterna har individuella placeringsanteckningar i kartan:
16 prompts pekar på Astrid-relaterat material; en talvideo har ingen säkert
fastställd dealer eller replik. Korta innehållsetiketter för övriga poster
är promptindikationer. Ingen av de 224 videorna har fått nytt visuellt
godkännande genom denna översyn.

## Dagens användning och val av presentation

Det verifierade Partner-flödet är:

command → serverägd Round/shoe → publik gameView →
presentationEvents(prevView, view, op) → ordnad presentation[].

De sex verkliga typerna är speak, deal, reveal, settle, turn och idle.
Det vanliga spelet använder sitt befintliga klientflöde; V3-adaptern och
labbets konsumtion av presentation[] är inte redan inkopplade i det spelet.

Kevins granskade app-referens läser cfg.clipAssignments[dealer] och
neverAgain. BO erbjuder elva platser: box0–6, dealer-up, dealer-hole,
return och idle. I flyFromShoe mappas aktuell kortdestination till rätt
BO-plats; id söks i performance-manifestets takes och continuations.
Idle-val kan ändra CLIP.idle. Ingen direkt läsning av
clipAssignments.return hittades i den referensen: fortsättningar hanteras
i continuation-flödet. Riggade och andra specialvägar har egna villkor.

Partnerpresentationens deal-action-familjer är:

- box 0–1 → deal-left.
- box 2–4 → deal-centre.
- box 5–6 → deal-right.
- dealern → deal-dealer; faceDown skiljer utdelning av uppkort och hålkort.
- reveal visar ett redan utdelat hålkort när det blivit offentligt.
  Det får inte bli ännu en deal.

Astrids publicerade performance-manifest har fyra grundtakes:

- astrid-centre-native-20260909 → centre-native-review.mp4.
- astrid-dealer-front-contact-20260909 → dealer-front-review.mp4.
- astrid-left-outlet-contact-20260909 → left-outlet-review.mp4.
- astrid-right-outlet-contact-20260909 → right-outlet-review.mp4.

Två continuations beskriver fortsatt utdelning/retur:

- astrid-centre-return-review-20260910 → centre-return-review.mp4.
- astrid-left-return-review-20260910 → left-return-review.mp4.

Alla sex har status review. De är katalogiserade, inte härmed live-godkända.
buildAssetsManifest filtrerar bara rejected ur takes och utelämnar
take-status och mediahash i sina deal-utdata. En strikt framtida V3-
allowlist måste därför kontrollera en fullständig katalogrevision.

Publicerade stream-index innehåller 89 poster: Astrid 19 (17 tal, 1 idle,
1 action), Vera 39 (32 tal, 2 idle, 5 action), Amira 16 (15 tal, 1 idle)
och Mei 15 (14 tal, 1 idle). Lokal Astrid har dessutom action-return och
därmed 20; lokalt totalantal är 90. Ljudbankerna saknar totalt 13
motsvarande speak-indexnycklar: Vera 8, Amira 2, Mei 3, inklusive Mei push.
Detta mäter bank→index och säger inte att alla andra talrader är visuellt
godkända eller att alla indexklipp används.

## Föreslaget nodträd

Blackjack
→ dealer (Astrid, Vera, Amira, Mei)
→ semantisk eventnod
→ valfritt subevent (exakt destination, talrad eller deluppgift)
→ variant med trigger/prioritet/fallback
→ take-id
→ videofil och dess kompletta metadata-/talpaket.

Utgångspunkten är labbets 16 semantiska noder, med samma nycklar per dealer:

1. speak.goodluck: op=start publicerar goodluck, blocking.
2. speak.insurance: ny övergång till insurance publicerar insurance.
3. speak.double: accepterad act/double publicerar double.
4. speak.other: övriga exakta talrader. Separata subevents för placebets,
   dealerblackjack, blackjack, dealerbust, win, push och lose.
5. deal.player.left: deal-left; subevents box0 och box1.
6. deal.player.centre: deal-centre; box2, box3 och box4.
7. deal.player.right: deal-right; box5 och box6.
8. deal.dealer: to=dealer; dealer-up respektive dealer-hole.
9. reveal.dealer: hålkort blir offentligt; befintligt shoeDraw bevaras.
10. turn.player: publicerad box, handIndex och legalActions.
11. settle.blackjack: någon publicerad hand har outcome=blackjack.
12. settle.dealerBust: dealerTotal>21 enligt labbets matchning.
13. settle.win: någon outcome=win efter mer specifika labbmatchningar.
14. settle.push: samtliga publicerade outcomes=push, icke-tom lista.
15. settle.other: övriga resultat/förlust/blandade resultat.
16. idle.ready: publicerat idle efter collect.

Dessa är inte 16 nya typer i spelmotorn. Den befintliga labbkatalogen har
två varianter per nod och 32 enkla animationer, inte fyra kompletta
videobibliotek. Det föreslagna trädet är en utvidgning av den indelningen.

Om tre variantplatser **inkluderar baslinjen**:
4 × 16 × 3 = **192 variantplatser**.
Om tre extra varianter ligger utöver baslinjen blir antalet 256.
En takemängd är ett annat mått: tre inspelningar med samma betydelse kan
vara tre takes inom en enda variant.

De destinationer och talrader som visas ovan ger som utbyggnadsexempel
27 slutliga event/subevent-familjer per dealer:
16 − 5 + (7 + 2 + 3 + 2 + 2) = 27.
27 × 4 × 3 = 324 variantplatser före ytterligare takes. Detta är
planeringskapacitet, inte ett produktionskrav eller antal färdiga videor.

## Triggers, subevents och fysiska cues

En trigger gör en variant valbar efter ett riktigt source-event.
Den får läsa redan publicerade fält som line, box, faceDown, dealerTotal
och hands[].outcome. Den skall ha dokumenterad prioritet, fallback och
eventuell cooldown. Antal varianter är inte ett skäl att hitta på nya
spel-event eller hemliga villkor.

Labbets noder väljs genom första match i katalogordning. Extra varianter
filtreras av when.all och sorteras på prioritet/id, men baslinjen väljs
när ingen giltig separat rådgivning accepteras. Det är inte redan en
automatisk produktionsväljare av godtycklig video.

Labbets dealerBust-match skiljer sig från produktionsfrasens villkor:
frasen dealerbust kräver även en vinnande hand, och produktionskoden
har en bestämd prioritet mellan dealerblackjack, blackjack, dealerbust,
win, push och lose. Mappningen måste behålla rätt fras och inte härleda
en motstridig reaktion. settle bör hantera tyst gest/UI medan det
efterföljande speak-eventet äger den exakta repliken.

Prepare → pickup → handoff → release → land → return är delar av en
fysisk rörelsesekvens. pickup/release/land/rest är kalibrerade frame-cues
inne i takes, inte ytterligare server-events. Destinationsnoder måste
bevara målpunkt, kortidentitet, ingångspose och utgångspose.

Chatt, språkpreferens, återkomst och vinst/förlusthistorik är simulerade
labbkontexter. De är inte införda V3-produktionstriggers. Fysisk bets-open,
stand-nick, clear-table och chip-payout behöver eget avgränsat underlag;
inga fullständiga videokopplingar till dem verifierades i denna översyn.

## Placering utan att röra Kevins nuvarande filer

Föreslagen logisk adress:

blackjack/astrid/deal.player.left/box1/line/<take-id>/video.mp4

Ett event.yaml beskriver sourceRef, matchning, subevents, baslinje,
varianter, prioritet, cooldown och fallback. Ett take.yaml beskriver
take-id, dealer, generation-id/proveniens, modell/promptreferens, media-src,
originalhash, bearbetad mediahash, format, fps/frame-index, cues,
kalibrering och acceptansanteckningar.

Börja med media-src som pekar på befintliga filer. Skapa ingen kopia i
live-media förrän Kevin valt hur en godkänd katalogrevision skall införlivas.

Tre statusfält behöver vara åtskilda:

- intakeVerdict: want / no / utan omdöme, direkt från API.
- reviewStatus: draft / review / approved / rejected, knutet till exakt
  video-/audiohash, kalibrering och visuell evidens.
- activeBinding: faktisk dealer + BO-plats/runtimekonfiguration och revision.

Tal är ett paket: exakt text, ljud, video, frame-index, kalibrering och
acceptans. Varken längdmatchning eller en generisk talvideo är giltig
fallback för en annan line.

## Konkreta konflikter och kvarstående frågor

Generation d8214fb8-fef1-4810-a29e-70230d1baa20 har want i API men
[handoff](../../JOHN-HANDOFF.md) dokumenterar att kamera/miljö byttes och
taken avvisades. Kartan lägger den i karantän för ny avstämning.

I [performance-proveniens](../../../web/public/dealers/astrid/performance/provenance.json)
finns också no-märkta originalkällor, bland annat centre-entry-clean och
dealer-front-continuation, som beskrivs som komponenter i äldre staged
material. Ett nytt intake-omdöme är inte automatiskt ett fullständigt
beroendebeslut för varje bearbetad take. Konflikten måste granskas; denna
översyn ändrar inte gamla filer eller aktiva kopplingar.

## Lagring och hämtning — uppföljande kontroll 20 september

GitLabs main hämtades på nytt och var b14765971ca9f697a7fa14ffc0ea13570453b789
(18 september). Följande mäter filernas storlek i just det Git-trädet,
inte Git-historik, ospårade filer eller den driftsatta serverns lediga disk:

| Mängd | Storlek |
| --- | ---: |
| Alla spårade filer | 3,069 GB |
| web/public | 412,4 MB |
| Astrids performance-mapp med kringmaterial | 106,7 MB |
| De fyra dealernas 90 indexerade H.264-klipp | cirka 67,8 MB |
| Grundmanifestets fyra takes och två continuations | 31,1 MB |
| Separat generationsarkiv, 224 original | 1,023 GB |

Siffrorna överlappar och ska inte summeras. Vera använder fortfarande
web/public/dealer, medan Astrid, Amira och Mei använder dealers/<namn>.
Main innehåller inga filer under web/public/bo/gen. Generations-API:t och
BO-klippvalen finns i den granskade Kevin-grenen och API:t är live, vilket
inte innebär att GitLab-main är identisk med den driftsatta appen.

Backoffice Generations visar bo/gen/<generation-id>.mp4. Generations-API:t
läser samma katalog och samma originalfiler. Det lokala råarkivet är en
identisk kopia av dessa 224 filer. Performance/streams är ett separat lager
av spelmaterial, ofta bearbetat med egna bytes, masker och kalibrering.
BETTALOTTO_API är credential-variabeln för åtkomst, inte namnet på ett extra
videolager. /api/bo/config returnerar val av klipp; det är inte råvideoregistret.

DealerEngine hämtar först streams/index.json och därefter hela efterfrågade
H.264-filer till en Map med ArrayBuffer. Det är ingen kontinuerlig
livesändning. Uppspelningar återanvänder bytes i minnet. Cachen saknar en
uttrycklig storleksbudget/utkastning under sessionen. PerformancePlayer
förladdar hela MP4-takes i aktiverat staged-läge, kontrollerar SHA-256 och
spelar via blob-adresser; dessa frigörs vid dispose.

Live-kontrollen verifierade GET-registret (224 poster), en 32-byte
delhämtning av original (206), och delhämtning av H.264/MP4 (206).
Originalets svar hade private, max-age=3600 och hash-ETag. Vanlig GET för
performance-MP4 gav no-cache och ETag; delsvaret gav no-store. Dessa
kontroller mätte protokollbeteende, inte maximal trafik eller samtidighet.

Bedömning, inte benchmark: spårbarhet 8/10, mappstruktur 5/10, hämtning och
återanvändning 7/10, skalbarhet 4/10; sammantaget 6/10. Manifest/hashar är
en styrka. Blandade arbets-/runtimefiler, media direkt i Git, fullfilshämtning
och obegränsad cache är de främsta förbättringspunkterna.

Vid mätningen fanns cirka 180 GB ledigt på C: och 736 GB på D:.
Originalens genomsnitt på 4,565 MB ger 0,876 GB för 192 filer eller
1,479 GB för 324 filer. Detta är ett planeringsexempel med en fil per plats;
bearbetningar, masker och flera takes tillkommer. Serverns lediga disk,
bandbredd och samtidighetsgräns är inte uppmätta.

Fortsatt rekommendation: behåll råarkivet separat och nuvarande runtimevägar;
låt eventträdet referera till generation-id och bearbetad take. Inför senare
begränsad förladdning för vald dealer, minnesbudget och versionsbundna
mediefiler som kan cachelagras länge. Separat medielagring/CDN kan därefter
byta fysisk plats utan att den logiska eventadressen ändras.

## Kontroller av leveransen

- Git-versionen byggdes om deterministiskt från snapshot och mall. Inbäddad
  data stämdes av mot snapshoten och API-nyckeln saknas i samtliga leveransfiler.
- Den portabla servern klarade 15 HTTP-kontroller: karta, HEAD, byteintervall,
  saknat arkiv, okända resurser, otillåtna metoder/host/origin samt avvisning
  av felaktig storlek/hash. Testkopior användes för avvikande videofiler.
- Webbläsaren öppnade Git-versionen och en lokal 1920×1080-video nådde
  readyState 4 utan mediafel eller konsolfel. Detta verifierar previewvägen.
- API-antalet och samtliga 224 lokala filer stämdes av med storlek och SHA-256.
- Nodantal, unika generation-id:n, 27 subevent-familjer, take-referenser,
  dokumentlänkar och frånvaro av API-nyckeln i leveransfilerna verifierades.
- HTML-skriptets syntax och canvas-filens strikta TypeScript-kontroll passerade.
- Webbläsaren visade kartan, dealerbyte och exakta tal-subevents. Mei/push
  visade korrekt saknad videokoppling. Sökning på ett generation-id gav rätt
  ensam registerpost och dess statuskonflikt.
- En lokal råvideo laddade metadata och bild i previewn och spelades till
  slut utan mediafel. Detta är ett test av kartan,
  inte en acceptansgranskning av dealer-rörelsen i det riktiga spelet.

Kvar att verifiera inför verklig koppling:

- Aktuella BO-val och den faktiskt driftsatta app-revisionen.
- Visuell dealeridentitet, talrad och faktiska destinationer för kandidater.
- Vilka två extra variantgrenar per familj som har meningsfulla, tillåtna
  triggers; alternativt om önskemålet avser tre takes i samma baspool.
- Kalibrering, hashbunden acceptans och två uppspelningar i faktisk spelare.
- Kevin-beslut om slutlig katalogform och integration.

Ingen gameplay-, player-, media-, kalibrerings- eller databasfil ändrades.
Ingen ny Jira CAC-implementation genomfördes och inget CAC-issue markerades
klart. Rapporten är en inventering och arkitekturkarta, inte dealer-QA.
