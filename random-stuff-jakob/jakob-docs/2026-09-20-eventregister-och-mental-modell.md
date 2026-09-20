# Eventregister och mental mappmodell

Arbetsmodell för Jakob, 20 september 2026. Jakob vill tills vidare se systemet
som ett mappträd. Trädet nedan är en **logisk vy över referenser**, inte ett
beslut att flytta videor eller ändra spelmotorns kontrakt.

Underlaget är lokal spelkod, [V3-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/animation-events-v3-s03),
[videoinventeringen](../../docs/animation-events/v3-video-map/README.md) och
den parallella OPENCLAW-uppgiftens nya labbfiler. Spelkoden lästes vid lokalt
HEAD `d910ddc`; labbets startprojekt lästes som `studio.2026-09-20.2` och
OPENCLAW-uppgiftens nya labbarbete blev under granskningen lokalt committat
som `b26ff83`. Detta dokument påstår inte att allt är publicerat eller att
Kevins senaste remote-head har kontrollerats.

**Finns** betyder läst i kod/data. **Labb** betyder en implementerad
illustration eller simulerad kontext. **Förslag** betyder ännu inte infört.
`sourceStatus: verified` avser eventets källa, inte godkänd video.

## 1. Mappträdet vi använder för att tänka

```text
Spel
├── Blackjack [implementerad motor; labbets enda gameId]
│   └── Dealer: Astrid / Vera / Amira / Mei
│       ├── Tal
│       │   ├── Start och insatser
│       │   │   └── goodluck, placebets
│       │   ├── Spelhandlingar
│       │   │   └── insurance, double
│       │   ├── Resultatrepliker
│       │   │   └── dealerblackjack, blackjack, dealerbust, win, push, lose
│       │   └── Övrigt tal från klient och ljudbank
│       │       └── greeting, bust, sidebet, peek, farewell,
│       │           chatter1, chatter2 och informationsrepliker
│       ├── Kortutdelning
│       │   ├── Vänster → box0, box1
│       │   ├── Mitten  → box2, box3, box4
│       │   ├── Höger   → box5, box6
│       │   └── Dealer → uppkort, hålkort
│       ├── Kortvisning
│       │   └── Reveal av det befintliga hålkortet
│       ├── Turmarkering
│       │   └── Aktiv box och hand
│       ├── Resultatgest
│       │   └── blackjack, dealerBust, win, push, other
│       ├── Vänteläge
│       │   └── idle och tillgängliga väntande gester
│       └── Övergångar
│           └── Retur, fortsättning och övergång mellan poser
└── Roulette [framtida plats i labbets gränssnitt; ingen implementerad modell]

Varje exakt presentationsbehov
└── Dealerlinje
    ├── Standardvariant [alltid tillgänglig]
    └── Namngivna alternativ
        └── Referenser till triggers [alla valda villkor måste vara sanna]

Varje variant
├── Labb: assetId → syntetisk rörelse
├── Labb: valfri videoGenerationId → exakt originalpreview
└── Föreslagen produktkoppling: tillåtna takeId:n
    └── Video + eventuellt ljud + kalibrering + originalreferenser
```

Kategorierna Tal/Kortutdelning/etc. är presentationsmappar i vår mentala vy.
De sju kategorierna är inte sju nya motor-events. Övergångar beskriver främst
spelarens mediesekvenser, inte ytterligare händelser från spelmotorn.

En samma rörelsefil kan refereras av flera dealerlinjer. En take kan stödja
flera mål genom uttrycklig kalibrering. Triggers kan återanvändas av flera
varianter. Därför passar **stabila ID:n och referenser** bättre än att varje
sak bara får finnas i en enda fysisk undermapp.

## 2. Orden och kopplingarna

| Begrepp | Betydelse | Exempel |
| --- | --- | --- |
| Command | Begäran till motorn; kan accepteras eller avvisas. | `act` med `action: double` |
| Intern motorhändelse | Händelse inne i Round; inte automatiskt publik. | Ett internt kortdrag |
| Publik spelvy | Aktuell, filtrerad bild av bordet efter ett command. | `round.hands`, `round.phase` |
| Presentationsevent | En bestämd sak klienten ska visa/höra. | `type: deal`, `box: 3` |
| Eventnod | Labbets klassificering av ett presentationsevent. | `deal.player.centre` |
| Matchning | Väljer nod utifrån eventets källa/fält. | `clip.action = deal-centre` |
| Dealerlinje | Dealer + eventnod + standard och alternativ. | Astrid + `deal.player.centre` |
| Trigger | Ett villkor som gör en variant valbar efter matchningen. | `event.box = 3` |
| Variant | Ett alternativt uttryck för samma presentationsbehov. | Lugn delning till samma mål |
| Take | En konkret inspelning med eget innehåll och granskning. | `astrid-centre-native-20260909` |
| Asset | I labbet en syntetisk animation; mediaregistren har andra roller. | `deal.player.centre.standard` |
| Bindning | Referens från vald variant till media; produktbindning behöver starkare kontroll. | `videoGenerationId` i labbet |

