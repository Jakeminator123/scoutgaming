# Masterplan: Kevins spelbeteenden in i mains produkt

Kort, gällande plan. Status finns bara i [STATUS.md](STATUS.md), genererad från [status.json](status.json) (enda statuskällan). Läge, nästa steg och vem som agerar finns i [docs/NEXT-AGENT.md](../docs/NEXT-AGENT.md). Den fullständiga planen med avstämningar 21–27 oktober, prioriteringstabellen, frysta käll-SHA:er och O01-kontrakten finns oförändrad i den historiska planen (raderat; se `git show 29ed6626bf:docs/history/MASTERPLAN-2026-10.md`); den är historik, inte körorder.

## Syfte och avgränsning

- Utvalda beteenden från Kevins spelmodul (regelkärna, delat bord, spelklient, mediakontrakt) körs genom mains befintliga tjänster och styrs av publicerad Admin-konfiguration. Main äger auth, wallet, regler, sko, Neon, Blob och trelagersspelaren.
- Ingen helmerge av Kevins branch. Hans SQLite, filregister, cookies, fallbackdealer, backoffice och roulette följer inte med. Extra dealers, språk och generativ GPU-worker ingår inte.
- En produktväg (Jakob 27 oktober): Vercel + Render + Neon + Blob. SQLite lämnar main helt; ren main är ett slutkrav som O02/O03 bekräftar. `tools/check-no-sqlite.mjs` förbjuder SQLite i all kod; bara dokumentation får nämna det.
- Planen ger inget mandat för merge, produktions-DDL, produktionsflaggor, import, deploy eller GPU-körning. Sådant följer [AGENTS.md](../AGENTS.md) och Jakobs beslut.

## De 20 aktiviteterna

Varje verifierad aktivitet väger 5 procentenheter. Kriterier: J i [Jakobs aktiviteter](jakob-main-migrering/AKTIVITETER.md), K i [Kevins aktiviteter](kevin-ks-migrering/AKTIVITETER.md), O nedan. Beroenden är desamma som i `status.json`.

| ID | Etapp | Ansvar | Kräver | Innehåll |
| --- | --- | --- | --- | --- |
| J01 | E1 | jakob | – | Tydligare publicering i Admin: spara, återläsa och publicera |
| J02 | E1 | jakob | J01 | Avveckla den ersatta Control-publiceringen |
| K01 | E1 | kevin | – | Inventera den rensade Kevin-modulen mot exakt käll-SHA |
| O01 | E1 | orkestrator | K01 | Lås kontrakt och funktionsansvar mellan main och Kevin-modulen |
| J03 | E2 | jakob | J02, O01 | Avveckla resterande Control-ytor (bara redirects kvar) |
| J04 | E2 | jakob | O01 | En spelkatalog via `/lobby` |
| J05 | E2 | jakob | J03, J04 | Förenkla runtime och byggkedja |
| J06 | E2 | jakob | J03, J04 | Rensa testlås och rikta CI mot produktens beteende |
| K02 | E3 | kevin | O01 | Ren regelkärna med explicit slump och tid |
| K03 | E3 | kevin | K02 | Delat bord utan SQL- och videokoppling |
| J07 | E3 | jakob | K03 | Postgres-adapter för delat bord (transaktioner och lås) |
| K04 | E3 | kevin | K03, J07 | Spelklient och presentation från committade händelser |
| J08 | E4 | jakob | J07, O01 | Admin styr versionerad spelkonfiguration |
| K05 | E4 | kevin | K01, K04 | Exakt mediakoppling till Neon och Blob (ID, SHA-256, granskning) |
| J09 | E4 | jakob | J05, J07 | Förbered avveckling av oanvända databaskontrakt |
| K06 | E4 | kevin | J08, K05 | Admin till spel efter omstart, med frusen aktiv hand |
| K07 | E5 | kevin | K04, K06 | Spelbeteenden och samtidighet, även delat bord |
| J10 | E5 | jakob | J06, J09 | Ren klon, start och återställning |
| O02 | E5 | orkestrator | K07, J10 | Oberoende integrerad granskning av en fryst kandidat |
| O03 | E5 | orkestrator | O02 | Godkänd integration och verifierad drift |

## Beroendeordning

Etapperna är kumulativa (E1 20 %, E2 40 %, E3 60 %, E4 80 %, E5 100 %); en etappgrind är godkänd först när den och alla tidigare etapper är verifierade. Förberedelser får gå parallellt enligt beroendena.

