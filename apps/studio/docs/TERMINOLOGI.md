# Scoutgaming: ordlista

Vad orden betyder i produkten. Ett ord per begrepp i all text som vänder sig till användare; kodens namn står inom parentes en gång och byter inte namn för att ett ord byts i menyn. Ordlistan låser inga flöden: hur Admin ska se ut står i [målbilden](../../../docs/plans/ADMIN-FORENKLING.md), hur koden hänger ihop i [kablagekartan](../../../docs/plans/ADMIN-KARTA.md), arbetsstegen i [användarguiden](README.md) och de tekniska medieformaten i [runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md). Uppdaterad 28 oktober 2026.

## Tre nivåer

| Nivå | Namn i produkten | Vem | Adress |
| --- | --- | --- | --- |
| 1 | **Admin** | Scoutgamings personal | `/admin` |
| 2 | **Partnerportalen** | bolagets personal | `/partner/<bolag>` |
| 3 | **Spelaren** | spelare hos ett bolag | `/lobby`, `/game` |

Regeln: **Admin skapar och tilldelar, bolaget väljer, spelaren spelar.** Allt ett bolag kan ändra är en delmängd av det Admin kan ändra, begränsat av tilldelningen och av personens roll. "Nivå 1, 2, 3" får användas som kortform i dokument; menyer och rubriker använder namnen.

## Ytor

- **Admin** (`/admin`): personalens arbetsyta för dealers, klipp, tal, mallar, material, bolag och spelbord. Kallas i produkten **Scoutgaming Admin**. `apps/studio` är källkoden och `/studio` appens tekniska sökväg (basePath), inte en egen produkt; ordet Studio används inte i menyer.
- **Partnerportalen** (`/partner`): bolagets egen yta för sina spelbord, sitt team och sin integration.
- **Lobbyn** (`/lobby`): spelarens katalog över bolagets öppna spelbord. **Spelet** (`/game?game=…`) är det autentiserade spelfönstret.
- **Spelmotorn** (`services/game`, Render `croupier-v3`): äger kort, sko, regler, saldo och utbetalningar. Presentationen påverkar aldrig dem.
- **Delat bord** (`shared-table`, `CROUPIER_SHARED_TABLE_ENABLED`): flera spelare vid samma spelbord i spelmotorn. Från O03 är det den enda spelvägen.
- **Preview**: provbänken (tidigare staging) med syntetiska konton, som behålls efter O03 och deployas pinnat av orkestratorn; inget obligatoriskt steg före produktion.

## Det man skapar, tilldelar och publicerar

