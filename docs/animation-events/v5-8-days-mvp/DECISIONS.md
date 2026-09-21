# V5 · beslut och rättelser från V4

## Jakobs instruktion · 21 september 2026

Sammanställ dagens arbete, spara/committa/pusha arbetsgrenen och publicera V5
på wiki och sprintwebb. Behåll åttadagarsramen och ge Kevin/Emil genomförbara
leveranser medan Jakob reser. Jakobs OpenClaw-chatt ska äga chatt och vad
dealern säger; Kevin/Emils läppsynklösning ska ingå i denna kedja.

Detta är beslut om arbetets riktning. Det betyder inte att dagens produktkod
redan har en gemensam OpenClaw-talägare, eller att planen är accepterad av
Kevin och Emil. V5 stänger inga CAC-ärenden och beställer ingen betald media.

## Vad som faktiskt ändrats

- V4 beskrev främst exempelprov och en planerad läsande monitor. Nu finns
  Partner-observation, import/export, sekvenssteg och separat lokal playback.
- V4:s uppgift att native `/api/table` inte publicerar Partner-events gäller
  den äldre granskade revisionen. Arbetsgrenen har nu en brygga efter commit
  till verifierad launch-session. Liveversionen är ännu inte fastställd.
- De båda labbytorna delar presentationsbeslut och processlokal återanvändning.
  Detta är ännu inte en distribuerad tal-/playbackkö för produkten.
- Originalförval och exakta talexempel ersätter uppfattningen att de 16
  eventnoderna var 16 färdiga videoklipp. Tur, resultat och kortvändning har
  andra roller än `speak` och ska inte få dubblerat resultattal.
- Backoffice har fått gemensam previewägare och återställning vid sidåterkomst.
  Det är en konkret fix; det äldre rapporterade tvåströmsfelet är inte bevisat löst.
- V5 kompletterar video-kontrakt/schema med de sju grundrepliker som saknades
  i intake: `greeting`, `peek`, `bust`, `sidebet`, `chatter1`, `chatter2`,
  `farewell`. Exakta bindningar till dessa kan nu registreras. Samma 16 noder,
  samma projektformat och samma obligatoriska situation; ingen data migreras.

## Vad dokumentationen rättar

Nytt är en konkret uppladdnings-/triggerguide, artefaktkarta, take-mall,
delad implementationsbrief för OpenClaw-talägarskap och tydliga mål per person.
Ordlistan skiljer dealerlinje från replik, originalförval från visuell acceptans,
variantval från köjobb och beslut från faktiskt uppspelningskvitto.

V4 bevaras med en historikmarkering. Aktiva ingångar pekar på V5. Repo/domän
med `v1` behåller sin adress för att inte bryta publiceringskopplingarna.
Produktmanifest ligger kvar i produkten och länkas från labbets artefaktindex.
Lokala media, credentials och privata loggar följer inte med Git-pushen.

## Fortfarande öppet

Verifierad deploy-revision, verkliga rundposter, originalets playbacktelemetri,
sammanhängande full kortscen, alla platser/splitar, Astrids visuella identitet,
hashbunden läppsynkacceptans och produktens gemensamma chatt-/talkö.
Åttadagarsplanen prioriterar en begränsad fungerande kedja före full täckning.
