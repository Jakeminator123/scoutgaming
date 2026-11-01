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
policy- och talsteg följer sina sviter. [Urvalsproven](../../test/ci-changes.mjs)
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
| Övrig kod/config | Sökbara spårade sökvägar för Python, SQL, shell, CSS, JSON, HTML, YAML, TOML och Docker | Analyserade samband för dessa språk |

JS/TS-analysen omfattar `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`
och `.cts` under `apps/`, `packages/`, `services/`, `test/`, `tools/`, `ops/`.
Filer över 1 MB, binära och icke UTF-8-filer hoppas över och räknas.
Övrig kod/config inventeras som sökvägar utan att innehållet analyseras.
Dokument, binära tillgångar och privata mappar är inte ett kodindex.

Parsern hoppar över kommentarer, strängar, regex och mallsträngars innehåll.
Detta är avsiktligt en begränsad lexikal inventering, inte en JS-kompilator.
Beräknade imports, escapes, URL-specifikationer, JSONC/ärvda tsconfig-alias,
villkorade paketexports och mål utanför språkomfånget kan förbli olösta.
`require` kan vara ombundet lokalt. Externa/inbyggda paket räknas separat.
Frånvaro av statisk kant betyder **aldrig död kod**.

För varje ändrat ansvar: granska dess dokumenterade beteenden, följ riktiga
testkonsumenter och komplettera relevanta beteendeprov i deras befintliga svit.
Lägg inte till tester enbart för att öka kartans referensantal.

## Kontrollera en kartändring

Kör Pythonproven ovan och generera mot aktuell arbetskopia. Öppna översikt,
kodkedja, kodnät och prov/luckor; prova sök, filgranne, en riktad kant,
relationstyp, zoom/pan och Anpassa. Kontrollera läsbarhet på smal skärm.
Provsviten använder egna tillfälliga Git-repon under `.cache/system-map-tests`;
den läser ingen produktdatabas och anropar inga externa tjänster.
