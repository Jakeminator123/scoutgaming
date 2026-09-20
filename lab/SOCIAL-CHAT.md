# Astrids sociala chattprov

I **Eventstudion**, gå till **Astrid → Bordet väntar**. Chatten är ett lokalt
spelarchattprov, inte OpenClaw-sidans operatörschatt eller IDE-agenternas inbox.

## Två skilda prov

- **Spela vald variant** spelar det du markerat, utan regler eller modell.
- **Testa event** kör urvalet. Läget **Bara standard** väljer alltid standarden,
  även om du redigerar ett alternativ. Det är inte samma sak som variantfamiljen.

## Från meddelande till reaktion

Chatt → lokal sparad policy → Director på Render → OpenClaw `croupier-social`
→ kontrollerat JSON-val → lokalt ElevenLabs-tal + en ändlig 2D-rörelse.

`social.ledsen` heter **Ledsen** i editorn. Du kan ändra dess namn, instruktion,
tröskel, paus och fasta replik; välj **Fritt svar** för genererad svensk text.
Tröskeln gäller modellens bedömning, inte en uppmätt sannolikhet.
Den beskriver Astrids spelade uttryck, inte spelarens mentala tillstånd.

Modellen får ett begränsat handlingskontrakt `choose_social_response`: text och
ett uttrycks-ID eller inget uttrycksbyte. Det är ett validerat JSON-svar, **inte
en installerad MCP-tool**. Den får inte skriva filer, ändra kort eller välja
nya motor-events. Bara Astrid/`idle.ready` accepteras. En kortdelning avbryts
inte för en social reaktion. Detta är inte ännu en kö till produktens spelare.

Knappen för standardfras sparar **exakt** vald text via ElevenLabs. Tal vid
chatt är ett uttryckligt val och kan kosta API-krediter. Cacheträff återanvänder
samma ljud; inga automatiska genereringsförsök görs efter fel.
2D-gesten illustrerar uttrycket, inte verifierad läppsynk. Inspelade produkt-
videor får aldrig återanvändas med nya ord utan ett matchande granskat talpaket.

## Var saker ligger

| Fil/mapp | Innehåll |
| --- | --- |
| `policies/social.seed.json` | Versionshanterad startpolicy. |
| `schemas/social.schema.json` | Läsbart formatkontrakt; runtimevalideringen finns i `open-claw/lab/src/social.mjs`. |
| `data/social-policy.json` | Dina sparade sociala inställningar, lokalt och utanför Git. |
| `data/social-history/` | Tidigare policyversioner; den vanliga `project.json` ändras inte. |
| `animations/social-reactions.json` | Syntetisk, ändlig idle → ledsen → händer vid ansiktet → idle. |
| `data/voice-cache/` | MP3 och exakt text/röst/modell/hash, utanför Git. |
| `test/social.test.mjs` | Lokala kontrakts-, lagrings-, cooldown- och integrationsprov med mockade leverantörer. |

Samtalshistoriken hålls begränsad i labbpanelen. Render får den med varje nytt
prov i en separat social session; inget beständigt spelarspecifikt minne har
byggts. OpenClaw kan fortfarande skriva sina vanliga sessionsloggar på Render.
Cooldown och dupliceringsskydd är tillfälliga per lokal serverprocess, inte
ett produktionslås. Vid omladdning/omstart startas ett nytt labbsamtal.

Inga nya nycklar: `LAB_REMOTE_URL`/`LAB_REMOTE_TOKEN` återanvänds lokalt,
`LAB_API_TOKEN` på Director och befintlig modellnyckel på Gateway.
ElevenLabs läses bara på den lokala servern från rotens `.env`.
Blueprinten ligger fortfarande i `open-claw/lab/render.yaml`.
