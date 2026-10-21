# Migrationsstatus

Genererad från [status.json](status.json). Uppdaterad 2026-10-21.

**Verifierad migrering: 20% (4/20 aktiviteter).**

Detta mäter godkända leveranser. Det är inte en uppskattning av förbrukad arbetstid. Planfiler ger inga migrationspoäng.

| Etapp | Verifierat inom etappen | Kumulativt etappmål | Grind |
| --- | ---: | ---: | --- |
| E1 Kontrakt och första Adminleverans | 100% | 20% | Godkänd |
| E2 En produktväg | 0% | 40% | Ej godkänd |
| E3 Kevinmodul med mains lagring | 0% | 60% | Ej godkänd |
| E4 Adminstyrning och datamigrering | 0% | 80% | Ej godkänd |
| E5 Verifierad leverans | 0% | 100% | Ej godkänd |

| Ansvar | Verifierat inom ansvaret |
| --- | ---: |
| jakob | 20% |
| kevin | 14% |
| orkestrator | 33% |

| ID | Aktivitet | Ansvar | Status |
| --- | --- | --- | --- |
| J01 | Tydligare publicering i Admin | jakob | VERIFIED |
| J02 | Avveckla ersatt Control-publicering | jakob | VERIFIED |
| K01 | Inventera den rensade Kevin-modulen | kevin | VERIFIED |
| O01 | Lås kontrakt och funktionsansvar | orkestrator | VERIFIED |
| J03 | Avveckla resterande Control-ytor | jakob | IN_PROGRESS |
| J04 | En spelkatalog via lobby | jakob | TODO |
| J05 | Förenkla runtime och byggkedja | jakob | TODO |
| J06 | Rensa testlås och rikta CI | jakob | TODO |
| K02 | Ren regelkärna med explicit slump | kevin | IN_PROGRESS |
| K03 | Delat bord utan SQL- och videokoppling | kevin | IN_PROGRESS |
| J07 | Postgres-adapter för delat bord | jakob | TODO |
| K04 | Spelklient och presentation från händelser | kevin | TODO |
| J08 | Admin styr versionerad spelkonfiguration | jakob | TODO |
| K05 | Exakt mediakoppling till Neon och Blob | kevin | TODO |
| J09 | Förbered avveckling av oanvända databaskontrakt | jakob | TODO |
| K06 | Verifiera Admin till spel efter omstart | kevin | TODO |
| K07 | Verifiera spelbeteenden och samtidighet | kevin | TODO |
| J10 | Ren klon, start och återställning | jakob | TODO |
| O02 | Oberoende integrerad granskning | orkestrator | TODO |
| O03 | Godkänd integration och verifierad drift | orkestrator | TODO |

## Uppdatering

Orkestratorn uppdaterar status.json efter granskad leverans och kör node migrering/status.mjs --write.
VERIFIED kräver full kod-SHA, branch, PR, oberoende granskare och konkreta test-/runtimebevis. Skriptet validerar uppgifterna strukturellt; granskaren bedömer bevisen.
En ändring som ogiltigförklarar ett bevis återöppnar aktiviteten och berörda beroenden; procenten får sjunka.

[Masterplan](MASTERPLAN.md) · [Jakobs aktiviteter](jakob-main-migrering/AKTIVITETER.md) · [Kevins aktiviteter](kevin-ks-migrering/AKTIVITETER.md)
