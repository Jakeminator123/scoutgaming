# Körplan v2: gemensam genomförandeplan

Beställd av Jakob 31 oktober 2026. **Den här filen ersätter körordningen i både #722 och Fables alternativ.** [NULAGE](NULAGE.md) och [UNDERLAG](UNDERLAG.md) behålls som daterade bevis. Äldre områdes-/aktivitetsfiler är avgränsningsunderlag, inte en andra aktiv kö. Endast tabellen nedan bär denna vågs status. Migreringen ligger kvar på 20/20 i `migrering/status.json`.

## Mandat och arbetsyta

- Plan/integration: `C:/Users/jakob/dev/worktrees/scoutgaming/merge-organisation-v2-1031`, branch `jakob/codex-organisation-v2-1031`. Kanonisk checkout `C:/Users/jakob/dev/scoutgaming` uppdateras endast med verifierad fast-forward av ren main; produktändringar görs i ägda worktrees.
- Jakobs senaste mål använder de tre redan uppstartade agentchattarna: ARKITEKTEN – produkt och kontrakt (auth), REPOAGENTEN – underlag och leverans (docs), DRIFTAGENTEN – moln och miljö (F11). Varje uppdrag får en kort ny brief och avgränsade filer; ingen omläsning av gammal chatthistorik krävs. Separata underagenter startas kalla för avgränsad granskning. Högst tre skrivare samtidigt. Orkestratorn äger denna plan, dokumentindex, beslutslogg och NEXT-AGENT.
- **Jakob har därefter uttryckligen gett fullt beslutsmandat för genomförandet och bett om inga fler godkännandefrågor.** MERGEAGENTEN får därför besluta om nödvändiga merges och kontrollerade release-/previewsteg inom planen efter granskning, verifierad ägare, exakt SHA och rätt prov. Tidigare frågespärrar är återkallade. Förbuden mot force, branch-/worktree-radering, kollegors arbete och RunPod-endpoints består. Destruktiv data-/historikåtgärd väljs inte utan konkret behov, återställningsunderlag och kontrollerad scope; osäkra eller onödiga ingrepp avförs av orkestratorn.
- Inga force-operationer, inga raderade brancher eller worktrees, inget arbete på Kevins/Emils/Johns resurser eller RunPod-endpoints. Inte heller en helt mergad egen branch städas här.
- Kod, lokala isolerade prov, läsande molnkontroller och granskbara PR:er ingår. Inga externa meddelanden, issue-stängningar, installationer av appar, nyckelrotationer eller incidentändringar ingår.
- Ingen produktionsdeploy beställs som bieffekt av en kodrättning. Efter godkänd merge förbereds eventuell Render-deploy på exakt SHA som ett separat granskbart steg. Vercels automatiska main-deploy redovisas i releasekvittot.

## Underlag och vad som faktiskt har verifierats

Fables tre huvudfiler och samtliga sex FA-briefs har lästs i sin helhet i `C:/Users/jakob/dev/worktrees/scoutgaming/fable-organisation-1031/docs/plans/organisation-fable/`, branch `jakob/fable-organisation-alt-1031`, källhead `a9f2c83ba31a24dc6337356c5c3f87ea2f8c3dcd`. Fables worktree och opushade commits ändras inte.

Ny läsning 31 oktober: `origin/main=394fbb02bc3a46131bfcc553fd86a90458af7209`, `origin/preview=6a3f976e4428627b135664ba7d13ae24593567c4`. Preview är en förfader till main; `services/game` är identiskt mellan dem. Director/OpenClaw och docs skiljer. Mellan rapporterad Render-prod-SHA `c5cc98d68b219a77d728813f233e27e32a3b54a2` och main ligger bara docs. Detta bevisar kodskillnaden, inte aktuell driftsättning.

