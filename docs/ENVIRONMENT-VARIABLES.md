# Miljövariabler per tjänst

## Aktuella driftprofiler, 14 oktober 2026 kväll

Denna avstämning ersätter dagens tidigare generella kopiering av Emil-värden.
Samordnat med SAMORDNING efter PR #145. **En RunPod-nyckel och dess endpoint
hör till samma profil.** Kopiera inte alla värden mellan tjänster eller från
Vercel till lokala filer. En saknad hemlighet i ett Vercel-utdrag betyder inte
att den saknas i driften; Sensitive-värden kan inte läsas tillbaka.

| Plats | Innehåll och ansvar | Kontroll / rättning |
| --- | --- | --- |
| Rotens `.env.local` | Lokala hjälpverktyg; vanlig Lab-start läser inte denna fil | RunPod-paret återställt till samma fungerande par som Lab/Render. Legacy `RUNPOD_ENDPOINT_ID`, oanvänd `GEMINI_API_KEY` och föråldrad webhookmetadata borttagna. Övriga värden bevarade. |
| `lab/.env.local` | Isolerade Lab-startarens vanliga profil | Fungerande RunPod-par bevarat. Endast oanvänd `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` borttagen. |
| `lab/.env.cloud-storage.local` | Blob och zondatabas vid uttryckligt `--cloud-storage` | Oförändrad; Blob-token matchar Render. Ingen produktions-game-URL införs lokalt. |
| `.env.emil` | Endast uttryckligt valda Emil-tester | Fem namn har prefix `EMIL_`. Samma fyra API-nyckelvärden som i originalet; bara det lokala endpointvalet rättat till den nåbara rörliga endpointen i Emils överlämning. |
| Vercel `scoutgaming/scoutgaming`, Production | Web/Studio, databas, Blob, autentisering och Cartesias Studio-kontroll | Fyra oanvända testkopior borttagna: `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`. Cartesia har en faktisk Studio-konsument och behålls. Preview/Development och alla andra poster oförändrade vid bytet. |
| Render `croupier-v2` | Spelmotor och providerjobb; egen verifierad RunPod-profil, Cartesia och ElevenLabs | Oförändrad. Rätt databasmål och Blob-lager verifierade med läsningar. |
| Render `croupier-lab-director` / `croupier-lab-openclaw` | Director och OpenClaw Gateway | Oförändrade. Gateway/Director-token och produkttalets token stämmer överens mellan avsedda par. |
| Render `croupier-vercel-preview-qa` | Befintlig separat QA-miljö | Egen QA-databas, inga RunPod-/Cartesia-/ElevenLabs-nycklar, genererat tal av. Inte synkad med produktion. |
| GitHub Actions | Endast `CROUPIER_GAME_DATABASE_URL` behövs för migrationsberedskap | Sparad om från verifierad Render-produktionsanslutning 14 oktober 20:54 UTC. Ingen databasändring. |

Emils fjärrkonto, Cartesia-inställningar, workers, poddar, image och avatarer
har inte ändrats. Namnbytet `EMIL_*` gäller bara vår privata lokala testfil.
Prefixet ger ingen workerintegration i produkten. Ingen ny pod ansluts till
Emils staging. Ändring i hans miljö kräver Jakobs uttryckliga godkännande efter
en fråga MED VERSALER.

### Läsande profilkontroll

Kör från den checkout som innehåller verktyget och ange privatfilens absoluta
sökväg om den ligger i huvudcheckouten:

```powershell
node tools/check-provider-profile.mjs --profile scoutgaming --env-file C:\Users\jakem\Projects\croupier\.env.local
node tools/check-provider-profile.mjs --profile emil --env-file C:\Users\jakem\Projects\croupier\.env.emil
```

Verktyget läser endast den angivna filen. Det importerar inte processens
nycklar, exporterar inga hemligheter, följer inga HTTP-omdirigeringar och
utför endast GET mot leverantörernas fasta API-adresser. Dubbla namn,
blandade profiler och ofullständigt RunPod-par stoppas. Scoutgaming kräver
`RUNPOD_API_KEY` + `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`; Emil kräver
`EMIL_RUNPOD_API_KEY` + `EMIL_RUNPOD_ENDPOINT_ID`. Övriga Emil-namn är
`EMIL_CARTESIA_API_KEY`, `EMIL_ELEVENLABS_API_KEY`, `EMIL_GEMINI_API_KEY`.
Hälsokontroller startar inga GPU-jobb och genererar inget tal. HTTP 200 och
rapporterade workers är **inte** ett godkänt läppsynkprov.

Kontroller efter lokal rättning: Scoutgamings RunPod, Cartesia och ElevenLabs
svarade 200; Emils RunPod, Cartesia, ElevenLabs och Gemini svarade 200.
Det gamla lokala Emil-endpointvalet gav 404. Emils nyckel ihop med vår
Astrid-endpoint gav 401; det felaktiga paret är borttaget ur rotprofilen.
Varken dessa kvitton eller en READY-deploy innebär mediaacceptans.

### Databasens namn och ägare

`croupier-production` är **Neon-projektets namn**, inte en ny databas.
Projektet `wandering-hill-60561912` skapades 29 september och innehåller
bland annat `croupier_game` (spel, konton, Studio), separata QA-databaser
samt `neondb` (zoner). Det ägs nu av `Vercel: scoutgaming`,
`org-green-butterfly-00780270`. Produktionsgrenen är `main`.

Git-commit `022fab5ed623a1af5ddb13d2f43b218cea687437`, författare
`Jakeminator123`, 8 oktober 2026 kl. 17:16 svensk tid, dokumenterar namnbytet
från `croupier-astrid-background-zones-db`. Det visar kontot bakom Git-kvittot,
inte säkert vilken människa eller agent som klickade i Neon. Resursflytten till
teamet dokumenterades separat. Det finns ingen anledning att skapa ännu en
produktionsdatabas för att namnet ändrats.

Render-anslutningen verifierades till `croupier_game`, roll `croupier_game`,
med TLS `verify-full` och installerade Studio-versioner 001–008 samt 011.
GitHubs befintliga migrationskontroll gav samma databas/roll och inga väntande
migrationer. Blob-lagret `croupier-media-private` tillhör Scoutgaming-teamet;
Render-token läste rätt privata lager. Vercels databas-/Blob-hemligheter
behålls; deras värden kan inte läsas tillbaka via API. Inloggning, sessionsläsning
och projektläsning på Vercel gav 200. Vercels sparade projektrevision matchade
exakt en read-only SELECT i produktionsdatabasen. Mediebiblioteket gav 130
poster och autentiserat HEAD på ett privat MP4-klipp gav 200 med rätt byteantal.
Ingen film laddades ned och inga spel-/Studio-data ändrades av dessa läsprov.

### Inventering och återställning

Inventeringen omfattade huvudcheckouten och tolv då registrerade syskoncheckouter:
54 env-relaterade filer, varav fyra aktiva privata profiler, tio sparade privata
kopior och fyrtio mallar. Inga aktiva hemlighetsfiler hittades i syskoncheckouterna.
Genererade beroenden, mediebinarier och förbjudna privata historikarkiv ingår inte.
Arkiverade kopior är återställningsmaterial och ska aldrig väljas automatiskt.

Originalen före denna rättning finns med ursprungliga fil-ACL under
`arkiv/2026-10-14/.env.local`, `arkiv/2026-10-14/.env.emil` och
`arkiv/2026-10-14/lab/.env.local`. Vercels privata föredata och redigerade
metadata ligger under `arkiv/2026-10-14/provider-env-audit/`, begränsat till
användaren och SYSTEM. Sensitive-värden ingår inte i API-exporten; de fyra
borttagna Emil-kopiornas ursprung finns i den bevarade Emil-filen.

Full nyckelfri översikt finns lokalt i
`lab/data/platform-private/provider-env-alignment/inventory.json`:
119 unika namn, deras lokala filer, Vercel-miljöer och Render-tjänster.
Efter borttagningen har Vercel 66 poster: 56 gäller Production, 31 Preview och
5 Development (en post kan gälla flera miljöer). Render har 53 namn i spelet,
16 i Director, 10 i Gateway och 37 i QA. Förekomst är inte ett funktionskvitto.
`GITGUARDIAN_API_TOKEN`, `DID_API_KEY` och `ELEVENLABS_VIDEO_KEY` är
kvarvarande separata verktygs-/providerinställningar: ingen aktiv produktkonsument
hittades i den granskade koden, och deras avsedda externa verktygsanvändning är
inte verifierad. De har inte blandats in i talprofilerna eller raderats.

## Historik: lokal env-konsolidering före profilrättningen, 14 oktober 2026

I Jakobs huvudcheckout är två privata filer flyttade återställbart till
`lab/data/platform-private/env-cleanup-20261014/`, efter samordning med
ADMIN och DRAGAN. Ingen miljöinställning i molnet eller källa ändrades av flytten.

