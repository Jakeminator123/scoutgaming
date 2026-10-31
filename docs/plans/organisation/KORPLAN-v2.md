# Körplan v2: gemensam genomförandeplan

Beställd av Jakob 31 oktober 2026. **Den här filen ersätter körordningen i både #722 och Fables alternativ.** [NULAGE](NULAGE.md) och [UNDERLAG](UNDERLAG.md) behålls som daterade bevis. Äldre områdes-/aktivitetsfiler är avgränsningsunderlag, inte en andra aktiv kö. Endast tabellen nedan bär denna vågs status. Migreringen ligger kvar på 20/20 i `migrering/status.json`.

## Mandat och arbetsyta

- Plan/integration: `C:/Users/jakob/dev/worktrees/scoutgaming/merge-organisation-v2-1031`, branch `jakob/codex-organisation-v2-1031`. Kanonisk checkout `C:/Users/jakob/dev/scoutgaming` hålls orörd.
- Jakobs senaste mål använder de tre redan uppstartade agentchattarna: ARKITEKTEN – produkt och kontrakt (auth), REPOAGENTEN – underlag och leverans (docs), DRIFTAGENTEN – moln och miljö (F11). Varje uppdrag får en kort ny brief och avgränsade filer; ingen omläsning av gammal chatthistorik krävs. Separata underagenter startas kalla för avgränsad granskning. Högst tre skrivare samtidigt. Orkestratorn äger denna plan, dokumentindex, beslutslogg och NEXT-AGENT.
- **Jakob har uttryckligen godkänt att denna plan levereras och mergas via PR, och att de tre agentchattarna därefter driver genomförandet.** För övriga merges, produktionsmiljö-/databasändringar, preview-fast-forward, byte av repo-synlighet och betald API-/GPU-körning gäller fortfarande föregående uttryckliga ja-spärr. Godkännanden knyts till det konkreta ingreppet; inga andra åtgärder följer av en planmerge.
- Inga force-operationer, inga raderade brancher eller worktrees, inget arbete på Kevins/Emils/Johns resurser eller RunPod-endpoints. Inte heller en helt mergad egen branch städas här.
- Kod, lokala isolerade prov, läsande molnkontroller och granskbara PR:er ingår. Inga externa meddelanden, issue-stängningar, installationer av appar, nyckelrotationer eller incidentändringar ingår.
- Ingen produktionsdeploy beställs som bieffekt av en kodrättning. Efter godkänd merge förbereds eventuell Render-deploy på exakt SHA som ett separat granskbart steg. Vercels automatiska main-deploy redovisas i mergefrågan.

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
| Ny avgränsning | Fables uppgift om ett äldre beslut att göra repot privat saknar direkt beslutskälla i underlaget. Nuvarande användarinstruktion kräver ett nytt uttryckligt ja. Ingen synlighetsändring görs på en bots/minnesantecknings mandat. |

## Våg 1: rättningar och verifierad startberedskap

**Första etappen har fyra verifierbara leveranser:** mergad gemensam plan, granskad Secure-PR med relevanta gröna kontroller, granskad dokument-PR med gröna kontroller och konkret F11-/releaseberedskap. Etappens procent är antal verifierade leveranser / 4, aldrig procent av hela produktens färdighet. Merge, deploy och F11:s verkliga driftacceptans är nästa steg efter Jakobs ja. Kod/CI får aldrig markeras som produktionsacceptans.

| ID | Aktivitet och ägare | Status | Bevis / nästa steg |
| --- | --- | --- | --- |
| K1-00 | MERGEAGENTEN: denna gemensamma plan och beslutsunderlag | PAGAR | Skriven från main 394fbb02; plan-PR och oberoende granskning återstår. |
| K1-01 | AUTH: Secure på preview_session (SEC-01 / FA-01) | REDO | ARKITEKTEN, exakt brief nedan. |
| K1-02 | DOKUMENT: rätta verifierad dokumentdrift (DOC-01/02 / FA-02) | REDO | REPOAGENTEN, exakt brief nedan. |
| K1-03 | DRIFT: F11-startberedskap och avgränsat godkännandeunderlag (GAM-01, REL-01/02/04 / FA-03/04) | REDO | DRIFTAGENTEN; läsning och befintliga isolerade tester, inga molnmutationer. |
| G1 | MERGEAGENTEN: genomför godkända leverans-/driftsteg | VANTAR_BESLUT | Aktiveras först med Jakobs ja för konkreta PR-headar, därefter fryst preview-/deploymål. |