**En labblinje är inte samma sak som `speak.line`.** Labblinjen är en
konfigurationspost för dealer/event. `speak.line` är den exakta repliken som
produkten redan har valt. `speak.other` samlar flera sådana repliker; en
gemensam talvideo kan inte säkert ersätta dem.

En trigger skapar inte själv ett spel-event. Beröm i chatten kan i dagens
labb göra ett alternativ valbart vid nästa testade event. En spontan reaktion
direkt när chatt anländer skulle kräva en separat, beslutad eventkälla.

## 3. Vilka register finns faktiskt?

| Register | Auktoritativ källa i dag | Innehåll/status |
| --- | --- | --- |
| Spel | `gameId` i [projektet](../../lab/policies/project.seed.json), [valideringen](../../lab/lib/studio-model.mjs) | Endast `blackjack`. Roulette är en UI-platshållare. Ingen generell `games[]` finns. |
| Dealers | `dealers[]`, `DEALER_IDS`; [produktens DEALERS](../../web/public/app.mjs) | `astrid`, `vera`, `amira`, `mei`. |
| Motor och publik spelvy | [shoe-game.mjs](../../web/shoe-game.mjs), [blackjack.mjs](../../web/public/blackjack.mjs) | Regler, kommandon, interna händelser, publika fakta. |
| Presentationstyper | [partner-presentation.mjs](../../web/partner-presentation.mjs) | Sex typer; rå kontraktskälla till labbets klassificering. |
| Labbnoder | `events[]` | 16 ordnade, låsta matchningar. |
| Triggers | `triggers[]` | 9 namngivna startvillkor, redigerbara inom tillåtna fält. |
| Dealerlinjer/varianter | `lines[].variants[]` | 64 linjer, 4 startvarianter vardera = 256 variantposter. |
| Labbassets | `assets[]` | 64 delade animationsreferenser. |
| Rörelsedata | [animations/index.json](../../lab/animations/index.json), 16 eventfiler | 64 tysta 2D-klipp; inte 256 dealerfilmer. |
| Originalvideor | [snapshot.json](../../docs/animation-events/v3-video-map/snapshot.json), externt råarkiv | 224 inventerade generationer. Snapshot, ingen livesynk. |
| Vanliga spelklipp | Dealernas `streams/index.json` | 90 indexposter lokalt; tal/idle/actions. |
| Exakt tal | Dealerljudbanker, [speech-lines.mjs](../../web/public/speech-lines.mjs), [speech-media.json](../../web/public/speech-media.json) | Text, ljud, matchande klipp och vissa MP4 med inbyggt ljud. |
| Fysiska takes | [Astrids performance-manifest](../../web/public/dealers/astrid/performance/manifest.json) | 4 grundtakes + 2 continuations, samtliga `review`; dessutom särskilda review-manifest för andra bearbetningar. |
| Produktens aktiva val | Produktkonfiguration, körläge och aktuell kodrevision | Aktuella BO-bindningar är inte verifierade här. |

Seedräkningen gäller `studio.2026-09-20.2`, inte automatiskt ett tidigare
sparat användarprojekt. Det normala `lab/data/project.json` saknades vid
kontrollen. Äldre QA-data ska inte importeras som riktiga bindningar.

| Dealer | Produktens mediarot | Tal / idle / actions i stream-index |
| --- | --- | --- |
| Astrid | `web/public/dealers/astrid` | 17 / 1 / 2 |
| Vera | `web/public/dealer` | 32 / 2 / 5 |
| Amira | `web/public/dealers/amira` | 15 / 1 / 0 |
| Mei | `web/public/dealers/mei` | 14 / 1 / 0 |

## 4. Rådata och vägen från spel till presentation

```text
Spelarens command
    ↓
Serverns shoe + Round + regler + transaktion
    ↓
gameView(): filtrerad publik spelvy
    ├── /api/table → vanliga webbklientens befintliga koreografi
    └── /api/v1/table → presentationEvents(föregående vy, ny vy, op, extra)
                            ↓
                       presentation[]
                            ↓
Labbets testinput → projektion → eventnod → triggerprövning → variantval
                                  ↑             ↑
                              eventregister   tillåten kontext
```

Partner-flödet finns, men labbet prenumererar inte automatiskt på ett riktigt
spelbord. Den vanliga webbklienten använder sin egen kodväg. En gemensam
produktionsadapter återstår att välja och granska med Kevin.

### Kommandon och intern motor

| `op` | Relevant input | Effekt |
| --- | --- | --- |
| `state` | Ingen spelhandling | Läs publik vy. Partner-svaret har tom `presentation[]`. |
| `start` | `bets` med `main`, `pp`, `tp` per box | Kontrollera insatser, debitera, starta omgång och vid behov blanda om. |
| `act` | `action`: `hit/stand/double/split` | Utför en av motorn tillåten handling. |
| `insurance` | `take`: boolean | Acceptera/avstå försäkring för samtliga spelbara händer. |
| `collect` | Ingen ytterligare spelhandling | Samla reglerade utbetalningar och återgå till nästa omgång. |