```text
E1  J01 → J02            K01 → O01
E2  J02 + O01 → J03      O01 → J04            J03 + J04 → J05, J06
E3  O01 → K02 → K03 → J07                     K03 + J07 → K04
E4  J07 + O01 → J08      K01 + K04 → K05      J05 + J07 → J09      J08 + K05 → K06
E5  K04 + K06 → K07      J06 + J09 → J10      K07 + J10 → O02 → O03
```

Migreringen är klar: alla 20 aktiviteter VERIFIED (O03 via #527, granskning i [O03-REVIEW](../docs/2026-10-28-O03-REVIEW.md)). Nästa arbete står i [NEXT-AGENT](../docs/NEXT-AGENT.md#efter-o03).

## När migreringen är klar

- Alla 20 aktiviteter är VERIFIED i `status.json` med full kod-SHA, branch, PR, oberoende granskare och konkreta bevis, och deras beroenden är verifierade. `node migrering/status.mjs --check` kontrollerar strukturen; granskaren bedömer bevisen.
- Ett krav som väljs bort kräver Jakobs uttryckliga scopebeslut med motivering. Det får inte strykas tyst eller räknas som VERIFIED.
- En mergad del-PR, en plan eller grön CI ger inga procent. En ändring som ogiltigförklarar ett bevis återöppnar aktiviteten.
- Den tekniska Neon/Blob-flytten har ett eget avslut i [CLOUD-MIGRATION](../docs/CLOUD-MIGRATION.md) och blandas inte ihop med dessa aktiviteter.

## Orkestratorns aktiviteter

### O01 — Lås kontrakt och funktionsansvar

VERIFIED. Kontrakten för kommandon, händelser, lagring, presentation och configversion är låsta; underlaget finns i [K01/O01-svar.md](kevin-ks-migrering/K01/O01-svar.md) och i den historiska planen (raderat; se `git show 29ed6626bf:docs/history/MASTERPLAN-2026-10.md`).

### O02 — Oberoende samprov

Kräver K07 och J10.

- [ ] Frys en integrerad kandidat och verifiera schema, miljö, webb, motor och media separat.
- [ ] Kör Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning.
- [ ] Verifiera negativa fall: fel rum/ägare/roll, inaktuellt paket, dubbelkommandon, samtidiga spelare, avbruten presentation och felaktiga media-ID.
- [ ] Visa att borttagna ytor (`/control`, `/lab`, `/bo`) inte kan starta en alternativ produkt, och att testfixturer aldrig använder riktiga användardata.
- [ ] Granskaren redovisar observerat resultat, testmiljö och kvarvarande brister; tidigare agentkvitton tillskrivs sina författare.

Klart: inga blockerande fynd; verkliga driftprov redovisas åtskilda från automatiska tester.

### O03 — Integration och leverans

Kräver O02.

- [ ] Kontrollera aktuell main, PR-ägare, källrepo, full head, obligatorisk CI och säkerhetsstatus enligt ägarreglerna i [AGENTS.md](../AGENTS.md).
- [ ] Kör schemaändringar i godkänd ordning; krävd Neon-readiness passerar före merge.
- [ ] Godkänd release har verifierad Vercel- och Render-SHA, schema, vanlig inloggning, Admin-sparning, launch och relevant spelfunktion.
- [ ] Dokumentera återställning som fungerar med faktiskt migrerat schema och uppdatera [NEXT-AGENT](../docs/NEXT-AGENT.md).

Klart: den integrerade produkten är levererad och verifierad i drift. Ingen förhandsmarkering av 100 %.

## Efter O03

Ingen av punkterna är en av de 20 aktiviteterna eller ger procent; status och vikter ändras inte. Ordningen är Jakobs beslut 28 oktober 2026 och gäller tills han ändrar den. Varje punkt levereras som vanlig PR med grön CI, provas i preview när orkestratorn bedömer att det behövs och kvitteras med verifierad Vercel- och Render-SHA.

1. **F11 först.** Första runtime-PR:en efter O03 (#529): spelmotorn stänger det delade bordets anslutningar med 1012 vid SIGTERM, och ögonblicksbilder når spelare oavsett instans under Render-överlappet. Provas i preview. Till dess deployas `croupier-v3` bara när bordet är tomt.
2. **Nya Admin:** nivå 2 (partnerportalen, #518), sedan nivå 1 (#519), sedan demo-byggaren (#512), enligt [ADMIN-FORENKLING](../docs/plans/ADMIN-FORENKLING.md).
3. **Dealer-generisk talkedja, med Paow först** ([PAOW-LIPSYNC](../docs/plans/PAOW-LIPSYNC.md) (#528); läppsynken bevisades i två prov 28 oktober 2026 utan att något aktiverades: stillbild på 6,7 s via varm endpoint och rörligt tal med 160 munlappar på 3,3 s). En kedja för alla dealers i stället för Dragans egen. Stillbildsvägen finns redan i main (`speechProfile` med `reference.kind='video-frame'`) och kan bli Admin-konfiguration utan kod; rörligt tal per dealer kräver kod. Bara Jakob godkänner ljud och läppsynk.
4. **Mobil och 3-rutors fönster:** F12–F15 (knappöverlapp vid 1440/1920, saldopanelen över insatsen vid 320×568, dubblerad beslutspanel), utan zoom och utan kamera per plats.
5. **Bindning nyckel → bolag:** partnerns API-nyckel binds till ett bolag, och motorn kräver att `operator` matchar nyckelns bolag efter verifierad signatur.
   Plan: [NYCKEL-BOLAG](../docs/plans/NYCKEL-BOLAG.md) (datamodell, migrering 012, kodpunkter, prov och PR-sekvens).
6. **L3:** rummens namn och state läses ur det publicerade paketet i stället för administrationsdokumentet.
7. **Ren start steg 2** enligt [REN-START](../docs/plans/REN-START.md).
8. **Kevins portplan P4–P14:** resterande beteenden skrivs om i mains moduler; P7 (gäståtkomst) och P13 (desktop) kräver Jakobs beslut.
9. **Skalningstest:** tio bord med sju spelare (10×7) som grind, med de kända serialiseringspunkterna i motorn (globalt lås även vid läsning, auditlåset, den sekventiella schemaläggaren) mätta.
10. **Preview får egen taluppsättning** när den generiska talkedjan byggs, med egna nycklar och egen budget; produktionens nycklar kopieras aldrig dit.
11. **Städning (D6):** kvarlämnade QA-roller (`croupier_game_qa`, `croupier_studio_qa_abc92154cb15`) tas bort, `pg_stat_statements` flyttas ur schemat `croupier_game` eller tas bort, och `CROUPIER_ASTRID_CAMERA=1` på `croupier-v3` ses över (kamera och röst är en behållen produktfunktion, flaggan är Astrid-märkt). Jakob raderar O03:s Neon-grenar och restoremålen enligt [ENVIRONMENT-RESTORATION](../docs/ENVIRONMENT-RESTORATION.md#preview).

## Radera med ett konkret slutdatum

Varje ändring anger vad som ersätts och vad som därför raderas. Följ konsumenterna hela vägen: route → komponent → tjänst → adapter → data → build/env/test/docs. Ett gammalt namn räcker inte som raderingsbevis, och en pensionerad implementation behålls inte för sitt namn eller sin historik.

- **Kod:** ersatt eller utan aktiva konsumenter tas bort med registreringar, ensamma tester och instruktioner. Git är återställningen.
- **Databas:** ta först bort läsare och skrivare, uppdatera schema och readiness, prova migrering och återställning isolerat och låt Jakob godkänna produktionsåtgärden. Noll rader bevisar inte att en tabell kan släppas.
- **Media:** koppla exakta ID och hashar till aktiva och historiska paket. Oanvända Kevin-filer importeras inte, och historiskt refererade media raderas inte genom namnmatchning.
- **Tester och regler:** avveckla gamla layoutlås samtidigt med ersättningen. Behåll säkerhets-, transaktions- och spelregler.

## Arbetsordning

1. Läs [STATUS.md](STATUS.md) och [NEXT-AGENT](../docs/NEXT-AGENT.md). Frys faktisk main och käll-SHA.
2. Ta en avgränsad leverans för nästa aktivitet i kedjan. Återanvänd mains kontrakt och ange observerbart godkänt resultat.
3. Håll isär kodtest, publicering och lagring, faktisk media, Postgres- och processprov samt driftbevis.
4. Efter granskad acceptans uppdaterar orkestratorn aktiviteten i `status.json` och kör `node migrering/status.mjs --write`.
