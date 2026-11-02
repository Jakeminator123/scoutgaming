# Liten produktrepo: konsekvenser och övergång

31 oktober 2026. Beställt beslutsunderlag, inte utförd repo- eller driftflytt. Mätningar, frysta SHA:n, backup och exakta kandidater finns i [incidentrapporten](2026-10-31-repository-history.md). Rapportleveransen går via vanlig featurebranch, commit, push, PR och CI till main. En sådan dokument-PR kapar inte Git-historiken.

## Vad betyder 65 MiB?

Den lokala jämförelsen har **64,94 MiB komprimerade Git-packfiler** (68 090 037 byte, cirka 68 MB i decimalsystemet). Den innehåller en ny rotcommit med exakt samma filträd som main `bbe4c7e503c5557aaea71534185c9b79d70f79bd`. De utcheckade, spårade filerna är cirka 84,94 MiB. Installerade beroenden, byggen, Neon och Blob ingår inte i packstorleken.

Det är en uppmätt snapshot, inte en framtida storleksgaranti. Rapport-PR:n, nya agenters leveranser och nödvändiga integrationsändringar ska ingå i en **ny, färsk snapshot** före ett eventuellt byte. Den befintliga 65 MiB-artefakten får inte användas som om den innehöll senare arbete.

## Vad bevaras och vad förloras?

| Del | I den nya produktrepon | Var det gamla finns kvar |
| --- | --- | --- |
| Dagens kod, tester och spårade tillgångar | Samma filer och filrättigheter; träd-ID kontrolleras före integrationsändringar | Även i originalrepo och fullbackup |
| Tidigare commits och deras författarskap | Historiken börjar vid en ny rot; `log`, `blame`, `bisect` och `revert` kan inte följa tiden före bytet | Originalrepo och fullbackup behåller de gamla commitsen |
| Gamla brancher, taggar och releasepekare | Följer inte med automatiskt; att pusha dem kan föra in den stora historiken igen | Originalrepo och frysta refs i backup |
| PR:er, issues, kommentarer, Actions-historik och repo-inställningar | Följer inte med genom en Git-snapshot | Kvar på originalets GitHub-sida; full Git-backup innehåller inte all plattformsmetadata |
| Gamla commit-SHA:n och dokumentlänkar | Gamla SHA:n finns inte som commits i den nya repon; gamla relativlänkar till Git-historik kan bli obrukbara | Behåll hänvisning till originalrepo och ett uttryckligt käll-SHA i övergångskvittot |
| Kollegornas ej överförda utveckling | Förs inte in genom rotcommiten | Deras befintliga brancher/repon och den frysta backupen behålls |
| Lokala testutkast, `.env` och beroenden | Ingår inte automatiskt i ett nytt Git-repo | Arbetskopiorna och avsedda lokala backupfiler behålls |
| Neon, Blob och befintlig drift | Flyttas eller raderas inte av en Git-snapshot | Samma resurser tills en separat, verifierad omkoppling görs |