GitHub-plugin/CLI bekräftar publikt repo, inga öppna PR:er vid starten och aktivt preview-ruleset 26090808 utan bypass, med raderings-/force-push-skydd. Secret scanning och push protection är på; validity/non-provider-kontroller och Dependabot security updates är av. Exakta tjänst-/deployidentiteter återläses i K1-03 innan ett driftbeslut. Fables äldre observation av publik Director-health 401 är inte ett bevis på ohälsa; autentiserad tjänststatus skiljs från publik HTTP.

| Bedömning | Vad som ändras från de två underlagen |
| --- | --- |
| Håller med Fable | Få körbara briefs, färsk bas vid start, Secure först, och tydligt avskilda beslut. Den nya vågen är mindre än inventeringens backlog. |
| Håller med Fable | Astrid behöver ett samlat ägarskap; dess `gateway/` är en levande del av spelcontainern och får inte raderas för mappnamnets skull. |
| Håller med Fable | Ingen ny generell env-inventering, systemkarta, workspaceflytt eller talprocess utan ett konkret gap. Befintliga register/readiness används. |
| Rättar min plan | CI-04 är nu en belagd kontrollucka: pre-push anropar bara `check-push-target.mjs`; pre-commit/CI granskar inte säkert varje nytillkommen mellanliggande commit. Åtgärden ligger i våg 2. |
| Säger emot Fable | Tio rader i en beroendegrupp var inte tio samtidiga agenter; #722 satte uttryckligen max tre. Vi behåller taket och gör den faktiska tilldelningen synlig. |
| Säger emot Fable | SHA:n i #722 är inventeringens frysta bevisbas, inte en instruktion att arbeta från gammal kod. Alla nya briefs får färsk start-SHA och egen head. |
| Säger emot Fable | Levande importreferenser kan själva tillhöra legacy; de är inte ensamma bevarandebevis. Följ hela vägen från aktuell route/produkt till konsumenten. Identiska filer, Next-routefiler och appägda helpers är inte färdiga raderingskandidater enbart genom likhet. FA-05 blir ingen kosmetisk städ-PR. Branch-/issue-städning ingår inte. |
| Säger emot Fable | Två indexrader medan 45 dokument ligger kvar följer inte docs/README:s regel om en rad per dokument. Indexet behålls; körningen har ändå bara denna aktiva plan. |
| Säger emot Fable | PITR och ett backupskript bevisar inte återställningsförmåga. Restore-prov krävs före destruktiv data-/historikåtgärd; det skjuts inte bort med hänvisning till liten databas. |
| Säger emot Fable | 25 ignorerade GitGuardian-fynd är inte bevis för 25 ofarliga testvärden. Två är uttryckligen verifierade som testvärden; historisk täckning är ofullständig. |
| Ny avgränsning | Fables uppgift om ett äldre beslut att göra repot privat saknar direkt beslutskälla i underlaget. Jakobs senare fullmandat ger orkestratorn beslutsrätt; nuvarande skydd och kostnad måste ändå verifieras före en ändring. Botens/minnets uppgift räcker inte som sakunderlag. |

## Tre genomförandefaser

| Fas | Arbete och parallellisering | Utgångskriterium |
| --- | --- | --- |
| 1 | Gemensam plan, auth och dokumenträttningar samt läsande driftunderlag; tre oberoende agentuppdrag | Fyra leveranser granskade; merge/CI redovisas separat från drift |
| 2 | Utvalda kontraktsrättningar: pushskydd, F11-evidens och pensionerad policykedja i skilda filer | Granskade PR:er, gröna relevanta prov och integration mot färsk main |
| 3 | Kontrollerad release och verkliga runtimeprov; får löpa parallellt med oberoende fas-2-arbete | Exakta deploy-SHA:er, health och faktiska beteendekvitton; F11 kräver båda verkliga instanserna |

Övriga områden nedan är prioriterad fortsättning, inte ett löfte om att hela inventeringens backlog startas samtidigt.
## Våg 1: rättningar och verifierad startberedskap

