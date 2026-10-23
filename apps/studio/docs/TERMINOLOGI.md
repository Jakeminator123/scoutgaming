# Scoutgaming: produkt och val

Enda styrande produkttexten, 22 oktober 2026. Detta är målbilden;
genomfört stöd redovisas i [handoffen](../../../docs/JOHN-HANDOFF.md)
och [runtime-referensen](../../../docs/LOCAL-PRESENTATION-RUNTIME.md).

## Tre nivåer

- **Admin** `/admin`: personalen förvaltar material, bolag och tilldelningar.
- **Operatör** `/partner`: spelbolaget förvaltar sina rum inom tilldelat utbud.
- **Spelare** `/lobby` → spel: väljer rummets publicerade alternativ.

**Studio** är personalytornas visuella editor. `/studio` är teknisk basePath,
inte en fjärde nivå eller ett extra register.

## Ägarskap och spelarens val

Ett **rum** är en bolagsägd ingång till ett spel med eget ID.
Scenen byggs av **bakgrund → dealer → bord → spelets kort och kontroller**.
Ny bakgrund skapar varken ny dealer eller nytt rum. Delade filer ger inte delad behörighet.

Alla tre lager ska kunna väljas i alla nivåer. Admin avgränsar operatörens
utbud; operatören avgränsar rummets spelarval. Varje val kan låsas till ett
giltigt förval. Avstängt val tar inte bort lagret. Bara kompatibla kombinationer
erbjuds; inbakade lager i dealerfilm kan inte bytas separat. Saknas giltig
kombination blockeras publicering/spelstart. Spelarbyten sker vid säker övergång
och påverkar bara den spelarens presentation, aldrig kort, spelregler eller saldo.

**UX-förslag:** en gemensam sceneditor med Bakgrund, Dealer, Bord och Tillåtna val.
Rumsändringar sparas som utkast och granskas före publicering. Delade **mallar**
redigeras separat med berörda rum synliga. Meny, rubrik och länk använder samma namn.
Tekniska ID:n finns under Detaljer; namnbyte är ingen datamigrering.
Admin får arbetslägena **Studio** (dealers, klipp, scener) och **Administration**
(bolag, kunder, drift, ekonomi), med gemensamt designspråk och tydliga lägesnamn.
Behåll klippkartan med spelval. Öppna rumseditorn från rummet; klipp och tal
hör till dealerns bibliotek. Arbetsläge ändrar inte behörighet eller lagringsägare.

**Jakobs befintliga klippkarta och redigering är grunden.** Kevin och Emils
exakta videor och uppspelningsflöde återanvänds; deras namngivning används där
den passar. Deras klippkarta eller tvålagrade uppbyggnad ersätter inte denna
struktur. Bakgrund, dealer och bord är tre valbara presentationslager som ska
kunna spelas samordnat. Valen följer materialets verkliga kompatibilitet ovan.
Admin ska göra det begripligt att bygga och redigera en dealers klippsekvenser,
välja kompatibel bakgrund/bord och tilldela dem till operatörer och rum.
Lobbydemot visar det publicerade flödet för spelbolag och spelare.

Klipp ordnas som **kategori → situation → standardklipp + varianter**.
**Vila (idle)** har en basloop och separata beteendeklipp. **Redo** skiljer
till/från skon; **Dela till spelare** skiljer box 1–7. Varje situation har
eget standardklipp. Dealerns egna kort, dolt kort och kortvändning har sina
respektive spelhandlingar. Mobil och widescreen ska ha tydliga förval för
placering/kalibrering så att dealer, bord och utdelningspositioner stämmer.
Tekniska poseversioner är inte beteendevarianter.
Talade repliker behåller situation, språk och exakt text/ljud/bild tillsammans.
Alla klipp där dealern talar hör till **Talade repliker**, även välkomstfraser,
småprat och resultatfraser. Tysta blickar, nickningar och andra beteenden som
återgår till vila är **beteendeklipp under Vila/Idle**. Kortutdelning,
kortvändning och till/från skon förblir egna spelhandlingar.
**Tur och resultat är körvillkor, inte egna klippkategorier.** Beteenden kan
vara avstängda för automatiken, köras med intervall eller väljas vid en
spelhändelse. Talfrasens situation och val av tagning hålls isär: en fras kan
ha flera varianter utan att bli ett Idle-klipp. Frivilliga beteenden ska inte
presenteras som obligatoriskt material som saknas. Automatik och OpenClaw kan
välja kompatibla beteenden och varianter utifrån kategori, intervall,
spelhändelse eller chatt/persona. De ändrar inte den serverägda spelhandlingen
eller dess korrekta utdelningsposition. Operatörens dealer/persona använder
samma klippkarta och behörighetsstyrda tilldelningar.
[Användarguiden](README.md) beskriver arbetssteg, ingen separat produktmodell.