Filer kan alltså bevaras exakt samtidigt som historiska utvecklingsverktyg tappar sin gamla historik i den nya repon. GitHub beskriver också riskerna med gamla kloner, SHA-beroenden och PR-referenser vid historikändring. Den föreslagna vägen skapar en separat repo och lämnar originalet kvar, vilket ger en enklare återgång än att skriva över originalets historik. [GitHub: konsekvenser av historikändring](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

## Bevara Bordmall och Lounge

De två lokala worktrees som redan finns under `C:/Users/jakob/dev/worktrees/scoutgaming` ska vara kvar. De delar fortfarande Git-objektlager med `C:/Users/jakob/dev/scoutgaming/.git`; de är inte två självständiga kloner.

1. Behåll båda arbetsmapparna och originalets Git-lager på sina nuvarande platser under övergången. Skapa den nya produktcheckouten separat. Radera, byt ut eller flytta inte gamla `.git` som del av produktbytet.
2. Ta en ny snapshot av testheads, index, spårade diffar och nya arbetsfiler direkt före bytet. Lounge hade 120 ändrade/nya filer i den nu verifierade kopian; det omfattar även Admin-arbete. Tvinga inte fram en commit av allt som råkar ligga där.
3. Kontrollera hashes, heads och status efter bytet. Gör ett återställningsprov i separat temporär miljö innan originalets Git-lager någon gång avvecklas. Ignorerade resurser, lokala inställningar och startväg behöver också inventeras; dagens kopia undantar genererade beroenden/byggen och är inte en kopia av driftvärden.
4. Om testerna senare ska bli självständiga lokala repon, gör det som ett avgränsat steg efter verifierad återställning. Behåll lokal-only-gränsen och de två synliga testarbetsytorna. De behöver inte pushas till den nya produktrepon.

## Kollegor, GitLab och hur historik kommer tillbaka

En lokal commit i Kevins eller Emils egen klon påverkar inte GitHub. En push till ett separat GitLab-/GitHub-repo gör inte heller vår repo större. De kan behålla sin utvecklingshistorik separat och bidra med utvalda ändringar.

| Handling | Konsekvens för produktrepon |
| --- | --- |
| Lokal commit eller push till ett fristående repo | Ingen direkt storleksändring här |
| Lokal `fetch` från ett gammalt repo | Kan öka den lokala klonens storlek; ändrar inte i sig GitHub |
| Push av en gammal branch/tagg till produktrepon | Gör dess historik och objekt nåbara här även om branchen aldrig mergas |
| Hel merge av gammal historik eller spegling | Kan återinföra tidigare medier och tusentals objekt; en merge av orelaterade rötter ska inte användas för att förena det gamla och nya repot |
| Överföring av granskade ändringar till en ny branch från nya main | Kan ta in förbättringen utan hela gamla ancestry; även utvalda commits/patchar måste kontrolleras för stora eller pensionerade filer |
| Script med tillgång till samma Neon, Blob eller deploykonto | Kan påverka driftdata oavsett vilken Git-tjänst koden ligger på; det är en separat koppling från Git-historiken |

GitLab kan automatiskt spegla brancher, taggar och commits mellan tjänster; det är själva speglingen som skapar kopplingen. [GitLab: repository mirroring](https://docs.gitlab.com/user/project/repository/mirror/)

Repoets nuvarande policy är GitHub-only med `gitlabPaused: true`, och pushverktyget nekar GitLab. Den lokala checkouten hade endast remoten `origin` vid läsningen. Det bevisar **inte** att kollegornas egna datorer, andra GitLab-projekt eller externa automationer saknar spegling. Ingen sådan extern spegling har konstaterats eller ändrats här. En eventuell tillåtelse för ett nytt samarbetsflöde på GitLab är ett separat beslut; denna rapport ändrar inte policyn.

Det finns inget lagringsskäl att porta Kevin eller Emil som personer. En överenskommen repo-gräns och kontrollerad överföring av deras ändringar löser problemet bättre. Originalrepon förblir tillgänglig och skrivbar för deras arbete tills en avstämning visar att den kan frysas; ingen automatisk arkivering eller branchradering.

## Föreslagen övergång i ordning

1. **Frys ett aktuellt underlag.** Stäm av aktiva PR:er och kollegornas opushade arbete; skydda nya heads/utkast och kontrollera en återställningsbar kopia på annan disk eller plats. Backupen från denna utredning ligger bara på C:. Bestäm originalets fortsatta tillgänglighet, vem som äger integrationen och exakt vilken ny main som ska användas.
2. **Skapa separat Git-repo och checkout.** En ny rot från det valda main-trädet, utan gamla brancher/taggar eller mirror-push. Kontrollera träd-ID, filantal och storlek. Lämna originalet och testernas Git-lager intakta. En GitHub-överföring eller ett namnbyte av originalrepon tar inte bort dess historia.
3. **Anpassa identiteter och historikberoenden i en avgränsad ändring.** Inventera bland annat `tools/repository-policy.json` (repo och checkpointCommit), `tools/check-push-target.mjs`, `tools/merge-pr.mjs`, `tools/security-status.mjs`, GitGuardian-bindningen, GitHub-workflows, `START-HERE.md` och daterade Git-länkar i aktiva sakguider. Lägg inte tillbaka gamla objekt bara för att tillfredsställa ett gammalt checkpoint-SHA. Här måste ett nytt verifierat kontrakt ersätta det gamla.
4. **Återskapa leveranskontroller.** Repoåtkomst, main-/previewskydd, CI, miljöhemligheternas avsedda placering och GitGuardian behöver sättas upp och provas för den nya identiteten. Ingen hemlighet skrivs i rapport eller Git. Befintliga arbetssätt och huvudbranchens spel-/säkerhetskontroller ska fortsatt gälla.
5. **Prova bygg- och leveransvägen isolerat.** Kör relevanta tester och CI från ren klon; kontrollera readiness för befintliga scheman och att media fortfarande hämtas via avsedda URL:er. En identisk trädsnapshot eller grön CI är inte bevis på korrekt ny molnkoppling. En eventuell previewprovning ska följa befintlig previewpolicy och inte påverka riktiga användares data.
6. **Byt driftkoppling först efter verifiering.** Dokumentera exakt repo, branch, SHA, integrationsändringar och återgång. Vercel/Render ska bygga rätt commit; Neon/Blob ska fortsätta peka rätt. Ge aktiva agenter en entydig ny checkout och remote. Pusha inte gamla brancher eller taggar till nya repot; för över utvalda ändringar via nya PR:er.
7. **Verifiera och behåll återgången.** Kontrollera faktisk deploy, centrala produktflöden, säkerhetsmonitorering och testernas bevarande. Gamla deployartefakter och repoåtkomst behövs för återgång. Först efter avstämning med alla ägare kan originalet övervägas för arkivering; ingen automatisk gallring ingår.

Stegen ovan är förberedda för granskning, inte genomförda. Ny repoidentitet, driftomkoppling eller radering av original behöver ett konkret separat genomförandebeslut. En normal PR-merge av denna dokumentation gör inget av detta.

## Håll den nya historiken liten

- Förvara medieoriginal och modellvikter utanför Git enligt produktens lagringskontrakt. Git ska bära koden, små nödvändiga tillgångar och referenser.
- Kontrollera alla nya objekt som ska pushas, även en stor fil som lagts till och sedan raderats före PR. Enbart granskning av slutträdet upptäcker inte det fallet.
- Följ storleksökning i PR och använd serverregler där kontotypen stöder det. En lokal hook kan kringgås; CI efter push gör inte redan mottagna objekt oskrivna.
- Uppdatera befintliga sakdokument. Dessa två uttryckligt beställda incidentdokument är beslutsunderlag, inte början på en automatisk logg av varje agenttur. Om de senare ersätts följs vanlig dokumentgallring med en pekare till deras Git-version.
