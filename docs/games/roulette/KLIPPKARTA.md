# Roulette: signaler, filmfack och lager

[Rouletteguiden](README.md) · [Teknisk referens](TEKNIK.md) · [Krav på utfallsbank](UTFALLSFILMER.md).

## Separation mellan spelen

En dealer behåller samma dealer-ID i båda spelen, men blackjack och roulette har egna filmfack, händelsekartor och bordsgeometrier. Roulette registreras med `game: roulette` och exakta `roulette.*`-fack; blackjackens `idle.ready`, `speak.goodluck`, utdelningar och skosekvenser används aldrig som reserv. `dealerSets` väljer inte spel.

Bakgrunder kan återanvändas mellan rum; samma bakgrund gör inte två rum till ett. Bord registreras med ett beständigt spelval; äldre otaggade bord räknas som blackjack. Se [ordlistan](../../../apps/studio/docs/TERMINOLOGI.md).

## Signaler och reaktion

| Källa | Finns i dag | Presentation |
| --- | --- | --- |
| Rummet öppnas, `op: state` | Serverläget läses | Vila, valfri hälsning |
| Marker läggs, tas bort, ångras | Lokalt utkast; ingen motorsignal per klick | Behåll vila |
| Spela, `op: spin` | `requestId`, version, valuta och satsningar sparas före anropet | Lås kontroller, vänta på kvitto |
| `roulette.spin.resolved` | Serverevent i sparat rundkvitto med nummer, färg och avräkning | Resultatet är redan offentligt; ingen hemlig filmfas |
| Accepterad satsning (pending) och serverns reveal | Saknas; se [utfallskraven](UTFALLSFILMER.md#resultatsekretess) | Neutral rörelse före reveal, korrekt avslut efter |
| Ny runda | Personliga rundor, ingen nedräkning | Tillbaka till kompatibel vila |
| Nät- eller mediafel, återläst kvitto | Exakt återförsök finns | Samma runda, aldrig ny dragning; textresultat om film saknas |

`round.wagered`, `returned`, `net`, `balanceAfter` och valuta kommer från servern. `roulette_bet` och `roulette_payout` är bokföringsposter, inte klienttriggers. Filmavslut ändrar aldrig pengarna.

## Klippkartan i Admin

Öppna `/admin/clips`, välj bolag, **Roulette**, rum och dealer.

| Kort | Fack och filtyp | Läge |
| --- | --- | --- |
| Vila | `roulette.reference/VILA`, PNG med alfa | Bara lokalt bildprov; native-registret avvisar PNG (`studio_media_content_type_unsupported`) |
| Vänta | `roulette.idle/breathing`, MP4/WebM | Registrerar dealerns vila |
| Vänta, variant | `roulette.idle/glasses-clean`, MP4/WebM | Registrerar lugn variation |
| Starta | `roulette.wheel-start/wheel-start`, MP4/WebM | Registrerar hjulgest, poser initialt overifierade |
| Insatser, Hjul, Resultat | Talset, 37 slutlägen, resultatreaktion | Planerade; ingen uppladdning innan kontraktet finns |

Registrerat är inte spelkopplat. Spelkopplingen sker i rummets publicerade `rouletteIdle` och `rouletteStart` (se [rouletteguiden](README.md#scen)). Dealer stöder grön MP4 eller verifierad alfa-WebM med `compositing: {mode: "alpha"}`; servern kontrollerar alfamarkering och webbläsaren avkodar början, mitten och slutet före uppladdning. Tre stickprov bevisar inte alla rutor, hårkanter eller handkontakt. Bakgrund och bord stöder PNG, JPEG, WebP, MP4 och WebM. En bordsvideo är ett scenlager som loopar, inte en utfallsfilm.

Saknas VILA visar editorn första korrekt registrerade vila för samma dealer och roulette, sorterad på media-ID. Det är en förhandsvisningsreserv, inte acceptans; saknas även vila lånas inget blackjackklipp.

## Återstår före spelkoppling

- Sekvenskö med prioritet, samma rund-ID vid återförsök, säker avbrytning vid kontobyte och skydd mot dubbel start. Markerändring startar aldrig hjulgesten.
- Hashbunden pose, handmask och kulsläppsruta samt en 37-utfallsbank med slutbilder; utfallsfilmer behöver en engångsspelare som håller slutrutan.
- Separat roulette-talset med exakt text, ljud, video och läppsynkgranskning.
- Två sammanhängande spelningar i den riktiga spelaren på mobil och desktop, reducerad rörelse, mediafel, tappat kvitto och omladdning.
