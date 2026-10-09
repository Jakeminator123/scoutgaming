# Aktuell handoff — Scoutgaming

## 9 oktober 2026: sammanhängande sammansättning och partnerns val

Kodleverans 35eb07b29b704c4df9dbf93e46479341bbc68bcd är pushad till GitHub main. Normal fullhook PASS: 2 020 tester, 2 011 PASS, 9 SKIP, 0 FAIL. Exakt-SHA CI 37971486777 är SUCCESS med alla tre jobb godkända utan omkörning. Vercel production READY på dpl_EBfdHp1Y43sjEjToyqfs4gX5u1dZ (scoutgaming-24cxi2fl1-scoutgaming.vercel.app); separat kontroll av www.scoutgaming.tech gav samma deployment. Render-version och produktionsacceptans är separata öppna kontroller.
Nivå 1:s Sammansättning är huvudeditorn för Dealer, Bord och Bakgrund.
Storlek och placering visas öppet, separat för Mobil och Desktop. Valet Dealer
ändrar sparad startdealer; Förhandsvisa klipp är fortfarande enbart ett prov.
Grundloop och idle är samma vänteläge. Basklipp och Variationer beskriver
innehåll i det läget; en egen dealer publiceras med ett fryst basklipp.
Astrids befintliga avancerade urval och originalklipp bevaras.

Den faktiska inbyggda guiden i lab/docs/guide.json hade kvar Nora-specifik
manuell rumsguidning och uppgift om att rumskapande återstod. Den rättas
samtidigt med README, terminologi och studio-contract.json. Tekniska idle-ID:n
ändras inte. Separata lager ersätter inte fullbildsklippets inbakade pixlar.

Verifierat fel i nivå 2: ett tillåtet dealerval kunde sparas men inte stödjas
av rummets spellane, varpå spelaren fortsatte med den tidigare dealern.
Rättningen ger samma tillåtna urval i UI och server, med kompatibilitet
i samtliga berörda publicerade live-rum, samt färsk behörighet/revision under
befintlig transaktion. Nivå 2 får inga egna geometriöverlagringar eller nya
paketformat; storlek och placering hör till den publicerade N1-sammansättningen.

Ytterligare reproducerat N2/runtimefel: val för en presentation kunde läcka
som bord/bakgrund/dealer till ett rum med annan presentation, trots att N2
visade det andra rummets egna standardval. Rättningen avgränsar dessa
presentationsval till matchande branding.lane och bevarar bolagsgemensamt
utseende och det frysta paketet. Denna del ändrar web/game-entry-operator.mjs
och kräver separat Render-utrullning; Vercel READY räcker inte som kvitto.

Lokalt verifierat: N2:s samlade serverfria svit 93/93 PASS; N1:s riktade svit
31/31, guide/Grundloop 12/12 och uppdaterat Händelser-test 6/6 PASS.
Slutlig gemensam TypeScript och Lab-build PASS. Oberoende granskning hittade
två fel som rättades före frysning: transaktionen maskerade 403/409 som 503,
och sparad färg kunde tappas vid återval av första presentationen. Nya native-
och tillståndsbaserade UI-regressioner täcker båda. Sync-probe matchar baslinjen;
mediernas bytes och mänskliga läppsynkacceptans har inte ändrats.

N1:s isolerade UI-slutprov PASS: sju assertiongrupper, 1440/768/390 utan
överflöde och noll React-, console-, media- eller dialogfel. Verklig lokal
GET/PUT/full omladdning använder oförändrad SSR/inventory och egen tempdata;
dealer-default/allowed, lager-ID, båda formatens placering och orörd andra
presentation verifieras. Frilagd/fullbild-preview provas separat med explicit
klientinventory och exakt hashkontrollerade originalmedier. Det senare är
previewbevis, inte serverinventering eller produktionsacceptans. Två tidigare
privata SSR-fixturfel och ett felaktigt Pausa-antagande rättades i provskriptet;
ingen produktkod eller felassertion ändrades för att få provet grönt.
Tre nya tydligt isolerade bilder finns i skrivbordsgalleriet; de tidigare
23 originalbilderna bevaras. Lokalt QA-par stängdes i finally.

Johns spelbolag saknar fortfarande partner-medlem. /partner utan partnersession
visar en uttryckligt märkt demonstration; den är inte bevis på Johns liveåtkomst.
Ingen användare, inbjudan, e-post eller authgenväg skapas för detta prov.
Produktionsspelarens separata manuella inloggning och två grundloopvarv återstår.

Render svarar HTTP 200/capability v3 men exakta deploy-SHA och privata felloggar
saknas. Ett misslyckat nytt bygge kan lämna föregående version i trafik.
Den lokala startkedjans 30-sekundersgränser och bortvalda child-processloggar
är möjliga felsökningspunkter, inte en bevisad felorsak. Ändra inte timeouter
utan deploy-ID, SHA och tidsstämplat första fel. Teknisk vägledning finns i
LOCAL-PRESENTATION-RUNTIME.md. GitHubs ffmpeg-installationstimeout är separat.

Nästa agents avgränsade fortsättning:
1. Kontrollera exakt Render-SHA för 35eb07b2 eller en verifierad efterföljare.
   Hämta det första misslyckade deploykvitto/loggutdraget innan eventuell
   starttidsfix. Anslutningsväg finns i LOCAL-PRESENTATION-RUNTIME.md.
2. Efter Jakobs manuella spelarinloggning: prova befintliga Johannas blackjack,
   tre lager och två hela grundloopar; spara bilder. Inga riktiga insatser.
3. N2-produktion kräver verklig partner-medlem och inloggning. Skapa inte en
   godtycklig medlem eller skicka en inbjudan utan rätt konto/mottagare och
   Jakobs instruktion. Därefter verifieras val→spara→omladdning→rätt spelrum.
   Uppdatera samma handoff och Desktopgalleri; skapa inte demoobjekten igen.

## 9 oktober 2026: generiskt dealerpaket och Skapa spelrum

Tidigare kodleverans 88e590e7327f379d56022eebcb891843058a0732 är pushad till GitHub main, har normal fullhook PASS, grön exakt-SHA CI 37963723334 och Vercel production READY. Separat domänkontroll av www.scoutgaming.tech pekar på samma deployment dpl_DMuc47ugqtd2Wz8rmq8PexbFaZAv. Kanonisk player-login gav HTTP 200 med neutral titel/text efter deploy.
Den innehåller 72891be6 (generiskt dealerpaket/rum) och b12653e4 (sista UI-puts).
Egen dealer får en fryst grundloop. Rumpublicering sparar bolagsägt rum,
kompatibel spellane och paket atomiskt. Översikt börjar i Sammansättning;
Publicering visar ett sammanhängande rumflöde och utfällbara avancerade val.
N2:s provlänkar använder verkliga bolagsägda rum även när presentation och
spellane har olika ID. Gamla JSON-exporten och Nora-specifik manuell
rumguidning är borttagna; namnfält för ny och befintlig presentation skiljs åt.

Verifierat: normal fullhook för 72891be6 och b12653e4 PASS; den senare
sammanlagt 2 010 tester, 2 001 PASS och 9 SKIP. Paket/capture/publisher 104/104,
N2-rum 17/17, UI-puts 37/37, gemensam TypeScript och Lab-build PASS.
Isolerad UI-QA visar verkligt sparande, återläsning, tangentbordsnavigation och
layout i 1440/768/390 utan JavaScript-fel.

CI 37952326479 på 8f0dfff6: presentation-studio och lipsync-worker PASS,
dealer-regression föll på en Windows-specifik gzip-fixture. Payload/SHA var
identiska; endast gzip-headerns OS-byte 9 skiljde Linux (3) från Windows (10).
Testjämförelsen normaliserar nu just denna byte; produktionsencoder och
paketformat förblir oförändrade. 34/34 riktade tester PASS. Leveransen verifierade korrigeringen i Linux-CI på c83a47b6; alla tre jobb passerade.

Isolerad faktisk spelklient: Johanna spelade två kompletta muted grundloopar
med exakt källhash och media-ID. Ändrad paketrevision gav 409 och krävde
omladdning. Box 4 utan video gav position_clip_missing/skipped medan två
serverägda kort visades i 2D. Astrid, Vera, Amira och Mei spelade goodluck två
gånger var med media-/framekvitton och utan JavaScript-fel. Båda lokala
serverparen stoppades sekventiellt och tempdata rensades. Privata transport-
fixturer användes; detta verifierar inte produktions-Neon. Originalmedia är
orörda och sync-probe PASS; ingen ny mänsklig läppsynkacceptans hävdas.

### Produktionsdemo och nästa agents startpunkt

Lagerfix 6a0bedba8499c4b510fdbd5f1086d9e3646a14c3 är pushad på main.
Normal fullhook, 66 riktade tester och oberoende granskning PASS. CI
37960489826 är success efter en enda omkörning av failed-job: första försöket
nådde timeout vid installation av ffmpeg/jq, omkörningen passerade. Vercel är
READY och www pekar på samma deployment dpl_5nQph2fD1HeMnoBYWt3eHeLuWSZo.

Den faktiska produktionsdemon skapade via UI och återläste:
- Johns spelbolag, slug johns-spelbolag, med standardroller och utan medlemmar/inbjudningar.
- Johanna, ID johanna, med egen registrering av dealer-nora.mp4:
  f1e92965-940b-4722-9910-063ff409d110 → johanna.idle.ready.standard,
  Johanna · Grundloop, greenscreen. Noras post och källfil är orörda.
- Presentation johns-johanna, Johns spelbolag · Johanna, med endast Johanna
  som tillåten/startdealer. Tre lager sparade och återlästa efter omladdning;
  faktiskt visade i mobil- och desktopformat, samt uppspelade i Studio.
- Bord · Svart och guld: 4b688411-d186-4229-8f8a-046cd1b0a2c5,
  SHA 2265a92fe3c51df054dbb84416942d8a69bbc8b0f6209645636945d0874f1973.
- Bakgrund · Casino: 6ca45a4e-f696-4849-a3f7-a15dc872862f,
  SHA 1e03fe5e67c8c00ba241ce07f86200a3d3bc502e3b266e6b6d666f0e6cca91ba.
- Johannas blackjack, rum room-06f0722d-74bf-49ca-8546-f6328ac69909,
  skapat/publicerat till Johns spelbolag som paketversion 1.

Spelrummets verkliga länk:
https://www.scoutgaming.tech/play/blackjack?operator=johns-spelbolag&table=room-06f0722d-74bf-49ca-8546-f6328ac69909
Den öppnar separat spelarinloggning med operator och table bevarade.
Studio-inloggning räcker inte. Jakob är tillfrågad om manuell inloggning;
produktionsuppspelning och två idlevarv är ännu inte verifierade. Målet är inte klart.
Den gamla generella inloggningstexten nämnde alltid Astrid; den är nu neutral
utan ändring av autentisering eller konto-/speldata.

Lageruppladdningens tidigare HTTP 503 är nu rättad och provad i produktion.
Nativegrinden får verkligt projekt och verifierad mediapost före SQL;
behörighet och revision kontrolleras igen under lås. GET efter det misslyckade
försöket gav assets: [], varefter nya UI-uppladdningar skapade exakt två
registrerade lager med originalens hash/byteantal. Den första PNG-uppladdningen
kan ha lämnat ett okopplat Blobobjekt; ingen okänd fil har gissats eller raderats.
Biljetten från det misslyckade försöket är utgången/förlorad. Ingen recovery byggdes.

Render svarar capability v3 med rooms: operator-owned-v2,
registeredDealerMode: saved-registry-idle-v1 och frozenDealerIdle:
operator-package-v2. Exakt Render-SHA är fortfarande inte verifierad.
Sync-probe matchar oförändrad baseline; mänsklig läppsynkacceptans är separat.
GitGuardian: 17 lästa incidenter, 12 öppna, locationCoverage partial;
aktiv övervakning och ofullständig historisk skanning. Ingen ren säkerhetsstatus hävdas.

Privat klickbar bildfil: C:/Users/jakob/Desktop/Johns-spelbolag-bilder.html — 26 bilder, 21 produktionssteg och fem tydligt avskilda isolerade QA-bilder. De tre senaste visar de nya N1-kontrollerna i 1440/768/390.
Originalbilder och production-demo-browser-persistent.mjs ligger utanför Git:
C:/Users/jakob/.codex/visualizations/2026/10/09/01a1208f-20d2-7f03-837f-7f7fab0ae5f9/.
Beständig Edge-demoprofil finns där; läs/exportera aldrig authfiler eller
inloggningsfält. Starta hjälparen med tty:true om den behöver återöppnas;
stäng en tidigare instans först och återanvänd samma profil. Ingen lokal
produkt-/Lab-server körs. /control är publik Studio; /studio är teknisk basePath.

Fortsätt efter manuell spelarinloggning: öppna samma rumslänk, bekräfta
Johanna/paket 1 och två hela grundloopar med tre lager; spara nya stegbilder.
Skapa inte bolag, dealer, lager eller rum igen. Gör inga verkliga spelarinsatser
för QA. Box 4 utan videoklipp har redan bevisats hoppa över video och visa
serverägda kort i isolerad faktisk spelklient; det är separat från produktionsprovet.
Uppdatera bildfilen och denna handoff efter sista kontrollen. Alla fortsatta
leveranser på main genom tools/push-github-work.mjs; bevara andra agenters filer.

## 9 oktober 2026: rumsläsare, atomisk publicering och lokal repetition

