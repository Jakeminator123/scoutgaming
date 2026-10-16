# Scoutgaming: ord i produkten

Denna ordlista gör gränssnittets namn begripliga. Den kräver inte att gamla
sidor, mappnamn, register eller tester bevaras. Aktuell kod och verifierad
drift beskrivs i [runtime-referensen](../../docs/LOCAL-PRESENTATION-RUNTIME.md);
leveransläget finns i [handoffen](../../docs/JOHN-HANDOFF.md). Användarens
aktuella produktbeslut gäller framför äldre beskrivningar.

## Ägarskap och spelarens val

| Ord | Betydelse |
| --- | --- |
| Bolag / operatör | Organisationen som äger sitt spelutbud och sina rum. Scoutgaming driver tjänsten. |
| Spel | Exempelvis Blackjack eller Roulette, med tillåtna och kompatibla rum, dealers och bord. |
| Rum | Ett bolagsägt val med eget ID och en bakgrund. Samma bakgrundsfil kan användas i flera rum utan att identiteter eller behörigheter slås ihop. |
| Bakgrund | Scenens bakersta bild- eller videolager. |
| Dealer | Registrerad person med egna klipp. En annan bakgrund eller klippkategori skapar ingen ny dealer. |
| Bord | Scenens separata förgrundslager med spelets geometri. |
| Sammansättning | Teknisk konfiguration för scenens lager, placering och kompatibilitet. Visa den när inställningarna behövs; den är ingen extra produktnivå. |

Normal scen är **bakgrund → dealer → bord → spelets kort och kontroller**.
Spelaren väljer bland rummets tillåtna dealers och bord; giltiga förval
behövs också. En gemensam mall kan påverka flera rums utkast. Ett valt rum
i gränssnittet gör inte en malländring rumsspecifik. Rumsval måste sparas
med serverkontrollerat ägarskap, behörighet och revisionsskydd.

**Astrid är legacyreferens utan trelagersversion.** Hennes fungerande tal-
och OpenClaw-flöden kan användas som referens. Fullbildsmaterial med inbakat
bord eller bakgrund får inte beskrivas som frilagda lager. Dragan är den
ordinarie dealern. Referensrollen kräver inga parallella lokala register.

## Ytor och lagring

`/admin` är intern administration, `/partner` bolagets portal och `/lobby`
spelarens ingång. Nya funktioner och instruktioner utgår från dessa ytor.
Kvarvarande äldre adresser är kompatibilitet, inte krav på dubblerade menyer.
`lab/` är källkod och `/studio` teknisk basePath, inte ytterligare produkter.

Neon är produktens register; Blob innehåller mediefilerna. Lokal authoring
och isolerade testfixtures uppdaterar inte produkten automatiskt. Exakt
import- och leveransstatus ska verifieras i den aktuella handoffen.

Äldre fält som `lane`, `gameLaneId`, `presentationLaneId` och `dealerSets`
är tekniska lagringsnamn. De skapar inga nya personer, rum eller produktnivåer.
Nya texter använder ordet för vad kontrollen faktiskt ändrar. ID-byten kräver
att referenser och sparade data hanteras; de görs inte som kosmetiska namnbyten.

Arkivering visar påverkan och lossar aktiva kopplingar. Återställning öppnar
inte automatiskt rum eller publicerar material. Permanent radering hanterar
beroenden och användarens beslut separat från vanlig arkivering.

Filformat, medieacceptans och tekniska gränser hör hemma i
[runtime-referensen](../../docs/LOCAL-PRESENTATION-RUNTIME.md), användarsteg i
[guiden](README.md) och assistenternas funktion i [AI-dokumentationen](../../docs/AI/README.md).