- **Dealer**: en person med eget klippbibliotek, egen röst och egna repliker. En dealer kan tilldelas flera bolag.
- **Bolag** (`operator`): spelbolaget, till exempel Johns Bet. Ett bolag är aktivt, avstängt eller i papperskorgen (`active`, `suspended`, `archived`).
- **Spelbord** (`room`): bolagets ingång till ett spel, med eget id, egen dealer, eget utseende och egna spelinställningar. Ett spelbord är **öppet** (`live`) eller **pausat** (`pending`); ett pausat spelbord syns inte i lobbyn och pågående rundor spelas klart. Äldre text säger "rum".
- **Mall** (`lane`, `presentationLaneId`; i adresser `composition`): placeringen av dealer, bakgrund och bordsgrafik i scenen, plus vilka dealers och vilket material den tillåter. Flera spelbord kan använda samma mall; en ändring i mallen påverkar alla spelbord som använder den. I menyn heter den **Scenmall**.
- **Tilldelning**: det bolaget får använda: spel, dealers, mallar, bordsgrafik, bakgrunder, godkända insatsprofiler och vilka val som är upplåsta. Bolaget får en **uppsättning** att välja bland, inte en enda låst dealer eller bakgrund. Tilldelningen lagras i bolagets paket.
- **Paket** (`operator package`, `operator_packages`): bolagets publicerade tilldelning och frysta material, med ett revisionsnummer som bara räknas uppåt. Spelet läser paketet, aldrig utkast. Undantag i dag: spelbordets namn och om det är öppet läses direkt ur Admins register; det fryses i paketet i målbildens steg D.
- **Version**: paketets revisionsnummer så som det visas för användaren ("Publicerad version 11").
- **Spelinställningar** (`room game config`, `roomGameConfigs`, `shared_table_configs`): spelbordets språk (`en`, `sv`), insatsprofil och tider (insats 20 s, beslut 15 s). De publiceras per spelbord och binds till paketets version.
- **Insatsprofil** (`limitPreset`): en namngiven uppsättning gränser och marker. I dag finns tre profiler med samma regler som bara skiljer sig i gränser, marker och påfyllning: **Casual** (1–500, sidoinsats 50, marker 1–100, påfyllning 500), **Privé** (5–2 000, sidoinsats 200, marker 5–500, påfyllning 1 000) och **High** (100–25 000, sidoinsats 1 000, marker 100–25 000, påfyllning 50 000). Admin bestämmer profilen; bolaget får byta bara om Admin låst upp det, och då bland profiler Admin godkänt.
- **Spelbordets utseende** (`branding`, `roomOverrides`): vald bakgrund, dealer och bordsgrafik per spelbord inom tilldelningen. Ändras som utkast, granskas och publiceras. Utkastet är i dag ett per bolag, inte per spelbord.
- **Utkast** och **live**: det sparade läget mot det publicerade. Spelaren ser bara live. Pågående rundor spelas klart på den gamla versionen; nästa runda får den nya.
- **Publicering**: tal godkänns, paketet publiceras och sist spelbordets spelinställningar. Målbilden samlar det till en knapp per spelbord med granskning och kvitto.
- **Papperskorgen**: arkivering som går att ångra. Historik och källmedia raderas aldrig som bieffekt; permanent radering är ett eget steg.

## Scenen

- **Bakgrund**, **dealer** och **bordsgrafik** (`table`) är scenens tre lager; spelets kort, marker och knappar ligger överst. Bordsgrafik är bara bilden av bordet, aldrig ett spelbord. Ny bakgrund skapar varken ny dealer eller nytt spelbord. Ett lager som är inbakat i en dealerfilm kan inte bytas separat.
- **Material**: bordsgrafik och bakgrunder (`layerAssets`), uppladdade på ett ställe och tilldelade till bolag.
- **Placering** (`composition`): mallens skala och läge för dealer, bakgrund och bordsgrafik, separat för dator och mobil, samt kortens geometri. Publiceras med mallen.
- **Skon**, korten och dealerns händer sitter i dealerns filmade klipp, inte i något lager.

## Klipp och tal

- **Klipp**: en videofil i dealerns bibliotek. **Klippkartan** ordnar klippen per situation i grupperna nedan, med ett standardklipp och varianter per situation. Tekniska poseversioner är inte varianter.
- **Vila** (`idle.ready`): basloopen och tysta beteendeklipp, som blickar och nickningar, som återgår till vila.
- **Spelhandlingar** (`deal.*`, `reveal.*`): utdelning till plats 1–7 (`box0`–`box6`), dealerns öppna kort (`dealer-up`), dolt kort (`dealer-hole`) och kortvändning (`reveal.dealer/dealer-hole`). Exakt matchning mot händelsen, ingen slump.
- **Övergångar** (`transition.shoe`): till och från skon (`to-shoe`, `from-shoe`), mellan poserna vila (`VILA`) och redo (`REDO`).
- **Replik** (`speak.<line>`): en situation där dealern talar, med språk och exakt text. Text, ljud och bild hör ihop.
- **Tagning** (`take`, `takeId`): en inspelning av en replik. En replik kan ha flera tagningar; en tagning är ogranskad, godkänd eller underkänd (`pending`, `approved`, `rejected`), och bara godkända, servermätta tagningar får spelas.
- **Talfack** (`speechSlots`): replikens plats i klippkartan; den valda tagningen är standard där.
- **Mätt speltid**: klippets exakta längd mätt på servern. Utan den kan klippet inte publiceras.
- **Godkännande**: klipp är ogranskade tills Admin granskat dem (`reviewStatus`). En dealer är **godkänd** när klipp och tal räcker för spel; först då kan den tilldelas ett bolag.
- **Röst och tal**: dealerns inspelade tal (`recordedSpeech`) och, när talkedjan är igång, genererat tal med läppsynk från chatten. **Dialogtest** är chatten mot dealern; **Svarsbiblioteket** är dealerns inspelade svar sorterade i kategorier. Talkedjan är pausad till efter O03 och byggs då lika för alla dealers.
- Tur och resultat avgör när ett klipp körs; de är inga egna kategorier. Automatik får välja bland kompatibla varianter men ändrar aldrig spelhandlingen eller utdelningspositionen.

