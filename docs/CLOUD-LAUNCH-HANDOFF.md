# Molnstart och ansvar — 2026-09-29

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
- Render (föreslagen värd): spelserver, browserns spelfiler, skyddad BO och Lab
  med gemensam beständig disk. Aktuell konfiguration kräver tre skilda
  HTTPS-värdnamn för spel, BO och Lab. De kan peka på samma tjänst.
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

1. Välj Render-konto, kostnadstak och tre HTTPS-värdnamn. Behörighet till rätt
   GitHub-repo krävs. Inga hemligheter i Git eller chatt.
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
