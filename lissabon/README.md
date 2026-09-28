# Lissabon är samlad i Lab

Startkod, standardprojekt och gränssnitt underhålls i [Lab](../lab/README.md).
Starta från reporoten med `node lab/start.mjs --offline --no-open` för ett
kostnadsfritt lokalt prov med tom testdatabas.

Den här mappen finns kvar för befintliga ignorerade privata `data/`.
De flyttas eller raderas inte. Den anslutna startaren återanvänder dem om
`data/project.json` finns; annars används `lab/data`. `Start-Lissabon.cmd` i reporoten
är ett kompatibilitetsalias. `/lissabon` går till den gemensamma studioingången.

Borttagna start-/snapshotkopior finns i Git före sammanläggningen (`f2dce6fc`).
Aktiva tester är flyttade till `lab/test/local-start.test.mjs`.
