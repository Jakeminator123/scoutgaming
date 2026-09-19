# Handoff — nästa agent (Jakob / Croupier)

Läs detta först, sedan `AGENTS.md`, `docs/PROJECT-PROMPT.md` och senaste toppen av `docs/JOHN-HANDOFF.md`. Jobba bara på `jakeminator123/work`. Pusha inte `main`. Skapa inte MR mot `main` om Jakob inte sagt det.

## Vem och var

- Produkt: Scout Live Casino, repo `scout-gg/croupier` på GitLab.
- Jakob: GitLab/GitHub `Jakeminator123`. Branch `jakeminator123/work`. Lokal kopia `C:\Users\jakem\Projects\croupier`.
- Kevin: GitLab [`Kevinnegash1`](https://gitlab.com/Kevinnegash1), Owner. Mejl `kevin.negash@scoutgaminggroup.com`. Inget hittat GitHub-konto.
- Emil: GitHub `EmaCodeHero`. Referens, inte Croupier-arbetsyta.

## Vad som är uppsatt

- SSH till GitLab fungerar. Origin är bara GitLab, inte Jakobs GitHub.
- Gemensam yta: https://gitlab.com/scout-gg/croupier/-/wikis/home
- Workflow (första canvasen, speglad i wikin): https://gitlab.com/scout-gg/croupier/-/wikis/workflow
- Canvas i Cursor: `C:\Users\jakem\.cursor\projects\c-Users-jakem-Projects-croupier\canvases\jakob-workflow.canvas.tsx`
- Referens, read-only: `C:\Users\jakem\Projects\ref\spelsajt` (push avstängd). `emil-branch` = import av `EmaCodeHero/ava-live-blackjack`. Titta, bygg om i Croupier. Ingen submodule, ingen dump.
- Cursor alwaysApply är tre rader. Inbox: `/ping-croupier` (skill), inte poll varje tur.
- Claude Code: `CLAUDE.md`. Kevin kan svara från valfri IDE.
- Lokal `.git/hooks/pre-push` stoppar push till `main`
- MR-mall: `.gitlab/merge_request_templates/Jakob.md`

## Ping

https://gitlab.com/scout-gg/croupier/-/work_items/1

Kommentar + `@Kevinnegash1`. Svara i samma tråd. Fortsätt annat arbete. Inte Slack-bot. Inte nytt issue för en snabb fråga. Jira CAC för riktiga dealer-ärenden.

## Inte klart / rör inte utan orsak

- Kevin har inte skyddat `main` på GitLab än — be honom.
- Inbjudan till `jakob@dg97.se` ska slängas (Kevin).
- Emil måste acceptera GitHub-inbjudan till `spelsajt`.
- Kevin saknar GitHub — han ska skaffa/peka ut konto för läs på `spelsajt`.
- Slack-texten till Kevin är skriven men måste skickas av Jakob (wikin notifierar inte).
- Spelet / media / dealer-sync är Kevins produktspår. Följ `AGENTS.md`. Isolerad databas. Inga påhittade visuella godkännanden.

## Kevin-meddelande (om det inte gått iväg)

Se https://gitlab.com/scout-gg/croupier/-/wikis/note-to-kevin och `docs/shared` / wikin Slack-sidan.
