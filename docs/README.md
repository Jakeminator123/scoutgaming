# Dokument

En rad per dokument: vad det är, för vem och när det uppdateras. Ingången är [START-HERE](../START-HERE.md) och reglerna står i [AGENTS](../AGENTS.md). Ett nytt dokument får en rad här i samma PR; ett dokument som ingen levande text eller kod pekar på raderas i stället för att arkiveras. Raderade dokument läses ur Git (`git log --diff-filter=D -- docs/`).

Gränser (`tools/check-repo-limits.mjs`): inget dokument under `docs/` över 100 kB och [NEXT-AGENT](NEXT-AGENT.md) högst 150 rader.

## Läge och status

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [NEXT-AGENT](NEXT-AGENT.md) | Aktuellt läge, återstående arbete, kända fällor | Agent som börjar kallt | Vid varje överlämning (status-PR:n) |
| [migrering/STATUS](../migrering/STATUS.md) och [MASTERPLAN](../migrering/MASTERPLAN.md) | Aktivitetsstatus (genererad från `status.json`) och plan | Alla | När en aktivitet ändrar status |

## Drift och miljö

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [CLOUD-MIGRATION](CLOUD-MIGRATION.md) | Ytor, datalagring, väg från merge till produktion, deploykontroll | Den som levererar | När driftvägen ändras |
| [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) | Backup, restore, Node-versioner, renklonprov | Den som återställer eller provar | När backup- eller restorevägen ändras |
| [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) och [environment-variables.json](environment-variables.json) | Alla miljövariabler per tjänst, aldrig värden; JSON:en läses av `tools/check-environment-variables.mjs` | Alla som rör env | I samma PR som variabeln ändras |
| [2026-10-28-ENV-INVENTORY](2026-10-28-ENV-INVENTORY.md) | Inventering av döda och saknade variabelnamn 28 oktober | Den som städar env | Daterad, ändras inte |
| [storage/BLOB-NEON](storage/BLOB-NEON.md) | Klipp i Neon och Blob: sökvägar, import, radering | Den som rör media | När lagringskontraktet ändras |
| [ops/cloud/RENDER-V3](../ops/cloud/RENDER-V3.md), [README](../ops/cloud/README.md), [CONTAINER-CONTEXT](../ops/cloud/CONTAINER-CONTEXT.md) | Spelmotorn på Render: tjänst, deploy, återgång, byggkontext | Den som deployar motorn | När tjänsten eller imagen ändras |

## Produkt och kontrakt

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [apps/studio/docs/README](../apps/studio/docs/README.md) | Användarguide för Admin (länkas från Admins hjälp) | Admin-användare | När ett arbetssteg i Admin ändras |
| [apps/studio/docs/TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md) | Ord och begrepp (länkas från Admins hjälp) | Alla | När ett begrepp ändras |
| [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md) | Tekniskt kontrakt för lagring, frysning och uppspelning av dealermedia | Den som rör presentation | När kontraktet i koden ändras |
| [games/](games/README.md) | Blackjack, roulette, klipp och format, Partner-API v1 | Den som rör spel eller integration | När regler, format eller API ändras |
| [AI/](AI/README.md) och [AI/openclaw/](AI/openclaw/README.md) | Vem anropar vilken modell, OpenClaw-källor, produkttal, Director- och Gateway-drift, dashboard, Astrids labbchatt (avvecklas) | Den som rör tal eller OpenClaw | När Director, Gateway eller modellflöden ändras |

## Planer

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [plans/O02-PLAN](plans/O02-PLAN.md) och [O02-RESTORE-REPLAY](plans/O02-RESTORE-REPLAY.md) | Frysning, restore och replay inför O02 (refereras av `tools/o02-*.mjs`) | Orkestreraren | Tills O02 är klar, sedan raderas de |
| [plans/PAOW-LIPSYNC](plans/PAOW-LIPSYNC.md) | Paow: verifierat läge för röst, bank och RunPod, proven 28 oktober, varför inget aktiveras före O03, aktiviteten "dealer-generisk talkedja, Paow först" | Orkestreraren och den som bygger talkedjan | Tills aktiviteten är verifierad, sedan raderas det |
| [plans/REN-START](plans/REN-START.md) | Ren start: ordning, backup och go-punkter för att radera Astrid, testrum och operatörer | Orkestreraren och Jakob | Tills ren start är utförd |
| [plans/ADMIN-KARTA](plans/ADMIN-KARTA.md), [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md), [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html) | Kablagekarta, målbild och klickbar skiss för Admin | Admin-arkitekten | Av Admin-arkitekten |

## Kvitton

Daterade bevis, skrivna en gång och lästa av status och `tools/o02-receipt.mjs`. De beskriver inte läget.

| Mönster | Innehåll |
| --- | --- |
| `<datum>-<aktivitet>-…-ACCEPTANCE.json` | Sanerade acceptanskvitton med versions-, deploy- och databasidentiteter (J08, K04–K07, O02, isolerat prov, O03-releasen) |
| `<datum>-…-REVIEW.md` | Granskningar av kvittona (K04 F3–F5, K04/K05, K06/K07, K07, O02, O03) |

Det finns ingen historikmapp. docs/history raderades 28 oktober 2026; äldre text läses ur Git.
