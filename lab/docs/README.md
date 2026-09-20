# Guide — en gemensam ingång

Jakobs arbetsdokumentation visas i [Guide i labbet](http://127.0.0.1:4188/guide).
Innehållet finns i [guide.json](guide.json); ordlistan hämtas direkt från
[studio-contract.json](../policies/studio-contract.json). Uppdatera dessa,
inte en parallell användarguide eller ett nytt kategorinamn i en enskild vy.

Utvecklarreferenser: [start och arkitektur](../README.md),
[videoformat och lagring](../VIDEO-LIBRARY.md), [videoschema](../schemas/video.schema.json).
Eventgrupperna ska överensstämma med projektets seed och motorns källkontrakt.
Nodträdet grupperar dem efter **idle/bakgrund, engångshandling, exakt tal och
tur/resultat** med `lib/presentation-profile.mjs`; detta är en visningsmodell
över samma sex källtyper och 16 ID:n. Den skapar inte nya motorevents.
Ändrade tekniska ID:n, nya typer eller playback-funktioner kräver ett uttalat
beslut, kontrakt/schemaändring, tester och migrationsbeskrivning. Visningsnamn
kan fortfarande ändras i projektet utan att tekniska ID:n ändras.

Historiska analyser och permanenta källankare ligger kvar i jakob-docs.
De är fördjupning, inte ytterligare en startyta. Privata anteckningar lämnas orörda.

**Händelseloggen** på `/activity` skiljer källa, eventdata, kontext, beslut och
uppspelningskvitto. Den visar aktuella labbanrop och valfri läsande Partner-
observation, högst 150 poster i flikens minne. Saknad konfiguration är inte
en ansluten spelström; observern spelar inget i scenen. Konfiguration och
gränser finns i [labbets README](../README.md#läsande-partner-ström).
På samma yta finns Partner-verifiering, öppning av hela originalspelet,
aktuell videokarta och JSON-export av hela mottagna presentationslistor.
2D ska efterlikna observerad videopresentation. Originalspelarens faktiska
klippstart/slut och kopplingen från launch-rundor till SSE återstår att belägga.

**Socialt svar** är ett eget idle-prov med en enda talägare och högst sex
sekunder ljud. För långa ljud avvisas; avbrott/fel loggas. Modellens uttrycks-
förslag visas separat från neutralt idle. Produktens talväg och riktig
läppsynk är fortfarande separata integrationer. Se [socialt prov](../SOCIAL-CHAT.md).

[Signal- och begreppskartan](../../random-stuff-jakob/jakob-docs/2026-09-20-situationer-variantfamiljer-och-takes.md)
förklarar RNG kontra spelfakta, Partner kontra native-status, de 16 genvägarna,
relevanta situationer och föreslagen gemensam bild-/taluppspelning. Kartan skiljer
nuvarande kod från nästa steg; den aktiverar inte nya funktioner.

Aktuell plan och publicerade läsytor finns i [V4 · åtta arbetsdagar](../../docs/animation-events/v4-8-days-mvp/README.md). Guide beskriver dagens labb; sprintplanens förslag aktiverar inga funktioner.
