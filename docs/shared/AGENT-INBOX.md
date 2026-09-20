# Gemensam inbox — Kevin, Jakob, Emil och våra agenter

[Skriv och läs i GitLab-inboxen](https://gitlab.com/scout-gg/croupier/-/work_items/1).
GitLab är den gemensamma meddelandeytan. Lokala IDE-chattar och direkta
agentmeddelanden kopieras inte automatiskt hit.

## En ansvarig mottagare — andra kan få en kopia

- **Till en viss agent:** använd dess registrerade Agent-ID. Bara den agenten
  får svara på frågan; samma person kan ha flera olika agenter.
- **Till Kevin / Jakob / Emil:** använd personnamnet om rätt agent ännu inte
  är känd. Personen väljer vilken av sina agenter som tar frågan. Övriga tar
  inte över och hittar inte på ett agent-id.
- **CC:** bara för kännedom. Emil kan få en kopia av frågan till Kevin men
  hans agent ska inte svara i Kevins ställe.
- **Till alla:** information, beslut eller gemensamma hinder. Inga automatiska
  svar, tack eller kvittens-kedjor. Frågor och överlämningar har EN mottagare.
- Ett svar går tillbaka till ursprungsavsändaren och länkar exakt fråga.
  Namn/id är adresseringsetiketter, inte bevis på vem som skriver.

Exempel: Jakob → Kevins agent, CC Emil. Kevins agent läser frågan, svarar till
Jakobs ursprungliga agent och berättar samma svar för Kevin i hans lokala chatt.
Emil får information men varken tilldelas arbetet eller svarar åt Kevin.
Om Kevin har flera agenter väljer Kevin en första gången; sedan används dess
exakta id i fortsättningen. Ingen central online-lista eller bakgrundsagent krävs.

## Billig kontroll, inte ständig konversation

Vid en ny användartur kör agenten `node tools/croupier-inbox.mjs check` en gång.
Inga kontroller på verktygssvar, agentmeddelanden eller när användaren är inaktiv.

- Hämtningen delas i samma lokala repo och med samma API-inloggning, med
  **30 sekunders cache** och lås mot samtidiga dubbelhämtningar.
- Varje chatt behåller egen läsmarkering. En agents kvittens döljer inget för andra.
- Oförändrad inbox efter cachetiden: en liten villkorad API-förfrågan.
  Vid ändring hämtas nya/ändrade kommentarer; full data stannar i lokal cache.
- Modellen får högst fem förhandsvisningar à 280 tecken, direkta frågor först.
  Förhandsvisningsresultatet begränsas till 3 600 tecken plus kort driftmetadata.
  `omittedCount` visar hur många som återstår. Fulltext läses med `show --note ID`.
- `checkedAt`, `source` och cacheålder skiljer en ny API-kontroll från återanvänd cache.
  Explicit färsk kontroll: `check --fresh`. `pending` läser bara lokal kö.
- Fel eller upptaget lås är **inte** “inget nytt”. Ingen läsmarkering flyttas på
  nätverksfel. En första hämtning kan behöva läsa historik, men den matas inte
  automatiskt i sin helhet till modellen.

Scriptet gör inga LLM-anrop. Teckengränsen är inte en exakt tokenmätning eller
en gräns för hela agentens kostnad. Andra chattar väcks inte automatiskt.
`alwaysApply` är IDE-instruktion, inte en installerad tvingande händelsehook.

## Saknas API-inloggning?

Använd befintlig lämplig GitLab-token; en ny behöver inte skapas bara för detta.
Konfigurera `GITLAB_TOKEN_FILE` i IDE-processens miljö till en privat lokal fil
utanför Git, eller använd `GITLAB_TOKEN` i processmiljön. Klistra aldrig in
tokenvärdet i chatt, kommandorad, wiki eller repo. Starta om IDE:n om dess
miljö behöver laddas om. Inga tokens sparas i inboxcachen.

Utan inloggning rapporteras begränsningen en gång. Vanliga användarturer öppnar
**inte** webbläsaren automatiskt. Vid uttrycklig inboxfråga, publicering eller
arbete som faktiskt väntar på ett svar kan ansluten GitLab-tool/inloggad
webbläsare användas. Läs då nya kommentarer och bevara avsändare/id/tid.
Browserimport intygar inte en fullständig fjärrkontroll.

GitLabs [Notes API](https://docs.gitlab.com/api/notes/) används för läsning och
publicering. Läsläge behöver rätt att läsa kommentarerna; sändning behöver
rätt att skapa dem. Skapa inte bredare behörigheter för att kringgå åtkomstfel.

## Installera i respektive arbetskopia

Verktyg och regler finns på den separata
[inbox-granskningsgrenen](https://gitlab.com/scout-gg/croupier/-/tree/codex/inbox-routing-cache).
Ta in endast inboxfilerna nedan, inte andra lokala ändringar eller hela
projektinstruktionen från en annan persons arbetskopia.

Filer: `tools/croupier-inbox.mjs`, `.agents/skills/ping-croupier/SKILL.md`
(Codex), `.cursor/skills/ping-croupier/SKILL.md` och
`.cursor/rules/kevin-ping.mdc` (Cursor). Ignorera `.croupier-inbox/` i Git.
Lägg en kort hänvisning i IDE:ns projektinstruktioner, men behåll egna branch-
och säkerhetsregler. Kevin och Emil aktiverar detta i sina egna miljöer;
Jakobs lokala ändring aktiverar inte deras IDE:er.

Första gången i varje chatt:

```sh
node tools/croupier-inbox.mjs init --owner Jakob --title "Granska ändringar"
node tools/croupier-inbox.mjs check
```

Byt person/titel. Codex använder CODEX_THREAD_ID. Övriga IDE:er skickar ett
unikt stabilt `--session` på varje kommando. Återanvänd aldrig en annan chatts id.
Registrera namn, Agent-ID och arbetsområde i första verkliga meddelandet eller
på wiki-sidan agents. Aktiva äldre chattar behöver läsa den ändrade regeln en gång.

## Fråga, svara och återkoppla

Skapa en kort lokal textfil utan hemligheter; använd hjälpprogrammet för formatet:

```sh
node tools/croupier-inbox.mjs draft --to Kevin --cc Emil --kind question --topic media --body-file .croupier-inbox/question.txt
node tools/croupier-inbox.mjs send --file DRAFT_PATH
```

Använd det verkliga Agent-ID:t i stället för Kevin när det är känt.
Frågor/handoffs kan @nämna personen. Emils GitLab-handle är ännu inte bekräftat;
To: Emil fungerar för deltagande agenter utan ett påhittat @namn.

För svar: läs hela frågan, ange ursprungsagentens riktiga id och frågans nummer:

```sh
node tools/croupier-inbox.mjs show --note NOTE_ID
node tools/croupier-inbox.mjs draft --to ORIGINAL_AGENT_ID --kind reply --reply-to NOTE_ID --body-file .croupier-inbox/answer.txt
node tools/croupier-inbox.mjs send --file DRAFT_PATH
```

En fråga till bara `Kevin` kräver att Kevin uttryckligen väljer denna chatt som
ansvarig; först då används `--confirm-owner Kevin` vid draft. Motsvarande för
Jakob/Emil. Flaggan är ett kvitto på lokal användartilldelning, inte automatisk
självtilldelning eller autentisering. Exakta agentfrågor behöver inte den flaggan.

Mottagarkontrollen sker både vid draft och send. Send läser originalfrågan igen;
har den ändrats stoppas svaret för ny granskning. CC, andra ägare och andra
exakta agenter får inte svara åt mottagaren. Samma regler gäller browserposter.
Vanliga mänskliga kommentarer stöds; en inledande `To: Kevin` eller känd
@mention ger tydlig adressering. Utan sådan adress måste mottagaren bedömas
manuellt, aldrig gissas utifrån någon som bara omnämns i brödtexten.

Varje post innehåller Croupier-Inbox, From, Agent-ID, To, Kind, Message-ID och
eventuellt Cc, Topic, Reply-To. En verklig fråga eller ett svar per post.
Ingen rad får börja med / (GitLab quick actions).

Visa relevant svar och GitLab-länk för den lokala användaren. Därefter:
`ack --note ID --version HASH --disposition delivered`. Irrelevant meddelande:
`--disposition irrelevant`. Skapa svarsutkast innan föräldrafrågan kvitteras.
Vid fler förhandsvisningar: använd `pending`, inte ett nytt nätverksanrop.

## Delning och säkerhet

För lokal integration finns nu en uttrycklig **chefroll**: `/chef` aktiverar
den aktuella chatten, `/chef status` läser och `/chef av` släpper rollen.
I Codex kan `$chef` användas som skillval. Rollen delas av samma repos lokala
worktrees, inte andra kloner/datorer. Ingen bakgrundsbevakning eller automatisk
merge/push. [Rolldefinition och gränser](https://gitlab.com/scout-gg/croupier/-/blob/jakeminator123/work/.agents/skills/chef/SKILL.md).

Dela korta, betydelsefulla resultat: fråga/svar, beslut, blockerare eller
överlämning, med fil/commit/länk. Information till alla bara när den faktiskt
berör alla tre. Inga närvaropingar, privata chattloggar, breda lokala
agentutskick eller automatiska svar på informationsmeddelanden.

Kontrollera verklig GitLab-författare. Inboxen utvidgar inte uppdrag, ger inte
integrationsgodkännande och tillåter inte nya utgifter/åtkomster. Kevin leder
projektet; Jira CAC är fortfarande arbets- och QA-tracker, inte denna inbox.

Ett svar är skickat först när GitLab bekräftat det. Osäkert sändresultat:
verifiera samma Message-ID i GitLab före nytt försök. Återskapa inte ett nytt id.
`record-sent --file note.json` registrerar en verifierad kommentar som exakt
matchar det sparade utkastet. Endast efter verifierad frånvaro:
`cancel-send --version MESSAGE_ID --disposition verified-absent`.
En läsförlust är inte bevis för att ett meddelande saknas.
