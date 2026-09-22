# Croupier — kort start för Jakob och nya agenter

**Källa:** GitLab `scout-gg/croupier`, branch `jakeminator123/work` för Jakobs
arbete. [Privat GitHub-kopia](https://github.com/Jakeminator123/github-work)
finns för browser-GPT som inte når GitLab; samma commit ska finnas på båda.
Den äldre GitHub-adressen `gitlab-work` är bara en vägvisare, inte en arbetsyta.
Använd `node tools/push-work-mirrors.mjs` för godkända leveranser på Jakobs
branch. Skriptet pushar GitLab först, sedan GitHub och jämför commit-ID. Det är
en agent-/manuell standard, inte en obevakad serverregel. Pusha aldrig `main`.

**Vad är vad?** `web/` är spelet och dess serverägda kort, shoe, wallet och
Partner-API. `content/` och `assets/` innehåller dealer-media och 3D; ändra
inte godkända takes utan hela kalibrerings-/acceptansflödet. `lab/` är den
lokala studion för prov, observation och dokumentation; `open-claw/` är
Director/Gateway-kopplingen. [Labbguiden](../../lab/docs/README.md),
[aktuell sprint](../../docs/animation-events/README.md),
[sjudagarshandoffen](../../docs/animation-events/v5-8-days-mvp/HANDOFF-7-DAGAR.md)
och [systemkartan](systemkarta/README.md) ger detaljerna. Jira CAC äger status
för faktiskt utvecklings- och QA-arbete.

**Miljö och API:er:** Den privata `.env` i repots rot innehåller bl.a. lokal
Director-koppling, röst-/generationsnamn och äldre Partner-namn.
`lab/.env.local` har de tre aktuella `BETTALOTTO_PARTNER_*`-namnen för
observatören. Filerna läses inte identiskt av alla komponenter; Render har
egna Environment-inställningar. [Miljöförklararen](_env.explanation.md)
listar samtliga kontrollerade namn, ansvar och läsordning — inga värden.
Kopiera aldrig hemligheter till Git, chatt eller `NEXT_PUBLIC_*`.

**Video och indexering:** Enligt Jakob finns utöver repots media en separat
lokal mapp med MP4-material hämtat från Bettalotto för slask/mappning. Den är
inte kanonisk produktkälla och ska inte automatiskt skannas, importeras eller
raderas.
Exakt sökväg och hemliga inställningsvärden dokumenteras inte här; använd
`LAB_VIDEO_ARCHIVE` enligt miljöförklararen när ett uppdrag kräver arkivet.
`.cursorindexingignore` utesluter lokala bygg-/beroendekataloger och binära
video-, ljud-, bild- och 3D-format från semantisk indexering. Den raderar inga
filer och ändrar inte Git-spårningen; källkod och JSON-manifest finns kvar för
sökning. Öppna bara den här repomappen som workspace om du vill undvika att
indexera en yttre mapp med videor. Om Cursor fortfarande använder ett gammalt
index, starta en omindexering där efter att undantagen har laddats.

**Vid överlämning:** Kontrollera branch och aktuell Jira-issue, läs
`AGENTS.md`, ändra endast uppgiftsägda filer, kör relevanta tester, notera
utfall/luckor i `docs/JOHN-HANDOFF.md`, och verifiera båda remote-commitarna.
