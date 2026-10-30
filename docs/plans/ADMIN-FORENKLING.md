# Admin-förenkling: läget efter enkel väg

> Admin som den är på `main` `989609e9b` (29 oktober 2026), efter enkel väg PR 1–8: #661/#663 (Nytt spelbord på ett steg), #660 (spärrar som en mening och en knapp), #662 (spelinställningar utan "utkast krävs"), #666 (bolaget 7 → 4 flikar), #667 (dealern 7 → 5 steg), #665/#668 (ord, Astrid och Forge-UI ut), #678 (kitet på Spelinställningar, Nytt spelbord och Tillgänglighet) och #676 (en primär åtgärd, räknare i menyn, System 6 flikar). Koden vinner över texten.
>
> Den långa målbilden (nivåmatriser, beslutskarta, steg A–H, funktionsregister och felkontraktet för Publicera) läses med `git show 989609e9b:docs/plans/ADMIN-FORENKLING.md`. Avsnittsnummer i kodkommentarer ("ADMIN-FORENKLING 5.3", "§7", "§9") avser den versionen. Kablagekartan och den klickbara skissen är raderade ([HISTORIK](../HISTORIK.md)). Användarens beskrivning är [användarguiden](../../apps/studio/docs/README.md); orden står i [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md).

## Beslut

| Datum | Beslut (Jakob) |
| --- | --- |
| 2026-10-27 | En produktväg: `/admin` är arbetsytan; `/control`, `/lab` och `/bo` är pensionerade och omdirigeras. |
| 2026-10-28 | Admin skapar och tilldelar, bolaget väljer, spelaren spelar. En dold meny är ingen åtkomstkontroll: varje skrivning kontrolleras på servern per bolag. |
| 2026-10-28 | Inga låtsasfunktioner: saknas data står det "Inte anslutet", och inga knappar lovar något som "kommer senare". |
| 2026-10-28 | **Spelbord** är ordet för `room`, **bordsgrafik** för bordslagret, **Bolag** och **Partnerportalen** för nivå 2. |
| 2026-10-28 | Varje spelare tillhör exakt ett bolag (steg F). Insatsprofilen är låst som standard och låses upp per bolag. |
| 2026-10-28 | Talkedjan är pausad tills den byggs dealer-generisk ([TALKEDJA](TALKEDJA.md)). |
| 2026-10-28 | Radera hellre än arkivera; dubbla ytor tas bort, inte göms. |
| 2026-10-29 | Scenmall heter **miljö**. **Körregel** behålls som ord, eftersom OpenClaw ska kunna styra klipp genom den. |
| 2026-10-29 | Nya dealers utan egen filmad profil ärver PAOW:s landningar, så att de kan spelas vid delat bord utan egen mätning. |
| 2026-10-29 | Enkel väg: ett spelbord skapas i en ruta med standardval; varje sida har en primär åtgärd; en spärr är en mening och en knapp. |

## Målflödet: Nytt spelbord

En ruta, allt förvalt, en knapp. Koden: `CreateRoomDialog` i `apps/studio/client/admin/components/studio/companies-page.tsx` och kedjan i `client/admin/lib/room-quick-create.mjs`.