**Första etappen har fyra verifierbara leveranser:** mergad gemensam plan, granskad Secure-PR med relevanta gröna kontroller, granskad dokument-PR med gröna kontroller och konkret F11-/releaseberedskap. Etappens procent är antal verifierade leveranser / 4, aldrig procent av hela produktens färdighet. Merge, deploy och F11:s verkliga driftacceptans följs separat under det senare fullmandatet. Kod/CI får aldrig markeras som produktionsacceptans.

| ID | Aktivitet och ägare | Status | Bevis / nästa steg |
| --- | --- | --- | --- |
| K1-00 | MERGEAGENTEN: gemensam plan | VERIFIERAD | #723 mergad efter grön CI; main 427f7378bc89d874a7b72dfa71a3333fabbe5570. Oberoende Astra/high: 1 fynd rättat. |
| K1-01 | ARKITEKTEN: Secure på preview_session (SEC-01 / FA-01) | MERGAD | #725 head a91038242c9e24b1fd3ebde16b1b1c36f6753eaa, Astra/high 0 fynd, CI 11 godkända/0 fel. Main b080df8c74420ce7ac68b80d64ae25eb1043589e. Render prod/preview live på denna SHA; Gästläget är av i preview, så cookieutfärdning där är inte observerad; relevanta produktlogikprov passerar. |
| K1-02 | REPOAGENTEN: dokumentdrift (DOC-01/02 / FA-02) | VERIFIERAD | #724, head 3ace7db36b512823ebf754ee5da23103c05577b9, granskad diff och grön CI. Mergad som c300e1e3e2da6067e8e0d201e188a61a0f259705. |
| K1-03 | DRIFTAGENTEN: F11-beredskapsunderlag (GAM-01, REL-01/02/04 / FA-03/04) | VERIFIERAD | Läsuppdrag klart: 1/1 isolerat F11-prov, live preview-SHA och SQL verifierade. Underlaget visar att verkligt överlappsprov ännu inte är körklart; K2-02 förbereder det. |
| G1 | MERGEAGENTEN: kontroll vid varje ny integration och release | LÖPANDE GRIND | Den valda genomförandevågen är avslutad (4/4 + 3/3 + 2/2); G1 är ingen kvarstående leverans i den vågen. Jakobs fullmandat gäller fortsatt, och varje ny release kräver frysta headar, mergegrind samt relevanta preview-/runtimebevis. |

```text
färsk main + KORPLAN-v2
  +-- K1-01 AUTH: server/session + eget prov --------+
  +-- K1-02 DOKUMENT: avgränsade sakguider ----------+--> granskning + CI
  +-- K1-03 DRIFT: läsning + F11-körberedskap -------+
  +-- K1-00 MERGEAGENTEN: plan/index/beslutsunderlag-+
                 |
                 +--> G1: orkestratorns granskade releasebeslut
                          |
                          +--> G1: release/preview/F11-acceptans
```

### K1-01: Secure på preview_session

Bas läses före start. Ägda filer: `services/game/server.mjs` (previewPlayer, omkring 498–508), vid behov en liten testbar sessionsmodul i samma paket, nytt riktat `test/preview-session-cookie.mjs`, samt enbart dess testregistrering i `.githooks/pre-commit-full`. Ingen annan agent ändrar dessa filer.

Använd samma Secure-villkor som `administratorGameSession` (omkring 346–347) och `storage/async-player-auth.mjs`: krypterad socket eller NODE_ENV=production. Behåll HttpOnly, SameSite=Strict, livslängd, digest, giltig sessionsåteranvändning och befintliga player/bo/guest-grindar. Ingen ny auktoritet från en godtycklig forwarded-header och ingen bred cookie-refaktor.

Prov på verklig produktlogik, inte en kopierad sträng: production bakom TLS-terminering, direkt TLS, lokal HTTP utan production, giltig återanvändning och utgången/ogiltig session. Bevara sessions-/bolagsisolering. Node 24.21.0, högst fyra testarbetare; kör riktat nytt prov, relevanta player-auth-prov och hookens urval. Agenten gör egen buggranskning, commit med hookar, säkerhetsstatus och färdig PR mot main. Den väntar inte på CI och mergar inte.