- `lab/.env.generated-speech.local` innehöll endast
  `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, redan identisk i `lab/.env.local`.
- `lab/.env.cloud-activation.local` hade ingen aktuell kodläsare och ingen
  pågående manuell användning enligt DRAGAN. Tre lagringsvärden matchade
  `lab/.env.cloud-storage.local`; två unika streamhemligheter bevaras i kopian
  och har inte lagts till i vanlig Lab-miljö.

Filerna behåller exakt innehåll (141 respektive 600 byte) och Windows-ACL.
För varje flytt jämfördes den effektiva loaderkonfigurationen före/efter i
alla åtta kombinationer av generated speech, kamera och cloud storage: identiska.
Privata `proof.json` och `cloud-activation-proof.json` finns bredvid kopiorna;
inga nyckelvärden finns i kvittona eller Git. Detta är en lokal kontroll, inte
ny verifiering av leverantörsinloggning, produktion eller medieacceptans.

Rotens `.env.local` och `lab/.env.local` behålls för sina olika läsare.
Inventeringen fann 59 respektive 51 namn: 49 gemensamma värden var identiska,
medan `RUNPOD_API_KEY` och `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` skilde sig.
De åtta namn som bara finns i rotfilen och de två skillnaderna är bevarade;
rotfilen får därför inte blint ersätta Lab-filen. `lab/.env.cloud-storage.local`
behålls separat: dess Blob- och zondatabasuppgifter laddas endast vid
`--cloud-storage`. Rotens `.env` saknades redan vid inventeringen.

`loadPrivateConnection` söker i ordningen `.env`, `lab/.env.local`,
`lab/.env.generated-speech.local` och, endast vid cloud-storage-opt-in,
`lab/.env.cloud-storage.local`. Senare filer vinner; uttrycklig processmiljö
vinner sist. Endast respektive tillåtna nycklar vidarebefordras. Rotens
`.env.local` och cloud-activation-filen ingår inte i denna läsordning.
Saknad generated-speech-fil är tillåten; stödet finns kvar för andra checkouter.

## Historik: tillfällig Emil-kopiering, 14 oktober 2026 (ersatt av profilerna ovan)

Tidigare samma dag kopierades på Jakobs begäran `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`,
`GEMINI_API_KEY`, `RUNPOD_API_KEY` och `RUNPOD_ENDPOINT_ID` från
den privata `.env.emil` till rotens ignorerade `.env.local`. Tre ersatta
liknamniga rader kommenterades och samma fem namn sparades som Sensitive
i projekt/team `scoutgaming`, endast Production/main. Detta tillfälliga
undantag ersattes senare av de separata profilerna ovan; det är inte en
instruktion att återinföra kopiorna. Inga hemliga värden finns i registret eller Git.

Värdena aktiverades i produktionsdeploymenten för PR #139 (220519a1), skapad
efter miljöuppdateringen och verifierad READY. Även PR #142 (418040fa) är
verifierad READY med samma Production-scope. Vercel förmedlar taltransport,
men Render äger providerjobb. Ingen Render-nyckel, pod, workerbild eller
GitHub-hemlighet ändrades. Render har redan samma Cartesia-/ElevenLabs-värden. Befintlig RunPod-nyckel gav health 200 på aktiv endpoint; Emil-nyckeln gav 401 där och ersätter därför inte den fungerande Render-nyckeln. Workflows behöver inte dessa fem nycklar och GPU-jobbet
får sitt ljud och tillfälliga anslutningsuppgifter från servern.

Normal lokal Lab-start söker `.env`, `lab/.env.local` och den valfria
`lab/.env.generated-speech.local`; rotens `.env.local` läses inte av den
startvägen. Aktuell lokal konsolidering och prioritet beskrivs ovan.
`RUNPOD_ENDPOINT_ID` är inget alias till aktiva
`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Det nykopierade legacy-ID:t svarade 404
och har inte ersatt scoped endpoint. `GEMINI_API_KEY` har ingen aktiv konsument
i main. Kopieringen innebär inte att Dragans genererade tal är aktiverat.

## Databasadresser i tester

Tester med injicerad minnespool eller schemafunktion använder
`test/fixtures/database-url.mjs` för syntetiska PostgreSQL-adresser.
Basadressen saknar användaruppgifter; ett slumpmässigt lösenord skapas bara
vid testkörningen. Hjälparen läser inga miljöhemligheter, ansluter inte och
skriver inte adressen till disk eller logg. Behåll injicerad databas även när
testets värdnamn behöver sluta med `neon.tech` för att pröva valideringen.

`test/test-credential-fixtures.mjs` körs i ordinarie full hook/CI och stoppar
incheckade Neon-adresser med användare/lösenord i `test/` och `lab/test/`.
Rapporten innehåller bara filsökväg, rad och felkod. Skyddet är avgränsat till
återfallet från incident 38176586 och ersätter inte GitGuardian eller skyddar
mot alla typer av falsklarm. Lägg inte till scannerundantag för att gömma en
sådan fixture. Rättad kod stänger inte historiska incidenter automatiskt;
bedöm deras ursprung separat och ändra status endast med rätt mandat.

## Dealerimportens begränsade rådgivare, 13 oktober 2026

Klippassistenten använder en stateless modelladapter i importvyn under
`/admin/clips`. Den gemensamma Adminroboten beskrivs separat nedan.
Den är avstängd tills `CROUPIER_DEALER_IMPORT_AI=1` och de serverägda
`OPENCLAW_MODEL_API_KEY` finns i **Studio-tjänsten**. För officiella
OpenAI-API:t fungerar även sajtens befintliga `OPENAI_API_KEY` om den särskilda
nyckeln inte är angiven. En uttryckligen tom särskild nyckel stänger av
kopplingen; OpenAI-nyckeln skickas aldrig till en anpassad leverantör.
Gatewayns befintliga inställningar innebär inte att Studio har dessa värden.
`OPENCLAW_MODEL_API` stöder `openai-responses` (förval) och `openai-completions`;
`OPENCLAW_MODEL_BASE_URL` är en HTTPS-bas, med `https://api.openai.com/v1` som förval.
Modellrollerna är fasta på servern: kartläggning använder `gpt-6.1-sol` med
`high`, äldre importchatt använder `gpt-5.6-luna` med `medium`. Adaptern
läser inte `OPENCLAW_MODEL_ID`; Gatewayns modellinställning är separat.
Ingen nyckel kopieras, tjänst aktiveras eller leverantör konfigureras av kodleveransen.

Modellen får högst tio filbeskrivningar, avgränsad användarkontext och tillåtna fack.
Vanlig chatt kräver ingen vald dealer. Den får en begränsad projektion av
verklig dealer-/fackkatalog och högst fyra lyckade fråge-/svarspar (3 000 tecken
per meddelande, 12 000 totalt), som opålitlig kontext. Samma historik kan följa
med till kartläggningen. Inga ekonomi-, drift-
eller rumsregister kopplas in genom denna inställning.
Inga bildrutor, mediebytes, verktyg, hemligheter eller skrivbehörigheter följer med.
Begäran anger `store:false`. Kartläggning har högst 12 000 outputtokens och
60 sekunders timeout; chatt har 2 600 och 20 sekunder. Budgeten inkluderar
resonemangstokens. Ofullständiga svar får inte bli placeringsförslag.
Två samtidiga anrop och sex anrop per minut/användare begränsas per serverprocess;
det är inte en gemensam kostnadsgräns mellan instanser. Utan modell eller vid fel
visar kartläggningen uttryckligen filnamnsregler. Chatt visar i stället att AI-svaret
inte är tillgängligt och lämnar placeringar/godkännanden orörda. Sparandet använder befintlig
N1-behörighet och privata Blob-/registerflöden efter separat mänskligt godkännande.

## Gemensam webbchatt och Adminroboten

Samma befintliga Studio-konfiguration ovan aktiverar modelladaptern för
`/studio/api/assistant`. Inga nya miljövariabler införs. Modell-ID:n måste
finnas hos den valda leverantören: Scoutguiden använder `gpt-6-luna`/low;
Adminroboten och OpenClaw-läget använder `gpt-6.1-sol`/high. Ingen tyst
reservmodell används. Modellen kan lämna ett förslag, aldrig köra det.

Publik hjälp får endast statisk produktkunskap. N1 får avgränsade aktuella
inventarier och redigerad Gatewaymetadata. Alla skrivningar behöver signerad
förhandsvisning och separat bekräftelse genom befintliga behörighetskontroller.
Bekräftelsenyckeln härleds med egen domän från Studios befintliga servernyckel;
ingen ny klienthemlighet eller databasroll skapas. Fyra samtidiga och åtta anrop
per minut/aktör begränsas per process, inte globalt mellan Vercelinstanser.
Publik trafik använder Vercels anslutningsheader eller gemensam reservbucket.
Maximalt 2 400/8 000 outputtokens och 20/55 sekunder för publik/intern modell.
`store:false`, verktygsfria modellanrop och samma ursprung krävs.

