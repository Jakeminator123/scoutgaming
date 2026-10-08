# Prompt C5b: select för alla fyra dealers (K steg 3b)

Kör i en egen agent/chatt **med Jakob närvarande** – passet slutar i rehearsal som bara en
människa kan godkänna. **Modell: Claude Opus 5.5 (max)** (medieaccept-reglerna i
`AGENTS.md` är stränga och lätta att bryta). Orkestratorn granskar före merge.

Skriven 8 okt 2026 av orkestrator 2 efter `79737a5d`. Checklista: C5b, C7, B6 låses upp.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md` (avsnittet
Dealer speech, media, cards, and wallet – hela), `docs/JOHN-HANDOFF.md`,
`docs/ENVIRONMENT-RESTORATION.md`, `random/k1-fakta-spelvagen-2026-10-08.md`,
`random/k2-forslag-2026-10-08.md` (Steg 3 i två delar, 3b), `random/beslutsmatris-2026-10-07.md`
rad 49–53, `random/checklista-2026-10-08.md` C5b/C7. Ingen commit/push/branch utan
orkestratorns ord. Agent-talk-id `c5b-select`: `node tools/agent-talk.mjs status c5b-select`
vid start, var 30:e sekund, före rapport. Lokala servrar: `node lab/start.mjs --no-open`
enligt `AGENTS.md`; en serverpar åt gången.

## Nuläge (fakta, K1)

- Produktion följer **system A**: `gameLane: mobile-phone` → `presentation=local` →
  `POST /api/presentation/select` (`web/presentation-api.mjs:106`) – men bara för Astrid.
- Vera, Amira, Mei spelas av originalmotorn (system B, `legacyClipPolicy`);
  `clip-mapping.mjs` är katalog (`actualPlayback:false`), spelar inte.
- Frekvens per klipp bor i A (`mediaPolicy.frequencyPercent`).
- Beslut 49–53: ett system. 3b = select för alla fyra dealers; `legacyClipPolicy` blir
  standardvarianter i A. Ingen media rörs, inga filbyten (ny hash ogiltigförklarar synk).

## Mål

1. `presentation-api.mjs`: `select` gäller alla fyra dealers. Dealer-id valideras mot
   `project.dealers`; Astrids väg ska ge **byte-identiskt** svar som i dag för samma
   indata (snapshot-test före/efter).
2. Varje `legacyClipPolicy`-regel för Vera/Amira/Mei översätts till en standardvariant i
   A (`lines[].variants[]` med `videoGenerationId`, `selection`, `triggerIds`) via ett
   idempotent migreringssteg i Studio-modellen (`lab/lib/studio-model.mjs`,
   `normalizeProject`): körs vid läsning, skriver inget förrän admin sparar. Original-
   fältet `legacyClipPolicy` lämnas kvar och läses inte längre av spelvägen när A täcker
   dealern. Dokumentera mappningen rad för rad i rapporten.
3. Spelklienten (`web/public/app.mjs` + presentation-runtime) kallar `select` för alla
   dealers när `presentation === 'local'`; `gameLaneFromDocument` tillåter `local` för
   fler än Astrid **bara** när serverns katalog säger att lanen är `portrait-video` för
   den dealern. Rör inte `shoe-game.mjs`, wallet, kort.
4. `node pipeline/audit-dealer-sync.mjs --probe` grönt. Alla `.githooks/pre-commit`-tester
   gröna.

## Rehearsal (med Jakob, inte agenten)

För var och en av `astrid`, `vera`, `amira`, `mei`: öppna
`/blackjack?dealer=<namn>&rehearsal=1`, spela **två spel i rad**, notera per replik:
text, ljud, video, synk, start/stopp. Fyll tabellen i rapporten. Ingen rad får markeras
godkänd av agenten från hash, waveform eller testpass – bara från Jakobs ögon/öron.
Astrid ska se ut exakt som före passet.

## Rapport

Tabell Åtgärd | Status | Verifierat hur | Risk %. Mappningstabell legacy-regel →
variant. Rehearsal-tabell per dealer (fylld av Jakob). **Tveksamt**: varje punkt där
agenten gissat, särskilt varianter som saknar klipp i manifestet, och om något i Astrids
svar ändrats.