Godkänt vid denna stoppunkt: diff och prov granskade, exakt PR-head med grön CI. Runtimekvittot tas efter godkänd release; en lokal testsvit är inte bevis för Secure i produktion.

### K1-02: dokumentdrift (avslutad startbrief)

Genomförd i #724. Uppdraget nedan beskriver läget före det verkliga F11-provet; aktuellt deploybeslut finns i B-015 och [F11-DRIFTKVITTO](F11-DRIFTKVITTO.md).

Ägda filer: `START-HERE.md`, `docs/ENVIRONMENT-RESTORATION.md`, `docs/ENVIRONMENT-VARIABLES.md`, `apps/web/README.md`, `apps/studio/docs/TERMINOLOGI.md`, `docs/plans/TALKEDJA.md`. Bara sakdokument; ingen UI-kod/ordbyteskampanj. Orkestratorn äger NEXT-AGENT, docs/README och organisationsplanen.

Rätta Fables verifierade radlista: aktivt preview-ruleset (39), F11-koden mergad men då ännu inte driftaccepterad (57 / restoration 30 / env 183), datera äldre Director/Gateway-SHA (restoration 181), nuvarande preview-namn (env 17), Node-pin för speech och separat preview (web README 60/68), pensionerade UI-exempel i terminologi 50/52/56. Bekräfta påståendena i kod innan text ändras. Talkedjans callbackkvittens får bara beskrivas som daterat redan befintligt bevis; ingen RunPod-läsning eller ändring.

Vid K1-02 behölls tomt-bord-regeln: en dokumenträttning innebar inget driftgodkännande. Inga envvärden eller envkontrakt ändrades; rättelser av namn/text kontrollerades mot befintlig JSON-förteckning. Inget datum konstruerades för när rulesetet aktiverades. Det senare verkliga driftprovet och B-015 ersätter nu den dåvarande F11-spärren.

Prov: länkar, träfflista för de ändrade felpåståendena, dokumenthookens urval och env-kontrollen där den berörs. Inga nya tester för ordalydelse. Egen buggranskning, hookar och färdig docs-PR; ingen CI-väntan eller merge i agenten.

### K1-03: F11-startberedskap

Agenten skriver inga filer. Den rapporterar högst 200 ord med färska identiteter, vad som faktiskt testats och blockerare. Orkestratorn införlivar resultatet här; ingen separat rapportmapp skapas.

Läs `services/game/shared-room-channel.mjs`, `test/shared-room-overlap.mjs`, relevanta delar av `tools/run-shared-table-qa.mjs` och SQL-schemat innan någon körinstruktion formuleras. Fables exempel med `shared_table_members WHERE active` och `shared_wallet_reservations` måste verifieras mot verkliga tabeller/kolumner. Inga påhittade SQL-frågor.

Verifiera Render-/Vercel-preview-SHA och tjänststatus via plugin/API, samt Director-health med rätt åtkomst. Bara läsning. Kör befintligt F11-prov lokalt i isolerad fixtur om beroenden redan finns, med pinnen och högst fyra arbetare. Ingen publicerad spelhand, testkonto, reservation, deploy, env-/DB-skrivning eller betald körning ingår i förberedelsen.

F11-kriteriet kräver bevis för klienter på **både gammal och ny instans** under verkligt överlapp, med löpande snapshots/version/presentation och dealerhändelser. Två klienter på en okänd instans eller en fryst klient som bara fungerar efter reconnect räcker inte. Behövs instansidentitet eller ett instrumenterat prov ska luckan beskrivas före körning.

