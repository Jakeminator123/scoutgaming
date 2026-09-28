# Astrid: register, spelanrop och faktisk uppspelning

Kontrollerat 21 september 2026. Detta är felsökningsunderlag för originalspelet
och 2D-mockupen, inte ett nytt eventkontrakt eller godkännande av filmer.

## Underlag och viktigaste fynd

Jakobs [historiska motorinventering i `Jakobs-v1`](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/random-stuff-jakob/astrid_motorklipp.txt) är identisk som JSON med
Astrid-delen av det tidigare hämtade Generations-API-svaret. Den innehåller
19 motorklipp: **1 idle, 1 action och 17 exakta repliker**, plus 4 staged-
grundtakes och 2 continuations. Inga green-takes registrerades i svaret.

Autentiserade HTTP-kontroller 00:32 UTC gav:

- Grundmanifestet `dealers/astrid/performance/manifest.json`: 200, status draft.
- Alla fyra grundfilmer och båda continuations: HEAD 200, status review i manifestet.
- Alla 19 motorströmmar och de 17 registrerade ljudfilerna: HEAD 200.
- Manifesten för `smooth60` och `rhythm`: 404.
- De native talfilmerna `speech/goodluck.mp4` och `speech/win.mp4`: 404,
  trots att speech-media.json prioriterar dem framför indexets talpaket.

Detta korrigerar intrycket att alla staged-filmer saknas. Den tidigare
testlänken väljer en saknad variant trots att grundmaterial finns. HTTP 200
bevisar endast tillgänglighet, inte avkodning, korrekt kontakt eller läppsynk.
Privata kvitton: `lab/data/observations/2026-09-21T00-10-30-027Z/asset-availability.json`.

Labbet har därför ett uttryckligt testval på Händelselogg: **Testa Astrids
grundfilmer → Öppna staged-grundläge**. Det behåller Partner-identiteten och
väljer Astrid + performance=staged utan motion/scene-överstyrningar. Vanlig
Partner-launch behåller serverns länk. Gör jämförelsen efter avslutad runda.
Grundvalet aktiverar inte automatiskt de två continuations; de är ett separat
`continuity=review`-val i produktkoden. Filmerna är fortfarande granskningsmaterial.

## Tre olika saker som kallas event

1. Spelmotorns interna signaler, exempelvis `round.dealt`, `card.dealt` och
   `dealer.reveal`. Native svaret innehåller publik spelstatus, inte denna
   interna lista eller det hemliga kortets värde före avslöjandet.
