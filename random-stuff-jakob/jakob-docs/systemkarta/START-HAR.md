# Croupier — kort start för Jakob och nya agenter

Aktiv startpunkt, samlad i systemkartan den 25 september 2026.

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
Director/Gateway-kopplingen. [Labbguiden](../../../lab/docs/README.md),
[aktuell sprint](../../../docs/animation-events/README.md),
[sjudagarshandoffen](../../../docs/animation-events/v5-7-days-mvp/HANDOFF-7-DAGAR.md)
och [systemkartan](README.md) ger detaljerna. Jira CAC äger status
för faktiskt utvecklings- och QA-arbete.

**Labbflödet:** På Händelseloggen väljer du **Anslut** och spelar i fliken
som öppnas. Labbet följer publika instruktioner och visar sin presentation
bredvid originalbilden; webbläsaren kräver eget flikval för bilden.
**Diagnostik** samlar videokarta och import/export. `/` är originalspelet;
`/v2/` är Kevins alternativa rendering med samma motor. BO är materialverktyget.
Backup före Kevin är taggen `backup/jakob-work-pre-kevin-20260922` (`6fe7c82`);
den skyddar committad kod, inte lokala data. Lokal integration är inte deploy.
[Livejämförelsens status och kvarstående prov](06-arbetssatt-och-verifiering/LIVEJAMFORELSE.md)
skiljer testad lokal kod från drift och faktisk bild-/speltrafik.

**Miljö och API:er:** Den privata `.env` i repots rot innehåller bl.a. lokal
Director-koppling, röst-/generationsnamn och äldre Partner-namn.
`lab/.env.local` har de tre aktuella `BETTALOTTO_PARTNER_*`-namnen för
observatören. Filerna läses inte identiskt av alla komponenter; Render har
egna Environment-inställningar. [Miljöförklararen](05-openclaw-rost-och-drift/MILJO-OCH-API.md)
listar samtliga kontrollerade namn, ansvar och läsordning — inga värden.
Kopiera aldrig hemligheter till Git, chatt eller `NEXT_PUBLIC_*`.

**Video och indexering:** Enligt Jakob finns utöver repots media en separat
lokal mapp med MP4-material hämtat från Bettalotto för slask/mappning. Den är
inte kanonisk produktkälla och ska inte automatiskt skannas, importeras eller
raderas.
Ett konkret generationsarkiv är nu verifierat genom ID-/storleksmetadata:
`C:/Users/jakem/CroupierAssets/bettalotto-generations` (224 poster). Det är
labbets befintliga förval och inte det pensionerade personarkivet; om det
är samma slaskmapp är inte belagt. `LAB_VIDEO_ARCHIVE` väljer annan plats.
Hemliga inställningsvärden dokumenteras inte här.
`.cursorindexingignore` utesluter lokala bygg-/beroendekataloger och binära
video-, ljud-, bild- och 3D-format från semantisk indexering. Den raderar inga
filer och ändrar inte Git-spårningen; källkod och JSON-manifest finns kvar för
sökning. Öppna bara den här repomappen som workspace om du vill undvika att
indexera en yttre mapp med videor. Om Cursor fortfarande använder ett gammalt
index, starta en omindexering där efter att undantagen har laddats.

**Vid överlämning:** Kontrollera branch och aktuell Jira-issue, läs
`AGENTS.md`, ändra endast uppgiftsägda filer, kör relevanta tester, notera
utfall/luckor i `docs/JOHN-HANDOFF.md`, och verifiera båda remote-commitarna.
Uppdatera rätt ämnessida enligt [dokumentordningen](06-arbetssatt-och-verifiering/DOKUMENTORDNING.md)
i stället för att lägga nya fristående rapporter i `jakob-docs/`.
