# Scoutgaming: produkt och val

Enda styrande produkttexten, 18 oktober 2026. Detta är målbilden;
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
Föreslagen adminmeny: Översikt, Bolag & rum, Bibliotek, Drift & ekonomi, System.
Öppna Studio från rummet; klipp och tal finns under respektive dealer i Bibliotek.
[Användarguiden](README.md) beskriver arbetssteg, ingen separat produktmodell.