## Vem väljer vad

Admin bestämmer per bolag vilka dealers, mallar, material och insatsprofiler bolaget får använda, och vilka val som är **upplåsta** (dealer, bordsgrafik, bakgrund, bordsspråk, insatsprofil, öppet/pausat). Insatsprofilen är låst som standard. Bolaget väljer inom det på sina spelbord; låsta val visas som "Låst av Scoutgaming". Spelaren väljer aldrig vad ett spelbord är, bara hur det visas för just honom eller henne (språk, ljud, sparade val). Ett bolag med ett spelbord och en mall behöver inga val alls.

## Konton och roller

- **Personal**: Admins konton (`croupier_auth.users`, roll `admin` eller `staff`). Bara personal når Admin.
- **Bolagets team** (`operator_memberships`): bolagets personer med en roll. Standardrollerna är **administratör** (`partner-admin`, alla behörigheter, utses bara av Admin), **redaktör** (`partner-editor`, ser och ändrar spelbord) och **läsare** (`partner-viewer`, ser allt i bolaget). Den sista administratören kan inte stängas av.
- **Behörighet**: kodens tolv namn (`overview.read`, `tables.read`, `tables.configure`, `presentations.read`, `presentations.configure`, `players.read`, `reports.read`, `integrations.read`, `team.read`, `team.invite`, `team.roles.assign`, `team.suspend`). En dold meny är ingen behörighet; servern avgör.
- **Spelare** (`players`): ett spelarkonto med saldo och historik. Efter O03 tillhör varje spelare exakt ett bolag.
- **API-nyckel** (`api_keys`): bolagets nyckel för att starta spelare från sin egen sajt; **testsession** är en start med demokrediter.
- **Journal** (`operator_audit_events`): bolagets händelser, synlig för Admin och för bolagets administratör.

## Lagring

Neon är produktregistret (bolag, paket, spelbord, klipp, konton) och Blob lagrar mediebytes; Git innehåller kod och text. Paketet är kontraktet mellan Admin och spelet. Detaljerna står i [BLOB-NEON](../../../docs/storage/BLOB-NEON.md) och [kablagekartan](../../../docs/plans/ADMIN-KARTA.md).

## Ord som utgår

| Gammalt ord | Använd |
| --- | --- |
| rum, spelrum, spelutbud, room, table (i svensk text), bj, game-tables | spelbord |
| bord (som scenlager), bordsbild, lagerfil, material-library, assets | bordsgrafik; material (bordsgrafik och bakgrunder tillsammans) |
| sammansättning, spelmall, gemensam mall, lane, game lane, presentation (substantiv) | mall (i menyn Scenmall) |
| operatör, kund, spelbolag, partner, company (utom som förklaring) | bolag |
| Operatörsportal, partnerportal, Spelbolag (som ytans namn) | Partnerportalen |
| bolagspaket, partnerpaket, lane-paket, paketversion, publiceringsrevision | paket; version |
| rumskonfiguration, spelkonfiguration | spelinställningar |
| insatsnivå, limit, tier | insatsprofil |
| branding, theme, design, appearance, "rummets val" | spelbordets utseende |
| grundloop, idle (i svensk text) | vila |
| take | tagning |
| forge, dealer-studio, Dealer Forge | Skapa material |
| speech, voice, probe, taldrift, talgranskning | röst och tal |
| OpenClaw, ai/models, dealer-agent, operator-chat | AI-agenter; Dialogtest |
| Dealerregister, Studio som egen produkt, Lab, labbet, Control, Backoffice, Croupier Admin, N1-session | Admin (Scoutgaming Admin) |
| Konton & åtkomst (för personal) | Scoutgamings personal |
