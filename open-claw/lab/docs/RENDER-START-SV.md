# Förvalta befintliga OpenClaw-tjänster på Render

Använd `Jakeminator123/github-work`, branch `jakemanator123-github-work`.
Director och privat Gateway är redan skapade och kopplade till denna källa.
Den gamla GitLab-Blueprinten är frånkopplad. Återskapa inte resurserna för
en env-ändring. Blueprinten i `open-claw/lab/render.yaml` beskriver kontraktet;
de befintliga tjänsternas Environment-vyer visar deras faktiska värden.

1. Öppna rätt tjänst i Render Dashboard → **Environment**.
2. Jämför endast den tjänstens namn och värden mot
   [miljökartan](../../../_ENVIROMENT-INFO.md). Importera inte rotens hela
   `.env`: den innehåller flera tjänsters lokala credentials.
3. Spara en avsedd ändring och driftsätt den i tjänsten. En vanlig omstart
   räcker inte för sparade men ännu odriftsatta env-ändringar.
4. Vid kod-/rolländringar: driftsätt den granskade Gateway-revisionen och
   verifiera konfigurationen, därefter Director när ändringen kräver det.
5. Kontrollera Directors hälsa och autentiserade status utan modellkostnad.
   Produkt-token ska nekas på Lab-status; tomt produkt-schema med rätt
   produkt-token ska ge 400 innan modellkörning. Ett giltigt talprov kräver
   separat syntetisk provprofil, kostnadsram och uppspelningskvitto.

Aktuellt resultat finns i [driftkvittot](CLOUD-ACTIVATION-2026-09-29.md).
Gateway-modellens effektiva konfiguration ligger på beständig disk; ändrad
`OPENCLAW_MODEL_ID` i env är inte ensam bevis på modellbyte. Nycklar och
diskdata följer inte med en Git-push eller en Vercel-deploy.
