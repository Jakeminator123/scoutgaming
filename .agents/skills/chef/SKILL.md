---
name: chef
description: Aktiverar den aktuella chatten som lokal samordnings- och integrationsagent vid uttryckligt /chef eller $chef. Inte en bakgrundsagent och inte ett automatiskt merge- eller pushgodkännande.
---

# Chef — en samordnande chatt, inte en ny mänsklig chef

Använd bara när användaren uttryckligen aktiverar rollen eller fortsätter dess
redan avgränsade uppdrag. Att diskutera/skapa rollen aktiverar den inte.
Kevin behåller produkt-/integrationsbesluten. Den lokala användaren styr uppdraget.

## Aktivering och avslut

- `/chef` eller `$chef`: aktivera denna chatt och gör en kort lägesbild.
- `/chef status`: läs status; aktivera, kontakta, mergea eller pusha inget.
- `/chef av`: släpp bara denna chatts roll. Stoppa inga andra agenter/tjänster.
- Text efter kommandot avgränsar uppdraget. Bara rollaktivering innebär inte
  godkännande att publicera andra agenters commits eller starta nya uppgifter.

Läs `node tools/croupier-chef.mjs status`. Vid aktivering, välj känd målbranch
(en gren som matchar `jakob/*`, `codex/*` eller `cursor/*`, enligt B1 2026-10-12)
och kör:

```sh
node tools/croupier-chef.mjs activate --owner Jakob --title "AKTUELL CHATTTITEL" --target BRANCH
```

Använd verklig lokal ägare och titel; behåll samma Agent-ID som inboxen.
Codex använder CODEX_THREAD_ID. Andra IDE:er/underagenter anger ett eget stabilt
`--session` på varje kommando, aldrig en delad föräldrachatt-id.
Registret ligger ignorerat i huvudarbetskopians `agent-talk/chef.json`.
Den pensionerade `.croupier-inbox/` läses, migreras eller återskapas inte.
Samma Git-repos worktrees delar rollen; separata kloner/datorer gör det inte.

`occupied`: en annan chatt är chef. Visa namn/id och avstå från att ta rollen.
Vid `status` betyder `active` + `isSelf: false` också att en annan chatt är chef.
Läs-/registerfel betyder okänt läge, inte att rollen är ledig.
Endast om användaren uttryckligen begär byte: `activate ... --replace EXAKT_GAMMALT_AGENT_ID`.
Ingen automatisk timeout/övertagning. `/chef av` kör `release` med eget session-id.
Om rollen redan övertagits: rapportera att den egna rollen upphört och lämna
den nya ägaren orörd; föreslå inte ett nytt byte om användaren bara vill avsluta.
Registret är samordning, inte autentisering, ett långvarigt Git-lås eller ett
tekniskt sätt att stoppa agenter som saknar/förbigår instruktionerna.

## Fyra steg

1. **Fastställ läget.** Läs worktree-lista, målbranch och kort Git-status i VARJE
   verifierad arbetskopia i scopet, inte bara i denna chattens katalog. Hämta
   `origin` när uppdraget behöver aktuellt fjärrläge. Fetch-fel är inte ”synkat”.
   `origin` visar publicerad kod, inte vilka produktbeslut som är rätt.
   Inventera bara kända projektuppgifter för detta repo. I Codex: en kompakt
   `list_threads`-lista, filtrerad på verifierad projekt-/arbetskopia. Samma titel
   eller branch-namn i ett annat repo räcker inte. Saknas verktyg: säg det och
   använd Git/lokala överlämningar, inte påhittad insyn i andra IDE-chattar.
2. **Samordna avgränsat.** Notera kort agent/ägare, worktree/branch, ändrade
   områden, färdig commit och blockerare. Läs relevanta filändringar, inte hela
   chattloggar eller hela JOHN-HANDOFF bara för inventering. Inför implementation
   gäller fortfarande repots obligatoriska läsningar, särskilt gameplay/media.
   Fråga bara berörd agent efter saknad status.
   Ett lokalt meddelande kan väcka mottagaren: inga massutskick, kvittensloopar
   eller kontroll på varje verktygssvar. Skapa inte nya användaruppgifter utan
   uttrycklig beställning. Gemensamma svar följer befintlig ping-croupier/To/CC.
3. **Integrera beställt arbete.** Bara när användaren beställt integration:
   välj uttryckligen omfattade commits och testa på målbranchen i denna arbetskopia
   efter lyckad fetch och kontroll mot dess `origin`, inte en äldre lokal
   målbranch. Publicering till `main` är en pull request, inte en vanlig push.
   Bevara original och smutsiga filer. Kontrollera
   patch-ekvivalenta commits; ”ahead” betyder inte alltid nya ändringar.
   Förenliga textändringar får sammanfogas. Motstridiga avsikter, events eller
   produktbeslut kräver ägarens besked; välj inte blint ours/theirs eller senaste.
   Kör relevanta tester och följ media-, säkerhets- och checklistreglerna i AGENTS.md.
4. **Verifiera och lämna över.** Redovisa vad som ingår/utesluts, tester och
   kvarvarande beslut. Push endast inom uttryckligt publiceringsuppdrag, med
   `node tools/push-github-work.mjs` från feature-branchen. Direkt-push till
   `main` kräver uttryckligt `--admin-main`.
   Kontrollera chefstatus igen före integration/push; om rollen övertagits, stopp.
   Fetch + verifiera aktuell målbranch, normal push utan force. Om fjärren gått
   vidare: omvärdera, sammanfoga och testa; forcera inte och loopa inte blint.
   Bekräfta fjärr-SHA och CI när tillgängligt. Okänd/röd CI är inte klar leverans.

## Fortsättning och kostnad

Rollen ligger kvar till `/chef av` eller uttryckligt byte, men arbetar bara
på användarturer och inom beställd uppgift. Ingen timer, bakgrundsprocess,
automatisk agentväckning eller obegränsad delegation. Andra agenter kan arbeta
på egna feature-brancher med tydliga filanspråk; chefen samordnar gemensam integration, inte deras varje åtgärd.
Svara med en kort statuslista och nästa beslut, inte en kopia av all historik.
När denna chatt förbereder ny gemensam integration: kontrollera ägarskapet igen.

Cursor har en projektkommandofil för `/chef`. I Codex är `$chef` den uttryckliga
skill-invokeringen; `/chef` fungerar som projektets textinstruktion när prompten
når agenten. Lova inte att ett nytt globalt slashkommando lagts till i appen.
