# Dealers, video och takes

[Till systemkartan](../README.md) · [Nästa: JSON och lagring](../04-studio-json-och-lagring/README.md)

**Rätt film måste kunna utföra den konkreta situationen.** Ett nodnamn,
en standardpost eller ett korrekt filhash bevisar inte det.

[Astrids live-kontroll 21 september](ASTRID-LIVE-2026-09-21.md) jämför
motorlistan med native-anrop, Partner-instruktioner och faktisk tillgänglighet.
Grund-staged finns; smooth60/rhythm och native goodluck/win gav 404 i provet.

## Fyra frågor om varje film

1. **Finns den?** Originalinventering och stream-index beskriver material.
2. **Passar den?** Dealer, exakt tal, destination, hand/kortposition och
   sekvens måste stämma där de påverkar uppgiften.
3. **Är den granskad?** Exakta mediebytes, kalibrering och visuell acceptans
   hör ihop. Ny ljud-/videohash upphäver tidigare acceptans för ändrad take.
4. **Används den?** Aktiv konfiguration och faktisk uppspelning måste
   kontrolleras separat.

`/api/v1/assets` bygger ett manifest från filer. Det läser inte aktuella
BO-bindningar och är inte ett uppspelningskvitto. Performance-takes filtreras
på att de inte är `rejected`; även `review` kan därför komma med.
Manifestförekomst betyder inte godkänd take.

## Vilka register finns?

- Produktmedia: Astrid i [dealers/astrid](../../../../web/public/dealers/astrid/),
  Vera i [dealer](../../../../web/public/dealer/), Amira i
  [dealers/amira](../../../../web/public/dealers/amira/) och Mei i
  [dealers/mei](../../../../web/public/dealers/mei/).
- Daterad inventering: 90 stream-indexposter, fördelade 20/39/16/15.
  [Originalinventeringen](../../../../docs/animation-events/v3-video-map/README.md)
  har 224 poster. Antalen mäter inte godkänd täckning.
- [Performance-manifest](../../../../web/public/dealers/astrid/performance/manifest.json)
  och [proveniens](../../../../web/public/dealers/astrid/performance/provenance.json)
  beskriver Astrids fyra grundtakes och två continuations, samtliga
  `review` vid den daterade inventeringen.
- [Exakt talmedia](../../../../web/public/speech-media.json) och
  [tal-ID:n](../../../../web/public/speech-lines.mjs) håller ihop replik och
  mediekoppling. Text, ljud, video, frame-index, kalibrering och acceptans
  måste behandlas som ett paket.
- [Labbets videobank](../../../../lab/VIDEO-LIBRARY.md) visar original och
  lokala uppladdningar. Kategorisering är knuten till ID/hash och binder
  ingen film till produkten.

## Situation före uttryck

Box 3:s första och andra kort kan ibland använda samma take med korrekt
digital placering och kalibrering. Andra mål kan kräva andra filmade rörelser.
Återanvändningen måste visas i produktspelaren; vänster/mitten/höger bevisar
inte täckning för sju boxar, split och senare kort.

Labbets variant har en animation och högst en videoreferens. Kategoriserad
film kan bindas till rätt dealer/event; exakt replik/kortsituation kontrolleras
mot testeventet. Manuell preview granskar den valda filmen. Saknad eller
felaktig film ger märkt 2D-reserv i eventtestet. Ingen av dessa funktioner är
en komplett katalog över godkända produkttakes.

**Förslag:** en variant kan få flera likvärdiga, kompatibla takes.
Takepool, viktning, generell idle-sekvens och produktkoppling återstår.
Produktens befintliga idle-scheduler och labbets `once`-preview är olika saker.

## Ljud och video ger också signaler

Beredskap, `currentTime`, slut, avbrott, fel och frame-cues samordnar
uppspelningen. Pickup/release/land/rest markerar tidpunkter inne i materialet;
de ändrar inte kort eller resultat. Nytt tal över gammal talvideo är inte
godkänd läppsynk.

[DealerEngine](../../../../web/public/dealer-engine.mjs),
[PerformancePlayer](../../../../web/public/performance-player.mjs) och
[manifestbyggaren](../../../../web/partner-presentation.mjs) är direkta
kodkällor. Ingen produktvideo avkodades eller innehållsindexerades i denna
dokumentationsgranskning.

## Öppna fynd består

[Findings F-001–F-007](../../../../docs/findings/REGISTER.md) skiljer loaderns
samtidighetsfel, staged-förladdning, HTTP-cache, QA-paketering, Partner-
klassificering, taltäckning och okända aktuella BO-bindningar.
F-001/F-002 har fortfarande sitt särskilda beslutsberoende. Ingen ny
visuell dealergranskning, spelarändring eller takeacceptans ingår här.
