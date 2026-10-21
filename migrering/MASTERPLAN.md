# Masterplan: ett Admin, en lobby och en gemensam spelmodul

Beslut och planunderlag: 21 oktober 2026. Planleverans: [PR #311](https://github.com/Jakeminator123/scoutgaming/pull/311). Utförandestatus finns bara i [status.json](status.json), med läsvy i [STATUS.md](STATUS.md). Denna plan beställdes uttryckligen av Jakob och kompletterar [produktens befintliga migrationsöversikt](../docs/CLOUD-MIGRATION.md); den återöppnar inte den redan genomförda Neon-/Blob-flytten.

## Rekommendation och mål

**Behåll main som bas. Förnya Admin och lyft ut valda spelbeteenden från Kevins rensade branch som en avgränsad modul. Radera det som ersätts i samma leverans.** Planens lämplighet: **9/10, bedömning**. Att först storstäda hela repot och databasen utan en körbar ersättningskedja är **4/10, bedömning**: det skjuter upp användarvärdet och gör beroendefel svåra att lokalisera.

Det behövs ingen tom main, inget nytt produktrepo och ingen generell merge av Kevin över main. En granskbar featurebranch skapas från aktuell main per aktivitet. En tillfällig integrationsbranch kan användas för samprov; den är ingen ny permanent produktlinje. Jakobs säkerhetsgren lämnas kvar. Begrepp och produktansvar ägs fortsatt av [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).

När hela planen är verifierad ska användaren kunna:

- Arbeta i ett sammanhängande /admin, inklusive den zoombara klippkartan, utan en parallell /control-yta.
- Välja rum i /lobby och starta spelet genom ett enda autentiserat launchkontrakt.
- Spara och publicera de överenskomna spel-, dealer-, tal-, idle- och presentationsvalen i Admin och se rätt version i spelet efter omstart.
- Använda de utvalda Kevin-beteendena med mains behörighet, rumskoppling, Neon och Blob.
- Förstå en funktion genom UI → tjänst/kontrakt → lagring eller presentation, med färre alternativa körvägar.

Jakob har därefter uttryckligen startat J01 med underagenter, parallell K01-granskning och separat SQL-läsroll. J01 är verifierad i PR #313 men inte mergad. K01:s audit-import är rättad och verifierad; en motsägelse om state/JSONB återstår i PR #314. O01 förbereds som kontraktsförslag. Aktuell färdiggrad finns i status.json och ökar bara efter verifierad leverans.

## Frysta utgångspunkter

| Källa | Full SHA | Användning |
| --- | --- | --- |
| main | 15988f32fd572c453d2189502acbe324c4566815 | Plattform, Admin, publicering, auth, Neon/Blob; inkluderar PR310:s Talade repliker och Vila/Idle |
| jakob-gren | 15988f32fd572c453d2189502acbe324c4566815 | Verifierad säkerhetsgren, inte arbetsmål |
| kevin-merge-admin | 5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc | Fryst källa efter läppsynksfix; deltat från c4818f5 är oberoende granskat, K01 ännu öppet |
| kevin-staging | 238d6dd681745ca87a813b969443e7edee3f820b | Äldre analysunderlag; inte migrationskälla |

Refarna kontrollerades på GitHub 21 oktober. En senare käll-SHA kräver granskning av deltat; en branchs namn räcker inte som versionsbevis. Medieborttagningen är ingen garanti för att alla SQL-/runtimekopplingar är borta. K01 verifierar den nya källan innan portning.

## Vad ”bäst av allt” betyder

| Område | Bas/urval | Konkret avveckling |
| --- | --- | --- |
| Admin och publicering | Main; förbättra användarflödet, behåll aktiva tjänster | Ersatta Control-sidor, formulärkopior, gamla entrypoints och deras enda tester |
| Spelkatalog och launch | /lobby + serverkontrollerat rum/paket | /game och äldre /play-katalog, gamla navlänkar och alternativa produktstarter |
| Regelkärna | Välj verifierade regler per funktion | SQL, HTTP, filer, UI, video och timers inne i själva regelkärnan |
| Delat bord och spelklient | Kevins dokumenterade beteenden som klarar K01/O01 | Kopierat auth-/wallet-/lagringssystem, hårdkodade bord/video och lokala produktregister |
| Data och identitet | Mains Neon, serverägd wallet, befintliga scoped writers | SQLite som produktfallback och bevisat oanvända tabeller efter konsumentavveckling |
| Media, tal och idle | Befintliga exakta identiteter och frysta paket i Neon/Blob | Oanvända V1-klipp från Kevin återimporteras inte; inga parallella fillager |
| Lokal utveckling | Explicit isolerad fixture där den behövs | Dolda fallbackvägar som råkar starta en annan produkt |
| Test och CI | Regler, auth, isolering, samtidighet, sparning, publicering | CSS-/sträng-/antal-lås för pensionerad implementation och redundanta byggjobb |

/play/{game} är i dag spelstart, medan /play även har varit en katalog. J04 tar bort dubbel katalog och fastställer en enda väg; en URL-radering får inte samtidigt radera serverns paket-, ägar- och autentiseringskontroller. Profil och historik får en uttrycklig destination innan gamla sidor tas bort. /studio är en teknisk basePath, inte ännu en produkt.

## Motorn ska renodlas före sammanfogning

Det finns redan åtskillnad mellan delar av regler och lagring, men serverns startkod innehåller även auth, presentation, media, äldre läsare och runtimeval. Kevins delade bord behöver granskas som tjänst, inte antas vara en fristående deterministisk motor.

Målgränser:

1. **Regelkärna:** tillstånd + kommando + explicit slump/tid → nytt tillstånd + spelhändelser. Ingen databas eller nätverksåtkomst. Reproducerbar med samma ingångar; produktionsslumpen försvagas inte.
2. **Bordstjänst:** sessioner, platser, deadlines, återanslutning, kommandon och idempotens. Tiden drivs utifrån; schemaläggning ägs här, inte av klienten.
3. **Lagringsadapter:** Postgres-transaktioner och lås för både delat bord och berörda spelare. Wallet, sko, resultat och ledger måste förbli konsistenta vid samtidighet och omstart.
4. **Presentation:** översätter committade spelhändelser till publicerade media-/talkontrakt. Misslyckad video eller tal får inte ändra utfallet eller debitera igen.
5. **Admin:** producerar validerad, versionerad konfiguration. Aktiva sessioners versionspolicy bestäms i O01; inga halvpublicerade ändringar mitt i en hand.

**Ta bort SQL ur regelkärnan, inte Postgres ur produkten.** SQLite för en namngiven, isolerad testfixture kan vara rimligt om den tillför värde; den ska inte bli en andra driftväg. Portningen ska inte börja med generell omskrivning av all SQL.

## Etapper, ansvar och procent

Varje godkänd aktivitet väger 5 procentenheter. Etappernas mål är kumulativa. Måttet avser verifierade leveranser, inte arbetsvolym eller utlovad tid. En större aktivitet kan därför ta längre tid utan att procentsiffran ökar. Förberedelser får gå parallellt enligt beroendena i status.json; en etappgrind blir inte godkänd förrän den och tidigare etapper är klara.

| Etapp | Aktiviteter | Synligt resultat/grind | Etappmål |
| --- | --- | --- | ---: |
| E1 | J01 J02 K01 O01 | Förbättrad Admin-publicering med sparning/återläsning, ersatt Control-kod borta, modulkontrakt överenskomna | 20% |
| E2 | J03 J04 J05 J06 | En Admin och en lobby; aktiva launchkontroller bevarade; runtime och tester följer produkten | 40% |
| E3 | K02 K03 J07 K04 | Kevins utvalda spel kör genom rena kontrakt och mains Postgres-adapter i isolerad miljö | 60% |
| E4 | J08 K05 J09 K06 | Admin styr publicerad konfiguration och rätt media; avvecklingsmigrering granskad och provad isolerat; produktions-DDL återstår till O03 | 80% |
| E5 | K07 J10 O02 O03 | Oberoende integration, exakt-head-granskning, erforderlig migration, leverans och faktisk driftkontroll | 100% |

- [Jakob: J01–J10](jakob-main-migrering/AKTIVITETER.md): plattform, Admin, lagring, routes, CI och städning.
- [Kevin: K01–K07](kevin-ks-migrering/AKTIVITETER.md): spelregler, delat bord, spelklient och mediakontrakt.
- Orkestratorn äger O01–O03, integration, beroenden och status. En agent implementerar, en annan granskar samma SHA. Högst ett avgränsat uppdrag per agent åt gången.

### O01 — Lås kontrakt och funktionsansvar

Beroende: K01. Kan förberedas samtidigt som J01.

- [ ] Jämför main och exakt Kevin-SHA i en funktionsmatris: behåll, porta, ersätt eller radera, med konsument och testfall.
- [ ] Bestäm vilka spelbeteenden som faktiskt omfattas: regler, seats, countdown, reconnect, saldo, sko, idle, tal, kort och tillgänglighet. ”Bäst” måste få observerbara acceptanskriterier.
- [ ] Lås kontrakt för kommandon, händelser, lagring och presentation samt configversion/rum/paket.
- [ ] Ange varje Admin-inställnings ägare, tillåtna värden, skrivmål, publiceringsgräns och verkan i aktiva/nya sessioner.
- [ ] Bekräfta kontrakten med båda ägarna och placera dem i befintliga kanoniska kontrakt/docs, med ändrade beteendetester. Inga nya parallella register eller regelböcker.

Klart: Kevin och Jakob kan implementera sina sidor utan att behöva kopiera varandras runtime eller gissa schemasemantik. Bevis och granskad SHA förs till status.json.

#### O01: kontraktsförslag för avstämning — ännu inte låst

Utgår från main `15988f32fd572c453d2189502acbe324c4566815`, Kevin-kod
`5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc` och K01-underlag
`bcd9273432c686c3e140892b5b00b2e69065dfcb`. K01:s två rättelser kvarstår.
Detta är förberedelse, inte startbesked för runtimeport, DDL eller mediaimport.

- Mains auth bestämmer spelare, operatör och tillåtet rum. Admin publicerar
  versionsbunden konfiguration; bordstjänsten och regelkärnan äger kort/utfall.
- Kommando: `roomId`, `commandId`, `expectedVersion`, `configVersion`, operation
  och payload. Actor hämtas från auth. Föreslagen beständig idempotensnyckel är
  `(roomId, actorId, commandId)`; samma nyckel med annat innehåll avvisas.
  Pröva idempotens före versionskonflikt. Repris återger lagrat kommandoresultat;
  aktuell snapshot är separat. Regler för samtidiga insatser är fortfarande öppna.
- Behåll mains globala spelarsaldo. Rum, berörda saldon, avräkning, kvitto,
  idempotens och audit ska committas atomiskt. Föreslagen låsordning är rum →
  sorterade spelar-ID → global auditkedja, utan nya resurslås därefter. O01 ska
  inventera alla berörda skrivvägar, även mains, tillsammans med J07:s ägare
  innan ordningen beslutas. J07 verifierar sedan implementationen.
- Bevara rumsstate inklusive shoe proof, auditpayload och separat proof som text.
  Nyckelordning och numeriska typer får inte ändras utan verifierad kompatibilitet.
  `rowid` ersätts uttryckligen. Studio-audit är inte spelhashkedjans ersättning.
- Konfiguration ska vara gemensam för alla spelare vid samma bord och fryst över
  en aktiv hand, även vid omstart. Föreslagen bordssession och dess bytesgräns
  måste definieras; en spelares nya inloggning får inte ge bordet en annan version.
- Offentliga händelser publiceras först efter commit med återläsbar sekvens.
  Dolda kort stannar serverägda. Presentation använder exakt publicerat material;
  tal-/video-/workerfel får inte påverka saldo eller utfall. Medielistan är kandidater.

Kevin behöver precisera vilka insatsoperationer som måste accepteras samtidigt,
vilken gemensam rund-/sko-/sessionsgräns som kan byta konfiguration och vilka
idle-/moving-lipsync-förlopp samt fallbackbeteenden som måste bevaras. Orkestratorn
sammanför svaren med mains kontrakt. O01 blir inte VERIFIED innan K01 är klar,
båda ägare har stämt av kontrakten och nödvändiga beteendeprov finns.

### O02 — Oberoende samprov

Beroende: K07 och J10.

- [ ] Frys en integrerad kandidat och verifiera schema, miljö, webb, motor och media separat.
- [ ] Kör Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning.
- [ ] Verifiera negativa fall: fel rum/ägare/roll, inaktuellt paket, dubbelkommandon, samtidiga spelare, avbruten presentation och felaktiga media-ID.
- [ ] Visa att borttagna ytor inte kan starta en alternativ produkt, och att testfixturer aldrig använder riktiga användardata.
- [ ] Granskare redovisar observerat resultat, testmiljö och kvarvarande brister; tidigare agentkvitton tillskrivs sina författare.

Klart: inga blockerande fynd; verkliga driftprov redovisas åtskilda från automatiska tester.

### O03 — Integration och leverans

Beroende: O02.

- [ ] Kontrollera aktuell main, PR-ägare, källrepo, full head, konflikter, obligatorisk CI och säkerhetsstatus.
- [ ] Följ AGENTS.md:s ägarregel: Kevin-ägd PR kräver Jakobs uttryckliga godkännande för just PR och oförändrad head. Citerade Slack-meddelanden är inte det godkännandet.
- [ ] Kör schemaändringar i godkänd ordning. Krävd Neon-readiness måste passera före merge; expansion/tolerant kod/avveckling får delas i flera PR:er där det behövs.
- [ ] Godkänd release ska ha verifierad Vercel-/Render-SHA, schema, vanlig inloggning, Admin-sparning, launch och relevant spelfunktion.
- [ ] Dokumentera återställning som fungerar med faktiskt migrerat schema, uppdatera befintlig handoff och stäng egna claims.

Klart: den integrerade produkten är faktiskt levererad och verifierad. Ingen förhandsmarkering av 100% för grön CI eller färdig plan.

## Radera med ett konkret slutdatum

I varje ändring ska agenten ange **vad som ersätts och vad som därför raderas**. Följ konsumenterna hela vägen: route → komponent → tjänst → adapter → data → build/env/test/docs. Ett gammalt namn räcker inte som raderingsbevis; en pensionerad implementation behöver inte behållas för sitt namn eller sin historik.

- **Kod:** ersatt eller utan aktiva konsumenter tas bort tillsammans med registreringar, tillhörande ensamma tester och instruktioner. Git är återställningen för versionerad kod.
- **Oklarhet:** gör en avgränsad konsumentkontroll i den aktuella aktiviteten. Notera konkret återstående fråga och ansvarig; bygg inte en permanent extra kompatibilitetsväg för att slippa avgöra.
- **Databas:** ta först bort läsare/skrivare och uppdatera schema/readiness. Prova migrering och återställning isolerat, därefter separat godkänd produktionsåtgärd. Noll rader är inte ett tillräckligt bevis för att tabellen kan släppas.
- **Media:** koppla exakta ID/hashar till aktiva och historiska paket. Oanvända Kevin-filer ska inte importeras. Historiskt refererade main-media raderas inte genom namnmatchning.
- **Ignorerat:** inventera bara utpekade metadata och konsumenter i exempelvis lab/data och open-claw/lab/data. Respektera .ignore; läs inte hemligheter, binärmassor eller det privata historiska dokumentarkivet. Ingen rg --no-ignore. Återställningsmaterial är inte en alternativ produktkälla.
- **Tester/regler:** avveckla gamla layoutlås samtidigt med ersättningen. Behåll säkerhets-, transaktions- och spelregler. Referenser till gamla repon får inte få agenten att återställa pensionerad kod.

Aktiva gemensamma tjänster flyttas eller får neutralt namn endast när det underlättar ansvarsfördelningen. En filflytt utan bättre flöde eller borttagna alternativ räknas inte som slutförd aktivitet.

## Arbetsordning nu

1. Läs [STATUS.md](STATUS.md), aktivitetsfilen, AGENTS och relevanta kanoniska dokument. Bekräfta rätt checkout, full bas-SHA och filägande.
2. Starta J01 och K01 parallellt. O01 samlar kontraktsbesluten. J02 följer direkt på den verifierade ersättningen.
3. Fortsätt enligt beroendena; integrera små granskbara PR:er. Orkestratorn gör Git-operationer i gemensam checkout; andra agenter äger separata filer eller worktrees.
4. Avrapportera vid blockerare eller färdig leverans, med aktivitet, SHA och bevis. Uppdatera status.json och generera STATUS.md. Gemensam GitHub-tråd #312 bevakas högst en gång per schemalagd femminuterskörning; inga vänteloopar eller kvittenssvar.
5. Använd [samarbets- och åtkomstguiden](SAMARBETE-OCH-ATKOMST.md) för GitHub-samordning, Slack och behörigheter.

**Tidsbild, grov uppskattning:** första synliga J01-jämförelse inom 2–4 arbetstimmar efter implementationens start; det är en återkopplingspunkt, inte löfte om en färdig sida. E1 ungefär 1–2 arbetsdagar. Hela programmet ungefär 7–12 arbetsdagar med två tillgängliga implementerare och en orkestrator, om kontrakt och åtkomst kan fastställas tidigt. Skatta om efter K01/O01; schemaavvikelser, samtidighetsfel och mediakrav kan ändra utfallet. Separat beställd femminutersbevakning av GitHub-tråden är aktiv; den ger inget utökat ändringsmandat.