Förbered fryst mål, korrekt konto/rum, avgränsad synthetic-data-scope, hur handens spel-/insatsfas hålls genom deploytiden, reservation/utbetalningsbevis, negativt rum/session-prov och återgång. `roundRevision` kan öka vid legitima kommandon; jämför korrekt handkontinuitet, kort/utfall och monetär unikhet, inte ett ovillkorligt konstant revisionsnummer. Använd ingen tom commit för att utlösa deploy.

## G1: genomförande under Jakobs fulla beslutsmandat

1. Läs färsk PR-identitet, full head, ägare, main och exakta CI-bevis; frys beslutet till dessa konkreta merges. Kör sedan endast repoets `merge-pr.mjs` enligt aktuella regler. Ett ändrat head kräver ny bedömning.
2. Besluta om preview-fast-forward till en namngiven full SHA och redovisa att Vercel och Render auto-deployar. Verifiera återgång och fryst mål före mutationen. Ingen preview-historik förs till main.
3. Preview-synk är inte en blockerare för läsning eller lokala F11-prov: motorkoden var identisk vid start. Före ett fullständigt miljökvitto behövs dock en uttryckligen vald, kompatibel tjänstekombination och dokumenterade SHA:er.
4. Förbered F11-deploy på exakt preview-SHA med synthetic-data-scope och återgång. Kontrollera isolering, kostnad och återgång före driftkörningen. Provet måste följa både instanserna, serverägda kort/utfall, reservations-/utbetalningsunikhet och nekad återanslutning för fel scope/session.
5. Skriv ett riktigt datum i ett ACCEPTANCE-kvitto först när provet har körts. Ta bort tomt-bord-regeln endast efter godkänt kvitto och granskad dokument-PR; inte på basis av en plan, health 200 eller en ensam lokal testsvit.

F11 är ett tydligt driftmål men underlaget kvantifierar inte dess dagliga kostnad. Det är därför ingen anledning att fördröja Secure-rättningen eller ändra regler utan acceptans.

## Våg 2: välj från belagda kontraktsproblem

Startas per kontrakt efter första granskade leveransen; ingen automatisk start av allt. Tal och Astrid delar `server.mjs` och får **inte** ha konkurrerande skrivare.

| Område / underlags-ID | Nästa avgränsade resultat | Beroende och prov |
| --- | --- | --- |
| CI-01/02/04, FB-04 | Rätta faktisk typ-/runtimeavvikelse; separat pre-push-rättning för nya mellanliggande Git-objekt | Typkontroll/bygge för berört paket. Fixtur med add→delete av stor blob ska stoppas. En max-N-gräns eller saknad remote-bas får inte tyst släppa igenom resten; explicit stopp/fallback måste provas. Inget historikomskrivande. |
| TAL-02, FB-02 | Nekat tal får inte stoppa en frisk spelmotor | Saknad bank: servern startar, health beskriver nekat tal, spel fungerar, inget tal utfärdas. Ingen godtycklig reservbank; andra startup-/databasfel får inte sväljas. |
| TAL-01 + dealer-generisk del av FB-03, FB-01 | Generated speech: aktualitet, mute/avbrott och rumsdistribution | Först bindning till dealeridentitet i katalogen, därefter aktuellhets-/distributionsprov. Fel rum/bolag, stale revision, mute/disconnect stoppar. Syntetisk ström utan GPU. |
| DAT-03, TAL-03, GAM-02, FB-03 / REN-START | Samlad Astrid-avveckling utan att radera levande talrelä | Inventera konsumenterna; gateway finns i spelcontainern och flyttas/bevaras före workeravveckling. Inga RunPod-endpoints rörs. Destruktiv Neon-/Blob-rensning och betald AV väljs endast vid belagt behov och verifierat återställnings-/kostnadsunderlag; de ingår inte i den startade städningen. |
| ADM-01 + DAT-02/03, FB-05 | Visa materialets påverkan, kompatibelt byte och atomisk publicering | Scope/CAS/samtidighet, grannrummets utkast, låsta historiska konfigurationer. Återställning får inte öppna rum/aktivera tal. Ingen radering för att en fil eller tabell ser gammal ut. |
| SEC-02, GAM-02/03, ADM-03 | Konsolidera en belagd adapter-/session-/partnerlucka åt gången | Levande native/partner/Provspel bevaras tills konsumenterna ersatts. Ingen ny generell ledger/Redis; serverauktoritet och atomiska pengar består. |
| REL-02, DAT-01 | Verifiera återställning/readiness inför det ingrepp som behöver det | PITR-fönster, backupskript eller små databaser är inte ett restore-kvitto. Isolerat mål, jämförelse och återgång krävs före destruktiv data-/historikåtgärd. |

