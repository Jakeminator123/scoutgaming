# Systemkartan: lokal Atlas

Kör från repot med Python 3.10+ och Git:

```text
python tools/system-map.py
python tools/system-map.py --strict-anchors
python -m unittest discover -s test/system-map -v
```

Öppna `.cache/system-map/index.html` i en webbläsare. Filen är fristående;
inga paket, externa typsnitt, CDN:er eller server behövs. GitHub-länkar gör
nätanrop först när du öppnar dem. Lokala länkar öppnar arbetskopian.
Utdata är privat arbetsmaterial och ska inte publiceras som produktvy.

Alternativ utdata måste ligga under repots `.cache/` och sluta med `.html`.
Exit 0 betyder att kartan skrevs utan blockerande fel; varningar kan finnas.
1 betyder att kartan skrevs med referensfel, eller ankare som behöver översyn
i läget `--strict-anchors`; 2 betyder ogiltiga indata och ingen ny karta.
Olösta automatiska referenser redovisas i kartan och är inte i sig ett exitfel.

De befintliga kontrakts- och dokumentationsjobben i CI kör Pythonproven och
generatorn i vanligt läge. Använd `--strict-anchors` vid explicit kartgranskning;
inaktuella ankare ska inte blockera vanlig CI. Ändrade ansvar eller kodankare uppdateras i samma PR som koden;
förbrukade samband tas bort. Kontrollen låser inga produkter, filnamn eller
antal samband och kräver inte att pensionerad implementation återinförs.

## Underlag och underhåll

### Från vald koppling till prov och kontroll

Välj en pil i **Kodkedjor** och öppna dess berörda filer. Filvyn visar
direkta konsumenter, beroenden och testimporter. En import från ett prov är
en sökingång; HTTP-, browser-, data- och byggvägar kan finnas utan sådan kant.
Frånvaro i kartan betyder aldrig död kod eller saknad beteendetäckning.

**Prov & kontroller** samlar befintliga provreferenser med spårade agentregler,
Git-hookar, GitHub-workflows, utvalda leveransverktyg och ignoreringsfiler.
Sök fungerar även på dessa filer. Välj fil eller pil för riktning och radbevis.
Dokumenthänvisningar och literala sökvägar märks separat från JS/TS-importer;
de bevisar inte exekvering, körordning eller fullständig kontrolltäckning.

Provregistreringar läses ur `.githooks/pre-commit-full`. Endast kända former
av `run_node_tests`, direkta `run_check … node <provfil>` och Python unittest
discover blir kommandon. Registrerade globbar matchas mot tillåtna spårade
provfiler. Ett riktat Node-kommando har samma runner men vald fil och två
testarbetare; hela svitens befintliga kommando finns separat. Filnamn ensamt
ger aldrig ett körkommando. Radbevis visar både registrering och, för Node
test-runnern, dess definition. Ett prov som kontrollerar en registrering är
ett annat bevis än registreringen själv.

Motorsvitens HTTP-prov och filer som refererar till browser-fixturen får
inga kopierbara vanliga Node-/hookkommandon: de kan annars lyckas genom att
hoppa över proven. Vyn visar det särskilda harnesskravet och återfunna
radbevis i registret, provfilen och CI. Atlas väljer inte PostgreSQL-binärer,
laddar inte ned en driver och sätter inga miljövariabler. Detta är kända
förutsättningar, ingen fullständig analys av alla möjliga skip-villkor.

Dessutom hålls kommandon tillbaka när den lexikala analysen hittar möjliga
`skip`-/`todo`-villkor i provfilen eller dess statiskt upplösta JS/TS-beroenden.
Det fångar exempelvis PostgreSQL-konfiguration, plattformskrav och opt-in i
hjälpare utan en lista över särskilda provfilnamn. Vyn visar villkorets rad,
identifierade miljövariabelnamn/plattformsläsningar och importkedjans radbevis;
inga värden läses. Kommentarer och strängar räknas inte som villkor. Urvalet
är avsiktligt försiktigt och kan kräva manuell granskning även när ett villkor
inte skulle köras. Olösta/dynamiska beroenden och godtycklig kontrollkod kan
fortfarande dölja förutsättningar; kommandoförslagen är inte komplett verifiering.
Om något registrerat prov i en svit har sådana villkor hålls även svitens
vanliga hookkommando tillbaka; andra prov kan fortfarande få riktade kommandon.

Kommandona kan markeras och kopieras. **Atlas kör inga kommandon.** Kontrollera
paketversion, beroenden och isolerad provmiljö i svitens dokumentation före
manuell körning. Ett framtida körgränssnitt behöver separat utformning för
avgränsning, miljö, behörighet och resultat; den lokala HTML-filen har ingen
sådan backend och visar inga påhittade provresultat.

