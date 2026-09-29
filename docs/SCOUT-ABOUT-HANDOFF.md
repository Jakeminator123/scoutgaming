# Scout About — 2026-09-29

## Leverans

`apps/croupier-frontend/app/about/` innehåller en svensk About-sida på
`/about`. Navigationen från startsidan och blackjackpilotens informationssida
länkar dit. Ändringen hör till GitHub-repot `Jakeminator123/github-work`,
branchen `jakemanator123-github-work` och Vercels befintliga frontendprojekt.

Loungen använder Jakobs tillhandahållna PNG och MP4, kopierade oförändrade
till `public/about/`. Bilden har fem personer; filmen visar en annan
uppställning. Därför är filmen en separat, användarstartad dialog med
uppspelningskontroller. Den hämtas först när dialogen öppnas och tas bort
när den stängs. Filmen är H.264, 1916×1080, 24 fps, 10,041667 sekunder,
utan ljudspår. Desktop har varsam pekar-/scrollparallax. Bildens fokuszoner
använder en mjuk färgspotlight medan resten blir grått.

Zonerna representerar redaktionella teman (nyfikenhet, gemenskap, teknik,
spelglädje, framåtanda), inte de avbildade personernas namn eller roller.
Hover och tangentbordsfokus förhandsvisar ett tema, klick/Enter låser det,
och Escape/stängknappen återställer bilden. Mobil/surfplatta har även
tryckbara temaknappar. `prefers-reduced-motion` stänger av parallax och
övergångar. Dialogen låser bakgrundens rullning och återställer fokus vid
stängning.

## Källor och faktagräns

Lästa 2026-09-29:

- [Scout Gaming](https://scoutgaminggroup.com/): produktområden och kontor.
- [Om Scout](https://scoutgaminggroup.com/about): grundat 2013 i Stockholm,
  Impact Win som ny ägare 2026 och nytt ledarskap.
- [Fantasy](https://scoutgaminggroup.com/fantasy): drafts, pick’em, ligor.
- [AI casino](https://scoutgaminggroup.com/ai-casino): under utveckling.

Sidan återger inte lanseringsdatum, licens-/RNG-garantier, påhittade
teamidentiteter eller påståenden om färdig real-money-produkt. Den lokala
blackjackprodukten beskrivs som pilot. Originalfilerna ligger kvar på
Desktop respektive Videos. Inga extra genererade personbilder används.

## Verifiering

- Separat TypeScript-kontroll (`tsc --noEmit`) passerade. Produktionsbygget
  passerade lokalt och på Vercel. Routens första JS-last är cirka 115 kB.
- Första QA-versionen i befintliga `croupier-landing-preview-qa`:
  deployment `dpl_5fMjtVmjXoJCX6uaTJbY9bJuxGDb`, READY. Vercels
  förhandsvisningsskydd är kvar. QA:s spellänk pekar på den befintliga
  isolerade spel-Previewn; ingen spelrunda startades.
- Chromium: 1440×1000 desktop och 390×844 mobil visuellt granskade;
  320 px och 768 px utan horisontell sidöverströmning. Fem fokuszoner,
  gråskalning, temaknapp på mobil, Enter/Escape och minskad rörelse provade.
- Filmen laddades inte före klick, spelade alla 10,04 sekunder, stängdes
  med Escape, återställde fokus till startknappen och släppte scrolllåset.
  Inga sidfel eller nya konsolfel i About-kontrollen.
- Tabletgranskningen ledde till att texten placerades under hela bilden
  upp till 900 px; startsidans utökade meny växlar vid 1024 px.
  Slutlig QA-version `dpl_GNzCKgBef24ijcJzhXwqtrHswoKX` är READY;
  den justerade 768-px-layouten och samtliga fem klickzoner verifierades där.
- `node pipeline/audit-dealer-sync.mjs --probe` passerade. Kända saknade
  tal-takes kvarstår: Vera 8, Amira 2, Mei 3. Detta är inte läppsynkacceptans.

Ingen spelarkod, databas, dealerfilm, hashbaslinje, Lab-policy eller lokal
server ändrades. Fyra-dealer-rehearsal är därför inte en acceptanskontroll
för denna fristående marknadssida. Befintliga smutsiga media-/Lab-filer och
ändringarna i `JOHN-HANDOFF.md` hör till annat pågående arbete och bevaras.
Inget Jira-ärende angavs för den nya sidan och ingen Jira-anslutning fanns
tillgänglig; inga CAC-statusar ändrades. Fysisk iOS-/Android-kontroll återstår.

Screenshots är privata QA-filer utanför Git i chattens visualiseringsmapp.
