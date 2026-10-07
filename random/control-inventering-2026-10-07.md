# Inventering av /control

Datum: 7 oktober 2026.

Syfte: Jakob bockar av rad för rad om varje sak en inloggad administratör ser under kontrollpanelen ska behållas, tas bort eller flyttas.

Sista kolumnen är tom med flit. Fungerar betyder att koden är kopplad. Attrapp betyder att saken syns men inte gör det den lovar. Oklart betyder att det krävs en körning för att avgöra. Inget är kört i webbläsaren.

Menyordning: Översikt, Studio (Dealers & klipp, Händelser → klipp, Klippbibliotek, Bakgrundszoner, Händelser), OpenClaw (Agentmodeller, Operatörschatt), Drift (Administration, Uppspelning, Talgranskning), Åtkomst (Partners), sedan Guide i sidfoten. Därefter sidor som inte ligger i menyn.

Den gamla inre menyn (Blackjack, Roulette, dealerväljare, eventsök) finns bara på Händelser och Klippbibliotek, inte på alla sju gamla sidor.

## Kortversion: de beslut som behövs

Orkestratorns sammanfattning, 7 okt kväll. Allt som inte står här föreslås **behåll** på nuvarande plats. Svara med gruppnummer (D1, A1 …) eller radnummer (C…). "John" betyder att raden redan ligger hos John i issue #2; då gäller rekommendationen om han inte svarat inom två arbetsdagar.

| Grupp | Vad | Rader | Rekommendation | Vem |
| --- | --- | --- | --- | --- |
| D1 | Sparstatus-pillret visas på upp till tre ställen per sida | C17, C35, C74, C75, C147, C171 | Bara topplisten C17; övriga bort | John (rad 13) |
| D2 | Dealerväljare | C38, C39, C95, C126, C87, C184 | Chips C38 kvar; dold lista C39 bort när testet skrivits om; gamla sidomenyns C95/C126 flyttar in i Händelser-sidan; C87 och C184 har andra syften, behåll | Jakob (rad 10) |
| D3 | Idle-inställningar på två sidor | C40, C49, C129 | En plats: fliken Idle på Dealers & klipp; Händelser länkar dit | John |
| D4 | Kort, repliker och mapplistor | C41, C42, C53, C83, C97, C100 | Behåll båda tills John sett tabellen; `changeView` byts mot länkar | John |
| D5 | Probe på två ställen | C44, C63–C66, C225 | Sidan `/control/probe` är platsen; fliken blir en länk | John (rad 17) |
| D6 | Bakgrund på tre ställen | C43, C62, C108–C125, C257 | Fliken länkar till Bakgrundszoner; aliaset pekar dit | John (rad 19) |
| D7 | OpenClaw två sidor med olika innehåll | C8, C9, C29, C146–C168, C264 | En sida med två flikar: Agentmodeller och Chatt | John (rad 18) |
| D8 | Händelser mot Händelser → klipp | C83, C86–C92, C126 | Behåll båda; länkar i stället för vybyte | John |
| D9 | Uppspelning tre vägar | C67, C80, C210–C222 | Egen sida C210 är platsen; C67 och C80 blir länkar | Jakob |
| D10 | Roulette som löfte | C89, C94, C241 | Ta bort tills Roulette finns | John (Johns regel: visa inget som inte fungerar) |
| D11 | Partners: menyrad mot administrationsflik | C13, C19, C31, C195 | Menyraden lämnar panelen till `/partner`; fliken C195 är inställningar. Behåll båda, byt namn på fliken | John |
| A1 | Sökfältet i topplisten, inte anslutet | C16 | Dölj tills sökning finns | John (rad 15) |
| A2 | Nio döda adresser som bara visar översikten | C24, C238–C246 | Ta bort | Jakob (rad 20, ja) |
| A3 | Valet Regelstyrd, avstängt | C51 | Ta bort eller behåll: ingen kod bakom | Jakob |
| A4 | Texter om att en åtgärd inte är ansluten | C173, C208 | Behåll texten tills servern har åtgärden; finns i lösa trådar L6 och L17 | – |
| A5 | Spara alla sparar en agent per klick | C155 | Behåll nu | Jakob (rad 9, beslutat) |
| A6 | Röstprovet visar tom text i molnläge | C167 | Miljö, inte fel; behåll | – |

Rör ej oavsett svar: bevarandelistan längst ner (inloggning, välj lösenord, probe-ytan, repliklistan och ljudfilerna, spelmotor och plånbok).

### Beslut 7 okt kl 18:45

Jakob delegerade alla beslut i tabellen till orkestratorn, även Johns rader. Varje rekommendation ovan gäller som beslut. Tillägg:

| Rader | Beslut |
| --- | --- |
| C72, C73 | Behåll: hopplänk och brödsmula ligger i sidmallen |
| C74, C75 | Bort: sparstatus bara i topplisten (D1) |
| C76 | Behåll på en plats: Händelser (projektet redigeras där) |
| C77 | Spara projekt bara på sidor där något redigeras: Händelser, Klippbibliotek, Talgranskning |
| C78, C79 | Bort: menyn har Uppspelning och Operatörschatt |
| C80 | Bort: Uppspelning är egen sida (D9); loggen sparas i sessionStorage så den följer med |
| C81 | Bort: skalets statusfält ersätter sidfoten |
| C51 (A3) | Behåll: visar bara ett redan sparat värde, lovar inget |
| D4, D8 | Behåll båda; `changeView` byts mot länkar med `?dealer=&event=` |
| D7 | `/control/openclaw` får flikarna Agentmodeller och Chatt via `?tab=chat`; `/control/operator-chat` omdirigerar dit |
| D11 | Fliken Partner i administrationen döps om till Partnernycklar |
| D10 | Bort: C94 knappen, C89 texten i nodträdet, C241 notisen |
| A1 | Sökfältet döljs |

## Skal (sidomeny och topplist)

