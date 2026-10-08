# Branch-preview /test

Visar Paow och Dragge med koordinatbord, videobakgrund och ett stillbildsalternativ.
Det är en fristående provspelare. Import, scenredigering och redigerbar export
finns kvar i den lokala Laneverkstaden. Ingen koppling till spelsaldo, produktion
eller lokala API-nycklar ingår.

Vercels befintliga projekt **scoutgaming** bygger automatiskt branchen
**test-video-jakob**. Endast kombinationen `VERCEL_ENV=preview` och
`VERCEL_GIT_COMMIT_REF=test-video-jakob` publicerar `/test`. Produktionsbyggen,
main och andra brancher får inte rutten eller materialet. Inget nytt projekt
eller produktionsalias behövs. Vercels befintliga preview-skydd gäller.

- `site/`: granskat, versionshanterat preview-material; 720p-kopior av dealerklippen.
- `prepare.mjs`: verifierar mediehashar och kopierar till frontendens ignorerade `public/test/` vid branchbygget.
- Spelare, kompositor och koordinatberäkning kopieras från `program/web/` vid bygget.
- Original, arbetsutkast, sessionsfiler och redigeringsarkiv publiceras inte.

Uppdatera med explicit valda lokala lanes från mappen test-videoeditor:

```powershell
.\program\.venv\Scripts\python.exe tools/build_branch_preview.py lane-16d202061913 lane-aeabf3ab3ef4
node --test --test-concurrency=4 preview/prepare.test.mjs
```

Skriptet återanvänder eller skapar kontrollerade 720p-varianter. Videobakgrunden
får en separat faststart-kopia utan omkodning och med samma bildruteantal.
Vid ett nytt materialurval stoppar skriptet om gamla, oanvända media finns kvar;
de ska då granskas och tas bort uttryckligen. Granska diffen, committa och pusha
endast test-video-jakob. Kontrollera därefter att Vercels deployment för rätt
commit är READY och prova `/test` i webbläsaren.
