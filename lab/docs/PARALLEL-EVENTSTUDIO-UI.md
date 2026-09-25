# Uppdrag för parallell UI-agent: gör Eventstudion lugnare

Kopiera texten nedan till en separat agent. Den beskriver en avgränsad
presentationsuppgift som kan göras parallellt med tal-, läppsynk- och spelararbete.
Kontrollera alltid aktuellt arbetsläge först: grundstädningen i dessa komponenter
kan redan finnas. Bygg vidare på verklig kod, gör inte om färdigt arbete.

---

Arbeta i `C:/Users/jakem/Projects/croupier`. Läs tillämpliga `AGENTS.md`,
`lab/docs/README.md` och installerade Next-dokument om klientkomponenter och CSS.
Bevara andra agenters och användarens ändringar. Samordna filägarskapet innan
du börjar. Gör inga commits eller pushar utan överlämna diffen till huvudagenten.

## Målet

Eventstudion ska i första hand visa vald videofamilj, dess riktiga klipp och dess
varianter. Det ska vara uppenbart vad som är direkt förhandsvisning, ett simulerat
variantval, ett separat chattprov och faktiskt mottagen speldata. Ingen ny
inställningssida eller dubblerad chattyta ska skapas.

## Din del

- Förenkla `lab/components/event-test-panel.tsx` och dess CSS-modul:
  välj urvalsläge, kör test, se resultat. Testkontext, alla lägesförklaringar,
  tekniska kvitton och pedagogiska demonstrationer ska vara åtkomliga men inte
  dominera standardvyn.
- Förenkla `lab/components/social-chat-panel.tsx` och dess CSS-modul:
  ett tydligt märkt separat chattprov. Panelen kan vara hopfälld vid deal/replik
  och öppnas vid Astrids vänteläge. Behåll oskickad text och osparad policy när
  panelen fälls ihop. Visa pågående anrop, stopp och fel även om panelen är stängd.
- Använd delade `modeLabels`/`modeExplanations` från `lib/director-modes.mjs`.
  Lägena väljer en klippvariant, inte en chattmodell eller ett spelresultat:
  Standard spelar standardfilen; Regler väljer högst prioriterat tillåtet
  alternativ; OpenClaw får föreslå tillåtet alternativ; Skuggläge loggar
  modellförslaget men spelar standard. Slumpvariation finns också och är lokal
  presentationsslump, inte kortens RNG. Ändra inte internvärden eller beteende.
- Gör paneler läsbara på bred skärm utan långa tomma rader, med god kontrast,
  tangentbordsfokus och enkolumnsläge på liten skärm.
- En tidsstyrd illustration får inte kallas verifierad startpositionsgrind eller
  verklig uppspelning. Märk den uttryckligen som pedagogisk demo.

## Gränser

Huvudagenten äger `stage.tsx`, `game-stream.tsx`, `reference-capture.tsx` och
deras CSS, spelare, uppspelningskö, pose-grind, ljud/läppsynk, API:er och
manifest-/familjemappning. Redigera inte dessa eller server-/providerfiler,
nycklar, media, sparade projekt eller deploykonfiguration. Byt inte
OpenAI-provider. Ändra inte säkerhetsgränser eller när tal får starta.

Ta inte bort funktioner för att få en renare bild. Använd tillgängliga,
tydligt namngivna utfällbara sektioner. Ändra inte policy eller kör nätverksanrop
bara för att någon öppnar, stänger eller läser hjälpen.

## Verifiering och överlämning

1. Kör berörda komponenttester inklusive social chatt och Eventstudio-rendering.
   Testa att hopfällning bevarar text/policy, att idle öppnar chatten och att
   öppna/stänga paneler inte skickar meddelanden eller skapar ljud.
2. Kör `npm --prefix lab run typecheck`. Starta inte en konkurrerande build
   medan huvudagenten bygger eller använder samma `.next`.
3. Samordna browser-QA med huvudagenten: kontrollera deal, replik och idle på
   cirka 1440 px och 390 px. Kontrollera tangentbord, öppna/stänga inställningar,
   osparat utkast, felmeddelanden och faktiskt testresultat. Mock/render-tester
   är inte bevis för att den verkliga layouten är granskad.
4. Leverera exakta ändrade filer, verkliga testresultat, eventuell kvarvarande
   browser-QA och en kort beskrivning av synliga förändringar. Påstå inte att
   chatt, lipsync eller nativeuppspelning har integrerats genom UI-städningen.

---
