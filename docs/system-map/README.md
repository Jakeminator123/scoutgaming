# Systemöversikt och kartans begränsningar

Produktens riktning är **Admin → Neon-register → Blob-medier**, med
spelmotorn på Render och webb/Admin på Vercel. Leverans sker via PR till
`main`, därefter production. En PR-preview är ett granskningssteg.
Aktuellt leveransläge finns överst i [JOHN-HANDOFF](../JOHN-HANDOFF.md) och
[CLOUD-MIGRATION](../CLOUD-MIGRATION.md); en målbild är inte driftbevis.

- `/admin` är intern administration, `/partner` operatörens portal och
  `/lobby` spelarens ingång. Spelmotor, behörigheter och rumspublicering
  har egna kontrakt även när gränssnitten förenklas.
- Neon äger produktens register, inklusive mediekatalog och sparad
  replikmetadata. Blob lagrar mediefiler. Lokala authoringfiler, importer
  och isolerade testfixtures är inte parallella produktregister.
- Astrid behålls som märkt legacyreferens utan trelagersversion. Dragan
  är ordinarie dealer. Astrids fungerande tal-/OpenClaw-flöden kan vara
  referenser utan att lokala register eller gamla editorer måste bevaras.
- `lab/lib` innehåller aktiva delade tjänster. Katalogens namn avgör inte
  vilka implementationer som ska behållas eller tas bort.

## Den äldre maskinella kartan

[HTML-kartan](index.html) och JSON-filerna i denna mapp är daterade
inventeringsunderlag. De kan innehålla äldre implementationer, sökvägar och
testkopplingar. De är **inte produktkrav, agentinstruktioner eller en lista
över saker som måste bevaras**. Använd dem endast för en avgränsad fråga och
kontrollera relevanta uppgifter mot aktuell kod. Gamla baslinjehashar ska
inte styra vilka sidor eller tester produkten behöver.

Automatisk kartcapture, reporter, verifiering, generering och uppladdning
är pensionerade från produktens CI och fullhook. Även kartverktygens två
egna testfiler körs endast på uttrycklig begäran. CI kör det verkliga
SQL-/omstarts-/HTTPS-provet direkt med `tools/studio-isolated-qa.mjs`;
dess fel och eget skydd mot ändrade källor är fortsatt blockerande.
Kartans grön/gul/röd-status bevisar inte produktionsdrift, visuell
medieacceptans eller läppsynk. Försvunnen evidens är okänd täckning, inte
ett godkänt prov.

Den återstående katalogen och dess verktyg kan slimmas eller avvecklas
efter kontroll av anropare. Inga tester ska behållas enbart för att en
historisk kartpost nämner dem. Behåll relevant verifiering av pengar,
spelregler, behörigheter, rumsisolering, register och medieidentitet.

Vid uttrycklig kartgranskning finns läskommandot
`node docs/system-map/verify.mjs --check --ref HEAD`. Vanligt produktarbete
behöver inte läsa hela katalogen eller den genererade HTML-filen.
Vid underhåll av själva kartverktyget körs dess tester separat:
`node --test --test-concurrency=4 test/system-map.mjs test/system-map-verify.mjs`.

## Regressionens tider

`sh .githooks/pre-commit --full` kör samma åtta sviter som de separata
CI-stegen. En svit kan reproduceras med exempelvis
`sh .githooks/pre-commit-full database`. Tillåtna namn är `studio`, `admin`,
`contracts`, `database`, `presentation`, `access`, `speech` och `gameplay`.
Inom varje svit visar loggen gruppnamn, starttid, förfluten tid var 30:e
sekund och slutstatus med millisekunder. Gruppnamnet utgår från första
testfilen; kommandoraden i fullhook visar samtliga ingående filer.

Varje testomgång använder högst fyra workers och har normalt 180 sekunders
tidsgräns; Studio-testomgången har 240 sekunder och isolerad SQL/HTTPS
360 sekunder. Timeout ger felkod 124 och avslutar enbart gruppens egna
underprocesser. Sviten stoppar vid fel; nästa CI-svit körs ändå om körningen
inte har avbrutits. Varje fel gör `dealer-regression` och slutgrinden röda.
Den övergripande jobbtidsgränsen är fortsatt 30 minuter.

Actions-sammanfattningen visar gruppresultat och tider. Artefakten
`dealer-regression-timing-<sha>` innehåller JSONL med start- och slutposter;
en start utan slutpost visar vilken grupp som kördes vid ett hårt avbrott.
De äldre kartartefakterna skapas inte längre automatiskt.
