# S04 · OpenClaw äger talet, läppsynken följer beslutet

**Beställd integration:** Jakobs OpenClaw-spår ska äga persona, chatt och vad
dealern säger. Det är riktningen för produktarbetet. Dagens labbval är fungerande
delar, men produktens samtliga talproducenter har ännu inte konsoliderats.

## Ansvar mellan Jakob, Kevin och Emil

**Jakob/OpenClaw:** samtalslogik, tillåtet text-/replikval, tystnad och avsedd
ordning/prioritet inom presentationspolicyn. Operatörschatten ska hållas skild
från den spelarchatt som äger dealer-dialogen.

**Kevin:** adapter mellan publika spelfakta, chatt, OpenClaw och befintlig
runtime; kontraktsvalidering, en gemensam talkö, avbrott och verkliga kvitton.
Inventera gamla `sayLine`, `voice.say`, produktens `/chat` och eventkommentarer.
Stäng av konkurrerande text-/replikägare när den nya vägen aktiveras.

**Emil och Kevin:** exakt matchande tal-/videopaket, läppsynk, format,
kalibrering och visuell acceptans. Läppsynklösningen utför talbeslutet;
den blir inte en andra agent som skriver om dialogen.

Servern behåller alla kort, legal actions, pengar och utfall. Modellen får
inte ändra spelordningen eller utlova ett annat resultat.

## Ett beslut och en kö

Återanvänd befintlig Director/Gateway, speech-queue.mjs och samma spelarväg för
alla fyra dealers. Produktens speltriggers och /chat använder redan klientkön,
men deras text-/replikbeslut har flera ägare. Integrationen konsoliderar ägarskapet
och utvecklar köns korrelation/livscykel; den börjar inte med en ny parallell kö.
Talbeslutet behöver ett validerat utfall: exakt tillåtet `recordedLineId`,
kort `generatedText` eller `silence`. Dessa är mål för integrationskontraktet;
dagens variantbesluts-API är inte redan ett färdigt sådant tal-API.

Alla spelrepliker och chattsvar ska gå genom samma köimplementation. Kevin
äger dess tekniska livscykel, OpenClaw dess godkända samtalsbeslut. Käll-ID,
besluts-ID, materialrevision och avbrottsscope följer varje jobb. Ett jobb får
exakt ett terminalt resultat: klart, avbrutet eller fel. Retry/HTTP+SSE ska
inte skapa ett andra jobb. Flera flikar/processer kräver uttrycklig hantering;
labbets beslutscache löser inte detta åt produkten.

Vid dealerbyte, gammal rundversion, navigation, mute eller mediafel ska kön
städa ljud, video, decoder, captions och timers enligt vald produktpolicy.
OpenClaw-fel ger uttrycklig tystnad eller avtalad reservpolicy, inte en dold
äldre chattagent som börjar prata.

## Exakt läppsynkpaket

Inspelat tal binds som ett paket: line-ID, exakt text, ljud och hash, video och
hash, frame-index/fps, audio delay, mask/kalibrering, proveniens och review.
Byte av ljud/video gör tidigare visuellt godkännande ogiltigt för den taken.
Ändrad text måste också följa paketet och granskas.

Välj aldrig film efter ungefärlig längd eller liknande känsla. En gammal mun
får inte spelas till ny OpenClaw-text. För fri text behövs en verkligt matchande
läppsynklösning; tills den finns används tydligt neutral idle/2D eller tystnad
enligt policy. Den reservvägen får inte marknadsföras som läppsynkad.

Börja med ett litet inspelat paket för hela kedjan. Gör dynamisk läppsynk till
ett separat mätbart prov med vald leverantör, latenstid, avbrott och kvalitet.
Den här planen väljer inte leverantör och beställer ingen betald generering.

## Godkännande kräver mer än filnärvaro

Skilj på: kommando committat, instruktion mottagen, beslut validerat, material
upplöst, första frame/ljudstart, landning/cue samt avslut eller avbrott.
API 200, hash, waveform eller modellens text är inte bevis för det sista steget.

Vid media-/spelarändringar gäller repots audit och pre-commit-kontroller.
Granska Vera, Astrid, Amira och Mei i den faktiska rehearsal-spelaren med två
plays i följd. Lyssna och titta genom hela den ändrade repliken. Uppdatera
baseline först efter dokumenterad per-take-granskning; regenerera inte andra
godkända assets som bieffekt.

Astrids avsedda visuella identitet och full läppsynk är fortfarande öppna
acceptanspunkter. Tidigare lifecycle-prov på alla fyra dealers är värdefulla,
men bevisar inte att varje replik ser rätt ut eller har rätt person.

## Utvecklingsuppdraget

[Labbets implementationsbrief](../../../lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md)
innehåller kontrakt, ägarskapsinventering, deduplicering, felprov och handoffkrav.
Det ersätter beroendet av en privat chattprompt. Använd isolerad databas och
annan hostname för gameplay-QA. [Sjudagarsplanen](s06-plan.md) prioriterar
leveransen och talar om vad som kan lämnas öppet.
