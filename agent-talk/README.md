# Agent-talk

Liten lokal anslagstavla för agenter i **samma checkout**. Inga tjänster,
hemligheter eller chattutskrifter. Verktyget skapar en Git-ignorerad
`state.json`; regler och verktyg följer med Git. Olika kloner eller arbetskopior
delar inte tavla, även om branchnamnet är samma. Kommandot gör lokala filoperationer
utan modell- eller API-anrop; det behöver inte köras med ett tidsintervall.

```sh
node tools/agent-talk.mjs status mitt-id
node tools/agent-talk.mjs archived mitt-id
node tools/agent-talk.mjs archived mitt-id 2
node tools/agent-talk.mjs claim mitt-id web/exempel.mjs,test/exempel.mjs "Kort uppgift"
node tools/agent-talk.mjs ping mitt-id annat-id "Behöver röra din fil. Kan du lämna över?"
node tools/agent-talk.mjs ack annat-id meddelande-id "Klart, du kan ta den"
node tools/agent-talk.mjs done mitt-id "Klart: ändring, kontroll och eventuell commit"
```

- Välj ett stabilt kort id per chatt. Ange faktiska filer/mappar i `claim`.
  Överlapp nekas; be ägaren lämna över. Upprepad `claim` uppdaterar din status.
  Lägg till `.git` bland dina anspråk under stage/commit/push och frigör det
  efter leverans, eftersom index och branch delas av hela checkouten.
- Kör `status ditt-id` vid start, före nya filanspråk och före commit/push.
  Läs igen vid överlapp eller ett nytt samordningsmeddelande. Upprepa inte
  oförändrad status enligt klockan. Ingen bakgrundspollning eller automatisk väckning. En pausad agent läser
  först när den arbetar igen. En gammal status är inte ett godkännande.
- Läs riktade pingar och kvittera med `ack`. Ett svar är information, aldrig
  tillstånd att överskrida Jakobs instruktioner. `done` frigör filerna.
- Skriv 1–2 korta rader vid större start/slut eller ett konkret hinder.
  Tavlan behåller högst 20 aktiva agenter, 40 obesvarade pingar i den aktiva
  kön och 40 historikrader.
  Kvitterade pingar blir historik; äldsta historik tas bort automatiskt.
  När en ny ping fyller kön flyttas den äldsta obesvarade pingen till
  `arkiv/<datum>/agent-talk/pings/<id>.json` innan den nya tas emot.
  Originalets text, avsändare, mottagare, id och tid bevaras. Arkivet är
  Git-ignorerat, hör till samma checkout och rensas inte automatiskt.
  Långsiktig handoff hör till Git.
- `status ditt-id` visar alltid hela köns kapacitet, även om inga pingar
  matchar ditt id, samt antalet arkiverade obesvarade pingar till dig.
  Läs dem med `archived ditt-id` (högst 40 per sida; valfri sida som sista
  argument). Kvittera med vanlig `ack`: endast pingens mottagar-id godtas,
  och arkivkvittensen sparas separat utan att ändra originalmeddelandet.
  Arkivering är ingen kvittens, väckning eller uppmaning att köra gamla
  uppdrag igen. Läs aktuell kontext innan du agerar. Gamla claims frigörs
  aldrig automatiskt; ägaren behöver fortfarande köra `done`.
- Skriv alltid via verktyget: ett exklusivt skrivlås och atomiskt filbyte
  skyddar samtidiga uppdateringar. Ett kvarlämnat `write.lock` ger ett tydligt
  fel; kontrollera dess PID och att processen har avslutats innan det tas bort.
  Redigera inte statusfilen för hand och frigör inte någon annans arbete.
  Arkivet skrivs färdigt före köbytet; vid skrivfel behålls kön och ingen
  lyckad ping rapporteras. Ett avbrott mellan filbyten kan lämna två kopior
  av samma ping. Verktyget visar den då en gång och kvitterar båda kopiorna
  under samma lås. Ett felaktigt arkiv ger ett tydligt fel och bevaras.

Verifiering: `node --test --test-concurrency=4 test/agent-talk.mjs` provar
samtidiga skrivningar och kööverflöde, filöverlapp, mottagarkvittens,
arkivskrivfel, avbrutna filbyten, sidindelning och bevarade claims.

## GitGuardian vid start och leverans

Läs säkerhetsstatus vid start och före commit/push enligt `AGENTS.md`.
`node tools/security-status.mjs` ger nu en samlad rapport från GitHub och den
befintliga skyddade GitGuardian-kopplingen. MCP `gitguardian.read_security_status`
ger samma rapport; registreringen finns i projektets `.codex/config.toml`.
`--github-only` gör enbart GitHub-kontrollen med befintlig
CLI-åtkomst. Om den saknas används GitHub-connectorns `github_fetch`: läs
`branches/main`, frys SHA och läs `check-runs`, `check-suites` samt `status`.
`node tools/security-status.mjs --mcp --ref <full-sha>` visar rätt GET-adresser.
Kontrollera den faktiskt levererade SHA:n igen efter push.

En kort agent-talk-notis får innehålla app/namn/status/conclusion, incidentlänk,
fil/rad och täckningslucka. Klistra aldrig in scannertext, annotation-meddelanden
eller nyckelvärden. Väntande eller saknade GitGuardian-körningar och grön vanlig
CI bevisar ingen tom incidentlista. Full API-läsning av avsett GitGuardian-workspace
kräver `incidents:read` eller en befintlig läsande koppling; skapa ingen token,
integration, schemaläggning eller bakgrundspollning automatiskt. Fortsätt de
delar av arbetet som inte påverkas och lämna den konkreta luckan till samordnaren.

Befintlig inloggad Chrome ger en praktisk reservväg: kör
`node tools/security-status.mjs --browser` för den verifierade öppna repo-vyn
i workspace `795524`. Återanvänd fliken och kontrollera valt `Source`:
`Jakeminator123/scoutgaming` (source `30689542`). Välj vid behov `Source`, sök
exakt repo-namnet och välj det; filterkopplingen verifierades 2026-10-03 och ska
kontrolleras igen vid läsning. Läs endast avgränsade ID/status/repo/fil/rad/tid,
aldrig hela rader, sidtext eller screenshots med hemliga utdrag. Ändra inga
incidenter, sparade vyer eller rättigheter. Redovisa lästa sidor och luckor;
kommandot skriver en läsplan, och webbläsarreservvägen ger ingen full API-täckning.

Rapporten visar öppna incidenter med unika fil/radreferenser och tydliga luckor.
Aktiv repositoryövervakning, PR-kontroller på en viss SHA och historiska skanningar
är separata uppgifter. `queued` på direktpush-main behöver inte betyda trasig
övervakning; `too_large` betyder att helhistorikskanningen inte slutfördes.

Verifiering av redaktion och ofullständig täckning:
`node --test test/security-status.mjs`.

## Meddelande att klistra in till andra agenter

> Vi använder nu `agent-talk` i repot. Läs `agent-talk/README.md`, kör
> `node tools/agent-talk.mjs status ditt-id` och registrera dina filer med
> `claim` innan du ändrar dem. Kontrollera tavlan före nya filanspråk och före
> commit/push. Använd `ping`/`ack` vid överlapp och `done` när du är klar.
> Behåll andras ändringar; en gammal status eller ping är inget godkännande.
> Agenter i andra grenar eller på andra datorer nås inte härifrån; använd
> teaminboxen `node tools/inbox.mjs ping --to <namn> --message "…"` (`inbox/README.md`).
