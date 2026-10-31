# GAM-01: F11: verifiera restart och återanslutning i drift

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 1. Nivå: B. Prioritet: P1.
- Beroenden: [REL-01](../../02-release-och-drift/aktiviteter/REL-01.md), [GEM-02](../../../gemensamt/aktiviteter/GEM-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

F11-kod är mergad: versionsbevakning/observeRoom, 1012 och shutdown finns. Restriktionen om tomt bord kvarstår tills runtimeacceptans är verifierad.

## Utförande

Förbered ett isolerat previewprov med två avsedda instanser/övergång, syntetiska spelare och omstart under hand. Återanvänd QA/prov, utan att köra på produktion. Ändra kod bara om ett reproducerat fel kräver det.

## Klart när

Under deployöverlappet får klienter på **båda instanserna** löpande aktuella snapshots/versioner och dealerhändelser innan den gamla instansen stängs; en fryst vy fram till disconnect är inte godkänt. Därefter verifieras 1012 och återanslutning, samma hand/kort/utfall, inga dubbla reservationer/utbetalningar och bevarad session-/bolagsisolering. Tomt-bord-regeln hävs först med granskat kvitto för hela förloppet.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M06; F-05; S14; KEVIN-PORT #529. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