Mutationer använder request-ID för omförsök. Ordinarie API kräver rätt
version; Partner kontrollerar klientens version om den skickas, annars
används aktuell version. Partner-API:t kan normalisera glesa insatser med
`box` till motorns sju boxar. Dessa kommandon är inte namn på videor.

Motorns `Round.events` lagrar objekt som `{e, ...data}`. Hela den interna
händelselistan i den granskade koden är:

| Internt `e` | Payload utöver namnet | När det uppstår |
| --- | --- | --- |
| `round.dealt` | Inga extra fält | Initial utdelning och sidobetsresultat beräknade |
| `insurance.offered` | Inga | Dealerns uppkort är ess |
| `dealer.peek` | Inga | Kontroll av blackjack vid ess/tiovärde |
| `dealer.blackjack` | Inga | Kontroll hittar blackjack |
| `hand.thinking` | `box` | Nästa spelbara hand aktiveras |
| `card.dealt` | `box`, `card` | Hit/double eller nya kort efter split |
| `hand.split` | `box`, `seat`, `stake` | En extra hand skapas |
| `dealer.reveal` | Inga | Dealerns vanliga spelsekvens visar hålkortet |
| `dealer.draw` | `card` | Dealern drar enligt reglerna |
| `round.settled` | Inga | Resultaten har beräknats |

**Namnfallgrop:** interna `box` syftar på handindexet i den platta
handlistan. I `hand.split` är `seat` själva bordsplatsen. De publika
presentationerna skiljer på fysisk `box` och `handIndex`. Registren måste
ange vilken källa ett fält kommer från.

Det finns inga separata interna events med namnen `hit`, `stand`, `double`,
`collect`, `bust`, `sidebet`, `speak`, `idle` eller `shuffle` i denna lista.
Begreppen finns som handlingar, tillstånd eller klientbeteenden.
Partner-adaptern vidarebefordrar inte listan; den jämför publika vyer.

### Publik spelvy: mer data än de sex presentationstyperna

| Del | Publika fält i den granskade modellen |
| --- | --- |
| Bord | `version`, `round`, `shoe`; `shuffled` på mutationssvaret |
| Shoe | `id`, `total`, `remaining`, `dealt`, `cutAfter`, `cutReached`, `shufflePending`, `decks`, `burn` |
| Round | `boxes[]`, `hands[]`, `dealer[]`, `phase`, `active`, `holeDraw`, `legalActions[]` |
| Box/hand | `box`, `splitFrom`, `stake`, `pp`, `tp`, `cards[]`, `done`, `doubled`, `insured`, `result`, `sideReturn`, `sideLabels[]`, ibland `busted` |
| Synligt kort | `r` (valör), `s` (färg), `shoeDraw` (dragets identitet/ordningsnummer) |
| HTTP-svar | API:t tillför `balance`; Partner tillför även `requestId` och `presentation[]` |

Faserna är `dealing`, `insurance`, `decisions`, `dealer`, `settled`. De
synkrona dealing/dealer-stegen kan passera inom samma command; alla faser
behöver inte synas som egna nätverkssvar. `round` kan också vara `null`.

`holeDraw` avslöjar vilket drag hålkortet tillhör, inte valör/färg.
Spelvyn lämnar inte ut den framtida shoe-ordningen, burn-kortets valör/färg,
det ännu dolda hålkortets valör/färg eller interna eventpayloads.

### De sex publika presentationseventen

| `type` | Payload | När Partner-adaptern publicerar det |
| --- | --- | --- |
| `speak` | `line`, ibland `blocking` | Start → goodluck; ny insurancefas → insurance; accepterad double → double; ny settledfas → resultatfras; collect → placebets |
| `deal` | `to`, `box`, `handIndex`, `card`, `faceDown`, `shoeDraw`, `clip.action/prefer/fallback` | Nytt synligt kort, eller det dolda hålkortet vid start; ordnat efter dragnummer |
| `reveal` | `to`, `card`, `shoeDraw` | Tidigare dolt hålkort blir offentligt vid settlement |
| `turn` | `box`, `handIndex`, `legalActions[]` | Den nya vyn står i decisions; behöver inte vara en ändrad tur |
| `settle` | `dealerTotal`, `dealerBlackjack`, `hands[]` med `box/stake/returned/outcome` | Övergång till settled |
| `idle` | Inga ytterligare fält | Efter collect |

`goodluck` är blockerande. Dolt `deal.card` är `null`. `reveal` vänder ett
redan utdelat kort. `clip.prefer` använder i den granskade koden fortfarande
Astrid-specifika hintar och `fallback` är `slide`; ett färdigt universellt
takeval för fyra dealers kan inte härledas ur dessa hintar.