```text
färsk main + KORPLAN-v2
  +-- K1-01 AUTH: server/session + eget prov --------+
  +-- K1-02 DOKUMENT: avgränsade sakguider ----------+--> granskning + CI
  +-- K1-03 DRIFT: läsning + F11-körberedskap -------+
  +-- K1-00 MERGEAGENTEN: plan/index/beslutsunderlag-+
                 |
                 +--> STOPP: Jakobs konkreta merge-/driftgodkännande
                          |
                          +--> G1: release/preview/F11-acceptans
```

### K1-01: Secure på preview_session

Bas läses före start. Ägda filer: `services/game/server.mjs` (previewPlayer, omkring 498–508), vid behov en liten testbar sessionsmodul i samma paket, nytt riktat `test/preview-session-cookie.mjs`, samt enbart dess testregistrering i `.githooks/pre-commit-full`. Ingen annan agent ändrar dessa filer.

Använd samma Secure-villkor som `administratorGameSession` (omkring 346–347) och `storage/async-player-auth.mjs`: krypterad socket eller NODE_ENV=production. Behåll HttpOnly, SameSite=Strict, livslängd, digest, giltig sessionsåteranvändning och befintliga player/bo/guest-grindar. Ingen ny auktoritet från en godtycklig forwarded-header och ingen bred cookie-refaktor.

Prov på verklig produktlogik, inte en kopierad sträng: production bakom TLS-terminering, direkt TLS, lokal HTTP utan production, giltig återanvändning och utgången/ogiltig session. Bevara sessions-/bolagsisolering. Node 24.21.0, högst fyra testarbetare; kör riktat nytt prov, relevanta player-auth-prov och hookens urval. Agenten gör egen buggranskning, commit med hookar, säkerhetsstatus och färdig PR mot main. Den väntar inte på CI och mergar inte.

Godkänt vid denna stoppunkt: diff och prov granskade, exakt PR-head med grön CI. Runtimekvittot tas efter godkänd release; en lokal testsvit är inte bevis för Secure i produktion.

### K1-02: verifierad dokumentdrift

Ägda filer: `START-HERE.md`, `docs/ENVIRONMENT-RESTORATION.md`, `docs/ENVIRONMENT-VARIABLES.md`, `apps/web/README.md`, `apps/studio/docs/TERMINOLOGI.md`, `docs/plans/TALKEDJA.md`. Bara sakdokument; ingen UI-kod/ordbyteskampanj. Orkestratorn äger NEXT-AGENT, docs/README och organisationsplanen.

Rätta Fables verifierade radlista: aktivt preview-ruleset (39), F11-koden mergad men driftacceptans återstår (57 / restoration 30 / env 183), datera äldre Director/Gateway-SHA (restoration 181), nuvarande preview-namn (env 17), Node-pin för speech och separat preview (web README 60/68), pensionerade UI-exempel i terminologi 50/52/56. Bekräfta påståendena i kod innan text ändras. Talkedjans callbackkvittens får bara beskrivas som daterat redan befintligt bevis; ingen RunPod-läsning eller ändring.

Behåll tomt-bord-regeln i sak. Att byta ”F11 är rättad” till ”F11:s driftacceptans är kvitterad” är en korrekt precisering, inte ett godkännande. Ändra inga envvärden eller envkontrakt; rättelse av namn/text kontrolleras mot befintlig JSON-förteckning. Inget datum konstrueras för när rulesetet aktiverades.

Prov: länkar, träfflista för de ändrade felpåståendena, dokumenthookens urval och env-kontrollen där den berörs. Inga nya tester för ordalydelse. Egen buggranskning, hookar och färdig docs-PR; ingen CI-väntan eller merge i agenten.

### K1-03: F11-startberedskap

Agenten skriver inga filer. Den rapporterar högst 200 ord med färska identiteter, vad som faktiskt testats och blockerare. Orkestratorn införlivar resultatet här; ingen separat rapportmapp skapas.

