# Croupier · Presentationsplan V5

> **28 september: GitHub V2-arbete.** Aktiv branch är
> `jakemanator123-github-work` i `Jakeminator123/github-work`.
> V1 är sparad som `Jakobs-v1`; GitLab och wiki-synken är pausade.
> Samlad [lägesbild, testplan och molnplan](../STATUS-OCH-TESTPLAN-V2.md)
> är avstämd mot `44feeec` och skiljer verifierad kod från återstående driftprov.
> Nedanstående tidsplan/publiceringsflöde är historiskt underlag.
> Läs [migreringen](../GITHUB-MIGRATION.md) och
> [molnförberedelserna](../CLOUD-MIGRATION.md) för aktuellt läge.

**Sju återstående arbetsdagar efter startgrinden D0.** Från verklig signal till rätt presentation,
med tydliga bevis på vad som finns, vad labbet provar och vad som återstår.

- [Läs V5 i GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/animation-events) · [Läs källan](v5-7-days-mvp/README.md) · [Sjudagarsplanen](v5-7-days-mvp/s06-plan.md)
- [Portabel handoff för den kvarvarande sjudagarsramen](v5-7-days-mvp/HANDOFF-7-DAGAR.md)
- [Äldre publik webbversion från 21 september](https://animation-events-v1.vercel.app/) — inväntar beslut om omdirigering eller avveckling
- [Systemkartan](../../random-stuff-jakob/jakob-docs/systemkarta/README.md)
- [Astrids kamera och tal: implementation och verifieringsläge](ASTRID-CAMERA-IMPLEMENTATION.md)

## En källa, en primär publiceringsyta

Croupier-koden är källa för motor, spelstatus och uppspelning. V5-filerna här
är sakunderlaget. GitLab-wikin är den primära läsytan och synkas direkt från
Croupier med `node tools/sync-animation-events-wiki.mjs --wiki WIKI_PATH --write`.
Synken bygger eller ändrar inte webbversionen. Ingen dokumentationsyta är en
spelmotor eller ett bevis på färdig produktintegration.

Webbversionen är en separat historisk publicering från 21 september. Den har
fliknavigation, sök, hash-länkar, mobil/utskrifts-CSS och gamla V2–V4-snapshots,
men visar fortfarande den äldre åttadagarsversionen. Den ska inte uppdateras eller
stängas som bieffekt av wiki-publicering.

Kevin äger produktintegration och motorn. Jakob arbetar på sin branch med
presentationens logik och labb. Emil arbetar nära Kevin med video, takes och läppsynk. Jakobs OpenClaw-chatt ska
äga samtal och talbeslut; Kevin integrerar detta med befintlig gemensam klientkö.
Se V5:s konkreta instruktioner för uppladdning, triggers och testkvitton.

## Versionsgräns

V5 är aktuell. Sju dagar är Jakobs nuvarande planeringsram, inte ett löfte
om godkänd lansering. V4, V3 och V2 är historiska dokumentversioner och ska inte
användas som aktuell plan. Äldre adresser behålls för hänvisningar.

Ändra källan här, kontrollera den och publicera sedan wikin i en egen leverans.
Ett separat beslut krävs för att omdirigera eller avveckla webbplatsen. Visa källa,
testmiljö och kvarstående luckor intill påståendet.
Spelarkod, media, runtimekontrakt och Jira-status ändras inte av ett dokumentbygge.