Syns på alla kontrollsidor utom inloggning och välj lösenord.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Logotypen scout/gaming | Klickar och kommer till översikten. | ja | – | lab/components/workspace-navigation.tsx:46 | |
| C2 | Menyrad Översikt | Öppnar översikten. | ja | C23 | lab/lib/scout-navigation.mjs:8 | |
| C3 | Menyrad Dealers & klipp | Öppnar dealerns klippsida. | ja | C34 | lab/lib/scout-navigation.mjs:14 | |
| C4 | Menyrad Händelser → klipp | Öppnar sidan som kopplar händelser till klipp. | ja | C82 | lab/lib/scout-navigation.mjs:15 | |
| C5 | Menyrad Klippbibliotek | Öppnar klippbiblioteket. | ja | C99 | lab/lib/scout-navigation.mjs:16 | |
| C6 | Menyrad Bakgrundszoner | Öppnar bakgrundszoner. | ja | C109 | lab/lib/scout-navigation.mjs:17 | |
| C7 | Menyrad Händelser | Öppnar den gamla händelseytan. | ja | C126 | lab/lib/scout-navigation.mjs:18 | |
| C8 | Menyrad Agentmodeller | Öppnar val av modell per agent. | ja | C146 | lab/lib/scout-navigation.mjs:24 | |
| C9 | Menyrad Operatörschatt | Öppnar chatten med OpenClaw. | ja | C158 | lab/lib/scout-navigation.mjs:25 | |
| C10 | Menyrad Administration | Öppnar administrationen. | ja | C169 | lab/lib/scout-navigation.mjs:32 | |
| C11 | Menyrad Uppspelning | Öppnar sidan som följer spelets uppspelning. | ja | C210 | lab/lib/scout-navigation.mjs:33 | |
| C12 | Menyrad Talgranskning | Öppnar probesidan, inte administrationens flik med samma namn. | ja | C224, C205 | lab/lib/scout-navigation.mjs:34 | |
| C13 | Menyrad Partners | Lämnar kontrollpanelen och öppnar spelbolagens yta. | ja | C19, C31 | lab/lib/scout-navigation.mjs:40 | |
| C14 | Menyrad Guide & hjälp | Öppnar guiden längst ner i menyn. | ja | C226 | lab/lib/scout-navigation.mjs:46 | |
| C15 | Brödsmula Nivå 1 / sidnamn | Visar vilken sida som är öppen. Byter inte sida. | ja | – | lab/components/workspace-navigation.tsx:63 | |
| C16 | Sökfält i topplisten | Ser ett sökfält. Under det står "Inte ansluten ännu". Det söker inte. | attrapp | – | lab/components/workspace-navigation.tsx:64 | |
| C17 | Statuspiller i topplisten | Ser om sidan är sparad eller har osparade ändringar, när sidan skickar en status. | ja | C35, C74, C147, C171 | lab/components/workspace-navigation.tsx:26 | |
| C18 | Nivåväxlare 1 · Admin | Stannar på kontrollpanelen. | ja | – | lab/lib/scout-navigation.mjs:53 | |
| C19 | Nivåväxlare 2 · Spelbolag | Öppnar spelbolagens yta. | ja | C13, C31 | lab/lib/scout-navigation.mjs:54 | |
| C20 | Nivåväxlare 3 · Spelare | Öppnar spelarens yta. | ja | C32 | lab/lib/scout-navigation.mjs:55 | |
| C21 | Knapp för ljust eller mörkt läge | Växlar mellan ljust och mörkt skal. | ja | – | lab/components/theme-toggle.tsx:23 | |
| C22 | Dold text "Nivå 1 · ScoutGamingGroup" | Texten finns i sidhuvudet men är dold för ögat. | ja | – | lab/components/workspace-navigation.tsx:49 | |

## Översikt (`/control`)

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C23 | Rubrik Översikt | Läser att det är den gemensamma arbetsytan och ser vem som är inloggad. | ja | C247 | lab/components/control-workspace.tsx:27 | |
| C24 | Notis "exempelvyn är inte ansluten" | Ser notisen bara om adressen är en av de nio döda exempeladresserna. Översikten själv visar den inte. | attrapp | C238–C246 | lab/components/control-workspace.tsx:30 | |
| C25 | Knappen Lanes, bord & konton | Den gröna knappen öppnar administrationen. | ja | C10, C169 | lab/lib/control-workspace.mjs:26 | |
| C26 | Kort Dealer & klipp | Öppnar dealerns klippsida. | ja | C3, C34 | lab/lib/control-workspace.mjs:27 | |
| C27 | Kort Presentationshändelser & regler | Öppnar Händelser → klipp. | ja | C4, C82 | lab/lib/control-workspace.mjs:28 | |
| C28 | Kort Klippbibliotek | Öppnar klippbiblioteket. | ja | C5, C99 | lab/lib/control-workspace.mjs:29 | |
| C29 | Kort OpenClaw & drift | Öppnar Agentmodeller, inte operatörschatten. Texten lovar mer än sidan visar. | ja | C8, C146 | lab/lib/control-workspace.mjs:30 | |
| C30 | Kort Uppspelningsdiagnostik | Öppnar Uppspelning. | ja | C11, C210 | lab/lib/control-workspace.mjs:31 | |
| C31 | Länk Nivå 2 · Spelbolag | Öppnar spelbolagens yta. | ja | C13, C19 | lab/components/control-workspace.tsx:37 | |
| C32 | Länk Nivå 3 · Spelare | Öppnar spelarens yta. | ja | C20 | lab/components/control-workspace.tsx:38 | |
| C33 | Länk Läs guiden | Öppnar guiden. | ja | C14, C226 | lab/components/control-workspace.tsx:39 | |

## Dealers & klipp (`/control/clips`)

