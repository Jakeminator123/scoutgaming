# S06 · åtta dagar medan Jakob reser

Dag 1 är nästa gemensamma arbetsdag. Planen utgår från det som redan är byggt
lokalt den 21 september. Kevin äger produktintegration; Emil tar mediaarbetet
tillsammans med Kevin. Jakob lämnar detta underlag och ska inte behöva vara
online för rutinval. Datumen sätts efter faktisk bemanning.

## Dag 1 · starta från rätt läge

**Kevin:** läs V5, hämta arbetsgrenens commit och välj en isolerad produktväg
för första talintegrationen. Kartlägg nuvarande talproducenter och ange vilka
som ska stängas av när OpenClaw tar över. Bekräfta lokalt kontra deployat SHA.
**Emil:** inventera befintligt Astrid-material med Kevin och välj ett exakt
inspelat talpaket samt ett litet alternativ att börja med. Ändra inga godkända
originalbytes i inventeringen.

**Klart när:** kända filer, ansvar, testmiljö och saknade underlag är noterade.
Ingen väntar på Jakob för att välja första testfall. Identitets- eller
produktbeslut som kräver Jakob läggs i en samlad blockerarlista.

## Dag 2 · kontrakt och första variant

**Kevin:** definiera minsta validerade talbeslut och köjobb ovanpå befintlig
Director/Gateway: exakt inspelad replik, ny text eller tystnad. Behåll
serverägda spelfakta och separera källa, beslut och playback.
**Emil:** lägg in första granskbara MP4/WebM i labbet enligt videokapitlet,
koppla alternativ och trigger, spara projekt och prova match/icke-match.

**Klart när:** Kevin kan följa ett beslut utan att gammal talägare också kör,
och Emil lämnar video-ID/hash, variant, replik/situation samt provkvitto.
En oacceptabel film dokumenteras som lucka; den blockerar inte kontraktsarbetet.

## Dag 3 · en talägare i isolerad runtime

**Kevin:** led ett spelrelaterat yttrande och ett chattsvar genom samma kö.
Testa samtidig trigger/chatt, avbrott, fel och två plays. Stäng av de gamla
producenterna för just den aktiverade vägen; skriv ned vad som ännu är separat.
**Emil:** leverera exakt text/ljud/video/index/kalibrering för första paketet
och granska munnens rörelse genom hela repliken med Kevin.

**Klart när:** ett paket startar och avslutas med verkliga kvitton, utan dubbelt
tal. Saknad dynamisk läppsynk använder uttrycklig reserv eller tystnad.

## Dag 4 · samma instruktion, ett jobb

**Kevin:** verifiera HTTP+SSE, native-publicering efter commit, duplicate retry,
stale version och återanslutning med lucka. Välj hur flera flikar ska ägas;
lita inte på processcachen som en distribuerad lösning.
**Emil:** utöka bara med en eller två varianter där första paketet klarat review.
Ge dem exakta repliker/mål, urvalstillåtelser och avgränsade triggers.

**Klart när:** dubbel leverans ger ett köjobb, konflikt stoppar, och källan kan
följas till exakt material. Utöka inte mängden för att dölja kvalitetsproblem.

## Dag 5 · läppsynk och kortkontakt

**Kevin och Emil:** mät den befintliga läppsynkvägens kvalitet, latens och
avbrott med Jakobs OpenClaw-text som källa. Fri text får bara använda faktiskt
matchat material. Besluta om en begränsad dynamisk prototyp ryms; annars
leverera inspelat paket och tydlig neutral reserv.

**Klart när:** per-take-resultat finns för läppar, ljud, identitet och
övergångar. Prova en stödd kortdestination separat; full split-/platstäckning
lovas inte på grund av ett enda lyckat mål.

## Dag 6 · regression och återhämtning

**Kevin:** prova saknat/korrupt media, fel replik/dealer/hash, sen modellrespons,
mute, navigation, dealerbyte och BO-previewbyte. Kör relevanta automatiska
kontroller och repots obligatoriska auditer vid media-/spelarändring.
**Emil:** åtgärda de prioriterade visuella felen i separat staging; dokumentera
nya hashvärden och vilka tidigare godkännanden som måste göras om.

**Klart när:** fel har exakt ett terminalt kvitto, ingen kvarhängande media och
ingen förändring av spelets utfall. Oförändrade godkända assets lämnas orörda.

## Dag 7 · sammanhängande QA

**Kevin och Emil:** spela den avgränsade scenen från instruktion till avslut.
Granska alla fyra dealers i faktisk rehearsal, inklusive två plays i följd.
Om behörig live-/testmiljö och rätt serverrevision finns: samla riktiga
rundposter och spelartelemetri. Annars redovisa det som återstående live-QA.

**Klart när:** förväntat resultat prövats, misslyckade cases återgår till arbete
och inga stubbar/fixture-resultat presenteras som verkligt livebevis.

## Dag 8 · integration eller tydligt avgränsad handoff

**Kevin:** lämna liten granskbar MR/diff, exakt aktiverade ägare, testresultat,
återställningsväg och beslut om produktintegration/deploy.
**Emil:** lämna takepaket, hashbunden review och öppna kvalitetsluckor.
**Tillsammans:** uppdatera handoff, V5-källa, wiki och webbsida. Ge Jakob en
kort rapport som går att läsa från resan utan hela chattloggen.

**Klart när:** det går att förstå och upprepa leveransen utan privata mappar.
En merge eller deploy är ett eget integrationsbeslut, inte följden av en sparad
labbvariant. Faktisk publicerad dokumentation kontrolleras efter push.

## Prioritering och arbetsstatus

Skydda först serverfakta och ett enda talägarskap. Leverera sedan ett fungerande
exakt läppsynkpaket och ett triggerbundet alternativ. Skjut på större
takepooler, alla platser/splitar och bred dynamisk dialog om tiden inte räcker.

Kevin och Emil dokumenterar kort varje arbetsdag: klart med commit/kvitto,
nästa leverans och konkreta hinder. Samla frågor till Jakob; frånvaro ger
ingen automatisk visuell acceptans av Astrids identitet.

Jira CAC är faktisk arbetsstatus: läs Expected Result/custom fields, använd
tillgängliga övergångar till In Dev, Ready for QA och In Testing. Done först
efter fullt verifierat resultat; misslyckad QA tillbaka till In Dev. V5 anger
uppdrag och mål, inte att personerna redan accepterat dem eller att ticketstatus
har uppdaterats av denna dokumentationsleverans.
