# AI och OpenClaw

Ingång till de AI-dokument som gäller i dag. Kod, promptpaket och maskinlästa
kontrakt ligger vid implementationen; dokumenten här förklarar ansvar och
gränser.

| Behov | Läs här |
| --- | --- |
| Officiella OpenClaw-källor, versionslås och läsregel | [OpenClaw-index](openclaw/README.md) och [källindex](openclaw/OPENCLAW-DOCS.md) |
| Spelarens tal: Director → Gateway → `croupier-speech` | [Produkttal](openclaw/PRODUCT-SPEECH-DEPLOYMENT-SV.md) |
| Director, Gateway, nycklar och Render-drift | [Drift](openclaw/DEPLOYMENT.md) |
| OpenClaws egen dashboard | [Dashboard](openclaw/DASHBOARD-SV.md) |
| Runtimepaketet som Gateway-rollerna får | [Runtime-bundle](../../services/openclaw/lab/deploy/runtime-bundle/README.md) |
| Medier och uppspelning | [Runtime-referensen](../LOCAL-PRESENTATION-RUNTIME.md) |
| Miljövariabler | [Variabelregistret](../ENVIRONMENT-VARIABLES.md) |
| Begrepp | [Ordlistan](../../apps/studio/docs/TERMINOLOGI.md) |
| Läge och nästa steg | [NEXT-AGENT](../NEXT-AGENT.md) |

## Vem anropar vad

| Flöde | Väg | Gräns |
| --- | --- | --- |
| Spelaren talar med dealern | spelmotorn (`croupier-v3`) → Director `croupier-lab-director` `/api/product/speech` → privat Gateway `croupier-lab-openclaw` → `croupier-speech` | Svaret är `recordedLine`, `generatedText` eller `silence`. Kort, sko, saldo och utfall ägs av spelmotorn. |
| Adminroboten (`/studio/api/assistant`) | Vercel → modelladapter i `apps/studio/lib/assistant-*.mjs`; OpenClaw-läget går via Director | Kräver aktuell N1-session. Högst tre paginerade registerläsningar per svar; skrivning bara efter granskning och separat bekräftelse. Ingen fri SQL, shell, signerad URL eller nyckel. |
| Scoutguiden (`/studio/api/public-assistant`) | Vercel → modell, svaret kan läsas upp av D-ID (`speak` med färdig text) | Fast publik sajtinformation. Ingen databas, inga interna verktyg. D-ID:s nyckel stannar på servern. |
| Klippassistenten (`POST /api/dealers/import-proposal`) | Vercel → modell i `apps/studio/lib/dealers/dealer-import-model.mjs` | Föreslår klippfack efter klippkartan. Inga verktyg, inga bildrutor, kan inte spara; servern räknar `role` och validerar alternativen. |
| OpenClaws dashboard | Director `/openclaw/` → Gatewayns Control UI → `croupier-operator` | Separat administrativ konversation; styr inte webbchatten. |

Gatewayn konfigurerar fyra roller: `croupier-director` (väljer
kompatibel presentationsvariant), `croupier-chat` (förklarar konfiguration),
`croupier-operator` (dashboarden) och
`croupier-speech` (spelarens tal). Repots konfiguration har heartbeat `0m`,
nekade verktyg och avstängd cron och webbläsare, så ingen roll arbetar i
bakgrunden. Effektiv modell per roll ligger i Gatewayns beständiga
`openclaw.json` och kan skilja sig från miljöns standard; läs den innan ett
modellbyte.

## Regler

- Bara `docs.openclaw.ai` och `github.com/openclaw/openclaw` är auktoritativa
  för OpenClaw. Imagen i `services/openclaw/lab/deploy/Dockerfile.gateway`
  uppgraderas inte tyst, och ingen dokumentations-MCP installeras.
- Att ett dokument flyttas eller ändras ger ingen agent nya kunskaper eller
  behörigheter. Gateway-rollerna får bara det versionsmärkta runtimepaketet
  vid containerstart; webbchatten får sitt sammanhang från serveradaptern.
- Ändringar i `packages/director` eller `services/openclaw/lab` når drift först
  när Director respektive Gateway har deployats om.
## Avvecklad labbchatt

Eventstudio, Astrids labbchatts enda produktklient, togs bort i #468.
Dess social-/companion-API, minneslager och rollens kodregistrering är nu
borttagna. Spelarens tal använder det separata produkttalkontraktet ovan.
Operatörschattens delade persona-/humorfunktion och hjälptjänsten
`services/openclaw/lab/deploy/companion-search-server.mjs` används fortfarande;
den senare äger också dashboardinloggningens handoff.

Det befintliga `social-policy`-dokumentet är fortsatt läsbart och kan exporteras
och återställas genom det generella registret. Den rena validatorn finns i
`packages/studio-registry/server/document-contract.mjs`; inget API kan längre
redigera policyn. Validatorn, dokumenttypen och revisionsprefixet kan tas bort
först efter separat verifierad dataavveckling och beslut om äldre snapshots.
Följ [lagringsguidens avvecklingsordning](../storage/BLOB-NEON.md#avveckling-av-produktdata-och-original).

Befintlig `companion.json` och lagrad Gateway-roll/workspace/session är privata
driftdata. Kodavvecklingen raderar dem inte vid start. Deras avveckling kräver
ett separat datasteg med backup; [återställningsguiden](../ENVIRONMENT-RESTORATION.md)
beskriver den bevarade diskkopieringen.
