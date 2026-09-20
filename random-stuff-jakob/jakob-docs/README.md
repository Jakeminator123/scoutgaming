# Jakobs snabbnoteringar

Tillfälliga, korta minnesnoteringar — inte en ny dokumentationsstruktur eller chattlogg. Den gemensamma dokumentationen finns fortsatt i GitLab-wikin.

## 2026-09-20 — V3 och agentkommunikation

- **Grund:** Kevins befintliga Croupier-motor/RNG används. Granskningen visade att motorn inte saknades; ”runtime-verifiering” betyder tekniskt belägg för vad som faktiskt körs.
- **Roller:** Kevin leder/integrerar, Jakob hjälper med backend och logik, Emil arbetar nära Kevin med video. Avstämning med Kevin vid etapper.
- **Canvas:** V3 korrigerades i GitHub-repot `animation-events-v1` och publicerades på [Vercel](https://animation-events-v1.vercel.app/). Namnets v1 är historiskt; V2 finns kvar som arkiv.
- **Synk:** Croupier-dokumentationen är underlag för wiki/GitHub; publicerad GitHub-version blir Vercel-sidan. Kontrollerat vid leverans, men inte automatisk dubbelriktad synk mellan tre redigerbara källor.
- **Inbox:** namngivna agenter, exakt mottagare, CC bara för kännedom. Svar kontrolleras mot originalfrågan; Emil svarar inte åt Kevin. [Gemensam guide](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox).
- **Kostnad:** delad hämtcache i 30 sekunder, egen läsmarkering per chatt, högst fem förhandsvisningar à 280 tecken. Ingen automatisk agentväckning eller hel historik till alla. 23 tester passerade.
- **Historik:** förhandsvisningar förkortas; GitLab-original raderas inte. Hanterade meddelanden lämnar chattens olästa kö. Lokal cache/läsmarkeringar har ännu ingen automatisk åldersrensning.
- **Kvar:** anslut befintlig GitLab-token lokalt, utan att skriva hemligheten här. Kevin/Emil behöver aktivera reglerna själva. Inboxändringen finns på `codex/inbox-routing-cache`; annan lokal kod följde inte med den publiceringen.

Fortsätt vid behov med någon enstaka daterad punkt här. Inga undermappar behövs ännu.