Ignorevyn visar regler i filordning och respektive verktygs innebörd, inte
innehåll eller matchlistor från ignorerade filer. `.gitignore` styr normalt
oregistrerade Gitfiler, `.ignore` textsökning, `.cursorignore` Cursors AI-åtkomst
och `.dockerignore` byggkontext. Dessa är olika gränser och inga OS-behörigheter.
Personliga `.codex`-/`.claude`-inställningar, `.env`, cache och privata arkiv
inventeras inte. Det är alltså inte en karta över alla lokala agentinställningar.

### Leveranskontroller

Atlas-grafen **Leverans och verifiering** följer dessa körbara samband:

```text
CI-klassificerare → jobbmatris → svitregistret → beteendeprov
Git-event/objekt → storleksgrind
exakt PR-head + testad bas + aktuell main → mergegrind
```

[CI-klassificeraren](../ci-changes.mjs) väljer fyra befintliga ben i full scope.
Studio kör sin svit ensam; Admin och contracts kör på databasbenet.
CSS och OpenClaw-deploy behåller två ben och samma sviter som tidigare:
Studio/Admin/contracts samt access/presentation. Provfiler och upptäckt kommer
fortsatt från [svitregistret](../../.githooks/pre-commit-full); bygg-, PostgreSQL-,
policy- och talsteg följer sina sviter. [Urvalsproven](../../test/delivery/ci-changes.mjs)
kontrollerar partitionen, stegens ägare och fallback vid okända indata.
Omfördelningen är inte i sig en uppmätt tidsvinst. Jämför CI:s jobbtider och
grupptider på jämförbara körningar; lokala Git-fixturprov mäter inte denna effekt.

[Storleksgrinden](../check-repo-limits.mjs) läser Git-objekt: dokument har den
generella gränsen 1 MiB, med exakt krympande undantagslista. Push och CI granskar
även mellanliggande objekt; ett raderat stort mellanobjekt försvinner inte ur
kontrollen. Nya/växande mediebinärer och okända eventintervall stoppas fortsatt.

[Mergegrinden](../merge-pr.mjs) nekar samma ändrade fil och kod/kod i samma
paketrot när main har flyttat sedan testad bas. Den skyddar integration som
PR:ens CI ännu inte har provat. Dokument/kod kan passera först efter den
betrodda kontrollen av det kombinerade trädet, bunden till full main- och head-SHA.
Ingen ny kod/kod-lättnad har belagts: Atlas saknar fullständig upplösning av
dynamiska imports, HTTP/SQL, filinläsning och gemensamt tillstånd. Använd därför
normal uppdatering från main och ny CI vid paketöverlapp; en utebliven grafkant
är inget oberoendebevis.

### Kartans källor

- `START-HERE.md`, avsnitt Systemkarta: fyra tabellkolumner anger ansvar,
  kodingångar, drift/data och beteenden att verifiera. Uppdatera sakunderlaget
  där när kontraktet ändras. Markdownlänkar verifieras som Git-spårade sökvägar.
- `relations.json`: det obligatoriska manifestet för handgranskade kedjor, med
  `version: 1` och en `graphs`-lista. Saknad fil eller ogiltig struktur ger exit 2
  utan ny karta. Varje graf har ett unikt `id` samt `title`, `category`, `nodes` och `edges`;
  `note` är valfri text. En nod har `id`, `label`, `place`,
  `col` och `row`. En riktad kant har `id`, `source`, `target`, `kind`, `label`,
  `explanation`, `conditional` och minst ett `evidence` med `path` + `match`.
  `match` är en granskad kodrad. Generatorn söker exakt efter den med yttre
  blanksteg borttagna; en enda träff krävs. Raden flyttas automatiskt när kod
  läggs före den. Noll eller flera träffar ger **behöver översyn**, inget
  påhittat radnummer, commitlänk eller aktuellt bevis. Vanlig generering ger en
  tydlig varning och exit 0 om inga andra fel finns; `--strict-anchors` ger exit 1.
  Även beteendeneutrala citatteckensändringar kan bryta den exakta matchningen.
  Granska innebörden innan ankaret uppdateras.
  Nod- och kant-id är unika inom grafen; kanter måste peka på dess noder.
  `col` och `row` är heltal och `conditional` en boolesk flagga. Tomma eller
  saknade `evidence` godtas inte. Förbrukade samband och grafer får tas bort;
  valideringen kräver inga bestämda namn eller antal.
- `graph.py`: inventering och begränsad lexikal JS/TS-parser. Git-spårade
  filer i arbetskopian används; nya ospårade filer ingår inte. `.ignore`,
  `.gitignore`, privata mappar och symlänkar utesluts före filinnehåll läses.
  Ändrade filer markeras och får inte länkar som hävdar oförändrad HEAD.