Transporten har dessutom SSE-namnen `hello` och `round`. SSE-`round` bär
presentationslistan som `events` tillsammans med bland annat op/version/phase.
De är transportmeddelanden, inte två extra presentationstyper.

### Vad kan mer bli input till registret?

| Källa | Vad som redan finns | Vad som återstår för labbpolicy |
| --- | --- | --- |
| Publik spelvy | Sidobet-resultat, bust, split/double, aktiva händer, shoe/cut, omblandning och pengar | Endast vissa fält projiceras till labbet; fler kräver en uttrycklig adapter och fältlista. |
| Föregående + ny vy och command | Övergångar, nytt kort, ändrad aktiv hand | Härledda triggers behöver källa och jämförelseregel. |
| Historik-API | Registrerade commands/resultat och tidpunkter | Vinst-/förlustföljder måste härledas; de är inte färdiga råa streak-events. |
| Vanliga klientens chatt | Manuellt `/chat` med `message`, de senaste historikposterna och `dealer`; svar `reply/say` | Detta är inte samma system som labbets simulerade `chat.signal`. Automatisk spelkommentar finns i kod men `AUTO_COMMENTARY=false`. |
| Partner-launch | Bland annat språk och valuta | Att ett språk finns i launch-token innebär inte att det redan matar labbets språkpreferens. |
| Tillgångskatalog | Dealer, scen, kamera, codec, frames, ljud/text, take/cues | Mediemetadata är en egen källa; inte spelutfall. |
| Labboperatör | Chattklass, återkomst, språk, historikräknare, framtoning | Manuella testvärden i dag. |

Den vanliga klienten anropar exempelvis `greeting` vid inträde, `bust`
efter ett för högt handvärde och `sidebet` när en sidobet vinner. Dessa är
verkliga klientbeteenden utöver Partner-listans tio exakta talrader.
Det gemensamma tal-ID-underlaget innehåller också `peek`, `farewell`,
`chatter1`, `chatter2`. Veras informationsbank har:

```text
rules_decks, rules_s17, rules_bj_pays, rules_insurance, rules_double,
side_pp, side_213, fair_rng, fair_streak, no_advice, no_predict,
rg_support, greet_back, who_are_you, limits_table, limits_vip,
no_peek, house_edge, thanks, small_talk, side_when, ask_me, farewell_bank
```

Detta är bankposter, inte nya spel-events eller en lista över godkända klipp.
Klienten filtrerar bort `rules_decks` och `fair_rng` från den laddade banken.
Alla poster har inte motsvarande talvideo. Partner-lobbyn listar i den
granskade koden bara `astrid-blackjack`; fyra dealeruppsättningar innebär
inte att fyra Partner-bord eller fler spel är publicerade.

Resultatdata kräver särskild noggrannhet: motorns `result` kan inkludera
försäkringsretur, medan `sideReturn` är separat. Partnerns `outcome` är en
härledd presentationsklass, inte beräkningen av utbetalningen. Dess test
av `h.split` vid blackjackklassificering behöver dessutom stämmas av mot
motorns faktiska `splitFrom`-fält. Registret bevarar därför både källreferens
och ursprungliga fält; denna uppgift ändrar inte adaptern eller resultaten.

OpenClaw får en **ännu smalare projektion**: relevanta publika kort/mål,
handutfall och legal actions samt de tillåtna kontextfälten. Pengafält och
onödiga mediehintar tas bort. Ett fält som är publikt i spelet blir alltså
inte automatiskt en tillåten trigger eller modellinput.

## 5. Hela registret över labbets 16 eventnoder

Matchningen använder första träff i katalogordning. Specificerade noder
kommer därför före `speak.other` och `settle.other`.

| Nod | Källa och matchning | Exakt underindelning i mental modell |
| --- | --- | --- |
| `speak.goodluck` | `speak`, `line=goodluck` | Startfras |
| `speak.insurance` | `speak`, `line=insurance` | Försäkringsinformation |
| `speak.double` | `speak`, `line=double` | Bekräftad dubbling |
| `speak.other` | Återstående `speak` | Minst `placebets`, `dealerblackjack`, `blackjack`, `dealerbust`, `win`, `push`, `lose`, separerade efter exakt line |
| `deal.player.left` | `deal`, `clip.action=deal-left` | `box0`, `box1` |
| `deal.player.centre` | `deal`, `clip.action=deal-centre` | `box2`, `box3`, `box4` |
| `deal.player.right` | `deal`, `clip.action=deal-right` | `box5`, `box6` |
| `deal.dealer` | `deal`, `to=dealer` | Uppkort respektive hålkort (`faceDown`) |
| `reveal.dealer` | `reveal` | Visa tidigare utdelat hålkort; inget nytt drag |
| `turn.player` | `turn` | Publicerad box/hand och tillåtna handlingar |
| `settle.blackjack` | `settle`, någon `hands[].outcome=blackjack` | Resultatgest |
| `settle.dealerBust` | Därefter `settle`, `dealerTotal>21` | Resultatgest; inte själv ett vinstbeslut |
| `settle.win` | Därefter `settle`, någon `outcome=win` | Kan även innehålla förlorande händer |
| `settle.push` | Därefter `settle`, alla outcomes är `push`, icke-tom lista | Resultatgest |
| `settle.other` | Återstående `settle` | Förlust, andra/blandade/tomma resultat som tidigare matcher inte fångat |
| `idle.ready` | `idle` | Vänteläge |

