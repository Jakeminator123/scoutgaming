# Meddelande till Kevin och Emil, 8 oktober 2026 (kopiera texten under strecket)

---

Hej Kevin och Emil,

kort nuläge och vad vi behöver från er för nästa dealervideor.

**Vad som finns nu**
- Kontrollpanelen (`/control`) har sidorna Lanes och Förhandsvisning. Förhandsvisning visar tre-lager-spelaren från min gren `test-video-jakob`: bakgrund, bord och dealer som separata lager, Paow och Dragge som prov.
- En lane = ett paket med dealers + klipp + vad OpenClaw får göra. Bolaget får en grundprofil och kan sedan justera bordsfärg och branding. Spelaren ska kunna byta bordsfärg, bakgrund och dealer inom paketet.
- Astrid körs fortfarande som fullbild i produktion. Tre lager är målet för alla nya dealers.

**Ny standard för dealervideo (tre lager, läs innan ni spelar in/exporterar)**

Dealerlager (video):
- MP4, H.264, **1080×1920 (9:16)**, **konstant 24 fps**, kvadratiska pixlar, ingen rotationsflagga, **utan ljud**.
- **Behåll grön bakgrund** – friläggningen görs i spelaren. Ingen alfavideo behövs.
- Samma kamera, perspektiv, utsnitt och grundposer i alla klipp. Dealern får inte "glida" mellan klipp.
- `VILA.png` och `REDO.png` på samma 1080×1920-canvas.
- `klippinfo.json` ska följa med varje paket: kortpositioner, kortstorlek (i dag 79×106 px), klipp, bildruteantal och stillägesruta.
- Desktop är **inte** en liggande fil: samma stående spelplan centreras i 16:9. En riktig bred vinkel kräver ett helt nytt kalibrerat klippset – gör inte det nu.

Bakgrundslager:
- Stillbild: PNG/JPEG/WebP. Video: MP4/H.264, loopbar, spelas mutad. Helst "nästan stilla" seamless loop.

Bordslager:
- **RGBA PNG/WebP med riktig transparens** (bord, främre bordskant, rekvisita var för sig). Originalproportioner bevaras.
- Masker (om ni gör egna): gråskala, exakt 1080×1920, vitt visar, svart döljer.

Lagerordning i spelaren: bakgrund → bord → kort → dealer → främre bordskant → överlägg. (Split-läge med dealerhänder över korten kräver handmask; hoppa över tills vidare.)

**Hur ni levererar**
- Ett paket per dealer: `dealer/<namn>/` med klippen, `VILA.png`, `REDO.png`, `klippinfo.json`; `bakgrund/` och `bord/` separat.
- Lämna som filer (Dropbox/Drive), **inte** via uppladdning i kontrollpanelen – vi lägger in dem i grenen och hashar dem där tills tre-lager-vägen går till produktion.
- Råoriginal (t.ex. 1088×1920) är inte godkänd ingång; skicka de färdiga exporterna, men spara råfilerna.

**Vad som gäller för godkännande**
- Tekniska fel (fel upplösning, variabel fps, ljudspår, rotationsflagga) stoppar import automatiskt.
- Visuellt godkännande görs av mig i spelaren: geometri/kortkontakt, kanter, riktig telefon, desktop.

**Kevin, separat:** partnerportalen har nu ett API för bolagets utseende (`branding?operator=`) som skriver inom vad lanen tillåter. Skrivning kräver rollrättigheten `presentations.configure`, och inga roller seedas förrän dina skrivrutter (N2.2) är på plats – så just nu ger den 403 i produktion. Ditt svar på #3 låser upp det.

Säg till om något är oklart så tar vi det på ett samtal.

/Jakob
