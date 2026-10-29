# Dokument

En rad per dokument: vad det är, för vem och när det uppdateras. Ingången är [START-HERE](../START-HERE.md) och reglerna står i [AGENTS](../AGENTS.md). Ett nytt dokument får en rad här i samma PR; ett dokument som ingen levande text eller kod pekar på raderas i stället för att arkiveras, med en rad i [HISTORIK](HISTORIK.md) som säger vad det var och var det läses i Git.

Gränser (`tools/check-repo-limits.mjs`): inget dokument under `docs/` över 100 kB och [NEXT-AGENT](NEXT-AGENT.md) högst 150 rader.

## Läge och status

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [NEXT-AGENT](NEXT-AGENT.md) | Aktuellt läge, återstående arbete, kända fällor | Agent som börjar kallt | Vid varje överlämning (status-PR:n) |
| [migrering/STATUS](../migrering/STATUS.md) och [MASTERPLAN](../migrering/MASTERPLAN.md) | Aktivitetsstatus (genererad från `status.json`) och plan; migreringen är klar (20/20), MASTERPLAN pekar framåt under "Efter O03" | Alla | När en aktivitet ändrar status |
| [HISTORIK](HISTORIK.md) | En rad per raderat dokument: vad det var och var det läses i Git | Den som letar efter ett gammalt kvitto, en granskning eller en plan | I samma PR som ett dokument raderas |

## Drift och miljö

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [CLOUD-MIGRATION](CLOUD-MIGRATION.md) | Ytor, datalagring, väg från merge till produktion, deploykontroll | Den som levererar | När driftvägen ändras |
| [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) | Backup, restore, Node-versioner, renklonprov | Den som återställer eller provar | När backup- eller restorevägen ändras |
| [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) och [environment-variables.json](environment-variables.json) | Alla miljövariabler per tjänst, aldrig värden; JSON:en läses av `tools/check-environment-variables.mjs` | Alla som rör env | I samma PR som variabeln ändras |
| [2026-10-29-ENV-INVENTORY](2026-10-29-ENV-INVENTORY.md) | Inventering 29 oktober av alla variabler i drift mot koden: rester, saknade namn, Neon-identiteter och förslag till borttagning (ersatte 28 oktobers) | Den som städar env | Daterad, ändras inte |
| [storage/BLOB-NEON](storage/BLOB-NEON.md) | Klipp i Neon och Blob: sökvägar, import, radering | Den som rör media | När lagringskontraktet ändras |
| [ops/cloud/RENDER-V3](../ops/cloud/RENDER-V3.md), [README](../ops/cloud/README.md), [CONTAINER-CONTEXT](../ops/cloud/CONTAINER-CONTEXT.md) | Spelmotorn på Render: tjänst, deploy, återgång, byggkontext | Den som deployar motorn | När tjänsten eller imagen ändras |

## Produkt och kontrakt

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [apps/studio/docs/README](../apps/studio/docs/README.md) | Användarguide för Admin (länkas från Admins hjälp) | Admin-användare | När ett arbetssteg i Admin ändras |
| [apps/studio/docs/TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md) | Bred beskrivning av vad orden betyder; referens, inte tvingande ordlista (länkas från Admins hjälp) | Den som är ny i produkten | När ett ord byter betydelse i produkten |
| [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md) | Tekniskt kontrakt för lagring, frysning och uppspelning av dealermedia | Den som rör presentation | När kontraktet i koden ändras |
| [games/](games/README.md) | Blackjack, roulette, klipp och format, Partner-API v1 | Den som rör spel eller integration | När regler, format eller API ändras |
| [AI/](AI/README.md) och [AI/openclaw/](AI/openclaw/README.md) | Vem anropar vilken modell, OpenClaw-källor, produkttal, Director- och Gateway-drift, dashboard, Astrids labbchatt (avvecklas) | Den som rör tal eller OpenClaw | När Director, Gateway eller modellflöden ändras |

## Planer

| Dokument | Vad | För vem | Uppdateras |
| --- | --- | --- | --- |
| [plans/O02-PLAN](plans/O02-PLAN.md) och [O02-RESTORE-REPLAY](plans/O02-RESTORE-REPLAY.md) | Frysning, restore och replay inför O02 (klar); kvar bara för att `tools/o02-*.mjs` och `test/o02-*.mjs` pekar på dem | Ingen aktiv läsare | Raderas tillsammans med `tools/o02-*.mjs` i en kod-PR |
| [plans/NYCKEL-BOLAG](plans/NYCKEL-BOLAG.md) | Nyckel → bolag: `api_keys.operator_id`, migrering 012, motorns kontroll, prov och PR-sekvens | Orkestreraren och den som bygger bindningen | Tills bindningen är verifierad i drift, sedan raderas det |
| [plans/PAOW-LIPSYNC](plans/PAOW-LIPSYNC.md) | Paow: verifierat läge för röst, bank och RunPod, proven 28 oktober, varför inget aktiveras före O03, aktiviteten "dealer-generisk talkedja, Paow först" | Orkestreraren och den som bygger talkedjan | Tills aktiviteten är verifierad, sedan raderas det |
| [plans/TALKEDJA](plans/TALKEDJA.md) | Genomförandeplan för den dealer-generiska talkedjan, Paow först: hinder med fil och rad, PR-sekvens T1–T8, Jakobs beslut, vad som raderas | Orkestreraren och den som bygger talkedjan | Per PR i sekvensen, raderas när kedjan är verifierad |
| [plans/KEVIN-PORT](plans/KEVIN-PORT.md) | Selektiv överföring av Kevins och Emils presentationsförbättringar: läget för P1–P14, kandidater med fil och rad, PR-ordning, vad som inte tas, Jakobs beslut | Orkestreraren och den som bygger varje PR | Per PR i ordningen, raderas när den sista är verifierad |
| [plans/REN-START](plans/REN-START.md) | Ren start: ordning, backup och go-punkter för att radera Astrid, testrum och operatörer | Orkestreraren och Jakob | Tills ren start är utförd |
| [plans/ADMIN-KARTA](plans/ADMIN-KARTA.md), [ADMIN-FORENKLING](plans/ADMIN-FORENKLING.md), [ADMIN-MALBILD-PROTOTYP.html](plans/ADMIN-MALBILD-PROTOTYP.html) | Kablagekarta, målbild och klickbar skiss för Admin | Admin-arkitekten | Av Admin-arkitekten |

## Kvitton

Daterade bevis (`<datum>-<aktivitet>-…-ACCEPTANCE.json`), skrivna en gång. De beskriver inte läget. När aktiviteten är verifierad raderas kvittot med en rad i [HISTORIK](HISTORIK.md). Kvar i `docs/` är bara de som `tools/o02-receipt.mjs` och `test/o02-receipt.mjs` läser: J08, isolerat prov, K04 staging, K04 omprov 6, K06 omprov 1–2 och K07 omprov 1–2. De raderas tillsammans med O02-verktygen.

Det finns ingen historikmapp. docs/history raderades 28 oktober 2026; äldre text läses ur Git ([HISTORIK](HISTORIK.md)).