2. Partner-presentation: `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
   Partner-table bygger dessa från före/efter-status. SSE-publicering från
   vanliga `/api/table` är fortfarande inte verifierad.
3. Kartans etiketter som `show.line.goodluck` och `show.deal.centre`. De
   skapas av clip-mapping som materialkategorier. De är inte mottagna
   nätverkshändelser eller kvitton på att en film visats.

Den faktiskt hämtade live-klienten använder `/api/table`. Klienten väljer
sin egen koreografi genom funktioner som `voice.say`, `beginDealingTake`,
`deliverCard`, `revealHole` och `finish`.

## Vad som utlöser replikerna i native-klienten

- **greeting:** klick på introduktionens gate-enter, inte bevisat vid varje launch.
- **goodluck:** lyckat start-svar, före delningsförsöket och kortens presentation.
- **sidebet:** klienten upptäcker positiv sidovinst efter första kortdelningen.
- **insurance:** första delningen lämnar spelet i försäkringsfas.
- **double:** servern har accepterat double; repliken föregår det nya kortet.
- **bust:** nytt kort har levererats och den aktiva handen överstiger 21.
- **dealerblackjack, blackjack, dealerbust, win, push, lose:** resultatvalet i
  `finish`, i den prioritetsordningen. Om alla spelarhänder redan bustat
  undertrycks en extra resultatreplik i native-klienten.
- **placebets:** resultatkön är klar, korten har samlats och vänteläget återställs.
- **chatter1, chatter2, farewell, peek:** finns i materialregistret, men inget
  direkt `voice.say`-anrop för dem hittades i den granskade native-rundkedjan.
  Chatten kan välja en exakt `say`-replik som finns i bank.json. Registrering
  bevisar inte att någon sådan chattselektion verkligen sker.

`AUTO_COMMENTARY=false` stoppar automatiska golvkommentarer. Mute, dold flik,
saknat ljud eller upptagen talkö kan dessutom stoppa en begärd replik. En
`voice`-logg är därför ett försök, inte ett startkvitto. `speech end` skrivs
även vid fel; goodluck-404 följt av end utan start är ett sådant exempel.

## Idle och rörelser som inte finns i listan

Endast `idle-1/idle/idle` finns som idle i denna Astrid-karta. Den har 145
bilder vid 24 fps, cirka 6,04 sekunder per cykel. Små rörelser kan ingå i
själva filmen; de behöver inte vara separata events eller variantval.

Native-koden känner också till head-tilt, gesticulate, think och deal-watch,
men de fyra klippen finns inte i denna Astrid-inventering. `trigger` kräver
att klippet finns och är dessutom avstängt i staged-läge. `onIdlePick`
väljer grund-idle i staged-läge även om staged-manifestet misslyckats att laddas.

Den äldre action-deal-strömmen finns, men dealing-cues.json är `rejected`:
användaren avvisade rörelsen eftersom den inte plockar upp från skon. Återställ
inte denna spärr för att bli av med loggen om direkt kortleverans.

Grund-staged väljer vänster/mitten/höger/dealer-take. Spelarkortets faktiska
målpunkt och kalibrering avgör vilken spelartake som passar; inte bara ett
allmänt gestnamn. Pickup/release/land/rest är bildmarkörer inne i filmen.

## Partner-listan är inte en inspelning av native-klienten

Exempel som behöver kontrolleras innan ett 2D-replay byggs:

- Native säger double före kortleveransen; Partner-byggaren lägger nya
  deal-instruktioner före double-repliken.
- Native kan säga bust efter ett kort och sedan avstå extra resultatfras om
  alla bustat. Partner-byggaren beskriver slutresultatet med lose och har
  ingen motsvarande fristående bust-replik i denna kodväg.
- Native använder fanens faktiska målpunkt för staged-filmen. Partner-listans
  clip-preferens är grövre vänster/mitten/höger per box.

Ändra inte spelregler eller välj en av listorna som facit för observerad
uppspelning. Fånga faktisk klientkoreografi och märk eventuell skillnad.

## Vad 2D-labbet redan har och vad som saknas

`playMotion` använder normaliserade keyframes och en explicit `durationMs`
mellan 200 och 10000 ms. Stage kan överstyra längden med asset.durationMs.
Ett namn som "långsamt" ändrar inte tiden. Samma bana kan få annan duration;
en annan handväg eller pose behöver annan rörelsedata. Detta gäller syntetisk
2D-motion, inte godtycklig retiming av inspelat tal.

Stage visar fortfarande ett exempel-event, inte ett beständigt serverbord.
Nästa observation behöver korrelera requestId/version, klientens val och
orsak, faktiskt startad bild, kortlandning och slut/fel. Spara avbrott och
observerade luckor. Lägg inte kort eller filmer i historiken för att fylla
det som saknas i nätverksloggen.

## Källor och verifiering

- Native: `web/public/app.mjs`, särskilt dealSequence, action-handler,
  finish, playRecorded och onIdlePick; `web/public/dealer-engine.mjs`.
- Partner: `web/partner-presentation.mjs` och tidigare hämtad
  `origin/codex/restore-casino-environment:web/clip-mapping.mjs` vid b066a43.
- Labbet: `lab/components/stage.tsx`, `lab/lib/motion-player.mjs` och
  `lab/components/partner-reference.tsx`.
- Live-klientens tidigare hämtade SHA-256 börjar 463ff2a00d92; deployad
  serverrevision är fortfarande okänd. Kodgranskning är inte live-telemetri.
- Testvalets API verifierades live: samma origin, ny session via normal launch,
  slutadress dealer=astrid&performance=staged utan motion, grundmanifest 200.
  Ingen runda spelades och browserns faktiska rendering har inte verifierats
  i detta pass. Ingen mediefil, produktspelare eller acceptansstatus ändrades.
