# 05 — Historik, handoffs, loggar och arkiv

## Syfte och mål

Sammanfatta hur arbetet utvecklades över flera agenter och göra nuvarande
fakta lättare att hitta. Bevara spårbarhet utan att flytta material till en
ny databas bara för att ett dokument blivit långt.

## Verifierad tidslinje att börja med

Det finns flera rimliga startpunkter. Git-datum visar committat arbete,
inte när första samtalet eller all utveckling började.

| Fas | Tidig verifierad punkt | Betydelse |
| --- | --- | --- |
| Nuvarande John-handoff/dealerbevis | 8 september, `25851e9f` | Tidig version av den löpande handofffilen |
| Next-baserad presentationsstudio | 20 september, `6efd3ba4` | Studioarbetet föregår den senaste migreringen |
| Lissabon stream lane | 25 september, `26a5d3aa` | Fokuserad, beständig labblane |
| V2/molnmigrationens dokument | 28 september, `b3e830a0` | CLOUD-MIGRATION införs och GitHub/molnberedskap dokumenteras |
| BO/Lab/Lissabon-konsolidering | 2 oktober, `3e65860d` och `421b6f4b` | Sammanslagning, städning och Neon/Vercel-förberedelse |
| Plan för en gemensam Studio | 2 oktober, `cd4d8480` | Sammanhängande UI, data och ansvar |
| Produktionsimport och avveckling | 4 oktober, slutleverans `bee4e04a` | P7/P8 genomförda; tre senare upptäckta funktionsfel hanteras i plan 01 |

Kevin finns i flera äldre commitmeddelanden, bland annat media-/kalibreringsarbete
i augusti och en samordningsfas 19–22 september. Namnet anger historiskt
arbete/proveniens och identifierar inte en enda avstängd runtimefunktion.

## Vad sparas var?

| Material | Nuvarande innebörd | Bevarande/åtgärd |
| --- | --- | --- |
| Committade handoffs/planer/kod | Versioner i Git | Vanliga nya commits tar inte bort tidigare committad historik. Sammanfatta från aktiva dokument och deras Git-historik. |
| Aktuell JOHN-HANDOFF och CLOUD-MIGRATION | Löpande dokument med många historiska checkpoints | Inte ett automatiskt daterat arkiv. Markera nuläge tydligt och kondensera äldre avsnitt med länkar till relevanta commits. |
| Privata drift-/QA-kvitton | Ignorerad lokal data i `lab/data/platform-private` | Ingår inte i en vanlig Git-push. Inventera metadata och bevara oföränderliga original. |
| Extern diskbackup | `C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004` | Bevaras efter avveckling; inget nytt raderingsdatum är beslutat. |
| Codex-chattar | Arkivering organiserar chattar; det är inte samma sak som radering | Arkiverade hjälpagenter ändrar inte redan committad kod. Exakt automatisk gallring/inställning för denna installation är inte verifierad. |
| Provider-/processloggar | Annan lagring än Git och kvitton | Faktisk retention måste läsas för den aktuella tjänsten om loggar behövs som beständigt bevis. |

OpenAI beskriver arkivering som organisering och möjlighet att återfinna
arkiverade chattar: [officiell dokumentation](https://developers.openai.com/blog/mastering-codex-remote-for-engineering).
Källan anger inte en garanterad obegränsad lagringstid för denna installation.
Git-dokumenten ska därför bära överlämningen även när en chatt inte används.

## Kontroller och ändringar

1. Gör en kort sammanfattning per fas: avsikt, faktisk ändring, slut-SHA,
   bevis och kvarvarande luckor. Läs endast relevant, aktiv Git-historik.
2. Rätta nuvarande dokument där historiska målbilder fortfarande låter
   aktuella, exempelvis gamla konto-/route-/diskbeskrivningar. Radera inte
   kvitton eller skriv om historiska FAIL till PASS.
3. Identifiera vilken ”mycket stor loggfil” Jakob avser: exakt path, typ,
   storlek, tillväxt och vem som läser den. Filen är ännu inte identifierad.
4. Välj därefter åtgärd: rotation/komprimering för driftlogg, privat extern
   lagring för kvitton eller sökbart register om det finns ett verkligt behov.
   Docker i sig löser varken sökning, backup eller retention.
5. Dokumentera ägare, backupplats, återläsning och eventuell gallringsregel
   innan något flyttas/raderas. Kostnadsjournaler och reservationer får inte nollställas.

Vid inventeringen var `JOHN-HANDOFF.md` 122 650 byte och
`CLOUD-MIGRATION.md` 99 900 byte. Deras problem är främst läsbarhet och
blandade tidslager, inte en lagringsvolym som kräver databas.

Jakobs pensionerade personliga arkiv läses eller återställs inte genom denna
plan. Generell historiksammanfattning är inte en begäran om en viss gammal privat handling.

## Färdigt när

En ny granskare kan förstå faser, beslut och nuläge utan chatthistorik;
aktuella påståenden är skilda från historiska checkpoints. Den namngivna
stora loggen har ett motiverat bevarandebeslut. Inget okänt arkiv har gallrats.
