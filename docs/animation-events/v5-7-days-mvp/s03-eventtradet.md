# S03 · Kevin och Emil: lägg in video och koppla triggers

Produktens aktuella dealerbank byggs i en separat stagingkatalog och registreras
i `emil/dealklipp-v1/lab-video-manifest.json`; wikin är instruktion, inte
medielagring. Labbets **Videobank** är fortfarande en lokal experimentyta.
En uppladdning där blir inte automatiskt aktiv i produkten.

## Produktens granskningsväg först

Varje ändrad replik är ett paket: exakt text, ljud, video, frame-index,
kalibrering och acceptansnotis. Nytt ljud- eller videohash ogiltigförklarar
tidigare visuellt godkännande. Bygg ersättningstakes i staging; skriv inte över
kalibrerat material i liveindex och ta inte bort metadata för att kringgå
skyddet. Kör `node pipeline/audit-dealer-sync.mjs --probe` och pre-commit-
kontrollerna. Granska Vera, Astrid, Amira och Mei via
`?dealer=<namn>&rehearsal=1`, två plays i följd. Baseline, hash och waveform
är inte ensamma bevis för läppsynk.

## Förbered en liten, exakt leverans

Emil: börja med ett Astrid-talpaket och ett alternativ till en redan täckt
situation, tillsammans med Kevin. Ange dealer, exakt replik eller kortmål,
filrevision och vad som faktiskt granskats. En video kan vara ett bra alternativ
utan att täcka varje situation i en bred nod.

För tal hör exakt text, ljud, video, frame-index, kalibrering och review ihop.
En MP4/WebM med rätt synkat ljud lämpar sig för enkel lokal intake. Separat
H.264/ljud, packad staged-film, masker och kontaktmetadata går genom befintlig
produktpipeline; ladda inte upp en packad film som om den vore vanlig MP4-preview.
Filerna kodas inte om av Videobanken.

## Lägg in i Videobanken

1. Öppna labbet på dess faktiska lokala port, normalt `http://127.0.0.1:4188/`.
   Gå till **Videobanken** och välj **Lägg in en video**.
2. Välj MP4 eller WebM, högst **128 MiB**. Ange ett begripligt namn och rätt
   dealer, eventgrupp och avsedd roll: standard eller alternativ.
3. Välj **exakt situation**. `speak.other` kräver exempelvis `greeting`, `bust`
   eller `blackjack`; ett tal-klipp gäller inte alla repliker. Kortdelning
   kräver exempelvis `box3` eller `dealer-hole`. Box 0–6 är plats 1–7.
4. Skriv proveniens, tänkt användning och granskningsluckor i anteckningen.
   Kategorisering beskriver filmen; det är inte ett visuellt godkännande.
5. Markera vid behov **Koppla till projektutkastet direkt**. Standard ersätter
   linjens videoreferens. Alternativ lägger till en variant; linjen rymmer
   standard plus högst fyra alternativ. Är den full, spara bara filmen i
   banken och byt uttryckligen koppling på ett befintligt alternativ.
6. Klicka **Spara video i banken**. Filen sparas direkt lokalt. Klicka sedan
   **Spara projekt** för att göra variantkopplingar och urvalsregler beständiga.
   Filuppladdning och projektsparning är två olika steg.

För en redan befintlig fil: välj **Inkorg** om kategorisering saknas, registrera
rätt dealer/event/situation och koppla sedan i varianteditor. Klassificeringen
är knuten till filens ID och hash; råfilen flyttas inte. Fel kategorisering på
en egen uppladdning kan rättas genom ny registrering med korrigerade metadata
och ett uttryckligt byte av koppling.

## När ska varianten få väljas?

Nya alternativ börjar med automatiskt urval avstängt, för manuell preview.
Aktivera **Regler**, **OpenClaw** och/eller **Slumpvariation** i formuläret eller
varianteditor först när varianten ska delta i just det urvalet.

- **Regler:** följer prioritet och matchande villkor.
- **OpenClaw:** får föreslås av modellen; samma kompatibilitetskontroll gäller.
- **Slumpvariation:** separat lokal presentationsslump, ingen koppling till RNG
  som väljer kort eller utfall. Standard deltar också.
- **Alla av:** bara manuell preview. Tom triggerlista betyder däremot inga
  extra villkor, inte avstängd variant.

Välj extra villkor under **Villkor / triggers**. Alla valda triggers måste
matcha, och själva eventet krävs alltid. Urvalstillåtelser och `triggerIds`
tillhör varianten; lägg inte en ny parallell policy på råfilen. Standard är
ovillkorlig reserv och kan inte begränsas med triggers.

Exempel: koppla ett nytt `blackjack`-tal till `speak.other` och låt det delta
i OpenClaw-val. Prova ett blackjack-event med matchande kontext, sedan ett
win-event. Filmen får inte väljas för win bara för att båda uttrycker glädje.
Lägg ingen talfilm på `settle.blackjack` för att duplicera samma yttrande.

## Prova, spara och lämna ett kvitto

**Spela vald variant** kontrollerar den explicit valda filmen. **Testa event**
prövar kandidater, triggers och urvalsläge. Välj både ett matchande och ett
icke-matchande fall. **Bara standard** är kontrollprovet. Prova två plays i
följd, omladdning efter sparning och fel/saknad film; 2D-reserven ska vara märkt.

Lämna en kort leveransnotis: dealer/event/situation, video-ID/hash,
variant-ID, valt urval, trigger-ID:n, provade positiva/negativa fall, faktisk
uppspelning och vad som återstår visuellt. Använd
[take-mallen](../../../lab/docs/templates/media-take.md). Mallen är underlag;
dagens uppladdare validerar inte hela läppsynkpaketet automatiskt.

Labbet spelar uppladdad preview en gång. Redigerbar looping, takepooler,
viktning och fler än fyra alternativ är inte införda. Fler råkandidater kan
finnas i banken. Kevin granskar sedan integration i produktens register och
gemensamma spelare. Aktivering i BO/live kräver den integrationen.

## Varför syns ett förval men ingen egen fil?

En standard med tom `videoGenerationId` kan använda ett exakt registrerat
lokalt original. En explicit koppling går före. Alternativ utan egen film
får sin 2D-reserv och lånar aldrig standardtal. `videoGenerationId` är ett
äldre fältnamn som även används för uppladdade video-ID:n.

Det aktiva manifestet omfattar åtta exakta deal-familjer, sjutton speech-
familjer och en idle-familj. Box 0–6 mappar till `deal_pos1`–`deal_pos7`;
tal matchas på exakt line-ID. Idle har två baser och fyra varianter. Full
plats-/splitkontakt och visuell acceptans måste fortfarande beläggas i den
faktiska rehearsal-spelaren.