Kompatibilitetsdelen inför rumsschema 2 med separata presentationLaneId och
gameLaneId. En uttrycklig /play/blackjack?operator=<slug>&table=<rum-id> kräver
ett live-rum som ägs av bolaget, finns i dess paket och binder en befintlig
spellane till en fryst presentation. Okänt/främmande/inaktivt rum ger 404;
otillgänglig lagring ger 503. Ingen reserv-lane väljs för en uttrycklig rumslänk.
Äldre ingång utan table och äldre sparade rum behåller sitt läsbeteende.

Publishern använder nu operatörslås och expectedRevision under samma SQL-
transaktion. Det delade repository-klientgränssnittet behåller scope och
återställer administration, historik, audit och paket även när ett fångat
valideringsfel uppstår. N2:s redan levererade revisionsargument får därmed
atomiskt konfliktskydd. Ingen SQL-migration behövs.

Runtime annonserar capability v2 (rooms: operator-owned-v2). Native Studio
kräver den före nya rumsskrivningar. Denna leverans aktiverar endast läsare
och transaktionsstöd; rum-writer och dess UI levereras separat. Render måste
uppdateras till denna etapp innan den nya rumfunktionen kan användas.

Verifierat: rum/entry/policy/readiness-regressioner 81/81 PASS; oberoende
CAS-granskning 40/40 PASS efter två rättade transaktionsfall. Offline-ingång
27/27 PASS; generation-media 3/3 och local-comparison 2/2 PASS. Tempfixturen
kopierar entry-kontraktets publika modulberoenden och lämnar inga servrar kvar.
Astrid, Vera, Amira och Mei spelades lokalt två gånger var på faktisk player-
väg med rätt dealer och utan JavaScript-fel. Åtta privata bilder och kvitton
finns utanför Git. Oförändrade media och sync-probe PASS; ingen ny läppsynk-
acceptans eller produktionsrepetition hävdas av detta.

Föregående Studio-etapp 3d4faaf3 har grön exakt-SHA CI 37935300051 och Vercel
production READY. N2-etapp 82d01ecf har CI 37942515170 success och Vercel READY
dpl_BV8qAas8ydphvL4zVk1JpLFxibWw. Kompatibilitetsetapp 3f70016a har fullhook
PASS, CI 37943725684 success och Vercel production READY
dpl_Ag2MCARdKiPcs8EY2R25mn5g5odj. Jakob meddelade Render-omdeploy; därefter
verifierades HTTP 200 health och capability v2 med operator-owned-v2.
Renders exakta SHA är ännu inte verifierad. Webbläsarstyrningen
felar i verktygets anslutning; den inloggade produktionsfliken har inte klickats.

Nästa stopptest: Johns spelbolag → separat dealer Johanna → Nora-filens egna
Johanna-mediaregistrering som grundloop + bakgrundsfilm + PNG-bord → redigerbar
sammansättning → publicerat rum → faktisk spelklient, med bild per steg och
två idlevarv. Generiskt registrerat dealerstöd och fryst idle-descriptor byggs
som nästa etapp; ingen Johanna-specialkod eller omdöpning av Noras post.


## 9 oktober 2026: N2-paket och verifierad legacyutrensning

Genomfört efter avstämning med **Förenkla menyer och förhandsvisning**.
Den tekniska roten `/studio` återexporterade `/control/clips`; den ger nu
308 till samma publika klippadress med bevarad query. BasePath/API består.

Inloggad operatör ser fryst paketdata för dealer, bord och bakgrund, med
tillgångarnas verkliga bild/videoformat. Bord, Bakgrund, Presentationslanes,
branding och Provbord använder paketvyn; de gamla lokala SVG-/bildproven
visas bara i den märkta fixturen. Provbord länkar till riktiga spelklienten.
Ändring kräver rätt roll, revision och val inom samma tilldelade lane.
Godkända fullbildsklipp behålls; nya separata bord/bakgrund/färg avvisas där.
Äldre paket utan fryst lagerformat kräver återpublicering före UI-redigering.
Partner-writer skickar nu expectedRevision till publisher; atomiskt CAS-substrat
levereras av den andra agenten i dess separata etapp. Rum-ID:n bevaras.
Marker/kort-design är nästa steg; spelvärden, kort och saldo ägs av spelmotorn.

Raderat lokalt och från produktkällan: tio filer, 259 423 byte:
- `lab/components/background-zones.tsx` och dess CSS; sparad zondata/API består.
- Åtta JS/MJS-kopior i `apps/croupier-frontend/public/kevin-cards/`; den tomma
  katalogen är borttagen. Aktiv `web/public/card-presentation`, kortbilder
  och URL-alias består.

Mailmallarna har en verklig referens i Kevin-originalvyn och behålls.
Fristående editor/viewer har dokumenterad användning och behålls.
Inga runtimebibliotek har bevisats överflödiga. Ingen mediefil eller
produktionsdatabas har ändrats; inget privat arkiv har lästs.

Verifierat: slutligt Lab-build och TypeScript PASS; paket/scope/roll,
bakade lager, MIME-format, snapshot, permanent redirect och stale-read-tester PASS.
Hela delade Lab-arbetskopian gav 1 142 PASS, 2 SKIP, 0 FAIL (1 144 tester);
den innehåller också andra agenters ännu separata rumstester.
Originalfyras `audit-dealer-sync --probe` PASS. Detta är inte nytt
lip-sync-godkännande. Produktions-CI/utrullning har eget kvitto efter push.
Den privata systemkartan är uppdaterad som Canvas.


## 9 oktober 2026: samlad Studio-etapp för löpande leverans

**Publicerad som 3d4faaf3; exakt-SHA CI grön och Vercel production READY.**
Studio har Sammansättning, Innehåll och Publicering. Drift, AI & chatt och
Administration är utfällbara grupper; Bolag & team ligger på
`/control/lanes?tab=companies`. Sammansättning samlar preview och lageruppladdning;
avancerade reglage finns kvar. Egna klippnamn bevaras, standardnamn är svenska.
Grundloop, sju spelarplatser och dealerns öppna/dolda/vända kort hålls åtskilda.

Spara och fortsätt väntar på en ren render och bevarar nyare utkast.
Publicering låser dubbelklick. Native inloggning behåller tillåten tab/lane-query;
äldre remoteUi-handoff tar fortfarande bort query. Direkt upload behåller
tekniskt kvitto, hash, revisions- och avbrottsskydd utan extra previewgodkännande.

Tom exakt utdelningsposition ger `position_clip_missing`/`skipped`, ingen
reservfilm. Spelmotorns kort fortsätter visas i 2D. Detta gäller också Noras
registrerade positionsfilm med `available:false`; annat speechbeteende ändras
inte. Publicering kräver inte kompletta positionsuppsättningar.
Vänster/mitten/höger är fortfarande tekniska eventgrupper: platser 1–2, 3–5,
6–7. De är inte grundloopar och ingen godtycklig positionsersättning införs.

Verifierat före commit:
- Lab produktionsbygge och TypeScript passerade.
- Hela Studio-sviten: 1 099 PASS, 2 SKIP, 0 FAIL (1 101 tester).
- Isolerad webbläsare: meny/tangentbord, 390/768/1440 px utan sidöverflöde,
  verklig PUT → sparning → sidhopp → omladdning, exakt box3 till Händelser och
  separerad bolagsvy; inga JavaScript-fel eller utkastdialoger.
- Runtime/kort/lager och saknade positioner har riktade regressioner; sista
  P2-korrigeringen har 45/45 PASS. Originalfyras sync-probe PASS, media oförändrade.
- Oberoende granskning hittade och ledde till rättade spar-/dubbelklicks- och
  saknad-fil-fall. Lip-sync eller produktionsrepetition är inte godkänd av dessa tester.

**Återstår:** produktionskontroll och riktig skapa-spelrum-kedja med Nora/Johanna.
Originalfyras lokala dubbelrepetition är verifierad i nästa kompatibilitetsdel
ovan. Ingen rumfunktion eller ny SQL-migration ingick i 3d4faaf3. Johns Nivå 2-brief/skiss
finns i teaminbox #9. Ingen kandidatmapp från separat legacygranskning har raderats.

## 9 oktober 2026: arbetsplan för Sammansättning som nav

**Status: genomförande pågår; etapper levereras efter verifiering.** Jakob har valt Sammansättning med tre
videolager som nav. Överflödiga vyer, självklara texter och bekräftelser tas bort;
avancerade funktioner behålls utfällbara. Inspirationsdokumentet kommer senare
och är vägledande, inte en bindande detaljspecifikation. Jakob har aktiverat måluppdraget och begärt löpande main-leveranser för
granskning i produktion. Ingen ny tracker skapas.

### Avsedd struktur och beteende

| Arbetsyta | Samlar | Standardbeteende |
| --- | --- | --- |
| Studio → Sammansättning | Dealer, bord, bakgrund, exakta provklipp | Gemensam stor preview; val och uppladdning vid respektive lager |
| Studio → Innehåll | Dealers & klipp, bibliotek, händelser, tal vid inaktivitet | Vald dealer följer med; Grundloop, Utdelning och Repliker; detaljer i paneler |
| Studio → Publicering | Presentationslanes, bolagspaket, export, spelkoppling | Samma sparade presentation; tydlig separat publicering |
| Drift | Bord/spelrum, uppspelning, spelintegritet, betalningar/journal | Operativa verktyg samlade, med nuvarande åtkomstkontroller |
| AI & chatt | Agentmodeller och operatörschatt | Två undervyer inom samma grupp |
| Administration | Bolag/team, konton/roller, partners | En förvaltningsyta; relevant bolagsval nås även vid publicering |

Översikt och Guide är lågprioriterade fasta länkar. Två layoutalternativ provas:
utfällbara Studio-undervyer i vänstermenyn, eller en Studio-ingång med tre flikar
på sidan. Ordvalet Publicering är ett arbetsnamn; presentationslane, spellane och
spelrum får inte blandas ihop i datamodell eller användarflöde.

- Direkt förhandsvisning utan manuellt godkännande. Uppladdning: välj fil,
  automatisk teknisk kontroll, filen vald i preview. Fel visas vid berört lager.
- Samordnat Spara och fortsätt ersätter onödiga sidhoppsspärrar där det går.
  CAS/revisionskontroll och konfliktåterhämtning måste skydda osparade ändringar.
- Kortnamn beskriver handling eller replik: exempel Lugn blick, Leende,
  Första kortet, Välkommen till bordet. Dealer/kategori visas separat.
  Befintliga egna namn bevaras; originalfilnamn, ID och hash finns under Avancerat.
- Grundloop behåller viktade Basklipp och Variationer. Tal vid inaktivitet är
  en annan funktion. Förhandsvisa klipp är ett provval, ingen runtimekoppling.
- Menytexter, hjälptext och tomma förklaringsblock rensas. Tekniska felmeddelanden,
  behörighetskontroller, upload-biljetter/hashar och capability-skydd bevaras.
- Radera ersatta UI-komponenter först efter referens-/användningskontroll.
  Befintliga alias, sparad zondata, media och kompatibilitetsläsning består
  tills deras beroenden är verifierat avvecklade.

### Genomförande i ordning

| Etapp | Arbete | Klart när |
| --- | --- | --- |
| 1. Meny och nav | Gemensam skalstruktur, valt sammanhang och utfällning | Aktiv undervy, tangentbord, omladdning, bakåtknapp och djup-/querylänkar fungerar |
| 2. Sammansättning och innehåll | Lagerpaneler, direkta provval, enhetlig dealeruppladdning inklusive greenscreen | Upload → preview → spara → omladdning fungerar; avbruten upload och revisionskonflikt förlorar inget utkast |
| 3. Texter, namn och legacy | Renodla paneler, synliga namn och oanvänd UI-kod | Alla befintliga funktioner går att nå, ID/replik/kortplats och egna namn är oförändrade |
| 4. Publicering och spelrum | Koppla presentation till kompatibel spellane och rum | Paket/behörighet valideras; upprepat klick skapar inga dubbletter; komplett isolerat flöde till spelaren verifierat |
| 5. Dokumentation och leverans | Uppdatera guide, ordlista, teknisk referens och denna handoff | Menynamn/route/flöde stämmer; relevanta tester, visuell QA och exakt-SHA driftkontroller redovisade var för sig |

Etapp 4 börjar med att fastställa API-kontraktet: återanvänd kompatibel spellane
eller skapa en ny, och skapa därefter ett faktiskt rum. Detta är inte bara en
knapptext. Nora kräver egen kompatibel spellane; live-AI-chatt för Nora ingår inte.

### Arbetsfördelning och verifiering

Samordnaren äger integration, utkast/sparning, publiceringskontrakt och gemensamma
dokument. Underagent A arbetar med meny/skal; B med klipp- och lagerpaneler;
C gör en separat granskning av städning, terminologi och tillgänglighet.
Högst tre underagenter samtidigt; exakta filclaims innan ändringar, samordnaren
äger .git vid integration. Ingen branch eller worktree skapas.

Relevanta filer: lab/lib/scout-navigation.mjs, lab/components/workspace-navigation.tsx,
control-preview-page.tsx, composition-preview.tsx, layer-library.tsx,
family-video-upload.tsx, video-metadata-fields.tsx, control-lanes-page.tsx och
lane-editor.tsx under lab/components. Navigationstester finns under lab/test.
Dokument ändras i lab/docs/README.md, lab/docs/TERMINOLOGI.md,
docs/LOCAL-PRESENTATION-RUNTIME.md och denna handoff tillsammans med respektive etapp.
CLOUD-MIGRATION uppdateras bara för verifierade ändringar i befintliga poster.

Standard i editorn är tre lager; fullbildsfilmer fortsätter fungera som fullbild
och döljer separata bord/bakgrund. Ny default i spelruntime kräver egen verifiering:
originalfyra dealers, två uppspelningar vardera, Nora och hela paket → partner →
spelare. Visuell lip-sync-acceptans är inte ett hinder för vanlig upload/preview
men kan inte ersättas med hashkontroll vid ändrat spelmaterial.

