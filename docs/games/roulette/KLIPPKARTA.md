# Roulette: signaler, filmfack och tre lager

Kodgrund kontrollerad 13 oktober 2026 på `54522581`. Tilläggen nedan hör till
`codex/roulette-clip-map`; detta är inte ett kvitto på produktionspublicering.
[Spelmanual](README.md) · [Motorkontrakt](TEKNIK.md) · [37 utfallsfilmer](UTFALLSFILMER.md).

## Ägarskap och separation

En person, exempelvis en känd dealer, behåller samma dealer-ID i båda spelen.
Blackjack och roulette har egna filmfack, händelsekartor och bordsgeometrier.
Ett filnamn, personnamn eller lika lång film gör inte klippen utbytbara.
Roulette registreras med `game: roulette` och exakta `roulette.*`-fack;
blackjackens `idle.ready`, `speak.goodluck`, givning och skosekvenser får inte
användas som roulette-reserv. Uppsättningsnamn (`dealerSets`) väljer inte spel.

Bakgrundsfiler kan återanvändas. Rum behåller bolagets ägarskap, behörigheter
och speltyp; samma bakgrund gör inte två sparade rum till samma rum. Bord
registreras med ett beständigt spelval. Äldre otaggade bord behålls för
blackjackkompatibilitet men räknas inte som roulettebord. Kända designhashar
kan inte märkas om. Se [gemensamma ordlistan](../../../lab/docs/TERMINOLOGI.md).

## Faktiska signaler och föreslagen reaktion

| Källa | Finns idag | Presentation |
| --- | --- | --- |
| Rummet öppnas, `op: state` | Serverläget läses; ingen buy-in | VILA/idle, valfri hälsning |
| Marker läggs, tas bort, ångras, återläggs | Lokalt utkast; ingen debitering eller motorsignal per klick | Behåll idle; eventuell kort bekräftelse begränsas i frekvens |
| Spela, `op: spin` | Samma requestId/version/valuta/satsningar sparas före anropet | Lås kontroller och vänta på kvitto |
| `roulette.spin.resolved` | Serverevent i ett redan sparat rundkvitto, nummer/färg samt avräkning | Starta dealerhandling en gång per spelare/bolag/rum/rund-ID |
| Kulsläppsruta | Behöver kalibreras i rätt filhash | Starta rätt 0–36-film i hjulspåret |
| Filmens stopp/resultatruta | Behöver implementeras | Håll rätt slutbild; resultatannonsering och eventuell nettoreaktion |
| Ny runda | Personliga rundor, ingen gemensam nedräkning | Tillbaka till kompatibel vila |
| Utträde | Ingen separat cash-out i roulette | Valfritt farväl vid ordnat utträde; flikstängning garanterar inget klipp |
| Nät-/mediafel eller återläst kvitto | Exakt återförsök finns | Samma runda, aldrig ny dragning/debitering; textresultat om film saknas |

`round.wagered`, `returned`, `net`, `balanceAfter` och valuta kommer från
servern. `roulette_bet` och `roulette_payout` är bokföringsposter, inte två
fristående klienttriggers. Återbetalning kan vara större än noll trots negativt
netto. Filmavslut får aldrig ändra pengarna. Gemensamt demosaldo delas med
blackjack; externa partnerkontons rouletteplånbok stöds inte ännu.

```text
Öppna rum → VILA/IDLE ←─────────────────────────────┐
                │                                 │
          Placera marker                          │
                ↓                                 │
             SPELA → sparat serverkvitto           │
                         ├─ DEALER: hjulgest → idle │
                         └─ HJUL: nummerfilm 0–36   │
                                      ↑           │
                            synkat kulsläpp        │
                                      ↓           │
                         slutbild → resultat ──────┘
BAKGRUND: separat tyst bild/videolager genom scenen
```

## Klippkartan och uppladdning

Öppna `/admin/clips`, välj bolag, **Roulette**, rum och dealer. Korten går att
flytta och har egna förhandsvisningar. Sparade blackjacklinjer ändras inte.

| Kort | Fack och filtyp | Vad verktyget gör |
| --- | --- | --- |
| Vila | `roulette.reference/VILA`, PNG med alfa | Lokalt bildprov; native-registrets PNG-lagring är fortfarande spärrad |
| Vänta | `roulette.idle/breathing`, MP4/WebM | Registrerar dealer-idle |
| Vänta, variant | `roulette.idle/glasses-clean`, MP4/WebM | Registrerar lugn variation |
| Starta | `roulette.wheel-start/wheel-start`, MP4/WebM | Registrerar hjulgest, initialt overifierade poser |
| Insatser | Välkommen, lägg insatser, inga fler insatser | Planerat roulette-talset; ingen falsk koppling till blackjacktal |
| Hjul | 37 nummerfilmer och resultatstillbilder | Planerad versionsbunden bank; inte en vanlig loopande bordsfilm |
| Resultat | Nummer/färg, nettoreaktion, återgång | Planerad spel- och talstyrning |

