# Systemkartan: lokal Atlas

Kör från repot med Python 3.10+ och Git:

```text
python tools/system-map.py
python -m unittest discover -s test/system-map -v
```

Öppna `.cache/system-map/index.html` i en webbläsare. Filen är fristående;
inga paket, externa typsnitt, CDN:er eller server behövs. GitHub-länkar gör
nätanrop först när du öppnar dem. Lokala länkar öppnar arbetskopian.
Utdata är privat arbetsmaterial och ska inte publiceras som produktvy.

Alternativ utdata måste ligga under repots `.cache/` och sluta med `.html`.
Exit 0 betyder att referenser och handgranskade kodankare kunde kontrolleras;
1 betyder att kartan skrevs med fel; 2 betyder ogiltiga indata och ingen ny karta.
Olösta automatiska referenser redovisas i kartan och är inte i sig ett exitfel.

## Underlag och underhåll

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
  påhittat radnummer och exit 1. Granska innebörden innan ankaret uppdateras.
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
