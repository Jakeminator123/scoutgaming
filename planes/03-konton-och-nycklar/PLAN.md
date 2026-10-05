# 03 — Konton, privilegier och nyckelregister

## Syfte och mål

Göra det möjligt att förstå vem som får göra vad, hur ett konto följer
användaren mellan spel och Studio och vilka serverhemligheter varje tjänst
behöver. Leveransen är ett kontrollerat register och en vy i HTML-kartan.

## Återanvänd det som finns

- [ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md) beskriver
  nyckelnamn, tjänsteplacering och villkor.
- [environment-variables.json](../../docs/environment-variables.json) är
  befintligt maskinläsbart namnregister.
- [check-environment-variables](../../tools/check-environment-variables.mjs)
  kontrollerar namn i hook/CI, inte hemliga värden eller leverantörspaneler.
- [Gemensam kontoåtkomst](../../docs/LOCAL-PRESENTATION-RUNTIME.md) beskriver
  samma credentials, skilda cookie-audiences, roller och återkallelse.

Skapa inte en konkurrerande lista som måste uppdateras separat. Komplettera
källregistret där information saknas och låt kartan visa samma uppgifter.

## A. Behörighetsmatris

OpenClaws vanliga modellval finns nu under `/studio/openclaw`. En inloggad
Studio-admin får läsa och spara huvudmodell för de fem befintliga agenterna;
spelarkonton får inte det. Servern kontrollerar färsk roll/session och samma
origin vid sparning. Ändringen går via en avgränsad Director-route och
Gatewayens revisionskontroll. Användaren behöver inte skriva ett delat
OpenClaw-lösenord här.

`OPENCLAWAPI_KEY` ligger server-only i Vercel Studio och Director; Directors
signeringsnyckel `OPENCLAW_STUDIO_ADMIN_DEVICE_KEY` identifierar dess parade
serveranslutning. Inga värden skickas till webbläsaren. Den avancerade native
dashboarden har fortsatt sin separata OpenClaw-inloggning och device-policy.
Den kan öppnas från samma flik; Studio ger inte generell tillgång till alla
Gateway-, verktygs- eller autentiseringsinställningar.

Dokumentera konto-/credentialkälla, effektiv roll, sida/action, API-kontroll,
sessionens livslängd, utloggning, återkallelse och lösenordsflöde.

Nuvarande kontrakt: admin/superadmin ger effektiv admin; äldre reader/staff
och spelarkonton ger effektiv spelare. Studio/Backoffice kräver admin.
Kontrollera detta mot [access-policy](../../lab/lib/studio-access-policy.mjs)
och den aktuella gemensamma serverresolvern. Äldre text om fyra aktiva
privilegienivåer får inte oavsiktligt återinföras som dagens produktmodell.

Skilj dessutom på:

- Spelare/admin i produkten.
- Partner-API med scopes och signerade kommandon till Render.
- OpenClaws operator, director, chat och speech: agentroller, inte spelarkonton.
- Providerkonto, CI/deploykonto och lokala agentverktyg: separata tekniska behörigheter.

### Kontroller

- Samma credential ger rätt tillgång i spel/Studio; spelarlogin ger inte admin.
- Cookies/CSRF/host, färsk roll och auth-epoch kontrolleras på servern.
- Vercel kan inte själv skriva ett saldo genom att kringgå Render-authority.
- QA-konton/scopes och produktionskonton blandas inte.
- Invite/reset-mail är egen acceptans; fungerande login bevisar inte mejlleverans.

## B. Nyckelregister utan hemligheter

En rad per namn eller sammanhörande grupp:

| Fält | Innehåll |
| --- | --- |
| Namn och syfte | Exempelvis `CARTESIA_API_KEY`, vad den används för |
| Ägande tjänst | Render-produkt, Vercel-Studio, Director, Gateway, RunPod eller lokal utveckling |
| Miljö | Produktion/QA/lokal; required, conditional, avvecklad eller ska saknas |
| Gräns | Vilken tjänst får läsa den; browseråtkomst normalt nej |
| Källa | Kod/konfiguration och befintligt register |
| Operativ kontroll | Förekomst, rätt scope och ett läsande providerprov där relevant |
| Rotation | Beroende tjänster, återgång och senast kontrollerat datum; inga värden |

Ta med Cartesia, RunPod, modell-/OpenClawnycklar, tal/Director-token,
ingress-, worker- och ticket-hemligheter, Neon, Blob, sessionssignering,
partner och mejl. Det är inventeringskategorier, inte ett beslut att skapa nya nycklar.

Jakobs Cartesia-nyckel finns enligt tidigare verifiering i lokal `.env` och
`lab/.env.local`. Det bevisar inte att produktionen bytt konto. Kontrollera
driftens ägare separat om ett byte ska göras; prisinventering ingår inte.
Lokala filer och leverantörernas secret stores är inte vanliga Git-filer.

## Färdigt när

- Kontomatris och nyckelplacering stämmer med samma aktuella kodversion.
- Varje UI-handling har en dokumenterad serverkontroll och ett relevant test.
- Inga värden, cookies, personliga nyckelfingerprints eller spelardata syns i kartan/Git.
- Eventuella driftavvikelser anges som avvikelser; de ändras inte tyst under inventeringen.