Läs `services/game/shared-room-channel.mjs`, `test/shared-room-overlap.mjs`, relevanta delar av `tools/run-shared-table-qa.mjs` och SQL-schemat innan någon körinstruktion formuleras. Fables exempel med `shared_table_members WHERE active` och `shared_wallet_reservations` måste verifieras mot verkliga tabeller/kolumner. Inga påhittade SQL-frågor.

Verifiera Render-/Vercel-preview-SHA och tjänststatus via plugin/API, samt Director-health med rätt åtkomst. Bara läsning. Kör befintligt F11-prov lokalt i isolerad fixtur om beroenden redan finns, med pinnen och högst fyra arbetare. Ingen publicerad spelhand, testkonto, reservation, deploy, env-/DB-skrivning eller betald körning ingår i förberedelsen.

F11-kriteriet kräver bevis för klienter på **både gammal och ny instans** under verkligt överlapp, med löpande snapshots/version/presentation och dealerhändelser. Två klienter på en okänd instans eller en fryst klient som bara fungerar efter reconnect räcker inte. Behövs instansidentitet eller ett instrumenterat prov ska luckan beskrivas före körning.

Förbered fryst mål, korrekt konto/rum, avgränsad synthetic-data-scope, hur handens spel-/insatsfas hålls genom deploytiden, reservation/utbetalningsbevis, negativt rum/session-prov och återgång. `roundRevision` kan öka vid legitima kommandon; jämför korrekt handkontinuitet, kort/utfall och monetär unikhet, inte ett ovillkorligt konstant revisionsnummer. Använd ingen tom commit för att utlösa deploy.

## G1: endast efter Jakobs godkännande

1. Läs färsk PR-identitet, full head, ägare, main och exakta CI-bevis; fråga om dessa konkreta merges. Kör sedan endast repoets `merge-pr.mjs` enligt aktuella regler. Ett ändrat head kräver ny bedömning.
2. Föreslå preview-fast-forward till en namngiven full SHA och redovisa att Vercel och Render auto-deployar. Invänta särskilt ja före mutationen. Ingen preview-historik förs till main.
3. Preview-synk är inte en blockerare för läsning eller lokala F11-prov: motorkoden var identisk vid start. Före ett fullständigt miljökvitto behövs dock en uttryckligen vald, kompatibel tjänstekombination och dokumenterade SHA:er.
4. Förbered F11-deploy på exakt preview-SHA med synthetic-data-scope och återgång. Fråga före driftkörningen. Provet måste följa både instanserna, serverägda kort/utfall, reservations-/utbetalningsunikhet och nekad återanslutning för fel scope/session.
5. Skriv ett riktigt datum i ett ACCEPTANCE-kvitto först när provet har körts. Ta bort tomt-bord-regeln endast efter godkänt kvitto och granskad dokument-PR; inte på basis av en plan, health 200 eller en ensam lokal testsvit.

F11 är ett tydligt driftmål men underlaget kvantifierar inte dess dagliga kostnad. Det är därför ingen anledning att fördröja Secure-rättningen eller ändra regler utan acceptans.

## Våg 2: välj från belagda kontraktsproblem

Startas per kontrakt efter första godkännandepunkten; ingen automatisk start av allt. Tal och Astrid delar `server.mjs` och får **inte** ha konkurrerande skrivare.