Astrid har de fem flikarna. Vera, Amira och Mei har bara Idle, Kort & deal och Fasta repliker, och där en enklare klipplista.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C34 | Sidhuvud Dealers & klipp | Läser sidans namn och en kort förklaring. | ja | – | lab/components/lab-studio.tsx:120 | |
| C35 | Piller Sparat i Studio | Ser om ändringarna är sparade. Samma piller syns också i topplisten. | ja | C17 | lab/components/lab-studio.tsx:124 | |
| C36 | Knappen Ladda upp klipp | Öppnar uppladdningen. Syns för Astrid på Idle, Kort & deal och Fasta repliker. | ja | C47 | lab/components/lab-studio.tsx:126 | |
| C37 | Knappen Spara inställningar | Sparar dealerns val. Kan vara låst tills spelanslutningen är på. På uppladdningsflikarna finns den både som grön knapp och som en extra knapp under flikarna. | ja | C77 | lab/components/lab-studio.tsx:118 | |
| C38 | Dealerväljare (chips) | Väljer Astrid, Vera, Amira eller Mei. | ja | C95, C184 | lab/components/lab-studio.tsx:130 | |
| C39 | Dold dealerväljare | En osynlig lista som gör samma val som chipsen. Den finns kvar för ett gammalt test. | ja | C38 | lab/components/lab-studio.tsx:131 | |
| C40 | Flik Idle | Ställer in vänteläget. | ja | C49, C129 | lab/lib/dealer-workspace.mjs:3 | |
| C41 | Flik Kort & deal | Visar utdelningsklipp. | ja | C53, C100 | lab/lib/dealer-workspace.mjs:4 | |
| C42 | Flik Fasta repliker / ljud | Visar de fasta replikerna. | ja | C53, C61 | lab/lib/dealer-workspace.mjs:5 | |
| C43 | Flik Bakgrund | För Astrid: en länk till bakgrundszoner. För de andra: en text om att bakgrund inte finns här. | ja | C6, C109 | lab/components/lab-studio.tsx:143 | |
| C44 | Flik Probe | För Astrid: inställningar för egna tal när spelaren är tyst. För de andra: en text om att det bara gäller Astrid. | ja | C12, C224 | lab/components/lab-studio.tsx:142 | |
| C45 | Varning om spelanslutning | Ser en varning och kan inte spara om anslutningen saknas. | ja | – | lab/components/lab-studio.tsx:135 | |
| C46 | Konflikt vid sparning | Om någon annan sparat samtidigt får man slå ihop utkasten. | ja | – | lab/components/lab-studio.tsx:138 | |
| C47 | Uppladdning av klipp | Väljer film, namn och exakt plats eller replik, och sparar klippet. | ja | C36 | lab/components/family-video-upload.tsx:89 | |
| C48 | Knappen Läs in nya idle-klipp | Läser in nya vänteläge-klipp. | ja | C101 | lab/components/lab-studio.tsx:144 | |
| C49 | Idle-redigeraren | Väljer huvudloop, variationer, när klippet får användas, och kan spela ett minutprov. | ja | C129 | lab/components/idle-policy-editor.tsx:157 | |
| C50 | Sökfält Hitta idleklipp | Söker bland vänteläge-klipp. | ja | – | lab/components/idle-policy-editor.tsx:169 | |
| C51 | Val Regelstyrd · ej ansluten | Syns bara om ett klipp redan är märkt så, och går inte att välja. | attrapp | – | lab/components/idle-policy-editor.tsx:174 | |
| C52 | Knappen Spela en minut | Spelar ett lokalt prov av vänteläget. Det styr inte spelet. | ja | – | lab/components/idle-policy-editor.tsx:191 | |
| C53 | Lista Kort & deal eller Fasta repliker | Ser mapparna, kan spela standardklippet och öppna inställningar. | ja | C100 | lab/components/family-video-library.tsx:51 | |
| C54 | Sökfält Hitta klipp eller mapp | Söker namn, replik eller plats. | ja | C100 | lab/components/family-video-library.tsx:57 | |
| C55 | Knappen Inställningar på ett klipp | Öppnar standard, varianter och hur ofta klippet får väljas. | ja | C140 | lab/components/family-video-library.tsx:63 | |
| C56 | Knappen ← Alla klipp | Går tillbaka från ett öppnat klipp till listan. | ja | – | lab/components/lab-studio.tsx:146 | |
| C57 | Filmspelare för valt klipp | Spelar klippet. Texten säger att förhandsvisningen inte styr spelet. | ja | – | lab/components/lab-studio.tsx:146 | |
| C58 | Frekvens och villkor för varianten | Ställer in hur ofta ett utdelningsklipp används, eller när en replikvariant får väljas. | ja | C140 | lab/components/media-family-editor.tsx:47 | |
| C59 | Knappen Läs om videomapparna | Läser in mapparna på nytt. | ja | C48 | lab/components/media-family-editor.tsx:53 | |
| C60 | Enklare klipplista för Vera, Amira och Mei | Väljer vilket registrerat klipp som hör till varje rörelse. | ja | C106 | lab/components/legacy-clip-editor.tsx:27 | |
| C61 | Utfällbar lista Förinspelade exakta talpar | På Astrids replikflik: samma typ av lista för redan inspelade repliker. | ja | C60 | lab/components/lab-studio.tsx:149 | |
| C62 | Länk Öppna bakgrundszoner | På Bakgrund-fliken för Astrid. Texten säger att zonerna ännu inte styr spelets bakgrund. | ja | C6, C109 | lab/components/lab-studio.tsx:143 | |
| C63 | Probe-läge Av, Textprov, Automatiskt | Väljer om Astrid ska vara tyst, bara provas i text, eller prata själv i spelet. | ja | C225 | lab/components/probe-editor.tsx:37 | |
| C64 | Probe-fält och knappen Prova text | Ställer in väntetid och modell, och kan prova en text. Texten blir varken ljud eller film. | ja | C225 | lab/components/probe-editor.tsx:39 | |
| C65 | Knappen Snabbt inaktivitetsprov | Fyller i korta väntetider. De gäller i spelet först efter sparning. | ja | – | lab/components/probe-editor.tsx:44 | |
| C66 | Länk Öppna separat talprov | Öppnar Astrid i spelet för ett talprov, om ett lokalt spel är anslutet. Annars bara en förklaring. | oklart | – | lab/components/probe-editor.tsx:64 | |
| C67 | Utfällbar Granska i spel | Följer spelflikens uppspelning och kvitton. | ja | C210 | lab/components/lab-studio.tsx:150 | |
| C68 | Knappen Anslut & följ spelet | Öppnar spelet och visar kvitton här. | ja | C215 | lab/components/partner-reference.tsx:216 | |
| C69 | Knappen Öppna spelet | Öppnar spelet i en ny flik utan att nödvändigtvis följa kvittona. | ja | C216 | lab/components/partner-reference.tsx:216 | |
| C70 | Knappen Exportera observationsprotokoll | Sparar ner det som setts. | ja | C221 | lab/components/partner-reference.tsx:245 | |
| C71 | Knappen Ny observation | Börjar en ny följning. Spelet fortsätter. | ja | C222 | lab/components/partner-reference.tsx:246 | |

## Gemensamt på sju gamla sidor

Sidorna är Händelser → klipp, Klippbibliotek, Händelser, Uppspelning, Talgranskning, Guide och Operatörschatt. De ligger i Johns meny, men innehållet är den gamla ytan. Länkar inuti den byter innehåll och adress, men menyn till vänster hänger inte alltid med.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C72 | Länk Hoppa till arbetsytan | Hoppar förbi sidhuvudet. | ja | – | lab/components/studio.tsx:372 | |
| C73 | Sidhuvud med brödsmula | Ser Blackjack, dealerns namn och sidans namn, plus en märkning STUDIO. | ja | – | lab/components/studio.tsx:372 | |
| C74 | Piller Sparad eller Ej sparad | Ser sparstatus både i sidhuvudet och i topplisten. | ja | C17 | lab/components/studio.tsx:372 | |
| C75 | Text Osparade ändringar | Samma besked som pillret, en gång till i sidhuvudet. | ja | C74 | lab/components/studio.tsx:372 | |
| C76 | Knappen Exportera projekt | Laddar ner projektets inställningar som en fil. | ja | – | lab/components/studio.tsx:365 | |
| C77 | Knappen Spara projekt | Sparar inställningarna. | ja | C37 | lab/components/studio.tsx:372 | |
| C78 | Länk Spelarchatt vid bordet | Byter till Uppspelning inuti samma fönster. Saknas på Operatörschatt. | ja | C11, C210 | lab/components/studio.tsx:379 | |
| C79 | Länk Fråga OpenClaw om labbet | Byter till Operatörschatt inuti samma fönster. Saknas på den sidan själv. | ja | C9, C158 | lab/components/studio.tsx:379 | |
| C80 | Kort händelselogg längst ner | Visar de senaste händelserna och en länk som öppnar hela Uppspelning. På Uppspelning är loggen hela sidan. | ja | C210 | lab/components/studio.tsx:385 | |
| C81 | Sidfot Croupier Lab | Visar en fast textrad och om OpenClaw är konfigurerat eller om läget är lokalt. | ja | – | lab/components/studio.tsx:386 | |

## Händelser → klipp (`/control/tree`)

