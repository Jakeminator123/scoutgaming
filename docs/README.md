# Dokument

Börja i [START-HERE](../START-HERE.md); arbetsreglerna står i [AGENTS](../AGENTS.md). Välj sakguide efter frågan. Planer beskriver kvarvarande uppdrag, inte frysta mappar eller UI-layouter.

## Läge och arbete

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Vad händer nu? | [NEXT-AGENT](NEXT-AGENT.md) | Vid överlämning |
| Organisationsarbete och verifiering | [KORPLAN-v2](plans/organisation/KORPLAN-v2.md) | Vid ny tilldelning, beslut eller verifiering |

## Produkt och kontrakt

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Arbetssteg i Admin | [användarguiden](../apps/studio/docs/README.md), [ordlistan](../apps/studio/docs/TERMINOLOGI.md) och Admins Hjälp `/admin/guide` | När flöde eller betydelse ändras |
| Lagring och uppspelning av dealermedia | [runtimeguiden](media/PRESENTATION-RUNTIME.md) | När kodens kontrakt ändras |
| Blackjack, roulette och Partner-API | [games/](games/README.md) | När regler, format eller API ändras |
| Dealer och bordsgrafik | [DEALER-TABLE-TEMPLATE](design/DEALER-TABLE-TEMPLATE.md) | När kompositionskontraktet ändras |
| Admins klientbygge, UI-kit och tema | [klientguiden](../apps/studio/client/README.md#ui-tema-och-kontrakt), [partnerguiden](../apps/studio/components/partner/README.md) | I samma PR som implementationen ändras |
| AI och OpenClaw | [AI/](AI/README.md), [OpenClaw](AI/openclaw/README.md) med källindex, dashboard, deployment och produkttal | När modellflöde eller tjänst ändras |

## Drift och miljö

| Fråga | Dokument | Uppdateras |
| --- | --- | --- |
| Molnväg, merge och release | [CLOUD-DELIVERY](operations/CLOUD-DELIVERY.md), [Render V3](../ops/cloud/RENDER-V3.md), [molnindex](../ops/cloud/README.md), [byggkontext](../ops/cloud/CONTAINER-CONTEXT.md) | När driftvägen ändras |
| Backup och återställning | [ENVIRONMENT-RESTORATION](operations/ENVIRONMENT-RESTORATION.md) | När återställningsvägen ändras |
| Miljövariabler, aldrig värden | [ENVIRONMENT-VARIABLES](operations/ENVIRONMENT-VARIABLES.md), [maskinläsbart register](environment-variables.json) | I samma leverans som en variabel ändras |
| Neon och Blob | [BLOB-NEON](storage/BLOB-NEON.md) | När schema eller lagringskontrakt ändras |
| Paows bank och GPU-körning | [PAOW-BANK-KORNING](media/PAOW-BANK-KORNING.md), [kvittomall](media/PAOW-BANK-ACCEPTANCE.template.json) | När verktyg eller endpointmall ändras; mallen är inget genomfört prov |
| F11: överlapp, återanslutning och releasevillkor | [F11-DRIFTKVITTO](plans/organisation/F11-DRIFTKVITTO.md) | Vid nytt relevant prov; behåll medan releasebeslutet använder bevisen |

## Sakplaner

Kontrollera kvarvarande delar mot aktuell kod före start. Genomförda steg och daterade filhänvisningar beställer inget nytt arbete. Bevara kontrakt i sakguiden och radera planen när dess återstående syfte är uppfyllt.

| Område | Dokument | Varför det finns kvar |
| --- | --- | --- |
| Bolagsbindning för nycklar och spelare | [API-kontraktet](games/partner-api.md#company-binding), [restarbetet](plans/organisation/KORPLAN-v2.md#bolagsbindning-kvarvarande-leverans) | 012/014 och skapvägarna är ännu inte fullt kravhöjda. Kontrakt och arbete har varsin befintlig hemvist. |
| Tal, röst och läppsynk | [TALKEDJA](plans/TALKEDJA.md), [RunPod-underlag](media/TALKEDJA-RUNPOD.md) | Pausat uppdrag. Daterade prov är underlag, inte aktuell molnstatus eller godkänd läppsynk. |
| Kontrollerad avveckling av data och media | [Lagringsguiden](storage/BLOB-NEON.md#avveckling-av-produktdata-och-original), [uppdragets avgränsning](plans/organisation/KORPLAN-v2.md#data-och-medieavveckling) | Aktuella konsumenter, frysta revisioner och verifierbar återgång före den avgränsade dataåtgärden. |
| Beställd Git-utredning och möjligt repo-byte | [historikmätning](incidents/2026-10-31-repository-history.md), [övergångsplan](incidents/2026-10-31-clean-repository-plan.md) | Beslutsunderlag för ett fortfarande separat repo-byte, inte en utförd flytt. |

## Struktur

`operations/` samlar drift, återställning och miljökontrakt. `media/` samlar
presentationsruntime, bankkörning och GPU-underlag; övriga sakområden framgår
av tabellerna ovan. Roten innehåller bara detta index, den aktuella
överlämningen och `environment-variables.json`. JSON-registret ligger kvar
som stabil maskiningång för miljökontrollen; det är inte en proseguide.

## Underhåll

- Kör `node tools/check-documentation.mjs` för relativa länkar till Git-spårade mål och Markdownankare (`--json` ger feldata). Dokumentations-CI och kontraktssviten kör kontrollen; pre-commit använder `--cached` för commitens eget index. Kontrollen läser också funktionsmapparnas README-filer. Det ger inget automatiskt CI-/merge-undantag: den separat granskade klassningen i `tools/documentation-paths.mjs` styr det. Kontrollen bedömer inte saktextens aktualitet.
- Uppdatera befintlig sakguide. Nya dokument får en tydlig ingång här eller i ett områdesindex.
- Radera förbrukade planer, dubbletter och kvitton med uppdaterade hänvisningar. Git och PR:er bär historiken; ingen extra raderingsliggare eller historikmapp behövs. Hitta äldre innehåll med `git log origin/main -- <sökväg>` och `git show <sha>:<sökväg>`. Kontrollera även aktuell `origin/preview` när konsumenter bedöms.
- Ett aktivt kontrakt eller releasebeslut får behålla sitt nödvändiga bevis. En gammal länk ensam motiverar ingen dokumentdubblett.
- Dokument följer den generella filgränsen 1 MiB och den exakta, krympande undantagslistan (`tools/check-repo-limits.mjs`). Aktualitet och lämpligt omfång granskas efter innehåll; håll överlämningar korta och ersätt inaktuella avsnitt.
- Den som ändrar ett kontrakt ansvarar för dess sakguide i samma PR. Granskaren kontrollerar konsument, beteendeprov och kvarvarande påståenden; ingen fast personägare här ersätter uppdragets tilldelning.
- Datum, gröna länkar och godkända storleksgränser bevisar inte att textens sakuppgifter stämmer. Daterade mätningar behåller datum och version; förnya underlaget före ett beslut som använder det.

Verktygsingångarna [CLAUDE](../CLAUDE.md), [GEMINI](../GEMINI.md), [Copilot](../.github/copilot-instructions.md), [Windsurf](../.windsurf/rules/scoutgaming.md) och [Cursor](../.cursor/rules/scoutgaming.mdc) pekar på START-HERE och AGENTS. Ändra arbetsreglerna i AGENTS.