## Bevakade fynd och separata beslut

| Tidigare aktivitet | Beslut nu |
| --- | --- |
| FA-06 / SEC-03 | Repo är publikt. Förbered kostnad, CI-/appåtkomst och sekretesskonsekvenser innan orkestratorn beslutar om synlighet. Inga påståenden om gratis scanning eller privata CI-kvoter används utan aktuell verifiering. Privatläge återkallar inte redan spridda kopior. |
| SEC-03 historisk scanning | 0 öppna är inte full täckning. Läs säkra statusfält före push; ingen rå scannertext eller hemlighet i rapporten. Full backupscan är inte automatiskt beställd och måste respektera privata dokumentgränser. |
| GEM-01 / FA-05 | Ingen branch-/worktree-/inboxstädning. Dubbletter med aktuell produktkonsument lämnas; en levande import inom en helt pensionerad kedja är inte ensam bevarandeskäl; konkreta döda filer tas först med verifierat konsumentbevis inom ägd uppgift. |
| GEM-02 | Ingen generell ominventering. Befintligt env-register och riktad providerläsning i berörd aktivitet avgör avvikelser. |
| DOC-03, CI-03, REL-03, TAL-04, GEM-03 | Ingen ny karta, workspaceflytt, releaseautomation, separat talprocess eller nytt repo nu. Återkommer bara med visad saknad förmåga och separat beslut. |
| ADM-02, TAL-05 | Ingen generell UX-ombyggnad eller Slack-aktivitet i denna våg. Ett tidigare läsmandat är inte ett uppdrag att skicka meddelanden eller koppla fler persondata. |

## Nya fynd, kvitton och omplanering

En kort rad i [BESLUTSLOGG](BESLUTSLOGG.md): observation + full SHA/resurs + reproduktion + berörd aktivitet + beslut. Skilj fel, osäkerhet och produktval. Orkestratorn ändrar bara berörd brief och beroenden; ingen ny bred rapport eller automatiskt utökat mandat.

Agentrapport: högst 200 ord, ändrade filer, verkliga prov, PR/full head, blockerare; inga hemligheter eller kopierad chatthistorik. Avslutad underagent återupptas inte. Egen buggranskning krävs; orkestratorn granskar integrationen och samlar CI. Ingen agent väntar själv på CI.

Kvitto skiljer lokala prov, CI, merge, deploy och driftacceptans. Status anger alltid vilken nivå som har verifierats. Orkestratorn beslutar om nästa del inom Jakobs mandat; ett grönt kodprov ersätter aldrig saknade runtimebevis.

## Kort etapplogg

| Tid / etapp | Verifierat | Framsteg |
| --- | --- | --- |
| 31 oktober, start | Båda planerna lästa, färsk main och mandat kontrollerade. | Startbas |
| Etapp 1 | #723–725 mergade, F11-beredskapsunderlag verifierat. | 4/4, 100 % |
| Etapp 2 | #726–728 mergade efter oberoende granskning, rättningar och grön CI. | 3/3, 100 % |
| Fortsättning | K2-04 talstart levererad; K3-02 verkligt F11-prov godkänt efter oberoende logg-/evidensgranskning och SQL-efterkontroll. | 2/2, 100 % av vald fortsättningsvåg |

### Första etappens verifierade läge