En dealer-blackjack kan exempelvis sammanfalla med push-resultat. Därför får
nodnamnet aldrig ersätta den exakta efterföljande `speak.line`. Partner-adapterns
resultatfras har egen ordning: dealerblackjack → blackjack → dealerbust med
vinnande hand → win → push utan förlorande hand → lose.

De finare undergrenarna är en föreslagen **registervy**. Dagens schema har
inte ett generellt `subevents[]`-fält och tillåter inte att man bara lägger
till godtyckliga eventnoder i seedfilen.

## 6. Triggers: alla startvillkor och möjliga nya

| ID | Kategori | Fält | Operator / värde |
| --- | --- | --- | --- |
| `returning-player` | social | `context.playerHistory.returning` | `eq true` |
| `preferred-german` | social | `context.playerHistory.preferredLanguage` | `eq "de"` |
| `recent-losses` | deterministic | `context.session.recentLosses` | `gte 2` |
| `chat-praise` | social | `context.chat.signal` | `eq "praise"` |
| `chat-boundary` | social | `context.chat.signal` | `eq "inappropriate"` |
| `recent-wins` | deterministic | `context.session.recentWins` | `gte 3` |
| `warm-mood` | temperament | `context.temperament.mood` | `eq "warm"` |
| `calm-mood` | temperament | `context.temperament.mood` | `eq "calm"` |
| `playful-mood` | temperament | `context.temperament.mood` | `eq "playful"` |

`deterministic` innebär här ett testbart villkor. Det innebär inte att
sessionshistoriken redan hämtas från spelservern. All kontext ovan är ännu
simulerad i labbet. `temperament` beskriver dealerns uttryck.

Följande ytterligare triggerposter kan beskrivas med **dagens tillåtna
fält**, men har inte lagts in av denna dokumentationsuppgift:

| Föreslaget ID | Villkor | Användning |
| --- | --- | --- |
| `centre-box3` | `event.box eq 3` | Ett alternativ för exakt mittplats inom rätt dealnod |
| `dealer-hole` | `event.faceDown eq true` | Presentation av dolt kort, utan att läsa dess identitet |
| `exact-push-line` | `event.line eq "push"` | Avgränsa en variant under `speak.other` till rätt replik |
| `split-available` | `event.legalActions includes "split"` | Turmarkering när split redan är tillåtet; inget råd att splitta |
| `preferred-swedish` | `context.playerHistory.preferredLanguage eq "sv"` | Språkpreferens; kräver separat exakt svensk tal-take för riktigt tal |

Flera triggers på en variant betyder **AND**. Tom lista betyder alltid
valbar; den betyder inte avstängd. `in` kan uttrycka flera alternativ för
ett enskilt fält. Godtyckliga nästlade AND/OR-träd finns inte i studioformatet.

Tillåtna fält enligt `allowedPathDescriptors` i
[studio-model.mjs](../../lab/lib/studio-model.mjs):

| Grupp | Samtliga tillåtna triggerfält |
| --- | --- |
| Typ och tal | `event.type`, `event.line`, `event.blocking` |
| Kort och mål | `event.to`, `event.box`, `event.handIndex`, `event.faceDown`, `event.clip.action`, `event.card.r`, `event.card.s` |
| Resultat och tur | `event.dealerTotal`, `event.dealerBlackjack`, `event.hands.outcome`, `event.hands.box`, `event.legalActions` |
| Historik | `context.session.recentWins`, `context.session.recentLosses` |
| Socialt | `context.chat.signal`, `context.playerHistory.returning`, `context.playerHistory.preferredLanguage` |
| Framtoning | `context.temperament.mood` |

Skalärer stödjer `eq/ne/in/exists`; tal dessutom `gt/gte/lt/lte`.
Arrayfält stödjer `includes/all_eq/exists`. Värden och intervall är begränsade.
Chattsignaler: `none/praise/inappropriate`. Språk: `null/en/sv/de/fr/es`.
Framtoning: `calm/warm/playful/reserved`. Vinster/förluster: heltal 0–100.

Detta är 21 fält i studions redigeringsmodell. Directors underliggande
motor tillåter dessutom `event.shoeDraw`, men studion exponerar ännu inte
det fältet som redigerbar trigger. Saknade fält ger inte träff med `ne`;
`exists` behandlar även `null` som frånvarande.

**Idéer som kräver utbyggnad:** cooldown, ”använd inte samma take två gånger”,
tid sedan senaste replik, spelarens explicita önskemål om mindre prat,
shoe/cut-card-kontext och en spontan chattreaktion. De behöver dokumenterad
källa, projektion och ibland tillstånd/schemaläggning. De är inte färdiga
triggers bara för att data går att föreställa sig. Pengafält, rå chatt och
hemlig shoe-ordning ingår inte i dagens triggerlista.

