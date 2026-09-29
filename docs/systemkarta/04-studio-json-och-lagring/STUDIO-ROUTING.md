# En Studio, ett Astrid-spel och flera tekniska strömmar

[Systemkartan](../README.md) · [Användarguide](../../../lab/docs/README.md) ·
[Aktuell molnstatus](../../CLOUD-CURRENT-STATE-2026-09-29.md)

**Använd Astrid Studio på `/studio` i molnet.** Vercels Studio-länk öppnar
samma Render-arbetsyta. Välj **Öppna spelet**, spela och chatta i spelfliken
och konfigurera klipp i Studio. **Anslut & följ spelet** är valfritt och
lägger till observation i Studio när Partner-anslutningen är konfigurerad.
BO används för administration och inloggning.
Studio väljer aldrig BO:s diagnostiska spelöppning som en andra Astrid-ström.

## Adresser och namn

| Yta | Molnet på Render | Lokalt på det koordinerade paret |
| --- | --- | --- |
| Astrid Studio | `/studio` | Lab-serverns `/` |
| Uppladdning och bibliotek | Välj **Ladda upp & bibliotek** i Studio | Samma flik |
| Bakgrundszoner | `/studio/zones` | `/zones` |
| Guide | `/studio/guide` | `/guide` |
| Avancerat labb, alla dealers | `/studio/tree` | `/tree` |
| Astrids anslutna spel | Studio öppnar spelet med `dealer=astrid&presentation=local` | Samma presentationsval på spelservern |
| Spel utan Studio-observation | `/blackjack` öppnar vanlig spelarinloggning och samma Astrid-presentation | Ordinarie lokal spelflik |
| BO-administration | `/bo/` med egen inloggning | Spelserverns `/bo/` |

`Lab` är kodmappens och de tekniska API:ernas namn. `Lissabon` är det äldre
namnet på det samlade arbetsflödet. Den privata datamappen kan fortfarande
heta `lissabon/data`; startaren återanvänder den utan att flytta sparade data.
Det interna lane-id:t `lissabon-stream-lane` är ett kompatibilitetskontrakt,
inte en annan stream som användaren ska välja.

På Render i single-origin-läget omdirigeras exakt `/lab`, `/studio-astrid`
och `/studio-lissabon` (även med avslutande snedstreck) till `/studio`.
GET och HEAD behåller query-parametrar. Aliasens underadresser och
skrivanrop skapar inga nya API-ingångar. `/studio/api/...` behåller den
vanliga Lab-autentiseringen. Vercels äldre `/labb-lissabon` är en
övergångslänk; navigeringen visar en enda Studio-ingång.
Inne i Lab omdirigerar `/lissabon` till startsidan, alltså
`/studio/lissabon` → `/studio` i molnet.

## Vad menas med ström?

| Flöde | Uppgift | Vad det bevisar |
| --- | --- | --- |
| Spelets server-API | Äger kort, sko, saldo och utbetalningar. | Serverns accepterade spelstatus; ingen klient får ersätta den. |
| Spelflikens observation till Studio | Förmedlar samma fliks publika status, chatt och uppspelningskvitton. Astrids ordinarie flöde. | Vad den anslutna spelaren faktiskt rapporterar startat/slutfört. |
| Partner-SSE | Kompletterande presentationsinstruktioner för avancerad jämförelse och integration. | Mottagna instruktioner; öppen anslutning bevisar inte speltrafik eller visad film. |
| Talvideo via WebSocket/RunPod | Skapar och överför ljud och bild för ett exakt genererat svar. | Levererade paket och spelarens kvitton; kvalitet/läppsynk kräver egen granskning. |
| MP4/Blob via Range-läsning | Levererar en sparad klippfil till spelaren. | Tillgängliga byte/hash; inte godkänd rörelse eller läppsynk. |
| Valfri bilddelning | Visar en vald fliks bild i avancerat labb. | Bild från den valda fliken, inga serverfakta eller klipp-ID:n i sig. |

Astrid spelar på den gemensamma presentationsvägen med studions sparade
klippfamiljer och policy. Standard, Slump, Regler och OpenClaw är val av
klippurval inom samma väg. Probe och fri chatt är separata talbeslut; de
skapar ingen ny spelmotor. Övriga dealers och deras befintliga gemensamma
uppspelning är oförändrade.

## Kodankare och kontroll 29 september 2026

- [Gateway](../../../ops/cloud/gateway.mjs) monterar `/studio` och hanterar
  dokumentalias. [Aliasregressionen](../../../ops/cloud/test/studio-aliases.test.mjs)
  provar query, metoder, värdgräns, underadresser och verklig auth-kedja med
  isolerade HTTP-fixtures som stängs efter testet.
- [Studioingången](../../../lab/app/page.tsx) visar den gemensamma
  [Astrid-vyn](../../../lab/components/lissabon-studio.tsx).
  [Anslut](../../../lab/components/partner-reference.tsx) väljer exakt
  `presentation=local` för Astrid. Den fokuserade vyn visar ingen alternativ
  diagnostisk launch eller BO-videokarta; de ligger i avancerat labb.
  Molnstudions **Öppna spelet** använder samma ursprungs `/blackjack` och
  kräver inga Partner-nycklar. En redan öppnad spelflik återanvänds utan
  navigering; byte till observation får vänta tills den har stängts efter
  avslutad runda.
- [Händelseloggen](../../../lab/components/activity-log.tsx) följer
  spelfliken i fokuserat läge och startar ingen parallell Partner-SSE där.
- [URL-hjälparen](../../../lab/lib/lab-url.mjs) ger samma interna länkar och
  API-adresser på lokal rot och molnets `/studio`.

Riktade kontroller av gateway, auth, URL:er och observation gav **58/58 PASS**;
hela Lab-sviten gav **525/525 PASS**. TypeScript och produktionsbygge med
molnets `/studio`-mount passerade. Länkkontrollen för sju ändrade aktiva
dokumentsidor hittade inga saknade mål bland 116 lokala länkar.
Detta är kod-, bygg- och fixturebevis. Publicerade alias och Studio-vyn
kontrollerades därefter enligt [handoffens kvitto 16:32 UTC](../../JOHN-HANDOFF.md):
korrekta 307-omdirigeringar, 401/no-store för obehöriga Studio-API:er och
spelöppning med återanvänd spelflik. Det är navigerings- och åtkomstbevis;
visuell medieacceptans kräver fortfarande egen granskning.
Inga media, policies, privata data eller serverprocesser har bytts av denna
förenkling. Äldre daterade driftkvitton bevaras som evidens; den aktiva
[dokumentordningen](../06-arbetssatt-och-verifiering/DOKUMENTORDNING.md)
anger vilken källa som ska uppdateras framöver.
