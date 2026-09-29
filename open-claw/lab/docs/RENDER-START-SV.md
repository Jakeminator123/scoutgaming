# GitHub → Render → OpenClaw-labb

GitHub-repot `Jakeminator123/github-work` på
`jakemanator123-github-work` är enda mål för nytt arbete. En läsande Render-
kontroll 2026-09-29 visade att de två befintliga OpenClaw-tjänsterna ännu
hämtar från gamla GitLab-branchen `jakeminator123/work` på `8e10017d`.
GitHub-källbytet kräver en separat granskad Render-åtgärd.
Skapa inte en dubblett av Blueprinten för att tillämpa denna guide. Granska
aktuell tjänstkonfiguration och använd endast en avsiktlig Manual Sync eller
Manual Deploy vid en separat driftåtgärd. Se den
[aktuella aktiveringschecklistan](CLOUD-ACTIVATION-2026-09-29.md).

Den här Blueprinten publicerar Director och privat Gateway, inte själva
Croupier-spelet. Director har både operatörs-API och en separat skyddad
produkt-speech-endpoint. Spelets aktivering kräver dessutom Web-processens
egna env och verifiering enligt checklistan ovan. Den pausade IDE-inboxen är
ett helt separat system och ska inte kopplas till OpenClaw.

**Vilken editor?** Den nya Next-studion ligger i rotens `lab/` och sparar
projektet lokalt. Den skickar bara en tillfällig katalog till Directors
`/api/studio/advice` och `/api/studio/chat`. Den äldre editorn som följer med
Director sparar en separat katalog på Render. Blanda inte ihop dem.
[Aktuell studioguide](../../../lab/README.md).

## 1. Koden i GitHub

Använd repot `Jakeminator123/github-work`, branchen
`jakemanator123-github-work` och filen `open-claw/lab/render.yaml`. Leverera
bara granskade, uppgiftsägda ändringar med `node tools/push-github-work.mjs`.
Varken `main`, lokala `.env`-filer, videofiler eller någon annan agents
ofärdiga filer ska ingå i publiceringen.

En Git-push publicerar koden. Den skapar inte i sig några Render-tjänster.
GitLab-integrationen är pausad och ska inte användas för denna drift.

## 2. Blueprint vid en ny, avsiktlig installation

