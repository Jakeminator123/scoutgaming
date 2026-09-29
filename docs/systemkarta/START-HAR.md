# Croupier — kort start för Jakob och nya agenter

Aktiv startpunkt, samlad i systemkartan den 25 september 2026.

**Aktuell källa:** privata [GitHub-repot `Jakeminator123/github-work`](https://github.com/Jakeminator123/github-work),
branch `jakemanator123-github-work`. Läs [migrationsreglerna](../GITHUB-MIGRATION.md)
och `AGENTS.md` före ändringar. Leverera med `node tools/push-github-work.mjs`;
GitLab-inbox, wiki och spegling är pausade. Pusha aldrig `main`.

**Vad är vad?** `web/` är spelet och dess serverägda kort, shoe, wallet och
Partner-API. `content/` och `assets/` innehåller dealer-media och 3D; ändra
inte godkända takes utan hela kalibrerings-/acceptansflödet. `lab/` är den
gemensamma studion för molndrift, lokala prov och dokumentation; `open-claw/` är
Director/Gateway-kopplingen. [Labbguiden](../../lab/docs/README.md),
[aktuell sprint](../animation-events/README.md),
[sjudagarshandoffen](../animation-events/v5-7-days-mvp/HANDOFF-7-DAGAR.md)
och [systemkartan](README.md) ger detaljerna. Jira CAC äger status
för faktiskt utvecklings- och QA-arbete.

**Studioflödet:** Öppna [Astrid Studio](https://croupier-v2.onrender.com/studio)
och välj **Öppna spelet**, eller **Anslut & följ spelet** om du också vill
följa händelserna i Studio. Spela och chatta i spelfliken. Studio sparar
klippval; observation kräver konfigurerad Partner-anslutning. Astrid använder en
spelare. För avancerade jämförelser och övriga dealers finns **Avancerat labb**.
**Diagnostik** samlar anslutning och observationsfiler. BO är administration
och inloggning. [Väg- och strömkartan](04-studio-json-och-lagring/STUDIO-ROUTING.md)
förklarar kanoniska adresser och äldre kompatibilitetsvägar.
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

**Video och indexering:** Den aktuella labbkällan för Emils Astrid-material är
`emil/dealklipp-v1/` i repot. Manifestet anger aktuella MP4-filer och exakta
familjer: deal, repliker och idle. Se [bankernas aktuella gräns](../../emil/README.md).
Det tidigare externa
`C:/Users/jakem/CroupierAssets/bettalotto-generations` användes som daterat
inventeringsunderlag men dess MP4-filer flyttades till Windows papperskorg den
25 september; sökvägen är inte längre standardkälla. `LAB_VIDEO_ARCHIVE` är
endast en valfri override till en rot med samma Emil-manifeststruktur.
Hemliga inställningsvärden dokumenteras inte här.
`.cursorindexingignore` utesluter lokala bygg-/beroendekataloger och binära
video-, ljud-, bild- och 3D-format från semantisk indexering. Den raderar inga
filer och ändrar inte Git-spårningen; källkod och JSON-manifest finns kvar för
sökning. Öppna bara den här repomappen som workspace om du vill undvika att
indexera en yttre mapp med videor. Om Cursor fortfarande använder ett gammalt
index, starta en omindexering där efter att undantagen har laddats.

**Vid överlämning:** Kontrollera branch och aktuell Jira-issue, läs
`AGENTS.md`, ändra endast uppgiftsägda filer, kör relevanta tester, notera
utfall/luckor i `docs/JOHN-HANDOFF.md`, och verifiera GitHub-commiten.
Uppdatera rätt ämnessida enligt [dokumentordningen](06-arbetssatt-och-verifiering/DOKUMENTORDNING.md).
Det pensionerade personarkivet ska inte användas som källa eller få nya rapporter.
