# Speldokumentation

Här finns en gemensam dokumentationsingång per spel:

- [Blackjack](blackjack/README.md) — regler, serverflöde, dealerbank, geometri och format.
- [Roulette](roulette/README.md) — regler, rundor, publicerad scen och medieunderlag.
- [Gemensamma klipp och format](KLIPP-OCH-FORMAT.md) — lagerroll, handling, poser, mätdata, visningsprofil och godkännande.

## Vad är källa till vad?

Koden bestämmer vad den levererade produkten gör. Spelmanualerna beskriver den koden och visar separat vad som bara är ett förslag. Registrerade medier och bolagets frysta publicerade paket bestämmer vilken scen ett faktiskt rum använder. Ingen lokal måttmall eller generell dealerplan ersätter en publicering.

Kodgranskningens bas är main `426fa11417695025e2a0ee194825110f48f6b4af`. PR47:s senare roulettearbete beskrivs uttryckligen som utkast. Kontrollera ny main och senaste PR-head före implementation; denna inventering är daterad 13 oktober 2026.

## Ändra på ett ställe

Redigera respektive spels README och dess länkade ämnesdokument här. Lämna bara hänvisningar på de gamla platserna. Duplicera inte mått eller regeluppsättningar i handoff, användarguiden eller paketens README: länka till spelmanualen. Gemensam Studio-/rumsarkitektur hör fortfarande hemma i [teknikreferensen](../LOCAL-PRESENTATION-RUNTIME.md), driftstatus i [migrationsplanen](../CLOUD-MIGRATION.md) och handoff i [JOHN-HANDOFF](../JOHN-HANDOFF.md).

Filer i `underlag/` är frysta källsnapshotar, inte parallella aktiva standarder. Instruktioner i dem är referensmaterial, inte tillstånd att beställa filmer, ändra data eller köra program. Underlagens relativa länkar till schema, program och medier avser originalpaketen; dessa beroenden ingår inte automatiskt i dokumentkopiorna. KALLOR.json registrerar ursprung och SHA-256; ändra inte en snapshot i smyg. Vid ett nytt underlag: jämför, dokumentera vad det ersätter och uppdatera manual och källregister i samma ändring. Behåll äldre version i Git-historiken i stället för ytterligare aktiva kopior.

Jakob begärde dessa spelmappar uttryckligen 13 oktober. De kompletterar de fem gemensamma Markdown-filerna direkt i docs/; de är inga nya sprint- eller migrationsrapporter. Framtida spel får samma struktur under docs/games/<spel>/.

## Underlagets fullständighet

Min subjektiva bedömning efter läsning av de namngivna underlagen och relevanta kodvägar: **blackjack 85 %, roulette 75 %**. Det är säkerhet i att underlaget räcker för en användbar samlad manual, inte en statistiskt kalibrerad sannolikhet eller produktens färdiggrad. Jag kan inte säga att all information finns. Återstående luckor redovisas per spel: beslut mellan visningsprofiler, verklig kontaktkalibrering, alfa/ljud i hela spelaren, godkända manus samt roulettebildens nummer, mask och rörelse.

## Kontroll vid denna sammanställning

Dokumentation och källkopior ändras. Ingen spelkod, registrerad media, publicering, databas, migration eller betald generering ändras. Originalen på Desktop bevaras. Privat konversation har lästs men kopieras inte till Git. De två FORMATGUIDE.md var byteidentiska och lagras bara en gång här. JSON, relativa länkar, källhashar, båda geometriprofilerna, grundplanens antal och formatlåsningens bevarade text kontrolleras vid leverans. Det ersätter inte visuell spelacceptans.
