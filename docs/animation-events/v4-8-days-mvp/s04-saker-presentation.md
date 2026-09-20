# S04 · uppspelning och acceptans

> Ett godkänt urval är inte bevis på godkänd uppspelning.

## Tre skilda kvitton

1. **Källan stämmer:** rätt kodväg, publicerade fält, dealer och situation.
2. **Materialet stämmer:** exakt take, rätt status, bytes/hash, text/ljud och
   nödvändig kalibrering. `want` och katalogförekomst är inte livegodkännande.
3. **Uppspelningen stämmer:** verklig spelare, rätt ord och mål, synk, avslut,
   återgång och nästa uppspelning. Anteckna resultat och kvarvarande fel.

En taländring är ett sammanhängande paket: **exakt text + inspelat ljud +
video + frame-index + kalibrering + acceptansanteckning**. Nya ljud- eller videobytes
ogiltigförklarar tidigare visuell acceptans. Varken hash, vågform eller testpass
bevisar korrekt läppsynk.

Vid media-/spelarändring gäller repots befintliga kontroller:
`node pipeline/audit-dealer-sync.mjs --probe`, testerna i `.githooks/pre-commit`
och rehearsal för **Astrid, Vera, Amira och Mei**, med två på varandra följande
uppspelningar. Alla fyra ska behålla den gemensamma spelvägen.

## Föreslås: en ägare av dealer-talet

Spelrepliker och sociala svar behöver en gemensam styrning av start, avbrott
och avslut så att ljud och bild inte konkurrerar. Produktens befintliga chatt
och det nya sociala labbprovet är ännu separata. V4 beskriver samordningen som
ett integrationsförslag, inte en färdig talkö.

Dynamiskt labbtal tillsammans med en 2D-gest är ett uttrycksprov. Det är inte
en godkänd kombination med produktens inspelade talvideo.

## Gränsen som gäller hela tiden

Presentation och modellråd får inte ändra kort, regler, tur, wallet eller
utbetalning. Fel och sena modellsvar ska ge en kontrollerad reserv; detta ska
provas i vald integration. Testa i isolerad server/databas med annan hostname.
Öppna fynd följs i Jira CAC; en grön dokumentationssida stänger dem inte.

Nästa: [Ordlistan](s05-ordlista.md). Källor: [acceptans och kända gap](RUNTIME-EVIDENCE.md).
