# 06 — Vad är OFF, och hur blir en lane produktionsklar?

## Syfte och mål

Förklara avstängda funktioner utan att blanda ihop QA-skydd, kamera,
administration och äldre mediearbete. Beskriv en kontrollerad väg från
provad mobil-/dealer-/spellan till aktiv gemensam spelpolicy.

## Faktiskt avläst Render-konfiguration den 4 oktober

Produktionens avlästa kod var `bee4e04a`. Tabellen är en konfigurationsavläsning,
inte ett nytt betalt uppspelningsprov.

| Flagga | Produkt-Render | QA-Render | Betydelse |
| --- | --- | --- | --- |
| `CROUPIER_GENERATED_SPEECH` | `1` | `0` | Genererat tal |
| `CROUPIER_CLOUD_GENERATED_SPEECH` | `1` | `0` | Tillåtelse för molnets talflöde |
| `CROUPIER_GENERATED_SPEECH_STREAMING` | `1` | `0` | Tal-/GPU-strömtransport |
| `CROUPIER_ASTRID_CAMERA` | `0` | `0` | Astrids kamera/mikrofonfunktion är av |
| `CROUPIER_STUDIO_NEON_POLICY` | `1` | `1` | Gemensam sparad policy inom respektive isolerat scope |
| `CROUPIER_STUDIO_NATIVE_ADMIN` | `0` | `0` | Render ska inte vara den native administrativa UI-tjänsten |
| `CROUPIER_P6_QA_ROUTER` | Inte satt | Inte satt | Den särskilda provroutern är inte aktiv |

Native administration körs på Vercel-Studio enligt migrationsverifieringen;
Render-admin OFF betyder därför inte att Backoffice är avstängt.

QA hade 37 miljövariabler och saknade Cartesia-/RunPod-nycklar. **OFF37 betyder
37 bevarade miljövärden, inte 37 avstängda funktioner.** QA:s gamla journaler,
reservationer, SDK och disk har behållits.

## Vad krävs för aktivering?

- **QA AI:** ett avgränsat provfönster med befintlig budget/journal, avsedda
  credentials och samtidighetsskydd samt återställning till OFF. Ingen
  automatisk aktivering bara för att en agent läser planen.
- **Kamera/mikrofon i produktion:** kontrollera avsedd funktion och provider,
  konfiguration, spelarens samtycke/enhetsbehörighet samt faktiskt kamera-/
  mikrofonprov. Historisk aktivering den 29 september bevisar inte dagens ON-läge.
- **Render native-admin:** ska inte slås på för att ”starta BO”; ansvarsfördelningen
  är Vercel-Studio för administration och Render för spelauktoritet.
- **Kevin-/Emil-material:** inventera konkreta clip-ID:n, register, talpar,
  calibration och acceptance. Ett namn i proveniens är ingen funktionsflagga.

## Lanes: rimlig målbild med tydlig gräns

Jakobs idé är rimlig: det som provas i Studio ska kunna bli en registrerad,
godkänd väg i produktionen, exempelvis annan dealer eller mobilanpassad
uppspelning. Studio är redigering/prov och sparad policy; det riktiga spelet
är uppspelningsvägen. Historisk BO-preview ska inte bli en separat motor.

Inventera först vilket stöd som redan finns i
[presentationskontraktet](../../docs/LOCAL-PRESENTATION-RUNTIME.md),
[spelpolicyn](../../web/storage/studio-game-policy.mjs) och medieregistren.
Nuvarande `lissabon-stream-lane` är ett befintligt kontraktsnamn. Dess existens
bevisar inte en färdig generell lane-marknadsplats eller stöd för ett nytt spel.

### Föreslagen kontroll per lane

1. Namn/version, syfte, dealer/spel/enhetsstöd och avgränsade kontrakt.
2. Exakta registrerade medier: text, ljud, video, hashar, frame-/posegränser,
   kalibrering och godkännande. Ingen ungefärlig tidsmatchning eller loopat tal.
3. Samma autentisering, serverägda spelresultat och beständiga policy som produktionen.
4. Prov i riktig spelare: två följande plays, avbrott, återanslutning,
   relevant mobil/webbläsare och kontroll av andra berörda dealers.
5. Tydligt utkast/testat/godkänt/aktivt/tillbakadraget läge och återgång till
   föregående godkända policy. Återanvänd nuvarande revisioner/approval där möjligt.

Ett nytt spel kräver även spelregler, serverauktoritet och egna acceptansfall;
det kan inte godkännas enbart genom att nya klipp visas rätt.

## Färdigt när

Kartan visar varför en funktion är OFF och vem som äger dess aktivering.
En konkret befintlig lane går att följa från Studio-save till produktionens
spelare. Eventuellt saknat stöd är namngivet som framtida implementation,
utan att en ny generell arkitektur införs i detta efterarbete.