1. **Nytt spelbord**: den enda primära knappen på Översikt (`admin-home.tsx`), och på fliken Alla spelbord och bolagets flik Spelbord. Rutan heter "Nytt spelbord hos <bolag>".
2. **Standardval** (`quickCreateDefaults`): dealern från bolagets senaste spelbord, annars PAOW, annars första dealern vars klipp räcker för spel; miljön som har dealern som standard, den bolaget senast använde först; namnet `<Dealer> Blackjack N`; språket från bolagets senaste blackjackbord, annars engelska; insatsprofil Privé. Allt går att ändra under **Avancerat** (bolag, spel, dealer, miljö, bordsspråk, insatsprofil).
3. **Skapa och publicera** kör tre steg: Miljö (låses eller kopieras om andra spelbord använder den; saknas en skapas en ny utan vald bakgrund) → Mät klipp → Spelbord, tilldelning och spelinställningar i en transaktion och en paketversion (#663).
4. **Klart**: "<namn> är öppet och publicerat." med **Öppna spelbordet** och **Öppna i spelet**. Stannar ett steg visas en mening och en knapp (`blocker-view.mjs`); ett nytt försök kör bara det som återstår, med samma miljö.

Har ingen dealer klipp som räcker för spel förväljs ingen, och knappen är inaktiv med en förklaring.

## Flikarna i dag

Menyn (`packages/navigation/admin-navigation.mjs`, sidomenyn `studio-sidebar.tsx`):

| Menyval | Adress | Flikar |
| --- | --- | --- |
| Översikt | `/admin` | ingen; Väntar på dig, Bolag och spelbord, Börja med (Nytt spelbord primär, Lägg till klipp, Tilldela innehåll, Ny dealer, Skapa demo), Dealers, Spelhändelser |
| Dealers | `/admin/dealers`, `/admin/dealers/<id>?flik=` | Klippkarta · Röst och tal · Landningar · Används av · Inställningar; stegraden Skapa → Lägg till klipp → Klipp per fack → Röst och tal → Tilldela |
| Miljöer och material | `/admin/scenes?tab=` | Miljöer · Material (filter Bakgrund, Bordsgrafik, Arkiverat) |
| Bolag och spelbord | `/admin/companies?tab=` | Bolag · Alla spelbord · Papperskorg |
| ett bolag | `/admin/companies/<id>?flik=` | Spelbord (standard, med startadresser och papperskorg) · Tilldelning · Team · Inställningar (med journalen) |
| ett spelbord | `/admin/rooms/<id>?flik=` | Utseende · Dealer · Spelinställningar · Tillgänglighet · Bolagets val · Historik; en gemensam **Publicera** ovanför flikarna; **Öppna i spelet** i sidhuvudet |
| System | `/admin/system?flik=` | Drift · AI-agenter · Scoutgamings personal · Spelarkonton · Integration · Beroenden; Intern lobby i sidhuvudet |
| Hjälp | `/admin/guide` | ingen; menyn, vem som får ändra vad, orden, dealerflödet, var uppgifterna kommer ifrån |

Menyn visar räknare vid **Dealers** (dealers där klipp saknas) och **Bolag och spelbord** (spelbord som inte är spelbara), räknade ur det sidorna redan läst (`adminMenuCounts`); menyn läser inget själv. Gamla flik-id:n landar på närmaste flik (`adminTabAliases`), och pensionerade adresser omdirigeras i `packages/navigation/admin-workspace-routes.mjs`.

**Publicera:** spelbordets **Publicera** → **Publicera nu** (`room-release.tsx`, servern i `apps/studio/lib/room-release.mjs`) jämför med live och tar med tal, klipp, vila, placering, utseende och spelinställningar. Publiceringsraden ligger ovanför alla flikar och behåller sin jämförelse och sitt kvitto vid flikbyte. På öppna, publicerade blackjackbord sparar Utseende och Spelinställningar sina utkast; deras separata publiceringsknappar är borttagna. Osparade ändringar och pågående skrivning blockerar huvudknappen. Efter sparning läses jämförelsen igen.

**Avgränsning:** den gemensamma servervägen stöder öppna, publicerade blackjackbord. Roulette och pausade bord behåller därför utseendets publicering; Partnerportalen är oförändrad. Bolagets urval publiceras under Tilldelning. Specialvägarna har annat omfång: **Publicera igen** ligger under Tilldelning → Felsökning, **Publicera PAOWs viloklipp** under Tillgänglighet → Felsökning (kan uppdatera ett fryst paket vars miljö saknas), och **Publicera sparad placering** under miljöns Avancerat (alla berörda spelbord). De tas inte bort utan verifierad ersättning.

**Verifiering 30 oktober:** riktade klientprov kontrollerar sparning utan publicering, oförändrat grannrumsutkast, serverrevisioner, publiceringsspärr vid redigering/sparning och ny jämförelse efter sparning. Befintliga room-release-prov täcker den atomiska servervägen. Admin-klientens typkontroller och bygge passerar. CUA före/efter med syntetiska data i en tillfälligt utökad `admin-clips-fixture`: välj svenska → Publicera spärras → Spara → byt till Dealer → gemensamma granskningen visar engelska → svenska. Inget publicerades. Fixturens livscykelkvitto är ofullständigt; detta är UI-verifiering, inte deploy- eller produktionsacceptans.

## Kvar

| Område | Läge på `main` | Nästa |
| --- | --- | --- |
| Steg F, per bolag | Spelarkonton och Integration ligger under System, inte i bolagets nav; bolagets flikar Spelare och Integration är borttagna och deras gamla id:n landar på Spelbord | [STEG-F](STEG-F.md): spelare och nycklar knyts till bolag; därefter får bolagets nav Spelare och ekonomi och Integration tillbaka |
| Talkedjan | Röst och tal visar dagens verktyg; inget AI-tal fungerar i produktionen | [TALKEDJA](TALKEDJA.md): dealer-generisk kedja, Paow först |
| Landningar 3/4–4/4 | 2/4 är mergad: en dealer som kopierat PAOW:s landningar får dem genom spelbordets låsta konfiguration (`test/shared-room-layout.mjs`); fliken Landningar visar "Ärver PAOW:s landningar" för en dealer utan egen filmad profil | landningsplanens steg 3 och 4 |
| Publicera | en gemensam väg för öppna, publicerade blackjackbord; specialpublicering är avskild enligt ovan | roulette, pausade bord och riktade reparationer behöver likvärdigt serverstöd innan deras befintliga vägar kan tas bort |
| Kitet | sidorna och Spelinställningar, Nytt spelbord och Tillgänglighet är byggda med kitet | vyerna på tur i [DESIGNSYSTEM](DESIGNSYSTEM.md) |
| Partnerportalen | egen meny och vyer | [PARTNERPORTAL-KONVERTERING](PARTNERPORTAL-KONVERTERING.md) |