**Registrerat är inte spelkopplat.** De tre videofacken använder befintlig
native-upload med servergrindar för roulette/alfa. VILA-bilden provas bara
lokalt och sparas inte; beständig dealer-PNG kräver lagringsmigration.
Övriga kort visar nästa
steg och har ingen uppladdningsknapp innan deras exakta kontrakt finns.
Valet **Bakgrund och bord · bild/video** öppnar den gemensamma mallen;
panelen listar vilka rum en malländring berör. Rummets egna val använder det
befintliga rumsbundna flödet.

Bakgrund och scenbord stöder PNG/JPEG/WebP samt MP4/WebM. Dealer stöder grön
MP4 eller verifierad alfa-WebM; lokalt VILA-prov använder PNG. MIME bevaras vid
förhandsvisning. Bordsvideo är scenmaterial, inte en godkänd utfallsbank.
Händer framför bord kräver granskad mask och samma tidsregistrering.

Saknas VILA visar editorn första tillgängliga, korrekt registrerade idle för
**samma dealer och roulette**, stabilt sorterad på media-ID. Detta är en
förhandsvisningsreserv, inte visuell acceptans eller automatisk publicering.
En framtida publicering måste låsa valt ID/hash och en granskad stillruta.
Saknas även idle lånas inget blackjackklipp.

## Materialinventering

Underagentens kontroll av källkod, metadata och befintliga dokument gav:

| Material | Evidens och destination |
| --- | --- |
| `web/public/roulette/assets/roulette-bord.png` | Lokala bytes matchar metadata: 2 229 281 byte, SHA-256 börjar `dcf2fe0e`. Prototyp med kända sifferfel; inte produktionsgodkänt |
| Anna VILA | Dokumenterad privat PNG → referensfacket |
| `runway-idle-alpha.webm` | Dokumenterat privat 1916×1080, 10,042 s → andningsvila |
| `runway-glasses-alpha-v2.webm` | Dokumenterad glasögonvariation → eget idle-fack; v1 är underkänd |
| `spin_transparent.webm` | Dokumenterad 1080×1920-hjulgest → hjulstart; handträff fortfarande felkalibrerad |
| `runway-bg-source.mp4` | Dokumenterat bakgrundslager; annan bildkvot kräver matchande poster |
| `runway-table-source.mp4` | Underkänd geometri; får inte fylla ett utfallsfack |
| 0–36-banken | Ingen verifierad komplett bank eller spelkoppling |

Privata original har inte öppnats, flyttats eller återgodkänts i denna kontroll.
Detaljer och tidigare privata prov finns i [materialavsnittet](README.md#faktiskt-producerad-startuppsättning).
De fem kända blackjackborden ska ligga kvar som separata blackjackdesigner.
Ingen fysisk omflyttning behövs; problemen gäller felaktiga kopplingar och
otydliga speltyper. Bildens dealertext bevisar inte vem en fil föreställer.

## Återstår före spelkoppling

Publicerade bord som bild/MP4/WebM kan nu användas som scenlager i
`/play/roulette`: giltigt spelarval → rummets standard → första tillåtna
publicerade bord. Om inget finns används prototypen. Publicerade bord behåller
sin geometri och får inte prototypens handmask. Bordsvideo här är en loop,
inte en serverstyrd utfallsfilm. Bakgrundsvideo stöds också som separat lager.

- Eget fryst roulettekontrakt för val av dealer-idle/handlingar och bankrevision.
  Den publicerade `idle.ready`-kopplingen är blackjack och exponeras inte för roulette.
- Sekvenskö med prioritet, samma rund-ID vid återförsök, säker avbrytning vid
  kontobyte och dubbleringsskydd. Markerändring får inte starta hjulgesten.
- Hashbunden pose/handmask/kulsläppsruta, full 37-bank och slutbilder.
  Nuvarande gemensamma scenrenderare loopar video; utfallsfilmer behöver
  separat engångsspelare som håller slutrutan.
- Separat roulette-talset med exakt text, ljud, video och lipsyncacceptans.
- Två sammanhängande spelningar i riktiga spelaren, mobil/desktop, reducerad
  rörelse, mediafel, tappat kvitto och omladdning. API-test är inte visuell acceptans.

Nya spelmärkta bord kräver motsvarande runtimekapabilitet före registrering
och publicering. Ingen produktion, databas eller lagrad fil har ändrats av
att detta dokument och verktygsförslag levereras.
