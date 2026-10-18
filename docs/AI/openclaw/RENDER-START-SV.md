# Förvalta befintliga OpenClaw-tjänster på Render

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `services/openclaw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

Använd `Jakeminator123/scoutgaming`, branch `main`.
Director och privat Gateway är redan skapade och kopplade till denna källa.
Den gamla GitLab-Blueprinten är frånkopplad. Återskapa inte resurserna för
en env-ändring. Blueprinten i `services/openclaw/lab/render.yaml` beskriver kontraktet;
de befintliga tjänsternas Environment-vyer visar deras faktiska värden.

1. Öppna rätt tjänst i Render Dashboard → **Environment**.
2. Jämför endast den tjänstens nyckelnamn och ansvar mot
   [variabelregistret](../../ENVIRONMENT-VARIABLES.md). Registret
   innehåller inga hemliga värden; kontrollera avsedda värden separat i rätt
   tjänst. Importera inte rotens hela `.env`: den innehåller flera tjänsters
   lokala credentials.
3. Spara en avsedd ändring och driftsätt den i tjänsten. En vanlig omstart
   räcker inte för sparade men ännu odriftsatta env-ändringar.
4. Vid kod-/rolländringar: driftsätt den granskade Gateway-revisionen och
   verifiera konfigurationen, därefter Director när ändringen kräver det.
5. Kontrollera Directors hälsa och autentiserade status utan modellkostnad.
   Produkt-token ska nekas på Lab-status; tomt produkt-schema med rätt
   produkt-token ska ge 400 innan modellkörning. Ett giltigt talprov kräver
   separat syntetisk provprofil, kostnadsram och uppspelningskvitto.

Aktuell drift och öppna kontroller finns i [handoffen](../../JOHN-HANDOFF.md)
och [driften](DEPLOYMENT.md). Kvittot från 29 september är pensionerat.
Gateway-modellens effektiva konfiguration ligger på beständig disk; ändrad
`OPENCLAW_MODEL_ID` i env är inte ensam bevis på modellbyte. Nycklar och
diskdata följer inte med en Git-push eller en Vercel-deploy.

## Första övergången från root-tini till tini med uid 1000

Gäller bara övergången från den äldre imagen som loggade tini EPERM vid
stopp. OpenClaw 2026.9.5 behåller då sin owner-lease i högst fem minuter
efter senaste förnyelse. Ingen lease får raderas eller kringgås.

1. Kräv granskad exakt revision och grönt Linux-containerprov. Spara
   tjänstens ursprungliga Docker Command (nu tomt), autoDeploy och diskbindning.
2. Merger samordnar ensam drift på befintlig Gateway med beständig disk.
   Sätt tillfälligt Docker Command till
   `/bin/sh -c sleep 330; exec node /opt/croupier-gateway/gateway-bootstrap.mjs`
   utan omslutande citattecken runt shellprogrammet i Render-fältet.
   Driftsätt den exakta fixrevisionen. Kontrollera att gamla instansen
   verkligen stoppas före den nya starten. Vid oklar tidsordning: avbryt
   vidare steg och granska bounded status/loggar; rör inte state eller lås.
3. Väntan gör inget med disk/auth. Därefter ersätter exec skalet med samma
   bootstrap som vanlig CMD. Efter uid/gid-drop execar bootstrap befintlig tini som uid 1000/PID 1, som startar runtime-bootstrap. Kontrollera live-revision, Director→Gateway
   config.get, anslutning och oförändrade effektiva modellval utan modellkörning.
4. Återställ Docker Command till det sparade tomma värdet och verifiera
   fältet. Driftsätt samma exakta fixrevision normalt. Kräv lyckat stopp och
   omstart utan owner-lease-fel samt nytt autentiserat driftkvitto. Först då
   är rättningen och övergången färdiga. Behåll autoDeploy av.

[Render beskriver Docker Command och sh -c](https://render.com/docs/docker)
och [15 minuters starttimeout](https://render.com/docs/deploys). Renders
kodexempel använder `/bin/sh -c python ... && gunicorn ...` utan omslutande
citattecken. Första övergångsförsöket med enkla quotes gav exit127 och
`not found` för hela shellprogrammet: Render behöll citattecknen. Det är
en skillnad mellan Render-fältets sträng och Dockers uttryckliga argv.
CI skickar `["/bin/sh", "-c", "sleep 1; exec node ..."]` och provar samma
shellprogram på den faktiska pinnade imagen, inklusive /bin/sh och sleep;
det provar inte Renders strängtolkning. Krävd faktisk driftkontroll omfattar
fortfarande 330-sekunderssteget och efterföljande normal omstart.
Nya fel ska utredas innan en ny deploy; återställ kommandoinställningen och
använd befintlig återställningsprocess utan att radera eller ändra leasens data.

Verifierat övergångskvitto18oktober: den korrigerade strängen nådde LIVE
trots en portscan-varning under väntan. Den följande normala omstarten på
samma d55ce412 gav ordnad SIGTERM, ny Gateway och autentiserat config.get200.
Bedöm faktisk slutstatus och anslutning; en tidigare varning ensam visar
varken misslyckad eller lyckad drift. Se exakt tids-/deploykvitto i handoffen.
