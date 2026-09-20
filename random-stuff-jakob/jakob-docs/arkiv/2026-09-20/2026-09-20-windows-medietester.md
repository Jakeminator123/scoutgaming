> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# Windows-testerna är reparerade

De 11 rapporterade testfelen reproducerades. Sökvägarna använder nu
`fileURLToPath`, rapporttestet använder befintlig Git Bash utan WSL, och
cue-auditen hanterar CRLF/LF i minnet. Originalmedia och baseline är orörda.

FFmpeg/ffprobe 9.0.1 och jq 1.8.2 installerades användarlokalt från officiellt
länkade källor; checksummor och jq:s PGP-signatur verifierades. Bara användarens
PATH utökades. En redan öppen IDE kan behöva startas om för att ärva den.

Alla 12 pre-commit-kommandon passerar: 113/113 Node-tester. Även djupa
dealer-auditen, labbets 69/69 och OpenClaw-labbets 62/62 passerar, utan
överhoppade tester. Ingen push eller driftsättning ingår.

[Full rapport med exakta kommandon, resultat och installationsuppgifter](../../../../docs/WINDOWS-MEDIA-TESTS.md).
Inget CAC-id/Jira-anslutning fanns tillgängligt; inga ärendestatusar ändrades.
Befintliga brister i läppsynk och saknade repliker är inte lösta av denna testfix.
