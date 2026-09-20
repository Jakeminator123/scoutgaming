# Fynd och förbättringar

[Projektets ingång](../../README.md) ·
[Systemkartan](../../random-stuff-jakob/jakob-docs/systemkarta/README.md) ·
[Arbetsrapporter](../../random-stuff-jakob/jakob-docs/arkiv/README.md)

Här samlas repoövergripande observationer som behöver triage: buggar,
förbättringsförslag och frågor som måste granskas. Börja i
[registret](REGISTER.md). Utförliga undersökningar och handoffnotiser ligger
kvar som källor; registret ger en kort väg till rätt underlag.

**Registret är inte en parallell Jira eller ett tillstånd att ändra kod.**
Jira CAC är den levande arbetslistan och äger implementationens status.
Ingen Jira-koppling, ansvarig, prioritet, acceptans eller publicering ska
antas bara för att en observation finns här.

## Tre olika uppgifter per fynd

| Fält | Betydelse | Värden i första versionen |
| --- | --- | --- |
| Typ | Vad slags observation detta är | `bugg`, `förbättring`, `granskningsbehov` |
| Evidensnivå | Hur påståendet är underbyggt | `reproducerad`, `kodfynd`, `hypotes`, `förslag` |
| Arbetsstatus | Var dokumentationens triage står | Exempelvis registrerad, behöver avstämning eller inväntar ett namngivet beslut |

`reproducerad` kräver en länk till ett beskrivet försök och dess resultat.
Det kan vara ett isolerat test eller en begränsad protokollkontroll; ange
vilket. Det betyder inte automatiskt verifierat i produktion.
`kodfynd` betyder belägg i granskad kod/data utan att hela användarflödet
har reproducerats. `hypotes` är en möjlig förklaring som behöver prövas.
`förslag` är en önskad ändring, inte ett bevisat fel.

Arbetsstatusen beskriver **triage**, inte utveckling eller QA. När ett fynd
kopplas till CAC används Jira för In Dev, Ready for QA, In Testing och Done.
Läs då aktuell issue, Expected Result och fält; upptäck tillgängliga
övergångar. Kopiera inte dessa statusar till en andra arbetslista här.

## Håll registret litet och spårbart

- Tilldela nästa lediga ID i serien `F-001`, `F-002`, … och återanvänd aldrig ett gammalt ID.
  En observation behåller sitt ID även när rubrik eller bedömning ändras.
- Sök först efter samma problem. Länka relaterade fynd, men slå inte ihop
  exempelvis saknad talmedia och okänd produktbindning till ett enda fel.
- Ange område, typ, evidensnivå, triagestatus, källa/kod, nästa steg,
  beslut eller beroende samt Jira-referens. Skriv **ingen angiven** när
  Jira-issue inte är identifierad.
- Datera underlaget och skilj kodrevision, lokal reproduktion och
  driftsatt beteende. En ny uppgift kan ändra slutsatsen utan att det äldre
  kvittot raderas.
- Sammanfatta observationen och dess gräns. Länka detaljerade rapporter;
  lägg inte in chattutskrifter, hemligheter eller råa API-svar här.
- Beslut och eventuell avslutad triage ska ha en källa. Ett skickat ping
  är inte ett godkännande. En genomförd kodändring är inte visuell media-QA.

Första versionen består av två Markdown-filer. Ingen databas, schemafil,
UI, automatisk fullinventering eller ny implementeringsprocess införs.
