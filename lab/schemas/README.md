# Scheman för labbet

Projekt-, video-, idle- och probescheman ägs av
`../../packages/presentation/contracts/schemas/`. `lab-video-manifest.schema.json`
och `social.schema.json` stannar här med appens lagrings- och socialfunktioner.
Tekniska ID:n och tillåtna situationer samordnas med
`../../packages/presentation/contracts/policies/studio-contract.json`.
`test/studio-contract.test.mjs` kontrollerar att dessa håller ihop.

V5 kompletterar `speak.other` med befintliga grundrepliker som tidigare gick
att prova som original men inte klassificera vid upload. Detta är additivt:
inga gamla projekt eller event-ID:n migreras. Exakt replik krävs fortfarande.
En schemagiltig fil är inte bevis för dealeridentitet, codec eller läppsynk.

[Guidens material- och granskningsregler](../docs/README.md#material-och-granskningsregler)
skiljer dessa format från produktens kanoniska mediemanifest och 2D-prov.
Aktuellt tal- och uppspelningsansvar beskrivs i
[presentationsguiden](../../docs/LOCAL-PRESENTATION-RUNTIME.md).