OpenClaw-läget återanvänder befintlig N1-skyddad Director/Gatewaykoppling.
Gatewayns agentmodeller är separat konfiguration. Åtgärden kan bara välja en
modell som finns i aktuell Gatewaykatalog och kräver bekräftelse. Modellbyte
rensar rollens reservmodeller och kan starta om Gatewayn; förhandsvisningen
visar detta. Ingen Renderadministration eller fri Gatewaykonfiguration öppnas.

## Avslutsrättning 13 oktober 2026: Vercel och Blob-metadata

CLI och anslutna Vercel-verktyg verifierade teamet `scoutgaming`, projektet
`scoutgaming` (`prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`) och samma team i den lokala
projektlänken. Det personliga teamet finns också men användes inte för åtgärden.
Enligt Jakobs uttryckliga begäran togs endast `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY`
(`R8EEeym41phJSfgk`, Production + Preview) bort från projektinställningarna.
Posten hade Blob-contentHint och giltigt Ed25519/PEM-format; den är en publik
webhooknyckel, inte en API-nyckel, och läses inte av applikationskoden.

Efterläsning verifierade att posten saknas och att övriga env-posters ID,
namn, typ och scope är oförändrade. `BLOB_READ_WRITE_TOKEN` behölls.
Det privata lagret `croupier-media-private` (`store_AqwvebTbBHarOjvG`) är
fortsatt aktivt med 1 845 objekt. Projektkopplingens ID, projekt, prefix och
Production/Preview-scope är oförändrade; dess env-metadata speglar borttagningen.
Ingen fil, lagringsresurs eller token raderades. En framtida återanslutning av
lagret kan tillföra managed metadata på nytt; den lokala filen styr inte
Vercels projektinställningar eller redan skapade deployments.

`OPENAI_API_KEY` uppdaterades separat i rotens Git-ignorerade `.env.local`.
Övriga lokala rader bevarades. Värdet kopierades inte till molninställningar,
dokumentation eller Git, och ingen leverantörskontroll/debiterbar körning gjordes.
En nyckel som klistrats in i chatten ska ersättas före fortsatt användning.

## Förteckning och tidigare verifieringskvitton

Detta är den läsbara nyckelnamnsförteckningen. Den maskinläsbara listan finns i
[`environment-variables.json`](environment-variables.json) och används av CI
och systemkartan. Båda är aktiva referenser; ingen av dem laddas som processmiljö.
De innehåller inga hemliga värden. Ignorerade `.env`/`.env.local` och tjänsternas
miljöinställningar är separata och ska inte raderas vid dokumentstädning.
Ändra båda när en variabel läggs till, tas bort eller byter betydelse.
`node tools/check-environment-variables.mjs` körs i Git-hook och CI och
kontrollerar namn som läses av molnstart, Vercelbygge, GPU-relä och
migreringsgrinden.
Den kontrollerar **inte** värden eller leverantörspaneler. Vid ändring direkt
i Render/Vercel/RunPod: jämför endast nyckelnamn med listan och uppdatera
repo-dokumentationen i samma leverans. Lagra aldrig värden här.

Aktuell källa: `Jakeminator123/scoutgaming` på `main`; gamla `github-work`
vidarebefordras av GitHub till samma repo-ID `1380630440`.
Vercelprojektet `scoutgaming` bygger `apps/croupier-frontend` och `lab` som
Services från reporoten. Båda använder samma projektmiljö och `fra1`.
Aktuell drift och QA: [molnkarta](CLOUD-MIGRATION.md), [handoff](JOHN-HANDOFF.md).

Slutkontroll 12 oktober 2026, 13:56 UTC: kod `19c44902` har grön
[GitHub-CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/38257724379).
Director `dep-db6eciqd0e5s73aef4f0` och Gateway `dep-db6eciid0e5s73aef360`
är live på denna commit efter omstart med enbart `OPENCLAW_API_KEY`.
Det äldre `OPENCLAWAPI_KEY` saknas på båda; 16 respektive 10 env-poster återstår.
Credentialvärdet och samtliga andra värden är verifierat oförändrade;
backup finns privat under `lab/data/platform-private/env-cleanup-20261012/`.
Director använder nu repo-roten som Docker-kontext med en separat strikt
filallowlist, samma Dockerfile-sökväg och bevarad disk. Gatewayens byggkontext,
disk och sparade konfiguration är bevarade. Hälsa för spel, QA, Director och
Vercel ger 200. Autentiserad admin visar ansluten Gateway, samma konfigurationshash,
fem roller och fyra modeller. Detta är anslutningskontroll, inte nytt
godkännande av genererat tal eller läppsynk.

Webb och spelserver verifierades på `4ea767cf`, som innehåller PAOW-/envfixarna;
den publika `dealer-compositing.mjs` matchar `fe8b6372` bytevis. Dockerfixen
kräver enbart ny Director-image. GitGuardian läst på `19c44902`: noll öppna,
17 tidigare ignorerade incidenter och aktiv övervakning. Platstäckningen är
partiell och historisk skanning är `too_large`; detta är ingen full säkerhetsfriskrivning.

Verifierad produktion 4 oktober: gemensam Neon-policy och native Studio är
aktiva. Render kör utan produktdisk och utan `CROUPIER_CLOUD_DATA_ROOT`;
`CROUPIER_MEDIA_BLOB_INDEX=/app/media/blob-index.json` och disponibel OS-temp
ersätter gamla diskvägar. Tre tal-/streamflaggor är ON i produktion, OFF i QA.
QA:s disk, SDK, journaler och reservationer bevaras. Inga nya envnamn införs.

Director/Gateway-konfiguration: se [OpenClaws källindex](AI/openclaw/README.md).

Studio-flikens modellinställningar använder den inloggade administratörens
vanliga Studio-session. `OPENCLAW_API_KEY` är det rättade namnet för Gateway-
hemligheten i Vercel-projektet `scoutgaming`, endast production, och måste motsvara Directors befintliga
Gateway-lösenord. Nyckeln får inte skickas till webbläsaren eller till spelets
frontend. Det vanliga `LAB_API_TOKEN` ger ingen rätt att administrera Gateway.
De avvecklade `LAB_REMOTE_URL`/`LAB_REMOTE_TOKEN` behöver inte återaktiveras.

Studio och den lokala anslutningsstartaren accepterar även `OPENCLAWAPI_KEY`
för befintliga tjänster. Inom samma env-källa vinner `OPENCLAW_API_KEY`;
senare filer och processmiljön behåller sin vanliga prioritet. Ett uttryckligen
tomt rättat värde stänger av anslutningen även när det gamla namnet är satt.
Båda namnen töms i isolerade barn som inte ska få Gateway-hemligheten.
Gatewayens startkod har samma prioritet och normaliserar barnprocessen till
det rättade namnet. Render-Blueprint och Compose använder `OPENCLAW_API_KEY`
för både Director och Gateway. Det äldre namnet är endast kompatibilitet.

Env-granskning 12 oktober: 59 Vercel-poster motsvarar 51 unika namn.
Alla 18 namn utan referens i produktkällorna hör till de registrerade Neon-/
Blob-kopplingarna. De handsatta namnen har källreferenser; det bevisar inte att
varje villkorligt flöde är aktivt. Hemliga molnvärden är maskerade i pluginen
och har inte likhetsverifierats mot lokala filer. Rootens två OpenClaw-namn
och labbets äldre namn innehöll lokalt samma värde. Preview saknar avsiktligt
produktionskonton, native Studio och leverantörsnycklar; dessa ska inte kopieras
dit som del av namnbytet.
Rättningen har verifierats med 56 riktade env-/Studio-/isolationsprov. De två
aktiva lokala `.env.local`-filerna använder nu det rättade namnet och har samma
Gateway-värde. Kodstödet är levererat i `36c8ef59` med full regression:
2 895 godkända prov, 11 villkorliga undantag och 0 fel. Vercel-versionen
`dpl_5JueKQrBNhtvdVN2w4LaeNAALKbs` blev READY före env-bytet.
Vercel tillåter inte namnbyte på Sensitive-poster. Det rättade namnet skapades
därför som en Production-hemlighet från den lokala filen via CLI-stdin, efter
ett läsande 200-svar från Directors admin-API med samma Gateway-nyckel.
Den äldre Vercel-posten togs därefter bort. Efterläsning visar 59 poster,
51 unika namn och inga ändringar av övriga posters namn, typ eller scope.
Vid den tidigare env-granskningen rättades rotens lokala
`CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` mot Vercels publika post; labbets kopia
matchade då redan posten. Vercel-posten togs senare bort enligt nedan.
`LAB_PARTNER_*` används genom en dynamisk kompatibilitetsmappning i
`lab/lib/partner-observer.mjs`; en sökning efter fullständiga namn missar detta.
`GEMINI_API_KEY` saknar referenser i mains källkod och ingår inte i den isolerade
startarens allowlist. Den har tagits bort från båda aktiva lokala env-filerna,
tillsammans med tomma äldre `RUNPOD_ENDPOINT_ID` och plattformsägda `VERCEL`.
Övriga lokala värden är oförändrade. Borttagna värden har en privat,
Git-ignorerad backup under `lab/data/platform-private/env-cleanup-20261012/`.
Den aktiva `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` och dynamiska partneralias
behålls. Rendergranskningen omfattar endast Croupiers fyra tjänster i Jakobs
workspace; andra projekt och de registrerade Vercel-integrationerna bevaras.

