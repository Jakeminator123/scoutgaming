# ADM-01: Samla kvarvarande publiceringskontrakt efter L3

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: B. Prioritet: P1.
- Beroenden: [DAT-01](../../07-data-och-media/aktiviteter/DAT-01.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

L3 steg 5-6 är levererade; paketens rooms är aktiva registret. gameLanes är kvarvarande uppspelningskonfig. Dragan-test har room_config_missing redan före L3.

## Utförande

Spåra aktuella roomOverrides, frysta paket och publiceringsvägar, inklusive roulette/pausade bord/Provspel. Bryt ut återstående steg 7 och Dragan-konfig som separata ändringar vid tilldelning. Gissa ingen standard som öppnar ett felkonfigurerat rum.

## Klart när

Admin → spara → omläsning → publicering → rätt rum/bolag → launch. Grannrummets utkast består och CAS/scope testas negativt. Rättade L3-delar räknas inte som nya fel.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: S12/S13; M17; aktuell NEXT-AGENT. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