Sidan öppnas alltid med Astrid. Om Astrid har videomappar, vilket är det vanliga, syns mapparna. Det stora nodträdet används bara när dealern saknar mappar. Menyn laddar om sidan med Astrid, så nodträdet kan vara omöjligt att nå den vanliga vägen.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C82 | Rubrik Nodträdet | Ser sidans namn i sidhuvudet. Innehållet under är mapparna, inte ett träd, när Astrid har mappar. | ja | – | lab/components/studio.tsx:371 | |
| C83 | Tre mapplistor | Ser kort till rätt plats, exakta repliker och vänteläge, och kan klicka en mapp. | ja | C53, C100 | lab/components/family-video-library.tsx:26 | |
| C84 | Klick på en mapp | Öppnar händelseytan för den platsen, i samma fönster. | ja | C126 | lab/components/studio.tsx:381 | |
| C85 | Utfällbar Övriga spelsignaler | Visar tur och resultat som inte har en egen filmapp, och kan öppna dem. | ja | C97 | lab/components/family-video-library.tsx:30 | |
| C86 | Nodträd för dealer utan mappar | Ser spel, dealer, grupper, varianter och villkor, och kan klicka sig fram. | oklart | C98 | lab/components/event-tree.tsx:100 | |
| C87 | Dealerväljare i nodträdet | Byter dealer. Syns bara i nodträdet, inte i mapplistan. | oklart | C38, C95 | lab/components/event-tree.tsx:124 | |
| C88 | Filter för presentationssätt | Filtrerar Idle, handling, tal och tur. Bara i nodträdet. | oklart | – | lab/components/event-tree.tsx:131 | |
| C89 | Text Roulette · senare | En text, inte en knapp. Roulette går inte att välja. | attrapp | C94 | lab/components/event-tree.tsx:121 | |
| C90 | Knapp Öppna editorn / Redigera | Hoppar till händelseytans redigerare. Bara i nodträdet. | oklart | C141 | lab/components/event-tree.tsx:184 | |
| C91 | Knapp Öppna operatörschatten | Hoppar till operatörschatten. Bara i nodträdet. | oklart | C9, C158 | lab/components/event-tree.tsx:184 | |
| C92 | Knapp till videofilen | Hoppar till klippbiblioteket. Bara i nodträdet. | oklart | C5, C99 | lab/components/event-tree.tsx:184 | |

## Klippbibliotek (`/control/videos`)

Här finns den gamla inre menyn. För Astrid är innehållet en mapplista. För de andra är det det äldre biblioteket.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C93 | Knappen Blackjack | Visar att blackjack är valt. Gör inget mer. | ja | C126 | lab/components/studio.tsx:373 | |
| C94 | Knappen Roulette · Senare | Syns avstängd. Roulette finns inte. | attrapp | C89 | lab/components/studio.tsx:373 | |
| C95 | Dealerväljare | Byter dealer i en lista. | ja | C38 | lab/components/studio.tsx:373 | |
| C96 | Sökfält Hitta ett event | Filtrerar mapparna eller händelselistan till vänster. | ja | C126 | lab/components/studio.tsx:373 | |
| C97 | Lista Videomappar | Kort till plats, exakt replik och vänteläge. Klick öppnar händelseytan. | ja | C83 | lab/components/family-video-library.tsx:18 | |
| C98 | Lista Eventträd | För dealer utan mappar: grupperna Idle, handling, tal och tur. | oklart | C86 | lab/components/studio.tsx:373 | |
| C99 | Rubrik Videobanken | Sidans namn i sidhuvudet. | ja | – | lab/components/studio.tsx:371 | |
| C100 | Mapplista Dina videomappar | Söker, spelar standard och öppnar inställningar. Samma lista som på Dealers & klipp, men för alla mappar på en gång. | ja | C53 | lab/components/family-video-library.tsx:51 | |
| C101 | Knappen Läs in nya filer | Läser in filmregistret igen. | ja | C48 | lab/components/family-video-library.tsx:51 | |
| C102 | Äldre bibliotek | För dealer utan mappar: söker, filtrerar och kopplar en film till en variant. | oklart | – | lab/components/video-library.tsx:42 | |
| C103 | Sökfält i äldre bibliotek | Söker namn eller filmens id. | oklart | C96 | lab/components/video-library.tsx:79 | |
| C104 | Filter i äldre bibliotek | Filtrerar källa, typ, dealer, händelse och bedömning. | oklart | – | lab/components/video-library.tsx:78 | |
| C105 | Knappen Koppla loss video | Tar bort kopplingen mellan variant och film. | oklart | – | lab/components/video-library.tsx:36 | |
| C106 | Enklare klipplista under biblioteket | Samma lista som för Vera, Amira och Mei, även på den här sidan. | ja | C60 | lab/components/studio.tsx:378 | |
| C107 | Varning om videokopplingar | Om kopplingar är felaktiga finns en länk som stannar på den här sidan. | ja | – | lab/components/studio.tsx:377 | |

## Bakgrundszoner (`/control/zones`)

Egen sidtopp, inte den vanliga sidmallen. Zonerna styr inte spelet.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C108 | Länk ← Dealers & klipp | Går tillbaka till klippsidan. | ja | C3 | lab/components/background-zones.tsx:378 | |
| C109 | Rubrik Bakgrundszoner | Ser att det gäller Astrid. | ja | C43 | lab/components/background-zones.tsx:378 | |
| C110 | Knappen Exportera koordinater | Laddar ner zonernas mått. Avstängd om inga zoner finns. | ja | – | lab/components/background-zones.tsx:378 | |
| C111 | Knappen Spara till molnet | Sparar zonerna i molnet. Avstängd om molnet inte är konfigurerat. | oklart | – | lab/components/background-zones.tsx:381 | |
| C112 | Knappen Läs från molnet | Hämtar molnets zoner till en egen vy. Webbläsarens kopia ligger kvar. | oklart | – | lab/components/background-zones.tsx:381 | |
| C113 | Knappen Till webbläsarkopian | Går tillbaka till zonerna som bara finns i den här webbläsaren. | ja | – | lab/components/background-zones.tsx:381 | |
| C114 | Knappen Återställ molnutkast | Tar tillbaka osparade molnändringar. Syns bara om ett utkast finns. | ja | – | lab/components/background-zones.tsx:381 | |
| C115 | Väljare Underlag för prov | Byter mellan startbild och en dealerfilm bakom zonerna. | ja | – | lab/components/background-zones.tsx:384 | |
| C116 | Rita en zon | Drar en ruta på startbilden. | ja | – | lab/components/background-zones.tsx:385 | |
| C117 | Lista över zoner | Klickar en zon för att redigera den. | ja | – | lab/components/background-zones.tsx:395 | |
| C118 | Fält för namn och pixelruta | Byter namn och mått, och sparar rutan. | ja | – | lab/components/background-zones.tsx:396 | |
| C119 | Väljare Blandning | Väljer ljus blandning eller vanlig video. | ja | – | lab/components/background-zones.tsx:399 | |
| C120 | Väljare Uppspelning | Väljer hela tiden, automatiskt eller av. | ja | – | lab/components/background-zones.tsx:400 | |
| C121 | Knappen Ladda ned zonens startbild | Sparar en bild av rutan. | ja | – | lab/components/background-zones.tsx:403 | |
| C122 | Knappen Skapa blinkklipp | Skapar ett litet klipp i rutans storlek. | ja | – | lab/components/background-zones.tsx:403 | |
| C123 | Lägg in eget zonklipp | Laddar upp en film som måste ha rutans exakta storlek. | ja | – | lab/components/background-zones.tsx:403 | |
| C124 | Knappen Ladda ned klipp | Sparar zonens film. Syns när ett klipp finns. | ja | – | lab/components/background-zones.tsx:404 | |
| C125 | Knappen Ta bort zon | Tar bort zonen. | ja | – | lab/components/background-zones.tsx:404 | |

