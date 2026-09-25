# S05 · ord som betyder samma sak i alla ytor

V5 ändrar förklaringar och fyller luckor i ordlistan. Vi byter inte de sex
källtyperna eller de 16 tekniska event-ID:na. Labbets centrala ordlista finns
i `lab/policies/studio-contract.json` och visas i Guide.

## Spel och presentation

**RNG:** slumpdelen i den auktoritativa spelmotorn. Labbets presentationsslump
väljer bara uttryck och påverkar inte kort eller vinst.

**Signal:** samlingsord för indata, till exempel publika spelfakta, chatt,
kontext eller spelarstatus. Allt är inte ett Partner-event.

**Presentationsinstruktion / event:** här en instruktion av de sex typerna
`speak`, `deal`, `reveal`, `turn`, `settle`, `idle`. Motorn och klienten har
fler interna signaler än så.

**Eventgrupp / nod:** en av labbets 16 genvägar. Inte en universell videofil.
**Situation:** exakt replik, kortdestination eller andra relevanta omständigheter.
Dagens klassificering beskriver inte ännu hela hand-/kortpositionsdomänen.

**Native:** den vanliga spelklientens status-/kommandoväg. **Partner:** API,
launch och presentationsström per nyckel/spelare. **Live:** faktiskt driftsatt
kod och media; inte ett annat ord för Git-branchen `main`.

## Linje, variant och take

**Linje:** en dealers behållare för standard och alternativ inom en eventgrupp.
**Standard:** den ovillkorliga reservvarianten. 16 grupper × fyra dealers ger
64 standardlinjer, inte 64 unika filmer.

**Replik / line-ID:** exakt talinnehåll, exempelvis `greeting`. Ska inte blandas
ihop med en dealerlinje som `astrid.speak.other` med flera möjliga repliker.

**Variant:** ett valbart uttryck med egna urvalstillåtelser och triggers.
Idag en videoreferens och 2D-reserv; takepooler är inte införda.
**Take:** en konkret inspelad/genererad tagning med identitet och revision.
**Videofil:** materialbytes med ID/hash; en fil kan vara rå, avvisad eller granskad.

**Originalförval:** exakt registrerat lokalt produktmaterial som standard kan
använda utan egen videokoppling. Det bevisar inte livebindning eller kvalitet.
**2D:** mockup av rörelse och presentation, inte bevis för läppsynk.

## Villkor och register

**Trigger:** extra villkor för en variant. Alla valda villkor måste matcha.
Tom lista betyder inga extra krav. Triggers skapar inte ett nytt spel-event.
**Urvalstillåtelse:** får varianten väljas av regler, OpenClaw eller presentationsslump?
Alla av betyder manuell preview, även om triggerlistan är tom.

**Schema:** formatets tillåtna fält och värden. **Policy:** regler för urval
och beteende. **Manifest:** register över identiteter, mediareferenser och
metadata; det är inte en logg över vad som faktiskt spelats.
**Familj:** manifestets exakta urvalsgrupp. Aktuellt schema 2 har 26 familjer:
åtta deal, sjutton speech och en idle. **Vikt:** relativ urvalsparameter, inte
ett uppmätt löfte om faktisk trafikandel. **Idle-bas / idle-variant:** två
roller i produktens idlepolicy; de ska inte blandas ihop med labbprojektets
standard och högst fyra alternativ.
**Klassificering:** operatörens uppgift om dealer/event/situation, knuten till
material. **Bindning:** vald koppling mellan variant/produktplats och material.
**Acceptans:** dokumenterad granskning av just den revisionen/taken.

## Beslut, kö och bevis

**Director:** mellanled för validerade presentationsbeslut. **Operatörsroll:**
hjälp och drift, inte dealer-dialog. **Socialt prov:** avgränsat labbexperiment.
**Produktspeech-roll:** `openclaw/croupier-speech`, byggd och lokalt testad för
dealer-dialog men ännu inte driftsatt. Gateway-åtkomst är inte i sig färdig
produktintegration.

**Besluts-ID:** identifierar ett variantval. **Källreferens:** korrelerar
ursprungligt spel-/chattunderlag. **Köjobb:** en uppspelningsavsikt som ska ha
en ägare och ett avslut. Dessa identiteter har olika livslängd.

**Deduplicering:** skydd mot samma instruktion eller beslut flera gånger.
Lokal cache är inte automatiskt deduplicering av uppspelning i hela systemet.
**Uppspelningskvitto:** faktiskt observerad start, slut, cue, avbrott eller fel
från spelaren. Ett modellförslag eller filval är inte ett sådant kvitto.

**Läppsynkpaket:** exakt text, ljud, video, index, kalibrering och acceptans
som hör ihop. Läppsynkkomponenten utför det godkända talet; den äger inte en
egen konkurrerande dialog. **Review** betyder under granskning, inte godkänd.