- 4/4 leveranser = 100 %: gemensam plan, auth-/dokumenträttningar och F11:s läsande beredskapsunderlag är verifierade. #723–725 är mergade. Procenten gäller etappen, inte produktens totala acceptans.
- Planbranchen ca5a13d8 togs trots tillfälligt avstängd automatisk radering bort av GitHub efter merge; samma referens återställdes omedelbart på exakt samma SHA. Under efterföljande merges hålls auto-delete tillfälligt avstängd tills hela mergeomgången har avslutats; därefter återställs tidigare inställning. De kontrollerade mergade headreferenserna är kvar. Ingen worktree eller annan branch har städats.
- Daterat K1-03-kvitto före releasen: Render/Vercel-preview låg på 6a3f976e4428627b135664ba7d13ae24593567c4, live/READY. Director /healthz ger 200 medan /health ger 401; autentiserad applikationshälsa är inte separat bevisad. Lokalt F11-prov passerar med --test-isolation=none efter miljöns spawn EPERM; propagation 268/275 ms. Det bevisar fixturen, inte riktigt Render-överlapp.
- Preview-SQL verifierar faktiska medlems-/närvaro-/reservations-/handtabeller; alla relevanta aktiva räknare var noll vid läsningen. Riktigt prov behöver instansmärkning, dealerlogg, ekonomisk avstämning och negativa återanslutningsprov. 20/15-sekundersfönster kräver kontinuerliga händer genom deploy, inte ändrade spelregler.

### Valda oberoende fortsättningar

Omplanering 31 oktober: de två färdiga agentchattarna får nedanstående separata förberedelser medan K1-01 granskas. Inga filer/paket som authagenten skriver delas. Merges och runtimekörning är separata verifieringssteg som orkestratorn nu beslutar om. Övriga våg-2-rader startas inte automatiskt.

| ID | Ägare / branch | Status | Avgränsning och godkänt resultat |
| --- | --- | --- | --- |
| K2-01 | REPOAGENTEN / jakob/codex-org-v2-push-1031 | MERGAD | #727 head 5e56b2ad910c16428829671aabe6068838fb892b: OID-luckan rättad och verifierad, CI 11 godkända/0 fel, mergegrinden godkänd. |
| K2-01 scope | REPOAGENTEN | AVGRANSNING | .githooks/pre-push, check-repo-limits och avgränsad helper samt befintligt test/check-repo-limits.mjs. Nya mellanliggande stora objekt nekas, inga tysta luckor vid första push/shallow-bas eller flera refs. Ingen bred historikscan. Granskad PR + relevanta gröna prov/CI. |
| K2-02 | DRIFTAGENTEN / jakob/codex-org-v2-f11-qa-1031 | MERGAD | #726 head d510ba62f11cefa2ee6d9cd9afe9d9a8e0b1c070: oberoende fynd och auditens SQL-format rättade, CI 10 godkända/0 fel. Main d5006a58902e5cf6f27d81a20da6d0441615b4a0. Offlinevalidering är inte driftacceptans; ID-kontraktet anpassades i K3-02. |
| K2-02 scope | DRIFTAGENTEN | AVGRANSNING | Befintlig QA-runner, liten F11-observer och redan registrerade QA-/överlappstester. Endast lokala syntetiska fixtures. Preview/instans/scope/revisions-/betalningsbevis måste vara uttryckliga; inga deployer eller spelhandlingar som bieffekt. Granskad PR och konkret kvarvarande runtimegodkännande. |

### Legacy och synlighetsbeslut: nytt underlag