Arrayvillkor måste också användas rätt: `hands.box includes 3` tillsammans
med `hands.outcome includes win` bevisar inte att just box 3 vann. Villkoren
kan träffa olika händer; en sådan koppling behöver ett särskilt kontrakt.

## 7. Alla varianter utan att skriva samma 256 rader

Varje kombination av de fyra dealer-ID:na och de 16 nod-ID:na har fyra
startvarianter. Deras fullständiga ID är **`<dealerId>.<eventId>.<suffix>`**.
Detta mönster räknar upp hela mängden; etiketter och detaljrörelser finns i
startprojektet och respektive animationsfil.

| Suffix | Prioritet | Triggerreferenser | Roll |
| --- | ---: | --- | --- |
| `standard` | 0 | Inga | Obligatorisk ovillkorlig fallback |
| `contextual` | 10 | Enligt tabellen nedan | Första kontextalternativet |
| `motion3` | 20 | `chat-praise` AND `warm-mood` | Varm social labbgest |
| `motion4` | 15 | `playful-mood` AND `recent-wins` | Lekfull labbgest |

| Nod | `contextual`: etikett | Trigger-ID:n |
| --- | --- | --- |
| `speak.goodluck` | Välkommen tillbaka · tyska | `returning-player`, `preferred-german` |
| `speak.insurance` | Lugn information | `recent-losses` |
| `speak.double` | Vänlig bekräftelse | `chat-praise` |
| `speak.other` | Lugn gränssättning | `chat-boundary` |
| `deal.player.left` | Lugn delning vänster | `recent-losses` |
| `deal.player.centre` | Vänlig delning mitten | `chat-praise` |
| `deal.player.right` | Lugn delning höger | `recent-losses` |
| `deal.dealer` | Lugn delning croupier | `recent-losses` |
| `reveal.dealer` | Lugn kortvändning | `recent-losses` |
| `turn.player` | Vänlig turmarkering | `returning-player` |
| `settle.blackjack` | Lågmäld bekräftelse | `recent-wins` |
| `settle.dealerBust` | Tacka för beröm | `chat-praise` |
| `settle.win` | Lågmäld vinstreaktion | `recent-wins` |
| `settle.push` | Lugn bekräftelse | `recent-losses` |
| `settle.other` | Neutral gränssättning | `chat-boundary` |
| `idle.ready` | Välkommen tillbaka | `returning-player` |

`calm-mood` finns i triggerregistret men används inte av startvarianterna.
En redigerad linje får ha standard + högst fyra alternativ, alltså upp till
fem varianter; fyra är seedens nuvarande antal. Alla seedens
`videoGenerationId` är `null`.

Variantnamnen är labbexempel. Ett ”tyska”-namn skapar inget tyskt ljud och
en gest som heter ”gränssättning” skriver inte om den publicerade repliken.
Flera olika inspelningar av samma uttryck ska senare kunna vara **takes
inom samma variant**, snarare än nya motor-events.

## 8. Ja: JSON-formaten och mapparna finns redan

```text
lab/
├── policies/
│   └── project.seed.json       startdata: regler och referenser
├── schemas/
│   └── studio.schema.json     vilka projektfält och värden som får finnas
├── data/                      lokalt sparande, Git-ignorerat
│   ├── project.json           skapas när användaren sparar
│   └── history/               tidigare revisioner
├── animations/
│   ├── index.json             rörelsebibliotekets innehållsförteckning
│   └── <eventId>.json         fyra syntetiska klipp per eventnod
└── lib/
    ├── studio-model.mjs       referensvalidering och katalogkonvertering
    ├── project-store.mjs      sparande, revisioner och historik
    ├── motion-library.mjs     validering av rörelsefiler
    └── video-registry.mjs     läser befintligt originalregister

open-claw/lab/
├── schemas/
│   ├── event.schema.json      labbets projekterade eventformat
│   └── catalog.schema.json    katalogformat för urvalsmotorn
├── config/catalog.json        äldre/friliggande labbkatalog
└── src/engine.mjs             projektion, matchning, triggers och rådskontroll
```

Ett **schema** beskriver formen. **Projekt-JSON** innehåller instanserna.
**Rörelse-JSON** beskriver hur figuren rör sig. Samma ord ”JSON” betyder
alltså inte att de tre filtyperna har samma ansvar.

[studio.schema.json](../../lab/schemas/studio.schema.json) använder JSON Schema
2020-12. `validateProject` gör dessutom korsreferenskontroller, låser nodernas
ordning/källa och kräver alla 64 unika dealer/event-kombinationer. Det finns
ingen generell möjlighet att lägga in ett nytt spel eller en femte dealer
genom enbart en extra rad. Sådan utbyggnad kräver ändrade kontrakt.

