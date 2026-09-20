# Systemkarta för Jakob

En läsväg genom projektet, sammanställd 20 september 2026 med lokal
källrevision `c0a5681` som ursprungligt ankare. Senare dokumentationsöversyn
vid `bf4e82e` har tillfört röstpanel/runtimepaket och loaderfynd samt
arkiverat arbetsrapporter; detaljer finns i [källregistret](KALLOR.md). Mapparna här
sorterar **dokumentation efter systemdel**. Produktkod, JSON-register och
mediefiler ligger kvar där de används; länkarna leder till originalkällorna.

Börja med [Jakobs situationer, variantfamiljer och takes](../2026-09-20-situationer-variantfamiljer-och-takes.md).
Det förklarar den önskade mappkänslan och varför ett event kan behöva täcka
många situationer. [Det fullständiga eventregistret](../2026-09-20-eventregister-och-mental-modell.md)
samlar namn, fält, triggers och förslag till serialisering.

```text
systemkarta/
├── 01-spelmotor-och-data/       Vad spelet bestämmer och publicerar
├── 02-events-triggers-urval/    Vad som ska visas och vilka uttryck som får väljas
├── 03-dealers-video-takes/      Vilka inspelningar som kan utföra uppgiften
├── 04-studio-json-och-lagring/  Hur labbet redigerar och sparar register
├── 05-openclaw-rost-och-drift/  Modellråd, röstprov och tjänsternas ansvar
├── 06-arbetssatt-och-verifiering/ Källor, samarbete, test och acceptans
└── KALLOR.md                   Lästa underlag, kodkontroller och avgränsning
```

| Fråga | Börja här |
| --- | --- |
| Varifrån kommer kort, rådata och de tio interna händelsetyperna? | [Spelmotor och data](01-spelmotor-och-data/README.md) |
| Vad är skillnaden mellan sex presentationstyper, 16 noder och en trigger? | [Events, triggers och urval](02-events-triggers-urval/README.md) |
| Behöver box 3:s första och andra kort olika videor? | [Dealers, video och takes](03-dealers-video-takes/README.md) |
| En JSON-fil eller många; schema eller faktiska poster? | [Studio, JSON och lagring](04-studio-json-och-lagring/README.md) |
| Vad gör OpenClaw, ElevenLabs och Render faktiskt? | [OpenClaw, röst och drift](05-openclaw-rost-och-drift/README.md) |
| Vilken dokumentation gäller och vad är verifierat? | [Arbetssätt och verifiering](06-arbetssatt-och-verifiering/README.md) |
| Vilka buggar och förbättringar är öppna? | [Repoövergripande findings](../../../docs/findings/README.md) |
| Vad gjordes och testades i en tidigare uppgift? | [Arbetsrapporter i arkivet](../arkiv/README.md) |

**Läs statusen bredvid påståendet.** Här betyder **kodkontrollerat** att den
lokala implementationen/data har lästs; **labb** beskriver den isolerade
studion; **förslag** är ännu inte infört. **Tidigare verifierat** hänvisar
till ett daterat prov i källan, inte till en ny kontroll av dagens drift.

Blackjack är implementerat. Roulette är en framtida plats i gränssnittet.
Fyra dealers finns. De 256 variantposterna och 64 syntetiska rörelserna
beskriver labbets startprojekt, inte antalet godkända dealerfilmer.

Kartan sammanfattar systemet och länkar till kontrakt och daterade
arbetsrapporter. [Källor och kvarstående glapp](KALLOR.md) redovisar vad som
lästes och vad denna dokumentationsgranskning inte har verifierat. Öppna
problem följs i findings; deras arbetsrapporter kan arkiveras utan att
problemet därmed betraktas som löst.
