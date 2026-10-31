# Selektiva presentationsförslag från Kevin och Emil

Detta är beslutsunderlag, inte en parallell införandeplan. Den fulla jämförelsen
från 28 oktober finns i `git show c0150add62fd9e4b39fd31a7e0127406ca860007:docs/plans/KEVIN-PORT.md`.
Den jämförde main `74fdb27f` med äldre kollegors commits och beskriver inte dagens
status. Läs aktuell kod före en ny beställning; inga kollegors brancher får mergas
som bieffekt av att ett beteende verkar användbart.

## Vad som redan ersätter den gamla leveranslistan

Återanslutning, väntande vid fullt bord och tangentstyrning levererades tidigare
via #502, #547 och #541. Senare har bland annat spelkontroller, nedräkning,
filmtider, flera satsningsrutor och Ångra levererats. Deras faktiska prov och
återstående acceptans finns i [körplanen](organisation/KORPLAN-v2.md) och
[överlämningen](../NEXT-AGENT.md). Den gamla tabellens K2/K4 och beroende på
layout-PR #536 ska inte behandlas som en ny order att bygga samma sak igen.

## Förslag som kräver en konkret avgränsning

| Förslag | Före eventuell implementation |
| --- | --- |
| Kodekvarianter med reserv | Mät aktuell avkodning och bytes. Varje variant behöver egen identitet och verifierad bildrute-/ljudbindning enligt [runtimeguiden](../LOCAL-PRESENTATION-RUNTIME.md). Äldre procenttal är inte dagens benchmark. |
| Tydligare resultatsammanfattning | Jämför dagens klient med det önskade beteendet; bevara serverns utfall och tidpunkten då resultat får visas. |
| Tempo per spelbord | Ett produktval. Bevara serverns tider, kortplan och exakt mediebindning; snabbare video ensam är inte korrekt speltempo. |
| Chatt och besked när talet inte fungerar | Talspåret är pausat. Ansvar, moderering, kostnad och faktisk användartext ingår i ett senare [taluppdrag](TALKEDJA.md), inte i denna städning. |

Inget förslag här är i sig ett merge- eller publiceringsmandat. När ett förslag
beställs ska dess konkreta mål och prov stå i aktuell körplan; stryk den här raden
när den inte längre behövs. Regler, pengar, samtidighet och behörighet provas som
beteenden, inte genom att låsa kollegans filnamn eller implementation.
