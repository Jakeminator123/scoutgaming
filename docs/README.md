# Dokument

Börja i [START-HERE](../START-HERE.md); arbetsreglerna står i [AGENTS](../AGENTS.md). Välj sakguide efter frågan. Planer beskriver kvarvarande uppdrag, inte frysta mappar eller UI-layouter.

## Läge och arbete

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Vad händer nu? | [NEXT-AGENT](NEXT-AGENT.md) | Vid överlämning |
| Organisationsarbete och verifiering | [KORPLAN-v2](plans/organisation/KORPLAN-v2.md), [beslutslogg](plans/organisation/BESLUTSLOGG.md) | Vid ny tilldelning, beslut eller verifiering |
| Migrationsstatus | [STATUS](../migrering/STATUS.md), genererad från `migrering/status.json`; [MASTERPLAN](../migrering/MASTERPLAN.md) är ingången till den avslutade migreringen | Bara vid konkret återöppnat migrationsfel |
| Var finns borttagen text? | [HISTORIK](HISTORIK.md) anger fil och Git-version | När dokument raderas |

## Produkt och kontrakt

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Arbetssteg i Admin | [användarguiden](../apps/studio/docs/README.md), [ordlistan](../apps/studio/docs/TERMINOLOGI.md) och Admins Hjälp `/admin/guide` | När flöde eller betydelse ändras |
| Lagring och uppspelning av dealermedia | [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md) | När kodens kontrakt ändras |
| Blackjack, roulette och Partner-API | [games/](games/README.md) | När regler, format eller API ändras |
| Dealer och bordsgrafik | [DEALER-TABLE-TEMPLATE](design/DEALER-TABLE-TEMPLATE.md) | När kompositionskontraktet ändras |
| AI och OpenClaw | [AI/](AI/README.md), [OpenClaw](AI/openclaw/README.md) med källindex, dashboard, deployment och produkttal | När modellflöde eller tjänst ändras |

## Drift och miljö

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Molnväg, merge och release | [CLOUD-MIGRATION](CLOUD-MIGRATION.md), [Render V3](../ops/cloud/RENDER-V3.md), [molnindex](../ops/cloud/README.md), [byggkontext](../ops/cloud/CONTAINER-CONTEXT.md) | När driftvägen ändras |
| Backup och återställning | [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) | När återställningsvägen ändras |
| Miljövariabler, aldrig värden | [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md), [maskinläsbart register](environment-variables.json) | I samma leverans som en variabel ändras |
| Neon och Blob | [BLOB-NEON](storage/BLOB-NEON.md) | När schema eller lagringskontrakt ändras |
| Paows bank och GPU-körning | [PAOW-BANK-KORNING](PAOW-BANK-KORNING.md), [kvittomall](2026-11-XX-TALKEDJA-PAOW-BANK-ACCEPTANCE.json) | När verktyg eller endpointmall ändras; mallen är inget genomfört prov |
| F11: överlapp, återanslutning och releasevillkor | [F11-DRIFTKVITTO](plans/organisation/F11-DRIFTKVITTO.md) | Vid nytt relevant prov; behåll medan releasebeslutet använder bevisen |

## Sakplaner

Kontrollera kvarvarande delar mot aktuell kod före start. Genomförda steg och daterade filhänvisningar beställer inget nytt arbete. Bevara kontrakt i sakguiden och radera planen när dess återstående syfte är uppfyllt.

| Område | Dokument |
| --- | --- |
| Bolagsbindning för nycklar och spelare | [NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md), [STEG-F](plans/STEG-F.md) |
| Tal, röst och läppsynk | [TALKEDJA](plans/TALKEDJA.md), [PAOW-LIPSYNC](plans/PAOW-LIPSYNC.md), [RunPod-underlag](TALKEDJA-RUNPOD.md) |
| Selektiva presentationsförbättringar | [KEVIN-PORT](plans/KEVIN-PORT.md) |
| Admin, partner och design | [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md), [PARTNERPORTAL-KONVERTERING](plans/PARTNERPORTAL-KONVERTERING.md), [DESIGNSYSTEM](plans/DESIGNSYSTEM.md), [VISUELL-RIKTNING](plans/VISUELL-RIKTNING.md), [VERKTYGSKEDJA](plans/VERKTYGSKEDJA.md) |
| Kontrollerad avveckling av data och media | [REN-START](plans/REN-START.md); konkreta backup-, referens- och återgångsvillkor gäller före dataåtgärd |
| Beställd Git-utredning och möjligt repo-byte | [historikmätning](incidents/2026-10-31-repository-history.md), [övergångsplan](incidents/2026-10-31-clean-repository-plan.md); daterade beslutsunderlag, ingen utförd flytt |

## Underhåll

- Uppdatera befintlig sakguide. Nya dokument får en tydlig ingång här eller i ett områdesindex.
- Radera förbrukade planer, dubbletter och kvitton med uppdaterade länkar och en Git-hänvisning i [HISTORIK](HISTORIK.md). Skapa ingen historikmapp.
- Ett aktivt kontrakt eller releasebeslut får behålla sitt nödvändiga bevis. En gammal länk ensam motiverar ingen dokumentdubblett.
- Dokument under `docs/` får vara högst 100 kB; NEXT-AGENT högst 150 rader (`tools/check-repo-limits.mjs`).

Verktygsingångarna [CLAUDE](../CLAUDE.md), [GEMINI](../GEMINI.md), [Copilot](../.github/copilot-instructions.md), [Windsurf](../.windsurf/rules/scoutgaming.md) och [Cursor](../.cursor/rules/scoutgaming.mdc) pekar på START-HERE och AGENTS. Ändra arbetsreglerna i AGENTS.