På `croupier-lab-director` används dessutom
`OPENCLAW_STUDIO_ADMIN_DEVICE_KEY`: en privat Ed25519-nyckel i base64-kodad
PKCS8. Den signerade serveridentiteten paras uttryckligen i befintlig Gateway
med `operator.read` och `operator.admin`. Nyckeln hör inte hemma i Studio,
frontend, QA eller Git. Ingen autentiseringsspärr stängs av. Det avgränsade
API:t tillåter endast modellval för befintliga Croupier-agenter; verktyg,
leverantörshemligheter och nätverksinställningar ändras inte där.

`BO_URL` anger publik origin för auth/handoff och `CROUPIER_GAME_ORIGIN`
används lokalt. Aktiva klippval och administration läses nu från gemensamma
Neon-revisioner. `CROUPIER_DATA_DIR`, `LAB_STUDIO_DATA_DIR`,
`CROUPIER_PRESENTATION_STUDIO_DIR`, `CROUPIER_GENERATIONS_DIR`,
`CROUPIER_GENERATED_SPEECH_DIR`, `LAB_VIDEO_ARCHIVE` och lagringsexportens
två variabler är avvecklade i produktion och får inte återinföras som fallback.
Namnregistret behåller namn som fortfarande läses av nekande guards eller
historiska exportkontrakt; listning betyder inte att de ska sättas i produktion.
Inga credentials skickas i navigationen.

Gemensam inloggning använder de befintliga game-/CRAIG-kontona och två
behörigheter: admin för spel/Studio/Backoffice, spelare för spel. Native
lösenordshantering går genom samma signerade Render-authority som övrig
administration; `CROUPIER_STUDIO_NATIVE_ADMIN` och Neon-policyn ovan styr
runtimevalet. Ingen ny roll-, lösenords- eller inloggningsvariabel införs.
Kontoroller och lösenord ändras i Backoffice, aldrig genom klientens env.

### Aktiv molnkonfiguration

Panelgranskning 8 oktober 2026 (Vercel `scoutgaming`, namn jämförda mot denna
förteckning): Jakob har lagt in `LLM_LOGIN_UN` och `LLM_LOGIN_PW` med
Studio-kontot `LLM`:s inloggning. Ingen kod läser dem; de är inte en del av
någon tjänsts konfiguration och ska inte registreras som krav. Rekommendation:
ta bort dem ur Vercel och förvara inloggningen i en lösenordshanterare. Studio-
inloggningen är ett konto i Neon (`/control/administration?tab=accounts`), inte
en miljövariabel. Värden står aldrig här.

Panelgranskning 12 oktober 2026 (Vercel `scoutgaming`, namn och typer jämförda
mot denna förteckning; inga värden lästes eller kopierades). Borttaget efter
Jakobs beslut: `LLM_LOGIN_UN` och `LLM_LOGIN_PW` (sensitive, alla tre miljöer)
samt sex tomma plain-rader i Production som ingen Vercel-tjänst skiljer från
saknade värden: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `LAB_REMOTE_URL`,
`LAB_REMOTE_TOKEN`, `CROUPIER_PRESENTATION_DIRECTOR_TOKEN` och `NODE_OPTIONS`.
Kvar med avsikt: tomma `CARTESIA_API_KEY` och `RUNPOD_API_KEY` (blockerade för
`vercel-lab-ui`; `lab/lib/voice-preview.mjs` skiljer tomt från saknat),
`CROUPIER_MEDIA_STORE_ID` (managed, hör till Blob-kopplingen; läses inte av
koden). Den då kvarvarande `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` togs bort
13 oktober enligt nedan. Även `DEMO_GUEST_ACCESS`, `CROUPIER_GENERATED_SPEECH_PREVIEW`
och `CROUPIER_LISSABON_PROFILES` = `0` i Production (läses av talvägen;
Render-motorn vägrar starta om någon är `1`, `ops/cloud/config.mjs`). Inga
formatfel (radbrytningar, citattecken, blanksteg) hittades i läsbara variabler.
Sensitive-värdens form går inte att läsa tillbaka och är okontrollerad.

Lokala env-filer (konsoliderade 8 oktober 2026). Vercel production är källan
för delade nycklar. Förnya lokalt med `vercel env pull --environment=production
--yes <tempfil>` och slå ihop; systemnycklar `VERCEL_*`, `NX_*`, `TURBO_*` tas
bort. Nycklar som bara finns lokalt (OpenClaw-agent/modell/tal-URL/token,
`LAB_API_TOKEN`, `LAB_PARTNER_*`, `BETTALOTTO_*`, `ELEVENLABS_*`) behålls från
den lokala filen. Placering: rotens `.env.local` och `lab/.env.local` har samma
delade värden; rotens `ELEVENLABS_API_KEY` är avsiktligt spelserverlokal.
`open-claw/lab/deploy/local-connection.mjs` söker generated-speech-filen
i standardordningen och läser cloud-storage-filen endast under dess flagga.
Cloud-activation-filen ingår inte i laddaren. Konsolideringen 14 oktober ovan
beskriver vilka lokala filer som finns kvar och den faktiska värdeprioriteten.
Äldre
kopior sparas under `/random/env-backup-*/` (Git-ignorerat). Vid avvikelse
mellan lokal fil och Vercel för samma namn vann Vercel (gällde API-nycklar för
Cartesia, OpenAI, Gemini, RunPod, OpenClaw och `LAB_REMOTE_*`).

**Verifiering 11 oktober 2026:** Kopplingarna i huvudkopian och arbetskopian 74b4 pekar nu på team `scoutgaming`, `team_Scxorb9qtZHjNae1YEQnFCaT`, och projekt `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`. Root/Lab har identiska lokala env-filer med 56 namn, med privata backuper av tidigare filer och länkar. Vercel production-pull returnerade 59 namn men bara 29 icke-tomma värden; de andra 30 kan inte användas som bevis på hemlighetsparitet. Tomt molnsvar ersatte inte sju befintliga lokala värden. Andra otillgängliga värden lämnades osatta, och systemnycklar samt oanvända LLM_LOGIN_* togs inte med i de aktiva filerna. De privata snapshotsen för alla tre miljöerna och jämförelsekvittot finns under lab/data/platform-private/cloud-sync-audit; de ska inte läggas i Git. Lokal utveckling fortsätter via den isolerade startaren, vars barn saknar produktions-game-URL och postgresläge. Full produktions-env lokalt och fungerande modell-/medieanrop är inte verifierade. Vercel-pluginens gamla scope ger 403 i scoutgaming; CLI har verifierad åtkomst. Neon-ägaren är nu liveverifierat "Vercel: scoutgaming", `org-green-butterfly-00780270`; organisationen i stycket nedan är den historiska uppgiften före flytten.

