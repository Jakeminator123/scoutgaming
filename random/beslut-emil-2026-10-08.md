# Till Emil: fyra beslut om nästa dealerpaket (kopiera texten under strecket)

---

Hej Emil,

standarden för tre-lager-video skickade jag separat (1080×1920, 24 fps, grön bakgrund,
`VILA.png`/`REDO.png`/`klippinfo.json`). Här är det som bara du kan avgöra innan du
exporterar nästa paket. Svara med nummer + val.

**1. Vilka dealers först?**
Spelaren kan i dag spela alla fyra (Astrid, Vera, Amira, Mei) men bara Astrid har klipp
på den nya vägen; Vera/Amira/Mei faller till 2D-reserv. Paow och Dragge finns som prov i
lagerspelaren. Ordning du föreslår? Mitt förslag: **Paow färdig först** (hon finns redan
kalibrerad i `klippinfo.emil-v3.json`), sedan Vera.

**2. Hålkort**
Paow saknar `deal_poshole` (dealerns dolda kort). Spelaren visar då inget kort där – inte ett
vitt kort, inte ett annat klipp. Kan du spela in hålkortet för Paow, eller ska vi köra
henne utan försäkring/hålkort tills vidare?

**3. Idle och repliker**
Lanen kan ställa idle-frekvens ("gäspning") och variera dealsekvenser. Behöver vi:
- 2–3 idle-varianter per dealer (≈ 3–6 s vardera, loopbara till `VILA`)?
- Repliker (greeting, goodluck, win, lose, push, insurance, double, blackjack, bust) som
  separata klipp **utan ljud** – ljudet läggs på i efterhand via TTS/läppsynk, eller vill du
  spela in med ljud och leverera ljudspåret separat (wav)?

**4. Desktop**
Vi centrerar den stående 1080×1920-spelplanen i 16:9 och fyller sidorna med bakgrunden.
En riktig bred kameravinkel skulle kräva ett helt nytt kalibrerat klippset. OK att vänta
med bred vinkel tills mobilen är godkänd?

**Leverans:** filer i Dropbox/Drive per dealer (`dealer/<namn>/` med klipp, `VILA.png`,
`REDO.png`, `klippinfo.json`), bakgrund och bord separat. Inte via kontrollpanelen.
Spara råfilerna, skicka exporterna.

Tack!

/Jakob