## Händelser (`/control/events`)

Samma gamla yta som klippbiblioteket, med inre meny. För Astrid och vänteläget visas idle-redigeraren. Annars visas händelsens film, chatt och test.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C126 | Inre meny | Blackjack, avstängd Roulette, dealerväljare, sök och mapplista eller eventlista. | ja | C93–C98 | lab/components/studio.tsx:373 | |
| C127 | Varning om fel kopplingar | Knappen Rätta första kopplingen hoppar till varianten som behöver rättas. | ja | – | lab/components/studio.tsx:376 | |
| C128 | Länk Granska i Videobanken | Hoppar till klippbiblioteket inuti samma fönster. | ja | C5, C93 | lab/components/studio.tsx:377 | |
| C129 | Idle-redigerare | När vänteläget är valt för Astrid: samma redigerare som fliken Idle. | ja | C49 | lab/components/studio.tsx:380 | |
| C130 | Väljare av situation | Väljer exakt plats eller replik för händelsen. | ja | C83 | lab/components/media-family-editor.tsx:15 | |
| C131 | Talets källa | För händelser utan filmapp: väljer vilken replik som visas, eller öppnar talklippen. | ja | – | lab/components/speech-source.tsx:12 | |
| C132 | Scen med film eller 2D-figur | Spelar klippet eller en enkel figur om filmen saknas. | ja | – | lab/components/stage.tsx:117 | |
| C133 | Knappar Video / 2D och Bara 2D | Byter hur förhandsvisningen ritas. | ja | – | lab/components/stage.tsx:118 | |
| C134 | Knappen Spela valt klipp | Spelar det valda klippet direkt, utan att låta regler eller modell välja. | ja | – | lab/components/stage.tsx:140 | |
| C135 | Knappen Testa event | Kör ett prov av vilket klipp som skulle väljas. Ändrar inte spelet. | ja | C137 | lab/components/stage.tsx:140 | |
| C136 | Social chatt med Astrid | Skriver som en spelare, kan slå på skämtläge och webbsökning, och kan glömma testpersonen. | ja | – | lab/components/social-chat-panel.tsx:300 | |
| C137 | Panel Testa event | Väljer vem som väljer klippet: standard, regler, slump, OpenClaw eller skuggläge. | ja | C135, C165 | lab/components/event-test-panel.tsx:65 | |
| C138 | Utfällbar Testsituation | Fyller i låtsasdata för provet. Påverkar inte läget Bara standard. | ja | – | lab/components/event-test-panel.tsx:73 | |
| C139 | Knappen Visa exempelförlopp | Visar en pedagogisk ordning. Det är inte ett riktigt test. | ja | – | lab/components/event-test-panel.tsx:79 | |
| C140 | Panel Standard och varianter | Väljer variant, frekvens eller villkor, och kan läsa om mapparna. | ja | C55, C58 | lab/components/media-family-editor.tsx:40 | |
| C141 | Flik Event | Byter visningsnamn och beskrivning. Det tekniska id:t ligger fast. | oklart | C90 | lab/components/studio.tsx:383 | |
| C142 | Flik Varianter | Lägger till, döper och tar bort alternativ, och kopplar villkor. | oklart | C90 | lab/components/studio.tsx:383 | |
| C143 | Flik Triggers | Öppnar villkorslistan. | oklart | C144 | lab/components/studio.tsx:383 | |
| C144 | Villkorsredigerare | Skapar, döper och tar bort villkor i grupperna Spel & regler, Socialt & minne och Temperament. | oklart | – | lab/components/trigger-editor.tsx:46 | |
| C145 | Kryssrutor för variantval | Tillåter att OpenClaw, regler eller slump får välja alternativet. | oklart | C58 | lab/components/variant-selection.tsx:6 | |

Flikarna Event, Varianter och Triggers, och villkorsredigeraren, visas när dealern inte har videomappar. För Astrid med mappar syns i stället panelen Standard och varianter.

## Agentmodeller (`/control/openclaw`)

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C146 | Rubrik Agentmodeller | Läser att man väljer modell för en agent och sparar. | ja | C8 | lab/components/openclaw-workspace.tsx:177 | |
| C147 | Piller Sparad | Samma sparstatus i sidhuvudet och i topplisten. | ja | C17 | lab/components/openclaw-workspace.tsx:179 | |
| C148 | Knappen Hämta aktuella val | Hämtar modellerna från OpenClaw. | ja | – | lab/components/openclaw-workspace.tsx:181 | |
| C149 | Statusrad om Gateway | Ser om de hämtade valen används, bara är sparade, eller inte kan bekräftas. | ja | – | lab/components/openclaw-workspace.tsx:190 | |
| C150 | Lista Modellval | En rad per agent, med nuvarande modell. | ja | – | lab/components/openclaw-workspace.tsx:195 | |
| C151 | Väljare Modell | Byter modell. Avstängd om OpenClaw inte är nåbar. | ja | – | lab/components/openclaw-workspace.tsx:204 | |
| C152 | Knappen Spara på raden | Sparar den agenten. Knappen "Spara alla" längst ner sparar också bara den första osparade agenten. | ja | C155 | lab/components/openclaw-workspace.tsx:214 | |
| C153 | Knappen Återställ | Tar tillbaka agentens osparade val. | ja | C155 | lab/components/openclaw-workspace.tsx:215 | |
| C154 | Utfällbar Reservmodeller | Visar reservmodellerna. De följer med när man sparar. | ja | – | lab/components/openclaw-workspace.tsx:201 | |
| C155 | List Spara alla och Ångra | Syns när något är osparat. Spara alla sparar en agent. Ångra tömmer alla utkast. | ja | C152 | lab/components/openclaw-workspace.tsx:232 | |
| C156 | Länk Öppna OpenClaw-dashboard | Öppnar OpenClaws egen sida, om adressen är giltig. Annars en varning. | ja | C166 | lab/components/openclaw-workspace.tsx:228 | |
| C157 | Länk Studio | Går till dealerns klippsida. | ja | C3 | lab/components/openclaw-workspace.tsx:230 | |

## Operatörschatt (`/control/operator-chat`)