K2-03 är mergad i #728, head 1bce036b6f042f59f5c88f8ae727156d2602618a, main 9352a6116cb341bcb803203a2917db9e024a2494. Astra/max fann inga blockerande buggar; fyra routing-/kommentarrester rättades. 603 lokala prov godkända/12 miljöhopp/0 fel, 36 integrationsprov, 7 manifestprov, 69 routingprov och 9 hookprov godkända. Sista CI: 10 godkända/0 fel. Uppdraget utfördes av ARKITEKTEN i `jakob/codex-org-v2-legacy-1031` efter levererad auth-PR. Uppgiften följer hela legacy-clip-policy/inventory-kedjan och får bara ta bort den belagt pensionerade delen. Serverns auth, QA-verktyg och pushgrind ägs av andra. Sparade tomma fält ska fortsätta kunna läsas och icke-tomma pensionerade bindningar nekas säkert. Nya/raderade dokument integreras av MERGEAGENTEN; inga media- eller databasändringar ingår. Den direkta Neon-räkningen i F-20261031-05 är underlag, inte generellt Astrid-raderingsmandat.

För FA-06 visar aktuell GitHub-dokumentation att privata repositories kan få andra säkerhets-/rulesetvillkor beroende på plan och ägarskap. Konto-API:t lämnade inget abonnemangsnamn. Vi kan därför inte lova att nuvarande skydd består efter ett byte. GitHubs aktuella Actions-förmån beskrivs som ett compute-belopp per månad, så Fables äldre generella minutkvoter används inte som budgetbevis. Faktisk kostnad och appåtkomst är fortfarande inte verifierade. Källor: [synlighetskonsekvenser](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility), [rulesetvillkor](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository), [Actions-förmån](https://docs.github.com/en/billing/reference/product-usage-included), [secret-scanning-villkor](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning). Ingen synlighet, licens eller budget ändras.
### Fas 3 och nästa avgränsade kontrakt

| ID | Ägare | Status / kriterium |
| --- | --- | --- |
| K3-01 | MERGEAGENTEN | Release e8d0b935fd33b7e625f157788033359085d16f96 verifierad: Render prod dep-dbinukgae00c73c7eapg och preview dep-dbinum6417fc73a59h40 live; båda versioner/health200. Vercel prod dpl_4dyyzwFHPLT4CVHbYF4xxhWDnuEh och preview dpl_9iiTaeuJ9PkfohHD3bdujhksX4Ua READY på samma SHA; previewdomänen verifierad. F11-provet kördes på denna frysta runtime; preview fick därefter en ny deploy på samma SHA, dep-dbiob649v7es7385p7u0. Se [driftkvittot](F11-DRIFTKVITTO.md). |
| K3-02 | ARKITEKTEN + MERGEAGENTEN | KLAR: #729/#732/#733/#735 levererar identitet, driver, loggning och granskad evidens. Andra verkliga provet gav 169 s tvåinstansöverlapp, korrekta pengar, återanslutning och negativa prov. Kall Astra/high återläste faktiska Render-loggar; inga blockerande fynd. Egen Neon-efterkontroll gav noll aktiva medlemmar/närvaro/reservationer/händer. [F11-DRIFTKVITTO](F11-DRIFTKVITTO.md) kvitterar den testade runtimen och avgränsar deploybeslutet. Första provet förblir underkänt. Direkt CLI-importcykel är rättad och mergad i #736 på 03de02d219cf4a50b11a061ff660617f22010d2b. |
| K2-04 / TAL-02 | REPOAGENTEN + MERGEAGENTEN | Klar: #731 mergad på 9832cf21dbb47ad88c4ef2e0ac95067b335a69bd efter grön CI och oberoende timeout-/resursgranskning. Gemensam aborterbar bankdeadline på 5 s; obligatoriska DB-/readinessfel förblir fatala. Sju riktade omprov hos orkestratorn passerade, inklusive verklig supervisorstart efter 5,195 s. Driftsatt i båda miljöerna; inga providerjobb kördes. |

Vercel-pluginens previewläsning gav 403/404. Befintlig lokal CLI med uttrycklig global config och scope verifierade därefter projectId, deploymentId, branch, SHA och domänalias. Ingen ny app, åtkomst eller projektinställning lades till. Gästläget i preview är av; ingen env ändrades för att få fram en cookie i testet.
