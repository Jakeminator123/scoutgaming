# Beslutsmatris, 7 oktober 2026

Arbetsanteckning för Jakob. Återvänd hit inför samtal med John och Kevin.
Inga hemligheter här. Status uppdateras i `docs/JOHN-HANDOFF.md`, inte i den här filen.

## Jakobs policy (7 okt)

| Område | Regel |
|---|---|
| Repots logik | Facit. Varken Kevin eller John ändrar hur logiken i repot fungerar. |
| Design | Får ändras efter John. |
| Kevins nivå 2 | Var inte koherent med repot vid import. Kevins kod ändrar inte repot; repot får tweaka Kevins kod. Kevins kopplingar anpassas till repot. |
| Öppna punkter | Kör på orkestratorns rekommendation. Jakob har sista ordet på nytt tveksamt. |
| Leverans | Agenter via Jakob pushar direkt till main. Kevin, Emil, John via PR från sina grenar. |

## Rader 1–11, med beslut

| # | Tveksamt | Alternativ | Beslut | Status |
|---|---|---|---|---|
| 1 | Fyra menyval i Drift/Åtkomst gick till samma administrationssida utan flikbyte | A: behåll fyra. B: ett val "Administration" tills sidan har flikar. C: sektionsankare | **B nu, C i steg 3** | Gjort 7 okt |
| 2 | Bakgrundszoner och Händelser låg i sidfoten, utanför Johns fem grupper | A: kvar i foten. B: in under Studio. C: ta bort | **B** | Gjort 7 okt |
| 3 | Ljust läge: skalet ljust, inre sidor mörka | Vänta tills ingen inre sida är mörk | **Vänta** | Sidmallen rapporterar klart; verifieras i produktion |
| 4 | Nivåväxlare och chips 40 px, Johns bild 36 px | A: 40 enligt hans regel 10. B: 36 enligt bilden | **A** | Ingen ändring |
| 5 | Inloggningssidor visade sidomenyn | A: behåll. B: ren inloggningssida | **B** | Gjort 7 okt |
| 6 | Översiktens lime-knapp är "Lanes, bord & konton" | A: behåll. B: "Ladda om från servern" när livedata finns | **A nu, B senare** | Ingen ändring |
| 7 | "Skydd för sista administratören" står som kvar i T2, ingen kod finns | A: bygg i nästa partnerpass. B: stryk | **A** | Öppet, Kevin-spår |
| 8 | Nivå 1 står som "påbörjad" fast sidorna fungerar | A: behåll. B: "klart" | **A** | Ingen ändring |
| 9 | Agentmodeller: "Spara alla" sparar en agent per klick | A: behåll. B: riktig batch | **A nu** | Ingen ändring |
| 10 | Dealerns gamla `<select>` ligger dold bakom chipsen för ett gammalt test | A: behåll dold. B: skriv om testet, ta bort | **B i nästa pass** | Öppet |
| 11 | Klipplistans filterchips och triggerpiller från Johns bild saknas | A: eget pass. B: hoppa över | **A, steg 3** | Öppet |

## Avgjort av orkestratorn, till kännedom

| Tveksamt | Vad som gjordes |
|---|---|
| Historiksidan sa "ingen publik rutt" fast rutten finns | "Inga avslutade rundor ännu" |
| `/api/history` tar bara POST | Behölls, samma som `/api/balance` |
| Transaktions-id borttagna ur historiksvaret | Behölls, spelaren behöver dem inte |
| Migration 005 | Körd mot produktions-Neon, status rättad |
| "Nivå 1 · ScoutGamingGroup" dold text | Behålls tills testet skrivs om |
| `/` och `/studio` markerar Dealers & klipp | Rätt, labbets rot är klippsidan |
| Agentmodeller hade två lime-knappar | Radens Spara är sekundär (Johns regel 2) |
| Skalet läste React-internals för att hoppa över hooks i test | Borttaget 7 okt. Statusfältet är en egen komponent |
| Offline-labbet ger 500 på alla sidor utom Agentmodeller | Förväntat sedan `45ae2752`: sidorna kräver Neon, ingen diskfallback. Inte en regression. Verifiera UI i produktion eller med Neon-anslutning |

## Till Kevin

| Punkt | Läge |
|---|---|
| Team-vyn lyfts ut ur `original-views.jsx` som första vy, mot riktig data | Pågår |
| Resten av hans 13 vyer rörs inte förrän de får riktig data | Policy |
| Hans kopplingar anpassas till repots API och sessioner, inte tvärtom | Jakobs policy 7 okt |
| Rad 7: skydd för sista administratören | Nästa partnerpass |

## Större beslut som väntar på Jakob

| Fråga | Rekommendation |
|---|---|
| `web/server.mjs` har dubbla vägar sqlite/postgres (11 grenar, 15 P6-referenser) | Separat granskning. Ta inte bort sqlite utan beslut |
| Render `croupier-v2` har autodeploy av; `/bo`-redirects och `/api/history` är inte deployade | Manuell deploy i Render-konsolen, eller ge API-nyckel |
| Neon-rollen `croupier_game` visades i klartext i en MCP-session | Rotera lösenordet, uppdatera Vercel-env |