Det här är den gamla OpenClaw-ytan, inte Agentmodeller. Den har inte den inre menyn med Blackjack och Roulette.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C158 | Rubrik OpenClaw | Sidhuvudet säger OpenClaw, menyn säger Operatörschatt. | ja | C9 | lab/components/studio.tsx:371 | |
| C159 | Knappen Öppna bordschatten | Byter till Uppspelning. | ja | C78, C210 | lab/components/gateway-panel.tsx:41 | |
| C160 | Länk Till operatörschatten | Scrollar ner till chattrutan på samma sida. | ja | – | lab/components/gateway-panel.tsx:41 | |
| C161 | Chatt med OpenClaw | Skriver en fråga och får svar från servern. Fältet är låst om OpenClaw inte är konfigurerat. | ja | – | lab/components/gateway-panel.tsx:42 | |
| C162 | Knappen Vad får du bestämma över? | Fyller i en färdig fråga. | ja | – | lab/components/gateway-panel.tsx:42 | |
| C163 | Knappen Skicka | Skickar meddelandet. | ja | – | lab/components/gateway-panel.tsx:42 | |
| C164 | Statuspiller för anslutning | Visar kontakt verifierad, inte hälsotestad, eller ej ansluten. | ja | – | lab/components/gateway-panel.tsx:42 | |
| C165 | Utfällbar Urvalsläge | Väljer standard, regler, slump, OpenClaw eller skuggläge. | ja | C137 | lab/components/gateway-panel.tsx:44 | |
| C166 | Utfällbar Ansvar och dashboard | Läser vad chatten får och inte får påverka, och kan öppna OpenClaws dashboard. | ja | C156 | lab/components/gateway-panel.tsx:45 | |
| C167 | Röstprov | Antingen en text om att provet inte finns i den här miljön, eller knappar för att skapa ett ljudprov. Vilket som visas beror på hur servern är satt. | oklart | – | lab/components/voice-preview-panel.tsx:56 | |
| C168 | Utfällbar dokumentation | Länkar till OpenClaws egna hjälpsidor. | ja | C233 | lab/components/openclaw-sources.tsx:2 | |

## Administration (`/control/administration`)

Sex flikar. Knappar som skriver syns bara om servern tillåter åtgärden. Annars står det att ändringen inte är ansluten. Sidans namn i fliken är ScoutGamingGroup, de andra kontrollsidorna säger Croupier Studio.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C169 | Knappen Ladda om från servern | Hämtar sidans uppgifter igen. | ja | – | lab/components/studio-administration.tsx:637 | |
| C170 | Knappen Logga ut | Loggar ut. | ja | – | lab/components/native-administration.tsx:27 | |
| C171 | Piller Sparad | Visar osparade formulärfält. | ja | C17 | lab/components/studio-administration.tsx:632 | |
| C172 | Knappen Kasta formulärutkast | Slänger osparade fält och läser om. | ja | – | lab/components/studio-administration.tsx:648 | |
| C173 | Text om åtgärd som inte är ansluten | Om servern inte har åtgärden syns en mening i stället för knappen. | attrapp | – | lab/components/studio-administration.tsx:311 | |
| C174 | Flik Drift & spelintegritet | Öppnar driftöversikt och skostatus. | ja | – | lab/lib/backoffice-navigation.mjs:18 | |
| C175 | Siffror Spelare och Rum | Läser senast hämtade antal. | ja | – | lab/components/studio-administration.tsx:324 | |
| C176 | Siffror för skor och bord | Läser sparade bord, pågående rundor och kortlekar. | ja | – | lab/components/studio-administration.tsx:331 | |
| C177 | Utfällbar Spelregler och status | Läser cut card och att certifieringsunderlag saknas. | ja | – | lab/components/studio-administration.tsx:336 | |
| C178 | Flik Spel, lanes & bord | Öppnar lane, rum och dealer per bordsnivå. | ja | C25 | lab/lib/backoffice-navigation.mjs:19 | |
| C179 | Väljare Lane för Blackjack | Väljer vilken presentation nya spel får, och sparar. | ja | – | lab/components/studio-administration.tsx:347 | |
| C180 | Lägg till lane | Skapar en ny lane som delar Astrids klipp. | ja | – | lab/components/studio-administration.tsx:350 | |
| C181 | Ta bort lane | Tar bort en lane. Sista lanen stänger ny blackjackstart. | ja | – | lab/components/studio-administration.tsx:357 | |
| C182 | Länk Öppna Blackjack | Öppnar spelet i en ny flik. | ja | C69 | lab/components/studio-administration.tsx:364 | |
| C183 | Lista Bord och rum | Ser rum och kan spara status live, preview eller pending. | ja | – | lab/components/studio-administration.tsx:367 | |
| C184 | Dealer per bordsnivå | Väljer dealer för classic, high och vip, och sparar. | ja | C38 | lab/components/studio-administration.tsx:377 | |
| C185 | Flik Konton | Öppnar spelarkonton och administratörskonton. | ja | – | lab/lib/backoffice-navigation.mjs:20 | |
| C186 | Tabell Spelarkonton | Ser spelare, saldo och status. | ja | – | lab/components/studio-administration.tsx:392 | |
| C187 | Ändra spelarstatus | Kan blockera, öppna eller stänga ett konto. Stängt konto går inte att öppna igen. | ja | – | lab/components/studio-administration.tsx:396 | |
| C188 | Byt spelarens lösenord | Sätter ett nytt lösenord. Gamla sessioner avslutas. Saldo och historik blir kvar. | ja | – | lab/components/studio-administration.tsx:402 | |
| C189 | Skapa spelarkonto | Skapar ett konto som kan logga in i blackjack, inte i kontrollpanelen. | ja | – | lab/components/studio-administration.tsx:413 | |
| C190 | Lista Användare och roller | Ser administratörer och om kontot är aktiverat. | ja | – | lab/components/studio-administration.tsx:431 | |
| C191 | Spara roll | Byter roll. Det egna kontot går inte att byta eller ta bort. | ja | – | lab/components/studio-administration.tsx:434 | |
| C192 | Ta bort konto | Tar bort en annan administratörs inloggning. | ja | – | lab/components/studio-administration.tsx:435 | |
| C193 | Skicka nytt mejl | Skickar en ny aktiverings- eller återställningslänk. | ja | – | lab/components/studio-administration.tsx:437 | |
| C194 | Bjud in adminpersonal | Bjuder in med e-post. Mottagaren väljer lösenord via länken. | ja | C236 | lab/components/studio-administration.tsx:439 | |
| C195 | Flik Partner | Öppnar partnernycklar och exempel på mejl. Menyraden Partners är en annan sida. | ja | – | lab/lib/backoffice-navigation.mjs:21 | |
| C196 | Lista partnernycklar | Ser namn och status. Själva nyckeln är dold. | ja | – | lab/components/studio-administration.tsx:447 | |
| C197 | Återkalla partnernyckel | Stänger nyckeln. | ja | – | lab/components/studio-administration.tsx:449 | |
| C198 | Rotera hemlighet | Byter den hemliga delen. Den gamla slutar fungera. | ja | – | lab/components/studio-administration.tsx:450 | |
| C199 | Skapa spellänk | Startar ett partnerspel för ett spelar-id. | ja | – | lab/components/studio-administration.tsx:451 | |
| C200 | Kreditera demo-saldo | Lägger demopengar på ett partnerkonto utan riktig plånbok. | ja | – | lab/components/studio-administration.tsx:457 | |
| C201 | Ny partnernyckel | Skapar en nyckel med rättigheter. Nyckeln visas bara en gång. | ja | – | lab/components/studio-administration.tsx:462 | |
| C202 | Visa exempelmallar | Läser exempel på mejl. Skickar inte mejlen. | ja | – | lab/components/studio-administration.tsx:474 | |
| C203 | Flik Betalningar & journal | Visar de senaste raderna. Ändrar inte saldo eller historik. | ja | – | lab/lib/backoffice-navigation.mjs:22 | |
| C204 | Tabell journal | Ser tid, spelare, typ och belopp. | ja | – | lab/components/studio-administration.tsx:482 | |
| C205 | Flik Talgranskning | Öppnar manuell bedömning av repliker. Det är inte probesidan i menyn. | ja | C12, C224 | lab/lib/backoffice-navigation.mjs:23 | |
| C206 | Lista repliker med film och ljud | Öppnar en replik, ser texten och kan spela film och ljud. | ja | – | lab/components/studio-administration.tsx:488 | |
| C207 | Spara manuell granskning | Markerar repliken som godkänd, underkänd eller ej granskad. | ja | – | lab/components/studio-administration.tsx:493 | |
| C208 | Text om betald speech-QA | Säger att den betalda granskningen inte körs här. Det finns ingen knapp. | attrapp | – | lab/components/studio-administration.tsx:499 | |
| C209 | Engångsresultat | Efter en nyckel, en spellänk eller en kreditering visas uppgiften en gång, med en knapp som döljer den. | ja | – | lab/components/studio-administration.tsx:640 | |

