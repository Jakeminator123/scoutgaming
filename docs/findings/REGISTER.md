# Register över fynd

Startat 20 september 2026. Detta är en första sammanställning av redan
dokumenterade observationer, inte en fullständig revision av repot.
Evidensen nedan hänvisar till källornas daterade kontroller; denna
sammanställning har inte gjort nya liveanrop eller produkt-QA.
Begrepp och arbetssätt finns i [README](README.md). Personarkivet är
avskilt; tidigare rapporterade reproduktioner är bevarade som daterade
observationer nedan, inte omkörda genom dokumentationsändringen.

**Jira CAC äger implementationens status.** Arbetsstatus här avser bara
triage. Ingen Jira-referens är ännu angiven för posterna nedan.

| ID | Område och observation | Typ | Evidensnivå | Arbetsstatus för triage |
| --- | --- | --- | --- | --- |
| [F-001](#f-001-samtidiga-medieladdningar-lämnar-en-blob-url-utanför-städningen) | PerformancePlayer: samtidiga laddningar och Blob-städning | bugg | reproducerad | Inväntar Kevins godkännande A |
| [F-002](#f-002-staged-förladdning-startar-före-första-idle) | Astrid staged: prioritet för första bilden | förbättring | kodfynd | Inväntar Kevins godkännande B |
| [F-003](#f-003-http-cache-och-medieversionering-behöver-en-samlad-plan) | HTTP: cacheheaders och medieversionering | förbättring | reproducerad | Behöver avstämning |
| [F-004](#f-004-källmaterial-och-qa-material-följer-med-public-trädet) | Distribution: källmaterial och QA-paket | förbättring | förslag | Behöver beroendekontroll |
| [F-005](#f-005-partnerklassificeringen-använder-split-men-motorn-splitfrom) | Partner: klassificering av 21 efter split | granskningsbehov | kodfynd | Behöver reproduktion |
| [F-006](#f-006-talbankernas-täckning-mot-exakta-videonycklar-är-ofullständig) | Media: exakt taltäckning | granskningsbehov | kodfynd | Behöver omfattningskontroll |
| [F-007](#f-007-aktuella-produktbindningar-till-videor-är-inte-verifierade) | BO/konfiguration: aktuell användning av videor | granskningsbehov | reproducerad | Behöver läsande avstämning |

## F-001: Samtidiga medieladdningar lämnar en Blob-URL utanför städningen

- **Område / typ / evidens:** PerformancePlayer / bugg / reproducerad i
  isolerad minnesreproduktion, dokumenterad 2026-09-20.
- **Observation:** `source()` kontrollerar `assets` före fetch men lagrar
  resultatet först efter hämtning, hashkontroll och skapad Blob-URL. Två
  samtidiga anrop för samma hash gav två fetch-anrop, två hashningar och två
  URL:er, men bara en cachepost. `dispose()` återkallade en av URL:erna.
  Sekventiella anrop återanvände ett resultat.
- **Gräns:** Detta visar fel i samtidighet och resurshantering. Det bevisar
  inte dubbel bild, viss RAM-förbrukning eller två fulla nätöverföringar i
  en verklig webbläsarsession.
- **Kod / källa:** [performance-player.mjs](../../web/public/performance-player.mjs),
  metoderna `source`, `preload`, `dispose`;
  reproduktion och omfattning, avsnitt 1 och 5 (historiskt rapportunderlag, ej i aktiv läsväg).
- **Arbetsstatus:** Inväntar Kevins godkännande A. Ingen fix utförd inom fyndet.
- **Nästa steg:** Efter uttryckligt besked samordnas pågående laddningar per
  verifierat medieinnehåll. Kontrollera retry efter fel, flera konsumenter,
  avbruten konsument och dispose under/efter laddning så att sena resultat
  inte lämnar resurser kvar. Följ därefter repoets player-/media-QA.
- **Beslut / beroende:** Jakob har villkorat lokala player-/videoändringar
  med Kevins godkännande. [Ping, del A](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870554825)
  är skickat; det är inte ett godkännande. F-002 behöver separat besked.
- **Jira-ref:** Ingen angiven. Koppla till rätt CAC-issue före implementation.

## F-002: Staged-förladdning startar före första idle

- **Område / typ / evidens:** Astrids staged-start / förbättring / kodfynd.
- **Observation:** I `dealer=astrid&performance=staged&motion=smooth60`
  startar `app.mjs` de dokumenterade 18 förladdningsposterna om 9 035 338
  byte före `engine.init()`. Anropen inväntas inte och kan konkurrera med
  laddningen av första idle. Detta är en särskild staged-väg; vanliga
  spelet hämtar efterfrågade klipp för vald dealer.
- **Gräns:** Kodordningen är belagd. Försämrad starttid och en viss
  sekundvinst är inte uppmätta. Att ta bort förladdning kan i stället
  flytta väntan till första kortet.
- **Kod / källa:** [app.mjs](../../web/public/app.mjs), blocket
  `if(performanceStaged)` och anropen till `performancePlayer.preload`;
  [DealerEngine](../../web/public/dealer-engine.mjs);
  prioritetsförslaget, avsnitt 4–5 (historiskt rapportunderlag, ej i aktiv läsväg).
- **Arbetsstatus:** Inväntar Kevins godkännande B. Ingen prioriteringsändring utförd.
- **Nästa steg:** Efter besked mäts kall/varm start, första målade idle,
  första replik och första landade kort. Pröva sedan första idle med rätt
  matte före begränsad bakgrundsladdning; behåll komplett nästa kedja av
  take, joins och ready.
- **Beslut / beroende:** [Ping, del B](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870554825).
  F-001 påverkar samtidiga laddningar men är en separat ändring. Samma
  godkännandegräns gäller; ett allmänt samordningssvar räcker inte.
- **Jira-ref:** Ingen angiven. Implementation och QA följs i CAC.

## F-003: HTTP-cache och medieversionering behöver en samlad plan

- **Område / typ / evidens:** Statisk medieleverans / förbättring /
  reproducerad begränsad HTTP-kontroll i källrapporten.
- **Observation:** Två kontrollerade publika filer gav GET 200 med
  `no-cache`/ETag, Range 206 med `no-store` och villkorat 304 med `no-store`.
  I serverkoden är media fortfarande ändringsbar under samma filnamn;
  kommentaren kräver återvalidering för att undvika gammal H.264 mot nytt index.
- **Gräns:** Protokollsvaren är belagda för de två filerna, inte all media
  eller alla driftlägen. `no-cache` tillåter lagring med återvalidering.
  Fyndet är inte ett belägg för felaktigt visad media eller en uppmätt
  trafik-/starttidsförlust.
- **Kod / källa:** [web/server.mjs](../../web/server.mjs), statisk
  filhantering för 200/206/304;
  cachekontrollen, avsnitt 3 (historiskt rapportunderlag, ej i aktiv läsväg);
  [tidigare lagrings- och HTTP-kontroll](../animation-events/v3-video-map/README.md).
- **Arbetsstatus:** Behöver avstämning; ingen cacheändring beslutad här.
- **Nästa steg:** Beskriv en säker versionskoppling mellan index, media och
  hash. Kontrollera därefter önskade headers för 200/206/304 och respektive
  publik/åtkomstskyddad resurs, innan längre cachetid föreslås.
- **Beslut / beroende:** Kräver eget beslut om versionering och publicering.
  Ingår inte i Kevins A/B-fråga. Löser inte ensamt F-001:s dubbla hashning
  eller Blob-URL:er.
- **Jira-ref:** Ingen angiven.

## F-004: Källmaterial och QA-material följer med public-trädet

- **Område / typ / evidens:** Paketering och lagring / förbättring / förslag.
- **Observation:** Inventeringen av Git-trädet `b147659`, kontrollerad
  20 september 2026, skiljer 412,4 MB under `web/public`
  från cirka 67,8 MB i de 90 indexerade H.264-klippen och 31,1 MB i sex
  performance-MP4. De senare mängderna ingår i public. Underlaget pekar ut
  cirka 121,8 MB käll-/QA-kandidater, ungefär 30 procent av public, för
  beroendegranskning inför ett separat produktpaket.
- **Gräns:** Detta är inte 121,8 MB bevisat oanvända filer eller en
  raderingslista. Original, dry-ljud, kalibrering, previews och reviewvägar
  kan ha beroenden. Filer som spelaren aldrig hämtar kostar inte automatiskt
  nedladdning hos spelaren. Enbart nya mappnamn sparar inga bytes.
- **Kod / källa:** [inventering och lagringsgränser](../animation-events/v3-video-map/README.md);
  QA-paketering, avsnitt 4 (historiskt rapportunderlag, ej i aktiv läsväg);
  [SPEECH-SYNC.md](../SPEECH-SYNC.md), om bevarade original som warp-källa.
- **Arbetsstatus:** Behöver beroendekontroll; ingen flytt eller radering beslutad.
- **Nästa steg:** Bygg en uttrycklig fillista för produktleverans och
  separata QA-/källpaket. Granska både spelarens och verktygens referenser;
  mät det faktiska paketet före/efter och bevara proveniens och återställning.
- **Beslut / beroende:** Kräver beslut om vad som distribueras respektive
  arkiveras. Ändringar av godkända mediebytes kräver ny tillhörande granskning.
  Flytt mellan lager är inte samma sak som minskad total bevarad lagring.
- **Jira-ref:** Ingen angiven.

## F-005: Partnerklassificeringen använder split men motorn splitFrom

- **Område / typ / evidens:** Partner-presentationens resultatklass /
  granskningsbehov / kodfynd.
- **Observation:** Partnerns `outcome` testar `!h.split` när tvåkortshänder
  med värdet 21 klassificeras som blackjack. Motorns handmodell använder
  `splitFrom`, och `isNatural` kräver uttryckligen `splitFrom === null`.
  Fältskillnaden kan ge fel presentationsklass/replik för 21 efter split.
- **Gräns:** Detta är ett kodfynd som behöver isolerad reproduktion, inte
  en verifierad driftincident. Ingen felaktig utbetalning är belagd här;
  utbetalningar ägs av motorn, inte presentationsklassificeringen.
- **Kod / källa:** [partner-presentation.mjs](../../web/partner-presentation.mjs),
  `presentationEvents`/`outcome`; [blackjack.mjs](../../web/public/blackjack.mjs),
  `isNatural`, handmodell och `split`;
  [eventregistrets rådataförklaring](../systemkarta/02-events-triggers-urval/EVENTREGISTER.md).
- **Arbetsstatus:** Behöver reproduktion och avstämning av presentationskontraktet.
- **Nästa steg:** Jämför naturlig blackjack med tvåkortshand på 21 efter
  split i ett isolerat motor-/adapterfall. Ta med box 0: `splitFrom: 0`
  får inte misstas för osplittad hand genom ett sanningsvärdestest.
  Kontrollera både `settle.hands[].outcome` och efterföljande `speak.line`.
- **Beslut / beroende:** Fastställ förväntad presentationsklass med
  kontraktsansvarig och aktuell CAC-issue innan ändring. Testa utan verklig
  användardatabas; bevara motorns auktoritativa utfall och belopp.
- **Jira-ref:** Ingen angiven.

## F-006: Talbankernas täckning mot exakta videonycklar är ofullständig

- **Område / typ / evidens:** Talmedia för fyra dealers / granskningsbehov /
  kodfynd i den daterade bank→index-inventeringen.
- **Observation:** Inventeringen fann 13 bankposter utan motsvarande
  speak-indexnyckel: Vera 8, Amira 2 och Mei 3, däribland Mei `push`.
  Den mätningen säger inte att alla dessa poster måste spelas i varje
  spelväg eller att det saknas varje möjlig alternativ mediekoppling.
- **Gräns:** Detta är en täckningslucka mellan registren, inte ett
  godkännande av övriga klipp eller 13 reproducerade fel i produktion.
  Native talmedia och faktiskt använda bankposter behöver kontrolleras.
- **Kod / källa:** [inventeringens bank/index-resultat](../animation-events/v3-video-map/README.md);
  [speech-media.json](../../web/public/speech-media.json),
  [speech-lines.mjs](../../web/public/speech-lines.mjs);
  mediarötterna `web/public/dealer` för Vera och
  `web/public/dealers/{astrid,amira,mei}` för övriga dealers.
- **Arbetsstatus:** Behöver omfattningskontroll per exakt talrad.
- **Nästa steg:** Lista de berörda nycklarna med text, ljud, faktisk
  spelanvändning, eventuell native-videokoppling och fallback. Prioritera
  därefter de saknade paket som behövs för verifierade användarflöden.
- **Beslut / beroende:** En taländring kräver text, ljud, video, frame-index,
  kalibrering och acceptansanteckningar tillsammans. F-007 avgör vilka
  produktbindningar som faktiskt är aktiva; det är en separat kontroll.
- **Jira-ref:** Ingen angiven. Matcha full Expected Result i CAC innan arbete.

## F-007: Aktuella produktbindningar till videor är inte verifierade

- **Område / typ / evidens:** BO och aktiv produktkonfiguration /
  granskningsbehov / reproducerad åtkomstbegränsning i den daterade rapporten.
- **Observation:** Inventeringens försök att läsa `/api/bo/config` gav 401,
  och ingen inloggad BO-session fanns tillgänglig. Dagens faktiska
  `cfg.clipAssignments` kunde därför inte fastställas där. Generations-ID,
  ett `want`-omdöme, ett manifest eller korrekt hash visar inte vilket klipp
  en aktuell session använder.
- **Gräns:** Rapporten belägger att den kontrollen inte kunde slutföras.
  Den belägger inte att bindningarna är fel, tomma eller oförändrade nu.
  Ingen ny BO-/livekontroll gjordes för detta register.
- **Kod / källa:** [videoinventeringens källor och verifieringsgräns](../animation-events/v3-video-map/README.md),
  särskilt skillnaden mellan generationsregistret och `cfg.clipAssignments`;
  [eventregistrets statusdimensioner](../systemkarta/02-events-triggers-urval/EVENTREGISTER.md).
- **Arbetsstatus:** Behöver läsande avstämning av aktuell konfiguration.
- **Nästa steg:** Med behörig läsande BO-åtkomst fastställ dealer, plats,
  generation/take, konfigurationsrevision och driftsatt revision. Knyt
  observationen till ett konkret spel-/previewläge och datum.
- **Beslut / beroende:** Kräver rätt läsåtkomst och kännedom om aktuell
  miljö. Generations-API:ts scope är inte BO-konfigurationens scope.
  Intake, visuell review och aktivering ska fortsatt hållas isär.
- **Jira-ref:** Ingen angiven.