Öppna [Render Dashboard](https://dashboard.render.com/) och välj **New → Blueprint**.
Anslut ditt GitHub-konto om det inte redan är anslutet, och välj
`Jakeminator123/github-work`. Om repot saknas: kontrollera rätt GitHub-konto och att Render
har åtkomst till just det repot; gör inte repot offentligt som genväg.

Fyll i:

| Fält | Värde |
| --- | --- |
| Blueprint Name | `croupier-openclaw-lab` (ett beskrivande namn) |
| Branch | `jakemanator123-github-work` |
| Blueprint Path | `open-claw/lab/render.yaml` |

Skapa inte en separat tom Web Service först. Blueprinten beskriver redan båda
tjänsterna och hur de kopplas ihop. Ange ingen extra Root Directory.
Behåll Docker-sökvägarna som de är: de är
relativa till Croupier-repots rot, inte till YAML-filens mapp.

## 3. Granska resurser och kostnad innan du startar

Förhandsgranskningen ska visa exakt dessa nya labbresurser:

| Resurs | Typ/plan | Beständig disk |
| --- | --- | --- |
| `croupier-lab-director` | Publik Web Service, Starter | 1 GB, `/data/catalog` |
| `croupier-lab-openclaw` | Private Service, Standard | 1 GB, `/data/openclaw` |

Båda använder Docker och regionen Frankfurt. Det är alltså en Blueprint med
två tjänster, inte två alternativa installationer. Kontrollera priset som Render
visar innan **Deploy Blueprint**: detta är inte ett gratisupplägg. Vid kontroll
2026-09-20 var grundkostnaden för en hel månad **32,50 USD**: 7 USD för Director,
25 USD för Gateway och 0,50 USD för diskarna. Modellanrop och eventuella
workspace-/förbrukningskostnader tillkommer. Aktuella priser:
[Render Pricing](https://render.com/pricing).

Stanna om Render visar ändringar i befintliga produktionsresurser, oväntade
resurser eller YAML-fel. Granska då meddelandet innan du går vidare.

## 4. Lägg hemligheterna hos Render

När Render frågar efter variabler med `sync: false`:

- `OPENCLAWAPI_KEY`: en separat, lång slumpmässig hemlighet för åtkomst till
  vår OpenClaw Gateway. Om en sådan redan finns i din lokala `.env` kan samma
  värde anges säkert i Render. Detta är inte modellleverantörens API-nyckel.
- `OPENCLAW_MODEL_API_KEY`: nyckeln från den modellleverantör som ska användas.
  Den stannar i den privata Gateway-tjänsten.
- `OPENCLAW_PRODUCT_SPEECH_TOKEN`: separat hemlighet på Director. Samma värde
  ges till den betrodda produktservern, som anropar Directors bara HTTPS-origin.
  Den ska skilja sig från `LAB_API_TOKEN` och får aldrig läggas i browsern.

Blueprintens exempel väljer `gpt-5.4-mini` hos OpenAI. En annan leverantör kräver
också ändrade `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID` och
`OPENCLAW_MODEL_API`; en annan nyckel ensam byter inte leverantör.

Render skapar `LAB_API_TOKEN` automatiskt för Director. Gateway-nyckeln
refereras automatiskt från Director; lägg inte modellnyckeln där. Klistra aldrig
in nycklar i GitHub, chatt, skärmbilder eller webbläsarens JavaScript.

När du accepterat resurserna och kostnaden: **Deploy Blueprint**. Render hämtar
koden och bygger de två Dockerbilderna. Första bygget och live-modellanropen är
fortfarande verifieringssteg, inte något de lokala testerna har bevisat.

## 5. Behåll kontroll över uppdateringar

Efter skapandet: öppna Blueprintens **Settings → Auto Sync → No**.
Detta är separat från tjänsternas `autoDeployTrigger: off` som redan finns i
YAML-filen. Utan denna inställning kan en ändring i YAML-filen ändå uppdatera
resurser automatiskt.

Vid en granskad ändring i infrastrukturen: använd **Manual Sync** på Blueprinten.
Vid en granskad ändring enbart i koden: använd tjänstens **Manual Deploy**.
Vi kan senare slå på automatik uttryckligen när första installationen är testad.

## 6. Koppla din lokala labbyta

För **OpenClaws egen admin-dashboard**, följ först
[dashboard-guiden](DASHBOARD-SV.md). Den öppnas direkt på Directors HTTPS-adress
med `/openclaw/` på slutet och använder OpenClaws egen inloggning. Du behöver
inte starta det lokala labbet för att använda denna dashboard.

När båda tjänsterna är **Live**, öppna Director-tjänsten och hämta dess publika
HTTPS-adress samt dess `LAB_API_TOKEN` från Environment. Lägg bara dessa värden
lokalt i Croupier-rotens `.env`, under följande namn:

```dotenv
LAB_REMOTE_URL=https://<din-director-adress>.onrender.com
LAB_REMOTE_TOKEN=<samma-värde-som-Directors-LAB_API_TOKEN>
```

Använd inte Gatewayens privata adress som `LAB_REMOTE_URL`. Gateway- och
modellnycklarna behövs inte lokalt när anropen går via Render-Director.
Från Croupier-repots rot, starta labbet:

```powershell
npm --prefix open-claw/lab start
```

Öppna `http://localhost:4188`. Datorn ansluter utgående via HTTPS; det behövs
ingen tunnel eller öppen port in till datorn. Editorn ändrar nu katalogen på
Render-disken, inte den lokala startkatalogen i Git.

## 7. Kontrollera hela kedjan

1. Kör ett scenario med **Standardlinje**: grundanimationerna ska fungera.
2. Skriv i labbets operatörschatt: ett verkligt OpenClaw-svar ska komma tillbaka.
3. Kör ett scenario i **Shadow** eller **Aktiv** och läs beslutsspåret. Kontrollera
   att ett riktigt råd kom fram och klarade valideringen. En fallback vid fel
   är rätt säkerhetsbeteende, men bevisar inte att anslutningen fungerar.
4. Spara en liten katalogändring, ladda om och kontrollera att den finns kvar.

`/healthz` bevisar bara att Director svarar, inte att Gateway eller modellen
fungerar. Vid fel: dela feltext/loggutdrag utan nycklar. Använd inte denna
operatörs-API-token i Croupiers publika spelklient: den ger även rätt att redigera
katalogen. Spelarchatt, spelarautentisering, moderering, beständigt spelarminne
och produktionsintegration återstår som separata steg.

Se även [teknisk deploymentguide](DEPLOYMENT.md) och
[Renders officiella Blueprint-guide](https://render.com/docs/infrastructure-as-code).
