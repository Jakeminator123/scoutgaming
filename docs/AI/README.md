# AI och OpenClaw

Gemensam ingång för AI-agenternas dokumentation. Varje guide har en enda
innehållsplats. Kodsökvägar, promptpaket och maskinlästa kontrakt ligger kvar
vid implementationen; de är inte fristående handböcker.

| Behov | Läs här |
| --- | --- |
| Publik D-ID-chatt, separat N1-Adminrobot, behörigheter, dealerimport och arkivering | [Agentflöde och ändringslogg](scoutgaming-agentflode.md) |
| Director, Gateway, inloggning och lokala prov | [OpenClaw-guider](openclaw/README.md) |
| Tjänsteansvar, datakällor och kvarvarande arbete | [Migrationsöversikten](../CLOUD-MIGRATION.md) |
| Produktens ingångar, bolagsåtkomst, äldre länkar och användarsteg | [Användarguiden](../../lab/docs/README.md) |
| Gemensamma begrepp | [Terminologi](../../lab/docs/TERMINOLOGI.md) |
| Medier, uppspelning och kvarvarande acceptans | [Runtime-referensen](../LOCAL-PRESENTATION-RUNTIME.md) |
| Klippstruktur, Neon/Blob-migration och gemensam talworker | [Kanonisk struktur och genomförandeplan](../storage/BLOB-NEON.md) |
| Miljövariabler och ansvar | [Variabelregistret](../ENVIRONMENT-VARIABLES.md) |
| Aktuell leverans och verifiering | [Handoff](../JOHN-HANDOFF.md) |

Admin, partnerportal och lobby hör till Vercels webb-/Studio-tjänster;
Render-tjänsten `croupier-v2` kör spelmotorn. Neon är enda produktregistret
och privat Blob innehåller mediebyte. `lab/` och `open-claw/lab/` är aktiva
kodsökvägar, inte lokala kopior av produkten. Isolerade fixtures och äldre
authoringfiler är inte alternativa produktregister.

Dragan är ordinarie dealer. Astrids guider och exakta mediereferenser är
legacyunderlag för bevarade tal-/OpenClaw-flöden, utan trelagersversion.
Aktuell leverans och acceptans följs i [handoffen](../JOHN-HANDOFF.md);
daterade prov nedan ersätter inte den.

## Daterad driftkontroll: 13 oktober 2026

Läsning av Renders tjänste- och deploy-API i Jakobs bekräftade arbetsyta.
Sju tjänster totalt; fyra hör till `Jakeminator123/scoutgaming`. Övriga tre
hör till andra repon och är inte extra instanser av Scoutgamings Gateway.
Alla fyra nedan var ej suspenderade och hade en `live`-deploy.

| Tjänst | Instanser | Roll och plan | Live-commit |
| --- | ---: | --- | --- |
| croupier-v2 | 1 | Spelserver, 1c-2g | `579c47e3` |
| croupier-lab-director | 1 | Publik autentiserad adapter, starter | `e57f28ef` |
| croupier-lab-openclaw | 1 | Privat Gateway, standard | `e57f28ef` |
| croupier-vercel-preview-qa | 1 | Separat QA, 1c-2g | `ee060804`, 5 oktober |

Blueprinten [render.yaml](../../open-claw/lab/render.yaml) omfattar endast
Director och Gateway, vilket stämmer med deras nuvarande tjänsteuppdelning.
Fem agentroller i Gateway är fem rollkonfigurationer, inte fem servrar.
Vercel, Neon, Cartesia och RunPod ingår inte i antalet Render-instanser.

Director och Gateway har varsin beständig disk på 1 GB. Det fungerar för
dagens enskilda instanser, men Render tillåter inte horisontell skalning av
tjänster med disk och deras driftsättningar saknar zero-downtime-garantin.
Se [Render: skalning](https://render.com/docs/scaling) och
[beständiga diskar](https://render.com/docs/disks). Ökad last eller krav på
redundans kräver separat plan för delat tillstånd, sessioner och återställning;
att bara öka antalet agentroller löser inte detta.

Bedömning: tjänstegränserna är rimliga och kodens versionslås ger
reproducerbarhet. Detta är inte en belastningsmätning, versions-/sårbarhetsaudit
eller bevis för hög tillgänglighet. QA:s äldre revision kan vara avsiktlig;
dagens kod kan inte godkännas med enbart dess gamla prov. Inga tjänster,
instanser, nycklar eller modellkonfigurationer ändrades vid denna kontroll.

## Vilka guider beskriver vad?

- **Drift och aktiv integration:** DEPLOYMENT, RENDER-START, DASHBOARD,
  LOCAL-CONNECTION, PRODUCT-SPEECH och OPENCLAW-DOCS under `openclaw/`.
  Äldre prov i dem är daterade belägg, inte dagens driftstatus.
- **Astrids avgränsade prov:** SOCIAL-CHAT och COMPANION beskriver social
  chatt och lokal profil/minne, inte hela produktens dealeruppspelning.
  ASTRID-CAMERA-VOICE-PLAN är ursprungligt designunderlag för kamera/mikrofon;
  implementationen finns bakom flaggor och separat driftacceptans återstår.
- **Förslag:** [SLACK-ASTRID-SETUP-SV](openclaw/SLACK-ASTRID-SETUP-SV.md)
  beskriver en ännu inte verifierat aktiverad Slack-anslutning. Det är ingen
  instruktion att skapa en tjänst, token eller börja publicera meddelanden.

Den gemensamma media-/spelarvägen omfattar registrerade dealers. Att några
gamla provguider är Astrid-specifika gör inte hela systemet Astrid-specifikt.
Namnet `open-claw/lab` är en driftsatt sökväg, inte bevis för att koden är död.

## Underhåll

Uppdatera en guide samtidigt som dess kontrakt ändras. Skilj aktivt beteende,
daterat prov och framtida förslag åt. Radera eller ersätt en gammal guide när
dess konsumenter har flyttats; ålder ensam räcker inte som borttagningsbevis.
Guider och runtimepaketets källhänvisningar använder `docs/AI/openclaw/`.
De elva gamla dokumentstubbarna är borttagna. Ändringsloggen finns i
[agentflödet](scoutgaming-agentflode.md#ändringslogg).
