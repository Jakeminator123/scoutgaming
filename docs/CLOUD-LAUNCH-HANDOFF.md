# Molnstart och ansvar — 2026-09-29

## Senast: en Render-adress utan egen domän

`CROUPIER_CLOUD_LAYOUT=single-origin` använder Render-tjänstens riktiga
`RENDER_EXTERNAL_URL`: spel `/`, BO `/bo` och Lab `/studio`. Nexts byggda
sökväg kontrolleras mot startkonfigurationen. Lab-länkar, API/SSE och
förhandsvisningsadresser följer prefixet; lokal utveckling är oförändrad.
Ingen film, kalibrering eller spelsregel ändrades. Gemensam origin innebär
mindre browserisolering än tre separata värdar, men spelar-/BO-/Lab-sessioner,
adminroll, origin-kontroller och intern åtkomstspärr är kvar.

Dockerstarten rättar vid behov ägare för exakt `/var/data`, utan rekursion,
och släpper root innan apparna laddas. Ingen privat spelar- eller Lab-databas
kopieras. GPU, kamera och genererat tal är fortfarande avstängda.

Verifierat: 494 Lab-tester, 40 moln-/auth-testposter samt separat Next-
produktionsbygge med `/studio` (inklusive TypeScript). Den tillfälliga
byggmappen rensades; befintliga lokala servrar och `.next` bevarades.
Detta är inte ett verifierat Linux-containerbygge eller en publicerad produkt.

Render-formuläret för `croupier-v2` är förberett med GitHub-arbetsbranchen,
Frankfurt, 1 CPU/2 GB, 5 GB disk, hälsoadress `/__cloud/health` och
autodeploy efter CI. Godkänd grundkostnad är 26,25 USD/månad; trafik och andra
tjänster ingår inte i den uppgiften. Ingen betald tjänst är skapad ännu.
Icke-hemlig konfiguration är ifylld. Bootstrap-adminlösenord samt befintliga
OpenClaw-/Director-nycklar måste överföras säkert innan Deploy.
Lösenord skrivs av Jakob direkt i Render, aldrig i chatten eller Git.

## Ändring i denna leverans

`ops/cloud/start.mjs` hade ett ovillkorligt `throw`: korrekt konfiguration
kunde aldrig starta produkten. Det är nu ersatt med uttryckligt
`CROUPIER_CLOUD_LAUNCH=pilot` och automatiska, läsande åtkomstprov före publik
lyssning. Spel-, BO- och Lab-gränserna finns kvar. Ingen inloggning eller
behörighetskontroll har tagits bort. `--check` returnerar nu 0 för giltig lokal
konfiguration, inte för bevisad drift.

Starten kör Web och Lab på loopback, provar den riktiga molningången på en
tillfällig loopbackport, stänger den och öppnar publik port endast vid godkänt
resultat. Förlorad autentisering, felaktig Lab-guard eller otillgänglig tjänst
stoppar starten. Proverna använder inga verkliga konton och anropar inga
leverantörer. Avbruten/misslyckad start städar sina egna processer.

## Var saker körs

- GitHub: källkod och leveranser på `jakemanator123-github-work`.
- Vercel: befintlig statisk ingång i `ops/vercel-entry/`, just nu EN
  Blackjack-knapp, inte fem. Den länkar till backendens `/blackjack`.
- Render: spelserver, browserns spelfiler, skyddad BO och Lab med gemensam
  beständig disk. Det nya uttryckliga single-origin-läget behöver ingen egen
  domän. Ursprungligt läge med tre skilda HTTPS-värdnamn finns kvar.
- OpenClaw: den separata AI-/presentationskopplingen. Spelservern förblir
  auktoritativ för kort, spelrunda och demobalans; dessa bestäms inte av AI.
- RunPod: Emils importerade GPU-worker för valbart genererat tal/video,
  inte ett krav för förinspelade filmer. Vercel kör inte denna worker.

Att flytta även själva spelklienten till Vercel är en annan ombyggnad av
cookies, origins och streaming. Det är inte vad den nuvarande ingången gör.
Första onlinesteget återanvänder Lissabon-presentationen på samma origin som
spelservern. Inga produktmappar flyttas i denna ändring; den andra agentens
pågående Lab/Lissabon-samling lämnas orörd.

## Nästa steg och kvarvarande verifiering

1. Render-konto, GitHub-repo, region och grundkostnad är valda. Fyll de
   återstående hemligheterna säkert i Render och starta tjänsten där.
2. Bygg och kontrollera produktens Docker-image (inte bara GPU-imagen).
   Konfigurera beständig disk, tomma spelardata, bootstrap-admin och befintlig
   OpenClaw-anslutning som värdhemligheter. Verifiera rätt mediebank/projekt.
3. Starta uttryckligt pilotläge. Verifiera HTTPS, inloggning, spärrad
   obehörig administration, hel spelrunda, omstart samt databasbackup/restore.
4. Publicera Vercel-ingången med exakt backend-origin. Ytterligare fyra
   knappar behöver namn och mål; de är inte skapade här.
5. Aktivera GPU separat efter beslutad kostnadsram och verkligt latens-/synkprov.

Pilot är inte real-money-godkännande. Självproverna bevisar inte TLS,
cookiebeteende i browsern, fungerande lyckad inloggning, medier eller lagringens
beständighet. Gemensam IP-begränsning bakom proxy och kontoåterhämtning behöver
lösas före bred fleranvändardrift. Äldre dokument som säger att molnstarten
alltid kastar fel beskriver läget före denna ändring.

## Verifiering

- `node --test ops/cloud/test/*.test.mjs`: 29/29 godkända, inklusive nio nya
  start-/åtkomstprov. Dessa använder riktiga HTTP-ingången med isolerade
  fixture-tjänster, inte en driftsatt produktcontainer.
- `node --test test/bo-lab-auth.mjs test/bo-game-auth.mjs lab/test/http-guard-cloud.test.mjs`:
  4/4 godkända testposter (BO/spel, BO/Lab och två Lab-guard-prov).
- `git diff --check`: inga whitespacefel.

Ingen driftsättning, inga permanenta lokala produktservrar och inga betalda
jobb har startats. Ingen full browser-/Render-verifiering har gjorts här.