[event.schema.json](../../open-claw/lab/schemas/event.schema.json) beskriver
labbets tillåtna projektion, inte hela den ursprungliga Partner-responsen.
`normalizeInput` är den körande gränsen som validerar och plockar ut fält.
Schemafilerna ensamma utgör inte alla kontroller som programmet gör.

Den äldre `open-claw/lab/config/catalog.json` har separat revision
`lab.2026-09-20.1`, 16 noder, 32 varianter och 32 assets. Den ska inte
summeras med studions 256 variantposter. Studions API skickar en tillfällig
katalog för valt projekt/dealer; det skriver inte över den äldre katalogen.

Rörelsefilerna har egen kodvalidering i `motion-library.mjs`; någon separat
`motion.schema.json` finns inte i denna version. Där finns numeriska spår för
`actor`, `face`, `leftArm`, `rightArm`, `blush`, med tid 0–1, position,
rotation och opacitet. Händelseval och triggers ligger kvar i policyprojektet.

Exempel på **två separata JSON-poster**, inte ett komplett importprojekt.
Den föreslagna triggern avgränsar en variant till mittplatsen:

```json
{
  "id": "centre-box3",
  "label": "Kort till mittplatsen",
  "category": "deterministic",
  "path": "event.box",
  "op": "eq",
  "value": 3
}
```

```json
{
  "id": "astrid.deal.player.centre.box3",
  "label": "Mittplatsens alternativ",
  "priority": 25,
  "triggerIds": ["centre-box3"],
  "assetId": "deal.player.centre.standard",
  "videoGenerationId": null
}
```

Här återanvänds medvetet en befintlig labbrörelse. Regeln demonstrerar en
referenskoppling och producerar inte en ny film. De två posterna skulle
läggas i `triggers[]` respektive rätt `lines[].variants[]`; standarden behålls.
Exemplen har inte sparats i användarens projekt.

## 9. Var OpenClaw kommer in

```text
Projekt-JSON + vald dealer
    ↓ buildRuntimeCatalog
En katalog för just denna dealer
    ↓
Publicerat event + tillåten kontext → normalisering
    ↓
Första matchande nod → tillåtna varianter → alltid tillgänglig standard
    ├── off: standard
    ├── rules: högst prioriterade tillåtna variant, utan modell
    ├── shadow: modellråd registreras, standard spelas
    └── active: endast ett giltigt råd för rätt anrop/katalog får användas
    ↓
Vald variant → labbanimation / separat originalpreview
```

`rules` är studions extra lokala urvalsläge. Den underliggande Director-motorn
har `off/shadow/active`. Samma lägeslista ska därför inte kopieras blint
mellan format.

`buildRuntimeCatalog` översätter `triggerIds` till konkreta `when.all`
predikat. `prepareDecision` matchar nod och filtrerar varianter; prioritet
sorteras fallande, sedan ID. OpenClaw får föreslå bland tillåtna ID:n.
`finalizeDecision` kontrollerar `requestId`, `catalogRevision` och
`variantId`. Studion binder katalogrevisionen till utkastets innehåll och
vald dealer för att avvisa inaktuella råd.

Fel, timeout, uteblivet råd eller otillåtet variant-ID ger standardvarianten.
I `active` behöver OpenClaws giltiga val inte vara den högst prioriterade
kandidaten; prioritet avgör direkt i `rules`.

Rådet är alltså inte en fri sökning bland alla MP4-filer. Generations-ID och
filväg följer inte med som fria medieval i modellens variantkontrakt.
Operatörschatten är ett separat anrop om labbprojektet. Den är inte
spelarchatt, spelminne eller en källa som får ändra spelresultat.

Den lokala studion kan anropa Render Director som i sin tur anropar privat
OpenClaw. Enligt OPENCLAW-uppgiftens daterade
[anslutningsnotering](2026-09-20-nodtrad-rorelser-anslutning.md) har riktiga
råd och operatörschatt provats mot Director `7f056f7`. Det provet tillhör
den uppgiften; denna dokumentation har inte gjort egna modell- eller
deployanrop. Produktkoppling och godkända dealerfilmer är separata steg.

## 10. Media, takes och aktivering i samma logiska register

```text
generationId + originalhash
    ↓ bearbetning och dokumenterad proveniens (kan ha flera original)
takeId + video-/audiohash + exakt innehåll + kalibrering + review
    ↓ föreslagen bindning för dealer/event/subevent/variant
godkänd katalogrevision + tillåtet körläge
    ↓
uppspelning i den gemensamma produktspelaren
```

Detta är målkedjan för produktintegration. Dagens labb kan redan binda
direkt till ett original för preview, men har inte en färdig sådan
take-katalog per variant.

| Statusdimension | Vad den säger |
| --- | --- |
| `intakeVerdict` | Originalet är `want`, `no` eller utan omdöme. |
| `reviewStatus` | Exakt bearbetad take är draft/review/approved/rejected enligt granskning. |
| `activeBinding` | Vilken konfiguration/revision som faktiskt väljer materialet. |