Var databaserna bor (bekräftat 8 oktober 2026 via Neon MCP): ett enda Neon-projekt,
**`croupier-production`** (omdöpt 8 oktober 17:15 från `croupier-astrid-background-zones-db`;
id `wandering-hill-60561912`, gren `main`, Neon-organisationen "Vercel: jakeminator123's
projects", dvs. Vercel-styrd), innehåller flera databaser:
`croupier_game` (schemana `croupier_game`, `croupier_auth`, `croupier_studio` – spelet,
konton och Studio-policy; det är den `CROUPIER_GAME_DATABASE_URL` pekar på från både
Render och Vercel), `croupier_game_qa`, `croupier_game_restore_check`,
`croupier_studio_qa_abc92154cb15` och `neondb` (zonerna, `CROUPIER_ZONES_DATABASE_URL`).
Resursen och Blob-lagret `croupier-media-private` (787 MB, region arn1) flyttades
8 oktober 17:25 på Jakobs beslut från det personliga teamet `jakeminator123s-projects`
till teamet `scoutgaming` (Vercel "Transfer Database" respektive "Transfer Store") och
kopplades till produktionsprojektet `scoutgaming` (Production + Preview, Sensitive, ingen
automatisk Neon-gren per deploy). Kopplingarna fick egna prefix så att de handsatta
nycklarna inte rörs: Neon injicerar 16 namn `CROUPIER_NEON_*` och Blob injicerar
`CROUPIER_MEDIA_STORE_ID` + `CROUPIER_MEDIA_WEBHOOK_PUBLIC_KEY` (read-write-token-rutan
lämnades av). Koden läser ingen av dem; `CROUPIER_GAME_DATABASE_URL` och
`BLOB_READ_WRITE_TOKEN` är fortsatt de auktoritativa värdena och verifierades oförändrade
(namnjämförelse 44 → 59 namn, bara tillägg; `/api/operators/sg-test` svarade före, under
och efter). Render berördes inte (egen kopia av `CROUPIER_GAME_DATABASE_URL`).
Bieffekt: QA-projektet `croupier-player-preview-qa` förlorade sin Neon-koppling och därmed
`CROUPIER_ZONES_*` i Preview/Development; produktionen har aldrig haft dem. Projektet
raderades 18:40 samma dag (legacy, inga egna domäner).
Migration `006-player-profile.sql` kördes där 8 oktober 16:48 (två nya nullbara kolumner,
4 spelare oförändrade).

Render: `CROUPIER_DATABASE=postgres` kräver `CROUPIER_GAME_DATABASE_URL` till
en separat TLS-skyddad game-databas, färdiginstallerat `product-v1`-schema och
verifierad import. `sqlite` är kompatibilitetsstandard; en game-URL utan
postgres-flagga är fel. Zon-URL får aldrig vara reserv för konton/spel.

Ett isolerat native-QA-prov får använda
`CROUPIER_CLOUD_DATA_ROOT=/var/data/native-studio-qa/<12 hextecken>`.
Containern kräver då postgres och gemensam policyflagga, exakt matchande
`qa_native_<suffix>`-miljö, workspace `croupier` och den separata Neon-
databasen/rollen `croupier_studio_qa_<suffix>`. Skrivbara QA-kataloger skapas
efter att rootprivilegier släppts. Den befintliga diskens övriga data bevaras.

Diskfri produktion kräver i stället postgres, gemensam Neon-policy, privat Blob,
en explicit TLS-skyddad Neon-URL och frånvaro av gamla diskvariabler.
TLS `require`, `verify-ca` och `verify-full` accepteras; befintlig produktion
behåller `verify-full`. CROOT ska vara **unset**, inte en tom sträng.

Vercel-spel/BO: `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`,
`CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN` och serverhemligheten
`CROUPIER_VERCEL_INGRESS_SECRET`. `CROUPIER_GAME_URL` bevaras för äldre
flagga-av-kompatibilitet. Gemensamt Neon-läge använder dess serverägda
policy-/scope-/lagringskopplingar; inga hemligheter skickas till klientprops.

Aktivt gemensamt Scoutgaming-projekt: rotens `vercel.json` bygger
webb, Studio och taltransport som Services. Talservicen i
`apps/croupier-speech` delar befintlig origin-/ingresskonfiguration genom
`apps/croupier-frontend/lib/platform-configuration.mjs`; inga nya nycklar behövs.
`CROUPIER_VERCEL_UNIFIED_UI=1` tillsammans med
`CROUPIER_VERCEL_UI=1` och `CROUPIER_STUDIO_NATIVE_ADMIN=1` använder samma
publika origin för båda; `CROUPIER_LAB_UI_ORIGIN` behövs då inte för routingen.
Render-origin måste fortfarande vara separat och ingressnyckeln stannar på
servern. Studio behåller `/studio` som basePath och sin befintliga Neon/Blob/mail-
konfiguration. De två nya flaggorna är production-scopade i samma projekt,
utan nyckelkopior. Git-autobyggen är återaktiverade; rootDirectory och
ignored-build-kommandot är null, framework är services. Det äldre Studio-
aliaset bevaras även i native-konfigurationens exakta tillåtna origins.
Det domänlösa reservprojektet scoutgaming-legacy-frontend har i stället
ignored-build `exit 0` och automatisk domäntilldelning avstängd.

Vercel-Lab UI: `CROUPIER_LAB_REMOTE_UI=1`, samma fyra origins/ingressnyckel,
`CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`
och `BO_URL` till publik origin. Native serverrendering läser samma autentiserade
Neon-revision som Render; ingen lokal seed- eller diskfallback finns.

Gemensam sparad policy är aktiverad i produktion och i isolerad native-QA:
`CROUPIER_STUDIO_NEON_POLICY=1` på Render och båda Vercel-byggena kräver samma
`CROUPIER_GAME_DATABASE_URL` till befintliga game/auth-Neon, installerat
checksumverifierat product-v1 samt Studio-migrationerna 001, 002, 003 och 004. Samma
`CROUPIER_STUDIO_ENVIRONMENT_ID` och `CROUPIER_STUDIO_WORKSPACE_ID` måste anges
på båda tjänsterna. Projekt och administration läses i en enda transaktion;
projektrevision, administrationsrevision och gemensam spelrevision redovisas.
Saknade sparade dokument, fel schema eller tier-dealer utan exakt registrerad
idle ger fel. Ingen automatisk seed, diskfallback eller dubbelskrivning ingår.
Studio-save använder CAS, historik och audit; osparade utkast blir inte spelpolicy.

Native administration kräver **både** `CROUPIER_STUDIO_NATIVE_ADMIN=1` och
den gemensamma policyflaggan. `CROUPIER_STUDIO_ENVIRONMENT_ID` och
`CROUPIER_STUDIO_WORKSPACE_ID` är explicita serverägda scopes; de läses aldrig
från klienten. De två tekniska UI-origins består bakom samma publika adress.
Flaggan migrerar/initialiserar ingenting. Produktionsimport och gemensam
spelprojektion är verifierade; native administration är på i Vercel-Studio.
Render har native-adminflaggan avsiktligt OFF och behåller spelauktoritet och
signerade kommandon, medan Neon-policyn är ON. Avstängd administration ger
ingen gammal BO-/iframefallback. Den separata native-QA-miljön
har egen Neon-databas, scope och datarot samt två egna Vercelprojekt; dess
uppgifter får inte användas som produktionskonfiguration. Konto-/partnerhandlers
är inkopplade bakom flaggorna; endast verkligt inkopplade actions annonseras.
Spelarstatus och partner-
launch/credit/revoke går genom signerad Render-kommandogräns med aktuell
Neon-identitet och engångsnonce, aldrig en lokal Vercel-walletmutation.
Den använder befintliga `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`
och `CROUPIER_VERCEL_INGRESS_SECRET`. Isolerad auth/SQL/HTTPS/restart är
godkänd; faktisk produktionsimport, policy-/aliasbyte och diskfri omstart är
verifierade. Produktionskonton har inte använts för nya syntetiska authprov.
`RESEND_API_KEY` och `CROUPIER_STUDIO_MAIL_FROM` på Vercel-Studio krävs tillsammans
för riktiga invite/resend/reset-mail. Sedan 8 oktober 2026 gäller samma två nycklar
och `CROUPIER_PUBLIC_ORIGIN` även inbjudan av operatörspersonal (partner-API:t `team`
`invite` och admin-åtgärden `operator-membership` med e-post): länken byggs mot den
publika originen till `/partner/set-password`; utan mejlnycklar skapas kontot men inget
mejl går, och svaret avslöjar inte det. Inga nya variabelnamn. Avsändaren är en explicit e-postadress
på en ägd och providerverifierad domän; ingen äldre hårdkodad avsändare används.
Saknad leveransadapter gör dessa actions otillgängliga; befintliga
inloggningar kräver inte en mailnyckel och tokenläckage till UI är inte fallback.
Resend Free och avsändardomänen `scoutgaming.tech` verifierades och kopplades
till det separata QA-Studio den 3 oktober. Ett godkänt invitationsmejl skickades genom den
verkliga Studio-handlaren 2026-10-03; Resend bekräftar `delivered` och mejlet
hittades i mottagarens Gmail-skräppost kl. 17:31 svensk tid. QA-testkontot och
dess tokens städades bort efter provet,
så mejlets länk är nu ogiltig. Ett separat verkligt resetmejl har inte skickats.
Den 6 oktober återlästes en icke-tom domänbegränsad produktionsnyckel och
`CROUPIER_STUDIO_MAIL_FROM=no-reply@scoutgaming.tech` i samma Studio-projekt,
nu scoutgaming. Native invite/reset-adaptern gav Delivered till Resends sandbox.
Den tomma extra Marketplace-installationen är borttagen; fungerande delad
Resend-koppling och QA bevaras. Free-planen är kvar. Ett riktigt produktionskontos
invitation/aktivering/reset och mottagarinkorg är fortsatt oprövade (checklistans F).
För driftkonfiguration används avsedda Render-/Vercel-värden. Lokala provider-
nycklar kan tillhöra ett annat konto och får inte automatiskt ersätta dem.
Native videoregistret kräver `CROUPIER_MEDIA_STORAGE=blob`,
`CROUPIER_MEDIA_BLOB_INDEX` till samma verifierade aktiva manifest och
serverhemligheten `BLOB_READ_WRITE_TOKEN` på Vercel-Studio. Token är därför
villkorlig i nyckelregistret för det nya läget; den installeras inte genom
kodändringen. Nya reviewposter/klassificeringar läses ur Neon, utan gamla
uploads-/klassificeringsfiler. Aktiva bankklipp och deras exakta ID/hash består.
Tillfällig hashverifierad bytescache är disponibel scratch, inte beständig metadata.

### Bevarad QA

Den isolerade native-QA-miljön har egen backend, databas, scope och hostname.
AI/GPU/kamera och native-admin är OFF; Cartesia-/RunPodnycklar finns inte där.
SDK, sourcepins, ursprungliga manifest, journaler och förbrukade reservationer
bevaras. Varken koddeploy eller återstående generationskvot öppnar ett nytt prov.

Namnregistret behåller de källlästa `CROUPIER_P6_QA_ROUTER`-, SDK- och bounded-
variablerna. Den avstängda routern laddar inga privata adaptrar. När en sådan
koppling uttryckligen används kräver koden exakt QA-tjänst/origin/databas/scope,
manifest- och källhashar, avgränsad giltighet och separata worker/readback/ticket-
nycklar. Lab får inga QA-nycklar. Processinjektion via NODE_OPTIONS/NODE_PATH/
LD_PRELOAD eller ändrad TLS-tillit nekas. Ursprungliga tider/poster skrivs inte om.
Fullfils- och streamkostnader går genom samma beständiga budgetskydd.

Aktuell usage, testtak, okänd kostnad och öppen acceptans finns i
[handoffen](JOHN-HANDOFF.md#2-öppna-kontroller-och-kända-fel). Äldre installationsdetaljer
finns i [Git före städningen](https://github.com/Jakeminator123/github-work/blob/6b9dad55ced03ee0573e24b472b4dcbba2b97776/docs/ENVIRONMENT-VARIABLES.md).

### Origins och privata medier

Källinventeringen omfattar de aktiva `lab/lib/cloud-media-store.mjs` och
`lab/lib/video-registry.mjs` för både Render och Studio samt Studios
`lab/lib/legacy-clip-inventory.mjs`. De har inte flyttats eller tagits bort.
Studio läser även `LAB_PUBLIC_URL` som betrodd proxy-origin och
`CROUPIER_DATA_DIR` som lokal inventeringsreserv; namnen är villkorade i
registret. Detta dokumenterar befintliga kodläsningar och kräver ingen
ny tjänsteinställning eller ändring av hemliga värden.

Render-ingress: `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`,
`CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_GAME_ORIGIN` och
`BETTALOTTO_PARTNER_BASE_URL` anger samma exakta publika Vercel-origin.
Aktiv gemensam Neon-policy väljer `/blackjack` som speladress, `/game` som filtrerad
omdirigering och `/player-login` som spelarentré. Launch/callback använder
samma effektiva adress; nativeflaggan ensam byter ingen speladress.
`CROUPIER_VERCEL_TRANSPORT_ORIGIN` anger
exakt Render-origin och `CROUPIER_VERCEL_INGRESS_SECRET` matchar UI-projekten.
Host/forwarded headers utan privat ingressbevis nekas.

Gemensam privat media: `CROUPIER_MEDIA_BLOB_INDEX` är opt-in med aktiv
Blob-lagring och pekar på `/app/media/blob-index.json` eller exakt härledd
`studio/media-blob-index.json`. Publika assets kräver public-allowlist;
privata bankklipp kräver autentisering och exakt familj, roll, fil-ID, hash,
storlek och Blob-path. Originalpreview har dessutom inventory-allowlist.
Källa/review/staging blir inte allmänt publik genom indexet. Aktivt indexläge
ger 503 vid saknad eller felaktig källa, utan lokal bytesfallback.
`LAB_VIDEO_ARCHIVE` är avvecklad i gemensamt Neon-läge; gammal archiveväg
normaliseras inte till en aktiv reservkälla.

`CROUPIER_STORAGE_MAINTENANCE` och `CROUPIER_STORAGE_EXPORT_SECRET` gäller
historiska exportlägen. De ska vara borttagna i migrerad produktion;
återaktivera inte gamla disk-/exportsättare från en äldre konfigurationsbeskrivning.

Native talgranskning använder samma privata Blobindex och exakta registrerade
audio-/video-/text-/indexhashar. Det äldre fristående röstprovet stoppas före
cache-/inställningsläsning och Cartesia-anrop när Neon- eller nativeflaggan är på.
`LAB_STUDIO_DATA_DIR` får inte återinföras i aktiv gemensam Neon-drift.

Fullfilsvägen med Neon kräver separat explicit `CROUPIER_SPEECH_FULLFILE_RESERVE_USD`
och `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` samt motsvarande redan verifierad
beständig policy. Värdena skickas endast till Web när fullfilsvägen uttryckligen
är vald; streamvägen behåller sin sessionsreservation. De båda vägarna räknas
i samma dygnstak. Belopp accepterar högst sex decimaler och 1–10 000 000
mikro-USD. Migration 004 skapar ingen policy och återbetalar eller nollställer
ingen historisk kostnad. Den gamla streamreservationen bevisar inte rätt
fullfilspris. Production/version 1-policy är adopterad inom bevarade tak;
avgränsade funktionstest får använda dokumenterat okänd USD enligt det
uttryckliga acceptansundantaget. Exakta tariffer förblir backlog.

### Tjänsteansvar

Import/ALL0 och produktionsbyte är avslutade. Originalkvitton och återställningsregler
finns i [handoffen](JOHN-HANDOFF.md) och [återställningsguiden](ENVIRONMENT-RESTORATION.md).
Återanvänd inte historiska exportflaggor som normal driftkonfiguration.

| Tjänst | Krävs | Vid första start | Villkorligt/valfritt | Värdhanterat |
| --- | --- | --- | --- | --- |
| Render: spel och aktiva runtime-/kommandofunktioner | `NODE_ENV=production`, `CROUPIER_CLOUD_LAUNCH=pilot`, `CROUPIER_CLOUD_LAYOUT=single-origin`, `CROUPIER_LAB_BASE_PATH=/studio` (även Docker-bygget), `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `OPENCLAW_PRODUCT_SPEECH_URL`, `OPENCLAW_PRODUCT_SPEECH_TOKEN` | Bootstrap endast vid uttryckligt separat tomdatabasuppdrag; befintliga produktionskonton bevaras | Aktiv produktion kräver postgres/Neon/Blob och saknar CROOT; monterad QA använder sin exakta isolerade CROOT | Render sätter `PORT`, `RENDER_EXTERNAL_URL` och `RENDER_GIT_COMMIT`; den sista används enbart som sanerat runtime-SHA-kvitto i /__cloud/version, utan manuell Git-fallback |
| Vercel: spel/Studio-ingång (`apps/croupier-frontend`) | `CROUPIER_VERCEL_UI=1`, `CROUPIER_PUBLIC_ORIGIN`, `CROUPIER_BACKEND_ORIGIN`, `CROUPIER_LAB_UI_ORIGIN`, `CROUPIER_VERCEL_INGRESS_SECRET` | – | Gemensam serverägd Neon-/scope-/lagringspolicy; `CROUPIER_GAME_URL` är äldre flagga-av-kompatibilitet | – |
| Vercel: native Studio (`lab`) | `CROUPIER_LAB_REMOTE_UI=1`, samma origins/ingress, `CROUPIER_LAB_BASE_PATH=/studio`, `CROUPIER_STREAM_LANE=lissabon-stream-lane`, `BO_URL` | – | Gemensam `CROUPIER_STUDIO_NEON_POLICY`, native-adminflagga, explicit scope/game-Neon och Studio 001–005; SSR läser Neon. `RUNWAY_API_KEY` (valfri, server-only) aktiverar **Dealers & klipp → Skapa material** på `/control/clips?view=generate` med vald dealer; utan den visas facken men inga Runway-jobb kan startas. Nyckeln läses av `lab/lib/runway-client.mjs`, skickas bara till `https://api.dev.runwayml.com` och aldrig till Blob eller nedladdningsadresser. Forge kräver dessutom den deploy-valfria Studio-migrationen 008 (`forge_dealers`, `forge_jobs`). | – |
| Frontendens spelarbygge (`apps/croupier-frontend/tools/player-ui-build.mjs`, tjänst `vercel-entry`) | `CROUPIER_GAME_ORIGIN` = spelserverns exakta HTTPS-origin utan snedstreck på slutet | – | Krävs när bygget anropas utan explicit origin | – |
| Render: separat GPU-relä (ännu ej driftsatt) | `WORKER_SECRET`, annat `TICKET_SECRET` (båda minst 32 tecken), `ALLOWED_ORIGINS` = exakta spel-origins | – | – | Render sätter `PORT` |
| Render: OpenClaw Director (separat Blueprint) | `LAB_API_TOKEN` (genereras), `OPENCLAW_API_KEY` (från privata Gateway) | – | `OPENCLAW_PRODUCT_SPEECH_TOKEN` krävs för produktens talendpoint och anges privat; `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`, `HOST`, `PORT`, `LAB_DATA_DIR`, `OPENCLAW_HOSTPORT` eller `OPENCLAW_BASE_URL`, `OPENCLAW_AGENT`, `OPENCLAW_CHAT_AGENT`, `OPENCLAW_TIMEOUT_MS`, `OPENCLAW_DASHBOARD_ENABLED` enligt Blueprint | Produkt-token ska skilja sig från `LAB_API_TOKEN`; Blueprint kopplar Director till Gateway |
| Render: privat OpenClaw Gateway | Separata `OPENCLAW_API_KEY` och `OPENCLAW_MODEL_API_KEY` | – | `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, lokalt endast `OPENCLAW_DASHBOARD_ALLOW_LOOPBACK`; `CROUPIER_SPEECH_VISION` är opt-in | Blueprint anger icke-hemliga standardvärden; två nycklar anges privat |
| RunPod: äldre separat GPU-testworker | Inga egna env-nycklar krävs av imagen | – | `AVATAR_ID` för annan avatar; `NVIDIA_DRIVER_CAPABILITIES`, `NVENC` endast om GPU-konfigurationen kräver det | Endpoint-id, API-nyckel och worker-inställningar hanteras i RunPod och av anropande tjänst |
| Lokal Lab/OpenClaw | Inga globala krav; beror på anslutningssätt | – | Se `open-claw/lab/.env.example` och `lab/.env.example`; nyckelnamnen speglas i JSON-listan | – |
| GitHub Actions: Studio-migreringsgrind | – | – | `CROUPIER_GAME_DATABASE_URL` är repository secret och läses av readiness-kontrollen vid push till main; `CROUPIER_MIGRATION_CONFIRM` är lokal operatörsbekräftelse och sätts aldrig i CI eller Vercel | – |

`tools/check-migration-readiness.mjs` läser `CROUPIER_GAME_DATABASE_URL` som
GitHub-repository secret i `presentation-studio` vid push till `main`. Samma
namn används av en operatör lokalt. `CROUPIER_MIGRATION_CONFIRM` ska vara
exakt `apply-pending` endast i den terminal som kör `--apply`. Sätt den aldrig
i CI eller Vercel.

Huvudprojektets Preview kan peka mot produktion. Syntetiska spel-/kontoprov
kräver den separata native-QA-backenden och dess egen databas/hostname.
De aktuella QA-fronterna heter `croupier-native-qa-abc92154cb15` och
`croupier-native-studio-qa-abc92154cb15`. Det äldre `croupier-player-preview-qa`
raderades 8 oktober 18:40 på Jakobs beslut, efter att Neon- och Blob-resurserna
flyttats till teamet `scoutgaming`; raden `vercel-zones-qa` i registret är historik.
Se [driftskartan](CLOUD-MIGRATION.md).

Lab läser bara `CROUPIER_ZONES_DATABASE_URL` för zoner. Generella DATABASE_URL/
POSTGRES_URL är inte reserv för detta. Vercel-konfiguration kopieras inte
automatiskt till Render. Produkt-, Lab- och Gateway-token har olika roller.

### Synkade privata nycklar, 11 oktober 2026

Rotens ignorerade `.env.local` innehåller aktuella lokala värden. Befintliga
selektiva läsare använder även `.env` och `lab/.env.local`; deras överlappande
nycklar hålls därför lika, utan att ladda alla hemligheter i varje process.
Detta är en verifierad engångssynk, ingen automatisk molnsynk vid filändring.

- ElevenLabs har ett runtime-namn: `ELEVENLABS_API_KEY`. Den angivna
  dubbla prefixeringen rättades med det separat verifierade kontovärdet.
  PAOWs och Dragges exakta originalröst-ID svarade 200 vid läsande kontroll.
  `ELEVENLABS_OC_API` och `ELEVENLABS_VIDEO_KEY` är borttagna ur de tre
  lokala env-filerna; Lab har ingen ElevenLabs-nyckel. Ingen leverantörsnyckel
  återkallades och ingen alternativ röst valdes.
- Render `croupier-v2` har den verifierade `ELEVENLABS_API_KEY`. Läsning
  efter skrivning bekräftade värdet och att andra Render-värden var orörda.
  Lokal Cartesia synkades till den fungerande Render-nyckeln; båda tidigare
  värdena nådde Victoria, men molnets fungerande konto ersattes inte.
- Vercel `scoutgaming` Production fick `OPENCLAWAPI_KEY` och
  `RESEND_API_KEY` från rotens `.env.local`, båda som Sensitive.
  OpenClaws verkliga adminläsning svarade 200 och Resend matchade redan före
  skrivningen. Övriga Vercel-variabler förblev oförändrade, inklusive
  integrationsstyrda Neon/Blob-värden och separata Preview-inställningar.
- Vercels gamla Cartesia/RunPod/OpenAI/Gemini/Director-fält är avsiktligt
  tomma. De fylls inte från lokala filer. ElevenLabs behövs inte på Vercel,
  i GPU-workern eller som GitHub-secret: Render genererar ljud och skickar
  ljudet vidare till workern.

Kontokontroll 12 oktober 2026: nuvarande ElevenLabs-runtime-nyckel i lokal
Web och Render tillhör Kevin (Pro). Det är fortfarande originalklonernas
workspace, inte ett verifierat Jakob-konto. Kontot byts först när egen nyckel
och tillgång till PAOW/Dragge är verifierade; nyckelnamn får inte användas som
bevis på ägare. Instant-kloner delas inom samma workspace enligt
[ElevenLabs](https://elevenlabs.io/docs/help-center/product/voices/my-voices/how-do-i-share-a-voice).
Originalinspelningar behöver bevaras separat; genererade svar ersätter dem inte.
RunPod-endpointen kontrollerades i Jakobs inloggade konto och runtime-nyckeln
klarade en obetald health-läsning. Cartesias runtime-värde överensstämmer mellan
lokal Web och Render, men kontoägaren är inte verifierad. Inga nyckelvärden
lagras i denna förteckning. Den aktiva ElevenLabs-vägen använder enbart
`ELEVENLABS_API_KEY` för TTS; historiska video-/OC-namn införs inte som
automatiska reserver. Ljudleverantörsnycklar stannar på Render Web; Vercel,
GPU-workern och GitHub behöver inga kopior för svarsbiblioteket.

Synk av nycklar bevisar inte TTS eller läppsynk. Dealerprofilflaggan förblir
av tills den nya GPU-imagen och hela PAOW-förloppet accepterats.

### Talnycklar och sparade modeller

Nya dealerprofiler kräver `CROUPIER_DEALER_SPEECH_PROFILES=1` på Render
`croupier-v2`, tillsammans med befintlig streaming och Neon-journal. Flaggan är
av tills en workerimage som stöder profilbunden avatar och protokoll 3 har verifierats.
`ELEVENLABS_API_KEY` behövs där för ElevenLabs-profiler; Cartesia-profiler använder
`CARTESIA_API_KEY`. Molnstartaren vidarebefordrar nyckeln enbart till Web-processen,
inte Lab, webbläsaren eller GitHub Actions. Lokala `.env.local` och `lab/.env.local`
förs inte automatiskt över till Render. Inga nya GitHub-secrets krävs för TTS.
Röst-ID, modell och referens sparas per dealer i Studio; runtime kontrollerar
röstbehörighet med ett läsande API-anrop innan GPU-jobbet. Saknad röst eller nyckel
ger fel, aldrig Astrids röst som reserv. Budget och återstartsregler är oförändrade.

På Render `croupier-v2` finns tal-/GPU-konfigurationens `CARTESIA_API_KEY`,
`RUNPOD_API_KEY` och `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Produktens tre
aktiveringsflaggor är ON. Aktuell verifiering och kostnadsgränser finns i
[handoffen](JOHN-HANDOFF.md); gamla deploy-ID:n och gamla budgetbelopp är inte
instruktioner för att ersätta dagens konfiguration. Lokala nycklar kan höra
till annat konto och ersätter inte driftens nycklar automatiskt.

Gatewayns nya kod-, Compose- och Blueprint-standard för `OPENCLAW_MODEL_ID`
är `gpt-5.6-terra`. En befintlig `/data/openclaw/openclaw.json` bevaras vid
omstart och kräver ett uttryckligt byte av sparade rollmodeller; ett env-byte
ensamt bevisar inte att Gatewayns primärmodell har ändrats.

Sparade modeller visas och ändras genom Studios avgränsade OpenClaw-flik.
En miljöändring eller omstart bevisar inte ett lyckat modellbyte; läs tillbaka
Gatewayns verkliga sparade konfiguration.

### Adaptiv chatt genom samma OpenClaw

Ny kod har opt-in `OPENCLAW_SPEECH_ROUTING=adaptive` på **Director** och
`OPENCLAW_SPEECH_DEEP_MODEL=gpt-6-sol`. Standard är `fixed`: ingen andra
modell aktiveras av enbart koddeploy eller katalogregistrering. Vid adaptive
kan Astrids vanliga modell begära en enda fördjupning; tekniska fel eller
ogiltiga svar utlöser inte fler modellanrop. Båda anropen går genom samma
verktygslösa OpenClaw-roll. Slutligt svar ger högst en talvideo.

Sätt `OPENCLAW_SPEECH_TIMEOUT_MS=20000` på **både croupier-v2 och Director**
före aktivering. Spelets molnstart skickar den enbart till Web; den är en
sammanlagd chattdeadline, inte en ny 20-sekundersfrist per modell.
`OPENCLAW_TIMEOUT_MS=8000` kan ligga kvar för övriga Director-råd.
Gateway behöver modellen i sin tillåtna katalog men inga routervariabler.
Inga av dessa variabler hör hemma på Vercels startsida eller RunPod.

Den lokala Lab-startaren tillåter samma explicita speech-timeout och
skickar den bara till Web. I denna checkout är privat `lab/.env.local` satt
till `20000`, med effektiv generisk timeout kvar på `8000`; ingen lokal
server har startats. Senare privata speech-/cloud-storage-filer och processenv
har fortfarande högre prioritet. Compose-mallen ändras inte av detta.
Aktivera först efter verifierad modell- och bildåtkomst samt ny kod i båda
berörda tjänsterna. [Flöde och prov](JOHN-HANDOFF.md).

`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` ska sparas som serverhemlighet i
Render → `croupier-v2` → Environment, tillsammans med bootstrap-användaren.
Den används bara för att skapa första administratören i en tom CRAIG-databas.
En ändring av variabeln ändrar inte lösenordet för ett befintligt konto.

Render-spelets villkorliga grupper:

- Privat media: `CROUPIER_MEDIA_STORAGE=blob` kräver
  `BLOB_READ_WRITE_TOKEN`. Båda skickas till Web och Lab eftersom Lab laddar
  upp och spelservern levererar valda familjeklipp. Filerna är privata;
  behöriga API-routes hanterar GET, HEAD och Range utan publik Blob-URL.
  Lokal standard utan flagga är disk. Migrerad produktion kräver uttrycklig
  Blob-konfiguration; familjeregistret ligger i scoped Neon Studio och
  ersätter produktens gamla `videos/index.json` på Render-disk. Den gamla
  produktdisken är avvecklad och dess externa backup bevaras. QA:s separata
  disk och lokala filprofiler har egna livscykler.
- Bakgrundszoner: `CROUPIER_ZONES_DATABASE_URL` kräver aktiv privat media
  och en separat TLS-skyddad Postgres-anslutning. Den skickas endast till
  Lab. Schemat i `lab/lib/zone-cloud-schema.sql` installeras uttryckligen;
  det är installerat i zonprojektet efter separat QA den 29 september.
  Generella `DATABASE_URL`/`POSTGRES_URL` används aldrig som reserv.
  Spelkonton och saldon använder en separat game/auth-Neon-databas.
- Lokal molnlagring: koordinerad `node lab/start.mjs --cloud-storage --no-open`
  läser den Git-ignorerade `lab/.env.cloud-storage.local` med samma tre namn.
  Flaggan är opt-in. Nycklarna begränsas till avsedda serverprocesser och
  nätåtkomst till lagringens exakta ursprung. Render kräver motsvarande
  server-env och en deploy; Vercel-projektets värden kopieras inte automatiskt.
- Konto/data: `CROUPIER_PLAYER_ACCOUNTS` styr kontofunktionen. Migrerad
  produktion har separat game/auth-Neon och ingen CROOT/diskfallback.
  Endast isolerad monterad QA får använda den validerade CROOT-katalogen
  och dess exakt härledda datavägar; gamla LAB_VIDEO_ARCHIVE/diskvariabler
  ska inte kopieras till produktion.
- Vercel-spelarproxy: `CROUPIER_VERCEL_FRONTEND_ORIGIN` är valfri och av som
  standard. Ange endast den förhandsversionens exakta HTTPS-origin utan path,
  wildcard eller avslutande snedstreck. Den tillåter spelarens POST-anrop med
  detta Origin när Render fortfarande får sitt eget publika Host; BO och Lab
  får ingen ny tillåtelse. Konfigurationen aktiverar ingen Vercel-rewrite eller
  Production-frontend. Kontrollera Host, cookies och omdirigeringar i Preview
  innan variabeln används i drift.
- En origin: `PUBLIC_URL`, `BO_URL`, `LAB_PUBLIC_URL`,
  `CROUPIER_GAME_ORIGIN`, `BETTALOTTO_PARTNER_BASE_URL` kan utelämnas när
  Render levererar `RENDER_EXTERNAL_URL`. I separat-värdläge måste dessa
  origins konfigureras enligt `ops/cloud/config.mjs`.
- Presentation/AI: `CROUPIER_PRESENTATION_DIRECTOR_URL` +
  `CROUPIER_PRESENTATION_DIRECTOR_TOKEN`, `LAB_REMOTE_URL` +
  `LAB_REMOTE_TOKEN`. Varje par sätts tillsammans. `OPENCLAW_TIMEOUT_MS`
  är valfri tidsgräns.
- Röst och kamera: `CROUPIER_ASTRID_CAMERA=1` kräver
  `CROUPIER_ASTRID_TRANSLATION_KEY` och `CROUPIER_STREAM_LANE=lissabon-stream-lane`.
  Flaggan var OFF efter migrationen och sätts åter till ON i produktion på
  Jakobs beställning 4 oktober; QA förblir OFF. Nyckelns läsande modellkontroll
  gav åter HTTP 200 för `whisper-1` samma dag. Detta bevisar inte en genomförd
  mikrofoninspelning. Rösten översätts av OpenAI; Astrids svar använder fortsatt
  Cartesia. Bilder kräver vald `gpt-6-luna` eller `gpt-5.6-terra`.
  Webbspelaren kräver spelarens val och enhetsbehörighet. Inspelning börjar
  aldrig automatiskt vid sidladdning; manuellt engångsmeddelande finns när
  webbläsaren saknar lokal wake-word-igenkänning. Se aktuell driftavläsning i handoff.
- Genererat tal/video: `CROUPIER_GENERATED_SPEECH=1` och
  `CROUPIER_CLOUD_GENERATED_SPEECH=1` kräver `CARTESIA_API_KEY`,
  `RUNPOD_API_KEY`, `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`. Streaming
  `CROUPIER_GENERATED_SPEECH_STREAMING=1` kräver dessutom olika
  `CROUPIER_SPEECH_STREAM_WORKER_SECRET` och
  `CROUPIER_SPEECH_STREAM_TICKET_SECRET` samt
  `CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD` (positivt decimaltal, högst
  10 USD, högst sex decimaler). Sessionsreserven skickas enbart till Web
  och måste beräknas från den avsedda RunPod-sessionens pris före aktivering.
  `CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD` krävs samtidigt, med samma
  decimalformat och högst 20 USD, minst sessionsreserven. Även den går
  endast till Web. Redan förbrukade GPU-medel ska räknas av från dagens
  tillgängliga budget före aktivering; den beständiga sessionsliggaren
  behåller reserver genom omstart. Se [aktuell handoff](JOHN-HANDOFF.md).
  Ingen av dessa funktioner är
  nödvändig för de registrerade förinspelade klippen.
- Partner: `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET` och
  `BETTALOTTO_PARTNER_PLAYER_ID` är en grupp om partnerkopplingen används.

Sätt inte `DEMO_GUEST_ACCESS=1`, `CROUPIER_GENERATED_SPEECH_PREVIEW=1`
eller `CROUPIER_LISSABON_PROFILES=1` i molndrift; startvalideringen avvisar
dem. Lösenord och token är endast i leverantörens hemlighetslager eller
ignorerad lokal `.env`. Inga `NEXT_PUBLIC_*`-variabler får innehålla hemligheter.

Game/auth använder nu separat Neon med verifierad extern backup och full
återläsningsparitet. Bevara historiska SQLite-filer; efter nya Neon-skrivningar
får en äldre SQLite-kopia aldrig återaktiveras som datakälla. Den nya
Git-kopplade UI-projekten har rätt rot/branch och kanoniska origins/ingress;
kontrollera varje automatisk deploy där. Native Node-funktionerna för
`/speech-stream` och `/lipsync-worker` har 300 respektive 600 sekunders gräns.
Genererat tal genom Render/Cartesia/RunPod har passerat två tidigare liveprov;
kallstart, exakt synk och fysisk mikrofon återstår enligt handoffen.