## Uppspelning (`/control/activity`)

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C210 | Rubrik Händelselogg | Sidhuvudet säger Händelselogg. Menyn säger Uppspelning. | ja | C11 | lab/components/studio.tsx:371 | |
| C211 | Knappen Töm detaljloggen | Tömmer listan i minnet. Den kommer tillbaka tom efter omladdning. | ja | – | lab/components/activity-log.tsx:185 | |
| C212 | Status för anslutning och revision | Ser om spelfliken är kopplad och om spelet använder samma sparade version. | ja | C67 | lab/components/activity-log.tsx:201 | |
| C213 | Kedja av kvitton | Ser vilket klipp som valdes och om det faktiskt spelades. | ja | C67 | lab/components/activity-log.tsx:208 | |
| C214 | Utfällbar Källöversikt | Ser hur många filmer som är registrerade, har förhandsvisning eller har spelats. | ja | – | lab/components/activity-log.tsx:219 | |
| C215 | Knappen Anslut eller Koppla från | Öppnar spelet och följer det, eller släpper följningen. | ja | C68 | lab/components/partner-reference.tsx:216 | |
| C216 | Knappen Öppna spelet | Öppnar spelet i en ny flik. | ja | C69 | lab/components/partner-reference.tsx:216 | |
| C217 | Knappen Läs om konfiguration | Läser om anslutningens inställningar. | ja | – | lab/components/activity-log.tsx:187 | |
| C218 | Knappen Öppna separat Lab-preview | Startar ett jämförelseprov. Räknas inte som visat i spelfliken. Syns inte för Astrid, där webbläsaren redan äger spelaren. | ja | – | lab/components/activity-log.tsx:187 | |
| C219 | Knappen Visa spelfliken här | Ber webbläsaren visa spelflikens bild. Syns när Astrid spelas i den vanliga spelaren. | ja | – | lab/components/reference-capture.tsx:50 | |
| C220 | Filter i detaljloggen | Filtrerar alla, indata, beslut, uppspelning, anslutning och konfiguration. | ja | C80 | lab/components/activity-log.tsx:189 | |
| C221 | Knappen Exportera och Läs in observation | Sparar eller läser in följningen. | ja | C70 | lab/components/partner-reference.tsx:245 | |
| C222 | Knappen Ny observation | Börjar om följningen. | ja | C71 | lab/components/partner-reference.tsx:246 | |
| C223 | Utfällbar diagnostik | Verifierar partneråtkomst, öppnar referensspel och kan hämta en videokarta. Mestadels när studion inte kör mot molnet. | oklart | – | lab/components/partner-reference.tsx:223 | |

## Talgranskning (`/control/probe`)

Menyn säger Talgranskning. Sidhuvudet säger Probe. Det är Astrids egna tal vid inaktivitet, samma redigerare som fliken Probe.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C224 | Rubrik Probe | Ser sidans namn Probe, inte ordet Talgranskning. | ja | C12, C44 | lab/components/studio.tsx:371 | |
| C225 | Hela probe-redigeraren | Samma lägen, fält, textprov och länk till spelprov som på fliken Probe. | ja | C63–C66 | lab/components/probe-editor.tsx:35 | |

## Guide & hjälp (`/control/guide`)

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C226 | Rubrik Guide | Läser guidens titel och inledning. | ja | C14 | lab/components/studio-guide.tsx:10 | |
| C227 | Fem steg med länk | Varje steg har en länk "Öppna i Dealer & klipp" som öppnar klippsidan, ibland på en viss flik. | ja | C34 | lab/components/studio-guide.tsx:11 | |
| C228 | Lista Ramar som gäller nu | Läser vad som gäller just nu. Inga knappar. | ja | – | lab/components/studio-guide.tsx:12 | |
| C229 | Utfällbar Vilken vy använder jag? | Läser vad varje yta är till för. | ja | – | lab/components/studio-guide.tsx:14 | |
| C230 | Utfällbar Gemensamma begrepp | Läser korta förklaringar. | ja | – | lab/components/studio-guide.tsx:15 | |
| C231 | Utfällbar Var finns mina saker? | Läser var materialet ligger. | ja | – | lab/components/studio-guide.tsx:16 | |
| C232 | Utfällbar Teknisk källa | Läser var reglerna står. | ja | – | lab/components/studio-guide.tsx:17 | |
| C233 | Utfällbar OpenClaw-dokumentation | Samma hjälplänkar som på operatörschatten. | ja | C168 | lab/components/openclaw-sources.tsx:2 | |

## Inloggning och lösenord

De här sidorna visas utan sidomeny.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C234 | Inloggning `/control/login` — bevaras | Skriver namn och lösenord och loggar in. Samma konto som i spelet. | ja | – | lab/components/studio-login.tsx:44 | |
| C235 | Glömt lösenordet? — bevaras | Ber om en återställningslänk, om mejl är påslaget. Annars syns inte rutan. | ja | C193 | lab/components/studio-login.tsx:55 | |
| C236 | Välj lösenord `/control/set-password` — bevaras | Väljer ett nytt lösenord från länken i mejlet. | ja | C194 | lab/components/studio-login.tsx:58 | |
| C237 | Länkar efter sparat lösenord — bevaras | Kan gå till spelets inloggning eller studions inloggning. | ja | C234 | lab/components/studio-login.tsx:58 | |

