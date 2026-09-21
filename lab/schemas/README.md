# Scheman för labbet

`studio.schema.json` beskriver projektet, `video.schema.json` klassificering
och `social.schema.json` den separata sociala policyn. Tekniska ID:n och
tillåtna situationer samordnas med `../policies/studio-contract.json`.
`test/studio-contract.test.mjs` kontrollerar att dessa håller ihop.

V5 kompletterar `speak.other` med befintliga grundrepliker som tidigare gick
att prova som original men inte klassificera vid upload. Detta är additivt:
inga gamla projekt eller event-ID:n migreras. Exakt replik krävs fortfarande.
En schemagiltig fil är inte bevis för dealeridentitet, codec eller läppsynk.

[Artefaktkartan](../docs/ARTIFACTS.md) skiljer dessa format från produktens
mediemanifest, 2D-rörelser och OpenClaws befintliga event-/katalogscheman.
Planerade talbeslut i implementationsbriefen är inte ett redan aktivt API.
