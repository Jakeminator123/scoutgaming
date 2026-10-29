# Scoutgaming: orden i produkten

En bred beskrivning av vad orden betyder, för den som är ny i Admin, Partnerportalen eller koden. Den låser ingenting: inte menyer, inte rubriker, inte vilka ord ny text måste använda. Menyer och hjälptexter får utvecklas; kodens namn (inom parentes nedan) byter inte namn för att ett ord i menyn byts.

Referenser: Admins **Hjälp** (`/admin/guide`, kortet "Orden") är den korta, aktuella beskrivningen inne i produkten. Målbildens språkavsnitt står i [ADMIN-FORENKLING](../../../docs/plans/ADMIN-FORENKLING.md#8-språk), arbetsstegen i [användarguiden](README.md) och de tekniska medieformaten i [runtimeguiden](../../../docs/LOCAL-PRESENTATION-RUNTIME.md). Den tidigare, detaljerade ordlistan med tabeller över ord som utgår läses ur Git: `git show a05917c3:apps/studio/docs/TERMINOLOGI.md`.

## Tre nivåer

**Admin** (`/admin`) är Scoutgamings egen arbetsyta, där personalen skapar och tilldelar. **Partnerportalen** (`/partner/<bolag>`) är bolagets yta, där bolaget väljer inom det som tilldelats. **Spelaren** möter produkten i **lobbyn** (`/lobby`), bolagets katalog över öppna spelbord, och i **spelet** (`/game`), det autentiserade spelfönstret. Allt ett bolag kan ändra är en delmängd av det Admin kan ändra, och spelaren ser bara det som är publicerat.

`apps/studio` är källkoden för alla tre ytorna; `/studio` är appens tekniska sökväg, inte en egen produkt.

## Spelmotorn och det delade bordet

**Spelmotorn** (`services/game`, Render `croupier-v3`) äger kort, sko, regler, saldo och utbetalningar. Presentationen påverkar aldrig dem. **Delat bord** (`shared-table`) är motorns sätt att låta flera spelare sitta vid samma spelbord och är sedan O03 den enda spelvägen. **Preview** är provbänken med syntetiska konton, som deployas med låst version av orkestratorn.

## Det Admin skapar

- **Dealer**: en person med eget klippbibliotek, egen röst och egna repliker. Dealerns **klipp** ordnas i en **klippkarta** per situation: **vila** (grundloopen mellan händelserna; PAOW och Dragan kan därtill ha en **sammanhängande vilosekvens**, Kevins urval av viloklipp som kopplas under Körregel), spelhandlingar som utdelning och kortvändning, övergångar till och från skon, och **repliker** med språk och exakt text. En **tagning** är en inspelning av en replik; bara godkända, servermätta tagningar spelas. En dealer är **godkänd** när klipp och tal räcker för spel.
- **Material**: **bakgrunder** och **bordsgrafik** (`layerAssets`), uppladdade på ett ställe. Bordsgrafik är bilden av bordet med boxarna där korten landar, aldrig ett spelbord. Den ritas efter dealerns **landningar**, mätningen i dealerns **filmade profil** av var handen lägger korten.
- **Scenmall** (`lane`; i koden också `composition`): hur bakgrund, dealer och bordsgrafik placeras i scenen, och vilka dealers och vilket material mallen tillåter. Flera spelbord kan dela samma scenmall. **Placering** är mallens skala och läge för de tre lagren, separat för dator och mobil; normalt fylls den i från dealerns filmade profil.
- **Röst och tal**: dealerns inspelade tal och, när talkedjan är igång, genererat tal med läppsynk. **Dialogtest** är chatten mot dealern; **AI-agenter** är systeminställningarna för det.

## Det bolaget får och väljer

- **Bolag** (`operator`): spelbolaget, till exempel Johns Bet. Bolagets **team** har roller (administratör, redaktör, läsare); vad en roll får göra avgörs av servern, inte av vad som syns i menyn.
- **Tilldelning**: det bolaget får använda: dealers, scenmallar, material och insatsprofiler, och vilka val som är **upplåsta** för bolaget. Tilldelningen lagras i bolagets **paket**.
- **Paket** (`operator package`): bolagets publicerade tilldelning och frysta material, med en **version** som bara räknas uppåt. Spelet läser paketet, aldrig utkast.
- **Spelbord** (`room`; äldre text säger rum): bolagets ingång till ett spel, med namn, dealer, utseende inom tilldelningen och egna **spelinställningar** (språk, insatsprofil och tider). Ett spelbord är **öppet** eller **pausat**; ett pausat spelbord syns inte i lobbyn.
- **Insatsprofil** (`limitPreset`): en namngiven uppsättning gränser och marker, i dag Casual, Privé och High. Admin bestämmer profilen; bolaget får byta bara om Admin låst upp det.
- **Spelbordets utseende** (`branding`): vald bakgrund, dealer och bordsgrafik per spelbord inom tilldelningen.

## Utkast, publicering och papperskorg

Det sparade läget är ett **utkast**; det publicerade är **live**. Spelaren ser bara live, en pågående runda spelas klart på den gamla versionen och nästa runda får den nya. **Publicering** fryser det valda i paketet och sist spelbordets spelinställningar. Varje sak har ett permanent **id**, så att länkar och historik pekar rätt när namn ändras. **Papperskorgen** är arkivering som går att ångra; permanent radering är ett eget steg, och historik och källmedia raderas aldrig som bieffekt.

## Konton

**Personal** är Admins konton (`croupier_auth.users`). **Spelare** (`players`) har saldo och historik och tillhör ett bolag. En **API-nyckel** (`api_keys`) låter bolaget starta spelare från sin egen sajt; varje nyckel hör till exakt ett bolag, valt när Admin skapar den, och Partnerportalen visar bolagets egna nycklar maskerade. En **testsession** är en start med demokrediter. **Skapa demo** i Admin sätter ihop bolag, spelbord och dealer för en visning, och demolänken startar spelet med det valda bolagets nyckel. **Journalen** är bolagets händelselogg.

**Partner-API** (`/api/v1/*` i spelmotorn, [partner-api.md](../../../docs/games/partner-api.md)) är kundkontraktet: bolagets egen server anropar det med API-nyckeln och HMAC-signerade anrop. **Portal-API:t** (`/studio/api/partner/*`, `apps/studio/app/api/partner/[...action]`) är Partnerportalens eget API för inloggad bolagspersonal och inget kontrakt mot kunden.

## Lagring

Neon är produktregistret (bolag, paket, spelbord, klipp, konton) och Blob lagrar mediebytes; Git innehåller kod och text. Paketet är kontraktet mellan Admin och spelet. Detaljerna står i [BLOB-NEON](../../../docs/storage/BLOB-NEON.md) och [ADMIN-KARTA](../../../docs/plans/ADMIN-KARTA.md).
