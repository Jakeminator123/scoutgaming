# Jakobs snabbnoteringar

Jakobs minnesnoteringar och arbetsrapporter. Den gemensamma dokumentationen finns fortsatt i GitLab-wikin; tekniska rapporter länkas nedan. Konversationsexporter hör inte hemma här.

## 2026-09-20 — Windows-testerna

[Reparerade media-/spelartester](2026-09-20-windows-medietester.md): portabla sökvägar, Git Bash utan WSL, verifierade användarlokala testverktyg och CRLF-hantering utan ändrade medier/baseline. Alla begärda testkommandon passerar.

## 2026-09-20 — API-inbox ansluten

Jakobs egen token är installerad i en separat åtkomstskyddad lokal fil utanför Git; `GITLAB_TOKEN_FILE` är sparad i Windows användarmiljö. API-läsning och publicering verifierade. Starta om IDE:n för automatisk miljöinläsning; sandboxad åtkomst kan kräva godkänd körning. [Anslutningsinfo skickad till Kevin, CC Emil](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3870229815): egna tokens, samma gemensamma tråd. Deras anslutning/läsning är inte bekräftad. Originalfilen lämnades orörd; inga hemligheter finns i Git.

## 2026-09-20 — Chefrollen

`/chef` gör den aktuella chatten till samordnare: lägesbild → avgränsad samordning → beställd integration/test → verifierad överlämning. `/chef status` läser bara; `/chef av` släpper rollen. I Codex kan rollen väljas med `$chef`. En lokal chef per repo och dess worktrees, ingen bakgrundsagent eller automatisk push. [Rolldefinition](../../.agents/skills/chef/SKILL.md).

## 2026-09-20 — OpenClaw och labbet

[Nodträd, 64 rörelser och verifierad Render-anslutning](2026-09-20-nodtrad-rorelser-anslutning.md): hur labbet följer Kevins motor, vad som bara är exempel, vad som är testat och en separat Windows/Cursor-prompt.

[Startfil och miljöregister](../../_ENVIROMENT-INFO.md): dubbelklicka `Start-Labb.cmd` i repots rot. Alla labb-/OpenClaw-variabelnamn och deras placeringar, utan hemliga värden. Lokal `LAB_REMOTE_TOKEN` är samma värde som Directors `LAB_API_TOKEN`; inga automatiska nyckelbyten.

[Kort arbetsnotering](2026-09-20-openclaw-och-labb.md): vad som byggts, dashboard och labbeditor, Render, nycklarnas olika roller, kvarvarande integration och städningen av gamla OpenClaw-mappar.

[Mappar, tester och videokoppling](2026-09-20-labbets-mappar-och-tester.md): enkla förklaringar av policies/schema/data/test, varför inget nytt manifest behövs, Windows-felen och hur riktig OpenClaw ska verifieras.

## 2026-09-20 — Videoregister, V3-karta och lagring

[Arbetsrapport: V3, videoregister och placering](2026-09-20-v3-videoregister-och-placering.md) samlar vad vi undersökte och levererade, var de 224 originalvideorna finns, hur kartan startas, beslut om eventträdet, lagringsbedömning, kontroller, publicerade commits och vad som återstår inför verklig integration. Rapporten skiljer inventeringen från OPENCLAW-uppgiftens eget arbete.

## 2026-09-20 — V3 och agentkommunikation

- **Grund:** Kevins befintliga Croupier-motor/RNG används. Granskningen visade att motorn inte saknades; ”runtime-verifiering” betyder tekniskt belägg för vad som faktiskt körs.
- **Roller:** Kevin leder/integrerar, Jakob hjälper med backend och logik, Emil arbetar nära Kevin med video. Avstämning med Kevin vid etapper.
- **Canvas:** V3 korrigerades i GitHub-repot `animation-events-v1` och publicerades på [Vercel](https://animation-events-v1.vercel.app/). Namnets v1 är historiskt; V2 finns kvar som arkiv.
- **Synk:** Croupier-dokumentationen är underlag för wiki/GitHub; publicerad GitHub-version blir Vercel-sidan. Kontrollerat vid leverans, men inte automatisk dubbelriktad synk mellan tre redigerbara källor.
- **Inbox:** namngivna agenter, exakt mottagare, CC bara för kännedom. Svar kontrolleras mot originalfrågan; Emil svarar inte åt Kevin. [Gemensam guide](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox).
- **Kostnad:** delad hämtcache i 30 sekunder, egen läsmarkering per chatt, högst fem förhandsvisningar à 280 tecken. Ingen automatisk agentväckning eller hel historik till alla. 23 tester passerade.
- **Historik:** förhandsvisningar förkortas; GitLab-original raderas inte. Hanterade meddelanden lämnar chattens olästa kö. Lokal cache/läsmarkeringar har ännu ingen automatisk åldersrensning.
- **Kvar:** anslut befintlig GitLab-token lokalt, utan att skriva hemligheten här. Kevin/Emil behöver aktivera reglerna själva. Inboxändringen finns på `codex/inbox-routing-cache`; annan lokal kod följde inte med den publiceringen.

Lägg korta daterade noteringar här och länka längre arbetsrapporter som enstaka Markdown-filer i samma mapp. Inga undermappar behövs ännu.
