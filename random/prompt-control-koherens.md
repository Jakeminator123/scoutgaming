# Prompt: koherens i /control (klistra in i en ny chatt)

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main` (GitHub `Jakeminator123/scoutgaming`). Läs `AGENTS.md`, `CLAUDE.md`, `random/handoff-2026-10-07.md` och `random/beslutsmatris-2026-10-07.md` först. Underagenter kör `grok-4.7-xhigh-fast` enligt `.cursor/rules/subagents.mdc`; varje rapport slutar med `Tveksamt`. Kör `node tools/agent-talk.mjs status <ditt-id>` vid start och `node tools/inbox.mjs list --to me` om `gh` är inloggat.

## Problemet

Nivå 1 (`/control`) har Johns nya skal (`lab/components/workspace-navigation.tsx`, `lab/lib/scout-navigation.mjs`) och en sidmall (`lab/components/page-template.tsx`). Under skalet ligger två generationer av Studio som inte hänger ihop:

| Generation | Komponent | Sidor | Egen navigation |
|---|---|---|---|
| Ny | `lab-studio.tsx` + sidmall | `/control/clips` (Dealers & klipp: Idle, Kort & deal, Fasta repliker, Bakgrund, Probe) | Nej, följer skalet |
| Ny | `openclaw-workspace.tsx` + sidmall | `/control/openclaw` (Agentmodeller) | Nej |
| Ny | `studio-administration.tsx` + sidmall | `/control/administration` (sex flikar) | Flikar |
| Gammal | `studio.tsx` via `app/studio-page.tsx` (`StudioPage view=…`) | `/control/events` (view `lab`), `/control/tree`, `/control/videos`, `/control/activity`, `/control/probe`, `/control/guide`, `/control/operator-chat` (view `openclaw`) | Ja: egen `event-sidebar` med spelväljare, dealer-`<select>`, eventsök, och `changeView()` som byter vy utan att byta URL |
| Egen | `background-zones.tsx` | `/control/zones` | Egen header |
| Översikt | `control-workspace.tsx` | `/control` | Kort |

## Fynd att åtgärda (inventering 7 okt 2026)

1. **Dubbel navigation.** På de sju `studio.tsx`-sidorna finns både skalets sidomeny och den gamla `event-sidebar`. `changeView('tree')` inuti `studio.tsx` byter innehåll utan att skalets aktiva menyrad eller URL följer med.
2. **Probe finns på tre ställen:** `/control/probe` (`ProbeEditor` i `studio.tsx`), fliken Probe i `/control/clips`, och fliken Talgranskning i `/control/administration`. Sidomenyn säger Talgranskning → `/control/probe`.
3. **OpenClaw finns två gånger med olika innehåll:** Agentmodeller `/control/openclaw` (nya) och Operatörschatt `/control/operator-chat` som renderar `StudioPage view="openclaw"` (gamla, med Gateway-panel). Namnen i menyn skiljer, koden inte.
4. **Händelser vs Händelser → klipp:** `/control/events` (eventklippredigeraren, view `lab`) och `/control/tree` (`FamilyOverview`/`EventTree`) överlappar och länkar in i varandra via `changeView`.
5. **Bakgrund på tre ställen:** fliken Bakgrund i `/control/clips`, `/control/zones` (Bakgrundszoner), och det gamla alias `/control/backgrounds` → `/control/clips#background`.
6. **Administrationens flikar dubblerar menyn:** flik Partner vs menyrad Partners (`/partner`); flik Talgranskning vs menyrad Talgranskning.
7. **Döda Kevin-slugs under `/control`:** `pit-bosses`, `presentation`, `table-design`, `roulette`, `baccarat`, `preview`, `statistics`, `reports`, `generations` renderar översikten med en notis "exempelvyn är inte ansluten" (`lab/lib/workspace-surfaces.mjs` `CONTROL_PREVIEW_VIEWS`, `lab/lib/control-workspace.mjs`). Femton andra slugs omdirigerar till riktiga verktyg. Avgör vilka som ska bort ur `CONTROL_PREVIEW_VIEWS`; behåll omdirigeringarna.
8. **UI-löften utan funktion:** spelväljaren i `studio.tsx` har "Roulette · Senare" avstängd; sökfältet i skalets topprad är en attrapp (rad 15 i matrisen); dold dealer-`<select>` bakom chipsen i `lab-studio.tsx` (rad 10).
9. **Titlar:** de flesta säger "· Croupier Studio", administrationen "· ScoutGamingGroup". Enas om en.

## Mål

En generation. Varje `/control`-sida använder sidmallen, följer skalets meny och har exakt en plats för varje funktion. Inga sidor som byter innehåll utan att byta URL.

## Ordning

1. **Inventera och föreslå, inga ändringar.** Tabell: funktion | finns i dag på | föreslagen enda plats | vad försvinner | risk. Jakob godkänner per rad. Rad 1 i matrisen (administrationens flikar som djuplänkar) och rad 12 hör hit.
2. **Flytta `studio.tsx`-vyerna till sidmallen en i taget**, i den ordningen: `tree`, `videos`, `activity`, `guide`, `events`, `probe`, `operator-chat`. Varje flytt: egen commit, `changeView` ersätts med riktiga länkar (`labUrl('/control/…')`), `event-sidebar` tas bort från den vyn, befintliga tester för vyn uppdateras mot verifierat beteende. `studio.tsx` krymper tills bara det återstår som ingen sida använder; då tas det bort.
3. **Slå ihop dubbletterna** efter Jakobs beslut i steg 1: Probe, OpenClaw, Bakgrund, Händelser.
4. **Rensa `CONTROL_PREVIEW_VIEWS`** till de slugs som omdirigerar.

## Regler

- Ingenting får bli sämre: ingen länk, åtgärd eller sida som en användare når i dag får försvinna utan en omdirigering eller ett beslut från Jakob. Ett rött befintligt test återställs, det skrivs inte om för att bli grönt.
- Rör inte spelmotor, plånbok, media, dealer-synk, `web/`, `pipeline/`, `media/`. Rör inte `lab/components/kevin-bo/` (Kevins kod; eget spår) utöver slugs i `workspace-surfaces.mjs`.
- Design följer John: `lab/app/scout-theme.css`, en lime-knapp per sida, 40 px-kontroller, tomlägen med knapp i stället för text. Svenska i UI.
- Verifiera i produktion inloggad som `LLM` efter varje push (offline-labbet ger 500 på Neon-sidor). Skärmbild per flyttad sida.
- Efter varje ändring: `npm --prefix lab test`, `npm --prefix lab run typecheck`, `npm --prefix lab run build`, `node docs/system-map/verify.mjs`. Uppdatera kartans baseline (`--refresh-baseline`) bara när en ruttändring är avsiktlig. Pre-commit-kroken stoppar lokalt på två ffmpeg-tester om ffmpeg saknas; CI har det.
- Leverera med `node tools/push-github-work.mjs`. Inga andra grenar. Uppdatera `docs/JOHN-HANDOFF.md` (översta tabellen plus ett kort avsnitt) och `random/beslutsmatris-2026-10-07.md` vid varje leverans.
- Inga hemligheter. Inga nya Markdown-filer i `docs/`.

## Rapportformat

Kort. Tabell för inventeringen, en rad per flyttad vy, sist `Tveksamt` med varje beslut Jakob ska se.
