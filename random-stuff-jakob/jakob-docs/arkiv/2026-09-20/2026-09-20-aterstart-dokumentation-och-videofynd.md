# Återstart: dokumentation och videofynd

Kort arbetsöverlämning, 20 september 2026. Källäge: lokal HEAD `11d751a`.
Detta är en sammanfattning av arbetsläget, inte en konversationsexport.
Kontrollera senare commits och handoff innan gamla driftuppgifter används.

## Läs bara det som behövs

1. Följ aktuella `AGENTS.md`-regler och kontrollera branch/status.
2. Börja i [Jakobs index](../../README.md).
3. Läs [findings-registret](../../../../docs/findings/REGISTER.md) för buggar
   och förbättringar, eller relevant ämne i [systemkartan](../../systemkarta/README.md).
4. Läs senaste relevanta del av [JOHN-HANDOFF](../../../../docs/JOHN-HANDOFF.md)
   innan implementation. Läs inte hela arkivet för varje liten uppgift.

## Jakobs modell och dokumentationsstruktur

Mental struktur: spel → dealer → presentationsbehov → konkret situation
→ variantfamilj → kompatibel take. Det är inte ett krav på fysisk medieflytt.
Tio interna blackjack-händelser, sex Partner-presentationstyper och sexton
labbnoder är olika lager; de är inte sexton motorhändelser.

Commit `41c9a5d` arkiverade åtta rapporter och en historisk agentprompt,
bevarade det gamla indexet och uppdaterade systemkartan. De två aktiva
event-/situationsmodellerna ligger kvar på stabila sökvägar; OpenClaws
kunskapspaket refererar situationsmodellen. 359 lokala dokumentlänkar
kontrollerades. Originalens innehåll bevarades, med arkivmarkeringar och
justerade länkar.

- Bestående förklaringar: `systemkarta/`.
- Daterade rapporter: `arkiv/ÅÅÅÅ-MM-DD/`, med indexrad.
- Buggar/förbättringar/granskningsbehov: `docs/findings/`, F-001–F-007.
- Jira CAC äger implementationens och QA:s status. Arkivering löser inga fynd.

## Viktigaste öppna frågan

F-001: `PerformancePlayer.source()` kan vid samtidiga anrop med samma hash
göra dubbel fetch/hash/Blob-hantering. Ett isolerat försök med verkliga lokala
videobytes reproducerade två skapade Blob-URL:er men bara en som `dispose()`
återkallade. Två Astrid-filer hade samma hash och var 598 735 byte vardera.
Detta bevisar inte visuell dubbelbild eller uppmätt dubbel nättrafik i drift.

F-002: staged-förladdning kan konkurrera med första bilden; förbättringens
effekt behöver mätas. QA-paketering är en separat fråga, inte automatiskt
snabbare uppspelning. Redis löser inte F-001:s klientrace.

Kevin har fått [ett samlat ping](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870554825)
om A) delad pågående laddning per hash och B) första bild/förladdningsprioritet.
Jakob vill ha Kevins godkännande före ändringar i videologiken, även lokalt.
Inget sådant godkännande är verifierat här. Senaste inboxförsöket saknade
färsk API-åtkomst; cachade meddelanden är inte ett nytt besked.
Reproduktion och åtgärdsförslag finns i [videoladdningsrapporten](2026-09-20-videoladdning-och-kevin-ping.md).

## Parallellt arbete och nästa steg

Tasken OPENCLAW (id `01a0bba8-083d-7782-990f-7f44d9698c09`) har informerats
om arkivet och findings. Dess senare commits `6797b6a` och `11d751a` tillför
socialchat/variantpreview. Nyare drift- och testuppgifter finns i gemensam
handoff; tidigare systemkarta är inte en fullständig beskrivning av dessa.
Vid denna notis finns ytterligare ospårade/ändrade labbfiler från annat arbete.
Bevara dem. Läs eller committa inte privata loginnoter.

Nästa task bör välja en enda avgränsad fråga. Om det gäller F-001/F-002:
verifiera först Kevins besked; annars invänta det och välj en oberoende uppgift.
Efter godkännande ska pending-cache hantera retry, abort och dispose säkert;
följ projektets media-/spelarprov för alla fyra dealers.

Jakob vill minska tokenåtgången. Undvik ny helhetsinventering och överlappande
agentgranskningar. Ingen ny kodfix, push, deployment eller ny task beställs
automatiskt genom denna återstartsnotis.
