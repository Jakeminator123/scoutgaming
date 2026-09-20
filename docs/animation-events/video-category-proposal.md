# Enkel modell för videotyper och uppspelning

Beslutsskiss, 20 september 2026. **Inte implementerad eller runtime-godkänd.**
Utgår från det lokala repot; ingen ny kontroll av driftsatt app-revision ingår.

Interaktiv lokal canvas:
[Videotyper och uppspelning](C:/Users/jakem/.cursor/projects/c-Users-jakem-Projects-croupier/canvases/croupier-videotyper-och-uppspelning.canvas.tsx).
Blått + ”finns idag” markerar befintlig kod; orange + ”nytt förslag” markerar
nya krav eller nya gemensamma fält. Färg är aldrig den enda markeringen.

## Behåll tre skilda frågor

1. **Vad gör filmen? Befintligt i labbet:** idle, action, tal eller reaktion.
2. **Hur spelas den? Nytt gemensamt registreringsfält:** en gång eller loop.
   Beteendena finns i spelarkoden men inte som ett enhetligt labbfält.
3. **När får den väljas? Befintlig labbpolicy:** manuell preview och separata
   tillåtelser för regler, OpenClaw och presentationsslump. Triggers är extra
   villkor. Nya alternativ börjar manuellt.

## Befintlig indelning och föreslagen standardregel

- `idle` → Idle / vänteläge. **Förslag:** loop för basväntan; en gång för en
  kort idle-gest. Idle som kategori innebär inte att varje film ska loopas.
- `deal` + `reveal` → Action / korthandling. **Förslag:** en gång per handling
  med bevarad destination, kortidentitet och kalibrerad synk.
- `speak` → Tal / exakt replik. **Behåll:** en gång med exakt text, ljud och
  video. En inspelad mening får inte loopas över fortsatt ljud.
- `turn` + `settle` → Reaktion / tur / resultat. **Förslag:** en gång och
  därefter nästa tillåtna tillstånd. Tal ägs av separat `speak`-event.

Sex presentationstyper och 16 labbnoder behålls. Övergångar och returer finns
i delar av spelaren, men är ingen femte registrerbar videotyp i labbet.
**Förslag:** behåll dem som tekniska länkar mellan kompatibla tagningar,
eventuellt bakom en senare avancerad editor, inte nya motor-events.

## Föreslagen strikt placering

Dealer → event → exakt situation → standard/alternativ → videofil.

Grunddata för detta finns delvis. **Nytt krav:** samma kompatibilitetsregler
måste gälla vid registrering, visning, sparning och val. Exempelvis ska
Astrid/deal/box2 inte erbjuda box3-filmer. Oklassificerade original placeras i
en separat inkorg och är inte automatiskt kompatibla med alla fack.

Lägg till tydligt avslut, tillåten brytpunkt och hashbunden loopgranskning.
Spelet äger eventordningen. Ingen godtycklig avbrytning mitt i kortlandning
eller replik; inget byte till en annan situations film vid saknat material.
Standard är uttryckligen vald grundtagning, inte automatisk kvalitetsrankning.

## Nuläge och källor

- [Videotyp/situation](../../lab/lib/video-intake.mjs): fyra typer; äldre
  original utan klassificering släpps fortfarande igenom `videoFitsLine`.
- [Labbspelaren](../../lab/components/stage.tsx): alla videor spelas en gång.
- [Eventkontrakt](../../web/partner-presentation.mjs): sex presentationstyper.
- [Spelklienten](../../web/public/app.mjs): `onIdlePick` återväljer idle,
  ibland små gester och i äldre delningsväg en action medan utdelning pågår.
- [DealerEngine](../../web/public/dealer-engine.mjs): köat klipp före idleval.
- [PerformancePlayer](../../web/public/performance-player.mjs): engångstakes,
  övergångar och särskild vänteloop.

Canvasens TypeScript-kontroll passerade med det installerade canvas-SDK:t.
Ingen runtime-, media-, manifest- eller policyändring gjordes. Skissen är
underlag för nästa beslut, inte en färdig produktintegration.