Planunderlag kontrollerat mot main 40b2931 och kort överlämning från chatt "1".
Skapa spelrum från presentationslane saknas; CUA-visuell slutkontroll och Nora-
produktionsacceptans är fortfarande öppna. Den ursprungliga planeringsvändan ändrade ingen produktkod; den aktuella
implementationens testresultat står i leveransavsnittet ovan. Säkerhetsläsning vid start:
12 öppna GitGuardian-incidenter; platsmetadata delvis och historisk skanning
ofullständig, aktiv övervakning. Ingen incident har ändrats.

Jakobs modellkrav: minst GPT-6.1 Sol med extra hög tankegrad för underagenter.
Samordnaren hanterar integration och svårare avvägningar.
John och hans agent har fått originalskissen och Nivå 2-uppdraget via
[teaminbox #9](https://github.com/Jakeminator123/scoutgaming/issues/9).
Utdelning ska uttryckligen behålla separata spelarplatser och dealerpositioner.
Svenska visningsord dokumenteras i ordlistans kolumn Svenska.

## 9 oktober 2026: samlad Studio-meny och enklare sammansättning

Jakobs meny- och begreppsbeslut är genomfört med underlag från chatten
”Kartlägg terminologi och kontrollmen”. Ett Studio samlar Dealers & klipp,
Klippbibliotek, Sammansättning, Lanes, Händelser och Tal vid inaktivitet.
Zoningångarna går till Sammansättning; gamla zondata och tekniska ID:n bevaras.
Översikt visar fyra steg: dealer/klipp → sammansättning → lane → spelrum/bord.

Grundloop är idle-loop med Basklipp och Variationer. De befintliga basklippen
väljs fortfarande viktat; inget ”reservklipp” har införts. Vikter, tester,
spelvägar och diagnostik öppnas under Avancerat. Utdelning och Repliker
är övriga klippflikar. Probe heter Tal vid inaktivitet och ligger under Studio;
den befintliga Astrid-begränsningen framgår. Inga ändringar av spelruntime,
mediefiler, sparad produktionspolicy, databas eller AI-behörighet.

Sammansättning och Lanes skickar valt lane-id mellan vyerna. Osparade utkast
stoppar nästa länkhopp. Publicering, bolag, JSON-export och avancerade urval finns
kvar. Spelkoppling leder till Administration → Bord. En knapp som automatiskt
skapar ett spelrum från en presentationslane ingår ännu inte.

Verifierat: Studio 1 061 PASS, 0 FAIL, 2 SKIP; Lab-bygge och TypeScript PASS.
Dealer-audit --probe matchar originalfyra utan medieändring. Oberoende kodgranskning
hittade ingen blockerare; gammal guidehänvisning rättad. Slutlig fullregression
körs före commit; exakt-SHA CI/Vercel redovisas vid leverans.
CUA-startfel finns kvar, så ny visuell granskning i inloggad produktion är inte gjord.
Noras produktionsfiler, fyradealerrepetition och hela lane → rum → spelare-flödet
återstår att acceptera.

Föregående Nora-leverans 260e439a hade grön CI 37918069540 och Vercel READY på
exakt SHA. Efter Jakobs andra Render-redeploy svarade /api/presentation/capabilities
200 med Nora/per-clip. Renders exakta commit-SHA har fortfarande inte lästs.


## 9 oktober 2026: kortare aktiv terminologi

`lab/docs/TERMINOLOGI.md` är nu en kort ordlista med matriser och textflöde,
cirka 25 % färre ord. Presentationslane skiljs från spellane; Nora,
fullbild/greenscreen, samlad Studio-meny och acceptansgränser finns med.
Grundloop, Basklipp, Variation, Sammansättning och Tal vid inaktivitet
är samordnade med Studio-ombyggnaden; gamla zoningångar pekar på Sammansättning.
Historiska GitLab-/snapshotreferenser, dubbleringar och tekniska
legacyöversättningar har tagits bort ur ordlistan. Dokumentändringen innehåller
ingen produktkod. Den lämnas till den samlade Studio-integrationen: separat
commit stoppades av ett test mot den samtidigt ändrade zoningången.

De två PDF-underlagen från 6 oktober och en identisk Desktop-kopia har
arkiverats privat med ursprungliga sökvägar, storlekar och SHA-256 i manifest.
Tre av tre arkivhashar matchar; inget underlag har raderats.
Tabeller, kodblock, relativa länkar och kvarvarande guideankare är kontrollerade.
Produktionsstatus och visuell spelacceptans påverkas inte av dokumentändringen.

## 9 oktober 2026: Nora och videoeditorn integreras i Control

Jakobs val är **egen dealer Nora**. Dealerregistrering på `/control/clips`
skapar 16 egna tomma baselines. Native upload/classify kräver sparad registrering
och rätt behörighet; ingen Astridmedia kopieras. Filmens metadata väljer fullbild
eller greenscreen med bounded key-inställningar. Övriga framtida dealer-id kan
beskrivas i modellen, men runtime och utrullningskontroll godkänner nu bara Nora
utöver originalfyra; detta är inte ett generellt live-dealerlöfte.

Förhandsvisning använder samma compositor som det lokala Nora-provet: dealer,
bild/video för bord och bakgrund, mobil/desktopplaceringar, två uppspelningar
och tillfälligt trefilsprov. Placeringar sparas i lanen och fryses i bolagspaketet.
Actual game-player använder det exakta valda klippets frame/clock och metadata.
Fullbild undertrycker separata lager. Publicerade lager läses enbart via
bolagspaketets befintliga tillgångsväg. Nora idle kräver exakt egen sparad
idle-baseline och spelas muted; ingen Astridfallback. Live AI-chatt för Nora
är inte tillagd; originalfyra behåller sin befintliga chattväg.

**Utrullningsgrind:** Render autoDeploy är avstängd och dess SHA är inte verifierad.
Native Studio måste få en betrodd capability från Render före nya Nora-/lager-
skrivningar i gemensam Neon, även inuti repository.transaction. Gamla
projektoperationer behöver inget capability-anrop. Render uppdateras separat;
Vercel READY räcker inte för spelacceptans. Ingen produktionsdata har ändrats.

Lokalt: Studio **1 057 PASS, 0 FAIL, 2 SKIP**. Slutligt Lab-bygge, TypeScript
och Vercelfrontend-bygge med spelarflagga och isolerade buildvärden passerade.
Riktade runtimeprov: 101 PASS; Native utrullnings-/saveprov: 83 PASS;
Blobexport: 6 PASS. Dealer sync `--probe` matchar baslinjen för originalfyra.
Ordinarie fullregression körs av commithook; exakt-SHA CI/deploy-resultat
redovisas vid leveransen. Mänsklig lip-sync-acceptans kvarstår.

**Sandbox:** default-exec och CUA misslyckas före start. Sandboxloggen visar
os error 32 vid ACL-validering av Codex `node_repl.exe`. Flera Codex-processer
och två chattar finns. Read-only Windows Restart Manager bekräftade åtta
node_repl-resursanvändare under samma Codex/ChatGPT-processkedja; det pekar
inte ut ett ensamt blockerande filhandtag eller en specifik chatt. Inga belägg
för att dev-servrar, git push, Parsec eller Tailscale orsakar detta. Båda
fjärrverktygen används enligt Jakob och har lämnats igång. Hypotes/fynd är
sparade i privat Codex-minne. Ingen omstart eller sandboxreparation är verifierad.
Ett isolerat produkt/Lab-par byggdes och stoppades inför fullregression.
Sessionvakten nekade korrekt ett tests andra par medan QA-paret var igång;
QA-portarna 4192/4194 är nu fria. Inga parallella produktpar startades.
CUA är därför blockerande för nya visuella spelrepetitioner, inte för skaltester.


## 9 oktober 2026: smidigt GitGuardian-läsflöde

`node tools/security-status.mjs` läser nu GitHub-status och GitGuardian-incidenter
parallellt i en kompakt rapport. Befintlig DPAPI-koppling återanvänds; inga nya
nycklar eller rättigheter. Projektets Codex-konfiguration registrerar den
befintliga stdio-servern med `read_security_status`, `read_source_binding` och
`read_repo_incidents`. `codex mcp get gitguardian --json` verifierar registreringen;
en redan öppen chatt kan behöva laddas om för att få de nya verktygen.

Live mot remote main `ef5ff919`: komplett incidentlista, 17 incidenter varav 12
öppna och 5 ignorerade. 6 öppna incidenter saknar fil/rad; luckan är synlig.
Repositoryövervakning är active/monitored=true. GitHub-suite är queued utan
check runs på direktpush-committen. Senaste helhistorikskanning 2 oktober är
`too_large`; aktiv övervakning och läst incidentlista bevisar inte full historik
eller en lyckad skanning av exakt senaste SHA. Ingen incident har ändrats.

Verifiering: 34/34 riktade säkerhets-/MCP-tester PASS, riktig stdio/API-läsning
och Codex MCP-registrering verifierad.
Återstående: bedöm de öppna incidenterna separat; utred saknade platser om de
behövs. Ingen ny CI-installation eller bakgrundsövervakning infördes.

## 8 oktober 2026 kväll: övertagande och isolerat Nora-kompositionsprov

Övertagandet återläste lokal och remote main `cad8f6e6` samt GitHub-körning
`37832989977` (success). Vercelprojekt `scoutgaming` i team `scoutgaming` har
production target READY på samma SHA; www-aliaset pekar på
`dpl_4J12tc6ncJg2swjdWKZafFpy7kse`. www svarar 200 och apex 308 till www.
Render `/__cloud/health` svarar 200/ok men lämnar ingen commit-version.
GitGuardian-suite är queued; incidentlistan är fortfarande `not-read`.

Jakob gav tre lokala testfiler: bakgrundsvideo (1920×1080), Noras gröna
dealervideo (1080×1920) och ett transparent PNG-bord (1440×2560).
Videorna är H.264, 24 fps och 10,042 s utan ljudspår. Byte-identiska kopior
ligger i Git-ignorerade `lab/preview-build/nora-test/media/`; originalen och
godkända produktmedier ändrades inte. En lokal testvy använder den befintliga
WebGL-kompositorn med grön nyckling, mobil 9:16, desktop 16:9 och individuella
lagerkontroller. Båda videorna spelar och loopar; bordets alpha visar 75,1 %
helt transparenta pixlar. Lager av/på och schackrutebakgrund har granskats i
webbläsaren. Bilder finns privat i `lab/data/qa-composition-nora-20261008/`.
Testvyn är inget aktiverat dealerpaket: handmask, kortkalibrering, repliker och
acceptans i den faktiska spelaren återstår.

Ett isolerat lokalt produkt-/labbpar behålls för Jakobs interaktiva prov:
`http://127.0.0.1:4192/preview/nora-test/index.html`. Det startades med
`node lab/start.mjs --offline --no-open --skip-build`, tom testdatabas och
externa tjänster avstängda. Ingen ny server får startas parallellt.

Astrids goodluck slutförde två repetitionplays i den gemensamma spelaren.
Vera-/Amira-query i samma offline-fixtur räknas däremot inte som acceptans av
dessa dealers: odekorerad HTML saknar serverns lane-dataset och klienten
faller tillbaka till `mobile-phone`/Astrid/local. Produktionslanens
Astridbegränsning är avsiktlig; fyradealeracceptansen kvarstår.
Produktionsprojektet visar dessutom standardförslaget mobile-phone utan en
uttryckligen sparad lane och med tomt lagerbibliotek. JSON-exportknappen
startar en nedladdning på 934 byte, men IAB avbryter den före mottagna byte.
Själva nedladdningsfilen och export → partner → spelare är därför fortfarande
overifierade. Inga produktionspaket eller konton ändrades i provet.

## 8 oktober 2026 kväll: T10 — tre val och frysta lane-paket

Produktkoden levererades på main som `813c25a6`; full lokal commit-hook passerade
och Vercel-deploymenten blev READY. GitHub-jobbet `presentation-studio` hittade
därefter fyra gamla UI-förväntningar: teknisk offlinecopy, låst lane-checkbox,
iframe-only-preview och den gamla menyn. De har uppdaterats till det avsedda flödet
och lagts i full lokal regression. Studio-suiten: 1 029 pass, 0 fail, 2 skip.
Preview-testet verifierar dessutom att den delade dataläsaren stoppar 401/partner
innan Studio-data läses. Ny meny, sparad lane och tre väljare har även lästs på
`www.scoutgaming.tech/control/preview` efter omladdning. Inga mediefiler ändras.

Jakob gav Codex uppdraget att fortsätta efter masterplanen. Astrids godkända
filmer ska vara kompatibla fullbildslager tills godkända frilagda dealerpaket finns.
Start och plan finns i `random/start-T10-2026-10-08.md` och
`random/masterplan-t10-konsolidering-2026-10-08.md`; alla tre T10-dokument kom med
i remote main `ddc58fcb`. Aktivitetsdokumenten fanns redan på main.

- Studio har tre huvudingångar: Dealers & klipp, Förhandsvisning och Lanes.
  Bibliotek, zoner och händelser är kvar under Studio · verktyg.
- Förhandsvisning redigerar samma sparade lane som Lanes: dealer, bord och
  bakgrund, standardval, tillåtna alternativ och synlighet. Exakta befintliga
  klipp kan provas; Paow/Dragge-provet finns kvar i en utfällbar del.
- Lagerbiblioteket registrerar bild/video i privata Blob-namnrymder
  `croupier/media/backgrounds/` och `croupier/media/tables/`. Prepare/commit kräver
  Studio-session, rätt scope, origin, giltig uppladdningsbiljett, verifierad hash
  och projektets aktuella revision. Ingen ny SQL-migration behövs: biblioteket
  ligger i projektdokumentet. Offline saknar uppladdning och molnpublicering.
- Lanes kan exportera ett validerat JSON-manifest från sparat innehåll.
  Publicering fryser valda lanes och refererade lager i operatörspaketets
  reserverade, komprimerade `_scoutPresentation`. Hashen kontrollerar integritet;
  det är ingen digital signatur. Paketet behåller den befintliga storleksgränsen.
  Exporten innehåller filreferenser, inte videofiler eller leverantörshemligheter.
- Partnerns val begränsas till en publicerad lane och dess rättigheter.
  Spelstart läser frysta presentationsval och delar inte privata biblioteksfiler
  som bolaget saknar i sitt paket. Kort, saldo och spelutfall förblir serverägda.
- Tre lager är redigeringsmodellen. Ordinarie opaque dealerfilm förblir fullbild;
  bakgrund/bord kan inte bytas självständigt bakom dess inbakade pixlar.
  T9-renderern är fortsatt opt-in. Fler dealers och frilagda standardpaket återstår.

Verifierat separat: TypeScript, riktade kontrakt-/behörighetsprov, privat
uppladdning med testlager, paketfrysning, delad spelentré, offline save → reload,
video Range 206 och visuell editor. Full regression körs av leveransens commit-hook.
`audit-dealer-sync --probe` passerade för samtliga fyra dealerbanker; tidigare
saknade repliker och mänsklig läppacceptans kvarstår. Inga godkända medier ändrades.
Webbläsarens klickverktyg fastnade före dispatch: fyra dealers × två spelningar,
JSON-nedladdning via knapp samt riktiga Blob/Neon/partner-klick är inte godkända
som end-to-end. Den isolerade serverparet stoppades och dess tillfälliga data raderades.

Vercel-team och projekt verifierades som `scoutgaming`. GitHub API visar repot
som **public**, trots README:s tidigare private-uppgift. GitGuardian-suite på
setup-commit `ddae3b5d` är queued; incidentlistan är `not-read`.
Produktionsdeploy och Render-version ska kontrolleras mot den levererade SHA:n.

## 8 oktober 2026 kväll: Codex och befintlig checkout

Arbetskatalogen är `C:/Users/jakob/dev/projects/scoutgame`, på `main` i
`Jakeminator123/scoutgaming`. Efter Cursor-agentens leverans hämtades remote main:
`ddc58fcb`, utan divergens. Ingen ny checkout eller flytt av lokala filer gjordes.
De 60 inventerade filerna i `random/` och 16 `.env`-filerna behöll samma SHA-256;
hemliga värden ingår inte i rapporten eller Git.

`.codex/config.toml` ger projektet `workspace-write`, nätåtkomst, automatisk
granskning av utökade behörigheter och Windows-sandbox `elevated`. Modellval och
inloggningar ärvs från användaren. Git använder `.githooks`, fast-forward-only pull
och prune vid fetch. Codex-CLI uppdaterades via Volta från 0.150.0 till 0.161.0;
enbart det föråldrade `mcp_servers.vercel.type` togs bort ur användarkonfigurationen.

Verifierat: TOML, faktisk laddning från rätt cwd, installation, auth, sandbox,
HTTP-åtkomst och WebSocket-handshake via `codex doctor`, samt filbevarande.
Repoets fulla pre-commit-kontroller körs vid commit. Systemkartan har 0 röda fel
men gul baslinjedrift. GitGuardian-suite väntar; incidentlistan är inte läst.
Valfria CLI-varningar kvar: desktopvariabel för `node_repl`, Defender-exkluderingar
ej verifierade och `TERM=dumb` vid icke-interaktiv körning. Produktservrar startades
inte. T10 är fortsatt en plan; detta arbete ändrar ingen spel- eller medialogik.

## 8 oktober 2026 eftermiddag: T9 layer-preview bakom flagga

Spelvägen har ett opt-in-spår för tre lager utan att röra Astrids ordinarie local-väg:
ny server-lane `layer-preview` (`renderer: layered`, default dealer `paow`) och ny
Render-rutt `/layer-packs/*` som bara svarar när entrén har satt cookie-flaggan
`croupier_layer_preview=1`. Rutten serverar runtime-moduler från
`test-videoeditor/program/web` och manifest/media från `lab/preview-build`, med
`Range`-stöd och `Cross-Origin-Resource-Policy: same-origin`.

Klienten har ny modul `web/public/layered-presentation.mjs` som monterar canvas i
`#scene`, laddar `/layer-packs/<dealer>/manifest.json` och matar `bridge.consume`
med serverns `presentation[]` från `/api/table`. `unsupported[]` (exempelvis `speak`)
loggas som kvitto i observationsflödet och kastas inte. Om paket saknas visas
`Lagerpaket saknas · 2D-reserv` och ordinarie DOM/SVG-kort fortsätter.

`gameChoices` för `layer-preview` öppnar dealer-val `paow/dragge` och bakgrundsval
från katalog-ID:t; panelen Ditt bord använder samma lagring som N3.4.
`#dealer-options` listar fortfarande bara dealers i `DEALERS`-objektet, alltså inte
Paow/Dragge där ännu; de syns i Ditt bord-panelen.

## 8 oktober 2026 sen eftermiddag: e-postinbjudan för operatörspersonal

`invite` i partner-API:t och `operator-membership` med e-post skapar ett partnerkonto utan
hash, en engångstoken (samma `tokens`-tabell och `studio-sha256:`-hash som Studio) och
medlemskap `invited` när adressen saknas; ett befintligt partnerkonto kopplas `active` utan
mejl. Mejlet (Resend, rubrik "Inbjudan – operatörspersonal, nivå 2") bär bolagsnamn, roll och
länk till `/partner/set-password?t=`. Svaret är alltid `{ invited: true }`; högst 5 per aktör och
timme, sedan 429. `POST /api/partner/set-password` konsumerar token, sätter scrypt-hash, bumpar
auth-epoch och aktiverar inbjudna medlemskap; Studio:s set-password och login vägrar fortfarande
roll `partner`. Journalen loggar maskad e-post. Översikten `/control` läser riktiga bolag via
`listLaneOperators()` när native admin är på. Inte klickat i webbläsare; inget riktigt mejl skickat.
Kvar: glömt-lösenord för partner, journaltabell.

## Nuläge per funktion

| Funktion | Status | Avsnitt |
| --- | --- | --- |
| Klipplogik och lane | påbörjad — system A är det enda urvalssystemet och `select` gäller alla fyra dealers (Astrid bevisat oförändrad, baslinje 160 anrop); `project.lanes[]` redigeras och publiceras på `/control/lanes`; lanen bär zoner, bordsfärger, probe och idle som valfria fält; Render läser paketet på `/blackjack?operator=` och Vercel `/play/blackjack?operator=` hämtar det dokumentet (L8b); kvar: rehearsal Vera/Amira/Mei (2D-reserv tills nya paket), tre lager i spelet (Jakobs gren), klick i prod. Uppföljning: `random/checklista-2026-10-08.md` | 8 okt eftermiddag |
| Nivå 1 /control | påbörjad — en kodgeneration på sidmallen; Händelser en sida, Probe i menyn, Lanes med lane-redigerare, Översikt med anslutna bolag, Uppspelning är loggen, ljust läge rättat på fyra ytor; kvar: filterchips (11), Probe verifierad i prod (C9) | 8 okt middag |
| Nivå 2 /partner | påbörjad — session finns; team och branding skrivs (revision som CAS, sista-admin-spärr i lagret); Bolag på `/control/lanes` skapar bolag, roller och medlemskap; e-postinbjudan skapar inbjudet partnerkonto + engångslänk till `/partner/set-password`, kontot kan sedan logga in på `/partner/login` (5 inbjudningar per aktör och timme); Översikten listar riktiga bolag ur Neon när lagret är på; kvar: journaltabell, glömt-lösenord för partner, speldata, prod-klick | Skrivande partnerrutter, Partnerportal |
| Nivå 3 /play | påbörjad — lobby med `Spelar hos` och senaste bord/dealer från webbläsaren; redigerbar profil (namn, språk; migration `006` väntar); historikrutt; panelen Ditt bord väljer dealer och bordsfärg inom lanen (N3.4). Bakgrund är avstängd när filmen är inbakad. Valet ligger inte på kontot | Spelaryta |
| Tester och dokumentation | klart 7 okt natt — körare för lösa tester, dokumentation mot kod (D1–D32); 8 okt: CI-steget Orphan tests, ffmpeg från cache, GPU-workflows på `ubuntu-24.04` | Pass M |
| Studio-migrationer | klart — 001–005 applicerade på produktions-Neon 7 okt; CI-spärr före deploy | Partnerportal |
| Systemkarta | klart — tre nivåer, CI-spärr; baslinje `8ebb53e2`, grå med 0 röda | Systemkarta |
| Render croupier-v2 | manuell deploy 8 okt 12:45 med L8/N3 (`/api/profile` svarar 401, `/api/operators/<slug>` läser Neon); `006-player-profile.sql` väntar på körning | Aktuell leverans |

Uppdaterad 8 oktober 2026. Detta är den enda löpande handoffen.
[Äldre komplett handoff, fryst på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/JOHN-HANDOFF.md)
bevarar samtliga tidigare statusnotiser och kvittoplatser. Privata bevis,
journaler och backups ligger kvar; detta är dokumentstädning, inte nya order.

## Skrivande partnerrutter, 8 oktober 2026 eftermiddag: bolag, roller, team (N2.2, N2.3)

Byggt på 005 och `ac936377` utan att vänta på Kevins svar (#3); ingen migration. Väntar på orkestratorns granskning.
Nivå 1: POST `operator-create` (bolag med standardrollerna `partner-admin`, `partner-editor`,
`partner-viewer`), `operator-role` (kända behörigheter; `team.roles.assign` bara på `partner-admin`)
och `operator-membership` (befintligt konto med roll `partner`, revision som CAS, sista-admin-spärr).
Kortet Bolag på `/control/lanes` listar bolag och medlemmar, skapar bolag, lägger till medlem via
användarnamn, byter roll och stänger av. Äldre bolag som `sg-test` får rollerna med Skapa saknade
standardroller; först med ett medlemskap som `partner-admin` eller `partner-editor` slutar
branding-skrivningen ge 403. Nivå 2: `GET/POST /api/partner/team?operator=` (GET kräver `team.read`,
POST dessutom `team.roles.assign`). Bjud in kopplar ett befintligt partnerkonto via e-post; ingen
e-post skickas (N2.6). `partner-admin` är inte delegerbar, så operatören kan inte utse, degradera eller
stänga av administratörer. Kevins `team.jsx` har ett additivt `runtime.team`; utan det renderas vyn
som förut. Bjud in och rollbyte anropar API:t i riktig session; avstängning finns i API:t och i Bolag,
inte i Kevins vy. Journaltabell saknas: varje skrivning ger en serverloggrad `[operator-journal]`
(at, actor, action, operatorId, target, ingen e-post). Testat: lab `npm test` (två webbläsartester
hoppas över som förut), `npm run typecheck`, `npm --prefix lab run build`, hela
`.githooks/pre-commit-full` (Kevins portaltest, `test/operator-store.mjs`,
`test/partner-access-policy.mjs`), systemkartan utan fel. Kvar: e-postinbjudan och accept-steg,
journaltabell; en admin-409 skiljer inte sista-admin från revisionskrock; låstimeout i partner-API:t
blir 503. Kevin godkänner rollnamn, standardbehörigheter, placering och journalformat.

## 8 oktober 2026 middag: paketet når spelet, select för fyra dealers, spelarprofil

Tre promptagenter levererade parallellt, orkestratorn löste korsfelen och mergade.
Spelmotorn läser operatörspaketet på `/blackjack?operator=<slug>` (lane och dealer
begränsas till paketet, 30 s cache, okänd slug 404, utan `?operator=` oförändrad väg).
`POST /api/presentation/select` gäller alla fyra dealers; `legacyClipPolicy` översätts till
standardvarianter vid läsning och Astrids svar är bevisat oförändrade (baslinje 160 anrop,
`tools/astrid-select-baseline.mjs`). Vera, Amira och Mei spelar 2D-reserv där klipp saknas
tills nya paket finns. Spelaren kan redigera visningsnamn och språk (`PATCH /api/profile`,
saldo serverägt) och lobbyn visar `Spelar hos`. Migration `006-player-profile.sql` väntar på
körning mot spel-Neon, Render väntar på manuell deploy, rehearsal av tre dealers väntar på Jakob.
Uppspelning är nedbantad till loggen; ljust läge rättat på `/partner`, guiden, chatten och
inspektorn; demo-bolagen bor i `web/demo-operators.mjs` så servern inte importerar `lab/`.

## 8 oktober 2026 eftermiddag: Vercel bär paketet, spelaren väljer inom lanen

L8b och N3.4. Vercel `/play/blackjack?operator=<slug>` hämtar Renders `/blackjack`-dokument
(paketets lane och dealer, bolagets 404, 503 om motorn inte svarar). Ogiltig slug och en
signerad launch med `claims.partner` skickas inte som operatör. Utan `?operator=` är vägen
densamma som förut. Spelet får `gameChoices` från lanen även utan bolag. Panelen Ditt bord
byter dealer via befintlig adress och lägger bordsfärg på filt-märke, plånbokskant och
marker. Inbakad bakgrund går inte att välja. Valet sparas i `localStorage`, inte på kontot.
Testat: spelentré, spelarval, lobbyns text, fuzz 3000 rundor, dealer-probe PASS. Inte klickat
i webbläsaren eller i produktion. N2.2 (skrivande partnerrutter) har ingen kod i den här leveransen.

## 8 oktober 2026 förmiddag: Lanes, clipLabels, CI-actions

`/control/lanes` publicerar ett operatörspaket (POST `operator-package`) och kan skapa
`SG test game provider` på klick (POST `operator-create-demo`). Skrivningar kräver Neon-pool
med `connect()`; `{ query }` ger 503. Spelet läser inte paketet. Klippbibliotek sätter
`project.clipLabels` via sidans Spara. `dealer-regression` använder `pnpm/action-setup@v6`
och `actions/upload-artifact@v7`. Kartans L3-ruta är live.

Andra passet samma förmiddag (fyra parallella underagenter): `/control/lanes` har en
redigerare för `project.lanes[]` (ny lane, dealers 1–4, lager, OpenClaw-läge,
bolagsjusteringar; Spara projekt är sidans lime, Publicera paket sekundär; id låses vid
skapande). Översikten listar anslutna bolag ur fixturen med länk till `/partner/{slug}`.
Partner-API:t har `GET/POST …/branding?operator=` som läser och skriver bolagets utseende
inom lanens `operatorAdjustable` (revision som CAS, rättighet `presentations.configure`,
pool med `connect()`); panelen visas i Kevins vy Färger, marker och kort för inloggad
operatör. Inga roller seedas förrän N2.2, så skrivningen ger 403 i produktion tills dess.
Död CSS borta, guiden har dagens sidnamn, `returnTo` efter utloggning pekar tillbaka på
`/control/preview` och `/control/lanes`. Jakob 10:32: `/control/lanes` ersätter Kevins
gamla alias som ledde till Administration. Promptfiler för L8, C5b och N3 ligger i `random/`.

## Pass S, 8 oktober 2026 natt: klipplogik steg 3a, Händelser en sida, förhandsvisning

Jakob 02:49: "kör enligt rekommendationerna, bortse från John om det blockar". Beslut 49–59 i
`random/beslutsmatris-2026-10-07.md`; förslag `random/k2-forslag-2026-10-08.md`; fakta
`random/k1-fakta-spelvagen-2026-10-08.md`; uppföljning `random/checklista-2026-10-08.md`.
Fyra underagenter parallellt, orkestratorn granskade och rättade.

Ändrat. Studio-projektet har `lanes[]` (presentation lane: dealers, lager bakgrund/bord/dealer,
OpenClaw-läge per händelsetyp, vad bolaget får ändra) och `clipLabels`; `schemaVersion` kvar på 1,
standardlane `mobile-phone` när nyckeln saknas, ingen läsare ännu. Klipp visas med svenska namn ur
`familyId` + roll utan filbyten. Händelser är en sida: `/control/events` utan `?event=` är
översikten, `/control/tree` omdirigerar 308 med frågesträngen kvar. Menyraden heter Probe, Johns
fyra etiketter är djuplänkar `/control/administration?tab=`, inloggningskortet ligger på
sidmallens tokens. `test-videoeditor/` bär lagerprovets material (ursprungligen grenen
`test-video-jakob`, byte-identiskt speglad och raderad 8 okt 18:35; förhandsvisning Paow/Dragge 720p,
12 MB, webbspelare med WebGL-kompositor); `/control/preview`
visar den bakom adminsessionen via `/preview/[...path]` (ingen publik kopia, media som filer,
inget till blob eller databas). `test/fuzz-blackjack.mjs` fuzzar serverns `web/shoe-game.mjs`
(3 000 rundor i kroken, 100 000 gröna). Systemkartan har sidan och handlern; menynamnen är
uppdaterade i `AGENTS.md`, `CLAUDE.md`, README-filerna, labbguiden, terminologibladet och driftdokumenten.

Testat: labbtester 954 gröna (2 skippade sedan tidigare), typecheck, systemkartan 0 röda,
orphan-kontrollen 263 filer, full pre-commit-krok per commit, lab-bygget med prepare-steget.
Produktion verifieras som `LLM`: `/control/events` med och utan `?event=`, `/control/tree?dealer=astrid&event=idle.ready`
(308), `/control/probe`, `/control/administration?tab=accounts`, `/control/login` ljust/mörkt,
`/control/preview` (Paow/Dragge spelas, inget skrivs), `/studio/preview/index.html` utan session
ska leda till inloggning.

Kvar: K steg 3b (select för alla fyra dealers, `legacyClipPolicy` → standardvarianter) kräver
rehearsal med Jakob dagtid. Lane-export, bolagets yta, demo-operatör (L1–L3, rad 44). Redigering
av `clipLabels`. Systemkartans `planned`-rutor (matris 42). Nivå 2-rutter väntar på Kevin.

## Pass M, 8 oktober 2026 natt

Mekaniskt pass enligt `random/handoff-2026-10-08-orkestrator.md`, två underagenter parallellt,
granskat av orkestratorn. Beslut i `random/beslutsmatris-2026-10-07.md` rader 45–48.

Ändrat: `a91f92ee` tre gränssnittstexter (L20–L22). `820709dd` Uppspelning monterar det
rullande observationsfönstret via en egen `rolling`-prop i `ActivityLog`; *Visa spelfliken här*,
Partner-SSE och övriga verktyg finns kvar (rad 39, L23). `815b0b76` Bakgrundszoner på sidmallen
med kortad text, alla funktioner kvar (rad 43). `f95ed1ef` GPU-workflows på `ubuntu-24.04`.
`683dd4fd` ffmpeg i `presentation-studio` och `lipsync-worker` installeras från cachade `.deb`
(`actions/cache`, nyckel `ubuntu-24.04-ffmpeg-<version>`), nedladdning bara vid miss; jobben får
`actions: write` för att spara cache. `9dbfe09e` CI-steget Orphan tests
(`tools/check-orphan-tests.mjs`): 259 testfiler, 0 föräldralösa, 3 undantag med motivering i
`tools/orphan-tests-exceptions.json`; tre gröna tester in i `pre-commit-full`.

Testat: labbtester 941/943 (2 skippade sedan tidigare), typecheck, systemkartan grå, full
pre-commit-krok för varje commit (ffmpeg och jq lokalt). Produktion verifieras som `LLM`:
`/control/activity`, `/control/guide`, `/control`, `/control/zones` ljust och mörkt.

Kvar: `dealer-regression` installerar ffmpeg och jq utan cache (rad 46). `test/fuzz-blackjack.mjs`
är ett manuellt skript mot klientmodulen och räknar invariantbrott (rad 47). Johns rader 11, 12,
14, 17b. Klipplogiken: steg 2-förslaget väntar på Jakobs svar; lagerspåret (tre lager) finns som
lane `layer-preview` (T9) och provas i rehearsal; se `random/checklista-2026-10-08.md`.

## Sista operatörsadmin, 7 oktober 2026 natt

Ändrat (`186c6bc4`): operatörslagret (`web/storage/operator-store.mjs`) avvisar en ändring av
medlemskap (roll eller status) eller av en befintlig roll som skulle lämna bolaget utan aktiv
admin. Admin är en aktiv medlem vars roll har `team.roles.assign`
(`OPERATOR_ADMIN_PERMISSION` och `isOperatorAdmin` i `web/partner-access-policy.mjs`).
Avvisningen är 409 `studio_last_operator_admin`. Kontroll och skrivning sker i en transaktion
med låst bolagsrad; utan en pool med `connect()` avvisas sådana skrivningar med 503. Ingen
migration, ingen vy och ingen rutt. Sqlite-vägen i `web/server.mjs` är granskad utan ändringar:
produktion kör postgres, sqlite bär offline-labbet (beslutsmatrisens rad 36).

Testat: 82 tester för lagret, policyn och partnerdatan, labbtester, typecheck, systemkartan och
full regression lokalt utom `test/bugshot-report.mjs`. Kvar: ingen rutt eller vy skriver
medlemskap (L5, L11), en skrivande rutt måste skicka poolen (L24), ingen databasspärr och
inget samtidighetsprov mot riktig Postgres.

## Teststädning och dokumentation, 7 oktober 2026 natt

Teststädning: sex gröna testfiler utan körare och tre frontendtester (lobby/profil/historik,
landningssida, introenhet) körs nu av `.githooks/pre-commit-full`. Testberoende DOM är borta
(dold text "Nivå 1 · ScoutGamingGroup", konstanterna i `lab/lib/studio-navigation.mjs`); skyddet
för gamla menyadresser är en fast lista i testet. Pensionerade namn i tester är bytta;
`tools/backup-lissabon-state.mjs` heter `tools/backup-lab-state.mjs` med oförändrat backupformat.
GitLab-inboxens verktyg och test är borta; `identity` och låset ligger i
`tools/croupier-chef.mjs`. Död CSS för gamla Studions sidomeny och chattgenvägar är borttagen.

Dokumentation: `AGENTS.md`, `CLAUDE.md`, `README.md`, `lab/README.md`, labbguiden,
`lab/docs/guide.json`, driftdokumenten och `.cursor/rules` följer koden (avvikelserna D1–D32 i
`random/docs-avvikelser-2026-10-07.md`): partnerinloggning och spelarsidorna finns, dagens
`/control`-namn, start med `node lab/start.mjs`, repot `scoutgaming`. T2 och T4 är öppna.

Testat: labbtester, open-claw-tester, typecheck, build, systemkartan och full regression
lokalt utom `test/bugshot-report.mjs` (kräver `jq`). Kvar: `test/backoffice-lab-browser.mjs`
är opt-in och inte körd; tre gränssnittstexter ligger efter koden (lösa trådar L20–L22), och det
rullande observationsfönstret monteras inte längre på någon sida (L23).

## /control-ombyggnad, 7 oktober 2026 kväll

Underlag: `random/control-inventering-2026-10-07.md` (varje knapp och flik, C1–C265),
`random/losa-tradar-2026-10-07.md` (19 ofärdiga kopplingar, inte åtgärdade) och
beslutsmatrisens rader 21–30.

Ändrat: delat tillstånd för Studio-sidorna ligger i `useStudioSession`
(`lab/components/studio-session.tsx`) med vakt mot osparade ändringar. Händelser →
klipp, Uppspelning och Guide & hjälp är egna sidor på sidmallen; val av dealer och
event följer med i adressen (`?dealer=&event=`), loggen i `sessionStorage` (högst 150 poster).
Dealers & klipp har tre flikar; Probe, Bakgrund och Uppspelning är länkar. Nio döda
Kevin-adresser ger 404. Sökattrappen och dubbla sparpiller är borta. Rotens startfiler
är borttagna; start sker med `node lab/start.mjs`.

Andra omgången: Händelser, Klippbibliotek och Talgranskning är egna sidor.
OpenClaw har flikarna Agentmodeller och Chatt (`?tab=chat`); `/control/operator-chat`
omdirigerar dit. Händelser har dealerchips, eventsök och eventlista i sidan, villkors-
biblioteket även för Astrid, idle som länk till Dealers & klipp och en rad om att
Vera, Amira och Mei inte används av spelet ännu (lös tråd L19). Valet av variant följer
med i adressen till Klippbibliotek. Mottaget steg från Uppspelning öppnas i Händelser
via `sessionStorage`. `lab/components/studio.tsx` och `StudioPage` är borttagna;
data laddas med `lab/app/control-studio-data.tsx`.

Testat: 942 labbtester (940 gröna, 2 skippade webbläsartester), typecheck, build,
systemkartan (gul, 0 röda), full regression lokalt utom `test/bugshot-report.mjs`
som kräver `jq` (finns i CI). Omskrivna tester gäller avsiktligt borttagen UI och listas
i commit-texten. Kvar: situationen från en videomapp följer inte med till Händelser.

## CI, 7 oktober 2026 kväll

`dealer-regression` föll två gånger när Ubuntus paketservrar var långsamma:
nedladdningen av PostgreSQL passerade QA-skriptets gräns, och `apt-get install ffmpeg jq`
hängde i 30 minuter. Tredje försöket blev grönt. De tre jobben i
`.github/workflows/croupier.yml` kör nu på `ubuntu-24.04` i stället för `ubuntu-latest`
(som byts till Ubuntu 26 från 19 oktober). Installationen hoppas över om verktyget finns,
har en egen gräns på 8 minuter och tre försök. Den isolerade SQL-acceptansen använder
runnerns PostgreSQL 16 om den finns och laddar annars ner som förut.
`.github/workflows/astrid-gpu-build.yml` (rad 15) och `astrid-gpu-publish.yml` (rad 21)
kör fortfarande `ubuntu-latest` och ska låsas till `ubuntu-24.04` före 19 oktober.
`croupier.yml` är redan låst.

## Kopplingar som saknas

Ytan kan finnas, men kopplingen saknas. Listan följer `random/losa-tradar-2026-10-07.md`.

- **L1** Lane-villkor för idle och kortutdelning skrivs inte in i operatörspaketet, och en ny porträttlane får ingen egen klippuppsättning. `lab/components/studio-administration.tsx`, `web/public/game-lanes.mjs`.
- **L2** Ingen sida anropar `publishPackage`, och spelmotorn läser inte `operator_packages`. `web/storage/operator-store.mjs`.
- **L3** Bolagets filtfärg, marker och kort stannar i minnet och publiceras inte till spelet. `lab/components/kevin-bo`.
- **L4** Probe i Talgranskning är ett textprov utan ljud eller video. Menyn och administrationens talflik är olika saker. `lab/components/probe-editor.tsx`.
- **L5** Team-vyns inbjudan, rollbyte och suspend skriver inte till servern. `lab/components/kevin-bo/views/team.jsx`.
- **L6** Klienten kastar 501 på POST `speech-qa` innan något anrop. `lab/components/studio-administration.tsx`.
- **L7** `POST /api/history` och `/bo`-ompekningarna i `web/server.mjs` är inte deployade på Render.
- **L10** Spelare, transaktioner och rapporter hämtas inte från spelmotorn. `lab/lib/partner-data.mjs`.
- **L11** Ingen rutt anropar `createOperator`, `upsertRole` eller `upsertMembership`. `web/storage/operator-store.mjs`.
- **L12** Operatörsskrivningar får ingen rad i `audit_events`. `ops/neon-studio/001-studio-metadata.sql`.
- **L13** Lobbyn saknar operatörskontext och profilen kan inte redigeras. `apps/croupier-frontend/app/play`.
- **L14** Rollen `partner` kan inte bjudas in eller återställa lösenord. `web/account-role.mjs`.
- **L15** En intern admin-cookie öppnar inte riktiga bolag, och det finns inget bolagsval. `lab/lib/partner-session.mjs`.
- **L16** Bakgrundszoner styr inte spelets bakgrund. `lab/components/lab-studio.tsx`.
- **L19** Varianter för Vera, Amira och Mei sparas men spelets urval använder dem inte. `web/presentation-api.mjs`.
- **L23** Det rullande observationsfönstret monteras inte; Uppspelning stannar vid 300 meddelanden eller 4 MiB. `lab/components/activity-log.tsx`.
- **L24** En skrivande rutt för operatörer måste skicka poolen med `connect()`; partnerdatan skickar bara `{ query }`. `lab/lib/partner-data.mjs`.

## Design, 7 oktober 2026

Johns designpaket (`Croupier-Studio-design`) är infört på nivå 1: sidomeny i fem
grupper (`lab/lib/scout-navigation.mjs`), nivåväxlare, lime/ink-tokens i
`lab/app/scout-theme.css`, ljust och mörkt läge (`theme-toggle.tsx`, sparas i
`localStorage` som `sg-theme`), och en gemensam sidmall (`page-template.tsx`) på
Dealers & klipp, Agentmodeller och Administration. Inloggningssidorna renderas
utan meny. Bakgrundszoner och Händelser ligger under Studio. Administrationen har
ett menyval tills sidan får flikar. Medlemskap i partnerportalen renderas från
`kevin-bo/views/team.jsx`; verkligt läge är läsbart, utkast finns bara i
förhandsvisningen. Testat: 919 labbtester gröna lokalt (två ffprobe-tester
kräver ffmpeg och körs i CI), typecheck, build. Kvar: filterchips i klipplistan,
dold `<select>` bakom dealerchipsen, sektionsankare i administrationen,
"Spara alla" som riktig batch. Beslutsunderlag: `random/beslutsmatris-2026-10-07.md`.
Jakobs regel 7 okt: repots logik är facit, John styr design, Kevins nivå 2
anpassas till repot och inte tvärtom.

## Konton, 7 oktober 2026

Agentkontot `LLM` (roll `admin`, `croupier_auth.users` id 5) skapades på Jakobs
begäran med samma villkor som hans dg97-konto, så att agenten kan granska `/control`
inloggad. Lösenordet är Jakobs, inte i Git. Nivå 1-inbjudningar till Kevin
(`kevin.negash@scoutgaminggroup.com`) och Emil (`emilmattsson@yahoo.se`) skickades
via `POST /studio/api/admin/users/invite` med `emailSent: true`. GitHub-inbjudningar
med skrivrätt: `EmaCodeHero`, Kevins och Johns e-post; grenarna `kevin`, `emil`,
`john` finns, och `main` kräver PR för alla utom repo-admin. Teamets inbox är
GitHub Issues med etiketten `inbox` (`inbox/README.md`, `tools/inbox.mjs`); de
första beslutsärendena är #2 till John och #3 till Kevin.

## Namn, 7 oktober 2026

Denna dokumentpassning samlar personalens gränssnitt under `/control`:
`/control/clips`, `/control/administration`, `/control/tree`, `/control/videos`,
`/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`,
`/control/events`, `/control/probe` och `/control/operator-chat`.
Kevins importerade backoffice (`lab/components/kevin-bo`) ligger kvar på
`/partner` och `/partner/{operatorSlug}`. Det är inte kontrollpanelen.
`/studio` är labb-servicens basePath, inte en fjärde produkt och inte namnet i gränssnittet.
Spelarytan är `/play`, `/play/profil`, `/play/historik` och `/play/blackjack`.
`174f893` är pushad till `main`. Gamla `/bo`, `/bo/login.html` och `/bo/set-password.html` svarar 308 till `/control/administration`, `/control/login` och `/control/set-password`. `/api/bo` är kvar som inloggningsbrygga.
Inget öppet acceptanskrav nedan markeras klart av den här passningen.
Äldre meningar som kallar `/studio` för produktionsverktyget är 6-oktoberhistorik.

## Spelaryta, 7 oktober 2026

`/play` är Spellobby, `/play/profil` egen profil och `/play/historik` egen historik,
alla i `apps/croupier-frontend` ovanpå befintliga `GET /api/auth/session` och
`POST /api/player` via ingress-headers. Utan session går profil och historik till
`/player-login?returnTo=…`; lobbyn visar inloggningsknapp. Historiksidan anropar
`POST /api/history` för egna aggregerade resultat. `/api/v1/history` är
partner-API. Spelmotor och signerad direktstart är oförändrade.
Testat före resultatrutten: `apps/croupier-frontend/test/player-area.mjs` 6, `platform-ui` 13,
`game-entry` 12, `tsc --noEmit` grön. Tomt resultat betyder inga avslutade rundor, inte en saknad rutt.

## Spelaryta, 8 oktober 2026

`/play/profil` har ett formulär för visningsnamn (2–40 tecken, inga styrtecken) och språk (`sv`/`en`).
`PATCH /api/profile` skriver bara `display_name` och `locale` på den inloggade spelaren.
Saldo och valuta är text. Produktions-Neon saknar kolumnerna tills Jakob kör
`ops/neon-game/006-player-profile.sql` mot speldatabasen (`croupier_game`, inte zones).
Då visar profilsidan "Inte tillgängligt än". Lokal SQLite får kolumnerna vid start.
Lobbyn visar "Spelar hos" från `?operator=` eller `localStorage['croupier.operator']`
via `GET /api/operators/<slug>` (`{slug, name}`, aktiv, cache 60 s). Utan Studio-pool
gäller fixturen, bland annat `sg-test`. Länken Spela Blackjack bär `?operator=` till
`/play/blackjack`; L8:s `approvedGameQuery` behåller den.
Testat här: `player-area`, `player-profile`, `platform-ui`, `game-entry`, `player-profile-api`, `public-operators`, `game-entry-contract`, `tsc --noEmit`, `fuzz-blackjack` 3000 rundor.
Ingen commit i den här passningen.

## Partnerportal, 7 oktober 2026

Nivå 2-skalet kan visa intern fixtur (`preview: true`) och riktig operatörsdata
(`preview: false`). Parallella filer i samma pass:
`ops/neon-studio/005-operators.sql`, `web/storage/operator-store.mjs`,
`lab/lib/partner-session.mjs`, `lab/lib/partner-data.mjs`,
`lab/app/partner/login` och `lab/app/api/partner`.

Gräns: `partner_session` är en egen cookie med eget syfte. En intern admin-cookie
öppnar inte partnerdata, och partner-cookien öppnar inte `/control`. Medlemskap
ger bara den egna operatörens data; annan operatör eller avstängt medlemskap ger
403, okänd slug 404. Spelare, transaktioner och rapporter är tomma med `notConnected`.
`/partner` utan session går till `/partner/login`. Interna admins ser fortfarande
fixturförhandsvisningen med Partnerportal-rubrik och login-länk.

Testat: `npm --prefix lab test` 909 pass (två ffprobe-tester kräver ffmpeg lokalt),
`npm --prefix lab run typecheck`, `test/operator-store.mjs`, `test/partner-access-policy.mjs`,
`test/studio-migrations.mjs`, `test/speech-ledger-import.mjs` 40 pass,
`docs/system-map/verify.mjs --check` 0 fel. Ingen riktig Postgres-körning här;
`tools/studio-isolated-qa.mjs` hashar nu `005-operators.sql` och körs i CI.

Drift: runtime kräver exakt migration 001–005. Kör `005-operators.sql` mot
produktions-Neon före deploy, annars svarar Studio-admin `unavailable`.
Kvar: operatörs-onboarding-UI, åtkomstjournal för operatörsskrivningar
(`audit_events` tar bara dokument/media), spelardata, transaktioner, rapporter.
Inget krav i T2–T4 är markerat klart.

## Systemkarta, 7 oktober 2026

Kartan beskriver nivå 1 `/control`, nivå 2 `/partner` och nivå 3 `/play`.
En Next-rutt som läggs till eller flyttas utan `routes.json` ger route-drift och CI-fel.
Kontraktens filhasher är prefixade. Inget acceptanskrav markeras klart.

## Aktuell leverans och ansvar

- GitHub: Jakeminator123/scoutgaming, main, repo-ID 1380630440. Gamla
  github-work-adressen vidarebefordras. Återskapa inte namnet.
- Ett Vercelprojekt: scoutgaming, prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD.
  Services bygger web från apps/croupier-frontend och studio från lab, båda fra1.
  Node-middleware och rotens request.path-regler för /control och /partner krävs.
- Render äger spelmotor/live/sessionauktoritet. Vercel visar UI och kör native
  Studio/admin-API; Neon håller policy/metadata/journaler, privat Blob medier.
- www.scoutgaming.tech är huvudadress. scoutgaming.tech och det gamla
  croupier-frontend.vercel.app ger 308. croupier-lab-ui.vercel.app behålls som
  kompatibilitetsalias. Det gamla frontendprojektet är en domänlös reserv med
  autobyggen och domäntilldelning av; det är inte markerat paused. QA består.
- Infrastrukturens tidigare verifierade leverans: 4ed55a56, Vercel
  dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP READY, fullhook och CI37451320053 tre success.
  Läsande HTTP/static-prov och befintlig adminsession verifierade. Inga riktiga
  konto-/spel-/DB-skrivningar. Privat scoutgaming-delivery-final-read.json.

## Tre nivåer: denna ändring

Samordnat med chatten **Hämta Croupier från Kevins branch**, som släppt sina
filanspråk. /control är intern Kontrollpanel, /partner/{operatorSlug} är
Partnerportal och /play är Spelaryta med /play/blackjack. Fliken heter Administration.

Efter Jakobs förtydligande är nivå 1 en gemensam ScoutGamingGroup-adminyta:
/control visar verkliga verktygsingångar, inte Kevins parallella exempelpaneler.
Klipp/tal/media/konton-länkar leder till befintlig Studio med samma huvudmeny.
Oanslutna gamla exempelvyer visar en förklaring; de låtsas inte vara färdiga
produktionsverktyg. Kevin-komponenten renderas på /partner, inte /control.
Nivå 2 använder läsbara menyadresser och popstate. Gamla hashbokmärken fungerar.
Nivå 2:s lane-/designnotiser skiljer lokala marker/kort/bordsprov från faktisk
spelpublicering. Lokala designutkast kan fortfarande granskas i provbordet.
Operatörs-/administratörsbyte och authfel tömmer vyn; inga gamla utkast får
visas för en ny identitet. Klipp, masker, urvalsregler och publicering är interna.

/play/blackjack använder befintlig
sessionskontroll, sparad lane och spel-HTML. Äldre molnadresser går vidare;
giltig launch går genom samma signerade serverhantering och game-audience.
Spelmotor, media, sessionsformat och kunddatabas ändras inte.

Guide, ordlista och systembeskrivning förenar PDF-underlaget med aktuell kod.
Namn på ansvar är inte nya tjänster eller nya scheman. Privata random-förslag
ersätts med en pekare till aktiva dokument; originaltexter och PDF-kopior bevaras.
Den redundanta gamla agentbeställningen tas bort efter extern hashverifierad
backup i C:/Users/jakem/CroupierBackups/terminology-docs-20261006.

Lokalt verifierat: 43 riktade tester, båda typkontrollerna, båda produktionsbyggena
och full regression PASS. Isolerad webbläsare verifierar marker-notis, valt tema
i provbordet, bakåtknapp med bevarat utkast, operatörsbyte med bekräftelse,
omladdning med rätt lane, gamla hash-länkar och historik till annan operatör.
Den korta /administration går vidare till /studio/administration efter observerad
404 på den förstnämnda. Privat provkatalog: lab/data/platform-private/terminology-update.
Testservern och provfliken är stängda. Leverans a72c4bf1 är verifierad på
Vercel dpl_CMCcHtRDDDHxByk3VMRZw8ewtx2k, READY på exakt SHA, och
CI37462222613 har tre successjobb. Samordnaren verifierade 14 läsande
HTTP-prov, åtta JS/CSS-resurser och befintlig jakob-session: /control till
verklig Administration och klippverktyg, gamla #gen till förklaring samt
separat partnerförhandsvisning. Utloggade dokument går till login och
admin-/partner-API ger 401. Inga riktiga konto-/spel-/policy-/provider-skrivningar.
Privata kvitton: terminology-update/live-delivery.json och production-read.json.
Kompletteringen för en gemensam nivå 1 har dessutom 29 riktade tester,
ny Lab-typkontroll och nytt Lab-produktionsbygge PASS. Den behåller samma
färska adminauktorisering, lämnar partnerns data och utkast oförändrade och
skickar inga exempeloperatörsdata till den nya interna ingången.

## Nästa arbete och viktiga gränser

**Övertagande och stoppunkt, 6 oktober:** denna chatt tar över efter
**Hämta Croupier från Kevins branch**. Jakob skickar själv de två
personalinbjudningarna. Inga nya utskick/konton görs av agenten. Intern admin
når nivå 1, 2 och 3 med samma konto; nivå 2 var redan adminauktoriserad men
saknades i inbjudningstexten. Formulär, mejl och båda guiderna är nu samstämmiga.
`/partner` är en separat ingång med explicit val av demonstration, inte ett
automatiskt exempelbolag. Adminens val bland riktiga operatörer är
ännu inte aktiverat. Operatörens egen inloggning står i Partnerportal.
Riktiga kunder ska komma från verifierade organisationsanslutningar, inte namn
eller API-nycklar.
Gamla giltiga hashbokmärken och befintliga demo-adresser behålls.

Den avgränsade leveransen avslutar navigation/åtkomstinformation och
dokumentationsstädning. De öppna A–I-punkterna
är acceptans/driftarbete, inte ett påstående om att allt är produktionsklart.
Lokalt verifierat: 90 riktade UI-, serverrutt-, auth- och mejltester, Lab-
typkontroll och produktionsbygge PASS. Kod 4df5e74a och etikettkomplettering
ec060e73 är pushade; fullhook gav 1626 PASS/9 skip/0 fail vid båda kodcommits.
Vercel dpl_7vDDEzyvkN9ZLjqnyEhoKZHtF2Ny är READY på exakt ec060e73 med
produktionsalias, och CI37496945897 har tre successjobb. Sex läsande HTTP-prov
på första leveransen bekräftar login/401 utan inloggning. Befintlig adminsession
verifierade Kontrollpanel → nivå 2-ingång → Demo South → intern Administration.
Efter senaste publiceringen är även behörighetsvalets etikett verifierad live:
Administratör – nivå 1, 2 och 3. Det befintliga UI-provet bevakar denna etikett.
Privata loggar ligger under `lab/data/platform-private/level-two-takeover-*`.
Inga produktservrar har startats och agenten har inte skrivit konton, policy
eller riktig databas. Inga extra grenar, worktrees eller nya rapportfiler behövs.

Resend återlästes separat den 6 oktober: Johns verkliga inbjudan har **Bounced**
med **Recipient not found**, och mottagaradressen har lagts på suppression-listan.
Kontot väntar på aktivering. Rätt mottagaradress behöver bekräftas innan nytt
utskick; spärren har inte tagits bort. Ett mejl till Jakobs dg97-adress visas som
**Delivered** och det kontot som aktiverat. Det bevisar inte leverans till den
tidigare begärda Gmail-adressen, inte heller mottagarens faktiska inkorg eller
resetflöde. Exakta adresser och provider-ID finns endast i det privata kvittot
`level-two-takeover-delivery.json`. Jakob äger fortsatt utskicken och F:s
mottagaracceptans; denna agent har inte skickat något mejl.

**Personalinbjudningar, första leveransen 6 oktober:** samordnad fortsättning
efter a72c4bf1; åtkomsttexten har därefter kompletterats enligt övertagandet ovan.
Resend-adaptern skickar nu ScoutGamingGroup-mejl i text och HTML med
aktiveringsknapp, e-postadress och giltighetstid. Formuläret anger intern
adminpersonal, nivå 1, med åtkomst till hela nivå 1 och nivå 3 via samma konto
och lösenord. Befintlig serverauktorisering, kontokollisionskontroll,
transaktion och engångstoken används; spelarroller får ingen admintext eller
ny behörighet. Ingen lösenordsändring görs för mottagarna. Riktade mail-,
auth- och UI-tester samt Lab-typkontroll PASS. Kodleverans 6f32a58b är pushad;
full regression gav 1623 PASS, 9 skip och 0 fail. Vercel
dpl_B4kWYUVrsVa5aNmKGxiieQzoUu3s är READY på exakt kod-SHA med
www.scoutgaming.tech som produktionsalias. Befintlig adminsession har läst
den publicerade kontofliken/formuläret: tydlig nivå 1+3, endast adminval och
72-timmars aktivering. Inga konton eller tokens har skapats vid detta prov.
CI37462924847 är komplett med success i alla tre jobb.
De begärda verkliga utskicken
och mottagarnas aktivering/inkorg behöver eget leveransbevis enligt punkt F;
lokala testkonton bevisar inte mottagarnas aktivering.

Den enda arbetslistan är [CLOUD-MIGRATION](CLOUD-MIGRATION.md): T2–T4 för
verklig partneranslutning/lobby, A–I för övrig användar- och driftacceptans.
Pågående uppdrag är inte ett generellt mandat till nya migreringar eller betalda prov.

Resend är konfigurerat i produktion med domänbegränsad sändnyckel och
no-reply@scoutgaming.tech. Native invite/reset är Delivered till Resends
sandbox på 184fe66b; riktigt konto/token/aktivering/reset/inkorg återstår (F).
Den tomma extra Marketplace-installationen är borttagen, fungerande konto och
QA bevarade. Privat resend-setup-20261006.json. Äldre uppgift om tom nyckel är ersatt.

Regionprovet på samma 019dba6d flyttade Studio iad1→fra1: första
Studio→Administration 7,879→3,041 s, varm overview 1,595→0,328 s utan Neonuppgradering.
Färsk auth och anropsminskning består; första-/proxyväntan är inte fullförklarad (B).
Ingen generell latensgaranti. Båda Services använder nu fra1.

GG: senast läst workspace795524/source30689542, 12 TRIGGERED/5 IGNORED,
en incidentsida och 17 locationsidor; fil/rad partiell, sex öppna positionsluckor.
GitHub checks läses på fryst leverans-SHA; queued suite/inga runs bevisar
ingen incidentfrihet. Läs bara säker metadata via befintlig read-only-brygga,
inga secrets/annotationsmeddelanden, inga automatiska ignore/resolve.
Triagestatus och nästa krav finns i G; historiska fixtureklassningar är inte
nya bevis för incidenter utan positioner.

### Läsutredda drift- och backuprester — fortfarande öppna

Frame-varningen i `web/public/local-film-player.mjs:17` använder samma text
för saknad playing/presented/ended. Historiska goodluckprov är inte belägg
för ursprungligt idlefel. Behåll rVFC-spärren; nästa diagnos kräver terminal-
flaggor, readyState/currentTime/duration/visibility och exakt media-ID/SHA.
Zoner är editorlagring (lokala utkast+molnkoordinater+privataBlobklipp), inte
spelstyrning. Befintlig CAS/dimension/hash/Range/partialuploadkontroll saknar
full isolerad zonroundtrip/restartacceptans. Tidigare 88medieURLprov inkluderar
inte reference-poster. Startsideskoden byter SSRhero till annan layout och
asynkront intro; möjlig flimmermekanism kräver bildserie/layoutshift/laddnings-
tider inklusive mobile/reduced-motion före riktad fix.

Backupagenten återläste de uttryckligt angivna metadatafilerna utan bred
backup-/personarkivsökning. Extern produktbackupkvitto matchar dokumenterad
SHA256, 206filer/10mappar/125745905bytes och verifierade hash-/arkiv-/inventory-
flaggor. Gamebackupmanifest finns; tidigare32Postgrestabellers återläsning är
dokumentation, ingen ny DBkontroll. Privat OpenClawenhetsfil finns men är inte
fullbackup. Director `/data/catalog` och Gateway `/data/openclaw` saknar angivet
externt fullsnapshot/återläsningskvitto. Exportåtkomst har inte prövats. Kräv
faktiskt frysta/stoppade skrivare, fullsnapshot, externmanifest/hash och
SQLite integrity/FK/WAL enligt `ENVIRONMENT-RESTORATION.md:74`; maintenanceMode
eller quiesced-markör ensam bevisar inte writerdrain. Inga drift-/DB-/provider-
åtgärder, restore eller nya servertester gjordes i dessa läsutredningar.


## Acceptans som består

Isolerad SQL/HTTPS-fixtur är rättad och verkligt provad i CI; gamla FAIL sparas.
Game-persistence/concurrency är separat och saknar sitt isolerade prov.
Full P6, mänsklig läppsynk/kortkontakt, fysisk mic/kamera/mobil/Safari,
zonroundtrip, startsidesflimmer och externa Director/Gatewaybackups återstår.
Upload-problemet med kortflipp_kling_1080p.mp4 är öppet under H; ingen ny
produktmedia har aktiverats här. Se systembeskrivningen för aktuell arkitektur.

## Lanes och faktisk medierensning

Mobile Phone Lane är sparat förval. Versionerade lane-definitioner har ID/namn/
renderer/dealer/mediesamling i `gameLanes`/`gameLane`. Saknat/äldre `original`
migreras vid läsning till Mobile; HTML binds till serverns val och gamla queryparametrar
kan inte återaktivera Kevin. `web/public/card-presentation` ersätter `kevin-cards`;
kortgrund, källproveniens och kalibrering består.

Admin create/remove är revisionsstyrda. Aktiv lane kräver ersättare eller `null`
för sista lane; då stoppas ny Blackjack-start tills lane läggs till. Nya porträttlanes
delar Astrids bank/policy. Ny renderer/mediebank behöver adapter/verifierad media;
fria URL:er nekas. Lane-borttagning raderar inte delade medier.
Separat lane-publicering, nya dealers/spel och granskad svarskatalog är inte därmed byggda.

| Utförd åtgärd | Exakt omfattning / slutbevis |
| --- | --- |
| Lokal source/staging-rensning | 2 410 binära filer, 2 133 120 568 byte; faktiska hashar/säkra paths kontrollerade |
| Motsvarande Blob-rensning | 2 313 objekt, 2 131 771 483 byte efter `8f265831` LIVE/READY; komplett paginerad efterlista |
| Lokal deduplicering | 64 byteidentiska kopior, 14 216 404 byte; kvar 2 450 fysiska filer/764 115 959 byte |
| Blob-deduplicering | 58 objekt, 12 787 392 byte efter produkt `ebbbeb76`/QA `ee060804` och exakt medieläsarekvivalens |
| Slutlista Blob | 1 800 objekt/769 901 848 byte; just målen saknas, alla andra gamla paths/storlekar oförändrade |
| Bevarade publika adresser | 88 GET200/fullhash/storlek PASS: 44 produktion + 44 QA; dessutom 62 huvudobjekt HEAD/full SHA PASS |

Alla 2 514 logiska poster/ID/hashar/URL/åtkomstgränser består. Layout v1:s
`canonicalPath` pekar direkt på registrerad huvudkopia med samma hash/storlek/ändelse.
Mobile-media, zonreferens, kortbild, runtime/kod/kalibrering, uploadfiler, GPU-resultat,
speechreferenser, journaler och övriga objekt består. Produktion/QA delar Blob;
deras Studio-dokument/historik/mediarecords/speechreferenser och produktzoner
lästes före radering. Ingen ny visuell approval och ingen omskriven Git-historik.

Privata underlag i `lab/data/lane-media-audit/`:
`blob-purge-receipt.json`, `blob-after-purge.json`, `kept-readback.json`,
`dedup-cloud-purge-receipt.json`, `dedup-blob-after.json`,
`dedup-http-verification.json`, plan och lokalkvitto.
35 dedup-prov, hela fysiska bankens hashar och fyra dealer-sync `--probe` PASS.
Lane/CRUD/kort/policy/startprov och TypeScript PASS; äldre fullhook 1 418 PASS/9 skip.
Kontrollens privata cachekopior är hashkontrollerat borttagna; receipts består.

## Produktionsimport, avveckling och återställning

P7 är utförd på b0bc efter fryst export, oberoende admission och faktisk ALL0-drain.
Underhåll `dep-db16rv0u01pc73d442p0` var LIVE/childless: inga barn/skrivare/providers.
RunPod var tillfälligt Max 0/Active 0/FlashBoot OFF och alla sex workerfält/båda jobbfält 0.
Efter import återställdes Max 1/Active 0/FlashBoot ON före provideraktivering.
Gemensam Neon-policy är aktiv; produktens tre tal-/streamflaggor ON, kamera ON.
QA är kvar OFF. Aktiveringen är inte en generell kostnads-/mänsklig acceptans.

Studio 001–004, tre dokument, talhistorik, 18 aktiva och sex retained-mediaposter
är importerade. Sex original (8 262 169 byte) återfanns i `365f283b` och
fullhashades privat; liknande filnamn/familj får aldrig automappas till nya bytes.
Production/version1 fullfilspolicy adopterades via ett additivt INSERT;
numeriska tak/historik/reservationer ändrades inte.
Paritet PASS: 32 skyddade konto-/speltabeller, elva kostnadstabeller och exakta
dokument/media. Alla 17 alias återlästes med historiska mål/domäninställningar/SSO bevarade.
Den avslutade importen körs inte om; nya läskvitton får inte skriva om originaltider.

P8:s slutkod `9ba2fd05`/CI `37222438373` tre success verifierade diskfri drift.
Produktdisk DELETE204/GET404/`service.disk` saknas; tolv äldre Blobalias borta,
gamla-lista0/ersättningar12 och noll gamla Neon-dokument-/historikreferenser.
Explicit restart200: faktisk ny process, 160 rätta källhashar, åtta avvecklade
runtimefiler, AI3/Neon ON/health200 och ingen `/var/data`/persistent produktmount.
TLS `verify-full` bevarades; 51 övriga produkt-envvärden kontrollerades oförändrade.
Parent-env var direkt oläsbar efter UID-byte (EACCES); barnprocess/källa och
stabila deploy-/envavläsningar ger bindningen, inte en påstådd direkt parentläsning.

Privat `C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`:
206 filer/10 mappar/125 745 905 källbyte; full inventering, oförändrad källmetadata,
arkivläsbarhet och remote/lokal/arkivhash PASS. Behåll backupen efter avveckling.
Befintliga privata P8-journal/kvitton: diskfri `6cf5030f…`, data/HTTP `4615366b…`,
postdelete `bf582b0b…`; fulla pinnar finns i snapshotens importförlopp.

| Verifierat privat kvitto | SHA256 |
| --- | --- |
| P7 admission | `77eccc3a1ca99bca328f2abec8e11d4d37ec62b3797a2a7b25aea1c616b751c1` |
| Cloudplan | `25fe34d42251b1f57de6ff0ae7505459c0448c6d0ba500646aa7281a9115c59d` |
| BEFORE | `0555b7988d5f686d4b918a966bd82d1865a9a83d22c805a076e6f46df648ccb2` |
| Importplan | `94a458599f0c77ca8aaf468feccf4cc7d5e1e050f2f31662be8740796cde7442` |
| Avslutad import | `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d` |
| Full diskbackup | `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9` |

Återställning är en samordnad återgång, aldrig en andra writer eller automatisk fallback.
Frys alla skrivare, bevara senaste Neon/ledger separat och verifiera rätt scope,
schema/checksummor, aktuell paritet, media och rollbackpunkt före operation.
Gamla SQLite-/diskbytes får inte aktiveras efter nya Neon-skrivningar utan datatillbakaföring.
Gamebackup: `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`
(24 källtabeller/102 rader; 32 Postgrestabeller med rad-/sekvensparitet).
Labbbackup: `C:/Users/jakem/CroupierBackups/lab-consolidation-20261002`;
lokal syskonstädning: `C:/Users/jakem/CroupierBackups/local-project-cleanup-20261004T210828Z`
(214 bevarade filer, två verifierade Gitbundlar, workercommits kvar).
Återställningsprocedurer: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
QA-, Director-/Gatewaydiskar är aktiva/bevarade, inte P8-mål; extern Director/
Gatewaybackup är fortfarande separat kvarvarande ansvar.

## P6: delbevis, numeriska skydd och kvarvarande acceptans

### Verifierade delbevis — inte full P6

Historiskt native90/90 på `190399386d93a02882d9b18a5ce5af53bb91fe23`:
alla fyra dealers, två avkodade/hörbara/avslutade plays, samma sparade Neonrevision,
CAS/utkast/privata medier/native administration utan iframe. Projekt/pit återställda
med identiska hashar; browser/route-drain städade; inga mejl/betalda anrop.
Privat `lab/data/platform-private/native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
SHA `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
Åtta layoutbildrutor godkänner inte läppsynk. Äldre FAIL-kvitton består.

På `e461ef073b63b2d1c937454bbfa31289774fcb8f`: 80/80 authkontroller över
68 HTTPS-anrop, 22/22 verkliga login-/städ-/källkontroller och 27 städgrupper PASS.
Admin når spel/Studio/BO, spelare nekas Studio, reader/staff-reset behåller game-only,
lösenord/epoch återkallar gamla sessioner, saldo/historik/paritet består.
Pending provider-cancellation är inte liveprovat av detta authprov.
Privat `p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/` och
`p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`
under `lab/data/platform-private/`; egna fixtures borttagna.
Greeting-rehearsal på e461 har matching clip/återaktiverade tvåspelskontroller,
men saknar explicit ended-räknare/nya hashbevis/ny mänsklig approval:
`p6-browser-evidence-e461ef07/receipt.json`.

Faktisk isolerad SQL/HTTPS/restart: 41 grupper, fyra retained-guards och 46
oförändrade källhashar PASS. Täcker CAS/rollback/token/epoch/roller, signerad
actor/scope, walletnonce utan dubbelkreditering, journalimport och kostnads-/QA-rollback,
review exakt talpar/revision/roll, privat media, lokal mailpreview och kortsekretess.
Fixturer/processer städade, inga riktiga konton/molndatabaser/mejl/betalda jobb.

Fullfil `generated-bd1123e6caec51e8a232036547b0f8fc` fick Director/SDK-svar,
Cartesia-ljud och färdigt RunPod-paket. Två game-queue/audio-ended härledda plays;
per-play synliga frame-/ownerobservationer hann inte sparas och är okända.
Privat `verify-final-qa/fullfile-two-play-derived-attestation-8712e00b.json`.
cc77-run `75eaf797-9342-4e2c-8995-f3c759fade75`: 6 562 941 streambyte,
synlig bild, hörbart ljud, faktisk spelkö-END/completed SQL-request och browsercleanup.
Efter END avlästes provider HTTP200 CANCELLED, terminal/released/lease0/uncertain0/OFF.
Det är avslutad speluppspelning enligt Jakobs krav, inte ett naturligt provider-
COMPLETED-kvitto. Exakt tid för providertransition saknas; b0bc:s naturliga COMPLETED
är bara lokalt testat. Sammansatt snäv P7-admission återanvänder dessa delbevis och
oförändrade godkända e461-playbackbytes; full P6 och nya take-approvals förblir öppna.

QA:s äldre närvarogap består: `player_probe_sessions` 17→15 på a0 och 19→18
vid 42→37-övergången. Övriga 31 kontotabeller matchar; 24h TTL är möjlig orsak,
men tidigare radmetadata saknas. Original FALSE/compose=false skrivs inte om.
Senare aktuella 10/10-bevarandekvitton gör inte dessa äldre jämförelser full-PASS.

### Budget och framtida prov

Exakta Cartesia-/counting-priser är backlog enligt Jakob. Avgränsade funktionstester
kan använda dokumenterat okänd USD/null och mätt usage inom ursprunglig numerisk
budget/reservation/dispatchauktoritet. Detta är inget nollpris, verifierad faktura,
extra testfönster eller generell produktionskostnadsapproval.
Upprepa ingen prisinventering utan nytt konto-/tariffunderlag; extern Cartesia-
nyckelägare saknar tillgänglig egen kontoinloggning. Privat `p6-cost-evidence-20261004.json`.

Originalkampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`, totaltak 10 USD inklusive
alla försök, budgetankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historiskt reservation 5,251152/oreserverat 4,748848 USD; inget refund/reset.
Jakob höjde testtaket från två till sex genereringar totalt, inte per omstart.
Senaste closed39: usage 4 generationer/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null,
head `8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Två av sex generationer var kvar; detta är inte ny färsk dispatchauktoritet.
Den gamla reservationspolicyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Återläs faktisk journal före nytt prov; förbrukat/pending/uncertain är aldrig ”nytt”.

Fullfilsadmission kräver explicit belopp/policy före TTS/GPU; stream/fullfil delar
UTC-dygnssumma. Originalets 12 min/krav 8 min kvar, klientdeadline 300 s och separat
RunPod-TTL 180 s får inte förlängas tyst. Utgångna fönster återöppnas inte.
Successor är append-only med föregående journalhash; inga automatiska retries,
budgetrefunds eller nytt providerjobb vid reconnect. Gamla FAIL/manifest/tider bevaras.
SDK-import/prepare-only/router404/WS-binary/deterministisk baseline är inte acceptans.

Nytt liveprov kräver aktuell källa/Gitblobs, immutable basimage, färska worker/router/
entry-manifest, faktisk SDK 7.12.1/readback och separata Render/Web-child/SDK-envbindningar.
Exakt serverägd session/runda/sparad Neonpolicy, request/job/mediahashar och ägargates
måste avse samma körning. Tre cookieägda kontroller före connect/play/efter END;
en produktspelare/WS/video genom posegrind/talkö, presenterade frames/hörbart ljud
och två verkliga playback-ACK. `decoded-product-game-queue`, faktisk integration/
laddad källa och cleanup/cancel/terminal/drain krävs; inga ersättningswrappers.
Full P6 omfattar också text/bild/STT, fullfil/stream, SQL/HTTPS/restart, auth/revoke
och verklig invitation/reset där de återstår. `fullP6Passed` får inte sättas true tidigt.


## Funktionella regler som aldrig får komprimeras bort

Render äger kort/shoe/slump/wallet/rundor/resultat, sessionägarskap och cancellation.
Studio/Vercel sparar revisionsstyrd Neonpolicy, inte osparade utkast eller saldo.
En kandidat vid credentialresolver; collision/pending/fel lösenord ger generiskt
avslag utan fallback/klientroll. Admin får spel+Studio; superadmin är alias,
reader/staff är game-only. Playerlogin rensar gamla BO/Labcookies.
BO-audience/live roll/fingerprint/epoch och Origin/Host/JSON/CAS/audit består.
CRAIG-reset och native playerpasswordbyte behåller rätt identitet/saldo/historik;
Rendercancel kvitteras före OK. Självrollbyte/radering och sista-admin-race skyddas.
Engångstokens förbrukas atomiskt; hemliga partnerresultat är tillfälliga, inte listmetadata.

Alla fyra dealers delar spelaren. Tal är exakt text/audio/video/frame-index/
kalibrering/acceptans; ändrad audio-/videohash ogiltigförklarar visuell approval.
Ingen approximate-duration-match, gammal talvideo till ny text eller munoverlay.
Audit `pipeline/audit-dealer-sync.mjs --probe`, obligatoriska regressioner och
två rehearsalplays per dealer krävs för media/spelarändring, inte bara hashar.
Gamla BO-videopreviews är tysta historikklipp, inte lipsyncmaterial.
Observation följer faktisk spelflik utan andra playback; valt/laddat ≠ spelat.
Originalpolicy `legacyClipPolicy` och Astrid `mediaPolicy/idlePolicy` består;
gammal BO-tilldelning är read-only410 och import kräver explicit exakt match.
Privata chattar, secrets och signerade medielänkar hör inte hemma i publika logs/takes.
Neon/Blob-fel stänger med fel, aldrig diskfallback/fröprojekt/nollbudget.
Aktiva tools/test/fixtures/pipeline/web/media/kalibreringar/OpenClaw-state består.
Svarskatalog/automatiska spelararkiv är inte infört; kostnadsjournaler gallras inte.

GPU-shutdownrättningen börjar cleanup före gatewayväntan och signalerar båda barnen.
15 s naturligt provideravslut +15 s cancel +30 s journalmarginal, sedan högst 5 s HTTP
och 10 s lagring; barnets tvångsgräns 80 s/Render 90 s. Timeout lämnar återhämtningsbar
journal/reservation och felstatus, inte för tidigt släppt shared lease.
Isolerad Linuxkedja 4/4 och close 38/38 PASS, inklusive lease 0 före båda flushar/1 efter.
Zonbilden är registrerad privat PNG 1080×1920/1 628 428 byte,
SHA `eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`;
fel molnkälla ger 503 utan lokal fallback. Export 290×104 var pixelidentisk med befintlig zon.
OpenClawproxy tillåter endast avsedd toppnavigation till exakt /openclaw[/];
API/fetch/iframe/mutation/WS/Origin/Host/auth/pairing behåller separata kontroller.
Dessa prov ändrade ingen zonrevision, pairing, speldata eller betaldispatch.

## Historik (daterade lägesbilder)

Flyttade meningar som motsade nuläget 7 oktober 2026. De är inte raderade.
Kvitton, acceptans, P6, medieregler och privata sökvägar står kvar ovan.

### 7 oktober 2026 — Spelaryta-avsnittet, före resultatrutten i arbetskopian

Ersatt samma dag när historiksidan kopplades till `POST /api/history`. T4 är inte klar.

Historiken är ärligt tom: `readPlayerResults` saknar publik spelarrutt och `/api/v1/history` är partner-API. Ingen ändring i `web/`, spelmotor eller signerad direktstart. Kvar: resultatrutt för spelaren.

### 7 oktober 2026 — Namn-avsnittet, före Spelaryta och Partnerportal samma dag

Ersatt 7 oktober av Spelaryta- och Partnerportal-avsnitten.

Lobby, profil, historik, riktig operatörsinloggning och tenantdata är inte klara.

### 6 oktober 2026 — Tre nivåer: denna ändring

Ersatt 7 oktober av Namn-avsnittet (`/studio` är basePath, inte produktionsverktygets namn). Fliken heter fortfarande Administration.

Intern Studio på /studio är kvar som verkligt produktionsverktyg; fliken heter Administration.

Ersatt 7 oktober av Partnerportal-avsnittet (`partner_session` är en egen cookie; intern admin-cookie öppnar inte partnerdata).

Servern kontrollerar fortsatt intern admin på varje dokument/API-läsning.

Ersatt 7 oktober av Spelaryta-avsnittet (`/play` är Spellobby, med profil och historik).

/play är en enkel Blackjack-ingång.

Ersatt 7 oktober av Partnerportal- och Spelaryta-avsnitten.

Full partner-session/medlemskap/organisationslagring, publicerat operatörspaket,
kundavgränsad sparning samt spelarprofil/historik är fortfarande öppna T2–T4.
Den separata policyn web/partner-access-policy.mjs från cb2673c6 är fortsatt
bara policy; ingen runtime/DB använder den som verklig partnerinloggning.

### 6 oktober 2026 — Övertagande och stoppunkt

Ersatt 7 oktober av Partnerportal-avsnittet (medlemslagring och `partner_session` finns; lane-publicering och operatörsbunden lobby är kvar i T2–T4).

T2–T4 kvarstår för verkligt kundregister, kundpersonal, medlemskap, lane-publicering och operatörsbunden lobby.

Ersatt 7 oktober av en snävare mening i Övertagande: adminens val bland riktiga operatörer är kvar; operatörens inloggning står i Partnerportal.

Kundval är ännu inte aktiverat.
