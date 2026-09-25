# Runtimekunskap – litet, versionsmärkt och utan hemligheter

`manifest.json` väljer vilken text som hör till varje roll. Director och social
får sina korta, separata JSON-kontrakt. Chat och operator får även begreppsmodell
och ett kompakt källindex. Det är egna sammanfattningar och länkar, inte en kopia
av hela OpenClaws dokumentation. Nya begrepp märks som förslag när de inte är kod.

Vid varje containerstart, även när `openclaw.json` återanvänds, synkar
`../runtime-bundle.mjs` paketet till de fem **befintligt konfigurerade** rollernas
arbetsytor. Den skapar inte nya roller eller verktygsbehörigheter. Saknad roll,
delad/extern arbetsyta och handredigerat managed block rapporteras utan att
skrivas över. Den befintliga Gateway-konfigurationen ägs inte av paketet.

I varje hanterad arbetsyta finns:

- `AGENTS.md`: ett märkt block med själva rolltexten och relevant index, inte
  bara en hänvisning till en fil som den verktygslösa modellen inte kan läsa.
- `.croupier-runtime/<version>-<sha256>/`: immutable snapshot av paketets manifest
  och källfiler. Version och SHA-256 skrivs också i startloggen, aldrig nyckelvärden.
- `.croupier-runtime/backups/AGENTS.<sha256>.md`: originalet före varje ändring.
  Text utanför blocket bevaras exakt; SOUL.md och IDENTITY.md rörs aldrig.

Redigera egna instruktioner **utanför** managed block, eller ändra paketets
källor och versionsnummer i Git. En ändring inne i blocket upptäcks via hash och
rapporteras som konflikt; den kastas inte bort. Backuper och äldre snapshots
behålls. Synken är återstartbar; en halvskriven snapshot kompletteras bara med
saknade filer och annorlunda befintliga bytes skrivs aldrig över.

## Varför AGENTS.md och inte bara en docs-mapp?

Kontrollerat mot officiell **v2026.9.5** den 20 september 2026:

- [workspace.ts](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/agents/workspace.ts):
  `WORKSPACE_BOOTSTRAP_FILENAMES` och `loadWorkspaceBootstrapFiles` läser
  AGENTS, SOUL, IDENTITY, USER, BOOTSTRAP och MEMORY. Godtyckliga indexfiler
  laddas inte automatiskt. Subagent-filter behåller AGENTS.
- [bootstrap-files.ts](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/agents/bootstrap-files.ts):
  `resolveContextInjectionMode` har normalvärdet `always`; manuellt valda
  `never` eller `continuation-skip` ändrar det. Paketet ändrar inte sådana val.
- [bootstrap.ts](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/agents/embedded-agent-helpers/bootstrap.ts):
  normala bootstrap-budgetar är 20 000 tecken per fil och 60 000 totalt.
  Filer kan trunkeras. Startsammanfattningen visar vald mode och budgetvarning.

Detta verifierar filvägen till promptkontexten, inte att en modell redan svarat
med den nya kunskapen. Efter redeploy: kontrollera startloggens rollstatus,
öppna en ny rollsession och fråga vad rollen kan respektive inte kan göra.
Vid `contextInjection: never`, ändrade bootstrap-hooks eller väldigt stora
handtexter krävs separat kontroll. Dokumenten ger ingen ny verktygsbehörighet.

`llms.txt` läses fortfarande endast vid behov av en agent som faktiskt har
verktyg/nätåtkomst. Ingen crawl, embeddings, bakgrundssynk eller docs-MCP skapas.
Den lilla lokala sammanfattningen injiceras däremot avsiktligt i rollernas
AGENTS-kontext; det är skilt från att hämta externa dokument per chatt/event.

Testa offline: `node --test open-claw/lab/deploy/runtime-bundle.test.mjs`.
Inga modellnycklar, samtal, spelardata eller lokala miljöfiler finns i paketet.
