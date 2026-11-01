# Dokument

Börja i [START-HERE](../START-HERE.md); arbetsreglerna står i [AGENTS](../AGENTS.md). Välj sakguide efter frågan. Planer beskriver kvarvarande uppdrag, inte frysta mappar eller UI-layouter.

## Läge och arbete

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Vad händer nu? | [NEXT-AGENT](NEXT-AGENT.md) | Vid överlämning |
| Organisationsarbete och verifiering | [KORPLAN-v2](plans/organisation/KORPLAN-v2.md), [beslutslogg](plans/organisation/BESLUTSLOGG.md) | Vid ny tilldelning, beslut eller verifiering |
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
| Bolagsbindning för nycklar och spelare | [NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md), [STEG-F](plans/STEG-F.md) | Koden har fortfarande toleranta läsvägar. Full kravhöjning och driftacceptans är inte verifierade av dokumentgranskningen. |
| Tal, röst och läppsynk | [TALKEDJA](plans/TALKEDJA.md), [RunPod-underlag](TALKEDJA-RUNPOD.md) | Pausat uppdrag. Daterade prov är underlag, inte aktuell molnstatus eller godkänd läppsynk. |
| Selektiva presentationsförslag | [KEVIN-PORT](plans/KEVIN-PORT.md) | Daterat jämförelseunderlag med kvarvarande förslag. Kontrollera varje förslag mot aktuell main före nytt arbete. |
| Kontrollerad avveckling av data och media | [REN-START](plans/REN-START.md) | Återgångs- och referensvillkor inför eventuell dataåtgärd. Den gamla objektlistan och SQL-körlistan är ersatta med aktuell beroende- och återgångsordning. |
| Beställd Git-utredning och möjligt repo-byte | [historikmätning](incidents/2026-10-31-repository-history.md), [övergångsplan](incidents/2026-10-31-clean-repository-plan.md) | Beslutsunderlag för ett fortfarande separat repo-byte, inte en utförd flytt. |

Granskning 1 november 2026 mot
`e3dbed2c17afe91deb81ff9b9e9d88264958d38f` omfattar samtliga 39 då spårade
och fysiska filer under `docs/`. Astrids förbrukade labbguide är borttagen;
aktuella gränser finns i AI-index. Sakguiderna rättar schema/readiness,
publicering, talstart och API-exempel. Aktiva planer är kortade till
verifierat kodläge och kvarvarande arbete. [HISTORIK](HISTORIK.md) anger
originalversionen. Daterade drift- och AV-kvitton har inte gjorts om till
nya acceptanspåståenden.

## Underhåll

- Kör `node tools/check-documentation.mjs` för relativa länkar till Git-spårade mål och Markdownankare (`--json` ger feldata). Dokumentations-CI och kontraktssviten kör kontrollen; pre-commit använder `--cached` för commitens eget index. Kontrollen bedömer inte saktextens aktualitet.
- Uppdatera befintlig sakguide. Nya dokument får en tydlig ingång här eller i ett områdesindex.
- Radera förbrukade planer, dubbletter och kvitton med uppdaterade länkar och en Git-hänvisning i [HISTORIK](HISTORIK.md). Skapa ingen historikmapp.
- Ett aktivt kontrakt eller releasebeslut får behålla sitt nödvändiga bevis. En gammal länk ensam motiverar ingen dokumentdubblett.
- Dokument under `docs/` får vara högst 100 kB (`tools/check-repo-limits.mjs`). Handoffens innehåll hålls aktuellt och kort; radbrytning är ingen leveransspärr.
- Den som ändrar ett kontrakt ansvarar för dess sakguide i samma PR. Granskaren kontrollerar konsument, beteendeprov och kvarvarande påståenden; ingen fast personägare här ersätter uppdragets tilldelning.
- Datum, gröna länkar och godkända storleksgränser bevisar inte att textens sakuppgifter stämmer. Daterade mätningar behåller datum och version; förnya underlaget före ett beslut som använder det.

Verktygsingångarna [CLAUDE](../CLAUDE.md), [GEMINI](../GEMINI.md), [Copilot](../.github/copilot-instructions.md), [Windsurf](../.windsurf/rules/scoutgaming.md) och [Cursor](../.cursor/rules/scoutgaming.mdc) pekar på START-HERE och AGENTS. Ändra arbetsreglerna i AGENTS.
