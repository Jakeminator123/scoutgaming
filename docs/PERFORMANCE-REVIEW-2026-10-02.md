# Väntetider och städning — 2 oktober 2026

Jakob bad om en kontroll av långsamt projektarbete och ville samla fortsatt
arbete på `main`. Kontrollen skiljer uppmätta väntetider från möjliga orsaker.
Inga gameplay-, media-, databas-, GPU-budget- eller testskydd ändrades.

## Uppmätt på den lokala datorn

| Kontroll | Resultat | Betydelse |
| --- | --- | --- |
| RAM | 63,9 GiB totalt, cirka 46,3 GiB ledigt | Ingen uppmätt minnesbrist |
| CPU | 0–14 % i korta stickprov | Ingen uppmätt varaktig CPU-mättnad |
| Disk | Ingen kö i stickproven, cirka 136 GiB ledigt på C: | Ingen uppmätt lagringsflaskhals |
| Git-status | 84–124 ms | Den aktuella arbetskopian svarar snabbt |
| Lokal produkt-/labserver | Ingen sådan process eller lyssnande Node-port | Ingen kvarglömd lokal produktserver identifierades |
| Chrome | 10 flikar vid första inventeringen, senare 7; cirka 4,1 GiB sammanlagd working set vid första mätningen | Processantal är inte flikantal; ingen konstaterad RAM-flaskhals |

Detta är korta stickprov och utesluter inte tillfälliga toppar eller ett
problem i en enskild app/flik. Codex stödtjänster identifierades som MCP,
browserkontroll och JavaScript-runtime; de ska inte förväxlas med produktservrar.

## Verifierade väntetider i agentarbetet

Den avslutade lokala chattens senaste leverans innehöll ett webbläsaranrop på
173,8 sekunder samt två commitkommandon på 74,2 och 66,2 sekunder. Det senare
commitkommandot ändrade bara `docs/JOHN-HANDOFF.md` men körde samma fulla hook.
Detta visar konkreta väntetider, inte hela förklaringen till chattens arbetstid.

En separat mätning av alla 32 kommandon i `.githooks/pre-commit`, i samma
ordning och med normal felhantering, tog 68,55 sekunder. Samtliga kommandon
passerade: 656 TAP-tester godkända, 0 fel, 1 plattformsskip, samt scriptaudits.

| Långsammaste kontrollgrupp | Sekunder |
| --- | ---: |
| `local-session.test.mjs` och `local-connection.test.mjs` | 21,25 |
| Agent-talk, backup, signup/auth, blackjack entry och preview build | 7,89 |
| Lokal jämförelsefixture och generation-media | 5,47 |
| OpenClaw-/produktchattkontrakt, HTTP, speech package/pose och chat response | 3,91 |
| Dealerrytm, smooth60, reach, scene join och ready motion | 3,61 |
| Dealer collection | 3,31 |

Detaljerade lokala mätkvitton ligger privat i Windows TEMP:
`croupier-performance-hook-20261002.json` och motsvarande `.log`.

Den första commitkontrollen i detta uppdrag avbröts dessutom av `EPERM` vid
öppning av en syntetisk `agent-talk`-låsfil i Windows TEMP. Tre efterföljande
separata körningar av samma samordningstest passerade. Felet är intermittent
och bör följas upp; det är inte ett fel i branchbytet. Den befintliga
låsimplementationen väntar vid `EEXIST` men släpper igenom `EPERM` som fel.

## Rekommenderad prioritering

1. **Minska upprepningen av full regression vid rena dokumentationsändringar.**
   Utforma en kort dokumentationskontroll, samtidigt som full regression
   bevaras för kod/media och i CI. En lokal ändring av testurvalet behöver egen
   verifiering; ingen hook har kortats eller stängts av i denna leverans.
   Samla färdig dokumentation och kod i samma leverans när det passar.
2. **Undvik webbläsaranrop som kan vänta i flera minuter.** Använd tjänsternas
   API/CLI för konfiguration och status, och ett avgränsat browserprov för det
   visuella resultatet. Mät återkommande långa anrop innan större felsökning.
3. **Stabilisera låsfilstestet på Windows.** Undersök den observerade
   `EPERM`-situationen med samtidig skrivning och bevara det exklusiva låset.
   Tillfälliga filsystemfel bör hanteras avgränsat, inte genom att stänga av
   samordningen eller automatiskt radera någon annans lås.
4. **Håll aktuell handoff kort och läs historik riktat.** `JOHN-HANDOFF.md`
   innehöll 6 920 rader och cirka 589 KiB. Upprepade fulla läsningar ger
   onödig textmängd för agenten. En separat historikdel är ett möjligt senare
   dokumentationsarbete; historiken har inte raderats här.
5. **Fortsätt återanvända produkt- och labbflikar.** Stäng avslutade agenters
   tillfälliga QA-flikar när deras resultat är sparat. Inga användarflikar eller
   andra chattars browserflikar har stängts av denna kontroll.
6. **Behandla startsidans darr/flimmer separat.** Den tidigare livekontrollen
   pekade ut perspektivgolv, parallax och videokortets jolt som möjliga orsaker.
   Att dämpa golvrörelsen är en rimlig första visuell jämförelse, men någon
   sådan produktändring ingår inte i detta uppdrag.

## Vad som har städats och vad som bör bevaras

Alla gamla brancher var redan förfäder till `64c903ab`:
`codex/inbox-routing-cache`, `codex/skapa-del-bilder`, `jakeminator123/work`
och `jakemanator123-github-work`. De lokala brancherna är borttagna.
På GitHub ersattes standardbranchen med `main` och den återstående gamla
`jakeminator123/work`-branchen raderades. Endast `main` finns kvar.

Den gamla `inbox-publish`-arbetskopian från 19 september saknade ändrade,
ospårade och ignorerade filer. Den togs bort med vanlig `git worktree remove`
efter verifiering av exakt sökväg och gemensamt Git-repo. En arbetskopia återstår.
Hela commithistoriken och befintliga återställningstaggar finns kvar.

En aktiv Cursor-regel som fortfarande beskrev GitLab-mirroring är rättad till
GitHub-only och `main`. Agentinstruktioner, pushpolicy, chefexempel, CI och den
manuella GPU-publiceringsgrinden använder också `main`. Den pausade
wiki-helperns historiska GitLab-mål lämnas vilande.

Vercel-projektet `croupier-frontend` har verifierad produktionsbranch `main`.
Render-tjänsterna `croupier-v2`, `croupier-lab-openclaw`,
`croupier-lab-director` och `croupier-vercel-preview-qa` följer `main`.
Deras tidigare autodeployläge är bevarat: `checksPass` för produkten och
`off` för de andra tre. Ingen manuell Render-deploy eller GPU-start begärdes.

Byggcachearna `.next` var sammanlagt cirka 0,75 GiB och de två inventerade
`node_modules` cirka 0,75 GiB. Att radera dem är inte en motiverad lösning på
de uppmätta väntetiderna och skulle kräva nya byggen/installationer. Originalmedia,
kalibrering, sparade profiler, SQLite-data och Git-historik ska bevaras.

Branchstädningen förenklar valet av arbetsyta. De tydliga väntetiderna att
prioritera är upprepade kontroller och långsamma verktygsanrop.