## Adresser som inte ligger i menyn

Nio adresser visar översikten plus notisen att exempelvyn inte är ansluten.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C238 | Adress pit-bosses | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:27 | |
| C239 | Adress presentation | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:28 | |
| C240 | Adress table-design | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:28 | |
| C241 | Adress roulette | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:29 | |
| C242 | Adress baccarat | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:29 | |
| C243 | Adress preview | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:30 | |
| C244 | Adress statistics | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:30 | |
| C245 | Adress reports | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:30 | |
| C246 | Adress generations | Ser översikten och notisen. | attrapp | C23, C24 | lab/lib/workspace-surfaces.mjs:32 | |
| C247 | Adress overview | Samma översikt som `/control`, utan notisen. | ja | C23 | lab/lib/workspace-surfaces.mjs:10 | |

Adresser som skickar vidare. Användaren landar på målet, inte på en egen sida.

| # | Funktion | Vad användaren kan göra | Fungerar? | Finns också på | Kod | Jakob: Behåll / Ta bort / Flytta till |
| --- | --- | --- | --- | --- | --- | --- |
| C248 | players → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:8 | |
| C249 | transactions → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:8 | |
| C250 | team → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:8 | |
| C251 | integration → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:8 | |
| C252 | game-tables → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:9 | |
| C253 | lanes → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:9 | |
| C254 | shoes → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:9 | |
| C255 | tables → Administration | Skickas till administrationen. | ja | C10 | lab/lib/control-workspace.mjs:9 | |
| C256 | legacy-rooms → Administration | Skickas till administrationen. | ja | C255 | lab/lib/control-workspace.mjs:9 | |
| C257 | backgrounds → Dealers & klipp, flik Bakgrund | Skickas till bakgrundsfliken. | ja | C43 | lab/lib/control-workspace.mjs:10 | |
| C258 | speech → Dealers & klipp, flik Fasta repliker | Skickas till replikfliken. | ja | C42 | lab/lib/control-workspace.mjs:10 | |
| C259 | media → Klippbibliotek | Skickas till klippbiblioteket. | ja | C5 | lab/lib/control-workspace.mjs:11 | |
| C260 | archive → Klippbibliotek | Skickas till klippbiblioteket. | ja | C5 | lab/lib/control-workspace.mjs:11 | |
| C261 | presentation-events → Händelser → klipp | Skickas till trädsidan. | ja | C4 | lab/lib/control-workspace.mjs:11 | |
| C262 | studio → Översikt | Gammal adress. Skickas till översikten. | ja | C2 | lab/lib/workspace-surfaces.mjs:13 | |
| C263 | admin → Administration | Gammal adress. Skickas till administrationen. | ja | C10 | lab/lib/workspace-surfaces.mjs:14 | |
| C264 | ops → Agentmodeller | Gammal adress. Skickas till Agentmodeller, inte till operatörschatten. | ja | C8 | lab/lib/workspace-surfaces.mjs:15 | |
| C265 | lab → Översikt | Gammal adress. Skickas till översikten. | ja | C2 | lab/lib/workspace-surfaces.mjs:16 | |

## Dubbletter

Samma sak på flera ställen. Radnummer:

- Sparstatus: C17 i topplisten, C35 på Dealers & klipp, C74 och C75 på de sju gamla sidorna, C147 på Agentmodeller, C171 i administrationen.
- Dealerväljare: C38 chips, C39 dold lista, C95 och C126 på Händelser och Klippbibliotek, C87 i nodträdet, C184 dealer per bordsnivå.
- Idle: C40 och C49 på Dealers & klipp, C129 på Händelser.
- Kort, repliker och mapplistor: C41, C42, C53 på Dealers & klipp, C83 och C97 på trädet och biblioteket, C100 i biblioteket.
- Probe: C44 och C63–C66 på Dealers & klipp, C225 på Talgranskning. Namnet krockar med C205, administrationens flik Talgranskning, som är en annan granskning.
- Bakgrund: C43 och C62 på Dealers & klipp, C108–C125 på Bakgrundszoner, C257 som skickar till fliken.
- OpenClaw: C8 och C146–C157 Agentmodeller, C9 och C158–C168 Operatörschatt, C29 som heter OpenClaw & drift men öppnar Agentmodeller, C264 som också öppnar Agentmodeller.
- Händelser mot Händelser → klipp: C83 klick öppnar C126. C86–C92 är nodträdet som hoppar till samma händelseyta.
- Uppspelning: C67 på Dealers & klipp, C80 längst ner på de gamla sidorna, C210–C222 som egen sida.
- Spara: C37 på Dealers & klipp, C77 på de gamla sidorna.
- Roulette som löfte: C94 avstängd knapp, C89 och C241 bara text eller notis.
- Guide-länkar C227 och menyraden C3 går båda till Dealers & klipp.
- Partners: C13, C19 och C31 lämnar kontrollpanelen. C195 är administrationens flik Partner, en annan sak.
- Inloggning mot inbjudan: C234 och C236 hör ihop med C193 och C194.

## Attrapper och löften utan funktion

- C16 sökfältet i topplisten. Texten säger att det inte är anslutet.
- C24 och C238–C246 nio adresser som bara visar översikten och en notis.
- C51 valet Regelstyrd, avstängt.
- C89 och C94 Roulette, avstängt eller bara text.
- C167 röstprovet kan vara en tom text om att det inte finns. Oklart i den miljö Jakob använder.
- C173 meningar om att en administrationsåtgärd inte är ansluten, när servern inte har åtgärden.
- C208 texten om att betald speech-QA inte körs här.
- C29 och C158 namn som lovar OpenClaw eller drift, medan sidan är Agentmodeller respektive en chatt.
- C155 Spara alla sparar en agent, inte alla.

## Bevarandelista, rör ej

- Administratörens inloggning, C234 och C235.
- Sidan välj lösenord, C236 och C237.
- Probe-ytan: både fliken på Dealers & klipp (C44, C63–C66) och sidan Talgranskning (C224, C225).
- Repliklistan i `lab/lib/studio-voice-lines.mjs` och ljudfilerna under `media/dealers/astrid`. Filerna är inte räknade. De ska vara kvar.
- Spelmotorn och plånboken. De syns inte som egna sidor här. Administrationens journal (C203) och demo-kreditering (C200) läser eller rör demosaldo, inte den riktiga plånboken.

## Tveksamt

- C86–C92, C98, C102–C105, C141–C145: nodträdet och det äldre biblioteket kan vara oåtkomliga så länge sidan alltid öppnas med Astrid och Astrid har videomappar. Ta inte bort dem på den gissningen.
- C66 och C111–C112: talprovet och molnzonerna beror på servern. Inte körda här.
- C167: röstprovet stängs av när studion kör mot den gemensamma databasen. Då syns bara en text.
- C12 och C205 heter båda Talgranskning men är olika saker. Beslut finns redan i matrisens rad 17.
- Repliklistan och Astrids ljudfiler är inte en knapp i menyn. De ska ändå vara kvar.