| Område / underlags-ID | Nästa avgränsade resultat | Beroende och prov |
| --- | --- | --- |
| CI-01/02/04, FB-04 | Rätta faktisk typ-/runtimeavvikelse; separat pre-push-rättning för nya mellanliggande Git-objekt | Typkontroll/bygge för berört paket. Fixtur med add→delete av stor blob ska stoppas. En max-N-gräns eller saknad remote-bas får inte tyst släppa igenom resten; explicit stopp/fallback måste provas. Inget historikomskrivande. |
| TAL-02, FB-02 | Nekat tal får inte stoppa en frisk spelmotor | Saknad bank: servern startar, health beskriver nekat tal, spel fungerar, inget tal utfärdas. Ingen godtycklig reservbank; andra startup-/databasfel får inte sväljas. |
| TAL-01 + dealer-generisk del av FB-03, FB-01 | Generated speech: aktualitet, mute/avbrott och rumsdistribution | Först bindning till dealeridentitet i katalogen, därefter aktuellhets-/distributionsprov. Fel rum/bolag, stale revision, mute/disconnect stoppar. Syntetisk ström utan GPU. |
| DAT-03, TAL-03, GAM-02, FB-03 / REN-START | Samlad Astrid-avveckling utan att radera levande talrelä | Inventera konsumenterna; gateway finns i spelcontainern och flyttas/bevaras före workeravveckling. Inga RunPod-endpoints rörs. Neon/Blob och betald AV ligger bakom separata ja och återställningsunderlag. |
| ADM-01 + DAT-02/03, FB-05 | Visa materialets påverkan, kompatibelt byte och atomisk publicering | Scope/CAS/samtidighet, grannrummets utkast, låsta historiska konfigurationer. Återställning får inte öppna rum/aktivera tal. Ingen radering för att en fil eller tabell ser gammal ut. |
| SEC-02, GAM-02/03, ADM-03 | Konsolidera en belagd adapter-/session-/partnerlucka åt gången | Levande native/partner/Provspel bevaras tills konsumenterna ersatts. Ingen ny generell ledger/Redis; serverauktoritet och atomiska pengar består. |
| REL-02, DAT-01 | Verifiera återställning/readiness inför det ingrepp som behöver det | PITR-fönster, backupskript eller små databaser är inte ett restore-kvitto. Isolerat mål, jämförelse och återgång krävs före destruktiv data-/historikåtgärd. |

## Bevakade fynd och separata beslut

| Tidigare aktivitet | Beslut nu |
| --- | --- |
| FA-06 / SEC-03 | Repo är publikt. Förbered kostnad, CI-/appåtkomst och sekretesskonsekvenser innan Jakob väljer synlighet. Inga påståenden om gratis scanning eller privata CI-kvoter används utan aktuell verifiering. Privatläge återkallar inte redan spridda kopior. |
| SEC-03 historisk scanning | 0 öppna är inte full täckning. Läs säkra statusfält före push; ingen rå scannertext eller hemlighet i rapporten. Full backupscan är inte automatiskt beställd och måste respektera privata dokumentgränser. |
| GEM-01 / FA-05 | Ingen branch-/worktree-/inboxstädning. Dubbletter med levande konsumenter lämnas; konkreta döda filer tas först med verifierat konsumentbevis inom ägd uppgift. |
| GEM-02 | Ingen generell ominventering. Befintligt env-register och riktad providerläsning i berörd aktivitet avgör avvikelser. |
| DOC-03, CI-03, REL-03, TAL-04, GEM-03 | Ingen ny karta, workspaceflytt, releaseautomation, separat talprocess eller nytt repo nu. Återkommer bara med visad saknad förmåga och separat beslut. |
| ADM-02, TAL-05 | Ingen generell UX-ombyggnad eller Slack-aktivitet i denna våg. Ett tidigare läsmandat är inte ett uppdrag att skicka meddelanden eller koppla fler persondata. |

## Nya fynd, kvitton och omplanering

En kort rad i [BESLUTSLOGG](BESLUTSLOGG.md): observation + full SHA/resurs + reproduktion + berörd aktivitet + beslut. Skilj fel, osäkerhet och produktval. Orkestratorn ändrar bara berörd brief och beroenden; ingen ny bred rapport eller automatiskt utökat mandat.

Agentrapport: högst 200 ord, ändrade filer, verkliga prov, PR/full head, blockerare; inga hemligheter eller kopierad chatthistorik. Avslutad underagent återupptas inte. Egen buggranskning krävs; orkestratorn granskar integrationen och samlar CI. Ingen agent väntar själv på CI.

Kvitto skiljer lokala prov, CI, merge, deploy och driftacceptans. Klart vid denna körnings godkännandepunkt betyder **granskningsklart**, inte driftsatt. Nästa del startar först efter det uttryckliga beslut som krävs.

## Kort etapplogg

| Tid / etapp | Verifierat | Framsteg |
| --- | --- | --- |
| 31 oktober, start | Båda planerna lästa, färsk main och mandat kontrollerade; gemensam plan skriven men inte granskad/mergad. | 0/4 leveranser, 0 % |
