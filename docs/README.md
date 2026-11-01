# Dokument

Börja i [START-HERE](../START-HERE.md); arbetsreglerna står i [AGENTS](../AGENTS.md). Välj sakguide efter frågan. Planer beskriver kvarvarande uppdrag, inte frysta mappar eller UI-layouter.

## Läge och arbete

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Vad händer nu? | [NEXT-AGENT](NEXT-AGENT.md) | Vid överlämning |
| Organisationsarbete och verifiering | [KORPLAN-v2](plans/organisation/KORPLAN-v2.md) | Vid ny tilldelning, beslut eller verifiering |
| Var finns borttagen text? | [HISTORIK](HISTORIK.md) anger fil och Git-version | När dokument raderas |

## Produkt och kontrakt

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Arbetssteg i Admin | [användarguiden](../apps/studio/docs/README.md), [ordlistan](../apps/studio/docs/TERMINOLOGI.md) och Admins Hjälp `/admin/guide` | När flöde eller betydelse ändras |
| Lagring och uppspelning av dealermedia | [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md) | När kodens kontrakt ändras |
| Blackjack, roulette och Partner-API | [games/](games/README.md) | När regler, format eller API ändras |
| Dealer och bordsgrafik | [DEALER-TABLE-TEMPLATE](design/DEALER-TABLE-TEMPLATE.md) | När kompositionskontraktet ändras |
| Admins klientbygge, UI-kit och tema | [klientguiden](../apps/studio/client/README.md#ui-tema-och-kontrakt), [partnerguiden](../apps/studio/components/partner/README.md) | I samma PR som implementationen ändras |
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

| Område | Dokument | Varför det finns kvar |
| --- | --- | --- |
| Bolagsbindning för nycklar och spelare | [API-kontraktet](games/partner-api.md#company-binding), [restarbetet](plans/organisation/KORPLAN-v2.md#bolagsbindning-kvarvarande-leverans) | 012/014 och skapvägarna är ännu inte fullt kravhöjda. Kontrakt och arbete har varsin befintlig hemvist. |
| Tal, röst och läppsynk | [TALKEDJA](plans/TALKEDJA.md), [RunPod-underlag](TALKEDJA-RUNPOD.md) | Pausat uppdrag. Daterade prov är underlag, inte aktuell molnstatus eller godkänd läppsynk. |
| Kontrollerad avveckling av data och media | [Lagringsguiden](storage/BLOB-NEON.md#avveckling-av-produktdata-och-original), [uppdragets avgränsning](plans/organisation/KORPLAN-v2.md#data-och-medieavveckling) | Aktuella konsumenter, frysta revisioner och verifierbar återgång före den avgränsade dataåtgärden. |
| Beställd Git-utredning och möjligt repo-byte | [historikmätning](incidents/2026-10-31-repository-history.md), [övergångsplan](incidents/2026-10-31-clean-repository-plan.md) | Beslutsunderlag för ett fortfarande separat repo-byte, inte en utförd flytt. |

Konsolidering 1 november 2026 mot `f6185c3663dc9101958c8aca78527a5fa2d0301b`:
fem ytterligare plan-/loggfiler är borttagna. Bolagskontrakt, verkligt restarbete
och avvecklingsordning finns i guiderna ovan. Obeställda presentationsidéer och
avslutade etappkvitton finns i Git via [HISTORIK](HISTORIK.md).
Den tidigare bedömningen att varje restuppgift behövde en egen plan var för
försiktig; länkkontrollen kräver hela hänvisningar, inte att dokumenten bevaras.
F11:s aktiva releasebevis och de beställda incidentunderlagen är kvar.

## Underhåll

- Kör `node tools/check-documentation.mjs` för relativa länkar till Git-spårade mål och Markdownankare (`--json` ger feldata). Dokumentations-CI och kontraktssviten kör kontrollen; pre-commit använder `--cached` för commitens eget index. Kontrollen bedömer inte saktextens aktualitet.
- Uppdatera befintlig sakguide. Nya dokument får en tydlig ingång här eller i ett områdesindex.
- Radera förbrukade planer, dubbletter och kvitton med uppdaterade länkar och en Git-hänvisning i [HISTORIK](HISTORIK.md). Skapa ingen historikmapp.
- Ett aktivt kontrakt eller releasebeslut får behålla sitt nödvändiga bevis. En gammal länk ensam motiverar ingen dokumentdubblett.
- Dokument följer den generella filgränsen 1 MiB och den exakta, krympande undantagslistan (`tools/check-repo-limits.mjs`). Aktualitet och lämpligt omfång granskas efter innehåll; håll överlämningar korta och ersätt inaktuella avsnitt.
- Den som ändrar ett kontrakt ansvarar för dess sakguide i samma PR. Granskaren kontrollerar konsument, beteendeprov och kvarvarande påståenden; ingen fast personägare här ersätter uppdragets tilldelning.
- Datum, gröna länkar och godkända storleksgränser bevisar inte att textens sakuppgifter stämmer. Daterade mätningar behåller datum och version; förnya underlaget före ett beslut som använder det.

Verktygsingångarna [CLAUDE](../CLAUDE.md), [GEMINI](../GEMINI.md), [Copilot](../.github/copilot-instructions.md), [Windsurf](../.windsurf/rules/scoutgaming.md) och [Cursor](../.cursor/rules/scoutgaming.mdc) pekar på START-HERE och AGENTS. Ändra arbetsreglerna i AGENTS.
