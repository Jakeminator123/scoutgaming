# Branch-preview /test

Visar Dragge med koordinatbord, videobakgrund och ett stillbildsalternativ.
Det är en fristående provspelare. Import, scenredigering och redigerbar export
finns kvar i den lokala Laneverkstaden. Ingen koppling till spelsaldo, produktion
eller lokala API-nycklar ingår.

Grenen **test-video-jakob** raderades 8 oktober 2026; materialet här på `main` är
dess byte-identiska spegel och visas för intern personal på `/control/preview`
bakom adminsessionen. Den publika `/test`-rutten publiceras bara om en gren med
det namnet skulle återskapas (`VERCEL_ENV=preview` och
`VERCEL_GIT_COMMIT_REF=test-video-jakob`, se `prepare.mjs`). Produktionsbyggen
och andra brancher får inte rutten. Vercels befintliga preview-skydd gäller.

- `site/`: granskat, versionshanterat preview-material; 720p-kopior av dealerklippen.
- `prepare.mjs`: verifierar mediehashar och kopierar till frontendens ignorerade `public/test/` vid branchbygget.
- Spelare, kompositor och koordinatberäkning kopieras från `../compositor/` vid bygget.
- Original, arbetsutkast, sessionsfiler och redigeringsarkiv publiceras inte.

Uppdatera med explicit valda lokala lanes från packages/presentation:

```powershell
.\program\.venv\Scripts\python.exe tools/build_branch_preview.py lane-16d202061913 lane-aeabf3ab3ef4
node --test --test-concurrency=4 preview/prepare.test.mjs
```

Skriptet återanvänder eller skapar kontrollerade 720p-varianter. Videobakgrunden
får en separat faststart-kopia utan omkodning och med samma bildruteantal.
Vid ett nytt materialurval stoppar skriptet om gamla, oanvända media finns kvar;
de ska då granskas och tas bort uttryckligen. Granska diffen och leverera på
`main` som vanligt (`node tools/push-github-work.mjs`); kontrollera därefter
`/control/preview` i produktion.