- `controls.py`: avgränsad läsning av spårade kontrollfiler inom samma
  sekretess-/ignoregräns. Agentregler (`AGENTS.md`, `CLAUDE.md`, Copilot och
  `.cursor/rules/*.mdc`), `.githooks`, GitHub YAML och uttryckligen angivna
  leveransverktyg analyseras för literala sökvägar. Samma underlag tillåter
  handgranskade exakta ankare direkt i YAML och hookar. Ignorefiler exporterar
  sina regler, övriga kontrollfiler bara sökväg/rad, aldrig källtextutdrag.
- `template.html`, `style.css`, `app.js`: lokal vy. All data bäddas in med
  säker JSON-kodning; godtyckliga källtextutdrag och olösta uttryck exporteras
  inte. UI-text från dokument/manifest ska alltid vara escaped/textContent.

Granska `relations.json` som kod: lägg inga nycklar, användarvärden eller
privata strängar i `match`. Manifestet lagras i Git. Ursprungliga samband
kommer från den tidigare lokala sambandskartan, men dess gamla SHA och
radnummer återanvänds inte som aktuella bevis.

## Omfång och bevisnivåer

| Underlag | Vad kartan visar | Vad det inte bevisar |
| --- | --- | --- |
| Ansvarstabell | Ansvar/kontrakt → kodingångar och dokumenterade provkrav | Att prov körts eller att alla krav har prov |
| Handgranskat samband | Import, anrop, HTTP/WS eller data med återfunna kodankare | Att anropet verkligen körs, aktuell flagga eller driftacceptans |
| Automatisk JS/TS-referens | Import/export-from, literal `import()` och `require()` → fil | Full AST, bindning, transitive anrop, runtime- eller testtäckning |
| Testområde | En test-/stödfil importerar en fil; `fixtures`/`helpers` märks stöd | Ett relevant beteendeprov, körbar testfil eller godkänt provresultat |
| Kontrollreferens | Literal sökväg/dokumentlänk i utvald kontrollfil med fil/rad | Full shell-/YAML-semantik, aktiva GitHub-inställningar eller genomförd kontroll |
| Provregistrering | Spårad provfil matchar känd registrering och runner i befintligt svitregister | Att provmiljön är redo, provet körts eller beteendet täcks |
| Övrig kod/config och filtrerade importmål | Spårade sökvägar, bortvalsorsak och inkommande import från analyserad JS/TS | Lästa bytes, analyserade utgående samband eller runtimeanvändning för målfilen |

JS/TS-analysen omfattar `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`
och `.cts` under `apps/`, `packages/`, `services/`, `test/`, `tools/`, `ops/`.
Filer över 1 MB, binära och icke UTF-8-filer hoppas över och räknas.
Övrig kod/config inventeras som sökvägar utan att innehållet analyseras.
`.ignore` filtrerar innehållsanalys, inte spårad existens: ett importerat
JSON-manifest kan visas som nod med inkommande kant och bortvalsorsak utan
att dess bytes läses. Samma innehållsfilter gäller alias-/paketkonfiguration
och kontrollfiler. Git-ignorerade filer, privata mappar, ospårade filer och
symlänkar undantas fortsatt från kartan. Binära importmål kan visas med
enbart spårad sökväg. GEMINI och Windsurfs spårade regler ingår i Agentregler;
det bevisar inte att en viss agentsession faktiskt har läst dem.

Parsern hoppar över kommentarer, strängar, regex och mallsträngars innehåll.
Detta är avsiktligt en begränsad lexikal inventering, inte en JS-kompilator.
Beräknade imports, escapes, URL-specifikationer, JSONC/ärvda tsconfig-alias,
villkorade paketexports och mål utanför den tillåtna inventeringen kan förbli olösta.
`require` kan vara ombundet lokalt. Externa/inbyggda paket räknas separat.
Frånvaro av statisk kant betyder **aldrig död kod**.

För varje ändrat ansvar: granska dess dokumenterade beteenden, följ riktiga
testkonsumenter och komplettera relevanta beteendeprov i deras befintliga svit.
Lägg inte till tester enbart för att öka kartans referensantal.

## Kontrollera en kartändring

Kör Pythonproven ovan och generera mot aktuell arbetskopia. Öppna översikt,
kodkedja, kodnät och prov/kontroller; prova sök, filgranne, en riktad kant,
relationstyp, zoom/pan och Anpassa. Kontrollera läsbarhet på smal skärm.
Kontrollera även att SVG-ytan fyller kartans behållare: en sida utan
horisontellt överflöde kan ändå få fel zoom om själva ritytan är för låg.
Provsviten använder egna tillfälliga Git-repon under `.cache/system-map-tests`;
den läser ingen produktdatabas och anropar inga externa tjänster.