De tre namnen är föreslagna gemensamma registerfält; dagens filer använder
olika format. `want` innebär inte visuell acceptans. En ny mediehash
ogiltigförklarar tidigare acceptans för den ändrade taken.

Tal måste hålla ihop exakt text, ljud, video, frame-index, kalibrering och
granskningsanteckningar. Utdelning måste hålla ihop destination, kortidentitet
och rörelsens kontakt/landning. `pickup/release/land/rest` är frame-cues inne
i en take. Returer, joins och start/slutpose är relationer i spelaren.

Nuvarande grundtakes hos Astrid:

| Take-ID | Familj | Status |
| --- | --- | --- |
| `astrid-centre-native-20260909` | `deal-centre` | review |
| `astrid-dealer-front-contact-20260909` | `deal-dealer` | review |
| `astrid-left-outlet-contact-20260909` | `deal-left` | review |
| `astrid-right-outlet-contact-20260909` | `deal-right` | review |
| `astrid-centre-return-review-20260910` | Fortsättning från centre-taken | review |
| `astrid-left-return-review-20260910` | Fortsättning från left-taken | review |

Övriga review-bearbetningar, masker, actor-material och joins finns i egna
manifest och ska länkas via proveniens, inte räknas som nya spel-events.
Den daterade originalinventeringen har 224 poster: 17 want, 52 no och
155 utan omdöme. Lokala ljudbanker saknar 13 motsvarande speak-indexnycklar
(Vera 8, Amira 2, Mei 3). Det är täckningsluckor, inte godkännanden av resten.

## 11. Hur ett gemensamt register kan växa

Behåll först de befintliga filerna som källor. En registervy kan läsa dem och
visa följande logiska avdelningar utan att skapa lika många diskmappar:

```text
Register
├── Spel och kontrakt          gameId, status, adapter, eventkällor
├── Dealers                   dealerId, mediarot, språk/täckning
├── Eventkällor               intern motor / publik vy / presentation / klient
├── Presentationsbehov        eventnod + exakt talrad/mål
├── Triggers                  tillåten källa, predikat, kategori, status
├── Dealerlinjer och varianter baslinje, prioritet, triggerreferenser
├── Labbanimationer           assetId → rörelsefil
├── Original                  generationId, hash, intake
├── Takes                     takeId, innehåll, media, proveniens, review
└── Bindningar                variant → tillåtna takes + katalogrevision
```

Spel, dealers och triggers ska helst kunna ha egna registerposter som
refereras från flera vyer. **I dag är de flesta poster redan serialiserade
tillsammans i ett projekt-JSON.** Att dela upp dem fysiskt i fler filer är
en möjlig framtida lagringsändring, inte ett krav för att få mappkänslan.

Nästa avgränsade steg kan vara en läsande översikt över befintliga register,
med separat märkning av källa, labbexempel, förslag, saknad take och granskad
bindning. Exakta talrader och utdelningsmål behöver då synas under de breda
noderna. Ett nytt spel kräver därefter en egen publik eventadapter och
uppdaterade scheman/validering; dealerbilder och en menyetikett räcker inte.

Ingen ny konkurrerande runtimekatalog, schemafil eller fysisk medieflytt
införs av denna dokumentationsuppgift. De nya triggerexemplen och
take-poolerna är underlag för nästa beslut.

För en framtida gemensam registerpost är `sourceKind`, `sourceRef`,
`sourcePath`, `availability` och `derivedBy` användbara metadata: kommer
värdet från ett faktiskt motor-event, en publik vy, en härledning, en
operatör eller ett förslag? Det är ett designförslag; dessa extrafält får
inte stoppas direkt i dagens strikta studio-JSON.

## 12. Verifiering och kvarstående gränser

Dokumentets lokala länkar kontrollerades. Alla 16 noder och nio starttriggers
stämde med det lästa startprojektet. Båda JSON-exemplen parsades, och alla
fem föreslagna triggerposter godtogs av den riktiga `validateProject` i en
minneskopia. Exempelvarianten lades där till som femte variant och dess
härledda katalog validerades: box 3 gjorde varianten valbar och box 2 gjorde
den inte valbar. Inget användarprojekt sparades.

En separat läsgranskning kontrollerade motorfälten och en annan granskade
schema-/trigger-/OpenClaw-kopplingarna. Den nuvarande seedens fyra
dealerkataloger och 64 rörelseklipp passerade också sina rena validerare.
Detta verifierar dokumenterade format/referenser, inte nya visuella
godkännanden, belastning eller ett nytt spel-/modelltest.

Den här leveransen ändrar dokumentation. Den ändrar inte policies, lagrade
projekt, spelkod, media, databas eller OpenClaws konfiguration. Fullständig
produktintegration, aktuella BO-bindningar och hashbunden visuell take-QA
återstår. Den lokala GitLab-inboxens API-inloggning var inte tillgänglig i
denna process; den lokala OPENCLAW-uppgiften kunde ändå ge scoped återkoppling.
