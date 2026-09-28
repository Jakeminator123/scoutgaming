# Astrid: valbar kamera och mikrofon

28 september 2026. Status: undersökt förslag, ingen aktiverad inspelning.
Utgångspunkt är Lissabon och `presentation=local`, enbart Astrid.

## Verifierad integrationsgräns

Gateway är låst till OpenClaw 2026.9.5. Den versionens
[HTTP-dokumentation](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/gateway/openai-http-api.md)
beskriver `image_url` i senaste användarmeddelandet, högst åtta bilder och
20 MB sammanlagt. Externa bild-URL:er är avstängda som standard. Dokumentet
beskriver inte rått `input_audio` som ett verifierat ljudkontrakt.

[Externa appar](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/gateway/external-apps.md)
och [Gateway-protokollet](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/gateway/protocol.md)
beskriver även RPC-integration. Den befintliga produktvägen via Director
behålls för denna funktion. [MCP](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/cli/mcp.md)
är inte en förutsättning för att skicka en bild med ett chattmeddelande.

I Croupier är produktkontraktet fortfarande textbaserat:
`src/product-speech.mjs` godtar exakt request-ID, message och history.
Gateway-modellernas seed har `input: ['text']`. Befintligt kontrakt bevisar
alltså inte en fungerande bild- eller ljudväg. Inga modellmetadata har ändrats
för att antyda bildstöd. Ett bildprov mot den driftsatta kedjan återstår.

## Minsta produktflöde

1. **Kamera + mikrofon: Av** som startläge varje sidbesök. Användaren trycker
   Starta för att begära browserbehörighet. Visa lokal förhandsbild, mikrofon-
   nivå, mottagare och tydlig Stoppa-knapp.
2. Räkna faktisk talaktivitet med VAD. Ta en liten bild efter cirka tre
   sekunders ackumulerat tal och en vid observerat slut/Stoppa. En paus får
   inte behandlas som ett förutspått framtida slut. Kortare tal ger bara
   slutbild. Inget tal ger inga bilder att skicka.
3. Visa transkription och högst två bilder före sändning. **Skicka till Astrid**
   är samtycke för just detta meddelande. Transkription måste ha en vald,
   testad källa; saknas stöd visas det och vanlig textinmatning är kvar.
4. Kamera och mikrofon stängs vid Stoppa, avslag, timeout, bakgrundsflik,
   navigation, profilbyte och utloggning. Sena callbacks får inte återstarta
   enheten eller skicka material från en tidigare profil.

## Föreslaget kontrakt, ännu inte implementerat

- Utöka endast produkttal med ett valfritt `observation`-fält: version,
  turn-ID, uttryckligt samtycke för turn-ID och två ordnade JPEG-bilder.
  Max 384 px längsta sida, 64 KiB per bild, 128 KiB totalt avkodad data.
  Server och Director verifierar faktiskt format/dimensioner, antal och byte-
  gränser. Enbart data-URL; inga externa URL:er eller klientvald Gateway-roll.
- Acceptera endast från autentiserad aktuell Astrid-session, samma origin,
  med oförändrad profil-/rundrevision. Befintlig speech-token och verktygslösa
  `croupier-speech` används. Probe får aldrig utlösa kameran.
- Bilden är spelarens frivilliga observation, inte bevis för kort, saldo,
  identitet eller andra personers känslor. Serverns spelresultat har företräde.
  Begär inte skärmdelning eller dolda kort. Inga råbilder/råljud i Croupiers
  spelarminne, Git eller vanliga requestloggar.
- Innan liveprov: verifiera vald modells bildförmåga och Gatewayns hantering
  av sessionsfiler/bildbilagor. OpenClaws leverantörs-/sessionslagring är inte
  automatiskt avstängd bara för att Croupier inte sparar materialet.
- Behåll en separat featureflagga Av tills hela vägen och lagringsgränsen är
  kontrollerade. Ingen bredare MCP-, fil- eller operatörsbehörighet behövs.

## Acceptans innan aktivering

Testa med syntetisk videokälla och injicerad VAD/klocka: 0 s tal, mindre än
3 s, längre tal, paus, slut, Stoppa, sen callback, enhetsfel, nekat tillstånd,
timeout, flikbyte och profilbyte. Kontrollera maximalt två bilder och stoppade
tracks. HTTP-tester ska avvisa fel MIME/bytes/dimensioner, mer än två bilder,
saknat samtycke, fel profil och externa URL:er. Av får varken begära tillstånd
eller ändra vanlig chatt/Probe. Ett syntetiskt bildprov måste därefter nå rätt
modell i drift innan någon verklig kamera används.
